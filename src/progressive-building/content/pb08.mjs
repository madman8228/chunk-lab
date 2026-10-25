const course = ({ id, subgoalId, title, tokens, steps, reviewStep }) => ({
  schemaVersion: 'progressive-building/3', id, version: 1, knowledgeNode: 'PB08',
  subgoalIds: [subgoalId], prerequisites: ['PB02', 'PB06'], title, tokens, steps,
  review: { intervalsDays: [1, 3], stepIds: [reviewStep] },
});
const syntax = (id, role, ids, level = 0, extra = {}) => ({ id, role, segments: [ids], level, ...extra });
const tokensFor = (addition, extra = []) => [
  { id: 'she', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '代词' },
  { id: 'reads', text: 'reads', kind: 'word', gloss: '读书', partOfSpeech: '动词' },
  ...addition,
  ...extra,
];
const makeSteps = ({ key, cue, target, local, localMeaning, adverbialIds, explanation, transferCue, transferTarget, transferAnswer, subjectIds = ['she'], verbIds = ['reads'] }) => [
  {
    id: `${key}-teach`, activity: 'teach', phase: 'introduction', meaning: cue,
    targetTokenIds: target, focusTokenIds: adverbialIds,
    syntax: [syntax('s', '主语', subjectIds), syntax('v', '谓语', verbIds), syntax('adv', '状语', adverbialIds)],
    explanation, coverage: [`PB08.${key.slice(-1)}`],
  },
  { id: `${key}-local`, activity: 'compose', phase: 'practice', meaning: localMeaning, targetTokenIds: local, bankTokenIds: local, dependsOn: [`${key}-teach`], syntax: [syntax('adv', '状语', local)], coverage: [`PB08.${key.slice(-1)}`] },
  { id: `${key}-sentence`, activity: 'compose', phase: 'practice', meaning: cue, targetTokenIds: target, bankTokenIds: target, dependsOn: [`${key}-local`], syntax: [syntax('s', '主语', subjectIds), syntax('v', '谓语', verbIds), syntax('adv', '状语', adverbialIds)], coverage: [`PB08.${key.slice(-1)}`] },
  { id: `${key}-identify`, activity: 'range-identify', phase: 'practice', meaning: '选出补充信息', targetTokenIds: target, bankTokenIds: target, sourceTokenIds: target, focusSyntaxId: 'adv', dependsOn: [`${key}-sentence`], syntax: [syntax('s', '主语', subjectIds), syntax('v', '谓语', verbIds), syntax('adv', '状语', adverbialIds)], coverage: [`PB08.${key.slice(-1)}`] },
  { id: `${key}-transfer`, activity: 'independent-output', phase: 'transfer', meaning: transferCue, targetTokenIds: transferTarget, acceptedAnswers: [transferAnswer], revealTarget: false, hideHistory: true, dependsOn: [`${key}-identify`], coverage: [`PB08.${key.slice(-1)}`] },
];

const frequencyTokens = tokensFor([{ id: 'every', text: 'every', kind: 'word', gloss: '每', partOfSpeech: '限定词' }, { id: 'day', text: 'day', kind: 'word', gloss: '天', partOfSpeech: '名词' }], [
  { id: 'we', text: 'We', kind: 'word', gloss: '我们', partOfSpeech: '代词' }, { id: 'study', text: 'study', kind: 'word', gloss: '学习', partOfSpeech: '动词' }, { id: 'every2', text: 'every', kind: 'word', gloss: '每', partOfSpeech: '限定词' }, { id: 'week', text: 'week', kind: 'word', gloss: '周', partOfSpeech: '名词' },
]);
const placeTokens = tokensFor([{ id: 'at', text: 'at', kind: 'word', gloss: '在', partOfSpeech: '介词' }, { id: 'home', text: 'home', kind: 'word', gloss: '家', partOfSpeech: '名词' }], [
  { id: 'he', text: 'He', kind: 'word', gloss: '他', partOfSpeech: '代词' }, { id: 'works', text: 'works', kind: 'word', gloss: '工作', partOfSpeech: '动词' }, { id: 'at2', text: 'at', kind: 'word', gloss: '在', partOfSpeech: '介词' }, { id: 'school', text: 'school', kind: 'word', gloss: '学校', partOfSpeech: '名词' },
]);
const mannerTokens = tokensFor([{ id: 'slowly', text: 'slowly', kind: 'word', gloss: '慢慢地', partOfSpeech: '副词' }], [
  { id: 'he', text: 'He', kind: 'word', gloss: '他', partOfSpeech: '代词' }, { id: 'walks', text: 'walks', kind: 'word', gloss: '走路', partOfSpeech: '动词' }, { id: 'quickly', text: 'quickly', kind: 'word', gloss: '很快地', partOfSpeech: '副词' },
]);
const companyTokens = tokensFor([{ id: 'with', text: 'with', kind: 'word', gloss: '和', partOfSpeech: '介词' }, { id: 'me', text: 'me', kind: 'word', gloss: '我', partOfSpeech: '代词' }], [
  { id: 'they', text: 'They', kind: 'word', gloss: '他们', partOfSpeech: '代词' }, { id: 'play', text: 'play', kind: 'word', gloss: '玩', partOfSpeech: '动词' }, { id: 'with2', text: 'with', kind: 'word', gloss: '和', partOfSpeech: '介词' }, { id: 'us', text: 'us', kind: 'word', gloss: '我们', partOfSpeech: '代词' },
]);
const combinedTokens = tokensFor([
  { id: 'at', text: 'at', kind: 'word', gloss: '在', partOfSpeech: '介词' }, { id: 'home', text: 'home', kind: 'word', gloss: '家', partOfSpeech: '名词' },
  { id: 'every', text: 'every', kind: 'word', gloss: '每', partOfSpeech: '限定词' }, { id: 'day', text: 'day', kind: 'word', gloss: '天', partOfSpeech: '名词' },
], [
  { id: 'he', text: 'He', kind: 'word', gloss: '他', partOfSpeech: '代词' }, { id: 'studies', text: 'studies', kind: 'word', gloss: '学习', partOfSpeech: '动词' },
  { id: 'at2', text: 'at', kind: 'word', gloss: '在', partOfSpeech: '介词' }, { id: 'school', text: 'school', kind: 'word', gloss: '学校', partOfSpeech: '名词' },
  { id: 'every2', text: 'every', kind: 'word', gloss: '每', partOfSpeech: '限定词' }, { id: 'week', text: 'week', kind: 'word', gloss: '周', partOfSpeech: '名词' },
]);

export const courses = [
  course({ id: 'pb08-time-frequency-v1', subgoalId: 'PB08.a', title: 'every day：频率信息', tokens: frequencyTokens, reviewStep: 'pb08a-transfer', steps: makeSteps({ key: 'pb08a', cue: '她每天读书', target: ['she', 'reads', 'every', 'day'], local: ['every', 'day'], localMeaning: '每天', adverbialIds: ['every', 'day'], explanation: 'every day 回答“多久一次/什么时候”，补充 reads 发生的频率。every 是限定词，day 是名词；这组词在句中整体作时间状语。', transferCue: '我们每周学习', transferTarget: ['we', 'study', 'every2', 'week'], transferAnswer: 'We study every week.' }) }),
  course({ id: 'pb08-place-adverbial-v1', subgoalId: 'PB08.b', title: 'at home：地点信息', tokens: placeTokens, reviewStep: 'pb08b-transfer', steps: makeSteps({ key: 'pb08b', cue: '她在家读书', target: ['she', 'reads', 'at', 'home'], local: ['at', 'home'], localMeaning: '在家', adverbialIds: ['at', 'home'], explanation: 'at home 回答“在哪里读”，补充 reads 发生的地点。at 是介词，home 是它带出的位置；整组在这句话里作地点状语。', transferCue: '他在学校工作', transferTarget: ['he', 'works', 'at2', 'school'], transferAnswer: 'He works at school.' }) }),
  course({ id: 'pb08-manner-adverbial-v1', subgoalId: 'PB08.c', title: 'slowly：动作方式', tokens: mannerTokens, reviewStep: 'pb08c-transfer', steps: makeSteps({ key: 'pb08c', cue: '她慢慢地读书', target: ['she', 'reads', 'slowly'], local: ['slowly'], localMeaning: '慢慢地', adverbialIds: ['slowly'], explanation: 'slowly 回答“怎样读”，修饰动作 reads；词性是副词，在当前句中的成分作用是方式状语。词性和句子成分不是同一回事。', transferCue: '他走得很快', transferTarget: ['he', 'walks', 'quickly'], transferAnswer: 'He walks quickly.' }) }),
  course({ id: 'pb08-company-adverbial-v1', subgoalId: 'PB08.d', title: 'with me：伴随信息', tokens: companyTokens, reviewStep: 'pb08d-transfer', steps: makeSteps({ key: 'pb08d', cue: '她和我一起读书', target: ['she', 'reads', 'with', 'me'], local: ['with', 'me'], localMeaning: '和我一起', adverbialIds: ['with', 'me'], explanation: 'with me 补充“和谁一起读”，说明伴随对象。with 是介词，me 是介词宾语；整组修饰 reads，在这里作伴随状语。', transferCue: '他们和我们一起玩', transferTarget: ['they', 'play', 'with2', 'us'], transferAnswer: 'They play with us.' }) }),
  course({ id: 'pb08-multiple-adverbials-v1', subgoalId: 'PB08.e', title: '地点和时间一起补充', tokens: combinedTokens, reviewStep: 'pb08e-transfer', steps: makeSteps({ key: 'pb08e', cue: '她每天在家读书', target: ['she', 'reads', 'at', 'home', 'every', 'day'], local: ['at', 'home'], localMeaning: '在家', adverbialIds: ['at', 'home', 'every', 'day'], explanation: 'at home 回答地点，every day 回答频率；两组都补充 reads，但各自回答不同问题。先把信息按自然顺序接在动作后。英语也有其他语境许可的位置，本课只练这一种清楚的表达。', transferCue: '他每周在学校学习', transferTarget: ['he', 'studies', 'at2', 'school', 'every2', 'week'], transferAnswer: 'He studies at school every week.' }) }),
];
