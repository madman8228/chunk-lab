const syntax = (id, role, ids, level = 0, extra = {}) => ({ id, role, segments: [ids], level, ...extra });
const makeCourse = ({ id, subgoalId, subgoalIds, title, tokens, steps, reviewStep }) => ({
  schemaVersion: 'progressive-building/3', id, version: 1, knowledgeNode: 'PB09',
  subgoalIds: subgoalIds ?? [subgoalId], prerequisites: ['PB06', 'PB08'], title, tokens, steps,
  review: { intervalsDays: [1, 3], stepIds: [reviewStep] },
});

const neededTokens = [
  { id: 'put', text: 'Put', kind: 'word', gloss: '放', partOfSpeech: '动词' },
  { id: 'the1', text: 'the', kind: 'word', gloss: '这本', partOfSpeech: '限定词' },
  { id: 'book', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
  { id: 'on1', text: 'on', kind: 'word', gloss: '到……上', partOfSpeech: '介词' },
  { id: 'the2', text: 'the', kind: 'word', gloss: '这张', partOfSpeech: '限定词' },
  { id: 'desk', text: 'desk', kind: 'word', gloss: '桌子', partOfSpeech: '名词' },
  { id: 'the3', text: 'the', kind: 'word', gloss: '这个', partOfSpeech: '限定词' },
  { id: 'the4', text: 'the', kind: 'word', gloss: '这个', partOfSpeech: '限定词' },
  { id: 'bag', text: 'bag', kind: 'word', gloss: '包', partOfSpeech: '名词' },
  { id: 'under', text: 'under', kind: 'word', gloss: '到……下面', partOfSpeech: '介词' },
  { id: 'chair', text: 'chair', kind: 'word', gloss: '椅子', partOfSpeech: '名词' },
];
const optionalTokens = [
  { id: 'she1', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '代词' },
  { id: 'reads1', text: 'reads', kind: 'word', gloss: '读书', partOfSpeech: '动词' },
  { id: 'in1', text: 'in', kind: 'word', gloss: '在……里', partOfSpeech: '介词' },
  { id: 'the1', text: 'the', kind: 'word', gloss: '这间', partOfSpeech: '限定词' },
  { id: 'room1', text: 'room', kind: 'word', gloss: '房间', partOfSpeech: '名词' },
  { id: 'period1', text: '.', kind: 'punctuation' },
  { id: 'she2', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '代词' },
  { id: 'reads2', text: 'reads', kind: 'word', gloss: '读书', partOfSpeech: '动词' },
  { id: 'period2', text: '.', kind: 'punctuation' },
  { id: 'sleeps', text: 'sleeps', kind: 'word', gloss: '睡觉', partOfSpeech: '动词' },
];

export const courses = [
  makeCourse({
    id: 'pb09-required-destination-v1', subgoalIds: ['PB09.a', 'PB09.c'], title: 'put the book on the desk：动作需要目的地', tokens: neededTokens, reviewStep: 'pb09a-transfer',
    steps: [
      { id: 'pb09a-teach', activity: 'teach', phase: 'introduction', meaning: '把书放到桌子上', targetTokenIds: ['put', 'the1', 'book', 'on1', 'the2', 'desk'], focusTokenIds: ['put', 'on1', 'desk'], syntax: [syntax('v', '谓语', ['put']), syntax('o', '宾语', ['the1', 'book']), syntax('destination', '必需的地点/方向成分', ['on1', 'the2', 'desk'])], explanation: 'put 表示“把某物放到某处”。只说 Put the book 没说明放到哪里，对这个放置任务信息不完整；on the desk 补足了 put 所需的目的地。对比之下，reads 本身已经表达完整动作，地点常只是额外说明。把目的地换成 under the chair，put + 物品 + 目的地的关系仍保留。', coverage: ['PB09.a', 'PB09.c'] },
      { id: 'pb09a-local', activity: 'compose', phase: 'practice', meaning: '到桌子上', targetTokenIds: ['on1', 'the2', 'desk'], bankTokenIds: ['on1', 'the2', 'desk'], dependsOn: ['pb09a-teach'], syntax: [syntax('destination', '目的地短语', ['on1', 'the2', 'desk']), syntax('prep', '介词', ['on1'], 1, { parentId: 'destination' }), syntax('object', '介词宾语', ['the2', 'desk'], 1, { parentId: 'destination' })], coverage: ['PB09.a'] },
      { id: 'pb09a-local-replace', activity: 'compose', phase: 'practice', meaning: '到椅子下面', targetTokenIds: ['under', 'the3', 'chair'], bankTokenIds: ['under', 'the3', 'chair'], dependsOn: ['pb09a-local'], syntax: [syntax('destination', '目的地短语', ['under', 'the3', 'chair']), syntax('prep', '介词', ['under'], 1, { parentId: 'destination' }), syntax('object', '介词宾语', ['the3', 'chair'], 1, { parentId: 'destination' })], coverage: ['PB09.c'] },
      { id: 'pb09a-sentence', activity: 'compose', phase: 'practice', meaning: '把书放到桌子上', targetTokenIds: ['put', 'the1', 'book', 'on1', 'the2', 'desk'], bankTokenIds: ['put', 'the1', 'book', 'on1', 'the2', 'desk'], dependsOn: ['pb09a-local'], syntax: [syntax('v', '谓语', ['put']), syntax('o', '宾语', ['the1', 'book']), syntax('destination', '必需的地点/方向成分', ['on1', 'the2', 'desk'])], coverage: ['PB09.a'] },
      { id: 'pb09a-destination', activity: 'range-identify', phase: 'practice', meaning: '选出放置的目的地', targetTokenIds: ['put', 'the1', 'book', 'on1', 'the2', 'desk'], bankTokenIds: ['put', 'the1', 'book', 'on1', 'the2', 'desk'], sourceTokenIds: ['put', 'the1', 'book', 'on1', 'the2', 'desk'], focusSyntaxId: 'destination', dependsOn: ['pb09a-sentence'], syntax: [syntax('v', '谓语', ['put']), syntax('o', '宾语', ['the1', 'book']), syntax('destination', '必需的地点/方向成分', ['on1', 'the2', 'desk'])], coverage: ['PB09.a'] },
      { id: 'pb09a-transfer', activity: 'independent-output', phase: 'transfer', meaning: '把包放到椅子下面', targetTokenIds: ['put', 'the4', 'bag', 'under', 'the3', 'chair'], acceptedAnswers: ['Put the bag under the chair.'], revealTarget: false, hideHistory: true, dependsOn: ['pb09a-destination', 'pb09a-local-replace'], coverage: ['PB09.a', 'PB09.c'] },
    ],
  }),
  makeCourse({
    id: 'pb09-optional-location-v1', subgoalId: 'PB09.b', title: 'reads in the room：可省略的地点补充', tokens: optionalTokens, reviewStep: 'pb09b-transfer',
    steps: [
      { id: 'pb09b-teach', activity: 'teach', phase: 'introduction', meaning: '读书；在房间里读书', targetTokenIds: ['she1', 'reads1', 'in1', 'the1', 'room1', 'period1', 'she2', 'reads2', 'period2'], focusTokenIds: ['reads1', 'in1', 'room1', 'reads2'], syntax: [syntax('s1', '主语', ['she1']), syntax('v1', '谓语', ['reads1']), syntax('place', '可省的地点状语', ['in1', 'the1', 'room1']), syntax('s2', '主语', ['she2']), syntax('v2', '谓语', ['reads2'])], explanation: 'She reads 已经说清“她读书”，句子骨架完整；in the room 额外回答“在哪里”，可以省略。若任务明确要求说明地点，省略后虽然句子仍成立，却没有表达那个地点。是否必需，要看动词结构和本次要表达的意思，不能把所有地点短语一概而论。', coverage: ['PB09.b'] },
      { id: 'pb09b-local', activity: 'compose', phase: 'practice', meaning: '在房间里', targetTokenIds: ['in1', 'the1', 'room1'], bankTokenIds: ['in1', 'the1', 'room1'], dependsOn: ['pb09b-teach'], syntax: [syntax('place', '地点短语', ['in1', 'the1', 'room1']), syntax('prep', '介词', ['in1'], 1, { parentId: 'place' }), syntax('object', '介词宾语', ['the1', 'room1'], 1, { parentId: 'place' })], coverage: ['PB09.b'] },
      { id: 'pb09b-sentence', activity: 'compose', phase: 'practice', meaning: '她在房间里读书', targetTokenIds: ['she1', 'reads1', 'in1', 'the1', 'room1'], bankTokenIds: ['she1', 'reads1', 'in1', 'the1', 'room1'], dependsOn: ['pb09b-local'], syntax: [syntax('s', '主语', ['she1']), syntax('v', '谓语', ['reads1']), syntax('place', '可省的地点状语', ['in1', 'the1', 'room1'])], coverage: ['PB09.b'] },
      { id: 'pb09b-identify', activity: 'range-identify', phase: 'practice', meaning: '选出可以省略的地点信息', targetTokenIds: ['she1', 'reads1', 'in1', 'the1', 'room1'], bankTokenIds: ['she1', 'reads1', 'in1', 'the1', 'room1'], sourceTokenIds: ['she1', 'reads1', 'in1', 'the1', 'room1'], focusSyntaxId: 'place', dependsOn: ['pb09b-sentence'], syntax: [syntax('s', '主语', ['she1']), syntax('v', '谓语', ['reads1']), syntax('place', '可省的地点状语', ['in1', 'the1', 'room1'])], coverage: ['PB09.b'] },
      { id: 'pb09b-transfer', activity: 'independent-output', phase: 'transfer', meaning: '她睡觉', targetTokenIds: ['she2', 'sleeps'], acceptedAnswers: ['She sleeps.'], revealTarget: false, hideHistory: true, dependsOn: ['pb09b-identify'], coverage: ['PB09.b'] },
    ],
  }),
];
