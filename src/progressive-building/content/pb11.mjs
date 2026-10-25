const syntax = (id, role, ids, level = 0, extra = {}) => ({ id, role, segments: [ids], level, ...extra });
const makeLesson = ({ id, title, subgoalIds, tokens, steps, reviewStep }) => ({ schemaVersion: 'progressive-building/3', id, version: 1, knowledgeNode: 'PB11', subgoalIds, prerequisites: ['PB02', 'PB05'], title, tokens, steps, review: { intervalsDays: [1, 3], stepIds: [reviewStep] } });
const tokens = [
  { id: 'she', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '代词' }, { id: 'gives', text: 'gives', kind: 'word', gloss: '给', partOfSpeech: '动词' },
  { id: 'me', text: 'me', kind: 'word', gloss: '我', partOfSpeech: '代词' }, { id: 'a', text: 'a', kind: 'word', gloss: '一本', partOfSpeech: '限定词' }, { id: 'book', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
  { id: 'he', text: 'He', kind: 'word', gloss: '他', partOfSpeech: '代词' }, { id: 'gives2', text: 'gives', kind: 'word', gloss: '给', partOfSpeech: '动词' }, { id: 'her', text: 'her', kind: 'word', gloss: '她', partOfSpeech: '代词' }, { id: 'a2', text: 'a', kind: 'word', gloss: '一支', partOfSpeech: '限定词' }, { id: 'pen', text: 'pen', kind: 'word', gloss: '笔', partOfSpeech: '名词' },
  { id: 'they', text: 'They', kind: 'word', gloss: '他们', partOfSpeech: '代词' }, { id: 'give3', text: 'give', kind: 'word', gloss: '给', partOfSpeech: '动词' }, { id: 'him', text: 'him', kind: 'word', gloss: '他', partOfSpeech: '代词' }, { id: 'a3', text: 'a', kind: 'word', gloss: '一本', partOfSpeech: '限定词' }, { id: 'book2', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
];
const base = [syntax('s', '主语', ['she']), syntax('v', '谓语', ['gives']), syntax('receiver', '间接宾语（接收者）', ['me']), syntax('thing', '直接宾语（物品）', ['a', 'book'])];

export const lesson = makeLesson({
  id: 'pb11-double-object-v1', title: 'She gives me a book：给谁、给什么', subgoalIds: ['PB11.a', 'PB11.b', 'PB11.c'], tokens, reviewStep: 'pb11-transfer',
  steps: [
    { id: 'pb11-teach', activity: 'teach', phase: 'introduction', meaning: '她给我一本书', targetTokenIds: ['she', 'gives', 'me', 'a', 'book'], focusTokenIds: ['gives', 'me', 'a', 'book'], syntax: base, explanation: '在 She gives me a book 里，me 回答“给谁”，是间接宾语；a book 回答“给什么”，是直接宾语。它们都是 gives 涉及的对象，但关系不同。先看意思，不能只因为 me 后面还有一个名词短语就把它叫第二个宾语；换人物或物品时，这两种关系仍要分别保留。', coverage: ['PB11.a', 'PB11.b', 'PB11.c'] },
    { id: 'pb11-local-receiver', activity: 'compose', phase: 'practice', meaning: '给我', targetTokenIds: ['me'], bankTokenIds: ['me'], dependsOn: ['pb11-teach'], syntax: [syntax('receiver', '接收者', ['me'])], coverage: ['PB11.a'] },
    { id: 'pb11-local-thing', activity: 'compose', phase: 'practice', meaning: '一本书', targetTokenIds: ['a', 'book'], bankTokenIds: ['a', 'book'], dependsOn: ['pb11-local-receiver'], syntax: [syntax('thing', '物品', ['a', 'book'])], coverage: ['PB11.a'] },
    { id: 'pb11-build', activity: 'compose', phase: 'practice', meaning: '她给我一本书', targetTokenIds: ['she', 'gives', 'me', 'a', 'book'], bankTokenIds: ['she', 'gives', 'me', 'a', 'book'], dependsOn: ['pb11-local-thing'], syntax: base, coverage: ['PB11.a', 'PB11.b'] },
    { id: 'pb11-reuse', activity: 'compose', phase: 'practice', meaning: '他给她一支笔', targetTokenIds: ['he', 'gives2', 'her', 'a2', 'pen'], bankTokenIds: ['he', 'gives2', 'her', 'a2', 'pen'], dependsOn: ['pb11-build'], syntax: [syntax('s', '主语', ['he']), syntax('v', '谓语', ['gives2']), syntax('receiver', '间接宾语（接收者）', ['her']), syntax('thing', '直接宾语（物品）', ['a2', 'pen'])], coverage: ['PB11.c'] },
    { id: 'pb11-identify-receiver', activity: 'range-identify', phase: 'practice', meaning: '选出接收者', targetTokenIds: ['she', 'gives', 'me', 'a', 'book'], bankTokenIds: ['she', 'gives', 'me', 'a', 'book'], sourceTokenIds: ['she', 'gives', 'me', 'a', 'book'], focusSyntaxId: 'receiver', dependsOn: ['pb11-reuse'], syntax: base, coverage: ['PB11.a', 'PB11.b'] },
    { id: 'pb11-identify-thing', activity: 'range-identify', phase: 'practice', meaning: '选出被给的物品', targetTokenIds: ['she', 'gives', 'me', 'a', 'book'], bankTokenIds: ['she', 'gives', 'me', 'a', 'book'], sourceTokenIds: ['she', 'gives', 'me', 'a', 'book'], focusSyntaxId: 'thing', dependsOn: ['pb11-identify-receiver'], syntax: base, coverage: ['PB11.a', 'PB11.b'] },
    { id: 'pb11-transfer', activity: 'independent-output', phase: 'transfer', meaning: '他们给他一本书', targetTokenIds: ['they', 'give3', 'him', 'a3', 'book2'], acceptedAnswers: ['They give him a book.'], revealTarget: false, hideHistory: true, dependsOn: ['pb11-identify-thing'], coverage: ['PB11.a', 'PB11.b', 'PB11.c'] },
  ],
});
