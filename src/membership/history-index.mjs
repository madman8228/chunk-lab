/** Join public course metadata to the account's existing facts, without fetching lesson bodies. */
export async function buildProtectedHistoryDecks({ courses, stats, digest }) {
  const byDeck = new Map();
  const registered = new Set((courses || []).flatMap(course => (course.units || []).map(unit => unit.recordIdentity?.deckId).filter(Boolean)));
  for (const [key, stat] of Object.entries(stats || {})) {
    const separator = key.indexOf('#');
    if (separator < 1 || !key.startsWith('protected_') && !registered.has(key.slice(0, separator))) continue;
    const id = key.slice(0, separator);
    if (!byDeck.has(id)) byDeck.set(id, []);
    byDeck.get(id).push({ cid: key.slice(separator + 1), stat });
  }
  const matched = new Map();
  await Promise.all((courses || []).flatMap(course => (course.units || []).map(async unit => {
    const id = unit.recordIdentity?.deckId || 'protected_' + await digest(JSON.stringify([course.courseId, unit.unitId]));
    if (byDeck.has(id)) matched.set(id, { course, unit });
  })));
  return [...byDeck].map(([id, records]) => {
    const source = matched.get(id);
    const title = source?.course.title || '平台课程学习记录';
    return { id, name: title, _protectedHistory: true, _protectedCourseId: source?.course.courseId,
      items: records.map(({ cid, stat }, index) => {
        const evidence=Array.isArray(stat.learningV1?.evidence)?stat.learningV1.evidence:[];
        const latest=evidence.filter(event=>event&&event.type==='assessment').slice().sort((a,b)=>a.at-b.at).at(-1);
        return { cid, sentence: stat.sentence || title + ' · 已学内容 ' + (index + 1),
        translation: '学习记录保留；打开课程后检查当前学习权限。',
        ...(latest ? {_protectedAssessmentHistory:'最近'+(latest.stage==='initial'?'初测':'复测')+(latest.ok?'通过':'未通过')+'（历史记录）'} : {}),
        _protectedHistory: true,
        ...(source ? { _protectedReviewUrl: 'main.html?protectedCourse=' + encodeURIComponent(source.course.courseId) +
          '&unit=' + encodeURIComponent(source.unit.unitId) + '&reviewItem=' + encodeURIComponent(cid),
          _protectedAssessmentUrl: 'main.html?protectedCourse=' + encodeURIComponent(source.course.courseId) +
          '&unit=' + encodeURIComponent(source.unit.unitId) + '&assessmentItem=' + encodeURIComponent(cid) } : {}) };
      }) };
  });
}
