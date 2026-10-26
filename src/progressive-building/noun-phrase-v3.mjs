const span = (start, end, label, level = 0) => ({ start, end, label, level });
const objectAnnotations = [span(0, 1, '主语'), span(1, 2, '谓语'), span(3, 4, '定语'), span(4, 5, '中心名词'), span(2, 5, '宾语', 1)];

export const nounPhrase = {
  id: 'noun-phrase-preview', label: 'PB04 · 名词短语（已打磨）', knowledgeNode: 'PB04',
  sentenceStepIndexes: [2, 5, 8, 11],
  prerequisites: ['PB02'], objectives: ['理解形容词怎样修饰名词', '识别名词短语整体与内部成分', '改变修饰语而保留句子骨架'],
  words: {
    i: { en: 'I', zh: '我', part: '代词', visualSceneId: 'i' }, need: { en: 'need', zh: '需要', part: '动词' },
    a: { en: 'a', zh: '一个', part: '冠词' }, bag: { en: 'bag', zh: '包', part: '名词', visualSceneId: 'bag' },
    red: { en: 'red', zh: '红色的', part: '形容词', visualSceneId: 'red' }, blue: { en: 'blue', zh: '蓝色的', part: '形容词', visualSceneId: 'blue' },
    you: { en: 'You', zh: '你', part: '代词', visualSceneId: 'you' },
  },
  sentence: { wordIds: ['you', 'need', 'a', 'red', 'bag'], zh: '你需要一个红色的包。' },
  sequence: [
    { meaning: '一个包', wordIds: ['a', 'bag'], bankWordIds: ['a', 'bag'], dependsOn: [], annotations: [span(0, 2, '名词短语')], visual: { sceneId: 'bag', show: 'after-correct' }, learningNote: { term: '名词短语', question: '说的是什么东西？', answer: '一个包', explanation: 'bag 是包，a 表示一个。a bag 一起表示一个东西，是名词短语，还不是完整句子。' } },
    { meaning: '我需要', wordIds: ['i', 'need'], bankWordIds: ['i', 'need'], dependsOn: [0], replacesTrailIndexes: [0], annotations: [span(0, 1, '主语'), span(1, 2, '谓语')], learningNote: { term: '等待补齐的片段', question: '谁需要？', answer: 'I（我）', explanation: 'need 表示需要。这里先练 I need，后面还要补上需要什么，才完成本课这句话。' } },
    { meaning: '我需要一个包', wordIds: ['i', 'need', 'a', 'bag'], bankWordIds: ['i', 'need', 'a', 'bag'], dependsOn: [0, 1], annotations: [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 4, '宾语')], visual: { sceneId: 'i-need-bag', show: 'after-correct' } },
    { meaning: '红色的', wordIds: ['red'], bankWordIds: ['red'], dependsOn: [], clearSentenceResultOnComplete: true, annotations: [span(0, 1, '形容词')], learningNote: { term: '形容词', question: '色卡是什么颜色？', answer: 'red（红色的）', explanation: 'red 描述红色这种颜色。这里看的是颜色本身，不代表某一种物品。' } },
    { meaning: '一个红色的包', wordIds: ['a', 'red', 'bag'], bankWordIds: ['a', 'red', 'bag'], dependsOn: [0, 3], replacesTrailIndexes: [0, 3], annotations: [span(1, 2, '定语'), span(2, 3, '中心名词'), span(0, 3, '名词短语', 1)], visual: { sceneId: 'red-bag', show: 'after-correct' }, learningNote: { term: '定语', question: 'red 说明哪个词？', answer: 'red → bag，红色的是包', explanation: 'red 放在 bag 前，说明包的颜色。在这个短语中，red 修饰名词 bag，叫定语；a red bag 整体仍表示一个包。' } },
    { meaning: '我需要一个红色的包', wordIds: ['i', 'need', 'a', 'red', 'bag'], bankWordIds: ['i', 'need', 'a', 'red', 'bag'], dependsOn: [1, 4], annotations: objectAnnotations, visual: { sceneId: 'i-need-red-bag', show: 'after-correct' }, learningNote: { term: '整个短语作宾语', question: 'I need 什么？', answer: 'a red bag（一个红色的包）', explanation: '整个 a red bag 回答需要什么，所以一起作宾语。短语内部，red 是定语，bag 是中心名词；不能把整个宾语只算成 red 或 bag。' } },
    { meaning: '蓝色的', wordIds: ['blue'], bankWordIds: ['blue'], dependsOn: [], clearSentenceResultOnComplete: true, annotations: [], learningNote: { term: '形容词', question: '色卡是什么颜色？', answer: 'blue（蓝色的）', explanation: 'blue 描述蓝色这种颜色。后面用它说明包的颜色。' } },
    { meaning: '一个蓝色的包', wordIds: ['a', 'blue', 'bag'], bankWordIds: ['a', 'bag', 'blue'], dependsOn: [4, 6], replacesTrailIndexes: [4, 6], annotations: [span(1, 2, '定语'), span(2, 3, '中心名词'), span(0, 3, '名词短语', 1)], visual: { sceneId: 'blue-bag', show: 'after-correct' }, learningNote: { term: '定语变化', question: '包的哪项信息变了？', answer: '颜色从 red 变成 blue', explanation: 'blue 修饰的仍是 bag。这里只换颜色，物品种类仍是包。' } },
    { meaning: '我需要一个蓝色的包', wordIds: ['i', 'need', 'a', 'blue', 'bag'], bankWordIds: ['i', 'need', 'a', 'bag', 'blue'], dependsOn: [5, 7], annotations: objectAnnotations, visual: { sceneId: 'i-need-blue-bag', show: 'after-correct' }, learningNote: { term: '宾语内部的变化', question: '需要什么？', answer: 'a blue bag', explanation: 'I 和 need 不变，宾语内部的定语换成 blue。整个 a blue bag 仍一起作宾语。' } },
    { type: 'classify', meaning: '我需要一个蓝色的包', wordIds: ['i', 'need', 'a', 'blue', 'bag'], focusWordId: 'need', prompt: '哪一组词是这句话的整个宾语？', answer: 'phrase', dependsOn: [8], annotations: objectAnnotations,
      options: [
        { id: 'head', key: 'h', label: 'bag：只取中心名词', feedback: 'bag 是宾语短语的中心名词，但这里只问整个宾语；表示数量和颜色的词也在这个短语内。' },
        { id: 'phrase', key: 'p', label: 'a blue bag：一个蓝色的包', feedback: 'a blue bag 整体回答“I need 什么”。blue 是内部修饰语，bag 是中心名词，整个短语一起作宾语。' },
        { id: 'modifier', key: 'm', label: 'blue：只取颜色', feedback: 'blue 只说明包是什么颜色，不能独自表达这里所需要的整个对象。' },
      ] },
    { type: 'identify', meaning: '我需要一个红色的包', wordIds: ['i', 'need', 'a', 'red', 'bag'], dependsOn: [9], annotations: objectAnnotations, successFeedback: 'red 是修饰颜色的定语，bag 是中心名词；它们与 a 组成整个宾语短语。',
      checks: [
        { prompt: '找出表示颜色的定语。', wordId: 'red', feedback: 'red 修饰 bag 的颜色，是定语。', wrongFeedback: '请找说明包的颜色、修饰名词 bag 的词。' },
        { prompt: '找出宾语短语的中心名词。', wordId: 'bag', feedback: 'bag 说明需要的物品种类，是中心名词。', wrongFeedback: '这里要找物品种类，不是颜色、数量或需要的动作。' },
      ] },
    { meaning: '你需要一个红色的包', wordIds: ['you', 'need', 'a', 'red', 'bag'], bankWordIds: ['you', 'need', 'a', 'red', 'bag'], dependsOn: [10], annotations: objectAnnotations, visual: { sceneId: 'you-need-red-bag', show: 'after-correct' }, learningNote: { term: '主语变化', question: '现在谁需要这个包？', answer: 'You（你）', explanation: '主语换成 You，整个 a red bag 仍是需要的对象，在这句话中作宾语。' } },
    { type: 'transfer', meaning: '你需要一个蓝色的包', wordIds: ['you', 'need', 'a', 'blue', 'bag'], dependsOn: [11], annotations: objectAnnotations, answers: ['You need a blue bag.'], visual: { sceneId: 'you-need-blue-bag', show: 'after-correct' }, successFeedback: 'You 是主语，need 是谓语；整个 a blue bag 是宾语，blue 在短语内部修饰 bag，作定语。' },
  ],
};
