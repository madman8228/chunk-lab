export const lesson = {
  schemaVersion: 'progressive-building/3',
  id: 'pb02-subject-verb-object-v1',
  version: 1,
  knowledgeNode: 'PB02',
  subgoalIds: ['PB02.a', 'PB02.b', 'PB02.c'],
  prerequisites: ['PB01'],
  title: '动作涉及什么',
  tokens: [
    { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' },
    { id: 'you', text: 'You', kind: 'word', gloss: '你', partOfSpeech: '代词' },
    { id: 'they', text: 'They', kind: 'word', gloss: '他们', partOfSpeech: '代词' },
    { id: 'like', text: 'like', kind: 'word', gloss: '喜欢', partOfSpeech: '动词' },
    { id: 'tea', text: 'tea', kind: 'word', gloss: '茶', partOfSpeech: '名词' },
    { id: 'coffee', text: 'coffee', kind: 'word', gloss: '咖啡', partOfSpeech: '名词' },
    { id: 'my', text: 'my', kind: 'word', gloss: '我的', partOfSpeech: '限定词' },
    { id: 'books', text: 'books', kind: 'word', gloss: '书', partOfSpeech: '名词', lemma: 'book', inflection: 'plural' },
  ],
  steps: [
    { id: 'pb02-local-object', activity: 'compose', phase: 'introduction', meaning: '茶', targetTokenIds: ['tea'], bankTokenIds: ['tea'], coverage: ['PB02.a'] },
    {
      id: 'pb02-build-sentence', activity: 'compose', phase: 'introduction', meaning: '我喜欢茶',
      targetTokenIds: ['i', 'like', 'tea'], bankTokenIds: ['i', 'like', 'tea'], dependsOn: ['pb02-local-object'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['like']], level: 0 },
        { id: 'o', role: '宾语', segments: [['tea']], level: 0 },
      ], coverage: ['PB02.a'],
    },
    {
      id: 'pb02-explain-object', activity: 'teach', phase: 'introduction', meaning: '我喜欢茶',
      targetTokenIds: ['i', 'like', 'tea'], focusTokenIds: ['like', 'tea'], dependsOn: ['pb02-build-sentence'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['like']], level: 0 },
        { id: 'o', role: '宾语', segments: [['tea']], level: 0 },
      ],
      explanation: '在 I like tea 里，I 是谁在喜欢，like 说做什么；tea 是“喜欢什么”的答案，是动作涉及的对象，所以在句中作宾语。',
      coverage: ['PB02.a'],
    },
    {
      id: 'pb02-identify-object', activity: 'range-identify', phase: 'practice', meaning: '宾语',
      targetTokenIds: ['i', 'like', 'tea'], bankTokenIds: ['i', 'like', 'tea'], sourceTokenIds: ['i', 'like', 'tea'], focusSyntaxId: 'o', dependsOn: ['pb02-explain-object'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['like']], level: 0 },
        { id: 'o', role: '宾语', segments: [['tea']], level: 0 },
      ], coverage: ['PB02.a'],
    },
    {
      id: 'pb02-change-object', activity: 'transform', phase: 'practice', meaning: '我喜欢咖啡',
      instruction: '把 tea 换成 coffee。',
      targetTokenIds: ['i', 'like', 'coffee'], sourceTokenIds: ['i', 'like', 'tea'], focusTokenIds: ['tea'], dependsOn: ['pb02-identify-object'],
      operations: [{ type: 'replace', from: ['tea'], to: ['coffee'], key: 'c', explanation: 'I 和 like 不变，只把“喜欢什么”从 tea 换成 coffee；变化的是宾语内容。' }],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['like']], level: 0 },
        { id: 'o', role: '宾语', segments: [['coffee']], level: 0 },
      ], coverage: ['PB02.a', 'PB02.c'],
    },
    { id: 'pb02-local-object-phrase', activity: 'compose', phase: 'introduction', meaning: '我的书', targetTokenIds: ['my', 'books'], bankTokenIds: ['my', 'books'], dependsOn: ['pb02-change-object'], coverage: ['PB02.b'] },
    {
      id: 'pb02-build-full-object', activity: 'compose', phase: 'practice', meaning: '我喜欢我的书',
      targetTokenIds: ['i', 'like', 'my', 'books'], bankTokenIds: ['i', 'like', 'my', 'books'], dependsOn: ['pb02-local-object-phrase'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['like']], level: 0 },
        { id: 'o', role: '宾语', segments: [['my', 'books']], level: 0, headIds: ['books'], modifiesIds: ['my'] },
      ], coverage: ['PB02.b'],
    },
    {
      id: 'pb02-explain-full-object', activity: 'teach', phase: 'introduction', meaning: '我喜欢我的书',
      targetTokenIds: ['i', 'like', 'my', 'books'], focusTokenIds: ['my', 'books'], dependsOn: ['pb02-build-full-object'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['like']], level: 0 },
        { id: 'o', role: '宾语', segments: [['my', 'books']], level: 0, headIds: ['books'], modifiesIds: ['my'] },
      ],
      explanation: '在 I like my books 里，动作涉及的不是单独一个词，而是 my books 整组；它一起回答“我喜欢什么”，整体作宾语。',
      coverage: ['PB02.b'],
    },
    {
      id: 'pb02-identify-full-object', activity: 'range-identify', phase: 'practice', meaning: '完整宾语',
      targetTokenIds: ['i', 'like', 'my', 'books'], bankTokenIds: ['i', 'like', 'my', 'books'], sourceTokenIds: ['i', 'like', 'my', 'books'], focusSyntaxId: 'o', dependsOn: ['pb02-explain-full-object'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['like']], level: 0 },
        { id: 'o', role: '宾语', segments: [['my', 'books']], level: 0, headIds: ['books'], modifiesIds: ['my'] },
      ], coverage: ['PB02.b'],
    },
    {
      id: 'pb02-independent-transfer', activity: 'independent-output', phase: 'transfer', meaning: '他们喜欢我的书',
      targetTokenIds: ['they', 'like', 'my', 'books'], dependsOn: ['pb02-identify-full-object'],
      acceptedAnswers: ['They like my books.'], revealTarget: false, hideHistory: true,
      syntax: [
        { id: 's', role: '主语', segments: [['they']], level: 0 },
        { id: 'v', role: '谓语', segments: [['like']], level: 0 },
        { id: 'o', role: '宾语', segments: [['my', 'books']], level: 0, headIds: ['books'], modifiesIds: ['my'] },
      ], coverage: ['PB02.a', 'PB02.b', 'PB02.c'],
    },
  ],
  review: { intervalsDays: [1, 3], stepIds: ['pb02-independent-transfer'] },
};
