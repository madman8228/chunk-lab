/* template.mjs · SEO 静态页 HTML 外壳与渲染契约
 *
 * 契约（每个内容页都必须满足）：
 *  - 恰好 1 个 <h1>（模板层保证，渲染器只提供 h1 文本，不得再输出 h1）；
 *  - 含 <meta name="description">（调用方保证 ≤160 字符）；
 *  - 含可见面包屑 <nav aria-label="breadcrumb">（≥2 级）；
 *  - 正文在 <main>，练习入口 CTA 在 <aside>（不遮挡正文）；
 *  - **只允许根相对链接**（以 / 开头），禁止任何带域名的绝对内链；
 *  - 每页内嵌内容版本戳 <meta name="clb:content-version">。
 *
 * ⚠️ canonical / og:url 属 Y 类（T8），本轮（M1）不产出。
 */

/** HTML 文本转义（用于 title/h1/description 等属性/文本位）。 */
export function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 把路径规范为根相对形式（以 / 开头，正斜杠）。 */
export function rootRelative(p) {
  let s = String(p || '').replace(/\\/g, '/');
  if (!s.startsWith('/')) s = '/' + s;
  return s.replace(/\/{2,}/g, '/');
}

/**
 * 把绝对/根相对 URL 转为根相对（仅保留 path+query+hash）。
 * 用于防御性收口：任何 http(s) 域名都会被剥离，保证产出内链均为根相对。
 */
export function toRootRelativeUrl(url) {
  const s = String(url || '');
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      return rootRelative(u.pathname + u.search + u.hash);
    }
  } catch (err) {
    /* 非法 URL：降级为路径处理 */
  }
  return rootRelative(s);
}

const STYLE = `
:root{--ink:#2a2118;--muted:#6b6b6b;--line:#e3e0d8;--accent:#c8402f;--bg:#fbfaf5}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:0 18px}
a{color:var(--accent)}
nav.bc{font-size:14px;color:var(--muted);padding:16px 0}
nav.bc ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0}
nav.bc li::after{content:"›";margin-left:6px;color:var(--muted)}
nav.bc li:last-child::after{content:""}
nav.bc a{text-decoration:none}
main{padding-bottom:24px}
h1{font-size:1.6rem;line-height:1.35;margin:.2em 0 .6em}
h2{font-size:1.15rem;margin:1.4em 0 .4em;border-left:4px solid var(--accent);padding-left:10px}
.en{font-size:1.15rem;font-weight:600;margin:.2em 0}
.zh{color:var(--muted);margin:.1em 0 0}
.chunks{display:flex;flex-wrap:wrap;gap:8px;margin:.5em 0;padding:0;list-style:none}
.chunks li{background:#fff;border:1px solid var(--line);border-radius:8px;padding:4px 12px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:.5em 0}
.card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.card .w{font-weight:700}
.card .hint{color:var(--muted);font-size:.92em}
.card .pos{color:var(--accent);font-size:.82em;font-weight:700;text-transform:uppercase}
.muted{color:var(--muted)}
.aside-cta{margin:28px auto;max-width:760px;padding:0 18px}
.cta{display:block;background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.cta a.primary{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:700;margin-top:8px}
.list{list-style:none;padding:0;margin:.5em 0}
.list li{padding:6px 0;border-bottom:1px solid var(--line)}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px;padding:18px 0}
footer a{color:var(--muted)}
`;

/**
 * 渲染整页 HTML。
 * @param {{
 *   type: string, title: string, description: string, h1: string,
 *   breadcrumb: {label:string, href?:string}[], body: string, cta: string,
 *   jsonld?: object|null, contentVersion?: string
 * }} page
 * @returns {string}
 */
export function renderPage(page) {
  const parts = [];
  parts.push('<!doctype html>');
  parts.push('<html lang="zh-CN">');
  parts.push('<head>');
  parts.push('<meta charset="utf-8">');
  parts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  parts.push(`<title>${escapeHtml(page.title)}</title>`);
  parts.push(`<meta name="description" content="${escapeHtml(clampDescription(page.description))}">`);
  if (page.contentVersion) {
    parts.push(`<meta name="clb:content-version" content="${escapeHtml(page.contentVersion)}">`);
  }
  if (page.jsonld) {
    const json = JSON.stringify(page.jsonld, null, 2).replace(/<\//g, '<\\/');
    parts.push(`<script type="application/ld+json">${json}</script>`);
  }
  parts.push(`<style>${STYLE}</style>`);
  parts.push('</head>');
  parts.push('<body>');
  parts.push(renderBreadcrumb(page.breadcrumb));
  parts.push('<main class="wrap">');
  parts.push(`<h1>${escapeHtml(page.h1)}</h1>`);
  parts.push(page.body || '');
  parts.push('</main>');
  if (page.cta) {
    parts.push('<aside class="aside-cta" aria-label="开始练习">');
    parts.push(`<div class="cta">${page.cta}</div>`);
    parts.push('</aside>');
  }
  parts.push('<footer><div class="wrap">Chunk Lab · 把长句拆成意群，跟读练到听懂 · <a href="/">返回首页</a></div></footer>');
  parts.push('</body>');
  parts.push('</html>');
  parts.push('');
  return parts.join('\n');
}

function renderBreadcrumb(items) {
  const list = Array.isArray(items) && items.length ? items : [{ label: '首页', href: '/' }];
  const cells = list.map((item) => {
    if (item && item.href) {
      return `<li><a href="${escapeHtml(toRootRelativeUrl(item.href))}">${escapeHtml(item.label)}</a></li>`;
    }
    return `<li aria-current="page">${escapeHtml(item && item.label ? item.label : '')}</li>`;
  });
  return `<nav class="bc wrap" aria-label="breadcrumb"><ol>${cells.join('')}</ol></nav>`;
}

/** description 硬上限 160 字符（模板层兜底，渲染器已尽量自控）。 */
export function clampDescription(text) {
  const s = String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
  return s.length <= 160 ? s : s.slice(0, 159) + '…';
}
