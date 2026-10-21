/* content-index.mjs · SEO 预渲染的「数据契约」层
 *
 * 职责：读取 `content/manifest.json` → 根据 manifest **声明**的分片路径加载分片 →
 *      构建 (deckId, cid) → SentenceItem 索引，并在任何产出之前执行 fail-closed 断言。
 *
 * 铁律：
 *  1. 只信任 manifest 的 `decks[].shards[].url` / `indexShards[].url`，
 *     **禁止对 content/ 目录做 glob**（该 worktree 存在孤儿/半成品分片）。
 *  2. 缺分片 / 分片计数不匹配 / 空 chunks / 缺 sentence / (deckId,cid) 重复 →
 *     抛出明确异常（调用方据此 exit≠0），绝不静默跳过、绝不产出空页。
 *  3. 同一 cid 跨 deck 重复（已知 9 处）→ 记录为 INFO（可见），不阻断
 *     —— 因为句页 URL 已 deck 限定，冲突已被消解（见架构 §2）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 从分片 item 派生句页所需的稳定结构（字段可能缺失，交由渲染层容错）。 */
function toSentenceItem(raw) {
  return {
    cid: raw.cid,
    sentence: raw.sentence,
    translation: raw.translation || '',
    chunks: Array.isArray(raw.chunks) ? raw.chunks : [],
    hints: Array.isArray(raw.hints) ? raw.hints : [],
    grammar: Array.isArray(raw.grammar) ? raw.grammar : [],
    explanations: Array.isArray(raw.explanations) ? raw.explanations : [],
    distractors: Array.isArray(raw.distractors) ? raw.distractors : [],
  };
}

/**
 * 加载内容索引。
 * @param {object} [options]
 * @param {string} [options.rootDir] 仓库根（默认：脚本上两级）
 * @param {string} [options.manifestPath] manifest 相对/绝对路径（默认 content/manifest.json）
 * @returns {{
 *   manifest: object, contentVersion: string, series: string, chapters: object[],
 *   decks: object[], sentences: object[],
 *   crossDeckDuplicates: {cid:string, decks:string[]}[],
 *   resolve: (deckId:string, cid:string) => object|null,
 *   iterSentences: (deckId?:string) => object[],
 *   problems: string[]
 * }}
 */
export function loadContentIndex(options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(HERE, '..', '..'));
  const manifestRel = options.manifestPath || 'content/manifest.json';
  const manifestAbs = path.isAbsolute(manifestRel) ? manifestRel : path.join(rootDir, manifestRel);

  if (!fs.existsSync(manifestAbs)) {
    throw new Error(`[seo] manifest 不存在：${manifestAbs}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestAbs, 'utf8'));

  const problems = [];
  if (manifest.schemaVersion !== 1) problems.push(`manifest.schemaVersion 必须为 1（实际 ${manifest.schemaVersion}）`);
  if (!Array.isArray(manifest.decks) || !manifest.decks.length) problems.push('manifest.decks 非空数组校验失败');

  const decks = [];
  const sentences = [];
  const byKey = new Map();       // `${deckId}\n${cid}` -> SentenceItem
  const cidToDecks = new Map();  // cid -> Set(deckId)

  for (const deck of manifest.decks || []) {
    const shards = Array.isArray(deck.shards) ? deck.shards : [];
    const indexShards = Array.isArray(deck.indexShards) ? deck.indexShards : [];
    if (!shards.length) problems.push(`deck ${deck.id} 未声明任何详情分片（shards 为空）`);

    const seenInDeck = new Map(); // cid -> shardUrl（同 deck 内重复即 fail-closed）
    const detailItems = [];

    for (const shard of shards) {
      const shardAbs = path.join(rootDir, shard.url);
      if (!fs.existsSync(shardAbs)) {
        problems.push(`分片缺失：deck ${deck.id} → ${shard.url}`);
        continue;
      }
      let data;
      try {
        data = JSON.parse(fs.readFileSync(shardAbs, 'utf8'));
      } catch (err) {
        problems.push(`分片无法解析：${shard.url}（${err.message}）`);
        continue;
      }
      if (!Array.isArray(data.items)) {
        problems.push(`分片格式错误（items 非数组）：${shard.url}`);
        continue;
      }
      if (Number(shard.count) !== data.items.length) {
        problems.push(`分片计数不匹配：${shard.url} 实际 ${data.items.length}，manifest 声明 ${shard.count}`);
      }
      data.items.forEach((raw, offset) => {
        if (!raw || typeof raw.cid !== 'string' || !raw.cid) {
          problems.push(`条目缺 cid：deck ${deck.id} · ${shard.url} #${offset}`);
          return;
        }
        if (seenInDeck.has(raw.cid)) {
          problems.push(`同一 deck 内 cid 重复：deck ${deck.id} · cid ${raw.cid}`);
          return;
        }
        if (!raw.sentence || typeof raw.sentence !== 'string') {
          problems.push(`条目缺 sentence：deck ${deck.id} · cid ${raw.cid}`);
          return;
        }
        if (!Array.isArray(raw.chunks) || !raw.chunks.length) {
          problems.push(`条目 chunks 为空：deck ${deck.id} · cid ${raw.cid}`);
          return;
        }
        seenInDeck.set(raw.cid, shard.url);
        const item = toSentenceItem(raw);
        const ref = {
          deckId: deck.id,
          cid: raw.cid,
          shardUrl: shard.url,
          offset,
          item,
        };
        detailItems.push(ref);
        sentences.push(ref);
        byKey.set(`${deck.id}\n${raw.cid}`, ref);
        if (!cidToDecks.has(raw.cid)) cidToDecks.set(raw.cid, new Set());
        cidToDecks.get(raw.cid).add(deck.id);
      });
    }

    decks.push({
      id: deck.id,
      name: deck.name || deck.id,
      short: deck.short || '',
      desc: deck.desc || '',
      chapter: deck.chapter,
      section: deck.section || '',
      sectionTitle: deck.sectionTitle || '',
      topic: deck.topic || '',
      baseCount: Number(deck.baseCount) || 0,
      totalCount: Number(deck.totalCount) || detailItems.length,
      shards,
      indexShards,
      shardUrls: shards.map((s) => s.url),
      indexShardUrls: indexShards.map((s) => s.url),
      sentences: detailItems,
    });
  }

  /* 跨 deck cid 重复：可见 INFO，不阻断（deck 限定 URL 已消解冲突）。 */
  const crossDeckDuplicates = [];
  for (const [cid, deckSet] of cidToDecks.entries()) {
    if (deckSet.size > 1) crossDeckDuplicates.push({ cid, decks: Array.from(deckSet) });
  }
  crossDeckDuplicates.sort((a, b) => (a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : 0));

  return {
    manifest,
    contentVersion: String(manifest.contentVersion || ''),
    series: manifest.series || '',
    chapters: Array.isArray(manifest.chapters) ? manifest.chapters : [],
    decks,
    sentences,
    crossDeckDuplicates,
    problems,
    resolve(deckId, cid) {
      const ref = byKey.get(`${deckId}\n${cid}`);
      return ref ? ref.item : null;
    },
    iterSentences(deckId) {
      return deckId ? sentences.filter((s) => s.deckId === deckId) : sentences.slice();
    },
  };
}

/**
 * fail-closed 断言：任何 problems 即抛出（含全部明细），供生成器 exit≠0。
 * @param {ReturnType<loadContentIndex>} index
 */
export function assertContentIndexFailClosed(index) {
  if (index.problems && index.problems.length) {
    const detail = index.problems.slice(0, 50).join('\n  - ');
    const more = index.problems.length > 50 ? `\n  …还有 ${index.problems.length - 50} 条` : '';
    throw new Error(`[seo] fail-closed：内容索引校验未通过（${index.problems.length} 项）\n  - ${detail}${more}`);
  }
}
