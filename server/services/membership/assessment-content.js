'use strict';
const crypto = require('node:crypto');
const deckIdentity = (courseId, unitId) => 'protected_' + crypto.createHash('sha256').update(JSON.stringify([courseId, unitId])).digest('hex');
const fail = (code, status = 503) => Object.assign(new Error(code), { code, status });

function createProtectedAssessmentContent({ registry, courseAccess }) {
  function locate(deckId) {
    for (const course of registry.snapshot().courses) {
      const unit = course.units.find(unit => (unit.recordIdentity?.deckId || deckIdentity(course.courseId, unit.unitId)) === deckId);
      if (unit) return { course, unit };
    }
    if (deckId.startsWith('protected_')) throw fail('COURSE_NOT_FOUND', 404);
    return null;
  }
  function scopeKey(deckId) { const source = locate(deckId); return source?.unit.recordIdentity?.generationScope || 'course:' + (source ? source.course.courseId : deckId); }
  function resolve(userId, key, learningSessionId) {
    const separator = key.indexOf('#'), deckId = key.slice(0, separator), itemId = key.slice(separator + 1);
    const source = locate(deckId);
    if (!source) return null;
    const cursor = source.unit.itemIds.indexOf(itemId);
    if (cursor < 0) throw fail('ITEM_NOT_FOUND', 404);
    const result = courseAccess.read(source.course.courseId, source.unit.unitId, cursor, userId, learningSessionId);
    if (!result.allowed) throw fail(result.reasonCode, result.status || 403);
    const item = result.unit.items[0];
    if (source.course.contentType === 'sentence') return item;
    const text = typeof item.text === 'string' ? { en: item.text } : item.text || {};
    return { cid: item.id, sentence: text.en, translation: text['zh-CN'],
      chunks: Array.isArray(item.chunks) ? item.chunks : item.chunks?.correctOrder?.map(id => item.chunks.items.find(chunk => chunk.id === id)?.text) || item.chunks?.items?.map(chunk => chunk.text) };
  }
  return Object.freeze({ locate, resolve, scopeKey });
}
module.exports = { createProtectedAssessmentContent, deckIdentity };
