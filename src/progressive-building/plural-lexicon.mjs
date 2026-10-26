// Reviewed lexical facts. Rules explain these entries; they do not guess unknown plurals.
export const pluralPatterns = {
  s: { label: '规则变化：加 s', explanation: '许多可数名词在单数词尾加 s 构成复数。', change: word => word + 's', accepts: word => !/(s|x|z|ch|sh|[^aeiou]y)$/i.test(word) },
  es: { label: '规则变化：加 es', explanation: '以 s、x、ch、sh 等结尾的名词通常加 es。这里练习 x 和 sh 结尾的词。', change: word => word + 'es', accepts: word => /(s|x|ch|sh)$/i.test(word) },
  y: { label: '规则变化：辅音字母加 y', explanation: '以辅音字母加 y 结尾时，通常把 y 改为 i，再加 es；元音字母加 y 的词不套用这条。', change: word => word.slice(0, -1) + 'ies', accepts: word => /[^aeiou]y$/i.test(word) },
  irregular: { label: '不规则变化：特殊词形', explanation: '这些词不按本课的 s、es、ies 规则变化，需要记住审核过的单复数配对。' },
  unchanged: { label: '不规则变化：单复数同形', explanation: '有些名词的单数和复数拼写相同，需要结合数量词和语境判断。' },
};
export const pluralLexicon = {
  book: { singular: 'book', plural: 'books', gloss: '书', measure: '本', pattern: 's', singularScene: 'book', pluralScene: 'books' },
  box: { singular: 'box', plural: 'boxes', gloss: '盒子', measure: '个', pattern: 'es' },
  baby: { singular: 'baby', plural: 'babies', gloss: '婴儿', measure: '个', pattern: 'y' },
  child: { singular: 'child', plural: 'children', gloss: '孩子', measure: '个', pattern: 'irregular', singularScene: 'child' },
  foot: { singular: 'foot', plural: 'feet', gloss: '脚', measure: '只', pattern: 'irregular' },
  sheep: { singular: 'sheep', plural: 'sheep', gloss: '绵羊', measure: '只', pattern: 'unchanged' },
  // Held out of the lesson to verify the same builder works with different vocabulary.
  dish: { singular: 'dish', plural: 'dishes', gloss: '盘子', measure: '个', pattern: 'es' },
  city: { singular: 'city', plural: 'cities', gloss: '城市', measure: '座', pattern: 'y' },
  mouse: { singular: 'mouse', plural: 'mice', gloss: '老鼠', measure: '只', pattern: 'irregular' },
  bag: { singular: 'bag', plural: 'bags', gloss: '包', measure: '个', pattern: 's' },
};
export function pluralEntry(id) {
  const entry = pluralLexicon[id];
  if (!entry || !pluralPatterns[entry.pattern]) throw new Error('Missing reviewed plural entry: ' + id);
  const pattern = pluralPatterns[entry.pattern];
  if (pattern.change && (!pattern.accepts(entry.singular) || pattern.change(entry.singular) !== entry.plural)) throw new Error('Plural rule disagrees with reviewed form: ' + id);
  if (entry.pattern === 'unchanged' && entry.singular !== entry.plural) throw new Error('Same-form entry must retain spelling');
  return entry;
}
