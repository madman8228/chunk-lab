/* 口语 8000 句 · 第四批数据源（批次 4/5）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch4-4.js */
var ORAL_BATCH = [
  {
    "sentence": "Bite that piece off.",
    "translation": "把那块咬下来。",
    "chunks": ["Bite", "that piece off."],
    "hints": ["咬", "那一块下来"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/baɪt/'],pos:'祈使句动词',meaning:'咬'},
      {role:'宾语+副词',color:'#3358e0',phonetic:['/ðæt/','/piːs/','/ɔːf/'],pos:'名词短语 + off',meaning:'把那块咬下来'}
    ],
    "explanations": [
      "`bite off` 是短语动词，表「咬下来」。常见错误：\n• \"Bite that piece\" → 少了 off，就没「咬掉」的意思\n• \"Bite off that piece\" → 也通，但名词较长时更常放中间",
      "祈使句用动词原形开头。常见错误：\n• \"Biting that piece off\" → 祈使句不带动名词"
    ],
    "distractors": [["Biting","Bites","Bite to"],["that pieces off.","that piece of.","that piece on."]]
  },
  {
    "sentence": "I took that job.",
    "translation": "我接受了那份工作。",
    "chunks": ["I took", "that job."],
    "hints": ["我接了", "那份工作"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/tʊk/'],pos:'take 的过去式',meaning:'我接了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðæt/','/dʒɑːb/'],pos:'名词短语',meaning:'那份工作'}
    ],
    "explanations": [
      "`take a job` 表「接受一份工作」。常见错误：\n• \"I taked\" → take 是不规则动词，过去式是 took\n• \"took that job\" 与 \"got that job\" → got 强调「得到」，took 强调「接受」",
      "`job` 是可数名词，特指某份工作时用 that / the。常见错误：\n• \"that works\" → job 指职位，work 是不可数名词"
    ],
    "distractors": [["I take","I taked","I taken"],["that jobs.","this job.","that work."]]
  },
  {
    "sentence": "Good for you.",
    "translation": "真不错（为你高兴）。",
    "chunks": ["Good", "for you."],
    "hints": ["好", "对你来说"],
    "grammar": [
      {role:'表语',color:'#c87033',phonetic:['/ɡʊd/'],pos:'形容词（省略主语）',meaning:'好'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/fɔːr/','/juː/'],pos:'介词短语',meaning:'对你来说'}
    ],
    "explanations": [
      "`Good for you` 是回应别人好消息的固定说法，表「为你高兴」。常见错误：\n• 理解成「对你有好处」→ 那是 Good for your health 之类的含义，语境不同\n• \"Good to you\" → 固定搭配用 for",
      "同义：Nice! / That's great! / I'm happy for you."
    ],
    "distractors": [["Good at","Good to","Better"],["for your.","to you.","for yours."]]
  },
  {
    "sentence": "It's close to me.",
    "translation": "离我很近。",
    "chunks": ["It's close", "to me."],
    "hints": ["它是近的", "对我来说"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/kloʊs/'],pos:'it + is + 形容词',meaning:'它是近的'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/tə/','/miː/'],pos:'介词短语',meaning:'离我'}
    ],
    "explanations": [
      "`close` 作形容词读 /kloʊs/，表「近的」。常见错误：\n• \"It's closed\" → closed 读 /kloʊzd/，是「关门的」，意思完全不同\n• \"near to me\" → near 作形容词时不加 to，或直接用 close to me",
      "`close to sb/sth` 表「离……近」。常见错误：\n• \"close me\" → 缺介词 to"
    ],
    "distractors": [["It's closed","It's closest","It's close by"],["to my.","for me.","to mine."]]
  },
  {
    "sentence": "The pay is good.",
    "translation": "薪水不错。",
    "chunks": ["The pay", "is good."],
    "hints": ["薪水", "不错"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/ðə/','/peɪ/'],pos:'不可数名词',meaning:'薪水'},
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪz/','/ɡʊd/'],pos:'is + 形容词',meaning:'不错'}
    ],
    "explanations": [
      "`pay` 表薪水时不可数，不加 s。常见错误：\n• \"the pays\" → 不可数名词\n• \"the salary is good\" → salary 指固定月薪，pay 更泛",
      "表语用形容词 good。常见错误：\n• \"is well\" → well 表身体好"
    ],
    "distractors": [["The pay's","A pay","The paying"],["are good.","is well.","is good at."]]
  },
  {
    "sentence": "You got a minute?",
    "translation": "你有空吗？",
    "chunks": ["You got", "a minute?"],
    "hints": ["你有", "一分钟（时间）"],
    "alts": [null, ["a second?", "a moment?"]],
    "grammar": [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/juː/','/ɡɑːt/'],pos:'Do you have 的口语省略',meaning:'你有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈmɪnɪt/'],pos:'名词短语',meaning:'一分钟（时间）'}
    ],
    "explanations": [
      "口语省略 Do，用 got 代替 have：You got a minute? = Do you have a minute?。常见错误：\n• \"You got a minute.\" 降调 → 变陈述句\n• \"Have you got a minute?\" → 英式更常这么说",
      "`a minute` 在口语里泛指「一点时间」，不是真的六十秒。常见错误：\n• \"a minutes\" → 前面有 a 要用单数"
    ],
    "distractors": [["You have got","You get","You got to"],["a minutes?","the minute?","a minit?"]]
  },
  {
    "sentence": "Sure, what's up?",
    "translation": "有，怎么了？",
    "chunks": ["Sure,", "what's up?"],
    "hints": ["当然、有", "怎么了"],
    "grammar": [
      {role:'应答词',color:'#7c5cbf',phonetic:['/ʃʊr/'],pos:'口语肯定词',meaning:'当然、有'},
      {role:'疑问句',color:'#c87033',phonetic:['/wʌts/','/ʌp/'],pos:'what is up 缩写',meaning:'怎么了'}
    ],
    "explanations": [
      "`Sure` 在回应请求时等于「当然可以」。常见错误：\n• \"Surely\" → 那是「确实、无疑」，语气不对\n• \"Of course\" → 更正式，也可以",
      "`What's up?` 是极常用的口语问候/询问，等于「怎么了／最近怎么样」。常见错误：\n• \"What up?\" → 少 is，非常随意\n• \"What's up.\" 降调读 → 语气会显得敷衍"
    ],
    "distractors": [["OK,","Yep,","Yeah,"],["what's on?","what up?","what's new?"]]
  },
  {
    "sentence": "I'm not on today.",
    "translation": "我今天不上班。",
    "chunks": ["I'm not on", "today."],
    "hints": ["我今天不上（班）", "今天"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/nɑːt/','/ɑːn/'],pos:'be + not + on',meaning:'我不在班'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/təˈdeɪ/'],pos:'时间副词',meaning:'今天'}
    ],
    "explanations": [
      "`be on` 在排班语境里表「上班/值班」，否定就是 I'm not on。常见错误：\n• \"I'm not work today\" → 要说 I'm not working today\n• \"I'm not in today\" → 也可以，但 on 更常用于班表",
      "`today` 作时间状语放句末。常见错误：\n• \"on today\" → today 前不加介词"
    ],
    "distractors": [["I'm not in","I'm no on","I'm not at"],["todays.","the today.","in today."]]
  },
  {
    "sentence": "It's my day off.",
    "translation": "我今天休息。",
    "chunks": ["It's my", "day off."],
    "hints": ["这是我的", "休息日"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/ɪts/','/maɪ/'],pos:'it + is + 所有格',meaning:'这是我的'},
      {role:'表语',color:'#3358e0',phonetic:['/deɪ/','/ɔːf/'],pos:'名词短语',meaning:'休息日'}
    ],
    "explanations": [
      "`It's my` 注意 Its（它的）与 It's（它是）的区别。常见错误：\n• \"Its my day off\" → 少了撇号\n• \"It's mine day off\" → 有名词时用 my",
      "`day off` 是固定搭配，表「休息日」。常见错误：\n• \"day of\" → 少一个 f，意思变「……的一天」\n• \"off day\" → 那是「状态不好的一天」，语序不同"
    ],
    "distractors": [["It's mine","It's me","It's my the"],["day of.","day offs.","days off."]]
  },
  {
    "sentence": "Are you off tomorrow?",
    "translation": "你明天休息吗？",
    "chunks": ["Are you", "off tomorrow?"],
    "hints": ["你是", "明天休息吗"],
    "grammar": [
      {role:'系动词+主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'倒装疑问',meaning:'你是'},
      {role:'表语+时间状语',color:'#7c5cbf',phonetic:['/ɔːf/','/təˈmɑːroʊ/'],pos:'off + 副词',meaning:'明天休息'}
    ],
    "explanations": [
      "`be off` 在排班语境里表「休息」。常见错误：\n• \"Do you off tomorrow?\" → off 是形容词，要用 be 动词\n• \"Are you off work?\" → 更完整的说法，也对",
      "`tomorrow` 作时间状语不加介词。常见错误：\n• \"on tomorrow\" → 错，tomorrow 前不加介词"
    ],
    "distractors": [["Do you","Are your","Is you"],["of tomorrow?","off tomorow?","on tomorrow?"]]
  },
  {
    "sentence": "I don't work Friday.",
    "translation": "我周五不上班。",
    "chunks": ["I don't", "work Friday."],
    "hints": ["我不", "周五上班"],
    "grammar": [
      {role:'主语+助动词',color:'#e74c7a',phonetic:['/aɪ/','/doʊnt/'],pos:'do not 缩写',meaning:'我不'},
      {role:'谓语+时间状语',color:'#7c5cbf',phonetic:['/wɜːrk/','/ˈfraɪdeɪ/'],pos:'动词原形 + 星期',meaning:'周五上班'}
    ],
    "explanations": [
      "一般现在时否定用 don't + 动词原形。常见错误：\n• \"I not work\" → 缺助动词\n• \"I doesn't work\" → I 配 don't",
      "口语里星期前的 on 常省略：work Friday = work on Friday。常见错误：\n• \"work in Friday\" → 用 on 或省略"
    ],
    "distractors": [["I doesn't","I not","I don't works"],["works Friday.","working Friday.","worked Friday."]]
  },
  {
    "sentence": "I've been so busy.",
    "translation": "我最近太忙了。",
    "chunks": ["I've been", "so busy."],
    "hints": ["我一直", "这么忙"],
    "grammar": [
      {role:'主语+助动词',color:'#e74c7a',phonetic:['/aɪv/','/bɪn/'],pos:'现在完成时',meaning:'我一直（是）'},
      {role:'表语',color:'#3358e0',phonetic:['/soʊ/','/ˈbɪzi/'],pos:'副词 + 形容词',meaning:'这么忙'}
    ],
    "explanations": [
      "`I've been + 形容词` 表「（从过去到现在）一直处于某状态」。常见错误：\n• \"I been so busy\" → 少了 've\n• \"I've being busy\" → being 用错，be 的过去分词是 been",
      "`so` 表「这么、那么」，加强语气。同义：I've been super busy. / I've been swamped."
    ],
    "distractors": [["I been","I've being","I've be"],["so busily.","such busy.","so busier."]]
  },
  {
    "sentence": "Sometimes I forget.",
    "translation": "有时候会忘。",
    "chunks": ["Sometimes", "I forget."],
    "hints": ["有时候", "我会忘"],
    "grammar": [
      {role:'频度状语',color:'#7c5cbf',phonetic:['/ˈsʌmtaɪmz/'],pos:'频度副词',meaning:'有时候'},
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/fərˈɡet/'],pos:'一般现在时',meaning:'我会忘'}
    ],
    "explanations": [
      "`sometimes` 写成一个词，表「有时候」。常见错误：\n• \"sometime\" → 那是「某个时候」，指不确定的一个时间点\n• \"some times\" → 那是「几次」，指次数",
      "频度副词可放句首或句中。常见错误：\n• \"I sometimes forget\" → 也同样正确"
    ],
    "distractors": [["Sometime","Some times","Sometimes's"],["I forgets.","I forgetting.","I forgotten."]]
  },
  {
    "sentence": "I can't put up with it.",
    "translation": "我受不了这个。",
    "chunks": ["I can't", "put up with it."],
    "hints": ["我不能", "忍受它"],
    "grammar": [
      {role:'主语+情态',color:'#c87033',phonetic:['/aɪ/','/kænt/'],pos:'can not 缩写',meaning:'我不能'},
      {role:'固定表达',color:'#7c5cbf',phonetic:['/pʊt/','/ʌp/','/wɪð/','/ɪt/'],pos:'put up with 短语动词',meaning:'忍受它'}
    ],
    "explanations": [
      "`can't` = cannot，表能力或不允许。常见错误：\n• \"I can't to put\" → 情态动词后不加 to\n• \"I can not\" → 分开写也可，但口语几乎都缩写",
      "`put up with` 是三个词组成的短语动词，意思是「忍受」，不能拆开理解。常见错误：\n• \"put up it\" → 缺 with\n• \"put with it\" → 缺 up\n按字面理解成「把……放上去」会完全跑偏"
    ],
    "distractors": [["I can","I can't to","I cannot to"],["put up it.","put with it.","put up on it."]]
  },
  {
    "sentence": "What's bothering you?",
    "translation": "什么事烦你了？",
    "chunks": ["What's", "bothering you?"],
    "hints": ["什么（是）", "烦着你的"],
    "grammar": [
      {role:'疑问词+系动词',color:'#c87033',phonetic:['/wʌts/'],pos:'what + is 缩写',meaning:'什么（是）'},
      {role:'谓语+宾语',color:'#e74c7a',phonetic:['/ˈbɑːðərɪŋ/','/juː/'],pos:'现在进行时',meaning:'烦着你'}
    ],
    "explanations": [
      "`bother` 表「打扰、使烦恼」。常见错误：\n• \"What's brother you?\" → brother 是「兄弟」，正确拼写是 bothering\n• \"What's bother you?\" → 进行时要用 -ing",
      "现在进行时表「此刻正在」。同义：What's wrong? / What's on your mind?"
    ],
    "distractors": [["What","What're","What was"],["bother you?","bothering your?","bothers you?"]]
  },
  {
    "sentence": "We're in a library.",
    "translation": "我们在图书馆。",
    "chunks": ["We're in", "a library."],
    "hints": ["我们在", "一个图书馆"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/wɪr/','/ɪn/'],pos:'we are 缩写 + 介词',meaning:'我们在'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/ə/','/ˈlaɪbreri/'],pos:'名词短语',meaning:'一个图书馆'}
    ],
    "explanations": [
      "`We're` = we are，注意与 Were（are 的过去式）区分。常见错误：\n• \"Were in a library\" → 少了撇号就成过去时陈述\n• \"We in a library\" → 缺 be 动词",
      "`library` 注意拼写，中间是 -brar-。常见错误：\n• \"librery\" / \"libary\" → 常见拼错\n• \"a libraries\" → 前有 a 用单数"
    ],
    "distractors": [["We in","We was in","We're at"],["a libraries.","the library.","an library."]]
  },
  {
    "sentence": "You're talking too loudly.",
    "translation": "你说话太大声了。",
    "chunks": ["You're talking", "too loudly."],
    "hints": ["你说话", "太大声"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/jʊr/','/ˈtɔːkɪŋ/'],pos:'you are + 现在分词',meaning:'你正在说'},
      {role:'程度状语',color:'#7c5cbf',phonetic:['/tuː/','/ˈlaʊdli/'],pos:'副词',meaning:'太大声'}
    ],
    "explanations": [
      "`You're` = you are，注意区分 your（你的）。常见错误：\n• \"Your talking too loudly\" → Your 是形容词，不能构成进行时\n• \"You talking\" → 口语可省略，但书面要写 You are",
      "`too` 表「过于」，修饰副词再 -ly。常见错误：\n• \"to loudly\" → 是 too 不是 to\n• \"too loud\" → 也可，但修饰 talking 用副词 loudly"
    ],
    "distractors": [["You talking","Your talking","You're talk"],["to loudly.","too loudness.","too louder."]]
  },
  {
    "sentence": "Keep it down.",
    "translation": "小声点。",
    "chunks": ["Keep", "it down."],
    "hints": ["保持", "声音低"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/kiːp/'],pos:'祈使句动词',meaning:'保持'},
      {role:'宾语+补语',color:'#3358e0',phonetic:['/ɪt/','/daʊn/'],pos:'keep + 宾语 + 副词',meaning:'把声音压低'}
    ],
    "explanations": [
      "`keep sth down` 表「把（音量）压低」。常见错误：\n• \"Keep down it\" → 代词要放 keep 和 down 中间\n• \"Keep it up\" → up 意思是「继续保持」，正好相反",
      "祈使句用动词原形。同义：Lower your voice. / Quiet down."
    ],
    "distractors": [["Keeping","Keeps","Keep to"],["it up.","it low.","it downs."]]
  },
  {
    "sentence": "I'm trying to study.",
    "translation": "我在学习。",
    "chunks": ["I'm trying", "to study."],
    "hints": ["我在努力", "学习"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪm/','/ˈtraɪɪŋ/'],pos:'try 的进行时',meaning:'我在努力'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/ˈstʌdi/'],pos:'try to do',meaning:'学习'}
    ],
    "explanations": [
      "`try to do sth` 表「努力做某事」。常见错误：\n• \"I trying\" → 缺 am\n• \"try studying\" → try doing 表「试试看（方法）」，语义不同",
      "进行时表「此刻正在」。同义：I'm studying. / I'm hitting the books."
    ],
    "distractors": [["I trying","I'm try","I tries"],["to studying.","to studied.","to studies."]]
  },
  {
    "sentence": "My test is tomorrow.",
    "translation": "我明天有考试。",
    "chunks": ["My test", "is tomorrow."],
    "hints": ["我的考试", "在明天"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/maɪ/','/test/'],pos:'名词短语',meaning:'我的考试'},
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪz/','/təˈmɑːroʊ/'],pos:'is + 副词',meaning:'是在明天'}
    ],
    "explanations": [
      "英语用 be + 时间词表达「某事在某时」。常见错误：\n• \"My test is in tomorrow\" → tomorrow 前不加介词\n• \"My test are tomorrow\" → test 单数用 is",
      "`test` 指考试、测验。同义：I have a test tomorrow."
    ],
    "distractors": [["My tests","Mine test","My test are"],["are tomorrow.","in tomorrow.","on tomorrow."]]
  },
  {
    "sentence": "You'll be fine.",
    "translation": "你会没事的。",
    "chunks": ["You'll", "be fine."],
    "hints": ["你会", "没事"],
    "grammar": [
      {role:'主语+助动词',color:'#c87033',phonetic:['/juːl/'],pos:'you will 缩写',meaning:'你会'},
      {role:'系表',color:'#e74c7a',phonetic:['/bi/','/faɪn/'],pos:'will be + 形容词',meaning:'没事'}
    ],
    "explanations": [
      "`You'll` = you will，表安慰性的预测。常见错误：\n• \"You'll be fine.\" 写成 \"Your be fine\" → Your 是所有格\n• \"You will be fine\" → 不缩写也可以，语气更正式",
      "`fine` 表「没问题、没事」。同义：You'll do great. / You'll be okay."
    ],
    "distractors": [["You","You're","You will be"],["be find.","being fine.","be finely."]]
  },
  {
    "sentence": "You're in charge.",
    "translation": "你说了算。",
    "chunks": ["You're", "in charge."],
    "hints": ["你是", "负责的"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/jʊr/'],pos:'you are 缩写',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/ɪn/','/tʃɑːrdʒ/'],pos:'介词短语（固定）',meaning:'负责的'}
    ],
    "explanations": [
      "`be in charge` 是固定短语，表「负责、主管」。常见错误：\n• \"in charged\" → charge 在此不加 ed\n• \"in the charge\" → 加 the 后意思变成「在……看管下」，正好相反",
      "`You're in charge` 口语里也可表「你说了算」。同义：It's up to you. / You're the boss."
    ],
    "distractors": [["Your","You","You've"],["in charged.","in charge of.","in the charge."]]
  }
];
