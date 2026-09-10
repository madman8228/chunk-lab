/* scripts/inject-freq-idioms.js
 * 把 extra/batch*.json 数组中的条目校验后追加到 freq-idioms.js 的 DATA_FREQ_IDIOMS 数组末尾。
 *
 * 用法：
 *   node scripts/inject-freq-idioms.js extra/batch2a.json extra/batch2b.json ...
 *
 * 规则（与 validate_freq_idioms.js 一致，注入前在本脚本复刻一遍以早失败）：
 *  1) chunks 2~5 个
 *  2) chunks.join('').replace(/\s+/g, '') 必须等于 sentence.replace(/\s+/g, '')
 *  3) chunk 不以 .?!,;: 开头；非末 chunk 不以句末标点 .?! 结尾
 *  4) hints/grammar 长度等于 chunks；grammar 每块含 role/color/pos/meaning/phonetic[]
 *  5) explanations 至少 2 条
 *  6) 与源库 high_freq_600.json 对照：grammar.pos/role 标为习语/谚语/固定搭配 的 chunk
 *     必须在源数据中存在（去空格规范化后做子串匹配），提示但非阻断（首条目或轻微变形可放过）
 *  7) 注入格式保持与 freq-idioms.js 数据区相同的 compact JS 风格
 *  8) 去重护栏（2026-09-07）：注入前解析现有库，条目与「库内已入库」或「本批内」句子重复
 *     （去全部空白后比对，同 cid 但句不同仅为哈希碰撞提示）即中止，杜绝 v42 式重 key 前科复发。
 *
 * 注意：脚本不主动写 cid——每条 JSON 必须自带 cid: fnv8(sentence)（fnv8 与 core.js Math.imul 实现一致）。
 *      若条目缺 cid，会在 fnv8(sentence) 现场计算填入。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const tr = require('./translation-rules');

/* fnv8 与 core.js / validate_freq_idioms.js / scripts/add-cids.js 保持一致 */
function fnv8(str) {
  let h = 0x811c9dc5 >>> 0;
  str = String(str == null ? '' : str);
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  let x = (h >>> 0).toString(16);
  while (x.length < 8) x = '0' + x;
  return x;
}

/* 校验规则：返回错误数组（空=通过） */
function validateItems(items, sourceList) {
  const issues = [];
  items.forEach((it, idx) => {
    const ms = [];
    if (!it.sentence || !it.translation) ms.push('缺 sentence/translation');
    if (!Array.isArray(it.chunks) || it.chunks.length < 2 || it.chunks.length > 5) ms.push('chunks 需 2~5 个');
    else {
      const join = it.chunks.join('').replace(/\s+/g, '');
      const sent = String(it.sentence).replace(/\s+/g, '');
      if (join !== sent) ms.push('拼接≠原句: ' + JSON.stringify(it.chunks.join('')) + ' vs ' + JSON.stringify(it.sentence));
      it.chunks.forEach((c, j) => {
        if (!c || !c.trim()) ms.push('chunk 空');
        if (/^[.?!,;:]/.test(c)) ms.push('前导标点: ' + JSON.stringify(c));
        if (j < it.chunks.length - 1 && /[.?!]\s*$/.test(c)) ms.push('非末句末标点: ' + JSON.stringify(c));
      });
    }
    if ((it.hints || []).length !== (it.chunks || []).length) ms.push('hints 不等长 chunks');
    if ((it.grammar || []).length !== (it.chunks || []).length) ms.push('grammar 不等长 chunks');
    (it.grammar || []).forEach((g, gi) => {
      if (!g.role || !g.color || !g.pos || !g.meaning) ms.push('grammar[' + gi + '] 缺字段');
      if (!Array.isArray(g.phonetic) || !g.phonetic.length) ms.push('grammar[' + gi + '] 缺 phonetic');
    });
    if (!Array.isArray(it.explanations) || it.explanations.length < 2) ms.push('explanations<2');
    if (!it.cid) ms.push('缺 cid（应当 fnv8(sentence)）');
    else if (it.cid !== fnv8(it.sentence)) ms.push('cid ≠ fnv8(sentence) — 自动重算覆盖');
    /* 翻译机检（2026-09-06 方案 A：直译腔/漏英文/机械病在注入前硬拦） */
    const trRes = tr.checkTranslation(it);
    trRes.errors.forEach((e) => ms.push('翻译机检: ' + e));
    if (trRes.warnings.length) {
      console.log('  ⚠ 翻译复核提示 (#' + (idx + 1) + ' ' + it.sentence + '): ' + trRes.warnings.join('; '));
    }
    if (ms.length) issues.push('#' + (idx + 1) + ' [' + (it._batchFile || '?') + '] ' + it.sentence + ' :: ' + ms.join('; '));
  });

  /* 源库匹配（提示级别，不退出） */
  if (sourceList) {
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
    let miss = 0;
    items.forEach((it) => {
      (it.grammar || []).forEach((g, gi) => {
        if (/(习语|谚语|固定搭配|动词习语|习语·|·习语)/.test(String(g.pos) + String(g.role))) {
          const ic = norm(it.chunks[gi]);
          if (ic && !sourceList.some((s) => { const n = norm(s); return n.indexOf(ic) >= 0 || ic.indexOf(n) >= 0; })) {
            miss++;
            console.log('  ⚠ 源库未匹配 idiom chunk:', JSON.stringify(it.chunks[gi]), 'in', it.sentence);
          }
        }
      });
    });
    console.log('源库未匹配 idiom 块数:', miss, '（提示级，不阻断）');
  }

  return issues;
}

/* 一条 item → JS compact 风格文本（与 freq-idioms.js 数据区现有条目同风格） */
function itemToJs(it) {
  const j = JSON.stringify;
  const L = ['  {'];
  L.push('    sentence: ' + j(it.sentence) + ',');
  L.push('    cid: fnv8(' + j(it.sentence) + '),');
  L.push('    translation: ' + j(it.translation) + ',');
  L.push('    chunks: ' + j(it.chunks) + ',');
  L.push('    hints: ' + j(it.hints) + ',');
  L.push('    grammar: [');
  it.grammar.forEach((g, i) => L.push('      {' + [
    'role:' + j(g.role),
    'color:' + j(g.color),
    'phonetic:' + j(g.phonetic),
    'pos:' + j(g.pos),
    'meaning:' + j(g.meaning)
  ].join(', ') + '}' + (i < it.grammar.length - 1 ? ',' : '')));
  L.push('    ],');
  L.push('    explanations: [');
  it.explanations.forEach((e, i) => L.push('      ' + j(e) + (i < it.explanations.length - 1 ? ',' : '')));
  L.push('    ]');
  L.push('  }');
  return L.join('\n');
}

/* 注入前去重护栏：与 freq-idioms.js 现有库 + 本批内部 双向查重。
 * 返回错误数组（空=通过）。句子比对用「去全部空白」规约；cid 仅作哈希碰撞提示。 */
function assertNoDup(items) {
  const fpath = path.join(__dirname, '..', 'freq-idioms.js');
  const file = fs.readFileSync(fpath, 'utf8');
  const normKey = (s) => String(s).replace(/\s+/g, '');
  const dups = [];
  const cidHitTips = [];

  /* 解析现有库（在临时 window 上执行数据区与注册 IIFE，无真实副作用） */
  let existing = [];
  try {
    const sandbox = { BUILTIN: { push() {} }, console };
    new Function('window', file)(sandbox);
    existing = Array.isArray(sandbox.DATA_FREQ_IDIOMS) ? sandbox.DATA_FREQ_IDIOMS : [];
  } catch (e) {
    console.error('❌ freq-idioms.js 当前不可解析（' + e.message + '）。已中止注入——先修复目标文件。');
    process.exit(1);
  }
  if (!existing.length) {
    console.error('❌ freq-idioms.js 解析后未取到 DATA_FREQ_IDIOMS 条目。已中止注入（防误写空库）。');
    process.exit(1);
  }
  const libSent = new Map(existing.map((x) => [normKey(x.sentence), x.sentence]));
  const libCid = new Set(existing.map((x) => x.cid).filter(Boolean));

  const batchSeen = new Map();
  for (const it of items) {
    const nk = normKey(it.sentence);
    const fc = fnv8(it.sentence);
    const tag = it._batchFile + ' :: ' + it.sentence;
    /* 库内重复（主判据：句子规约命中） */
    if (libSent.has(nk)) dups.push('库内重复: ' + tag + '（库内已有同句）');
    /* cid 撞库但句不同 → 哈希碰撞提示（不阻断） */
    else if (libCid.has(fc)) cidHitTips.push('cid 撞库但句不同(可能哈希碰撞): ' + tag);
    /* 批内重复 */
    if (batchSeen.has(nk)) dups.push('批内重复: ' + batchSeen.get(nk) + ' ↔ ' + tag);
    else batchSeen.set(nk, tag);
  }
  cidHitTips.forEach((t) => console.log('  ⚠ ' + t));
  return dups;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) { console.error('用法: node scripts/inject-freq-idioms.js extra/batch*.json [...]'); process.exit(2); }
  /* 载入所有 batch JSON */
  const items = [];
  args.forEach((f) => {
    const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
    arr.forEach((it) => { it._batchFile = path.basename(f); items.push(it); });
  });
  console.log('载入条目:', items.length, '（来自', args.length, '个文件）');

  /* 去重护栏（先于一切校验/写入）：库内 + 批内 双向查重，遇重即中止 */
  const dupIssues = assertNoDup(items);
  if (dupIssues.length) {
    console.error('❌ 去重失败（' + dupIssues.length + ' 处）：\n' + dupIssues.join('\n') + '\n已中止注入——请剔除重复条目后重试。');
    process.exit(1);
  }
  console.log('✅ 去重通过：与现有库及批内均无重复');

  /* 载入源库（可选，无则跳过匹配提示） */
  let sourceList = null;
  const sourcePath = process.env.SOURCE_PATH || path.join(__dirname, '..', 'extra', 'idioms-394.json');
  if (fs.existsSync(sourcePath)) sourceList = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

  /* 校验 */
  const issues = validateItems(items, sourceList);
  if (issues.length) {
    console.error('❌ 校验失败：\n' + issues.join('\n'));
    process.exit(1);
  }
  console.log('✅ 规则校验通过', items.length, '条');

  /* 自动补齐 cid（缺或错的） */
  items.forEach((it) => { if (!it.cid || it.cid !== fnv8(it.sentence)) it.cid = fnv8(it.sentence); });

  /* 注入 freq-idioms.js */
  const fpath = path.join(__dirname, '..', 'freq-idioms.js');
  const file = fs.readFileSync(fpath, 'utf8');

  /* ── 注入前解析守卫（防叠加损坏：2026-09-06 曾因目标文件结构损坏，
     多次注入把注册块与旧内容拼进数组，导致 3 段声明 + 无闭合 + 整文件不可解析）── */
  try {
    new Function('window', file); // 仅编译（parse check），不调用 → 无副作用
  } catch (e) {
    console.error('❌ freq-idioms.js 当前不可解析（' + e.message + '）。已中止注入——先修复目标文件（可跑 scripts/_recover 系列重建）。');
    process.exit(1);
  }
  const declCount = (file.match(/DATA_FREQ_IDIOMS\s*=\s*\[/g) || []).length;
  if (declCount !== 1) {
    console.error('❌ freq-idioms.js 数据声明数异常（' + declCount + ' 处，应为 1）。已中止注入，避免插入错位。');
    process.exit(1);
  }

  /* 定位 DATA_FREQ_IDIOMS 数组结尾 '];'：在文件尾部自注册 IIFE 之前 */
  const end = file.lastIndexOf('];');
  if (end < 0) {
    console.error('❌ freq-idioms.js 未找到数组闭合 ];。已中止注入。');
    process.exit(1);
  }
  const itemsJs = items.map(itemToJs).join(',\n');
  /* 换行风格归一（2026-09-10）：readFileSync 保留原文件的 CRLF，但拼接的 itemsJs 用 '\n'，
     直接写回会让文件变成混合换行 —— 下次 git diff 会冒出上百行「仅换行符不同」的噪音
     （实测 freq-idioms.js 一次注入产生 191 行假变更，git blame 全失效）。
     这里按原文件的主导风格统一整个输出。 */
  const crlfCount = (file.match(/\r\n/g) || []).length;
  const lfOnly = (file.match(/\n/g) || []).length - crlfCount;
  const eol = crlfCount >= lfOnly ? '\r\n' : '\n';
  const out = (file.slice(0, end) + ',\n' + itemsJs + '\n' + file.slice(end))
    .replace(/\r\n/g, '\n').replace(/\n/g, eol);
  fs.writeFileSync(fpath, out, 'utf8');
  console.log('已注入 freq-idioms.js:', items.length, '条（换行风格 ' + JSON.stringify(eol) + '）');

  /* 注入后回读确认仍可解析（写坏立即报错，防静默损坏） */
  const after = fs.readFileSync(fpath, 'utf8');
  try {
    new Function('window', after);
  } catch (e) {
    console.error('❌ 注入后文件解析失败（' + e.message + '）——立即检查/回滚！');
    process.exit(1);
  }
}

main();