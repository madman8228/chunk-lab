import { nounPhrase } from './noun-phrase-v3.mjs';
const span = (start, end, label, level = 0) => ({ start, end, label, level });
const location = [span(0, 1, '介词'), span(1, 3, '介词宾语'), span(0, 3, '介词短语', 1)];
const clause = [span(0, 2, '主语'), span(2, 3, '系动词'), span(3, 4, '介词'), span(4, 6, '介词宾语'), span(3, 6, '地点表语', 1)];
export const locationLesson = {
 id: 'location-preview', label: 'PB06 · 介词短语与位置（已打磨）', knowledgeNode: 'PB06', prerequisites: ['PB03', 'PB05'], sentenceStepIndexes: [2, 4, 6, 7, 10, 13, 14, 17, 19, 21],
 objectives: ['对比内部、表面、下方、紧邻及前后六种位置关系', '理解单词介词与多词位置表达后接参照对象', '区分短语内部介词宾语与整组地点表语', '同时换物品和参照物后独立组句'],
 words: {
  theSubject: { en: 'The', zh: '那', part: '冠词' }, thePlace: { en: 'the', zh: '那', part: '冠词' },
  book: { en: 'book', zh: '书', part: '名词', visualSceneId: 'book' }, bag: nounPhrase.words.bag,
  desk: { en: 'desk', zh: '桌子', part: '名词' }, is: { en: 'is', zh: '在（连接位置）', part: '动词' },
  on: { en: 'on', zh: '在……上', part: '介词' }, under: { en: 'under', zh: '在……下面', part: '介词' },
  box: { en: 'box', zh: '箱子', part: '名词' }, in: { en: 'in', zh: '在……里', part: '介词' },
  next: { en: 'next', zh: '紧邻', part: '副词' }, to: { en: 'to', zh: '（连用）', part: '介词' },
  behind: { en: 'behind', zh: '在……后面', part: '介词' }, inFront: { en: 'in', zh: '（连用）', part: '介词' }, front: { en: 'front', zh: '前面', part: '名词' }, of: { en: 'of', zh: '（连用）', part: '介词' },
 },
 sentence: { wordIds: ['theSubject', 'book', 'is', 'inFront', 'front', 'of', 'thePlace', 'box'], zh: '书在箱子前面。' },
 sequence: [
  { meaning: '那张桌子', wordIds: ['thePlace', 'desk'], bankWordIds: ['thePlace', 'desk'], dependsOn: [], annotations: [span(0, 2, '名词短语')], learningNote: { term: '参照对象', question: '接下来相对于什么说位置？', answer: '双方明确的那张桌子', explanation: 'desk 表示桌子。the desk 指双方清楚是哪张的桌子；接下来用它作位置关系的参照对象。' } },
  { meaning: '在……上', wordIds: ['on'], bankWordIds: ['on'], dependsOn: [0], replacesTrailIndexes: [0], annotations: [], learningNote: { term: '介词 on', question: 'on 表示什么关系？', answer: '本课表示在表面上，并与表面接触', explanation: '介词可以表达事物之间的位置关系。on 在本课中表示位于某物表面上，并有接触。只说 on 还没有交代相对于什么，需要接上参照对象。' } },
  { meaning: '在桌子上', wordIds: ['on', 'thePlace', 'desk'], bankWordIds: ['on', 'thePlace', 'desk'], dependsOn: [0, 1], annotations: location, learningNote: { term: '介词短语', question: 'on 接上什么才交代完整的位置关系？', answer: 'on + the desk', explanation: 'on 是介词，整个 the desk 是它的宾语，叫介词宾语。on the desk 合起来是介词短语，表达在桌子上；单独这一组没有说谁在桌上，还不是完整陈述句。' } },
  { meaning: '这本书在……', wordIds: ['theSubject', 'book', 'is'], bankWordIds: ['theSubject', 'book', 'is'], dependsOn: [2], annotations: [span(0, 2, '主语'), span(2, 3, '系动词')], learningNote: { term: '等待合并的位置句', question: '正在说明什么的位置？', answer: 'The book，这本书', explanation: '整个 The book 作主语。单数物品 book 搭配 be 的形式 is，用来连接主语和后面的位置。这里先练片段，后面还要补书在哪里。' } },
  { meaning: '书在桌子上', wordIds: ['theSubject', 'book', 'is', 'on', 'thePlace', 'desk'], bankWordIds: ['desk', 'thePlace', 'on', 'is', 'book', 'theSubject'], dependsOn: [2, 3], annotations: clause, visual: { sceneId: 'book-on-desk', show: 'after-correct' }, learningNote: { term: '整组说明位置', question: '这本书在哪里？', answer: 'on the desk', explanation: 'The book 是主语，is 是系动词。整个 on the desk 说明书的位置，本句按主系表口径作地点表语。短语内部的 the desk 是 on 的介词宾语，不是 is 的宾语。' } },
  { meaning: '在……下面', wordIds: ['under'], bankWordIds: ['under'], dependsOn: [4], clearSentenceResultOnStart: true, annotations: [], learningNote: { term: '介词 under', question: 'under 表示哪种位置关系？', answer: '在参照物下方', explanation: 'under 在本课中表示在桌子下面，与在桌面上接触的 on 不同。更换介词就改变了位置关系，参照对象仍可保持为 the desk。' } },
  { meaning: '在桌子下面', wordIds: ['under', 'thePlace', 'desk'], bankWordIds: ['under', 'thePlace', 'desk'], dependsOn: [5], annotations: location, learningNote: { term: '换关系，保留参照对象', question: '哪个部分变了？', answer: 'on 换为 under', explanation: 'under 与整个 the desk 合成介词短语，表达在桌子下面。介词表达关系，后面的名词短语交代参照对象。' } },
  { meaning: '书在桌子下面', wordIds: ['theSubject', 'book', 'is', 'under', 'thePlace', 'desk'], bankWordIds: ['desk', 'thePlace', 'under', 'is', 'book', 'theSubject'], dependsOn: [4, 6], annotations: clause, visual: { sceneId: 'book-under-desk', show: 'after-correct' }, successFeedback: '书和参照桌子不变，on 换成 under，书的位置变了。整个 under the desk 在本句中作地点表语。' },
  { type: 'classify', meaning: '书在桌子下面', wordIds: ['theSubject', 'book', 'is', 'under', 'thePlace', 'desk'], focusWordId: 'under', dependsOn: [7], annotations: clause, prompt: '哪一组完整表达本句的位置关系？', answer: 'phrase', options: [
   { id: 'object', key: 'd', label: 'the desk：只说参照物', feedback: 'the desk 只说明哪张桌子，没有说明在上面还是下面。完整位置关系需要介词和它的对象：under the desk。' },
   { id: 'preposition', key: 'u', label: 'under：只说关系', feedback: 'under 只说明在下方，还缺相对于什么。这里的完整介词短语是 under the desk。' },
   { id: 'phrase', key: 'p', label: 'under the desk：关系与参照对象一起', feedback: 'under 表示在下方，the desk 是参照对象。整个 under the desk 说明书的位置，本句作地点表语；不能把这个作用永久贴到 under 单词上。' }
  ] },
  { meaning: '包', wordIds: ['bag'], bankWordIds: ['bag'], dependsOn: [8], replacesTrailIndexes: [8], clearSentenceResultOnStart: true, annotations: [], learningNote: { term: '换被描述的物品', question: '接下来描述什么的位置？', answer: '包', explanation: '把主语中的书换成包，位置表达仍可以复用。本课都指双方清楚的物品，用 the。' } },
  { meaning: '包在桌子上', wordIds: ['theSubject', 'bag', 'is', 'on', 'thePlace', 'desk'], bankWordIds: ['desk', 'thePlace', 'on', 'is', 'bag', 'theSubject'], dependsOn: [9], annotations: clause, visual: { sceneId: 'bag-on-desk', show: 'after-correct' }, successFeedback: 'The bag 作主语，is 连接位置，整个 on the desk 作地点表语。两个 the 分别属于主语物品和参照对象，不可漏掉其中一个。' },
  { meaning: '那只箱子', wordIds: ['thePlace', 'box'], bankWordIds: ['box', 'thePlace'], dependsOn: [10], clearSentenceResultOnStart: true, annotations: [span(0, 2, '名词短语')], learningNote: { term: '换参照物', question: '这次相对于什么说位置？', answer: '那只箱子', explanation: 'the box 指双方明确的箱子。参照物可以改变，介词短语的组合方式仍可复用。' } },
  { meaning: '在……里面', wordIds: ['in'], bankWordIds: ['in'], dependsOn: [11], replacesTrailIndexes: [11], annotations: [], learningNote: { term: '内部、表面与下方', question: 'in 与 on、under 有什么区别？', answer: 'in 表示在内部；on 在表面上；under 在下方', explanation: '本课中，in 表示处于容器内部。on 强调与表面接触；under 表示位置在下方，不表示装在里面。这里讲的是空间用法，不把它推广到时间等其他用法。' } },
  { meaning: '在箱子里', wordIds: ['in', 'thePlace', 'box'], bankWordIds: ['box', 'thePlace', 'in'], dependsOn: [11, 12], annotations: location, successFeedback: 'in + the box 合成介词短语；the box 是介词的宾语，说明在哪个容器里面。' },
  { meaning: '书在箱子里', wordIds: ['theSubject', 'book', 'is', 'in', 'thePlace', 'box'], bankWordIds: ['box', 'thePlace', 'in', 'is', 'book', 'theSubject'], dependsOn: [13], annotations: clause, visual: { sceneId: 'book-in-box', show: 'after-correct' }, successFeedback: '书在箱子的内部，所以用 in the box。整个 in the box 在本句作地点表语；参照物从桌子换成箱子，结构并没有改变。' },
  { type: 'classify', meaning: '书放在箱子的内部', wordIds: ['theSubject', 'book', 'is', 'in', 'thePlace', 'box'], focusWordId: 'in', dependsOn: [14], annotations: clause, prompt: '书装在箱子内部，哪一种位置关系准确？', answer: 'inside', options: [
   { id: 'surface', key: 'o', label: 'on：在表面上', feedback: 'on 在这里表示与表面接触，不能表达书装在箱子内部。内部关系用 in。' },
   { id: 'inside', key: 'i', label: 'in：在内部', feedback: 'in 表示在箱子内部。先确定空间关系，再选择介词，不能只根据后面的名词猜。' },
   { id: 'below', key: 'u', label: 'under：在下方', feedback: 'under 表示位置在下方，不等于被箱子装在里面。内部关系用 in。' },
  ] },
  { meaning: '在……紧旁边', wordIds: ['next', 'to'], bankWordIds: ['to', 'next'], dependsOn: [15], replacesTrailIndexes: [15], clearSentenceResultOnStart: true, annotations: [span(0, 2, '复合介词')], learningNote: { term: '多个词共同表达关系', question: 'next to 要作为几组意思理解？', answer: '作为一组，表示紧挨着、在旁边', explanation: 'next to 在本课中作为复合介词使用，to 不能漏。逐词选择，理解时把 next to 看成一组；后面仍然接参照对象。' } },
  { meaning: '书在箱子紧旁边', wordIds: ['theSubject', 'book', 'is', 'next', 'to', 'thePlace', 'box'], bankWordIds: ['box', 'thePlace', 'to', 'next', 'is', 'book', 'theSubject'], dependsOn: [11, 16], annotations: [span(0, 2, '主语'), span(2, 3, '系动词'), span(3, 5, '复合介词'), span(5, 7, '介词宾语'), span(3, 7, '地点表语', 1)], visual: { sceneId: 'book-next-to-box', show: 'after-correct' }, successFeedback: 'next to 两个词共同表达紧邻关系，后接 the box。整个 next to the box 说明书的位置。不能只保留 next，也不要求每个词单独承担一个整句成分。' },
  { meaning: '在……后面', wordIds: ['behind'], bankWordIds: ['behind'], dependsOn: [17], clearSentenceResultOnStart: true, annotations: [], learningNote: { term: '前后关系', question: 'behind 说明什么位置？', answer: '在参照物后面', explanation: 'behind 表示在后方，不等于在里面。接下来以画面中面向我们的箱子正面为参照，书位于箱子后方。' } },
  { meaning: '书在箱子后面', wordIds: ['theSubject', 'book', 'is', 'behind', 'thePlace', 'box'], bankWordIds: ['box', 'thePlace', 'behind', 'is', 'book', 'theSubject'], dependsOn: [18], annotations: clause, visual: { sceneId: 'book-behind-box', show: 'after-correct' }, successFeedback: 'behind the box 表示在箱子后方。参照物仍是箱子，只更换位置关系；整个短语在本句作地点表语。' },
  { meaning: '在……前面', wordIds: ['inFront', 'front', 'of'], bankWordIds: ['of', 'front', 'inFront'], dependsOn: [19], clearSentenceResultOnStart: true, annotations: [span(0, 3, '复合介词')], learningNote: { term: '整体理解位置表达', question: 'in front of 是箱子里面吗？', answer: '不是，整体表示在……前面', explanation: 'in front of 三个词合起来表示在某物前面，不把这里的 in 单独理解成在内部。of 不能漏。它与 behind 表达相对的位置关系。' } },
  { meaning: '书在箱子前面', wordIds: ['theSubject', 'book', 'is', 'inFront', 'front', 'of', 'thePlace', 'box'], bankWordIds: ['box', 'thePlace', 'of', 'front', 'inFront', 'is', 'book', 'theSubject'], dependsOn: [20], annotations: [span(0, 2, '主语'), span(2, 3, '系动词'), span(3, 6, '复合介词'), span(6, 8, '介词宾语'), span(3, 8, '地点表语', 1)], visual: { sceneId: 'book-in-front-of-box', show: 'after-correct' }, successFeedback: '整个 in front of 表达前方关系，the box 说明参照对象。书在箱子外的前方，与 in the box 的内部关系不同。' },
  { type: 'transfer', meaning: '包在桌子后面', wordIds: ['theSubject', 'bag', 'is', 'behind', 'thePlace', 'desk'], dependsOn: [21], annotations: clause, answers: ['The bag is behind the desk.', "The bag's behind the desk."], successFeedback: '把书换成包、箱子换成桌子，behind + the desk 的结构仍能复用。整个 The bag 作主语，behind the desk 作地点表语。这是新组合，不是照抄上一句。' },
 ],
};
