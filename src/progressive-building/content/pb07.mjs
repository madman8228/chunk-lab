const syntax = (id, role, ids, level = 0, extra = {}) => ({ id, role, segments: [ids], level, ...extra });
const tokens = [
  { id: 'the1', text: 'The', kind: 'word', gloss: '这本', partOfSpeech: '限定词' },
  { id: 'book1', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
  { id: 'on1', text: 'on', kind: 'word', gloss: '在……上', partOfSpeech: '介词' },
  { id: 'the2', text: 'the', kind: 'word', gloss: '这张', partOfSpeech: '限定词' },
  { id: 'desk1', text: 'desk', kind: 'word', gloss: '桌子', partOfSpeech: '名词' },
  { id: 'is1', text: 'is', kind: 'word', gloss: '是', partOfSpeech: '动词' },
  { id: 'mine1', text: 'mine', kind: 'word', gloss: '我的', partOfSpeech: '代词' },
  { id: 'the3', text: 'The', kind: 'word', gloss: '这只', partOfSpeech: '限定词' },
  { id: 'cup', text: 'cup', kind: 'word', gloss: '杯子', partOfSpeech: '名词' },
  { id: 'in', text: 'in', kind: 'word', gloss: '在……里', partOfSpeech: '介词' },
  { id: 'the4', text: 'the', kind: 'word', gloss: '这个', partOfSpeech: '限定词' },
  { id: 'box', text: 'box', kind: 'word', gloss: '盒子', partOfSpeech: '名词' },
  { id: 'is2', text: 'is', kind: 'word', gloss: '是', partOfSpeech: '动词' },
  { id: 'mine2', text: 'mine', kind: 'word', gloss: '我的', partOfSpeech: '代词' },
];
const course = {
  schemaVersion: 'progressive-building/3', id: 'pb07-postpositive-modifier-v1', version: 1,
  knowledgeNode: 'PB07', subgoalIds: ['PB07.a', 'PB07.b', 'PB07.c'], prerequisites: ['PB03', 'PB06'],
  title: 'on the desk 修饰 book：扩展主语', tokens,
  steps: [
    { id: 'pb07-local-noun', activity: 'compose', phase: 'practice', meaning: '那本书', targetTokenIds: ['the1', 'book1'], bankTokenIds: ['the1', 'book1'], syntax: [syntax('noun', '名词短语', ['the1', 'book1']), syntax('head', '中心名词', ['book1'], 1, { parentId: 'noun' })], coverage: ['PB07.b'] },
    { id: 'pb07-local-place', activity: 'compose', phase: 'practice', meaning: '在桌子上', targetTokenIds: ['on1', 'the2', 'desk1'], bankTokenIds: ['on1', 'the2', 'desk1'], dependsOn: ['pb07-local-noun'], syntax: [syntax('place', '介词短语', ['on1', 'the2', 'desk1']), syntax('prep', '介词', ['on1'], 1, { parentId: 'place' }), syntax('object', '介词宾语', ['the2', 'desk1'], 1, { parentId: 'place' })], coverage: ['PB07.a'] },
    {
      id: 'pb07-explain-attachment', activity: 'teach', phase: 'introduction', meaning: '先看地点短语和名词的关系',
      targetTokenIds: ['the1', 'book1', 'is1', 'on1', 'the2', 'desk1'], focusTokenIds: ['book1', 'on1', 'the2', 'desk1'], dependsOn: ['pb07-local-place'],
      syntax: [syntax('s', '主语', ['the1', 'book1']), syntax('v', '系动词', ['is1']), syntax('loc', '地点表语', ['on1', 'the2', 'desk1'])],
      explanation: '在 The book is on the desk 里，on the desk 接在 is 后，说明书在哪里。把同一地点短语放到名词 book 后面时，它改为补充“哪一本书”，整个 The book on the desk 才作为一个主语。成分由它在当前句中的关系决定。', coverage: ['PB07.a', 'PB07.b', 'PB07.c'],
    },
    { id: 'pb07-build-subject', activity: 'compose', phase: 'practice', meaning: '桌上的那本书', targetTokenIds: ['the1', 'book1', 'on1', 'the2', 'desk1'], bankTokenIds: ['the1', 'book1', 'on1', 'the2', 'desk1'], dependsOn: ['pb07-explain-attachment'], syntax: [syntax('s', '主语', ['the1', 'book1', 'on1', 'the2', 'desk1']), syntax('head', '中心名词', ['book1'], 1, { parentId: 's' }), syntax('modifier', '后置定语', ['on1', 'the2', 'desk1'], 1, { parentId: 's', modifiesIds: ['book1'] })], coverage: ['PB07.a', 'PB07.b', 'PB07.c'] },
    { id: 'pb07-complete-sentence', activity: 'compose', phase: 'practice', meaning: '桌上的那本书是我的', targetTokenIds: ['the1', 'book1', 'on1', 'the2', 'desk1', 'is1', 'mine1'], bankTokenIds: ['the1', 'book1', 'on1', 'the2', 'desk1', 'is1', 'mine1'], dependsOn: ['pb07-build-subject'], syntax: [syntax('s', '主语', ['the1', 'book1', 'on1', 'the2', 'desk1']), syntax('modifier', '后置定语', ['on1', 'the2', 'desk1'], 1, { parentId: 's', modifiesIds: ['book1'] }), syntax('v', '系动词', ['is1']), syntax('pred', '表语', ['mine1'])], coverage: ['PB07.b'] },
    { id: 'pb07-identify-subject', activity: 'range-identify', phase: 'practice', meaning: '选出完整主语', targetTokenIds: ['the1', 'book1', 'on1', 'the2', 'desk1', 'is1', 'mine1'], bankTokenIds: ['the1', 'book1', 'on1', 'the2', 'desk1', 'is1', 'mine1'], sourceTokenIds: ['the1', 'book1', 'on1', 'the2', 'desk1', 'is1', 'mine1'], focusSyntaxId: 's', dependsOn: ['pb07-complete-sentence'], syntax: [syntax('s', '主语', ['the1', 'book1', 'on1', 'the2', 'desk1']), syntax('modifier', '后置定语', ['on1', 'the2', 'desk1'], 1, { parentId: 's', modifiesIds: ['book1'] }), syntax('v', '系动词', ['is1']), syntax('pred', '表语', ['mine1'])], coverage: ['PB07.a', 'PB07.b', 'PB07.c'] },
    { id: 'pb07-transfer', activity: 'independent-output', phase: 'transfer', meaning: '盒子里的杯子是我的', targetTokenIds: ['the3', 'cup', 'in', 'the4', 'box', 'is2', 'mine2'], acceptedAnswers: ['The cup in the box is mine.'], revealTarget: false, hideHistory: true, dependsOn: ['pb07-identify-subject'], coverage: ['PB07.a', 'PB07.b', 'PB07.c'] },
  ],
  review: { intervalsDays: [1, 3], stepIds: ['pb07-transfer'] },
};
export const lesson = course;
