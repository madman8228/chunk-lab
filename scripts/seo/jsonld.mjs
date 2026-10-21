/* jsonld.mjs · 结构化数据生成器（Course / FAQPage / HowTo / BreadcrumbList）
 *
 * 纪律：
 *  - 所有 URL 一律**根相对**（不含域名）——迁域不废，且满足 T2「无绝对内链」；
 *  - `@context` 使用 schema.org 词表（标准词汇标识，非站内链接）；
 *  - 不硬编码任何本站域名。
 */
import { toRootRelativeUrl } from './template.mjs';

/** 课程页 → Course。 */
export function course(page) {
  const node = {
    '@type': 'Course',
    name: page.name,
    description: page.description || page.name,
    inLanguage: 'zh-CN',
    provider: { '@type': 'Organization', name: 'Chunk Lab' },
  };
  if (page.url) node.url = toRootRelativeUrl(page.url);
  return { '@context': 'https://schema.org', ...node };
}

/** 句页/症状页/品牌页 → FAQPage。entries: [{question, answer}]。 */
export function faq(entries) {
  const list = (entries || []).filter((e) => e && e.question && e.answer);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  };
}

/** 症状词页 → HowTo。steps: [{name, text}]。 */
export function howTo(page) {
  const steps = (page.steps || []).filter((s) => s && s.name);
  const node = {
    '@type': 'HowTo',
    name: page.name,
    inLanguage: 'zh-CN',
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text || s.name,
    })),
  };
  if (page.description) node.description = page.description;
  return { '@context': 'https://schema.org', ...node };
}

/** 面包屑 → BreadcrumbList（item 均为根相对 URL）。 */ 
export function breadcrumbList(items) {
  const list = (items || []).filter((it) => it && it.label);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: toRootRelativeUrl(it.href) } : {}),
    })),
  };
}

/** 组合多个节点为 @graph（可选使用）。 */
export function graph(...nodes) {
  const flat = nodes.filter(Boolean);
  return { '@context': 'https://schema.org', '@graph': flat.map((n) => { const c = { ...n }; delete c['@context']; return c; }) };
}
