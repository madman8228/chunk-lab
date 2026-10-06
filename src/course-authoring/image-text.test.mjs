import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { IMAGE_TEXT_DRAFT_EXAMPLE } from './image-text-draft-spec.mjs';
import { ImageTextDraftValidator } from './image-text-draft-validator.mjs';
import { ImageTextCourseCompiler } from './image-text-compiler.mjs';
import { ImageTextBundleCodec } from './image-bundle-codec.mjs';
import { ImageTextPackageAdapter } from './adapters/image-text-package-adapter.mjs';
import { BrowserImageFileReader } from './adapters/image-file-reader.mjs';

const require = createRequire(import.meta.url);
const schemaValidator = require('../../scripts/course-schema-validator-entry.js');
const packageContract = require('../../js/course-package-contract.js');

test('图文素材读取拒绝格式伪装并检查解码尺寸', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOs2PKBgYGBiQEMABkCAiDaYDR0AAAAAElFTkSuQmCC', 'base64');
  const reader = new BrowserImageFileReader({ createBitmap: async () => ({ width: 2, height: 2, close() {} }), subtle: null });
  const valid = await reader.read(new File([png], 'scene.png', { type: 'image/png' }));
  assert.equal(valid.width, 2);
  await assert.rejects(reader.read(new File([png], 'scene.jpg', { type: 'image/jpeg' })), /内容与声明格式不一致/);
  const oversized = new BrowserImageFileReader({ createBitmap: async () => ({ width: 5000, height: 1, close() {} }), subtle: null });
  await assert.rejects(oversized.read(new File([png], 'scene.png', { type: 'image/png' })), /尺寸过大/);
});

test('图文课程要求每张声明图片都有对应文件，并校验意群', () => {
  const validator = new ImageTextDraftValidator({ schemaValidator });
  const missing = validator.validate(IMAGE_TEXT_DRAFT_EXAMPLE);
  assert.equal(missing.valid, false);
  assert.ok(missing.issues.some((issue) => issue.code === 'MISSING_IMAGE_FILE'));
  const supplied = [{ name: 'cafe-counter.png', size: 512, mimeType: 'image/png' }];
  assert.equal(validator.validate(IMAGE_TEXT_DRAFT_EXAMPLE, supplied).valid, true);
  const damaged = structuredClone(IMAGE_TEXT_DRAFT_EXAMPLE);
  damaged.items[0].chunks[0] = 'different';
  assert.ok(validator.validate(damaged, supplied).issues.some((issue) => issue.code === 'IMAGE_CHUNK_MISMATCH'));
});

test('图文课程可编译成现有 2.0 课程包并还原成可分享草稿', async () => {
  const compiler = new ImageTextCourseCompiler({ schemaValidator, packageContract });
  const result = compiler.compile(IMAGE_TEXT_DRAFT_EXAMPLE, {
    courseId: 'ai-123456789012',
    images: [{ key: 'cafe', extension: 'png', mimeType: 'image/png' }]
  });
  assert.equal(result.course.schemaVersion, '2.0');
  assert.deepEqual(packageContract.validateCourseV2(result.course), []);
  assert.equal(result.course.utterances[0].imageAssetId, result.course.assets[0].id);
  assert.equal(Object.hasOwn(result.course.assets[0], '_dataUri'), false);
  const materialized = await new ImageTextPackageAdapter().materialize(result.course, result.assetRefs, [
    { id: 'cafe', blob: new Blob([Uint8Array.of(0)], { type: 'image/png' }), metadata: { mimeType: 'image/png' } }
  ]);
  const projected = compiler.project(materialized.course);
  assert.equal(projected.items.length, 2);
  assert.equal(projected.items[0].en, IMAGE_TEXT_DRAFT_EXAMPLE.items[0].en);
  const bundle = await new ImageTextBundleCodec().encode(projected, materialized.course);
  assert.equal(bundle.format, 'chunklab-ai-image-bundle');
  assert.equal(bundle.images[0].sha256.length, 64);
  const bundleText = JSON.stringify(bundle).padEnd(300 * 1024, ' ');
  assert.equal(new ImageTextBundleCodec().parseText(bundleText).ok, true);
  const decoded = await new ImageTextBundleCodec().decode(bundle);
  assert.equal(decoded.draft.items[1].en, IMAGE_TEXT_DRAFT_EXAMPLE.items[1].en);
  assert.equal(decoded.files[0].name, 'cafe.png');
  const corrupted = structuredClone(bundle);
  corrupted.images[0].sha256 = '0'.repeat(64);
  await assert.rejects(new ImageTextBundleCodec().decode(corrupted), /完整性检查失败/);
});
