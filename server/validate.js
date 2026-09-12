/**
 * validate.js · 服务端轻量 schema 校验（ADR-008 / Phase A，零依赖）
 *
 * 目标：坏数据返回 400（而非 500），防止非法结构打进数据库 / 触发崩溃。
 * 原则：
 *   - 只做「防崩溃 / 防坏数据」的浅层类型检查，不做严格 schema 强绑
 *     （旧客户端数据结构多样：item 可能是 {sent,chunks:[{t,role}]} 或简略形态，深校验会误伤）。
 *   - 所有校验函数返回 null = 通过，或返回错误消息字符串。
 */
'use strict';

function isStr(v) { return typeof v === 'string'; }
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

/* 校验一个句子 item（浅层：sent/en/sentence 至少一个字符串——真实前端 decks.html 用 sentence 字段，
   旧数据用 sent/en；chunks 若存在必须是数组）
   ★ 2026-09-08 sync 对抗测试抓到 P1：validateItem 原只认 sent/en，而 decks.html 全部用 sentence
     → 用户 deck 上云全被 400 静默拒绝（cloudSyncNow catch 吞错，UI 只显"未同步"） */
function validateItem(it, deckIdx, itemIdx) {
  if (!isObj(it)) return 'decks[' + deckIdx + '].items[' + itemIdx + '] 不是对象';
  if (!isStr(it.sent) && !isStr(it.en) && !isStr(it.sentence)) return 'decks[' + deckIdx + '].items[' + itemIdx + '] 缺少 sent/en/sentence 文本';
  if (it.chunks !== undefined && !Array.isArray(it.chunks)) return 'decks[' + deckIdx + '].items[' + itemIdx + '].chunks 必须是数组';
  return null;
}

/* 校验 mem 结构（PUT /api/data 与 POST /api/import 共用） */
function validateMem(mem) {
  if (!isObj(mem)) return 'mem 必须是对象';
  if (mem.decks !== undefined) {
    if (!Array.isArray(mem.decks)) return 'mem.decks 必须是数组';
    for (let i = 0; i < mem.decks.length; i++) {
      const d = mem.decks[i];
      if (!isObj(d)) return 'mem.decks[' + i + '] 不是对象';
      if (!isStr(d.id) || !d.id) return 'mem.decks[' + i + '].id 缺失或非字符串';
      if (!isStr(d.name)) return 'mem.decks[' + i + '].name 缺失或非字符串';
      if (d.items !== undefined) {
        if (!Array.isArray(d.items)) return 'mem.decks[' + i + '].items 必须是数组';
        for (let j = 0; j < d.items.length; j++) {
          const e = validateItem(d.items[j], i, j);
          if (e) return e;
        }
      }
    }
  }
  /* 键值类字段浅层类型检查（旧客户端可能整体缺省，undefined 视为合法）：
     best/mastered/settings/stats 应为对象；deletedItems 兼容对象或数组（历史两种形态）；
     reinforceBook 应为数组 */
  for (let i = 0; i < 4; i++) {
    const k = ['best', 'mastered', 'settings', 'stats'][i];
    if (mem[k] !== undefined && !isObj(mem[k])) return 'mem.' + k + ' 必须是对象';
  }
  if (mem.deletedItems !== undefined && !isObj(mem.deletedItems) && !Array.isArray(mem.deletedItems)) return 'mem.deletedItems 必须是对象或数组';
  if (mem.reinforceBook !== undefined && !Array.isArray(mem.reinforceBook)) return 'mem.reinforceBook 必须是数组';
  return null;
}

/* 校验 PUT /api/data 整体载荷 */
function validatePutPayload(body) {
  if (isObj(body) && body.baseSeq !== undefined && (!Number.isSafeInteger(body.baseSeq) || body.baseSeq < 0)) return 'baseSeq 必须是非负安全整数';
  if (isObj(body) && body.requestId !== undefined && (body.baseSeq === undefined || typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(body.requestId))) return 'requestId 必须搭配baseSeq并为8至80位字母、数字、下划线或连字符';
  if (!isObj(body)) return 'body 必须是对象';
  const e = validateMem(body.mem);
  if (e) return e;
  if (body.courses !== undefined) {
    if (!Array.isArray(body.courses)) return 'courses 必须是数组';
    for (let i = 0; i < body.courses.length; i++) {
      const c = body.courses[i];
      if (!isObj(c) || !isStr(c.courseId) || !c.courseId) return 'courses[' + i + '] 缺少 courseId';
    }
  }
  if (body.courseProgress !== undefined && !isObj(body.courseProgress)) return 'courseProgress 必须是对象';
  if (body.revs !== undefined && !isObj(body.revs)) return 'revs 必须是对象';
  if (body.deleted !== undefined && !isObj(body.deleted)) return 'deleted 必须是对象';
  /* statsDelta（2026-09-10 增量同步）：bySentence / events 的变更行上行走这里。
     浅层类型检查即可 —— 深校验会误伤不同客户端的字段演进。 */
  if (body.statsDelta !== undefined) {
    const sd = body.statsDelta;
    if (!isObj(sd)) return 'statsDelta 必须是对象';
    if (sd.sbs !== undefined && !isObj(sd.sbs)) return 'statsDelta.sbs 必须是对象';
    if (sd.sbsGone !== undefined && !Array.isArray(sd.sbsGone)) return 'statsDelta.sbsGone 必须是数组';
    if (sd.evs !== undefined && !Array.isArray(sd.evs)) return 'statsDelta.evs 必须是数组';
    if (sd.evsGone !== undefined && !Array.isArray(sd.evsGone)) return 'statsDelta.evsGone 必须是数组';
  }
  /* entityDelta（2026-09-10 第二轮）：mastered / reinforceBook / deletedItems 的变更行上行走这里。
     同样只做浅层检查。键名必须是 ROW_KV_KINDS 覆盖的三个之一 —— 未知键会被服务端忽略，
     但提前拒掉能让客户端的协议误用立刻可见（而不是静默无效）。 */
  if (body.entityDelta !== undefined) {
    const ed = body.entityDelta;
    if (!isObj(ed)) return 'entityDelta 必须是对象';
    const allowed = ['mastered', 'reinforceBook', 'deletedItems'];
    for (const k of Object.keys(ed)) {
      if (allowed.indexOf(k) < 0) return 'entityDelta 含未知键：' + k;
      const part = ed[k];
      if (!isObj(part)) return 'entityDelta.' + k + ' 必须是对象';
      if (part.up !== undefined && !isObj(part.up)) return 'entityDelta.' + k + '.up 必须是对象';
      if (part.gone !== undefined && !Array.isArray(part.gone)) return 'entityDelta.' + k + '.gone 必须是数组';
    }
  }
  if (body.publications !== undefined) {
    if (!Array.isArray(body.publications)) return 'publications 必须是数组';
    for (const publication of body.publications) {
      if (!isObj(publication) || !isStr(publication.deckId) || !publication.deckId || typeof publication.publish !== 'boolean') {
        return 'publications 项目必须包含 deckId 和布尔 publish';
      }
    }
  }
  if (body.baseRevs !== undefined) return validateBaseRevs(body);
  return null;
}

/* Optional conditional-write protocol. Once supplied, every versioned mutation
   must carry a base and a valid next revision; omissions cannot downgrade it. */
function validateBaseRevs(body) {
  const bases = body.baseRevs;
  if (!isObj(bases)) return 'baseRevs 必须是对象';
  const groups = ['decks', 'kv', 'courses', 'courseProgress'];
  for (const group of Object.keys(bases)) {
    if (!groups.includes(group) || !isObj(bases[group])) return 'baseRevs 分类无效';
    for (const value of Object.values(bases[group])) {
      if (value !== null && (!Number.isSafeInteger(value) || value < 0)) return '基础版本必须是非负安全整数或 null';
    }
  }
  const seen = new Set();
  function item(group, id, revision) {
    if (typeof id !== 'string' || !id) return '同步项目 ID 无效';
    const key = JSON.stringify([group, id]);
    if (seen.has(key)) return '同一项目不能在一批中重复写入或同时删除';
    seen.add(key);
    if (!Object.hasOwn(bases, group) || !Object.hasOwn(bases[group], id)) return '缺少基础版本：' + group + '/' + id;
    if (!Number.isSafeInteger(revision) || revision < 1) return '提交版本必须是正安全整数';
    return null;
  }
  const revs = body.revs || {};
  const revision = (group,id) => isObj(revs[group]) && Object.hasOwn(revs[group],id) ? revs[group][id] : undefined;
  const edits = [];
  (body.mem.decks || []).forEach(d => edits.push(['decks', d.id, revision('decks',d.id)]));
  ['best','stats','settings'].forEach(k => {
    if (Object.hasOwn(body.mem,k)) edits.push(['kv', k, revision('kv',k)]);
  });
  (body.courses || []).forEach(c => edits.push(['courses', c.courseId, revision('courses',c.courseId)]));
  Object.keys(body.courseProgress || {}).forEach(id => edits.push(['courseProgress', id, revision('courseProgress',id)]));
  const deleted = body.deleted || {};
  for (const group of Object.keys(deleted)) {
    if (!groups.includes(group) || !Array.isArray(deleted[group])) return '删除清单分类或格式无效';
    for (const d of deleted[group]) {
      if (!isObj(d)) return '删除清单项目必须是对象';
      const id = group === 'kv' ? d.k : d.id;
      if (group === 'kv' && !['best','stats','settings'].includes(id)) return '此小字段不支持版本删除';
      edits.push([group,id,d.rev]);
    }
  }
  for (const edit of edits) {
    const error = item(...edit);
    if (error) return error;
  }
  return null;
}

/* 校验课程对象（POST /api/courses） */
function validateCourse(course) {
  if (!isObj(course)) return 'course 必须是对象';
  if (!isStr(course.courseId) || !course.courseId) return 'course.courseId 缺失或非字符串';
  return null;
}

module.exports = { validateMem, validatePutPayload, validateCourse };
