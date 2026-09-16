/* 口语 8000 句 · 第五批数据源（批次 1/6）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch5-1.js */
var ORAL_BATCH = [
  {
    "sentence": "Go clean up.",
    "translation": "去洗漱吧。",
    "chunks": ["Go", "clean up."],
    "hints": ["去", "收拾干净"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/'],pos:'祈使句动词',meaning:'去'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/kliːn/','/ʌp/'],pos:'短语动词 clean up',meaning:'收拾、洗漱干净'}
    ],
    "explanations": [
      "`clean up` 是「把自己收拾干净」的短语动词，`up` 是固定成分。常见错误：\n• \"Go clean **yourself** up\" → 口语里针对自己时一般直接说 clean up\n• \"Go **to** clean up\" → 祈使句后直接跟动词原形，不加 to",
      "祈使句用动词原形，主语 you 不出现。对比 `wash up`：warm water 洗手洗脸，clean up 更泛。"
    ],
    "distractors": [["Come","Get","Come on"],["cleans up.","clean on.","clean out."]]
  },
  {
    "sentence": "Go wash up.",
    "translation": "去洗把脸、洗把手。",
    "chunks": ["Go", "wash up."],
    "hints": ["去", "洗洗（手脸）"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/'],pos:'祈使句动词',meaning:'去'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/wɑːʃ/','/ʌp/'],pos:'短语动词 wash up',meaning:'洗手洗脸'}
    ],
    "explanations": [
      "`wash up` 在美式英语指「洗手洗脸」，英式还可指「洗碗」。常见错误：\n• \"Go wash up **you**\" → 反身代词多余，祈使句本身已隐含 you\n• \"Go **to** wash up\" → 祈使句后不加 to",
      "与 `clean up` 的区别：wash up 专指用水洗，clean up 泛指收拾弄干净。"
    ],
    "distractors": [["Come","Get","Come in"],["washes up.","wash it up.","wash out."]]
  },
  {
    "sentence": "Rinse your mouth.",
    "translation": "漱漱口。",
    "chunks": ["Rinse", "your mouth."],
    "hints": ["冲洗", "你的嘴"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/rɪns/'],pos:'祈使句动词',meaning:'冲洗、漱'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/maʊθ/'],pos:'名词短语',meaning:'你的嘴'}
    ],
    "explanations": [
      "`rinse` 指用清水冲、漱，词尾是清音 /s/。常见错误：\n• 把 rinse 读成 /rɪnz/ → 动词原形清音，加了 -d 才浊化\n• \"Rinse your mouth water\" → 要喝水一起说就说 with water",
      "用漱口水则是 `rinse with mouthwash`，漱口水这个词本身是 mouthwash。"
    ],
    "distractors": [["Rinse out","Wash","Clean out"],["your mouths.","you mouth.","your mouthing."]]
  },
  {
    "sentence": "Rinse out your mouth.",
    "translation": "把嘴漱干净。",
    "chunks": ["Rinse out", "your mouth."],
    "hints": ["漱干净", "你的嘴"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/rɪns/','/aʊt/'],pos:'短语动词 rinse out',meaning:'漱干净'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/maʊθ/'],pos:'名词短语',meaning:'你的嘴'}
    ],
    "explanations": [
      "`rinse out` 强调「漱干净、冲掉残留」，out 表彻底。常见错误：\n• \"Rinse out **of** your mouth\" → out 后面不接 of\n• \"Rinse out your mouths\" → 一个人只有一张嘴，用单数",
      "对比 `rinse`：加 out 有「冲干净」的结果意味；宾语是代词时要说 rinse it out。"
    ],
    "distractors": [["Rinse of","Rinsing out","Rinse from"],["your mouths.","you mouth.","your mouth out."]]
  },
  {
    "sentence": "Gargle with water.",
    "translation": "用水漱漱喉咙。",
    "chunks": ["Gargle", "with water."],
    "hints": ["漱喉", "用水"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈɡɑːrɡl/'],pos:'祈使句动词（不及物）',meaning:'漱喉咙'},
      {role:'方式状语',color:'#7c5cbf',phonetic:['/wɪð/','/ˈwɔːtər/'],pos:'介词短语',meaning:'用水'}
    ],
    "explanations": [
      "`gargle` 专指「含一口水在喉咙里咕噜」，比 rinse 更具体，且是不及物动词。常见错误：\n• \"Gargle water\" → 漏了 with\n• 记住拼写：gargle → gargling（不双写 l）",
      "常见搭配：gargle with salt water（用盐水漱口），嗓子疼时常说。"
    ],
    "distractors": [["Gargles","Swallow","Gargle out"],["with a water.","with waters.","by water."]]
  },
  {
    "sentence": "Rinse it.",
    "translation": "冲一冲。",
    "chunks": ["Rinse", "it."],
    "hints": ["冲洗", "它"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/rɪns/'],pos:'祈使句动词',meaning:'冲洗'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɪt/'],pos:'人称代词宾格',meaning:'它'}
    ],
    "explanations": [
      "杯子、菜、手上沾了泡沫都能说 `Rinse it.` 常见错误：\n• \"Rinse it clean\" → 想说「冲到干净」应说 Rinse it until clean\n• \"Rinse out it\" → 代词不能放在 out 后面，要说 rinse it out",
      "代词作宾语放动词后：rinse it / rinse them，不能先说 it。"
    ],
    "distractors": [["Rinses","Rinsing","Rinse from"],["them.","its.","it is."]]
  },
  {
    "sentence": "Take a shower.",
    "translation": "洗个澡。",
    "chunks": ["Take a", "shower."],
    "hints": ["洗", "淋浴"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ə/'],pos:'动词短语 take a shower',meaning:'洗（澡）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈʃaʊər/'],pos:'名词',meaning:'淋浴'}
    ],
    "explanations": [
      "`take a shower` 是「洗淋浴」的固定搭配，泡澡用 `take a bath`。常见错误：\n• \"Wash a shower\" → wash 的宾语应是身体或衣物，不是淋浴设备\n• \"Take shower\" → 可数名词单数前要加 a",
      "同义：have a shower（英式更常用）。"
    ],
    "distractors": [["Make a","Take the","Have the"],["show.","showers.","showering."]]
  },
  {
    "sentence": "Dry your hands.",
    "translation": "把手擦干。",
    "chunks": ["Dry", "your hands."],
    "hints": ["擦干", "你的手"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/draɪ/'],pos:'祈使句动词',meaning:'弄干'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/hændz/'],pos:'名词短语',meaning:'你的手'}
    ],
    "explanations": [
      "`dry` 可以直接作动词，表示「弄干」。常见错误：\n• \"Dry your hand\" → 两只手用复数 hands\n• \"Make your hands dry\" → 啰嗦，dry 本身就能当动词",
      "同类：dry your hair（擦干头发）/ dry the clothes（晾干衣服）。"
    ],
    "distractors": [["Dries","Drying","Dry up"],["your hand.","you hands.","your hands of."]]
  },
  {
    "sentence": "Go to the bathroom.",
    "translation": "去上厕所。",
    "chunks": ["Go to", "the bathroom."],
    "hints": ["去", "洗手间"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/','/tuː/'],pos:'动词短语',meaning:'去往'},
      {role:'地点宾语',color:'#3358e0',phonetic:['/ðə/','/ˈbæθruːm/'],pos:'名词短语（带定冠词）',meaning:'洗手间'}
    ],
    "explanations": [
      "`bathroom` 是美式「洗手间」的礼貌说法；英式常用 toilet/loo。常见错误：\n• \"Go to bathroom\" → 漏定冠词 the\n• 美音读 /ˈbæθruːm/，英音才是 /ˈbɑːθruːm/",
      "委婉说法：use the restroom / go to the loo / excuse me for a moment。"
    ],
    "distractors": [["Go in","Go at","Go for"],["the bath.","a bathroom.","the bathrooms."]]
  },
  {
    "sentence": "Have some tea.",
    "translation": "喝点茶。",
    "chunks": ["Have some", "tea."],
    "hints": ["喝点", "茶"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/hæv/','/sʌm/'],pos:'动词 + 限定词',meaning:'喝点'},
      {role:'宾语',color:'#3358e0',phonetic:['/tiː/'],pos:'不可数名词',meaning:'茶'}
    ],
    "explanations": [
      "招待、建议喝什么时用 `have` 比 `drink` 更自然。常见错误：\n• \"Eat some tea\" → 喝用 have / drink，不跟 eat\n• \"Have some teas\" → tea 指饮料时不可数，不加 s",
      "同类：have some coffee / have some juice；「来杯茶」也可说 have a cup of tea。"
    ],
    "distractors": [["Have any","Eat some","Having some"],["teas.","tea is.","the tea of."]]
  },
  {
    "sentence": "Get out of bed.",
    "translation": "起床了。",
    "chunks": ["Get out of", "bed."],
    "hints": ["从……出来", "床"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/aʊt/','/əv/'],pos:'短语动词 get out of',meaning:'从……出来'},
      {role:'宾语',color:'#3358e0',phonetic:['/bed/'],pos:'名词（表用途，不加冠词）',meaning:'床'}
    ],
    "explanations": [
      "`get out of bed` 指「下床、起床」，bed 前不加冠词（表床的用途）。常见错误：\n• \"Get out of the bed\" → 指某张具体的床，不表起床这个动作\n• \"Get up of bed\" → 搭配是 out of",
      "同义：get up。区别：get up 还可表站起来，get out of bed 只指离开床。"
    ],
    "distractors": [["Get out from","Get off of","Get up of"],["the bed.","a bed.","beds."]]
  },
  {
    "sentence": "Get dressed.",
    "translation": "穿好衣服。",
    "chunks": ["Get", "dressed."],
    "hints": ["变得", "穿好衣服的"],
    "grammar": [
      {role:'系动词',color:'#c87033',phonetic:['/ɡet/'],pos:'get + 过去分词',meaning:'变得'},
      {role:'表语',color:'#3358e0',phonetic:['/drest/'],pos:'过去分词作形容词',meaning:'穿好衣服的'}
    ],
    "explanations": [
      "`get dressed` = 把衣服穿好，dressed 是过去分词当形容词。常见错误：\n• \"Get dress\" → 必须是 dressed\n• \"Wear dressed\" → wear 后面接具体衣物，不接 dressed",
      "反义：get undressed（脱衣服）；换衣服说 get changed。"
    ],
    "distractors": [["Get in","Be","Get on"],["dress.","dressing.","dresses."]]
  },
  {
    "sentence": "Let's go downstairs.",
    "translation": "下楼吧。",
    "chunks": ["Let's go", "downstairs."],
    "hints": ["我们走吧", "下楼"],
    "grammar": [
      {role:'主谓（祈使）',color:'#e74c7a',phonetic:['/lets/','/ɡoʊ/'],pos:'let us + 动词原形',meaning:'我们走吧'},
      {role:'方向状语',color:'#7c5cbf',phonetic:['/ˌdaʊnˈsterz/'],pos:'副词',meaning:'下楼'}
    ],
    "explanations": [
      "`Let's` = let us，后面接动词原形。常见错误：\n• \"Let's going downstairs\" → 不用 -ing\n• \"Let's to go downstairs\" → 不加 to",
      "`downstairs` 是副词，前面不加介词：go downstairs（不说 go to downstairs）。反义 upstairs。"
    ],
    "distractors": [["Let's going","Let us to go","Let go"],["to downstairs.","downstair.","the downstairs."]]
  },
  {
    "sentence": "Eat something.",
    "translation": "吃点东西。",
    "chunks": ["Eat", "something."],
    "hints": ["吃", "一些东西"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/iːt/'],pos:'祈使句动词',meaning:'吃'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈsʌmθɪŋ/'],pos:'不定代词',meaning:'一些东西'}
    ],
    "explanations": [
      "`something` 用于肯定、建议、邀请。常见错误：\n• \"Eat anything\" → 劝人吃点东西时用 something\n• \"Eat somethings\" → something 没有复数形式",
      "同类：have something to eat、grab a bite（随便吃点）。"
    ],
    "distractors": [["Eats","Eating","Have eat"],["anything.","somethings.","some thing."]]
  },
  {
    "sentence": "Come to dinner.",
    "translation": "来吃晚饭。",
    "chunks": ["Come to", "dinner."],
    "hints": ["来参加", "晚饭"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/kʌm/','/tuː/'],pos:'动词短语',meaning:'来（参加）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈdɪnər/'],pos:'名词（三餐不加冠词）',meaning:'晚饭'}
    ],
    "explanations": [
      "三餐名词前一般不加冠词：come to dinner / have dinner。常见错误：\n• \"Come to a dinner\" → 三餐前通常不加 a\n• \"Come at dinner\" → 表「来吃饭」用 to，at 表时间点",
      "同类：come to lunch / come to breakfast；请客说 come for dinner 也常见。"
    ],
    "distractors": [["Come in","Come at","Come for to"],["the dinner.","a dinner.","dinners."]]
  },
  {
    "sentence": "Get off your phone.",
    "translation": "别看手机了。",
    "chunks": ["Get off", "your phone."],
    "hints": ["离开、放下", "你的手机"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/ɔːf/'],pos:'短语动词 get off',meaning:'离开、放下'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/foʊn/'],pos:'名词短语',meaning:'你的手机'}
    ],
    "explanations": [
      "`get off your phone` 字面是「从手机上离开」，口语里就是「别老盯着手机」。常见错误：\n• \"Get off from your phone\" → get off 后面直接接宾语\n• \"Get out your phone\" → 那是「把手机拿出来」，意思正好相反",
      "同类说法：Put your phone down. / Get off the screen."
    ],
    "distractors": [["Get out","Get on","Get from"],["you phone.","your phones.","your phone of."]]
  },
  {
    "sentence": "It's getting cold.",
    "translation": "（饭）要凉了。",
    "chunks": ["It's getting", "cold."],
    "hints": ["它正在变得", "冷"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ˈɡetɪŋ/'],pos:'get + 形容词（进行时）',meaning:'它正在变得'},
      {role:'表语',color:'#3358e0',phonetic:['/koʊld/'],pos:'形容词',meaning:'凉的、冷的'}
    ],
    "explanations": [
      "`get + 形容词` 表「逐渐变得」，比 be 更有变化感。常见错误：\n• \"It's get cold\" → 进行时要用 getting\n• \"It gets cold\" → 一般现在时表习惯，指眼下要变了用进行时",
      "指饭菜或天气都用 it：It's getting cold. Let's eat.（要凉了，吃吧）"
    ],
    "distractors": [["It's get","It getting","It's got"],["colder of.","coldly.","the cold."]]
  },
  {
    "sentence": "Warm it up first.",
    "translation": "先热一下。",
    "chunks": ["Warm it up", "first."],
    "hints": ["把它热一下", "先"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/wɔːrm/','/ɪt/','/ʌp/'],pos:'短语动词 warm up（代词夹中）',meaning:'把它加热'},
      {role:'状语',color:'#7c5cbf',phonetic:['/fɜːrst/'],pos:'副词',meaning:'先'}
    ],
    "explanations": [
      "`warm up` 加热；宾语是代词时必须夹在中间：warm **it** up。常见错误：\n• \"Warm up it first\" → 代词不能放后面\n• \"Warm it up first\" 与 \"Warm it first\" 都对，加 up 更强调热透",
      "同类：heat it up / pop it in the microwave。"
    ],
    "distractors": [["Warm up it","Warmer it up","Warm it from"],["the first.","firstly.","at first."]]
  },
  {
    "sentence": "Get some fresh air.",
    "translation": "去呼吸点新鲜空气。",
    "chunks": ["Get some", "fresh air."],
    "hints": ["去弄点", "新鲜空气"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/sʌm/'],pos:'动词 + 限定词',meaning:'去弄点'},
      {role:'宾语',color:'#3358e0',phonetic:['/freʃ/','/er/'],pos:'名词短语（不可数）',meaning:'新鲜空气'}
    ],
    "explanations": [
      "`get some fresh air` 就是「出去透透气」。常见错误：\n• \"Get some fresh airs\" → air 不可数，不加 s\n• \"Get some fresh water\" → 那是淡水，fresh air 才是空气",
      "同类：take a walk / get some sun，都属「出门活动」这一族。"
    ],
    "distractors": [["Get a","Get any","Got some"],["fresh airs.","fresh the air.","freshly air."]]
  },
  {
    "sentence": "Get some sun.",
    "translation": "去晒晒太阳。",
    "chunks": ["Get some", "sun."],
    "hints": ["去晒点", "太阳"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/sʌm/'],pos:'动词 + 限定词',meaning:'去晒点'},
      {role:'宾语',color:'#3358e0',phonetic:['/sʌn/'],pos:'不可数名词',meaning:'阳光'}
    ],
    "explanations": [
      "`get some sun` 是「晒太阳」最地道的口语说法。常见错误：\n• \"Get some suns\" → sun 不可数\n• sun 与 son 同音 /sʌn/，听写时靠上下文区分",
      "相关：get some sunshine（更强调暖阳）、get a tan（晒黑）。"
    ],
    "distractors": [["Get a","Got some","Get any"],["suns.","the sun of.","son."]]
  }
];
