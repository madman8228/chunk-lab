import { IMAGE_TEXT_DRAFT_SCHEMA } from './image-text-draft-spec.mjs';
import { IMAGE_MEDIA_POLICY } from './image-media-policy.mjs';

function issue(code, path, message, suggestion, severity = 'error') { return { code, path, severity, message, suggestion }; }
function normalized(value) { return String(value || '').replace(/[\t\n\f\r ]+/g, ' ').trim(); }

export class ImageTextDraftValidator {
  constructor({ schemaValidator }) { if (!schemaValidator || typeof schemaValidator.validate !== 'function') throw new Error('需要注入课程Schema校验器'); this.schemaValidator = schemaValidator; }
  validate(draft, suppliedImages = []) {
    const issues = [];
    if (!draft || draft.format !== 'chunklab-ai-image-text' || draft.formatVersion !== '1.0') issues.push(issue('UNSUPPORTED_IMAGE_DRAFT', 'formatVersion', '这不是受支持的图文课程格式。', '使用 Chunk Lab 图文课程规范重新生成。'));
    const result = this.schemaValidator.validate(IMAGE_TEXT_DRAFT_SCHEMA, draft);
    for (const error of result.errors || []) issues.push(issue('IMAGE_SCHEMA_INVALID', String(error.instancePath || error.path || '').replaceAll('/', '.') || '课程', '课程字段格式不符合图文课程规范。', error.message || String(error) || '按固定规范修复后重试。'));
    if (!draft || !Array.isArray(draft.images) || !Array.isArray(draft.items)) return { valid: false, issues, supportedModes: [] };
    const byKey = new Map(), byName = new Map();
    draft.images.forEach((image, index) => {
      if (!image || typeof image.key !== 'string') return;
      if (byKey.has(image.key)) issues.push(issue('DUPLICATE_IMAGE_KEY', `images[${index}].key`, '图片标识重复。', '为每张图片设置唯一 key。'));
      byKey.set(image.key, image);
      const name = String(image.fileName || '').toLowerCase();
      if (byName.has(name)) issues.push(issue('DUPLICATE_IMAGE_NAME', `images[${index}].fileName`, '图片文件名重复。', '为每张图片设置唯一文件名。'));
      byName.set(name, image.key);
    });
    const seen = new Set();
    draft.items.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const image = byKey.get(item.imageKey);
      if (!image) issues.push(issue('UNKNOWN_IMAGE', `items[${index}].imageKey`, `第 ${index + 1} 条没有引用已声明的图片。`, '选择 images 中的有效 key。'));
      else seen.add(item.imageKey);
      if (Array.isArray(item.chunks) && normalized(item.chunks.join(' ')) !== normalized(item.en)) issues.push(issue('IMAGE_CHUNK_MISMATCH', `items[${index}].chunks`, `第 ${index + 1} 条意群拼接后与英文不一致。`, '调整意群边界，使拼接结果与英文原句完全相同。'));
      if (draft.learning && draft.learning.modes && draft.learning.modes.includes('chunkSelection') && !Array.isArray(item.chunks)) issues.push(issue('IMAGE_CHUNKS_REQUIRED', `items[${index}].chunks`, `第 ${index + 1} 条缺少意群。`, '补齐意群，或从 learning.modes 移除 chunkSelection。'));
    });
    for (const image of draft.images) if (image && !seen.has(image.key)) issues.push(issue('UNUSED_IMAGE', `images.${image.key}`, `图片“${image.fileName}”未被课程内容引用。`, '将图片用于至少一条内容，或从 images 移除。'));
    {
      const supplied = new Map(suppliedImages.map((image) => [String(image.name || image.fileName || '').toLowerCase(), image]));
      let total = 0;
      if (supplied.size > IMAGE_MEDIA_POLICY.maxFiles) issues.push(issue('TOO_MANY_IMAGES', 'images', `最多上传 ${IMAGE_MEDIA_POLICY.maxFiles} 张图片。`, '减少图片数量后重试。'));
      suppliedImages.forEach((file) => {
        total += Number(file.size || file.byteLength || 0);
        if ((file.size || file.byteLength || 0) > IMAGE_MEDIA_POLICY.maxFileBytes) issues.push(issue('IMAGE_TOO_LARGE', file.name || file.fileName, '单张图片超过 2 MiB。', '使用较小的 PNG、JPEG 或 WebP 图片。'));
      });
      if (total > IMAGE_MEDIA_POLICY.maxTotalBytes) issues.push(issue('IMAGE_TOTAL_TOO_LARGE', 'images', '图片总大小超过 8 MiB。', '减少图片数量或选择较小文件。'));
      for (const image of draft.images) if (image && !supplied.has(image.fileName.toLowerCase())) issues.push(issue('MISSING_IMAGE_FILE', `images.${image.key}`, `找不到图片文件“${image.fileName}”。`, '上传该图片，或在页面中为此图片选择一个文件。'));
    }
    const modes = draft.learning && Array.isArray(draft.learning.modes) ? draft.learning.modes : [];
    if (draft.learning && !modes.includes(draft.learning.defaultMode)) issues.push(issue('INVALID_DEFAULT_MODE', 'learning.defaultMode', '默认练习方式必须包含在课程已选择的练习方式中。', '从 learning.modes 中选择一个作为 defaultMode。'));
    const supportedModes = ['typing', 'chunkSelection'].map((id) => ({ id, enabled: modes.includes(id) && (id === 'typing' || draft.items.every((item) => Array.isArray(item.chunks))), reason: id === 'typing' ? '' : '课程需要每条内容都提供完整意群。' }));
    if (suppliedImages.some((image) => !byName.has(String(image.name || '').toLowerCase()))) issues.push(issue('UNUSED_IMAGE_FILE', 'images', '上传了课程没有引用的图片文件。', '只上传 JSON 中声明的图片。', 'warning'));
    return { valid: !issues.some((entry) => entry.severity === 'error'), issues, supportedModes, canonicalDraft: draft, type: 'imageText' };
  }
}
