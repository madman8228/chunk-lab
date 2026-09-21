/* ============================================================
   srs.js · SRS 间隔重复调度（纯函数，ADR-003）
   ------------------------------------------------------------
   - 无 DOM / 无存储依赖 → 可在 Node 直接单测
   - 间隔序列 1→3→7→14→30→60→120→180→365（艾宾浩斯节奏）
   - 答对 → 沿序列前进，ease+0.05（上限 2.5）
   - 答错 → repetition 重置 0 / interval=1 / ease-0.2（下限 1.3）
   - 未来可替换 FSRS 算法而不影响 UI（只改本文件 + 测试）
   ============================================================ */
(function(global){
  'use strict';

  var DAY_MS = 86400000;

  /* 间隔序列（答对第 N 次的间隔天数） */
  var SEQ = [1, 3, 7, 14, 30, 60, 120, 180, 365];

  /* 确保卡片有合法的 SRS 字段（兼容旧数据缺失） */
  function normalize(card){
    var c = card || {};
    return {
      interval: (typeof c.interval === 'number' && c.interval >= 1) ? c.interval : 1,
      ease: (typeof c.ease === 'number' && c.ease >= 1.3) ? c.ease : 2.5,
      dueAt: (typeof c.dueAt === 'number') ? c.dueAt : 0,
      repetition: (typeof c.repetition === 'number' && c.repetition >= 0) ? c.repetition : 0
    };
  }

  /* 纯函数：记录一次练习结果，返回调度字段的副本（不修改入参） */
  function recordResult(card, ok, now){
    var c = normalize(card);
    var t = (typeof now === 'number') ? now : Date.now();
    if(ok){
      c.repetition++;
      var idx = Math.min(c.repetition - 1, SEQ.length - 1);
      c.interval = SEQ[idx];
      c.ease = Math.min(2.5, c.ease + 0.05);
      c.dueAt = t + c.interval * DAY_MS;
    } else {
      c.repetition = 0;
      c.interval = 1;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.dueAt = t + DAY_MS;
    }
    return c;
  }

  /* 是否到期（dueAt ≤ now 且已设过 dueAt） */
  function isDue(st, now){
    if(!st || typeof st.dueAt !== 'number' || !st.dueAt) return false;
    return st.dueAt <= ((typeof now === 'number') ? now : Date.now());
  }

  /* 排序权重：到期 0 / 未到期 1（用于出题队列排序） */
  function dueRank(st, now){
    return isDue(st, now) ? 0 : 1;
  }

  /* 格式化：距到期的剩余/逾期描述（UI 展示用，纯函数） */
  function dueLabel(st, now){
    if(!st || typeof st.dueAt !== 'number' || !st.dueAt) return '';
    var t = (typeof now === 'number') ? now : Date.now();
    var diffDays = Math.round((st.dueAt - t) / DAY_MS);
    if(diffDays > 0) return '还有 ' + diffDays + ' 天';
    if(diffDays === 0) return '今天到期';
    return '已逾期 ' + (-diffDays) + ' 天';
  }

  /* 阶段序号（1-based，上限=序列长度）：repetition=0（新句 / 答错重置）视为第 1 阶段。
     UI 用它回答「这句现在在记忆曲线的哪一格」，而不是只给一个孤立的天数。 */
  function stageOf(st){
    var c = normalize(st);
    return Math.min(Math.max(c.repetition, 1), SEQ.length);
  }

  /* 一次性展示文案：'下次复习:X天后'。
     未排期（dueAt=0）返回 ''，与 dueLabel 同口径，调用方据此决定「是否显示」。
     阶段信息保留在 SRS 数据和统计中，不在练习卡片的即时提示里重复展示。 */
  function scheduleLabel(st, now){
    if(!st || typeof st.dueAt !== 'number' || !st.dueAt) return '';
    var t = (typeof now === 'number') ? now : Date.now();
    var diffDays = Math.round((st.dueAt - t) / DAY_MS);
    var dueText = diffDays > 0 ? diffDays + '天后'
      : (diffDays === 0 ? '今天' : '逾期' + (-diffDays) + '天');
    return '下次复习:' + dueText;
  }

  global.CL = global.CL || {};
  global.CL.srs = {
    SEQ: SEQ.slice(),
    STAGES: SEQ.length,
    normalize: normalize,
    recordResult: recordResult,
    isDue: isDue,
    dueRank: dueRank,
    dueLabel: dueLabel,
    stageOf: stageOf,
    scheduleLabel: scheduleLabel
  };
})(window);
