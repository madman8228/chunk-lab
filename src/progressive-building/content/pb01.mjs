export const lesson = {
  schemaVersion: 'progressive-building/3',
  id: 'pb01-subject-predicate-v1',
  version: 1,
  knowledgeNode: 'PB01',
  subgoalIds: ['PB01.a', 'PB01.b', 'PB01.c'],
  prerequisites: [],
  title: '谁在做什么',
  tokens: [
    { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '人称代词' },
    { id: 'work', text: 'work', kind: 'word', gloss: '工作', partOfSpeech: '动词' },
    { id: 'you', text: 'You', kind: 'word', gloss: '你', partOfSpeech: '人称代词' },
    { id: 'rest', text: 'rest', kind: 'word', gloss: '休息', partOfSpeech: '动词' },
    { id: 'she', text: 'She', kind: 'word', gloss: '她', partOfSpeech: '人称代词' },
    { id: 'rests', text: 'rests', kind: 'word', gloss: '休息', partOfSpeech: '动词', lemma: 'rest', inflection: 'third-person-singular' },
    { id: 'period', text: '.', kind: 'punctuation' },
  ],
  steps: [
    {
      id: 'pb01-local-subject', activity: 'compose', phase: 'introduction', meaning: '我',
      targetTokenIds: ['i'], bankTokenIds: ['i'], syntax: [{ id: 's1', role: '主语', segments: [['i']], level: 0 }],
      coverage: ['PB01.a'],
    },
    {
      id: 'pb01-local-predicate', activity: 'compose', phase: 'introduction', meaning: '工作',
      targetTokenIds: ['work'], bankTokenIds: ['work'], dependsOn: ['pb01-local-subject'],
      syntax: [{ id: 'p1', role: '谓语', segments: [['work']], level: 0 }], coverage: ['PB01.b'],
    },
    {
      id: 'pb01-merge', activity: 'compose', phase: 'practice', meaning: '我工作',
      targetTokenIds: ['i', 'work'], bankTokenIds: ['i', 'work'], dependsOn: ['pb01-local-subject', 'pb01-local-predicate'],
      syntax: [
        { id: 's1', role: '主语', segments: [['i']], level: 0 },
        { id: 'p1', role: '谓语', segments: [['work']], level: 0 },
      ], coverage: ['PB01.a', 'PB01.b'],
    },
    {
      id: 'pb01-explain', activity: 'teach', phase: 'introduction', meaning: '我工作',
      targetTokenIds: ['i', 'work'], focusTokenIds: ['i', 'work'], dependsOn: ['pb01-merge'],
      syntax: [
        { id: 's1', role: '主语', segments: [['i']], level: 0 },
        { id: 'p1', role: '谓语', segments: [['work']], level: 0 },
      ],
      explanation: '在 I work 里，I 是这句话说的对象；work 说明 I 做什么。说“谁”是主语，说明主语“做什么”的动词在这里作谓语。',
      coverage: ['PB01.a', 'PB01.b'],
    },
    {
      id: 'pb01-identify-subject', activity: 'range-identify', phase: 'practice', meaning: '主语',
      targetTokenIds: ['i', 'work'], bankTokenIds: ['i', 'work'], sourceTokenIds: ['i', 'work'], focusSyntaxId: 's1', dependsOn: ['pb01-explain'],
      syntax: [
        { id: 's1', role: '主语', segments: [['i']], level: 0 },
        { id: 'p1', role: '谓语', segments: [['work']], level: 0 },
      ], coverage: ['PB01.a', 'PB01.c'],
    },
    {
      id: 'pb01-identify-predicate', activity: 'range-identify', phase: 'practice', meaning: '谓语',
      targetTokenIds: ['i', 'work'], bankTokenIds: ['i', 'work'], sourceTokenIds: ['i', 'work'], focusSyntaxId: 'p1', dependsOn: ['pb01-identify-subject'],
      syntax: [
        { id: 's1', role: '主语', segments: [['i']], level: 0 },
        { id: 'p1', role: '谓语', segments: [['work']], level: 0 },
      ], coverage: ['PB01.b', 'PB01.c'],
    },
    {
      id: 'pb01-change-subject', activity: 'transform', phase: 'practice', meaning: '只换成“你工作”里的“谁”',
      targetTokenIds: ['you', 'work'], dependsOn: ['pb01-identify-predicate'],
      sourceTokenIds: ['i', 'work'], focusTokenIds: ['i'],
      operations: [{ type: 'replace', from: ['i'], to: ['you'], key: 'y', explanation: '换了这句话说谁，work 所表达的事情保持不变。' }],
      syntax: [
        { id: 's1', role: '主语', segments: [['you']], level: 0 },
        { id: 'p1', role: '谓语', segments: [['work']], level: 0 },
      ], coverage: ['PB01.a', 'PB01.c'],
    },
    {
      id: 'pb01-change-predicate', activity: 'transform', phase: 'practice', meaning: '只换成“你休息”里的“做什么”',
      targetTokenIds: ['you', 'rest'], dependsOn: ['pb01-change-subject'],
      sourceTokenIds: ['you', 'work'], focusTokenIds: ['work'],
      operations: [{ type: 'replace', from: ['work'], to: ['rest'], key: 'r', explanation: '换了谓语，仍然是 You 在做这件事。' }],
      syntax: [
        { id: 's1', role: '主语', segments: [['you']], level: 0 },
        { id: 'p1', role: '谓语', segments: [['rest']], level: 0 },
      ], coverage: ['PB01.b', 'PB01.c'],
    },
    {
      id: 'pb01-transfer', activity: 'independent-output', phase: 'transfer', meaning: '她休息',
      targetTokenIds: ['she', 'rests', 'period'], dependsOn: ['pb01-change-predicate'],
      acceptedAnswers: ['She rests.'], revealTarget: false, hideHistory: true,
      syntax: [
        { id: 's1', role: '主语', segments: [['she']], level: 0 },
        { id: 'p1', role: '谓语', segments: [['rests']], level: 0 },
      ], coverage: ['PB01.a', 'PB01.b', 'PB01.c'],
    },
  ],
  review: { intervalsDays: [1, 3], stepIds: ['pb01-transfer'] },
};
