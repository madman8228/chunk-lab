/* 口语 8000 句 · 第四批数据源（批次 5/5）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch4-5.js */
var ORAL_BATCH = [
  {
    "sentence": "I've got this.",
    "translation": "我可以的。",
    "chunks": ["I've got", "this."],
    "hints": ["我能搞定", "这件事"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪv/','/ɡɑːt/'],pos:'have got 缩写',meaning:'我能搞定'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðɪs/'],pos:'指示代词',meaning:'这件事'}
    ],
    "explanations": [
      "`I've got this` 是口语鼓励自己的固定说法，表「我能应付」。常见错误：\n• \"I got this\" → 也可以，语气更随意\n• \"I've got this to\" → 加 to 意思就变「我不得不处理这个」",
      "同义：I got it. / I can handle it. / I'm on it."
    ],
    "distractors": [["I got","I've get","I've got to"],["that.","these.","this's."]]
  },
  {
    "sentence": "You really changed.",
    "translation": "你真的变了。",
    "chunks": ["You really", "changed."],
    "hints": ["你真的", "变了"],
    "grammar": [
      {role:'主语+状语',color:'#c87033',phonetic:['/juː/','/ˈriːəli/'],pos:'副词修饰谓语',meaning:'你真的'},
      {role:'谓语',color:'#e74c7a',phonetic:['/tʃeɪndʒd/'],pos:'一般过去时',meaning:'变了'}
    ],
    "explanations": [
      "`really` 修饰谓语时放在实义动词之前。常见错误：\n• \"You changed really\" → 语序错，副词不能放句末表程度\n• \"You real changed\" → 要用 really，real 是形容词",
      "`changed` 用过去式表「已经发生了变化」。常见错误：\n• \"You are changed\" → 也可表被动，但口语直接说 changed 更自然"
    ],
    "distractors": [["You real","You really's","You really are"],["change.","changing.","changeed."]]
  },
  {
    "sentence": "I'm so proud of you.",
    "translation": "我为你骄傲。",
    "chunks": ["I'm so", "proud of you."],
    "hints": ["我非常", "为你骄傲"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/aɪm/','/soʊ/'],pos:'be + so',meaning:'我非常'},
      {role:'表语',color:'#3358e0',phonetic:['/praʊd/','/əv/','/juː/'],pos:'be proud of 固定搭配',meaning:'为你骄傲'}
    ],
    "explanations": [
      "`so` 修饰形容词，表程度。常见错误：\n• \"I so proud\" → 缺 be 动词\n• \"I'm such proud\" → such 后接名词短语",
      "`be proud of sb` 是固定搭配，介词用 of。常见错误：\n• \"proud for you\" → 不用 for\n• \"proud at you\" → 不用 at"
    ],
    "distractors": [["I so","I'm very","I'm such"],["proud for you.","proud at you.","proud of your."]]
  },
  {
    "sentence": "Don't beat yourself up.",
    "translation": "别太苛责自己。",
    "chunks": ["Don't", "beat yourself up."],
    "hints": ["不要", "责备你自己"],
    "grammar": [
      {role:'祈使句(否定)',color:'#e74c7a',phonetic:['/doʊnt/'],pos:'do not 缩写',meaning:'不要'},
      {role:'固定表达',color:'#7c5cbf',phonetic:['/biːt/','/jərˈself/','/ʌp/'],pos:'beat oneself up 习语',meaning:'苛责自己'}
    ],
    "explanations": [
      "否定祈使句用 Don't + 动词原形。常见错误：\n• \"Doesn't beat\" → 祈使句用 don't\n• \"Not beat\" → 缺助动词",
      "`beat yourself up` 是习语，表「过度自责」，与「打自己」无关。常见错误：\n• \"beat up yourself\" → 反身代词要放中间\n• \"beat yourself\" → 少了 up，习语不成立"
    ],
    "distractors": [["Doesn't","Don't to","Not"],["beat up yourself.","beat yourself on.","beat yours up."]]
  },
  {
    "sentence": "You matter to me.",
    "translation": "你对我很重要。",
    "chunks": ["You matter", "to me."],
    "hints": ["你很重要", "对我来说"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/juː/','/ˈmætər/'],pos:'matter 作动词',meaning:'你很重要'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/tə/','/miː/'],pos:'介词短语',meaning:'对我来说'}
    ],
    "explanations": [
      "`matter` 作动词表「要紧、重要」。常见错误：\n• \"You matters\" → 主语 you 用原形\n• \"You are matter\" → be 与动词混用",
      "`matter to sb` 表「对某人重要」。常见错误：\n• \"matter for me\" → 固定介词是 to"
    ],
    "distractors": [["You matters","You mattering","Your matter"],["to my.","for me.","to mine."]]
  },
  {
    "sentence": "Just keep going.",
    "translation": "继续坚持。",
    "chunks": ["Just", "keep going."],
    "hints": ["只管", "继续走下去"],
    "grammar": [
      {role:'程度/语气词',color:'#7c5cbf',phonetic:['/dʒʌst/'],pos:'副词（弱化语气）',meaning:'只管、就'},
      {role:'祈使句',color:'#e74c7a',phonetic:['/kiːp/','/ˈɡoʊɪŋ/'],pos:'keep doing 固定结构',meaning:'继续走'}
    ],
    "explanations": [
      "`just` 在此弱化语气，表「就这样、只管」，不是「刚刚」。常见错误：\n• \"Only keep going\" → Only 表「只有」，语气不对",
      "`keep doing sth` 表「持续做某事」，固定接动名词。常见错误：\n• \"keep to go\" → 不能接不定式\n• \"keep go\" → 少了 -ing"
    ],
    "distractors": [["Only","Justly","Just to"],["keep to go.","keep go.","keep going to."]]
  },
  {
    "sentence": "I've been there.",
    "translation": "我是过来人。",
    "chunks": ["I've been", "there."],
    "hints": ["我去过（经历过）", "那里"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪv/','/bɪn/'],pos:'现在完成时',meaning:'我去过'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ðer/'],pos:'副词',meaning:'那里'}
    ],
    "explanations": [
      "`I've been there` 字面是「我去过那里」，引申为「我也经历过、我懂你」。常见错误：\n• \"I been there\" → 少了 've\n• \"I've gone there\" → gone 强调去了没回，表「经历过」用 been",
      "这是安慰别人时的高频共情表达。同义：I know the feeling. / Been there."
    ],
    "distractors": [["I been","I've being","I've be"],["here.","their.","there's."]]
  },
  {
    "sentence": "You're nice to me.",
    "translation": "你对我真好。",
    "chunks": ["You're nice", "to me."],
    "hints": ["你很好", "对我"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/jʊr/','/naɪs/'],pos:'you are + 形容词',meaning:'你很好'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/tə/','/miː/'],pos:'介词短语',meaning:'对我'}
    ],
    "explanations": [
      "`You're` = you are，别和 your（你的）搞混。常见错误：\n• \"Your nice to me\" → Your 不能构成主系表\n• \"You're nicely to me\" → 表语要用形容词 nice",
      "`be nice to sb` 是固定搭配，介词用 to。常见错误：\n• \"nice for me\" → 对人态度用 to"
    ],
    "distractors": [["Your nice","You nice","You're nicely"],["to my.","for me.","to mine."]]
  },
  {
    "sentence": "You got it.",
    "translation": "应该的。",
    "chunks": ["You got", "it."],
    "hints": ["你拿到了", "它"],
    "grammar": [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/juː/','/ɡɑːt/'],pos:'口语省略 did',meaning:'你（做）到了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɪt/'],pos:'代词',meaning:'它'}
    ],
    "explanations": [
      "`You got it` 回应感谢时表「应该的、小意思」。常见错误：\n• 用降调读 → 才表「没问题/包在我身上」，两种含义靠语境区分\n• \"You get it\" → 那是「你明白了」",
      "同义：No problem. / Anytime. / My pleasure."
    ],
    "distractors": [["You get","You got to","You've got"],["that.","them.","it's."]]
  },
  {
    "sentence": "I'm here for you.",
    "translation": "我陪你。",
    "chunks": ["I'm here", "for you."],
    "hints": ["我在这儿", "为你"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/hɪr/'],pos:'be + here',meaning:'我在这儿'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/fɔːr/','/juː/'],pos:'介词短语',meaning:'为你'}
    ],
    "explanations": [
      "`be here for sb` 表「陪着你、支持你」。常见错误：\n• \"I'm here to you\" → 固定搭配用 for\n• \"I hear for you\" → hear 是「听见」，同音但意思完全不同",
      "同义：I've got your back. / I'm with you."
    ],
    "distractors": [["I here","I'm hear","I'm here to"],["for your.","to you.","for yours."]]
  },
  {
    "sentence": "I'm willing to help.",
    "translation": "我愿意帮忙。",
    "chunks": ["I'm willing", "to help."],
    "hints": ["我愿意", "帮忙"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/ˈwɪlɪŋ/'],pos:'be willing 固定用法',meaning:'我愿意'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/help/'],pos:'不定式',meaning:'帮忙'}
    ],
    "explanations": [
      "`be willing to do` 表「愿意做某事」，willing 是形容词。常见错误：\n• \"I'm will to help\" → will 是情态动词，形容词形式是 willing\n• \"I willing to help\" → 缺 am",
      "同义：I'd be happy to help. / I'm glad to help."
    ],
    "distractors": [["I willing","I'm will","I'm willing for"],["to helping.","to helped.","to helps."]]
  },
  {
    "sentence": "I'm not feeling well.",
    "translation": "我不舒服。",
    "chunks": ["I'm not", "feeling well."],
    "hints": ["我不", "感觉好"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/aɪm/','/nɑːt/'],pos:'be + not',meaning:'我不'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈfiːlɪŋ/','/wel/'],pos:'feel well 进行时',meaning:'感觉好'}
    ],
    "explanations": [
      "否定词 not 放在 be 之后。常见错误：\n• \"I not feeling well\" → 缺 am\n• \"I don't feeling well\" → 有 be 动词时不再用 don't",
      "`feel well` 中 well 是副词，表身体健康。常见错误：\n• \"feel good\" → 表情绪好、感觉不错，说身体不舒服要用 well\n这是英语里最容易混的一组：身体用 well，心情用 good"
    ],
    "distractors": [["I not","I'm no","I don't"],["feeling good.","feel well.","feeling goodly."]]
  },
  {
    "sentence": "Can I go home early?",
    "translation": "我能早点回家吗？",
    "chunks": ["Can I", "go home early?"],
    "hints": ["我能", "早点回家吗"],
    "grammar": [
      {role:'情态+主语',color:'#c87033',phonetic:['/kæn/','/aɪ/'],pos:'can 引导疑问',meaning:'我能'},
      {role:'谓语+状语',color:'#e74c7a',phonetic:['/ɡoʊ/','/hoʊm/','/ˈɜːrli/'],pos:'go home + 副词',meaning:'早点回家'}
    ],
    "explanations": [
      "`Can I ...?` 是请求许可的常用句型。常见错误：\n• \"Do I can go\" → 情态动词直接提前，不用 do\n• \"Can me go\" → 主语用主格 I",
      "`go home` 固定不加 to（home 作副词）。常见错误：\n• \"go to home\" → 错，go home 才是对的\n• \"early\" 是副词，修饰 go"
    ],
    "distractors": [["Can me","Do I can","Can I to"],["go to home early?","go home earlily?","go home earlies?"]]
  },
  {
    "sentence": "Did you eat something bad?",
    "translation": "你是不是吃坏东西了？",
    "chunks": ["Did you", "eat something", "bad?"],
    "hints": ["你是否", "吃了什么", "不好的"],
    "grammar": [
      {role:'助动词+主语',color:'#c87033',phonetic:['/dɪd/','/juː/'],pos:'一般过去时疑问',meaning:'你是否'},
      {role:'谓语+宾语',color:'#e74c7a',phonetic:['/iːt/','/ˈsʌmθɪŋ/'],pos:'动词原形 + 不定代词',meaning:'吃了什么'},
      {role:'定语',color:'#3358e0',phonetic:['/bæd/'],pos:'形容词后置',meaning:'不好的'}
    ],
    "explanations": [
      "有 did 时动词用原形。常见错误：\n• \"Did you ate\" → 用 eat\n• \"Did your eat\" → 主语用 you",
      "`something bad` 是形容词后置修饰不定代词。常见错误：\n• \"bad something\" → 修饰 something 时形容词必须放后面",
      "`bad` 修饰 something 作定语。同义：Did you eat anything bad? / Was it something you ate?"
    ],
    "distractors": [["Do you","Did your","Does you"],["eat somethings","eating something","eats something"],["badly?","badder?","a bad?"]]
  },
  {
    "sentence": "Hope you're feeling better.",
    "translation": "希望你好点了。",
    "chunks": ["Hope", "you're feeling", "better."],
    "hints": ["希望", "你感觉", "好些了"],
    "grammar": [
      {role:'谓语（省略主语）',color:'#e74c7a',phonetic:['/hoʊp/'],pos:'省略 I 的口语',meaning:'希望'},
      {role:'主谓',color:'#c87033',phonetic:['/jʊr/','/ˈfiːlɪŋ/'],pos:'you are + 现在分词',meaning:'你感觉'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈbetər/'],pos:'形容词比较级',meaning:'好些'}
    ],
    "explanations": [
      "口语省略主语 I，直接以 Hope 开头。常见错误：\n• \"Hoping you're feeling better\" → 句子不能以动名词开头当谓语\n• \"I hope you feeling better\" → 从句里缺 are",
      "`better` 是 well 的比较级，表「好一些」。常见错误：\n• \"more better\" → 比较级不叠用",
      "同义：Hope you feel better soon."
    ],
    "distractors": [["Hoping","Hopes","I hope"],["your feeling","you feeling","you're feel"],["good.","best.","weller."]]
  },
  {
    "sentence": "I couldn't sleep.",
    "translation": "我没睡着。",
    "chunks": ["I couldn't", "sleep."],
    "hints": ["我没能", "睡着"],
    "grammar": [
      {role:'主语+情态',color:'#c87033',phonetic:['/aɪ/','/ˈkʊdnt/'],pos:'could not 缩写',meaning:'我没能'},
      {role:'谓语',color:'#e74c7a',phonetic:['/sliːp/'],pos:'动词原形',meaning:'睡着'}
    ],
    "explanations": [
      "`couldn't` = could not，注意拼写是 couldn't，不是 could'nt。常见错误：\n• \"I could't sleep\" → 漏了 n\n• \"I couldn't to sleep\" → 情态动词后不加 to",
      "`sleep` 在此表「入睡」。常见错误：\n• \"I couldn't sleeping\" → 情态动词后接原形\n同义：I couldn't fall asleep."
    ],
    "distractors": [["I couldn't to","I can't","I didn't could"],["sleeping.","slept.","sleepy."]]
  },
  {
    "sentence": "I was up till one.",
    "translation": "我熬到一点。",
    "chunks": ["I was up", "till one."],
    "hints": ["我还没睡", "一直到一点"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/aɪ/','/wʌz/','/ʌp/'],pos:'be up 表醒着',meaning:'我还没睡'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/tɪl/','/wʌn/'],pos:'介词短语',meaning:'一直到一点'}
    ],
    "explanations": [
      "`be up` 表「还没睡、醒着」。常见错误：\n• \"I was up to one\" → 加 to 后意思变「我能做……」，这里 till 表一直到\n• \"I up till one\" → 缺 was",
      "`till` = until 的口语形式，接时间点。常见错误：\n• \"till to one\" → till 后面不加 to\n• one 表示「一点钟」，读 /wʌn/"
    ],
    "distractors": [["I up","I was up to","I were up"],["till on.","till ones.","till once."]]
  },
  {
    "sentence": "I went to bed early.",
    "translation": "我睡得早。",
    "chunks": ["I went", "to bed early."],
    "hints": ["我去了", "早睡"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/went/'],pos:'go 的过去式',meaning:'我去了'},
      {role:'状语',color:'#7c5cbf',phonetic:['/tə/','/bed/','/ˈɜːrli/'],pos:'go to bed + 副词',meaning:'上床睡觉（早）'}
    ],
    "explanations": [
      "`go` 的过去式是 went。常见错误：\n• \"I gone to bed\" → gone 要配 have\n• \"I was went\" → 两个过去形式不能叠用",
      "`go to bed` 是固定搭配，指「上床睡觉」，不加冠词。常见错误：\n• \"go to the bed\" → 那是「走到那张床旁边」\n• \"early\" 是副词，修饰整个动作"
    ],
    "distractors": [["I go","I gone","I was went"],["to the bed early.","to bed earlily.","to bed late."]]
  },
  {
    "sentence": "I got up late.",
    "translation": "我起晚了。",
    "chunks": ["I got up", "late."],
    "hints": ["我起来了", "晚"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/ɡɑːt/','/ʌp/'],pos:'get up 的过去式',meaning:'我起来了'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/leɪt/'],pos:'副词',meaning:'晚'}
    ],
    "explanations": [
      "`get up` 的过去式是 got up。常见错误：\n• \"I gotten up\" → gotten 要和 have 连用\n• \"I got\" → 少了 up，意思变「我得到」",
      "`late` 是副词，直接修饰 got up。常见错误：\n• \"lately\" → 那是「最近」，不是「晚」\n• \"later\" → 那是「稍后」"
    ],
    "distractors": [["I get up","I got","I gotten up"],["later.","lately.","latly."]]
  },
  {
    "sentence": "Get some more rest.",
    "translation": "多休息一下。",
    "chunks": ["Get some", "more rest."],
    "hints": ["获得一些", "更多的休息"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/ɡet/','/sʌm/'],pos:'祈使句 + 限定词',meaning:'获得一些'},
      {role:'宾语',color:'#3358e0',phonetic:['/mɔːr/','/rest/'],pos:'比较级 + 不可数名词',meaning:'更多的休息'}
    ],
    "explanations": [
      "`get some rest` 是固定说法，表「休息一下」。常见错误：\n• \"Get any rest\" → 劝人时用 some，any 多用于疑问/否定\n• \"Take some rest\" → 也可以，但 get some rest 更口语",
      "`rest` 在此不可数，用 more 修饰。常见错误：\n• \"more rests\" → 不可数不加 s\n• \"much rest\" → 这是「很多休息」，而这里要「再多一点」"
    ],
    "distractors": [["Get any","Got some","Get some more"],["more rests.","much rest.","more resting."]]
  },
  {
    "sentence": "Sleep is important.",
    "translation": "睡眠很重要。",
    "chunks": ["Sleep", "is important."],
    "hints": ["睡眠", "是重要的"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/sliːp/'],pos:'不可数名词作主语',meaning:'睡眠'},
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪz/','/ɪmˈpɔːrtnt/'],pos:'is + 形容词',meaning:'是重要的'}
    ],
    "explanations": [
      "`sleep` 作名词时不可数，单独作主语用单数谓语。常见错误：\n• \"The sleep\" → 泛指睡眠不加冠词\n• \"Sleeping is important\" → 动名词也可以，但名词 sleep 更简洁",
      "表语用形容词 important。常见错误：\n• \"is importance\" → importance 是名词\n• \"is importantly\" → 那是副词，表语位置用形容词"
    ],
    "distractors": [["Sleeping","Sleeps","The sleep"],["is importance.","are important.","is importantly."]]
  }
];
