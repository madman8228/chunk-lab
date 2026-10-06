import { IMAGE_TEXT_DRAFT_SCHEMA } from './image-text-draft-spec.mjs';
import { IMAGE_TEXT_RUNTIME_SCHEMA } from './image-text-runtime-spec.mjs';

function locale(en, zh) { return { en: String(en || ''), 'zh-CN': String(zh || '') }; }
function normalize(value) { return String(value || '').trim().replace(/[\t\n\f\r ]+/g, ' ').toLowerCase(); }

export class ImageTextCourseCompiler {
  constructor({ schemaValidator, packageContract }) { this.schemaValidator = schemaValidator; this.packageContract = packageContract; }
  compile(draft, { courseId, images }) {
    if (!/^ai-[a-z0-9-]{12,80}$/i.test(String(courseId || ''))) throw new Error('需要由网站分配课程 ID');
    const files = new Map((images || []).map((image) => [image.key, image]));
    const assets = draft.images.map((image) => {
      const file = files.get(image.key);
      if (!file || !file.extension || !file.mimeType) throw new Error(`图片“${image.fileName}”尚未准备好。`);
      return { id: `${courseId}:image:${image.key}`, type: 'story_image', path: `images/${image.key}.${file.extension}`, fileName: `${image.key}.${file.extension}`, mimeType: file.mimeType, alt: image.alt };
    });
    const imageByKey = new Map(draft.images.map((image) => [image.key, assets.find((asset) => asset.id.endsWith(`:image:${image.key}`))]));
    const utterances = draft.items.map((item, index) => {
      const id = `${courseId}:line:${String(index + 1).padStart(3, '0')}`;
      const chunks = item.chunks && item.chunks.map((text, chunkIndex) => ({ id: `${id}:chunk:${String(chunkIndex + 1).padStart(2, '0')}`, text: chunkIndex === item.chunks.length - 1 ? text : `${text} ` }));
      const result = { id, text: locale(item.en, item.zh), roleId: null, imageAssetId: imageByKey.get(item.imageKey).id, audioAssetId: null, acceptedAnswers: { en: [item.en] } };
      if (chunks) result.chunks = { items: chunks, correctOrder: chunks.map((chunk) => chunk.id), distractors: [] };
      return result;
    });
    const capabilities = { text: true, audio: false, translation: true, chunkSelection: draft.learning.modes.includes('chunkSelection'), roleplay: false };
    const course = {
      schemaVersion: '2.0', courseId, version: '1.0.0',
      metadata: { title: locale('', draft.title), description: locale('', draft.description), targetCefr: draft.targetCefr, estimatedDurationMinutes: Math.max(1, Math.ceil(draft.items.length * 0.4)), learningLocale: 'en', supportLocales: ['zh-CN'] },
      assets, roles: [], utterances, sequence: utterances.map((item) => item.id), capabilities,
      capabilityReasons: { audio: [{ code: 'REAL_AUDIO_REQUIRED', message: '这门图文课程不包含真实音频。' }], roleplay: [{ code: 'IMAGE_TEXT_NO_ROLEPLAY', message: '图文课程暂不支持角色练习。' }] },
      authorNotes: { chunklabImageText: { format: 'chunklab-ai-image-text', formatVersion: '1.0', learning: structuredClone(draft.learning), images: draft.images.map(({ key, fileName, alt, prompt }) => ({ key, fileName, alt, prompt: prompt || '', sha256: files.get(key)?.sha256 || '' })) } }
    };
    const schema = this.schemaValidator.validate(IMAGE_TEXT_RUNTIME_SCHEMA, course);
    const graph = this.packageContract.validateCourseV2(course);
    if (!schema.valid || graph.length) throw new Error(`图文课程内部格式校验失败：${(schema.errors || []).concat(graph).slice(0, 3).join('；')}`);
    for (const utterance of utterances) {
      const item = draft.items.find((row, index) => utterances[index].id === utterance.id);
      if (normalize(utterance.chunks && utterance.chunks.items.map((chunk) => chunk.text).join('') || item.en) !== normalize(item.en)) throw new Error(`第 ${item.imageKey} 条内容无法安全转换。`);
    }
    return { course, assetRefs: Object.fromEntries(draft.images.map((image) => [assets.find((asset) => asset.id.endsWith(`:image:${image.key}`)).path, image.key])) };
  }
  project(course) {
    const payload = course && course.authorNotes && course.authorNotes.chunklabImageText;
    if (!payload || payload.format !== 'chunklab-ai-image-text' || payload.formatVersion !== '1.0') throw new Error('这不是可导出的 AI 图文课程。');
    const lines = new Map((course.utterances || []).map((item) => [item.id, item]));
    const imageById = new Map((payload.images || []).map((image) => {
      const asset = (course.assets || []).find((entry) => entry.fileName === `${image.key}.${String(entryExtension(entry))}`) || (course.assets || []).find((entry) => entry.id.endsWith(`:image:${image.key}`));
      return [image.key, { image, asset }];
    }));
    const draft = { format: 'chunklab-ai-image-text', formatVersion: '1.0', title: course.metadata.title['zh-CN'], description: course.metadata.description['zh-CN'], targetCefr: course.metadata.targetCefr, learning: structuredClone(payload.learning), images: [], items: [] };
    for (const image of payload.images || []) {
      const found = imageById.get(image.key), asset = found && found.asset;
      if (!asset || !asset._dataUri) throw new Error(`已保存课程图片“${image.fileName}”缺失，无法导出。`);
      draft.images.push({ key: image.key, fileName: `${image.key}.${entryExtension(asset)}`, alt: image.alt, ...(image.prompt ? { prompt: image.prompt } : {}) });
    }
    for (const id of course.sequence || []) {
      const line = lines.get(id), image = payload.images.find((entry) => { const asset = imageById.get(entry.key)?.asset; return asset && asset.id === line?.imageAssetId; });
      if (!line || !image) throw new Error('图文课程顺序或图片引用损坏，无法导出。');
      const chunks = line.chunks && line.chunks.correctOrder.map((chunkId) => line.chunks.items.find((chunk) => chunk.id === chunkId)?.text.replace(/ $/, '')).filter(Boolean);
      draft.items.push({ imageKey: image.key, en: line.text.en, zh: line.text['zh-CN'], ...(chunks ? { chunks } : {}) });
    }
    const checked = this.schemaValidator.validate(IMAGE_TEXT_DRAFT_SCHEMA, draft);
    if (!checked.valid) throw new Error('图文课程数据不完整，不能导出。');
    return draft;
  }
}

function entryExtension(asset) { return String(asset && asset.mimeType || '').split('/')[1] === 'jpeg' ? 'jpg' : String(asset && asset.mimeType || '').split('/')[1] || 'png'; }
