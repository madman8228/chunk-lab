/**
 * core-deps.js · core.js 必需依赖模块的加载清单（**单一事实来源**）
 *
 * 背景（2026-09-22 重复实现清理，见 docs/implementation/2026-09-22-duplicate-implementation-cleanup.md）：
 *   core.js 在**加载期**强制要求 `CoreStatsSignature` / `CoreStorageState` 存在。
 *   这两个模块原本被 core.js 用手写内联副本兜着（`if(CoreStatsSignature)` / `if(!plan)`），
 *   副本已删除 ⇒ 模块缺失不再是「静默换一套判据继续跑」，而是在加载期进入**用户可见失败态**。
 *   这是刻意的 fail-closed 契约，不是待修的缺陷。
 *
 *   四个真实页面（main / decks / stats / courses）都在 core.js 之前用 <script> 加载这两个模块，
 *   且它们与 core.js 走同一静态服务、同一份 SW 预缓存 ⇒ 生产里必然同时到达。
 *   ⇒ 任何「只加载 core.js」的**合成测试页面**都必须照做。
 *      漏加时页面会（正确地）被判为加载失败 —— 别去放宽 core.js 的闸，补上依赖即可。
 *
 * 之所以抽成一处：这份清单在多个 e2e 里都要用，散落维护必然漂移
 *   （本仓库的最高频教训就是「同一事实出现两份实现」）。
 */
'use strict';
const path = require('path');

/* 顺序有意义：必须在 `core.js` 之前加载 */
const CORE_DEPS = ['js/core-stats-signature.js', 'js/core-storage-state.js'];

/** 给 `page.route(fulfill)` 的合成 HTML 用：返回依赖模块的 <script> 标签串（插在 core.js 之前）。 */
function dependencyTags() {
  return CORE_DEPS.map(function (f) { return '<script src="/' + f + '"></script>'; }).join('');
}

/** 给 `page.addScriptTag(...)` 的合成页面用：按序注入依赖模块（须在 core.js 之前调用）。 */
async function addCoreDependencies(page, root) {
  for (const f of CORE_DEPS) await page.addScriptTag({ path: path.join(root, f) });
}

module.exports = { CORE_DEPS, dependencyTags, addCoreDependencies };
