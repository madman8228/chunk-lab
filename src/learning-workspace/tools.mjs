export const TOOLS = Object.freeze([
  Object.freeze({ id: 'vocabulary', label: '学单词', href: 'vocabulary.html', readiness: 'ready', resumeSupport: true, resumeScope: 'wordbook' }),
  Object.freeze({ id: 'chunks', label: '练句子', href: 'main.html?view=discover', readiness: 'ready', resumeSupport: true }),
]);

export function selectTools(preferences = {}) {
  const pinned = Object.values(preferences).filter(row => row?.itemType === 'tool' && row.selected)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const tools = pinned.map(row => TOOLS.find(tool => tool.id === row.targetId)).filter(Boolean);
  return { personalized: tools.length > 0, tools: tools.length ? tools.slice(0, 3) : TOOLS.slice() };
}
