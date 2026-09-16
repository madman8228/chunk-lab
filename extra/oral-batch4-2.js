/* 口语 8000 句 · 第四批数据源（批次 2/5）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch4-2.js */
var ORAL_BATCH = [
  {
    "sentence": "I want you home by 10.",
    "translation": "我要你十点前回家。",
    "chunks": ["I want you", "home by 10."],
    "hints": ["我要你", "十点前到家"],
    "grammar": [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/wɑːnt/','/juː/'],pos:'want + 宾语',meaning:'我要你'},
      {role:'补语',color:'#7c5cbf',phonetic:['/hoʊm/','/baɪ/','/ten/'],pos:'home + 介词短语',meaning:'十点前到家'}
    ],
    "explanations": [
      "`want sb + 补语` 表「要求某人处于某状态」，这里 home 作副词。常见错误：\n• \"I want you to home\" → home 是副词，不加 to\n• \"I want that you home\" → 英语不用 that 从句，直接接宾语+补语",
      "`by 10` = 十点之前（含十点），强调截止时间。常见错误：\n• \"until 10\" → until 表持续到十点，不是「在十点前完成」\n• \"in 10\" → 那是「十分钟后」"
    ],
    "distractors": [["I want you to","I wants you","I want your"],["home at 10.","home in 10.","home till 10."]]
  },
  {
    "sentence": "Yes, ma'am.",
    "translation": "好的，女士。",
    "chunks": ["Yes,", "ma'am."],
    "hints": ["好的", "女士"],
    "grammar": [
      {role:'应答词',color:'#7c5cbf',phonetic:['/jes/'],pos:'肯定应答',meaning:'好的'},
      {role:'称呼',color:'#3358e0',phonetic:['/mæm/'],pos:'名词（尊称）',meaning:'女士'}
    ],
    "explanations": [
      "`Yes` 是标准肯定应答，应答长辈或上级时更常用。常见错误：\n• 随意场合的 Yeah 不适合对长辈说\n• 逗号不能省：Yes ma'am 读起来会很赶",
      "`ma'am` 是对女性的尊称（= madam 的缩写），常含撇号。常见错误：\n• \"mam\" → 少了撇号，标准写法是 ma'am\n• 对男性用 sir，不是 mister"
    ],
    "distractors": [["Yeah,","Yep,","Yes sir,"],["mam.","madam.","mister."]]
  },
  {
    "sentence": "Let's go eat.",
    "translation": "我们去吃吧。",
    "chunks": ["Let's", "go eat."],
    "hints": ["我们（一起）", "去吃"],
    "grammar": [
      {role:'祈使提议',color:'#c87033',phonetic:['/lets/'],pos:'Let us 的缩写',meaning:'我们（一起）'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/','/iːt/'],pos:'go + 动词原形',meaning:'去吃'}
    ],
    "explanations": [
      "`Let's` = Let us，表提议，后接动词原形。常见错误：\n• \"Let's to go\" → 不能加 to\n• \"Lets go\" → 少了撇号就变成「让（某人）」的第三人称单数",
      "口语里 `go + 动词原形` 表示「去做某事」，中间省略 and。常见错误：\n• \"go to eat\" → 也可以，但 go eat 更口语\n• \"go eating\" → 错了，-ing 不用于这个结构"
    ],
    "distractors": [["Let us","Let","Let's to"],["go to eat.","going eat.","go eating."]]
  },
  {
    "sentence": "Kay, burgers?",
    "translation": "好，汉堡吗？",
    "chunks": ["Kay,", "burgers?"],
    "hints": ["好（口语）", "汉堡"],
    "grammar": [
      {role:'应答词',color:'#7c5cbf',phonetic:['/keɪ/'],pos:'OK 的口语变体',meaning:'好、行'},
      {role:'名词',color:'#3358e0',phonetic:['/ˈbɜːrɡərz/'],pos:'名词复数',meaning:'汉堡'}
    ],
    "explanations": [
      "`Kay` 是 OK 的口语简读，常出现在轻松的对话里。常见错误：\n• 正式场合要用 OK / All right\n• 升调读 Kay? 是「行吗？」",
      "`burgers?` 是省略句（Do you want burgers? / How about burgers?）。常见错误：\n• 泛指一类食物要用复数 burgers"
    ],
    "distractors": [["OK,","Hey,","K,"],["burger?","a burgers?","a burger."]]
  },
  {
    "sentence": "How about the movies?",
    "translation": "看电影怎么样？",
    "chunks": ["How about", "the movies?"],
    "hints": ["怎么样", "电影（院）"],
    "alts": [["What about"], null],
    "grammar": [
      {role:'建议句型',color:'#c87033',phonetic:['/haʊ/','/əˈbaʊt/'],pos:'How about 固定句型',meaning:'……怎么样'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/ðə/','/ˈmuːviz/'],pos:'名词短语',meaning:'电影'}
    ],
    "explanations": [
      "`How about + 名词/动名词` 是提建议的固定句型，about 是介词。常见错误：\n• \"How about go to the movies?\" → 后面接名词或 doing，不能接原形\n• \"How about the movie?\" → 去电影院说 the movies",
      "`the movies` 固定用复数，指「电影院、看电影这件事」。常见错误：\n• \"the movie\" → 指某一部影片，不指「去看电影」"
    ],
    "distractors": [["How abouts","How for","How with"],["the movie?","movies?","the cinema?"]]
  },
  {
    "sentence": "It's okay with Mom.",
    "translation": "妈妈同意了。",
    "chunks": ["It's okay", "with Mom."],
    "hints": ["（这件事）可以", "对妈妈来说"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ˌoʊˈkeɪ/'],pos:'it + is + 形容词',meaning:'可以'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/wɪð/','/mɑːm/'],pos:'介词短语',meaning:'对妈妈而言'}
    ],
    "explanations": [
      "`It's okay with sb` 表「某人没意见、某人同意」。常见错误：\n• \"It's okay for Mom\" → for 表「对……有好处」，表「同意」要用 with\n• 家庭称呼 Mom 首字母大写，作专有名词",
      "同义：Mom's fine with it. / Mom said it's fine."
    ],
    "distractors": [["It's ok to","It's okay for","It's okay to"],["for Mom.","with my Mom.","with mom's."]]
  },
  {
    "sentence": "It's dark in here.",
    "translation": "这里很黑。",
    "chunks": ["It's dark", "in here."],
    "hints": ["很黑", "在这里面"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/dɑːrk/'],pos:'it + is + 形容词',meaning:'很黑'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ɪn/','/hɪr/'],pos:'介词短语',meaning:'在这里面'}
    ],
    "explanations": [
      "`It's dark` 用 it 指环境（天气/光线/时间）。常见错误：\n• \"Here is dark\" → 英语习惯用 it 作形式主语\n• \"It's darkness\" → 形容词 dark 才对，darkness 是名词",
      "`in here` 强调「在里面」，与泛指的 here 有区别。常见错误：\n• \"in there\" → 那是「在那里面」，空间不同"
    ],
    "distractors": [["It's darker","It's darkly","It's dark in"],["in there.","here.","in the here."]]
  },
  {
    "sentence": "Watch your step.",
    "translation": "小心脚下。",
    "chunks": ["Watch", "your step."],
    "hints": ["注意", "你的脚下"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/wɑːtʃ/'],pos:'祈使句动词',meaning:'注意、当心'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/step/'],pos:'名词短语',meaning:'你的脚下'}
    ],
    "explanations": [
      "`watch` 在此表「留意、当心」，比 look 更有警觉意味。常见错误：\n• \"Look your step\" → 固定说法是 watch your step\n• \"Watching your step\" → 祈使句用原形",
      "`Watch your step` 既是「当心脚下」，也可引申为「小心行事」。同义：Mind the step."
    ],
    "distractors": [["Watch out","Watching","Watches"],["you step.","your steps.","your stepping."]]
  },
  {
    "sentence": "Want me to help?",
    "translation": "要我帮忙吗？",
    "chunks": ["Want me", "to help?"],
    "hints": ["想要我", "帮忙"],
    "grammar": [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/wɑːnt/','/miː/'],pos:'省略 Do you 的问句',meaning:'想要我'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/help/'],pos:'不定式短语',meaning:'帮忙'}
    ],
    "explanations": [
      "口语省略句首的 Do you，直接说 Want me...? 常见错误：\n• \"Want I to help?\" → 宾语用宾格 me\n• \"Wants me to help?\" → 省略了主语，动词不加 s",
      "`want sb to do sth` 是固定结构，不能省 to。常见错误：\n• \"Want me help?\" → 少了 to 就变错了"
    ],
    "distractors": [["Want I","Wants me","Want my"],["help?","for help?","helping?"]]
  },
  {
    "sentence": "I'm all right.",
    "translation": "不用了。",
    "chunks": ["I'm", "all right."],
    "hints": ["我", "还好、不用"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/aɪm/'],pos:'I + am 缩写',meaning:'我'},
      {role:'表语',color:'#3358e0',phonetic:['/ɔːl/','/raɪt/'],pos:'形容词短语',meaning:'还好'}
    ],
    "explanations": [
      "`I'm all right` 有两层意思：身体「我没事」，回答提议时是「不用了」。常见错误：\n• \"I'm alright\" → 也可接受，但规范写法是 all right\n• \"I'm right\" → 意思变成「我是对的」",
      "同义（拒绝提议）：I'm good. / No thanks."
    ],
    "distractors": [["I am","I'm not","I'm in"],["alright.","all write.","all rights."]]
  },
  {
    "sentence": "You tired?",
    "translation": "你累了？",
    "chunks": ["You", "tired?"],
    "hints": ["你", "累了吗"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/juː/'],pos:'人称代词',meaning:'你'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈtaɪərd/'],pos:'形容词',meaning:'累了'}
    ],
    "explanations": [
      "口语省略句首的 Are，只剩 You tired? 靠升调表疑问。常见错误：\n• \"You are tired?\" → 也对，但多是确认语气\n• \"You tiring?\" → tiring 是「令人累的」，形容人要用 tired",
      "`tired` 是过去分词作形容词，表「感到累」。常见错误：\n• \"tired of\" → 那是「对……厌倦」，不是身体累"
    ],
    "distractors": [["Your","You're","Yours"],["tiring?","tire?","tired of?"]]
  },
  {
    "sentence": "A little.",
    "translation": "有一点。",
    "chunks": ["A", "little."],
    "hints": ["一", "点儿"],
    "grammar": [
      {role:'冠词',color:'#c87033',phonetic:['/ə/'],pos:'不定冠词',meaning:'一（个）'},
      {role:'名词',color:'#3358e0',phonetic:['/ˈlɪtl/'],pos:'不可数名词用法',meaning:'一点儿'}
    ],
    "explanations": [
      "`a little` 是整体短语，表「一点点」，回答 Are you tired? 时常省略主句。常见错误：\n• \"a few\" → few 接可数名词，回答程度要用 a little\n• \"little\" 单用 → 表「几乎没有」，否定意味，跟 a little 相反",
      "同义：A bit. / Kind of. / Somewhat."
    ],
    "distractors": [["An","The","Some"],["few.","bit.","lot."]]
  },
  {
    "sentence": "I have a bump.",
    "translation": "我长了个包。",
    "chunks": ["I have", "a bump."],
    "hints": ["我长了", "一个包"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/hæv/'],pos:'一般现在时',meaning:'我有、我长了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/bʌmp/'],pos:'名词短语',meaning:'一个包'}
    ],
    "explanations": [
      "描述身体的包/肿起用 `have`。常见错误：\n• \"I have a bump on my head\" → 说位置更清楚，on 表表面\n• \"I am a bump\" → be 与 have 混淆",
      "`bump` 多指撞出来的肿包。同义：I got a bump. / There's a bump on my head."
    ],
    "distractors": [["I has","I had a","I have got"],["bumps.","the bump.","a bumb."]]
  },
  {
    "sentence": "It's a pimple.",
    "translation": "是个痘痘。",
    "chunks": ["It's a", "pimple."],
    "hints": ["它是一个", "痘痘"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ə/'],pos:'it + is + a',meaning:'它是一个'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈpɪmpl/'],pos:'名词',meaning:'痘痘'}
    ],
    "explanations": [
      "`It's a` 后面接可数名词单数。常见错误：\n• \"It's an pimple\" → p 是辅音音素，用 a\n• \"It's pimple\" → 可数名词单数前要加冠词",
      "`pimple` 指脸上的痘痘。口语也叫 zit。粉刺/痤疮是 acne。"
    ],
    "distractors": [["It's an","It a","It's a the"],["pimples.","a pimple.","pimpl."]]
  },
  {
    "sentence": "I might have a fever.",
    "translation": "我可能发烧了。",
    "chunks": ["I might", "have a fever."],
    "hints": ["我可能", "发烧"],
    "grammar": [
      {role:'情态+主语',color:'#c87033',phonetic:['/aɪ/','/maɪt/'],pos:'情态动词 might',meaning:'我可能'},
      {role:'谓语+宾语',color:'#e74c7a',phonetic:['/hæv/','/ə/','/ˈfiːvər/'],pos:'have + 名词短语',meaning:'发烧'}
    ],
    "explanations": [
      "`might` 表「有可能」，比 may 更不确定，后面接动词原形。常见错误：\n• \"I might to have\" → 情态动词后不加 to\n• \"I might has\" → 用原形 have",
      "`have a fever` 是固定搭配，fever 前要加 a。常见错误：\n• \"have fever\" → 少了冠词"
    ],
    "distractors": [["I may to","I might to","I mights"],["have fever.","has a fever.","have a fevers."]]
  },
  {
    "sentence": "Let's take your temperature.",
    "translation": "量一下你的体温吧。",
    "chunks": ["Let's take", "your temperature."],
    "hints": ["我们来量", "你的体温"],
    "grammar": [
      {role:'祈使提议',color:'#e74c7a',phonetic:['/lets/','/teɪk/'],pos:'let us + 动词',meaning:'我们来量'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/ˈtemprətʃər/'],pos:'名词短语',meaning:'你的体温'}
    ],
    "explanations": [
      "`take one's temperature` 是固定搭配，表「给某人量体温」。常见错误：\n• \"take you temperature\" → 要用所有格 your\n• \"measure your temperature\" → 也能懂，但地道的说法是 take",
      "`temperature` 注意拼写，中间是 -pera-。常见错误：\n• \"temperture\" → 漏了 a"
    ],
    "distractors": [["Let's taking","Let's take you","Let's takes"],["your temperture.","you temperature.","your temperatures."]]
  },
  {
    "sentence": "Your room's a mess.",
    "translation": "你房间很乱。",
    "chunks": ["Your room's", "a mess."],
    "hints": ["你的房间是", "一团乱"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/jʊr/','/ruːmz/'],pos:'your room + is 缩写',meaning:'你的房间是'},
      {role:'表语',color:'#3358e0',phonetic:['/ə/','/mes/'],pos:'名词短语',meaning:'一团乱'}
    ],
    "explanations": [
      "`Your room's` = Your room is，缩写带撇号。常见错误：\n• \"Your rooms\" → 少了撇号就成复数「你的房间们」\n• \"You room's\" → 所有格要用 your",
      "`a mess` 是固定说法，表「一团糟」。常见错误：\n• \"a mess room\" → 语序错了，要说 This room is a mess."
    ],
    "distractors": [["Your room is","You room's","Your rooms are"],["mess.","in a mess.","a messes."]]
  },
  {
    "sentence": "Mom, it's already clean.",
    "translation": "妈，已经很干净了。",
    "chunks": ["Mom,", "it's already clean."],
    "hints": ["妈", "已经很干净了"],
    "grammar": [
      {role:'称呼',color:'#7c5cbf',phonetic:['/mɑːm/'],pos:'呼语',meaning:'妈'},
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ɔːlˈredi/','/kliːn/'],pos:'it + is + 副词 + 形容词',meaning:'已经很干净'}
    ],
    "explanations": [
      "呼语放句首，后面用逗号隔开。常见错误：\n• \"Mom it's already clean\" → 少逗号，读起来像从句\n• 呼语后不要再加 you，英语不像中文说「妈你」",
      "`already` 放 be 动词之后、实义动词之前。常见错误：\n• \"It's clean already\" → 口语可以，但书面更常放中间\n• \"already it's clean\" → 语序错"
    ],
    "distractors": [["Mommy,","Ma,","Mama,"],["it's ready clean.","it's already cleaned.","it's already clear."]]
  },
  {
    "sentence": "Stop nagging me.",
    "translation": "别唠叨我了。",
    "chunks": ["Stop", "nagging me."],
    "hints": ["停止", "唠叨我"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/stɑːp/'],pos:'祈使句动词',meaning:'停止'},
      {role:'动名词宾语',color:'#3358e0',phonetic:['/ˈnæɡɪŋ/','/miː/'],pos:'stop + doing',meaning:'唠叨我'}
    ],
    "explanations": [
      "`stop doing sth` 表「停止做某事」，固定接动名词。常见错误：\n• \"Stop to nag me\" → stop to do 是「停下来去做另一件事」，意思完全变了\n• \"Stop nag me\" → 少了 -ing",
      "`nag` 指不停唠叨、抱怨。同义：Quit bugging me. / Cut it out."
    ],
    "distractors": [["Stopping","Stops","Stopped"],["nag me.","to nag me.","nagging at me."]]
  },
  {
    "sentence": "I'll do it soon.",
    "translation": "我很快做。",
    "chunks": ["I'll do", "it soon."],
    "hints": ["我会做", "很快"],
    "grammar": [
      {role:'主语+助动词',color:'#e74c7a',phonetic:['/aɪl/','/duː/'],pos:'I will 缩写 + 动词',meaning:'我会做'},
      {role:'宾语+时间状语',color:'#7c5cbf',phonetic:['/ɪt/','/suːn/'],pos:'代词 + 副词',meaning:'很快（做）它'}
    ],
    "explanations": [
      "`I'll` = I will，表将来的承诺，后接动词原形。常见错误：\n• \"I'll doing\" → will 后接原形\n• \"I'll did\" → 不能接过去式",
      "`soon` 表「不久之后」，多与将来时连用。常见错误：\n• \"soonly\" → 不存在这个副词\n• \"quick\" → 那是形容词，时间上要用 soon"
    ],
    "distractors": [["I'll doing","I do","I'll did"],["it soonly.","it quick.","its soon."]]
  },
  {
    "sentence": "I like those pants.",
    "translation": "我喜欢那条裤子。",
    "chunks": ["I like", "those pants."],
    "hints": ["我喜欢", "那条裤子"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/laɪk/'],pos:'一般现在时',meaning:'我喜欢'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðoʊz/','/pænts/'],pos:'指示代词+名词',meaning:'那条裤子'}
    ],
    "explanations": [
      "`like` 表喜好时是静态动词，一般不用进行时。常见错误：\n• \"I'm liking those pants\" → 一般现在时就好\n• \"I likes\" → I 后面不加 s",
      "`pants` 在英语里固定用复数，一条裤子也是 pants。常见错误：\n• \"this pants\" → 要用 these / those\n• \"a pant\" → 单数形式基本不用"
    ],
    "distractors": [["I likes","I like to","I'm like"],["those pant.","that pants.","those pans."]]
  },
  {
    "sentence": "Try them on.",
    "translation": "穿上试试。",
    "chunks": ["Try", "them on."],
    "hints": ["试", "把它们（穿上）"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/traɪ/'],pos:'祈使句动词',meaning:'试'},
      {role:'宾语+副词',color:'#3358e0',phonetic:['/ðem/','/ɑːn/'],pos:'代词 + 副词小品词',meaning:'把它们穿上'}
    ],
    "explanations": [
      "`try sth on` = 试穿。代词作宾语时必须放中间。常见错误：\n• \"Try on them\" → 代词只能用 try them on\n• \"Try them\" → 少了 on，意思变「试一下」不一定是试穿",
      "名词可以放两边：try on the shoes / try the shoes on；代词只能放中间。"
    ],
    "distractors": [["Trying","Tries","Try to"],["on them.","them in.","they on."]]
  }
];
