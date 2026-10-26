// Countability is recorded per teaching sense, not inferred from spelling or physical measurability.
export const countabilityLexicon = {
 book: { en: 'book', plural: 'books', zh: '书', sense: '一本本的书', countability: 'count' },
 water: { en: 'water', zh: '水', sense: '作为物质的水，不是点单时的一份水', countability: 'mass' },
 milk: { en: 'milk', zh: '牛奶', sense: '作为物质的牛奶，不是品种或点单份数', countability: 'mass' },
 rice: { en: 'rice', zh: '米', sense: '作为食物或物质的米', countability: 'mass' },
 glass: { en: 'glass', plural: 'glasses', zh: '玻璃杯', sense: '可逐个计数的容器，不是玻璃材料', countability: 'count' },
 bottle: { en: 'bottle', plural: 'bottles', zh: '瓶子', sense: '可逐个计数的容器', countability: 'count' },
};
export function massQuantity(substanceId, { unitId, number = 1 } = {}) {
 const substance = countabilityLexicon[substanceId];
 if (!substance || substance.countability !== 'mass') throw new Error('Requires a reviewed mass sense');
 if (!unitId) {
  if (number !== 1) throw new Error('Exact mass quantity requires a unit');
  return ['some', substance.en];
 }
 const unit = countabilityLexicon[unitId];
 if (!unit || unit.countability !== 'count' || !unit.plural) throw new Error('Requires a reviewed countable unit');
 if (![1, 2].includes(number)) throw new Error('Only reviewed one/two quantities are supported');
 return [number === 1 ? 'a' : 'two', number === 1 ? unit.en : unit.plural, 'of', substance.en];
}
