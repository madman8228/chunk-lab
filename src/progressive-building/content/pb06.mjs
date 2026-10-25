const course = ({ id, subgoalIds, title, tokens, steps, reviewStep }) => ({
  schemaVersion: 'progressive-building/3', id, version: 1, knowledgeNode: 'PB06',
  subgoalIds, prerequisites: ['PB05'], title, tokens, steps,
  review: { intervalsDays: [1, 3], stepIds: [reviewStep] },
});
const syntax = (id, role, ids, level = 0, extra = {}) => ({ id, role, segments: [ids], level, ...extra });

const locationTokens = [
  { id: 'the1', text: 'The', kind: 'word', gloss: '这/那', partOfSpeech: '限定词' },
  { id: 'book1', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
  { id: 'is1', text: 'is', kind: 'word', gloss: '在', partOfSpeech: '动词' },
  { id: 'on1', text: 'on', kind: 'word', gloss: '在……上', partOfSpeech: '介词' },
  { id: 'the2', text: 'the', kind: 'word', gloss: '这/那', partOfSpeech: '限定词' },
  { id: 'desk1', text: 'desk', kind: 'word', gloss: '桌子', partOfSpeech: '名词' },
  { id: 'bag', text: 'bag', kind: 'word', gloss: '包', partOfSpeech: '名词' },
  { id: 'chair', text: 'chair', kind: 'word', gloss: '椅子', partOfSpeech: '名词' },
];

const directionTokens = [
  { id: 'cat1', text: 'The', kind: 'word', gloss: '这只', partOfSpeech: '限定词' },
  { id: 'cat2', text: 'cat', kind: 'word', gloss: '猫', partOfSpeech: '名词' },
  { id: 'is', text: 'is', kind: 'word', gloss: '在', partOfSpeech: '动词' },
  { id: 'under', text: 'under', kind: 'word', gloss: '在……下面', partOfSpeech: '介词' },
  { id: 'the', text: 'the', kind: 'word', gloss: '这/那', partOfSpeech: '限定词' },
  { id: 'table', text: 'table', kind: 'word', gloss: '桌子', partOfSpeech: '名词' },
  { id: 'bag', text: 'bag', kind: 'word', gloss: '包', partOfSpeech: '名词' },
  { id: 'box', text: 'box', kind: 'word', gloss: '盒子', partOfSpeech: '名词' },
  { id: 'the2', text: 'the', kind: 'word', gloss: '这/那', partOfSpeech: '限定词' },
];

export const courses = [
  course({
    id: 'pb06-location-phrase-v1', subgoalIds: ['PB06.a', 'PB06.b'],
    title: 'on the desk：介词和它的对象', tokens: locationTokens, reviewStep: 'pb06-location-transfer',
    steps: [
      {
        id: 'pb06-location-teach', activity: 'teach', phase: 'introduction', meaning: '书在桌子上',
        targetTokenIds: ['the1', 'book1', 'is1', 'on1', 'the2', 'desk1'], focusTokenIds: ['on1', 'the2', 'desk1'],
        syntax: [syntax('s', '主语', ['the1', 'book1']), syntax('v', '系动词', ['is1']), syntax('place', '地点表语', ['on1', 'the2', 'desk1']), syntax('prep', '介词', ['on1'], 1, { parentId: 'place' }), syntax('object', '介词宾语', ['the2', 'desk1'], 1, { parentId: 'place', headIds: ['desk1'] })],
        explanation: 'on 表示“在……上”，后面要接它所指的位置 the desk。on 和 the desk 合起来是地点短语，整组说明书在哪里；the desk 是介词 on 的宾语。',
        coverage: ['PB06.a', 'PB06.b'],
      },
      { id: 'pb06-location-local', activity: 'compose', phase: 'practice', meaning: '在桌子上', targetTokenIds: ['on1', 'the2', 'desk1'], bankTokenIds: ['on1', 'the2', 'desk1'], dependsOn: ['pb06-location-teach'], syntax: [syntax('phrase', '地点短语', ['on1', 'the2', 'desk1']), syntax('prep', '介词', ['on1'], 1, { parentId: 'phrase' }), syntax('object', '介词宾语', ['the2', 'desk1'], 1, { parentId: 'phrase', headIds: ['desk1'] })], coverage: ['PB06.a', 'PB06.b'] },
      {
        id: 'pb06-location-range', activity: 'range-identify', phase: 'practice', meaning: '选出整组地点短语',
        targetTokenIds: ['the1', 'book1', 'is1', 'on1', 'the2', 'desk1'], bankTokenIds: ['the1', 'book1', 'is1', 'on1', 'the2', 'desk1'], sourceTokenIds: ['the1', 'book1', 'is1', 'on1', 'the2', 'desk1'], focusSyntaxId: 'place', dependsOn: ['pb06-location-local'],
        syntax: [syntax('s', '主语', ['the1', 'book1']), syntax('v', '系动词', ['is1']), syntax('place', '地点表语', ['on1', 'the2', 'desk1']), syntax('prep', '介词', ['on1'], 1, { parentId: 'place' }), syntax('object', '介词宾语', ['the2', 'desk1'], 1, { parentId: 'place', headIds: ['desk1'] })], coverage: ['PB06.a', 'PB06.b'],
      },
      { id: 'pb06-location-transfer', activity: 'independent-output', phase: 'transfer', meaning: '包在椅子上', targetTokenIds: ['the1', 'bag', 'is1', 'on1', 'the2', 'chair'], acceptedAnswers: ['The bag is on the chair.'], revealTarget: false, hideHistory: true, dependsOn: ['pb06-location-range'], coverage: ['PB06.a', 'PB06.b'] },
    ],
  }),
  course({
    id: 'pb06-position-meaning-v1', subgoalIds: ['PB06.c'], title: 'under the table：位置关系', tokens: directionTokens, reviewStep: 'pb06-position-transfer',
    steps: [
      { id: 'pb06-position-teach', activity: 'teach', phase: 'introduction', meaning: '猫在桌子下面', targetTokenIds: ['cat1', 'cat2', 'is', 'under', 'the', 'table'], focusTokenIds: ['under', 'table'], syntax: [syntax('s', '主语', ['cat1', 'cat2']), syntax('v', '系动词', ['is']), syntax('place', '地点表语', ['under', 'the', 'table'])], explanation: 'under 表示“在下方”，关系方向和 on 不同。介词选定后，再接它所表示的位置；整组 under the table 才表达完整位置。', coverage: ['PB06.c'] },
      { id: 'pb06-position-local', activity: 'compose', phase: 'practice', meaning: '在桌子下面', targetTokenIds: ['under', 'the', 'table'], bankTokenIds: ['under', 'the', 'table'], dependsOn: ['pb06-position-teach'], syntax: [syntax('place', '地点短语', ['under', 'the', 'table']), syntax('prep', '介词', ['under'], 1, { parentId: 'place' }), syntax('object', '介词宾语', ['the', 'table'], 1, { parentId: 'place', headIds: ['table'] })], coverage: ['PB06.c'] },
      { id: 'pb06-position-transfer', activity: 'independent-output', phase: 'transfer', meaning: '包在盒子下面', targetTokenIds: ['the', 'bag', 'is', 'under', 'the2', 'box'], acceptedAnswers: ['The bag is under the box.'], revealTarget: false, hideHistory: true, dependsOn: ['pb06-position-local'], coverage: ['PB06.c'] },
    ],
  }),
];
