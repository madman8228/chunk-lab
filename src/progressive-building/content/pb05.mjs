const makeCourse = ({ id, subgoalId, title, tokens, steps, reviewStep }) => ({
  schemaVersion: 'progressive-building/3', id, version: 1, knowledgeNode: 'PB05',
  subgoalIds: [subgoalId], prerequisites: ['PB04'], title, tokens, steps,
  review: { intervalsDays: [1, 3], stepIds: [reviewStep] },
});

const articleTokens = [
  { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' },
  { id: 'need', text: 'need', kind: 'word', gloss: '需要', partOfSpeech: '动词' },
  { id: 'a', text: 'a', kind: 'word', gloss: '一个', partOfSpeech: '限定词' },
  { id: 'an', text: 'an', kind: 'word', gloss: '一个', partOfSpeech: '限定词' },
  { id: 'useful', text: 'useful', kind: 'word', gloss: '有用的', partOfSpeech: '形容词' },
  { id: 'university', text: 'university', kind: 'word', gloss: '大学', partOfSpeech: '名词' },
  { id: 'hour', text: 'hour', kind: 'word', gloss: '小时', partOfSpeech: '名词' },
  { id: 'apple', text: 'apple', kind: 'word', gloss: '苹果', partOfSpeech: '名词' },
  { id: 'book', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
];

const referenceTokens = [
  { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' },
  { id: 'see', text: 'see', kind: 'word', gloss: '看见', partOfSpeech: '动词' },
  { id: 'a1', text: 'a', kind: 'word', gloss: '一只', partOfSpeech: '限定词' },
  { id: 'dog1', text: 'dog', kind: 'word', gloss: '狗', partOfSpeech: '名词' },
  { id: 'period1', text: '.', kind: 'punctuation' },
  { id: 'the', text: 'the', kind: 'word', gloss: '那只', partOfSpeech: '限定词' },
  { id: 'a2', text: 'a', kind: 'word', gloss: '一只', partOfSpeech: '限定词' },
  { id: 'dog2', text: 'dog', kind: 'word', gloss: '狗', partOfSpeech: '名词' },
  { id: 'runs', text: 'runs', kind: 'word', gloss: '跑', partOfSpeech: '动词' },
  { id: 'cat1', text: 'cat', kind: 'word', gloss: '猫', partOfSpeech: '名词' },
  { id: 'cat2', text: 'cat', kind: 'word', gloss: '猫', partOfSpeech: '名词' },
  { id: 'is', text: 'is', kind: 'word', gloss: '是', partOfSpeech: '动词' },
  { id: 'asleep', text: 'asleep', kind: 'word', gloss: '睡着的', partOfSpeech: '形容词' },
  { id: 'period2', text: '.', kind: 'punctuation' },
];

const pluralTokens = [
  { id: 'one', text: 'one', kind: 'word', gloss: '一本/一个', partOfSpeech: '数词' },
  { id: 'two', text: 'two', kind: 'word', gloss: '两本/两个', partOfSpeech: '数词' },
  { id: 'book', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
  { id: 'books', text: 'books', kind: 'word', gloss: '书', partOfSpeech: '名词', lemma: 'book', inflection: 'plural' },
  { id: 'child', text: 'child', kind: 'word', gloss: '孩子', partOfSpeech: '名词' },
  { id: 'children', text: 'children', kind: 'word', gloss: '孩子', partOfSpeech: '名词', lemma: 'child', inflection: 'irregular-plural' },
  { id: 'foot', text: 'foot', kind: 'word', gloss: '脚', partOfSpeech: '名词' },
  { id: 'feet', text: 'feet', kind: 'word', gloss: '脚', partOfSpeech: '名词', lemma: 'foot', inflection: 'irregular-plural' },
  { id: 'one2', text: 'one', kind: 'word', gloss: '一个', partOfSpeech: '数词' },
  { id: 'one3', text: 'one', kind: 'word', gloss: '一只', partOfSpeech: '数词' },
  { id: 'two2', text: 'two', kind: 'word', gloss: '两个', partOfSpeech: '数词' },
  { id: 'two3', text: 'two', kind: 'word', gloss: '两只', partOfSpeech: '数词' },
  { id: 'comma1', text: ',', kind: 'punctuation' },
  { id: 'comma2', text: ',', kind: 'punctuation' },
  { id: 'comma3', text: ',', kind: 'punctuation' },
  { id: 'semicolon', text: ';', kind: 'punctuation' },
  { id: 'semicolon2', text: ';', kind: 'punctuation' },
];

const quantityTokens = [
  { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' },
  { id: 'i2', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' },
  { id: 'need', text: 'need', kind: 'word', gloss: '需要', partOfSpeech: '动词' },
  { id: 'need2', text: 'need', kind: 'word', gloss: '需要', partOfSpeech: '动词' },
  { id: 'a', text: 'a', kind: 'word', gloss: '一本', partOfSpeech: '限定词' },
  { id: 'book', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
  { id: 'some', text: 'some', kind: 'word', gloss: '一些', partOfSpeech: '限定词' },
  { id: 'water', text: 'water', kind: 'word', gloss: '水', partOfSpeech: '名词', countability: 'uncountable' },
  { id: 'friends', text: 'friends', kind: 'word', gloss: '朋友', partOfSpeech: '名词', lemma: 'friend', inflection: 'plural' },
  { id: 'two', text: 'two', kind: 'word', gloss: '两本', partOfSpeech: '数词' },
  { id: 'milk', text: 'milk', kind: 'word', gloss: '牛奶', partOfSpeech: '名词', countability: 'uncountable' },
  { id: 'period1', text: '.', kind: 'punctuation' },
  { id: 'period2', text: '.', kind: 'punctuation' },
];

const determinerTokens = [
  { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' },
  { id: 'have', text: 'have', kind: 'word', gloss: '有', partOfSpeech: '动词' },
  { id: 'many', text: 'many', kind: 'word', gloss: '很多', partOfSpeech: '限定词' },
  { id: 'much', text: 'much', kind: 'word', gloss: '很多', partOfSpeech: '限定词' },
  { id: 'books', text: 'books', kind: 'word', gloss: '书', partOfSpeech: '名词', lemma: 'book', inflection: 'plural' },
  { id: 'friends', text: 'friends', kind: 'word', gloss: '朋友', partOfSpeech: '名词', lemma: 'friend', inflection: 'plural' },
  { id: 'some', text: 'some', kind: 'word', gloss: '一些', partOfSpeech: '限定词' },
  { id: 'water', text: 'water', kind: 'word', gloss: '水', partOfSpeech: '名词', countability: 'uncountable' },
  { id: 'period', text: '.', kind: 'punctuation' },
];

const plain = (role, ids) => ({ id: role, role, segments: [ids], level: 0 });

export const courses = [
  makeCourse({
    id: 'pb05-article-sound-v1', subgoalId: 'PB05.a', title: 'a / an：听开头的音', tokens: articleTokens, reviewStep: 'pb05a-transfer',
    steps: [
      { id: 'pb05a-teach', activity: 'teach', phase: 'introduction', meaning: '一本有用的书', targetTokenIds: ['a', 'useful', 'book'], focusTokenIds: ['a', 'useful'], explanation: 'a / an 看后面单词的开头发音，不只看字母。useful 的 u 发 /j/，开头是辅音音，所以说 a useful book。', coverage: ['PB05.a'] },
      { id: 'pb05a-university', activity: 'transform', phase: 'practice', meaning: '一所大学', targetTokenIds: ['a', 'university'], sourceTokenIds: ['an', 'university'], focusTokenIds: ['an'], operations: [{ type: 'replace', from: ['an'], to: ['a'], key: 'a', explanation: 'university 的 u 发 /j/，听起来以辅音音开头，因此用 a。' }], coverage: ['PB05.a'] },
      { id: 'pb05a-hour-teach', activity: 'teach', phase: 'introduction', meaning: '一小时', targetTokenIds: ['an', 'hour'], focusTokenIds: ['an', 'hour'], explanation: 'hour 的 h 不发音，开头听到元音音 /aʊ/，所以用 an hour。字母 h 并不决定冠词。', coverage: ['PB05.a'] },
      { id: 'pb05a-hour', activity: 'transform', phase: 'practice', meaning: '一小时', targetTokenIds: ['an', 'hour'], sourceTokenIds: ['a', 'hour'], focusTokenIds: ['a'], operations: [{ type: 'replace', from: ['a'], to: ['an'], key: 'a', explanation: 'h 不发音，hour 以元音音开头；把 a 改为 an。' }], coverage: ['PB05.a'] },
      { id: 'pb05a-transfer', activity: 'independent-output', phase: 'transfer', meaning: '我需要一个苹果', targetTokenIds: ['i', 'need', 'an', 'apple'], acceptedAnswers: ['I need an apple.'], revealTarget: false, hideHistory: true, coverage: ['PB05.a'] },
    ],
  }),
  makeCourse({
    id: 'pb05-known-reference-v1', subgoalId: 'PB05.b', title: 'the：说回已经知道的对象', tokens: referenceTokens, reviewStep: 'pb05b-transfer',
    steps: [
      { id: 'pb05b-teach', activity: 'teach', phase: 'introduction', meaning: '我看见一只狗；那只狗在跑', targetTokenIds: ['i', 'see', 'a1', 'dog1', 'period1', 'the', 'dog2', 'runs', 'period2'], focusTokenIds: ['a1', 'dog1', 'the', 'dog2'], explanation: '先说 a dog：听者还不知道是哪只。第二句说回同一只狗，已经有明确所指，用 the dog。the 取决于共同语境，不是名词自带的标签。', syntax: [plain('主语', ['i']), plain('谓语', ['see']), { id: 'first-object', role: '宾语', segments: [['a1', 'dog1']], level: 0, headIds: ['dog1'] }, { id: 'known-subject', role: '主语', segments: [['the', 'dog2']], level: 0, headIds: ['dog2'] }, plain('谓语2', ['runs'])], coverage: ['PB05.b'] },
      { id: 'pb05b-choose', activity: 'transform', phase: 'practice', meaning: '我看见一只狗；同一只狗在跑', targetTokenIds: ['i', 'see', 'a1', 'dog1', 'period1', 'the', 'dog2', 'runs', 'period2'], sourceTokenIds: ['i', 'see', 'a1', 'dog1', 'period1', 'a2', 'dog2', 'runs', 'period2'], focusTokenIds: ['a2'], operations: [{ type: 'replace', from: ['a2'], to: ['the'], key: 't', explanation: '第二次提到的 dog 指向前句那只狗，把 a 换成 the。' }], syntax: [plain('主语', ['i']), plain('谓语', ['see']), { id: 'first-object', role: '宾语', segments: [['a1', 'dog1']], level: 0, headIds: ['dog1'] }, { id: 'known-subject', role: '主语', segments: [['the', 'dog2']], level: 0, headIds: ['dog2'] }, plain('谓语2', ['runs'])], coverage: ['PB05.b'] },
      { id: 'pb05b-transfer', activity: 'independent-output', phase: 'transfer', meaning: '我看见一只猫；那只猫睡着了', targetTokenIds: ['i', 'see', 'cat1', 'the', 'cat2', 'is', 'asleep'], acceptedAnswers: ['I see a cat. The cat is asleep.'], revealTarget: false, hideHistory: true, coverage: ['PB05.b'] },
    ],
  }),
  makeCourse({
    id: 'pb05-plural-forms-v1', subgoalId: 'PB05.c', title: '复数：规则变化与常见不规则变化', tokens: pluralTokens, reviewStep: 'pb05c-transfer',
    steps: [
      { id: 'pb05c-teach', activity: 'teach', phase: 'introduction', meaning: '一个和多个', targetTokenIds: ['one', 'book', 'comma1', 'two', 'books', 'semicolon', 'one2', 'child', 'comma2', 'two2', 'children', 'semicolon2', 'one3', 'foot', 'comma3', 'two3', 'feet'], focusTokenIds: ['book', 'books', 'child', 'children', 'foot', 'feet'], explanation: '可数名词从一个变多个，普通情况下加 -s：book → books。常见不规则形式要单独记：child → children，foot → feet。', coverage: ['PB05.c'] },
      { id: 'pb05c-regular', activity: 'transform', phase: 'practice', meaning: '两本书', targetTokenIds: ['two', 'books'], sourceTokenIds: ['two', 'book'], focusTokenIds: ['book'], operations: [{ type: 'replace', from: ['book'], to: ['books'], key: 'b', explanation: 'two 表示多个；规则名词 book 加 -s，成为 books。' }], coverage: ['PB05.c'] },
      { id: 'pb05c-irregular', activity: 'transform', phase: 'practice', meaning: '两个孩子', targetTokenIds: ['two', 'children'], sourceTokenIds: ['two', 'child'], focusTokenIds: ['child'], operations: [{ type: 'replace', from: ['child'], to: ['children'], key: 'c', explanation: 'child 的复数不是 childs，而是 children。' }], coverage: ['PB05.c'] },
      { id: 'pb05c-transfer', activity: 'independent-output', phase: 'transfer', meaning: '两只脚', targetTokenIds: ['two', 'feet'], acceptedAnswers: ['Two feet.'], revealTarget: false, hideHistory: true, coverage: ['PB05.c'] },
    ],
  }),
  makeCourse({
    id: 'pb05-countability-v1', subgoalId: 'PB05.d', title: '可数与不可数：数量表达', tokens: quantityTokens, reviewStep: 'pb05d-transfer',
    steps: [
      { id: 'pb05d-teach', activity: 'teach', phase: 'introduction', meaning: '我需要一本书；我需要一些水', targetTokenIds: ['i', 'need', 'a', 'book', 'period1', 'i2', 'need2', 'some', 'water', 'period2'], focusTokenIds: ['a', 'book', 'some', 'water'], explanation: 'book 可以按一本、两本来数；water 通常当作整体物质，不直接说 two water。需要表达一些水时，用 some water。', coverage: ['PB05.d'] },
      { id: 'pb05d-quantity', activity: 'transform', phase: 'practice', meaning: '我需要一些水', targetTokenIds: ['i', 'need', 'some', 'water'], sourceTokenIds: ['i', 'need', 'two', 'water'], focusTokenIds: ['two'], operations: [{ type: 'replace', from: ['two'], to: ['some'], key: 's', explanation: '这里的 water 不按一份一份直接计数；把 two 换成适合不可数名词的 some。' }], coverage: ['PB05.d'] },
      { id: 'pb05d-local', activity: 'compose', phase: 'practice', meaning: '一些水', targetTokenIds: ['some', 'water'], bankTokenIds: ['some', 'water'], dependsOn: ['pb05d-quantity'], coverage: ['PB05.d'] },
      { id: 'pb05d-transfer', activity: 'independent-output', phase: 'transfer', meaning: '我需要一些牛奶', targetTokenIds: ['i', 'need', 'some', 'milk'], dependsOn: ['pb05d-local'], acceptedAnswers: ['I need some milk.'], revealTarget: false, hideHistory: true, coverage: ['PB05.d'] },
    ],
  }),
  makeCourse({
    id: 'pb05-quantity-determiners-v1', subgoalId: 'PB05.e', title: '数量限定：many 与 much', tokens: determinerTokens, reviewStep: 'pb05e-transfer',
    steps: [
      { id: 'pb05e-teach', activity: 'teach', phase: 'introduction', meaning: '很多书；一些水', targetTokenIds: ['many', 'books', 'some', 'water'], focusTokenIds: ['many', 'books', 'some', 'water'], explanation: 'many 后接可数名词复数，如 many books；much 常用于不可数名词，some 可表示不确定数量。选数量词要看名词的数量表达方式。', coverage: ['PB05.e'] },
      { id: 'pb05e-local', activity: 'compose', phase: 'practice', meaning: '很多书', targetTokenIds: ['many', 'books'], bankTokenIds: ['many', 'books'], dependsOn: ['pb05e-teach'], coverage: ['PB05.e'] },
      { id: 'pb05e-sentence', activity: 'compose', phase: 'practice', meaning: '我有很多书', targetTokenIds: ['i', 'have', 'many', 'books', 'period'], bankTokenIds: ['i', 'have', 'many', 'books'], dependsOn: ['pb05e-local'], syntax: [plain('主语', ['i']), plain('谓语', ['have']), { id: 'object', role: '宾语', segments: [['many', 'books']], level: 0, headIds: ['books'], modifiesIds: ['many'] }], coverage: ['PB05.e'] },
      { id: 'pb05e-select', activity: 'transform', phase: 'practice', meaning: '我有很多书', targetTokenIds: ['i', 'have', 'many', 'books'], sourceTokenIds: ['i', 'have', 'much', 'books'], focusTokenIds: ['much'], operations: [{ type: 'replace', from: ['much'], to: ['many'], key: 'm', explanation: 'books 是可数名词复数，这里用 many books；much 不和这个复数名词搭配。' }], coverage: ['PB05.e'] },
      { id: 'pb05e-transfer', activity: 'independent-output', phase: 'transfer', meaning: '我有很多朋友', targetTokenIds: ['i', 'have', 'many', 'friends'], acceptedAnswers: ['I have many friends.'], revealTarget: false, hideHistory: true, coverage: ['PB05.e'] },
    ],
  }),
];
