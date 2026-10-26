const span = (start, end, label) => ({ start, end, label, level: 0 });
const phrase = [span(0, 2, '名词短语')];
const clause = [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 4, '宾语')];
export const articleSound = {
  id: 'article-sound-preview', label: 'PB05 · a / an 与发音（已打磨）', knowledgeNode: 'PB05',
  prerequisites: ['PB04'], objectives: ['根据紧接着的发音选择a或an', '理解元音音与辅音音的区别', '将冠词选择迁移到带定语的短语'],
  sentenceStepIndexes: [4, 11],
  words: {
    i: { en: 'I', zh: '我', part: '代词', visualSceneId: 'i' }, you: { en: 'You', zh: '你', part: '代词', visualSceneId: 'you' },
    need: { en: 'need', zh: '需要', part: '动词' }, a: { en: 'a', zh: '一个', part: '冠词' }, an: { en: 'an', zh: '一个', part: '冠词' },
    book: { en: 'book', zh: '书', part: '名词', visualSceneId: 'book' }, apple: { en: 'apple', zh: '苹果', part: '名词', visualSceneId: 'apple' },
    hour: { en: 'hour', zh: '小时', part: '名词' }, red: { en: 'red', zh: '红色的', part: '形容词', visualSceneId: 'red' },
  },
  sentence: { wordIds: ['you', 'need', 'an', 'apple'], zh: '你需要一个苹果。' },
  sequence: [
    { meaning: '书', wordIds: ['book'], bankWordIds: ['book'], dependsOn: [], annotations: [], pronunciation: { text: 'book', ipa: '/bʊk/' } },
    { meaning: '一本书', wordIds: ['a', 'book'], bankWordIds: ['a', 'book'], dependsOn: [0], replacesTrailIndexes: [0], annotations: phrase, pronunciation: { text: 'a book', ipa: '/ə bʊk/' }, visual: { sceneId: 'book', show: 'after-correct' }, learningNote: { term: 'a 与辅音音', question: 'book 开头听到什么音？', answer: '/b/，用 a book', explanation: 'a 和 an 都可表示一个。发音时，气流受到嘴唇、舌头等阻碍的音叫辅音音；book 开头的 /b/ 是双唇先合拢再放开的音。紧接着辅音音时用 a。' } },
    { meaning: '苹果', wordIds: ['apple'], bankWordIds: ['apple'], dependsOn: [1], replacesTrailIndexes: [1], annotations: [], pronunciation: { text: 'apple', ipa: '/ˈæpəl/' } },
    { meaning: '一个苹果', wordIds: ['an', 'apple'], bankWordIds: ['apple', 'an'], dependsOn: [2], replacesTrailIndexes: [2], annotations: phrase, pronunciation: { text: 'an apple', ipa: '/ən ˈæpəl/' }, visual: { sceneId: 'apple', show: 'after-correct' }, learningNote: { term: 'an 与元音音', question: 'apple 开头听到什么音？', answer: '/æ/，用 an apple', explanation: '发音时，气流从口腔较通畅地发出的音叫元音音。apple 开头是元音音 /æ/，紧接着元音音时用 an。这是发音规则，不是看字母就能决定。' } },
    { meaning: '我需要一个苹果', wordIds: ['i', 'need', 'an', 'apple'], bankWordIds: ['i', 'need', 'apple', 'an'], dependsOn: [3], annotations: clause, visual: { sceneId: 'i-need-apple', show: 'after-correct' }, successFeedback: '整个 an apple 作 need 的宾语。an 表示一个，后面紧接 apple 的元音音 /æ/。' },
    { type: 'classify', meaning: '一本书', wordIds: ['book'], focusWordId: 'book', dependsOn: [4], annotations: [], prompt: 'book 前表示“一本”，选 a 还是 an？', pronunciation: { text: 'book', ipa: '/bʊk/' }, answer: 'a', options: [
      { id: 'an', key: 'n', label: 'an', feedback: 'an 用在紧接元音音时。book 开头的 /b/ 是辅音音，双唇先合拢再放开，所以这里用 a book。' },
      { id: 'a', key: 'a', label: 'a', feedback: 'book 开头的 /b/ 是辅音音，所以用 a book。判断的是发音。' },
    ] },
    { meaning: '小时', wordIds: ['hour'], bankWordIds: ['hour'], dependsOn: [5], replacesTrailIndexes: [5], clearSentenceResultOnComplete: true, annotations: [], pronunciation: { text: 'hour', ipa: '/ˈaʊər/（美式）' }, learningNote: { term: '字母不等于发音', question: 'hour 的 h 发音吗？', answer: '不发音，开头直接是 /aʊ/', explanation: 'hour 表示小时。它虽然写着 h，朗读时 h 不发音，开头听到的是元音音 /aʊ/。选择冠词时要听这个音。' } },
    { type: 'classify', meaning: '一小时', wordIds: ['hour'], focusWordId: 'hour', dependsOn: [6], annotations: [], prompt: 'hour 前表示“一小时”，选哪个冠词？', pronunciation: { text: 'hour', ipa: '/ˈaʊər/（美式）' }, answer: 'an', options: [
      { id: 'a', key: 'a', label: 'a', feedback: '不能只看字母 h。hour 的 h 不发音，开头是元音音 /aʊ/，所以要用 an hour。' },
      { id: 'an', key: 'n', label: 'an', feedback: 'hour 以元音音 /aʊ/ 开头，所以用 an hour；字母 h 不决定冠词。' },
    ] },
    { meaning: '一小时', wordIds: ['an', 'hour'], bankWordIds: ['an', 'hour'], dependsOn: [6, 7], replacesTrailIndexes: [6, 7], annotations: phrase, pronunciation: { text: 'an hour', ipa: '/ən ˈaʊər/' }, learningNote: { term: '按发音选择', question: '为什么不是 a hour？', answer: 'h 不发音，紧接元音音', explanation: 'an hour 表示一小时。冠词紧接着的是 /aʊ/，因此用 an。' } },
    { meaning: '一个红色的苹果', wordIds: ['a', 'red', 'apple'], bankWordIds: ['apple', 'red', 'a'], dependsOn: [3, 8], replacesTrailIndexes: [8], annotations: [span(1, 2, '定语'), { start: 0, end: 3, label: '名词短语', level: 1 }], pronunciation: { text: 'a red apple', ipa: '/ə red ˈæpəl/' }, visual: { sceneId: 'apple', show: 'after-correct' }, learningNote: { term: '听紧接着的词', question: '冠词后紧接 red 还是 apple？', answer: 'red 的 /r/，所以用 a', explanation: 'red 修饰 apple。加入 red 后，冠词紧接的是辅音音 /r/，所以说 a red apple。不能隔过 red，只根据 apple 选择 an。' } },
    { type: 'classify', meaning: '一个红色的苹果', wordIds: ['a', 'red', 'apple'], focusWordId: 'red', dependsOn: [9], annotations: [], prompt: 'a red apple 为什么用 a？', pronunciation: { text: 'red', ipa: '/red/' }, answer: 'nextSound', options: [
      { id: 'nounLetter', key: 'l', label: '只看 apple 的首字母', feedback: '冠词后紧接的是 red，不能跳过它只看 apple。red 开头是辅音音 /r/，所以用 a。' },
      { id: 'nextSound', key: 's', label: '紧接着 red 的辅音音 /r/', feedback: 'a/an 根据后面紧接着的发音选择。red 以 /r/ 开头，所以是 a red apple。' },
    ] },
    { meaning: '你需要一个苹果', wordIds: ['you', 'need', 'an', 'apple'], bankWordIds: ['you', 'need', 'apple', 'an'], dependsOn: [10], annotations: clause, visual: { sceneId: 'you-need-apple', show: 'after-correct' }, successFeedback: 'You 是主语，整个 an apple 是宾语。人物变化不改变 apple 开头的发音，仍用 an。' },
    { type: 'transfer', meaning: '你需要一个红色的苹果', wordIds: ['you', 'need', 'a', 'red', 'apple'], dependsOn: [11], annotations: [span(0, 1, '主语'), span(1, 2, '谓语'), span(3, 4, '定语'), { start: 2, end: 5, label: '宾语', level: 1 }], answers: ['You need a red apple.'], visual: { sceneId: 'you-need-apple', show: 'after-correct' }, successFeedback: '整个 a red apple 是宾语，red 修饰 apple。冠词紧接 red 的辅音音 /r/，所以用 a。' },
  ],
};
