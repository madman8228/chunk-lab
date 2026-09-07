/* 翻译质量机检规则（2026-09-06 方案 A：机检层）
 *
 * 背景：此前校验只查「translation 存在」，直译腔/漏英文/堆砌句零成本通过。
 * 本模块把「可编码的翻译腔规则」收敛为单一实现，供三处复用：
 *   1) scripts/inject-freq-idioms.js   —— 注入新批次前硬拦（errors 即 FAIL）
 *   2) validate_freq_idioms.js         —— 存量/发布校验（errors 报问题，warnings 打印供人看）
 *   3) 独立扫描：node -e "require('./scripts/translation-rules').scanAll()"
 *
 * 设计原则：宁可漏、不可误伤。只拦有把握的机械病，语感类问题靠 warnings 提示人工复核。
 * 修正翻译后若被误拦（规则过紧），先把规则改准，不要用白名单糊弄。
 */

/* 判定单条翻译。返回 { errors: string[], warnings: string[] } */
function checkTranslation(it) {
  const t = String((it && it.translation) || '').trim();
  const errors = [];
  const warnings = [];

  if (!t) {
    errors.push('translation 为空');
    return { errors, warnings };
  }

  const noWs = t.replace(/\s+/g, '');

  /* ── errors（机械病，必拦） ── */

  // E-1 含英文单词（≥2 字母）：中文释义不该残留英文（offer / you / eat…）
  const en = t.match(/[A-Za-z]{2,}/g);
  if (en) errors.push('译文含英文单词: ' + JSON.stringify(en));

  // E-2 过长：整句释义 >30 字基本是直译啰嗦（惯用语最多 25 字内）
  if (noWs.length > 30) errors.push('译文过长(' + noWs.length + '字)，疑似直译啰嗦');

  // E-3 过短：<2 字不成句
  if (noWs.length < 2) errors.push('译文过短(' + noWs.length + '字)');

  // E-4 「的」字堆砌：≥3 个"的"且 ≥14 字，是翻译腔铁证（"他的行为的…的…"）
  const deCount = (t.match(/的/g) || []).length;
  if (deCount >= 3 && noWs.length >= 14) errors.push('「的」字堆砌 x' + deCount + '（翻译腔，改短句）');

  // E-5 「把 X 叫做 Y」堆砌直译
  if (/把[^，。]{1,12}(叫做|称作|称为)/.test(t)) errors.push('「把X叫做Y」直译句式');

  // E-6 半角逗号残留（中文文案不该有 ","）
  if (/,/.test(t)) errors.push('译文含半角逗号 ","');

  // E-7 句末无中文句号（>2 字整句必须收尾）
  if (noWs.length > 2 && !/[。！？.!?]$/.test(t)) errors.push('句末缺标点');

  /* ── warnings（提示人复核，不自动 FAIL） ── */

  // W-1 学术腔（"意味着/表示的是"常是英文 means / refers to 的痕迹）
  if (/(意味着|表示的是|指的就是)/.test(t)) warnings.push('学术腔词（意味着/表示的是），确认是否人话');

  // W-2 以「的意思」收尾（直译自 "it means…"）
  if (/(的意思。|的意思！|的意思？)$/.test(t)) warnings.push('「…的意思」收尾，确认是否人话');

  return { errors, warnings };
}

/* 扫整批（供独立扫描用） */
function scanAll(arr, label) {
  let nErr = 0;
  (arr || []).forEach((it, i) => {
    const r = checkTranslation(it);
    if (r.errors.length) {
      nErr++;
      console.log('[#' + (i + 1) + '] ' + (it.sentence || '?'));
      r.errors.forEach((e) => console.log('   ✗ ' + e));
    }
  });
  if (nErr) console.log('\n翻译问题条目: ' + nErr + ' / ' + arr.length + '  ❌');
  else console.log('翻译机检: ' + arr.length + ' 条全部通过 ✅');
  return nErr;
}

module.exports = { checkTranslation, scanAll };