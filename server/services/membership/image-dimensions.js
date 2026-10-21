'use strict';
function imageDimensions(bytes, mimeType) {
  if (mimeType === 'image/png' && bytes.length >= 24 && bytes.subarray(12,16).toString() === 'IHDR') return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (mimeType === 'image/webp') {
    const tag = bytes.subarray(12,16).toString();
    if (tag === 'VP8X' && bytes.length >= 30) return [bytes.readUIntLE(24,3) + 1, bytes.readUIntLE(27,3) + 1];
    if (tag === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) { const bits = bytes.readUInt32LE(21); return [(bits & 16383) + 1, ((bits >>> 14) & 16383) + 1]; }
    if (tag === 'VP8 ' && bytes.length >= 30 && bytes.subarray(23,26).equals(Buffer.from([157,1,42]))) return [bytes.readUInt16LE(26) & 16383, bytes.readUInt16LE(28) & 16383];
  }
  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 4 <= bytes.length && bytes[offset] === 255) {
      while (offset < bytes.length && bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 218 || marker === 217 || offset + 2 > bytes.length) break;
      if (marker === 216 || marker >= 208 && marker <= 215) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (marker >= 192 && marker <= 207 && ![196,200,204].includes(marker) && length >= 7) return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
      offset += length;
    }
  }
  return null;
}
module.exports = { imageDimensions };
