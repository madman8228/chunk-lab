/* build-content.mjs · 将内置扩展题库生成可懒加载的内容分片与轻量索引
 *
 * 运行：node scripts/build-content.mjs
 *
 * 设计约束：
 * - builtins.js 保留 88 条基础日常题，作为旧页面/离线兜底；
 * - oral8000.js 与 freq-idioms.js 只作为源数据，不再由页面直接 script 加载；
 * - 输出文件名带内容 hash，配合 manifest 形成不可变 URL，避免 SW 复用旧内容；
 * - index 分片只保存 cid/中英文和详情分片位置，统计页不必解析完整题目。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScript(file, initialWindow) {
  const context = {
    window: initialWindow || {},
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  return context.window;
}

function hashBytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

const SHARD_SIZE = 200;

function writeShards(relativeDir, prefix, items, mode) {
  const outputDir = path.join(ROOT, relativeDir);
  if (fs.existsSync(outputDir)) {
    for (const oldFile of fs.readdirSync(outputDir)) {
      if (oldFile.startsWith(`${prefix}-`) && oldFile.endsWith('.json')) {
        fs.unlinkSync(path.join(outputDir, oldFile));
      }
    }
  }
  const shards = [];
  for (let offset = 0; offset < items.length; offset += SHARD_SIZE) {
    const part = items.slice(offset, offset + SHARD_SIZE);
    const body = JSON.stringify({ schemaVersion: 1, mode, items: part }, null, 2) + '\n';
    const hash = hashBytes(body);
    const partNo = String(Math.floor(offset / SHARD_SIZE) + 1).padStart(3, '0');
    const filePrefix = `${prefix}-${partNo}`;
    const relativePath = path.posix.join(relativeDir.replaceAll(path.sep, '/'), `${filePrefix}-${hash}.json`);
    const absolutePath = path.join(ROOT, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, body, 'utf8');
    shards.push({
      id: `${filePrefix}-${hash}`,
      url: relativePath,
      count: part.length,
      bytes: Buffer.byteLength(body),
      sha256: crypto.createHash('sha256').update(body).digest('hex'),
      mode,
    });
  }
  return shards;
}

function buildIndexItems(items, detailShards) {
  const result = [];
  let shardIndex = 0;
  let shardStart = 0;
  items.forEach((item, offset) => {
    while (shardIndex < detailShards.length && offset >= shardStart + detailShards[shardIndex].count) {
      shardStart += detailShards[shardIndex].count;
      shardIndex += 1;
    }
    const detail = detailShards[shardIndex];
    if (!detail) throw new Error(`无法为第 ${offset} 条内容找到详情分片`);
    result.push({
      cid: item.cid,
      sentence: item.sentence || item.en || item.sent || '',
      translation: item.translation || item.zh || '',
      sourceUrl: detail.url,
      sourceOffset: offset - shardStart,
    });
  });
  return result;
}

const baseWindow = runScript('builtins.js');
const baseDaily = (baseWindow.BUILTIN || []).find((deck) => deck.id === 'builtin-daily');
if (!baseDaily) throw new Error('builtins.js 中缺少 builtin-daily');

const oralWindow = runScript('oral8000.js');
const oralItems = oralWindow.DATA_ORAL8000;
if (!Array.isArray(oralItems) || !oralItems.length) throw new Error('oral8000.js 没有 DATA_ORAL8000');

const freqWindow = runScript('freq-idioms.js', { BUILTIN: [] });
const freqDeck = (freqWindow.BUILTIN || []).find((deck) => deck.id === 'builtin-freq-idioms');
if (!freqDeck || !Array.isArray(freqDeck.items) || !freqDeck.items.length) {
  throw new Error('freq-idioms.js 中缺少 builtin-freq-idioms');
}

const dailyShards = writeShards('content/builtin-daily', 'oral', oralItems, 'append');
const freqShards = writeShards('content/builtin-freq-idioms', 'idioms', freqDeck.items, 'replace');
const dailyIndexShards = writeShards(
  'content/builtin-daily',
  'oral-index',
  buildIndexItems(oralItems, dailyShards),
  'index',
);
const freqIndexShards = writeShards(
  'content/builtin-freq-idioms',
  'idioms-index',
  buildIndexItems(freqDeck.items, freqShards),
  'index',
);

const manifest = {
  schemaVersion: 1,
  contentVersion: '2026-09-11',
  decks: [
    {
      id: 'builtin-daily',
      name: baseDaily.name,
      desc: '生活口语综合题库',
      baseCount: baseDaily.items.length,
      totalCount: baseDaily.items.length + oralItems.length,
      shards: dailyShards,
      indexShards: dailyIndexShards,
      legacyFallback: 'oral8000.js',
    },
    {
      id: 'builtin-freq-idioms',
      name: freqDeck.name,
      desc: freqDeck.desc || '高频英语短语',
      baseCount: 0,
      totalCount: freqDeck.items.length,
      shards: freqShards,
      indexShards: freqIndexShards,
      legacyFallback: 'freq-idioms.js',
    },
  ],
};

fs.mkdirSync(path.join(ROOT, 'content'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'content/manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[content] generated ${oralItems.length} oral + ${freqDeck.items.length} idiom items`);
console.log(`[content] daily shards: ${dailyShards.map((shard) => shard.url).join(', ')}`);
console.log(`[content] idiom shards: ${freqShards.map((shard) => shard.url).join(', ')}`);
console.log(`[content] index shards: ${dailyIndexShards.length + freqIndexShards.length}`);
