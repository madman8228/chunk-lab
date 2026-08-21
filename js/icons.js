/**
 * icons.js · 项目统一 SVG 图标库（宪法：UI 禁用字符 icon，必须 SVG）
 *
 * 用法：
 *   1. 纯图标按钮：<button class="btn sm" data-icon="sound" title="音效开关"></button>
 *      → Icons.install() 把 data-icon 元素替换为内联 <svg>
 *   2. 带文字按钮：<span class="btn-ico" data-icon="export"></span>导出
 *   3. 动态渲染（JS 拼 HTML）：'<span class="tag-icon">' + Icons.svg('check') + '</span> 已掌握'
 *
 * 约定：
 *   - 24x24 viewBox，stroke=currentColor（跟随文本颜色），1.8 线宽圆角
 *   - 需要转圈动画时给 data-icon 元素加 class="icon-spin"（CSS 定义动画）
 *   - 新增图标只改 defs，不改调用方
 */
(function (g) {
  var defs = {
    sound: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    unsound: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/>',
    stats: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    warn: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 9v5"/><path d="M12 17.5v.5"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    export: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    import: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    ai: '<path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M12 8a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0v-2a4 4 0 0 1 4-4z"/>',
    speak: '<path d="M11 5 6 9H2v6h4l5 4V5z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>'
  };

  function svg(name, cls) {
    var d = defs[name];
    if (!d) return '';
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* 把文档中所有 data-icon 元素替换为内联 SVG（保留元素自身 class/title/id） */
  function install(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    scope.querySelectorAll('[data-icon]').forEach(function (el) {
      var n = el.getAttribute('data-icon');
      if (!defs[n]) return;
      el.innerHTML = svg(n);
      el.removeAttribute('data-icon');
    });
  }

  g.Icons = { defs: defs, svg: svg, install: install };
})(window);
