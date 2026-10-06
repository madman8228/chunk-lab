import { AiDraftCodec } from './draft-codec.mjs';
import { AuthoringSession } from './session.mjs';
import { CourseCapabilityCatalog } from './capabilities.mjs';
import { CourseCreationPreferences } from './preferences.mjs';
import { convertLegacyAiCourse } from './legacy-conversion.mjs';
import { CourseTypeCatalog } from './course-types.mjs';
import { composeMistakePrompt } from '../mistake-review/prompt-composer.mjs';

export class CourseAuthoringService {
  constructor({ sessionRepository, courseGateway, schemaValidator, promptComposer, draftValidator, compiler, imageDraftValidator = null, imageCompiler = null, imageFileReader = null, imageBundleCodec = null, imagePackageAdapter = null, io, scopeGuard, now = Date.now }) {
    this.sessionRepository = sessionRepository;
    this.courseGateway = courseGateway;
    this.schemaValidator = schemaValidator;
    this.promptComposer = promptComposer;
    this.draftValidator = draftValidator;
    this.compiler = compiler;
    this.imageDraftValidator = imageDraftValidator; this.imageCompiler = imageCompiler; this.imageFileReader = imageFileReader; this.imageBundleCodec = imageBundleCodec; this.imagePackageAdapter = imagePackageAdapter;
    this.io = io;
    this.scopeGuard = scopeGuard;
    this.now = now;
    this.capabilityCatalog = CourseCapabilityCatalog;
    this.codec = new AiDraftCodec();
    this.pending = new Map();
  }

  async open({ sessionId, sourceCourseId = '', brief = '', reviewContext = null }) {
    const scope = this.scopeGuard.capture();
    let saved = sessionId ? await this.sessionRepository.load(sessionId, scope) : null;
    this.scopeGuard.assert(scope);
    if (saved) return saved;
    const id = sessionId || this.io.newId();
    const courseId = `ai-${this.io.newId()}`;
    let example = null;
    if (sourceCourseId) { try { example = await this.courseGateway.loadExample(sourceCourseId, scope); } catch (error) { example = null; } }
    this.scopeGuard.assert(scope);
    const preferences = reviewContext ? { ...CourseCreationPreferences.defaults(), courseType: 'sentence' } : CourseCreationPreferences.defaults();
    const session = new AuthoringSession({ ...AuthoringSession.create({ sessionId: id, courseId, identity: scope, sourceCourseId, now: this.now() }).value(), brief, reviewContext, preferences, example });
    await this.sessionRepository.save(session.value(), scope, 0);
    return session.value();
  }

  async createPrompt(sessionId) {
    const scope = this.scopeGuard.capture();
    const snapshot = await this.sessionRepository.load(sessionId, scope);
    this.scopeGuard.assert(scope);
    if (!snapshot) throw new Error('制作草稿不存在，请重新开始。');
    if (snapshot.reviewContext && snapshot.reviewContext.task === 'practice') return composeMistakePrompt('practice', snapshot.reviewContext.publicPack, snapshot.preferences);
    return this.promptComposer.composeCreation({ brief: snapshot.brief, example: snapshot.example, preferences: snapshot.preferences });
  }

  async importFile(sessionId, text) { return this.acceptText(sessionId, text); }

  async revisePrompt(sessionId, brief) {
    const snapshot = await this.#load(sessionId);
    const session = new AuthoringSession(snapshot).transition('revisePrompt', { brief: String(brief || '').slice(0, 1200), rawResult: '', validatedDraft: null, validationReport: null, lastError: null });
    await this.#save(session); return session.value();
  }

  async updateBrief(sessionId, brief, expectedRevision) {
    const snapshot = await this.#load(sessionId, expectedRevision);
    return this.#save(new AuthoringSession(snapshot).updateBrief(brief));
  }

  async updatePreferences(sessionId, preferences, expectedRevision) {
    const snapshot = await this.#load(sessionId, expectedRevision);
    if (snapshot.reviewContext && snapshot.reviewContext.task === 'practice' && preferences.courseType !== 'sentence') throw new Error('错题针对性练习仅支持句子课程。');
    return this.#save(new AuthoringSession(snapshot).updatePreferences(preferences));
  }

  async markPromptCopied(sessionId) {
    const snapshot = await this.#load(sessionId);
    if (snapshot.stage !== 'setup') return snapshot;
    return this.#save(new AuthoringSession(snapshot).transition('copySucceeded'));
  }

  async copyPrompt(sessionId) {
    const prompt = await this.createPrompt(sessionId);
    try { await this.io.clipboard.write(prompt); } catch (error) { return { copied: false, prompt, error: '无法自动复制，请选中文本后手动复制。' }; }
    const snapshot = await this.#load(sessionId);
    if (snapshot.stage === 'setup') return { copied: true, prompt, session: await this.#save(new AuthoringSession(snapshot).transition('copySucceeded')) };
    return { copied: true, prompt, session: snapshot };
  }

  async acceptText(sessionId, input, imageFiles = []) {
    const snapshot = await this.#load(sessionId);
    const sourceText = String(input || '');
    let parsed = this.codec.parseText(sourceText);
    if (!parsed.ok && parsed.error.code === 'INPUT_TOO_LARGE' && this.imageBundleCodec) {
      const bundle = this.imageBundleCodec.parseText(sourceText);
      if (bundle.ok || sourceText.includes('"chunklab-ai-image-bundle"')) parsed = bundle;
    }
    if (!parsed.ok) {
      const safeText = new TextEncoder().encode(sourceText).byteLength <= 256 * 1024 ? sourceText : '';
      const failed = new AuthoringSession(snapshot).transition('validationFailed', { rawResult: safeText, validationReport: { valid: false, issues: [{ code: parsed.error.code, path: '', severity: 'error', message: parsed.error.message, suggestion: '复制“修复指令”，让 AI 只返回一个完整课程对象。' }] }, lastError: parsed.error.message });
      return this.#save(failed);
    }
    let draft = parsed.value;
    if (draft && draft.format === 'chunklab-ai-image-bundle') {
      try {
        if (!this.imageBundleCodec) throw new Error('图文课程文件解码器未就绪。');
        const decoded = await this.imageBundleCodec.decode(draft); draft = decoded.draft; imageFiles = decoded.files;
      } catch (error) {
        return this.#save(new AuthoringSession(snapshot).transition('validationFailed', { rawResult: '', validationReport: { valid: false, issues: [{ code: 'INVALID_IMAGE_BUNDLE', path: '课程文件', severity: 'error', message: error.message, suggestion: '重新下载课程文件，或导入 AI 生成的 JSON 并单独选择图片。' }] }, lastError: null }));
      }
    }
    const type = CourseTypeCatalog.detect(draft);
    if (!type) {
      const report = { valid: false, issues: [{ code: 'UNSUPPORTED_COURSE_TYPE', path: 'format', severity: 'error', message: '课程形式不受支持。', suggestion: '请选择句子课程或图文课程的规范重新生成。' }] };
      return this.#save(new AuthoringSession(snapshot).transition('validationFailed', { rawResult: String(input || '').slice(0, 256 * 1024), validationReport: report, lastError: null }));
    }
    if (type === 'imageText') {
      if (!this.imageDraftValidator || !this.imageCompiler || !this.imageFileReader) throw new Error('图文课程模块尚未就绪。');
      let supplied = [];
      try { supplied = await Promise.all(Array.from(imageFiles).map((file) => this.imageFileReader.read(file))); }
      catch (error) {
        return this.#save(new AuthoringSession(snapshot).transition('validationFailed', { rawResult: String(input || '').slice(0, 256 * 1024), validationReport: { valid: false, issues: [{ code: 'INVALID_IMAGE_FILE', path: 'images', severity: 'error', message: error.message, suggestion: '按图片限制重新选择 PNG、JPEG 或 WebP 文件。' }] }, lastError: null }));
      }
      const report = this.imageDraftValidator.validate(draft, supplied);
      const common = { rawResult: this.codec.serialize(draft), validatedDraft: report.valid ? report.canonicalDraft : null, validationReport: report, compiledCourse: null, lastError: null };
      if (!report.valid) return this.#save(new AuthoringSession(snapshot).transition('validationFailed', common));
      const images = draft.images.map((entry) => {
        const file = supplied.find((image) => image.name.toLowerCase() === entry.fileName.toLowerCase());
        return { key: entry.key, mimeType: file.mimeType, extension: file.extension, sha256: file.sha256, dataUri: file.dataUri };
      });
      const compiled = this.imageCompiler.compile(draft, { courseId: snapshot.courseId, images });
      const next = new AuthoringSession(snapshot).transition('acceptResult', { ...common, compiledCourse: compiled.course, compiledAssets: compiled.assetRefs });
      return this.#save(next, { assets: draft.images.map((image) => {
        const file = supplied.find((entry) => entry.name.toLowerCase() === image.fileName.toLowerCase());
        return { id: image.key, blob: file.blob, metadata: { name: file.name, mimeType: file.mimeType, size: file.size, width: file.width, height: file.height, sha256: file.sha256 } };
      }) });
    }
    const report = this.draftValidator.validate(parsed.value, snapshot.stage === 'waiting-result' ? snapshot.preferences : null);
    const common = { rawResult: String(input || ''), validatedDraft: report.valid ? report.canonicalDraft || parsed.value : null, validationReport: report, compiledCourse: null, lastError: null };
    if (!report.valid) return this.#save(new AuthoringSession(snapshot).transition('validationFailed', common));
    const course = this.compiler.compileDeck(report.canonicalDraft || parsed.value, { deckId: snapshot.courseId });
    return this.#save(new AuthoringSession(snapshot).transition('acceptResult', { ...common, compiledCourse: course, compiledAssets: null, validationReport: { ...report, mismatchAccepted: !(report.issues || []).some((item) => item.code === 'PREFERENCE_MISMATCH') } }));
  }

  async prepareLegacyConversion(sessionId, legacyCourseId) {
    const snapshot = await this.#load(sessionId);
    const source = await this.courseGateway.loadLegacyAiCourse(legacyCourseId, snapshot.identity);
    this.scopeGuard.assert(snapshot.identity);
    if (!source) throw new Error('找不到要转换的旧 AI 课程。');
    const conversion = convertLegacyAiCourse(source.course, { chunkShape: this.draftValidator.chunkShape, preferences: snapshot.preferences, validator: this.draftValidator });
    const issues = [
      ...conversion.report.blockers.map((item) => ({ code: item.code, path: '课程', severity: 'error', message: item.message, suggestion: '返回旧课程保持原样，或使用 AI 制作工作台生成符合当前练习要求的新版本。' })),
      ...conversion.report.warnings.map((item) => ({ ...item, path: '课程内容', severity: 'warning', suggestion: '旧课程不会被删除；检查预览后再确认转换。' }))
    ];
    if (!conversion.draft) {
      return this.#save(new AuthoringSession(snapshot).transition('validationFailed', { conversionReport: conversion.report, validationReport: { valid: false, issues }, rawResult: '', compiledCourse: null, validatedDraft: null }));
    }
    const compiledCourse = this.compiler.compileDeck(conversion.draft, { deckId: conversion.report.plan.deckId,
      catalogCourseId: conversion.report.plan.catalogCourseId, legacySource: conversion.report.plan.legacySource, lineIds: conversion.report.plan.lineIds });
    return this.#save(new AuthoringSession(snapshot).transition('acceptResult', { courseId: conversion.report.plan.deckId,
      conversionReport: { ...conversion.report, history: source.progress || conversion.report.history }, validatedDraft: conversion.draft,
      validationReport: { valid: true, supportedModes: conversion.draft.learning.modes.map((id) => ({ id, enabled: true })), issues }, compiledCourse, rawResult: '' }));
  }

  async getRepairPrompt(sessionId) {
    const snapshot = await this.#load(sessionId);
    return this.promptComposer.composeRepair(snapshot.rawResult, snapshot.validationReport);
  }

  async getSession(sessionId) { return this.#load(sessionId); }

  async getPreviewImageUrls(sessionId) {
    const snapshot = await this.#load(sessionId);
    if (!snapshot.compiledAssets || !this.imagePackageAdapter) return {};
    return this.imagePackageAdapter.previewUrls(snapshot.compiledAssets, await this.sessionRepository.loadAssets(sessionId, snapshot.identity));
  }

  async acceptModeMismatch(sessionId) {
    const snapshot = await this.#load(sessionId);
    if (!(snapshot.validationReport && (snapshot.validationReport.issues || []).some((item) => item.code === 'PREFERENCE_MISMATCH'))) return snapshot;
    return this.#save(new AuthoringSession(snapshot).transition('acceptResult', { validationReport: { ...snapshot.validationReport, mismatchAccepted: true } }));
  }

  async backToSetup(sessionId) {
    const snapshot = await this.#load(sessionId);
    return this.#save(new AuthoringSession(snapshot).transition('backToSetup'));
  }

  async exportCourse(sessionId) {
    const snapshot = await this.#load(sessionId);
    if (!snapshot.compiledCourse) throw new Error('请先导入并检查一份有效课程。');
    if (snapshot.validatedDraft.format === 'chunklab-ai-image-text') {
      const materialized = await this.imagePackageAdapter.materialize(snapshot.compiledCourse, snapshot.compiledAssets, await this.sessionRepository.loadAssets(sessionId, snapshot.identity));
      const bundle = await this.imageBundleCodec.encode(this.imageCompiler.project(materialized.course), materialized.course);
      return this.io.download.save(`${snapshot.validatedDraft.title}.chunklab-image-course.json`, JSON.stringify(bundle, null, 2), 'application/json;charset=utf-8');
    }
    return this.io.download.save(`${snapshot.validatedDraft.title}.chunklab-course.json`, this.codec.serialize(this.compiler.projectDeckForExport(snapshot.compiledCourse)), 'application/json;charset=utf-8');
  }

  async save(sessionId) {
    const snapshot = await this.#load(sessionId);
    if (snapshot.stage !== 'preview' || !snapshot.compiledCourse) throw new Error('请先修复课程问题并查看预览。');
    if (snapshot.validationReport && (snapshot.validationReport.issues || []).some((item) => item.code === 'PREFERENCE_MISMATCH') && !snapshot.validationReport.mismatchAccepted) throw new Error('练习方式与制作时的选择不同，请先确认按 AI 返回的方式继续。');
    if (this.pending.has(sessionId)) return this.pending.get(sessionId);
    const task = this.#save(new AuthoringSession(snapshot).transition('beginSave')).then(async () => {
      const courseToSave = snapshot.reviewContext ? this.#attachReviewSource(snapshot) : snapshot.compiledCourse;
      const receipt = snapshot.validatedDraft.format === 'chunklab-ai-image-text'
        ? await this.#saveImageCourse(snapshot)
        : await this.courseGateway.saveSentenceCourse(courseToSave, snapshot.identity);
      this.scopeGuard.assert(snapshot.identity);
      const latest = await this.#load(sessionId);
      return this.#save(new AuthoringSession(latest).transition('saveSucceeded', { saveReceipt: { ...receipt, savedAt: this.now() }, lastError: null }));
    }).catch(async (error) => {
      const latest = await this.#load(sessionId);
      if (latest.stage === 'saving') await this.#save(new AuthoringSession(latest).transition('saveFailed', { lastError: error.message }));
      throw error;
    }).finally(() => this.pending.delete(sessionId));
    this.pending.set(sessionId, task);
    return task;
  }

  #attachReviewSource(snapshot) {
    const context = snapshot.reviewContext;
    const sourceRefs = Object.values(context.localSourceRefs || {}).map(({ deckId, cid }) => ({ deckId, cid }));
    const reviewSource = { version: 1, packId: context.publicPack.packId, createdAt: context.publicPack.generatedAt, sourceRefs };
    const baseline = { ...(context.baseline || {}) };
    return { ...snapshot.compiledCourse, authoring: { ...(snapshot.compiledCourse.authoring || {}), reviewSource: { ...reviewSource, baseline } }, items: (snapshot.compiledCourse.items || []).map((item) => ({ ...item, authoring: { ...(item.authoring || {}), reviewSource: { ...reviewSource } } })) };
  }

  async join(sessionId) {
    const snapshot = await this.#load(sessionId);
    if (!['saved', 'complete'].includes(snapshot.stage)) throw new Error('先保存课程，再加入学习。');
    if (snapshot.stage === 'complete') return { session: snapshot, catalogCourseId: snapshot.catalogCourseId };
    const session = new AuthoringSession(snapshot).transition('beginJoin');
    await this.#save(session);
    try {
      const receipt = snapshot.saveReceipt || await this.courseGateway.getLaunchReceipt(snapshot.courseId, snapshot.identity);
      const result = await this.courseGateway.joinCourse(receipt.catalogCourseId, snapshot.identity);
      this.scopeGuard.assert(snapshot.identity);
      const saved = await this.#save(new AuthoringSession(session.value()).transition('joinSucceeded', { catalogCourseId: result && result.courseId || receipt.catalogCourseId, saveReceipt: receipt, lastError: null }));
      return { session: saved, catalogCourseId: saved.catalogCourseId };
    } catch (error) {
      await this.#save(new AuthoringSession(session.value()).transition('joinFailed', { lastError: error.message }));
      throw error;
    }
  }

  async getLaunchUrl(sessionId) {
    const snapshot = await this.#load(sessionId);
    const receipt = snapshot.saveReceipt || await this.courseGateway.getLaunchReceipt(snapshot.courseId, snapshot.identity);
    return receipt.storageKind === 'story-package'
      ? `courses.html?id=${encodeURIComponent(receipt.contentId)}&catalogCourse=${encodeURIComponent(receipt.catalogCourseId)}&catalogLesson=${encodeURIComponent(receipt.lessonId)}`
      : `main.html?course=${encodeURIComponent(receipt.catalogCourseId)}&lesson=${encodeURIComponent(receipt.lessonId)}`;
  }

  async #load(sessionId, expectedRevision) {
    const scope = this.scopeGuard.capture();
    const snapshot = await this.sessionRepository.load(sessionId, scope);
    this.scopeGuard.assert(scope);
    if (!snapshot) throw new Error('制作草稿不存在，请重新开始。');
    if (expectedRevision != null && snapshot.revision !== expectedRevision) throw Object.assign(new Error('这个草稿已在另一个标签页更新，请重新加载后继续。'), { code: 'STALE_SESSION' });
    return snapshot;
  }
  async #saveImageCourse(snapshot) {
    if (!this.imagePackageAdapter) throw new Error('图文课程素材存储模块尚未就绪。');
    const materialized = await this.imagePackageAdapter.materialize(snapshot.compiledCourse, snapshot.compiledAssets || {}, await this.sessionRepository.loadAssets(snapshot.sessionId, snapshot.identity));
    return this.courseGateway.saveCompiledCourse(materialized.course, materialized.assets, snapshot.identity);
  }
  async #save(session, assetDelta = null) { const value = session.value(); await this.sessionRepository.save(value, value.identity, value.revision - 1, assetDelta); this.scopeGuard.assert(value.identity); return value; }
}
