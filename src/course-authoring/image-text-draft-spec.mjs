import { IMAGE_MEDIA_POLICY } from './image-media-policy.mjs';

const string = (minLength, maxLength) => ({ type: 'string', minLength, maxLength });
export const IMAGE_TEXT_DRAFT_SCHEMA = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://chunklab.local/schema/ai-image-text-course-1.0.json',
  type: 'object', additionalProperties: false,
  required: ['format', 'formatVersion', 'title', 'description', 'targetCefr', 'learning', 'images', 'items'],
  properties: {
    format: { const: 'chunklab-ai-image-text' }, formatVersion: { const: '1.0' },
    title: string(1, 120), description: string(0, 1000), targetCefr: { enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
    learning: { type: 'object', additionalProperties: false, required: ['template', 'version', 'modes', 'defaultMode'], properties: {
      template: { const: 'image-text-practice' }, version: { const: 1 },
      modes: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: ['typing', 'chunkSelection'] } },
      defaultMode: { enum: ['typing', 'chunkSelection'] }
    } },
    images: { type: 'array', minItems: 1, maxItems: IMAGE_MEDIA_POLICY.maxFiles, items: { type: 'object', additionalProperties: false, required: ['key', 'fileName', 'alt'], properties: {
      key: { type: 'string', pattern: '^[a-z][a-z0-9_-]{0,39}$' }, fileName: { type: 'string', minLength: 5, maxLength: 120, pattern: '^[A-Za-z0-9_-]+\\.(png|jpg|jpeg|webp)$' }, alt: string(1, 200), prompt: string(0, 2000)
    } } },
    items: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', additionalProperties: false, required: ['imageKey', 'en', 'zh'], properties: {
      imageKey: { type: 'string', minLength: 1, maxLength: 40 }, en: string(1, 500), zh: string(1, 1000),
      chunks: { type: 'array', minItems: 1, maxItems: 20, items: string(1, 200) }
    } } }
  }
});

export const IMAGE_TEXT_DRAFT_EXAMPLE = Object.freeze({
  format: 'chunklab-ai-image-text', formatVersion: '1.0', title: '咖啡店点单', description: '看图学习点咖啡时的英语表达。', targetCefr: 'A2',
  learning: { template: 'image-text-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'chunkSelection' },
  images: [{ key: 'cafe', fileName: 'cafe-counter.png', alt: '咖啡店柜台和菜单', prompt: '明亮简洁的咖啡店柜台，菜单清晰，无文字水印。' }],
  items: [
    { imageKey: 'cafe', en: "I'd like a latte, please.", zh: '请给我一杯拿铁。', chunks: ["I'd like", 'a latte,', 'please.'] },
    { imageKey: 'cafe', en: 'Can I pay by card?', zh: '我可以刷卡吗？', chunks: ['Can I pay', 'by card?'] }
  ]
});

export const IMAGE_TEXT_DRAFT_SPEC = Object.freeze({ schema: IMAGE_TEXT_DRAFT_SCHEMA, example: IMAGE_TEXT_DRAFT_EXAMPLE, mediaLimits: IMAGE_MEDIA_POLICY });
