'use strict';
// Pass Sharp's module path, then optionally "large-intro" for the approved 20 KB poster.
const sharp = require(process.argv[2] || 'sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const words = ['decide', 'borrow', 'advice', 'avoid', 'explain', 'enough'];
const largeIntro = process.argv[3] === 'large-intro';
if (process.argv[3] && !largeIntro) throw new Error('Unknown image profile');
const budget = 20000;
(async () => {
  const source = path.join(root, 'assets/vocabulary-scenes-v1.png');
  const {width, height} = await sharp(source).metadata();
  const tile = width / 3;
  if (!Number.isInteger(tile) || height !== tile * 2) throw new Error('Expected a 3 × 2 square scene atlas');
  for (const [index, word] of words.entries()) {
    if (largeIntro && word !== 'decide') continue;
    const crop = {left: index % 3 * tile, top: Math.floor(index / 3) * tile, width: tile, height: tile};
    for (const format of ['avif', 'webp']) {
      let result;
      // Keep the highest resolution and quality that fit the byte budget.
      const sides = largeIntro ? (format === 'avif' ? [512, 448, 384] : [384, 320]) : (format === 'avif' ? [320, 256, 224] : [256, 224, 192]);
      for (const side of sides) {
        for (let quality = largeIntro ? 70 : 65; quality >= (largeIntro ? 30 : 25); quality -= 5) {
          const buffer = await sharp(source).extract(crop).resize(side, side)
            .toFormat(format, {quality, effort: 6}).toBuffer();
          if (buffer.length < budget) { result = {buffer, side, quality}; break; }
        }
        if (result) break;
      }
      if (!result) throw new Error(word + ' cannot fit the image budget');
      // Add a new encoding; existing originals and delivered versions are immutable.
      await fs.writeFile(path.join(root, 'assets/vocabulary-' + word + '-20k-v2.' + format), result.buffer, {flag: 'wx'});
      console.log(JSON.stringify({word, format, bytes: result.buffer.length, side: result.side, quality: result.quality}));
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
