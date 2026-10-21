'use strict';
const assert=require('node:assert/strict');
const {imageDimensions}=require('./image-dimensions');
for(const mime of ['image/png','image/webp','image/jpeg']){
  for(let length=0;length<24;length++)assert.doesNotThrow(()=>imageDimensions(Buffer.alloc(length),mime));
  assert.equal(imageDimensions(Buffer.from('not an image'),mime),null);
}
const png=Buffer.alloc(24);png.write('IHDR',12);png.writeUInt32BE(512,16);png.writeUInt32BE(256,20);
assert.deepEqual(imageDimensions(png,'image/png'),[512,256]);
const webp=Buffer.alloc(30);webp.write('VP8X',12);webp.writeUIntLE(399,24,3);webp.writeUIntLE(199,27,3);
assert.deepEqual(imageDimensions(webp,'image/webp'),[400,200]);
const jpeg=Buffer.from([255,216,255,224,0,4,0,0,255,192,0,7,8,0,200,1,144]);
assert.deepEqual(imageDimensions(jpeg,'image/jpeg'),[400,200]);
const broken=Buffer.from(jpeg);broken.writeUInt16BE(65535,4);
assert.equal(imageDimensions(broken,'image/jpeg'),null);
console.log('image dimensions: bounded header readers, truncated data, PNG, JPEG, WebP passed');
