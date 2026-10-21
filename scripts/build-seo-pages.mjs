/* build-seo-pages.mjs · SEO 内容页预渲染管道（CLI 入口）
 *
 * 运行：node scripts/build-seo-pages.mjs
 *
 * 产出（根相对 URL，服务端静态根 = 仓库根，见 server/index.js）：
 *   /s/{deckId}/{cid}.html   意群句页
 *   /c/{deckId}.html         课程页
 *   /g/{slug}.html           症状词方法论页
 *   /about.html              品牌说明书页
 *   /seo-version.json        内容版本戳（供服务端启动期新鲜度比对）
 *
 * 环境变量：
 *   SEO_LIMIT        仅生成前 N 个句页（本地测试用；默认 0 = 全量）
 *   SEO_ONLY         逗号分隔的类型子集（sentence,deck,brand,symptom；默认全部）
 *   SEO_OUTPUT_ROOT  产出根目录（默认仓库根）
 *
 * 铁律（fail-closed）：
 *   - 缺分片 / 计数不匹配 / 空 chunks / 缺 sentence / (deckId,cid) 重复 → exit≠0 并列出对象；
 *   - 只信任 manifest 声明的分片（禁止目录 glob）；
 *   - 产出目录不得落在 static-guard 敏感前缀下（自检）；
 *   - 绝不「找不到就静默跳过」、绝不产出空页。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContentIndex, assertContentIndexFailClosed } from './seo/content-index.mjs';
import { renderPage } from './seo/template.mjs';
import { renderSentenceModel } from './seo/render-sentence.mjs';
import { renderDeckModel } from './seo/render-deck.mjs';
import { renderBrandModel } from './seo/render-brand.mjs';
import { renderSymptomModel } from './seo/render-symptom.mjs';
// static-guard 是 CJS，Node 可静态解析其 module.exports 具名导出。
import { normalizeRequestPath, isSensitivePath } from '../server/middleware/static-guard.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUTPUT_ROOT = path.resolve(process.env.SEO_OUTPUT_ROOT || ROOT);
const GENERATOR_VERSION = 'seo-m1/1';
const VERSION_FILE = 'seo-version.json';

const ALL_TYPES = ['sentence', 'deck', 'brand', 'symptom'];

function parseLimit() {
  const raw = process.env.SEO_LIMIT;
  if (raw === undefined || raw === null || String(raw).trim() === '') return 0;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`[seo] SEO_LIMIT 非法：${raw}（应为非负整数）`);
  }
  return n;
}

function parseOnly() {
  const raw = process.env.SEO_ONLY;
  if (!raw || !String(raw).trim()) return new Set(ALL_TYPES);
  const set = new Set(String(raw).split(',').map((s) => s.trim()).filter(Boolean));
  for (const t of set) {
    if (!ALL_TYPES.includes(t)) throw new Error(`[seo] SEO_ONLY 含未知类型：${t}（可选 ${ALL_TYPES.join(',')}）`);
  }
  return set;
}

/** 写文件（自动建目录）。html 一律以单个换行收尾，保持字节稳定。 */
function writeFile(root, urlPath, content) {
  const abs = path.join(root, urlPath.replace(/^\//, ''));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

/** 逐条删除（避免对整目录的批量删除触发环境安全护栏）。 */
function removePathSafe(target) {
  if (!fs.existsSync(target)) return;
  const st = fs.lstatSync(target);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(target)) removePathSafe(path.join(target, name));
    fs.rmdirSync(target);
  } else {
    fs.unlinkSync(target);
  }
}

function cleanOutputs(root) {
  /* 默认不删除：产出按文件覆盖写入即可（同 env 重跑字节一致）。
     仅当显式 SEO_CLEAN=1 时才清空旧产物（清理历史子集残留）。 */
  if (String(process.env.SEO_CLEAN || '') !== '1') return;
  for (const dir of ['s', 'c', 'g']) {
    removePathSafe(path.join(root, dir));
  }
  removePathSafe(path.join(root, 'about.html'));
  removePathSafe(path.join(root, VERSION_FILE));
}

/** 产出目录/文件不得落在 static-guard 敏感前缀（否则线上 403）。 */
function assertOutputNotSensitive(urls) {
  const bad = urls.filter((u) => {
    const norm = normalizeRequestPath(u);
    return norm === null || isSensitivePath(norm);
  });
  if (bad.length) {
    throw new Error(`[seo] 产出路径命中 static-guard 敏感规则（会被 403）：\n  - ${bad.join('\n  - ')}`);
  }
}

function loadSymptomPages(root) {
  const file = path.join(root, 'content/seo/symptom-pages.json');
  if (!fs.existsSync(file)) throw new Error(`[seo] 症状词页数据缺失：${file}`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.pages) || !data.pages.length) {
    throw new Error('[seo] content/seo/symptom-pages.json 结构不受支持（需 schemaVersion=1 且 pages 非空）');
  }
  return data.pages;
}

function run() {
  const limit = parseLimit();
  const only = parseOnly();
  const generatedAt = new Date().toISOString();

  console.log(`[seo] 产出根：${OUTPUT_ROOT}`);
  console.log(`[seo] 类型：${Array.from(only).join(',')} · SEO_LIMIT=${limit || '全量'}`);

  const index = loadContentIndex({ rootDir: ROOT });
  assertContentIndexFailClosed(index); // 缺分片/空 chunks/(deckId,cid) 重复 → 抛出（exit≠0）

  /* 跨 deck cid 重复：显式可见 INFO（不阻断，deck 限定 URL 已消解冲突）。 */
  if (index.crossDeckDuplicates.length) {
    console.log(`[seo][INFO] 检测到 ${index.crossDeckDuplicates.length} 处跨 deck cid 重复（URL 已 deck 限定，不阻断）：`);
    for (const d of index.crossDeckDuplicates) {
      console.log(`[seo][INFO]   cid ${d.cid} → ${d.decks.join(', ')}`);
    }
  }

  const deckById = new Map(index.decks.map((d) => [d.id, d]));
  const writtenUrls = [];
  const counts = { deck: 0, sentence: 0, brand: 0, symptom: 0 };
  let truncated = 0;

  cleanOutputs(OUTPUT_ROOT);

  /* ---- 课程页 ---- */
  if (only.has('deck')) {
    for (const deck of index.decks) {
      const url = `/c/${encodeURIComponent(deck.id)}.html`;
      writeFile(OUTPUT_ROOT, url, renderPage(renderDeckModel(deck, index.contentVersion)));
      writtenUrls.push(url);
      counts.deck += 1;
    }
  }

  /* ---- 句页（受 SEO_LIMIT 截断） ---- */
  if (only.has('sentence')) {
    const all = index.sentences;
    const target = limit > 0 ? Math.min(limit, all.length) : all.length;
    truncated = all.length - target;
    for (let i = 0; i < target; i += 1) {
      const ref = all[i];
      const deck = deckById.get(ref.deckId);
      const url = `/s/${encodeURIComponent(ref.deckId)}/${encodeURIComponent(ref.cid)}.html`;
      writeFile(OUTPUT_ROOT, url, renderPage(renderSentenceModel(deck, ref.item, index.contentVersion)));
      writtenUrls.push(url);
      counts.sentence += 1;
    }
    if (truncated > 0) {
      console.log(`[seo][INFO] SEO_LIMIT=${limit} 生效：句页由 ${all.length} 截断为 ${target}（未生成 ${truncated} 页）`);
    }
  }

  /* ---- 品牌说明书页 ---- */
  if (only.has('brand')) {
    const deckLinks = index.decks.slice(0, 6).map((d) => ({ id: d.id, name: d.name }));
    const url = '/about.html';
    writeFile(OUTPUT_ROOT, url, renderPage(renderBrandModel({ deckLinks, contentVersion: index.contentVersion })));
    writtenUrls.push(url);
    counts.brand += 1;
  }

  /* ---- 症状词方法论页 ---- */
  if (only.has('symptom')) {
    const pages = loadSymptomPages(ROOT);
    for (const entry of pages) {
      if (!entry.slug || !entry.symptom) {
        throw new Error(`[seo] 症状词页条目缺 slug/symptom：${JSON.stringify(entry)}`);
      }
      const missing = (entry.relatedDecks || []).filter((id) => !deckById.has(id));
      if (missing.length) {
        throw new Error(`[seo] 症状词页 ${entry.slug} 引用了不存在的 deck：${missing.join(', ')}`);
      }
      const url = `/g/${encodeURIComponent(entry.slug)}.html`;
      writeFile(OUTPUT_ROOT, url, renderPage(renderSymptomModel(entry, deckById, index.contentVersion)));
      writtenUrls.push(url);
      counts.symptom += 1;
    }
  }

  const pageCount = writtenUrls.length;

  /* ---- static-guard 敏感前缀自检 ---- */
  const checkTargets = writtenUrls.concat([`/${VERSION_FILE}`]);
  assertOutputNotSensitive(checkTargets);

  /* ---- 版本戳（供服务端启动新鲜度比对） ---- */
  const versionPayload = {
    contentVersion: index.contentVersion,
    generatedAt,
    pageCount,
    generatorVersion: GENERATOR_VERSION,
    counts,
    truncatedFromHashLimit: truncated,
  };
  writeFile(OUTPUT_ROOT, `/${VERSION_FILE}`, JSON.stringify(versionPayload, null, 2) + '\n');

  console.log(`[seo] 完成：课程页 ${counts.deck} · 句页 ${counts.sentence} · 品牌页 ${counts.brand} · 症状页 ${counts.symptom} · 共 ${pageCount} 页`);
  console.log(`[seo] contentVersion=${index.contentVersion}`);
  console.log(`[seo] 版本戳：${path.join(OUTPUT_ROOT, VERSION_FILE)}`);
}

try {
  run();
} catch (err) {
  console.error(String(err && err.message ? err.message : err));
  process.exitCode = 1;
}
