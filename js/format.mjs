/**
 * format.mjs · 纯字符串/时间工具（ADR-007 ESM 模块化，Step 2）
 *
 * 从 main.html 单体抽取的零依赖纯函数（无 DOM、无全局状态）：
 *   - esc：HTML 转义
 *   - norm / normSent：归一化（与 main.html 内联版逐字符一致；注意与 core.js 的 CL.norm
 *     语义不同——本模块保留中英文字符，core.js 版会去掉中文，勿混用）
 *   - wordCount / timeAgo
 *
 * 浏览器：<script type="module" src="js/bridge.mjs">（内部挂 window.FormatTools）
 * 单测：  node js/format.test.mjs
 */
'use strict';

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* 归一化：忽略大小写、标点、多余空格、撇号差异 */
export function norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normSent(s) { return norm(String(s == null ? '' : s)); }

export function wordCount(s) { return String(s == null ? '' : s).trim().split(/\s+/).filter(Boolean).length; }

export function timeAgo(t) {
  if (!t) return '—';
  var d = Date.now() - t;
  if (d < 60000) return '刚刚';
  if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
  if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
  return Math.floor(d / 86400000) + ' 天前';
}
