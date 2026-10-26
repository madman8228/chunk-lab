import { quantity } from './quantity-v3.mjs';
import { massQuantity } from './countability-lexicon.mjs?v=20261026-30';
const span = (start, end, label) => ({ start, end, label, level: 0 });
const phrase = end => [span(0, end, '名词短语')];
const clause = end => [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, end, '宾语')];
export const countability = {
 id: 'countability-preview', label: 'PB05 · 可数与不可数（已打磨）', knowledgeNode: 'PB05', prerequisites: ['PB04'], sentenceStepIndexes: [3, 10, 11, 13, 14],
 objectives: ['区分逐个计数与物质整体的表达', '理解some并非不可数名词专用', '计量时改变单位名词而保留物质名词', '换物质后迁移计量结构'],
 words: { ...quantity.words,
  water: { en: 'water', zh: '水', part: '名词', visualSceneId: 'water' }, milk: { en: 'milk', zh: '牛奶', part: '名词', visualSceneId: 'milk' },
  some: { en: 'some', zh: '一些', part: '限定词' }, glass: { en: 'glass', zh: '玻璃杯', part: '名词', visualSceneId: 'empty-glass' }, glasses: { en: 'glasses', zh: '玻璃杯（复数）', part: '名词' }, of: { en: 'of', zh: '连接单位和内容', part: '介词' },
 },
 sentence: { wordIds: ['you', 'need', 'some', 'milk'], zh: '你需要一些牛奶。' },
 sequence: [
  { meaning: '两本书', wordIds: ['two', 'books'], bankWordIds: ['two', 'books'], dependsOn: [], annotations: phrase(2), visual: { sceneId: 'books', show: 'after-correct' }, learningNote: { term: '可数名词', question: '书怎样计数？', answer: '一本、两本，可以逐个数', explanation: 'book 表示一本本的书，是可数名词。一个用单数，两个及以上用复数，所以是 a book、two books。' } },
  { meaning: '水', wordIds: ['water'], bankWordIds: ['water'], dependsOn: [0], replacesTrailIndexes: [0], annotations: [], learningNote: { term: '不可数用法', question: '这里说的是水本身，还是几杯水？', answer: '水这种物质本身', explanation: '这里把水作为物质整体来表达，water 用不可数用法，不直接按一个water、两个water计数。这不表示水无法测量，而是英语表达数量时需要用杯、瓶、升等计量单位。' } },
  { meaning: '一些水', wordIds: massQuantity('water'), bankWordIds: massQuantity('water'), dependsOn: [1], replacesTrailIndexes: [1], annotations: phrase(2), visual: { sceneId: 'water', show: 'after-correct' }, learningNote: { term: '不指定确切数量', question: '没说几杯、几升，怎样表示一些水？', answer: 'some water', explanation: 'some 表示一些，没有指定确切数量。本题的 water 指水这种物质，不直接用 a water 或 two waters 表示普通的水量；这里用 some water。' } },
  { meaning: '我需要一些水', wordIds: ['i', 'need', 'some', 'water'], bankWordIds: ['i', 'need', 'some', 'water'], dependsOn: [2], annotations: clause(4), visual: { sceneId: 'i-need-water', show: 'after-correct' }, successFeedback: '整个 some water 作宾语。这里没有数杯子，也没有指定确切水量，water 保持原形。' },
  { type: 'classify', meaning: '一些水', wordIds: ['some', 'water'], focusWordId: 'water', dependsOn: [3], annotations: phrase(2), prompt: '这里 water 用不可数用法，是什么意思？', answer: 'expression', options: [
   { id: 'physical', key: 'p', label: '水在现实中完全无法测量', feedback: '水可以测量，例如两杯、一升。不可数说的是当前英语表达方式：water 表示物质，不直接配数字计数，需要用计量单位表达确定数量。' },
   { id: 'expression', key: 'e', label: '把水作为物质表达，计量时另加单位', feedback: '这里的 water 指水这种物质，不能照搬 two books。要表达确定数量，可说 two glasses of water，数的是杯。' }
  ] },
  { meaning: '牛奶', wordIds: ['milk'], bankWordIds: ['milk'], dependsOn: [4], replacesTrailIndexes: [4], clearSentenceResultOnComplete: true, annotations: [], learningNote: { term: '迁移到另一物质', question: '这里说的是牛奶本身吗？', answer: '是，milk 在这里用不可数用法', explanation: '本课把 milk 当作牛奶这种物质。没有指定容器或份数时，不说 two milks 来表示普通的牛奶量；可以用 some milk。点单中的两份牛奶属于另一种语境。' } },
  { meaning: '一些牛奶', wordIds: massQuantity('milk'), bankWordIds: massQuantity('milk'), dependsOn: [5], replacesTrailIndexes: [5], annotations: phrase(2), visual: { sceneId: 'milk', show: 'after-correct' }, learningNote: { term: '同类用法复用', question: '水换成牛奶，怎样表达一些？', answer: 'some milk', explanation: 'some water 和 some milk 都没有指定确切数量。词换了，物质整体的表达方法可以复用。' } },
  { type: 'classify', meaning: '两本书', wordIds: ['two', 'books'], focusWordId: 'books', dependsOn: [6], annotations: phrase(2), prompt: '表达“一些书”，也能用 some books 吗？', answer: 'yes', options: [
   { id: 'no', key: 'n', label: '不能，some 只用于不可数名词', feedback: 'some 不专属于不可数名词。some books 是一些书，some water 是一些水；前者接可数名词复数，后者接不可数名词。' },
   { id: 'yes', key: 'y', label: '能，some 也可接可数名词复数', feedback: 'some books 和 some water 都可以。判断可数性要看名词在当前意思中的用法，不能只看前面有没有 some。' }
  ] },
  { meaning: '一个玻璃杯', wordIds: ['a', 'glass'], bankWordIds: ['a', 'glass'], dependsOn: [6, 7], replacesTrailIndexes: [6, 7], annotations: phrase(2), visual: { sceneId: 'empty-glass', show: 'after-correct' }, learningNote: { term: '可数的计量单位', question: '杯子能一个个数吗？', answer: '可以，a glass / two glasses', explanation: '这里 glass 表示玻璃杯，是可数名词；复数按 s 结尾加 es，变成 glasses。接下来用杯来计量水。glass 表示玻璃材料时有另一种不可数用法，不与这里混为一谈。' } },
  { meaning: '水（计量短语的内容部分）', wordIds: ['of', 'water'], bankWordIds: ['of', 'water'], dependsOn: [8], replacesTrailIndexes: [8], annotations: [], learningNote: { term: '连接单位和内容', question: '杯里装的是什么？', answer: 'water（水）', explanation: '在 a glass of water 中，of 把计量单位 glass 和内容 water 连起来。of water 这里只是待合并片段，不是完整句子，也不是在表达动作“装”。' } },
  { meaning: '一杯水', wordIds: massQuantity('water', { unitId: 'glass' }), bankWordIds: massQuantity('water', { unitId: 'glass' }), dependsOn: [8, 9], replacesTrailIndexes: [8, 9], annotations: phrase(4), visual: { sceneId: 'one-glass-water', show: 'after-correct' }, learningNote: { term: '用单位计量物质', question: 'a 数的是水，还是杯？', answer: '一杯，单位是 glass', explanation: 'a glass of water 表示一杯水。a 与可数的 glass 配合；of water 说明内容是水，water 在这里仍是不可数用法。' } },
  { type: 'quantity', meaning: '两杯水', sourceWordIds: ['a', 'glass', 'of', 'water'], wordIds: massQuantity('water', { unitId: 'glass', number: 2 }), dependsOn: [10], annotations: phrase(4), visual: { sceneId: 'two-glasses-water', show: 'after-correct' }, changes: [
   { index: 0, to: 'two', prompt: '一杯变两杯，先改数量。', explanation: '把 a 换成 two，表示两杯。', options: [{ wordId: 'a', key: 'a' }, { wordId: 'two', key: 't' }], wrongFeedback: 'a 仍是一杯，这里要两杯，数量改为 two。' },
   { index: 1, to: 'glasses', prompt: '两杯，哪个名词需要变成复数？', explanation: '数的是容器 glass，两杯用复数 glasses。of water 保持不变，不给 water 加 s。', options: [{ wordId: 'glass', key: 'g' }, { wordId: 'glasses', key: 's' }], wrongFeedback: 'two 表示两杯，单位名词 glass 要用复数 glasses；水作为内容仍写 water。' }
  ], successFeedback: 'a glass of water → two glasses of water。数量改变的是杯，glass 变 glasses，water 保持原形。' },
  { type: 'classify', meaning: '两杯水', wordIds: ['two', 'glasses', 'of', 'water'], focusWordId: 'glasses', dependsOn: [11], annotations: phrase(4), prompt: 'two glasses of water 中，为什么只把 glass 变成 glasses？', answer: 'unit', options: [
   { id: 'liquid', key: 'w', label: '因为 water 也已经变成可数名词', feedback: '这里 water 仍表示物质。两杯数的是单位 glass，不是把 water 本身变成可数名词。' },
   { id: 'unit', key: 'u', label: '数的是杯，water 仍表示水这种物质', feedback: 'two 与可数的单位 glasses 配合，of water 说明装的是水。物质和计量单位的用法要分开判断。' }
  ] },
  { meaning: '两杯牛奶', wordIds: massQuantity('milk', { unitId: 'glass', number: 2 }), bankWordIds: massQuantity('milk', { unitId: 'glass', number: 2 }), dependsOn: [10, 11, 12], replacesTrailIndexes: [10, 11, 12], annotations: phrase(4), visual: { sceneId: 'two-glasses-milk', show: 'after-correct' }, learningNote: { term: '换内容，保留计量结构', question: '杯里改成牛奶，数量单位改变吗？', answer: '仍是 two glasses', explanation: 'two glasses of milk 表示两杯牛奶。只把内容 water 换成 milk，数的仍是杯，milk 在这里保持不可数用法。' } },
  { meaning: '你需要一些牛奶', wordIds: ['you', 'need', 'some', 'milk'], bankWordIds: ['you', 'need', 'some', 'milk'], dependsOn: [13], annotations: clause(4), visual: { sceneId: 'you-need-milk', show: 'after-correct' }, successFeedback: 'some milk 表达一些牛奶，没有指定确切数量。整个 some milk 是 need 的宾语。' },
  { type: 'transfer', meaning: '你需要两杯牛奶', wordIds: ['you', 'need', 'two', 'glasses', 'of', 'milk'], dependsOn: [14], annotations: clause(6), answers: ['You need two glasses of milk.'], visual: { sceneId: 'you-need-two-glasses-milk', show: 'after-correct' }, successFeedback: '整个 two glasses of milk 作宾语。two 决定单位 glass 用复数 glasses，milk 作为物质保持原形；单位和内容用 of 连接。' },
 ],
};
