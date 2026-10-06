import { convertLegacyAiCourse } from './legacy-conversion.mjs';
import { AiDraftValidator } from './draft-validator.mjs';
import { CourseDraftCompiler } from './draft-compiler.mjs';
import { ExistingCourseGateway } from './adapters/course-gateway.mjs';
import { BrowserIO } from './adapters/browser-io.mjs';

function copy(value) { return JSON.parse(JSON.stringify(value)); }

export class LegacyCourseLearningLauncher {
  constructor({ gateway, validator, compiler, scopeGuard, retiredStore }) {
    this.gateway = gateway; this.validator = validator; this.compiler = compiler;
    this.scopeGuard = scopeGuard; this.retiredStore = retiredStore;
    this.pending = new Map();
  }

  /** @returns {Promise<any>} */
  async inspect(courseId) {
    const scope = this.scopeGuard.capture();
    const source = await this.gateway.loadLegacyAiCourse(courseId, scope);
    this.scopeGuard.assert(scope);
    if (!source) return { kind: 'not-applicable', courseId };
    const conversion = convertLegacyAiCourse(source.course, { validator: this.validator, chunkShape: this.validator.chunkShape });
    const retired = this.retiredStore.has(courseId);
    const report = conversion.report;
    return { ...report, courseId, draft: conversion.draft, history: source.progress || report.history,
      kind: !report.valid ? 'blocked' : retired || report.warnings.length ? 'confirmation-required' : 'native-ready',
      retired };
  }

  markDeleted(courseId, mem) { this.retiredStore.mark(String(courseId), mem); }
  allowRecreate(courseId, mem) { this.retiredStore.clear(String(courseId), mem); }
  isRetired(courseId, mem) { return this.retiredStore.has(String(courseId), mem); }

  /** @returns {Promise<any>} */
  async launch(courseId, { confirmed = false } = {}) {
    const key = String(courseId);
    if (this.pending.has(key)) return this.pending.get(key);
    const task = this.#launch(key, confirmed).finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }

  async #launch(courseId, confirmed) {
    const scope = this.scopeGuard.capture();
    const source = await this.gateway.loadLegacyAiCourse(courseId, scope);
    this.scopeGuard.assert(scope);
    if (!source) return { kind: 'not-applicable', courseId };
    const conversion = convertLegacyAiCourse(source.course, { validator: this.validator, chunkShape: this.validator.chunkShape });
    const report = conversion.report;
    const retired = this.retiredStore.has(courseId);
    if (!conversion.draft || !report.valid) return { ...report, kind: 'blocked', courseId, history: source.progress || report.history };
    if ((report.warnings.length || retired) && !confirmed) return { ...report, kind: 'confirmation-required', courseId, retired, history: source.progress || report.history };

    const compiled = this.compiler.compileDeck(conversion.draft, { deckId: courseId,
      catalogCourseId: report.plan.catalogCourseId, legacySource: report.plan.legacySource, lineIds: report.plan.lineIds });
    const current = await this.gateway.findNativeCourse(courseId, scope);
    this.scopeGuard.assert(scope);
    if (current) {
      const sameSource = current.authoring && current.authoring.legacySource && current.authoring.legacySource.courseId === courseId;
      const sourceIsUnlabeled = !current.authoring || !current.authoring.legacySource;
      const sameContent = JSON.stringify(current.items) === JSON.stringify(compiled.items);
      if (!(sameSource || sourceIsUnlabeled) || !sameContent) return { kind: 'blocked', courseId, blockers: [{ code: 'NATIVE_COURSE_CONFLICT', path: 'courseId', message: '课程编号已被不同内容使用，原课程保持不变。' }], warnings: report.warnings };
      let receipt;
      if (retired || sourceIsUnlabeled) {
        receipt = await this.gateway.saveSentenceCourse(compiled, scope, {
          forceSave: true,
          adoptMetadata: sourceIsUnlabeled,
          beforeSave: retired ? (mem) => this.retiredStore.clear(courseId, mem) ? () => this.retiredStore.mark(courseId, mem) : null : null
        });
      } else receipt = await this.gateway.getLaunchReceipt(courseId, scope);
      this.scopeGuard.assert(scope);
      return { kind: 'launched', courseId, receipt, warnings: report.warnings, history: source.progress || report.history };
    }
    let receipt;
    receipt = await this.gateway.saveSentenceCourse(compiled, scope, {
      forceSave: retired,
      beforeSave: retired ? (mem) => this.retiredStore.clear(courseId, mem) ? () => this.retiredStore.mark(courseId, mem) : null : null
    });
    this.scopeGuard.assert(scope);
    return { kind: 'launched', courseId, receipt, warnings: report.warnings, history: source.progress || report.history };
  }
}

export function createBrowserLegacyCourseLauncher(win = globalThis.window) {
  if (!win || !win.CL || !win.ChunkCourse || !win.CourseSchemaValidator || !win.AccountStorage) throw new Error('学习模块尚未就绪，请刷新后重试。');
  const io = new BrowserIO({ accountStorage: win.AccountStorage });
  const scopeGuard = io.guard();
  const accountScope = scopeGuard.capture();
  /* Use a namespace without `#`: core's sentence-key migration hashes every
     non-cid suffix after `#`, which would otherwise rewrite this marker. */
  const markerKey = (id) => `ai-course-retired:${String(id)}`;
  const targetMem = (mem) => mem && typeof mem === 'object' ? mem : win.CL.loadMem();
  const has = (id, mem) => {
    scopeGuard.assert(accountScope);
    const marks = targetMem(mem).deletedItems;
    return !!(marks && marks[markerKey(id)]);
  };
  const retiredStore = {
    has,
    mark(id, mem) { scopeGuard.assert(accountScope); const target = targetMem(mem); target.deletedItems = target.deletedItems || {}; target.deletedItems[markerKey(id)] = true; scopeGuard.assert(accountScope); },
    clear(id, mem) { scopeGuard.assert(accountScope); const target = targetMem(mem); const marks = target.deletedItems || {}; const existed = !!marks[markerKey(id)]; delete marks[markerKey(id)]; target.deletedItems = marks; scopeGuard.assert(accountScope); return existed; }
  };
  const gateway = new ExistingCourseGateway({ scopeGuard });
  const validator = new AiDraftValidator({ schemaValidator: win.CourseSchemaValidator, chunkShape: win.ChunkShape || null });
  const compiler = new CourseDraftCompiler({ validator });
  return new LegacyCourseLearningLauncher({ gateway, validator, compiler, scopeGuard, retiredStore });
}
