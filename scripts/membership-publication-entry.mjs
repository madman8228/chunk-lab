import schemaValidator from './course-schema-validator-entry.js';
import packageContract from '../js/course-package-contract.js';
import { AiDraftValidator } from '../src/course-authoring/draft-validator.mjs';
import { SentenceCourseAdapter } from '../src/course-authoring/sentence-adapter.mjs';
import { ImageTextDraftValidator } from '../src/course-authoring/image-text-draft-validator.mjs';
import { ImageTextCourseCompiler } from '../src/course-authoring/image-text-compiler.mjs';

export function compilePublication(draft, images, courseId) {
  const imageText = draft?.format === 'chunklab-ai-image-text';
  const report = imageText ? new ImageTextDraftValidator({ schemaValidator }).validate(draft, images)
    : new AiDraftValidator({ schemaValidator }).validate(draft);
  if (!report.valid) throw Object.assign(new Error('课程格式未通过校验'), { code: 'INVALID_COURSE', status: 422, issues: report.issues });
  const canonical = report.canonicalDraft;
  if (!imageText && images.length) throw Object.assign(new Error('句子课程无需上传图片'), { status: 422, code: 'UNUSED_IMAGES' });
  if (!imageText) {
    const course = new SentenceCourseAdapter().compile(canonical, { deckId: courseId });
    return { title: canonical.title, contentType: 'sentence', content: { items: course.items, learning: canonical.learning, authoring: course.authoring }, assets: [], issues: report.issues };
  }
  const mapped = canonical.images.map(image => ({ ...images.find(file => file.name.toLowerCase() === image.fileName.toLowerCase()), key: image.key }));
  const { course } = new ImageTextCourseCompiler({ schemaValidator, packageContract }).compile(canonical, { courseId, images: mapped });
  return { title: canonical.title, contentType: 'image-text', content: { utterances: course.utterances, learning: canonical.learning,
    roles: course.roles, metadata: course.metadata, capabilities: course.capabilities, capabilityReasons: course.capabilityReasons, schemaVersion: course.schemaVersion, version: course.version },
    assets: course.assets.map(asset => ({ assetId: asset.id, mimeType: asset.mimeType, name: mapped.find(image => asset.id.endsWith(':image:' + image.key)).name })), issues: report.issues };
}
