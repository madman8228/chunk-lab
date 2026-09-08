/**
 * distractor-validate.mjs · 干扰项生成结果清洗/校验纯函数（D-pipeline，2026-09-08）
 *
 * 从 LLM 输出到可落盘 it.distractors[i] 的中间层（无 DOM、无网络、无全局状态）：
 *   - parseDistractorText：从 LLM 返回文本提取 {"distractors": [...]}（复用 extractJSON）
 *   - cleanDistractors：逐位对齐 chunks + 逐条清洗（类型/长度护栏 + norm 去重 +
 *     与句内所有 chunk norm 撞车即丢 —— 撞车项会让用户看到"两个都对"或判对歧义）
 *
 * 架构定位（ADR-007 纯逻辑模块）：读侧消费见 chunk-engine.mjs（buildChoices/buildDistractors
 * 的桶 0 / pass 0）；本模块是写侧（打包管线）的守门员。两者共享 norm 规约。
 *
 * 浏览器：不引入（仅 scripts/gen-distractors.mjs 与单测使用）
 * 单测：  node js/distractor-validate.test.mjs
 */
'use strict';

import { norm } from './chunk-engine.mjs';
import { extractJSON } from './ai-prompts.mjs';

/* 单条干扰项护栏：类型/长度。返回清洗后的字符串，非法返回 null */
function sanitizeOne(d) {
  if (typeof d !== 'string') return null;
  const t = d.trim();
  if (!t || t.length < 1 || t.length > 120) return null;
  return t;
}

/* LLM 输出解析：容忍代码块围栏/前后杂文/BOM（extractJSON 已处理），
   要求根为对象且含 distractors 数组。返回 {ok:true,data:{distractors}} 或 {ok:false,error} */
export function parseDistractorText(text) {
  let obj;
  try {
    obj = extractJSON(text);
  } catch (e) {
    return { ok: false, error: 'JSON 解析失败：' + e.message };
  }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.distractors)) {
    return { ok: false, error: '输出缺少 distractors 数组' };
  }
  return { ok: true, data: { distractors: obj.distractors } };
}

/* 清洗 + 校验：
   - raw = LLM/作者提供的 distractors 外层数组
   - ★ 长度契约：raw.length 必须 === it.chunks.length。逐位对齐消费 —— 若少位，
     后续数组会「前移错位」（chunk[i] 位吃到 chunk[i+1] 的干扰），比空位危害更大
     （空位运行时规则兜底；错位=把干扰灌进错误的填空位，静默劣质）。
     违反 → 返回 {ok:false}，由调用方决定整句重试/人工修正（杜绝错位入库）。
   - 逐条规则：必须是字符串；长度护栏 1..120；norm 不得等于该句任何 chunk 的 norm
     （含目标位自身 —— 撞车 = 该答案与正确答案归一化相同 → judgeChunk 判对歧义/白送）；
     同 chunk 位内 norm 去重；每 chunk 位至多收 3 条。
   - 返回 { ok, distractors, stats:{received, dropped, perChunk:number[]} }。
     合法空位（该 chunk 实在无合格项，宁缺毋滥）以空数组保留。 */
export function cleanDistractors(it, raw) {
  const chunks = it.chunks || [];
  const n = chunks.length;
  const dists = Array.isArray(raw) ? raw : [];
  if (dists.length !== n) {
    return { ok: false, error: 'distractors 外层长度 ' + dists.length + ' ≠ chunks ' + n + '（会错位，拒绝）' };
  }
  const correctSet = {};
  chunks.forEach(function (c) { correctSet[norm(c)] = 1; });

  const perChunk = [];
  let received = 0;
  let dropped = 0;

  const out = [];
  for (let i = 0; i < n; i++) {
    const slotRaw = Array.isArray(dists[i]) ? dists[i] : [];
    const slot = [];
    const seen = {};
    slotRaw.forEach(function (d) {
      if (slot.length >= 3) return;
      received++;
      const t = sanitizeOne(d);
      if (!t) { dropped++; return; }
      const nk = norm(t);
      if (!nk || correctSet[nk] || seen[nk]) { dropped++; return; }
      seen[nk] = 1;
      slot.push(t);
    });
    out.push(slot);
    perChunk.push(slot.length);
  }
  return { ok: true, distractors: out, stats: { received: received, dropped: dropped, perChunk: perChunk } };
}
