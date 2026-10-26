import { buildPluralPair } from './plural-practice.mjs?v=20261026-27';
const examples = ['book', 'box', 'baby', 'child', 'foot', 'sheep'];
const pairs = examples.map((id, index) => buildPluralPair(id, index * 2));
const phrase = [{ start: 0, end: 2, label: '名词短语', level: 0 }];
export const pluralForms = {
 id: 'plural-forms-preview', label: 'PB05 · 规则与不规则复数（已打磨）', knowledgeNode: 'PB05', review: true, prerequisites: ['PB04'],
 objectives: ['区分复数的数量意义与构成方式', '认识s/es/辅音字母+y的代表规则', '认识特殊词形和单复数同形', '依据词汇资料迁移而非机械加s'],
 words: { a: { en: 'a', zh: '一个', part: '冠词' }, two: { en: 'two', zh: '两个', part: '数词' }, four: { en: 'four', zh: '四个', part: '数词' }, ...Object.assign({}, ...pairs.map(pair => pair.words)) },
 sentence: { wordIds: ['four'], zh: '四个' },
 sequence: [
  ...pairs.flatMap(pair => pair.steps),
  { type: 'classify', meaning: '两个盒子', wordIds: ['two', 'boxPlural'], focusWordId: 'boxPlural', dependsOn: [11], annotations: phrase, prompt: 'box → boxes 属于哪种变化？', answer: 'regular', options: [
   { id: 'irregular', key: 'i', label: '不规则：所有不是加s的词都属于例外', feedback: '规则复数不只有加 s。box 以 x 结尾，按加 es 的规则变成 boxes，仍是规则变化。' },
   { id: 'regular', key: 'r', label: '规则变化：x 结尾，加 es', feedback: 'box → boxes 按 x 结尾加 es 的规则变化。规则复数还包括辅音字母加 y 改为 ies 等情况，不等于一律直接加 s。' }
  ] },
  { type: 'classify', meaning: '两只脚', wordIds: ['two', 'footPlural'], focusWordId: 'footPlural', dependsOn: [12], annotations: phrase, prompt: 'foot 的复数怎样确定？', answer: 'pair', options: [
   { id: 'suffix', key: 's', label: '所有名词都直接加 s，得到 foots', feedback: '复数表示两个及以上，但构成方式不都相同。foot 的标准复数是 feet，需要按这个词的特殊配对记忆，不能写 foots。' },
   { id: 'pair', key: 'p', label: '记住不规则配对：foot → feet', feedback: 'foot → feet 是不规则变化。child → children 也是特殊配对，但不能把 children 的变化方法套给 foot；遇到未学词应查询词汇资料。' }
  ] },
  { type: 'classify', meaning: '两只绵羊', wordIds: ['two', 'sheepPlural'], focusWordId: 'sheepPlural', dependsOn: [13], annotations: phrase, prompt: 'two sheep 的 sheep 是单数还是复数？', answer: 'plural', options: [
   { id: 'singular', key: 's', label: '拼写没变，所以只能是单数', feedback: 'sheep 单复数同形。two 表示两只，因此本短语里的 sheep 是复数；不能仅凭词尾判断单复数。' },
   { id: 'plural', key: 'p', label: '复数：two 表示两只，sheep 单复数同形', feedback: 'a sheep 和 two sheep 中，sheep 拼写相同，单复数由数量和语境确定。复数不一定加 s，也不一定改变拼写。' }
  ] },
  { meaning: '四个', wordIds: ['four'], bankWordIds: ['four'], dependsOn: [14], replacesTrailIndexes: [14], annotations: [], learningNote: { term: '迁移数量', question: 'four 表示多少？', answer: '四个', explanation: '接下来改用四个的数量，自己决定名词应该用什么形式。' } },
  { type: 'transfer', meaning: '四只绵羊', wordIds: ['four', 'sheepPlural'], dependsOn: [15], annotations: phrase, answers: ['Four sheep.'], successFeedback: 'four 表示四只，sheep 在这里用复数；单复数同形，因此不写 sheeps。' },
 ],
};
