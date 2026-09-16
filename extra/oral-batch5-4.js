/* 口语 8000 句 · 第五批数据源（批次 4/6）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch5-4.js */
var ORAL_BATCH = [
  {
    "sentence": "Can I return it?",
    "translation": "可以退吗？",
    "chunks": ["Can I", "return it?"],
    "hints": ["我可以", "退掉它吗"],
    "grammar": [
      {role:'情态动词 + 主语',color:'#e74c7a',phonetic:['/kæn/','/aɪ/'],pos:'请求许可',meaning:'我可以'},
      {role:'谓语 + 宾语',color:'#3358e0',phonetic:['/rɪˈtɜːrn/','/ɪt/'],pos:'动词短语',meaning:'退掉它'}
    ],
    "explanations": [
      "退货用 `return`，拿回钱说 get a refund。常见错误：\n• \"Can I return back it?\" → return 已含「回」，不加 back\n• 指着商品时也可说 Can I return this?",
      "相关：exchange it（换货）/ get a refund（退款）"
    ],
    "distractors": [["Can I do","Could I to","Can me"],["returning it?","return it back?","return of it?"]]
  },
  {
    "sentence": "What's your number?",
    "translation": "你号码多少？",
    "chunks": ["What's", "your number?"],
    "hints": ["什么是", "你的号码"],
    "grammar": [
      {role:'疑问词 + be',color:'#7c5cbf',phonetic:['/wʌts/'],pos:'what is 缩写',meaning:'什么是'},
      {role:'表语',color:'#3358e0',phonetic:['/jʊr/','/ˈnʌmbər/'],pos:'名词短语',meaning:'你的号码'}
    ],
    "explanations": [
      "问电话号码、房号都用这句。常见错误：\n• \"What your number?\" → 漏了 's\n• 口语里 What's 的 /ts/ 与后面的 your 连读",
      "更礼貌：Could I get your number?"
    ],
    "distractors": [["What","What are","How's"],["your numbers?","you number?","your number is?"]]
  },
  {
    "sentence": "Pick up the phone.",
    "translation": "接电话。",
    "chunks": ["Pick up", "the phone."],
    "hints": ["拿起、接起", "电话"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/pɪk/','/ʌp/'],pos:'短语动词 pick up',meaning:'拿起、接起'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/foʊn/'],pos:'名词短语',meaning:'电话'}
    ],
    "explanations": [
      "`pick up the phone` = 接电话，也可说 answer the phone。常见错误：\n• \"Pick up phone\" → phone 前要加 the\n• 代词宾语要夹中间：pick it up",
      "相关：hang up（挂电话）/ put the phone down（放下电话）"
    ],
    "distractors": [["Pick on","Picking up","Pick of"],["the phones.","a phone.","the phone up."]]
  },
  {
    "sentence": "Stop calling me.",
    "translation": "别给我打电话了。",
    "chunks": ["Stop", "calling me."],
    "hints": ["停止", "给我打电话"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/stɑːp/'],pos:'祈使句动词',meaning:'停止'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈkɔːlɪŋ/','/miː/'],pos:'动名词短语',meaning:'给我打电话'}
    ],
    "explanations": [
      "`stop doing` 表停止正在做的事，动词要用 -ing。常见错误：\n• \"Stop to call me\" → stop to do 是「停下来去打电话」，意思正好相反\n• \"Stop call me\" → 少了 -ing",
      "想更坚决：Don't call me again."
    ],
    "distractors": [["Stops","Stopping","Stop to"],["call me.","to call me.","calling my."]]
  },
  {
    "sentence": "Ma'am, you called us.",
    "translation": "女士，是你打给我们的。",
    "chunks": ["Ma'am,", "you called us."],
    "hints": ["女士", "你打给我们了"],
    "grammar": [
      {role:'称呼语',color:'#7c5cbf',phonetic:['/mæm/'],pos:'名词（尊称）',meaning:'女士'},
      {role:'主谓宾',color:'#e74c7a',phonetic:['/juː/','/kɔːld/','/ʌs/'],pos:'一般过去时',meaning:'你打给我们'}
    ],
    "explanations": [
      "`Ma'am` 是对女性的礼貌称呼，读 /mæm/。常见错误：\n• 拼写别写成 Mam / Maam，标准写法是 Ma'am\n• 称呼语后面要加逗号：Ma'am, ...",
      "男性对应 Sir；服务场景常见：Sir, you dropped your card."
    ],
    "distractors": [["Mam,","Maams,","Mister,"],["you call us.","you called we.","you called ours."]]
  },
  {
    "sentence": "Why didn't you wake me?",
    "translation": "为什么不叫醒我？",
    "chunks": ["Why didn't you", "wake me?"],
    "hints": ["为什么你没有", "叫醒我"],
    "grammar": [
      {role:'疑问词 + 助动词',color:'#7c5cbf',phonetic:['/waɪ/','/ˈdɪdnt/','/juː/'],pos:'过去时否定疑问',meaning:'你为什么不'},
      {role:'谓语 + 宾语',color:'#e74c7a',phonetic:['/weɪk/','/miː/'],pos:'动词原形 + 宾语',meaning:'叫醒我'}
    ],
    "explanations": [
      "`wake` 是叫醒，代词宾语跟在后面：wake me。常见错误：\n• \"Why didn't you woke me?\" → 助动词后要用原形 wake\n• \"Why you didn't wake me?\" → 疑问句语序是 Why didn't you...",
      "相关：wake me up（把我叫醒，代词夹中间）/ wake up（自己醒来）"
    ],
    "distractors": [["Why you didn't","Why don't you","Why didn't not"],["woke me?","waking me?","wake up me?"]]
  },
  {
    "sentence": "I overslept.",
    "translation": "我睡过头了。",
    "chunks": ["I", "overslept."],
    "hints": ["我", "睡过头了"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/aɪ/'],pos:'第一人称代词',meaning:'我'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˌoʊvərˈslept/'],pos:'oversleep 的过去式',meaning:'睡过头了'}
    ],
    "explanations": [
      "`oversleep` = 睡过头，过去式 overslept。常见错误：\n• \"I oversleep\" → 说的是这次的事，要用过去式\n• \"I sleep over\" → sleep over 是「在别人家过夜」，意思完全不同",
      "相关：I slept in.（我睡了个懒觉）/ I didn't hear my alarm."
    ],
    "distractors": [["Me","My","I've"],["oversleeps.","oversleep.","oversleeping."]]
  },
  {
    "sentence": "What time will you finish?",
    "translation": "你什么时候结束？",
    "chunks": ["What time", "will you finish?"],
    "hints": ["什么时间", "你会结束"],
    "grammar": [
      {role:'疑问短语',color:'#7c5cbf',phonetic:['/wʌt/','/taɪm/'],pos:'疑问词 + 名词',meaning:'什么时候'},
      {role:'助动词 + 主语 + 谓语',color:'#e74c7a',phonetic:['/wɪl/','/juː/','/ˈfɪnɪʃ/'],pos:'一般将来时疑问句',meaning:'你会结束'}
    ],
    "explanations": [
      "问具体几点结束用 `What time...?` 比 When 更聚焦。常见错误：\n• \"What time you will finish?\" → 语序应是 will you finish\n• 也可换说法：What time will you be done?",
      "回答模板：I'll finish at two.（我两点结束）"
    ],
    "distractors": [["What times","Which time","How time"],["you will finish?","will you finishes?","do you will finish?"]]
  },
  {
    "sentence": "I'll finish at two.",
    "translation": "我两点结束。",
    "chunks": ["I'll finish", "at two."],
    "hints": ["我会结束", "在两点"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪl/','/ˈfɪnɪʃ/'],pos:'will + 动词原形',meaning:'我会结束'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/æt/','/tuː/'],pos:'介词短语',meaning:'在两点'}
    ],
    "explanations": [
      "具体钟点前用介词 `at`。常见错误：\n• \"I'll finish in two\" → in two 会被听成「两小时后」\n• \"I'll finish on two\" → 钟点前不用 on",
      "相关：at noon（中午）/ at half past two（两点半）"
    ],
    "distractors": [["I finish","I'll finishing","I will finished"],["in two.","on two.","at the two."]]
  },
  {
    "sentence": "Let's hang out.",
    "translation": "出去玩吧。",
    "chunks": ["Let's", "hang out."],
    "hints": ["我们", "一起玩、闲逛"],
    "grammar": [
      {role:'主谓（祈使）',color:'#e74c7a',phonetic:['/lets/'],pos:'let us 缩写',meaning:'我们'},
      {role:'谓语',color:'#7c5cbf',phonetic:['/hæŋ/','/aʊt/'],pos:'短语动词 hang out',meaning:'一起玩、闲逛'}
    ],
    "explanations": [
      "`hang out` = 一起消磨时间、闲逛，超常用。常见错误：\n• 别写成 \"hang on\"，那是「等一下」\n• \"Let's hanging out\" → Let's 后接动词原形",
      "更随意：Wanna hang out? / Hang out sometime?"
    ],
    "distractors": [["Let is","Let us to","Let's to"],["hangs out.","hanging out.","hang on."]]
  },
  {
    "sentence": "I'm coming to get you.",
    "translation": "我来接你了。",
    "chunks": ["I'm coming", "to get you."],
    "hints": ["我正过来", "接你"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/aɪm/','/ˈkʌmɪŋ/'],pos:'现在进行时',meaning:'我正过来'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/tuː/','/ɡet/','/juː/'],pos:'不定式短语',meaning:'去接你'}
    ],
    "explanations": [
      "`come to get you` = 过来接你，进行时表马上就到。常见错误：\n• \"I'm coming to pick up you\" → 代词要夹中间：pick you up\n• \"I coming\" → 漏 be 动词",
      "相关：I'll pick you up at seven.（我七点来接你）"
    ],
    "distractors": [["I coming","I'm come","I've coming"],["to get yours.","for get you.","to getting you."]]
  },
  {
    "sentence": "Lend me 10 bucks.",
    "translation": "借我10块钱。",
    "chunks": ["Lend me", "10 bucks."],
    "hints": ["借给我", "十块钱"],
    "grammar": [
      {role:'谓语 + 宾语',color:'#e74c7a',phonetic:['/lend/','/miː/'],pos:'动词 + 间接宾语',meaning:'借给我'},
      {role:'宾语',color:'#3358e0',phonetic:['/ten/','/bʌks/'],pos:'数量 + 名词',meaning:'十块钱'}
    ],
    "explanations": [
      "`lend` 是「借出」（我借给你），`borrow` 是「借入」（我向你借）。常见错误：\n• \"Borrow me 10 bucks\" → 想说「借我钱」要用 lend me\n• bucks 是口语的「美元」，正式说法 10 dollars",
      "还钱时说：I'll pay you back."
    ],
    "distractors": [["Borrow me","Lends me","Lend to me"],["10 buck.","ten bucks of.","10 bucks to."]]
  },
  {
    "sentence": "I want my money.",
    "translation": "还我钱。",
    "chunks": ["I want", "my money."],
    "hints": ["我要", "我的钱"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/wɑːnt/'],pos:'一般现在时',meaning:'我要'},
      {role:'宾语',color:'#3358e0',phonetic:['/maɪ/','/ˈmʌni/'],pos:'名词短语',meaning:'我的钱'}
    ],
    "explanations": [
      "催人还钱最直接的表达；`money` 不可数。常见错误：\n• \"I want my moneys\" → money 没有复数\n• 想客气一点：Could you pay me back?",
      "相关：I need it back.（我得把钱要回来）"
    ],
    "distractors": [["I wants","I wanting","Me want"],["my moneys.","mine money.","my monies."]]
  },
  {
    "sentence": "Are you angry?",
    "translation": "你生气了吗？",
    "chunks": ["Are you", "angry?"],
    "hints": ["你是", "生气的"],
    "grammar": [
      {role:'系动词 + 主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'一般疑问句',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈæŋɡri/'],pos:'形容词',meaning:'生气的'}
    ],
    "explanations": [
      "`angry` 重音在第一音节 /ˈæŋɡri/。常见错误：\n• \"Are you anger?\" → anger 是名词，这里用形容词 angry\n• 对某人生气要说 angry with me",
      "程度递进：annoyed（有点烦）< angry < furious（暴怒）"
    ],
    "distractors": [["Is you","Are your","Do you"],["anger?","angrily?","angry with?"]]
  },
  {
    "sentence": "Of course not.",
    "translation": "当然没有。",
    "chunks": ["Of course", "not."],
    "hints": ["当然", "不"],
    "grammar": [
      {role:'状语',color:'#7c5cbf',phonetic:['/əv/','/kɔːrs/'],pos:'固定短语',meaning:'当然'},
      {role:'否定答语',color:'#e74c7a',phonetic:['/nɑːt/'],pos:'副词',meaning:'不'}
    ],
    "explanations": [
      "`Of course not.` 用来强烈否认，回答一般疑问句。常见错误：\n• \"Of course no\" → 否定答语用 not\n• 肯定回答是 Of course.，别在肯定回答里带 not",
      "相关：Not at all. / Absolutely not.（语气更强）"
    ],
    "distractors": [["Of the course","On course","Of cause"],["no.","none.","not to."]]
  },
  {
    "sentence": "I'm shocked.",
    "translation": "我很震惊。",
    "chunks": ["I'm", "shocked."],
    "hints": ["我", "感到震惊的"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/aɪm/'],pos:'I am 缩写',meaning:'我'},
      {role:'表语',color:'#e74c7a',phonetic:['/ʃɑːkt/'],pos:'过去分词作形容词',meaning:'震惊的'}
    ],
    "explanations": [
      "`shocked` 表「感到震惊的」，是过去分词作形容词。常见错误：\n• \"I'm shocking\" → shocking 是「令人震惊的」，形容事物\n• \"I shock\" → 要加 be 动词",
      "同类：I'm surprised.（惊讶）/ I'm stunned.（惊呆了）"
    ],
    "distractors": [["I","I've","Me"],["shocking.","shock.","shocks."]]
  },
  {
    "sentence": "I'm offended.",
    "translation": "我觉得被冒犯了。",
    "chunks": ["I'm", "offended."],
    "hints": ["我", "被冒犯的"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/aɪm/'],pos:'I am 缩写',meaning:'我'},
      {role:'表语',color:'#e74c7a',phonetic:['/əˈfendɪd/'],pos:'过去分词作形容词',meaning:'被冒犯的'}
    ],
    "explanations": [
      "`be offended` = 感到被冒犯，被谁冒犯用 by。常见错误：\n• 拼写：offe**nd**ed，两个 f\n• \"I'm offending\" → offending 是「冒犯别人的」，说自己要用 offended",
      "相关：That's offensive.（那话很冒犯）/ No offense.（无意冒犯）"
    ],
    "distractors": [["I","I've","Me"],["offending.","offense.","offend."]]
  },
  {
    "sentence": "Don't be sad.",
    "translation": "别伤心。",
    "chunks": ["Don't be", "sad."],
    "hints": ["别", "伤心"],
    "grammar": [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/'],pos:'do not 缩写',meaning:'别'},
      {role:'表语',color:'#c87033',phonetic:['/sæd/'],pos:'形容词',meaning:'伤心的'}
    ],
    "explanations": [
      "`Don't be + 形容词` 是安慰别人时的固定否定式。常见错误：\n• \"Don't sad\" → 形容词前必须加 be\n• \"No be sad\" → 否定祈使用 don't",
      "相关安慰语：Cheer up. / It's okay. / I'm here for you."
    ],
    "distractors": [["Doesn't","Not be","No"],["sadly.","sadness.","sading."]]
  },
  {
    "sentence": "Get yourself together.",
    "translation": "振作起来。",
    "chunks": ["Get yourself", "together."],
    "hints": ["把你自己", "聚拢、振作"],
    "grammar": [
      {role:'谓语 + 反身代词',color:'#e74c7a',phonetic:['/ɡet/','/jərˈself/'],pos:'动词 + 反身代词',meaning:'把你自己'},
      {role:'补足语',color:'#7c5cbf',phonetic:['/təˈɡeðər/'],pos:'副词',meaning:'聚拢、振作'}
    ],
    "explanations": [
      "`get yourself together` = 振作起来、把状态调回来。常见错误：\n• \"Get together yourself\" → yourself 要紧跟 get\n• \"Get you together\" → 反身代词要用 yourself",
      "更常用：Pull yourself together. / Get a grip."
    ],
    "distractors": [["Get you","Getting yourself","Get your"],["togetherness.","togather.","to gather."]]
  },
  {
    "sentence": "Great job.",
    "translation": "做得好。",
    "chunks": ["Great", "job."],
    "hints": ["很棒的", "活儿、表现"],
    "grammar": [
      {role:'形容词',color:'#c87033',phonetic:['/ɡreɪt/'],pos:'形容词',meaning:'很棒的'},
      {role:'名词',color:'#3358e0',phonetic:['/dʒɑːb/'],pos:'名词',meaning:'活儿、表现'}
    ],
    "explanations": [
      "`Great job.` 是表扬别人的固定说法，前面常省略 What a。常见错误：\n• 说成 \"Great work\" 也对，但 job 更口语\n• 想完整表达：You did a great job.",
      "同类：Nice work. / Well done. / Good for you."
    ],
    "distractors": [["Greatly","Greater","Greeting"],["jop.","job's.","jobb."]]
  }
];
