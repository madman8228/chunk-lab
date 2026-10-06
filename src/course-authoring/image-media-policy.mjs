export const IMAGE_MEDIA_POLICY = Object.freeze({
  maxFiles: 12, maxFileBytes: 2 * 1024 * 1024, maxTotalBytes: 8 * 1024 * 1024,
  maxBundleBytes: 12 * 1024 * 1024, maxDimension: 4096, maxPixels: 12_000_000,
  maxDraftBytes: 256 * 1024,
  types: Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })
});
