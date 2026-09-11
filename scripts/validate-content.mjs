/* validate-content.mjs · 校验 manifest 与内置扩展题库分片是否同步
 *
 * 不生成、不修改文件，只验证：
 * - manifest 声明的每个分片存在、JSON 格式正确、数量与 hash 一致；
 * - 分片总数与 oral8000.js / freq-idioms.js 当前源数据一致；
 * - manifest 的 baseCount / totalCount 与基础题库和扩展题库一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(ROOT, 'content', 'manifest.json');

function runScript(file, initialWindow) {
  const context = {
    window: initialWindow || {},
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  return context.window;
}

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function validateDeck(manifestDeck, expected) {
  if (!manifestDeck || manifestDeck.id !== expected.id) fail(`manifest 缺少 ${expected.id}`);
  if (!Array.isArray(manifestDeck.shards) || !manifestDeck.shards.length) fail(`${expected.id} 没有分片`);
  if (manifestDeck.baseCount !== expected.baseCount) {
    fail(`${expected.id} baseCount=${manifestDeck.baseCount}，期望 ${expected.baseCount}`);
  }

  const urls = new Set();
  let itemCount = 0;
  manifestDeck.shards.forEach((shard, index) => {
    if (!shard || typeof shard.url !== 'string' || shard.url.startsWith('/') || shard.url.includes('..')) {
      fail(`${expected.id} 第 ${index + 1} 个分片 URL 不安全`);
    }
    if (urls.has(shard.url)) fail(`${expected.id} 分片 URL 重复：${shard.url}`);
    urls.add(shard.url);
    const absolute = path.join(ROOT, shard.url);
    if (!fs.existsSync(absolute)) fail(`${expected.id} 分片不存在：${shard.url}`);
    const bytes = fs.readFileSync(absolute);
    if (shard.sha256 !== sha256(bytes)) fail(`${expected.id} 分片 hash 不匹配：${shard.url}`);
    let data;
    try { data = JSON.parse(bytes.toString('utf8')); } catch (e) { fail(`${expected.id} 分片不是合法 JSON：${shard.url}`); }
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.items)) {
      fail(`${expected.id} 分片 schema 错误：${shard.url}`);
    }
    if (data.mode !== shard.mode) fail(`${expected.id} 分片 mode 不匹配：${shard.url}`);
    if (shard.count !== data.items.length) fail(`${expected.id} 分片 count 不匹配：${shard.url}`);
    if (data.items.length > 200) fail(`${expected.id} 分片超过 200 条：${shard.url}`);
    itemCount += data.items.length;
  });

  if (itemCount !== expected.extensionCount) {
    fail(`${expected.id} 分片总数=${itemCount}，源数据期望 ${expected.extensionCount}`);
  }
  if (manifestDeck.totalCount !== expected.baseCount + expected.extensionCount) {
    fail(`${expected.id} totalCount=${manifestDeck.totalCount}，期望 ${expected.baseCount + expected.extensionCount}`);
  }
  return itemCount;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.decks)) {
  fail('content/manifest.json schema 不受支持');
}
if (!manifest.contentVersion) fail('content/manifest.json 缺少 contentVersion');

const baseWindow = runScript('builtins.js');
const baseDaily = (baseWindow.BUILTIN || []).find((deck) => deck.id === 'builtin-daily');
const oralWindow = runScript('oral8000.js');
const oralItems = oralWindow.DATA_ORAL8000;
const freqWindow = runScript('freq-idioms.js', { BUILTIN: [] });
const freqDeck = (freqWindow.BUILTIN || []).find((deck) => deck.id === 'builtin-freq-idioms');
if (!baseDaily || !Array.isArray(oralItems) || !freqDeck || !Array.isArray(freqDeck.items)) {
  fail('无法读取内置题库源数据');
}

const byId = new Map(manifest.decks.map((deck) => [deck.id, deck]));
validateDeck(byId.get('builtin-daily'), {
  id: 'builtin-daily',
  baseCount: baseDaily.items.length,
  extensionCount: oralItems.length,
});
validateDeck(byId.get('builtin-freq-idioms'), {
  id: 'builtin-freq-idioms',
  baseCount: 0,
  extensionCount: freqDeck.items.length,
});

console.log(`[content] manifest 与分片校验通过：${baseDaily.items.length + oralItems.length} 日常 + ${freqDeck.items.length} 高频短语`);
