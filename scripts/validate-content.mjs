/* validate-content.mjs · 校验 manifest、内容分片与轻量索引是否同步
 *
 * 不生成、不修改文件，只验证：
 * - manifest 声明的每个分片存在、JSON 格式正确、数量与 hash 一致；
 * - 分片总数与 oral8000.js / freq-idioms.js 当前源数据一致；
 * - manifest 的 baseCount / totalCount 与基础题库和扩展题库一致。
 * - index 分片与详情分片一一对应，cid、顺序和详情位置合法。
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

function validateIndexDeck(manifestDeck, expected) {
  if (!Array.isArray(manifestDeck.indexShards) || !manifestDeck.indexShards.length) {
    fail(`${expected.id} 没有 index 分片`);
  }
  const detailUrls = new Set((manifestDeck.shards || []).map((shard) => shard.url));
  const indexUrls = new Set();
  let itemCount = 0;
  let previousSource = '';
  let previousOffset = -1;
  manifestDeck.indexShards.forEach((shard, index) => {
    if (!shard || typeof shard.url !== 'string' || shard.url.startsWith('/') || shard.url.includes('..')) {
      fail(`${expected.id} 第 ${index + 1} 个 index URL 不安全`);
    }
    if (indexUrls.has(shard.url)) fail(`${expected.id} index URL 重复：${shard.url}`);
    indexUrls.add(shard.url);
    const absolute = path.join(ROOT, shard.url);
    if (!fs.existsSync(absolute)) fail(`${expected.id} index 分片不存在：${shard.url}`);
    const bytes = fs.readFileSync(absolute);
    if (shard.sha256 !== sha256(bytes)) fail(`${expected.id} index hash 不匹配：${shard.url}`);
    let data;
    try { data = JSON.parse(bytes.toString('utf8')); } catch (e) { fail(`${expected.id} index 不是合法 JSON：${shard.url}`); }
    if (!data || data.schemaVersion !== 1 || data.mode !== 'index' || !Array.isArray(data.items)) {
      fail(`${expected.id} index schema 错误：${shard.url}`);
    }
    if (shard.count !== data.items.length) fail(`${expected.id} index count 不匹配：${shard.url}`);
    if (data.items.length > 200) fail(`${expected.id} index 超过 200 条：${shard.url}`);
    data.items.forEach((item, itemIndex) => {
      if (!item || typeof item.cid !== 'string' || !item.cid || typeof item.sentence !== 'string') {
        fail(`${expected.id} index 缺少 cid/sentence：${shard.url}#${itemIndex}`);
      }
      if (typeof item.translation !== 'string') fail(`${expected.id} index translation 非字符串：${shard.url}#${itemIndex}`);
      if (!detailUrls.has(item.sourceUrl)) fail(`${expected.id} index sourceUrl 不在详情分片中：${item.sourceUrl}`);
      if (!Number.isInteger(item.sourceOffset) || item.sourceOffset < 0) {
        fail(`${expected.id} index sourceOffset 非法：${shard.url}#${itemIndex}`);
      }
      if (item.sourceUrl < previousSource || (item.sourceUrl === previousSource && item.sourceOffset <= previousOffset)) {
        fail(`${expected.id} index 详情位置未按题目顺序递增：${shard.url}#${itemIndex}`);
      }
      previousSource = item.sourceUrl;
      previousOffset = item.sourceOffset;
    });
    itemCount += data.items.length;
  });
  if (itemCount !== expected.extensionCount) {
    fail(`${expected.id} index 总数=${itemCount}，源数据期望 ${expected.extensionCount}`);
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
validateIndexDeck(byId.get('builtin-daily'), {
  id: 'builtin-daily',
  extensionCount: oralItems.length,
});
validateIndexDeck(byId.get('builtin-freq-idioms'), {
  id: 'builtin-freq-idioms',
  extensionCount: freqDeck.items.length,
});

console.log(`[content] manifest、详情分片与 index 校验通过：${baseDaily.items.length + oralItems.length} 日常 + ${freqDeck.items.length} 高频短语`);
