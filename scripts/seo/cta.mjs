/* cta.mjs · 共享 CTA / 内链 partial（练习入口，不遮挡正文）
 *
 * 纪律：所有 href 一律根相对；CTA 只放在 <aside> 容器内（由 template 挂载）。
 */
import { escapeHtml, toRootRelativeUrl } from './template.mjs';

/** 句页 URL。 */
export function sentenceUrl(deckId, cid) {
  return `/s/${encodeURIComponent(deckId)}/${encodeURIComponent(cid)}.html`;
}

/** 课程页 URL。 */
export function deckUrl(deckId) {
  return `/c/${encodeURIComponent(deckId)}.html`;
}

/** 症状词页 URL。 */
export function symptomUrl(slug) {
  return `/g/${encodeURIComponent(slug)}.html`;
}

/** 练习入口（main.html 深链），根相对。 */
export function practiceUrl(deckId) {
  const q = deckId ? `?deck=${encodeURIComponent(deckId)}` : '';
  return `/main.html${q}`;
}

/** 句页 CTA：开始练习本句 + 进入所属课程。 */
export function sentenceCta(deckId) {
  return [
    '<p>想跟着音频逐段跟读、并用间隔重复把这一句练到脱口而出？</p>',
    `<a class="primary" href="${escapeHtml(toRootRelativeUrl(practiceUrl(deckId)))}">开始练习这一课 →</a>`,
    `<p class="muted"><a href="${escapeHtml(toRootRelativeUrl(deckUrl(deckId)))}">查看本课程全部句子</a></p>`,
  ].join('\n');
}

/** 课程页 CTA：开始练习本课程。 */
export function deckCta(deckId) {
  return [
    '<p>这门课程共 1 个练习单元，按意群拆句 + 跟读 + AI 详解。</p>',
    `<a class="primary" href="${escapeHtml(toRootRelativeUrl(practiceUrl(deckId)))}">开始练习本课程 →</a>`,
  ].join('\n');
}

/** 品牌页 CTA。 */
export function brandCta() {
  return [
    '<p>免费开始，无需注册即可试听与练习。</p>',
    `<a class="primary" href="${escapeHtml(toRootRelativeUrl(practiceUrl()))}">进入 Chunk Lab 开始练习 →</a>`,
  ].join('\n');
}

/** 症状词页 CTA：按相关课程进入练习。 */
export function symptomCta(deckIds) {
  const links = (deckIds || []).map((id) =>
    `<li><a href="${escapeHtml(toRootRelativeUrl(deckUrl(id)))}">${escapeHtml(id)} 课程</a></li>`).join('');
  return [
    '<p>把「拆意群」的方法用起来，选一门课程开始跟读练习。</p>',
    `<a class="primary" href="${escapeHtml(toRootRelativeUrl(practiceUrl(deckIds && deckIds[0])))}">开始练习 →</a>`,
    links ? `<ul class="list">${links}</ul>` : '',
  ].filter(Boolean).join('\n');
}

/** 通用面包屑构造：首页 › 课程目录 › …（≥2 级）。 */
export function buildBreadcrumb(trail) {
  const base = [{ label: '首页', href: '/' }, { label: '课程目录', href: '/main.html' }];
  return base.concat(trail || []);
}
