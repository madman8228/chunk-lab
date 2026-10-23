'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { imageDimensions } = require('./membership/image-dimensions');

// Choose only the WebP already declared alongside an AVIF in the same slot.
// Canonical packages and their teaching revisions remain available for archives.
function wordbookImageDelivery(pkg, assetRoot) {
  const overrides = [];
  for (const item of pkg.items) {
    if (!item.images) continue;
    const images = structuredClone(item.images), removed = [];
    for (const slot of ['wide', 'mobile']) {
      if (!Array.isArray(images[slot])) continue;
      images[slot] = images[slot].filter(url => {
        if (typeof url !== 'string' || !url.endsWith('.avif')) return true;
        const webp = url.slice(0, -5) + '.webp';
        if (!images[slot].includes(webp)) return true;
        try {
          const root = fs.realpathSync(assetRoot), file = fs.realpathSync(path.resolve(root, webp));
          if (!file.startsWith(root + path.sep)) return true;
          const bytes = fs.readFileSync(file);
          const dimensions = imageDimensions(bytes, 'image/webp');
          if (bytes.length >= 20000 || bytes.subarray(0, 4).toString() !== 'RIFF' ||
              bytes.subarray(8, 12).toString() !== 'WEBP' || !dimensions || dimensions.some(value => value < 1)) return true;
          removed.push({ slot, path: url, replacement: webp,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
          return false;
        } catch { return true; }
      });
    }
    if (removed.length) overrides.push({ itemId: item.itemId, images, removed });
  }
  return overrides;
}

module.exports = { wordbookImageDelivery };
