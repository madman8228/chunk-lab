const subcourse = ({ id, subgoalId, title, tokens, steps, reviewStep }) => ({
  schemaVersion: 'progressive-building/3',
  id, version: 1, knowledgeNode: 'PB03', subgoalIds: [subgoalId],
  prerequisites: ['PB01'], title, tokens, steps,
  review: { intervalsDays: [1, 3], stepIds: [reviewStep] },
});

const identityTokens = [
  { id: 'she', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '代词' },
  { id: 'is', text: 'is', kind: 'word', gloss: '是', partOfSpeech: '动词', verbFunction: 'linking' },
  { id: 'a', text: 'a', kind: 'word', gloss: '一名', partOfSpeech: '限定词' },
  { id: 'doctor', text: 'doctor', kind: 'word', gloss: '医生', partOfSpeech: '名词' },
  { id: 'he', text: 'He', kind: 'word', gloss: '他', partOfSpeech: '代词' },
  { id: 'period', text: '.', kind: 'punctuation' },
];
const identitySyntax = [
  { id: 's', role: '主语', segments: [['she']], level: 0 },
  { id: 'v', role: '系动词', segments: [['is']], level: 0 },
  { id: 'c', role: '表语', segments: [['a', 'doctor']], level: 0, headIds: ['doctor'] },
];

const adjectiveTokens = [
  { id: 'she', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '代词' },
  { id: 'is', text: 'is', kind: 'word', gloss: '是', partOfSpeech: '动词', verbFunction: 'linking' },
  { id: 'happy', text: 'happy', kind: 'word', gloss: '开心的', partOfSpeech: '形容词' },
  { id: 'he', text: 'He', kind: 'word', gloss: '他', partOfSpeech: '代词' },
  { id: 'period', text: '.', kind: 'punctuation' },
];
const adjectiveSyntax = [
  { id: 's', role: '主语', segments: [['she']], level: 0 },
  { id: 'v', role: '系动词', segments: [['is']], level: 0 },
  { id: 'c', role: '表语', segments: [['happy']], level: 0 },
];

const locationTokens = [
  { id: 'she', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '代词' },
  { id: 'is', text: 'is', kind: 'word', gloss: '在', partOfSpeech: '动词', verbFunction: 'linking' },
  { id: 'at', text: 'at', kind: 'word', gloss: '在', partOfSpeech: '介词' },
  { id: 'home', text: 'home', kind: 'word', gloss: '家', partOfSpeech: '名词' },
  { id: 'he', text: 'He', kind: 'word', gloss: '他', partOfSpeech: '代词' },
  { id: 'period', text: '.', kind: 'punctuation' },
];
const locationSyntax = [
  { id: 's', role: '主语', segments: [['she']], level: 0 },
  { id: 'v', role: '系动词', segments: [['is']], level: 0 },
  { id: 'c', role: '表语', segments: [['at', 'home']], level: 0, headIds: ['home'], modifiesIds: ['at'] },
];

const contrastTokens = [
  { id: 'she', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '代词' },
  { id: 'is', text: 'is', kind: 'word', gloss: '是', partOfSpeech: '动词', verbFunction: 'linking' },
  { id: 'happy', text: 'happy', kind: 'word', gloss: '开心的', partOfSpeech: '形容词' },
  { id: 'period1', text: '.', kind: 'punctuation' },
  { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' },
  { id: 'like', text: 'like', kind: 'word', gloss: '喜欢', partOfSpeech: '动词' },
  { id: 'her', text: 'her', kind: 'word', gloss: '她', partOfSpeech: '代词' },
  { id: 'period2', text: '.', kind: 'punctuation' },
  { id: 'music', text: 'music', kind: 'word', gloss: '音乐', partOfSpeech: '名词' },
];
const contrastSyntax = [
  { id: 's1', role: '主语', segments: [['she']], level: 0 },
  { id: 'v1', role: '系动词', segments: [['is']], level: 0 },
  { id: 'c1', role: '表语', segments: [['happy']], level: 0 },
  { id: 's2', role: '主语', segments: [['i']], level: 0 },
  { id: 'v2', role: '谓语', segments: [['like']], level: 0 },
  { id: 'o2', role: '宾语', segments: [['her']], level: 0 },
];

export const courses = [
  subcourse({
    id: 'pb03-noun-predicative-v1', subgoalId: 'PB03.a', title: '名词表语：说明身份', tokens: identityTokens, reviewStep: 'pb03a-transfer',
    steps: [
      { id: 'pb03a-local', activity: 'compose', phase: 'introduction', meaning: '一名医生', targetTokenIds: ['a', 'doctor'], bankTokenIds: ['a', 'doctor'], coverage: ['PB03.a'] },
      { id: 'pb03a-build', activity: 'compose', phase: 'practice', meaning: '她是医生', targetTokenIds: ['she', 'is', 'a', 'doctor', 'period'], bankTokenIds: ['she', 'is', 'a', 'doctor'], dependsOn: ['pb03a-local'], syntax: identitySyntax, coverage: ['PB03.a'] },
      { id: 'pb03a-teach', activity: 'teach', phase: 'introduction', meaning: '她是医生', targetTokenIds: ['she', 'is', 'a', 'doctor', 'period'], focusTokenIds: ['is', 'a', 'doctor'], dependsOn: ['pb03a-build'], syntax: identitySyntax, explanation: '在 She is a doctor 里，a doctor 回答“她是谁”；is 把主语和身份连起来。a doctor 在这里是表语，不是动作涉及的宾语。', coverage: ['PB03.a'] },
      { id: 'pb03a-identify', activity: 'range-identify', phase: 'practice', meaning: '选出说明她身份的词块', targetTokenIds: ['she', 'is', 'a', 'doctor', 'period'], bankTokenIds: ['she', 'is', 'a', 'doctor'], sourceTokenIds: ['she', 'is', 'a', 'doctor', 'period'], focusSyntaxId: 'c', dependsOn: ['pb03a-teach'], syntax: identitySyntax, coverage: ['PB03.a'] },
      { id: 'pb03a-transfer', activity: 'independent-output', phase: 'transfer', meaning: '他是医生', targetTokenIds: ['he', 'is', 'a', 'doctor', 'period'], dependsOn: ['pb03a-identify'], acceptedAnswers: ['He is a doctor.'], revealTarget: false, hideHistory: true, syntax: [{ id: 's', role: '主语', segments: [['he']], level: 0 }, { id: 'v', role: '系动词', segments: [['is']], level: 0 }, { id: 'c', role: '表语', segments: [['a', 'doctor']], level: 0, headIds: ['doctor'] }], coverage: ['PB03.a'] },
    ],
  }),
  subcourse({
    id: 'pb03-adjective-predicative-v1', subgoalId: 'PB03.b', title: '形容词表语：说明状态', tokens: adjectiveTokens, reviewStep: 'pb03b-transfer',
    steps: [
      { id: 'pb03b-local', activity: 'compose', phase: 'introduction', meaning: '开心', targetTokenIds: ['happy'], bankTokenIds: ['happy'], coverage: ['PB03.b'] },
      { id: 'pb03b-build', activity: 'compose', phase: 'practice', meaning: '她很开心', targetTokenIds: ['she', 'is', 'happy', 'period'], bankTokenIds: ['she', 'is', 'happy'], dependsOn: ['pb03b-local'], syntax: adjectiveSyntax, coverage: ['PB03.b'] },
      { id: 'pb03b-teach', activity: 'teach', phase: 'introduction', meaning: '她很开心', targetTokenIds: ['she', 'is', 'happy', 'period'], focusTokenIds: ['is', 'happy'], dependsOn: ['pb03b-build'], syntax: adjectiveSyntax, explanation: '在 She is happy 里，happy 说明 She 的状态；is 连接两者。happy 是形容词，但它在这句中承担表语，不是谓语动词。', coverage: ['PB03.b'] },
      { id: 'pb03b-identify', activity: 'range-identify', phase: 'practice', meaning: '选出说明 She 状态的词', targetTokenIds: ['she', 'is', 'happy', 'period'], bankTokenIds: ['she', 'is', 'happy'], sourceTokenIds: ['she', 'is', 'happy', 'period'], focusSyntaxId: 'c', dependsOn: ['pb03b-teach'], syntax: adjectiveSyntax, coverage: ['PB03.b'] },
      { id: 'pb03b-transfer', activity: 'independent-output', phase: 'transfer', meaning: '他很开心', targetTokenIds: ['he', 'is', 'happy', 'period'], dependsOn: ['pb03b-identify'], acceptedAnswers: ['He is happy.'], revealTarget: false, hideHistory: true, syntax: [{ id: 's', role: '主语', segments: [['he']], level: 0 }, { id: 'v', role: '系动词', segments: [['is']], level: 0 }, { id: 'c', role: '表语', segments: [['happy']], level: 0 }], coverage: ['PB03.b'] },
    ],
  }),
  subcourse({
    id: 'pb03-pp-predicative-v1', subgoalId: 'PB03.c', title: '介词短语表语：说明位置', tokens: locationTokens, reviewStep: 'pb03c-transfer',
    steps: [
      { id: 'pb03c-local', activity: 'compose', phase: 'introduction', meaning: '在家', targetTokenIds: ['at', 'home'], bankTokenIds: ['at', 'home'], coverage: ['PB03.c'] },
      { id: 'pb03c-build', activity: 'compose', phase: 'practice', meaning: '她在家', targetTokenIds: ['she', 'is', 'at', 'home', 'period'], bankTokenIds: ['she', 'is', 'at', 'home'], dependsOn: ['pb03c-local'], syntax: locationSyntax, coverage: ['PB03.c'] },
      { id: 'pb03c-teach', activity: 'teach', phase: 'introduction', meaning: '她在家', targetTokenIds: ['she', 'is', 'at', 'home', 'period'], focusTokenIds: ['is', 'at', 'home'], dependsOn: ['pb03c-build'], syntax: locationSyntax, explanation: '在 She is at home 里，at home 整组说明主语在哪里，和 is 一起说明 She 的位置，所以整体作表语。相同短语放在 She studies at home 中时，才是动作的地点状语。', coverage: ['PB03.c'] },
      { id: 'pb03c-identify', activity: 'range-identify', phase: 'practice', meaning: '选出说明 She 位置的词块', targetTokenIds: ['she', 'is', 'at', 'home', 'period'], bankTokenIds: ['she', 'is', 'at', 'home'], sourceTokenIds: ['she', 'is', 'at', 'home', 'period'], focusSyntaxId: 'c', dependsOn: ['pb03c-teach'], syntax: locationSyntax, coverage: ['PB03.c'] },
      { id: 'pb03c-transfer', activity: 'independent-output', phase: 'transfer', meaning: '他在家', targetTokenIds: ['he', 'is', 'at', 'home', 'period'], dependsOn: ['pb03c-identify'], acceptedAnswers: ['He is at home.'], revealTarget: false, hideHistory: true, syntax: [{ id: 's', role: '主语', segments: [['he']], level: 0 }, { id: 'v', role: '系动词', segments: [['is']], level: 0 }, { id: 'c', role: '表语', segments: [['at', 'home']], level: 0, headIds: ['home'], modifiesIds: ['at'] }], coverage: ['PB03.c'] },
    ],
  }),
  subcourse({
    id: 'pb03-predicative-object-contrast-v1', subgoalId: 'PB03.d', title: '表语和宾语：由关系判断', tokens: contrastTokens, reviewStep: 'pb03d-transfer',
    steps: [
      { id: 'pb03d-teach', activity: 'teach', phase: 'introduction', meaning: '表语与宾语', targetTokenIds: ['she', 'is', 'happy', 'period1', 'i', 'like', 'her', 'period2'], focusTokenIds: ['happy', 'her'], syntax: contrastSyntax, explanation: '对照两句：She is happy 中，happy 说明主语状态，是表语；I like her 中，her 回答 like 什么，是宾语。不能只因为一个词在动词后面就把它叫宾语。', coverage: ['PB03.d'] },
      { id: 'pb03d-identify', activity: 'range-identify', phase: 'practice', meaning: '宾语', targetTokenIds: ['she', 'is', 'happy', 'period1', 'i', 'like', 'her', 'period2'], bankTokenIds: ['she', 'is', 'happy', 'i', 'like', 'her'], sourceTokenIds: ['she', 'is', 'happy', 'period1', 'i', 'like', 'her', 'period2'], focusSyntaxId: 'o2', dependsOn: ['pb03d-teach'], syntax: contrastSyntax, coverage: ['PB03.d'] },
      { id: 'pb03d-transfer', activity: 'independent-output', phase: 'transfer', meaning: '我喜欢音乐', targetTokenIds: ['i', 'like', 'music'], dependsOn: ['pb03d-identify'], acceptedAnswers: ['I like music.'], revealTarget: false, hideHistory: true, syntax: [{ id: 's', role: '主语', segments: [['i']], level: 0 }, { id: 'v', role: '谓语', segments: [['like']], level: 0 }, { id: 'o', role: '宾语', segments: [['music']], level: 0 }], coverage: ['PB03.d'] },
    ],
  }),
];
