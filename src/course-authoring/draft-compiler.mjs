import { CourseCapabilityCatalog } from './capabilities.mjs';
import { AiDraftValidator } from './draft-validator.mjs';
import { SentenceCourseAdapter } from './sentence-adapter.mjs';

function locale(en, zh) { return { en: String(en || ''), 'zh-CN': String(zh || '') }; }
function normalize(value) { return String(value || '').trim().replace(/[\t\n\f\r ]+/g, ' ').toLocaleLowerCase('en'); }
function markedCourse(course) {
  const markers = course && course.authorNotes && course.authorNotes.chunklabAuthoring;
  return Array.isArray(markers) && markers.includes('format=chunklab-ai-course') && markers.includes('formatVersion=1.0');
}

export class CourseDraftCompiler {
  constructor({ validator, sentenceAdapter = new SentenceCourseAdapter() }) { if (!(validator instanceof AiDraftValidator)) throw new Error('CourseDraftCompiler 需要 AiDraftValidator'); this.validator = validator; this.sentenceAdapter = sentenceAdapter; }

  /** @param {object} draft @param {{deckId:string,catalogCourseId?:string,legacySource?:object,lineIds?:string[]}} options */
  compileDeck(draft, { deckId, catalogCourseId, legacySource, lineIds }) {
    const report = this.validator.validate(draft);
    if (!report.valid) throw Object.assign(new Error('课程格式或内容校验失败'), { report });
    return this.sentenceAdapter.compile(report.canonicalDraft || draft, { deckId, catalogCourseId, legacySource, lineIds });
  }

  projectDeckForExport(deck) { return this.sentenceAdapter.projectForExport(deck); }

  compile(draft, identity) {
    if (!identity || typeof identity.courseId !== 'string' || !/^ai-[a-z0-9-]{12,80}$/i.test(identity.courseId)) throw new Error('需要由网站分配的课程 ID');
    const report = this.validator.validate(draft);
    if (!report.valid) { const error = /** @type {Error & {report:object}} */ (new Error('课程格式或内容校验失败')); error.report = report; throw error; }
    const roles = draft.roles.map((role) => ({ id: role.key, name: role.name }));
    const utterances = draft.items.map((item, lineIndex) => {
      const id = `${identity.courseId}:line:${String(lineIndex + 1).padStart(3, '0')}`;
      const chunks = Array.isArray(item.chunks) ? item.chunks : null;
      const chunkItems = chunks && chunks.map((text, chunkIndex) => ({ id: `${id}:chunk:${String(chunkIndex + 1).padStart(2, '0')}`, text: chunkIndex === chunks.length - 1 ? text : text + ' ' }));
      const distractors = chunkItems && (item.distractors || []).map((text, distractorIndex) => ({ id: `${id}:distractor:${String(distractorIndex + 1).padStart(2, '0')}`, text }));
      const acceptedAnswers = item.acceptedAnswers ? item.acceptedAnswers.slice() : [item.en];
      if (!acceptedAnswers.some((answer) => normalize(answer) === normalize(item.en))) acceptedAnswers.unshift(item.en);
      return { id, text: locale(item.en, item.zh), roleId: item.role || null, imageAssetId: null, audioAssetId: null,
        acceptedAnswers: { en: acceptedAnswers },
        ...(chunks ? { chunks: { items: chunkItems, correctOrder: chunkItems.map((chunk) => chunk.id), distractors } } : {}) };
    });
    const capabilities = CourseCapabilityCatalog.fromDraft(draft);
    const duration = Math.max(1, Math.ceil(draft.items.length * 0.4));
    return {
      schemaVersion: '2.0', courseId: identity.courseId, version: '1.0.0',
      metadata: { title: locale('', draft.title), description: locale('', draft.description), targetCefr: draft.targetCefr,
        estimatedDurationMinutes: duration, learningLocale: 'en', supportLocales: ['zh-CN'] },
      assets: [], roles, utterances, sequence: utterances.map((item) => item.id), capabilities,
      capabilityReasons: { audio: [{ code: 'REAL_AUDIO_REQUIRED', message: '跟读和听写需要课程提供真实音频。简易文字课程暂不包含音频。' }] },
      authorNotes: { chunklabAuthoring: ['format=chunklab-ai-course', 'formatVersion=1.0', `contentForm=${draft.contentForm}`, ...(draft.source && draft.source.title ? [`sourceTitle=${draft.source.title}`] : [])] }
    };
  }

  projectForExport(course) {
    if (!markedCourse(course) || course.schemaVersion !== '2.0' || !Array.isArray(course.utterances)) throw new Error('这门课程不是可无损导出的 AI 文字课程。');
    const markers = course.authorNotes.chunklabAuthoring;
    const contentForm = markers.find((marker) => marker.indexOf('contentForm=') === 0)?.slice('contentForm='.length);
    const sourceTitle = markers.find((marker) => marker.indexOf('sourceTitle=') === 0)?.slice('sourceTitle='.length) || '';
    if (!['sentences', 'article', 'dialogue'].includes(contentForm)) throw new Error('课程来源信息不完整，不能安全导出。');
    const byId = new Map(course.utterances.map((item) => [item.id, item]));
    const items = course.sequence.map((id) => {
      const line = byId.get(id);
      if (!line) throw new Error('课程顺序引用了不存在的台词。');
      const chunks = line.chunks && line.chunks.correctOrder.map((chunkId) => line.chunks.items.find((chunk) => chunk.id === chunkId)).filter(Boolean).map((chunk) => chunk.text.replace(/ $/, ''));
      return { en: line.text.en, zh: line.text['zh-CN'], ...(line.roleId ? { role: line.roleId } : {}), ...(chunks ? { chunks } : {}), ...(line.chunks && line.chunks.distractors.length ? { distractors: line.chunks.distractors.map((chunk) => chunk.text) } : {}), acceptedAnswers: line.acceptedAnswers.en.slice() };
    });
    const draft = { format: 'chunklab-ai-course', formatVersion: '1.0', title: course.metadata.title['zh-CN'], description: course.metadata.description['zh-CN'], targetCefr: course.metadata.targetCefr, contentForm, roles: course.roles.map((role) => ({ key: role.id, name: role.name })), items, ...(sourceTitle ? { source: { title: sourceTitle } } : {}) };
    const report = this.validator.validate(draft);
    if (!report.valid) { const error = /** @type {Error & {report:object}} */ (new Error('课程内容无法转换回 AI 课程文件')); error.report = report; throw error; }
    return draft;
  }
}
