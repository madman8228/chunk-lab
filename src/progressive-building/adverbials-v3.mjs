const span = (start, end, label, level = 0) => ({ start, end, label, level });
const base = [span(0,1,'主语'),span(1,2,'谓语'),span(2,3,'宾语')];
const local = (meaning, wordIds, dependsOn, annotations, learningNote, extra = {}) => ({ meaning, wordIds, bankWordIds:[...wordIds].reverse(), dependsOn, annotations, learningNote, clearSentenceResultOnStart:true, ...extra });
const whole = (meaning, wordIds, dependsOn, additions, successFeedback) => ({ meaning, wordIds, bankWordIds:[...wordIds].reverse(), dependsOn, annotations:[...base,...additions], successFeedback });
export const adverbials = {
 id:'adverbials-preview', label:'PB08 · 时间、地点、方式与伴随（待验收）', knowledgeNode:'PB08', prerequisites:['PB02','PB06'],
 objectives:['用状语补充动作的时间、地点、方式和伴随信息','区分状语与宾语及名词修饰语','换时间和人物后组合已有信息独立表达'],
 sentenceStepIndexes:[1,3,7,8,10,11,13,16,18,19],
 words:{
  i:{en:'I',zh:'我',part:'人称代词',visualSceneId:'i'}, youSubject:{en:'You',zh:'你',part:'人称代词',visualSceneId:'you'},
  study:{en:'study',zh:'学习',part:'动词'}, english:{en:'English',zh:'英语',part:'名词'},
  every:{en:'every',zh:'每',part:'限定词'}, day:{en:'day',zh:'天',part:'名词'}, week:{en:'week',zh:'周',part:'名词'},
  at:{en:'at',zh:'在',part:'介词'}, home:{en:'home',zh:'家',part:'名词'},
  with:{en:'with',zh:'和……一起',part:'介词'}, you:{en:'you',zh:'你',part:'人称代词',visualSceneId:'you'}, carefully:{en:'carefully',zh:'认真地',part:'副词'},
 },
 sentence:{wordIds:['youSubject','study','english','at','home','every','week'],zh:'你每周在家学英语。'},
 sequence:[
  local('学英语',['study','english'],[],[span(0,1,'动作'),span(1,2,'动作对象')],{term:'动作与对象',question:'学什么？',answer:'English，英语',explanation:'study 是动词，表示学习；English 是名词，表示英语。English 回答“学什么”，是 study 的宾语。study English 合起来表达“学英语”。'}, {buildGuide:{title:'先找动作，再说动作涉及什么',explanation:'“学英语”表达一个动作和学习的对象：做什么？学习。学什么？英语。这里英语也先说动作，再说学习对象：动词（学习）＋名词（英语）。动词告诉我们做什么；名词用来称呼人、事物等，这里的“英语”是一种语言的名称。',afterSelection:{study:'你已经说出“学习”。接着补上“学什么”，把学习对象接在动作后面。'}}}),
  whole('我学英语',['i','study','english'],[0],[],'I 作主语，study 作谓语，English 是学习涉及的对象，作宾语。'),
  local('每天',['every','day'],[1],[],{term:'时间与频率信息',question:'every day 补充哪类信息？',answer:'学习的时间频率：每天',explanation:'every day 表示每天。它补充学习多久一次，而不是说明学什么；接到 I study English 后，整组作时间状语。every 是限定词，day 是名词，状语是整组在句中的作用。'}),
  whole('我每天学英语',['i','study','english','every','day'],[1,2],[span(3,5,'时间状语')],'I study English＝我学英语；every day＝每天。通常先说“我学英语”，再补“每天”：I study English every day。也可以先交代“每天”，再说“我学英语”：Every day, I study English。every day 这一组通常放在这句话的开头或结尾，不放在 I 和 study 之间。'),
  {type:'classify',meaning:'我每天学英语',wordIds:['i','study','english','every','day'],focusWordId:'every',dependsOn:[3],annotations:[...base,span(3,5,'时间状语')],prompt:'every day 补充的是“学什么”，还是“多久学一次”？',answer:'frequency',options:[
   {id:'object',key:'o',label:'学什么：它是学习对象',feedback:'学习对象是 English；every day 不是被学习的东西，它补充学习发生的频率。'},
   {id:'frequency',key:'f',label:'多久学一次：它是时间状语',feedback:'every day 补充学习的频率，在本句作时间状语。用它回答多久一次，而不是学什么。'},
  ]},
  {type:'classify',meaning:'我每天学英语',wordIds:['i','study','english','every','day'],focusWordId:'every',dependsOn:[4],annotations:[...base,span(3,5,'时间状语')],prompt:'表达“我每天学英语”，哪种语序判断正确？',answer:'both',options:[
   {id:'end',key:'e',label:'只能说 I study English every day',feedback:'句末很常见，但不是唯一位置。Every day, I study English 也自然，先交代时间。'},
   {id:'middle',key:'m',label:'按中文顺序说 I every day study English',feedback:'I every day study English 把 every day 放进了 I 和 study 之间，普通表达中不自然。可以说 I study English every day，或 Every day, I study English。'},
   {id:'both',key:'b',label:'I study English every day 和 Every day, I study English 都可以',feedback:'两种都自然，every day 都作时间状语。句首先交代时间，句末在主干后补充频率；它不必固定在句末。'},
  ]},
  local('在家',['at','home'],[5],[span(0,1,'介词'),span(1,2,'介词宾语'),span(0,2,'介词短语',1)],{term:'地点信息',question:'在哪里学习？',answer:'at home，在家',explanation:'at home 表示在家。放进动作句时，它说明学习发生的地点，整组作地点状语。它说明在哪里学习，不是修饰 English。'},{replacesTrailIndexes:[5]}),
  whole('我在家学英语',['i','study','english','at','home'],[1,6],[span(3,5,'地点状语')],'at home 回答在哪里学习，补充动作发生的地点，作地点状语。去掉 at home，I study English 仍能表达“我学英语”。'),
  whole('我每天在家学英语',['i','study','english','at','home','every','day'],[7,2],[span(3,5,'地点状语'),span(5,7,'时间状语')],'at home 与 every day 各回答不同问题：在哪里、多久一次。它们分别作地点状语和时间状语。'),
  local('和你一起',['with','you'],[8],[span(0,1,'介词'),span(1,2,'介词宾语'),span(0,2,'介词短语',1)],{term:'伴随信息',question:'和谁一起学习？',answer:'with you，和你一起',explanation:'with you 表示和你一起。you 在短语内部作 with 的宾语；放进本课动作句时，整组 with you 作伴随状语，不是 study 的第二个宾语。'}),
  whole('我和你一起学英语',['i','study','english','with','you'],[1,9],[span(3,5,'伴随状语')],'English 说明学习什么，with you 说明和谁一起学习。两组功能不同：前者作宾语，后者整体作伴随状语。'),
  whole('我每天在家和你一起学英语',['i','study','english','with','you','at','home','every','day'],[8,10],[span(3,5,'伴随状语'),span(5,7,'地点状语'),span(7,9,'时间状语')],'先说 I study English（我学英语），再补 with you（和谁一起）、at home（在哪里）、every day（多久一次）。这里先把“和你一起学习”连着说，再交代地点和时间；地点放在时间前，是常见顺序。伴随信息不必排在地点前：I study English at home with you every day 也自然。every day 还可以放句首。每一组保持完整，不把伴随→地点→时间当成固定公式。'),
  local('认真地',['carefully'],[11],[],{term:'动作方式',question:'怎样学习？',answer:'carefully，认真仔细地',explanation:'carefully 的词性是副词。用它修饰 study，说明怎样学习时，它在句中作方式状语。词性“副词”和句子作用“状语”要分开，前面多词组成的表达也能作状语。'}),
  whole('我认真地学英语',['i','study','english','carefully'],[1,12],[span(3,4,'方式状语')],'carefully 修饰学习这个动作，作方式状语。它没有把学习对象从英语换成别的东西，也不是形容 English 的定语。'),
  {type:'classify',meaning:'我认真地学英语',wordIds:['i','study','english','carefully'],focusWordId:'carefully',dependsOn:[13],annotations:[...base,span(3,4,'方式状语')],prompt:'carefully 在这里说明的是哪一项？',answer:'manner',options:[
   {id:'noun',key:'n',label:'说明 English 是哪一种英语，修饰名词',feedback:'这里 carefully 说明学习动作怎样进行，不是在限定是哪一种英语，不能把它当作修饰 English 的定语。'},
   {id:'manner',key:'m',label:'说明怎样学习，作方式状语',feedback:'carefully 是副词，在本句作方式状语。状语不一定只有一个词，也不能把所有副词与所有句子中的状语直接画等号。'},
  ]},
  local('你',['youSubject'],[14],[],{term:'主语',question:'现在换成谁学习？',answer:'You，你',explanation:'You 表示你，在 You study English 中作主语。'},{replacesTrailIndexes:[14]}),
  whole('你每天学英语',['youSubject','study','english','every','day'],[15,3],[span(3,5,'时间状语')],'人物变成 You，every day 仍补充学习频率，不能把它当作只属于 I 的固定搭配。'),
  local('周',['week'],[16],[],{term:'更换时间单位',question:'week 表示什么？',answer:'周',explanation:'day 是天，week 是周。every day 是每天，every week 是每周；every 后的 day 和 week 都用单数。'}),
  {meaning:'每周',wordIds:['every','week'],bankWordIds:['week','every'],dependsOn:[17,2],replacesTrailIndexes:[17],annotations:[span(0,2,'时间表达')],successFeedback:'every week 表示每周，week 保持单数。接进本课句子后，整组补充学习频率。'},
  whole('你每周在家学英语',['youSubject','study','english','at','home','every','week'],[16,18,6],[span(3,5,'地点状语'),span(5,7,'时间状语')],'人物、地点和时间能重新组合。at home 补充在哪里，every week 补充多久一次，English 仍是学习对象。'),
  {type:'transfer',meaning:'我每周在家和你一起学英语',wordIds:['i','study','english','with','you','at','home','every','week'],dependsOn:[19,11],annotations:[...base,span(3,5,'伴随状语'),span(5,7,'地点状语'),span(7,9,'时间状语')],answers:['I study English with you at home every week.','I study English at home with you every week.','Every week I study English with you at home.','Every week, I study English with you at home.','Every week I study English at home with you.','Every week, I study English at home with you.'],successFeedback:'English 是宾语，with you、at home、every week 分别作伴随、地点、时间状语。这里示范一种词序；你若把时间放在句首，或调整伴随与地点的顺序，也可以自然表达这个意思。'},
 ],
};
