/* 口语 8000 句 · 第五批数据源（批次 3/6）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch5-3.js */
var ORAL_BATCH = [
  {
    "sentence": "Don't stare.",
    "translation": "别盯着看。",
    "chunks": ["Don't", "stare."],
    "hints": ["别", "盯着看"],
    "grammar": [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/'],pos:'do not 缩写',meaning:'别'},
      {role:'谓语',color:'#7c5cbf',phonetic:['/ster/'],pos:'动词原形',meaning:'盯着看'}
    ],
    "explanations": [
      "`stare` 指长时间盯着看，带不礼貌的意味。常见错误：\n• \"Don't staring\" → 否定祈使后接动词原形\n• \"Don't stare me\" → 盯住某人要说 stare at me",
      "提醒别人时可以说：Don't stare, it's rude."
    ],
    "distractors": [["Doesn't","Not","No"],["stares.","staring.","stare at."]]
  },
  {
    "sentence": "Close your eyes.",
    "translation": "闭上眼睛。",
    "chunks": ["Close", "your eyes."],
    "hints": ["闭上", "你的眼睛"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/kloʊz/'],pos:'祈使句动词',meaning:'闭上'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/aɪz/'],pos:'名词短语',meaning:'你的眼睛'}
    ],
    "explanations": [
      "作动词的 `close` 读 /kloʊz/，不读 /kloʊs/。常见错误：\n• \"Close your eye\" → 两只眼睛用复数 eyes\n• \"Shut your eyes\" 也对，但 close 更通用",
      "相关：open your eyes（睁开眼）/ cover your eyes（捂住眼睛）"
    ],
    "distractors": [["Closes","Closing","Open"],["your eye.","you eyes.","your eyes of."]]
  },
  {
    "sentence": "Blow your nose.",
    "translation": "擤鼻涕。",
    "chunks": ["Blow", "your nose."],
    "hints": ["擤", "你的鼻子"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/bloʊ/'],pos:'祈使句动词',meaning:'擤'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/noʊz/'],pos:'名词短语',meaning:'你的鼻子'}
    ],
    "explanations": [
      "擤鼻涕的动词是 `blow`，名词是 nose。常见错误：\n• \"Blow your noses\" → 一人一个鼻子，用单数\n• \"Wipe your nose\" 是用纸巾擦，blow 才是擤",
      "相关：a runny nose（流鼻涕）/ a stuffy nose（鼻塞）"
    ],
    "distractors": [["Blows","Blowing","Blow out"],["your nose's.","you nose.","your nose is."]]
  },
  {
    "sentence": "I sneezed.",
    "translation": "我打了个喷嚏。",
    "chunks": ["I", "sneezed."],
    "hints": ["我", "打了喷嚏"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/aɪ/'],pos:'第一人称代词',meaning:'我'},
      {role:'谓语',color:'#e74c7a',phonetic:['/sniːzd/'],pos:'一般过去时',meaning:'打了喷嚏'}
    ],
    "explanations": [
      "打喷嚏的动词是 `sneeze`，过去式读 /sniːzd/。常见错误：\n• \"I sneeze\" → 刚打过要用过去式\n• 拼写别漏 e：snee**ze**，不是 snez",
      "别人打喷嚏后说 Bless you!，回一句 Thank you. 就行。"
    ],
    "distractors": [["Me","My","I've"],["sneezes.","sneezing.","sneeze."]]
  },
  {
    "sentence": "I need help.",
    "translation": "我需要帮助。",
    "chunks": ["I need", "help."],
    "hints": ["我需要", "帮助"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/niːd/'],pos:'一般现在时',meaning:'我需要'},
      {role:'宾语',color:'#3358e0',phonetic:['/help/'],pos:'不可数名词',meaning:'帮助'}
    ],
    "explanations": [
      "求助最直接的表达，`help` 不可数。常见错误：\n• \"I need a help\" → help 不可数，不加 a\n• \"I need helps\" → 也不加 s",
      "更礼貌：Could you help me? / I need some assistance."
    ],
    "distractors": [["I wants","I am need","I needs"],["helps.","a help.","helper."]]
  },
  {
    "sentence": "Are you sick?",
    "translation": "你生病了吗？",
    "chunks": ["Are you", "sick?"],
    "hints": ["你是", "生病的"],
    "grammar": [
      {role:'系动词 + 主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'一般疑问句',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/sɪk/'],pos:'形容词',meaning:'生病的'}
    ],
    "explanations": [
      "美式用 `sick` 表生病，英式更常说 ill。常见错误：\n• \"Do you sick?\" → sick 是形容词，要用 be 动词提问\n• 说这句话时句尾语调要上扬",
      "关心两句：Are you feeling okay? / You look pale."
    ],
    "distractors": [["Is you","Are your","Do you"],["sickly?","tired?","sad?"]]
  },
  {
    "sentence": "Take some medicine.",
    "translation": "吃点药。",
    "chunks": ["Take some", "medicine."],
    "hints": ["服用一些", "药"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/sʌm/'],pos:'动词 + 限定词',meaning:'服用一些'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈmedɪsn/'],pos:'不可数名词',meaning:'药'}
    ],
    "explanations": [
      "英文「吃药」用 `take`，不用 eat。常见错误：\n• \"Eat some medicine\" → 中文说吃药，英文是 take medicine\n• \"Take some medicines\" → 泛指药物时不可数",
      "相关：take a pill（吃一片药）/ take it twice a day（一天吃两次）"
    ],
    "distractors": [["Eat some","Take a","Takes some"],["medicines.","a medicine.","medical."]]
  },
  {
    "sentence": "Where does it hurt?",
    "translation": "哪里疼？",
    "chunks": ["Where", "does it hurt?"],
    "hints": ["哪里", "它疼"],
    "grammar": [
      {role:'疑问词',color:'#7c5cbf',phonetic:['/wer/'],pos:'疑问副词',meaning:'哪里'},
      {role:'助动词 + 主语 + 谓语',color:'#e74c7a',phonetic:['/dʌz/','/ɪt/','/hɜːrt/'],pos:'一般现在时疑问句',meaning:'它疼'}
    ],
    "explanations": [
      "`hurt` 可及物可不及物，问哪里疼这样说最自然。常见错误：\n• \"Where does it hurts?\" → 助动词 does 后动词要用原形\n• \"Where it hurts?\" → 疑问句缺助动词",
      "医生还会问：Does it hurt here?（这里疼吗）"
    ],
    "distractors": [["What","When","Which"],["do it hurt?","does it hurts?","is it hurt?"]]
  },
  {
    "sentence": "Is it your stomach?",
    "translation": "是肚子吗？",
    "chunks": ["Is it", "your stomach?"],
    "hints": ["是它", "你的肚子"],
    "grammar": [
      {role:'系动词 + 主语',color:'#c87033',phonetic:['/ɪz/','/ɪt/'],pos:'一般疑问句',meaning:'（它）是'},
      {role:'表语',color:'#3358e0',phonetic:['/jʊr/','/ˈstʌmək/'],pos:'名词短语',meaning:'你的胃、肚子'}
    ],
    "explanations": [
      "确认疼痛位置时医生常这样问。常见错误：\n• 回答别背整句，简短答 Yes, it is. 就好\n• stomach 读 /ˈstʌmək/，ch 不发 /tʃ/；口语里也说 tummy",
      "相关部位：chest（胸口）/ throat（喉咙）/ back（背）"
    ],
    "distractors": [["Are it","Is your","Does it"],["your stomachs?","you stomach?","your stomach ache?"]]
  },
  {
    "sentence": "Take a rest.",
    "translation": "休息一下。",
    "chunks": ["Take a", "rest."],
    "hints": ["休息", "一下"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ə/'],pos:'动词短语 take a rest',meaning:'休息'},
      {role:'宾语',color:'#3358e0',phonetic:['/rest/'],pos:'名词',meaning:'休息'}
    ],
    "explanations": [
      "`take a rest` 与 `take a break` 都能表休息，rest 更偏身体恢复。常见错误：\n• \"Take rest\" → 缺少 a\n• \"Do a rest\" → 动词用 take 或 have",
      "相关：get some rest（好好休息）/ rest up（充分休息）"
    ],
    "distractors": [["Take the","Make a","Do a"],["rests.","resting.","a rest."]]
  },
  {
    "sentence": "Have some water.",
    "translation": "喝点水。",
    "chunks": ["Have some", "water."],
    "hints": ["喝点", "水"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/hæv/','/sʌm/'],pos:'动词 + 限定词',meaning:'喝点'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈwɔːtər/'],pos:'不可数名词',meaning:'水'}
    ],
    "explanations": [
      "劝人喝点水用 `have` 比 drink 更日常。常见错误：\n• \"Have some waters\" → water 不可数\n• \"Eat some water\" → 喝用 have / drink",
      "相关：drink plenty of water（多喝水）/ stay hydrated"
    ],
    "distractors": [["Have any","Eat some","Having some"],["waters.","a water.","water is."]]
  },
  {
    "sentence": "Lie down.",
    "translation": "躺下。",
    "chunks": ["Lie", "down."],
    "hints": ["躺", "下"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/laɪ/'],pos:'祈使句动词（不及物）',meaning:'躺'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词（表方向）',meaning:'下'}
    ],
    "explanations": [
      "`lie down` 的 lie 是不及物动词，过去式是 lay。常见错误：\n• \"Lay down\" → lay 需要宾语（lay the book down），自己躺要用 lie\n• \"Lie down you\" → 祈使句不加主语",
      "相关：lie on the bed（躺在床上）/ lie still（躺着别动）"
    ],
    "distractors": [["Lay","Lies","Lying"],["downstairs.","up.","over."]]
  },
  {
    "sentence": "Just relax.",
    "translation": "放松一下。",
    "chunks": ["Just", "relax."],
    "hints": ["就、尽管", "放松"],
    "grammar": [
      {role:'副词',color:'#7c5cbf',phonetic:['/dʒʌst/'],pos:'副词（缓和语气）',meaning:'就、只管'},
      {role:'谓语',color:'#e74c7a',phonetic:['/rɪˈlæks/'],pos:'祈使句动词',meaning:'放松'}
    ],
    "explanations": [
      "`just` 在这里缓和语气，等于「你就放松吧」。常见错误：\n• \"Just relax you\" → 祈使句不加主语\n• \"Just relaxing\" → 祈使句要用动词原形",
      "安慰别人：Take it easy. / Relax, it's fine. / Just breathe."
    ],
    "distractors": [["Only","Just be","Very"],["relaxing.","relaxes.","relaxed."]]
  },
  {
    "sentence": "Your fever broke.",
    "translation": "你的烧退了。",
    "chunks": ["Your fever", "broke."],
    "hints": ["你的发烧", "退了"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/jʊr/','/ˈfiːvər/'],pos:'名词短语',meaning:'你的发烧'},
      {role:'谓语',color:'#e74c7a',phonetic:['/broʊk/'],pos:'break 的过去式（此处指退烧）',meaning:'退了'}
    ],
    "explanations": [
      "`break` 用于发烧指「退烧」，非常地道。常见错误：\n• break 的过去式是 broke，不是 breaked\n• \"Your fever went down\" 也对，但 break 更地道",
      "退烧药是 a fever reducer；量体温是 take your temperature。"
    ],
    "distractors": [["You fever","Your fevers","Your fever is"],["breaks.","breaked.","broken."]]
  },
  {
    "sentence": "I still have a little cough.",
    "translation": "我还有点咳嗽。",
    "chunks": ["I still have", "a little cough."],
    "hints": ["我还有", "一点咳嗽"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/stɪl/','/hæv/'],pos:'一般现在时',meaning:'我还有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈlɪtl/','/kɔːf/'],pos:'名词短语',meaning:'一点咳嗽'}
    ],
    "explanations": [
      "描述症状用 `have a + 症状`。常见错误：\n• \"I still have little cough\" → 少了 a\n• cough 读 /kɔːf/，词尾是 /f/ 不是 /k/",
      "相关：have a cold（感冒）/ have a runny nose（流鼻涕）/ have a sore throat（嗓子疼）"
    ],
    "distractors": [["I still has","I have still","I'm still have"],["a little coughs.","little cough.","a cough little."]]
  },
  {
    "sentence": "What size are you?",
    "translation": "你穿多大码？",
    "chunks": ["What size", "are you?"],
    "hints": ["什么尺码", "你是"],
    "grammar": [
      {role:'疑问词 + 名词',color:'#7c5cbf',phonetic:['/wʌt/','/saɪz/'],pos:'疑问短语',meaning:'什么尺码'},
      {role:'系动词 + 主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'疑问句语序',meaning:'你是'}
    ],
    "explanations": [
      "买衣服问尺码最常用这句。常见错误：\n• \"What size you are?\" → 疑问句要用 are you 的语序\n• \"What's your size?\" 也对，但店员更常说 What size are you?",
      "回答：I'm a medium. / I wear a size 8."
    ],
    "distractors": [["What sizes","How size","Which size of"],["you are?","are your?","is you?"]]
  },
  {
    "sentence": "Just pick out anything.",
    "translation": "随便挑。",
    "chunks": ["Just pick out", "anything."],
    "hints": ["随便挑", "任何东西"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/dʒʌst/','/pɪk/','/aʊt/'],pos:'短语动词 pick out（祈使）',meaning:'随便挑'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈeniθɪŋ/'],pos:'不定代词',meaning:'任何东西'}
    ],
    "explanations": [
      "`pick out` = 挑选；表「随便挑」时宾语用 anything。常见错误：\n• \"Pick out something\" → 随便挑要用 anything\n• \"Pick of\" → 少了 out，pick 单独用意思变成「采、摘」",
      "同类：Choose whichever you like. / Take your pick."
    ],
    "distractors": [["Pick up out","Just pick of","Just picks out"],["something.","anythings.","anything is."]]
  },
  {
    "sentence": "Put it on.",
    "translation": "穿上。",
    "chunks": ["Put it", "on."],
    "hints": ["把它", "穿上"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/pʊt/','/ɪt/'],pos:'短语动词 put on（代词夹中）',meaning:'把它（穿）上'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɑːn/'],pos:'副词',meaning:'上（穿戴）'}
    ],
    "explanations": [
      "`put on` 表穿戴，代词宾语必须放中间：put **it** on。常见错误：\n• \"Put on it\" → 代词不能放后面\n• put on 是穿的动作，wear 是穿着的状态",
      "反义：take it off（脱下来）。"
    ],
    "distractors": [["Put on it","Putting it on","Put it of"],["off.","in.","up."]]
  },
  {
    "sentence": "Take it off.",
    "translation": "脱下来。",
    "chunks": ["Take it", "off."],
    "hints": ["把它", "脱下"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ɪt/'],pos:'短语动词 take off（代词夹中）',meaning:'把它脱下来'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɔːf/'],pos:'副词',meaning:'下（脱下）'}
    ],
    "explanations": [
      "`take off` 表脱下衣物，代词夹在中间：take **it** off。常见错误：\n• \"Take off it\" → 代词要放中间\n• take off 还能表「飞机起飞」，靠上下文区分",
      "反义：put it on（穿上）。"
    ],
    "distractors": [["Take off it","Taking it off","Take it of"],["on.","in.","out."]]
  },
  {
    "sentence": "It doesn't fit.",
    "translation": "它不合身。",
    "chunks": ["It doesn't", "fit."],
    "hints": ["它不", "合身"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/ɪt/','/ˈdʌznt/'],pos:'第三人称否定',meaning:'它不'},
      {role:'谓语',color:'#e74c7a',phonetic:['/fɪt/'],pos:'动词原形',meaning:'合身'}
    ],
    "explanations": [
      "衣服合不合身穿 `fit`；太紧太松则说 too tight / too loose. 常见错误：\n• \"It doesn't fits\" → 助动词 doesn't 后跟动词原形\n• \"It's not fit\" → 意思会变成「它不健康」",
      "相关：It fits perfectly.（正合适）/ It fits like a glove."
    ],
    "distractors": [["It don't","It isn't","They doesn't"],["fits.","fitting.","fit on."]]
  }
];
