import { IMAGE_MEDIA_POLICY } from '../image-media-policy.mjs';

const accepted = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]);

export class BrowserImageFileReader {
  constructor({ createBitmap = null, subtle = globalThis.crypto && globalThis.crypto.subtle } = {}) {
    this.createBitmap = createBitmap || ((file) => globalThis.createImageBitmap(file)); this.subtle = subtle;
  }
  async read(file) {
    if (!file || !accepted.has(file.type)) throw new Error('图片仅支持 PNG、JPEG 或 WebP 格式。');
    if (file.size > IMAGE_MEDIA_POLICY.maxFileBytes) throw new Error(`图片“${file.name}”超过单张 2 MiB 限制。`);
    const extension = accepted.get(file.type);
    const declared = String(file.name || '').split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(declared)) throw new Error(`图片“${file.name}”的扩展名与图片格式不匹配。`);
    const bytes = await file.arrayBuffer();
    if (!matchesSignature(new Uint8Array(bytes), file.type)) throw new Error(`图片“${file.name}”的文件内容与声明格式不一致。`);
    const bitmap = await this.createBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (!width || !height || width > IMAGE_MEDIA_POLICY.maxDimension || height > IMAGE_MEDIA_POLICY.maxDimension || width * height > IMAGE_MEDIA_POLICY.maxPixels) throw new Error(`图片“${file.name}”尺寸过大（最长边不超过 4096，像素不超过 1200 万）。`);
    const digest = this.subtle ? hex(new Uint8Array(await this.subtle.digest('SHA-256', bytes))) : '';
    const dataUri = `data:${file.type};base64,${toBase64(new Uint8Array(bytes))}`;
    return { name: file.name, mimeType: file.type, extension, size: file.size, width, height, sha256: digest, dataUri, blob: file };
  }
}

function hex(bytes) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); }
function matchesSignature(bytes, mimeType) {
  if (mimeType === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mimeType === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
  return false;
}

function toBase64(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  return globalThis.btoa(binary);
}
