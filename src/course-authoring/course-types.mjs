export const COURSE_TYPES = Object.freeze([
  Object.freeze({ id: 'sentence', label: '句子课程', description: '通过中文提示练习英文句子。', format: 'chunklab-ai-course', version: '1.1' }),
  Object.freeze({ id: 'imageText', label: '图文课程', description: 'AI 生成课程内容，你上传配套图片。', format: 'chunklab-ai-image-text', version: '1.0' })
]);

export class CourseTypeCatalog {
  static list() { return COURSE_TYPES.map((item) => ({ ...item })); }
  static get(id) { return COURSE_TYPES.find((item) => item.id === id) || COURSE_TYPES[0]; }
  static detect(draft) {
    if (draft && draft.format === 'chunklab-ai-image-text' && draft.formatVersion === '1.0') return 'imageText';
    if (draft && draft.format === 'chunklab-ai-course' && ['1.0', '1.1'].includes(draft.formatVersion)) return 'sentence';
    return null;
  }
}
