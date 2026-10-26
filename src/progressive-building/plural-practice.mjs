import { pluralEntry, pluralPatterns } from './plural-lexicon.mjs?v=20261026-27';
const phrase = [{ start: 0, end: 2, label: '名词短语', level: 0 }];
export function buildPluralPair(id, startIndex) {
  const entry = pluralEntry(id), pattern = pluralPatterns[entry.pattern];
  const singularId = id + 'Singular', pluralId = id + 'Plural';
  const visual = sceneId => sceneId ? { sceneId, show: 'after-correct' } : undefined;
  return {
    words: {
      [singularId]: { en: entry.singular, zh: entry.gloss + '（单数）', part: '名词', ...(entry.singularScene ? { visualSceneId: entry.singularScene } : {}) },
      [pluralId]: { en: entry.plural, zh: entry.gloss + '（复数）', part: '名词', ...(entry.pluralScene ? { visualSceneId: entry.pluralScene } : {}) },
    },
    steps: [
      { meaning: '一' + entry.measure + entry.gloss, wordIds: ['a', singularId], bankWordIds: ['a', singularId], dependsOn: startIndex ? [startIndex - 1] : [], ...(startIndex ? { replacesTrailIndexes: [startIndex - 1] } : {}), annotations: phrase, visual: visual(entry.singularScene), learningNote: { term: '从一个开始', question: '现在是一个还是多个？', answer: '一个，用单数 ' + entry.singular, explanation: '可数名词表示一个时用单数，两个及以上用复数。先认识单数 ' + entry.singular + '，再比较它的复数。' } },
      { meaning: '两' + entry.measure + entry.gloss, wordIds: ['two', pluralId], bankWordIds: ['two', pluralId], dependsOn: [startIndex], replacesTrailIndexes: [startIndex], annotations: phrase, visual: visual(entry.pluralScene), learningNote: { term: pattern.label, question: entry.singular + ' 怎样变成复数？', answer: entry.singular + ' → ' + entry.plural, explanation: pattern.explanation + '在本例中，' + entry.singular + ' 的复数是 ' + entry.plural + '。two 表示两个，要与复数 ' + entry.plural + ' 配合。' + (entry.pattern === 'irregular' ? '不能直接写成 ' + entry.singular + 's，也不能给复数再加 s。' : entry.pattern === 'unchanged' ? 'a sheep 是一只，two sheep 是两只；拼写不变，数量不同。' : '') } },
    ],
  };
}
