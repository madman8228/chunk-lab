/* ============================================================
   jqka.top 落地页共享层：词库数据装配 + 学习记录存储（无 DOM 依赖）
   2026-10-05：落地页已并入 Chunk Lab 仓库（/d/06-project/chunk-practice），
   本目录 land/ 是落地页私有资源，与产品侧 js/ assets/ content/ 隔离。
   落地页 index.html 引用本文件，逻辑只有一份。
   ============================================================ */

/* 词库数据来自 landing/deck.js（window.JQKA_DECK）：四段 = 四个真实 CEFR 难度层级。
   加词只改 landing 目录下的文件，不动页面。 */
const DECK = window.JQKA_DECK;

/* ---------- 内容类型：段位是难度轴，类型是另一根轴 ---------- */
const TYPE_NAME  = { word:'单词', phrase:'词组', pattern:'句型', slang:'口语俚语' };
const TYPE_ORDER = ['word','phrase','pattern','slang'];
let typeFilter = 'all';

/* CEFR → 段位：A1/A2→J，B1→Q，B2→K，C1/C2→A */
function rankOfLv(lv){
  const m = /^([ABC])([12])$/.exec(lv || '');
  if(!m) return null;
  if(m[1] === 'A') return 'J';
  if(m[1] === 'B') return m[2] === '1' ? 'Q' : 'K';
  return 'A';
}

/* 外部数据文件按 lv 自动并入对应段。加新类型 = 加数据文件 + 在这里登记一行 */
function mergeItems(list){
  (list || []).forEach(d => {
    const r = rankOfLv(d.lv);
    if(r && DECK[r]) DECK[r].words.push(d);
  });
}
/* 只暴露数据里真实存在的类型：没有内容的类型不生成按钮，避免一排空占位 */
function availableTypes(){
  const s = new Set();
  RANKS.forEach(r => DECK[r].words.forEach(d => { if(d.t) s.add(d.t); }));
  return TYPE_ORDER.filter(t => s.has(t));
}

const RANKS = ['J','Q','K','A'];
mergeItems(window.JQKA_PHRASES);   // 必须在 DECK 与 RANKS 之后，且早于 ITEM_INDEX 构建

/* ---------- 学习记录：localStorage 持久化，跨段共享（词全局唯一） ----------
   键 jqka.learning.v1 = { 'word:decide': { s, t } }
     s: 0 学习中 / 1 已熟悉 / 2 已掌握（当前 UI 只用到 0/1，2 留给「用得出」的产出判定）
     t: 最近一次状态变更时间戳（供「最近 7 天 +N」统计用）
   旧键 jqka.mastered.v1 是字符串数组，只能表达一态、也存不下复习时间，首次加载自动迁移为 s=1 后删除。
   数据存在用户浏览器里，可被手动改坏、也可被导入文件覆盖 —— 属不可信输入，读取必须校验。 */
const LEARN_KEY  = 'jqka.learning.v1';
const LEGACY_KEY = 'jqka.mastered.v1';
/* 条目 id = 类型 + 词形。单词与词组同名时不会互撞，将来加句型/俚语也不用改这里 */
const itemKey = (t, w) => (t || 'word') + ':' + w;

function readStore(key){
  const raw = localStorage.getItem(key);
  if(raw === null) return null;
  try { return JSON.parse(raw); } catch(err){ return undefined; }  // undefined = 数据已损坏
}

function loadLearning(){
  const data = readStore(LEARN_KEY);
  if(data === undefined){
    // 损坏不静默丢弃：留一份原始档，用户还能人工捞回来
    localStorage.setItem(LEARN_KEY + '.broken', localStorage.getItem(LEARN_KEY));
    localStorage.removeItem(LEARN_KEY);
    console.warn('[jqka] 学习记录已损坏，原始内容备份到 ' + LEARN_KEY + '.broken，本次以空记录启动');
    return {};
  }
  if(data && typeof data === 'object') return data;

  const legacy = readStore(LEGACY_KEY);
  const out = {};
  if(Array.isArray(legacy)) legacy.forEach(w => { out[itemKey('word', w)] = { s:1, t:Date.now() }; });
  if(legacy !== null) localStorage.removeItem(LEGACY_KEY);
  if(Object.keys(out).length) saveLearning(out);
  return out;
}

function saveLearning(o){ localStorage.setItem(LEARN_KEY, JSON.stringify(o)); }

const LEARN = loadLearning();
function stateOf(t, w){ const r = LEARN[itemKey(t, w)]; return r ? r.s : 0; }
function setState(t, w, s){
  const k = itemKey(t, w);
  if(s > 0) LEARN[k] = { s:s, t:Date.now() }; else delete LEARN[k];
  saveLearning(LEARN);
}


const ITEM_INDEX = {};
RANKS.forEach(r => DECK[r].words.forEach(d => { ITEM_INDEX[itemKey(d.t, d.w)] = d; }));

function libCounts(){
  let s1 = 0, s2 = 0;
  Object.keys(LEARN).forEach(k => {
    if(LEARN[k].s === 1) s1++; else if(LEARN[k].s === 2) s2++;
  });
  const total = RANKS.reduce((n, r) => n + DECK[r].words.length, 0);
  return { s1, s2, learning: total - s1 - s2, total };
}

/* 导出 / 导入的纯数据部分（文件选择、下载等 DOM 操作在各页面自己那里） */
function buildExportPayload(){
  return { app:'jqka', v:1, exportedAt:new Date().toISOString(), items:LEARN };
}
function mergeImportItems(obj){
  Object.assign(LEARN, obj);   // 合并而非覆盖：绝不因为一次导入清掉已有的记录
  saveLearning(LEARN);
}
