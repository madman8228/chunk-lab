import { locationLesson } from './location-v3.mjs';
const span = (start, end, label, level = 0) => ({ start, end, label, level });
const phrase = [span(0, 2, '中心部分'), span(2, 5, '后置定语'), span(0, 5, '名词短语', 1)];
const clause = [span(0, 2, '主语中心'), span(2, 5, '后置定语'), span(5, 6, '系动词'), span(6, 7, '表语'), span(0, 5, '完整主语', 1)];
export const postmodifier = {
 id: 'book-on-desk-preview', label: 'PB07 · 后置定语与主语扩展（已打磨）', knowledgeNode: 'PB07', prerequisites: ['PB03', 'PB06'],
 objectives: ['理解位置短语可以修饰名词', '区分中心名词与完整主语', '区分相同介词短语在不同句中的作用', '换物品和修饰信息后独立表达'],
 sentenceStepIndexes: [2, 5, 8, 9, 11, 12],
 words: {
  ...Object.fromEntries(['theSubject','thePlace','book','bag','desk','on','under'].map(id => [id, locationLesson.words[id]])),
  is: { en: 'is', zh: '是', part: '动词' }, mine: { en: 'mine', zh: '我的', part: '代词' },
 },
 sentence: { wordIds: ['theSubject','bag','on','thePlace','desk','is','mine'], zh: '桌上的那个包是我的。' },
 sequence: [
  { meaning: '那本书', wordIds: ['theSubject','book'], bankWordIds: ['book','theSubject'], dependsOn: [], annotations: [span(0,2,'名词短语')], learningNote: { term: '先确定中心名词', question: '我们要进一步说明哪个物品？', answer: 'book，书', explanation: 'The book 指双方明确的那本书。接下来补充位置，进一步说明我们说的是哪本书。' } },
  { meaning: '在桌子上', wordIds: ['on','thePlace','desk'], bankWordIds: ['desk','thePlace','on'], dependsOn: [0], replacesTrailIndexes: [0], annotations: [span(0,1,'介词'),span(1,3,'介词宾语'),span(0,3,'介词短语',1)], learningNote: { term: '位置短语修饰名词', question: '用这个位置可以说明哪本书吗？', answer: '可以：桌上的那本书', explanation: 'on the desk 表示在桌子上。把它接在 book 后面，说明哪一本书：on the desk → book。这种放在名词后面的修饰成分，叫后置定语。' } },
  { meaning: '桌上的那本书', wordIds: ['theSubject','book','on','thePlace','desk'], bankWordIds: ['desk','thePlace','on','book','theSubject'], dependsOn: [0,1], annotations: phrase, visual: {sceneId:'book-on-desk',show:'after-correct'}, learningNote: { term: '扩展名词短语', question: 'on the desk 修饰谁？', answer: '修饰 book，说明哪本书', explanation: '整个 The book on the desk 是一个名词短语，还没有说这本书怎么样。与 The book is on the desk 不同，这里没有 is，on the desk 紧接 book 作后置定语。' } },
  { meaning: '我的（指我的东西）', wordIds: ['mine'], bankWordIds: ['mine'], dependsOn: [2], clearSentenceResultOnStart: true, annotations: [], learningNote: {term:'所有关系',question:'mine 表示什么？',answer:'我的东西；本课指我的书或包',explanation:'mine 是名词性物主代词，可以独立使用。这里表示我的书；不在 mine 后再加 book，也不能用表示“我”的 I 代替。'} },
  { meaning: '是我的', wordIds: ['is','mine'], bankWordIds: ['mine','is'], dependsOn: [3], replacesTrailIndexes: [3], annotations: [span(0,1,'系动词'),span(1,2,'表语')], successFeedback:'is 连接前面的物品与归属，mine 说明是我的。这里只练 is mine 片段，接下来与扩展后的主语合并。' },
  { meaning: '桌上的那本书是我的', wordIds: ['theSubject','book','on','thePlace','desk','is','mine'], bankWordIds: ['mine','is','desk','thePlace','on','book','theSubject'], dependsOn: [2,4], annotations: clause, visual: {sceneId:'book-on-desk-mine',show:'after-correct'}, successFeedback:'整句说的是“桌上的那本书”，所以完整主语是 The book on the desk。book 是中心名词，on the desk 修饰 book；is 是系动词，mine 是表语，说明归属。' },
  { type:'classify', meaning:'桌上的那本书是我的', wordIds:['theSubject','book','on','thePlace','desk','is','mine'], focusWordId:'book', dependsOn:[5], annotations:clause, prompt:'哪一组是这句话的完整主语？', answer:'whole', options:[
   {id:'head',key:'b',label:'book：只有中心名词',feedback:'book 是中心名词，完整主语还包括 The 和说明哪本书的 on the desk。'},
   {id:'whole',key:'t',label:'The book on the desk',feedback:'正确，整个 The book on the desk 是被陈述的对象。主语内部可以带修饰语，不能只选中心名词。'},
   {id:'place',key:'o',label:'on the desk：只有位置修饰语',feedback:'on the desk 在这里修饰 book，不是独立的完整主语。'},
  ] },
  { meaning:'在桌子下面', wordIds:['under','thePlace','desk'], bankWordIds:['desk','thePlace','under'], dependsOn:[6], replacesTrailIndexes:[6], clearSentenceResultOnStart:true, annotations:[span(0,1,'介词'),span(1,3,'介词宾语'),span(0,3,'介词短语',1)], learningNote:{term:'更换修饰信息',question:'这次要说明哪本书？',answer:'桌子下面的那本书',explanation:'把修饰 book 的 on the desk 换成 under the desk，指向的书随位置变化。改变的是主语内部的修饰信息，归我所有这个陈述还可以保留。'} },
  { meaning:'桌子下面的那本书', wordIds:['theSubject','book','under','thePlace','desk'], bankWordIds:['desk','thePlace','under','book','theSubject'], dependsOn:[7], annotations:phrase, visual:{sceneId:'book-under-desk',show:'after-correct'}, successFeedback:'under the desk 修饰 book。整个名词短语指明哪本书，接下来可以把这一整组用作主语。' },
  { meaning:'桌子下面的那本书是我的', wordIds:['theSubject','book','under','thePlace','desk','is','mine'], bankWordIds:['mine','is','desk','thePlace','under','book','theSubject'], dependsOn:[8,4], annotations:clause, visual:{sceneId:'book-under-desk-mine',show:'after-correct'}, successFeedback:'位置修饰语换成 under the desk，完整主语也随之改变。mine 仍然说明归属，不是位置。' },
  { meaning:'包', wordIds:['bag'], bankWordIds:['bag'], dependsOn:[9], clearSentenceResultOnStart:true, annotations:[], successFeedback:'现在把中心名词 book 换成 bag，练习同样的后置修饰结构。' },
  { meaning:'桌上的那个包', wordIds:['theSubject','bag','on','thePlace','desk'], bankWordIds:['desk','thePlace','on','bag','theSubject'], dependsOn:[10,1], annotations:phrase, visual:{sceneId:'bag-on-desk',show:'after-correct'}, successFeedback:'中心名词改成 bag，on the desk 现在修饰 bag。词组的修饰对象由当前表达决定。' },
  { meaning:'桌上的那个包是我的', wordIds:['theSubject','bag','on','thePlace','desk','is','mine'], bankWordIds:['mine','is','desk','thePlace','on','bag','theSubject'], dependsOn:[11,4], annotations:clause, visual:{sceneId:'bag-on-desk-mine',show:'after-correct'}, successFeedback:'完整主语是 The bag on the desk。单数中心名词 bag 与 is 搭配，mine 说明这个包是我的。' },
  { type:'classify', meaning:'包在桌子上', wordIds:['theSubject','bag','is','on','thePlace','desk'], focusWordId:'on', dependsOn:[12], annotations:[span(0,2,'主语'),span(2,3,'系动词'),span(3,6,'地点表语')], prompt:'这句话中的 on the desk 还是后置定语吗？', answer:'location', options:[
   {id:'modifier',key:'m',label:'是：只要出现 on the desk 就是定语',feedback:'不能给短语永久贴成分标签。这里 on the desk 接在 is 后，说明包在哪里，不是在主语内部修饰 bag。'},
   {id:'location',key:'l',label:'不是：它在 is 后说明包的位置，作地点表语',feedback:'The bag is on the desk 陈述位置；The bag on the desk is mine 中，on the desk 修饰 bag，整句陈述归属。相同词组在具体句中的作用不同。'},
  ] },
  {type:'transfer',meaning:'桌子下面的那个包是我的',wordIds:['theSubject','bag','under','thePlace','desk','is','mine'],dependsOn:[13],annotations:clause,answers:['The bag under the desk is mine.'],visual:{sceneId:'bag-under-desk-mine',show:'after-correct'},successFeedback:'完整主语是 The bag under the desk，under the desk 是修饰 bag 的后置定语；is mine 陈述归属。新组合仍沿用同一种结构。'},
 ],
};
