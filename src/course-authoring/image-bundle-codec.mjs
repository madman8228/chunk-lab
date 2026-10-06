import { IMAGE_MEDIA_POLICY } from './image-media-policy.mjs';

export class ImageTextBundleCodec {
  constructor({ FileClass = globalThis.File } = {}) { this.FileClass = FileClass; }
  parseText(text) {
    const source = String(text || '');
    if (!source.includes('"chunklab-ai-image-bundle"')) return { ok: false, error: { code: 'INVALID_IMAGE_BUNDLE', message: '不是可识别的图文课程分享文件。' } };
    if (new TextEncoder().encode(source).byteLength > IMAGE_MEDIA_POLICY.maxBundleBytes) return { ok: false, error: { code: 'IMAGE_BUNDLE_TOO_LARGE', message: '图文课程分享文件超过 12 MiB 限制。' } };
    try { return { ok: true, value: JSON.parse(source) }; }
    catch (error) { return { ok: false, error: { code: 'INVALID_IMAGE_BUNDLE_JSON', message: '图文课程分享文件不是有效 JSON。' } }; }
  }
  async encode(draft, course) {
    const images = await Promise.all(draft.images.map(async (image) => {
      const asset = (course.assets || []).find((item) => item.id.endsWith(`:image:${image.key}`));
      const match = String(asset && asset._dataUri || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new Error(`课程图片“${image.fileName}”缺失，不能导出。`);
      return { key: image.key, mimeType: match[1], byteLength: Math.floor(match[2].length * 3 / 4) - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0), sha256: await digest(match[2]), base64: match[2] };
    }));
    const bundle = { format: 'chunklab-ai-image-bundle', formatVersion: '1.0', draft, images };
    if (new TextEncoder().encode(JSON.stringify(bundle)).byteLength > IMAGE_MEDIA_POLICY.maxBundleBytes) throw new Error('课程图片包超过 12 MiB，无法导出。');
    return bundle;
  }
  async decode(value) {
    if (!value || Object.keys(value).sort().join(',') !== 'draft,format,formatVersion,images' || value.format !== 'chunklab-ai-image-bundle' || value.formatVersion !== '1.0' || !value.draft || !Array.isArray(value.images) || !this.FileClass) throw new Error('这不是受支持的图文课程文件。');
    if (value.images.length > IMAGE_MEDIA_POLICY.maxFiles) throw new Error('课程图片数量超过限制。');
    const draftImages = new Map((value.draft.images || []).map((image) => [image.key, image]));
    if (draftImages.size !== value.images.length || new Set(value.images.map((image) => image && image.key)).size !== value.images.length || value.images.some((image) => !image || Object.keys(image).sort().join(',') !== 'base64,byteLength,key,mimeType,sha256' || !draftImages.has(image.key))) throw new Error('图文课程中的图片清单与课程内容不一致。');
    const total = value.images.reduce((sum, image) => sum + Math.floor(String(image.base64 || '').length * 3 / 4), 0);
    if (total > IMAGE_MEDIA_POLICY.maxTotalBytes) throw new Error('课程图片总大小超过 8 MiB。');
    const files = await Promise.all(value.images.map(async (image) => {
      const draftImage = draftImages.get(image.key);
      if (!draftImage || !/^image\/(?:png|jpeg|webp)$/.test(image.mimeType) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.base64 || '')) throw new Error('图文课程图片数据格式错误。');
      const binary = globalThis.atob(image.base64);
      if (binary.length !== image.byteLength) throw new Error(`图片“${draftImage.fileName}”文件大小记录不匹配。`);
      if (binary.length > IMAGE_MEDIA_POLICY.maxFileBytes) throw new Error(`图片“${draftImage.fileName}”超过单张 2 MiB 限制。`);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      if (!/^[a-f0-9]{64}$/.test(image.sha256 || '') || await digest(image.base64) !== image.sha256) throw new Error(`图片“${draftImage.fileName}”完整性检查失败。`);
      return new this.FileClass([bytes], draftImage.fileName, { type: image.mimeType });
    }));
    return { draft: value.draft, files };
  }
}

async function digest(base64) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) throw new Error('当前浏览器不支持图文文件完整性校验。');
  const binary = globalThis.atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
