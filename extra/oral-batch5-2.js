/* 口语 8000 句 · 第五批数据源（批次 2/6）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch5-2.js */
var ORAL_BATCH = [
  {
    "sentence": "I'm heading out the door.",
    "translation": "我要出门了。",
    "chunks": ["I'm heading out", "the door."],
    "hints": ["我正往外走", "门"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/aɪm/','/ˈhedɪŋ/','/aʊt/'],pos:'现在进行时',meaning:'我正往外走'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ðə/','/dɔːr/'],pos:'名词短语',meaning:'门口'}
    ],
    "explanations": [
      "`head out` 是「出门、出发」的口语说法，进行时表「马上就走」。常见错误：\n• \"I heading out\" → 漏 be 动词\n• \"I'm heading out of the door\" → 口语里不加 of，直接 the door",
      "家人告别常说：I'm heading out! 对方回 Have a good one!（路上顺利）"
    ],
    "distractors": [["I heading out","I'm heading of","I'm head out"],["a door.","the doors.","the door out."]]
  },
  {
    "sentence": "Get some groceries.",
    "translation": "买点菜。",
    "chunks": ["Get some", "groceries."],
    "hints": ["买点", "食品杂货"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/sʌm/'],pos:'动词 + 限定词',meaning:'买点'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈɡroʊsəriz/'],pos:'名词（恒用复数）',meaning:'食材杂货'}
    ],
    "explanations": [
      "`groceries` 指超市买回来的食材、日用品，习惯用复数。常见错误：\n• \"Get some grocery\" → 一般用复数 groceries\n• 拼写别丢 c：gro**c**eries，不是 groseries",
      "美式也说 get some food / pick up some stuff；英式常说 do the shopping。"
    ],
    "distractors": [["Get a","Get any","Got some"],["grocery.","grocerys.","the groceries of."]]
  },
  {
    "sentence": "The sun's out.",
    "translation": "太阳出来了。",
    "chunks": ["The sun's", "out."],
    "hints": ["太阳", "出来了"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/ðə/','/sʌnz/'],pos:'名词 + is 缩写',meaning:'太阳（出来了）'},
      {role:'表语',color:'#3358e0',phonetic:['/aʊt/'],pos:'副词作表语',meaning:'出来了、露面'}
    ],
    "explanations": [
      "`The sun's out.` 指太阳出来了，out 在此表「露面」。常见错误：\n• \"The sun's out of\" → out 后面不加东西\n• \"The sun comes out\" 也对，但 the sun's out 更即时",
      "同类：The moon's out. / The stars are out."
    ],
    "distractors": [["The sun","The sunny","The sun is of"],["out of.","outs.","outing."]]
  },
  {
    "sentence": "Take a walk.",
    "translation": "去走走。",
    "chunks": ["Take a", "walk."],
    "hints": ["去散个", "步"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ə/'],pos:'动词短语 take a walk',meaning:'去散步'},
      {role:'宾语',color:'#3358e0',phonetic:['/wɔːk/'],pos:'名词',meaning:'走路'}
    ],
    "explanations": [
      "`take a walk` 是「去走走、散步」的固定搭配。常见错误：\n• \"Take walk\" → 缺少 a\n• \"Go a walk\" → 动词用 take 或 have，不用 go",
      "同义：go for a walk / take a stroll（更悠闲）。"
    ],
    "distractors": [["Take the","Make a","Go a"],["walks.","walking.","a walk."]]
  },
  {
    "sentence": "It's raining.",
    "translation": "下雨了。",
    "chunks": ["It's", "raining."],
    "hints": ["天（它）", "在下雨"],
    "grammar": [
      {role:'形式主语',color:'#c87033',phonetic:['/ɪts/'],pos:'it 指天气',meaning:'天'},
      {role:'谓语（进行时）',color:'#e74c7a',phonetic:['/ˈreɪnɪŋ/'],pos:'现在进行时',meaning:'正在下雨'}
    ],
    "explanations": [
      "谈天气时用 it 作形式主语，不能用 he/she。常见错误：\n• \"It rains now\" → 眼下正在下要用进行时\n• \"Rain is happening\" → 不地道，直接说 It's raining",
      "相关：It's pouring.（下大雨）/ It's drizzling.（下毛毛雨）"
    ],
    "distractors": [["It","It is raining","There's"],["rains.","rained.","rainy."]]
  },
  {
    "sentence": "It's getting windy.",
    "translation": "起风了。",
    "chunks": ["It's getting", "windy."],
    "hints": ["正在变得", "有风"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ˈɡetɪŋ/'],pos:'get + 形容词（进行时）',meaning:'正在变得'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈwɪndi/'],pos:'形容词',meaning:'有风的'}
    ],
    "explanations": [
      "`windy` = wind + y，表「起风的」。常见错误：\n• \"It's getting wind\" → 形容词形式是 windy\n• \"It's getting a wind\" → 不需要冠词",
      "同类天气变化：It's getting cloudy / foggy / chilly."
    ],
    "distractors": [["It getting","It's got","It's get"],["wind.","windily.","winds."]]
  },
  {
    "sentence": "Order some food.",
    "translation": "点东西吃。",
    "chunks": ["Order some", "food."],
    "hints": ["点一些", "食物"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈɔːrdər/','/sʌm/'],pos:'动词 + 限定词',meaning:'点一些'},
      {role:'宾语',color:'#3358e0',phonetic:['/fuːd/'],pos:'不可数名词',meaning:'食物'}
    ],
    "explanations": [
      "`order` 指在餐厅点餐或叫外卖。常见错误：\n• \"Order some foods\" → 泛指食物时 food 不可数\n• \"Order for some food\" → order 是及物动词，直接接宾语",
      "外卖：order in / order takeout；堂食点餐：order from the menu。"
    ],
    "distractors": [["Order a","Order any","Buy for some"],["foods.","the food of.","feed."]]
  },
  {
    "sentence": "Set the table.",
    "translation": "布置桌子（摆餐具）。",
    "chunks": ["Set", "the table."],
    "hints": ["摆放", "桌子"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/set/'],pos:'祈使句动词',meaning:'摆放'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈteɪbl/'],pos:'名词短语',meaning:'餐桌'}
    ],
    "explanations": [
      "`set the table` 专指「摆好餐具、布置餐桌」。常见错误：\n• \"Put the table\" → put 不能表布置桌面\n• \"Set up the table\" → set up 是「组装」，摆餐具只用 set",
      "相关：clear the table（收拾桌子）/ do the dishes（洗碗）。"
    ],
    "distractors": [["Sets","Sit","Setting"],["the tables.","a table.","the table up."]]
  },
  {
    "sentence": "Stand up.",
    "translation": "起来（站起来）。",
    "chunks": ["Stand", "up."],
    "hints": ["站", "起来"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/stænd/'],pos:'祈使句动词',meaning:'站立'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ʌp/'],pos:'副词（表方向）',meaning:'起来'}
    ],
    "explanations": [
      "`stand up` 指从坐、躺到站起来。常见错误：\n• \"Stand up you\" → 祈使句不重复主语\n• \"Stand on\" → 意思变成「站在……上面」，需接宾语",
      "对比 `get up`：get up 还能表起床，stand up 只指站起来。"
    ],
    "distractors": [["Stands","Sit","Standing"],["upstairs.","down.","over."]]
  },
  {
    "sentence": "Sit down.",
    "translation": "坐下。",
    "chunks": ["Sit", "down."],
    "hints": ["坐", "下"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/sɪt/'],pos:'祈使句动词',meaning:'坐'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词（表方向）',meaning:'下'}
    ],
    "explanations": [
      "`sit down` 是「坐下」的固定表达，与 stand up 相对。常见错误：\n• \"Sit down you\" → 祈使句不加主语\n• \"Sit on\" → 必须接宾语（sit on the chair）",
      "更客气：Have a seat. / Please, take a seat."
    ],
    "distractors": [["Sits","Stand","Sitting"],["upstairs.","up.","over."]]
  },
  {
    "sentence": "I'll have a burger.",
    "translation": "我要一个汉堡。",
    "chunks": ["I'll have", "a burger."],
    "hints": ["我要（点）", "一个汉堡"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪl/','/hæv/'],pos:'will + 动词原形',meaning:'我要（点）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈbɜːrɡər/'],pos:'名词短语',meaning:'一个汉堡'}
    ],
    "explanations": [
      "点餐用 `I'll have...` 最自然，比 I want 礼貌。常见错误：\n• \"I have a burger\" → 少 will，听起来像陈述已有\n• \"I'd have a burger\" → 那是虚拟语气，点餐该用 I'll",
      "同类：I'll take the soup. / I'll go with the salad."
    ],
    "distractors": [["I have","I'll having","I would had"],["the burger.","burger.","a burgers."]]
  },
  {
    "sentence": "That's everything.",
    "translation": "就这些。",
    "chunks": ["That's", "everything."],
    "hints": ["那就（是）", "全部"],
    "grammar": [
      {role:'主语 + be',color:'#c87033',phonetic:['/ðæts/'],pos:'that is 缩写',meaning:'那就是'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈevriθɪŋ/'],pos:'不定代词',meaning:'全部、所有'}
    ],
    "explanations": [
      "点完单或收拾完东西时用 `That's everything.` = 就这些。常见错误：\n• \"These are everything\" → 主语用 that\n• \"That's anything\" → 意思完全不对，anything 用于疑问否定",
      "同类收尾语：That's it. / That's all for now."
    ],
    "distractors": [["That","These","That is of"],["anything.","everythings.","all thing."]]
  },
  {
    "sentence": "Get in the car.",
    "translation": "上车吧。",
    "chunks": ["Get in", "the car."],
    "hints": ["进", "车"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/ɪn/'],pos:'短语动词 get in',meaning:'进入'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/kɑːr/'],pos:'名词短语',meaning:'汽车'}
    ],
    "explanations": [
      "私家车这类「钻进里面」的用 `get in`，公交车、飞机、火车用 get on。常见错误：\n• \"Get on the car\" → 会被理解成爬到车上去\n• \"Get into the car\" 也对，into 更强调进入的动作",
      "对比：get in the car / get on the bus / get on the plane。"
    ],
    "distractors": [["Get on","Get at","Get of"],["the cars.","a car.","the car of."]]
  },
  {
    "sentence": "Get on the plane.",
    "translation": "上飞机。",
    "chunks": ["Get on", "the plane."],
    "hints": ["登上", "飞机"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/ɑːn/'],pos:'短语动词 get on',meaning:'登上'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/pleɪn/'],pos:'名词短语',meaning:'飞机'}
    ],
    "explanations": [
      "飞机、公交、火车、船这类「登上去」的交通工具用 `get on`。常见错误：\n• \"Get in the plane\" → in 指进到某个内部空间，登机用 on\n• \"Get the plane\" → 少了 on，意思变成得到飞机",
      "下机：get off the plane。"
    ],
    "distractors": [["Get in","Get at","Get of"],["the planes.","a plane.","the plane of."]]
  },
  {
    "sentence": "Be careful.",
    "translation": "当心。",
    "chunks": ["Be", "careful."],
    "hints": ["要（保持）", "小心"],
    "grammar": [
      {role:'系动词（祈使）',color:'#c87033',phonetic:['/biː/'],pos:'be 的祈使形式',meaning:'要（处于某状态）'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈkerfl/'],pos:'形容词',meaning:'小心的'}
    ],
    "explanations": [
      "祈使句里 be 用原形：Be careful. 常见错误：\n• \"Are careful\" → 祈使句不用 are\n• \"Be carefully\" → carefully 是副词，这里需要形容词 careful",
      "加限定：Be careful with the knife.（用刀当心）/ Be careful out there."
    ],
    "distractors": [["Are","Being","Was"],["carefully.","care.","cares."]]
  },
  {
    "sentence": "Don't fall down.",
    "translation": "别摔了。",
    "chunks": ["Don't", "fall down."],
    "hints": ["别", "摔下来"],
    "grammar": [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/'],pos:'do not 缩写',meaning:'别'},
      {role:'谓语',color:'#7c5cbf',phonetic:['/fɔːl/','/daʊn/'],pos:'短语动词 fall down',meaning:'摔倒、掉下来'}
    ],
    "explanations": [
      "否定祈使用 `Don't + 动词原形`。常见错误：\n• \"Don't falls down\" → 不用第三人称单数\n• \"No fall down\" → 英语没有 no + 动词 的祈使形式",
      "`fall down` 指摔倒、跌落；从某物上掉下来用 fall off（fall off the bike）。"
    ],
    "distractors": [["Doesn't","No","Not"],["falls down.","fell down.","fall on."]]
  },
  {
    "sentence": "Hold on.",
    "translation": "抓紧（也可以表示等一下）。",
    "chunks": ["Hold", "on."],
    "hints": ["抓", "住"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/hoʊld/'],pos:'祈使句动词',meaning:'抓住'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɑːn/'],pos:'副词（固定搭配）',meaning:'持住、继续'}
    ],
    "explanations": [
      "`hold on` 有两义：① 抓紧 ② 等一下（打电话时最常听）。常见错误：\n• \"Hold on to\" 后面要接宾语（hold on to the rail）\n• \"Hold up\" 也可表等等，但「抓紧」只用 hold on",
      "电话里听到 Hold on, please. 就是「请稍等」。"
    ],
    "distractors": [["Holds","Holding","Hold of"],["on to.","off.","out."]]
  },
  {
    "sentence": "Let go.",
    "translation": "松手。",
    "chunks": ["Let", "go."],
    "hints": ["让", "走"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/let/'],pos:'祈使句动词',meaning:'让'},
      {role:'宾语补足语',color:'#7c5cbf',phonetic:['/ɡoʊ/'],pos:'动词原形（固定搭配）',meaning:'松开'}
    ],
    "explanations": [
      "`let go` = 松手、放手，是固定搭配，中间不加 to。常见错误：\n• \"Let to go\" → let 后接动词原形\n• \"Let go it\" → 要说 let it go，代词夹在中间",
      "引申义：Let it go.（放下吧、别纠结了）"
    ],
    "distractors": [["Lets","Letting","Let to"],["goes.","going.","gone."]]
  },
  {
    "sentence": "Turn around.",
    "translation": "转过来、转过去。",
    "chunks": ["Turn", "around."],
    "hints": ["转", "过来（转身）"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/tɜːrn/'],pos:'祈使句动词',meaning:'转'},
      {role:'副词',color:'#7c5cbf',phonetic:['/əˈraʊnd/'],pos:'副词',meaning:'转身、转一圈'}
    ],
    "explanations": [
      "`turn around` 既表「转过来」也表「转过去」，靠语境。常见错误：\n• \"Turn around of\" → around 后面不加介词\n• 英式常说 turn round，美式说 around",
      "相关：turn left / turn right（转弯）；turn back（往回走）。"
    ],
    "distractors": [["Turns","Turning","Turn to"],["around of.","round of.","arounds."]]
  },
  {
    "sentence": "Back away.",
    "translation": "后退。",
    "chunks": ["Back", "away."],
    "hints": ["向后退", "离开"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/bæk/'],pos:'动词（后退）',meaning:'后退'},
      {role:'副词',color:'#7c5cbf',phonetic:['/əˈweɪ/'],pos:'副词',meaning:'离开'}
    ],
    "explanations": [
      "`back away` 指「慢慢往后退」，常用来让人让出空间。常见错误：\n• back away **from** + 宾语 表「从……退开」（back away from the dog）\n• 与 `go back`（回去）不同，别混用",
      "更急的说法：Get back!（退后！）"
    ],
    "distractors": [["Backs","Backing","Back of"],["away from.","out.","off."]]
  }
];
