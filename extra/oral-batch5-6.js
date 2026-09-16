/* 口语 8000 句 · 第五批数据源（批次 6/6）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch5-6.js */
var ORAL_BATCH = [
  {
    "sentence": "Throw it out.",
    "translation": "把它扔了。",
    "chunks": ["Throw it", "out."],
    "hints": ["把它扔", "出去"],
    "grammar": [
      {role:'谓语 + 宾语',color:'#e74c7a',phonetic:['/θroʊ/','/ɪt/'],pos:'短语动词 throw out（代词夹中）',meaning:'把它扔掉'},
      {role:'副词',color:'#7c5cbf',phonetic:['/aʊt/'],pos:'副词',meaning:'出去'}
    ],
    "explanations": [
      "`throw out` = 扔掉，代词宾语夹中间：throw **it** out。常见错误：\n• \"Throw out it\" → 代词要放中间\n• \"Throw it away\" 也常用，意思相同",
      "相关：take out the trash（倒垃圾）/ get rid of it（处理掉它）"
    ],
    "distractors": [["Throw out it","Throwing it out","Throw it of"],["of.","out to.","out off."]]
  },
  {
    "sentence": "Turn on the lights.",
    "translation": "打开灯。",
    "chunks": ["Turn on", "the lights."],
    "hints": ["打开", "灯"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/tɜːrn/','/ɑːn/'],pos:'短语动词 turn on',meaning:'打开'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/laɪts/'],pos:'名词短语',meaning:'灯'}
    ],
    "explanations": [
      "电器、水龙头、灯的「开」都用 `turn on`。常见错误：\n• \"Open the lights\" → 中文说开灯，英文用 turn on\n• 宾语是代词时要夹中间：turn them on",
      "相关：turn off the lights（关灯）/ switch on（偏英式）"
    ],
    "distractors": [["Turn in","Turning on","Turn of"],["the lights of.","a lights.","the lights on."]]
  },
  {
    "sentence": "The power's out.",
    "translation": "停电了。",
    "chunks": ["The power's", "out."],
    "hints": ["电力", "断了、没了"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/ðə/','/ˈpaʊərz/'],pos:'名词 + is 缩写',meaning:'电（是）'},
      {role:'表语',color:'#3358e0',phonetic:['/aʊt/'],pos:'副词作表语',meaning:'断了、没了'}
    ],
    "explanations": [
      "`The power's out.` = 停电了，out 表「断了」。常见错误：\n• \"The power is off\" 指「关着的」，停电用 out 更地道\n• \"The electricity's out\" 也行，但 power 更口语",
      "相关：a power outage（停电）/ The lights went out.（灯灭了）"
    ],
    "distractors": [["The power","The powers is","The power is of"],["off.","down.","over."]]
  },
  {
    "sentence": "Mop the floor.",
    "translation": "拖地（擦地板）。",
    "chunks": ["Mop", "the floor."],
    "hints": ["用拖把擦", "地板"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/mɑːp/'],pos:'祈使句动词',meaning:'拖（地）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/flɔːr/'],pos:'名词短语',meaning:'地板'}
    ],
    "explanations": [
      "`mop` 专指用拖把擦地。常见错误：\n• \"Wipe the floor\" 是用抹布擦，工具不同\n• mop 也可作名词：a mop（拖把）",
      "相关：sweep the floor（扫地）/ vacuum the carpet（吸地毯）"
    ],
    "distractors": [["Mops","Mopping","Map"],["the floors.","a floor.","the floor of."]]
  },
  {
    "sentence": "Do the dishes.",
    "translation": "洗碗。",
    "chunks": ["Do", "the dishes."],
    "hints": ["做（这件事）", "碗碟"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/duː/'],pos:'祈使句动词',meaning:'做（某事）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈdɪʃɪz/'],pos:'名词短语',meaning:'碗碟'}
    ],
    "explanations": [
      "`do the dishes` = 洗碗，是固定搭配。常见错误：\n• \"Do the dish\" → 用复数 dishes\n• 英式也常说 wash up，意思一样",
      "相关：do the laundry（洗衣服）/ do the cooking（做饭）"
    ],
    "distractors": [["Does","Doing","Done"],["the dish.","a dishes.","the dishes of."]]
  },
  {
    "sentence": "Put it up.",
    "translation": "挂上去。",
    "chunks": ["Put it", "up."],
    "hints": ["把它", "挂上"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/pʊt/','/ɪt/'],pos:'短语动词 put up（代词夹中）',meaning:'把它挂起'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ʌp/'],pos:'副词',meaning:'上（挂）'}
    ],
    "explanations": [
      "`put up` = 挂上去、张贴，代词夹中间：put **it** up。常见错误：\n• \"Put up it\" → 代词要放中间\n• put up 还能表「提高」（put up the price），靠语境区分",
      "反义：take it down（拿下来）。"
    ],
    "distractors": [["Put up it","Putting it up","Put it of"],["in.","on.","over."]]
  },
  {
    "sentence": "Take it down.",
    "translation": "拿下来。",
    "chunks": ["Take it", "down."],
    "hints": ["把它", "取下"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ɪt/'],pos:'短语动词 take down（代词夹中）',meaning:'把它取下'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词',meaning:'下（取下）'}
    ],
    "explanations": [
      "`take down` = 拿下来、取下，代词夹中间：take **it** down。常见错误：\n• \"Take down it\" → 代词要放中间\n• take down 还能表「记下」（take down notes）",
      "反义：put it up（挂上去）。"
    ],
    "distractors": [["Take down it","Taking it down","Take it of"],["up.","over.","aside."]]
  },
  {
    "sentence": "Climb up.",
    "translation": "爬上去。",
    "chunks": ["Climb", "up."],
    "hints": ["爬", "上去"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/klaɪm/'],pos:'祈使句动词',meaning:'爬'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ʌp/'],pos:'副词（表方向）',meaning:'上去'}
    ],
    "explanations": [
      "`climb up` 强调往上爬，反义 climb down。常见错误：\n• b 不发音，读 /klaɪm/\n• 后面接宾语时是「爬到……上」：climb up the tree",
      "相关：climb over（爬过去）/ climb in（爬进来）"
    ],
    "distractors": [["Climbs","Climbing","Climbed"],["upstairs.","over.","down the."]]
  },
  {
    "sentence": "Climb down.",
    "translation": "爬下来。",
    "chunks": ["Climb", "down."],
    "hints": ["爬", "下来"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/klaɪm/'],pos:'祈使句动词',meaning:'爬'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词（表方向）',meaning:'下来'}
    ],
    "explanations": [
      "`climb down` = 爬下来，也引申为「让步、认错」。常见错误：\n• b 不发音，读 /klaɪm/\n• 接宾语时是「从……下来」：climb down the ladder",
      "相关：get down（下来）/ come down（下来）"
    ],
    "distractors": [["Climbs","Climbing","Climbed"],["upstairs.","over.","up the."]]
  },
  {
    "sentence": "Do the laundry.",
    "translation": "洗衣服。",
    "chunks": ["Do", "the laundry."],
    "hints": ["做（这件事）", "要洗的衣物"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/duː/'],pos:'祈使句动词',meaning:'做（某事）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈlɔːndri/'],pos:'名词短语',meaning:'要洗的衣物'}
    ],
    "explanations": [
      "`do the laundry` = 洗衣服，固定搭配。常见错误：\n• 拼写：lau**n**dry，容易错写成 launday\n• \"Wash the laundry\" 不地道，动词用 do",
      "相关：do the dishes（洗碗）/ hang the laundry（晾衣服）"
    ],
    "distractors": [["Does","Doing","Done"],["the laundrys.","a laundry.","the laundry of."]]
  },
  {
    "sentence": "Water the plants.",
    "translation": "给花浇水。",
    "chunks": ["Water", "the plants."],
    "hints": ["浇水", "植物"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈwɔːtər/'],pos:'动词（浇水）',meaning:'浇'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/plænts/'],pos:'名词短语',meaning:'植物'}
    ],
    "explanations": [
      "`water` 作动词就是「浇水」。常见错误：\n• \"Give water the plants\" → 直接 water the plants 就行\n• plant 与 plan 容易听混，注意词尾 /t/",
      "相关：feed the dog（喂狗）/ walk the dog（遛狗）"
    ],
    "distractors": [["Waters","Watering","Watered"],["the plants of.","a plants.","plans."]]
  },
  {
    "sentence": "Take it out.",
    "translation": "拿出来。",
    "chunks": ["Take it", "out."],
    "hints": ["把它", "取出"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ɪt/'],pos:'短语动词 take out（代词夹中）',meaning:'把它取出'},
      {role:'副词',color:'#7c5cbf',phonetic:['/aʊt/'],pos:'副词',meaning:'出来'}
    ],
    "explanations": [
      "`take out` = 拿出来、取出来，代词夹中间：take **it** out。常见错误：\n• \"Take out it\" → 代词要放中间\n• takeout（一个词）作名词时指「外卖」",
      "反义：put it back（放回去）。"
    ],
    "distractors": [["Take out it","Taking it out","Take it of"],["in.","up.","off."]]
  },
  {
    "sentence": "Put it back.",
    "translation": "放回去。",
    "chunks": ["Put it", "back."],
    "hints": ["把它", "放回"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/pʊt/','/ɪt/'],pos:'短语动词 put back（代词夹中）',meaning:'把它放回'},
      {role:'副词',color:'#7c5cbf',phonetic:['/bæk/'],pos:'副词',meaning:'回去'}
    ],
    "explanations": [
      "`put it back` = 放回原处，代词夹中间。常见错误：\n• \"Put back it\" → 代词要放中间\n• \"Put it back to\" → back 后面一般不加 to",
      "相关：put it away（收起来）/ return it（归还）"
    ],
    "distractors": [["Put back it","Putting it back","Put it of"],["front.","down.","of."]]
  },
  {
    "sentence": "Don't fall asleep.",
    "translation": "别睡着了。",
    "chunks": ["Don't fall", "asleep."],
    "hints": ["别", "睡着的"],
    "grammar": [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/','/fɔːl/'],pos:'don\'t + 动词原形',meaning:'别'},
      {role:'表语',color:'#3358e0',phonetic:['/əˈsliːp/'],pos:'形容词（表状态）',meaning:'睡着的'}
    ],
    "explanations": [
      "`fall asleep` = 睡着，指进入睡眠状态。常见错误：\n• \"Don't fall sleep\" → 形容词是 asleep，不是 sleep\n• \"Don't sleep\" 只是「别睡」，fall asleep 更强调整个人睡过去",
      "相关：stay awake（保持清醒）/ I nodded off.（我打瞌睡了）"
    ],
    "distractors": [["Doesn't fall","Don't fall to","No fall"],["sleep.","sleeping.","sleepy."]]
  },
  {
    "sentence": "Don't stay up.",
    "translation": "别熬夜。",
    "chunks": ["Don't stay", "up."],
    "hints": ["别", "熬夜、不睡"],
    "grammar": [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/','/steɪ/'],pos:'don\'t + 动词原形',meaning:'别'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ʌp/'],pos:'副词（固定搭配 stay up）',meaning:'熬夜、不睡'}
    ],
    "explanations": [
      "`stay up` = 熬夜不睡，up 是固定成分。常见错误：\n• \"Don't stay wake\" → 想说不睡应该用 stay up / stay awake\n• 常说 \"Don't stay up late\"，指别熬到很晚",
      "相关：pull an all-nighter（通宵）/ get an early night（早点睡）"
    ],
    "distractors": [["Doesn't stay","Don't stay to","No stay"],["out.","in.","down."]]
  },
  {
    "sentence": "I had a nightmare.",
    "translation": "我做了个噩梦。",
    "chunks": ["I had", "a nightmare."],
    "hints": ["我做了", "一个噩梦"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/hæd/'],pos:'一般过去时',meaning:'我做了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈnaɪtmer/'],pos:'名词短语',meaning:'一个噩梦'}
    ],
    "explanations": [
      "「做噩梦」用 `have a nightmare`，过去式 had。常见错误：\n• \"I have a nightmare\" → 说昨晚的事要用过去式\n• \"I made a nightmare\" → 噩梦不是「制作」的，用 have",
      "相关：a bad dream（也行）/ a sweet dream（好梦）"
    ],
    "distractors": [["I have","I'm had","I had got"],["a nightmares.","nightmare.","a night mare."]]
  },
  {
    "sentence": "Go to bed early.",
    "translation": "早点睡。",
    "chunks": ["Go to bed", "early."],
    "hints": ["上床睡觉", "早"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/','/tuː/','/bed/'],pos:'动词短语 go to bed',meaning:'上床睡觉'},
      {role:'状语',color:'#7c5cbf',phonetic:['/ˈɜːrli/'],pos:'副词',meaning:'早'}
    ],
    "explanations": [
      "`go to bed` 指「去睡觉」，bed 前不加冠词。常见错误：\n• \"Go to the bed\" → 那是「走到那张床边去」\n• \"Go to sleep early\" 也可，但 go to bed 更强调上床这个动作",
      "相关：get an early night（早点睡）/ stay up late（熬夜）"
    ],
    "distractors": [["Go to the bed","Go to bed to","Going to bed"],["late.","earlier.","earliest."]]
  },
  {
    "sentence": "Give me a thumbs up.",
    "translation": "给我竖个大拇指（点个赞）吧。",
    "chunks": ["Give me", "a thumbs up."],
    "hints": ["给我", "一个大拇指（赞成）"],
    "grammar": [
      {role:'谓语 + 宾语',color:'#e74c7a',phonetic:['/ɡɪv/','/miː/'],pos:'动词 + 间接宾语',meaning:'给我'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/θʌmz/','/ʌp/'],pos:'名词短语（固定写法）',meaning:'一个大拇指'}
    ],
    "explanations": [
      "`a thumbs up` = 竖大拇指表示赞成，固定带 s。常见错误：\n• \"a thumb up\" → 固定写法是 thumbs up\n• 引申为「点赞」：Give it a thumbs up.",
      "反义：a thumbs down（表示反对）"
    ],
    "distractors": [["Give me to","Giving me","Give I"],["a thumb up.","a thumbs-ups.","thumb ups."]]
  },
  {
    "sentence": "We have more like this.",
    "translation": "我们还有更多像这样的。",
    "chunks": ["We have", "more like this."],
    "hints": ["我们有", "更多像这样的"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/wiː/','/hæv/'],pos:'一般现在时',meaning:'我们有'},
      {role:'宾语',color:'#3358e0',phonetic:['/mɔːr/','/laɪk/','/ðɪs/'],pos:'名词短语',meaning:'更多像这样的'}
    ],
    "explanations": [
      "`more like this` = 更多像这样的，用于介绍同类内容。常见错误：\n• \"more like these\" → 指刚提到的那一类用 this 更稳\n• 只说 \"We have more\" 需要语境支撑，说完整更清楚",
      "相关：There's plenty more.（还有很多）/ Want to see more?"
    ],
    "distractors": [["We has","We having","We are have"],["more like these.","more likes this.","much like this."]]
  }
];
