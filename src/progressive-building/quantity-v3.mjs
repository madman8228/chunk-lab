const span = (start, end, label) => ({ start, end, label, level: 0 });
const phrase = [span(0, 2, '名词短语')];
const sentence = [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 4, '宾语')];

export const quantity = {
  id: 'quantity-preview', label: 'PB05 · 一个与多个（已打磨）', knowledgeNode: 'PB05',
  sentenceStepIndexes: [3, 7, 9],
  prerequisites: ['PB04'], objectives: ['把数量与名词单复数连起来理解', '同时改变数量词和名词形式', '用另一物品复用规则并逆向还原'],
  words: {
    a: { en: 'a', zh: '一个', part: '冠词' }, two: { en: 'two', zh: '两个', part: '数词' },
    bag: { en: 'bag', zh: '包（单数）', part: '名词', visualSceneId: 'bag' }, bags: { en: 'bags', zh: '包（复数）', part: '名词', visualSceneId: 'bags' },
    book: { en: 'book', zh: '书（单数）', part: '名词', visualSceneId: 'book' }, books: { en: 'books', zh: '书（复数）', part: '名词', visualSceneId: 'books' },
    i: { en: 'I', zh: '我', part: '代词', visualSceneId: 'i' }, need: { en: 'need', zh: '需要', part: '动词' }, you: { en: 'You', zh: '你', part: '代词', visualSceneId: 'you' },
  },
  sentence: { wordIds: ['you', 'need', 'a', 'book'], zh: '你需要一本书。' },
  sequence: [
    { meaning: '一个包', wordIds: ['a', 'bag'], bankWordIds: ['a', 'bag'], dependsOn: [], annotations: phrase, visual: { sceneId: 'bag', show: 'after-correct' }, learningNote: { term: '单数', question: '有几个包？', answer: '一个', explanation: '包是能一个个数的东西。说一个包时，名词用表示一个的形式，叫单数：bag。a bag 就是一个包。' } },
    { meaning: '两个', wordIds: ['two'], bankWordIds: ['two'], dependsOn: [0], replacesTrailIndexes: [0], annotations: [span(0, 1, '数量')] },
    { type: 'quantity', meaning: '两个包', sourceWordIds: ['a', 'bag'], wordIds: ['two', 'bags'], dependsOn: [0, 1], annotations: phrase, visual: { sceneId: 'bags', show: 'after-correct' },
      changes: [
        { index: 0, to: 'two', prompt: '从一个包变成两个包，先改表示数量的部分。', explanation: 'a 表示一个；two 表示两个。', options: [{ wordId: 'a', key: 'a' }, { wordId: 'two', key: 't' }], wrongFeedback: 'a 还是一个。这次要两个，请换成 two。' },
        { index: 1, to: 'bags', prompt: '数量变成两个，包的形式也要一起改。', explanation: 'bag 是可数名词，表示能一个个数的东西。表示一个时，名词用单数：bag；表示两个及以上时，用复数。bag 的复数在末尾加 s，变成 bags。', options: [{ wordId: 'bag', key: 'b' }, { wordId: 'bags', key: 's' }], wrongFeedback: '你选的 bag 是单数，表示一个包；题目要两个包。可数名词表示两个及以上时要用复数，bag 加 s 变成 bags，所以数量 two 要与 bags 配合。' },
      ], successFeedback: 'a bag → two bags：数量从一个变两个，a 换成 two，bag 也变成 bags。两个变化要一起完成。' },
    { meaning: '我需要两个包', wordIds: ['i', 'need', 'two', 'bags'], bankWordIds: ['i', 'need', 'two', 'bags'], dependsOn: [2], annotations: sentence, visual: { sceneId: 'i-need-two-bags', show: 'after-correct' }, learningNote: { term: '数量与复数', question: '我需要什么？', answer: 'two bags（两个包）', explanation: 'I need 不变，整个 two bags 作宾语。two 表示两个，bags 是包的复数；不能说 two bag，也不在 two 前保留 a。' } },
    { meaning: '书', wordIds: ['book'], bankWordIds: ['book'], dependsOn: [], clearSentenceResultOnComplete: true, annotations: [] },
    { meaning: '一本书', wordIds: ['a', 'book'], bankWordIds: ['a', 'book'], dependsOn: [4], replacesTrailIndexes: [4], annotations: phrase, visual: { sceneId: 'book', show: 'after-correct' } },
    { type: 'quantity', meaning: '两本书', sourceWordIds: ['a', 'book'], wordIds: ['two', 'books'], dependsOn: [2, 5], annotations: phrase, visual: { sceneId: 'books', show: 'after-correct' },
      changes: [
        { index: 0, to: 'two', prompt: '换成两本书，先改数量。', explanation: '物品换成书，数量仍要从一个变两个。', options: [{ wordId: 'two', key: 't' }, { wordId: 'a', key: 'a' }], wrongFeedback: '这里需要两本，不是一本。' },
        { index: 1, to: 'books', prompt: '两本书，要用 book 还是 books？', explanation: '书也能一本本数。一本用单数 book；两本及以上用复数 books。book 和 bag 一样，在末尾加 s 构成复数。', options: [{ wordId: 'books', key: 's' }, { wordId: 'book', key: 'b' }], wrongFeedback: 'book 是表示一本的单数；这里要两本，属于两个及以上，要用复数 books。数量变了，名词形式也要相应变化。' },
      ], successFeedback: 'a book → two books：换了物品，数量词和名词形式仍然要对应。' },
    { meaning: '我需要两本书', wordIds: ['i', 'need', 'two', 'books'], bankWordIds: ['i', 'need', 'two', 'books'], dependsOn: [3, 6], annotations: sentence, visual: { sceneId: 'i-need-two-books', show: 'after-correct' }, learningNote: { term: '迁移到另一物品', question: '两本书怎样表达？', answer: 'two books', explanation: 'book 的复数是 books，整个 two books 作 need 的宾语。本课 bag、book 的复数加 s；不能据此认为所有名词都只加 s。' } },
    { type: 'quantity', meaning: '一本书', sourceWordIds: ['two', 'books'], wordIds: ['a', 'book'], dependsOn: [7], annotations: phrase, clearSentenceResultOnComplete: true, visual: { sceneId: 'book', show: 'after-correct' },
      changes: [
        { index: 0, to: 'a', prompt: '现在改为只需要一本，先改数量。', explanation: '只需要一本，先把数量改为一个。', options: [{ wordId: 'two', key: 't' }, { wordId: 'a', key: 'a' }], wrongFeedback: 'two 仍是两本。这次只需要一本，请改成 a。' },
        { index: 1, to: 'book', prompt: '数量变成一个，名词也要还原。', explanation: '现在只剩一本，不再是两个及以上，所以名词要从复数 books 还原为单数 book，和表示一个的 a 配合。', options: [{ wordId: 'books', key: 's' }, { wordId: 'book', key: 'b' }], wrongFeedback: 'books 是表示多本的复数；现在只要一本，应还原为表示一个的单数 book。a book 才表示一本书。' },
      ], successFeedback: 'two books → a book：数量词和名词一起还原，不能说 a books。' },
    { meaning: '你需要一本书', wordIds: ['you', 'need', 'a', 'book'], bankWordIds: ['you', 'need', 'a', 'book'], dependsOn: [8], annotations: sentence, visual: { sceneId: 'you-need-book', show: 'after-correct' } },
    { type: 'transfer', meaning: '你需要两个包', wordIds: ['you', 'need', 'two', 'bags'], dependsOn: [9], annotations: sentence, answers: ['You need two bags.'], visual: { sceneId: 'you-need-two-bags', show: 'after-correct' }, successFeedback: 'You 是主语，need 是谓语；整个 two bags 作宾语。two 与复数 bags 配合，不用 a。' },
  ],
};
