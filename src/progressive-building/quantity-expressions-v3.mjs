import { countability } from './countability-v3.mjs?v=20261026-32';
const span = (start, end, label, level = 0) => ({ start, end, label, level });
const phrase = end => [span(0, end, '名词短语')];
const clause = end => [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, end, '宾语')];
export const quantityExpressions = {
 id: 'quantity-expressions-preview', label: 'PB05 · 数量表达 many / much（已打磨）', knowledgeNode: 'PB05', prerequisites: ['PB04'], sentenceStepIndexes: [4, 5, 7, 8, 10],
 objectives: ['按当前名词用法选择many或much', '把a lot of作为整体数量表达使用', '换对象而保持整组宾语结构'],
 words: { i: countability.words.i, you: countability.words.you, need: countability.words.need, water: countability.words.water, milk: countability.words.milk,
  books: { en: 'books', zh: '书（复数）', part: '名词' }, a: countability.words.a, of: countability.words.of,
  many: { en: 'many', zh: '许多', part: '限定词' }, much: { en: 'much', zh: '很多', part: '限定词' }, lot: { en: 'lot', zh: '与a、of组成数量表达', part: '名词' } },
 sentence: { wordIds: ['a', 'lot', 'of', 'milk'], zh: '很多牛奶' },
 sequence: [
  { meaning: '很多书', wordIds: ['many', 'books'], bankWordIds: ['many', 'books'], dependsOn: [], annotations: phrase(2), learningNote: { term: 'many 与可数名词复数', question: '书能逐本计数，用什么形式？', answer: 'many books', explanation: 'many 表示许多，后接可数名词复数。book 可以逐本计数，这里表示很多本，用 books。many 不表示确切几本，也不再与 a 连用。' } },
  { meaning: '很多水', wordIds: ['much', 'water'], bankWordIds: ['much', 'water'], dependsOn: [0], replacesTrailIndexes: [0], annotations: phrase(2), learningNote: { term: 'much 与不可数名词', question: '本课把水作为物质，用 many 吗？', answer: '不用 many，数量片段是 much water', explanation: 'much 表示很多的量，后接当前用法为不可数的名词，如 water。many books 说很多本书，much water 说很多水量；这里不是给 water 加 s。much 常见于疑问句和否定句；普通肯定句表达很多水，通常用后面要学的 a lot of water。' } },
  { type: 'classify', meaning: '很多书', wordIds: ['many', 'books'], focusWordId: 'books', dependsOn: [1], annotations: phrase(2), prompt: '表达很多书，为什么用 many books？', answer: 'count', options: [
   { id: 'mass', key: 'm', label: 'books 是不可数名词', feedback: 'book 在这里可以逐本计数，books 是复数。many 搭配可数名词复数；much 才搭配当前用法为不可数的名词。' },
   { id: 'count', key: 'c', label: 'books 是可数名词复数', feedback: 'many 后接可数名词复数，所以用 many books。判断依据是当前名词用法，不是物品看起来多不多。' }
  ] },
  { meaning: '很多（待接名词的数量片段）', wordIds: ['a', 'lot', 'of'], bankWordIds: ['a', 'lot', 'of'], dependsOn: [1, 2], replacesTrailIndexes: [1, 2], annotations: [span(0, 3, '数量表达')], learningNote: { term: '整体数量表达', question: '这三个词一起表达什么？', answer: 'a lot of：很多', explanation: 'a lot of 在这里作为整体表达很多，后面还要接名词。不要把 a 单独理解成一个水，也不能漏掉 of；这一片段不是完整句子。' } },
  { meaning: '很多水', wordIds: ['a', 'lot', 'of', 'water'], bankWordIds: ['a', 'lot', 'of', 'water'], dependsOn: [3], annotations: [span(0, 3, '数量表达'), span(0, 4, '名词短语', 1)], learningNote: { term: '数量片段合并', question: 'a lot of 后接什么？', answer: 'water，合成 a lot of water', explanation: 'a lot of water 表示很多水。a lot of 整体表示数量，water 保持不可数用法。普通肯定句中，这是自然、常见的表达。' } },
  { meaning: '我需要很多水', wordIds: ['i', 'need', 'a', 'lot', 'of', 'water'], bankWordIds: ['i', 'need', 'a', 'lot', 'of', 'water'], dependsOn: [4], annotations: clause(6), learningNote: { term: '整组作宾语', question: 'I need 什么？', answer: 'a lot of water', explanation: 'I 是主语，need 是谓语，整个 a lot of water 回答需要什么，一起作宾语。不是只有 water 才是整个宾语。' } },
  { type: 'classify', meaning: '很多书', wordIds: ['many', 'books'], focusWordId: 'books', dependsOn: [5], annotations: phrase(2), prompt: 'a lot of 能用于可数名词复数，表达很多书吗？', answer: 'both', options: [
   { id: 'massOnly', key: 'm', label: '不能，只能接不可数名词', feedback: 'a lot of 既可接不可数名词，也可接可数名词复数。a lot of water 和 a lot of books 都可以。' },
   { id: 'both', key: 'b', label: '能：a lot of books 也可以', feedback: 'many books 和 a lot of books 都表示很多书。a lot of 可用于这两类名词，但可数名词仍用复数 books。' }
  ] },
  { meaning: '很多书', wordIds: ['a', 'lot', 'of', 'books'], bankWordIds: ['a', 'lot', 'of', 'books'], dependsOn: [4, 6], annotations: [span(0, 3, '数量表达'), span(0, 4, '名词短语', 1)], learningNote: { term: '换对象，保留结构', question: '水换成书，哪个词要按可数形式表达？', answer: 'books 用复数', explanation: 'a lot of 不变，内容换成 books。书按本计数，很多本仍要用复数 books；不能因为前面有 a 就改成单数 book。' } },
  { meaning: '你需要很多书', wordIds: ['you', 'need', 'a', 'lot', 'of', 'books'], bankWordIds: ['you', 'need', 'a', 'lot', 'of', 'books'], dependsOn: [7], annotations: clause(6), successFeedback: '主语换成 You，整个 a lot of books 作宾语。数量表达保持整体，可数名词 books 用复数。' },
  { meaning: '牛奶', wordIds: ['milk'], bankWordIds: ['milk'], dependsOn: [8], clearSentenceResultOnComplete: true, annotations: [], learningNote: { term: '迁移到另一物质', question: '本课中的 milk 用什么用法？', answer: '表示牛奶这种物质，不可数', explanation: 'milk 在这里表示牛奶这种物质。表达很多时可以用 much milk；普通肯定句通常用 a lot of milk，不用 many milk。' } },
  { meaning: '很多牛奶', wordIds: ['a', 'lot', 'of', 'milk'], bankWordIds: ['a', 'lot', 'of', 'milk'], dependsOn: [9], annotations: [span(0, 3, '数量表达'), span(0, 4, '名词短语', 1)], learningNote: { term: '复用数量结构', question: '牛奶要加 s 吗？', answer: '这里不加，a lot of milk', explanation: '本课 milk 为不可数用法，换内容时保持原形。a lot of 作为整体接在 milk 前，表达很多牛奶。' } },
  { type: 'transfer', meaning: '你需要很多牛奶', wordIds: ['you', 'need', 'a', 'lot', 'of', 'milk'], dependsOn: [10], annotations: clause(6), answers: ['You need a lot of milk.', 'You need lots of milk.', 'You need much milk.'], successFeedback: 'milk 在这里是不可数用法，不能搭配 many。普通肯定句通常说 a lot of milk 或 lots of milk；much milk 语法上也可表达该数量意义，但这种普通肯定句中较少用。整个数量短语作宾语。' },
 ],
};
