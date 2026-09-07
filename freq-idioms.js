/* 高频短语 · English Idioms（运行态 201 句：103 种子 + batch3 26 + batch4 32 + batch5 39 + batch6 1）
 * 数据源：extra/idioms-394.json（394 条 idioms，项目内资产，分批扩写；勿再引用 D:/tmp）
 * 历史批次归档说明：extra/batch2a.json + batch2b.json（30 句试产稿）未整体注入——
 *   24 句已由 batch3/4/5 以原句收录；5 句 idiom 与库内例句重复（you said it / easy for you to say /
 *   my bad / good for you / you bet，例句变体）；仅 you don't say 为库内缺词条，已单抽 batch6 注入（201）。
 *   文件保留在 extra/ 供溯源，勿再整批注入（会撞 cid 校验）。
 * 形态：每个 idiom 嵌入一个完整例句（idiom 作为可填入的 chunk）—— 用户练习时实际填的是 idiom 短语本身。
 * Schema 与 oral8000.js 完全一致：
 *   { sentence, cid, translation, chunks[2-5], hints[], grammar[{role,color,phonetic,pos,meaning}], explanations[] }
 * 完整规范见 oral8000.js 头部注释；扩展高频短语时务必先跑：
 *   node validate_freq_idioms.js          # 校验本文件（npm test 已含）
 * 扩写流程：
 *   写 extra/batchN*.json（自带 cid 或不带，均自动重算）→ node scripts/inject-freq-idioms.js extra/batchN*.json
 *   → node validate_freq_idioms.js → node scripts/e2e-freq-idioms.js
 *
 * ★★★ 数据规范（每次扩写前必读）★★★
 *  1) 每句拆 2~5 个 chunk，idiom 短语必须作为【一个完整 chunk】（不可拆）
 *  2) 标点（. ? ! , ; :）必须挂在所属词组的尾部
 *  3) 句末标点(. ? !)只允许出现在【最后一个】chunk
 *  4) 每个 chunk 应是完整语义单元，避免散碎单字
 *  5) 去空格后 chunks.join('') 必须等于 sentence，防脱字/多字
 *  6) idiom 例句应贴近真实场景（口语笔记、对话、日常表达），避免硬编造
 */

/* fnv8：生成稳定的 8 位 hex cid（与 core.js Math.imul 实现一致，勿改回 h*prime 双精度写法——会丢精度） */
function fnv8(str) {
  let h = 0x811c9dc5 >>> 0;
  str = String(str == null ? '' : str);
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  let x = (h >>> 0).toString(16);
  while (x.length < 8) x = '0' + x;
  return x;
}

window.DATA_FREQ_IDIOMS = [
  {
    sentence: "The flood was an act of god.",
    cid: fnv8("The flood was an act of god."),
    translation: "那场洪水是天灾（不可抗力）。",
    chunks: ["The flood was","an act of god."],
    hints: ["那场洪水是","不可抗力"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/flʌd/","/wʌz/"], pos:"主系表", meaning:"那场洪水是"},
      {role:"惯用短语", color:"#7c5cbf", phonetic:["/æn/","/ækt/","/əv/","/ɡɒd/"], pos:"固定法律习语", meaning:"不可抗力"}
    ],
    explanations: [
      "**act of god** 法律/保险术语，指超出人类控制的自然灾害（地震、洪水、台风等）。常见于合同免责条款。",
      "近义表达：force majeure（法律法语词）/ natural disaster（自然灾害）。例句：The damage was caused by an act of god, not by our negligence."
    ]
  },
  {
    sentence: "He repeated the joke ad nauseam.",
    cid: fnv8("He repeated the joke ad nauseam."),
    translation: "他一遍又一遍地讲那个笑话，说得让人烦死了。",
    chunks: ["He repeated","the joke","ad nauseam."],
    hints: ["他重复","那个笑话","令人作呕地"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/hiː/","/rɪˈpiːtɪd/"], pos:"一般过去时", meaning:"他重复"},
      {role:"宾语", color:"#3358e0", phonetic:["/ðə/","/dʒoʊk/"], pos:"名词短语", meaning:"那个笑话"},
      {role:"状语", color:"#7c5cbf", phonetic:["/æd/","/ˈnɔːziæm/"], pos:"拉丁语习语", meaning:"让人作呕地"}
    ],
    explanations: [
      "**ad nauseam** 拉丁语（= to nausea「到令人作呕」），表示重复到让人厌烦。常用来吐槽某人反复说同一件事。",
      "口语近义：over and over / a million times。变体：ad infinitum（无穷无尽地）。例句：She explained the rules ad nauseam until everyone zoned out."
    ]
  },
  {
    sentence: "My boss is all bark no bite.",
    cid: fnv8("My boss is all bark no bite."),
    translation: "我老板只是嘴上厉害，从不动真格的。",
    chunks: ["My boss is","all bark no bite."],
    hints: ["我老板是","光叫不咬"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/maɪ/","/bɒs/","/ɪz/"], pos:"主系表", meaning:"我老板是"},
      {role:"谚语表语", color:"#7c5cbf", phonetic:["/ɔːl/","/bɑːrk/","/noʊ/","/baɪt/"], pos:"固定谚语", meaning:"光叫不咬（表面凶）"}
    ],
    explanations: [
      "**all bark no bite** 形容人/动物只是嘴硬、威胁多但不会真正行动。对应中文「光打雷不下雨」「嘴硬心软」。",
      "常用来评价严厉但从不动手的上司/老师。近义：all hat, no cattle（牛仔版）/ a paper tiger（纸老虎，毛泽东用法）。"
    ]
  },
  {
    sentence: "Something seems amiss here.",
    cid: fnv8("Something seems amiss here."),
    translation: "这里好像有点不对劲。",
    chunks: ["Something seems","amiss here."],
    hints: ["有什么似乎","不对劲"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ˈsʌmθɪŋ/","/siːmz/"], pos:"主系表", meaning:"有什么似乎"},
      {role:"表语短语", color:"#7c5cbf", phonetic:["/əˈmɪs/","/hɪr/"], pos:"形容词短语", meaning:"不太对"}
    ],
    explanations: [
      "**amiss** 形容词，意思是不对劲、出故障。常用于 something is/seems amiss 句型，\"What's amiss?\"（出了啥事？）。",
      "源自古英语，常见搭配：nothing amiss（一切正常）/ there's something amiss（哪里不对劲）。英式口语常用。"
    ]
  },
  {
    sentence: "I want peace and all that.",
    cid: fnv8("I want peace and all that."),
    translation: "我就想要平静，就这些。",
    chunks: ["I want","peace","and all that."],
    hints: ["我想要","平静","就这样"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/wɒnt/"], pos:"一般现在时", meaning:"我想要"},
      {role:"宾语", color:"#3358e0", phonetic:["/piːs/"], pos:"名词", meaning:"平静"},
      {role:"含糊补语", color:"#7c5cbf", phonetic:["/ænd/","/ɔːl/","/ðæt/"], pos:"口头禅补语", meaning:"以及所有那些（和类似的事）"}
    ],
    explanations: [
      "**and all that** 口语中的含糊补语，表示「以及类似的事情/和那些」，用来轻描淡写、不想细说。常配合耸肩。",
      "近义：and stuff (like that) / or something。例句：I'm just tired and all that — I need to crash. 注意：偏随意，邮件中慎用。"
    ]
  },
  {
    sentence: "She's a teacher at heart.",
    cid: fnv8("She's a teacher at heart."),
    translation: "她骨子里是个老师。",
    chunks: ["She's","a teacher","at heart."],
    hints: ["她是","一个老师","骨子里"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/ʃiːz/"], pos:"She is 缩写", meaning:"她是"},
      {role:"表语", color:"#3358e0", phonetic:["/ə/","/ˈtiːtʃər/"], pos:"名词短语", meaning:"一名老师"},
      {role:"方式状语", color:"#7c5cbf", phonetic:["/æt/","/hɑːrt/"], pos:"固定短语", meaning:"骨子里；本质上"}
    ],
    explanations: [
      "**at heart** 强调人的真实本性或核心身份，不管外在表现如何。常用来评价人或自我评价。",
      "近义：at the core / deep down / essentially。例句：He's a banker at heart, even now that he's retired."
    ]
  },
  {
    sentence: "Sorry I'm late — better late than never!",
    cid: fnv8("Sorry I'm late — better late than never!"),
    translation: "抱歉来晚了——迟到总比不到好！",
    chunks: ["Sorry I'm late —","better late than never!"],
    hints: ["抱歉我晚了——","迟到总比不到好"],
    grammar: [
      {role:"道歉致意", color:"#c87033", phonetic:["/ˈsɒri/","/aɪm/","/leɪt/"], pos:"口语道歉句", meaning:"抱歉我来晚了"},
      {role:"谚语", color:"#7c5cbf", phonetic:["/ˈbetər/","/leɪt/","/ðæn/","/ˈnevər/"], pos:"谚语", meaning:"迟做总比不做好"}
    ],
    explanations: [
      "**Better late than never.** 谚语「迟到总比不到好」，用来安慰晚到的成果/回应。中国谚语「亡羊补牢」也是类似安慰但侧重补救。",
      "口语中常用 self-deprecating 方式自嘲迟到的回复。结构：better + 比较级 + than + 反义基准。变体：better safe than sorry（谨慎总比后悔好）。"
    ]
  },
  {
    sentence: "Birds of a feather flock together.",
    cid: fnv8("Birds of a feather flock together."),
    translation: "物以类聚，人以群分。",
    chunks: ["Birds of a feather","flock together."],
    hints: ["同一种羽毛的鸟","群聚在一起"],
    grammar: [
      {role:"谚语主语", color:"#c87033", phonetic:["/bɜːrdz/","/əv/","/ə/","/ˈfeðər/"], pos:"名词短语", meaning:"同一种羽色的鸟"},
      {role:"谚语谓语", color:"#e74c7a", phonetic:["/flɒk/","/təˈɡeðər/"], pos:"动词短语", meaning:"群聚在一起"}
    ],
    explanations: [
      "**Birds of a feather (flock together)** 谚语「物以类聚，人以群分」。常用来评价一群朋友/同事/伴侣的相似性，可褒可贬。",
      "口语中常省略后半，说 \"Birds of a feather...\" 对方就能接上。变体：like attracts like（同类相吸）。注意：语气带 judgment，用时看清场合。"
    ]
  },
  {
    sentence: "Bring your A game tomorrow.",
    cid: fnv8("Bring your A game tomorrow."),
    translation: "明天拿出你最好的表现。",
    chunks: ["Bring","your A game","tomorrow."],
    hints: ["拿出","你的 A 级状态","明天"],
    grammar: [
      {role:"祈使动词", color:"#e74c7a", phonetic:["/brɪŋ/"], pos:"动词", meaning:"带来"},
      {role:"宾语", color:"#3358e0", phonetic:["/jʊr/","/eɪ/","/ɡeɪm/"], pos:"固定短语", meaning:"你的最佳水平"},
      {role:"时间状语", color:"#7c5cbf", phonetic:["/təˈmɒroʊ/"], pos:"副词", meaning:"明天"}
    ],
    explanations: [
      "**A game** 源自美国体育（A 级表现即最佳水平），现泛指任何领域的最佳状态。常用 bring/show A game。",
      "近义：bring your best / step up your game / be on your A game（处于 A 状态）。例句：You've got to bring your A game to this interview."
    ]
  },
  {
    sentence: "I passed by the skin of my teeth.",
    cid: fnv8("I passed by the skin of my teeth."),
    translation: "我险险地通过了考试。",
    chunks: ["I passed","by the skin of my teeth."],
    hints: ["我通过了","差一点点"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/pæst/"], pos:"一般过去时", meaning:"我通过了"},
      {role:"方式状语", color:"#7c5cbf", phonetic:["/baɪ/","/ðə/","/skɪn/","/əv/","/maɪ/","/tiːθ/"], pos:"圣经习语", meaning:"仅差一点；险些不"}
    ],
    explanations: [
      "**by the skin of one's teeth** 源自《圣经·约伯记》19:20，字面「只剩牙齿的皮」，意为险些失败、堪堪躲过。",
      "近义：narrowly / barely / by a hair's breadth（差一根头发）。注意 teeth 是复数，\"skin of my teeth\" 不能换成 tooth。例句：We caught the flight by the skin of our teeth."
    ]
  },
  {
    sentence: "You're joking — come off it!",
    cid: fnv8("You're joking — come off it!"),
    translation: "你在开玩笑——别扯了!",
    chunks: ["You're joking —","come off it!"],
    hints: ["哦，","收起吧；别装了","你在开玩笑"],
    grammar: [
      {role:"感叹词", color:"#c87033", phonetic:["/oʊ/"], pos:"感叹词", meaning:"哦"},
      {role:"祈使短语", color:"#e74c7a", phonetic:["/kʌm/","/ɒf/","/ɪt/"], pos:"短语动词", meaning:"停止/别装了"},
      {role:"回应", color:"#c87033", phonetic:["/jʊr/","/ˈdʒoʊkɪŋ/"], pos:"现在进行时", meaning:"你在开玩笑"}
    ],
    explanations: [
      "**come off it** 短语动词祈使句，意为「别装了/收起你的鬼话/别闹了」。朋友间常用，对夸张说法表达不信。",
      "近义：come on / give me a break / you've got to be kidding。例句：— I never lost a game. — Come off it!"
    ]
  },
  {
    sentence: "I think he's coming on to you.",
    cid: fnv8("I think he's coming on to you."),
    translation: "我觉得他在撩你。",
    chunks: ["I think","he's","coming on to you."],
    hints: ["我觉得","他在","对你有意思"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/θɪŋk/"], pos:"主谓", meaning:"我觉得"},
      {role:"主语", color:"#c87033", phonetic:["/hiːz/"], pos:"He is 缩写", meaning:"他在"},
      {role:"谓语短语", color:"#e74c7a", phonetic:["/ˈkʌmɪŋ/","/ɒn/","/tuː/","/juː/"], pos:"短语动词", meaning:"向（你）示好"}
    ],
    explanations: [
      "**come on to (someone)** 短语动词，意为（对某人）调情、示好、暧昧。多指单方面主动接近，常带暗示意味。",
      "注意与 come on（加油/快点/得了吧）区分。例句：He kept coming on to me at the party, so I left."
    ]
  },
  {
    sentence: "I've been a couch potato all weekend.",
    cid: fnv8("I've been a couch potato all weekend."),
    translation: "我整个周末都窝在沙发上看电视。",
    chunks: ["I've been","a couch potato","all weekend."],
    hints: ["我一直是个","沙发土豆（躺尸族）","整个周末"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪv/","/bɪn/"], pos:"现在完成时", meaning:"我一直是"},
      {role:"表语", color:"#3358e0", phonetic:["/ə/","/kaʊtʃ/","/pəˈteɪtoʊ/"], pos:"俚语名词", meaning:"整天躺沙发看电视的人"},
      {role:"时间状语", color:"#7c5cbf", phonetic:["/ɔːl/","/ˈwiːkˌend/"], pos:"名词短语", meaning:"整个周末"}
    ],
    explanations: [
      "**couch potato** 俚语，形容整天窝在沙发上看电视/刷手机、几乎不下床的人。贬义，带轻微自嘲意味。",
      "近义：homebody（宅家者，偏中性）/ shut-in（闭门不出，偏严重）。变体 veggie（蔬菜=沙发土豆的简短称呼）。例句：Stop being a couch potato — let's go for a walk."
    ]
  },
  {
    sentence: "Don't give yourself airs.",
    cid: fnv8("Don't give yourself airs."),
    translation: "别摆架子。",
    chunks: ["Don't","give yourself airs."],
    hints: ["别","自己摆架子"],
    grammar: [
      {role:"助动词", color:"#c87033", phonetic:["/doʊnt/"], pos:"否定助动词", meaning:"不要"},
      {role:"谓语+宾语+宾补", color:"#e74c7a", phonetic:["/ɡɪv/","/jərˈself/","/erz/"], pos:"固定短语", meaning:"摆架子"}
    ],
    explanations: [
      "**give oneself airs** 固定短语，意为摆架子、装腔作势、装了不起。多用于批评。airs 是复数名词，不能写成 air。",
      "近义：put on airs（更常用）/ act high and mighty / get a big head（自大）。例句：He really gives himself airs since he got promoted."
    ]
  },
  {
    sentence: "Fake it until you make it.",
    cid: fnv8("Fake it until you make it."),
    translation: "假装自信，直到你真的自信。",
    chunks: ["Fake it","until you make it."],
    hints: ["假装到","你真的做到了"],
    grammar: [
      {role:"祈使宾语", color:"#e74c7a", phonetic:["/feɪk/","/ɪt/"], pos:"代词短语", meaning:"假装这件事"},
      {role:"时间状语从句", color:"#7c5cbf", phonetic:["/ənˈtɪl/","/juː/","/meɪk/","/ɪt/"], pos:"从属连词引导", meaning:"直到你做到"}
    ],
    explanations: [
      "**Fake it until you make it.** 励志谚语，强调先假装自信/熟练，直到真正掌握。美国心理学 Amy Cuddy 的 power posing 理论也基于此。",
      "口语常用，注意语气：可激励人也可能暗示冒牌货。注意 make it 意为「做成」；it 重复指上文整件事。变体：Fake it till you make it（till 比 until 更口语）。"
    ]
  },
  {
    sentence: "That's a fresh take.",
    cid: fnv8("That's a fresh take."),
    translation: "这是个新颖的视角。",
    chunks: ["That's","a fresh take."],
    hints: ["那是","一个新鲜的视角"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/ðæts/"], pos:"That is 缩写", meaning:"那是"},
      {role:"表语", color:"#3358e0", phonetic:["/ə/","/freʃ/","/teɪk/"], pos:"固定短语", meaning:"新颖的看法"}
    ],
    explanations: [
      "**fresh take** 名词短语，指对事情的新颖视角、独特观点。常用于评价观点/表演/方案与之前不同。",
      "口语常用：That's a fresh take on the problem. 注意与 fresh（清新/新鲜）单独使用区分。变体：a new spin on / a different angle on。"
    ]
  },
  {
    sentence: "Try not to overthink; go with the flow.",
    cid: fnv8("Try not to overthink; go with the flow."),
    translation: "别想太多；顺其自然就好。",
    chunks: ["Try not to overthink;","go with the flow."],
    hints: ["别想太多；","顺其自然"],
    grammar: [
      {role:"祈使句1", color:"#e74c7a", phonetic:["/traɪ/","/nɒt/","/tuː/","/ˌoʊvərˈθɪŋk/"], pos:"动词不定式短语", meaning:"试着别过度思考"},
      {role:"祈使句2", color:"#e74c7a", phonetic:["/ɡoʊ/","/wɪð/","/ðə/","/floʊ/"], pos:"短语动词", meaning:"随波逐流；顺其自然"}
    ],
    explanations: [
      "**go with the flow** 短语动词，意为随大流、随遇而安、不强行控制局面。褒贬随语境——可指适应性强，也可指没主见。",
      "近义：roll with the punches（拳击习语，更口语）/ take things as they come。注意与 go with the times（与时俱进）区分。例句：Just relax and go with the flow."
    ]
  },
  {
    sentence: "She's going it alone this time.",
    cid: fnv8("She's going it alone this time."),
    translation: "这次她要独自扛。",
    chunks: ["She's","going it alone","this time."],
    hints: ["她在","独自干这件事","这次"],
    grammar: [
      {role:"主语", color:"#c87033", phonetic:["/ʃiːz/"], pos:"She is", meaning:"她在"},
      {role:"谓语短语", color:"#e74c7a", phonetic:["/ˈɡoʊɪŋ/","/ɪt/","/əˈloʊn/"], pos:"短语动词", meaning:"独自去做"},
      {role:"时间状语", color:"#7c5cbf", phonetic:["/ðɪs/","/taɪm/"], pos:"名词短语", meaning:"这次"}
    ],
    explanations: [
      "**go it alone** 短语动词，意为独自行动、单干。常用来评价独立创业者/决策者。it 是形式宾语，指代正在做的事。",
      "近义：go solo / strike out on one's own。注意语境：从「独立勇敢」到「孤立无援」都适用，看动词时态和上下文。"
    ]
  },
  {
    sentence: "Hang in there — it'll get better.",
    cid: fnv8("Hang in there — it'll get better."),
    translation: "再坚持一下——会好起来的。",
    chunks: ["Hang in there —","it'll get better."],
    hints: ["再坚持一下——","会变好的"],
    grammar: [
      {role:"祈使短语", color:"#e74c7a", phonetic:["/hæŋ/","/ɪn/","/ðer/"], pos:"短语动词", meaning:"坚持下去"},
      {role:"主系表", color:"#c87033", phonetic:["/ɪtəl/","/ɡet/","/ˈbetər/"], pos:"一般将来时", meaning:"它会变好"}
    ],
    explanations: [
      "**hang in there** 短语动词，意为坚持下去、不放弃。常用于安慰处于困境/低谷的人。比 stick with it 更口语、更有共情。",
      "近义：keep at it / stay strong / don't give up。例句：I know the job is tough, but hang in there. 注意：hang in 不带 there 时意为「凑合着用」。"
    ]
  },
  {
    sentence: "He holds a grudge like nobody's business.",
    cid: fnv8("He holds a grudge like nobody's business."),
    translation: "他记仇记得没完没了。",
    chunks: ["He holds","a grudge","like nobody's business."],
    hints: ["他怀有","怨恨","不要命地"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/hiː/","/hoʊldz/"], pos:"一般现在时（第三人称单数）", meaning:"他怀有"},
      {role:"宾语", color:"#3358e0", phonetic:["/ə/","/ɡrʌdʒ/"], pos:"名词", meaning:"怨恨"},
      {role:"程度状语", color:"#7c5cbf", phonetic:["/laɪk/","/ˈnoʊˌbɒdiz/","/ˈbɪznəs/"], pos:"固定短语", meaning:"极其；不得了"}
    ],
    explanations: [
      "**like nobody's business** 程度状语，意为「不得了」「不一般地」，形容程度夸张。比 very 更有戏谑色彩。",
      "近义：like crazy / like mad / like it's going out of style（也过时）。例句：She can cook like nobody's business. 注意 nobody's 永远带撇号。"
    ]
  },
  {
    sentence: "Let it be; don't force it.",
    cid: fnv8("Let it be; don't force it."),
    translation: "顺其自然吧；别强求。",
    chunks: ["Let it be;","don't force it."],
    hints: ["随它去；","别强求"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/let/","/ɪt/","/biː/"], pos:"短语动词", meaning:"让它保持现状"},
      {role:"祈使句", color:"#e74c7a", phonetic:["/doʊnt/","/fɔːrs/","/ɪt/"], pos:"否定祈使", meaning:"别强行做"}
    ],
    explanations: [
      "**let it be** 短语动词，意为听其自然、不强行干预。也是披头士名曲《Let It Be》歌名。隐含一种禅意/接受情绪。",
      "与 let it go（放下，源自《冰雪奇缘》Frozen）近义但侧重不同：let it be 是接受现状，let it go 是释怀过去。例句：Things will work themselves out — just let it be."
    ]
  },
  {
    sentence: "Make yourself at home.",
    cid: fnv8("Make yourself at home."),
    translation: "别客气，像在自己家一样。",
    chunks: ["Make","yourself at home."],
    hints: ["让","你感觉在家"],
    grammar: [
      {role:"祈使动词", color:"#e74c7a", phonetic:["/meɪk/"], pos:"动词", meaning:"使"},
      {role:"宾语+宾补", color:"#3358e0", phonetic:["/jərˈself/","/æt/","/hoʊm/"], pos:"固定短语", meaning:"像在家一样自处"}
    ],
    explanations: [
      "**make yourself at home** 标准客人招待用语，让对方自在不拘束。多用于请客人坐下/喝茶前。",
      "近义：feel free / make yourself comfortable。注意 yourself 不能换成其他代词（you 含反身意义）。例句：Welcome! Please come in and make yourself at home."
    ]
  },
  {
    sentence: "No need to make a fuss.",
    cid: fnv8("No need to make a fuss."),
    translation: "不用这么大惊小怪。",
    chunks: ["No need","to make a fuss."],
    hints: ["没有必要","小题大做"],
    grammar: [
      {role:"主语", color:"#c87033", phonetic:["/noʊ/","/niːd/"], pos:"名词短语", meaning:"没必要"},
      {role:"不定式短语", color:"#e74c7a", phonetic:["/tuː/","/meɪk/","/ə/","/fʌs/"], pos:"动词不定式", meaning:"去小题大做"}
    ],
    explanations: [
      "**make a fuss** 短语动词，意为小题大做、大惊小怪、过分激动。可加 over 某人/某事：make a fuss over nothing。",
      "近义：make a big deal / kick up a fuss（更强烈）/ hit the ceiling/freak out（情绪化）。例句：Don't make a fuss — it's just a scratch."
    ]
  },
  {
    sentence: "Once in a blue moon, I eat fast food.",
    cid: fnv8("Once in a blue moon, I eat fast food."),
    translation: "我难得吃一次快餐。",
    chunks: ["Once in a blue moon,","I eat fast food."],
    hints: ["千载难逢，","我吃快餐"],
    grammar: [
      {role:"频率状语", color:"#7c5cbf", phonetic:["/wʌns/","/ɪn/","/ə/","/bluː/","/muːn/"], pos:"固定短语", meaning:"极为罕见地"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/iːt/","/fæst/","/fuːd/"], pos:"一般现在时", meaning:"我吃快餐"}
    ],
    explanations: [
      "**once in a blue moon** 频率状语，意为「难得一次」「极为罕见」（蓝色月亮 ≈ 每 2-3 年才出现一次的天文现象）。",
      "近义：every once in a while（更频繁）/ hardly ever / not often。反义：every now and then / frequently。注意 blue moon 是固定搭配，不能换成别的颜色。"
    ]
  },
  {
    sentence: "Pull yourself together.",
    cid: fnv8("Pull yourself together."),
    translation: "振作起来。",
    chunks: ["Pull","yourself together."],
    hints: ["把","你自己整合起来"],
    grammar: [
      {role:"祈使动词", color:"#e74c7a", phonetic:["/pʊl/"], pos:"动词", meaning:"拉；使镇定"},
      {role:"宾语+副词", color:"#3358e0", phonetic:["/jərˈself/","/təˈɡeðər/"], pos:"反身代词+副词", meaning:"（让自己）镇定下来"}
    ],
    explanations: [
      "**pull yourself together** 短语动词，意为控制情绪、振作、冷静下来。常对崩溃/慌乱/情绪失控的人说。",
      "近义：get a grip（自己）/ compose yourself / settle down。更柔和的版本：take a deep breath。注意是对受话人说，you 永远是 yourself。"
    ]
  },
  {
    sentence: "She has a sweet tooth.",
    cid: fnv8("She has a sweet tooth."),
    translation: "她爱吃甜食。",
    chunks: ["She has","a sweet tooth."],
    hints: ["她有","一颗甜牙"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/ʃiː/","/hæz/"], pos:"一般现在时", meaning:"她有"},
      {role:"宾语", color:"#3358e0", phonetic:["/ə/","/swiːt/","/tuːθ/"], pos:"固定短语", meaning:"嗜甜的习惯"}
    ],
    explanations: [
      "**sweet tooth** 名词短语，字面「甜牙」，指爱吃甜食/糖果的喜好。口语且带亲昵感，形容自己时多带自嘲。",
      "近义：sugar addict / chocoholic（巧克力成瘾者）。复数：sweet teeth。常说：I have a sweet tooth — pass the cake."
    ]
  },
  {
    sentence: "Take it with a grain of salt.",
    cid: fnv8("Take it with a grain of salt."),
    translation: "半信半疑地听。",
    chunks: ["Take it","with a grain of salt."],
    hints: ["接受它","伴着一粒盐"],
    grammar: [
      {role:"祈使宾语", color:"#e74c7a", phonetic:["/teɪk/","/ɪt/"], pos:"代词短语", meaning:"听它；接受这个说法"},
      {role:"方式状语", color:"#7c5cbf", phonetic:["/wɪð/","/ə/","/ɡreɪn/","/əv/","/sɔːlt/"], pos:"固定短语", meaning:"持保留态度"}
    ],
    explanations: [
      "**with a grain of salt** 来源古罗马毒物解药配方（一粒盐），意为不全信、保留怀疑。听八卦/广告/单一来源消息时常用。",
      "近义：with a pinch of salt（更轻微）/ take it with a dose of skepticism。变体：take everything with a grain of salt。注意：别写成 \"a grain of sugar\"。"
    ]
  },
  {
    sentence: "We're on the same page.",
    cid: fnv8("We're on the same page."),
    translation: "我们意见一致。",
    chunks: ["We're","on the same page."],
    hints: ["我们在","同一页纸上"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/wɪr/"], pos:"We are 缩写", meaning:"我们在"},
      {role:"表语", color:"#3358e0", phonetic:["/ɒn/","/ðə/","/seɪm/","/peɪdʒ/"], pos:"固定短语", meaning:"同一页（意见一致）"}
    ],
    explanations: [
      "**on the same page** 固定短语，意为理解一致、意见统一，源自工作汇报/会议场景。也可指「在同一进度上」。",
      "近义：in agreement / on the same wavelength。 反义：on different pages（沟通错位）。常用回应：Let's make sure we're on the same page before we move on."
    ]
  },
  {
    sentence: "You are what you eat.",
    cid: fnv8("You are what you eat."),
    translation: "吃什么像什么。",
    chunks: ["You are","what you eat."],
    hints: ["你是","你吃的"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/juː/","/ɑːr/"], pos:"主系", meaning:"你是"},
      {role:"表语从句", color:"#3358e0", phonetic:["/wɒt/","/juː/","/iːt/"], pos:"宾语从句作表语", meaning:"你吃的东西"}
    ],
    explanations: [
      "**You are what you eat.** 谚语，强调饮食对健康/状态/性格的影响。常用于健康饮食倡导场合。",
      "也可比喻思想/习惯塑造人：You are what you read. 你读什么就是什么人。字面对比：You are what you drink（Drake 歌曲名）。"
    ]
  },
  {
    sentence: "They keep up with the Joneses by buying a new car every year.",
    cid: fnv8("They keep up with the Joneses by buying a new car every year."),
    translation: "他们年年换新车，就为跟邻居攀比。",
    chunks: ["They","keep up with the Joneses","by buying a new car every year."],
    hints: ["他们","跟邻居攀比、不甘落后","每年买一辆新车来……"],
    grammar: [
      {role:"主语", color:"#c87033", phonetic:["/ðeɪ/"], pos:"人称代词", meaning:"他们"},
      {role:"谓语", color:"#7c5cbf", phonetic:["/kiːp/","/ʌp/","/wɪð/","/ðə/","/ˈdʒoʊnzɪz/"], pos:"动词习语", meaning:"与邻居攀比、不甘人后"},
      {role:"方式状语", color:"#3358e0", phonetic:["/baɪ/","/ˈbaɪɪŋ/","/ə/","/nuː/","/kɑːr/","/ˈevri/","/jɪr/"], pos:"介词短语", meaning:"通过每年买辆新车"}
    ],
    explanations: [
      "**keep up with the Joneses** 指在物质消费上「攀比邻居、不甘落后」。源自 1913 年美国连环画《Keeping Up with the Joneses》，Joneses 泛指虚构的富裕邻居。",
      "近义：keep pace with（跟上节奏）；反义：do your own thing（走自己的路）。口语里常带贬义：Buying a bigger TV is just keeping up with the Joneses."
    ]
  },
  {
    sentence: "We're young, so let's live it up this summer.",
    cid: fnv8("We're young, so let's live it up this summer."),
    translation: "我们还年轻，今年夏天就尽情狂欢吧。",
    chunks: ["We're young,","so let's","live it up","this summer."],
    hints: ["我们还年轻","所以让我们","尽情享乐","这个夏天"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/wɪr/","/jʌŋ/"], pos:"主系表结构", meaning:"我们还年轻"},
      {role:"连词+祈使", color:"#e74c7a", phonetic:["/soʊ/","/lets/"], pos:"so + 祈使句", meaning:"所以让我们"},
      {role:"谓语", color:"#7c5cbf", phonetic:["/lɪv/","/ɪt/","/ʌp/"], pos:"动词习语", meaning:"尽情享乐、痛快生活"},
      {role:"时间状语", color:"#3358e0", phonetic:["/ðɪs/","/ˈsʌmər/"], pos:"名词短语", meaning:"这个夏天"}
    ],
    explanations: [
      "**live it up** 非正式口语，指「纵情享受、过奢华痛快的日子」，常见于假期、派对、发工资等语境。it 指代『生活本身』，无实指。",
      "近义：have a blast（玩得尽兴）/ let loose（放松）。例：You just got promoted — go live it up tonight!"
    ]
  },
  {
    sentence: "She works two jobs to make ends meet.",
    cid: fnv8("She works two jobs to make ends meet."),
    translation: "她打两份工才能勉强维持生计。",
    chunks: ["She works two jobs","to make ends meet."],
    hints: ["她打两份工","为了勉强收支相抵"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/ʃiː/","/wɜːrks/","/tuː/","/dʒɑːbz/"], pos:"主谓宾", meaning:"她打两份工"},
      {role:"目的状语", color:"#7c5cbf", phonetic:["/tə/","/meɪk/","/endz/","/miːt/"], pos:"动词习语", meaning:"勉强度日、收支相抵"}
    ],
    explanations: [
      "**make ends meet** 常用习语：收入仅够开销、「勉强糊口」。ends 指账本的两端（收入/支出），把两端接上=收支平衡。",
      "例：With rent so high, many young people can barely make ends meet.（房租这么高，很多年轻人入不敷出。）近义：get by（勉强过活）。"
    ]
  },
  {
    sentence: "Money talks — he got the contract overnight.",
    cid: fnv8("Money talks — he got the contract overnight."),
    translation: "有钱能使鬼推磨——他隔夜就拿下了合同。",
    chunks: ["Money talks","— he got the contract","overnight."],
    hints: ["金钱说了算（有钱能使鬼推磨）","他拿到了合同","一夜之间"],
    grammar: [
      {role:"主谓", color:"#7c5cbf", phonetic:["/ˈmʌni/","/tɔːks/"], pos:"习语谚语", meaning:"有钱能使鬼推磨"},
      {role:"补充说明", color:"#c87033", phonetic:["/hiː/","/ɡɑːt/","/ðə/","/ˈkɑːntrækt/"], pos:"主谓宾", meaning:"他拿到了合同"},
      {role:"时间状语", color:"#3358e0", phonetic:["/ˌoʊvərˈnaɪt/"], pos:"副词", meaning:"一夜之间"}
    ],
    explanations: [
      "**Money talks** 谚语：金钱有话语权，「有钱能使鬼推磨」。talk 拟人化——钱会替你『说话』、开路。",
      "变体：Money talks, bullshit walks.（真金白银说话，空话走人——较粗，慎用正式场合。）近义：Money makes the world go round."
    ]
  },
  {
    sentence: "The coach gave the team a pep talk before the final.",
    cid: fnv8("The coach gave the team a pep talk before the final."),
    translation: "决赛前教练给全队做了一番鼓舞士气的动员。",
    chunks: ["The coach gave the team","a pep talk","before the final."],
    hints: ["教练给球队","一番加油鼓劲的话","在决赛前"],
    grammar: [
      {role:"主谓双宾", color:"#c87033", phonetic:["/ðə/","/koʊtʃ/","/ɡeɪv/","/ðə/","/tiːm/"], pos:"主谓 + 间接宾语", meaning:"教练给球队"},
      {role:"宾语", color:"#7c5cbf", phonetic:["/ə/","/pep/","/tɔːk/"], pos:"固定搭配", meaning:"一番打气的话"},
      {role:"时间状语", color:"#3358e0", phonetic:["/bɪˈfɔːr/","/ðə/","/ˈfaɪnl/"], pos:"介词短语", meaning:"决赛之前"}
    ],
    explanations: [
      "**pep talk**：赛前/任务前的简短「动员讲话」，目的是提气。pep 意为精力、活力（pep up 使振作）。常见于体育、销售、考前场景。",
      "动词搭配：give sb a pep talk / need a pep talk。例：My manager gave me a pep talk before the presentation.（演讲前经理给我打气。）"
    ]
  },
  {
    sentence: "Don't worry, you'll be right as rain after a good sleep.",
    cid: fnv8("Don't worry, you'll be right as rain after a good sleep."),
    translation: "别担心，好好睡一觉你就会完全恢复的。",
    chunks: ["Don't worry,","you'll be","right as rain","after a good sleep."],
    hints: ["别担心","你会","安然无恙、状态大好","好好睡一觉之后"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/doʊnt/","/ˈwɜːri/"], pos:"否定祈使", meaning:"别担心"},
      {role:"主系", color:"#c87033", phonetic:["/juːl/","/biː/"], pos:"主系结构", meaning:"你将会"},
      {role:"表语", color:"#7c5cbf", phonetic:["/raɪt/","/æz/","/reɪn/"], pos:"习语·表语", meaning:"恢复如初、状态很好"},
      {role:"时间状语", color:"#3358e0", phonetic:["/ˈæftər/","/ə/","/ɡʊd/","/sliːp/"], pos:"介词短语", meaning:"在好好睡一觉后"}
    ],
    explanations: [
      "**right as rain** 英式色彩浓的习语，表示「完全正常、状态极佳、恢复如初」。rain 押韵且表清爽/滋养，故用 rain 而非其他词。",
      "常接在 be/feel 后：I'll be right as rain tomorrow.（我明天就活蹦乱跳了。）近义：as good as new / fit as a fiddle。"
    ]
  },
  {
    sentence: "His loud voice rubbed me the wrong way.",
    cid: fnv8("His loud voice rubbed me the wrong way."),
    translation: "他大嗓门让我心里很不舒服。",
    chunks: ["His loud voice","rubbed me","the wrong way."],
    hints: ["他的大嗓门","惹得我","很反感、不舒服"],
    grammar: [
      {role:"主语", color:"#c87033", phonetic:["/hɪz/","/laʊd/","/vɔɪs/"], pos:"名词短语", meaning:"他的大嗓门"},
      {role:"谓语+宾语", color:"#7c5cbf", phonetic:["/rʌbd/","/miː/"], pos:"动词习语", meaning:"惹恼我（rub…the wrong way）"},
      {role:"补足成分", color:"#3358e0", phonetic:["/ðə/","/rɔːŋ/","/weɪ/"], pos:"习语尾部", meaning:"以错误的方式（令人不快）"}
    ],
    explanations: [
      "**rub sb the wrong way**：无意间「惹恼、使不快」。意象：顺着毛摸（rub the right way）让人舒服，逆着毛（the wrong way）就难受。",
      "第三人称注意人称：His attitude rubs ME the wrong way / rubs HER the wrong way。近义：get on sb's nerves（让人烦躁）。"
    ]
  },
  {
    sentence: "Sorry I'm late — that's on me.",
    cid: fnv8("Sorry I'm late — that's on me."),
    translation: "抱歉我来晚了——是我的错。",
    chunks: ["Sorry I'm late","— that's on me."],
    hints: ["抱歉我迟到了","这怪我"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ˈsɑːri/","/aɪm/","/leɪt/"], pos:"道歉句式", meaning:"抱歉我迟到"},
      {role:"主系表", color:"#7c5cbf", phonetic:["/ðæts/","/ɑːn/","/miː/"], pos:"习语", meaning:"责任在我、怪我"}
    ],
    explanations: [
      "**That's on me.** 美式口语：主动揽责——「这是我的错/责任」。on sb = 责任落在某人身上。同级还有 The fault is on me. 语义更强。",
      "用法区分：That's on me.（揽责）/ It's on me.（这顿我请客——同形不同义，靠语境）。近义：my bad / I take the blame."
    ]
  },
  {
    sentence: "Think it over before you quit your job.",
    cid: fnv8("Think it over before you quit your job."),
    translation: "辞职之前，好好考虑一下。",
    chunks: ["Think it over","before you quit","your job."],
    hints: ["仔细考虑一下","在你辞掉之前","你的工作"],
    grammar: [
      {role:"谓语", color:"#7c5cbf", phonetic:["/θɪŋk/","/ɪt/","/ˈoʊvər/"], pos:"动词习语", meaning:"好好考虑（think over）"},
      {role:"时间状语从句", color:"#c87033", phonetic:["/bɪˈfɔːr/","/juː/","/kwɪt/"], pos:"before 从句", meaning:"在你放弃之前"},
      {role:"宾语", color:"#3358e0", phonetic:["/jɔːr/","/dʒɑːb/"], pos:"名词短语", meaning:"你的工作"}
    ],
    explanations: [
      "**think it over**：花时间「仔细考虑、权衡」后再决定。代词 it 必须放中间：think it over / think things over，不能说 think over it。",
      "近义：sleep on it（睡一觉再决定，缓一夜）。例：Don't rush — think it over and call me tomorrow."
    ]
  },
  {
    sentence: "Ask Tom for advice — he really knows his stuff.",
    cid: fnv8("Ask Tom for advice — he really knows his stuff."),
    translation: "去请教汤姆吧——他对这行是真懂。",
    chunks: ["Ask Tom for advice","— he really knows","his stuff."],
    hints: ["去问汤姆要建议","他真的很懂","他那一行（专业）"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/æsk/","/tɑːm/","/fɔːr/","/ədˈvaɪs/"], pos:"祈使句", meaning:"去问汤姆要建议"},
      {role:"主谓", color:"#c87033", phonetic:["/hiː/","/ˈriːəli/","/noʊz/"], pos:"主谓", meaning:"他真的了解"},
      {role:"宾语", color:"#7c5cbf", phonetic:["/hɪz/","/stʌf/"], pos:"习语·宾语", meaning:"他的专业/本领"}
    ],
    explanations: [
      "**know one's stuff**：对自己的领域「非常在行、门儿清」。stuff 泛指业务内容。搭配 one's 随主语变化：know your stuff / know my stuff。",
      "近义：know one's onions（英式）/ be an expert。例：She's young but she knows her stuff when it comes to coding."
    ]
  },
  {
    sentence: "He ignored the warning and got burned — he asked for it.",
    cid: fnv8("He ignored the warning and got burned — he asked for it."),
    translation: "他不听警告栽了跟头——这是他自找的。",
    chunks: ["He ignored the warning","and got burned","— he asked for it."],
    hints: ["他无视警告","然后吃了亏","他自找的"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/hiː/","/ɪɡˈnɔːrd/","/ðə/","/ˈwɔːrnɪŋ/"], pos:"主谓宾", meaning:"他无视了警告"},
      {role:"并列谓语", color:"#e74c7a", phonetic:["/ænd/","/ɡɑːt/","/bɜːrnd/"], pos:"并列谓语·被动", meaning:"结果吃了亏"},
      {role:"评注习语", color:"#7c5cbf", phonetic:["/hiː/","/æskt/","/fɔːr/","/ɪt/"], pos:"习语", meaning:"他自找的"}
    ],
    explanations: [
      "**ask for it**：字面『讨要』，实际指『自找麻烦、咎由自取』，常因不听劝告而吃亏。过去式 asked for it。",
      "较直白版：You asked for trouble. 例：He drove drunk and crashed — he really asked for it.（酒驾出车祸，纯属自找。）"
    ]
  },
  {
    sentence: "Don't get me wrong — I like the city, I just miss the quiet.",
    cid: fnv8("Don't get me wrong — I like the city, I just miss the quiet."),
    translation: "别误会——我喜欢这座城市，只是想念那份清静。",
    chunks: ["Don't get me wrong","— I like the city,","I just miss the quiet."],
    hints: ["别误解我","我喜欢这座城市","我只是想念那份安静"],
    grammar: [
      {role:"祈使句", color:"#7c5cbf", phonetic:["/doʊnt/","/ɡet/","/miː/","/rɔːŋ/"], pos:"习语·祈使", meaning:"别误会我的意思"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/laɪk/","/ðə/","/ˈsɪti/"], pos:"主谓宾", meaning:"我喜欢这座城市"},
      {role:"并列转折", color:"#3358e0", phonetic:["/aɪ/","/dʒʌst/","/mɪs/","/ðə/","/ˈkwaɪət/"], pos:"并列分句", meaning:"我只是想念那份安静"}
    ],
    explanations: [
      "**Don't get me wrong**：说容易引起误解的话之前的「预防针」——别把我的意思理解偏了。get = 理解，wrong = 错误地。",
      "固定句式：Don't get me wrong, + 想说的内容。例：Don't get me wrong, he's nice — he's just not very reliable."
    ]
  },
  {
    sentence: "We're in a hurry, so get to the point.",
    cid: fnv8("We're in a hurry, so get to the point."),
    translation: "我们赶时间，请直接说重点。",
    chunks: ["We're in a hurry,","so get to the point."],
    hints: ["我们赶时间","所以请说重点"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/wɪr/","/ɪn/","/ə/","/ˈhɜːri/"], pos:"主系表结构", meaning:"我们赶时间"},
      {role:"祈使句", color:"#7c5cbf", phonetic:["/soʊ/","/ɡet/","/tə/","/ðə/","/pɔɪnt/"], pos:"习语·祈使", meaning:"说重点、直奔主题"}
    ],
    explanations: [
      "**get to the point**：说话「直奔要点」，别绕弯子。point = 核心观点。是会议、争论中的高频祈使表达。",
      "反义：beat around the bush（拐弯抹角）。例：Stop the small talk and get to the point — what's the price?"
    ]
  },
  {
    sentence: "The boys wrecked the garden again — boys will be boys.",
    cid: fnv8("The boys wrecked the garden again — boys will be boys."),
    translation: "那些男孩又把花园弄乱了——男孩嘛，本性难移。",
    chunks: ["The boys wrecked the garden again","— boys will be boys."],
    hints: ["男孩们又弄坏了花园","男孩就是男孩（天性如此，别太计较）"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/ðə/","/bɔɪz/","/rekt/","/ðə/","/ˈɡɑːrdn/","/əˈɡen/"], pos:"主谓宾", meaning:"男孩们又弄乱了花园"},
      {role:"谚语", color:"#7c5cbf", phonetic:["/bɔɪz/","/wɪl/","/biː/","/bɔɪz/"], pos:"谚语", meaning:"男孩天性如此"}
    ],
    explanations: [
      "**Boys will be boys.** 西方谚语：男孩淘气是天性，用来为顽皮/幼稚行为开脱。语气通常是宽容的摇头一笑。",
      "中性批评者会指它是在『为不当行为找借口』。现代口语也出现 girls will be girls 的玩笑用法。"
    ]
  },
  {
    sentence: "The broken printer was the last straw — I quit.",
    cid: fnv8("The broken printer was the last straw — I quit."),
    translation: "打印机坏掉成了压垮我的最后一根稻草——我辞职了。",
    chunks: ["The broken printer was the last straw","— I quit."],
    hints: ["坏掉的打印机是压垮骆驼的最后一根稻草","我辞职了"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/ˈbroʊkən/","/ˈprɪntər/","/wʌz/","/ðə/","/læst/","/strɔː/"], pos:"主系表", meaning:"坏打印机成了最后一根稻草"},
      {role:"结果", color:"#7c5cbf", phonetic:["/aɪ/","/kwɪt/"], pos:"习语·主谓", meaning:"我辞职了"}
    ],
    explanations: [
      "**the last straw**：缩写自 the last straw that breaks the camel's back（压垮骆驼的最后一根稻草）——一系列忍让后最终引爆的那件事。",
      "例：The rude email was the last straw.（那封无礼的邮件成了压垮我的最后一根稻草。）近义：the final blow / the breaking point."
    ]
  },
  {
    sentence: "Enough is enough — stop making excuses.",
    cid: fnv8("Enough is enough — stop making excuses."),
    translation: "适可而止吧——别再找借口了。",
    chunks: ["Enough is enough","— stop making excuses."],
    hints: ["够了就是够了（我已经受够了）","停止找借口"],
    grammar: [
      {role:"谚语", color:"#7c5cbf", phonetic:["/ɪˈnʌf/","/ɪz/","/ɪˈnʌf/"], pos:"谚语·主系表", meaning:"适可而止、忍无可忍"},
      {role:"祈使句", color:"#e74c7a", phonetic:["/stɑːp/","/ˈmeɪkɪŋ/","/ɪkˈskjuːzɪz/"], pos:"祈使句", meaning:"别再造借口了"}
    ],
    explanations: [
      "**Enough is enough.** 语气强硬：容忍到极限，「适可而止、我受够了」。以同词重复构成强调，常用于吵架/警告的收尾。",
      "变体：I've had enough.（我受够了。）例：Enough is enough — we're returning this defective product."
    ]
  },
  {
    sentence: "You pay for the dinner and I'll cover the movie — call it even.",
    cid: fnv8("You pay for the dinner and I'll cover the movie — call it even."),
    translation: "你出晚饭钱，电影票我来付——咱俩算扯平。",
    chunks: ["You pay for the dinner","and I'll cover the movie","— call it even."],
    hints: ["你付晚餐的钱","电影我来付","就算两清了"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/juː/","/peɪ/","/fɔːr/","/ðə/","/ˈdɪnər/"], pos:"主谓", meaning:"你付晚餐钱"},
      {role:"并列主谓", color:"#c87033", phonetic:["/ænd/","/aɪl/","/ˈkʌvər/","/ðə/","/ˈmuːvi/"], pos:"并列分句", meaning:"我来付电影票"},
      {role:"习语", color:"#7c5cbf", phonetic:["/kɔːl/","/ɪt/","/ˈiːvən/"], pos:"动词习语", meaning:"算扯平、两不相欠"}
    ],
    explanations: [
      "**call it even**：把账算平、「互不相欠」。even = 对等。常出现在轮流请客、分工后：You got the first round, I'll get this one and we call it even.",
      "近义：be even / we're square / call it quits（就此打住，可指关系或争执）。例：I helped you move; you fixed my bike — let's call it even."
    ]
  },
  {
    sentence: "Sorry to bother you, but do you have a minute?",
    cid: fnv8("Sorry to bother you, but do you have a minute?"),
    translation: "抱歉打扰一下，你有空吗？",
    chunks: ["Sorry to bother you,","but do you have a minute?"],
    hints: ["抱歉打扰你","但你有空吗？"],
    grammar: [
      {role:"道歉句式", color:"#e74c7a", phonetic:["/ˈsɑːri/","/tə/","/ˈbɑːðər/","/juː/"], pos:"道歉不定式", meaning:"抱歉打扰你"},
      {role:"征询", color:"#c87033", phonetic:["/bət/","/duː/","/juː/","/hæv/","/ə/","/ˈmɪnɪt/"], pos:"一般疑问句", meaning:"但你有空吗"}
    ],
    explanations: [
      "**Sorry to bother you** 职场/日常万能开场白：礼貌地打断别人。bother = 打扰、添麻烦。回答：No problem / Not at all.",
      "变体：Sorry to interrupt（打断别人说话时）/ Sorry for the trouble（事后致歉）。同义礼貌开场：Excuse me, do you have a second?"
    ]
  },
  {
    sentence: "If you love the job, just go for it.",
    cid: fnv8("If you love the job, just go for it."),
    translation: "你要是喜欢这份工作，就大胆去争取吧。",
    chunks: ["If you love the job,","just go for it."],
    hints: ["如果你喜欢这份工作","就大胆去争取吧"],
    grammar: [
      {role:"条件从句", color:"#c87033", phonetic:["/ɪf/","/juː/","/lʌv/","/ðə/","/dʒɑːb/"], pos:"if 条件句", meaning:"如果你喜欢这工作"},
      {role:"祈使句", color:"#7c5cbf", phonetic:["/dʒʌst/","/ɡoʊ/","/fɔːr/","/ɪt/"], pos:"动词习语·祈使", meaning:"大胆去争取、勇敢尝试"}
    ],
    explanations: [
      "**go for it** 万能鼓励语：放手去做、勇敢争取、别犹豫。it 指代目标/机会。比 try it 更带冲劲。",
      "例：— Should I apply for the manager position? — Of course, go for it! 近义：give it a shot / just do it."
    ]
  },
  {
    sentence: "There are only five seats — it's first come, first served.",
    cid: fnv8("There are only five seats — it's first come, first served."),
    translation: "只有五个座位——先到先得。",
    chunks: ["There are only five seats","— it's first come,","first served."],
    hints: ["只有五个座位","这是先到","先得（先来先服务）"],
    grammar: [
      {role:"存在句", color:"#c87033", phonetic:["/ðer/","/ɑːr/","/ˈoʊnli/","/faɪv/","/siːts/"], pos:"there be 句型", meaning:"只有五个座位"},
      {role:"谚语", color:"#7c5cbf", phonetic:["/ɪts/","/fɜːrst/","/kʌm/"], pos:"谚语·前半", meaning:"先来的"},
      {role:"谚语", color:"#7c5cbf", phonetic:["/fɜːrst/","/sɜːrvd/"], pos:"谚语·后半", meaning:"先被服务（先到先得）"}
    ],
    explanations: [
      "**First come, first served.** 通用规则语：按到达顺序先到先得。served 严格语法应为被动 served，口语常说 serve。常见于售票、入场、抢座。",
      "例：The free samples are first come, first served.（免费试吃先到先得。）祈使变体：First come, first serve!（招牌常用，语法略省。）"
    ]
  },
  {
    sentence: "It's only a matter of time before the truth comes out.",
    cid: fnv8("It's only a matter of time before the truth comes out."),
    translation: "真相大白只是时间问题。",
    chunks: ["It's only a matter of time","before the truth comes out."],
    hints: ["这只是时间问题","在真相大白之前"],
    grammar: [
      {role:"主系表", color:"#7c5cbf", phonetic:["/ɪts/","/ˈoʊnli/","/ə/","/ˈmætər/","/əv/","/taɪm/"], pos:"习语·主系表", meaning:"只是时间问题"},
      {role:"时间状语从句", color:"#c87033", phonetic:["/bɪˈfɔːr/","/ðə/","/truːθ/","/kʌmz/","/aʊt/"], pos:"before 从句", meaning:"真相暴露之前"}
    ],
    explanations: [
      "**a matter of time**：某事必然发生，「只是早晚问题」。固定句式 It's only/just a matter of time before + 从句。",
      "例：It's only a matter of time before they find out.（他们发现只是时间问题。）近义：it's inevitable / it's bound to happen."
    ]
  },
  {
    sentence: "Where we eat tonight is up to you.",
    cid: fnv8("Where we eat tonight is up to you."),
    translation: "今晚去哪吃，由你决定。",
    chunks: ["Where we eat tonight","is up to you."],
    hints: ["今晚我们吃什么","由你决定"],
    grammar: [
      {role:"主语从句", color:"#c87033", phonetic:["/wer/","/wiː/","/iːt/","/təˈnaɪt/"], pos:"where 主语从句", meaning:"今晚我们去哪吃"},
      {role:"主系表", color:"#7c5cbf", phonetic:["/ɪz/","/ʌp/","/tə/","/juː/"], pos:"习语·主系表", meaning:"取决于你、由你定"}
    ],
    explanations: [
      "**up to you**：决定权交给你——「由你决定/看你」。固定搭配 it's up to you / it's up to sb。口语常单独成句：Up to you!",
      "变体：It's your call.（你来拍板。）例：— Movie or dinner? — Up to you, I'm easy.（你定吧，我都行。）"
    ]
  },
  {
    sentence: "The car almost hit me — that was close!",
    cid: fnv8("The car almost hit me — that was close!"),
    translation: "那辆车差点撞上我——好险！",
    chunks: ["The car almost hit me","— that was close!"],
    hints: ["车差点撞到我","刚才好险！"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/ðə/","/kɑːr/","/ˈɔːlmoʊst/","/hɪt/","/miː/"], pos:"主谓宾", meaning:"车差点撞到我"},
      {role:"感叹习语", color:"#7c5cbf", phonetic:["/ðæt/","/wʌz/","/kloʊs/"], pos:"习语·感叹", meaning:"好险、差一点就出事"}
    ],
    explanations: [
      "**That was close!** 劫后余生的感叹：差一点就出事/成功，「好险！/就差一点！」。close = 接近（危险或成败边缘）。",
      "也用于体育、比赛险胜：That was close — we won by one point! 近义：That was a narrow escape."
    ]
  },
  {
    sentence: "Keep your chin up — better days are coming.",
    cid: fnv8("Keep your chin up — better days are coming."),
    translation: "抬起头来别气馁——好日子会来的。",
    chunks: ["Keep your chin up","— better days are coming."],
    hints: ["别垂头丧气（抬起下巴）","更好的日子就要来了"],
    grammar: [
      {role:"祈使句", color:"#7c5cbf", phonetic:["/kiːp/","/jɔːr/","/tʃɪn/","/ʌp/"], pos:"习语·祈使", meaning:"别气馁、振作点"},
      {role:"主谓", color:"#c87033", phonetic:["/ˈbetər/","/deɪz/","/ɑːr/","/ˈkʌmɪŋ/"], pos:"现在进行表将来", meaning:"好日子将至"}
    ],
    explanations: [
      "**keep your chin up** 安慰语：别垂头丧气、保持乐观。意象：下巴抬起来=不低头认输。常在朋友失意时说。",
      "例：I know the interview went badly, but keep your chin up — there will be other chances. 近义：cheer up / stay positive."
    ]
  },
  {
    sentence: "I won't sign that contract — no way!",
    cid: fnv8("I won't sign that contract — no way!"),
    translation: "我绝不签那份合同——没门！",
    chunks: ["I won't sign that contract —","no way!"],
    hints: ["我绝不签那份合同","没门！强烈拒绝"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/woʊnt/","/saɪn/","/ðæt/","/ˈkɑːntrækt/"], pos:"否定陈述句", meaning:"我不会签合同"},
      {role:"感叹习语", color:"#7c5cbf", phonetic:["/noʊ/","/weɪ/"], pos:"习语·强烈拒绝", meaning:"不可能！没门！"}
    ],
    explanations: [
      "**No way!** 强烈拒绝/惊讶：不可能！没门！比 No 更口语、带情绪。",
      "近义：No! / Absolutely not! / Forget it! 例：— Want to skydive? — No way!"
    ]
  },
  {
    sentence: "Come on, the bus is almost here!",
    cid: fnv8("Come on, the bus is almost here!"),
    translation: "快点，公交车快到了！",
    chunks: ["Come on,","the bus is almost here!"],
    hints: ["催人催促","公交车快到了"],
    grammar: [
      {role:"催促习语", color:"#7c5cbf", phonetic:["/kʌm/","/ɑːn/"], pos:"习语·催促鼓励", meaning:"快点！加把劲！"},
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/bʌs/","/ɪz/","/ˈɔːlmoʊst/","/hɪr/"], pos:"现在时表将来", meaning:"公交车即将到站"}
    ],
    explanations: [
      "**Come on** 催促/不耐烦/鼓励：快点！加把劲！语境：催人出门、加好友游戏、鼓励沮丧的人。",
      "注意连读：come on = /kʌm ɑːn/。也用在句末：Oh, come on!（哎，别这样！）"
    ]
  },
  {
    sentence: "Hold on a second — I'll get the door.",
    cid: fnv8("Hold on a second — I'll get the door."),
    translation: "稍等一下——我去开门。",
    chunks: ["Hold on","a second —","I'll get the door."],
    hints: ["让对方等一下","我去开门"],
    grammar: [
      {role:"等待习语", color:"#7c5cbf", phonetic:["/hoʊld/","/ɑːn/"], pos:"习语·祈使", meaning:"稍等一下"},
      {role:"时间状语", color:"#7c5cbf", phonetic:["/ə/","/ˈsekənd/"], pos:"不定冠词+名词", meaning:"一会儿"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪl/","/ɡet/","/ðə/","/dɔːr/"], pos:"将来时", meaning:"我去开门"}
    ],
    explanations: [
      "**hold on** 等一下；Hold on a second 句式：稍等一会儿。比 wait 口语、电话常用。",
      "近义：wait a moment / hang on（同义）/ just a sec. 例：— Is this the right bus? — Hold on, let me check."
    ]
  },
  {
    sentence: "Hold it — I need to check this first.",
    cid: fnv8("Hold it — I need to check this first."),
    translation: "暂停一下——我得先核实这件事。",
    chunks: ["Hold it —","I need to check this first."],
    hints: ["叫停对方","我先核实一下"],
    grammar: [
      {role:"叫停习语", color:"#7c5cbf", phonetic:["/hoʊld/","/ɪt/"], pos:"习语·祈使", meaning:"暂停一下"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/niːd/","/tʃek/","/ðɪs/","/fɜːrst/"], pos:"need to 不定式", meaning:"我需要先核实"}
    ],
    explanations: [
      "**Hold it** 比 hold on 更强烈：暂停！停一下！多在对方行动过快、过急时叫停。",
      "近义：Hold on / Wait a minute / Easy now. 例：— I'll spend $5000. — Hold it — we can't afford that."
    ]
  },
  {
    sentence: "You're in my personal space — back off!",
    cid: fnv8("You're in my personal space — back off!"),
    translation: "你靠得太近了——退后！",
    chunks: ["You're in my personal space —","back off!"],
    hints: ["你侵犯了我的私人空间","退后！别靠近"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/jʊr/","/ɪn/","/maɪ/","/ˈpɜːrsənl/","/speɪs/"], pos:"现在进行", meaning:"你进了我的私人空间"},
      {role:"命令习语", color:"#7c5cbf", phonetic:["/bæk/","/ɔːf/"], pos:"习语·命令", meaning:"退后、别靠近"}
    ],
    explanations: [
      "**Back off** 命令对方后撤/退让：退后！别再逼近。多用于争吵、肢体冲突升级时。",
      "近义：Step back / Move away. 名词形式：give someone some space."
    ]
  },
  {
    sentence: "Cheer up — things will get better.",
    cid: fnv8("Cheer up — things will get better."),
    translation: "振作起来——事情会好起来的。",
    chunks: ["Cheer up —","things will get better."],
    hints: ["让人开心起来","事情会好起来"],
    grammar: [
      {role:"鼓励习语", color:"#7c5cbf", phonetic:["/tʃɪr/","/ʌp/"], pos:"习语·祈使", meaning:"振作起来"},
      {role:"主谓", color:"#c87033", phonetic:["/θɪŋz/","/wɪl/","/ɡet/","/ˈbetər/"], pos:"一般将来时", meaning:"事情会变好"}
    ],
    explanations: [
      "**Cheer up** 鼓励沮丧的人：振作起来。up = 向上=情绪好转。",
      "近义：keep your chin up / hang in there / stay positive. 例：I failed the exam. — Don't worry, cheer up, you can try again."
    ]
  },
  {
    sentence: "I don't want to see you — get lost!",
    cid: fnv8("I don't want to see you — get lost!"),
    translation: "我不想见到你——滚开！",
    chunks: ["I don't want to see you —","get lost!"],
    hints: ["我不想见到你","滚开！走开"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/doʊnt/","/wɑːnt/","/siː/","/juː/"], pos:"否定陈述句", meaning:"我不想见你"},
      {role:"驱赶习语", color:"#7c5cbf", phonetic:["/ɡet/","/lɔːst/"], pos:"习语·命令粗鲁", meaning:"滚开、走开"}
    ],
    explanations: [
      "**Get lost** 粗鲁命令走开：滚开、消失。lost = 迷路=请消失在我视野里。",
      "注意语气强烈，比 go away 更狠。例：— Can I borrow $100? — Get lost! Get a job!"
    ]
  },
  {
    sentence: "Go ahead and start without me.",
    cid: fnv8("Go ahead and start without me."),
    translation: "你们先开始吧，不用等我。",
    chunks: ["Go ahead","and start without me."],
    hints: ["让对方先做","不用等我开始"],
    grammar: [
      {role:"允许习语", color:"#7c5cbf", phonetic:["/ɡoʊ/","/əˈhed/"], pos:"习语·允许", meaning:"开始吧、请便"},
      {role:"并列谓宾", color:"#c87033", phonetic:["/stɑːrt/","/wɪˈðaʊt/","/miː/"], pos:"祈使句+介宾", meaning:"不等地开始"}
    ],
    explanations: [
      "**Go ahead** 请便、动手吧：允许他人开始做某事。也用于：— May I open it? — Go ahead.",
      "近义：Please do / Be my guest. 反义：Hold on（等一下）。"
    ]
  },
  {
    sentence: "Have fun at the party tonight!",
    cid: fnv8("Have fun at the party tonight!"),
    translation: "今晚派对玩得开心！",
    chunks: ["Have fun","at the party tonight!"],
    hints: ["祝玩得开心","今晚派对"],
    grammar: [
      {role:"祝福习语", color:"#7c5cbf", phonetic:["/hæv/","/fʌn/"], pos:"习语·告别祝福", meaning:"玩得开心"},
      {role:"介宾短语", color:"#c87033", phonetic:["/ət/","/ðə/","/ˈpɑːrti/","/tʊˈnaɪt/"], pos:"介词短语", meaning:"今晚的派对"}
    ],
    explanations: [
      "**Have fun** 告别祝福：玩得开心！最常用告别语之一，朋友出门/度假都说。",
      "近义：Enjoy yourself / Have a good time. 例：Have fun on your trip!"
    ]
  },
  {
    sentence: "Heads up — the meeting moved to 3.",
    cid: fnv8("Heads up — the meeting moved to 3."),
    translation: "提醒一下——会议改到 3 点了。",
    chunks: ["Heads up —","the meeting moved to 3."],
    hints: ["发个提醒","会议改到 3 点"],
    grammar: [
      {role:"提醒习语", color:"#7c5cbf", phonetic:["/hedz/","/ʌp/"], pos:"习语·警告提醒", meaning:"提醒、注意"},
      {role:"主谓", color:"#c87033", phonetic:["/ðə/","/ˈmiːtɪŋ/","/muːvd/","/tʊ/","/θriː/"], pos:"一般过去时", meaning:"会议移到了 3 点"}
    ],
    explanations: [
      "**Heads up** 简短提醒：注意！告诉你/有情况。heads up = 抬头关注=用注意力提醒。",
      "近义：FYI / Just so you know. 例：Heads up — road is closed ahead."
    ]
  },
  {
    sentence: "So be it — I won't argue anymore.",
    cid: fnv8("So be it — I won't argue anymore."),
    translation: "那就随它去吧——我不再争了。",
    chunks: ["So be it","— I won't argue anymore."],
    hints: ["无奈接受","不再争辩"],
    grammar: [
      {role:"接受习语", color:"#7c5cbf", phonetic:["/soʊ/","/biː/","/ɪt/"], pos:"习语·让步接受", meaning:"那就那样吧、随它去"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/woʊnt/","/ˈɑːrɡjuː/","/ˌɛnəˈmɔːr/"], pos:"否定将来时", meaning:"我不再争辩"}
    ],
    explanations: [
      "**So be it** 无奈/正式接受：那就那样吧、随它去。比 OK 更沉重，常用于失败、降级、让步场景。",
      "近义：Let it be / That's that. 例：If you want to quit school, so be it."
    ]
  },
  {
    sentence: "I'll stand by you no matter what.",
    cid: fnv8("I'll stand by you no matter what."),
    translation: "无论如何我都会支持你。",
    chunks: ["I'll stand by","you no matter what."],
    hints: ["无论发生什么都支持","我会站在你这边的"],
    grammar: [
      {role:"支持习语", color:"#7c5cbf", phonetic:["/stænd/","/baɪ/"], pos:"习语·短语动词", meaning:"支持、站在一边"},
      {role:"宾语状语", color:"#c87033", phonetic:["/juː/","/noʊ/","/ˈmætər/","/wɑːt/"], pos:"让步从句缩写", meaning:"无论发生什么"}
    ],
    explanations: [
      "**stand by (sb)** 支持某人、站在某人一边；stand by (sth) 坚守承诺。",
      "例：Whatever you decide, I'll stand by you. 名词形式：stand-by 候补/待命。"
    ]
  },
  {
    sentence: "That was an amazing save — you rock!",
    cid: fnv8("That was an amazing save — you rock!"),
    translation: "那个救球太精彩了——你太棒了！",
    chunks: ["That was an amazing save —","you rock!"],
    hints: ["那个救球太神了","你真棒！太厉害了"],
    grammar: [
      {role:"主系定语", color:"#c87033", phonetic:["/ðæt/","/wʌz/","/ən/","/əˈmeɪzɪŋ/","/seɪv/"], pos:"主系表", meaning:"那是个绝妙的救球"},
      {role:"称赞习语", color:"#7c5cbf", phonetic:["/juː/","/rɑːk/"], pos:"习语·俚语赞誉", meaning:"你很棒、你太厉害了"}
    ],
    explanations: [
      "**You rock** 俚语赞誉：你很棒、你太厉害了！rock = 像摇滚明星一样牛。",
      "近义：You're awesome / You rule. 例：Thanks for the help! — You rock!"
    ]
  },
  {
    sentence: "After you — please, go in first.",
    cid: fnv8("After you — please, go in first."),
    translation: "您先请——请先进。",
    chunks: ["After you —","please, go in first."],
    hints: ["礼貌让对方先","请先进去"],
    grammar: [
      {role:"礼让习语", color:"#7c5cbf", phonetic:["/ˈæftər/","/juː/"], pos:"习语·礼貌让先", meaning:"您先请"},
      {role:"祈使句", color:"#c87033", phonetic:["/pliːz/","/ɡoʊ/","/ɪn/","/fɜːrst/"], pos:"祈使句", meaning:"请先进"}
    ],
    explanations: [
      "**After you** 礼貌让先：您先请。进门、上车、点餐都常用。",
      "回礼：After you / No, after you. 这是基本礼仪训练场景。反义：age before beauty（幽默版）。"
    ]
  },
  {
    sentence: "The taxi is leaving — chop chop!",
    cid: fnv8("The taxi is leaving — chop chop!"),
    translation: "出租车要开走了——快点快点！",
    chunks: ["The taxi is leaving —","chop chop!"],
    hints: ["出租车要开走","赶紧！快点快点"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/ðə/","/ˈtæksi/","/ɪz/","/ˈliːvɪŋ/"], pos:"现在进行表将来", meaning:"出租车要开走"},
      {role:"催促习语", color:"#7c5cbf", phonetic:["/tʃɑːp/","/tʃɑːp/"], pos:"拟声习语·催促", meaning:"快点快点（拟切菜声）"}
    ],
    explanations: [
      "**Chop chop** 拟声催促：快点快点（厨师切菜声）。中英混用范畴：儿童/老人/口音友好。",
      "近义：Hurry up / Quickly now. 例：— Dad, we're late! — Chop chop, get in the car!"
    ]
  },
  {
    sentence: "Fire away — I'm listening carefully.",
    cid: fnv8("Fire away — I'm listening carefully."),
    translation: "尽管问吧——我在认真听着。",
    chunks: ["Fire away —","I'm listening carefully."],
    hints: ["鼓励对方问","我在认真听"],
    grammar: [
      {role:"邀请习语", color:"#7c5cbf", phonetic:["/ˈfaɪər/","/əˈweɪ/"], pos:"习语·邀请开始", meaning:"尽管问、尽管说"},
      {role:"主谓状", color:"#c87033", phonetic:["/aɪm/","/ˈlɪsənɪŋ/","/ˈkɛrfəli/"], pos:"现在进行+方式", meaning:"我在仔细听"}
    ],
    explanations: [
      "**Fire away** 邀请对方开口说/问：尽管问、尽管说。原为火炮用语（开炮），引申为「开始发问」。",
      "例：— Can I ask you something? — Sure, fire away. 答复疑问很常用的套话。"
    ]
  },
  {
    sentence: "Forget it — I don't care anymore.",
    cid: fnv8("Forget it — I don't care anymore."),
    translation: "算了——我不在乎了。",
    chunks: ["Forget it —","I don't care anymore."],
    hints: ["放弃计较","不再在乎"],
    grammar: [
      {role:"放弃习语", color:"#7c5cbf", phonetic:["/fərˈɡet/","/ɪt/"], pos:"习语·放弃拒绝", meaning:"算了、别提了"},
      {role:"主谓状", color:"#c87033", phonetic:["/aɪ/","/doʊnt/","/kɛr/","/ɛnəˈmɔːr/"], pos:"否定陈述句", meaning:"我不再在乎"}
    ],
    explanations: [
      "**Forget it** 多义：①算了别提了 ②不客气（回应 thank you 时）③不可能（强烈否认）。",
      "语境区分：Forget it, I'll do it myself.（算了）vs. — Thanks! — Forget it.（不客气）。"
    ]
  },
  {
    sentence: "Don't talk back to your elders.",
    cid: fnv8("Don't talk back to your elders."),
    translation: "别跟长辈顶嘴。",
    chunks: ["Don't talk back","to your elders."],
    hints: ["别顶嘴","对长辈"],
    grammar: [
      {role:"顶嘴习语", color:"#7c5cbf", phonetic:["/tɔːk/","/bæk/"], pos:"习语·短语动词", meaning:"顶嘴、回嘴"},
      {role:"介宾短语", color:"#c87033", phonetic:["/tuː/","/jʊr/","/ˈeldərz/"], pos:"介词+名词", meaning:"对你的长辈"}
    ],
    explanations: [
      "**talk back** 回嘴、顶嘴（对长辈/上级）。back = 顶回去。",
      "例：Don't talk back to me! 近义：talk cheekily / mouth off. 注意 talk to the hand 系厌女俚语，不推荐。"
    ]
  },
  {
    sentence: "That's it — I'm done with this job.",
    cid: fnv8("That's it — I'm done with this job."),
    translation: "就这样了——我对这工作受够了。",
    chunks: ["That's it —","I'm done with this job."],
    hints: ["表示结束","我与这份工作绝交了"],
    grammar: [
      {role:"终结习语", color:"#7c5cbf", phonetic:["/ðæts/","/ɪt/"], pos:"习语·终结", meaning:"就这样、够了"},
      {role:"主系表", color:"#c87033", phonetic:["/aɪm/","/dʌn/","/wɪð/","/ðɪs/","/dʒɑːb/"], pos:"完成式", meaning:"我对这份工作做完了"}
    ],
    explanations: [
      "**That's it** 终结/接受语：就这样、够了。两种语气：①够了②那就是关键/原因。",
      "近义：I'm done / I quit / Enough. 例：That's it — I'm moving out.（就这样，我要搬走。）"
    ]
  },
  {
    sentence: "I haven't seen you for ages — what's up?",
    cid: fnv8("I haven't seen you for ages — what's up?"),
    translation: "好久没见到你了——最近怎么样？",
    chunks: ["I haven't seen you for ages —","what's up?"],
    hints: ["我很久没见你了","问候语：最近怎么样"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈhævənt/","/siːn/","/juː/","/fɔːr/","/ˈeɪdʒɪz/"], pos:"现在完成时", meaning:"我很久没见你"},
      {role:"问候习语", color:"#7c5cbf", phonetic:["/wʌts/","/ʌp/"], pos:"习语·招呼", meaning:"怎么了？最近怎样？"}
    ],
    explanations: [
      "**What's up** 招呼/问候：怎么了？最近怎么样？非正式问候，回答常 Not much / Hey。",
      "也可表达「出了什么事」：What's up with him? He looks angry."
    ]
  },
  {
    sentence: "Ask around — somebody must know.",
    cid: fnv8("Ask around — somebody must know."),
    translation: "四处问问吧——总有人知道。",
    chunks: ["Ask around —","somebody must know."],
    hints: ["到处打听","一定有人知道"],
    grammar: [
      {role:"打听习语", color:"#7c5cbf", phonetic:["/æsk/","/əˈraʊnd/"], pos:"习语·短语动词", meaning:"四处打听、问一圈"},
      {role:"主谓宾", color:"#c87033", phonetic:["/ˈsʌmˌbɑːdi/","/mʌst/","/noʊ/"], pos:"情态动词", meaning:"一定有人知道"}
    ],
    explanations: [
      "**ask around** 四处打听：问一圈不同的人。比 ask 更主动、覆盖更广。",
      "例：I don't know, but I'll ask around. 反义：keep it to yourself."
    ]
  },
  {
    sentence: "I didn't catch that — come again?",
    cid: fnv8("I didn't catch that — come again?"),
    translation: "我没听清——你再说一遍？",
    chunks: ["I didn't catch that —","come again?"],
    hints: ["我没听清","请再说一遍"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈdɪdnt/","/kætʃ/","/ðæt/"], pos:"一般过去否定", meaning:"我没听清"},
      {role:"求复习语", color:"#7c5cbf", phonetic:["/kʌm/","/əˈɡen/"], pos:"习语·礼貌求复", meaning:"再说一遍？"}
    ],
    explanations: [
      "**Come again?** 礼貌求复：请再说一遍？比 What? 更柔和，店员/电话常用。",
      "正式版：Could you repeat that, please? 例：— Room 305. — Come again? — Room 305."
    ]
  },
  {
    sentence: "I'm trying to study — cut it out!",
    cid: fnv8("I'm trying to study — cut it out!"),
    translation: "我正想学习呢——别闹了！",
    chunks: ["I'm trying to study —","cut it out!"],
    hints: ["我正在学习","别闹！停下来"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪm/","/ˈtraɪɪŋ/","/ˈstʌdi/"], pos:"现在进行", meaning:"我正试图学习"},
      {role:"禁止习语", color:"#7c5cbf", phonetic:["/kʌt/","/ɪt/","/aʊt/"], pos:"习语·命令禁止", meaning:"住手、别闹"}
    ],
    explanations: [
      "**Cut it out** 命令对方停止：住手、别闹。原意「切掉它」（从中间剪开）。",
      "近义：Knock it off / Stop it. 例：— Leave me alone! — Cut it out!"
    ]
  },
  {
    sentence: "Be my guest — help yourself to coffee.",
    cid: fnv8("Be my guest — help yourself to coffee."),
    translation: "请便——随意喝咖啡吧。",
    chunks: ["Be my guest —","help yourself to coffee."],
    hints: ["请对方随意","咖啡自便"],
    grammar: [
      {role:"允许习语", color:"#7c5cbf", phonetic:["/biː/","/maɪ/","/ɡest/"], pos:"习语·允许", meaning:"请便、随意"},
      {role:"祈使句宾", color:"#c87033", phonetic:["/help/","/jɔːrˈself/","/tʊ/","/ˈkɔːfi/"], pos:"反身代词+介宾", meaning:"自己取咖啡"}
    ],
    explanations: [
      "**Be my guest** 客气允许：请便、随意。回应— May I sit here? — Be my guest.",
      "与 help yourself 搭配 = 完全自便；help yourself to X 自由取用（食物/饮料）。"
    ]
  },
  {
    sentence: "By no means should you open that door.",
    cid: fnv8("By no means should you open that door."),
    translation: "你绝对不应该打开那扇门。",
    chunks: ["By no means","should you open that door."],
    hints: ["绝对不","应该打开吗"],
    grammar: [
      {role:"否定习语", color:"#7c5cbf", phonetic:["/baɪ/","/noʊ/","/miːnz/"], pos:"习语·强调否定", meaning:"绝不、绝不"},
      {role:"倒装句", color:"#c87033", phonetic:["/ʃʊd/","/juː/","/ˈoʊpən/","/ðæt/","/dɔːr/"], pos:"半倒装情态", meaning:"你绝不要开门"}
    ],
    explanations: [
      "**by no means** 绝不（加强否定）。句中位=部分倒装：By no means should you ... = You should never ...",
      "近义：Not at all / Never / Absolutely not. 例：By no means am I going to apologize."
    ]
  },
  {
    sentence: "He runs the office by the book.",
    cid: fnv8("He runs the office by the book."),
    translation: "他照章办事，管那间办公室。",
    chunks: ["He runs the office","by the book."],
    hints: ["管理办公室","严格按规章来"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/hiː/","/rʌnz/","/ðiː/","/ˈɔːfɪs/"], pos:"一般现在时", meaning:"他管这间办公室"},
      {role:"方式状语", color:"#7c5cbf", phonetic:["/baɪ/","/ðə/","/bʊk/"], pos:"习语·介宾短语", meaning:"按规矩、一丝不苟"}
    ],
    explanations: [
      "**by the book** 按规矩办事：照章办事。book = 法规手册/工作手册。",
      "近义：by the rules / strictly. 反义：off the cuff（即兴）。例：The auditor runs everything by the book."
    ]
  },
  {
    sentence: "Go easy on the salt — I'm on a diet.",
    cid: fnv8("Go easy on the salt — I'm on a diet."),
    translation: "盐少放点——我在减肥。",
    chunks: ["Go easy on","the salt — I'm on a diet."],
    hints: ["对……温和点","我在节食"],
    grammar: [
      {role:"温和习语", color:"#7c5cbf", phonetic:["/ɡoʊ/","/ˈiːzi/","/ɑːn/"], pos:"习语·动词短语", meaning:"对...温和/手下留情"},
      {role:"宾语从句", color:"#c87033", phonetic:["/ðə/","/sɔːlt/","/aɪm/","/ɑːn/","/ə/","/ˈdaɪət/"], pos:"主系表", meaning:"盐...我在节食"}
    ],
    explanations: [
      "**Go easy on** 对...温和/手下留情/少放。可接人：Go easy on him (he's new). 也可接物：Go easy on the criticism.",
      "近义：take it easy on / be gentle with. 例：Go easy on the spicy sauce — I can't handle heat."
    ]
  },
  {
    sentence: "I can't get used to waking up early.",
    cid: fnv8("I can't get used to waking up early."),
    translation: "我还没习惯早起。",
    chunks: ["I can't get used to","waking up early."],
    hints: ["习惯于","早起"],
    grammar: [
      {role:"习惯习语", color:"#7c5cbf", phonetic:["/ɡet/","/juːst/","/tuː/"], pos:"习语·短语动词", meaning:"习惯于"},
      {role:"动宾状语", color:"#c87033", phonetic:["/ˈweɪkɪŋ/","/ʌp/","/ˈɜːrli/"], pos:"动名词短语", meaning:"在早间醒来"}
    ],
    explanations: [
      "**get used to** 习惯于（过程：从不习惯 → 习惯）。完成式可用：I'm getting used to it.",
      "对比：be used to = 已习惯。例：I'm used to eating spicy food now. 反义：can't stand."
    ]
  },
  {
    sentence: "Keep it up — you're doing great.",
    cid: fnv8("Keep it up — you're doing great."),
    translation: "保持下去——你做得很好。",
    chunks: ["Keep it up —","you're doing great."],
    hints: ["保持现状","你很棒"],
    grammar: [
      {role:"鼓励习语", color:"#7c5cbf", phonetic:["/kiːp/","/ɪt/","/ʌp/"], pos:"习语·短语动词", meaning:"保持、不要停"},
      {role:"主系状", color:"#c87033", phonetic:["/jʊr/","/ˈduːɪŋ/","/ɡreɪt/"], pos:"现在进行+表语", meaning:"你做得真棒"}
    ],
    explanations: [
      "**Keep it up** 鼓励坚持：保持下去。it = 当前表现/进度。",
      "用于学习、锻炼、减肥，鼓励场景。也用于讽刺：Keep it up and you'll fail.（讽刺用法）"
    ]
  },
  {
    sentence: "No big deal — I'll fix it later.",
    cid: fnv8("No big deal — I'll fix it later."),
    translation: "没什么大不了——我待会儿修一下。",
    chunks: ["No big deal —","I'll fix it later."],
    hints: ["小事","稍后修"],
    grammar: [
      {role:"轻描习语", color:"#7c5cbf", phonetic:["/noʊ/","/bɪɡ/","/diːl/"], pos:"习语·名词短语", meaning:"没什么大不了"},
      {role:"主谓宾状", color:"#c87033", phonetic:["/aɪl/","/fɪks/","/ɪt/","/ˈleɪtər/"], pos:"将来时+时间状语", meaning:"我稍后再修"}
    ],
    explanations: [
      "**No big deal** 轻描淡写：没什么大不了、别在意。回应道歉或感谢时常用：— Sorry for the mess. — No big deal.",
      "近义：No worries / It's nothing / Don't mention it. 例：It's no big deal — I can do it tomorrow."
    ]
  },
  {
    sentence: "Be there at three on the dot.",
    cid: fnv8("Be there at three on the dot."),
    translation: "三点整到那儿。",
    chunks: ["Be there at three","on the dot."],
    hints: ["三点整到","准时"],
    grammar: [
      {role:"主谓状", color:"#c87033", phonetic:["/biː/","/ðɛr/","/ət/","/θriː/"], pos:"介宾短语", meaning:"三点到那儿"},
      {role:"准时习语", color:"#7c5cbf", phonetic:["/ɑːn/","/ðə/","/dɑːt/"], pos:"习语·介宾", meaning:"正点、不早不晚"}
    ],
    explanations: [
      "**on the dot** 准时：正点。dot = 时钟的整点标志。",
      "近义：sharp / on time / precisely. 反义：fashionably late. 例：The train left at 9:00 on the dot."
    ]
  },
  {
    sentence: "Can I take a rain check on dinner?",
    cid: fnv8("Can I take a rain check on dinner?"),
    translation: "晚餐改天行吗？",
    chunks: ["Can I take a rain check","on dinner?"],
    hints: ["改天约","下次再说"],
    grammar: [
      {role:"改约习语", color:"#7c5cbf", phonetic:["/reɪn/","/tʃek/"], pos:"习语·名词短语", meaning:"改日票、改天再约"},
      {role:"介宾短语", color:"#c87033", phonetic:["/ɑːn/","/ˈdɪnər/"], pos:"介词+名词", meaning:"对晚餐"}
    ],
    explanations: [
      "**rain check** 字面「雨票」（棒球术语：雨天延赛换票），引申为「改天再约」。",
      "常在婉拒时：Can I take a rain check on that? Yes, of course, no problem. 也用于购物：May I get a rain check on the sale?"
    ]
  },
  {
    sentence: "Settle down, kids — it's bedtime.",
    cid: fnv8("Settle down, kids — it's bedtime."),
    translation: "孩子们，安静下来——该睡觉了。",
    chunks: ["Settle down, kids —","it's bedtime."],
    hints: ["让小孩安静","睡觉时间"],
    grammar: [
      {role:"安静习语", color:"#7c5cbf", phonetic:["/ˈsɛtl/","/daʊn/"], pos:"习语·短语动词", meaning:"平静下来"},
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/ˈbedˌtaɪm/"], pos:"主系表", meaning:"现在该睡觉"}
    ],
    explanations: [
      "**Settle down** ①平静下来 ②安顿下来（搬新家：settle down in a new city）。",
      "近义：calm down / cool down. 例：Settle down and focus! 反义：get excited."
    ]
  },
  {
    sentence: "Dinner's on me tonight — don't worry.",
    cid: fnv8("Dinner's on me tonight — don't worry."),
    translation: "今晚晚餐我请——别担心。",
    chunks: ["Dinner's on me tonight —","don't worry."],
    hints: ["我请客","不用担心"],
    grammar: [
      {role:"请客习语", color:"#7c5cbf", phonetic:["/ɑːn/","/miː/"], pos:"习语·介宾短语", meaning:"我请客、我来付"},
      {role:"祈使句", color:"#c87033", phonetic:["/doʊnt/","/ˈwɜːri/"], pos:"祈使句否定", meaning:"别担心"}
    ],
    explanations: [
      "**It's on me** 我请客、我来付（吃喝）。同义：My treat / I'm buying / This round is mine.",
      "近义派生：It's on the house（店家请客）。例：Drinks are on me tonight, guys!"
    ]
  },
  {
    sentence: "I was torn between the two offers.",
    cid: fnv8("I was torn between the two offers."),
    translation: "我在两个工作机会之间举棋不定。",
    chunks: ["I was torn","between the two offers."],
    hints: ["内心纠结","两个选择"],
    grammar: [
      {role:"犹豫习语", color:"#7c5cbf", phonetic:["/tɔːrn/"], pos:"习语·被动形容", meaning:"撕裂般犹豫"},
      {role:"介宾短语", color:"#c87033", phonetic:["/bɪˈtwiːn/","/ðə/","/tuː/","/ˈɔːfərz/"], pos:"介宾短语", meaning:"在两份 offer 之间"}
    ],
    explanations: [
      "**torn** (被动形容) 撕裂、纠结：纠结于多个选择。torn = 撕碎=难以两全。",
      "近义：torn between A and B / can't decide / on the fence. 例：I was torn between staying home and traveling."
    ]
  },
  {
    sentence: "I'm low key worried about the exam.",
    cid: fnv8("I'm low key worried about the exam."),
    translation: "我有点小担心这个考试。",
    chunks: ["I'm low key worried","about the exam."],
    hints: ["暗暗有点担心","对这个考试"],
    grammar: [
      {role:"低调习语", color:"#7c5cbf", phonetic:["/loʊ/","/kiː/"], pos:"习语·俚语副词", meaning:"暗暗地、有点"},
      {role:"主系表介", color:"#c87033", phonetic:["/aɪm/","/ˈwɜːrid/","/əˈbaʊt/","/ðiː/","/ɪɡˈzæm/"], pos:"主系表+介宾", meaning:"我为考试担心"}
    ],
    explanations: [
      "**low key** 俚语副词（来自密码 low-key = 隐藏级别），意「稍微、暗暗地」。",
      "例：I'm low key mad about it.（我有点生气）。作形容词：a low-key party（低调派对）。"
    ]
  },
  {
    sentence: "I sort of forgot what you said.",
    cid: fnv8("I sort of forgot what you said."),
    translation: "我有点忘记你说的了。",
    chunks: ["I sort of forgot","what you said."],
    hints: ["有点忘","你说的内容"],
    grammar: [
      {role:"模糊习语", color:"#7c5cbf", phonetic:["/sɔːrt/","/ʌv/"], pos:"习语·副词短语", meaning:"有点、算是"},
      {role:"主谓宾从", color:"#c87033", phonetic:["/aɪ/","/fərˈɡɑːt/","/wʌt/","/juː/","/sed/"], pos:"一般过去+宾从", meaning:"我忘了你说的"}
    ],
    explanations: [
      "**sort of** 模糊程度副词：有点、算是。弱化语调：I sort of like it.（我勉强喜欢）。",
      "近义：kind of / somewhat. 例：I sort of agree. 口语常省 /k/: I sorta forgot."
    ]
  },
  {
    sentence: "Too bad you couldn't make it.",
    cid: fnv8("Too bad you couldn't make it."),
    translation: "真可惜你来不了。",
    chunks: ["Too bad","you couldn't make it."],
    hints: ["可惜","无法出席"],
    grammar: [
      {role:"遗憾习语", color:"#7c5cbf", phonetic:["/tuː/","/bæd/"], pos:"习语·感叹", meaning:"太遗憾了、真可惜"},
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/ˈkʊdnt/","/meɪk/","/ɪt/"], pos:"情态动词过去否定", meaning:"你去不了"}
    ],
    explanations: [
      "**Too bad** 遗憾/同情：真可惜。比 pity / lament 轻；比 What a pity 短。",
      "近义：What a pity / That's a shame. 例：— I missed the show. — Too bad, it was great."
    ]
  },
  {
    sentence: "I said no, so there!",
    cid: fnv8("I said no, so there!"),
    translation: "我说不就不，就这么定了！",
    chunks: ["I said no,","so there!"],
    hints: ["我不愿意","就这样啦"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/sed/","/noʊ/"], pos:"一般过去时", meaning:"我说了不"},
      {role:"坚持习语", color:"#7c5cbf", phonetic:["/soʊ/","/ðɛr/"], pos:"习语·坚持", meaning:"就这么着！就这样！"}
    ],
    explanations: [
      "**So there** 强调坚持已说：就这么定了！多用于儿童/撒娇式坚持，成人可用作轻度挑衅/防御。",
      "例：I'm not going, so there. 近义：That's that / And that's final."
    ]
  },
  {
    sentence: "She thinks she's hot stuff.",
    cid: fnv8("She thinks she's hot stuff."),
    translation: "她觉得自己很了不起。",
    chunks: ["She thinks","she's hot stuff."],
    hints: ["她觉得","自己很牛"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/ʃiː/","/θɪŋks/"], pos:"一般现在", meaning:"她以为"},
      {role:"自负习语", color:"#7c5cbf", phonetic:["/ʃiːz/","/hɑːt/","/stʌf/"], pos:"习语·俚语名词", meaning:"了不起的人/物"}
    ],
    explanations: [
      "**hot stuff** 俚语名词：了不起的人物/热门货。原指炙手可热的事物，转喻自大的人。",
      "例：Look at him acting like hot stuff. 近义：big shot / hot shot. 通常带点不屑/讽刺。"
    ]
  },
  {
    sentence: "I'm good — I don't need help.",
    cid: fnv8("I'm good — I don't need help."),
    translation: "我没事——不需要帮忙。",
    chunks: ["I'm good —","I don't need help."],
    hints: ["我很好","不需要帮忙"],
    grammar: [
      {role:"自足习语", color:"#7c5cbf", phonetic:["/aɪm/","/ɡʊd/"], pos:"习语·状态形容", meaning:"我很好、不需要"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/doʊnt/","/niːd/","/help/"], pos:"否定陈述句", meaning:"我不需要帮忙"}
    ],
    explanations: [
      "**I'm good** 多义：①我很好②不需要（拒人邀请/服务）。在餐厅、酒吧回应「再来一杯？」:",
      "用 I'm good 替代 No thanks，避免尴尬。例：— Want another beer? — I'm good, thanks."
    ]
  },
  {
    sentence: "Let it go — it's not worth fighting.",
    cid: fnv8("Let it go — it's not worth fighting."),
    translation: "放下吧——不值得再吵。",
    chunks: ["Let it go —","it's not worth fighting."],
    hints: ["放弃执念","不值得争吵"],
    grammar: [
      {role:"放手习语", color:"#7c5cbf", phonetic:["/let/","/ɪt/","/ɡoʊ/"], pos:"习语·短语动词", meaning:"放手、放下"},
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/nɑːt/","/wɜːrθ/","/ˈfaɪtɪŋ/"], pos:"worth + 动名", meaning:"争吵不值得"}
    ],
    explanations: [
      "**Let it go** ①放手、放掉执着 ②不注意（没看到/没听到）。let it go 也是 Frozen 主题曲名。",
      "近义：forget it / move on / get over it. 例：Let it go — we can't change the past."
    ]
  },
  {
    sentence: "Own up — you broke the vase.",
    cid: fnv8("Own up — you broke the vase."),
    translation: "坦白承认吧——你打碎了花瓶。",
    chunks: ["Own up —","you broke the vase."],
    hints: ["主动承认","你打碎了花瓶"],
    grammar: [
      {role:"坦白习语", color:"#7c5cbf", phonetic:["/oʊn/","/ʌp/"], pos:"习语·短语动词", meaning:"坦白承认"},
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/broʊk/","/ðə/","/veɪs/"], pos:"一般过去时", meaning:"你打碎了花瓶"}
    ],
    explanations: [
      "**own up** 坦白承认错误：认账。常接 to：own up to it. 强调责任归属。",
      "近义：confess / admit / come clean. 例：Own up to your mistake. 反义：deny / lie."
    ]
  },
  {
    sentence: "My dad is an easy-going man.",
    cid: fnv8("My dad is an easy-going man."),
    translation: "我爸是个随和的人。",
    chunks: ["My dad is an","easy-going man."],
    hints: ["我爸是","随和的人"],
    grammar: [
      {role:"主系定冠", color:"#c87033", phonetic:["/maɪ/","/dæd/","/ɪz/","/ən/"], pos:"主系冠", meaning:"我爸是个"},
      {role:"性格习语", color:"#7c5cbf", phonetic:["/ˈiːzi/","/ˈɡoʊɪŋ/"], pos:"习语·复合形容", meaning:"随和、好相处"}
    ],
    explanations: [
      "**easy-going** 形容人随和、好相处。注意连字符：复合形容词。",
      "近义：laid-back / relaxed / mellow. 反义：uptight / high-strung. 例：Her boss is really easy-going."
    ]
  },
  {
    sentence: "Forgive me — I didn't mean to interrupt.",
    cid: fnv8("Forgive me — I didn't mean to interrupt."),
    translation: "对不起——我不是有意打断的。",
    chunks: ["Forgive me —","I didn't mean to interrupt."],
    hints: ["请原谅","无意打扰"],
    grammar: [
      {role:"道歉习语", color:"#7c5cbf", phonetic:["/fərˈɡɪv/","/miː/"], pos:"习语·正式", meaning:"请原谅我"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈdɪdnt/","/miːn/","/tʊ/","/ˌɪntəˈrʌpt/"], pos:"mean to do 否定过去", meaning:"我不是想打断"}
    ],
    explanations: [
      "**Forgive me** 比 I'm sorry 更正式：恕我无礼/请宽恕。常用于道歉、插话、问古怪问题前。",
      "注意时态：forgive 现在形表客气，一般过去 forgave 表真实原谅。例：Forgive my ignorance, but ..."
    ]
  },
  {
    sentence: "As I say, please pay attention.",
    cid: fnv8("As I say, please pay attention."),
    translation: "依我说的话，请注意听。",
    chunks: ["As I say,","please pay attention."],
    hints: ["按我说的话","请注意"],
    grammar: [
      {role:"援引习语", color:"#7c5cbf", phonetic:["/æz/","/aɪ/","/seɪ/"], pos:"习语·方式状从", meaning:"照我说的、依我"},
      {role:"祈使句", color:"#c87033", phonetic:["/pliːz/","/peɪ/","/əˈtenʃən/"], pos:"祈使句", meaning:"请注意"}
    ],
    explanations: [
      "**As I say** 援引自己先前的话：照我说。引介方式状语。",
      "对比：As I said = 过去（已说过）。例：As I say, focus on the basics. 也用于复议：As I say before, ..."
    ]
  },
  {
    sentence: "No comment on the lawsuit.",
    cid: fnv8("No comment on the lawsuit."),
    translation: "对这场诉讼无可奉告。",
    chunks: ["No comment","on the lawsuit."],
    hints: ["无可奉告","关于诉讼"],
    grammar: [
      {role:"拒答习语", color:"#7c5cbf", phonetic:["/noʊ/","/ˈkɑːment/"], pos:"习语·名词短语", meaning:"无可奉告"},
      {role:"介宾短语", color:"#c87033", phonetic:["/ɑːn/","/ðə/","/ˈlɔːsuːt/"], pos:"介词+名词", meaning:"关于这场诉讼"}
    ],
    explanations: [
      "**No comment** 媒体/官方常用答：无可奉告。拒绝表态时的礼貌挡箭牌。",
      "例：— Are you planning to resign? — No comment. 近义：I'll say no more / That's all I'll say."
    ]
  },
  {
    sentence: "Please see to it that the door is locked.",
    cid: fnv8("Please see to it that the door is locked."),
    translation: "请确保门已上锁。",
    chunks: ["Please see to it","that the door is locked."],
    hints: ["确保","门已上锁"],
    grammar: [
      {role:"照料习语", color:"#7c5cbf", phonetic:["/siː/","/tuː/","/ɪt/"], pos:"习语·动宾短语", meaning:"确保、照料"},
      {role:"宾语从句", color:"#c87033", phonetic:["/ðæt/","/ðə/","/dɔːr/","/ɪz/","/lɑːkt/"], pos:"that 从句", meaning:"门已上锁"}
    ],
    explanations: [
      "**see to it that** 确保、留意办理。书面语；see to = 处理、照料。",
      "近义：make sure / ensure. 例：See to it that the patient gets his pills. 反义：neglect."
    ]
  },
  {
    sentence: "That's well put — I agree.",
    cid: fnv8("That's well put — I agree."),
    translation: "说得精辟——我同意。",
    chunks: ["That's well put —","I agree."],
    hints: ["说得好","我同意"],
    grammar: [
      {role:"称赞习语", color:"#7c5cbf", phonetic:["/wel/","/pʊt/"], pos:"习语·过去分词短语", meaning:"说得好、措辞精准"},
      {role:"主谓宾", color:"#c87033", phonetic:["/ðæts/","/aɪ/","/əˈɡriː/"], pos:"主谓", meaning:"我同意"}
    ],
    explanations: [
      "**well put** 称赞表达：说得好、措辞精准。put = 表达、措辞。",
      "例：— He's not honest, just opportunistic. — Well put. 近义：well said / well put indeed."
    ]
  },
  {
    sentence: "I never want to see you again — drop dead!",
    cid: fnv8("I never want to see you again — drop dead!"),
    translation: "我再也不想见到你——去死吧！",
    chunks: ["I never want to see you again —","drop dead!"],
    hints: ["我再也不想见你","去死吧！"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈnevər/","/wɑːnt/","/siː/","/juː/","/əˈɡen/"], pos:"否定陈述句", meaning:"我再也不想见你"},
      {role:"咒骂习语", color:"#7c5cbf", phonetic:["/drɑːp/","/ded/"], pos:"习语·命令粗鲁", meaning:"去死"}
    ],
    explanations: [
      "**Drop dead** 极端咒骂：去死吧！极端不满/厌恶。注意：儿童/陌生人禁用，太粗鲁。",
      "近义（较轻）：Get lost. 例：— Can you lend me $1000? — Drop dead!"
    ]
  }
,
  {
    sentence: "I broke your cup by accident — my bad.",
    cid: fnv8("I broke your cup by accident — my bad."),
    translation: "我不小心打碎你的杯子，是我的错。",
    chunks: ["I broke your cup by accident —","my bad."],
    hints: ["我不小心打碎你的杯子","我错了（口语认错）"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/broʊk/","/jʊr/","/kʌp/","/baɪ/","/ˈæksɪdənt/"], pos:"过去时陈述", meaning:"我不小心打碎了你的杯子"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/maɪ/","/bæd/"], pos:"习语·道歉", meaning:"是我的错（口语，比 I'm sorry 更随意）"}
    ],
    explanations: [
      "**my bad** 是非常口语的认错方式，等于 It's my fault，但更轻快。同龄人/熟人间用，正式场合别用。",
      "近义：my fault / I'm sorry / that's on me（责任在我）。例句：Sorry, my bad — I sent it to the wrong person."
    ]
  },
  {
    sentence: "Stop picking on him — he's half your size.",
    cid: fnv8("Stop picking on him — he's half your size."),
    translation: "别欺负他了，他个头才你一半。",
    chunks: ["Stop picking on him —","he's half your size."],
    hints: ["别再欺负他了","他个头只有你一半"],
    grammar: [
      {role:"祈使句+短语动词", color:"#c87033", phonetic:["/stɑːp/","/ˈpɪkɪŋ/","/ɑːn/","/hɪm/"], pos:"祈使句·短语动词", meaning:"别再欺负他"},
      {role:"主系表", color:"#e74c7a", phonetic:["/hiːz/","/hæf/","/jʊr/","/saɪz/"], pos:"比较表达", meaning:"他只有你一半个头"}
    ],
    explanations: [
      "**pick on** 指「专挑某个人欺负/找茬」，有针对性，比 bully 轻但仍是负向。反义：stand up for（护着某人）。",
      "辨析：pick at 是「挑剔/小口吃」，pick on 是「欺负」。例句：The boss always picks on the new guy."
    ]
  },
  {
    sentence: "We sat by the lake and soaked up the sunshine.",
    cid: fnv8("We sat by the lake and soaked up the sunshine."),
    translation: "我们坐在湖边尽情享受阳光。",
    chunks: ["We sat by the lake and","soaked up","the sunshine."],
    hints: ["我们坐在湖边","尽情享受","阳光"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/wiː/","/sæt/","/baɪ/","/ðə/","/leɪk/","/ænd/"], pos:"过去时陈述", meaning:"我们坐在湖边"},
      {role:"短语动词", color:"#7c5cbf", phonetic:["/soʊkt/","/ʌp/"], pos:"短语动词·吸收", meaning:"尽情享受（阳光）"},
      {role:"宾语", color:"#3358e0", phonetic:["/ðə/","/ˈsʌnʃaɪn/"], pos:"名词短语", meaning:"阳光"}
    ],
    explanations: [
      "**soak up** 本义「吸收（液体）」，引申为尽情享受（阳光/氛围/知识）：soak up the atmosphere / soak up knowledge。",
      "近义：take in / bask in。例句：I love soaking up the café vibe on weekend mornings."
    ]
  },
  {
    sentence: "Don't pass up this chance to study abroad.",
    cid: fnv8("Don't pass up this chance to study abroad."),
    translation: "别错过这个出国留学的机会。",
    chunks: ["Don't pass up","this chance to study abroad."],
    hints: ["不要错过","这个出国留学的机会"],
    grammar: [
      {role:"祈使句+短语动词", color:"#7c5cbf", phonetic:["/doʊnt/","/pæs/","/ʌp/"], pos:"祈使句·短语动词", meaning:"别放过/别错过"},
      {role:"宾语", color:"#3358e0", phonetic:["/ðɪs/","/tʃæns/","/tə/","/ˈstʌdi/","/əˈbrɔːd/"], pos:"名词短语+不定式", meaning:"出国留学的机会"}
    ],
    explanations: [
      "**pass up** 是「放弃（难得的机会/好事）」，通常带惋惜感。常用于劝人：Don't pass up…/ You'd be crazy to pass that up。",
      "近义：turn down（拒绝）/ miss out on（错过）。反义：seize the opportunity。例句：She passed up a great job offer to stay with her family."
    ]
  },
  {
    sentence: "\"Can you help me move this box?\" — \"You bet!\"",
    cid: fnv8("\"Can you help me move this box?\" — \"You bet!\""),
    translation: "能帮我搬这个箱子吗？当然可以！",
    chunks: ["\"Can you help me move this box?\" —","\"You bet!\""],
    hints: ["能帮我搬这个箱子吗","当然可以（爽快答应）"],
    grammar: [
      {role:"问句引用", color:"#c87033", phonetic:["/kæn/","/juː/","/help/","/miː/","/muːv/","/ðɪs/","/bɑːks/"], pos:"一般疑问句", meaning:"你能帮我搬这个箱子吗"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/juː/","/bet/"], pos:"习语·爽快答应", meaning:"当然啦！没问题"}
    ],
    explanations: [
      "**You bet!** 表示「当然！没问题！」，比 sure 更有热情。来自打赌引申的「你尽管放心」，熟人客套都合适。",
      "近义：Absolutely! / Of course! / You betcha（更随意的变体）。例句：— Thanks for the ride! — You bet!"
    ]
  },
  {
    sentence: "It's been a year — time to move on.",
    cid: fnv8("It's been a year — time to move on."),
    translation: "都一年了，该往前看了。",
    chunks: ["It's been a year —","time to move on."],
    hints: ["已经一年了","是时候向前看了"],
    grammar: [
      {role:"现在完成时", color:"#c87033", phonetic:["/ɪts/","/bɪn/","/ə/","/jɪr/"], pos:"现在完成时", meaning:"已经过了一年了"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/taɪm/","/tə/","/muːv/","/ɑːn/"], pos:"习语·走出过去", meaning:"该翻篇、向前看了"}
    ],
    explanations: [
      "**move on** 指「放下过去、继续前行」，用于分手/离职/失败后的劝慰。也可字面义「继续走/继续做下一件事」。",
      "常见搭配：move on to something（接着做某事）。例句：Stop dwelling on the past and move on with your life."
    ]
  },
  {
    sentence: "Before you quit, step back and think it over.",
    cid: fnv8("Before you quit, step back and think it over."),
    translation: "辞职之前退一步，好好想想。",
    chunks: ["Before you quit,","step back and think it over."],
    hints: ["在你辞职之前","退一步、再想想"],
    grammar: [
      {role:"时间状语从句", color:"#c87033", phonetic:["/bɪˈfɔːr/","/juː/","/kwɪt/"], pos:"时间状语从句", meaning:"在你辞职之前"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/step/","/bæk/","/ænd/","/θɪŋk/","/ɪt/","/ˈoʊvər/"], pos:"习语·冷静思考", meaning:"退一步冷静、好好考虑"}
    ],
    explanations: [
      "**step back** 从字面「往后退一步」引申为「抽离当下、换个视角冷静看」，常用于情绪上头时的建议。",
      "近义：take a step back / look at the big picture。例句：Sometimes you need to step back to see the whole problem."
    ]
  },
  {
    sentence: "You fixed it in five minutes — nice going!",
    cid: fnv8("You fixed it in five minutes — nice going!"),
    translation: "你五分钟就修好了，干得漂亮！",
    chunks: ["You fixed it in five minutes —","nice going!"],
    hints: ["你五分钟就修好了","干得漂亮（称赞）"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/fɪkst/","/ɪt/","/ɪn/","/faɪv/","/ˈmɪnɪts/"], pos:"过去时陈述", meaning:"你五分钟就修好了它"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/naɪs/","/ˈɡoʊɪŋ/"], pos:"习语·称赞", meaning:"干得漂亮"}
    ],
    explanations: [
      "**nice going** 是口语称赞「干得好/漂亮」，口语感强。也可反讽（对方搞砸时阴阳怪气地说 nice going）。",
      "近义：well done / good job / way to go。例句：Nice going! You solved the puzzle in no time."
    ]
  },
  {
    sentence: "Patience isn't my strong suit, I admit.",
    cid: fnv8("Patience isn't my strong suit, I admit."),
    translation: "我承认耐心不是我的强项。",
    chunks: ["Patience isn't","my strong suit,","I admit."],
    hints: ["耐心不是","我的强项","我承认"],
    grammar: [
      {role:"主语", color:"#3358e0", phonetic:["/ˈpeɪʃəns/","/ˈɪznt/"], pos:"否定主系表", meaning:"耐心不是"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/maɪ/","/strɔːŋ/","/suːt/"], pos:"习语·擅长领域", meaning:"我的强项/擅长的事"},
      {role:"插入句", color:"#c87033", phonetic:["/aɪ/","/ədˈmɪt/"], pos:"插入语", meaning:"我承认"}
    ],
    explanations: [
      "**strong suit** 源自牌戏「一手强牌」，引申为「某人最擅长的领域/技能」。句型：…isn't my strong suit = 我不擅长…。",
      "反义：weak point / Achilles' heel（致命弱点）。例句：Small talk is not my strong suit, but I try."
    ]
  },
  {
    sentence: "Don't worry — these things happen, it happens to everyone.",
    cid: fnv8("Don't worry — these things happen, it happens to everyone."),
    translation: "别担心，这种事难免，谁都会碰上。",
    chunks: ["Don't worry — these things happen,","it happens","to everyone."],
    hints: ["别担心，这种事难免","常有的事","对每个人"],
    grammar: [
      {role:"祈使句+陈述", color:"#c87033", phonetic:["/doʊnt/","/ˈwɜːri/","/ðiːz/","/θɪŋz/","/ˈhæpən/"], pos:"祈使句", meaning:"别担心，这种事难免"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/ɪt/","/ˈhæpənz/"], pos:"习语·宽慰", meaning:"常有的事，难免"},
      {role:"状语", color:"#3358e0", phonetic:["/tə/","/ˈevriwʌn/"], pos:"介词短语", meaning:"发生在每个人身上"}
    ],
    explanations: [
      "**it happens** 是宽慰他人的万能句，意思是「这种事难免/正常」，劝人别自责别尴尬。",
      "用法场景：对方迟到/犯错/出糗时说一句 It happens，气氛立刻松下来。例句：I spilled coffee on my shirt again — it happens."
    ]
  },
  {
    sentence: "I've been feeling down since I lost my job.",
    cid: fnv8("I've been feeling down since I lost my job."),
    translation: "丢了工作以后我一直情绪低落。",
    chunks: ["I've been feeling down","since I lost my job."],
    hints: ["我一直情绪低落","自从我丢了工作"],
    grammar: [
      {role:"现在完成进行时", color:"#c87033", phonetic:["/aɪv/","/bɪn/","/ˈfiːlɪŋ/","/daʊn/"], pos:"现在完成进行时", meaning:"我一直情绪低落"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/sɪns/","/aɪ/","/lɔːst/","/maɪ/","/dʒɑːb/"], pos:"时间状语从句", meaning:"自从我丢了工作以来"}
    ],
    explanations: [
      "**feel down** 表示情绪低落、提不起劲，比 sad 更日常口语。程度深可说 feel really down / down in the dumps。",
      "近义：feel blue / be in low spirits。例句：She's been down all week — let's cheer her up."
    ]
  },
  {
    sentence: "I'd rather go alone, but suit yourself.",
    cid: fnv8("I'd rather go alone, but suit yourself."),
    translation: "我宁可自己去，不过你随意。",
    chunks: ["I'd rather go alone,","but suit yourself."],
    hints: ["我宁可自己去","不过随你便"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪd/","/ˈræðər/","/ɡoʊ/","/əˈloʊn/"], pos:"would rather 句型", meaning:"我宁可独自去"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/bʌt/","/suːt/","/jɔːrˈself/"], pos:"习语·不强求", meaning:"随你便，你看着办"}
    ],
    explanations: [
      "**suit yourself** 有两面语气：中性「随你意，我不勉强」，也常带轻微不满（对方不听劝时的「随你吧」）。",
      "例句：— I'll wear this shirt even if it's ugly. — Fine, suit yourself."
    ]
  },
  {
    sentence: "That's enough TV for tonight — go to bed.",
    cid: fnv8("That's enough TV for tonight — go to bed."),
    translation: "今晚电视看到这就够了，去睡觉。",
    chunks: ["That's enough","TV for tonight —","go to bed."],
    hints: ["这就够了","今晚的电视","去睡觉"],
    grammar: [
      {role:"口语习语", color:"#7c5cbf", phonetic:["/ðæts/","/ɪˈnʌf/"], pos:"习语·制止", meaning:"够了，到此为止"},
      {role:"名词短语", color:"#3358e0", phonetic:["/ˌtiːˈviː/","/fər/","/təˈnaɪt/"], pos:"名词短语", meaning:"今晚的电视"},
      {role:"祈使句", color:"#c87033", phonetic:["/ɡoʊ/","/tə/","/bed/"], pos:"祈使句", meaning:"去睡觉"}
    ],
    explanations: [
      "**that's enough** 是制止语「够了/到此为止」，父母制止孩子、或人忍无可忍时都用，语气随重音可柔可硬。",
      "近义：enough is enough（受够了）/ cut it out（别闹了）。例句：That's enough complaining for one day!"
    ]
  },
  {
    sentence: "I almost agreed, but on second thought I declined.",
    cid: fnv8("I almost agreed, but on second thought I declined."),
    translation: "我差点就答应了，但转念一想又回绝了。",
    chunks: ["I almost agreed,","but on second thought","I declined."],
    hints: ["我差点就答应了","但转念一想","我回绝了"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/ˈɔːlmoʊst/","/əˈɡriːd/"], pos:"过去时陈述", meaning:"我几乎同意了"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/bʌt/","/ɑːn/","/ˈsekənd/","/θɔːt/"], pos:"习语·改变主意", meaning:"但转念一想"},
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/dɪˈklaɪnd/"], pos:"过去时陈述", meaning:"我拒绝了"}
    ],
    explanations: [
      "**on second thought** 表示「再一想、改变主意」，常单独成句或放句首，口语标志性表达。美式拼作 on second thought，英式 second thoughts。",
      "例句：I'll have coffee — actually, on second thought, make it tea."
    ]
  },
  {
    sentence: "She's been seeing someone from work for months.",
    cid: fnv8("She's been seeing someone from work for months."),
    translation: "她跟一个同事交往好几个月了。",
    chunks: ["She's been","seeing someone","from work for months."],
    hints: ["她一直","在和某人交往","来自同事、好几个月了"],
    grammar: [
      {role:"现在完成进行时", color:"#c87033", phonetic:["/ʃiːz/","/bɪn/"], pos:"现在完成进行时助动", meaning:"她一直在"},
      {role:"习语·动词短语", color:"#7c5cbf", phonetic:["/ˈsiːɪŋ/","/ˈsʌmwʌn/"], pos:"习语·约会交往", meaning:"和某人约会/交往"},
      {role:"状语", color:"#3358e0", phonetic:["/frəm/","/wɜːrk/","/fər/","/mʌnθs/"], pos:"介词短语", meaning:"与同事、持续数月"}
    ],
    explanations: [
      "**seeing someone** 是「与某人交往中」的委婉说法，比 dating 更口语低调。问别人感情状态常说：Are you seeing anyone?",
      "近义：dating / going out with。例句：I heard she's seeing a guy from the marketing team."
    ]
  },
  {
    sentence: "Stop fooling around and finish your homework.",
    cid: fnv8("Stop fooling around and finish your homework."),
    translation: "别瞎闹了，把作业写完。",
    chunks: ["Stop fooling around","and finish your homework."],
    hints: ["别再瞎胡闹","把作业写完"],
    grammar: [
      {role:"祈使句+习语", color:"#7c5cbf", phonetic:["/stɑːp/","/ˈfuːlɪŋ/","/əˈraʊnd/"], pos:"习语·浪费时间", meaning:"别瞎胡闹/别浪费时间"},
      {role:"祈使句", color:"#c87033", phonetic:["/ænd/","/ˈfɪnɪʃ/","/jʊr/","/ˈhoʊmwɜːrk/"], pos:"祈使句", meaning:"把作业做完"}
    ],
    explanations: [
      "**fool around** 指「瞎闹、不干正事」，家长老师高频用。也委婉指「（背地里）乱搞男女关系」，后者看语境。",
      "近义：mess around / goof off。例句：We fooled around all afternoon instead of studying."
    ]
  },
  {
    sentence: "That magic trick was really something — how did you do it?",
    cid: fnv8("That magic trick was really something — how did you do it?"),
    translation: "这个魔术真有两下子，你是怎么做到的？",
    chunks: ["That magic trick was really something —","how did you do it?"],
    hints: ["这个魔术真了不起","你是怎么做到的"],
    grammar: [
      {role:"主系表+习语", color:"#7c5cbf", phonetic:["/ðæt/","/ˈmædʒɪk/","/trɪk/","/wʌz/","/ˈriːəli/","/ˈsʌmθɪŋ/"], pos:"习语·赞叹", meaning:"那个魔术真了不起"},
      {role:"特殊疑问句", color:"#c87033", phonetic:["/haʊ/","/dɪd/","/juː/","/duː/","/ɪt/"], pos:"过去时疑问", meaning:"你是怎么做到的"}
    ],
    explanations: [
      "**really something** 表示「真了不起、有两下子」，口语赞叹。反义结构：not much of a…（算不上…）。",
      "例句：That new restaurant is really something — the dessert alone is worth it."
    ]
  },
  {
    sentence: "At forty she's no spring chicken, but she runs every day.",
    cid: fnv8("At forty she's no spring chicken, but she runs every day."),
    translation: "她四十了不算年轻，但每天都跑步。",
    chunks: ["At forty she's no spring chicken,","but she runs every day."],
    hints: ["她四十岁不算年轻了","但她每天都跑步"],
    grammar: [
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/æt/","/ˈfɔːrti/","/ʃiːz/","/noʊ/","/sprɪŋ/","/ˈtʃɪkɪn/"], pos:"习语·否定年轻", meaning:"四十岁已不年轻"},
      {role:"转折并列", color:"#c87033", phonetic:["/bʌt/","/ʃiː/","/rʌnz/","/ˈevri/","/deɪ/"], pos:"转折并列句", meaning:"但她每天跑步"}
    ],
    explanations: [
      "**no spring chicken** 幽默地说「不年轻了」，多用于自嘲或善意调侃，注意别对长辈冒犯使用。",
      "例句：He may be no spring chicken, but he can still hike ten miles."
    ]
  },
  {
    sentence: "Sleep on it and tell me your decision tomorrow.",
    cid: fnv8("Sleep on it and tell me your decision tomorrow."),
    translation: "你先考虑一晚上，明天告诉我决定。",
    chunks: ["Sleep on it","and tell me your decision tomorrow."],
    hints: ["考虑一晚上再定","明天告诉我你的决定"],
    grammar: [
      {role:"习语·动词短语", color:"#7c5cbf", phonetic:["/sliːp/","/ɑːn/","/ɪt/"], pos:"习语·慎重考虑", meaning:"睡一觉再决定（缓一缓）"},
      {role:"祈使句", color:"#c87033", phonetic:["/ænd/","/tel/","/miː/","/jʊr/","/dɪˈsɪʒən/","/təˈmɑːroʊ/"], pos:"祈使句", meaning:"明天告诉我你的决定"}
    ],
    explanations: [
      "**sleep on it** 劝人别急着拍板，先过一夜冷静想。销售/谈判/大额消费场景高频。",
      "例句：It's a big loan — why don't you sleep on it and call me tomorrow?"
    ]
  },
  {
    sentence: "The surprise party you threw really made my day.",
    cid: fnv8("The surprise party you threw really made my day."),
    translation: "你给我办的惊喜派对让我开心了一整天。",
    chunks: ["The surprise party you threw","really made my day."],
    hints: ["你办的惊喜派对","真让我开心一整天"],
    grammar: [
      {role:"定语从句主语", color:"#c87033", phonetic:["/ðə/","/sərˈpraɪz/","/ˈpɑːrti/","/juː/","/θruː/"], pos:"省略关系词定语从句", meaning:"你举办的惊喜派对"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ˈriːəli/","/meɪd/","/maɪ/","/deɪ/"], pos:"习语·让人开心", meaning:"让我一整天都开心"}
    ],
    explanations: [
      "**make my day** 直译「成就了我的一天」，即「让我特别开心/值了」。对方做了暖心小事后的最佳回应。",
      "经典梗：克林特·伊斯特伍德电影台词 Go ahead, make my day。例句：A coffee from you always makes my day."
    ]
  },
  {
    sentence: "His joke about her weight was way out of line.",
    cid: fnv8("His joke about her weight was way out of line."),
    translation: "他拿她体重开玩笑，太过分了。",
    chunks: ["His joke about her weight","was way out of line."],
    hints: ["他关于她体重的玩笑","实在太出格了"],
    grammar: [
      {role:"主语", color:"#c87033", phonetic:["/hɪz/","/dʒoʊk/","/əˈbaʊt/","/hɜːr/","/weɪt/"], pos:"名词短语", meaning:"他拿她体重开的玩笑"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/wʌz/","/weɪ/","/aʊt/","/əv/","/laɪn/"], pos:"习语·越界出格", meaning:"太过分、越界了"}
    ],
    explanations: [
      "**out of line** 指言行「越界、出格、不合规矩」，批评别人的冒犯言行时用。way 是强调词，意为「太出格了」。",
      "近义：cross the line / out of order。例句：That comment was out of line — you owe her an apology."
    ]
  },
  {
    sentence: "We'd better hit the road before the traffic gets bad.",
    cid: fnv8("We'd better hit the road before the traffic gets bad."),
    translation: "趁还没堵车，我们最好出发了。",
    chunks: ["We'd better hit the road","before the traffic gets bad."],
    hints: ["我们最好出发上路","趁交通还没变糟"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/wiːd/","/ˈbetər/","/hɪt/","/ðə/","/roʊd/"], pos:"习语·出发上路", meaning:"我们最好出发了"},
      {role:"时间状语从句", color:"#c87033", phonetic:["/bɪˈfɔːr/","/ðə/","/ˈtræfɪk/","/ɡets/","/bæd/"], pos:"时间状语从句", meaning:"趁交通还没变差"}
    ],
    explanations: [
      "**hit the road** 口语「出发、上路」，road trip 出发前必说。近义 hit the sack 则是「上床睡觉」。",
      "例句：Let's hit the road at six to beat the morning rush."
    ]
  },
  {
    sentence: "Knock it off, you two — I'm trying to study.",
    cid: fnv8("Knock it off, you two — I'm trying to study."),
    translation: "你俩别闹了，我要学习。",
    chunks: ["Knock it off, you two —","I'm trying to study."],
    hints: ["你们俩别闹了","我要学习"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/nɑːk/","/ɪt/","/ɔːf/","/juː/","/tuː/"], pos:"习语·让人停止", meaning:"你俩别闹了"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪm/","/ˈtraɪɪŋ/","/tə/","/ˈstʌdi/"], pos:"现在进行时", meaning:"我正在学习"}
    ],
    explanations: [
      "**knock it off** 是呵斥「别闹了/停下来」，比 stop it 更强硬直接，老师制止打闹的孩子常用。",
      "近义：cut it out / quit it。例句：Knock it off with the drumming — it's midnight!"
    ]
  },
  {
    sentence: "You passed the interview — good for you!",
    cid: fnv8("You passed the interview — good for you!"),
    translation: "你通过面试了，真为你高兴！",
    chunks: ["You passed the interview —","good for you!"],
    hints: ["你通过了面试","真为你高兴（祝贺）"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/pæst/","/ðiː/","/ˈɪntərˈvjuː/"], pos:"过去时陈述", meaning:"你通过了面试"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/ɡʊd/","/fər/","/juː/"], pos:"习语·祝贺", meaning:"真为你高兴"}
    ],
    explanations: [
      "**good for you** 祝贺对方的好消息：「真棒/为你高兴」。注意语气真诚时说祝贺，阴阳怪气时是讽刺，全靠语调。",
      "例句：— I finally quit smoking. — Good for you, that's not easy!"
    ]
  },
  {
    sentence: "Feel free to ask questions — by all means interrupt me.",
    cid: fnv8("Feel free to ask questions — by all means interrupt me."),
    translation: "有问题尽管问，随时打断我都可以。",
    chunks: ["Feel free to ask questions —","by all means","interrupt me."],
    hints: ["有问题尽管问","当然可以/尽管","打断我"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/fiːl/","/friː/","/tə/","/æsk/","/ˈkwestʃənz/"], pos:"祈使句·别拘束", meaning:"有问题尽管问"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/baɪ/","/ɔːl/","/miːnz/"], pos:"习语·务必尽管", meaning:"完全可以，尽管"},
      {role:"谓语+宾语", color:"#3358e0", phonetic:["/ˌɪntəˈrʌpt/","/miː/"], pos:"祈使句谓语", meaning:"打断我"}
    ],
    explanations: [
      "**by all means** 强化允许：「当然可以、尽管来」，比 sure 更恳切正式，也可回答请求：— May I sit here? — By all means!",
      "反义：by no means（绝不）。例句：By all means, take your time reading the contract."
    ]
  },
  {
    sentence: "The concert was sold out — we got in by the skin of our teeth.",
    cid: fnv8("The concert was sold out — we got in by the skin of our teeth."),
    translation: "演唱会票卖光了，我们险险挤了进去。",
    chunks: ["The concert was sold out —","we got in","by the skin of our teeth."],
    hints: ["演唱会已售罄","我们进去了","侥幸万分/千钧一发"],
    grammar: [
      {role:"被动语态", color:"#c87033", phonetic:["/ðə/","/ˈkɑːnsərt/","/wʌz/","/soʊld/","/aʊt/"], pos:"过去时被动", meaning:"演唱会票卖光了"},
      {role:"主谓", color:"#3358e0", phonetic:["/wiː/","/ɡɑːt/","/ɪn/"], pos:"过去时短语动词", meaning:"我们进去了"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/baɪ/","/ðə/","/skɪn/","/əv/","/aʊər/","/tiːθ/"], pos:"习语·侥幸万分", meaning:"千钧一发、差一点就错过"}
    ],
    explanations: [
      "**by the skin of one's teeth** 形象表达「侥幸脱险/勉强赶上」，像只剩牙皮那点距离。考试低空飞过、赶车最后一秒都适用。",
      "例句：I caught my flight by the skin of my teeth — the gate was already closing."
    ]
  }
,
  {
    sentence: "Don't worry — I've got your back no matter what.",
    cid: fnv8("Don't worry — I've got your back no matter what."),
    translation: "别担心，不管怎样我都挺你。",
    chunks: ["Don't worry —","I've got your back","no matter what."],
    hints: ["别担心","我挺你/罩着你","不管发生什么"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/doʊnt/","/ˈwɜːri/"], pos:"祈使句", meaning:"别担心"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪv/","/ɡɑːt/","/jʊr/","/bæk/"], pos:"习语·支持保护", meaning:"我支持你、护着你"},
      {role:"让步状语", color:"#3358e0", phonetic:["/noʊ/","/ˈmætər/","/wʌt/"], pos:"让步状语", meaning:"无论发生什么"}
    ],
    explanations: [
      "**have got someone's back** 形象表达「我罩着你/挺你」，出事时站在你这边。朋友间的定心丸。",
      "近义：stand by someone / back someone up。例句：Whatever happens in the meeting, I've got your back."
    ]
  },
  {
    sentence: "Whenever I'm in trouble, I turn to my best friend.",
    cid: fnv8("Whenever I'm in trouble, I turn to my best friend."),
    translation: "一有麻烦，我就会向最好的朋友求助。",
    chunks: ["Whenever I'm in trouble,","I turn to","my best friend."],
    hints: ["每当我有麻烦时","我求助","我最好的朋友"],
    grammar: [
      {role:"时间状语从句", color:"#c87033", phonetic:["/wenˈevər/","/aɪm/","/ɪn/","/ˈtrʌbl/"], pos:"时间状语从句", meaning:"每当我遇到麻烦"},
      {role:"短语动词", color:"#7c5cbf", phonetic:["/aɪ/","/tɜːrn/","/tə/"], pos:"短语动词·求助", meaning:"我求助于/转向"},
      {role:"宾语", color:"#3358e0", phonetic:["/maɪ/","/best/","/frend/"], pos:"名词短语", meaning:"我最好的朋友"}
    ],
    explanations: [
      "**turn to** 字面「转向某人」，引申「求助、依靠」。turn to sb for help / advice 是固定搭配。",
      "近义：rely on / count on。例句：When the project failed, he turned to his mentor for guidance."
    ]
  },
  {
    sentence: "That joke is killing me — I can't stop laughing.",
    cid: fnv8("That joke is killing me — I can't stop laughing."),
    translation: "这笑话要笑死我了，根本停不下来。",
    chunks: ["That joke is killing me —","I can't stop laughing."],
    hints: ["那笑话笑死我了","我停不下来笑"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ðæt/","/dʒoʊk/","/ɪz/","/ˈkɪlɪŋ/","/miː/"], pos:"习语·笑到不行", meaning:"这笑话快把我笑死了"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/kænt/","/stɑːp/","/ˈlæfɪŋ/"], pos:"现在时陈述", meaning:"我忍不住一直笑"}
    ],
    explanations: [
      "**something is killing me** 夸张表达「某事让我受不了/笑死我了」，口语高频。也可表疼痛：My back is killing me（腰快疼死了）。",
      "例句：This show is killing me — every episode is hilarious."
    ]
  },
  {
    sentence: "Cut the jokes — let's get serious for a minute.",
    cid: fnv8("Cut the jokes — let's get serious for a minute."),
    translation: "别开玩笑了，我们说一分钟正经的。",
    chunks: ["Cut the jokes —","let's get serious","for a minute."],
    hints: ["别开玩笑","我们说正经的","就一分钟"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/kʌt/","/ðə/","/dʒoʊks/"], pos:"祈使句·口语", meaning:"别开玩笑（打住）"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/lets/","/ɡet/","/ˈsɪriəs/"], pos:"习语·认真起来", meaning:"我们认真谈"},
      {role:"状语", color:"#3358e0", phonetic:["/fər/","/ə/","/ˈmɪnɪt/"], pos:"介词短语", meaning:"一会儿功夫"}
    ],
    explanations: [
      "**get serious** 是「说正经的/认真起来」，通常标志话题从玩笑转向严肃。cut the jokes 是其铺垫。",
      "例句：Okay, enough fun — let's get serious about the deadline."
    ]
  },
  {
    sentence: "The builder cut corners and now the wall is cracking.",
    cid: fnv8("The builder cut corners and now the wall is cracking."),
    translation: "施工队偷工减料，现在墙都开裂了。",
    chunks: ["The builder cut corners","and now the wall is cracking."],
    hints: ["施工方偷工减料","现在墙开始开裂了"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ðə/","/ˈbɪldər/","/kʌt/","/ˈkɔːrnərz/"], pos:"习语·偷工减料", meaning:"施工方偷工减料"},
      {role:"并列分句", color:"#c87033", phonetic:["/ænd/","/naʊ/","/ðə/","/wɔːl/","/ɪz/","/ˈkrækɪŋ/"], pos:"现在进行时", meaning:"现在墙在开裂"}
    ],
    explanations: [
      "**cut corners** 指「为省时省钱而偷工减料、走捷径」，通常带贬义，工程质量/产品质量场景常用。",
      "近义：take shortcuts。例句：Never cut corners on safety equipment — it saves lives."
    ]
  },
  {
    sentence: "She paid good money for that designer handbag.",
    cid: fnv8("She paid good money for that designer handbag."),
    translation: "她花了大价钱买那个名牌包。",
    chunks: ["She paid good money","for that designer handbag."],
    hints: ["她花了不少钱","买那个名牌包"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/ʃiː/","/peɪd/","/ɡʊd/","/ˈmʌni/"], pos:"过去时·习语宾语", meaning:"她花了大价钱"},
      {role:"介词短语", color:"#3358e0", phonetic:["/fɔːr/","/ðæt/","/dɪˈzaɪnər/","/ˈhændbæɡ/"], pos:"介词短语", meaning:"为那个名牌手提包"}
    ],
    explanations: [
      "**pay good money for** 意为「花大价钱/真金白银买」，强调东西不便宜、理应质量好。抱怨质量时常用：I paid good money for this!",
      "例句：We paid good money for those tickets — the seats better be great."
    ]
  },
  {
    sentence: "Stop second-guessing yourself and just send the email.",
    cid: fnv8("Stop second-guessing yourself and just send the email."),
    translation: "别反复纠结了，把邮件发出去就行。",
    chunks: ["Stop second-guessing yourself","and just send the email."],
    hints: ["别再事后怀疑自己","直接发邮件就行"],
    grammar: [
      {role:"祈使句+习语", color:"#7c5cbf", phonetic:["/stɑːp/","/ˈsekəndˈɡesɪŋ/","/jɔːrˈself/"], pos:"习语·反复怀疑", meaning:"别再自我怀疑/反复纠结"},
      {role:"祈使句", color:"#c87033", phonetic:["/ænd/","/dʒʌst/","/send/","/ðiː/","/ˈiːmeɪl/"], pos:"祈使句", meaning:"直接把邮件发出去"}
    ],
    explanations: [
      "**second-guess** 指「事后反复怀疑自己当初的决定」，动词可直接加宾语。比 hesitate 多了「回头看」的意味。",
      "例句：Stop second-guessing the interview answers — what's done is done."
    ]
  },
  {
    sentence: "Hey, what's new with you these days?",
    cid: fnv8("Hey, what's new with you these days?"),
    translation: "嘿，你最近有什么新鲜事吗？",
    chunks: ["Hey,","what's new","with you these days?"],
    hints: ["嘿","有什么新鲜事","你最近怎么样"],
    grammar: [
      {role:"感叹词", color:"#c87033", phonetic:["/heɪ/"], pos:"招呼语", meaning:"嘿"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/wʌts/","/nuː/"], pos:"习语·寒暄近况", meaning:"有什么新鲜事"},
      {role:"介词短语", color:"#3358e0", phonetic:["/wɪð/","/juː/","/ðiːz/","/deɪz/"], pos:"介词短语", meaning:"你最近"}
    ],
    explanations: [
      "**What's new?** 是比 How are you 更亲密的寒暄，问对方近况和新鲜事。熟人间高频开场白。",
      "回答套路：Not much（没啥特别的）/ Same as usual。例句：— What's new? — Just started a new job!"
    ]
  },
  {
    sentence: "Fill me in — I need to get up to speed on this project.",
    cid: fnv8("Fill me in — I need to get up to speed on this project."),
    translation: "给我讲讲，我得尽快跟上这个项目的进度。",
    chunks: ["Fill me in —","I need to get up to speed","on this project."],
    hints: ["给我补补课","我需要尽快跟上进度","关于这个项目"],
    grammar: [
      {role:"祈使句·短语", color:"#c87033", phonetic:["/fɪl/","/miː/","/ɪn/"], pos:"短语动词·告知详情", meaning:"给我讲讲详情"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/niːd/","/tə/","/ɡet/","/ʌp/","/tə/","/spiːd/"], pos:"习语·赶上进度", meaning:"我需要尽快熟悉情况"},
      {role:"介词短语", color:"#3358e0", phonetic:["/ɑːn/","/ðɪs/","/ˈprɑːdʒekt/"], pos:"介词短语", meaning:"关于这个项目"}
    ],
    explanations: [
      "**up to speed** 指「跟上最新进度、掌握全部信息」，职场高频。get/be/bring sb up to speed 三种搭配都要会用。",
      "例句：Can you bring me up to speed on what happened at the meeting?"
    ]
  },
  {
    sentence: "You can't copy my homework — do it on your own.",
    cid: fnv8("You can't copy my homework — do it on your own."),
    translation: "你不能抄我作业，得自己做。",
    chunks: ["You can't copy my homework —","do it on your own."],
    hints: ["你不能抄我的作业","自己独立完成"],
    grammar: [
      {role:"情态否定", color:"#c87033", phonetic:["/juː/","/kænt/","/ˈkɑːpi/","/maɪ/","/ˈhoʊmwɜːrk/"], pos:"情态动词否定", meaning:"你不可以抄我的作业"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/duː/","/ɪt/","/ɑːn/","/jɔːr/","/oʊn/"], pos:"习语·独立自主", meaning:"靠自己做、独立完成"}
    ],
    explanations: [
      "**on one's own** = alone / independently，「靠自己、独立地」。表「独自一人」或「独立完成」都行。",
      "近义：by yourself / single-handedly。例句：She built the whole website on her own."
    ]
  },
  {
    sentence: "He didn't respect me, so I told him to take a hike.",
    cid: fnv8("He didn't respect me, so I told him to take a hike."),
    translation: "他不尊重我，我就叫他滚一边去。",
    chunks: ["He didn't respect me,","so I told him to take a hike."],
    hints: ["他不尊重我","所以我要他滚蛋"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/hiː/","/ˈdɪdnt/","/rɪˈspekt/","/miː/"], pos:"过去时否定", meaning:"他不尊重我"},
      {role:"习语·不定式", color:"#7c5cbf", phonetic:["/soʊ/","/aɪ/","/toʊld/","/hɪm/","/tə/","/teɪk/","/ə/","/haɪk/"], pos:"习语·叫人走开", meaning:"所以我叫他走开/滚蛋"}
    ],
    explanations: [
      "**take a hike** 是不客气的「走开/一边去」，比 go away 更强硬粗鲁，生气或赶人时用，正式场合禁用。",
      "近义：get lost / buzz off。例句：If you're just here to complain, take a hike."
    ]
  },
  {
    sentence: "You broke my laptop, so don't ask for a favor — you asked for it.",
    cid: fnv8("You broke my laptop, so don't ask for a favor — you asked for it."),
    translation: "你弄坏了我的笔记本，就别来求我帮忙了，你自找的。",
    chunks: ["You broke my laptop,","so don't ask for a favor —","you asked for it."],
    hints: ["你弄坏了我的笔记本","所以别来求我帮忙","你自找的、活该"],
    grammar: [
      {role:"过去时陈述", color:"#c87033", phonetic:["/juː/","/broʊk/","/maɪ/","/ˈlæptɑːp/"], pos:"过去时", meaning:"你弄坏了我的笔记本"},
      {role:"祈使句", color:"#3358e0", phonetic:["/soʊ/","/doʊnt/","/æsk/","/fər/","/ə/","/ˈfeɪvər/"], pos:"祈使句·因果", meaning:"所以别来求帮忙"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/juː/","/æskt/","/fɔːr/","/ɪt/"], pos:"习语·自食其果", meaning:"你自找的"}
    ],
    explanations: [
      "**ask for it** 表示「自找麻烦/咎由自取」，常用于对方不听劝告后出了状况时的责难：You asked for it!",
      "例句：I warned him not to drive drunk — when he got caught, he asked for it."
    ]
  },
  {
    sentence: "\"This plan won't work.\" — \"You said it!\"",
    cid: fnv8("\"This plan won't work.\" — \"You said it!\""),
    translation: "「这方案行不通。」「说得太对了！",
    chunks: ["\"This plan won't work.\" —","\"You said it!\""],
    hints: ["这方案行不通","说得没错（附和）"],
    grammar: [
      {role:"引述陈述", color:"#c87033", phonetic:["/ðɪs/","/plæn/","/woʊnt/","/wɜːrk/"], pos:"一般将来时否定", meaning:"这个方案行不通"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/juː/","/sed/","/ɪt/"], pos:"习语·强烈附和", meaning:"你说得太对了"}
    ],
    explanations: [
      "**You said it!** 强烈附和对方：「说得太对/可不是嘛」，比 I agree 更口语带劲，像中文「说到点上了」。",
      "例句：— The traffic here is awful. — You said it!"
    ]
  },
  {
    sentence: "The team dropped the ball and lost the biggest client.",
    cid: fnv8("The team dropped the ball and lost the biggest client."),
    translation: "团队掉了链子，丢了最大的客户。",
    chunks: ["The team dropped the ball","and lost the biggest client."],
    hints: ["团队搞砸了","丢了最大客户"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ðə/","/tiːm/","/drɑːpt/","/ðə/","/bɔːl/"], pos:"习语·搞砸失误", meaning:"团队失职、搞砸了"},
      {role:"并列谓语", color:"#c87033", phonetic:["/ænd/","/lɔːst/","/ðə/","/ˈbɪɡɪst/","/ˈklaɪənt/"], pos:"过去时并列", meaning:"失去了最大的客户"}
    ],
    explanations: [
      "**drop the ball** 源自球类「接球失误」，引申「搞砸、失职、关键时刻掉链子」，职场批评常用。",
      "近义：mess up / blow it。例句：HR dropped the ball on the offer letter — the candidate took another job."
    ]
  },
  {
    sentence: "Hold your horses — we haven't even checked the price yet.",
    cid: fnv8("Hold your horses — we haven't even checked the price yet."),
    translation: "别急嘛，我们还没看价钱呢。",
    chunks: ["Hold your horses —","we haven't even checked the price yet."],
    hints: ["别急、慢着","我们还没查价格呢"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/hoʊld/","/jʊr/","/ˈhɔːrsɪz/"], pos:"习语·让人别急", meaning:"慢着、别着急"},
      {role:"现在完成时", color:"#c87033", phonetic:["/wiː/","/ˈhævnt/","/iːvən/","/tʃekt/","/ðə/","/praɪs/","/jet/"], pos:"现在完成时否定", meaning:"我们还没查价格呢"}
    ],
    explanations: [
      "**hold your horses** 字面「勒住你的马」，口语「别急/慢着」，拦着冲动的人先等等，带点调侃。",
      "例句：Hold your horses! Let me finish explaining before you judge."
    ]
  },
  {
    sentence: "Watch your mouth — that's not how you talk to your mother.",
    cid: fnv8("Watch your mouth — that's not how you talk to your mother."),
    translation: "说话注意点，这不是你对妈妈说话该有的态度。",
    chunks: ["Watch your mouth —","that's not how you talk to your mother."],
    hints: ["说话注意分寸","这不是你对妈妈说话的方式"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/wɑːtʃ/","/jʊr/","/maʊθ/"], pos:"习语·警告措辞", meaning:"说话注意点（别乱说）"},
      {role:"表语从句", color:"#c87033", phonetic:["/ðæts/","/nɑːt/","/haʊ/","/juː/","/tɔːk/","/tə/","/jʊr/","/ˈmʌðər/"], pos:"表语从句", meaning:"那不是跟妈妈说话的方式"}
    ],
    explanations: [
      "**watch your mouth** 警告对方「说话注意点」，对方爆粗口或无礼时用，语气较硬。",
      "近义：mind your language。例句：Watch your mouth in front of the kids."
    ]
  },
  {
    sentence: "\"Can you fix the printer by noon?\" — \"Consider it done.\"",
    cid: fnv8("\"Can you fix the printer by noon?\" — \"Consider it done.\""),
    translation: "「中午前能修好打印机吗？」「包在我身上。",
    chunks: ["\"Can you fix the printer by noon?\" —","\"Consider it done.\""],
    hints: ["你能中午前修好打印机吗","包在我身上（当已成事）"],
    grammar: [
      {role:"问句引用", color:"#c87033", phonetic:["/kæn/","/juː/","/fɪks/","/ðə/","/ˈprɪntər/","/baɪ/","/nuːn/"], pos:"一般疑问句", meaning:"你能中午前修好打印机吗"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/kənˈsɪdər/","/ɪt/","/dʌn/"], pos:"习语·爽快承诺", meaning:"就当办好了，包在我身上"}
    ],
    explanations: [
      "**Consider it done** 是干脆利落的承诺：「包在我身上/当它已经办好了」，比 I'll do it 更有把握感，商务场合也合适。",
      "例句：— Could you book a table for two? — Consider it done."
    ]
  },
  {
    sentence: "Don't you dare touch my phone again!",
    cid: fnv8("Don't you dare touch my phone again!"),
    translation: "你敢再碰我手机试试！",
    chunks: ["Don't you dare","touch my phone again!"],
    hints: ["你敢（警告）","再碰我手机"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/juː/","/der/"], pos:"习语·严厉警告", meaning:"你敢（试试看）"},
      {role:"谓语+宾语", color:"#c87033", phonetic:["/tʌtʃ/","/maɪ/","/foʊn/","/əˈɡen/"], pos:"祈使句谓语", meaning:"再碰我的手机"}
    ],
    explanations: [
      "**Don't you dare!** 是严厉警告「你敢！/ 你敢试试！」，比 don't 强硬得多，带威胁语气，通常最后通牒式使用。",
      "例句：Don't you dare tell anyone about this!"
    ]
  },
  {
    sentence: "For the record, I never agreed to that price.",
    cid: fnv8("For the record, I never agreed to that price."),
    translation: "把话说清楚，我从没同意过那个价钱。",
    chunks: ["For the record,","I never agreed","to that price."],
    hints: ["声明一下（把话说清）","我从未同意","那个价钱"],
    grammar: [
      {role:"习语·插入语", color:"#7c5cbf", phonetic:["/fɔːr/","/ðə/","/ˈrekərd/"], pos:"习语·正式声明", meaning:"为记录在案、把话说清楚"},
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/ˈnevər/","/əˈɡriːd/"], pos:"过去时否定", meaning:"我从未同意过"},
      {role:"介词短语", color:"#3358e0", phonetic:["/tə/","/ðæt/","/praɪs/"], pos:"介词短语", meaning:"对那个价格"}
    ],
    explanations: [
      "**for the record** 源自会议记录用语，现常表示「先声明清楚/把话说在前面」，避免日后被误解。",
      "例句：For the record, I was against this idea from day one."
    ]
  },
  {
    sentence: "Apply anyway — you never know what might happen.",
    cid: fnv8("Apply anyway — you never know what might happen."),
    translation: "先投了再说，结果谁知道呢。",
    chunks: ["Apply anyway —","you never know","what might happen."],
    hints: ["不管怎样先申请","你永远说不准","会发生什么"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/əˈplaɪ/","/ˈeniweɪ/"], pos:"祈使句", meaning:"无论如何先申请"},
      {role:"习语·主句", color:"#7c5cbf", phonetic:["/juː/","/ˈnevər/","/noʊ/"], pos:"习语·世事难料", meaning:"你永远说不准"},
      {role:"宾语从句", color:"#3358e0", phonetic:["/wʌt/","/maɪt/","/ˈhæpən/"], pos:"宾语从句", meaning:"会发生什么"}
    ],
    explanations: [
      "**you never know** 表示「世事难料/说不定呢」，鼓励对方尝试时常用，也可表达不把话说死。",
      "例句：Give it a shot — you never know unless you try."
    ]
  },
  {
    sentence: "Strike a pose — this photo will be on the cover.",
    cid: fnv8("Strike a pose — this photo will be on the cover."),
    translation: "摆个姿势，这张照片要上封面。",
    chunks: ["Strike a pose —","this photo will be on the cover."],
    hints: ["摆个姿势","这张照片要上封面"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/straɪk/","/ə/","/poʊz/"], pos:"习语·摆姿势", meaning:"摆个姿势"},
      {role:"主系表", color:"#c87033", phonetic:["/ðɪs/","/ˈfoʊtoʊ/","/wɪl/","/biː/","/ɑːn/","/ðə/","/ˈkʌvər/"], pos:"一般将来时", meaning:"这张照片将登上封面"}
    ],
    explanations: [
      "**strike a pose** 是摄影/时尚圈的「摆姿势」固定说法，strike 这里不是「打」而是「摆出」。",
      "例句：The photographer asked her to strike a pose by the window."
    ]
  },
  {
    sentence: "The boss wants the report — on the double!",
    cid: fnv8("The boss wants the report — on the double!"),
    translation: "老板要那份报告，立刻马上！",
    chunks: ["The boss wants the report —","on the double!"],
    hints: ["老板要那份报告","立刻、马上"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/ðə/","/bɔːs/","/wɑːnts/","/ðə/","/rɪˈpɔːrt/"], pos:"一般现在时", meaning:"老板要那份报告"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/ɑːn/","/ðə/","/ˈdʌbl/"], pos:"习语·马上行动", meaning:"立刻、赶紧"}
    ],
    explanations: [
      "**on the double** 源自军队口令「跑步走」，口语表「立即、赶快」，比 right now 更有催促感。",
      "近义：right away / ASAP。例句：Get the ambulance here on the double!"
    ]
  },
  {
    sentence: "Make it quick — I have a meeting in ten minutes.",
    cid: fnv8("Make it quick — I have a meeting in ten minutes."),
    translation: "有话快说，我十分钟后有个会。",
    chunks: ["Make it quick —","I have a meeting in ten minutes."],
    hints: ["快点说/快点办","我十分钟后有个会"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/meɪk/","/ɪt/","/kwɪk/"], pos:"习语·催促简短", meaning:"抓紧时间、简短点"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/hæv/","/ə/","/ˈmiːtɪŋ/","/ɪn/","/ten/","/ˈmɪnɪts/"], pos:"一般现在时", meaning:"我十分钟后有个会议"}
    ],
    explanations: [
      "**make it quick** 催促对方「快点/长话短说」，常用于没时间的场景，语气直接但不失礼。",
      "近义：keep it short / cut to the chase。例句：Make it quick — the store closes in five minutes."
    ]
  },
  {
    sentence: "Don't push it — I already said no twice.",
    cid: fnv8("Don't push it — I already said no twice."),
    translation: "别得寸进尺，我已经说了两次不了。",
    chunks: ["Don't push it —","I already said no twice."],
    hints: ["别得寸进尺","我已经拒绝两次了"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/pʊʃ/","/ɪt/"], pos:"习语·警告适可而止", meaning:"别得寸进尺、见好就收"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ɔːlˈredi/","/sed/","/noʊ/","/twaɪs/"], pos:"过去时", meaning:"我已经说过两次不了"}
    ],
    explanations: [
      "**don't push it** 警告对方适可而止：「别得寸进尺/别蹬鼻子上脸」，对方已越界或贪心时的最后提醒。",
      "例句：You got a raise last month — don't push it by asking for more."
    ]
  },
  {
    sentence: "Come in and make yourself at home.",
    cid: fnv8("Come in and make yourself at home."),
    translation: "进来吧，别客气当自己家。",
    chunks: ["Come in","and make yourself at home."],
    hints: ["进来","别拘束、当自己家"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/kʌm/","/ɪn/"], pos:"祈使句·短语动词", meaning:"进来吧"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ænd/","/meɪk/","/jɔːrˈself/","/æt/","/hoʊm/"], pos:"习语·宾至如归", meaning:"别拘束，像在自己家一样"}
    ],
    explanations: [
      "**make yourself at home** 是主人招呼客人的标准客套话：「随意点、别拘束、当自己家」。",
      "例句：The host said, \"Make yourself at home — grab a drink from the fridge.\""
    ]
  },
  {
    sentence: "Easy does it — that box has glass inside.",
    cid: fnv8("Easy does it — that box has glass inside."),
    translation: "轻拿轻放，那箱子里有玻璃。",
    chunks: ["Easy does it —","that box has glass inside."],
    hints: ["慢点、轻点","那箱子里有玻璃"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ˈiːzi/","/dʌz/","/ɪt/"], pos:"习语·提醒小心", meaning:"轻点慢点、悠着来"},
      {role:"主谓宾", color:"#c87033", phonetic:["/ðæt/","/bɑːks/","/hæz/","/ɡlæs/","/ˌɪnˈsaɪd/"], pos:"一般现在时", meaning:"那箱子里面是玻璃"}
    ],
    explanations: [
      "**easy does it** 提醒对方「悠着点、慢来轻来」，搬运重物、做精细操作时常用，语气温和。",
      "近义：take it slow / gently。例句：Easy does it with the paint — don't rush the strokes."
    ]
  },
  {
    sentence: "Get off my back — I'll clean my room when I want to.",
    cid: fnv8("Get off my back — I'll clean my room when I want to."),
    translation: "别老唠叨我，我想收拾房间自然会收拾。",
    chunks: ["Get off my back —","I'll clean my room when I want to."],
    hints: ["别烦我/别唠叨","我想收拾时自然会收拾"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡet/","/ɔːf/","/maɪ/","/bæk/"], pos:"习语·别唠叨施压", meaning:"别烦我、别一直唠叨"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪl/","/kliːn/","/maɪ/","/ruːm/","/wen/","/aɪ/","/wɑːnt/","/tə/"], pos:"将来时+时间状语", meaning:"我想收拾房间时就收拾"}
    ],
    explanations: [
      "**get off my back** 对被唠叨/施压的人说：「别烦我了/别老盯着我」，孩子对父母、下属对上司都常见。",
      "近义：stop nagging me / leave me alone。例句：Get off my back — I'll submit the report tonight!"
    ]
  },
  {
    sentence: "She's had a crush on her classmate since middle school.",
    cid: fnv8("She's had a crush on her classmate since middle school."),
    translation: "她从中学起就一直暗恋那个同学。",
    chunks: ["She's had a crush on","her classmate","since middle school."],
    hints: ["她一直暗恋","她的同学","从中学起"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ʃiːz/","/hæd/","/ə/","/krʌʃ/","/ɑːn/"], pos:"习语·暗恋", meaning:"她对…暗恋"},
      {role:"宾语", color:"#3358e0", phonetic:["/hɜːr/","/ˈklæsmeɪt/"], pos:"名词短语", meaning:"她的同学"},
      {role:"时间状语", color:"#c87033", phonetic:["/sɪns/","/ˈmɪdl/","/skuːl/"], pos:"时间状语", meaning:"从中学时代起"}
    ],
    explanations: [
      "**have a crush on someone** 指「暗恋某人」，是青涩单向的喜欢，区别于认真的恋爱关系。",
      "例句：I had a huge crush on my English teacher in high school."
    ]
  },
  {
    sentence: "Give me a break — I've been working nonstop for eight hours.",
    cid: fnv8("Give me a break — I've been working nonstop for eight hours."),
    translation: "饶了我吧，我已经连轴转了八小时。",
    chunks: ["Give me a break —","I've been working nonstop for eight hours."],
    hints: ["饶了我吧/别逗了","我已经连续工作八小时了"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡɪv/","/miː/","/ə/","/breɪk/"], pos:"习语·求饶/不信", meaning:"饶了我吧（求情/别逗了）"},
      {role:"现在完成进行时", color:"#c87033", phonetic:["/aɪv/","/bɪn/","/ˈwɜːrkɪŋ/","/ˌnɑːnˈstɑːp/","/fər/","/eɪt/","/ˈaʊərz/"], pos:"现在完成进行时", meaning:"我已经不停地工作了八小时"}
    ],
    explanations: [
      "**give me a break** 两种语气：①求饶「饶了我吧/让我歇歇」；②不信「别逗了/少来这套」（对方说离谱话时）。",
      "例句：— I ran a marathon last week. — Give me a break, you hate running!"
    ]
  },
  {
    sentence: "It's my treat tonight — the dinner is on me.",
    cid: fnv8("It's my treat tonight — the dinner is on me."),
    translation: "今晚我请客，这顿饭我来付。",
    chunks: ["It's my treat tonight —","the dinner is on me."],
    hints: ["今晚我请客","这顿饭我买单"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/maɪ/","/triːt/","/təˈnaɪt/"], pos:"主系表·请客", meaning:"今晚我请客"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/ðə/","/ˈdɪnər/","/ɪz/","/ɑːn/","/miː/"], pos:"习语·费用承担", meaning:"这顿饭算我头上（我买单）"}
    ],
    explanations: [
      "**it's on me** 表示「费用我来付」，结账场景万能句。同义 It's my treat / I'll pick up the tab。",
      "例句：You paid last time — this round is on me."
    ]
  },
  {
    sentence: "Just a minute — I need to grab my keys.",
    cid: fnv8("Just a minute — I need to grab my keys."),
    translation: "稍等一下，我拿个钥匙。",
    chunks: ["Just a minute —","I need to grab my keys."],
    hints: ["稍等一下","我需要拿我的钥匙"],
    grammar: [
      {role:"习语·插入", color:"#7c5cbf", phonetic:["/dʒʌst/","/ə/","/ˈmɪnɪt/"], pos:"习语·稍候", meaning:"等一下、稍候"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/niːd/","/tə/","/ɡræb/","/maɪ/","/kiːz/"], pos:"need to+动词", meaning:"我得拿一下钥匙"}
    ],
    explanations: [
      "**just a minute** 让对方稍候，比 wait 更礼貌自然。同义：just a second / hold on。",
      "例句：Just a minute, let me check my schedule first."
    ]
  },
  {
    sentence: "I have nothing to lose by telling you the truth.",
    cid: fnv8("I have nothing to lose by telling you the truth."),
    translation: "跟你说实话，我没什么可失去的。",
    chunks: ["I have nothing to lose","by telling you the truth."],
    hints: ["我没什么可输的","通过告诉你真相"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/hæv/","/ˈnʌθɪŋ/","/tə/","/luːz/"], pos:"习语·无所顾忌", meaning:"我没什么可失去的"},
      {role:"方式状语", color:"#c87033", phonetic:["/baɪ/","/ˈtelɪŋ/","/juː/","/ðə/","/truːθ/"], pos:"介词+动名词", meaning:"把真相告诉你"}
    ],
    explanations: [
      "**have nothing to lose** 表示「豁出去了/没什么可失去的」，常给犹豫的人壮胆，也形容已经跌到谷底无后顾之忧。",
      "例句：Ask her out — you have nothing to lose."
    ]
  }
,
  {
    sentence: "You've been working all day — take it easy tonight.",
    cid: fnv8("You've been working all day — take it easy tonight."),
    translation: "你今天忙了一整天，今晚好好歇歇。",
    chunks: ["You've been working all day —","take it easy","tonight."],
    hints: ["你今天一直忙","放轻松","今晚"],
    grammar: [
      {role:"现在完成进行时", color:"#c87033", phonetic:["/juːv/","/bɪn/","/ˈwɜːrkɪŋ/","/ɔːl/","/deɪ/"], pos:"现在完成进行时", meaning:"你已经忙了一整天"},
      {role:"习语·劝告", color:"#7c5cbf", phonetic:["/teɪk/","/ɪt/","/ˈiːzi/"], pos:"习语·放轻松", meaning:"放松点、悠着点"},
      {role:"时间状语", color:"#3358e0", phonetic:["/təˈnaɪt/"], pos:"时间状语", meaning:"今晚"}
    ],
    explanations: [
      "**take it easy** 意为「放轻松/悠着点」，既是日常安慰也是建议。比 relax 更主动。",
      "近义：chill out / don't push yourself。例句：Take it easy — there's no rush."
    ]
  },
  {
    sentence: "\"Work fewer hours?\" — \"Easy for you to say!\"",
    cid: fnv8("\"Work fewer hours?\" — \"Easy for you to say!\""),
    translation: "「少加点班？」「你说得倒轻巧！",
    chunks: ["\"Work fewer hours?\" —","\"Easy for you to say!\""],
    hints: ["少加点班","你说得倒轻巧（讽刺）"],
    grammar: [
      {role:"问句引用", color:"#c87033", phonetic:["/wɜːrk/","/ˈfiːjər/","/ˈaʊərz/"], pos:"祈使句引述", meaning:"少加一点班？"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/ˈiːzi/","/fər/","/juː/","/tə/","/seɪ/"], pos:"习语·反讽", meaning:"你说得倒轻巧"}
    ],
    explanations: [
      "**easy for you to say** 对方站着说话不腰疼时的常用回应：「你倒说得轻松」，含反讽/抱怨。",
      "例句：— Just save more money! — Easy for you to say, with your fancy job."
    ]
  },
  {
    sentence: "You can argue, but at the end of the day it's my call.",
    cid: fnv8("You can argue, but at the end of the day it's my call."),
    translation: "你可以争，但说到底还是我说了算。",
    chunks: ["You can argue, but","at the end of the day","it's my call."],
    hints: ["你可以争辩但","说到底","还是我说了算"],
    grammar: [
      {role:"让步状语", color:"#c87033", phonetic:["/juː/","/kæn/","/ˈɑːrɡjuː/","/bʌt/"], pos:"让步转折", meaning:"你可以争辩，但"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/æt/","/ðiː/","/end/","/əv/","/ðə/","/deɪ/"], pos:"习语·归根到底", meaning:"说到底、归根结底"},
      {role:"主系表", color:"#3358e0", phonetic:["/ɪts/","/maɪ/","/kɔːl/"], pos:"主系表", meaning:"还是由我决定"}
    ],
    explanations: [
      "**at the end of the day** 总结用语「说到底、归根结底」，把争论拉回本质。",
      "近义：when all is said and done / ultimately。例句：At the end of the day, the customer is always right."
    ]
  },
  {
    sentence: "Have it your way — I'm done arguing with you.",
    cid: fnv8("Have it your way — I'm done arguing with you."),
    translation: "随你吧，我懒得跟你吵了。",
    chunks: ["Have it your way —","I'm done arguing with you."],
    hints: ["随你便/依你","我不想再跟你争了"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/hæv/","/ɪt/","/jʊr/","/weɪ/"], pos:"习语·随你", meaning:"按你的方式/随你便"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪm/","/dʌn/","/ˈɑːrɡjuːɪŋ/","/wɪð/","/juː/"], pos:"现在时·表完成", meaning:"我不想再和你争了"}
    ],
    explanations: [
      "**have it your way** = suit yourself 升级版「随你吧/随你的便」，常带无奈放弃争论的语气。",
      "例句：— Let's order pizza. — Fine, have it your way."
    ]
  },
  {
    sentence: "What's the matter — you look upset?",
    cid: fnv8("What's the matter — you look upset?"),
    translation: "怎么了，你看起来不开心？",
    chunks: ["What's the matter —","you look upset?"],
    hints: ["怎么了","你看起来心情不好"],
    grammar: [
      {role:"习语·问句", color:"#7c5cbf", phonetic:["/wʌts/","/ðə/","/ˈmætər/"], pos:"习语·询问状况", meaning:"怎么了"},
      {role:"主系表", color:"#c87033", phonetic:["/juː/","/lʊk/","/ʌpˈset/"], pos:"主系表", meaning:"你看起来不开心"}
    ],
    explanations: [
      "**what's the matter** 表关心：「出什么事了/怎么了」，朋友发现你情绪不对时的开场。",
      "近义：what's wrong / what's up。例句：— What's the matter, honey? — Nothing, just tired."
    ]
  },
  {
    sentence: "He's good for nothing — never finishes a single task.",
    cid: fnv8("He's good for nothing — never finishes a single task."),
    translation: "他一点用没有，从来没完成过一件事。",
    chunks: ["He's good for nothing —","never finishes a single task."],
    hints: ["他一点用都没有","从来没完成过一件事"],
    grammar: [
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/hiːz/","/ɡʊd/","/fər/","/ˈnʌθɪŋ/"], pos:"习语·无用", meaning:"他毫无用处"},
      {role:"主谓宾", color:"#c87033", phonetic:["/ˈnevər/","/ˈfɪnɪʃɪz/","/ə/","/ˈsɪŋɡl/","/tæsk/"], pos:"一般现在时", meaning:"他从未完成过任何一件任务"}
    ],
    explanations: [
      "**good for nothing** 形容人「一无是处/没用的」，语气较重，慎用避免伤人。",
      "近义：useless / worthless。例句：This old phone is good for nothing — time to recycle it."
    ]
  },
  {
    sentence: "Show some respect — that's your father you're talking to.",
    cid: fnv8("Show some respect — that's your father you're talking to."),
    translation: "放尊重点，你在跟你爸说话呢。",
    chunks: ["Show some respect —","that's your father you're talking to."],
    hints: ["有点尊重（命令）","那是你爸在跟你说话"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ʃoʊ/","/sʌm/","/rɪˈspekt/"], pos:"习语·命令尊重", meaning:"放尊重点"},
      {role:"主系表+定语", color:"#c87033", phonetic:["/ðæts/","/jʊr/","/ˈfɑːðər/","/jʊr/","/ˈtɔːkɪŋ/","/tə/"], pos:"定语从句", meaning:"那是你的父亲在跟你说话"}
    ],
    explanations: [
      "**show some respect** 是长辈/上级对不敬者的警告：「放尊重点」，语气直接。",
      "例句：Show some respect when the flag is passing by."
    ]
  },
  {
    sentence: "Don't get involved — it's not your business.",
    cid: fnv8("Don't get involved — it's not your business."),
    translation: "别掺和了，这不关你的事。",
    chunks: ["Don't get involved —","it's not your business."],
    hints: ["别掺和进来","这不关你的事"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/ɡet/","/ɪnˈvɑːlvd/"], pos:"习语·阻止参与", meaning:"别掺和进来"},
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/nɑːt/","/jʊr/","/ˈbɪznəs/"], pos:"否定主系表", meaning:"这不关你的事"}
    ],
    explanations: [
      "**get involved** 指「参与、卷进」。don't get involved 是劝人别趟浑水的常用建议。",
      "近义：stay out of it / mind your own business。例句：Don't get involved in office gossip — it never ends well."
    ]
  },
  {
    sentence: "\"Thanks for helping!\" — \"Don't mention it.\"",
    cid: fnv8("\"Thanks for helping!\" — \"Don't mention it.\""),
    translation: "「谢谢你帮忙！」「别提了（不客气）。",
    chunks: ["\"Thanks for helping!\" —","\"Don't mention it.\""],
    hints: ["谢谢你的帮助","别客气（不客气）"],
    grammar: [
      {role:"致谢", color:"#c87033", phonetic:["/θæŋks/","/fər/","/ˈhelpɪŋ/"], pos:"致谢", meaning:"谢谢你帮忙"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/doʊnt/","/ˈmenʃən/","/ɪt/"], pos:"习语·客套回应", meaning:"不客气、别放在心上"}
    ],
    explanations: [
      "**don't mention it** 是回应致谢的客套话，等于 You're welcome，比 no problem 更正式。",
      "近义：not at all / my pleasure。例句：— I appreciate the help. — Don't mention it, that's what friends are for."
    ]
  },
  {
    sentence: "How have you been since you moved to Berlin?",
    cid: fnv8("How have you been since you moved to Berlin?"),
    translation: "搬到柏林以来你过得怎么样？",
    chunks: ["How have you been","since you moved to Berlin?"],
    hints: ["你过得怎么样","自从你搬到柏林以来"],
    grammar: [
      {role:"特殊疑问句", color:"#7c5cbf", phonetic:["/haʊ/","/hæv/","/juː/","/bɪn/"], pos:"现在完成时提问", meaning:"你过得如何"},
      {role:"时间状语从句", color:"#c87033", phonetic:["/sɪns/","/juː/","/muːvd/","/tə/","/bɜːrˈlɪn/"], pos:"时间状语从句", meaning:"自从你搬到柏林以来"}
    ],
    explanations: [
      "**How have you been** 是久未见面时的寒暄开场，比 how are you 更关切对方近期情况。",
      "回答：Pretty good / Same as usual / Been better. 例句：— How have you been? — Same old, same old."
    ]
  },
  {
    sentence: "Keep in touch — I want to know how you're doing.",
    cid: fnv8("Keep in touch — I want to know how you're doing."),
    translation: "保持联系，我想知道你的近况。",
    chunks: ["Keep in touch —","I want to know how you're doing."],
    hints: ["保持联系","我想了解你过得怎样"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/kiːp/","/ɪn/","/tʌtʃ/"], pos:"习语·保持联系", meaning:"保持联系"},
      {role:"宾语从句", color:"#c87033", phonetic:["/aɪ/","/wɑːnt/","/tə/","/noʊ/","/haʊ/","/jʊr/","/ˈduːɪŋ/"], pos:"宾语从句", meaning:"我想知道你过得怎么样"}
    ],
    explanations: [
      "**keep in touch** 告别或社交媒体互动时的标准客套：「保持联系」，结束对话或更新动态时高频。",
      "近义：stay in touch / keep me posted（保持更新）。例句：Keep in touch — and send me photos from the trip!"
    ]
  },
  {
    sentence: "You're ready — go for it!",
    cid: fnv8("You're ready — go for it!"),
    translation: "你准备好了，去争取吧！",
    chunks: ["You're ready —","go for it!"],
    hints: ["你准备好了","去争取吧/全力以赴"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/jʊr/","/ˈredi/"], pos:"主系表", meaning:"你准备好了"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/ɡoʊ/","/fər/","/ɪt/"], pos:"习语·鼓励争取", meaning:"放手去做、争取吧"}
    ],
    explanations: [
      "**go for it** 是「放手一搏/去争取」的口语鼓励，常见于比赛/面试/追求等场景。",
      "近义：go ahead / give it a shot。例句：Apply for the scholarship — just go for it."
    ]
  },
  {
    sentence: "Can you give me a ride to the airport tomorrow?",
    cid: fnv8("Can you give me a ride to the airport tomorrow?"),
    translation: "明天能顺路载我去机场吗？",
    chunks: ["Can you","give me a ride","to the airport tomorrow?"],
    hints: ["能","载我一程","明天去机场"],
    grammar: [
      {role:"助动词", color:"#3358e0", phonetic:["/kæn/","/juː/"], pos:"情态动词", meaning:"你能"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ɡɪv/","/miː/","/ə/","/raɪd/"], pos:"习语·搭车", meaning:"载我一程"},
      {role:"介词短语", color:"#c87033", phonetic:["/tə/","/ðiː/","/ˈerpɔːrt/","/təˈmɑːroʊ/"], pos:"介词短语", meaning:"明天去机场"}
    ],
    explanations: [
      "**give me a ride** 是请求搭车的标准说法，比 drive me 更礼貌、更口语。",
      "近义：give me a lift / take me to…。例句：If you're heading downtown, can you give me a lift?"
    ]
  },
  {
    sentence: "Give me a minute — I'll be right back.",
    cid: fnv8("Give me a minute — I'll be right back."),
    translation: "给我一分钟，我马上回来。",
    chunks: ["Give me a minute —","I'll be right back."],
    hints: ["给我一分钟","我马上回来"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡɪv/","/miː/","/ə/","/ˈmɪnɪt/"], pos:"习语·稍候", meaning:"给我一分钟"},
      {role:"主系表", color:"#c87033", phonetic:["/aɪl/","/biː/","/raɪt/","/bæk/"], pos:"将来时·短语", meaning:"我马上回来"}
    ],
    explanations: [
      "**give me a minute** 是请求别人「等一会儿」，立刻回来时用。比 just a minute 多了「我保证只等一分钟」的意味。",
      "近义：hold on / hang on。例句：Give me a minute, the file is downloading."
    ]
  },
  {
    sentence: "I'm looking forward to seeing you this weekend.",
    cid: fnv8("I'm looking forward to seeing you this weekend."),
    translation: "我盼着这个周末见到你。",
    chunks: ["I'm looking forward to","seeing you this weekend."],
    hints: ["我期盼着","这个周末见到你"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪm/","/ˈlʊkɪŋ/","/ˈfɔːrwərd/","/tə/"], pos:"习语·期待", meaning:"我期盼"},
      {role:"动名词宾语", color:"#c87033", phonetic:["/ˈsiːɪŋ/","/juː/","/ðɪs/","/ˈwiːkˌend/"], pos:"动名词短语", meaning:"这个周末见到你"}
    ],
    explanations: [
      "**look forward to** 是「期待/盼着」，to 是介词（不是不定式），后接名词或动名词。最常用于信末/邮件结尾。",
      "例句：I look forward to hearing from you soon.（盼望尽快回复）"
    ]
  },
  {
    sentence: "Have a good time at the concert — say hi to the band!",
    cid: fnv8("Have a good time at the concert — say hi to the band!"),
    translation: "演唱会玩得开心，替我跟乐队问好！",
    chunks: ["Have a good time","at the concert —","say hi to the band!"],
    hints: ["祝你玩得开心","演唱会","替我跟乐队问好"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/hæv/","/ə/","/ɡʊd/","/taɪm/"], pos:"习语·告别祝福", meaning:"玩得开心"},
      {role:"介词短语", color:"#3358e0", phonetic:["/æt/","/ðə/","/ˈkɑːnsərt/"], pos:"介词短语", meaning:"演唱会上"},
      {role:"习语·祈使", color:"#c87033", phonetic:["/seɪ/","/haɪ/","/tə/","/ðə/","/bænd/"], pos:"习语·问好", meaning:"替我跟乐队问好"}
    ],
    explanations: [
      "**have a good time** 是告别时的标准祝福「玩得开心」。**say hi to sb** 是「替我向某人问好」。",
      "例句：Have a good time at the party! Say hi to everyone for me."
    ]
  },
  {
    sentence: "Get well soon — the whole team misses you.",
    cid: fnv8("Get well soon — the whole team misses you."),
    translation: "快点好起来，整个团队都惦记你。",
    chunks: ["Get well soon —","the whole team misses you."],
    hints: ["快点好起来","整个团队都惦记你"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡet/","/wel/","/suːn/"], pos:"习语·康复祝福", meaning:"愿你早日康复"},
      {role:"主谓宾", color:"#c87033", phonetic:["/ðə/","/hoʊl/","/tiːm/","/ˈmɪsɪz/","/juː/"], pos:"一般现在时", meaning:"整个团队都惦记着你"}
    ],
    explanations: [
      "**get well soon** 是同事/朋友生病时的标准祝福，可送花/卡片/邮件都用。",
      "例句：Get well soon — let me know if you need anything."
    ]
  },
  {
    sentence: "Don't take it for granted — not everyone gets a second chance.",
    cid: fnv8("Don't take it for granted — not everyone gets a second chance."),
    translation: "别把这当成理所当然，不是谁都再有第二次机会的。",
    chunks: ["Don't take it for granted —","not everyone gets a second chance."],
    hints: ["别想当然","不是谁都再有第二次机会"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/teɪk/","/ɪt/","/fər/","/ˈɡræntɪd/"], pos:"习语·视作理所当然", meaning:"别想当然地认为"},
      {role:"主谓宾", color:"#c87033", phonetic:["/nɑːt/","/ˈevriwʌn/","/ɡets/","/ə/","/ˈsekənd/","/tʃæns/"], pos:"一般现在时", meaning:"不是每个人都能获得第二次机会"}
    ],
    explanations: [
      "**take ... for granted** 是「把…当成理所当然/不珍惜」，父母对孩子、伴侣对关心时常用。",
      "例句：She took her assistant's hard work for granted — until she quit."
    ]
  },
  {
    sentence: "Could I have a word with you in private?",
    cid: fnv8("Could I have a word with you in private?"),
    translation: "能跟你单独说两句吗？",
    chunks: ["Could I","have a word with you","in private?"],
    hints: ["我能","跟你单独说几句","私下里"],
    grammar: [
      {role:"情态动词", color:"#3358e0", phonetic:["/kʊd/","/aɪ/"], pos:"情态动词", meaning:"我能"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/hæv/","/ə/","/wɜːrd/","/wɪð/","/juː/"], pos:"习语·私下谈", meaning:"私下跟你谈几句"},
      {role:"状语", color:"#c87033", phonetic:["/ɪn/","/ˈpraɪvət/"], pos:"介词短语", meaning:"私下地"}
    ],
    explanations: [
      "**have a word with** 是「私下谈几句」，比 talk to 更含蓄有礼，常用于请人离开公众场合。",
      "近义：speak privately / have a quick chat。例句：Do you have a minute? I'd like to have a word with you."
    ]
  },
  {
    sentence: "I'll cover the tip — it's a deal!",
    cid: fnv8("I'll cover the tip — it's a deal!"),
    translation: "小费我出，就这么定了！",
    chunks: ["I'll cover the tip —","it's a deal!"],
    hints: ["小费我出","就这么定了"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪl/","/ˈkʌvər/","/ðə/","/tɪp/"], pos:"将来时", meaning:"小费我来付"},
      {role:"口语习语", color:"#7c5cbf", phonetic:["/ɪts/","/ə/","/diːl/"], pos:"习语·达成协议", meaning:"就这么定了"}
    ],
    explanations: [
      "**it's a deal** 是「成交/就这么定了」的口语承诺，商务/朋友间握手成交都可用。",
      "近义：deal! / done! / you got it!。例句：— I'll do the dishes tonight. — It's a deal."
    ]
  },
  {
    sentence: "You ate the last slice, and now you owe me.",
    cid: fnv8("You ate the last slice, and now you owe me."),
    translation: "你吃掉了最后一片，你欠我一份。",
    chunks: ["You ate the last slice,","and now you owe me."],
    hints: ["你吃掉了最后一片","现在你欠我一份"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/eɪt/","/ðə/","/læst/","/slaɪs/"], pos:"过去时", meaning:"你吃掉了最后一片"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ænd/","/naʊ/","/juː/","/oʊ/","/miː/"], pos:"习语·欠债", meaning:"现在你欠我"}
    ],
    explanations: [
      "**you owe me** 字面「你欠我」，引申「你欠我一个交代/一个回应」，可用于朋友间要说法、调侃。",
      "例句：You ruined my favorite mug — you owe me!"
    ]
  },
  {
    sentence: "We have pasta, salad, soup — you name it, we've got it.",
    cid: fnv8("We have pasta, salad, soup — you name it, we've got it."),
    translation: "我们有意大利面、沙拉、汤——你要什么有什么。",
    chunks: ["We have pasta, salad, soup —","you name it,","we've got it."],
    hints: ["我们有面、沙拉、汤","随你点名","我们都有"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/wiː/","/hæv/","/ˈpæstə/","/ˈsæləd/","/suːp/"], pos:"一般现在时", meaning:"我们有面、沙拉、汤"},
      {role:"习语·从句", color:"#7c5cbf", phonetic:["/juː/","/neɪm/","/ɪt/"], pos:"习语·列举", meaning:"随便你点（能想到的都有）"},
      {role:"主谓宾", color:"#3358e0", phonetic:["/wiːv/","/ɡɑːt/","/ɪt/"], pos:"完成时·短语", meaning:"我们都有"}
    ],
    explanations: [
      "**you name it** 是「随便你说/你能想到的都有」，表货源丰富、应有尽有。",
      "近义：and then some / you name it, we have it。例句：We sell anything — you name it."
    ]
  },
  {
    sentence: "Don't bother — I'll do it myself.",
    cid: fnv8("Don't bother — I'll do it myself."),
    translation: "别操心了，我自己来。",
    chunks: ["Don't bother —","I'll do it myself."],
    hints: ["别费心/别麻烦","我自己做就行"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/ˈbɑːðər/"], pos:"习语·阻止对方", meaning:"别费心了（不用你）"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪl/","/duː/","/ɪt/","/maɪˈself/"], pos:"将来时·反身代词", meaning:"我自己来"}
    ],
    explanations: [
      "**don't bother** 拒绝别人帮忙：「不用麻烦你了」，礼貌地接手或拒绝。",
      "近义：no worries / don't trouble yourself。例句：— Can I help with the dishes? — Don't bother, I've got it."
    ]
  },
  {
    sentence: "Look out — there's a car coming!",
    cid: fnv8("Look out — there's a car coming!"),
    translation: "当心，有车来了！",
    chunks: ["Look out —","there's a car coming!"],
    hints: ["当心/小心","有车开过来了"],
    grammar: [
      {role:"习语·警告", color:"#7c5cbf", phonetic:["/lʊk/","/aʊt/"], pos:"习语·危险警告", meaning:"当心！注意！"},
      {role:"存在句+现在分词", color:"#c87033", phonetic:["/ðerz/","/ə/","/kɑːr/","/ˈkʌmɪŋ/"], pos:"存在句+现在分词", meaning:"有辆车开过来了"}
    ],
    explanations: [
      "**look out!** 是危险预警「当心」，紧急程度高于 watch out，比 be careful 紧迫。",
      "近义：watch out / heads up。例句：Look out! The stove is hot!"
    ]
  },
  {
    sentence: "Watch out — the floor is slippery.",
    cid: fnv8("Watch out — the floor is slippery."),
    translation: "小心，地滑。",
    chunks: ["Watch out —","the floor is slippery."],
    hints: ["当心","地面滑"],
    grammar: [
      {role:"习语·警告", color:"#7c5cbf", phonetic:["/wɑːtʃ/","/aʊt/"], pos:"习语·提醒", meaning:"小心、当心"},
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/flɔːr/","/ɪz/","/ˈslɪpəri/"], pos:"主系表", meaning:"地面湿滑"}
    ],
    explanations: [
      "**watch out** 是日常提醒「小心」，比 look out 语气弱，更接近注意/留神。",
      "近义：be careful / mind your step。例句：Watch out for the step down — it's hard to see."
    ]
  },
  {
    sentence: "I need to know your decision — just say the word.",
    cid: fnv8("I need to know your decision — just say the word."),
    translation: "我需要知道你的决定，你开口就行。",
    chunks: ["I need to know your decision —","just say the word."],
    hints: ["我需要知道你的决定","你一句话的事（随时告诉我）"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/niːd/","/tə/","/noʊ/","/jʊr/","/dɪˈsɪʒən/"], pos:"need to+动词", meaning:"我需要知道你的决定"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/dʒʌst/","/seɪ/","/ðə/","/wɜːrd/"], pos:"习语·随时开口", meaning:"一句话就行，随时开口"}
    ],
    explanations: [
      "**say the word** = just let me know「随时说一声就行」，表示只要你开口我就行动。",
      "例句：If you need help moving, just say the word."
    ]
  },
  {
    sentence: "Don't worry about the kids — leave it to me.",
    cid: fnv8("Don't worry about the kids — leave it to me."),
    translation: "孩子们交给我来照顾，你不用操心。",
    chunks: ["Don't worry about the kids —","leave it to me."],
    hints: ["别担心孩子","交给我就行"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/doʊnt/","/ˈwɜːri/","/əˈbaʊt/","/ðə/","/kɪdz/"], pos:"祈使句", meaning:"别担心孩子们"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/liːv/","/ɪt/","/tə/","/miː/"], pos:"习语·交给我办", meaning:"交给我就行"}
    ],
    explanations: [
      "**leave it to me** 是承接任务的承诺：「交给我/包在我身上」，比 I'll do it 更有担当。",
      "近义：consider it done / I'll handle it。例句：— Who will close the deal? — Leave it to me."
    ]
  },
  {
    sentence: "Mind your own business — I'm fine on my own.",
    cid: fnv8("Mind your own business — I'm fine on my own."),
    translation: "管好你自己的事，我自己一个人能行。",
    chunks: ["Mind your own business —","I'm fine on my own."],
    hints: ["管好你自己的事","我一个人挺好"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/maɪnd/","/jʊr/","/oʊn/","/ˈbɪznəs/"], pos:"习语·别管闲事", meaning:"管好你自己的事"},
      {role:"主系表", color:"#c87033", phonetic:["/aɪm/","/faɪn/","/ɑːn/","/maɪ/","/oʊn/"], pos:"主系表", meaning:"我一个人能行"}
    ],
    explanations: [
      "**mind your own business** 是被多管闲事时的标准回击：「管好你自己」，态度明确。",
      "近义：stay out of it / it's none of your business。例句：Mind your own business, or I'll mind it for you."
    ]
  },
  {
    sentence: "Come on, we're going to be late for the movie.",
    cid: fnv8("Come on, we're going to be late for the movie."),
    translation: "快点儿，电影要迟到了。",
    chunks: ["Come on,","we're going to be late for the movie."],
    hints: ["快点/拜托","我们看电影要迟到了"],
    grammar: [
      {role:"口语习语", color:"#7c5cbf", phonetic:["/kʌm/","/ɑːn/"], pos:"习语·催促鼓励", meaning:"快点/来吧/得了吧"},
      {role:"主系表", color:"#c87033", phonetic:["/wɪr/","/ˈɡoʊɪŋ/","/tə/","/biː/","/leɪt/","/fər/","/ðə/","/ˈmuːvi/"], pos:"将来时·短语", meaning:"看电影要迟到了"}
    ],
    explanations: [
      "**come on** 多功能：催促「快点/得啦」+ 鼓励「加油」+ 不信「得了吧」。",
      "例句：Come on, you can do it! I believe in you."
    ]
  },
  {
    sentence: "Let me see — I think we have the file on the server.",
    cid: fnv8("Let me see — I think we have the file on the server."),
    translation: "我看看，我想我们服务器上应该有那个文件。",
    chunks: ["Let me see —","I think we have the file on the server."],
    hints: ["让我看看","我想服务器上应该有那文件"],
    grammar: [
      {role:"习语·插入", color:"#7c5cbf", phonetic:["/let/","/miː/","/siː/"], pos:"习语·稍作思考", meaning:"让我想想/看看"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/θɪŋk/","/wiː/","/hæv/","/ðə/","/faɪl/","/ɑːn/","/ðə/","/ˈsɜːrvər/"], pos:"主谓宾·状语", meaning:"我想服务器上应该有这个文件"}
    ],
    explanations: [
      "**let me see** = let me check「让我看看/让我查查」，回应对方需求前先确认的过渡语。",
      "近义：let me think / let me check。例句：— What's the WiFi password? — Let me see... it's on the fridge."
    ]
  },
  {
    sentence: "I see — you're telling me you want to quit your job.",
    cid: fnv8("I see — you're telling me you want to quit your job."),
    translation: "我明白了，你是告诉我你想辞职。",
    chunks: ["I see —","you're telling me you want to quit your job."],
    hints: ["我明白了","你跟我说你想辞职"],
    grammar: [
      {role:"习语·表态", color:"#7c5cbf", phonetic:["/aɪ/","/siː/"], pos:"习语·理解", meaning:"我明白"},
      {role:"主谓宾", color:"#c87033", phonetic:["/jʊr/","/ˈtelɪŋ/","/miː/","/juː/","/wɑːnt/","/tə/","/kwɪt/","/jʊr/","/dʒɑːb/"], pos:"现在进行时", meaning:"你在跟我说你想辞职"}
    ],
    explanations: [
      "**I see** 是「我明白了/我懂了」，比 I understand 更口语。对方解释事情时的回应高频。",
      "近义：got it / understood。例句：— It's a rental car, not ours. — I see, makes sense."
    ]
  },
  {
    sentence: "I get it — you don't want to talk about it right now.",
    cid: fnv8("I get it — you don't want to talk about it right now."),
    translation: "我懂了，你现在不想聊这个。",
    chunks: ["I get it —","you don't want to talk about it right now."],
    hints: ["我懂了","你现在不想谈这个"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/ɡet/","/ɪt/"], pos:"习语·理解", meaning:"我懂了/我明白"},
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/doʊnt/","/wɑːnt/","/tə/","/tɔːk/","/əˈbaʊt/","/ɪt/","/raɪt/","/naʊ/"], pos:"否定陈述", meaning:"你现在不想谈这件事"}
    ],
    explanations: [
      "**I get it** 跟 I see 同意，但 get it 更有「完全理解/同感」意味，朋友间宽慰对方常用。",
      "例句：— I'm so tired I could sleep for a week. — I get it. Take a break."
    ]
  },
  {
    sentence: "Not really — I just ate before I came over.",
    cid: fnv8("Not really — I just ate before I came over."),
    translation: "不客气了，我出门前刚吃过。",
    chunks: ["Not really —","I just ate before I came over."],
    hints: ["不用了/真的不用","我过来之前刚吃过"],
    grammar: [
      {role:"习语·婉拒", color:"#7c5cbf", phonetic:["/nɑːt/","/ˈriːəli/"], pos:"习语·婉转拒绝", meaning:"真不用/没有（礼貌推辞）"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/dʒʌst/","/eɪt/","/bɪˈfɔːr/","/aɪ/","/keɪm/","/ˈoʊvər/"], pos:"过去时", meaning:"我过来之前刚吃过"}
    ],
    explanations: [
      "**not really** 礼貌婉拒：「不必了/没有吧」，比 no 更温和，不会让对方下不来台。",
      "近义：I'm good / no thanks。例句：— Want more coffee? — Not really, but thanks."
    ]
  },
  {
    sentence: "We're leaving tomorrow — not yet tonight.",
    cid: fnv8("We're leaving tomorrow — not yet tonight."),
    translation: "我们明天走，今晚还没走。",
    chunks: ["We're leaving tomorrow —","not yet tonight."],
    hints: ["我们明天出发","今晚还没呢"],
    grammar: [
      {role:"主谓+时间", color:"#c87033", phonetic:["/wɪr/","/ˈliːvɪŋ/","/təˈmɑːroʊ/"], pos:"现在进行时表将来", meaning:"我们明天走"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/nɑːt/","/jet/","/təˈnaɪt/"], pos:"习语·否定现在", meaning:"现在还没呢"}
    ],
    explanations: [
      "**not yet** 表示「还没」，对 now? / ready? 这类当下问题的回答。",
      "例句：— Are you packed for the trip? — Not yet, I'll do it in the morning."
    ]
  },
  {
    sentence: "Not much, just catching up on some emails.",
    cid: fnv8("Not much, just catching up on some emails."),
    translation: "没什么，就是赶赶邮件。",
    chunks: ["Not much,","just catching up on some emails."],
    hints: ["没什么","就是赶赶邮件"],
    grammar: [
      {role:"习语·回应", color:"#7c5cbf", phonetic:["/nɑːt/","/mʌtʃ/"], pos:"习语·寒暄回应", meaning:"没什么特别的"},
      {role:"动名词短语", color:"#c87033", phonetic:["/dʒʌst/","/ˈkætʃɪŋ/","/ʌp/","/ɑːn/","/sʌm/","/ˈiːmeɪlz/"], pos:"现在分词短语", meaning:"只是补补邮件"}
    ],
    explanations: [
      "**not much** 是 What's up / What's new 的标准回应：「没啥特别的」。**catch up on** = 补上落下的工作。",
      "例句：— What are you up to? — Not much, just catching up on some paperwork."
    ]
  },
  {
    sentence: "It's now or never — grab the chance!",
    cid: fnv8("It's now or never — grab the chance!"),
    translation: "机不可失时不再来，抓住机会！",
    chunks: ["It's now or never —","grab the chance!"],
    hints: ["要么现在要么永远没了","抓住机会"],
    grammar: [
      {role:"习语·主系表", color:"#7c5cbf", phonetic:["/ɪts/","/naʊ/","/ɔːr/","/ˈnevər/"], pos:"习语·关键时机", meaning:"这是要么现在要么永远没有"},
      {role:"祈使句", color:"#c87033", phonetic:["/ɡræb/","/ðə/","/tʃæns/"], pos:"祈使句·短语动词", meaning:"抓住机会"}
    ],
    explanations: [
      "**now or never** 是「机不可失/要就要现在」，怂恿对方做决定的强力口号。",
      "近义：seize the day。例句：Apply now — it's now or never!"
    ]
  },
  {
    sentence: "I have no idea where he went after the party.",
    cid: fnv8("I have no idea where he went after the party."),
    translation: "我完全不知道派对后他去了哪。",
    chunks: ["I have no idea","where he went after the party."],
    hints: ["我完全不知道","他派对后去了哪"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/hæv/","/noʊ/","/aɪˈdɪə/"], pos:"习语·不知道", meaning:"我完全不知道"},
      {role:"宾语从句", color:"#c87033", phonetic:["/wer/","/hiː/","/went/","/ˈæftər/","/ðə/","/ˈpɑːrti/"], pos:"过去时", meaning:"他派对后去了哪里"}
    ],
    explanations: [
      "**have no idea** 是「完全不知道」，比 don't know 语气更强（确实不知道而非不想说）。",
      "近义：have no clue / haven't got a clue。例句：— Where's my passport? — No idea, have you checked your bag?"
    ]
  },
  {
    sentence: "I'm just kidding — don't take it seriously.",
    cid: fnv8("I'm just kidding — don't take it seriously."),
    translation: "我开玩笑呢，别当真。",
    chunks: ["I'm just kidding —","don't take it seriously."],
    hints: ["我开玩笑呢","别当真"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪm/","/dʒʌst/","/ˈkɪdɪŋ/"], pos:"现在进行时", meaning:"我只是开玩笑"},
      {role:"祈使句", color:"#7c5cbf", phonetic:["/doʊnt/","/teɪk/","/ɪt/","/ˈsɪriəsli/"], pos:"习语·别当真", meaning:"别把这话当真"}
    ],
    explanations: [
      "**just kidding** 是「开玩笑/逗你玩」，玩笑过头或朋友误会时立刻补充救场。",
      "近义：just joking / I'm messing with you。例句：— You got fired? — Just kidding, I got a raise!"
    ]
  },
  {
    sentence: "Take your time — the deadline is next Friday, not today.",
    cid: fnv8("Take your time — the deadline is next Friday, not today."),
    translation: "慢慢来，截止日期是下周五，不是今天。",
    chunks: ["Take your time —","the deadline is next Friday,","not today."],
    hints: ["慢慢来不急","截止是下周五","不是今天"],
    grammar: [
      {role:"习语·劝告", color:"#7c5cbf", phonetic:["/teɪk/","/jʊr/","/taɪm/"], pos:"习语·不急", meaning:"慢慢来、不用赶"},
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/ˈdedlaɪn/","/ɪz/","/nekst/","/ˈfraɪdeɪ/"], pos:"主系表", meaning:"截止日期是下周五"},
      {role:"否定状语", color:"#3358e0", phonetic:["/nɑːt/","/təˈdeɪ/"], pos:"否定状语", meaning:"不是今天"}
    ],
    explanations: [
      "**take your time** 是「慢慢来/不急」，给对方减压的友好表达，可用于工作/学习/约会/购物。",
      "近义：no rush / there's no hurry。例句：Take your time choosing — these shoes are a big investment."
    ]
  }
,
  {
    sentence: "\"We won the lottery!\" — \"You don't say!\"",
    cid: fnv8("\"We won the lottery!\" — \"You don't say!\""),
    translation: "「我们中彩票了！」——「真的假的！",
    chunks: ["\"We won the lottery!\"","— \"You don't say!\""],
    hints: ["我们中了彩票","你说真的？（表惊讶/反讽）"],
    grammar: [
      {role:"直接引语", color:"#c87033", phonetic:["/wiː/","/wʌn/","/ðə/","/ˈlɑːtəri/"], pos:"主谓宾·引语", meaning:"我们中了彩票"},
      {role:"回应习语", color:"#7c5cbf", phonetic:["/juː/","/doʊnt/","/seɪ/"], pos:"习语·感叹", meaning:"不会吧/真的假的"}
    ],
    explanations: [
      "**You don't say!** 高语境口语：字面『你不说我也知道』，实际两用——(1) 表惊讶：真的吗！(2) 反讽：谁不知道啊（语气拖长+降调）。",
      "中性场景表惊讶可用 No kidding! / Really? 例：— She quit her job. — You don't say!（她辞职了。——真的假的！）"
    ]
  }
];

/* 注册到 BUILTIN（按 P0 决策：不再依赖 builtins.js 占位壳）
 * 页面必须 builtins.js → oral8000.js → freq-idioms.js 顺序加载。 */
(function(){
  if(!window.BUILTIN){
    console.error("[freq-idioms.js] 未找到 window.BUILTIN：builtins.js 须在 freq-idioms.js 之前加载");
    return;
  }
  window.BUILTIN.push({
    id: "builtin-freq-idioms",
    builtin: true,
    name: "高频短语 · English Idioms",
    desc: "高频英语 idiom 短语：每个 idiom 嵌入完整例句，练习时填 idiom 短语本身",
    items: window.DATA_FREQ_IDIOMS
  });
})();
