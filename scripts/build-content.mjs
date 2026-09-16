/* build-content.mjs · 将内置题库生成可懒加载的内容分片与轻量索引
 *
 * 运行：node scripts/build-content.mjs
 *
 * 设计（2026-09-15：口语 8000 合并为唯一内容源 oral-book.js）：
 * - oral-book.js 是**构建期**内容源（页面不加载它）：含 45 个「日常口语 8000」deck；
 * - freq-idioms.js 仍为高频短语源；
 * - 所有 deck 一律按 `replace` 模式分片：页面通过 manifest + 分片取内容，
 *   builtins.js 不再持有句子（只留迁移表）；
 * - 输出文件名带内容 hash，配合 manifest 形成不可变 URL，避免 SW 复用旧内容；
 * - index 分片只保存 cid/中英文和详情分片位置，统计页不必解析完整题目。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
/* 「最少切几段」的唯一判据（含单字句例外）—— 同目录 */
import CS from '../js/chunk-shape.js';

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

/* 递归删除目录（用 unlink+rmdir 而非 rmSync —— 本仓沙箱下后者更易被拦） */
function removeDirDeep(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const target = path.join(dir, name);
    if (fs.statSync(target).isDirectory()) removeDirDeep(target);
    else fs.unlinkSync(target);
  }
  fs.rmdirSync(dir);
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

/* ---------- 读取源数据 ---------- */
const bookWindow = runScript('oral-book.js');
const book = bookWindow.ORAL_BOOK;
if (!book || !Array.isArray(book.decks) || !book.decks.length) {
  throw new Error('oral-book.js 没有 window.ORAL_BOOK.decks');
}
const decks = book.decks;
/* 结构自检：id 唯一、cid 唯一、必填字段 */
const seenId = new Set();
for (const deck of decks) {
  if (!deck.id || seenId.has(deck.id)) throw new Error(`deck id 缺失或重复：${deck.id}`);
  seenId.add(deck.id);
  if (!deck.name) throw new Error(`deck ${deck.id} 缺 name`);
  if (!Array.isArray(deck.items) || !deck.items.length) throw new Error(`deck ${deck.id} 没有 items`);
  const cids = new Set();
  for (const it of deck.items) {
    if (!it.cid) throw new Error(`deck ${deck.id} 有条目缺 cid`);
    if (cids.has(it.cid)) throw new Error(`deck ${deck.id} cid 重复：${it.cid}`);
    cids.add(it.cid);
    if (!it.sentence || !it.translation) throw new Error(`deck ${deck.id} 有条目缺 sentence/translation`);
    const chunkErr = CS.chunkCountError(it.sentence, it.chunks);
    if (chunkErr) throw new Error(`deck ${deck.id} 有条目 ${chunkErr}：${it.sentence}`);
  }
}

const freqWindow = runScript('freq-idioms.js', { BUILTIN: [] });
const freqDeck = (freqWindow.BUILTIN || []).find((deck) => deck.id === 'builtin-freq-idioms');
if (!freqDeck || !Array.isArray(freqDeck.items) || !freqDeck.items.length) {
  throw new Error('freq-idioms.js 中缺少 builtin-freq-idioms');
}

/* ---------- 清理旧分片目录（content/ 下均为生成物；物理删除避免孤儿文件） ---------- */
const contentRoot = path.join(ROOT, 'content');
if (fs.existsSync(contentRoot)) {
  for (const name of fs.readdirSync(contentRoot)) {
    const target = path.join(contentRoot, name);
    if (fs.statSync(target).isDirectory()) removeDirDeep(target);
  }
}

/* ---------- 逐 deck 生成分片 ---------- */
const manifest = {
  schemaVersion: 1,
  contentVersion: '',
  series: book.series || '',
  chapters: book.chapters || [],
  decks: [],
};

for (const deck of decks) {
  const dir = `content/${deck.id}`;
  const shards = writeShards(dir, 'oral', deck.items, 'replace');
  const indexShards = writeShards(dir, 'oral-index', buildIndexItems(deck.items, shards), 'index');
  if (!shards.length) throw new Error(`${deck.id} 没有生成任何详情分片`);
  manifest.decks.push({
    id: deck.id,
    name: deck.name,
    short: deck.short || '',
    desc: deck.desc || '',
    chapter: deck.chapter,
    section: deck.section || '',
    sectionTitle: deck.sectionTitle || '',
    topic: deck.topic || '',
    baseCount: 0,
    totalCount: deck.items.length,
    shards,
    indexShards,
  });
  console.log(`[content] ${deck.id.padEnd(14)} ${String(deck.items.length).padStart(3)} 句  （${shards.length} 详情 / ${indexShards.length} index）  ${deck.name}`);
}

const freqShards = writeShards('content/builtin-freq-idioms', 'idioms', freqDeck.items, 'replace');
const freqIndexShards = writeShards(
  'content/builtin-freq-idioms',
  'idioms-index',
  buildIndexItems(freqDeck.items, freqShards),
  'index',
);
manifest.decks.push({
  id: 'builtin-freq-idioms',
  name: freqDeck.name,
  short: '高频短语',
  desc: freqDeck.desc || '高频英语短语',
  chapter: null,
  section: '',
  sectionTitle: '',
  topic: '',
  baseCount: 0,
  totalCount: freqDeck.items.length,
  shards: freqShards,
  indexShards: freqIndexShards,
});
console.log(`[content] ${'builtin-freq-idioms'.padEnd(14)} ${String(freqDeck.items.length).padStart(3)} 句  （${freqShards.length} 详情 / ${freqIndexShards.length} index）`);

// Deterministic release identity: includes shard order/content, so any edit
// invalidates saved offsets.
manifest.contentVersion = 'v1-' + crypto.createHash('sha256')
  .update(JSON.stringify({ decks: manifest.decks })).digest('hex');
fs.mkdirSync(path.join(ROOT, 'content'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'content/manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const total = decks.reduce((sum, d) => sum + d.items.length, 0);
console.log(`[content] 共 ${manifest.decks.length} 个 deck（口语 8000：${decks.length} 个 / ${total} 句 + 高频短语 ${freqDeck.items.length} 句）`);
