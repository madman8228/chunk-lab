const word = (en, zh, part) => ({ en, zh, part });
const span = (start, end, label) => ({ start, end, label, level: 0 });
const personVisual = { sceneId: 'like-person', show: 'practice' };
const personAnd = id => ({ sceneId: `like-${id}`, show: 'practice' });

export const likeTransfer = {
  id: 'like-transfer-preview',
  label: '喜好迁移 · 配图样例',
  objectives: ['理解 like 表达喜好', '替换喜欢的对象，迁移组成新句'],
  prerequisites: ['PB01'],
  sentenceStepIndexes: [2, 4, 6, 8],
  words: {
    i: { ...word('I', '我', '人称代词'), visualSceneId: 'i' },
    like: { ...word('like', '喜欢', '动词'), visualSceneId: 'like' },
    apples: { ...word('apples', '苹果', '名词复数'), visualSceneId: 'apple' },
    coffee: { ...word('coffee', '咖啡', '名词'), visualSceneId: 'coffee' },
    tea: { ...word('tea', '茶', '名词'), visualSceneId: 'tea' },
    you: { ...word('You', '你', '人称代词'), visualSceneId: 'you' },
    work: { ...word('work', '工作', '动词'), visualSceneId: 'work' },
  },
  sentence: { wordIds: ['i', 'like', 'tea'], zh: '我喜欢茶。' },
  sequence: [
    { meaning: '我', wordIds: ['i'], bankWordIds: ['i', 'you'], dependsOn: [], annotations: [span(0, 1, '主语')],
      wordFeedback: { you: 'You 是“你”。这一步要说“我”，请选择 I。' } },
    { meaning: '喜欢', wordIds: ['like'], bankWordIds: ['like', 'work'], dependsOn: [], annotations: [span(0, 1, '动词')],
      wordFeedback: { work: 'work 是“工作”。这一步要表达喜好，请选择 like。' } },
    { meaning: '我喜欢', wordIds: ['i', 'like'], dependsOn: [0, 1], annotations: [span(0, 1, '主语'), span(1, 2, '谓语')], visual: personVisual,
      learningNote: { term: '主语 + 谓语', question: '谁表达了喜欢？', answer: 'I（我）like（喜欢）', explanation: 'I 说明是谁喜欢，like 说明这个人表达了什么态度。like 在这里是动词，和主语 I 一起组成“我喜欢”。' } },
    { meaning: '苹果', wordIds: ['apples'], bankWordIds: ['apples', 'coffee', 'tea'], dependsOn: [], annotations: [span(0, 1, '名词')],
      wordFeedback: { coffee: 'coffee 是“咖啡”，tea 是“茶”。这一步请选择“苹果” apples。', tea: 'tea 是“茶”。这一步请选择“苹果” apples。' } },
    { meaning: '我喜欢苹果', wordIds: ['i', 'like', 'apples'], dependsOn: [2, 3], annotations: [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 3, '宾语')], visual: personAnd('apple'),
      learningNote: { term: '加入喜欢的对象', question: '我喜欢什么？', answer: 'apples（苹果）', explanation: 'apples 是 I 喜欢的对象，在 I like apples 中作宾语。人物图保持不变，只把对象换成咖啡或茶，句子就能表达不同喜好。' } },
    { meaning: '咖啡', wordIds: ['coffee'], bankWordIds: ['coffee', 'apples', 'tea'], dependsOn: [], clearSentenceResultOnComplete: true, annotations: [span(0, 1, '名词')],
      wordFeedback: { apples: 'apples 是“苹果”。这一步请选择“咖啡” coffee。', tea: 'tea 是“茶”。这一步请选择“咖啡” coffee。' } },
    { meaning: '我喜欢咖啡', wordIds: ['i', 'like', 'coffee'], dependsOn: [4, 5], annotations: [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 3, '宾语')], visual: personAnd('coffee'),
      learningNote: { term: '替换喜欢的对象', question: '这次我喜欢什么？', answer: 'coffee（咖啡）', explanation: 'I 和 like 保持不变，喜欢的对象从 apples 换成 coffee。coffee 是 like 涉及的对象，在这句话中作宾语。' } },
    { meaning: '茶', wordIds: ['tea'], bankWordIds: ['tea', 'apples', 'coffee'], dependsOn: [], clearSentenceResultOnComplete: true, annotations: [span(0, 1, '名词')],
      wordFeedback: { apples: 'apples 是“苹果”。这一步请选择“茶” tea。', coffee: 'coffee 是“咖啡”。这一步请选择“茶” tea。' } },
    { meaning: '我喜欢茶', wordIds: ['i', 'like', 'tea'], dependsOn: [6, 7], annotations: [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 3, '宾语')], visual: personAnd('tea'),
      learningNote: { term: '迁移组成新句', question: '我喜欢什么？', answer: 'tea（茶）', explanation: '把已经学过的 I、like 和新对象 tea 组合起来，就得到 I like tea。三句共用同一个人物，变化的只有喜欢的对象。' } },
  ],
};
