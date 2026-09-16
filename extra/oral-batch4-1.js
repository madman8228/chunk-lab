/* 口语 8000 句 · 第四批数据源（批次 1/5）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch4-1.js */
var ORAL_BATCH = [
  {
    "sentence": "You want some?",
    "translation": "你要来点吗？",
    "chunks": ["You want", "some?"],
    "hints": ["你想要", "一些"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/juː/','/wɑːnt/'],pos:'省略 Do 的口语问句',meaning:'你想要'},
      {role:'宾语',color:'#3358e0',phonetic:['/sʌm/'],pos:'不定代词',meaning:'一些'}
    ],
    "explanations": [
      "口语里 `Do you want some?` 常省略句首的 Do，只靠语气表疑问。常见错误：\n• 用降调读成 \"You want some.\" → 变成陈述句（你要一些），问答语气完全变了\n• \"You want any?\" → 期待对方接受时用 some，any 多用于不确定的场合",
      "`some` 在提议/邀请里带「来一点吧」的期待。同义：Want some? / Would you like some?"
    ],
    "distractors": [["You wants","You wanting","You want to"],["any?","anything?","some of?"]]
  },
  {
    "sentence": "I got it here.",
    "translation": "我这儿有。",
    "chunks": ["I got it", "here."],
    "hints": ["我拿到了", "在这儿"],
    "grammar": [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/ɡɑːt/','/ɪt/'],pos:'一般过去时',meaning:'我拿到了'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/hɪr/'],pos:'副词',meaning:'在这儿'}
    ],
    "explanations": [
      "`got` 是 get 的过去式，口语里常表「已经拿到/有了」。常见错误：\n• \"I get it here.\" → 一般现在时表习惯，说这一次要用 got\n• 升调读 \"I got it here?\" → 才成疑问句",
      "`here` 放句末表地点。同义：I have some here. / I already got one."
    ],
    "distractors": [["I get it","I got them","I am got it"],["there.","in here.","here are."]]
  },
  {
    "sentence": "Veggies are good.",
    "translation": "蔬菜挺好的。",
    "chunks": ["Veggies", "are good."],
    "hints": ["蔬菜", "挺好的"],
    "grammar": [
      {role:'主语',color:'#e74c7a',phonetic:['/ˈvedʒiz/'],pos:'名词（veggie 复数）',meaning:'蔬菜'},
      {role:'主系表',color:'#c87033',phonetic:['/ɑːr/','/ɡʊd/'],pos:'系动词+形容词',meaning:'很好'}
    ],
    "explanations": [
      "`veggies` 是 vegetables 的口语简称，日常对话更常用。常见错误：\n• \"Veggies is good\" → 复数主语要用 are\n• \"Veggie are good\" → 复数别忘加 s",
      "`be good` 表「有好处/不错」。常见错误：\n• \"are well\" → well 指身体好，说食物好要用 good"
    ],
    "distractors": [["Veggie","Veggies's","The veggies"],["is good.","are well.","are good at."]]
  },
  {
    "sentence": "They have nutrients.",
    "translation": "它们有营养。",
    "chunks": ["They have", "nutrients."],
    "hints": ["它们含有", "营养"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/ðeɪ/','/hæv/'],pos:'一般现在时',meaning:'它们含有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈnuːtriənts/'],pos:'名词复数',meaning:'营养'}
    ],
    "explanations": [
      "`have` 在这里表「含有」。常见错误：\n• \"They has\" → 第三人称复数用 have\n• \"They are have\" → be 和 have 不能叠用",
      "`nutrient` 是可数名词，泛指营养时用复数。常见错误：\n• \"They have nutrient\" → 泛指要复数才自然"
    ],
    "distractors": [["They has","They having","Them have"],["nutrient.","nutritions.","a nutrients."]]
  },
  {
    "sentence": "What did you eat?",
    "translation": "你吃了什么？",
    "chunks": ["What did", "you eat?"],
    "hints": ["什么（过去）", "你吃了"],
    "grammar": [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/wʌt/','/dɪd/'],pos:'疑问词+did',meaning:'什么'},
      {role:'主语+谓语',color:'#e74c7a',phonetic:['/juː/','/iːt/'],pos:'you + 动词原形',meaning:'你吃'}
    ],
    "explanations": [
      "疑问句里 did 之后动词必须用原形，时态已经由 did 承担。常见错误：\n• \"What did you ate?\" → did 后不能用过去式\n• \"What you ate?\" → 缺助动词 did",
      "`eat` 用原形与 did 搭配；对应的陈述句是 You ate ..."
    ],
    "distractors": [["What do","What does","What were"],["you ate?","you eats?","you eating?"]]
  },
  {
    "sentence": "Leftover pizza.",
    "translation": "吃剩的披萨。",
    "chunks": ["Leftover", "pizza."],
    "hints": ["剩下的", "披萨"],
    "grammar": [
      {role:'定语',color:'#c87033',phonetic:['/ˈleftoʊvər/'],pos:'形容词',meaning:'剩下的'},
      {role:'主语/表语',color:'#3358e0',phonetic:['/ˈpiːtsə/'],pos:'名词',meaning:'披萨'}
    ],
    "explanations": [
      "`leftover` 写成一个词，作形容词表「吃剩的」。常见错误：\n• \"left over pizza\" → 写成两个词会被读成「留在……上面」\n• \"leftovers pizza\" → leftovers 是名词（剩菜），修饰名词要用单数形式 leftover",
      "这是省略主语的答句（It's leftover pizza.）。同义：Pizza from last night."
    ],
    "distractors": [["Left over","Leftovers","Left"],["pizzas.","the pizza.","pizza pie."]]
  },
  {
    "sentence": "It's homemade.",
    "translation": "自己做的。",
    "chunks": ["It's", "homemade."],
    "hints": ["它是", "自家做的"],
    "alts": [["It is"], null],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/ɪts/'],pos:'it + is 缩写',meaning:'它是'},
      {role:'表语',color:'#3358e0',phonetic:['/ˌhoʊmˈmeɪd/'],pos:'形容词',meaning:'自家做的'}
    ],
    "explanations": [
      "`It's` = It is，缩写必须带撇号。常见错误：\n• \"Its homemade.\" → Its 是「它的」，句首位置放不下\n• \"It homemade.\" → 缺 be 动词",
      "`homemade` 写成一个词，表「家里做的」。常见错误：\n• \"home made\" → 作形容词时连写"
    ],
    "distractors": [["It has","It was","It were"],["home made.","made home.","homemade it."]]
  },
  {
    "sentence": "Pretty good.",
    "translation": "挺好吃的。",
    "chunks": ["Pretty", "good."],
    "hints": ["挺、相当", "好"],
    "grammar": [
      {role:'程度状语',color:'#7c5cbf',phonetic:['/ˈprɪti/'],pos:'副词（口语）',meaning:'挺、相当'},
      {role:'表语',color:'#3358e0',phonetic:['/ɡʊd/'],pos:'形容词',meaning:'好'}
    ],
    "explanations": [
      "口语里 `pretty` 作副词 = 挺、相当，比 very 轻。常见错误：\n• \"pretty well\" → well 形容状态，说东西好要用 good\n• \"prettily\" → 那是「漂亮地」，日常几乎不用",
      "省略了主语（It's pretty good.）。同义：Not bad. / Pretty decent."
    ],
    "distractors": [["Pretty much","Prettier","Pretty well"],["better.","good at.","goodly."]]
  },
  {
    "sentence": "How'd you sleep?",
    "translation": "你睡得怎么样？",
    "chunks": ["How'd you", "sleep?"],
    "hints": ["你（怎么）", "睡"],
    "alts": [["How did you"], null],
    "grammar": [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/haʊd/','/juː/'],pos:'How did 的口语缩写',meaning:'你（怎么）'},
      {role:'谓语',color:'#e74c7a',phonetic:['/sliːp/'],pos:'动词原形',meaning:'睡'}
    ],
    "explanations": [
      "`How'd` = How did 的口语缩写，问的是过去的状况。常见错误：\n• \"How'd you slept?\" → did 之后要用原形\n• 完整形式 How did you sleep? 同样正确，只是没那么口语",
      "早上问候常用。同义：Did you sleep well? / How was your sleep?"
    ],
    "distractors": [["How'd you been","How do you","How'd your"],["sleepy?","sleeping?","slept?"]]
  },
  {
    "sentence": "You look refreshed.",
    "translation": "你气色不错。",
    "chunks": ["You look", "refreshed."],
    "hints": ["你看起来", "精神焕发"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/lʊk/'],pos:'系动词 look',meaning:'你看起来'},
      {role:'表语',color:'#3358e0',phonetic:['/rɪˈfreʃt/'],pos:'过去分词作形容词',meaning:'精神好的'}
    ],
    "explanations": [
      "`look` 作系动词时后面接形容词，不能接副词。常见错误：\n• \"You look refreshingly\" → 表语位置要用形容词\n• \"You looks\" → you 用 look",
      "`refreshed` 是过去分词作形容词，表「休息好了、精神好」。常见错误：\n• \"refreshing\" → 那是「令人清爽的」，修饰事物而不是人"
    ],
    "distractors": [["You looks","You looking","Your look"],["refresh.","refreshing.","refreshment."]]
  },
  {
    "sentence": "Yeah, I slept in.",
    "translation": "嗯，我睡懒觉了。",
    "chunks": ["Yeah,", "I slept in."],
    "hints": ["嗯、对", "我睡到很晚"],
    "grammar": [
      {role:'应答词',color:'#7c5cbf',phonetic:['/jeə/'],pos:'口语肯定词',meaning:'嗯、对'},
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/slept/','/ɪn/'],pos:'sleep in 的过去式',meaning:'我睡到很晚'}
    ],
    "explanations": [
      "`Yeah` 比 yes 更随意，日常对话里高频。常见错误：\n• 正式场合要用 Yes，Yeah 偏随意\n• 别把 Yeah 和口语里的 ya（= you）混用",
      "`sleep in` 是固定短语，表「睡懒觉、睡到自然醒」（不是失眠）。常见错误：\n• \"sleep on\" → 那是「先睡一晚再考虑」，意思完全不同\n• \"slept in late\" → 也有人说，但 in 已经含「晚」的意思"
    ],
    "distractors": [["Yes,","Yep,","No,"],["I sleep in.","I slept on.","I sleeping in."]]
  },
  {
    "sentence": "I woke up at 10.",
    "translation": "我十点醒的。",
    "chunks": ["I woke up", "at 10."],
    "hints": ["我醒了", "在十点"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/woʊk/','/ʌp/'],pos:'wake up 的过去式',meaning:'我醒了'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/æt/','/ten/'],pos:'介词短语',meaning:'在十点'}
    ],
    "explanations": [
      "`wake up` 的过去式是 woke up（不规则变化）。常见错误：\n• \"I waked up\" → 应作 woke\n• \"I woke at 10\" → 也通，但日常更常说 wake up",
      "`at 10` 读作 at ten，具体钟点用 at。常见错误：\n• \"in 10\" → 具体钟点用 at，in 用于月/年\n• \"on 10\" → on 用于星期和日期"
    ],
    "distractors": [["I wake up","I woken up","I waking up"],["in 10.","on 10.","for 10."]]
  },
  {
    "sentence": "You feelin' okay?",
    "translation": "感觉还好吗？",
    "chunks": ["You feelin'", "okay?"],
    "hints": ["你感觉", "还好吗"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/ˈfiːlɪn/'],pos:'Are you feeling 的省略',meaning:'你感觉'},
      {role:'表语',color:'#3358e0',phonetic:['/ˌoʊˈkeɪ/'],pos:'形容词',meaning:'还好'}
    ],
    "explanations": [
      "口语省略句首的 Are，feelin' 用撇号代替词尾的 g。常见错误：\n• \"You feels okay\" → you 用 feel\n• 正式书写要写 Are you feeling okay?",
      "`okay` 也写作 OK，用来问健康状况。同义：You all right? / Are you doing okay?"
    ],
    "distractors": [["You feel","You feels","You're feelin'"],["OK?","fine?","all right?"]]
  },
  {
    "sentence": "Super good.",
    "translation": "很好。",
    "chunks": ["Super", "good."],
    "hints": ["超级", "好"],
    "grammar": [
      {role:'程度状语',color:'#7c5cbf',phonetic:['/ˈsuːpər/'],pos:'副词（口语加强）',meaning:'超级'},
      {role:'表语',color:'#3358e0',phonetic:['/ɡʊd/'],pos:'形容词',meaning:'好'}
    ],
    "explanations": [
      "`super` 作副词表「超级」，年轻人常用，比 very 更夸张。常见错误：\n• \"super goodly\" → goodly 不是 good 的副词\n• 正式场合要说 very good",
      "省略了主语（I'm super good.）。同义：Awesome. / Great. / Doing great."
    ],
    "distractors": [["Superb","Superly","Very"],["well.","good at.","goodness."]]
  },
  {
    "sentence": "Wanna go for a run?",
    "translation": "想去跑步吗？",
    "chunks": ["Wanna", "go for a run?"],
    "hints": ["想要", "去跑步"],
    "grammar": [
      {role:'情态+主语',color:'#c87033',phonetic:['/ˈwɑːnə/'],pos:'want to 的口语缩写',meaning:'想要'},
      {role:'固定表达',color:'#7c5cbf',phonetic:['/ɡoʊ/','/fɔːr/','/ə/','/rʌn/'],pos:'go for a run 惯用短语',meaning:'去跑步'}
    ],
    "explanations": [
      "`wanna` = want to 的连读写法，只用于非正式场合。常见错误：\n• \"Wanna to go\" → wanna 已含 to，不能再加\n• 书面写作要用 want to",
      "`go for a run` 是固定搭配「去跑步」，整体是一个 chunk 不可拆。常见错误：\n• \"go for run\" → 漏掉冠词 a\n• \"go to a run\" → 介词是 for 不是 to\n同义：Want to go running? / Feel like a run?"
    ],
    "distractors": [["Want","Wanna to","Wanted to"],["go for run?","go to a run?","go for a running?"]]
  },
  {
    "sentence": "I'm down for it.",
    "translation": "我没问题。",
    "chunks": ["I'm down", "for it."],
    "hints": ["我愿意", "做这件事"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/daʊn/'],pos:'be down 口语习语',meaning:'我愿意'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/fɔːr/','/ɪt/'],pos:'介词短语',meaning:'做这件事'}
    ],
    "explanations": [
      "`be down for sth` 是口语习语，表「乐意、算我一个」，跟「在下面」无关。常见错误：\n• \"I'm down to it\" → 固定搭配用 for\n• 按字面理解成「我在下面」→ 会完全跑偏",
      "`for it` 指代前面提到的那件事。同义：I'm in. / Count me in. / I'm up for it."
    ],
    "distractors": [["I'm up","I'm down on","I down"],["to it.","on it.","at it."]]
  },
  {
    "sentence": "Did you get taller?",
    "translation": "你长高了吗？",
    "chunks": ["Did you get", "taller?"],
    "hints": ["你变得", "更高"],
    "grammar": [
      {role:'助动词+主语',color:'#e74c7a',phonetic:['/dɪd/','/juː/','/ɡet/'],pos:'一般过去时疑问',meaning:'你变（高）了'},
      {role:'补语',color:'#3358e0',phonetic:['/ˈtɔːlər/'],pos:'形容词比较级',meaning:'更高'}
    ],
    "explanations": [
      "`get + 形容词` 表「变得」，这里 get 是系动词。常见错误：\n• \"Did you got taller?\" → did 之后用原形 get\n• \"Did you get tall?\" → 跟过去比要用比较级 taller",
      "`taller` 是比较级，隐含「比你以前高」。常见错误：\n• \"more tall\" → 单音节词加 -er\n• \"tallest\" → 最高级用于三者以上"
    ],
    "distractors": [["Do you get","Did you got","Did you getting"],["tall?","more tall?","tallest?"]]
  },
  {
    "sentence": "You are growing fast.",
    "translation": "你长得真快。",
    "chunks": ["You are", "growing fast."],
    "hints": ["你正在", "长得快"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/juː/','/ɑːr/'],pos:'you + are',meaning:'你正在'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈɡroʊɪŋ/','/fæst/'],pos:'现在进行时+副词',meaning:'长得快'}
    ],
    "explanations": [
      "`grow` 表「长身体」时是不及物动词，用进行时表持续变化。常见错误：\n• \"You growing fast\" → 缺 are\n• \"You are grow fast\" → 进行时要用 growing",
      "`fast` 既是形容词也是副词，作副词时不加 -ly。常见错误：\n• \"growing fastly\" → fastly 不存在"
    ],
    "distractors": [["You is","You're","You am"],["grow fast.","growing fastly.","grown fast."]]
  },
  {
    "sentence": "How old are you?",
    "translation": "你多大了？",
    "chunks": ["How old", "are you?"],
    "hints": ["多大", "你呢"],
    "grammar": [
      {role:'疑问词+形容词',color:'#c87033',phonetic:['/haʊ/','/oʊld/'],pos:'询问年龄',meaning:'多大'},
      {role:'系动词+主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'倒装问句',meaning:'你呢'}
    ],
    "explanations": [
      "问年龄固定用 `How old`。常见错误：\n• \"How age are you?\" → 错，age 是名词不能这样问\n• \"What old are you?\" → 疑问词用 How",
      "`are you` 是主谓倒装。常见错误：\n• \"How old you are?\" → 语序没倒装，这种语序只用在宾语从句里（I know how old you are.）"
    ],
    "distractors": [["How age","What old","How older"],["you are?","are your?","do you?"]]
  },
  {
    "sentence": "Twenty something.",
    "translation": "二十多岁吧。",
    "chunks": ["Twenty", "something."],
    "hints": ["二十", "多（岁左右）"],
    "grammar": [
      {role:'数词',color:'#c87033',phonetic:['/ˈtwenti/'],pos:'基数词',meaning:'二十'},
      {role:'后缀',color:'#7c5cbf',phonetic:['/ˈsʌmθɪŋ/'],pos:'口语后缀',meaning:'多、左右'}
    ],
    "explanations": [
      "`-something` 接在整十数后面，表示「……多岁」，用于说得不精确。常见错误：\n• \"twenty some\" → 要连写成一个词\n• \"twenty more\" → 意思变成「再多二十」",
      "标准书写带连字符：Twenty-something。同义：in my twenties（二十几岁）"
    ],
    "distractors": [["Twenty's","The twenty","Twenties"],["some thing.","sometime.","somethings."]]
  },
  {
    "sentence": "Where you goin'?",
    "translation": "你要去哪？",
    "chunks": ["Where", "you goin'?"],
    "hints": ["哪里", "你去"],
    "alts": [null, ["are you going?"]],
    "grammar": [
      {role:'疑问词',color:'#c87033',phonetic:['/wer/'],pos:'疑问副词',meaning:'哪里'},
      {role:'主语+谓语',color:'#e74c7a',phonetic:['/juː/','/ˈɡoʊɪn/'],pos:'are you going 的口语省略',meaning:'你去'}
    ],
    "explanations": [
      "口语里句首的 Are 常被省掉，going 写成 goin'。常见错误：\n• \"Where you go?\" → 少 goin'，语义会变成「你（平时）去哪」\n• 正式书写是 Where are you going?",
      "同义：Where are you off to? / Where to?"
    ],
    "distractors": [["When","What","Where's"],["you go?","you gone?","your goin'?"]]
  },
  {
    "sentence": "Out for dinner.",
    "translation": "出去吃晚饭。",
    "chunks": ["Out for", "dinner."],
    "hints": ["出去（为了）", "晚饭"],
    "grammar": [
      {role:'方向状语',color:'#7c5cbf',phonetic:['/aʊt/','/fɔːr/'],pos:'口语省略句',meaning:'出去（为了）'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/ˈdɪnər/'],pos:'名词',meaning:'晚饭'}
    ],
    "explanations": [
      "回答 Where are you going 时省略了主句（I'm going out for dinner.）。常见错误：\n• \"Out for the dinner\" → 一日三餐前一般不加冠词",
      "三餐前不加冠词：have dinner / for dinner。常见错误：\n• \"for a dinner\" → 加冠词是错的"
    ],
    "distractors": [["Out to","Out of","Out in"],["the dinners.","a dinner.","dinner plate."]]
  }
];
