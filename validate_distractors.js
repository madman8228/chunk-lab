/* ============================================================
   validate_distractors.js · 三库 D-schema 预置干扰项全量质检
   ------------------------------------------------------------
   运行：node validate_distractors.js
   范围：builtin-daily（builtins.js 88 + oral8000.js concat 50）+
        builtin-freq-idioms（freq-idioms.js 自注册 201）
   背景：D-pipeline（e7a3085 消费侧 / e0fa6f9 写侧 / 2026-09-08 全量入库
         oral8000 50/50 + freq-idioms 201/201）。validate_builtins.js 只校验
         builtin-daily 静态 88 句且不认识 distractor 字段 —— 本脚本补齐
         「入库数据质量闸」：与 distractor-validate.mjs cleanDistractors 同规约
         （norm 复用于 chunk-engine.mjs，防规约漂移）。

   规则（对每个带 it.distractors 的句子）：
     E1  distractors 必须是数组
     E2  外层长度必须 === it.chunks.length（≠ → 逐位错位，chunk[i] 吃到
         chunk[i+1] 的干扰，比空位危害更大 —— cleanDistractors 的硬拒绝）
     E3  每槽必须是数组
     E4  条目必须 string、trim 后非空、长度 1..120（sanitizeOne 护栏）
     E5  条目 norm 不得等于句内任一 chunk 的 norm（含目标位自身 →
         用户看到"两个都对" / judgeChunk 判对歧义）
     E6  槽内 norm 不得重复（norm 去重）
     W1  条目首尾带空白（入库未走 cleanDistractors trim 的证据）
     W2  槽位 0 条（空位）→ 该 chunk 逐槽填空时无预置质量，掉运行时生成
     W3  句级消费仿真缺口（2026-09-08 升级）：直接调 chunk-engine 的
         buildDistractors(it, [], [])（空池 = 仅预置可用量，pass0 不依赖池），
         若可用量 < max(4, 2×chunks)（整句模式 distractorCount）→ 该句必混入
         运行时生成干扰（兜底）。取代旧的「每槽目标 3 条」静态阈值——引擎
         逐槽只吃 2 条（buildChoices pick(preset,2)），整句才展平 max(4,2n)，
         旧 W3 的 311 处告警绝大多数永不触发兜底 = 假警报。
   另：无 distractors 字段的句子计入「未入库」统计（builtin-daily 静态 88 句
       属预期未覆盖，输出供 D-pipeline 下一批排期参考），不算违规。

   退出码：有 E 违规 → 1；仅 W / 全合规 → 0。
   ============================================================ */
'use strict';
const fs = require('fs');

function loadLibs() {
  global.window = {};
  /* 与 main.html / stats.html / decks.html 完全一致的加载顺序：
     builtins.js 建 window.BUILTIN → oral8000.js concat 进 builtin-daily
     → freq-idioms.js 自注册 builtin-freq-idioms */
  const libs = ['builtins.js', 'oral8000.js', 'freq-idioms.js'];
  libs.forEach(function (f) {
    new Function('window', fs.readFileSync(__dirname + '/' + f, 'utf8'))(global.window);
  });
  return global.window.BUILTIN || [];
}

(async function main() {
  const { norm } = await import('./js/chunk-engine.mjs');
  const { presetSentenceCoverage } = await import('./js/distractor-validate.mjs');
  const decks = loadLibs();

  const stats = {
    totalSentences: 0,      /* 全部句子 */
    withDistractors: 0,     /* 带预置干扰项的句子 */
    withoutDistractors: 0,  /* 未入库句子（含 D-pipeline 目标外的 deck） */
    errs: [],               /* { deck, cid, sentence, msg } */
    warns: []               /* { deck, cid, sentence, msg } */
  };

  decks.forEach(function (d) {
    (d.items || []).forEach(function (it) {
      stats.totalSentences++;
      const where = d.id + ':' + (it.cid || '?') + '「' + String(it.sentence || '').slice(0, 40) + '」';

      /* ---- 未入库分支：非违规，仅统计 ---- */
      if (!('distractors' in it) || it.distractors == null) {
        stats.withoutDistractors++;
        return;
      }
      stats.withDistractors++;

      /* ---- E1：distractors 是数组 ---- */
      if (!Array.isArray(it.distractors)) {
        stats.errs.push({ where: where, msg: 'E1 distractors 非数组' });
        return; /* 后续规则无法继续 */
      }

      const chunks = it.chunks || [];
      const n = chunks.length;
      /* ---- E2：外层长度 === chunks 数（防错位） ---- */
      if (it.distractors.length !== n) {
        stats.errs.push({ where: where, msg: 'E2 外层长度 ' + it.distractors.length + ' ≠ chunks ' + n + '（会错位）' });
        /* 错位后逐位校验无意义，跳过本条其余规则 */
        return;
      }

      /* 句内正确 norm 集（含目标位自身） */
      const correctSet = {};
      chunks.forEach(function (c) { correctSet[norm(c)] = 1; });

      let slotEmpty = 0;   /* W2 计数 */

      it.distractors.forEach(function (slot, i) {
        /* ---- E3：每槽是数组 ---- */
        if (!Array.isArray(slot)) {
          stats.errs.push({ where: where, msg: 'E3 槽[' + i + '] 非数组：' + JSON.stringify(slot) });
          return;
        }
        if (slot.length === 0) {
          slotEmpty++;
          stats.warns.push({ where: where, msg: 'W2 槽[' + i + ']（chunk「' + chunks[i] + '」）空位：0 条预置干扰' });
          return;
        }

        const seenInSlot = {};
        slot.forEach(function (raw, j) {
          /* ---- E4：string + 非空 + 1..120（sanitizeOne 护栏） ---- */
          if (typeof raw !== 'string') {
            stats.errs.push({ where: where, msg: 'E4 槽[' + i + ']#' + j + ' 非字符串：' + JSON.stringify(raw) });
            return;
          }
          const t = raw.trim();
          if (!t) {
            stats.errs.push({ where: where, msg: 'E4 槽[' + i + ']#' + j + ' 空白串' });
            return;
          }
          if (t.length > 120) {
            stats.errs.push({ where: where, msg: 'E4 槽[' + i + ']#' + j + ' 超长 ' + t.length + '>120：' + t.slice(0, 60) });
            return;
          }
          /* ---- W1：入库未 trim（cleanDistractors 会 trim，出现即写侧绕守门员的证据） ---- */
          if (raw !== t) {
            stats.warns.push({ where: where, msg: 'W1 槽[' + i + ']#' + j + ' 未 trim：「' + raw + '」' });
          }
          /* ---- E5：norm 撞句内任一 chunk（含目标位） ---- */
          const nk = norm(t);
          if (correctSet[nk]) {
            stats.errs.push({ where: where, msg: 'E5 槽[' + i + ']#' + j + ' norm 撞句内 chunk：「' + t + '」' });
            return;
          }
          /* ---- E6：槽内 norm 重复 ---- */
          if (seenInSlot[nk]) {
            stats.errs.push({ where: where, msg: 'E6 槽[' + i + '] 内 norm 重复：「' + t + '」' });
            return;
          }
          seenInSlot[nk] = 1;
        });
      });

      /* ---- W3：句级消费仿真缺口 ----
         presetSentenceCoverage 直接调引擎 buildDistractors(it, [], [])：
         空池 → pass1..4 无候选可取，返回量 = 预置展平后（norm 去重 + 排除句内
         chunk）的真实可用数。整句模式 distractorCount = max(4, 2×chunks)；
         可用 < 该值 → 该句运行时必混入生成干扰（质量降级信号）。
         0 缺口 = 该句纯预置即可出满整句池。 */
      const cov = presetSentenceCoverage(it);
      if (cov.shortfall > 0) {
        stats.warns.push({ where: where, msg: 'W3 句级可用 ' + cov.available + ' < 整句需求 ' + cov.need + '（max(4,2×' + n + ')）→ 运行时必混入生成干扰' });
      }

      /* ---- W4：句级槽位覆盖不足 ---- */
      if (slotEmpty > 0 && n > 1) {
        stats.warns.push({ where: where, msg: 'W4 有 ' + slotEmpty + '/' + n + ' 槽空位' });
      }
    });
  });

  /* ---- 输出 ---- */
  console.log('\n========== 三库 distractor 全量质检 ==========');
  decks.forEach(function (d) {
    const withD = (d.items || []).filter(function (it) { return it.distractors != null; }).length;
    console.log('[' + d.id + '] ' + d.items.length + ' 句 · ' + withD + ' 句带预置干扰项' +
      '（覆盖率 ' + (d.items.length ? (withD / d.items.length * 100).toFixed(1) : '0') + '%）');
  });
  console.log('----------------------------------------');
  console.log('总句数 ' + stats.totalSentences + ' · 已入库 ' + stats.withDistractors +
    ' · 未入库 ' + stats.withoutDistractors);

  if (stats.errs.length) {
    console.log('\n【E 违规 ' + stats.errs.length + ' 处】');
    stats.errs.forEach(function (e) { console.log('  ✗ ' + e.where + ' — ' + e.msg); });
  }
  if (stats.warns.length) {
    console.log('\n【W 告警 ' + stats.warns.length + ' 处】');
    stats.warns.forEach(function (w) { console.log('  ⚠ ' + w.where + ' — ' + w.msg); });
  }

  if (!stats.errs.length && !stats.warns.length) {
    console.log('\n结果：全部合规  ✅');
  } else if (!stats.errs.length) {
    console.log('\n结果：结构全部合规，' + stats.warns.length + ' 处质量告警（建议复核）  ⚠️');
  } else {
    console.log('\n结果：' + stats.errs.length + ' 处违规，需修正  ❌');
  }
  process.exit(stats.errs.length ? 1 : 0);
})();
