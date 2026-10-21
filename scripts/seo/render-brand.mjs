/* render-brand.mjs · C1 品牌说明书页（→ /about.html）
 *
 * 内容：一句话价值主张 + 面向人群 + 练习页内链。稳定独立 URL。
 */
import { escapeHtml, clampDescription } from './template.mjs';
import { brandCta, deckUrl, buildBreadcrumb } from './cta.mjs';
import * as JsonLd from './jsonld.mjs';

/** 谁适合：面向人群。 */
const AUDIENCES = [
  '听得懂单词、却总听不清整句的人',
  '看长句要回读几遍才明白的人',
  '开口说英语容易「卡壳、断错地方」的人',
  '想用碎片时间把口语练到脱口而出的人',
];

/** 方法四步：意群拆解 → 跟读 → AI 详解 → 间隔重复。 */
const METHOD = [
  { name: '按意群拆句', text: '把长句按语义自然停顿切成意群，先「看清结构」，再谈听懂。' },
  { name: '逐段跟读', text: '跟着音频一段一段跟读，把意群节奏练成肌肉记忆。' },
  { name: 'AI 逐段详解', text: '每段配中文释义与讲解，弄懂为什么这样断、这样用。' },
  { name: '间隔重复', text: '按遗忘曲线安排复习，错题自动回炉，练到真正记住。' },
];

/**
 * @param {{ deckLinks?: {id:string,name:string}[], contentVersion?: string }} [options]
 */
export function renderBrandModel(options = {}) {
  const deckLinks = options.deckLinks || [];

  const audienceHtml = AUDIENCES.map((a) => `<li>${escapeHtml(a)}</li>`).join('');
  const methodHtml = METHOD.map((m) => `<li><strong>${escapeHtml(m.name)}</strong>：${escapeHtml(m.text)}</li>`).join('');
  const courseHtml = deckLinks.length
    ? `<ul class="list">${deckLinks.map((d) => `<li><a href="${escapeHtml(deckUrl(d.id))}">${escapeHtml(d.name)}</a></li>`).join('')}</ul>`
    : '';

  const body = [
    '<section>',
    '<p><strong>Chunk Lab</strong> 是一款把英语长句按「意群（chunk）」拆开、配合跟读与 AI 详解反复练到听懂的免费英语学习工具。</p>',
    '<p>我们相信：长句听不懂，多数时候不是词汇量不够，而是没听出句子的结构。把一个长句切成几个意群，先看清「一块一块」的意思，再跟读、再复述，比死背整句更高效。</p>',
    '</section>',
    '<section>',
    '<h2>我们把一句话练透的四步</h2>',
    `<ul class="list">${methodHtml}</ul>`,
    '</section>',
    '<section>',
    '<h2>谁适合使用 Chunk Lab</h2>',
    `<ul class="list">${audienceHtml}</ul>`,
    '</section>',
    '<section>',
    '<h2>从哪里开始</h2>',
    '<p>直接从任意一组句子开始即可，无需注册。</p>',
    `<p><a href="/main.html">进入练习页，随机开始一组 →</a></p>`,
    courseHtml,
    '</section>',
  ].join('\n');

  const jsonld = JsonLd.faq([
    { question: 'Chunk Lab 是什么？', answer: 'Chunk Lab 是一款把英语长句按意群拆开、配合跟读与 AI 详解练习到听懂的免费英语学习工具。' },
    { question: 'Chunk Lab 适合哪些人？', answer: AUDIENCES.join('；') + '。' },
    { question: '使用 Chunk Lab 需要注册吗？', answer: '不需要，未登录即可直接阅读句子拆解并开始练习。' },
  ]);

  return {
    type: 'brand',
    title: 'Chunk Lab · 把长句拆成意群，跟读练到听懂',
    description: clampDescription('Chunk Lab：把英语长句按意群拆开、配跟读与 AI 详解，练到听懂、说到脱口而出。免费开始，无需注册。'),
    h1: '把长句拆成意群，跟读练到听懂',
    breadcrumb: buildBreadcrumb([{ label: '关于 Chunk Lab' }]),
    body,
    cta: brandCta(),
    jsonld,
    selfPath: '/about.html',
    contentVersion: options.contentVersion || '',
  };
}
