import { foundations } from './foundations-v3.mjs?v=20261026-9';

const span = (start, end, label) => ({ start, end, label, level: 0 });
const svo = [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 3, '宾语')];
const svc = [span(0, 1, '主语'), span(1, 2, '系动词'), span(2, 3, '表语')];
const option = (id, key, label, feedback) => ({ id, key, label, feedback });

export const mixedReview = {
  id: 'foundation-mixed-review-preview', label: '综合 · 三种结构复习（已打磨）', review: true,
  prerequisites: ['PB01', 'PB02', 'PB03'], objectives: ['区分动作陈述、动词涉及的对象与主语状态', '依据句法作用修改表达'],
  words: Object.assign({}, ...foundations.map(course => course.words)),
  sentence: { wordIds: ['you', 'are', 'happy'], zh: '你很高兴。' },
  sequence: [
    { type: 'classify', meaning: '我休息', wordIds: ['i', 'rest'], focusWordId: 'rest', prompt: 'rest 在这句话里为什么是谓语？', answer: 'predicate', dependsOn: [], annotations: [span(0, 1, '主语'), span(1, 2, '谓语')],
      options: [
        option('object', 'o', '它是动作涉及的对象', '这句没有另一个动作涉及 rest；rest 自己是陈述 I 做什么的动词。'),
        option('predicate', 'v', '它直接陈述 I 做什么', 'I 是句子陈述的对象，rest 说明 I 休息，所以 rest 是谓语。'),
        option('subject', 's', '它是句子陈述的对象', '句子陈述的是 I；rest 是对 I 所做的事的说明。'),
      ] },
    { type: 'classify', meaning: '你喜欢咖啡', wordIds: ['you', 'like', 'coffee'], focusWordId: 'coffee', prompt: 'coffee 在这句话中是什么作用？', answer: 'object', dependsOn: [0], annotations: svo,
      options: [
        option('predicative', 'p', '表语：描述 You 的状态', 'coffee 不是 You 的状态，而是 You 喜欢的对象。'),
        option('subject', 's', '主语：这句话说的是它', '句子说的是 You 的喜好；coffee 是喜欢的对象。'),
        option('object', 'o', '宾语：说明喜欢什么', '问“You 喜欢什么”，回答 coffee，所以 coffee 是 like 的宾语。'),
      ] },
    { type: 'classify', meaning: '我准备好了', wordIds: ['i', 'am', 'ready'], focusWordId: 'ready', prompt: 'ready 也在句末，为什么不是宾语？', answer: 'predicative', dependsOn: [1], annotations: svc,
      options: [
        option('predicative', 'p', '表语：描述的就是 I 的状态', 'ready 描述 I 已准备好的状态；am 连接 I 与这个状态，所以 ready 是表语。句末位置不决定它是宾语。'),
        option('object', 'o', '宾语：它是 am 涉及的另一个对象', 'ready 没有引出另一个对象，而是在说明 I 的状态。'),
        option('predicate', 'v', '谓语：ready 自己是动作动词', 'ready 在这里是形容词；am 与表语一起陈述 I 的状态，不能把 ready 单独当作谓语动词。'),
      ] },
    { meaning: '你喜欢咖啡', bankWordIds: ['you', 'like', 'coffee'], wordIds: ['you', 'like', 'coffee'], dependsOn: [1, 2], annotations: svo, visual: { sceneId: 'you-like-coffee', show: 'after-correct' }, learningNote: { term: '宾语变化', question: '喜欢的对象是什么？', answer: 'coffee（咖啡）', explanation: 'You 是主语，like 陈述喜好；coffee 是喜欢的对象，作宾语。与茶相比，改变的是喜欢什么。' } },
    { type: 'classify', meaning: '我很高兴', wordIds: ['i', 'am', 'happy'], focusWordId: 'am', prompt: 'am 在这句话中起什么作用？', answer: 'link', dependsOn: [3], annotations: svc,
      options: [
        option('object', 'o', '宾语：是 I 喜欢的对象', '这句没有表达“喜欢什么”；am 是连接 I 与 happy 的动词。'),
        option('link', 'b', '系动词：把 I 和 happy 连接起来', 'happy 描述 I 的状态，am 在这里连接主语和表语。中文“我很高兴”里没有“是”，也不能因此省略 am。'),
        option('predicative', 'p', '表语：am 自己表示高兴的状态', '表示高兴状态的是 happy；am 负责连接。'),
      ] },
    { meaning: '你准备好了', bankWordIds: ['you', 'are', 'ready'], wordIds: ['you', 'are', 'ready'], dependsOn: [2, 4], annotations: svc, visual: { sceneId: 'you-are-ready', show: 'after-correct' }, learningNote: { term: '表语变化', question: '现在描述谁的什么状态？', answer: 'You 准备好了', explanation: 'You 是主语，are 是系动词；ready 描述 You 的状态，作表语。状态发生在同一个人身上，没有增加另一个对象。' } },
    { type: 'classify', meaning: '你工作', wordIds: ['you', 'work'], focusWordId: 'you', prompt: 'You 为什么是这句话的主语？', answer: 'subject', dependsOn: [5], annotations: [span(0, 1, '主语'), span(1, 2, '谓语')],
      options: [
        option('predicate', 'v', '因为它说明做什么', '说明做什么的是 work；You 是被陈述的人。'),
        option('object', 'o', '因为它承受 work 的动作', 'work 在本句不带宾语；句子是在说 You 工作。'),
        option('subject', 's', '因为句子陈述的是 You 做什么', '句子以 You 为陈述对象，work 说明 You 做什么，所以 You 是主语。'),
      ] },
    { type: 'identify', meaning: '我喜欢茶', wordIds: ['i', 'like', 'tea'], dependsOn: [6], annotations: svo, successFeedback: 'tea 是喜欢的对象，like 陈述喜好，I 是产生喜好的人。',
      checks: [
        { prompt: '找出宾语。', wordId: 'tea', feedback: 'tea 回答喜欢什么，是宾语。', wrongFeedback: '请找“喜欢什么”的对象。' },
        { prompt: '找出谓语。', wordId: 'like', feedback: 'like 陈述 I 的喜好，是谓语。', wrongFeedback: '请找陈述喜欢这一态度的动词。' },
        { prompt: '找出主语。', wordId: 'i', feedback: 'I 是句子陈述的对象，是主语。', wrongFeedback: '请找这句话说的是谁。' },
      ] },
    { meaning: '我休息', bankWordIds: ['i', 'rest'], wordIds: ['i', 'rest'], dependsOn: [7], annotations: [span(0, 1, '主语'), span(1, 2, '谓语')], visual: { sceneId: 'i-rest', show: 'after-correct' }, learningNote: { term: '主谓', question: '谁做什么？', answer: 'I 休息', explanation: 'I 是主语，rest 在这句话中作谓语，直接说明我做什么。这句不需要 am，也没有宾语。' } },
    { meaning: '你很高兴', bankWordIds: ['you', 'are', 'happy'], wordIds: ['you', 'are', 'happy'], dependsOn: [8], annotations: svc, visual: { sceneId: 'you-are-happy', show: 'after-correct' }, learningNote: { term: '主系表', question: '谁怎么样？', answer: 'You 很高兴', explanation: 'happy 描述 You 的状态，are 连接主语与表语。这里不能省略 are，也不能用与 I 搭配的 am。' } },
    { type: 'transfer', meaning: '你喜欢茶', wordIds: ['you', 'like', 'tea'], dependsOn: [9], annotations: svo, answers: ['You like tea.'], visual: { sceneId: 'you-like-tea', show: 'after-correct' }, successFeedback: 'You 是主语，like 陈述喜好，tea 是喜欢的对象，作宾语。like 是实义动词，这句不加 are。' },
  ],
};
