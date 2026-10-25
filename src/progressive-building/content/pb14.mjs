const syntax = (id, role, ids, level = 0, extra = {}) => ({ id, role, segments: [ids], level, ...extra });
const tokens = [
  { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' }, { id: 'want', text: 'want', kind: 'word', gloss: '想要', partOfSpeech: '动词' }, { id: 'to', text: 'to', kind: 'word', gloss: '去/不定式标记', partOfSpeech: '不定式标记' }, { id: 'learn', text: 'learn', kind: 'word', gloss: '学习', partOfSpeech: '动词' }, { id: 'english', text: 'English', kind: 'word', gloss: '英语', partOfSpeech: '名词' },
  { id: 'to2', text: 'to', kind: 'word', gloss: '去/不定式标记', partOfSpeech: '不定式标记' }, { id: 'read', text: 'read', kind: 'word', gloss: '读', partOfSpeech: '动词' }, { id: 'a', text: 'a', kind: 'word', gloss: '一本', partOfSpeech: '限定词' }, { id: 'book', text: 'book', kind: 'word', gloss: '书', partOfSpeech: '名词' },
];
const fullSyntax = [
  syntax('s', '主语', ['i']), syntax('v', '谓语', ['want']), syntax('o', '不定式短语作宾语', ['to', 'learn', 'english']),
  syntax('inf', '不定式动作片段', ['to', 'learn', 'english'], 1, { parentId: 'o' }),
  syntax('inner-v', '内部动作', ['learn'], 2, { parentId: 'inf' }), syntax('inner-o', '内部宾语', ['english'], 2, { parentId: 'inf' }),
];
export const lesson = {
  schemaVersion: 'progressive-building/3', id: 'pb14-want-to-do-v1', version: 1, knowledgeNode: 'PB14', subgoalIds: ['PB14.a', 'PB14.b', 'PB14.c'], prerequisites: ['PB02', 'PB08'], title: 'want to do：整体宾语和内部动作', tokens,
  steps: [
    { id: 'pb14-teach', activity: 'teach', phase: 'introduction', meaning: '我想要做什么', targetTokenIds: ['i', 'want', 'to', 'learn', 'english'], focusTokenIds: ['want', 'to', 'learn', 'english'], syntax: fullSyntax, explanation: 'want 后面接“想做的事”：to learn English 整体回答 want 什么，作宾语；短语内部，learn 是动作，English 是 learn 的宾语。to 标出不定式形式，不能只把 English 当成 want 的直接宾语。', coverage: ['PB14.a', 'PB14.b', 'PB14.c'] },
    { id: 'pb14-local', activity: 'compose', phase: 'practice', meaning: '学习英语这件事', targetTokenIds: ['to', 'learn', 'english'], bankTokenIds: ['to', 'learn', 'english'], dependsOn: ['pb14-teach'], syntax: [syntax('inf', '不定式动作片段', ['to', 'learn', 'english']), syntax('inner-v', '内部动作', ['learn'], 1, { parentId: 'inf' }), syntax('inner-o', '内部宾语', ['english'], 1, { parentId: 'inf' })], coverage: ['PB14.a', 'PB14.c'] },
    { id: 'pb14-build', activity: 'compose', phase: 'practice', meaning: '我想要学英语', targetTokenIds: ['i', 'want', 'to', 'learn', 'english'], bankTokenIds: ['i', 'want', 'to', 'learn', 'english'], dependsOn: ['pb14-local'], syntax: fullSyntax, coverage: ['PB14.a', 'PB14.b', 'PB14.c'] },
    { id: 'pb14-whole-range', activity: 'range-identify', phase: 'practice', meaning: '选出 want 的完整宾语', targetTokenIds: ['i', 'want', 'to', 'learn', 'english'], bankTokenIds: ['i', 'want', 'to', 'learn', 'english'], sourceTokenIds: ['i', 'want', 'to', 'learn', 'english'], focusSyntaxId: 'o', dependsOn: ['pb14-build'], syntax: fullSyntax, coverage: ['PB14.b'] },
    { id: 'pb14-inner-range', activity: 'range-identify', phase: 'practice', meaning: '选出 learn 的宾语', targetTokenIds: ['i', 'want', 'to', 'learn', 'english'], bankTokenIds: ['i', 'want', 'to', 'learn', 'english'], sourceTokenIds: ['i', 'want', 'to', 'learn', 'english'], focusSyntaxId: 'inner-o', dependsOn: ['pb14-whole-range'], syntax: fullSyntax, coverage: ['PB14.c'] },
    { id: 'pb14-transfer', activity: 'independent-output', phase: 'transfer', meaning: '我想读一本书', targetTokenIds: ['i', 'want', 'to2', 'read', 'a', 'book'], acceptedAnswers: ['I want to read a book.'], revealTarget: false, hideHistory: true, dependsOn: ['pb14-inner-range'], coverage: ['PB14.a', 'PB14.b', 'PB14.c'] },
  ], review: { intervalsDays: [1, 3], stepIds: ['pb14-transfer'] },
};
