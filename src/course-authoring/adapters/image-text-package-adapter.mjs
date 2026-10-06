export class ImageTextPackageAdapter {
  constructor({ createObjectURL = (blob) => URL.createObjectURL(blob) } = {}) { this.createObjectURL = createObjectURL; }
  async materialize(course, assetRefs, storedAssets) {
    const files = new Map((storedAssets || []).map((asset) => [asset.assetId || asset.id, asset]));
    const compiled = structuredClone(course);
    const assets = {};
    for (const asset of compiled.assets || []) {
      const imageKey = assetRefs && assetRefs[asset.path];
      const file = files.get(imageKey);
      if (!file || !file.blob) throw new Error(`课程图片“${asset.fileName}”缺失，请重新上传后再试。`);
      const dataUri = await blobDataUri(file.blob, file.metadata && file.metadata.mimeType || asset.mimeType);
      asset._dataUri = dataUri;
      assets[asset.path] = dataUri;
    }
    return { course: compiled, assets };
  }
  previewUrls(assetRefs, storedAssets) {
    const files = new Map((storedAssets || []).map((asset) => [asset.assetId || asset.id, asset]));
    return Object.fromEntries(Object.entries(assetRefs || {}).map(([path, imageKey]) => {
      const file = files.get(imageKey);
      return [imageKey, file && file.blob ? this.createObjectURL(file.blob) : ''];
    }).filter(([, url]) => url));
  }
}

async function blobDataUri(blob, mimeType) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  return `data:${mimeType};base64,${globalThis.btoa(binary)}`;
}
