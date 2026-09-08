/**
 * backup.mjs · 存储/备份纯逻辑（ADR-007 ESM 模块化，Step 4）
 *
 * 从 main.html 单体抽取的备份组装/解析纯函数（无 DOM、无全局状态）：
 *   - buildReinforceJson / buildReinforceTxt：错题巩固清单导出
 *   - buildExportPayload：全量备份对象组装
 *   - parseExport：备份文本解析 + 字段提取 + 导入摘要（不含 confirm / 写回）
 * 调用方（main.html）负责：读全局状态（S/mem）、downloadFile、confirm、写回存储。
 *
 * 浏览器：<script type="module" src="js/bridge.mjs">（内部挂 window.BackupTools）
 * 单测：  node js/backup.test.mjs
 */
'use strict';

/* 错题巩固清单 → JSON 题库格式（可直接重新导入练习） */
export function buildReinforceJson(wrong, deckName, stats) {
  return {
    name: deckName + ' · 巩固清单',
    source: 'Chunk Lab 错题导出',
    exportedAt: new Date().toISOString(),
    total: wrong.length,
    stats: {
      totalQuestions: stats.totalQuestions,
      perfectCount: stats.perfectCount,
      reinforceCount: wrong.length,
      accuracy: stats.accuracy
    },
    items: wrong.map(function (w, i) {
      return {
        sentence: w.it.sentence,
        translation: w.it.translation || '',
        chunks: w.it.chunks,
        hints: w.it.hints || [],
        grammar: w.it.grammar || null,
        _mistakes: (w.idx || []).map(function (ci) {
          return { chunkIndex: ci, correct: w.it.chunks[ci], user: (w.answers && w.answers[ci]) ? w.answers[ci] : '(空)' };
        })
      };
    })
  };
}

/* 错题巩固清单 → 可读文本（方便打印或笔记） */
export function buildReinforceTxt(wrong, deckName, stats) {
  var lines = [];
  lines.push('═══ Chunk Lab 巩固清单 ═══');
  lines.push('题库：' + deckName);
  lines.push('时间：' + new Date().toLocaleString());
  lines.push('统计：共 ' + stats.totalQuestions + ' 题 | PERFECT ' + stats.perfectCount + ' 题 | 需巩固 ' + wrong.length + ' 句');
  lines.push('');
  wrong.forEach(function (w, i) {
    lines.push('─── 第 ' + (i + 1) + ' 句 ───');
    lines.push('英文：' + w.it.sentence);
    lines.push('中文：' + (w.it.translation || ''));
    lines.push('意群：' + w.it.chunks.join(' │ '));
    if (w.idx && w.idx.length) {
      lines.push('错误：');
      w.idx.forEach(function (ci) {
        var userAns = (w.answers && w.answers[ci]) ? w.answers[ci] : '(未作答)';
        lines.push('  [' + w.it.chunks[ci] + '] 你写的：' + userAns);
      });
    }
    lines.push('');
  });
  lines.push('═══ 共 ' + wrong.length + ' 句需要巩固 ═══');
  return lines.join('\n');
}

/* 全量备份对象组装（__app/__version/时间戳/各数据段） */
export function buildExportPayload(mem, book, courses, courseProgress) {
  return {
    __app: 'chunklab',
    __version: 2,
    exportedAt: new Date().toISOString(),
    mem: mem,
    reinforceBook: book,
    courses: courses,
    courseProgress: courseProgress
  };
}

/* 备份文本解析 + 字段提取 + 导入摘要。
   返回 { ok:true, data:{ mem, book, courses, courseProgress, summary } } 或 { ok:false, error }。
   不含 confirm 与写回（由调用方执行）。 */
export function parseExport(text) {
  var data;
  try { data = JSON.parse(text); }
  catch (e) { return { ok: false, error: 'JSON 解析失败：' + e.message }; }
  if (!data || data.__app !== 'chunklab') return { ok: false, error: '非 Chunk Lab 备份文件' };
  if (!data.mem || typeof data.mem !== 'object') return { ok: false, error: '备份数据格式不正确' };
  var dMem = data.mem;
  var dBook = Array.isArray(data.reinforceBook) ? data.reinforceBook : [];
  var dCourses = Array.isArray(data.courses) ? data.courses : [];
  var dCourseProgress = (data.courseProgress && typeof data.courseProgress === 'object') ? data.courseProgress : {};
  var summary = '导入内容：\n' +
    '· 题库 ' + (dMem.decks || []).length + ' 个\n' +
    '· 标熟 ' + Object.keys(dMem.mastered || {}).length + ' 句\n' +
    '· 统计 ' + Object.keys((dMem.stats || {}).bySentence || {}).length + ' 句\n' +
    '· 错题本 ' + dBook.length + ' 条\n' +
    (dCourses.length ? '· 图文课程 ' + dCourses.length + ' 个\n' : '') +
    '· 设置 已含\n\n此操作将<b style="color:var(--bad)">覆盖</b>现有所有本地数据，确定继续吗？';
  return {
    ok: true,
    data: { mem: dMem, book: dBook, courses: dCourses, courseProgress: dCourseProgress, summary: summary }
  };
}
