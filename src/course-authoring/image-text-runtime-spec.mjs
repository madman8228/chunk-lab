export const IMAGE_TEXT_RUNTIME_SCHEMA = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', additionalProperties: true,
  required: ['schemaVersion', 'courseId', 'version', 'metadata', 'assets', 'roles', 'utterances', 'sequence', 'capabilities', 'authorNotes'],
  properties: {
    schemaVersion: { const: '2.0' }, courseId: { type: 'string', pattern: '^ai-[a-z0-9-]{12,80}$' }, version: { type: 'string' },
    metadata: { type: 'object', required: ['title', 'description', 'targetCefr', 'learningLocale', 'supportLocales'], properties: { title: { type: 'object' }, description: { type: 'object' }, targetCefr: { enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }, learningLocale: { const: 'en' }, supportLocales: { type: 'array', contains: { const: 'zh-CN' } } } },
    assets: { type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'type', 'path', 'fileName', 'mimeType'], properties: { id: { type: 'string' }, type: { const: 'story_image' }, path: { type: 'string' }, fileName: { type: 'string' }, mimeType: { enum: ['image/png', 'image/jpeg', 'image/webp'] } } } },
    roles: { type: 'array', maxItems: 0 }, utterances: { type: 'array', minItems: 1, maxItems: 50 }, sequence: { type: 'array', minItems: 1 },
    capabilities: { type: 'object', required: ['text', 'audio', 'translation', 'chunkSelection', 'roleplay'], properties: { text: { const: true }, audio: { const: false }, translation: { const: true }, chunkSelection: { type: 'boolean' }, roleplay: { const: false } } },
    authorNotes: { type: 'object', required: ['chunklabImageText'], properties: { chunklabImageText: { type: 'object', required: ['format', 'formatVersion', 'learning'], properties: { format: { const: 'chunklab-ai-image-text' }, formatVersion: { const: '1.0' }, learning: { type: 'object' }, images: { type: 'array' } } } } }
  }
});
