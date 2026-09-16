/* 口语 8000 句 · 第四批数据源（批次 3/5）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch4-3.js */
var ORAL_BATCH = [
  {
    "sentence": "Do I look fat?",
    "translation": "我看起来胖吗？",
    "chunks": ["Do I", "look fat?"],
    "hints": ["我（是不是）", "看着胖"],
    "grammar": [
      {role:'助动词+主语',color:'#c87033',phonetic:['/duː/','/aɪ/'],pos:'一般现在时疑问',meaning:'我（是不是）'},
      {role:'主系表',color:'#e74c7a',phonetic:['/lʊk/','/fæt/'],pos:'系动词 look + 形容词',meaning:'看着胖'}
    ],
    "explanations": [
      "一般现在时疑问句用 do/does + 主语。常见错误：\n• \"Am I look fat?\" → look 是实义动词，不用 am\n• \"Do me look fat?\" → 主语用主格 I",
      "`look + 形容词` 表「看起来……」。常见错误：\n• \"look fatly\" → 表语用形容词\n• \"look like fat\" → look like 后面要接名词"
    ],
    "distractors": [["Am I","Does I","Do me"],["looks fat?","look fatter?","looking fat?"]]
  },
  {
    "sentence": "You look perfect.",
    "translation": "你看起来很完美。",
    "chunks": ["You look", "perfect."],
    "hints": ["你看起来", "完美"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/lʊk/'],pos:'系动词 look',meaning:'你看起来'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈpɜːrfɪkt/'],pos:'形容词',meaning:'完美'}
    ],
    "explanations": [
      "`perfect` 本身已含「最」的意思，不再用 more/most 修饰。常见错误：\n• \"more perfect\" → 语义重复\n• \"perfectly\" → 那是副词，表「完美地」",
      "`look` 作系动词后接形容词，同义结构：You look great. / You look amazing."
    ],
    "distractors": [["You looks","You looking","Your look"],["perfectly.","perfection.","more perfect."]]
  },
  {
    "sentence": "I've got dandruff.",
    "translation": "我有头皮屑。",
    "chunks": ["I've got", "dandruff."],
    "hints": ["我有", "头皮屑"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪv/','/ɡɑːt/'],pos:'have got 缩写',meaning:'我有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈdændrʌf/'],pos:'不可数名词',meaning:'头皮屑'}
    ],
    "explanations": [
      "`I've got` 是英式/口语里表「有」的常用说法，等于 I have。常见错误：\n• \"I've get\" → got 是过去分词，不能换成原形\n• \"I got dandruff\" → 美式口语也这么说，但强调当下状态用 I've got",
      "`dandruff` 是不可数名词，不加 s、不加 a。常见错误：\n• \"a dandruff\" → 不可数\n• \"dandruffs\" → 没有复数形式"
    ],
    "distractors": [["I got","I've get","I've got to"],["dandruffs.","a dandruff.","the dandruff."]]
  },
  {
    "sentence": "Try some shampoo.",
    "translation": "试试洗发水。",
    "chunks": ["Try", "some shampoo."],
    "hints": ["试试", "一些洗发水"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/traɪ/'],pos:'祈使句动词',meaning:'试试'},
      {role:'宾语',color:'#3358e0',phonetic:['/sʌm/','/ʃæmˈpuː/'],pos:'名词（不可数）',meaning:'一些洗发水'}
    ],
    "explanations": [
      "祈使句直接用动词原形开头。常见错误：\n• \"Trying some shampoo\" → 祈使句不带动名词\n• \"Try to some shampoo\" → try to 后面要接动词",
      "`shampoo` 是不可数名词，用 some 修饰。常见错误：\n• \"a shampoo\" → 说「一瓶洗发水」才用 a bottle of shampoo"
    ],
    "distractors": [["Trying","Tries","Try to"],["some shampoos.","a shampoo.","some shampooing."]]
  },
  {
    "sentence": "It's a used one.",
    "translation": "这是二手的。",
    "chunks": ["It's a", "used one."],
    "hints": ["它是一个", "用过的"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ə/'],pos:'it + is + a',meaning:'它是一个'},
      {role:'表语',color:'#3358e0',phonetic:['/juːzd/','/wʌn/'],pos:'形容词 + 代词',meaning:'用过的（那个）'}
    ],
    "explanations": [
      "`It's a` 后接单数名词或代词 one。常见错误：\n• \"It's an used one\" → u 在此读 /juː/，是辅音音素，用 a\n• \"It's a use one\" → 形容词要用过去分词 used",
      "`used` 作形容词读 /juːzd/，表「用过的、二手的」。常见错误：\n• \"used one\" 读成 /juːst/ → 那是 be used to 的读音，语义不同"
    ],
    "distractors": [["It's an","It a","It's a used"],["use one.","using one.","used ones."]]
  },
  {
    "sentence": "But the price is right.",
    "translation": "但价格合适。",
    "chunks": ["But the price", "is right."],
    "hints": ["但价格", "是合适的"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/bʌt/','/ðə/','/praɪs/'],pos:'名词短语',meaning:'但价格'},
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪz/','/raɪt/'],pos:'is + 形容词',meaning:'是合适的'}
    ],
    "explanations": [
      "`the price is right` 是固定说法，表「价钱公道」。常见错误：\n• \"the prize\" → prize 是奖品，别和 price 混\n• \"the prices is\" → 主语复数才用 are",
      "`right` 在这里是「合适的、公道的」，不是「正确的」。同义：It's a fair price."
    ],
    "distractors": [["But the prices","But price","But the prize"],["are right.","is right's.","was right."]]
  },
  {
    "sentence": "That comes to 30.",
    "translation": "一共三十。",
    "chunks": ["That comes", "to 30."],
    "hints": ["一共（算下来）", "到三十"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/ðæt/','/kʌmz/'],pos:'一般现在时',meaning:'那算下来'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/tə/','/ˈθɜːrti/'],pos:'介词短语',meaning:'到三十'}
    ],
    "explanations": [
      "`come to + 金额` 是结账固定搭配，表「总计」。常见错误：\n• \"That comes 30\" → 少了介词 to\n• \"That come to 30\" → 主语是 that，动词加 s",
      "金额读法：30 读 thirty。同义：That'll be 30. / Your total is 30."
    ],
    "distractors": [["That come","That coming","Those comes"],["to thirteen.","at 30.","for 30."]]
  },
  {
    "sentence": "Cash or credit?",
    "translation": "现金还是刷卡？",
    "chunks": ["Cash", "or credit?"],
    "hints": ["现金", "还是刷卡"],
    "grammar": [
      {role:'名词',color:'#3358e0',phonetic:['/kæʃ/'],pos:'不可数名词',meaning:'现金'},
      {role:'选择问句',color:'#c87033',phonetic:['/ɔːr/','/ˈkredɪt/'],pos:'or + 名词',meaning:'还是刷卡'}
    ],
    "explanations": [
      "结账时的省略问句（Cash or credit? = Will you pay in cash or by credit card?）。常见错误：\n• \"Cash or credit card?\" → 也常听到，口语里 credit 单独用即可\n• 注意 cash 与 cache（缓存/藏匿）拼写不同",
      "选择疑问句用 or 连接两个选项，读时前项升调、后项降调。"
    ],
    "distractors": [["Cash's","Cache","Cashier"],["and credit?","or credit card?","nor credit?"]]
  },
  {
    "sentence": "How ya doin'?",
    "translation": "最近怎么样？",
    "chunks": ["How ya", "doin'?"],
    "hints": ["你（怎么）", "过得"],
    "alts": [null, ["doing?"]],
    "grammar": [
      {role:'疑问词+主语',color:'#c87033',phonetic:['/haʊ/','/jə/'],pos:'How are you 的口语连读',meaning:'你（怎么）'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈduːɪn/'],pos:'doing 的口语拼写',meaning:'过得'}
    ],
    "explanations": [
      "`ya` 是 you 的口语弱读，整句源自 How are you doing?。常见错误：\n• \"How ya doing?\" → 写成 doing 更规范，doin' 是口语拼写\n• \"How you doin'?\" → 也常见，但省略了 are 的读音",
      "这是非常随意的问候，正式场合要说 How are you?"
    ],
    "distractors": [["How you","How are","How's ya"],["do?","done?","doin's?"]]
  },
  {
    "sentence": "Not too bad.",
    "translation": "还不错。",
    "chunks": ["Not too", "bad."],
    "hints": ["不算", "太差"],
    "grammar": [
      {role:'程度状语',color:'#7c5cbf',phonetic:['/nɑːt/','/tuː/'],pos:'否定 + 程度副词',meaning:'不算太'},
      {role:'表语',color:'#3358e0',phonetic:['/bæd/'],pos:'形容词',meaning:'差'}
    ],
    "explanations": [
      "`not too bad` 是英语里典型的「保守式回答」，实际意思接近「挺好的」。常见错误：\n• \"not to bad\" → 程度副词是 too，不是 to\n• \"no too bad\" → 否定词用 not",
      "同义：Pretty good. / Can't complain. / Not bad at all."
    ],
    "distractors": [["No too","Not to","Not to much"],["badly.","worse.","bads."]]
  },
  {
    "sentence": "You moved?",
    "translation": "你搬家了？",
    "chunks": ["You", "moved?"],
    "hints": ["你", "搬了"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/juː/'],pos:'人称代词',meaning:'你'},
      {role:'谓语',color:'#e74c7a',phonetic:['/muːvd/'],pos:'一般过去时',meaning:'搬了'}
    ],
    "explanations": [
      "省略助动词 Did，只靠升调表疑问。常见错误：\n• \"You move?\" → 问已经发生的事要用过去式 moved\n• \"Did you moved?\" → 有 did 时动词要还原成 move",
      "`move` 表搬家时不及物，常说 move in / move out / move to a new place。"
    ],
    "distractors": [["Your","You're","Yours"],["move?","moving?","moved away?"]]
  },
  {
    "sentence": "Yes, nice place.",
    "translation": "是的，好地方。",
    "chunks": ["Yes,", "nice place."],
    "hints": ["是的", "好地方"],
    "grammar": [
      {role:'应答词',color:'#7c5cbf',phonetic:['/jes/'],pos:'肯定应答',meaning:'是的'},
      {role:'名词短语',color:'#3358e0',phonetic:['/naɪs/','/pleɪs/'],pos:'形容词+名词',meaning:'好地方'}
    ],
    "explanations": [
      "`nice place` 是省略句（It's a nice place.），口语常省掉冠词。常见错误：\n• \"nice places\" → 指一处住所要用单数\n• \"a nice place\" → 更完整，省略句里也常见",
      "同义：Nice spot. / Great location."
    ],
    "distractors": [["Yeah,","Yep,","Yup,"],["a nice place.","nice places.","nice play."]]
  },
  {
    "sentence": "What's the rent?",
    "translation": "房租多少？",
    "chunks": ["What's", "the rent?"],
    "hints": ["（是）多少", "房租"],
    "grammar": [
      {role:'疑问词+系动词',color:'#c87033',phonetic:['/wʌts/'],pos:'what + is 缩写',meaning:'（是）多少'},
      {role:'主语',color:'#e74c7a',phonetic:['/ðə/','/rent/'],pos:'名词短语',meaning:'房租'}
    ],
    "explanations": [
      "`What's` = What is，问价格。常见错误：\n• \"Whats\" → 少了撇号\n• \"How much the rent?\" → 更完整的问法是 How much is the rent?",
      "`rent` 表房租，可作名词也可作动词（rent a place）。"
    ],
    "distractors": [["What","What're","What was"],["the rents?","a rent?","the rant?"]]
  },
  {
    "sentence": "300 a week.",
    "translation": "一周三百。",
    "chunks": ["300", "a week."],
    "hints": ["三百", "一周"],
    "grammar": [
      {role:'数词',color:'#c87033',phonetic:['/ˈθriː/','/ˈhʌndrəd/'],pos:'金额',meaning:'三百'},
      {role:'频率状语',color:'#7c5cbf',phonetic:['/ə/','/wiːk/'],pos:'per 的口语形式',meaning:'一周'}
    ],
    "explanations": [
      "报价时省略货币单位（300 dollars a week）。常见错误：\n• \"300 in a week\" → 表频率不加 in\n• \"300 every week\" → 也对，但 a week 更简洁",
      "`a week` 在这里 = per week，表费率。同义：300 weekly. / 300 per week."
    ],
    "distractors": [["300's","Three hundreds","3000"],["a weeks.","the week.","per weeks."]]
  },
  {
    "sentence": "Sounds real nice.",
    "translation": "听起来不错。",
    "chunks": ["Sounds", "real nice."],
    "hints": ["听起来", "真的很不错"],
    "grammar": [
      {role:'系动词',color:'#c87033',phonetic:['/saʊndz/'],pos:'sound 第三人称单数',meaning:'听起来'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈriːəl/','/naɪs/'],pos:'副词 + 形容词',meaning:'真的很不错'}
    ],
    "explanations": [
      "`sound + 形容词` 表「听起来」。常见错误：\n• \"Sound real nice\" → 主语省略了 It，但要保留 -s 的第三人称单数\n• \"Sounds like nice\" → sound like 后面接名词",
      "口语里 `real` 常代替 really 作副词。常见错误：\n• 正式写作要用 really nice"
    ],
    "distractors": [["Sound","Sounding","Sounds like"],["really nice.","real nicer.","real nicely."]]
  },
  {
    "sentence": "Kids okay?",
    "translation": "孩子们还好吗？",
    "chunks": ["Kids", "okay?"],
    "hints": ["孩子们", "还好吗"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/kɪdz/'],pos:'名词复数',meaning:'孩子们'},
      {role:'表语',color:'#3358e0',phonetic:['/ˌoʊˈkeɪ/'],pos:'形容词',meaning:'还好'}
    ],
    "explanations": [
      "`Kids` 前省略了冠词 the（口语中很常见）。常见错误：\n• \"The kids\" → 更完整，问熟人家里的事时省略也自然\n• \"Kids is\" → 复数主语用 are（这里省略了）",
      "完整句是 Are the kids okay? 同义：How are the kids doing?"
    ],
    "distractors": [["Kid","The kids","Kids is"],["OK?","okay at?","alright?"]]
  },
  {
    "sentence": "Yeah, they're fine.",
    "translation": "嗯，他们都好。",
    "chunks": ["Yeah,", "they're fine."],
    "hints": ["嗯", "他们都好"],
    "grammar": [
      {role:'应答词',color:'#7c5cbf',phonetic:['/jeə/'],pos:'口语肯定词',meaning:'嗯'},
      {role:'主系表',color:'#c87033',phonetic:['/ðer/','/faɪn/'],pos:'they are 缩写 + 形容词',meaning:'他们都好'}
    ],
    "explanations": [
      "`they're` = they are，注意和 their（他们的）、there（那里）区分。常见错误：\n• \"their fine\" → 同音但含义不同\n• \"they fine\" → 少了 be 动词",
      "`fine` 表「身体好、没问题」。同义：They're doing well."
    ],
    "distractors": [["Yes,","Yep,","Yup,"],["they fine.","their fine.","they're find."]]
  },
  {
    "sentence": "Thanks for asking.",
    "translation": "谢谢关心。",
    "chunks": ["Thanks", "for asking."],
    "hints": ["谢谢", "来问（关心）"],
    "grammar": [
      {role:'致谢结构',color:'#e74c7a',phonetic:['/θæŋks/'],pos:'名词（复数形式固定）',meaning:'谢谢'},
      {role:'介词+动名词',color:'#7c5cbf',phonetic:['/fɔːr/','/ˈæskɪŋ/'],pos:'for + doing',meaning:'来问我'}
    ],
    "explanations": [
      "`Thanks` 比 Thank you 更随意，常用于熟人间。常见错误：\n• \"Thank you for asking\" → 更正式，也对\n• \"Thanks for ask\" → 介词 for 后要用动名词",
      "`for + 动名词` 表感谢的原因。这个结构固定，不能换成不定式。"
    ],
    "distractors": [["Thank","Thanks to","Thanks for"],["to ask.","for ask.","for asked."]]
  },  {
    "sentence": "I brought you apples.",
    "translation": "我给你带了苹果。",
    "chunks": ["I brought", "you apples."],
    "hints": ["我带了", "给你苹果"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/brɔːt/'],pos:'bring 的过去式',meaning:'我带了'},
      {role:'双宾语',color:'#3358e0',phonetic:['/juː/','/ˈæplz/'],pos:'间接宾语+直接宾语',meaning:'给你苹果'}
    ],
    "explanations": [
      "`bring` 的过去式是 brought（不规则）。常见错误：\n• \"I bringed\" → 错，应作 brought\n• \"I bought\" → bought 是「买」，读音接近但意思不同",
      "`bring sb sth` 双宾语结构，等于 bring sth to sb（给你带了苹果）。常见错误：\n• \"bring you apple\" → 可数名词泛指要复数"
    ],
    "distractors": [["I bring","I bought","I bringed"],["you apple.","your apples.","you an apples."]]
  },
  {
    "sentence": "This is way too much.",
    "translation": "这太多了。",
    "chunks": ["This is", "way too much."],
    "hints": ["这是", "实在太多了"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ðɪs/','/ɪz/'],pos:'this + is',meaning:'这是'},
      {role:'程度状语',color:'#7c5cbf',phonetic:['/weɪ/','/tuː/','/mʌtʃ/'],pos:'way + too much',meaning:'实在太多了'}
    ],
    "explanations": [
      "`way` 在口语里作程度副词，等于 much / far，表「远远地」。常见错误：\n• \"very too much\" → 不能用 very 修饰 too\n• \"way to much\" → 是 too 不是 to",
      "`too much` 修饰不可数；可数名词复数用 too many。常见错误：\n• \"too many\" 接 apples 才对"
    ],
    "distractors": [["This are","These is","This be"],["way to much.","way too many.","very too much."]]
  },
  {
    "sentence": "It's partly rotten.",
    "translation": "有点坏了。",
    "chunks": ["It's", "partly rotten."],
    "hints": ["它是", "部分烂了"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/ɪts/'],pos:'it + is 缩写',meaning:'它是'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈpɑːrtli/','/ˈrɑːtn/'],pos:'副词 + 形容词',meaning:'部分腐烂的'}
    ],
    "explanations": [
      "`partly` 表「部分地」，修饰形容词。常见错误：\n• \"part rotten\" → 少了 -ly 就变成名词修饰\n• \"partly rottened\" → rotten 已是形容词",
      "`rotten` 是 rot 的过去分词作形容词，表「腐烂的」。常见错误：\n• \"rot\" → 那是动词原形\n• 水果「有点坏」也可说 It's going bad."
    ],
    "distractors": [["It","It's part","It has"],["part rotten.","partly rottened.","partly rot."]]
  }
];
