/* ============================================================
   chunk-shape.js · 「最少切几段」的**唯一**判据实现（2026-09-15 立）
   ------------------------------------------------------------
   为什么存在：
     书里有 96 条**单字句**（Help! / Thief! / Thanks. / Hi! …），去标点后
     只有 1 个词 → 物理上无法切成 2 段。旧闸一刀切 `chunks.length >= 2`
     把它们全部挡在门外，而它们恰恰是最高频的口语。
     解决：判据按**句子形态**判定 —— 词数 = 1 时允许 1 段；其余仍强制 ≥2
     （`I'm late!` 这种 2 词句照样必须切 2 段）。这是精确例外，不可滥用。

   为什么是「唯一实现」：
     同一个判据曾散落在 7 个校验器里，改一处必漏一处（已在本项目反复踩过）。
     全库只此一份，其余全部 require/import 本模块。

   ⚠️ 为什么在 js/ 而不是 scripts/（2026-09-16 迁）：
     作者侧的三道闸（decks.html 编辑器保存 / 卡片质检、main.html 导入题库 JSON）
     也需要同一判据，而 **scripts/ 不部署到线上**、HTML 引不到 → 那 4 处只能硬编码
     `chunks.length 2-5`，于是单字句（Help! / Thanks.）在作者侧根本存不进去
     （库里 39 条单字句只能靠脚本绕行，作者改一下就被拒）。
     js/ 是运行时目录、HTML 可 `<script src>`，故唯一实现归此。
   ⚠️ 因此本文件**进入 SW 预缓存**（scripts/gen-sw.js 按 HTML 引用自动补全）→
     改它必须重跑 `node scripts/gen-sw.js`，与其它运行时代码同规则。

   运行期安全性（已查证）：
     main.html 槽位渲染是 `it.chunks.forEach`，buildChoices(it, i) 按索引取、
     干扰项从「其它句的 chunks 池」抽 → 1 段只是「1 槽的题」，不会崩。

   UMD：node（require / ESM import 均可）；浏览器（addInitScript 注入后
        取 window.ChunkShape）。
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof window !== 'undefined') window.ChunkShape = factory();
  else root.ChunkShape = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** 允许的最大切分段数（超了就变成碎句，失去意群意义） */
  var MAX_CHUNKS = 5;

  /**
   * 去标点后的「词」数。
   * 只保留字母与撇号 —— `It's` / `Don't` / `Let's` 算 1 个词（撇号是词内字符）。
   * @param {string} sentence
   * @returns {number}
   */
  function wordCount(sentence) {
    var s = String(sentence == null ? '' : sentence).replace(/[^A-Za-z' ]/g, '').trim();
    if (!s) return 0;
    return s.split(/\s+/).filter(Boolean).length;
  }

  /**
   * 该句允许的**最少**切分段数。
   *   词数 <= 1 → 1（单字句，物理上切不动，只此一条例外路径）
   *   词数 >= 2 → 2（不允许整句当一段）
   * @param {string} sentence
   * @returns {1|2}
   */
  function minChunks(sentence) {
    return wordCount(sentence) <= 1 ? 1 : 2;
  }

  /**
   * 该句能否切成至少 minChunks 段（chunks 数量闸的统一入口）。
   * 空数组 / 非数组 / 超 MAX_CHUNKS 一律不合格。
   * @param {string} sentence
   * @param {string[]} chunks
   * @returns {boolean}
   */
  function chunkCountOk(sentence, chunks) {
    if (!Array.isArray(chunks)) return false;
    var n = chunks.length;
    return n >= minChunks(sentence) && n <= MAX_CHUNKS;
  }

  /**
   * 人类可读的不合格原因（给校验器拼错误信息用）；合格返回 null。
   * @param {string} sentence
   * @param {string[]} chunks
   * @returns {string|null}
   */
  function chunkCountError(sentence, chunks) {
    if (chunkCountOk(sentence, chunks)) return null;
    var n = Array.isArray(chunks) ? chunks.length : -1;
    var need = minChunks(sentence);
    if (n < 0) return 'chunks 缺失或非数组';
    if (n < need) {
      return need === 1
        ? 'chunks 为空'
        : 'chunks 数 ' + n + '（该句 ' + wordCount(sentence) + ' 词，需 2~' + MAX_CHUNKS + '）';
    }
    return 'chunks 数 ' + n + '（需 ≤' + MAX_CHUNKS + '）';
  }

  return {
    MAX_CHUNKS: MAX_CHUNKS,
    wordCount: wordCount,
    minChunks: minChunks,
    chunkCountOk: chunkCountOk,
    chunkCountError: chunkCountError
  };
});
