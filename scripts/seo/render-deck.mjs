/* render-deck.mjs · 课程页渲染器（T1 / T2）
 *
 * 每 deck 一页：列出该 deck 全部句子内链（可索引聚合点）。
 * 输出 PageModel；唯一 H1 由 template 负责。
 */
import { escapeHtml, clampDescription } from './template.mjs';
import { deckCta, sentenceUrl, buildBreadcrumb } from './cta.mjs';
import * as JsonLd from './jsonld.mjs';

function deckDescription(deck) {
  const n = (deck.sentences || []).length;
  return clampDescription(`${deck.name}：共 ${n} 句，按意群逐句拆解并跟读练习，附 AI 详解与词卡，未登录可直接阅读。`);
}

/**
 * @param {object} deck DeckMeta（含 sentences: SentenceRef[]）
 * @param {string} contentVersion
 */
export function renderDeckModel(deck, contentVersion) {
  const refs = deck.sentences || [];
  const items = refs.map((ref) => {
    const sentence = ref.item.sentence;
    const translation = ref.item.translation || '';
    const href = sentenceUrl(deck.id, ref.cid);
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(sentence)}</a>${translation ? ` <span class="muted">${escapeHtml(translation)}</span>` : ''}</li>`;
  }).join('\n');

  const context = [deck.sectionTitle, deck.topic].filter(Boolean).join(' · ');
  const body = [
    '<section>',
    context ? `<p>${escapeHtml(context)}</p>` : '',
    `<p>本课程收录 <strong>${refs.length}</strong> 句日常英语。每句都按意群切分，配中文释义、逐段 AI 详解与词卡，点开任意一句即可看到完整拆解。</p>`,
    '</section>',
    '<section>',
    '<h2>本课程全部句子</h2>',
    `<ul class="list" lang="en">${items}</ul>`,
    '</section>',
  ].filter(Boolean).join('\n');

  const breadcrumb = buildBreadcrumb([{ label: deck.name }]);

  return {
    type: 'deck',
    title: `${deck.name}｜意群拆解练习 · Chunk Lab`,
    description: deckDescription(deck),
    h1: deck.name,
    breadcrumb,
    body,
    cta: deckCta(deck.id),
    jsonld: JsonLd.course({ name: deck.name, description: deck.desc || deck.name, url: `/c/${encodeURIComponent(deck.id)}.html` }),
    selfPath: `/c/${encodeURIComponent(deck.id)}.html`,
    contentVersion,
  };
}
