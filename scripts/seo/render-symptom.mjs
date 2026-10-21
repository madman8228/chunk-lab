/* render-symptom.mjs · C2 症状词方法论页模板（→ /g/{slug}.html）
 *
 * 数据驱动：输入来自 content/seo/symptom-pages.json 的单条 entry。
 * 标题含症状原词；页内含练习页内链；未登录可读。
 */
import { escapeHtml, clampDescription } from './template.mjs';
import { symptomCta, deckUrl, buildBreadcrumb } from './cta.mjs';
import * as JsonLd from './jsonld.mjs';

function symptomTitle(entry) {
  return `${entry.symptom}？用意群拆开试试｜Chunk Lab`;
}

function symptomDescription(entry) {
  return clampDescription(`${entry.symptom}？把长句按意群拆开、跟着音频跟读练到听懂。附相关课程与练习入口，未登录即可阅读。`);
}

/**
 * @param {object} entry 症状词页数据（含 slug/symptom/summary/whyChunking/steps/relatedDecks）
 * @param {Map<string,object>} deckById deckId → DeckMeta
 * @param {string} contentVersion
 */
export function renderSymptomModel(entry, deckById, contentVersion) {
  const related = (entry.relatedDecks || [])
    .map((id) => deckById.get(id))
    .filter(Boolean);

  const whyHtml = (entry.whyChunking || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const stepsHtml = (entry.steps || []).map((s) => `<li><strong>${escapeHtml(s.name)}</strong>：${escapeHtml(s.text || '')}</li>`).join('');
  const relatedHtml = related.length
    ? `<ul class="list">${related.map((d) => `<li><a href="${escapeHtml(deckUrl(d.id))}">${escapeHtml(d.name)}</a></li>`).join('')}</ul>`
    : '';

  const body = [
    '<section>',
    `<p>${escapeHtml(entry.summary || '')}</p>`,
    whyHtml,
    '</section>',
    '<section>',
    '<h2>用意群拆开，分三步练</h2>',
    `<ul class="list">${stepsHtml || '<li>把长句按语义停顿切成意群，逐段跟读。</li>'}</ul>`,
    '</section>',
    '<section>',
    '<h2>相关练习</h2>',
    relatedHtml || '<p class="muted">暂无关联课程，可直接进入练习页随机开始。</p>',
    `<p><a href="/main.html">进入练习页随机开始一组 →</a></p>`,
    '</section>',
  ].join('\n');

  const jsonld = JsonLd.howTo({
    name: symptomTitle(entry).replace('｜Chunk Lab', ''),
    description: entry.summary || '',
    steps: (entry.steps || []).map((s) => ({ name: s.name, text: s.text || s.name })),
  });

  return {
    type: 'symptom',
    title: symptomTitle(entry),
    description: symptomDescription(entry),
    h1: `${entry.symptom}？用意群拆开试试`,
    breadcrumb: buildBreadcrumb([{ label: '学习疑难' }, { label: entry.symptom }]),
    body,
    cta: symptomCta((entry.relatedDecks || [])),
    jsonld,
    selfPath: `/g/${encodeURIComponent(entry.slug)}.html`,
    contentVersion,
  };
}
