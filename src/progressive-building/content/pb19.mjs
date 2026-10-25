const syntax = (id, role, ids, level = 0) => ({ id, role, segments: [ids], level });
const lesson = ({ id, title, tokens, focusIds, targetIds, meaning, explanation, syntaxNodes, transferIds, answer, transferMeaning, coverage, prerequisites = ['PB16', 'PB17'] }) => ({
  schemaVersion: 'progressive-building/3', id, version: 1, knowledgeNode: 'PB19', subgoalIds: coverage, prerequisites, title, tokens,
  review: { intervalsDays: [1, 3], stepIds: [`${id}-transfer`] },
  steps: [
    { id: `${id}-teach`, activity: 'teach', phase: 'introduction', meaning, targetTokenIds: targetIds, focusTokenIds: targetIds, syntax: syntaxNodes, explanation, coverage },
    { id: `${id}-focus`, activity: 'compose', phase: 'practice', meaning: '先搭出所问的信息', targetTokenIds: focusIds, bankTokenIds: focusIds, dependsOn: [`${id}-teach`], syntax: [syntax('focus', '所问的信息', focusIds)], coverage },
    { id: `${id}-question`, activity: 'compose', phase: 'practice', meaning, targetTokenIds: targetIds, bankTokenIds: targetIds, dependsOn: [`${id}-focus`], syntax: syntaxNodes, coverage },
    { id: `${id}-transfer`, activity: 'independent-output', phase: 'transfer', meaning: transferMeaning, targetTokenIds: transferIds, acceptedAnswers: [answer], revealTarget: false, hideHistory: true, dependsOn: [`${id}-question`], coverage },
  ],
});

const whatTokens = [
  { id: 'what', text: 'What', kind: 'word', gloss: '什么', partOfSpeech: '疑问代词' }, { id: 'do', text: 'do', kind: 'word', gloss: '助动词', partOfSpeech: '助动词' }, { id: 'you', text: 'you', kind: 'word', gloss: '你', partOfSpeech: '代词' }, { id: 'need', text: 'need', kind: 'word', gloss: '需要', partOfSpeech: '动词' }, { id: 'period', text: '?', kind: 'punctuation' }, { id: 'want', text: 'want', kind: 'word', gloss: '想要', partOfSpeech: '动词' },
];
const whereTokens = [
  { id: 'where', text: 'Where', kind: 'word', gloss: '哪里', partOfSpeech: '疑问副词' }, { id: 'do', text: 'do', kind: 'word', gloss: '助动词', partOfSpeech: '助动词' }, { id: 'you', text: 'you', kind: 'word', gloss: '你', partOfSpeech: '代词' }, { id: 'work', text: 'work', kind: 'word', gloss: '工作', partOfSpeech: '动词' }, { id: 'period', text: '?', kind: 'punctuation' }, { id: 'when', text: 'When', kind: 'word', gloss: '什么时候', partOfSpeech: '疑问副词' }, { id: 'arrive', text: 'arrive', kind: 'word', gloss: '到达', partOfSpeech: '动词' }, { id: 'we', text: 'we', kind: 'word', gloss: '我们', partOfSpeech: '代词' },
];
const contrastTokens = [
  { id: 'who', text: 'Who', kind: 'word', gloss: '谁', partOfSpeech: '疑问代词' }, { id: 'can', text: 'can', kind: 'word', gloss: '能', partOfSpeech: '情态动词' }, { id: 'help', text: 'help', kind: 'word', gloss: '帮助', partOfSpeech: '动词原形' }, { id: 'you', text: 'you', kind: 'word', gloss: '你', partOfSpeech: '代词' }, { id: 'q1', text: '?', kind: 'punctuation' }, { id: 'who2', text: 'Who', kind: 'word', gloss: '谁', partOfSpeech: '疑问代词' }, { id: 'can2', text: 'can', kind: 'word', gloss: '能', partOfSpeech: '情态动词' }, { id: 'you2', text: 'you', kind: 'word', gloss: '你', partOfSpeech: '代词' }, { id: 'help2', text: 'help', kind: 'word', gloss: '帮助', partOfSpeech: '动词原形' }, { id: 'q2', text: '?', kind: 'punctuation' },
];

export const courses = [
  lesson({ id: 'pb19-what-question-v1', title: 'What：询问动作涉及什么', tokens: whatTokens, focusIds: ['what'], targetIds: ['what', 'do', 'you', 'need'], meaning: '你需要什么', explanation: 'What do you need? 中，what 是 need 的宾语，询问“需要什么”。疑问词移到句首；do 仍放在主语 you 前，need 保持原形。所问成分是宾语，所以句中仍保留“谁需要”。', syntaxNodes: [syntax('o', '疑问词作宾语', ['what']), syntax('aux', '助动词', ['do']), syntax('s', '主语', ['you']), syntax('v', '谓语', ['need'])], transferIds: ['what', 'do', 'you', 'want'], answer: 'What do you want?', transferMeaning: '你想要什么', coverage: ['PB19.a'] }),
  lesson({ id: 'pb19-where-when-v1', title: 'Where / When：询问地点与时间', tokens: whereTokens, focusIds: ['where'], targetIds: ['where', 'do', 'you', 'work'], meaning: '你在哪里工作', explanation: 'Where do you work? 的 where 询问 work 发生的地点，不是主语或宾语。When do you arrive? 同理，when 询问时间。疑问词在句首，do + 主语 + 动词原形的次序保留。', syntaxNodes: [syntax('adv', '地点疑问信息', ['where']), syntax('aux', '助动词', ['do']), syntax('s', '主语', ['you']), syntax('v', '谓语', ['work'])], transferIds: ['when', 'do', 'we', 'arrive'], answer: 'When do we arrive?', transferMeaning: '我们什么时候到', coverage: ['PB19.a'] }),
  lesson({ id: 'pb19-subject-object-who-v1', title: 'Who 作主语还是宾语', tokens: contrastTokens, focusIds: ['who'], targetIds: ['who', 'can', 'help', 'you'], meaning: '谁能帮助你', explanation: 'Who can help you? 里 who 是 help 的主语。Who can you help? 里 you 是主语，who 是 help 的宾语。两句都使用已学过的 can，因此 can 仍在主语前；比较的是 who 在句子里的成分位置，不把某一种时态的助动词规则误当成所有疑问句通则。', syntaxNodes: [syntax('s', '疑问词作主语', ['who']), syntax('m', '情态动词', ['can']), syntax('v', '谓语动词原形', ['help']), syntax('o', '宾语', ['you'])], transferIds: ['who2', 'can2', 'you2', 'help2'], answer: 'Who can you help?', transferMeaning: '你能帮助谁', coverage: ['PB19.b', 'PB19.c'], prerequisites: ['PB16', 'PB17', 'PB18'] }),
];
