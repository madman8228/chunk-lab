const span = (start, end, label) => ({ start, end, label, level: 0 });
const phrase = [span(0, 2, '名词短语')];
const sentence = [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 4, '宾语')];

export const quantity = {
  id: 'quantity-preview', label: 'PB05 · 一个与多个', knowledgeNode: 'PB05',
  prerequisites: ['PB04'], objectives: ['把数量与名词单复数连起来理解', '同时改变数量词和名词形式', '用另一物品复用规则并逆向还原'],
  words: {
    a: { en: 'a', zh: '一个', part: '冠词' }, two: { en: 'two', zh: '两个', part: '数词' },
    bag: { en: 'bag', zh: '包（单数）', part: '名词' }, bags: { en: 'bags', zh: '包（复数）', part: '名词' },
    book: { en: 'book', zh: '书（单数）', part: '名词' }, books: { en: 'books', zh: '书（复数）', part: '名词' },
    i: { en: 'I', zh: '我', part: '代词' }, need: { en: 'need', zh: '需要', part: '动词' }, you: { en: 'You', zh: '你', part: '代词' },
  },
  sentence: { wordIds: ['you', 'need', 'a', 'book'], zh: '你需要一本书。' },
  sequence: [
    { meaning: '一个包', wordIds: ['a', 'bag'], dependsOn: [], annotations: phrase },
    { meaning: '两个', wordIds: ['two'], dependsOn: [], annotations: [span(0, 1, '数量')] },
    { type: 'quantity', meaning: '两个包', sourceWordIds: ['a', 'bag'], wordIds: ['two', 'bags'], dependsOn: [0, 1], annotations: phrase,
      changes: [
        { index: 0, to: 'two', prompt: '从一个包变成两个包，先改表示数量的部分。', explanation: 'a 表示一个；two 表示两个。', options: [{ wordId: 'a', key: 'a' }, { wordId: 'two', key: 't' }], wrongFeedback: 'a 还是一个。这次要两个，请换成 two。' },
        { index: 1, to: 'bags', prompt: '数量变成两个，包的形式也要一起改。', explanation: '一个包用 bag；超过一个要用复数。bag 的复数是在末尾加 s：bags。', options: [{ wordId: 'bag', key: 'b' }, { wordId: 'bags', key: 's' }], wrongFeedback: 'two 已经表示两个，不能继续用单数 bag；这里要用 bags。' },
      ], successFeedback: 'a bag → two bags：数量从一个变两个，a 换成 two，bag 也变成 bags。两个变化要一起完成。' },
    { meaning: '我需要两个包', wordIds: ['i', 'need', 'two', 'bags'], dependsOn: [2], annotations: sentence },
    { meaning: '书', wordIds: ['book'], dependsOn: [], annotations: [span(0, 1, '名词')] },
    { meaning: '一本书', wordIds: ['a', 'book'], dependsOn: [4], annotations: phrase },
    { type: 'quantity', meaning: '两本书', sourceWordIds: ['a', 'book'], wordIds: ['two', 'books'], dependsOn: [2, 5], annotations: phrase,
      changes: [
        { index: 0, to: 'two', prompt: '换成两本书，先改数量。', explanation: '物品换成书，数量仍要从一个变两个。', options: [{ wordId: 'two', key: 't' }, { wordId: 'a', key: 'a' }], wrongFeedback: '这里需要两本，不是一本。' },
        { index: 1, to: 'books', prompt: '两本书，要用 book 还是 books？', explanation: '像 bag 一样，book 的复数也在末尾加 s。', options: [{ wordId: 'books', key: 's' }, { wordId: 'book', key: 'b' }], wrongFeedback: 'two 表示两个，book 也要改成复数 books。' },
      ], successFeedback: 'a book → two books：换了物品，数量词和名词形式仍然要对应。' },
    { meaning: '我需要两本书', wordIds: ['i', 'need', 'two', 'books'], dependsOn: [3, 6], annotations: sentence },
    { type: 'quantity', meaning: '我需要一本书', sourceWordIds: ['i', 'need', 'two', 'books'], wordIds: ['i', 'need', 'a', 'book'], dependsOn: [7], annotations: sentence,
      changes: [
        { index: 2, to: 'a', prompt: '现在改为只需要一本，先改数量。', explanation: '场景改为一个物品，I need 不变。', options: [{ wordId: 'two', key: 't' }, { wordId: 'a', key: 'a' }], wrongFeedback: 'two 仍是两本。这次只需要一本，请改成 a。' },
        { index: 3, to: 'book', prompt: '数量变成一个，名词也要还原。', explanation: 'a 后面这里要用单数 book，不能保留 books。', options: [{ wordId: 'books', key: 's' }, { wordId: 'book', key: 'b' }], wrongFeedback: 'a 表示一本，要与单数 book 配合。' },
      ], successFeedback: 'two books → a book：数量词和名词一起还原，I need 保持不变。' },
    { meaning: '你需要一本书', wordIds: ['you', 'need', 'a', 'book'], dependsOn: [8], annotations: sentence },
    { type: 'transfer', meaning: '你需要两个包', wordIds: ['you', 'need', 'two', 'bags'], dependsOn: [9], annotations: sentence, answers: ['You need two bags.'] },
  ],
};
