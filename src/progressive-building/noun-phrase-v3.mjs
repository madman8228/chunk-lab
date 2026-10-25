const span = (start, end, label, level = 0) => ({ start, end, label, level });
const objectAnnotations = [span(0, 1, '主语'), span(1, 2, '谓语'), span(3, 4, '定语'), span(4, 5, '中心名词'), span(2, 5, '宾语', 1)];

export const nounPhrase = {
  id: 'noun-phrase-preview', label: 'PB04 · 名词短语', knowledgeNode: 'PB04',
  prerequisites: ['PB02'], objectives: ['理解形容词怎样修饰名词', '识别名词短语整体与内部成分', '改变修饰语而保留句子骨架'],
  words: {
    i: { en: 'I', zh: '我', part: '代词' }, need: { en: 'need', zh: '需要', part: '动词' },
    a: { en: 'a', zh: '一个', part: '冠词' }, bag: { en: 'bag', zh: '包', part: '名词' },
    red: { en: 'red', zh: '红色的', part: '形容词' }, blue: { en: 'blue', zh: '蓝色的', part: '形容词' },
    you: { en: 'You', zh: '你', part: '代词' },
  },
  sentence: { wordIds: ['you', 'need', 'a', 'red', 'bag'], zh: '你需要一个红色的包。' },
  sequence: [
    { meaning: '一个包', wordIds: ['a', 'bag'], dependsOn: [], annotations: [span(0, 2, '名词短语')] },
    { meaning: '我需要', wordIds: ['i', 'need'], dependsOn: [], annotations: [span(0, 1, '主语'), span(1, 2, '谓语')] },
    { meaning: '我需要一个包', wordIds: ['i', 'need', 'a', 'bag'], dependsOn: [0, 1], annotations: [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 4, '宾语')] },
    { meaning: '红色的', wordIds: ['red'], dependsOn: [], annotations: [span(0, 1, '形容词')] },
    { type: 'insert-modifier', meaning: '一个红色的包', prompt: 'red 是“红色的”。它说明的是哪个词？', sourceWordIds: ['a', 'bag'], wordIds: ['a', 'red', 'bag'], headWordId: 'bag', modifierWordId: 'red', insertIndex: 1, dependsOn: [0, 3], annotations: [span(1, 2, '定语'), span(2, 3, '中心名词'), span(0, 3, '名词短语', 1)],
      wrongFeedback: 'a 表示一个，不是颜色所描述的东西。红色的是包，请选 bag。', successFeedback: 'red 说明 bag 是什么样的。修饰名词、把它说明白的部分叫定语，所以这里的 red 是定语。' },
    { meaning: '我需要一个红色的包', wordIds: ['i', 'need', 'a', 'red', 'bag'], dependsOn: [1, 4], annotations: objectAnnotations },
    { type: 'teach', meaning: '我需要一个红色的包', wordIds: ['i', 'need', 'a', 'red', 'bag'], dependsOn: [5], annotations: objectAnnotations,
      notes: [
        { wordId: 'bag', focusWordIds: ['a', 'red', 'bag'], term: '整个名词短语作宾语', question: 'I need 什么？', answer: 'a red bag（一个红色的包）', text: 'red 修饰 bag，它们与 a 组成“一个红色的包”。这个整体回答“我需要什么”，所以整个 a red bag 作宾语；内部的 red 仍是定语。' },
      ] },
    { meaning: '蓝色的', wordIds: ['blue'], dependsOn: [], annotations: [span(0, 1, '形容词')] },
    { type: 'replace', meaning: '我需要一个蓝色的包', prompt: '只换表示颜色的定语，改成“我需要一个蓝色的包”。', sourceWordIds: ['i', 'need', 'a', 'red', 'bag'], wordIds: ['i', 'need', 'a', 'blue', 'bag'], replaceIndex: 3, replacement: 'blue', dependsOn: [6, 7], annotations: objectAnnotations,
      wrongFeedback: '这里需要的人、需要的动作和物品种类不变；只换修饰 bag 颜色的词。', successFeedback: '定语从 red 换成 blue，包的颜色变了；整个 a blue bag 仍是 need 的宾语。' },
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
    { meaning: '你需要一个红色的包', wordIds: ['you', 'need', 'a', 'red', 'bag'], dependsOn: [10], annotations: objectAnnotations },
    { type: 'transfer', meaning: '你需要一个蓝色的包', wordIds: ['you', 'need', 'a', 'blue', 'bag'], dependsOn: [11], annotations: objectAnnotations, answers: ['You need a blue bag.'] },
  ],
};
