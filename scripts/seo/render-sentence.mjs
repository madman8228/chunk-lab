/* render-sentence.mjs · 意群句页渲染器（C3 / T1 / T2 / T4）
 *
 * 四要素：① 原句 ② 意群切分 ③ AI 详解 ④ 词卡。
 * 输出 PageModel（title/h1/description/breadcrumb/body/cta/jsonld），由 template 套壳。
 * 唯一 H1 由 template 负责；本渲染器不得输出 <h1>。
 */
import { escapeHtml } from './template.mjs';
import { sentenceCta, deckUrl, sentenceUrl, buildBreadcrumb } from './cta.mjs';
import * as JsonLd from './jsonld.mjs';

/** 生成句页 meta description（≤160 字符，必要时截断原句）。 */
export function buildDescription(item) {
  const n = (item.chunks || []).length;
  const suffix = ` —— 按意群切分为 ${n} 段，附逐段 AI 详解与跟读练习，未登录可直接体验。`;
  const budget = 160 - suffix.length;
  let sentence = String(item.sentence || '');
  if (sentence.length > budget) sentence = sentence.slice(0, Math.max(1, budget - 1)) + '…';
  return sentence + suffix;
}

/** 句页标题（症状/长尾优先，术语作锚点）。 */
export function buildTitle(item, deckName) {
  return `${item.sentence} 意群怎么断｜${deckName} · Chunk Lab`;
}

function renderChunks(item) {
  return (item.chunks || []).map((c) => `<li>${escapeHtml(c)}</li>`).join('');
}

function renderExplanations(item) {
  const list = item.explanations || [];
  if (!list.length) {
    return '<p class="muted">暂无逐段详解。可在练习页对着音频跟读，并在需要时开启 AI 逐段讲解。</p>';
  }
  return list.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}

function renderWordCards(item) {
  const cards = [];
  cards.push(`<div class="card"><div class="w">${escapeHtml(item.sentence)}</div><div class="hint">${escapeHtml(item.translation || '(暂无释义)')}</div></div>`);
  const chunks = item.chunks || [];
  const hints = item.hints || [];
  chunks.forEach((chunk, i) => {
    const hint = hints[i] || '';
    cards.push(`<div class="card"><div class="w">${escapeHtml(chunk)}</div>${hint ? `<div class="hint">${escapeHtml(hint)}</div>` : ''}</div>`);
  });
  (item.grammar || []).forEach((g) => {
    if (!g || typeof g !== 'object') return;
    const pos = g.pos || g.type || '';
    const word = g.word || g.text || '';
    const meaning = g.meaning || g.zh || '';
    const phonetic = g.phonetic || '';
    if (!word && !meaning) return;
    cards.push(
      `<div class="card">${pos ? `<div class="pos">${escapeHtml(pos)}</div>` : ''}` +
      `<div class="w">${escapeHtml(word)}${phonetic ? ` <span class="muted">${escapeHtml(phonetic)}</span>` : ''}</div>` +
      `${meaning ? `<div class="hint">${escapeHtml(meaning)}</div>` : ''}</div>`
    );
  });
  return `<div class="cards">${cards.join('')}</div>`;
}

/**
 * @param {object} deck DeckMeta（来自 content-index）
 * @param {object} item SentenceItem
 * @param {string} contentVersion
 */
export function renderSentenceModel(deck, item, contentVersion) {
  const n = (item.chunks || []).length;
  const selfPath = sentenceUrl(deck.id, item.cid);
  const body = [
    '<section>',
    '<h2>原句</h2>',
    `<p class="en" lang="en">${escapeHtml(item.sentence)}</p>`,
    `<p class="zh">${escapeHtml(item.translation || '(暂无翻译)')}</p>`,
    '</section>',
    '<section>',
    `<h2>意群切分（${n} 段）</h2>`,
    `<ul class="chunks" lang="en">${renderChunks(item)}</ul>`,
    '<p>意群切分帮助你把长句按语义自然停顿拆开，跟读时更接近母语者的节奏，也更容易在听力中「听出」句子结构。</p>',
    '</section>',
    '<section>',
    '<h2>AI 逐段详解</h2>',
    renderExplanations(item),
    '</section>',
    '<section>',
    '<h2>词卡</h2>',
    renderWordCards(item),
    '</section>',
  ].join('\n');

  const breadcrumb = buildBreadcrumb([
    { label: deck.name, href: deckUrl(deck.id) },
    { label: item.sentence.length > 24 ? item.sentence.slice(0, 24) + '…' : item.sentence },
  ]);

  const answer = [item.translation, ...(item.explanations || [])].filter(Boolean).join(' ');
  const jsonld = JsonLd.faq([{ question: `${item.sentence} 的意群怎么断？`, answer: answer || item.sentence }]);

  return {
    type: 'sentence',
    title: buildTitle(item, deck.name),
    description: buildDescription(item),
    h1: `${item.sentence} 意群怎么断`,
    breadcrumb,
    body,
    cta: sentenceCta(deck.id),
    jsonld,
    selfPath,
    contentVersion,
  };
}
