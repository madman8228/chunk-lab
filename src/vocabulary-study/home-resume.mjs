import contract from '../../js/vocabulary-course-contract.js';
export function selectHomeResume(chunk, vocabulary = {}) {
  const entries = Object.values(vocabulary).filter(row => row?.status === 'active' && row.itemId && row.bookId)
    .map(row => ({ toolId: 'vocabulary', title: row.title || '继续单词本练习', resourceId: 'wordbook:' + row.bookId,
      serverTime: Number(row.serverTime) || 0, bookId: row.bookId,unitId:row.unitId,structureRevision:row.structureRevision,practiceType:row.practiceType }));
  if (chunk) entries.push({ ...chunk, toolId: 'chunks', serverTime: Number(chunk.serverTime || chunk.updatedAt) || 0 });
  return entries.sort((a,b) => b.serverTime-a.serverTime)[0] || null;
}
export function resumeHref(resume) {
  return 'wordbook.html?book='+encodeURIComponent(resume.bookId)+(resume.unitId?'&unit='+encodeURIComponent(resume.unitId)+'&structureRevision='+encodeURIComponent(resume.structureRevision):'')+(contract.separatePractice(resume.practiceType)?'&practice='+encodeURIComponent(resume.practiceType):'');
}
