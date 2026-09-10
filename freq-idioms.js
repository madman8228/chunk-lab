/* 高频短语 · English Idioms（运行态 389 句：103 种子 + batch3 26 + batch4 32 + batch5 39 + batch6 1 + batch7 25 + batch8 26 + batch9 22 + batch10 27 + batch11 24 + batch12 24 + batch13 26 + batch14 11 + batch15 3）
 * 数据源：extra/idioms-394.json（394 条 idioms，项目内资产，分批扩写；勿再引用 D:/tmp）
 * 批次主题：batch7（2026-09-10）= 态度/回应/边界类 25 条（态度表态、划边界、抱怨与劝告），
 *   顺带修正源数据错拼（hit the book→the books / of ones own accord / rub them the wrong way /
 *   pull somes leg 一类）—— 扩写时以正确拼写为准，源清单仅作词条索引。
 * batch8（2026-09-10）= 关心/安抚/澄清类 26 条，含拼写修正（what out→Watch out / it your turn→it's your turn）；
 *   句式规则：非末 chunk 禁止独立句末标点（.?!），两句合一用破折号/so 连接。
 * batch9（2026-09-10）= 道歉/感谢类 22 条（认错、致歉、致谢、托付），句式按破折号规则一次过。
 * batch10（2026-09-10）= 情感/邀约 + 鼓励赞美 + B 类修正 27 条（crush / only have eyes for you /
 *   drop you off / it's on me / one in a million / pull someone's leg / ease into it 等）。
 * batch11（2026-09-10）= 公共指令/秩序类 24 条（制止/驱赶 stop it·stop him·go away·get out of here、
 *   排队秩序 line up·form a line·cut in line·get in line、疏散安全 stand back·stay down·stay away、
 *   规矩警告 no tricks·don't blab·take it or leave it），含错拼修正 stay away form me→from me。
 * batch12（2026-09-10）= 冲突指责 + 情绪状态类 24 条（who do you think you are / drop the act /
 *   going too far / good mood / cranky / long face / ridiculous / put up with / stay out of it /
 *   have the heart / can't bear to 等）；撞车预检剔除 8 条库内已有同义条目（killing me / out of line /
 *   good for nothing / know your stuff / bombshell / rubbed me the wrong way / my apologies / of one's own accord）。
 * batch13（2026-09-10）= 观点/建议/让步 + 日常交际类 26 条（a word of advice / take it from me /
 *   be that as it may / play it by ear / anything you say / suppose so / have a problem with /
 *   we are even / have your way / do I have to / by the way / what's happening / feel at home /
 *   take the lead / drop the ball / go big or go home / one at a time / try my best / speed up 等）；
 *   预检升级为「词序列 + 内容词子集」双层判定，抓出 9 条时态/人称变体假阳性
 *   （have a crush on ← She has a crush on...；soak up ← soaked up；pick on ← picking on）。
 *   另核出 6 条被既有同义句覆盖（ask for it ← you asked for it / it's up to you ← up to you /
 *   make an excuse ← stop making excuses / think about it ← think it over / see you out / be mad at me→已收）。
 * batch14（2026-09-10）= A 类收尾 11 条（back up / sober up / strive to / spring into action /
 *   tomorrow is another day / don't let the grass grow under your feet / on his knees / get down /
 *   walk you out 等），含 B 类修正 2 条：how you gona get home→how are you gonna get home、
 *   work you home→work one's way through college（按正确习语形式收录）。
 *   —— 至此源清单中的 A 类干净条目已全部收完。
 * 覆盖进度（对照 extra/idioms-394.json 差集，详见 output/idioms-todo.json）：
 *   累计收录 188 条（batch7~15）→ **源清单 A 类已彻底清零**。
 * batch15（2026-09-10）= 补漏 3 条（get out of my face / don't suck up to sb / get loaded）。
 *   注意：差集复算 v1 脚本词干化不一致（dropped→dropp ≠ drop、making→mak ≠ make）产生假阳性，
 *   把「drop the ball / it's up to you / make an excuse / is something on your mind」误报为未收录，
 *   实际库内早有同义句（dropped the ball / is up to you / stop making excuses / what's on your mind）。
 *   **机械预检结论必须 grep 复核**，否则会造重复题。
 * 剩余差集（32 条中已收 3）全部不建议入库：
 *   ① C 类粗俗/攻击性：piss off / fuck up / up yours / bite me / cut the crap / I don't give a shit 等；
 *   ② D 类脏数据（错拼/乱码）：my appologies / what out / i see & i know / keep you chain up 等
 *      —— 其中 nerve、barge in、dribs and drabs、pulling my leg 等**正确形式库内早已收录**，无需再收；
 *   ③ 碎片不成句：encore / who wants / do something / give me your attitude 等。
 *   若将来要收 C 类，须先设计「口语强度/粗俗度标签」，否则不进学习流。
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
    ],
    distractors: [["The floods were","The storm was","A flood was"],["an act of fate.","the work of god.","an act of faith."]]
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
    ],
    distractors: [["He repeats","He had repeated","He started to repeat"],["his joke","the story","the punchline"],["again and again.","endlessly.","until it was stale."]]
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
    ],
    distractors: [["My boss was","My boss can be","The boss is"],["all bark and bite.","barking up the wrong tree.","a wolf in sheep's clothing."]]
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
    ],
    distractors: [["Someone seems","Nothing seems","Everything seems"],["missing here.","awkward here.","amiss there."]]
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
    ],
    distractors: [["I need","I wanted","I really want"],["freedom.","a break.","quiet."],["or something.","for once.","after all."]]
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
    ],
    distractors: [["He's","She was","She'll be"],["a mother","a student","a born teacher"],["by heart.","from the heart.","after all."]]
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
    ],
    distractors: [["Sorry I'm running late —","Sorry we're late —","Sorry I'm early —"],["better safe than sorry!","never too late to learn!","the sooner the better!"]]
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
    ],
    distractors: [["Birds of different feathers","Crows of a feather","Birds with feathers"],["fly together.","sing together.","migrate together."]]
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
    ],
    distractors: [["Save","Pack","Play"],["your B game","your game","your A-list"],["tonight.","this morning.","next week."]]
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
    ],
    distractors: [["I failed","I almost passed"],["by the seat of my pants.","against all odds.","in the nick of time."]]
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
    ],
    distractors: [["You're lying —","You're serious —","Are you joking —"],["get over it!","come on now!","drop it!"]]
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
    ],
    distractors: [["I bet","I guess","I doubt"],["she's","he was","he's not"],["coming up to you.","checking you out.","coming after you."]]
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
    ],
    distractors: [["I've become","I was","I'm"],["a night owl","a weekend warrior","a sports fan"],["all week.","every weekend.","last weekend."]]
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
    ],
    distractors: [["You don't"],["give yourself credit.","sell yourself short.","give yourself away."]]
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
    ],
    distractors: [["Practice it","Push it"],["when you make it","before you make it","until you feel it"]]
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
    ],
    distractors: [["This is","That was","That's not"],["a hot take.","a fresh look.","a fresh start."]]
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
    ],
    distractors: [["Learn not to overthink;","Try not to think;","Try not to panic;"],["go against the flow.","go with your gut.","go with the times."]]
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
    ],
    distractors: [["He's","She was","She's been"],["facing it alone","fighting it alone"],["that time.","at last.","for good."]]
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
    ],
    distractors: [["Give it time —","Bear with me —","Keep it up —"],["it'll get worse.","it's getting better.","you'll get better."]]
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
    ],
    distractors: [["She holds","He held","He still holds"],["his breath","a record"],["for all he's worth.","out of spite."]]
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
    ],
    distractors: [["Let it out;","Set it free;","Stop it;"],["don't rush it.","don't fight it.","don't overdo it."]]
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
    ],
    distractors: [["Feel","Help","Take"],["yourself useful.","yourself a drink.","yourself heard."]]
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
    ],
    distractors: [["No point","Not worth","No chance"],["to make a scene.","to get angry.","to cause trouble."]]
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
    ],
    distractors: [["Once in a while,","Now and then,","Every so often,"],["I order fast food.","I ate fast food.","I love fast food."]]
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
    ],
    distractors: [["Calm","Put","Gather"],["your act together.","your socks up."]]
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
    ],
    distractors: [["He has","She had","She doesn't have"],["a green thumb.","a sweet voice.","a sweet spot."]]
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
    ],
    distractors: [["Read it","Take everything"],["with a grain of truth.","seriously.","to heart."]]
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
    ],
    distractors: [["They're","We were","We've been"],["on the same team.","on the same side.","in the same boat."]]
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
    ],
    distractors: [["We are","You become","You're not"],["what you drink.","what you ate.","where you eat."]]
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
    ],
    distractors: [["We","People","She"],["put up with the Joneses.","keep up with the times.","keep up appearances."],["by buying a bigger house.","to buy a new car every year."]]
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
    ],
    distractors: [["We were young,","We're getting old,","We're hardly young,"],["so we'll","so don't","so why not"],["play it safe","take it slow","live it down"],["this winter.","all summer.","last summer."]]
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
    ],
    distractors: [["She needs two jobs","She had two jobs","She has two jobs"],["to buy a new house.","to support her family.","to save for retirement."]]
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
    ],
    distractors: [["Money matters.","Money counts."],["— he lost the contract","— he got the job"],["over time.","last night.","suddenly."]]
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
    ],
    distractors: [["The captain gave the team","The coach had given the team"],["a pep rally","a good talking-to","a heart-to-heart"],["after the final.","before the game.","during the final."]]
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
    ],
    distractors: [["Don't hurry,","Don't panic,","Don't cry,"],["you won't be","you should be"],["sick as a dog.","busy as a bee.","clear as day."],["after a long nap.","after a good meal.","before a good sleep."]]
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
    ],
    distractors: [["His soft voice","His deep voice","Her loud voice"],["treated me","rub me"],["the right way.","a wrong way."]]
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
    ],
    distractors: [["Sorry I was late","Sorry I'll be late","Sorry I'm early"],["— that's on you.","— it's on me.","— that's up to me."]]
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
    ],
    distractors: [["Talk it over","Work it out","Figure it out"],["before you decide","after you quit","before you start"],["your boss.","your career.","your company."]]
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
    ],
    distractors: [["Ask Tom for help","Follow Tom's advice","Ask Tom for a favor"],["— he doesn't know","— he thinks he knows"],["his way around.","his limits.","his things."]]
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
    ],
    distractors: [["He ignored the advice","He missed the warning","He heeded the warning"],["and got caught","and got fired","and got scolded"],["— he asked for help.","— he asks for it.","— he asked for more."]]
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
    ],
    distractors: [["Don't get me started","Don't get me down","Don't get it wrong"],["— I left the city,","— I like the country,"],["I just miss the noise.","I just love the quiet.","I just want the quiet."]]
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
    ],
    distractors: [["We're in a meeting,","We're in no hurry,","We're short on time,"],["so get to work.","so make it quick.","so get on with it."]]
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
    ],
    distractors: [["The boys cleaned the garden again","The kids wrecked the garden again","The boy wrecked the garden again"],["— accidents will happen.","— kids will be kids."]]
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
    ],
    distractors: [["The missing file was the last straw","The slow computer was the last straw","The broken printer was the tip of the iceberg"],["— I snapped.","— I complained.","— I cried."]]
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
    ],
    distractors: [["Enough said","Enough is never enough","That's enough"],["— stop blaming others.","— stop making promises.","— stop whining."]]
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
    ],
    distractors: [["You paid for the dinner","I pay for the dinner","You pay for the meal"],["and I'll book the movie","and you'll cover the movie"],["— call it quits.","— call it off.","— call it a day."]]
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
    ],
    distractors: [["Sorry to interrupt you,","Sorry to keep you,","Sorry to ask you,"],["but do you have the time?","but do you have a pen?","but are you in a hurry?"]]
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
    ],
    distractors: [["If you hate the job,","If you want the job,","If you get the job,"],["just give it up.","just think about it.","just take it."]]
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
    ],
    distractors: [["There are only four seats","There aren't enough seats","There are over five seats"],["— it's last come,","— it's first served,"],["first come.","last served."]]
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
    ],
    distractors: [["It's not a matter of time","It's only a matter of days","It's only a matter of money"],["before the truth comes up."]]
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
    ],
    distractors: [["What we eat tonight","Where we go tonight","When we eat tonight"],["is up to me.","is out of your hands.","is open to debate."]]
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
    ],
    distractors: [["The car hit me","The car almost missed me","The truck almost hit me"],["— that was scary!","— that was dangerous!","— that was lucky!"]]
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
    ],
    distractors: [["Keep your cool","Keep your fingers crossed","Keep it up"],["— worse days are coming.","— better days are gone.","— a new day is coming."]]
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
    ],
    distractors: [["I'll sign that contract —","I can't sign that contract —"],["no problem!","no doubt!"]]
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
    ],
    distractors: [["Look out,","Let's go,","Calm down,"],["the bus is already here!","the bus has just left!","the bus is almost full!"]]
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
    ],
    distractors: [["Hang up","Carry on","Wait on"],["a while —","two seconds —"],["I'll close the door.","I'll get the phone.","I'll lock the door."]]
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
    ],
    distractors: [["Hold on —","Just a moment —"],["I need to fix this first.","I need to check that first.","I want to check this first."]]
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
    ],
    distractors: [["You're in my way —","You're in my face —"],["move it!","stay away!","get back!"]]
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
    ],
    distractors: [["Lighten up —","Cheer on —","Perk up —"],["things will get worse.","things are getting better."]]
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
    ],
    distractors: [["I don't want to talk to you —","I don't want to hear you —","I want to see you —"],["get out!","drop dead!"]]
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
    ],
    distractors: [["Go first","Hurry up"],["and leave without me.","and eat without me.","and go without me."]]
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
    ],
    distractors: [["Enjoy","Get fun","Make fun"],["at the concert tonight!","at the game tonight!","at the party last night!"]]
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
    ],
    distractors: [["Watch out —","Listen up —"],["the meeting is at 3.","the meeting moved to 4.","the party moved to 3."]]
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
    ],
    distractors: [["So it goes"],["— I won't care anymore.","— I can't argue anymore.","— I won't talk anymore."]]
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
    ],
    distractors: [["I'll look after","I'll stay with","I'll fight for"],["you when you need me.","you through the hard times."]]
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
    ],
    distractors: [["That was a terrible save —","That was an amazing goal —","That was an amazing catch —"],["you win!","you made it!"]]
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
    ],
    distractors: [["Ladies first —","Be my guest —"],["please, go ahead.","please, wait outside."]]
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
    ],
    distractors: [["The taxi is waiting —","The taxi has left —","The bus is leaving —"],["hurry up!","move it!","step on it!"]]
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
    ],
    distractors: [["Go ahead —","Speak up —","Keep going —"],["I'm taking notes.","I'm waiting patiently.","I'm watching closely."]]
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
    ],
    distractors: [["Drop it —","Never mind —"],["I don't want it anymore.","I won't care anymore."]]
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
    ],
    distractors: [["Don't talk down","Don't shout back"],["to your parents.","to your teachers.","to your boss."]]
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
    ],
    distractors: [["That's enough —","That's that —","That's all —"],["I'm tired of this job.","I'm done with this place.","I'm done with these people."]]
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
    ],
    distractors: [["I haven't talked to you for ages —","I haven't seen you for a while —","I won't see you for ages —"],["what happened?","what's going on?","what's the matter?"]]
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
    ],
    distractors: [["Look around —","Ask everyone —","Ask again —"],["somebody might know.","somebody will know."]]
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
    ],
    distractors: [["I didn't hear that —","I didn't get that —"],["come in?","come over?","go again?"]]
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
    ],
    distractors: [["I'm trying to sleep —","I'm trying to work —","I'm trying to read —"],["pipe down!","drop it!","settle down!"]]
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
    ],
    distractors: [["Make yourself at home —","Suit yourself —","After you —"],["pour yourself some coffee.","help yourself to tea.","serve yourself some coffee."]]
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
    ],
    distractors: [["By all means","In no circumstances"],["should you touch that door.","should you open that window.","should you knock on that door."]]
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
    ],
    distractors: [["He runs the company","She runs the office","He owns the office"],["by the seat of his pants.","on the fly.","by the hour."]]
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
    ],
    distractors: [["Go hard on","Don't go easy on"],["the sugar — I'm on a diet.","the salt — I have high blood pressure.","the salt — I'm trying to stay healthy."]]
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
    ],
    distractors: [["I'm not used to","I can't stand","I won't get used to"],["getting up early.","staying up late.","going to bed early."]]
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
    ],
    distractors: [["Keep it down —","Keep it quiet —","Keep going —"],["you're doing badly.","you're getting better.","you're almost there."]]
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
    ],
    distractors: [["Big deal —","No problem —","No worries —"],["I'll fix it now.","I'll check it later.","I'll handle it later."]]
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
    ],
    distractors: [["Be there by three","Be there at four","Get there at three"],["on the spot.","on the clock.","at the dot."]]
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
    ],
    distractors: [["Can I take a pass"],["on lunch?","on the meeting?","on dinner tonight?"]]
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
    ],
    distractors: [["Wake up, kids —","Calm down, kids —","Keep quiet, kids —"],["it's dinnertime.","it's time to get up.","it's late."]]
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
    ],
    distractors: [["Dinner's on you tonight —","Dinner's for me tonight —"],["don't hurry.","don't be late."]]
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
    ],
    distractors: [["I was stuck","I was trapped"],["among the two offers.","between the three offers."]]
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
    ],
    distractors: [["I'm not at all worried","I'm low key excited","I'm extremely worried"],["for the exam.","during the exam."]]
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
    ],
    distractors: [["I totally forgot","I sort of remember","I sort of missed"],["what I said.","what you did.","when you said it."]]
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
    ],
    distractors: [["No wonder","Good thing"],["you couldn't take it.","you couldn't help it."]]
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
    ],
    distractors: [["I said yes,","I said nothing,","I shouted no,"],["so what!","deal with it!"]]
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
    ],
    distractors: [["He thinks","She hopes","She knows"],["she's hot.","she's no big deal."]]
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
    ],
    distractors: [["I'm sure —","I'm busy —","I'm ready —"],["I don't want help.","I don't need anyone."]]
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
    ],
    distractors: [["Let it out —","Let him go —"],["it's worth fighting.","it's not worth worrying about."]]
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
    ],
    distractors: [["Speak up —","Give up —"],["you broke the glass.","you dropped the vase."]]
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
    ],
    distractors: [["His dad is an","My dad was an","My dad is quite an"],["outgoing man.","open-minded man.","honest man."]]
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
    ],
    distractors: [["Trust me —","Hear me out —"],["I didn't mean to be rude.","I didn't mean to be late."]]
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
    ],
    distractors: [["I repeat,","As you say,"],["please pay the bill.","please pay no attention."]]
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
    ],
    distractors: [["No news","No report"],["during the lawsuit.","on the meeting."]]
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
    ],
    distractors: [["Please check","Please remember"],["that the door is closed.","that the window is locked.","that the door is open."]]
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
    ],
    distractors: [["That's well done —","That's well known —","That's well made —"],["I disagree.","I admit."]]
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
    ],
    distractors: [["I always want to see you again —","I never expect to see you again —"],["drop it!","drop by!"]]
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
    ],
    distractors: [["I dropped your cup by accident —","I broke your phone by accident —","I broke your cup on purpose —"],["your fault.","no big deal."]]
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
    ],
    distractors: [["Stop shouting at him —","Stop pushing him —","Stop relying on him —"],["he's twice your size.","he's half your age."]]
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
    ],
    distractors: [["We stood by the lake and","We sat by the sea and","We walked by the lake and"],["avoided","faced"],["the moonlight.","the fresh air.","the view."]]
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
    ],
    distractors: [["Don't forget","Don't wait for"],["this chance to work abroad.","this chance to travel abroad.","this chance to study hard."]]
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
    ],
    distractors: [["\"Can you help me move this car?\" —","\"Can you watch me move this box?\" —","\"Can you help me open this box?\" —"],["\"You wish!\"","\"No way!\""]]
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
    ],
    distractors: [["It's been a while —","It's been years —","It took a year —"],["time to move out.","time to cheer up.","time to grow up."]]
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
    ],
    distractors: [["After you quit,","Before you start,"],["step forward and think it over.","sit back and think it over."]]
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
    ],
    distractors: [["You fixed it in five hours —","You found it in five minutes —"],["nice try!","no way!"]]
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
    ],
    distractors: [["Cooking isn't","Patience was"],["my problem,","my concern,"],["I agree.","I guess."]]
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
    ],
    distractors: [["Don't worry — these things pass,","Don't cry — these things happen,"],["it matters","it comes"],["for everyone.","all the time."]]
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
    ],
    distractors: [["I've been feeling sick","I've been feeling tired"],["since I quit my job.","since I lost my dog.","since I failed the exam."]]
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
    ],
    distractors: [["I'd rather go together,","I'd rather not go alone,"],["but help yourself.","but be yourself."]]
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
    ],
    distractors: [["That's too much","That's so much"],["homework for tonight —","TV for today —"],["go home.","go to your room."]]
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
    ],
    distractors: [["I just agreed,","I almost refused,"],["but on the other hand","but after a while"],["I changed my mind.","I gave up."]]
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
    ],
    distractors: [["She was","She kept"],["watching someone","meeting someone"],["from school for months.","from work for weeks."]]
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
    ],
    distractors: [["Stop running around","Stop sitting around","Stop looking around"],["and finish your dinner.","and finish your chores."]]
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
    ],
    distractors: [["That magic show was really something —","That card trick was really something —"],["why did you do it?","when did you do it?"]]
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
    ],
    distractors: [["At fifty she's no spring chicken,","At forty she's a spring chicken,"],["but she walks every day.","but she looks young."]]
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
    ],
    distractors: [["Sleep it off","Put it off"],["and tell me your plans tomorrow.","and text me your decision tomorrow."]]
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
    ],
    distractors: [["The surprise party you planned","The birthday party you threw","The welcome party you threw"],["really made my week.","really ruined my day."]]
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
    ],
    distractors: [["His joke about her age","His comment about her weight"],["was way out of date.","was way too funny."]]
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
    ],
    distractors: [["We'd rather hit the road","We'd better take the road"],["before the weather gets bad.","before the road gets bad."]]
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
    ],
    distractors: [["Turn it off, you two —","Put it off, you two —"],["I'm trying to sleep.","I'm trying to rest."]]
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
    ],
    distractors: [["You passed the exam —","You survived the interview —"],["good luck!","so what!"]]
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
    ],
    distractors: [["Feel free to answer questions —","Feel free to ask for help —"],["by no means","by any means"],["stop me.","ignore me."]]
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
    ],
    distractors: [["The concert was starting —","The concert was almost sold out —"],["we showed up","we got tickets"],["without any trouble.","after a long wait."]]
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
    ],
    distractors: [["Don't hurry —","Don't cry —"],["I've got your number","You've got my back"],["no matter why.","no matter where."]]
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
    ],
    distractors: [["Whenever I'm in danger,","Whenever I'm in a hurry,"],["I listen to","I write to"],["my old friend.","my parents."]]
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
    ],
    distractors: [["That movie is killing me —","That joke is driving me crazy —"],["I can't stop smiling.","I can't stop to laugh."]]
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
    ],
    distractors: [["Save the jokes —","Cut the noise —"],["let's get started","let's get moving"],["for an hour.","for once."]]
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
    ],
    distractors: [["The builder worked carelessly","The builder made a mistake"],["and now the wall is falling.","and now the wall is shaking."]]
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
    ],
    distractors: [["She made good money","She saved good money"],["for that designer dress.","for that designer watch."]]
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
    ],
    distractors: [["Stop blaming yourself","Stop second-guessing me"],["and just write the email.","and just send the letter."]]
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
    ],
    distractors: [["So,","Oh,"],["what's wrong","what's changed"],["with you today?","with your family these days?"]]
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
    ],
    distractors: [["Count me in —","Sign me up —"],["I don't need to get up to speed","I need to get ahead"],["for this project.","with this project."]]
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
    ],
    distractors: [["You shouldn't copy my homework —","You can't steal my homework —"],["do it at your own pace.","write it on your own."]]
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
    ],
    distractors: [["He didn't like me,","He didn't trust me,"],["so I told him to take a seat.","so I told him to take a break."]]
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
    ],
    distractors: [["You dropped my laptop,","You borrowed my laptop,"],["so don't ask for advice —","so don't beg for a favor —"],["don't even try.","that's final."]]
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
    ],
    distractors: [["\"This plan won't help.\" —","\"This plan won't fail.\" —"],["\"You don't say!\"","\"You made it!\""]]
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
    ],
    distractors: [["The team missed the deadline","The team raised the price"],["and lost the biggest game.","and kept the biggest client."]]
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
    ],
    distractors: [["Hold your tongue —","Watch your step —"],["we haven't even paid the price yet.","we haven't even asked the price yet."]]
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
    ],
    distractors: [["Watch your back —","Watch your step —"],["that's not how you talk to your boss.","that's not how you talk to your friends."]]
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
    ],
    distractors: [["\"Can you fix the printer by Friday?\" —","\"Can you fix the computer by noon?\" —"],["\"I'll try my best.\"","\"I've already done it.\""]]
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
    ],
    distractors: [["Don't you ever","Don't you even"],["touch my laptop again!","borrow my phone again!"]]
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
    ],
    distractors: [["Off the record,","By the way,"],["I almost agreed","I never would agree"],["to that deal.","to that plan."]]
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
    ],
    distractors: [["Try anyway —","Apply now —"],["you never guess","you never tell"],["what has happened.","when it might happen."]]
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
    ],
    distractors: [["Hold a pose —","Say cheese —"],["this photo will be on the wall.","this photo will be in the album."]]
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
    ],
    distractors: [["The boss wants you —","The boss wants the coffee —"],["on the hour!","on time!"]]
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
    ],
    distractors: [["Write it down —","Make it clear —"],["I have a meeting in ten days.","I have an appointment in ten minutes."]]
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
    ],
    distractors: [["Don't push me —","Don't test me —"],["I already said yes twice.","I already said no once."]]
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
    ],
    distractors: [["Sit down","Get in"],["and make yourself a drink.","and make yourself useful."]]
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
    ],
    distractors: [["Leave it alone —","Put it down —"],["that box has clothes inside.","that box has no glass inside."]]
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
    ],
    distractors: [["Get off my phone —","Get out of my way —"],["I'll clean my room when I have to.","I'll clean my room when I can."]]
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
    ],
    distractors: [["She's kept an eye on","She's taken care of"],["her teacher.","her neighbor."],["since high school.","during middle school."]]
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
    ],
    distractors: [["Give me a hand —","Give me a chance —"],["I've been working nonstop for eight days.","I've been working here for eight hours."]]
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
    ],
    distractors: [["It's my turn tonight —","It's my treat tomorrow —"],["the dinner is at my place.","the dinner is at eight."]]
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
    ],
    distractors: [["One more thing —","By the way —"],["I need to grab my coat.","I need to find my keys."]]
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
    ],
    distractors: [["I have nothing to gain","I have nothing to hide"],["by telling you a lie.","by telling you the secret."]]
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
    ],
    distractors: [["You've been resting all day —","You've been working all night —"],["take it slow","take it back"],["this evening.","tomorrow."]]
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
    ],
    distractors: [["\"Work more hours?\" —","\"Work fewer days?\" —"],["\"Easy for me to say!\"","\"Hard for you to say!\""]]
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
    ],
    distractors: [["You can argue, yet","You can argue, though"],["in the middle of the day","at the end of the week"],["it's my fault.","it's my turn."]]
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
    ],
    distractors: [["Make it your way —","See it your way —"],["I'm done talking to you.","I'm done working with you."]]
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
    ],
    distractors: [["What's the point —","What's the problem —"],["you look excited?","you look tired?"]]
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
    ],
    distractors: [["He's good for anything —","He's known for nothing —"],["never starts a single task.","never finishes a single meal."]]
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
    ],
    distractors: [["Show some mercy —","Show some emotion —"],["that's your father you're yelling at.","that's your boss you're talking to."]]
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
    ],
    distractors: [["Don't get excited —","Don't get upset —"],["it's not your fault.","it's not your turn."]]
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
    ],
    distractors: [["\"Thanks for waiting!\" —","\"Thanks for coming!\" —"],["\"Don't forget it.\"","\"Don't repeat it.\""]]
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
    ],
    distractors: [["How long have you been","How old have you been"],["since you moved to Paris?","since you visited Berlin?"]]
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
    ],
    distractors: [["Get in touch —","Keep in mind —"],["I want to know where you're going.","I want to see how you're doing."]]
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
    ],
    distractors: [["You're tired —","You're wrong —"],["go for a walk!","go for broke!"]]
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
    ],
    distractors: [["Would you","Can I"],["give me a hand","give me a call"],["to the station tomorrow?","to the airport tonight?"]]
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
    ],
    distractors: [["Give me a hand —","Give me a break —"],["I'll be right here.","I'll be back soon."]]
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
    ],
    distractors: [["I'm looking forward for","I'm not looking forward to"],["meeting you this weekend.","seeing you next weekend."]]
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
    ],
    distractors: [["Have a good day","Make a good time"],["at the party —","at the meeting —"],["say hi to the crowd!","say goodbye to the band!"]]
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
    ],
    distractors: [["Get home soon —","Get there soon —"],["the whole team hates you.","the whole school misses you."]]
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
    ],
    distractors: [["Don't take it for real —","Don't take it seriously —"],["not everyone gets a second job.","not everyone gets a first chance."]]
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
    ],
    distractors: [["May I","Could you"],["have a talk with you","have a word with me"],["in public?","in a minute?"]]
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
    ],
    distractors: [["I'll cover the cost —","I'll hide the tip —"],["it's a steal!","it's a joke!"]]
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
    ],
    distractors: [["You made the last slice,","You bought the last slice,"],["and now you owe her.","and now you hate me."]]
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
    ],
    distractors: [["We need pasta, salad, soup —","We had pasta, salad, soup —"],["you order it,","you say it,"],["we've seen it.","we've lost it."]]
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
    ],
    distractors: [["Don't worry —","Don't hurry —"],["I'll do it later.","I'll do it with you."]]
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
    ],
    distractors: [["Look up —","Look down —"],["there's a car leaving!","there's a bus coming!"]]
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
    ],
    distractors: [["Watch me —","Watch on —"],["the floor is wet.","the wall is slippery."]]
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
    ],
    distractors: [["I need to know your name —","I need to know your address —"],["just take my word.","just say the truth."]]
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
    ],
    distractors: [["Don't worry about the dinner —","Don't worry about the bills —"],["leave it to you.","leave it alone."]]
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
    ],
    distractors: [["Make your own decision —","Take your own advice —"],["I'm bored on my own.","I'm not fine on my own."]]
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
    ],
    distractors: [["Come here,","Calm down,"],["we're going to be late for school.","we're going to be early for the movie."]]
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
    ],
    distractors: [["Let me try —","Let me guess —"],["I think we have the file on my desk.","I'm sure we have the file on the server."]]
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
    ],
    distractors: [["Really —","I bet —"],["you're telling me you want to quit school.","you're telling me you want to keep your job."]]
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
    ],
    distractors: [["I doubt it —","I forget it —"],["you don't want to talk about it tomorrow.","you want to talk about it right now."]]
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
    ],
    distractors: [["Not at all —","No problem —"],["I just ate before I came in.","I just ate before I went out."]]
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
    ],
    distractors: [["We're arriving tomorrow —","We're flying tomorrow —"],["not yet paid for.","not yet settled."]]
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
    ],
    distractors: [["Not bad,","Not yet,"],["just catching up on some sleep.","just catching up on some news."]]
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
    ],
    distractors: [["It's now or later —","It's tonight or never —"],["miss the chance!","grab the change!"]]
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
    ],
    distractors: [["I don't care","I have no doubt"],["where he went before the party.","where she went after the party."]]
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
    ],
    distractors: [["I'm just asking —","I'm just curious —"],["don't take it lightly.","don't bring it up."]]
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
    ],
    distractors: [["Hurry up —","Spend your time —"],["the deadline is next Monday,","the meeting is next Friday,"],["not tomorrow.","not this week."]]
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
    ],
    distractors: [["\"We won the game!\"","\"I won the lottery!\""],["— \"You said it!\"","— \"Don't say that!\""]]
  }
,
  {
    sentence: "The doctor wants to have a second look.",
    cid: fnv8("The doctor wants to have a second look."),
    translation: "医生想再看一遍（复核一下）。",
    chunks: ["The doctor wants to","have a second look."],
    hints: ["医生想","再看一遍"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/ðə/","/ˈdɒktə/","/wɒnts/","/tuː/"], pos:"一般现在时", meaning:"医生想"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/hæv/","/ə/","/ˈsekənd/","/lʊk/"], pos:"动词习语", meaning:"再看一遍、复核"}
    ],
    explanations: [
      "**have a second look** = 再看一遍、复核。比 look again 更强调「带着怀疑或求准确的态度再看」，常见于医疗、审稿、验货场景。",
      "近义：take another look / double-check。例句：The editor asked me to have a second look at the opening paragraph."
    ]
  },
  {
    sentence: "I have to hit the books tonight.",
    cid: fnv8("I have to hit the books tonight."),
    translation: "我今晚得啃书本了。",
    chunks: ["I have to","hit the books tonight."],
    hints: ["我得","今晚用功读书"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/hæv/","/tuː/"], pos:"情态动词", meaning:"我得"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/hɪt/","/ðə/","/bʊks/","/təˈnaɪt/"], pos:"动词习语", meaning:"今晚用功读书"}
    ],
    explanations: [
      "**hit the books** = 用功读书、啃书本。学生俚语，比 study 更口语，含「下苦功」的劲头。",
      "近义：buckle down（沉下心来）/ cram（考前突击）。例句：Finals are next week, so I'd better hit the books."
    ]
  },
  {
    sentence: "Don't worry, I'm working on it.",
    cid: fnv8("Don't worry, I'm working on it."),
    translation: "别担心，我正在处理。",
    chunks: ["Don't worry,","I'm working on it."],
    hints: ["别担心","我正在着手处理"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/doʊnt/","/ˈwʌri/"], pos:"祈使句", meaning:"别担心"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪm/","/ˈwɜːkɪŋ/","/ɒn/","/ɪt/"], pos:"现在进行时习语", meaning:"我正在处理"}
    ],
    explanations: [
      "**work on it** = 着手处理某事，强调「还在进行中」。常用来回应催促，暗示有进展、别急。",
      "近义：get on it（马上办）/ handle it（搞定它）。区别：work on 强调过程，handle 强调结果。例句：Give me an hour — I'm working on it."
    ]
  },
  {
    sentence: "On this team, I have the final say.",
    cid: fnv8("On this team, I have the final say."),
    translation: "在这个团队里，我说了算。",
    chunks: ["On this team,","I have the final say."],
    hints: ["在这个团队里","我说了算"],
    grammar: [
      {role:"介宾短语", color:"#3358e0", phonetic:["/ɒn/","/ðɪs/","/tiːm/"], pos:"介词短语", meaning:"在这个团队里"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/hæv/","/ðə/","/ˈfaɪnl/","/seɪ/"], pos:"名词习语", meaning:"我有最终决定权"}
    ],
    explanations: [
      "**have the final say** = 有最终决定权、拍板权。职场高频，强调「最后那一下由谁定」。",
      "近义：have the last word / call the shots。例句：The client has the final say on the design."
    ]
  },
  {
    sentence: "I'll keep my eye out for a cheaper flight.",
    cid: fnv8("I'll keep my eye out for a cheaper flight."),
    translation: "我会留意有没有更便宜的航班。",
    chunks: ["I'll keep my eye out","for a cheaper flight."],
    hints: ["我会留心盯着","更便宜的航班"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪl/","/kiːp/","/maɪ/","/aɪ/","/aʊt/"], pos:"动词习语", meaning:"我会留意着"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/fɔː/","/ə/","/ˈtʃiːpə/","/flaɪt/"], pos:"介词短语", meaning:"更便宜的航班"}
    ],
    explanations: [
      "**keep an eye out (for)** = 留意、留心看着。语气比 watch 轻，常指顺便帮忙盯着。eye 用单数。",
      "辨析：keep an eye out for 是「找还没出现的」，keep an eye on 是「看着已有的」。例句：Keep an eye out for my package."
    ]
  },
  {
    sentence: "It was touch and go for a while, but she pulled through.",
    cid: fnv8("It was touch and go for a while, but she pulled through."),
    translation: "有一阵子情况危急，但她挺过来了。",
    chunks: ["It was touch and go for a while,","but she pulled through."],
    hints: ["一度吉凶难料","但她挺了过来"],
    grammar: [
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/ɪt/","/wɒz/","/tʌtʃ/","/ænd/","/ɡoʊ/","/fɔːr/","/ə/","/waɪl/"], pos:"形容词习语", meaning:"一度吉凶难料"},
      {role:"主谓", color:"#c87033", phonetic:["/bʌt/","/ʃiː/","/pʊld/","/θruː/"], pos:"一般过去时", meaning:"但她挺了过来"}
    ],
    explanations: [
      "**touch and go** = 情况危急、吉凶未卜，差一点就出事。原指船擦着礁石走，后泛指险情。",
      "**pull through** = 渡过难关、康复过来。例句：The surgery was touch and go, but he pulled through."
    ]
  },
  {
    sentence: "The news was a bombshell.",
    cid: fnv8("The news was a bombshell."),
    translation: "这个消息如同重磅炸弹。",
    chunks: ["The news was","a bombshell."],
    hints: ["这个消息是","爆炸性消息"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/ðə/","/njuːz/","/wɒz/"], pos:"主系表", meaning:"这个消息是"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/ə/","/ˈbɒmʃel/"], pos:"名词习语", meaning:"爆炸性消息"}
    ],
    explanations: [
      "**a bombshell** = 爆炸性消息、惊天内幕。多指让人震惊的负面消息（丑闻、突然辞职等）。",
      "搭配：drop a bombshell（抛出重磅消息）。例句：She dropped a bombshell when she announced she was leaving."
    ]
  },
  {
    sentence: "My boss's attitude is my way or the highway.",
    cid: fnv8("My boss's attitude is my way or the highway."),
    translation: "我老板的态度是：不听我的就走人。",
    chunks: ["My boss's attitude is","my way or the highway."],
    hints: ["我老板的态度是","不听我的就滚蛋"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/maɪ/","/ˈbɒsɪz/","/ˈætɪtjuːd/","/ɪz/"], pos:"主系表", meaning:"我老板的态度是"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/maɪ/","/weɪ/","/ɔːr/","/ðə/","/ˈhaɪweɪ/"], pos:"固定习语", meaning:"不听我的就滚蛋"}
    ],
    explanations: [
      "**my way or the highway** 字面「走我的路，不然上高速（走人）」，形容独断专行、不容异议。",
      "近义：take it or leave it（爱要不要）。例句：He's a my-way-or-the-highway kind of manager."
    ]
  },
  {
    sentence: "Don't count your chickens before they hatch.",
    cid: fnv8("Don't count your chickens before they hatch."),
    translation: "别高兴太早，蛋还没孵出来呢。",
    chunks: ["Don't count your chickens","before they hatch."],
    hints: ["别急着数小鸡","在它们孵出来之前"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/kaʊnt/","/jɔːr/","/ˈtʃɪkɪnz/"], pos:"谚语（前半）", meaning:"别急着数小鸡"},
      {role:"时间状语从句", color:"#c87033", phonetic:["/bɪˈfɔː/","/ðeɪ/","/hætʃ/"], pos:"时间状语从句", meaning:"在它们孵出来之前"}
    ],
    explanations: [
      "**Don't count your chickens before they hatch** 谚语：别高兴太早，别指望还没到手的东西。",
      "中文对应「别打如意算盘」「八字还没一撇」。省略版：Don't count your chickens. 例句：The contract isn't signed yet — don't count your chickens."
    ]
  },
  {
    sentence: "She left the party of her own accord.",
    cid: fnv8("She left the party of her own accord."),
    translation: "她主动离开了聚会。",
    chunks: ["She left the party","of her own accord."],
    hints: ["她离开了聚会","出于自愿"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/ʃiː/","/left/","/ðə/","/ˈpɑːti/"], pos:"一般过去时", meaning:"她离开了聚会"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/əv/","/hɜːr/","/oʊn/","/əˈkɔːd/"], pos:"介词习语", meaning:"出于自愿"}
    ],
    explanations: [
      "**of one's own accord** = 自愿地、主动地，没人逼。偏正式书面语，比 by oneself 更强调「出于本人意愿」。",
      "近义：on one's own initiative / voluntarily。例句：He resigned of his own accord."
    ]
  },
  {
    sentence: "He's been playing fast and loose with the rules.",
    cid: fnv8("He's been playing fast and loose with the rules."),
    translation: "他一直在钻规则的空子。",
    chunks: ["He's been","playing fast and loose","with the rules."],
    hints: ["他一直","行事轻率、不守规矩","对待这些规则"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/hiːz/","/biːn/"], pos:"现在完成进行时", meaning:"他一直"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ˈpleɪɪŋ/","/fɑːst/","/ænd/","/luːs/"], pos:"动词习语", meaning:"行事轻率不负责"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/wɪð/","/ðə/","/ruːlz/"], pos:"介词短语", meaning:"对待这些规则"}
    ],
    explanations: [
      "**play fast and loose (with)** = 玩弄、反复无常、不守规矩。原指街头骗术（飞快挪动赌注），现多指对规则或承诺不认真。",
      "常见搭配对象：the rules / the facts / people's feelings。例句：He played fast and loose with the facts."
    ]
  },
  {
    sentence: "That deal is robbing Peter to pay Paul.",
    cid: fnv8("That deal is robbing Peter to pay Paul."),
    translation: "那笔交易就是拆东墙补西墙。",
    chunks: ["That deal is","robbing Peter to pay Paul."],
    hints: ["那笔交易是","拆东墙补西墙"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ðæt/","/diːl/","/ɪz/"], pos:"主系表", meaning:"那笔交易是"},
      {role:"谚语·表语", color:"#7c5cbf", phonetic:["/ˈrɒbɪŋ/","/ˈpiːtə/","/tuː/","/peɪ/","/pɔːl/"], pos:"固定谚语", meaning:"拆东墙补西墙"}
    ],
    explanations: [
      "**rob Peter to pay Paul** = 拆东墙补西墙，借新债还旧债。字面「抢彼得的钱还给保罗」，源自中世纪教会税制之争。",
      "例句：Taking a new loan to cover the old one is just robbing Peter to pay Paul."
    ]
  },
  {
    sentence: "His remarks rubbed me the wrong way.",
    cid: fnv8("His remarks rubbed me the wrong way."),
    translation: "他那些话让我听着很不舒服。",
    chunks: ["His remarks","rubbed me the wrong way."],
    hints: ["他的那些话","让我很不舒服"],
    grammar: [
      {role:"主语", color:"#c87033", phonetic:["/hɪz/","/rɪˈmɑːrks/"], pos:"名词短语", meaning:"他的那些话"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/rʌbd/","/miː/","/ðə/","/rɒŋ/","/weɪ/"], pos:"动词习语", meaning:"让我很不舒服"}
    ],
    explanations: [
      "**rub someone the wrong way** = 惹人不快、让人听着别扭。字面「逆着毛摸」，强调说不清缘由的别扭感。",
      "反义：rub someone the right way（讨人喜欢）。例句：His tone rubbed me the wrong way from the start."
    ]
  },
  {
    sentence: "She is as mild as a dove.",
    cid: fnv8("She is as mild as a dove."),
    translation: "她性情温和得像只鸽子。",
    chunks: ["She is","as mild as a dove."],
    hints: ["她是","温顺得像鸽子"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/ʃiː/","/ɪz/"], pos:"主系表", meaning:"她是"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/æz/","/maɪld/","/æz/","/ə/","/dʌv/"], pos:"明喻习语", meaning:"性情极其温和"}
    ],
    explanations: [
      "**as mild as a dove** = 像鸽子一样温顺，形容人性格极其柔和、不争不闹。",
      "同结构明喻：as busy as a bee（忙得像蜜蜂）/ as cool as a cucumber（镇定自若）。例句：She's as mild as a dove, but she never backs down on principles."
    ]
  },
  {
    sentence: "Thanks for being my rock through all this.",
    cid: fnv8("Thanks for being my rock through all this."),
    translation: "谢谢你在这段艰难里做我的依靠。",
    chunks: ["Thanks for being my rock","through all this."],
    hints: ["谢谢你当我的靠山","经历这一切"],
    grammar: [
      {role:"习语·致谢", color:"#7c5cbf", phonetic:["/θæŋks/","/fɔːr/","/ˈbiːɪŋ/","/maɪ/","/rɒk/"], pos:"名词习语", meaning:"谢谢你做我的依靠"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/θruː/","/ɔːl/","/ðɪs/"], pos:"介词短语", meaning:"经历这一切"}
    ],
    explanations: [
      "**be someone's rock** = 做某人的靠山、定海神针。指在困难时给人稳定支持的那个人。",
      "可加冠词说 a rock。例句：After the accident, my sister was my rock."
    ]
  },
  {
    sentence: "A good seaman is known in bad weather.",
    cid: fnv8("A good seaman is known in bad weather."),
    translation: "好水手要在坏天气里见真章。",
    chunks: ["A good seaman","is known in bad weather."],
    hints: ["优秀的水手","要在恶劣天气里才看得出"],
    grammar: [
      {role:"谚语主语", color:"#c87033", phonetic:["/ə/","/ɡʊd/","/ˈsiːmən/"], pos:"名词短语", meaning:"优秀的水手"},
      {role:"谚语·表语", color:"#7c5cbf", phonetic:["/ɪz/","/noʊn/","/ɪn/","/bæd/","/ˈweðə/"], pos:"谚语（被动式）", meaning:"在恶劣天气里才看得出来"}
    ],
    explanations: [
      "**A good seaman is known in bad weather** 谚语：真本事要在困境中见分晓。中文对应「疾风知劲草」。",
      "变体：A good sailor is known in a storm. 例句：He stayed calm when the project crashed — a good seaman is known in bad weather."
    ]
  },
  {
    sentence: "You really know your stuff.",
    cid: fnv8("You really know your stuff."),
    translation: "你确实很懂行。",
    chunks: ["You really","know your stuff."],
    hints: ["你确实","很懂行、有本事"],
    grammar: [
      {role:"状语", color:"#3358e0", phonetic:["/juː/","/ˈrɪəli/"], pos:"副词状语", meaning:"你确实"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/noʊ/","/jɔːr/","/stʌf/"], pos:"动词习语", meaning:"很懂行、有本事"}
    ],
    explanations: [
      "**know one's stuff** = 懂行、业务过硬。称赞别人专业能力时的常见口语表达，stuff 不可数。",
      "近义：know the ropes（懂门道）/ know one's onions（英式俚语）。例句：She's only 25, but she really knows her stuff."
    ]
  },
  {
    sentence: "Don't push me, I'm already at my limit.",
    cid: fnv8("Don't push me, I'm already at my limit."),
    translation: "别逼我，我已经到极限了。",
    chunks: ["Don't push me,","I'm already at my limit."],
    hints: ["别逼我","我已到极限了"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/pʊʃ/","/miː/"], pos:"祈使句", meaning:"别逼我"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/aɪm/","/ɔːlˈredi/","/æt/","/maɪ/","/ˈlɪmɪt/"], pos:"习语", meaning:"我已经到极限了"}
    ],
    explanations: [
      "**push someone** 在这里不是「推」而是「逼、催到极限」。Don't push me 是划边界的高频口语。",
      "近义：Don't test my patience（别考验我的耐心）。例句：Don't push me — I've had a terrible day."
    ]
  },
  {
    sentence: "You're impossible, you never listen.",
    cid: fnv8("You're impossible, you never listen."),
    translation: "你真不可理喻，从来不听人说话。",
    chunks: ["You're impossible,","you never listen."],
    hints: ["你真不可理喻","你从不听人说话"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/jʊr/","/ɪmˈpɒsəbl/"], pos:"主系表", meaning:"你真是不可理喻"},
      {role:"主谓", color:"#c87033", phonetic:["/juː/","/ˈnevə/","/ˈlɪsn/"], pos:"一般现在时", meaning:"你从不听人说话"}
    ],
    explanations: [
      "**You're impossible** 口语里不是「你不可能」，而是埋怨人「你真是没治了、没法讲道理」。",
      "语气偏亲昵的抱怨（情侣、家人之间常用），比 you're unreasonable 轻。例句：You're impossible! I give up."
    ]
  },
  {
    sentence: "It's none of your business who I date.",
    cid: fnv8("It's none of your business who I date."),
    translation: "我跟谁约会不关你的事。",
    chunks: ["It's none of your business","who I date."],
    hints: ["这不关你的事","我跟谁约会"],
    grammar: [
      {role:"习语·主句", color:"#7c5cbf", phonetic:["/ɪts/","/nʌn/","/əv/","/jɔːr/","/ˈbɪznəs/"], pos:"固定习语", meaning:"这不关你的事"},
      {role:"宾语从句", color:"#c87033", phonetic:["/huː/","/aɪ/","/deɪt/"], pos:"宾语从句", meaning:"我跟谁约会"}
    ],
    explanations: [
      "**none of your business** = 不关你的事、少管闲事。语气直接，对陌生人说属冒犯；熟人之间可带玩笑。",
      "委婉版：I'd rather not say. 例句：Who I date is none of your business."
    ]
  },
  {
    sentence: "Stop joking, you're killing me!",
    cid: fnv8("Stop joking, you're killing me!"),
    translation: "别逗了，你笑死我了。",
    chunks: ["Stop joking,","you're killing me!"],
    hints: ["别开玩笑了","你笑死我了"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/stɒp/","/ˈdʒoʊkɪŋ/"], pos:"祈使句", meaning:"别开玩笑了"},
      {role:"习语·感叹", color:"#7c5cbf", phonetic:["/jʊr/","/ˈkɪlɪŋ/","/miː/"], pos:"习语", meaning:"你笑死我了"}
    ],
    explanations: [
      "**you're killing me** 不是「你要杀我」，而是夸张口语：笑死我了 / 你太逗了（也可表示被折磨得受不了）。",
      "语境定意：讲笑话时 = 笑死人；被反复催命时 = 你饶了我吧。例句：Stop it, you're killing me!"
    ]
  },
  {
    sentence: "Get over yourself and apologize.",
    cid: fnv8("Get over yourself and apologize."),
    translation: "别自我感觉良好了，道个歉吧。",
    chunks: ["Get over yourself","and apologize."],
    hints: ["别自以为了不起","然后去道歉"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡet/","/ˈoʊvə/","/jɔːrˈself/"], pos:"动词习语", meaning:"别自以为是"},
      {role:"祈使句", color:"#c87033", phonetic:["/ænd/","/əˈpɒlədʒaɪz/"], pos:"祈使句并列", meaning:"然后去道歉"}
    ],
    explanations: [
      "**get over yourself** = 别自我感觉良好、别太把自己当回事。带责备意味，要对方面对现实。",
      "近义：Get off your high horse（别摆架子）。例句：Get over yourself — not everyone is watching you."
    ]
  },
  {
    sentence: "Don't nag me about the dishes.",
    cid: fnv8("Don't nag me about the dishes."),
    translation: "别为洗碗的事唠叨我。",
    chunks: ["Don't nag me","about the dishes."],
    hints: ["别没完没了地催我","为了洗碗那点事"],
    grammar: [
      {role:"祈使动词", color:"#e74c7a", phonetic:["/doʊnt/","/næɡ/","/miː/"], pos:"祈使句", meaning:"别唠叨我"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/əˈbaʊt/","/ðə/","/ˈdɪʃɪz/"], pos:"介词短语", meaning:"为了洗碗这件事"}
    ],
    explanations: [
      "**nag** = 喋喋不休地唠叨、反复挑剔。比 remind（提醒）负面，含「烦人」意味。",
      "近义：nag at / keep on at（英式）。例句：He nags me about the dishes every single night."
    ]
  },
  {
    sentence: "You're out of line with that comment.",
    cid: fnv8("You're out of line with that comment."),
    translation: "你那句话说得越界了。",
    chunks: ["You're out of line","with that comment."],
    hints: ["你越界了","就那句评论来说"],
    grammar: [
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/jʊr/","/aʊt/","/əv/","/laɪn/"], pos:"形容词习语", meaning:"你越界了"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/wɪð/","/ðæt/","/ˈkɒment/"], pos:"介词短语", meaning:"就那句评论而言"}
    ],
    explanations: [
      "**out of line** = 越界、出格、不合规矩，指言行越过了应有的界限。带批评意味。",
      "反义：in line（守规矩）。例句：His remarks were completely out of line."
    ]
  },
  {
    sentence: "I'm sick of it, I quit.",
    cid: fnv8("I'm sick of it, I quit."),
    translation: "我受够了，不干了。",
    chunks: ["I'm sick of it,","I quit."],
    hints: ["我受够了","我不干了"],
    grammar: [
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/aɪm/","/sɪk/","/əv/","/ɪt/"], pos:"形容词习语", meaning:"我受够了"},
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/kwɪt/"], pos:"一般现在时", meaning:"我不干了"}
    ],
    explanations: [
      "**be sick of** = 对某事厌烦透了。语气比 be tired of 更强，接近「忍无可忍」。",
      "近义：be fed up with / be done with。例句：I'm sick of his excuses."
    ]
  }
,
  {
    sentence: "Are you all right — you look a little pale.",
    cid: fnv8("Are you all right — you look a little pale."),
    translation: "你还好吗？你脸色有点发白。",
    chunks: ["Are you all right —","you look a little pale."],
    hints: ["你还好吗","你脸色有点发白"],
    grammar: [
      {role:"疑问句", color:"#c87033", phonetic:["/ɑːr/","/juː/","/ɔːl/","/raɪt/"], pos:"主系表疑问句", meaning:"你还好吗"},
      {role:"主系表", color:"#3358e0", phonetic:["/juː/","/lʊk/","/ə/","/ˈlɪtl/","/peɪl/"], pos:"系动词+表语", meaning:"你看起来有点苍白"}
    ],
    explanations: [
      "**all right** = 没事、还好。关心他人状态的高频开场，比 Are you okay? 稍正式一点，也常写作 alright。",
      "近义：Are you OK? / Is everything all right? 例句：You fell off your bike — are you all right?"
    ]
  },
  {
    sentence: "Are you okay — you seem a bit off today.",
    cid: fnv8("Are you okay — you seem a bit off today."),
    translation: "你还好吧？你今天有点不对劲。",
    chunks: ["Are you okay —","you seem a bit off today."],
    hints: ["你还好吧","你今天状态不太对"],
    grammar: [
      {role:"疑问句", color:"#c87033", phonetic:["/ɑːr/","/juː/","/oʊˈkeɪ/"], pos:"主系表疑问句", meaning:"你还好吧"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/juː/","/siːm/","/ə/","/bɪt/","/ɒf/","/təˈdeɪ/"], pos:"系动词+习语表语", meaning:"你今天有点不对劲"}
    ],
    explanations: [
      "**a bit off** = 有点不对劲、状态不好。off 在这里表示「不寻常、不舒服」，比 sick 委婉，可指身体也可指情绪。",
      "近义：not yourself / a little down。例句：He seems a bit off since he got back from the trip."
    ]
  },
  {
    sentence: "Don't take it to heart — he was just joking.",
    cid: fnv8("Don't take it to heart — he was just joking."),
    translation: "别往心里去。他只是开个玩笑。",
    chunks: ["Don't take it to heart —","he was just joking."],
    hints: ["别往心里去","他只是开玩笑"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/teɪk/","/ɪt/","/tuː/","/hɑːrt/"], pos:"祈使句+动词习语", meaning:"别往心里去"},
      {role:"主谓", color:"#c87033", phonetic:["/hiː/","/wəz/","/dʒʌst/","/ˈdʒoʊkɪŋ/"], pos:"过去进行时", meaning:"他只是在开玩笑"}
    ],
    explanations: [
      "**take it to heart** = 把话往心里去、太当真。多用于安慰被批评或被开玩笑的人，否定式 Don't take it to heart 是高频安慰语。",
      "近义：Don't let it get to you. / Don't dwell on it. 例句：His comments were unfair, but don't take them to heart."
    ]
  },
  {
    sentence: "Whatever happens, I'm here for you.",
    cid: fnv8("Whatever happens, I'm here for you."),
    translation: "无论发生什么，我都在你身边。",
    chunks: ["Whatever happens,","I'm here for you."],
    hints: ["无论发生什么","我都在你身边"],
    grammar: [
      {role:"状语从句", color:"#c87033", phonetic:["/wətˈevər/","/ˈhæpənz/"], pos:"让步状语从句", meaning:"无论发生什么"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪm/","/hɪr/","/fɔːr/","/juː/"], pos:"习语句型", meaning:"我支持你、陪着你"}
    ],
    explanations: [
      "**be here for you** = 我在你身边、随时支持你。安慰场景的高频承诺句，强调「不是空话，我人就在」。",
      "近义：I've got your back. / You can count on me. 例句：Losing a job is hard, but remember I'm here for you."
    ]
  },
  {
    sentence: "Is something bothering you — you can tell me.",
    cid: fnv8("Is something bothering you — you can tell me."),
    translation: "有什么心事吗？你可以跟我说。",
    chunks: ["Is something bothering you —","you can tell me."],
    hints: ["有什么事困扰你吗","你可以告诉我"],
    grammar: [
      {role:"疑问句", color:"#c87033", phonetic:["/ɪz/","/ˈsʌmθɪŋ/","/ˈbɑːðərɪŋ/","/juː/"], pos:"现在进行时疑问句", meaning:"有什么事在困扰你吗"},
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/kæn/","/tel/","/miː/"], pos:"情态动词句", meaning:"你可以告诉我"}
    ],
    explanations: [
      "**bother** = 打扰、使烦恼。Is something bothering you? 比 What's wrong? 更委婉，暗示「我注意到你状态不对」。",
      "近义：Is something on your mind? / Did something happen? 例句：You've been quiet all night — is something bothering you?"
    ]
  },
  {
    sentence: "You've been quiet all day — what's on your mind?",
    cid: fnv8("You've been quiet all day — what's on your mind?"),
    translation: "你一整天都没说话。你在想什么呢？",
    chunks: ["You've been quiet all day —","what's on your mind?"],
    hints: ["你一整天都很安静","你在想什么"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/juːv/","/biːn/","/ˈkwaɪət/","/ɔːl/","/deɪ/"], pos:"现在完成时", meaning:"你一整天都很安静"},
      {role:"习语·疑问", color:"#7c5cbf", phonetic:["/wʌts/","/ɒn/","/jɔːr/","/maɪnd/"], pos:"名词习语", meaning:"你在想什么"}
    ],
    explanations: [
      "**on one's mind** = 挂在心上、有心事。What's on your mind? 关心的是「在想什么烦心事」，比 What do you think? 更体贴。",
      "区别：take one's mind off（转移注意力）/ keep in mind（记住）。例句：You look worried — what's on your mind?"
    ]
  },
  {
    sentence: "Look on the bright side — nobody got hurt.",
    cid: fnv8("Look on the bright side — nobody got hurt."),
    translation: "往好处想嘛。没有人受伤。",
    chunks: ["Look on the bright side —","nobody got hurt."],
    hints: ["往好处想","没人受伤"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/lʊk/","/ɒn/","/ðə/","/braɪt/","/saɪd/"], pos:"祈使句+名词习语", meaning:"往好处想"},
      {role:"主谓", color:"#c87033", phonetic:["/ˈnoʊbədi/","/ɡɑːt/","/hɜːrt/"], pos:"一般过去时被动", meaning:"没有人受伤"}
    ],
    explanations: [
      "**look on the bright side** = 往好处想、看到积极一面。安慰翻车现场的标准句，常接 but/nobody 引出「万幸」。",
      "近义：Every cloud has a silver lining. 例句：We lost the game, but look on the bright side — we played as a team."
    ]
  },
  {
    sentence: "You remembered my birthday — that's so sweet!",
    cid: fnv8("You remembered my birthday — that's so sweet!"),
    translation: "你记得我的生日。太贴心了！",
    chunks: ["You remembered my birthday —","that's so sweet!"],
    hints: ["你记得我的生日","太贴心了"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/rɪˈmembərd/","/maɪ/","/ˈbɜːrθdeɪ/"], pos:"一般过去时", meaning:"你记得我的生日"},
      {role:"习语·感叹", color:"#7c5cbf", phonetic:["/ðæts/","/soʊ/","/swiːt/"], pos:"习语感叹句", meaning:"太贴心了"}
    ],
    explanations: [
      "**That's so sweet!** = 太贴心了、好暖心。回应别人的细心举动，sweet 在口语里指「体贴暖心」，不是「甜」。",
      "近义：That's so thoughtful of you. / You're so kind. 例句：He brought me soup when I was sick. That's so sweet!"
    ]
  },
  {
    sentence: "Don't worry — we'll get through this together.",
    cid: fnv8("Don't worry — we'll get through this together."),
    translation: "别担心。我们会一起挺过去的。",
    chunks: ["Don't worry —","we'll get through this together."],
    hints: ["别担心","我们会一起渡过难关"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/doʊnt/","/ˈwʌri/"], pos:"否定祈使句", meaning:"别担心"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/wil/","/ɡet/","/θruː/","/ðɪs/","/təˈɡeðər/"], pos:"短语动词+将来时", meaning:"我们会一起渡过难关"}
    ],
    explanations: [
      "**get through** = 挺过、熬过（难关）。get through this 强调「这段困难会过去」，加 together 是给对方打气的力量感。",
      "近义：pull through（挺过来，多指病痛）/ ride it out。例句：Money is tight this month, but we'll get through this together."
    ]
  },
  {
    sentence: "Everyone ran out of the building — what's going on?",
    cid: fnv8("Everyone ran out of the building — what's going on?"),
    translation: "大家都跑出了大楼。发生什么事了？",
    chunks: ["Everyone ran out of the building —","what's going on?"],
    hints: ["大家都跑出大楼","发生什么了"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/ˈevriwʌn/","/ræn/","/aʊt/","/əv/","/ðə/","/ˈbɪldɪŋ/"], pos:"一般过去时+短语动词", meaning:"大家都跑出了大楼"},
      {role:"习语·疑问", color:"#7c5cbf", phonetic:["/wʌts/","/ˈɡoʊɪŋ/","/ɒn/"], pos:"进行时习语", meaning:"发生什么事了"}
    ],
    explanations: [
      "**go on** = 发生。What's going on? 是询问现场情况的万能句，比 What happened? 更强调「此刻正在进行」。",
      "近义：What's happening? / What's the matter? 例句：Why is everyone gathered here? What's going on?"
    ]
  },
  {
    sentence: "You've been sighing all morning — what's wrong?",
    cid: fnv8("You've been sighing all morning — what's wrong?"),
    translation: "你一早上都在叹气。怎么了？",
    chunks: ["You've been sighing all morning —","what's wrong?"],
    hints: ["你一早上都在叹气","怎么了"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/juːv/","/biːn/","/ˈsaɪɪŋ/","/ɔːl/","/ˈmɔːrnɪŋ/"], pos:"现在完成进行时", meaning:"你一早上都在叹气"},
      {role:"疑问句", color:"#c87033", phonetic:["/wʌts/","/rɔːŋ/"], pos:"主系表疑问句", meaning:"怎么了"}
    ],
    explanations: [
      "**What's wrong?** = 怎么了、出什么事了。最直接的关心句，wrong 指「有问题、不对劲」，语气比 What's going on? 更私人。",
      "近义：What's the matter? / Is something wrong? 例句：You look upset. What's wrong?"
    ]
  },
  {
    sentence: "You're not yourself today — is everything fine at home?",
    cid: fnv8("You're not yourself today — is everything fine at home?"),
    translation: "你今天不太对劲。家里一切都好吗？",
    chunks: ["You're not yourself today —","is everything fine at home?"],
    hints: ["你今天状态不对","家里还好吗"],
    grammar: [
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/jʊr/","/nɑːt/","/jɔːrˈself/","/təˈdeɪ/"], pos:"习语表语", meaning:"你今天不像平时的你"},
      {role:"疑问句", color:"#c87033", phonetic:["/ɪz/","/ˈevriθɪŋ/","/faɪn/","/æt/","/hoʊm/"], pos:"主系表疑问句", meaning:"家里一切都好吗"}
    ],
    explanations: [
      "**not oneself** = 不对劲、不像平时的自己。指情绪或状态明显反常，是委婉关心的经典句式。",
      "近义：You seem a bit off. / You're acting strange today. 例句：You've hardly eaten anything — you're not yourself today."
    ]
  },
  {
    sentence: "Just to be clear, the deadline is Friday, not Monday.",
    cid: fnv8("Just to be clear, the deadline is Friday, not Monday."),
    translation: "先说清楚，截止日期是周五，不是周一。",
    chunks: ["Just to be clear,","the deadline is Friday, not Monday."],
    hints: ["先说清楚","截止日期是周五不是周一"],
    grammar: [
      {role:"习语·开场", color:"#7c5cbf", phonetic:["/dʒʌst/","/tuː/","/biː/","/klɪr/"], pos:"习语插入语", meaning:"先说清楚"},
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/ˈdedlaɪn/","/ɪz/","/fraɪdeɪ/","/nɑːt/","/ˈmʌndeɪ/"], pos:"一般现在时", meaning:"截止日期是周五不是周一"}
    ],
    explanations: [
      "**just to be clear** = 先说清楚、确认一下。职场高频开场，用于消除歧义，比 to be honest 语气更中性。",
      "近义：To be clear / Just so we're on the same page. 例句：Just to be clear, this discount applies today only."
    ]
  },
  {
    sentence: "He always promises a lot, if you know what I mean.",
    cid: fnv8("He always promises a lot, if you know what I mean."),
    translation: "他总是许下很多承诺，你懂我意思吧。",
    chunks: ["He always promises a lot,","if you know what I mean."],
    hints: ["他总是许很多诺","你懂我意思吧"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/hiː/","/ˈɔːlweɪz/","/ˈprɑːmɪsɪz/","/ə/","/lɑːt/"], pos:"一般现在时", meaning:"他总是许下很多承诺"},
      {role:"习语·插入语", color:"#7c5cbf", phonetic:["/ɪf/","/juː/","/noʊ/","/wʌt/","/aɪ/","/miːn/"], pos:"习语插入语", meaning:"你懂我意思吧"}
    ],
    explanations: [
      "**you know what I mean** = 你懂我意思吧。暗示「话里有话，不便挑明」，口语里常缩略成 you know what I'm saying / know what I mean?",
      "近义：if you catch my drift. / you get me? 例句：He's generous with words, if you know what I mean."
    ]
  },
  {
    sentence: "You really got me the tickets — do you mean it?",
    cid: fnv8("You really got me the tickets — do you mean it?"),
    translation: "你真的给我搞到票了？你是认真的吗？",
    chunks: ["You really got me the tickets —","do you mean it?"],
    hints: ["你真的弄到票了","你是认真的吗"],
    grammar: [
      {role:"疑问句", color:"#c87033", phonetic:["/juː/","/ˈriːəli/","/ɡɑːt/","/miː/","/ðə/","/ˈtɪkɪts/"], pos:"一般过去时疑问", meaning:"你真的给我弄到票了"},
      {role:"习语·疑问", color:"#7c5cbf", phonetic:["/duː/","/juː/","/miːn/","/ɪt/"], pos:"习语疑问句", meaning:"你是认真的吗"}
    ],
    explanations: [
      "**mean it** = 说真的、不是开玩笑。Do you mean it? 用于确认对方的话是真心还是随口一说，惊喜或怀疑时都用。",
      "近义：Are you serious? / Really? 例句：You're giving me your old laptop? Do you mean it?"
    ]
  },
  {
    sentence: "The bill looks wrong — it doesn't make sense.",
    cid: fnv8("The bill looks wrong — it doesn't make sense."),
    translation: "这账单看着不对。完全说不通。",
    chunks: ["The bill looks wrong —","it doesn't make sense."],
    hints: ["账单看着不对","说不通"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/bɪl/","/lʊks/","/rɔːŋ/"], pos:"系动词+表语", meaning:"账单看起来不对"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ɪt/","/ˈdʌznt/","/meɪk/","/sens/"], pos:"名词习语", meaning:"说不通、不合理"}
    ],
    explanations: [
      "**make sense** = 说得通、有道理。否定式 doesn't make sense 表示「逻辑上讲不通」，质疑账单、规则、解释时都用它。",
      "近义：That doesn't add up. 例句：The math is right, but the answer still doesn't make sense."
    ]
  },
  {
    sentence: "Thanks for the warning — i'll take a raincoat with me.",
    cid: fnv8("Thanks for the warning — i'll take a raincoat with me."),
    translation: "谢谢提醒。我会带件雨衣。",
    chunks: ["Thanks for the warning —","i'll take a raincoat with me."],
    hints: ["谢谢提醒","我会带上雨衣"],
    grammar: [
      {role:"习语·致谢", color:"#7c5cbf", phonetic:["/θæŋks/","/fɔːr/","/ðə/","/ˈwɔːrnɪŋ/"], pos:"习语致谢句", meaning:"谢谢提醒"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪl/","/teɪk/","/ə/","/ˈreɪnkoʊt/","/wɪð/","/miː/"], pos:"将来时", meaning:"我会带上雨衣"}
    ],
    explanations: [
      "**thanks for the warning** = 谢谢提醒。回应别人好意告知风险，比 thanks for telling me 更明确指向「预警」。",
      "近义：Good to know. / I appreciate the heads-up. 例句：Thanks for the warning — I'll avoid that road at night."
    ]
  },
  {
    sentence: "Watch out — there's a step behind you.",
    cid: fnv8("Watch out — there's a step behind you."),
    translation: "小心！你身后有一级台阶。",
    chunks: ["Watch out —","there's a step behind you."],
    hints: ["小心","你身后有台阶"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/wɑːtʃ/","/aʊt/"], pos:"短语动词祈使句", meaning:"小心、注意"},
      {role:"there be 句型", color:"#c87033", phonetic:["/ðerz/","/ə/","/step/","/bɪˈhaɪnd/","/juː/"], pos:"存在句", meaning:"你身后有一级台阶"}
    ],
    explanations: [
      "**watch out** = 小心、当心。紧急提醒的高频短语动词，比 be careful 更急迫，常单独喊出来。",
      "近义：Look out! / Mind the step. 例句：Watch out! The floor is wet."
    ]
  },
  {
    sentence: "To make a long story short, we missed the last train.",
    cid: fnv8("To make a long story short, we missed the last train."),
    translation: "长话短说，我们错过了末班车。",
    chunks: ["To make a long story short,","we missed the last train."],
    hints: ["长话短说","我们错过末班车"],
    grammar: [
      {role:"习语·开场", color:"#7c5cbf", phonetic:["/tuː/","/meɪk/","/ə/","/lɔːŋ/","/ˈstɔːri/","/ʃɔːrt/"], pos:"习语插入语", meaning:"长话短说"},
      {role:"主谓宾", color:"#c87033", phonetic:["/wiː/","/mɪst/","/ðə/","/læst/","/treɪn/"], pos:"一般过去时", meaning:"我们错过了末班车"}
    ],
    explanations: [
      "**make a long story short** = 长话短说。讲述冗长经历前先给结论，口语也常用短版 long story short。",
      "近义：To cut a long story short（英式）/ bottom line。例句：To make a long story short, we got lost and arrived an hour late."
    ]
  },
  {
    sentence: "I only have five minutes, so please make it brief.",
    cid: fnv8("I only have five minutes, so please make it brief."),
    translation: "我只有五分钟，请说得简短些。",
    chunks: ["I only have five minutes,","so please make it brief."],
    hints: ["我只有五分钟","请简短些"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈoʊnli/","/hæv/","/faɪv/","/ˈmɪnɪts/"], pos:"一般现在时", meaning:"我只有五分钟"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/soʊ/","/pliːz/","/meɪk/","/ɪt/","/briːf/"], pos:"祈使句+习语", meaning:"请说得简短些"}
    ],
    explanations: [
      "**make it brief** = 说得简短些。职场会议高频，brief 作形容词指「简明扼要」，it 指你要说的内容。",
      "近义：Keep it short. / Get to the point. 例句：The boss is busy — make it brief."
    ]
  },
  {
    sentence: "Stop beating around the bush and come to the point.",
    cid: fnv8("Stop beating around the bush and come to the point."),
    translation: "别绕弯子了，直说重点吧。",
    chunks: ["Stop beating around the bush","and come to the point."],
    hints: ["别绕弯子","直说重点"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/stɑːp/","/ˈbiːtɪŋ/","/əˈraʊnd/","/ðə/","/bʊʃ/"], pos:"动名词+习语祈使句", meaning:"别拐弯抹角"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ənd/","/kʌm/","/tuː/","/ðə/","/pɔɪnt/"], pos:"习语祈使句", meaning:"直奔主题"}
    ],
    explanations: [
      "**beat around the bush** = 拐弯抹角、绕弯子。源自狩猎时用棍子打灌木赶猎物，引申为「不直入正题」。",
      "**come to the point** = 直说重点。与前者是一对反义搭配，常连用催对方进入正题。例句：Stop beating around the bush and come to the point."
    ]
  },
  {
    sentence: "Open the door, please — it's urgent!",
    cid: fnv8("Open the door, please — it's urgent!"),
    translation: "请开门！事情很紧急！",
    chunks: ["Open the door, please —","it's urgent!"],
    hints: ["请开门","很紧急"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/ˈoʊpən/","/ðə/","/dɔːr/","/pliːz/"], pos:"祈使句", meaning:"请开门"},
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/ˈɜːrdʒənt/"], pos:"主系表", meaning:"情况紧急"}
    ],
    explanations: [
      "**urgent** = 紧急的、十万火急。指需要立刻处理，医疗、工作、快递场景通用，语气比 important 强得多。",
      "近义：It can't wait. / It's an emergency. 例句：Sorry to call so late, but it's urgent."
    ]
  },
  {
    sentence: "I'm still learning English, so could you speak slower?",
    cid: fnv8("I'm still learning English, so could you speak slower?"),
    translation: "你能说慢一点吗？我还在学英语。",
    chunks: ["I'm still learning English,","so could you speak slower?"],
    hints: ["我还在学英语","所以能说慢点吗"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪm/","/stɪl/","/ˈlɜːrnɪŋ/","/ˈɪŋɡlɪʃ/"], pos:"现在进行时", meaning:"我还在学英语"},
      {role:"疑问句", color:"#c87033", phonetic:["/kʊd/","/juː/","/spiːk/","/ˈsloʊər/"], pos:"情态动词疑问句", meaning:"你能说慢一点吗"}
    ],
    explanations: [
      "**Could you speak slower?** = 能说慢一点吗？Could 比 Can 更客气；更礼貌的版本是 Could you speak more slowly, please?",
      "近义：Could you slow down a little? 例句：Could you speak slower? English isn't my first language."
    ]
  },
  {
    sentence: "I need your advice, so do you have a second?",
    cid: fnv8("I need your advice, so do you have a second?"),
    translation: "你有空吗？我需要你的建议。",
    chunks: ["I need your advice,","so do you have a second?"],
    hints: ["我需要你的建议","所以你有一分钟吗"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/niːd/","/jɔːr/","/ədˈvaɪs/"], pos:"一般现在时", meaning:"我需要你的建议"},
      {role:"习语·疑问", color:"#7c5cbf", phonetic:["/duː/","/juː/","/hæv/","/ə/","/ˈsekənd/"], pos:"习语疑问句", meaning:"你有一小会儿时间吗"}
    ],
    explanations: [
      "**have a second** = 有一小会儿空。second 这里指「片刻」，比 have time 更轻量，暗示「很快就好」。",
      "近义：Do you have a minute? / Got a sec? 例句：Do you have a second? I want to run something by you."
    ]
  },
  {
    sentence: "I set the table, so it's your turn to do the dishes.",
    cid: fnv8("I set the table, so it's your turn to do the dishes."),
    translation: "我摆好了餐具，所以轮到你洗碗了。",
    chunks: ["I set the table,","so it's your turn to do the dishes."],
    hints: ["我摆好了餐具","轮到你洗碗"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/set/","/ðə/","/ˈteɪbl/"], pos:"一般过去时", meaning:"我摆好了餐具"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/soʊ/","/ɪts/","/jɔːr/","/tɜːrn/","/tuː/","/duː/","/ðə/","/ˈdɪʃɪz/"], pos:"习语句型", meaning:"轮到你洗碗了"}
    ],
    explanations: [
      "**it's your turn to do sth** = 轮到你做某事了。turn 表示「轮流的机会」，家庭分工、游戏排队都靠它。",
      "近义：You're up. / Over to you. 例句：I cooked dinner, so it's your turn to wash up."
    ]
  },
  {
    sentence: "Please keep an eye on it — I'll be back in ten minutes.",
    cid: fnv8("Please keep an eye on it — I'll be back in ten minutes."),
    translation: "你能帮我看着点吗？我十分钟后回来。",
    chunks: ["Please keep an eye on it —","I'll be back in ten minutes."],
    hints: ["请你帮忙照看","我十分钟后回来"],
    grammar: [
      {role:"习语·疑问", color:"#7c5cbf", phonetic:["/kæn/","/juː/","/kiːp/","/ən/","/aɪ/","/ɒn/","/ɪt/"], pos:"习语疑问句", meaning:"你能帮忙照看吗"},
      {role:"主系表", color:"#c87033", phonetic:["/aɪl/","/biː/","/bæk/","/ɪn/","/ten/","/ˈmɪnɪts/"], pos:"将来时", meaning:"我十分钟后回来"}
    ],
    explanations: [
      "**keep an eye on** = 照看、留意。eye 用单数是习惯用法，指「持续盯着」，托人看包、看孩子、看锅都用它。",
      "区别：keep an eye out for（留意寻找某物）。例句：Keep an eye on my bag while I buy tickets."
    ]
  }
,
  {
    sentence: "If I sound rude, I don't mean it.",
    cid: fnv8("If I sound rude, I don't mean it."),
    translation: "如果我听起来很粗鲁，我不是故意的。",
    chunks: ["If I sound rude,","I don't mean it."],
    hints: ["如果我听起来粗鲁","我不是故意的"],
    grammar: [
      {role:"条件状语从句", color:"#c87033", phonetic:["/ɪf/","/aɪ/","/saʊnd/","/ruːd/"], pos:"if 引导条件句", meaning:"如果我听起来粗鲁"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/doʊnt/","/miːn/","/ɪt/"], pos:"习语句型", meaning:"我不是故意的"}
    ],
    explanations: [
      "**mean it** = 当真的、故意的。否定式 I don't mean it 是道歉高频句，表示「话出口但不是那个意思」。",
      "近义：I didn't mean that. / No offense intended. 例句：Sorry if I hurt your feelings — I don't mean it."
    ]
  },
  {
    sentence: "I forgot our anniversary — I feel really bad.",
    cid: fnv8("I forgot our anniversary — I feel really bad."),
    translation: "我忘了我们的纪念日，感觉糟透了。",
    chunks: ["I forgot our anniversary —","I feel really bad."],
    hints: ["我忘了我们的纪念日","我难受极了"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/fərˈɡɑːt/","/aʊər/","/ˌænɪˈvɜːrsəri/"], pos:"一般过去时", meaning:"我忘了我们的纪念日"},
      {role:"主系表", color:"#c87033", phonetic:["/aɪ/","/fiːl/","/ˈriːəli/","/bæd/"], pos:"系动词+表语", meaning:"我感觉很糟糕"}
    ],
    explanations: [
      "**feel really bad** = 感到非常过意不去。bad 在这里指「内疚」，不是身体难受；比 sorry 更强调自责的情绪。",
      "近义：I feel terrible about it. / I feel so guilty. 例句：I snapped at you earlier — I feel really bad."
    ]
  },
  {
    sentence: "The files got deleted — it's all my fault.",
    cid: fnv8("The files got deleted — it's all my fault."),
    translation: "文件被删掉了，全怪我。",
    chunks: ["The files got deleted —","it's all my fault."],
    hints: ["文件被删了","全是我的错"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/ðə/","/faɪlz/","/ɡɑːt/","/dɪˈliːtɪd/"], pos:"get 被动语态", meaning:"文件被删掉了"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/ɪts/","/ɔːl/","/maɪ/","/fɔːlt/"], pos:"习语表语", meaning:"全是我的错"}
    ],
    explanations: [
      "**it's all my fault** = 全是我的错。主动揽责的标准句，all 加强「一个都赖不掉」的语气。",
      "近义：I'm entirely to blame. / My bad.（更随意）。反问版：How is it my fault? 例句：Don't blame the intern — it's all my fault."
    ]
  },
  {
    sentence: "It's Thursday, not Wednesday — my mistake.",
    cid: fnv8("It's Thursday, not Wednesday — my mistake."),
    translation: "是周四不是周三，我搞错了。",
    chunks: ["It's Thursday, not Wednesday —","my mistake."],
    hints: ["是周四不是周三","我弄错了"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/ˈθɜːrzdeɪ/","/nɑːt/","/ˈwenzdeɪ/"], pos:"主系表+否定纠正", meaning:"今天是周四不是周三"},
      {role:"习语·口语", color:"#7c5cbf", phonetic:["/maɪ/","/mɪˈsteɪk/"], pos:"习语口语", meaning:"我的错"}
    ],
    explanations: [
      "**my mistake** = 我的错、我搞错了。认错的最短版本，多用于纠正事实性错误（记错时间、看错名单），语气轻。",
      "近义：My bad.（更口语）/ Sorry, I got it wrong. 例句：The meeting is at three? My mistake — it's at four."
    ]
  },
  {
    sentence: "I lost the tickets — this is my fault.",
    cid: fnv8("I lost the tickets — this is my fault."),
    translation: "我把票弄丢了，这是我的错。",
    chunks: ["I lost the tickets —","this is my fault."],
    hints: ["我把票弄丢了","这是我的错"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/lɔːst/","/ðə/","/ˈtɪkɪts/"], pos:"一般过去时", meaning:"我把票弄丢了"},
      {role:"主系表", color:"#c87033", phonetic:["/ðɪs/","/ɪz/","/maɪ/","/fɔːlt/"], pos:"主系表", meaning:"这是我的错"}
    ],
    explanations: [
      "**this is my fault** = 这是我的错。比 it's my fault 更具体指向「眼前这件事」，认错时指明责任归属。",
      "区别：it's all my fault（全是我的错，揽全部）/ it's partly my fault（部分是我的错）。例句：We missed the exit because I was talking — this is my fault."
    ]
  },
  {
    sentence: "The launch failed, and I take full responsibility.",
    cid: fnv8("The launch failed, and I take full responsibility."),
    translation: "发布失败了，我承担全部责任。",
    chunks: ["The launch failed,","and I take full responsibility."],
    hints: ["发布失败了","我承担全部责任"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/ðə/","/lɔːntʃ/","/feɪld/"], pos:"一般过去时", meaning:"发布失败了"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ənd/","/aɪ/","/teɪk/","/fʊl/","/rɪˌspɑːnsəˈbɪləti/"], pos:"动词习语", meaning:"我承担全部责任"}
    ],
    explanations: [
      "**take full responsibility** = 承担全部责任。正式度最高的揽责句，职场、公开声明通用，比 sorry 更有担当感。",
      "近义：I'm accountable for this. / The buck stops with me. 例句：The shipment was late, and I take full responsibility."
    ]
  },
  {
    sentence: "I'm awful sorry about the noise last night.",
    cid: fnv8("I'm awful sorry about the noise last night."),
    translation: "昨晚吵到你了，实在抱歉。",
    chunks: ["I'm awful sorry","about the noise last night."],
    hints: ["实在非常抱歉","昨晚的噪音"],
    grammar: [
      {role:"习语·道歉", color:"#7c5cbf", phonetic:["/aɪm/","/ˈɔːfl/","/ˈsɑːri/"], pos:"习语强调结构", meaning:"实在非常抱歉"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/əˈbaʊt/","/ðə/","/nɔɪz/","/læst/","/naɪt/"], pos:"介词短语", meaning:"关于昨晚的噪音"}
    ],
    explanations: [
      "**awful sorry** = 非常抱歉。awful 在这里是「非常」的口语强化词（不是「糟糕」），美国南方口语尤其常见，相当于 terribly sorry。",
      "近义：terribly sorry / awfully sorry。例句：I'm awful sorry to trouble you again."
    ]
  },
  {
    sentence: "I'm sorry about this mess in the kitchen.",
    cid: fnv8("I'm sorry about this mess in the kitchen."),
    translation: "厨房乱成这样，很抱歉。",
    chunks: ["I'm sorry","about this mess in the kitchen."],
    hints: ["很抱歉","厨房的混乱"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/aɪm/","/ˈsɑːri/"], pos:"主系表", meaning:"我很抱歉"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/əˈbaʊt/","/ðɪs/","/mes/","/ɪn/","/ðə/","/ˈkɪtʃɪn/"], pos:"介词短语", meaning:"为厨房的混乱"}
    ],
    explanations: [
      "**sorry about...** = 为……抱歉。about 后接具体事物，比 sorry for 更口语；mess 指乱七八糟的状态。",
      "近义：Sorry for the mess. / Excuse the mess. 例句：Come on in — sorry about the mess."
    ]
  },
  {
    sentence: "Sorry to keep you waiting — the traffic was terrible.",
    cid: fnv8("Sorry to keep you waiting — the traffic was terrible."),
    translation: "让你久等了，路上太堵了。",
    chunks: ["Sorry to keep you waiting —","the traffic was terrible."],
    hints: ["让你久等了","路上太堵"],
    grammar: [
      {role:"习语·致歉", color:"#7c5cbf", phonetic:["/ˈsɑːri/","/tuː/","/kiːp/","/juː/","/ˈweɪtɪŋ/"], pos:"习语致歉句", meaning:"让你久等了"},
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/ˈtræfɪk/","/wəz/","/ˈterəbl/"], pos:"一般过去时", meaning:"交通太糟糕"}
    ],
    explanations: [
      "**keep you waiting** = 让你一直等。Sorry to keep you waiting 是迟到标准开场，比 Sorry I'm late 多一层「我知道你在等」的体谅。",
      "近义：Sorry for the delay. / Sorry I'm late. 例句：Sorry to keep you waiting — the meeting ran over."
    ]
  },
  {
    sentence: "Sorry to barge in — is this seat taken?",
    cid: fnv8("Sorry to barge in — is this seat taken?"),
    translation: "冒昧打扰了，这个座位有人吗？",
    chunks: ["Sorry to barge in —","is this seat taken?"],
    hints: ["冒昧闯入","这个座位有人吗"],
    grammar: [
      {role:"习语·致歉", color:"#7c5cbf", phonetic:["/ˈsɑːri/","/tuː/","/bɑːrdʒ/","/ɪn/"], pos:"短语动词致歉句", meaning:"冒昧打扰"},
      {role:"疑问句", color:"#c87033", phonetic:["/ɪz/","/ðɪs/","/siːt/","/ˈteɪkən/"], pos:"被动语态疑问句", meaning:"这个座位被占了吗"}
    ],
    explanations: [
      "**barge in** = 闯入、贸然打断。barge 本义是「横冲直撞」，barge in 带自知理亏的劲儿，道歉时用很自然。",
      "近义：Sorry to interrupt. / Sorry to crash in on you. 例句：Sorry to barge in while you're eating."
    ]
  },
  {
    sentence: "My apologies for the late reply.",
    cid: fnv8("My apologies for the late reply."),
    translation: "回复晚了，非常抱歉。",
    chunks: ["My apologies","for the late reply."],
    hints: ["我深表歉意","回复晚了"],
    grammar: [
      {role:"习语·致歉", color:"#7c5cbf", phonetic:["/maɪ/","/əˈpɑːlədʒiz/"], pos:"名词习语", meaning:"我深表歉意"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/fɔːr/","/ðə/","/leɪt/","/rɪˈplaɪ/"], pos:"介词短语", meaning:"为迟来的回复"}
    ],
    explanations: [
      "**my apologies** = 我深表歉意。名词化的道歉，比 I'm sorry 正式，邮件、职场高频；apology 用复数表示诚意。",
      "近义：Please accept my apologies. / My sincere apologies. 例句：My apologies for missing the call — I was in a tunnel."
    ]
  },
  {
    sentence: "I sincerely apologize for what I said yesterday.",
    cid: fnv8("I sincerely apologize for what I said yesterday."),
    translation: "我为我昨天说的话诚恳道歉。",
    chunks: ["I sincerely apologize","for what I said yesterday."],
    hints: ["我诚恳道歉","为昨天说的话"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/sɪnˈsɪrli/","/əˈpɑːlədʒaɪz/"], pos:"一般现在时+状语", meaning:"我诚恳地道歉"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/fɔːr/","/wʌt/","/aɪ/","/sed/","/ˈjestərdeɪ/"], pos:"介词+宾语从句", meaning:"为我昨天所说的话"}
    ],
    explanations: [
      "**sincerely apologize** = 诚恳道歉。sincerely（真诚地）是道歉的强度词，正式场合或真心伤到人时用。",
      "近义：I owe you an apology. / I sincerely regret it. 例句：I sincerely apologize for the confusion my email caused."
    ]
  },
  {
    sentence: "I shouldn't have shouted at you — do you forgive me?",
    cid: fnv8("I shouldn't have shouted at you — do you forgive me?"),
    translation: "我不该冲你吼，你能原谅我吗？",
    chunks: ["I shouldn't have shouted at you —","do you forgive me?"],
    hints: ["我本不该冲你吼","你能原谅我吗"],
    grammar: [
      {role:"情态完成时", color:"#c87033", phonetic:["/aɪ/","/ˈʃʊdnt/","/həv/","/ˈʃaʊtɪd/","/æt/","/juː/"], pos:"shouldn't have done", meaning:"我本不该冲你吼"},
      {role:"疑问句", color:"#c87033", phonetic:["/duː/","/juː/","/fərˈɡɪv/","/miː/"], pos:"一般疑问句", meaning:"你能原谅我吗"}
    ],
    explanations: [
      "**shouldn't have done** = 本不该做（却做了）。表对过去的自责，道歉时先认错再求原谅，是很诚恳的句式。",
      "近义：I was out of line. / Can you ever forgive me?（更重）。例句：I shouldn't have said that — please forgive me."
    ]
  },
  {
    sentence: "You stepped on his foot — say you're sorry.",
    cid: fnv8("You stepped on his foot — say you're sorry."),
    translation: "你踩到他的脚了，快说对不起。",
    chunks: ["You stepped on his foot —","say you're sorry."],
    hints: ["你踩到他的脚了","快说对不起"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/stept/","/ɒn/","/hɪz/","/fʊt/"], pos:"一般过去时", meaning:"你踩到了他的脚"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/seɪ/","/jʊr/","/ˈsɑːri/"], pos:"习语祈使句", meaning:"说声对不起"}
    ],
    explanations: [
      "**say you're sorry** = 说声对不起。大人催小孩道歉的经典句，对成年人用会带命令甚至讽刺味，注意场景。",
      "近义：Apologize to him. / Say sorry right now. 例句：You took her toy — say you're sorry."
    ]
  },
  {
    sentence: "Don't pout — I'll buy you an ice cream.",
    cid: fnv8("Don't pout — I'll buy you an ice cream."),
    translation: "别撅嘴了，我给你买冰淇淋。",
    chunks: ["Don't pout —","I'll buy you an ice cream."],
    hints: ["别撅嘴了","我给你买冰淇淋"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/doʊnt/","/paʊt/"], pos:"否定祈使句", meaning:"别撅嘴生气"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪl/","/baɪ/","/juː/","/ən/","/aɪs/","/kriːm/"], pos:"将来时+双宾语", meaning:"我给你买个冰淇淋"}
    ],
    explanations: [
      "**pout** = 撅嘴、闹别扭。指不满时嘟起嘴的样子，孩子和撒娇的恋人都常用，Don't pout 带哄人的语气。",
      "近义：Don't sulk.（闷闷不乐）/ Don't give me that look. 例句：Don't pout — we'll go to the park tomorrow."
    ]
  },
  {
    sentence: "Don't mention it — it's my pleasure.",
    cid: fnv8("Don't mention it — it's my pleasure."),
    translation: "别客气，帮你是我的荣幸。",
    chunks: ["Don't mention it —","it's my pleasure."],
    hints: ["别提了不用谢","这是我的荣幸"],
    grammar: [
      {role:"习语·回应", color:"#7c5cbf", phonetic:["/doʊnt/","/ˈmenʃn/","/ɪt/"], pos:"习语回应句", meaning:"不用客气"},
      {role:"习语·回应", color:"#7c5cbf", phonetic:["/ɪts/","/maɪ/","/ˈpleʒər/"], pos:"习语回应句", meaning:"这是我的荣幸"}
    ],
    explanations: [
      "**don't mention it** = 别客气、不值一提。回应感谢的经典句，意思是「这点小事别放嘴上」。",
      "**it's my pleasure** = 我的荣幸。比 don't mention it 更热情，服务行业、朋友间通用，也可单说 My pleasure."
    ]
  },
  {
    sentence: "Your help is greatly appreciated.",
    cid: fnv8("Your help is greatly appreciated."),
    translation: "十分感谢你的帮助。",
    chunks: ["Your help is","greatly appreciated."],
    hints: ["你的帮助","被非常感激"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/jʊr/","/help/","/ɪz/"], pos:"主语+系动词", meaning:"你的帮助"},
      {role:"被动表语", color:"#3358e0", phonetic:["/ˈɡreɪtli/","/əˈpriːʃieɪtɪd/"], pos:"被动语态表语", meaning:"被深深地感激"}
    ],
    explanations: [
      "**(much/greatly) appreciated** = 不胜感激。被动式致谢，邮件、正式场合高频；口语缩略成 Much appreciated.",
      "近义：Thank you so much. / I'm very grateful. 例句：Your prompt reply is much appreciated."
    ]
  },
  {
    sentence: "I'm truly grateful for your help with the report.",
    cid: fnv8("I'm truly grateful for your help with the report."),
    translation: "你帮我做报告，我真心感激。",
    chunks: ["I'm truly grateful","for your help with the report."],
    hints: ["我真心感激","你帮我做报告"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/aɪm/","/ˈtruːli/","/ˈɡreɪtfl/"], pos:"系动词+形容词表语", meaning:"我真心感激"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/fɔːr/","/jʊr/","/help/","/wɪð/","/ðə/","/rɪˈpɔːrt/"], pos:"介词短语", meaning:"对你帮忙做报告这件事"}
    ],
    explanations: [
      "**be grateful for sth** = 为某事感激。grateful 比 thank you 更走心，强调「记在心里」的感激。",
      "近义：I can't thank you enough. / I owe you one. 例句：I'm truly grateful for your support this year."
    ]
  },
  {
    sentence: "You fixed my bike so fast — I really appreciate it.",
    cid: fnv8("You fixed my bike so fast — I really appreciate it."),
    translation: "你这么快修好我的车，太感谢了。",
    chunks: ["You fixed my bike so fast —","I really appreciate it."],
    hints: ["你很快就修好了车","我真的很感激"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/fɪkst/","/maɪ/","/baɪk/","/soʊ/","/fæst/"], pos:"一般过去时", meaning:"你很快修好了我的车"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈriːəli/","/əˈpriːʃieɪt/","/ɪt/"], pos:"一般现在时", meaning:"我真的很感激"}
    ],
    explanations: [
      "**I really appreciate it** = 我真的很感激。最通用的口头致谢升级版，比 thank you 更有分量，it 指对方做的整件事。",
      "近义：Thanks a million. / I can't thank you enough. 例句：You watered my plants all week? I really appreciate it."
    ]
  },
  {
    sentence: "You covered my shift yesterday — I owe you bigtime!",
    cid: fnv8("You covered my shift yesterday — I owe you bigtime!"),
    translation: "你昨天替我值班，我欠你个大人情！",
    chunks: ["You covered my shift yesterday —","I owe you bigtime!"],
    hints: ["你替我值班了","我大大欠你人情"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/ˈkʌvərd/","/maɪ/","/ʃɪft/","/ˈjestərdeɪ/"], pos:"一般过去时", meaning:"你替我值班了"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/oʊ/","/juː/","/ˈbɪɡtaɪm/"], pos:"习语+口语副词", meaning:"我大大欠你一份情"}
    ],
    explanations: [
      "**owe you bigtime** = 大大欠你个人情。bigtime 是口语副词「大大地、非常」，比 I owe you one 的分量重得多。",
      "近义：I owe you one. / I'm in your debt. 例句：You talked to the landlord for me? I owe you bigtime!"
    ]
  },
  {
    sentence: "The manager praised our report — keep up the good work.",
    cid: fnv8("The manager praised our report — keep up the good work."),
    translation: "经理表扬了我们的报告，再接再厉啊。",
    chunks: ["The manager praised our report —","keep up the good work."],
    hints: ["经理表扬了报告","保持好表现"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/ðə/","/ˈmænɪdʒər/","/preɪzd/","/aʊər/","/rɪˈpɔːrt/"], pos:"一般过去时", meaning:"经理表扬了我们的报告"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/kiːp/","/ʌp/","/ðə/","/ɡʊd/","/wɜːrk/"], pos:"短语动词祈使句", meaning:"继续保持好表现"}
    ],
    explanations: [
      "**keep up the good work** = 再接再厉、保持佳绩。夸人+鼓励的标准收尾句，邮件评价、老师批语通用。",
      "近义：Keep it up! / Way to go! 例句：Sales are up this quarter — keep up the good work."
    ]
  },
  {
    sentence: "I'm counting on you — don't let me down.",
    cid: fnv8("I'm counting on you — don't let me down."),
    translation: "我就指望你了，别让我失望。",
    chunks: ["I'm counting on you —","don't let me down."],
    hints: ["我指望你呢","别让我失望"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪm/","/ˈkaʊntɪŋ/","/ɒn/","/juː/"], pos:"短语动词进行时", meaning:"我指望你"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/let/","/miː/","/daʊn/"], pos:"短语动词祈使句", meaning:"别让我失望"}
    ],
    explanations: [
      "**count on** = 指望、依靠。I'm counting on you 是把事交出去前的信任宣言，常接 don't let me down 加压。",
      "**let sb down** = 让某人失望。let down 是「放鸽子/掉链子」的通感表达，否定的 don't let me down 是托付标配。例句：This presentation matters — I'm counting on you, don't let me down."
    ]
  }
,
  {
    sentence: "Are you free this Saturday for a movie?",
    cid: fnv8("Are you free this Saturday for a movie?"),
    translation: "这周六你有空看电影吗？",
    chunks: ["Are you free","this Saturday for a movie?"],
    hints: ["你有空吗","这周六看电影"],
    grammar: [
      {role:"习语·疑问", color:"#7c5cbf", phonetic:["/ɑːr/","/juː/","/friː/"], pos:"习语疑问句", meaning:"你有空吗"},
      {role:"时间状语", color:"#3358e0", phonetic:["/ðɪs/","/ˈsætərdeɪ/","/fɔːr/","/ə/","/ˈmuːvi/"], pos:"时间状语+目的", meaning:"这周六去看电影"}
    ],
    explanations: [
      "**be free** = 有空。约人最常用的问法，比 Do you have time 更轻松；free 后直接接时间即可。",
      "近义：Are you available?（更正式）/ Got any plans Saturday? 例句：Are you free tonight? I'd love to grab dinner."
    ]
  },
  {
    sentence: "She has a crush on her coworker.",
    cid: fnv8("She has a crush on her coworker."),
    translation: "她对一位同事有意思。",
    chunks: ["She has a crush on","her coworker."],
    hints: ["她喜欢上了","她的同事"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/ʃiː/","/hæz/","/ə/","/krʌʃ/","/ɒn/"], pos:"名词习语", meaning:"她暗暗喜欢上"},
      {role:"宾语", color:"#3358e0", phonetic:["/hɜːr/","/ˈkoʊwɜːrkər/"], pos:"名词短语", meaning:"她的同事"}
    ],
    explanations: [
      "**have a crush on sb** = 暗恋、对某人有好感。crush 本义「压碎」，转指「心动得心跳加速」，多指还没表白的那种喜欢。",
      "近义：be into sb（更口语）/ have feelings for sb。例句：He's had a crush on her since high school."
    ]
  },
  {
    sentence: "I can't live without you.",
    cid: fnv8("I can't live without you."),
    translation: "我不能没有你。",
    chunks: ["I can't live","without you."],
    hints: ["我没法活下去","没有你"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/kænt/","/lɪv/"], pos:"情态动词句", meaning:"我活不下去"},
      {role:"习语·补语", color:"#7c5cbf", phonetic:["/wɪˈðaʊt/","/juː/"], pos:"介词短语", meaning:"如果没有你"}
    ],
    explanations: [
      "**can't live without you** = 不能没有你。最直白的深情表达，恋人常用；也可戏谑用于咖啡、手机等离不开的东西。",
      "近义：You mean the world to me. 例句：You're my whole world — I can't live without you."
    ]
  },
  {
    sentence: "Don't be jealous — I only have eyes for you.",
    cid: fnv8("Don't be jealous — I only have eyes for you."),
    translation: "别吃醋，我眼里只有你。",
    chunks: ["Don't be jealous —","I only have eyes for you."],
    hints: ["别吃醋","我眼里只有你"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/doʊnt/","/biː/","/ˈdʒeləs/"], pos:"否定祈使句", meaning:"别吃醋"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/ˈoʊnli/","/hæv/","/aɪz/","/fɔːr/","/juː/"], pos:"名词习语", meaning:"我只钟情于你"}
    ],
    explanations: [
      "**only have eyes for sb** = 眼里只有某人。用「眼睛」表达专一，比 I love only you 更含蓄浪漫。",
      "近义：You're the only one for me. / I'm all yours. 例句：She's beautiful, but I only have eyes for you."
    ]
  },
  {
    sentence: "It's getting late — I'll take you home.",
    cid: fnv8("It's getting late — I'll take you home."),
    translation: "天不早了，我送你回家。",
    chunks: ["It's getting late —","I'll take you home."],
    hints: ["天越来越晚了","我送你回家"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/ˈɡetɪŋ/","/leɪt/"], pos:"现在进行时", meaning:"天越来越晚了"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪl/","/teɪk/","/juː/","/hoʊm/"], pos:"将来时+双宾", meaning:"我送你回家"}
    ],
    explanations: [
      "**take sb home** = 送某人回家（自己开车/陪同）。对比 walk sb home（走回去）、drive sb home（开车送），take 最通用。",
      "近义：Let me see you home. / I'll give you a ride home. 例句：It's raining — I'll take you home."
    ]
  },
  {
    sentence: "Honestly, I'm quite fond of you.",
    cid: fnv8("Honestly, I'm quite fond of you."),
    translation: "老实说，我挺喜欢你的。",
    chunks: ["Honestly,","I'm quite fond of you."],
    hints: ["说实话","我挺喜欢你"],
    grammar: [
      {role:"副词插入语", color:"#c87033", phonetic:["/ˈɑːnɪstli/"], pos:"句子副词", meaning:"说实话"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/aɪm/","/kwaɪt/","/fɑːnd/","/əv/","/juː/"], pos:"系动词+习语表语", meaning:"我挺喜欢你"}
    ],
    explanations: [
      "**be fond of sb** = 喜欢某人。比 like 更含蓄稳重，多用于「日久生情」的温和好感，语气不冲。",
      "近义：I have a soft spot for you. / I've grown to like you。例句：I'm very fond of my old professor."
    ]
  },
  {
    sentence: "I'm driving past your place — I'll drop you off.",
    cid: fnv8("I'm driving past your place — I'll drop you off."),
    translation: "我正好路过你那儿，顺路送你。",
    chunks: ["I'm driving past your place —","I'll drop you off."],
    hints: ["我正开车路过你那儿","我送你一程"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪm/","/ˈdraɪvɪŋ/","/pæst/","/jʊr/","/pleɪs/"], pos:"现在进行时", meaning:"我正开车路过你住的地方"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪl/","/drɑːp/","/juː/","/ɒf/"], pos:"短语动词", meaning:"我顺路送你到门口"}
    ],
    explanations: [
      "**drop sb off** = 顺路把某人送到（某地）。开车场景高频，指「到了就放下人」，宾语放中间 drop me off。",
      "区别：pick sb up（去接人）/ see sb off（送别）。例句：I'll drop you off at the station on my way."
    ]
  },
  {
    sentence: "Put your wallet away — it's on me.",
    cid: fnv8("Put your wallet away — it's on me."),
    translation: "把钱包收起来，这顿我请。",
    chunks: ["Put your wallet away —","it's on me."],
    hints: ["把钱包收起来","我来买单"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/pʊt/","/jʊr/","/ˈwɑːlɪt/","/əˈweɪ/"], pos:"祈使句+短语动词", meaning:"把钱包收起来"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/ɪts/","/ɒn/","/miː/"], pos:"习语表语", meaning:"由我付钱"}
    ],
    explanations: [
      "**it's on me** = 我请客、算我的。on 表示「由谁承担费用」，也可换人称 it's on the house（店里免费）。",
      "近义：This one's on me. / I've got this. / It's my treat. 例句：You paid last time — dinner is on me tonight."
    ]
  },
  {
    sentence: "You are adorable when you laugh.",
    cid: fnv8("You are adorable when you laugh."),
    translation: "你笑起来真可爱。",
    chunks: ["You are adorable","when you laugh."],
    hints: ["你真可爱","当你笑的时候"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/juː/","/ɑːr/","/əˈdɔːrəbl/"], pos:"系动词+形容词表语", meaning:"你非常可爱"},
      {role:"时间状语从句", color:"#3358e0", phonetic:["/wen/","/juː/","/læf/"], pos:"when 引导状语从句", meaning:"当你笑的时候"}
    ],
    explanations: [
      "**adorable** = 可爱得让人心动。比 cute 更强烈、更带宠溺感，夸人时常指「让人忍不住喜欢」。",
      "近义：You're so cute. / You're charming. 例句：Look at that baby — she's adorable."
    ]
  },
  {
    sentence: "You take my breath away every time you smile.",
    cid: fnv8("You take my breath away every time you smile."),
    translation: "你每次微笑都让我屏住呼吸。",
    chunks: ["You take my breath away","every time you smile."],
    hints: ["你让我屏住呼吸","每次你微笑"],
    grammar: [
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/juː/","/teɪk/","/maɪ/","/breθ/","/əˈweɪ/"], pos:"动词习语", meaning:"你美得让我屏息"},
      {role:"时间状语从句", color:"#3358e0", phonetic:["/ˈevri/","/taɪm/","/juː/","/smaɪl/"], pos:"every time 引导从句", meaning:"每次你笑的时候"}
    ],
    explanations: [
      "**take sb's breath away** = 让某人惊艳到失语。意象：美得让人忘了呼吸，是最高级的赞美之一。",
      "近义：You leave me speechless. / You're stunning. 例句：The view from the top took my breath away."
    ]
  },
  {
    sentence: "Your timing is just right — I just finished cooking.",
    cid: fnv8("Your timing is just right — I just finished cooking."),
    translation: "你来得正好，我刚做好饭。",
    chunks: ["Your timing is just right —","I just finished cooking."],
    hints: ["你时机正好","我刚做完饭"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/jʊr/","/ˈtaɪmɪŋ/","/ɪz/","/dʒʌst/","/raɪt/"], pos:"主系表", meaning:"你来得正是时候"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/dʒʌst/","/ˈfɪnɪʃt/","/ˈkʊkɪŋ/"], pos:"现在完成时", meaning:"我刚做完饭"}
    ],
    explanations: [
      "**timing is just right** = 时机正好、来得巧。timing 指「时间上的把握」，just right 强调分毫不差。",
      "反义：bad timing（来得不是时候）。例句：Perfect timing — dinner is ready."
    ]
  },
  {
    sentence: "You look tired — I'll leave you be.",
    cid: fnv8("You look tired — I'll leave you be."),
    translation: "你看起来很累，我就不打扰了。",
    chunks: ["You look tired —","I'll leave you be."],
    hints: ["你看上去很累","我就不打扰了"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/juː/","/lʊk/","/ˈtaɪərd/"], pos:"系动词+形容词表语", meaning:"你看上去累了"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪl/","/liːv/","/juː/","/biː/"], pos:"习语动词短语", meaning:"我不打扰你"}
    ],
    explanations: [
      "**leave sb be** = 不去打扰某人、让某人清静。比 leave sb alone 更温和，含「体谅对方需要空间」的意味。",
      "近义：I'll let you rest. / I'll get out of your hair. 例句：You've had a long day — I'll leave you be."
    ]
  },
  {
    sentence: "One more try — you can do it!",
    cid: fnv8("One more try — you can do it!"),
    translation: "再试一次，你能行的！",
    chunks: ["One more try —","you can do it!"],
    hints: ["再试一次","你能做到"],
    grammar: [
      {role:"名词短语", color:"#3358e0", phonetic:["/wʌn/","/mɔːr/","/traɪ/"], pos:"名词短语", meaning:"再试一次"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/juː/","/kæn/","/duː/","/ɪt/"], pos:"情态习语句", meaning:"你能做到"}
    ],
    explanations: [
      "**you can do it** = 你能做到。最普及的打气句，简短的三个词自带力量，比赛、考试、健身都用。",
      "近义：You've got this. / Hang in there. 例句：Only one lap left — you can do it!"
    ]
  },
  {
    sentence: "I'm flattered, but I can't accept.",
    cid: fnv8("I'm flattered, but I can't accept."),
    translation: "我受宠若惊，但我不能接受。",
    chunks: ["I'm flattered,","but I can't accept."],
    hints: ["我很受宠若惊","但我不能接受"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/aɪm/","/ˈflætərd/"], pos:"被动语态表语", meaning:"我受宠若惊"},
      {role:"主谓", color:"#c87033", phonetic:["/bʌt/","/aɪ/","/kænt/","/əkˈsept/"], pos:"情态动词句", meaning:"但我无法接受"}
    ],
    explanations: [
      "**I'm flattered** = 我受宠若惊、过奖了。被夸奖或被邀请时的礼貌回应，为之后的婉拒做铺垫，非常得体。",
      "用法：可单用回谢夸奖（= 太抬举我了），也可像本句接 but 引出拒绝。例句：That's a generous offer, and I'm flattered."
    ]
  },
  {
    sentence: "I admire you for speaking up at the meeting.",
    cid: fnv8("I admire you for speaking up at the meeting."),
    translation: "我佩服你敢在会上开口。",
    chunks: ["I admire you","for speaking up at the meeting."],
    hints: ["我佩服你","因为你在会上发声"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ədˈmaɪər/","/juː/"], pos:"一般现在时", meaning:"我佩服你"},
      {role:"介宾短语", color:"#3358e0", phonetic:["/fɔːr/","/ˈspiːkɪŋ/","/ʌp/","/æt/","/ðə/","/ˈmiːtɪŋ/"], pos:"介词+动名词", meaning:"因为你在会上发声"}
    ],
    explanations: [
      "**admire sb for sth** = 因某事佩服某人。admire 是「由衷敬佩」，比 respect 更带感情，for 后接令人佩服的原因。",
      "近义：I look up to you. / I really respect you for that. 例句：I admire her for standing by her decision."
    ]
  },
  {
    sentence: "You aced the exam — you are awesome!",
    cid: fnv8("You aced the exam — you are awesome!"),
    translation: "你考试拿了高分，你太棒了！",
    chunks: ["You aced the exam —","you are awesome!"],
    hints: ["你考试考得超好","你太棒了"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/eɪst/","/ðə/","/ɪɡˈzæm/"], pos:"一般过去时", meaning:"你考试考得极好"},
      {role:"习语·赞美", color:"#7c5cbf", phonetic:["/juː/","/ɑːr/","/ˈɔːsəm/"], pos:"习语赞美句", meaning:"你太厉害了"}
    ],
    explanations: [
      "**ace sth** = 在某事上拿满分、做得极漂亮。源自扑克牌 A（ace 最高牌），可接 exam / interview / test。",
      "**You are awesome** = 你太棒了。awesome 在口语里是「超厉害」，比 great 情绪更强。例句：She aced the presentation — everyone clapped."
    ]
  },
  {
    sentence: "You are one in a million — never change.",
    cid: fnv8("You are one in a million — never change."),
    translation: "你是万里挑一的人，别变。",
    chunks: ["You are one in a million —","never change."],
    hints: ["你是万里挑一","永远别改变"],
    grammar: [
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/juː/","/ɑːr/","/wʌn/","/ɪn/","/ə/","/ˈmɪljən/"], pos:"习语表语", meaning:"你是万里挑一的"},
      {role:"祈使句", color:"#c87033", phonetic:["/ˈnevər/","/tʃeɪndʒ/"], pos:"否定祈使句", meaning:"永远别改变"}
    ],
    explanations: [
      "**one in a million** = 万里挑一、独一无二。用概率表达稀有，是赞美别人特别之处的常用句。",
      "近义：You're one of a kind. / There's no one like you. 例句：Thanks for always helping me — you're one in a million."
    ]
  },
  {
    sentence: "You passed the driving test — you did it!",
    cid: fnv8("You passed the driving test — you did it!"),
    translation: "你驾照考过了，你做到了！",
    chunks: ["You passed the driving test —","you did it!"],
    hints: ["你通过了驾照考试","你做到了"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/pæst/","/ðə/","/ˈdraɪvɪŋ/","/test/"], pos:"一般过去时", meaning:"你通过了驾照考试"},
      {role:"习语·感叹", color:"#7c5cbf", phonetic:["/juː/","/dɪd/","/ɪt/"], pos:"习语感叹句", meaning:"你成功做到了"}
    ],
    explanations: [
      "**you did it** = 你做到了。见证对方努力后成功的欢呼句，比 congratulations 更直接带情绪。",
      "近义：You made it! / Well done! 例句：After three attempts, you did it!"
    ]
  },
  {
    sentence: "You got us front-row seats — you are the man!",
    cid: fnv8("You got us front-row seats — you are the man!"),
    translation: "你给我们弄到了前排座位，你太厉害了！",
    chunks: ["You got us front-row seats —","you are the man!"],
    hints: ["你搞到了前排座位","你真是太牛了"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/ɡɑːt/","/ʌs/","/ˈfrʌntroʊ/","/siːts/"], pos:"一般过去时+双宾", meaning:"你给我们弄到了前排座位"},
      {role:"习语·赞美", color:"#7c5cbf", phonetic:["/juː/","/ɑːr/","/ðə/","/mæn/"], pos:"习语赞美句", meaning:"你太厉害了"}
    ],
    explanations: [
      "**you are the man** = 你太厉害了、你是大哥。男性间的高强度赞美（对女性可说 you're the best），感谢对方帮了大忙。",
      "近义：You're the best. / You rock. 例句：You fixed my laptop in ten minutes — you are the man!"
    ]
  },
  {
    sentence: "You made me breakfast in bed — you are so sweet.",
    cid: fnv8("You made me breakfast in bed — you are so sweet."),
    translation: "你把早餐端到床边，你太贴心了。",
    chunks: ["You made me breakfast in bed —","you are so sweet."],
    hints: ["你做了床边早餐","你太贴心了"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/meɪd/","/miː/","/ˈbrekfəst/","/ɪn/","/bed/"], pos:"一般过去时+双宾", meaning:"你把早餐送到我床边"},
      {role:"主系表", color:"#c87033", phonetic:["/juː/","/ɑːr/","/soʊ/","/swiːt/"], pos:"系动词+表语", meaning:"你太贴心了"}
    ],
    explanations: [
      "**breakfast in bed** = 送到床边的早餐。情侣、家人之间的甜蜜仪式感表达，固定搭配不加冠词。",
      "**you are so sweet** = 你太贴心了。sweet 形容人「温柔体贴」，注意不是「甜」。例句：Thanks for the surprise — you are so sweet."
    ]
  },
  {
    sentence: "Take it easy at the gym — don't overdo it.",
    cid: fnv8("Take it easy at the gym — don't overdo it."),
    translation: "在健身房悠着点，别练过头。",
    chunks: ["Take it easy at the gym —","don't overdo it."],
    hints: ["在健身房别太拼","别做过头"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/teɪk/","/ɪt/","/ˈiːzi/","/æt/","/ðə/","/dʒɪm/"], pos:"习语祈使句+短语动词", meaning:"在健身房别太拼"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/ˌoʊvərˈduː/","/ɪt/"], pos:"习语否定祈使句", meaning:"别用力过猛"}
    ],
    explanations: [
      "**overdo it** = 做得过头、用力过猛。适用于运动、喝酒、加班——凡事超出身体能承受的度。",
      "近义：Don't push yourself too hard. / Take it slow. 例句：You just recovered — don't overdo it."
    ]
  },
  {
    sentence: "Information came in by dribs and drabs.",
    cid: fnv8("Information came in by dribs and drabs."),
    translation: "消息零零散散地传了过来。",
    chunks: ["Information came in","by dribs and drabs."],
    hints: ["消息陆续传来","零零散散地"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/ˌɪnfərˈmeɪʃn/","/keɪm/","/ɪn/"], pos:"一般过去时+短语动词", meaning:"消息陆续到来"},
      {role:"习语·状语", color:"#7c5cbf", phonetic:["/baɪ/","/drɪbz/","/ənd/","/dræbz/"], pos:"习语状语", meaning:"零零星星地"}
    ],
    explanations: [
      "**by dribs and drabs** = 零零星星、一点一点地。强调「不成批、不连续」，常形容消息、捐款、人流慢慢来。",
      "近义：in bits and pieces / little by little。例句：The donations came in by dribs and drabs."
    ]
  },
  {
    sentence: "Free concert tickets — you're pulling my leg!",
    cid: fnv8("Free concert tickets — you're pulling my leg!"),
    translation: "免费演唱会门票，你在逗我吧！",
    chunks: ["Free concert tickets —","you're pulling my leg!"],
    hints: ["免费的演唱会票","你在开我玩笑吧"],
    grammar: [
      {role:"名词短语", color:"#3358e0", phonetic:["/friː/","/ˈkɑːnsərt/","/ˈtɪkɪts/"], pos:"名词短语", meaning:"免费演唱会门票"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/jʊr/","/ˈpʊlɪŋ/","/maɪ/","/leɡ/"], pos:"动词习语进行时", meaning:"你在跟我开玩笑"}
    ],
    explanations: [
      "**pull sb's leg** = 逗某人、拿某人开玩笑。不是「拉腿」！指善意地哄骗逗趣，常用来表示「我不信，你在骗我」。",
      "近义：You're kidding me. / You're teasing me. 例句：Seriously, I'm not pulling your leg — the tickets are real."
    ]
  },
  {
    sentence: "It's your first week, so ease into it.",
    cid: fnv8("It's your first week, so ease into it."),
    translation: "这是你的第一周，慢慢上手吧。",
    chunks: ["It's your first week,","so ease into it."],
    hints: ["这是你的第一周","所以慢慢适应"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/jʊr/","/fɜːrst/","/wiːk/"], pos:"主系表", meaning:"这是你的第一周"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/soʊ/","/iːz/","/ˈɪntuː/","/ɪt/"], pos:"短语动词祈使句", meaning:"慢慢适应"}
    ],
    explanations: [
      "**ease into sth** = 慢慢进入状态、渐进适应。ease 是「缓和」，比 start 多一层「别急、慢来」的劝告语气。",
      "近义：take it slow / get into the swing of it。例句：New job? Give yourself a month to ease into it."
    ]
  },
  {
    sentence: "It's just a small injection — don't be a baby.",
    cid: fnv8("It's just a small injection — don't be a baby."),
    translation: "只是打个小针，别像个小孩一样。",
    chunks: ["It's just a small injection —","don't be a baby."],
    hints: ["只是打个小针","别跟小娃娃似的"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/dʒʌst/","/ə/","/smɔːl/","/ɪnˈdʒekʃn/"], pos:"主系表", meaning:"只是一个小针剂"},
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/doʊnt/","/biː/","/ə/","/ˈbeɪbi/"], pos:"习语否定祈使句", meaning:"别小孩子气"}
    ],
    explanations: [
      "**don't be a baby** = 别像个小孩似的、别娇气。哄小孩或略带嫌弃地劝人别闹，对成年人说会显得不太客气。",
      "近义：Don't be such a wimp. / Be a big boy. 例句：It's only a splinter — don't be a baby."
    ]
  },
  {
    sentence: "You can't fool me — I have your number.",
    cid: fnv8("You can't fool me — I have your number."),
    translation: "你骗不了我，我早就看透你了。",
    chunks: ["You can't fool me —","I have your number."],
    hints: ["你骗不了我","我清楚你的底细"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/kænt/","/fuːl/","/miː/"], pos:"情态动词句", meaning:"你骗不了我"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/aɪ/","/hæv/","/jʊr/","/ˈnʌmbər/"], pos:"名词习语", meaning:"我了解你的底细"}
    ],
    explanations: [
      "**have sb's number** = 摸清某人的底、看透某人。不是「有电话号码」！指知道对方真实动机，不被花招骗到。",
      "近义：I've got you figured out. / I know your game. 例句：Nice try, but I have your number."
    ]
  },
  {
    sentence: "You lied to my face — you have a lot of nerve!",
    cid: fnv8("You lied to my face — you have a lot of nerve!"),
    translation: "你当面骗我，胆子真大！",
    chunks: ["You lied to my face —","you have a lot of nerve!"],
    hints: ["你当面撒谎","你胆子真大"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/juː/","/laɪd/","/tuː/","/maɪ/","/feɪs/"], pos:"一般过去时", meaning:"你当面对我撒谎"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/juː/","/hæv/","/ə/","/lɑːt/","/əv/","/nɜːrv/"], pos:"名词习语", meaning:"你居然有这种脸皮"}
    ],
    explanations: [
      "**have a lot of nerve** = 脸皮真厚、胆子真大。指责对方「居然敢这么做」，语气强烈；也说 have some nerve。",
      "近义：How dare you! / You've got some guts. 例句：You asked me for a raise after that mess — you have a lot of nerve."
    ]
  }
,
  {
    sentence: "Stop it — that's not funny.",
    cid: fnv8("Stop it — that's not funny."),
    translation: "住手，这一点都不好笑。",
    chunks: ["Stop it —","that's not funny."],
    hints: ["住手","这一点都不好笑"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/stɒp/","/ɪt/"], pos:"祈使句", meaning:"住手"},
      {role:"主系表·否定", color:"#c87033", phonetic:["/ðæts/","/nɒt/","/ˈfʌni/"], pos:"一般现在时否定", meaning:"这不好笑"}
    ],
    explanations: [
      "**stop it** = 住手、别闹了。制止正在发生的动作，语气直接；比单说 Stop 更聚焦「这件事」。",
      "近义：Cut it out（更口语、带不耐烦）/ Knock it off。例句：Stop it — you're going to break something."
    ]
  },
  {
    sentence: "Stop that right now!",
    cid: fnv8("Stop that right now!"),
    translation: "马上给我停下！",
    chunks: ["Stop that","right now!"],
    hints: ["停下那个","马上"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/stɒp/","/ðæt/"], pos:"祈使句", meaning:"停下那个"},
      {role:"时间状语", color:"#3358e0", phonetic:["/raɪt/","/naʊ/"], pos:"时间状语", meaning:"立刻、马上"}
    ],
    explanations: [
      "**stop that** = 停下那个（动作）。that 指对方手上的动作，比 it 更强调「就是你正在干的那事」。",
      "**right now** 放句末是加重语气的催促。近义：Stop that this instant!（更严厉）例句：Stop that right now — I won't say it again."
    ]
  },
  {
    sentence: "Stop him — he's getting away!",
    cid: fnv8("Stop him — he's getting away!"),
    translation: "拦住他，他要跑了！",
    chunks: ["Stop him —","he's getting away!"],
    hints: ["拦住他","他要逃走了"],
    grammar: [
      {role:"祈使句·宾格", color:"#c87033", phonetic:["/stɒp/","/hɪm/"], pos:"祈使句", meaning:"拦住他"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/hiːz/","/ˈɡetɪŋ/","/əˈweɪ/"], pos:"现在进行时", meaning:"get away 逃走"}
    ],
    explanations: [
      "**stop sb** = 拦住某人、让某人停下。stop 接人表示阻止某人，接事（stop it）表示让某事停止。",
      "**get away** = 逃脱、溜走。例句：Stop him — he's getting away with my bag!"
    ]
  },
  {
    sentence: "Don't touch me — I mean it!",
    cid: fnv8("Don't touch me — I mean it!"),
    translation: "别碰我，我说真的！",
    chunks: ["Don't touch me —","I mean it!"],
    hints: ["别碰我","我是认真的"],
    grammar: [
      {role:"祈使句·否定", color:"#c87033", phonetic:["/doʊnt/","/tʌtʃ/","/miː/"], pos:"祈使句", meaning:"别碰我"},
      {role:"习语·强调", color:"#7c5cbf", phonetic:["/aɪ/","/miːn/","/ɪt/"], pos:"一般现在时习语", meaning:"我是认真的"}
    ],
    explanations: [
      "**Don't touch me** 是最直接的肢体边界表达，语气强硬，不留余地。",
      "**I mean it** = 我不是开玩笑，用来给前面的话加重。近义：Keep your hands off me。例句：Don't touch me — I mean it, back off."
    ]
  },
  {
    sentence: "Get your hands off me!",
    cid: fnv8("Get your hands off me!"),
    translation: "把你的手拿开！",
    chunks: ["Get your hands","off me!"],
    hints: ["把你的手","从我身上拿开"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/ɡet/","/jɔːr/","/hændz/"], pos:"祈使句", meaning:"把手拿开"},
      {role:"介词短语", color:"#3358e0", phonetic:["/ɒf/","/miː/"], pos:"介词短语", meaning:"离开我"}
    ],
    explanations: [
      "**get one's hands off sb** = 把手从某人身上拿开。被拉扯、被冒犯时的强硬抗议。",
      "近义：Take your hands off me! / Hands off!（更短更冲）例句：Get your hands off me — who do you think you are?"
    ]
  },
  {
    sentence: "Please line up, everyone.",
    cid: fnv8("Please line up, everyone."),
    translation: "请大家排好队。",
    chunks: ["Please line up,","everyone."],
    hints: ["请排队","各位"],
    grammar: [
      {role:"祈使句·礼貌", color:"#c87033", phonetic:["/pliːz/","/laɪn/","/ʌp/"], pos:"祈使句", meaning:"请排队"},
      {role:"呼语", color:"#3358e0", phonetic:["/ˈevriwʌn/"], pos:"呼语", meaning:"各位"}
    ],
    explanations: [
      "**line up** = 排队。英式美式通用，最常用的排队说法。",
      "近义：queue up（英式）/ get in line（美式）。例句：Please line up, everyone — the doors are about to open."
    ]
  },
  {
    sentence: "Please form a line at the door.",
    cid: fnv8("Please form a line at the door."),
    translation: "请在门口排成一列。",
    chunks: ["Please form a line","at the door."],
    hints: ["请排成一列","在门口"],
    grammar: [
      {role:"祈使句·礼貌", color:"#c87033", phonetic:["/pliːz/","/fɔːrm/","/ə/","/laɪn/"], pos:"祈使句", meaning:"请排成一列"},
      {role:"介词短语", color:"#3358e0", phonetic:["/æt/","/ðə/","/dɔːr/"], pos:"介词短语", meaning:"在门口"}
    ],
    explanations: [
      "**form a line** = 排成一列。比 line up 更正式，多用于广播、场馆、机场的指令。",
      "近义：form a queue（英式正式）。例句：Please form a line at the door and have your tickets ready."
    ]
  },
  {
    sentence: "Don't cut in line — go to the back.",
    cid: fnv8("Don't cut in line — go to the back."),
    translation: "别插队，到后面去。",
    chunks: ["Don't cut in line —","go to the back."],
    hints: ["别插队","到后面去"],
    grammar: [
      {role:"习语·祈使否定", color:"#7c5cbf", phonetic:["/doʊnt/","/kʌt/","/ɪn/","/laɪn/"], pos:"祈使句否定", meaning:"cut in line 插队"},
      {role:"祈使句", color:"#c87033", phonetic:["/ɡoʊ/","/tuː/","/ðə/","/bæk/"], pos:"祈使句", meaning:"到后面去"}
    ],
    explanations: [
      "**cut in line** = 插队（美式）。英式说 jump the queue；cut in 本身有「插进来」的意思。",
      "近义：jump the queue（英式）/ butt in line。例句：Excuse me, you can't cut in line — go to the back."
    ]
  },
  {
    sentence: "Get in line and wait your turn.",
    cid: fnv8("Get in line and wait your turn."),
    translation: "排队去，按顺序等着。",
    chunks: ["Get in line","and wait your turn."],
    hints: ["排好队","按顺序等"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡet/","/ɪn/","/laɪn/"], pos:"祈使句", meaning:"get in line 排队"},
      {role:"祈使句·并列", color:"#c87033", phonetic:["/ænd/","/weɪt/","/jɔːr/","/tɜːrn/"], pos:"祈使句并列", meaning:"等着轮到你"}
    ],
    explanations: [
      "**get in line** = 排队（美式口语），比 line up 更随意。",
      "**wait your turn** = 等着轮到你。强调按顺序来、别抢。例句：Get in line and wait your turn like everyone else."
    ]
  },
  {
    sentence: "Don't shove — there's room for everyone.",
    cid: fnv8("Don't shove — there's room for everyone."),
    translation: "别推挤，位置够所有人站。",
    chunks: ["Don't shove —","there's room for everyone."],
    hints: ["别推挤","每个人都有位置"],
    grammar: [
      {role:"祈使句·否定", color:"#c87033", phonetic:["/doʊnt/","/ʃʌv/"], pos:"祈使句", meaning:"别推挤"},
      {role:"存在句", color:"#3358e0", phonetic:["/ðerz/","/ruːm/","/fɔːr/","/ˈevriwʌn/"], pos:"there be 句型", meaning:"每个人都有空间"}
    ],
    explanations: [
      "**shove** = 用手肘或身体硬推。比 push 更粗鲁，专指人群里乱挤。",
      "近义：Don't push（一般推挤）/ Stop shoving。例句：Don't shove — there's room for everyone on the bus."
    ]
  },
  {
    sentence: "Stand back — the train is coming.",
    cid: fnv8("Stand back — the train is coming."),
    translation: "退后，列车要来了。",
    chunks: ["Stand back —","the train is coming."],
    hints: ["退后","列车要来了"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/stænd/","/bæk/"], pos:"祈使句", meaning:"stand back 退后"},
      {role:"主谓·进行", color:"#c87033", phonetic:["/ðə/","/treɪn/","/ɪz/","/ˈkʌmɪŋ/"], pos:"现在进行时", meaning:"列车正驶来"}
    ],
    explanations: [
      "**stand back** = 退后、站远一点。安全提示高频，比 move back 更强调保持距离。",
      "近义：Keep back / Stay clear。例句：Stand back — the train is coming and the platform is slippery."
    ]
  },
  {
    sentence: "Stay down and don't move!",
    cid: fnv8("Stay down and don't move!"),
    translation: "趴下别动！",
    chunks: ["Stay down","and don't move!"],
    hints: ["保持趴下","别动"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/steɪ/","/daʊn/"], pos:"祈使句", meaning:"stay down 保持低姿"},
      {role:"祈使句·否定", color:"#c87033", phonetic:["/ænd/","/doʊnt/","/muːv/"], pos:"祈使句否定", meaning:"别动"}
    ],
    explanations: [
      "**stay down** = 保持低位、别起身。多用于危险或紧急场景里的指令。",
      "近义：Get down and stay down。例句：Stay down and don't move until I say it's clear."
    ]
  },
  {
    sentence: "Stay away from me.",
    cid: fnv8("Stay away from me."),
    translation: "离我远点。",
    chunks: ["Stay away","from me."],
    hints: ["保持距离","离我远点"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/steɪ/","/əˈweɪ/"], pos:"祈使句", meaning:"stay away 保持距离"},
      {role:"介词短语", color:"#3358e0", phonetic:["/frɒm/","/miː/"], pos:"介词短语", meaning:"离开我"}
    ],
    explanations: [
      "**stay away from sb** = 跟某人保持距离。划清界限的警告，语气冷静但强硬。",
      "近义：Keep away from me / Keep your distance。例句：Stay away from me — I don't want to talk to you."
    ]
  },
  {
    sentence: "Get away from me!",
    cid: fnv8("Get away from me!"),
    translation: "滚开，别靠近我！",
    chunks: ["Get away","from me!"],
    hints: ["走开","离我远点"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡet/","/əˈweɪ/"], pos:"祈使句", meaning:"get away 走开"},
      {role:"介词短语", color:"#3358e0", phonetic:["/frɒm/","/miː/"], pos:"介词短语", meaning:"从我身边"}
    ],
    explanations: [
      "**get away from sb** = 从某人身边走开。比 stay away 更冲，带即时驱赶的怒气。",
      "近义：Back off! / Get lost!（更粗鲁）例句：Get away from me — don't you dare touch my phone!"
    ]
  },
  {
    sentence: "Go away — I need to be alone.",
    cid: fnv8("Go away — I need to be alone."),
    translation: "走开，我想一个人待着。",
    chunks: ["Go away —","I need to be alone."],
    hints: ["走开","我需要独处"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡoʊ/","/əˈweɪ/"], pos:"祈使句", meaning:"go away 走开"},
      {role:"主谓宾", color:"#3358e0", phonetic:["/aɪ/","/niːd/","/tuː/","/biː/","/əˈloʊn/"], pos:"一般现在时", meaning:"我需要独处"}
    ],
    explanations: [
      "**go away** = 走开、离开。最常见的驱赶表达，轻重完全看语调。",
      "近义：Leave me alone（别烦我）/ Get out。例句：Go away — I need to be alone for a while."
    ]
  },
  {
    sentence: "Get out of here!",
    cid: fnv8("Get out of here!"),
    translation: "滚出去！",
    chunks: ["Get out","of here!"],
    hints: ["出去","从这儿"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/ɡet/","/aʊt/"], pos:"祈使句", meaning:"get out 出去"},
      {role:"介词短语", color:"#3358e0", phonetic:["/əv/","/hɪr/"], pos:"介词短语", meaning:"从这里"}
    ],
    explanations: [
      "**get out of here** = 出去、滚出去。字面是「离开这里」；口语里也能表惊讶，相当于「别逗了」。",
      "近义：Get lost! / Out! 例句：Get out of here — you're not welcome anymore."
    ]
  },
  {
    sentence: "Keep it out of sight.",
    cid: fnv8("Keep it out of sight."),
    translation: "把它藏好别让人看见。",
    chunks: ["Keep it","out of sight."],
    hints: ["让它保持","不被看见"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/kiːp/","/ɪt/"], pos:"祈使句", meaning:"让它保持"},
      {role:"习语·补语", color:"#7c5cbf", phonetic:["/aʊt/","/əv/","/saɪt/"], pos:"介词短语习语", meaning:"out of sight 在视线之外"}
    ],
    explanations: [
      "**out of sight** = 在视线之外、看不见。keep sth out of sight 就是把某物收好、别露出来。",
      "反义：in sight（在看得见的地方）。例句：Keep it out of sight — the guards are checking bags."
    ]
  },
  {
    sentence: "Don't blab this to anyone.",
    cid: fnv8("Don't blab this to anyone."),
    translation: "这事别跟任何人乱说。",
    chunks: ["Don't blab this","to anyone."],
    hints: ["别乱说这事","对任何人"],
    grammar: [
      {role:"祈使句·否定", color:"#c87033", phonetic:["/doʊnt/","/blæb/","/ðɪs/"], pos:"祈使句否定", meaning:"别乱说这事"},
      {role:"介词短语", color:"#3358e0", phonetic:["/tuː/","/ˈeniwʌn/"], pos:"介词短语", meaning:"对任何人"}
    ],
    explanations: [
      "**blab** = 嘴不牢、到处乱说。含贬义，专指把该保密的事说漏出去。",
      "近义：Don't spill the beans / Keep it to yourself。例句：Don't blab this to anyone — it's not official yet."
    ]
  },
  {
    sentence: "No tricks — just tell me the truth.",
    cid: fnv8("No tricks — just tell me the truth."),
    translation: "别耍花样，说实话。",
    chunks: ["No tricks —","just tell me the truth."],
    hints: ["别耍花招","直接说真话"],
    grammar: [
      {role:"习语·禁止", color:"#7c5cbf", phonetic:["/noʊ/","/trɪks/"], pos:"名词短语禁令", meaning:"no tricks 不许耍花样"},
      {role:"祈使句", color:"#c87033", phonetic:["/dʒʌst/","/tel/","/miː/","/ðə/","/truːθ/"], pos:"祈使句", meaning:"告诉我真相"}
    ],
    explanations: [
      "**no tricks** = 不许耍花样、别玩手段。No + 名词构成简短禁令，语气干脆。",
      "近义：No games / No funny business。例句：No tricks — just tell me the truth and we'll be fine."
    ]
  },
  {
    sentence: "Don't call me names!",
    cid: fnv8("Don't call me names!"),
    translation: "别骂我！",
    chunks: ["Don't call me","names!"],
    hints: ["别这么叫我","侮辱性称呼"],
    grammar: [
      {role:"祈使句·否定", color:"#c87033", phonetic:["/doʊnt/","/kɔːl/","/miː/"], pos:"祈使句否定", meaning:"别这么叫我"},
      {role:"宾语", color:"#3358e0", phonetic:["/neɪmz/"], pos:"名词复数", meaning:"侮辱性称呼"}
    ],
    explanations: [
      "**call sb names** = 骂人、给人起侮辱性绰号。注意必须用复数 names，单数没有这个意思。",
      "近义：Don't insult me / Stop name-calling。例句：Don't call me names — argue with facts, not insults."
    ]
  },
  {
    sentence: "Take it or leave it.",
    cid: fnv8("Take it or leave it."),
    translation: "要就要，不要拉倒。",
    chunks: ["Take it","or leave it."],
    hints: ["接受它","否则放弃"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/teɪk/","/ɪt/"], pos:"祈使句", meaning:"take it 接受"},
      {role:"习语·并列", color:"#7c5cbf", phonetic:["/ɔːr/","/liːv/","/ɪt/"], pos:"并列选择", meaning:"leave it 放弃"}
    ],
    explanations: [
      "**take it or leave it** = 要就要、不要拉倒。谈判里下最后通牒，表示没有商量余地。",
      "近义：It's my final offer。例句：That's the price — take it or leave it."
    ]
  },
  {
    sentence: "Just do as I say.",
    cid: fnv8("Just do as I say."),
    translation: "照我说的做就行。",
    chunks: ["Just do","as I say."],
    hints: ["照做","按我说的"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/dʒʌst/","/duː/"], pos:"祈使句", meaning:"照做"},
      {role:"方式状语从句", color:"#3358e0", phonetic:["/æz/","/aɪ/","/seɪ/"], pos:"方式状语从句", meaning:"按我说的"}
    ],
    explanations: [
      "**do as I say** = 照我说的做。比 do what I say 略书面，语气偏权威。",
      "近义：Do what I tell you / Follow my instructions。例句：Just do as I say and you'll be fine."
    ]
  },
  {
    sentence: "No more excuses.",
    cid: fnv8("No more excuses."),
    translation: "别再找借口了。",
    chunks: ["No more","excuses."],
    hints: ["不再有","借口"],
    grammar: [
      {role:"习语·禁止", color:"#7c5cbf", phonetic:["/noʊ/","/mɔːr/"], pos:"限定词短语", meaning:"no more 不再"},
      {role:"名词", color:"#3358e0", phonetic:["/ɪkˈskjuːzɪz/"], pos:"名词复数", meaning:"借口"}
    ],
    explanations: [
      "**no more excuses** = 别再找借口。简短、终结性的表态，常出现在被反复爽约之后。",
      "近义：Enough excuses / Stop making excuses。例句：No more excuses — I want the report by Friday."
    ]
  },
  {
    sentence: "Do me a favor.",
    cid: fnv8("Do me a favor."),
    translation: "帮我个忙。",
    chunks: ["Do me","a favor."],
    hints: ["帮我","一个忙"],
    grammar: [
      {role:"祈使句·双宾", color:"#c87033", phonetic:["/duː/","/miː/"], pos:"祈使句", meaning:"帮我"},
      {role:"宾语", color:"#3358e0", phonetic:["/ə/","/ˈfeɪvər/"], pos:"名词短语", meaning:"一个忙"}
    ],
    explanations: [
      "**do sb a favor** = 帮某人一个忙。请求帮助的万用句式，后面能直接接 to do 说明具体事。",
      "近义：Give me a hand / Could you do me a favor? 例句：Do me a favor and keep an eye on my bag."
    ]
  }
,
  {
    sentence: "Who do you think you are?",
    cid: fnv8("Who do you think you are?"),
    translation: "你以为你是谁？",
    chunks: ["Who do you think","you are?"],
    hints: ["你以为","你是谁"],
    grammar: [
      {role:"疑问·主句", color:"#c87033", phonetic:["/huː/","/duː/","/juː/","/θɪŋk/"], pos:"疑问句", meaning:"你以为"},
      {role:"宾语从句", color:"#3358e0", phonetic:["/juː/","/ɑːr/"], pos:"宾语从句", meaning:"你是谁"}
    ],
    explanations: [
      "**Who do you think you are?** = 你以为你是谁？质问对方凭什么这么说话做事，是最常见的反击句。",
      "近义：What gives you the right? 例句：Who do you think you are — talking to me like that?"
    ]
  },
  {
    sentence: "You'll be sorry if you do that.",
    cid: fnv8("You'll be sorry if you do that."),
    translation: "你要是那么做会后悔的。",
    chunks: ["You'll be sorry","if you do that."],
    hints: ["你会后悔","如果你那么做"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/juːl/","/biː/","/ˈsɒri/"], pos:"一般将来时", meaning:"你会后悔"},
      {role:"条件状语从句", color:"#3358e0", phonetic:["/ɪf/","/juː/","/duː/","/ðæt/"], pos:"条件状语从句", meaning:"如果你那么做"}
    ],
    explanations: [
      "**You'll be sorry** = 你会后悔的。警告或威胁，语气轻重看场合；后接 if 从句说明后悔的缘由。",
      "近义：You'll regret it。例句：You'll be sorry if you do that — I'm not joking."
    ]
  },
  {
    sentence: "Drop the act — I know what you did.",
    cid: fnv8("Drop the act — I know what you did."),
    translation: "别装了，我知道你干了什么。",
    chunks: ["Drop the act —","I know what you did."],
    hints: ["别装了","我知道你干了什么"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/drɒp/","/ði/","/ækt/"], pos:"祈使句", meaning:"drop the act 别再装"},
      {role:"主谓宾从句", color:"#3358e0", phonetic:["/aɪ/","/noʊ/","/wɒt/","/juː/","/dɪd/"], pos:"宾语从句", meaning:"我知道你做了什么"}
    ],
    explanations: [
      "**drop the act** = 别装了、收起那套。act 指装出来的样子，drop 有「撂下」的劲。",
      "近义：Cut the act / Stop pretending。例句：Drop the act — I know what you did."
    ]
  },
  {
    sentence: "What were you thinking?",
    cid: fnv8("What were you thinking?"),
    translation: "你当时在想什么？",
    chunks: ["What were","you thinking?"],
    hints: ["当时是什么","你在想什么"],
    grammar: [
      {role:"疑问·过去进行", color:"#c87033", phonetic:["/wɒt/","/wɜːr/"], pos:"过去进行时疑问", meaning:"当时是什么"},
      {role:"主语·谓语", color:"#3358e0", phonetic:["/juː/","/ˈθɪŋkɪŋ/"], pos:"现在分词", meaning:"你在想什么"}
    ],
    explanations: [
      "**What were you thinking?** = 你当时到底在想什么？事后追责的固定问法，暗示对方做了蠢事。",
      "近义：What came over you? 例句：What were you thinking — driving after all that wine?"
    ]
  },
  {
    sentence: "That's going too far.",
    cid: fnv8("That's going too far."),
    translation: "这太过分了。",
    chunks: ["That's going","too far."],
    hints: ["这正在","走得太远"],
    grammar: [
      {role:"主谓·进行", color:"#c87033", phonetic:["/ðæts/","/ˈɡoʊɪŋ/"], pos:"现在进行时", meaning:"这走过头了"},
      {role:"程度状语", color:"#3358e0", phonetic:["/tuː/","/fɑːr/"], pos:"程度状语", meaning:"太远、过分"}
    ],
    explanations: [
      "**go too far** = 做得过分、越界。too far 在这里指程度，不是距离。",
      "近义：That crosses the line。例句：That's going too far — apologize right now."
    ]
  },
  {
    sentence: "You've gone too far this time.",
    cid: fnv8("You've gone too far this time."),
    translation: "这次你太过分了。",
    chunks: ["You've gone too far","this time."],
    hints: ["你已经越界了","这一次"],
    grammar: [
      {role:"习语·完成时", color:"#7c5cbf", phonetic:["/juːv/","/ɡɒn/","/tuː/","/fɑːr/"], pos:"现在完成时", meaning:"go too far 越界"},
      {role:"时间状语", color:"#3358e0", phonetic:["/ðɪs/","/taɪm/"], pos:"时间状语", meaning:"这一次"}
    ],
    explanations: [
      "**go too far** 用完成时 = 已经越界了，强调事情已经发生、收不回来。",
      "区别：That's going too far 是就当下的事评价；You've gone too far 是直接给对方定性。例句：You've gone too far this time — don't call me again."
    ]
  },
  {
    sentence: "You're nothing to me.",
    cid: fnv8("You're nothing to me."),
    translation: "你对我来说什么都不是。",
    chunks: ["You're nothing","to me."],
    hints: ["你什么都不是","对我来说"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/jʊr/","/ˈnʌθɪŋ/"], pos:"主系表结构", meaning:"你什么都不是"},
      {role:"介词短语", color:"#3358e0", phonetic:["/tuː/","/miː/"], pos:"介词短语", meaning:"对我来说"}
    ],
    explanations: [
      "**be nothing to sb** = 对某人来说无足轻重。关系彻底了断时的狠话。",
      "近义：You mean nothing to me。例句：You're nothing to me now — don't ever call again."
    ]
  },
  {
    sentence: "You set me up — it was a trap!",
    cid: fnv8("You set me up — it was a trap!"),
    translation: "你陷害我，那是个圈套！",
    chunks: ["You set me up —","it was a trap!"],
    hints: ["你设计我","那是个圈套"],
    grammar: [
      {role:"习语·主谓宾", color:"#7c5cbf", phonetic:["/juː/","/set/","/miː/","/ʌp/"], pos:"一般过去时习语", meaning:"set sb up 陷害某人"},
      {role:"主系表", color:"#3358e0", phonetic:["/ɪt/","/wɒz/","/ə/","/træp/"], pos:"主系表结构", meaning:"那是个陷阱"}
    ],
    explanations: [
      "**set sb up** = 陷害某人、给某人下套；也能表示「撮合两人交往」（set sb up with sb），看宾语判断。",
      "近义：frame sb（伪造证据陷害）。例句：You set me up — it was a trap!"
    ]
  },
  {
    sentence: "You're so careless — you left the door open.",
    cid: fnv8("You're so careless — you left the door open."),
    translation: "你太粗心了，门都没关。",
    chunks: ["You're so careless —","you left the door open."],
    hints: ["你太粗心","你没关门"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/jʊr/","/soʊ/","/ˈkerləs/"], pos:"主系表结构", meaning:"你太粗心"},
      {role:"主谓宾补", color:"#3358e0", phonetic:["/juː/","/left/","/ðə/","/dɔːr/","/ˈoʊpən/"], pos:"一般过去时", meaning:"你没关门"}
    ],
    explanations: [
      "**careless** = 粗心的、不上心的。指责别人疏漏时的直接说法，语气比「笨」轻。",
      "近义：You're so sloppy（更口语）。例句：You're so careless — you left the door wide open."
    ]
  },
  {
    sentence: "Stop giving me a hard time.",
    cid: fnv8("Stop giving me a hard time."),
    translation: "别再为难我了。",
    chunks: ["Stop giving me","a hard time."],
    hints: ["别再给我","难处"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/stɒp/","/ˈɡɪvɪŋ/","/miː/"], pos:"祈使句", meaning:"give sb a hard time 为难某人"},
      {role:"宾语", color:"#3358e0", phonetic:["/ə/","/hɑːrd/","/taɪm/"], pos:"名词短语", meaning:"难熬的处境"}
    ],
    explanations: [
      "**give sb a hard time** = 为难某人、找某人麻烦；也可指「让某人日子不好过」。",
      "近义：Stop hassling me / Get off my back。例句：Stop giving me a hard time — I'm doing my best."
    ]
  },
  {
    sentence: "Stay out of it — this is between us.",
    cid: fnv8("Stay out of it — this is between us."),
    translation: "别插手，这是我们之间的事。",
    chunks: ["Stay out of it —","this is between us."],
    hints: ["别插手","这是我们之间的事"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/steɪ/","/aʊt/","/əv/","/ɪt/"], pos:"祈使句", meaning:"stay out of it 别插手"},
      {role:"主系表", color:"#3358e0", phonetic:["/ðɪs/","/ɪz/","/bɪˈtwiːn/","/ʌs/"], pos:"主系表结构", meaning:"这是我们俩之间的事"}
    ],
    explanations: [
      "**stay out of it** = 别插手、别搅进来。it 指正在发生的那件事，常配 between us 划清范围。",
      "近义：Mind your own business / Don't get involved。例句：Stay out of it — this is between us."
    ]
  },
  {
    sentence: "I won't put up with this anymore.",
    cid: fnv8("I won't put up with this anymore."),
    translation: "我不会再忍这件事了。",
    chunks: ["I won't","put up with this anymore."],
    hints: ["我不会","再忍受这件事了"],
    grammar: [
      {role:"主谓·否定", color:"#c87033", phonetic:["/aɪ/","/woʊnt/"], pos:"一般将来时否定", meaning:"我不会"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/pʊt/","/ʌp/","/wɪð/","/ðɪs/","/ˌeniˈmɔːr/"], pos:"短语动词", meaning:"put up with 忍受"}
    ],
    explanations: [
      "**put up with sth** = 忍受某事。put 与 up 中间不能插别的词，with 后接忍受的对象。",
      "近义：tolerate / stand。例句：I won't put up with this anymore — one more word and I'm leaving."
    ]
  },
  {
    sentence: "What's the fuss about?",
    cid: fnv8("What's the fuss about?"),
    translation: "闹什么呢？",
    chunks: ["What's the fuss","about?"],
    hints: ["吵什么呢","为了什么"],
    grammar: [
      {role:"习语·疑问", color:"#7c5cbf", phonetic:["/wʌts/","/ðə/","/fʌs/"], pos:"名词习语", meaning:"the fuss 大惊小怪"},
      {role:"疑问·介词", color:"#3358e0", phonetic:["/əˈbaʊt/"], pos:"介词", meaning:"关于"}
    ],
    explanations: [
      "**fuss** = 大惊小怪、无谓的吵闹。What's the fuss about? 就是「至于这么大动静吗」。",
      "近义：What's all the commotion? 例句：What's the fuss about — it's only a little rain."
    ]
  },
  {
    sentence: "I'm not in a good mood.",
    cid: fnv8("I'm not in a good mood."),
    translation: "我心情不太好。",
    chunks: ["I'm not","in a good mood."],
    hints: ["我并不","心情好"],
    grammar: [
      {role:"主系·否定", color:"#c87033", phonetic:["/aɪm/","/nɒt/"], pos:"主系表否定", meaning:"我并不"},
      {role:"介词短语", color:"#3358e0", phonetic:["/ɪn/","/ə/","/ɡʊd/","/muːd/"], pos:"介词短语", meaning:"心情好"}
    ],
    explanations: [
      "**in a good mood** = 心情好。加 not 就是「心情不好」，是英语里最常用的状态自述。",
      "近义：I'm in a bad mood / I'm feeling down。例句：I'm not in a good mood — let's talk tomorrow."
    ]
  },
  {
    sentence: "I'm cranky today.",
    cid: fnv8("I'm cranky today."),
    translation: "我今天脾气不好。",
    chunks: ["I'm cranky","today."],
    hints: ["我脾气不好","今天"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/aɪm/","/ˈkræŋki/"], pos:"主系表结构", meaning:"我烦躁"},
      {role:"时间状语", color:"#3358e0", phonetic:["/təˈdeɪ/"], pos:"时间状语", meaning:"今天"}
    ],
    explanations: [
      "**cranky** = 烦躁、爱发脾气的，多因没睡好或饿了。比 angry 轻，是美式口语常用词。",
      "近义：I'm grumpy / I'm in a bad mood。例句：I'm cranky today — I didn't sleep well."
    ]
  },
  {
    sentence: "Leave me alone.",
    cid: fnv8("Leave me alone."),
    translation: "让我一个人待着。",
    chunks: ["Leave me","alone."],
    hints: ["让我","独自待着"],
    grammar: [
      {role:"习语·祈使", color:"#7c5cbf", phonetic:["/liːv/","/miː/"], pos:"祈使句", meaning:"leave sb alone 别烦某人"},
      {role:"宾语补足语", color:"#3358e0", phonetic:["/əˈloʊn/"], pos:"形容词补语", meaning:"独自"}
    ],
    explanations: [
      "**leave sb alone** = 别打扰某人、让某人静静。比 go away 温和，重点在「别烦我」。",
      "近义：Give me some space / Back off。例句：Leave me alone — I need to think."
    ]
  },
  {
    sentence: "Why the long face?",
    cid: fnv8("Why the long face?"),
    translation: "怎么拉着脸？",
    chunks: ["Why","the long face?"],
    hints: ["为什么","板着脸"],
    grammar: [
      {role:"疑问·省略", color:"#c87033", phonetic:["/waɪ/"], pos:"省略疑问句", meaning:"怎么啦"},
      {role:"习语·宾语", color:"#7c5cbf", phonetic:["/ðə/","/lɒŋ/","/feɪs/"], pos:"名词习语", meaning:"long face 拉长的脸、不高兴"}
    ],
    explanations: [
      "**long face** = 拉长的脸，指不高兴的表情。Why the long face? 是省略句，等于 Why do you have a long face?。",
      "近义：What's got you down? 例句：Why the long face — did your team lose again?"
    ]
  },
  {
    sentence: "That's ridiculous.",
    cid: fnv8("That's ridiculous."),
    translation: "这太荒唐了。",
    chunks: ["That's","ridiculous."],
    hints: ["这真是","荒唐"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/ðæts/"], pos:"主系结构", meaning:"这真是"},
      {role:"表语", color:"#3358e0", phonetic:["/rɪˈdɪkjələs/"], pos:"形容词", meaning:"荒唐的"}
    ],
    explanations: [
      "**ridiculous** = 荒唐的、离谱的。表达强烈不认同，比 silly 重、比 absurd 日常。",
      "近义：That's absurd / That's insane（更口语）。例句：That's ridiculous — nobody would believe it."
    ]
  },
  {
    sentence: "That's more like it.",
    cid: fnv8("That's more like it."),
    translation: "这才像话。",
    chunks: ["That's","more like it."],
    hints: ["这才","像样"],
    grammar: [
      {role:"主系", color:"#c87033", phonetic:["/ðæts/"], pos:"主系结构", meaning:"这才"},
      {role:"习语·表语", color:"#7c5cbf", phonetic:["/mɔːr/","/laɪk/","/ɪt/"], pos:"形容词习语", meaning:"more like it 像样"}
    ],
    explanations: [
      "**more like it** = 这才像话、这才对嘛。对刚出现的好转表示认可。",
      "近义：Now you're talking / That's better。例句：That's more like it — now we're getting somewhere."
    ]
  },
  {
    sentence: "I hope your idea takes wings.",
    cid: fnv8("I hope your idea takes wings."),
    translation: "希望你的想法能起飞。",
    chunks: ["I hope your idea","takes wings."],
    hints: ["我希望你的想法","能展翅高飞"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/hoʊp/","/jʊr/","/aɪˈdɪə/"], pos:"一般现在时", meaning:"我希望你的想法"},
      {role:"习语·宾语从句", color:"#7c5cbf", phonetic:["/teɪks/","/wɪŋz/"], pos:"动词习语", meaning:"take wings 腾飞"}
    ],
    explanations: [
      "**take wings** = 展翅高飞，比喻想法、计划腾飞起来。祝福或期待时用。",
      "近义：I hope it takes off。例句：I hope your idea takes wings — it deserves a chance."
    ]
  },
  {
    sentence: "Don't rob Peter to pay Paul.",
    cid: fnv8("Don't rob Peter to pay Paul."),
    translation: "别拆东墙补西墙。",
    chunks: ["Don't rob Peter","to pay Paul."],
    hints: ["别抢彼得的","去还给保罗"],
    grammar: [
      {role:"习语·祈使否定", color:"#7c5cbf", phonetic:["/doʊnt/","/rɒb/","/ˈpiːtər/"], pos:"祈使句否定", meaning:"rob Peter to pay Paul 拆东墙补西墙"},
      {role:"目的状语", color:"#3358e0", phonetic:["/tuː/","/peɪ/","/pɔːl/"], pos:"不定式作目的状语", meaning:"为了还给保罗"}
    ],
    explanations: [
      "**rob Peter to pay Paul** = 拆东墙补西墙，借新债还旧债。Peter 和 Paul 在英语里泛指「张三李四」。",
      "近义：take from one to give to another。例句：Don't rob Peter to pay Paul — fix the real problem."
    ]
  },
  {
    sentence: "I almost made it.",
    cid: fnv8("I almost made it."),
    translation: "我差一点就成了。",
    chunks: ["I almost","made it."],
    hints: ["我差点","成功了"],
    grammar: [
      {role:"主谓·程度", color:"#c87033", phonetic:["/aɪ/","/ˈɔːlmoʊst/"], pos:"副词修饰", meaning:"我差点"},
      {role:"习语·谓语", color:"#7c5cbf", phonetic:["/meɪd/","/ɪt/"], pos:"一般过去时习语", meaning:"make it 成功、赶到"}
    ],
    explanations: [
      "**make it** = 成功、赶上、撑过来（看语境）。almost made it 就是「差一点点就做到了」。",
      "近义：I was so close。例句：I almost made it — the train doors shut right in front of me."
    ]
  },
  {
    sentence: "I don't have the heart to tell her.",
    cid: fnv8("I don't have the heart to tell her."),
    translation: "我不忍心告诉她。",
    chunks: ["I don't have the heart","to tell her."],
    hints: ["我不忍心","去告诉她"],
    grammar: [
      {role:"习语·否定", color:"#7c5cbf", phonetic:["/aɪ/","/doʊnt/","/hæv/","/ðə/","/hɑːrt/"], pos:"动词习语", meaning:"have the heart 忍心"},
      {role:"不定式", color:"#3358e0", phonetic:["/tuː/","/tel/","/hɜːr/"], pos:"不定式", meaning:"去告诉她"}
    ],
    explanations: [
      "**have the heart to do sth** = 忍心做某事。多用于否定，表示「狠不下心」。",
      "近义：I can't bring myself to tell her。例句：I don't have the heart to tell her the cat is gone."
    ]
  },
  {
    sentence: "I can't bear to watch.",
    cid: fnv8("I can't bear to watch."),
    translation: "我不忍心看下去。",
    chunks: ["I can't bear","to watch."],
    hints: ["我受不了","去看"],
    grammar: [
      {role:"主谓·否定", color:"#c87033", phonetic:["/aɪ/","/kænt/","/ber/"], pos:"情态动词否定", meaning:"我无法忍受"},
      {role:"不定式", color:"#3358e0", phonetic:["/tuː/","/wɒtʃ/"], pos:"不定式作宾语", meaning:"去看"}
    ],
    explanations: [
      "**can't bear to do sth** = 不忍心做某事、受不了做某事。bear 在这里是「忍受」。",
      "近义：I can't stand to watch。例句：I can't bear to watch — tell me how it ends."
    ]
  }
,
  {
    sentence: "A word of advice — book your tickets early.",
    cid: fnv8("A word of advice — book your tickets early."),
    translation: "给你个忠告，早点订票。",
    chunks: ["A word of advice —","book your tickets early."],
    hints: ["给你个忠告","早点订票"],
    grammar: [
      {role:"独立成分", color:"#7c5cbf", phonetic:["/ə/","/wɜːrd/","/əv/","/ədˈvaɪs/"], pos:"名词短语", meaning:"给你个忠告"},
      {role:"祈使句", color:"#c87033", phonetic:["/bʊk/","/jʊr/","/ˈtɪkɪts/","/ˈɜːrli/"], pos:"祈使句", meaning:"早点订票"}
    ],
    explanations: [
      "**A word of advice** = 给你个忠告。在给出建议前先提个醒，比直接说 Listen to me 柔和，常用于朋友之间。",
      "近义：Here's a tip / A piece of advice. 例句：A word of advice — never sign anything without reading it twice."
    ]
  },
  {
    sentence: "Take it from me — the exam is easier than you think.",
    cid: fnv8("Take it from me — the exam is easier than you think."),
    translation: "听我的没错，考试比你想的简单。",
    chunks: ["Take it from me —","the exam is easier than you think."],
    hints: ["听我的没错","考试比你想的简单"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/teɪk/","/ɪt/","/frəm/","/miː/"], pos:"习语", meaning:"听我的没错"},
      {role:"主系表", color:"#c87033", phonetic:["/ðə/","/ɪɡˈzæm/","/ɪz/","/ˈiːziər/"], pos:"主系表", meaning:"考试比你想的简单"}
    ],
    explanations: [
      "**Take it from me** = 听我的没错。用自己的亲身经历给对方打保票，语气亲近且有分量。",
      "近义：Trust me on this. 例句：Take it from me — you'll regret quitting without a plan."
    ]
  },
  {
    sentence: "Be that as it may, we still need to finish today.",
    cid: fnv8("Be that as it may, we still need to finish today."),
    translation: "即便如此，今天还是得完成。",
    chunks: ["Be that as it may,","we still need to finish today."],
    hints: ["即便如此","今天还是得完成"],
    grammar: [
      {role:"让步状语", color:"#7c5cbf", phonetic:["/biː/","/ðæt/","/æz/","/ɪt/","/meɪ/"], pos:"让步状语从句", meaning:"即便如此"},
      {role:"主句", color:"#c87033", phonetic:["/wiː/","/stɪl/","/niːd/","/tə/","/ˈfɪnɪʃ/"], pos:"主谓", meaning:"我们今天还得完成"}
    ],
    explanations: [
      "**Be that as it may** = 即便如此。先承认对方说得有道理，再转折说出自己的重点，是正式场合好用的让步句。",
      "近义：Even so / That said. 例句：Be that as it may, the deadline hasn't changed."
    ]
  },
  {
    sentence: "Let's play it by ear and see how the weather is.",
    cid: fnv8("Let's play it by ear and see how the weather is."),
    translation: "随机应变吧，看天气再定。",
    chunks: ["Let's play it by ear","and see how the weather is."],
    hints: ["随机应变吧","看天气再定"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/pleɪ/","/ɪt/","/baɪ/","/ɪr/"], pos:"习语", meaning:"随机应变"},
      {role:"并列谓语", color:"#c87033", phonetic:["/siː/","/haʊ/","/ðə/","/ˈweðər/"], pos:"并列句", meaning:"再看看天气"}
    ],
    explanations: [
      "**Play it by ear** = 随机应变、走一步看一步。原指不看谱凭耳朵演奏，引申为不提前定死计划。",
      "近义：See how it goes. 例句：Let's not book anything — we'll play it by ear."
    ]
  },
  {
    sentence: "Anything you say — you're the boss here.",
    cid: fnv8("Anything you say — you're the boss here."),
    translation: "听你的，这儿你说了算。",
    chunks: ["Anything you say —","you're the boss here."],
    hints: ["听你的","这儿你说了算"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/ˈeniθɪŋ/","/juː/","/seɪ/"], pos:"习语", meaning:"听你的"},
      {role:"主系表", color:"#c87033", phonetic:["/jʊr/","/ðə/","/bɔːs/","/hɪr/"], pos:"主系表", meaning:"这儿你说了算"}
    ],
    explanations: [
      "**Anything you say** = 听你的、照你说的办。表示完全服从对方，语气可诚恳也可带点无奈。",
      "近义：Whatever you say / Your call. 例句：Anything you say — I'll follow your lead."
    ]
  },
  {
    sentence: "I suppose so, though I'm not really sure.",
    cid: fnv8("I suppose so, though I'm not really sure."),
    translation: "我想是吧，虽然不太确定。",
    chunks: ["I suppose so,","though I'm not really sure."],
    hints: ["我想是吧","虽然不太确定"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪ/","/səˈpoʊz/","/soʊ/"], pos:"主谓宾", meaning:"我想是吧"},
      {role:"让步状语", color:"#3358e0", phonetic:["/ðoʊ/","/aɪm/","/nɑːt/","/ˈrɪəli/","/ʃʊr/"], pos:"让步状语从句", meaning:"虽然我不太确定"}
    ],
    explanations: [
      "**I suppose so** = 我想是吧。勉强的同意，暗示自己并不十分认同，只是不想争。",
      "对比：I think so 更有把握；I suppose so 把握不足。例句：I suppose so, but don't quote me on it."
    ]
  },
  {
    sentence: "I'm not sure — let me check and get back to you.",
    cid: fnv8("I'm not sure — let me check and get back to you."),
    translation: "我不确定，我查一下再回复你。",
    chunks: ["I'm not sure —","let me check and get back to you."],
    hints: ["我不确定","我查一下再回复你"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/aɪm/","/nɑːt/","/ʃʊr/"], pos:"主系表", meaning:"我不确定"},
      {role:"祈使句", color:"#e74c7a", phonetic:["/let/","/miː/","/tʃek/","/ɡet/","/bæk/"], pos:"祈使句", meaning:"让我查一下再答复"}
    ],
    explanations: [
      "**I'm not sure** = 我不确定。职场里最安全的缓冲句，比直接说 No 或 I don't know 更专业。",
      "搭配：get back to you 稍后答复你。例句：I'm not sure — let me check with the team and get back to you."
    ]
  },
  {
    sentence: "Do you have a problem with the new plan?",
    cid: fnv8("Do you have a problem with the new plan?"),
    translation: "你对新方案有意见吗？",
    chunks: ["Do you have a problem","with the new plan?"],
    hints: ["你有意见吗","对新方案"],
    grammar: [
      {role:"疑问句", color:"#c87033", phonetic:["/duː/","/juː/","/hæv/","/ə/","/ˈprɑːbləm/"], pos:"疑问句", meaning:"你有意见吗"},
      {role:"介词短语", color:"#3358e0", phonetic:["/wɪð/","/ðə/","/nuː/","/plæn/"], pos:"介宾短语", meaning:"对这个新方案"}
    ],
    explanations: [
      "**Have a problem with sth** = 对某事有意见、有不满。可直接询问，也可反击别人。",
      "注意语气：问句是询问；陈述句 I have a problem with that. 就是明确反对了。例句：Do you have a problem with the way I did it?"
    ]
  },
  {
    sentence: "You helped me last week, so now we are even.",
    cid: fnv8("You helped me last week, so now we are even."),
    translation: "你上周帮过我，现在咱俩扯平了。",
    chunks: ["You helped me last week,","so now we are even."],
    hints: ["你上周帮过我","所以现在扯平了"],
    grammar: [
      {role:"主谓宾", color:"#c87033", phonetic:["/juː/","/helpt/","/miː/","/læst/","/wiːk/"], pos:"主谓宾", meaning:"你上周帮了我"},
      {role:"主系表", color:"#3358e0", phonetic:["/soʊ/","/naʊ/","/wiː/","/ɑːr/","/ˈiːvn/"], pos:"主系表", meaning:"现在咱俩扯平了"}
    ],
    explanations: [
      "**We are even** = 咱俩扯平了。指人情、账目两清，谁也不欠谁，常带轻松口吻。",
      "近义：We're square / Call it even. 例句：Thanks for the ride — now we're even."
    ]
  },
  {
    sentence: "Fine, have your way — but don't blame me later.",
    cid: fnv8("Fine, have your way — but don't blame me later."),
    translation: "行，随你，但回头别怪我。",
    chunks: ["Fine, have your way —","but don't blame me later."],
    hints: ["行，随你","但回头别怪我"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/hæv/","/jʊr/","/weɪ/"], pos:"习语", meaning:"随你、由着你"},
      {role:"祈使句", color:"#e74c7a", phonetic:["/bʌt/","/doʊnt/","/bleɪm/","/miː/","/ˈleɪtər/"], pos:"祈使句", meaning:"回头别怪我"}
    ],
    explanations: [
      "**Have your way** = 随你、由着你的意思来。多带无奈或不满，暗示后果自负。",
      "近义：Have it your way. 例句：Fine, have your way — just don't come crying to me."
    ]
  },
  {
    sentence: "Don't be mad at me — it was an honest mistake.",
    cid: fnv8("Don't be mad at me — it was an honest mistake."),
    translation: "别生我气，这是个无心的错。",
    chunks: ["Don't be mad at me —","it was an honest mistake."],
    hints: ["别生我气","这是个无心的错"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/doʊnt/","/biː/","/mæd/","/æt/","/miː/"], pos:"祈使句", meaning:"别生我的气"},
      {role:"主系表", color:"#c87033", phonetic:["/ɪt/","/wəz/","/ən/","/ˈɑːnɪst/","/mɪˈsteɪk/"], pos:"主系表", meaning:"这是个无心的错误"}
    ],
    explanations: [
      "**Be mad at sb** = 生某人的气。加上 an honest mistake（无心的过失）就是在请求原谅。",
      "近义：Don't be angry with me. 例句：Don't be mad at me — the file got deleted by accident."
    ]
  },
  {
    sentence: "Do I have to go to the meeting — I'm exhausted.",
    cid: fnv8("Do I have to go to the meeting — I'm exhausted."),
    translation: "我一定得去开会吗，我累坏了。",
    chunks: ["Do I have to go to the meeting —","I'm exhausted."],
    hints: ["我一定得去开会吗","我累坏了"],
    grammar: [
      {role:"疑问句", color:"#c87033", phonetic:["/duː/","/aɪ/","/hæv/","/tə/","/ɡoʊ/"], pos:"疑问句", meaning:"我非得去吗"},
      {role:"主系表", color:"#3358e0", phonetic:["/aɪm/","/ɪɡˈzɔːstɪd/"], pos:"主系表", meaning:"我累坏了"}
    ],
    explanations: [
      "**Do I have to...?** = 我非得……吗？带委屈或不情愿的抱怨口气，比 Must I 更口语。",
      "近义：Is it really necessary? 例句：Do I have to stay late again — I've got plans."
    ]
  },
  {
    sentence: "You go girl — show them what you can do!",
    cid: fnv8("You go girl — show them what you can do!"),
    translation: "加油姑娘，让他们看看你的本事。",
    chunks: ["You go girl —","show them what you can do!"],
    hints: ["加油姑娘","让他们看看你的本事"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/juː/","/ɡoʊ/","/ɡɜːrl/"], pos:"口头语", meaning:"加油，姑娘"},
      {role:"祈使句", color:"#c87033", phonetic:["/ʃoʊ/","/ðem/","/wʌt/","/juː/","/kən/"], pos:"祈使句", meaning:"让他们看看你的本事"}
    ],
    explanations: [
      "**You go girl!** = 加油姑娘！专门给女性打气的口头语，热情、带姐妹感，多用于朋友之间。",
      "近义：Go for it / You got this. 例句：You go girl — that presentation was amazing!"
    ]
  },
  {
    sentence: "By the way, did you get my message?",
    cid: fnv8("By the way, did you get my message?"),
    translation: "顺便问一下，你收到我的消息了吗？",
    chunks: ["By the way,","did you get my message?"],
    hints: ["顺便问一下","你收到我的消息了吗"],
    grammar: [
      {role:"连接性状语", color:"#7c5cbf", phonetic:["/baɪ/","/ðə/","/weɪ/"], pos:"状语", meaning:"顺便说一下"},
      {role:"疑问句", color:"#c87033", phonetic:["/dɪd/","/juː/","/ɡet/","/maɪ/","/ˈmesɪdʒ/"], pos:"疑问句", meaning:"你收到我的消息了吗"}
    ],
    explanations: [
      "**By the way**（缩写 BTW）= 顺便说一下。用来插入一个跟当前话题无关的新话题。",
      "近义：Incidentally / Speaking of which. 例句：By the way, the meeting moved to three."
    ]
  },
  {
    sentence: "Hey, what's happening — long time no see!",
    cid: fnv8("Hey, what's happening — long time no see!"),
    translation: "嘿，最近怎么样，好久不见。",
    chunks: ["Hey, what's happening —","long time no see!"],
    hints: ["嘿，最近怎么样","好久不见"],
    grammar: [
      {role:"问候语", color:"#7c5cbf", phonetic:["/wʌts/","/ˈhæpənɪŋ/"], pos:"口头语", meaning:"最近怎么样"},
      {role:"习语", color:"#3358e0", phonetic:["/lɔːŋ/","/taɪm/","/noʊ/","/siː/"], pos:"习语", meaning:"好久不见"}
    ],
    explanations: [
      "**What's happening?** = 最近怎么样、有什么新鲜事？轻松的朋友式问候，比 How are you 更随意。",
      "近义：What's up / How's it going. 例句：Hey man, what's happening — you look great!"
    ]
  },
  {
    sentence: "How's everything at your new job?",
    cid: fnv8("How's everything at your new job?"),
    translation: "你的新工作一切都好吗？",
    chunks: ["How's everything","at your new job?"],
    hints: ["一切都好吗","在你的新工作"],
    grammar: [
      {role:"疑问句", color:"#c87033", phonetic:["/haʊz/","/ˈevriθɪŋ/"], pos:"疑问句", meaning:"一切都好吗"},
      {role:"介词短语", color:"#3358e0", phonetic:["/æt/","/jʊr/","/nuː/","/dʒɑːb/"], pos:"介宾短语", meaning:"在你的新工作"}
    ],
    explanations: [
      "**How's everything?** = 一切都好吗？泛问近况的问候，比 How are you 更关心具体生活状态。",
      "近义：How are things? 例句：How's everything at home — is your mother better?"
    ]
  },
  {
    sentence: "Make yourself comfortable and feel at home.",
    cid: fnv8("Make yourself comfortable and feel at home."),
    translation: "别拘束，就当在自己家一样。",
    chunks: ["Make yourself comfortable","and feel at home."],
    hints: ["别拘束","就当在自己家"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/meɪk/","/jʊrˈself/","/ˈkʌmftəbl/"], pos:"祈使句", meaning:"别拘束"},
      {role:"习语", color:"#7c5cbf", phonetic:["/fil/","/æt/","/hoʊm/"], pos:"习语", meaning:"像在自己家一样"}
    ],
    explanations: [
      "**Feel at home** = 像在自己家一样自在。招待客人时的标准客套话，等于「别客气」。",
      "近义：Make yourself at home. 例句：Come in, feel at home — I'll get you a drink."
    ]
  },
  {
    sentence: "Could I get a little help with these boxes?",
    cid: fnv8("Could I get a little help with these boxes?"),
    translation: "能帮我搬一下这些箱子吗？",
    chunks: ["Could I get a little help","with these boxes?"],
    hints: ["能帮我一把吗","搬这些箱子"],
    grammar: [
      {role:"疑问句", color:"#c87033", phonetic:["/kʊd/","/aɪ/","/ɡet/","/ə/","/ˈlɪtl/"], pos:"疑问句", meaning:"我能得到一点帮助吗"},
      {role:"介词短语", color:"#3358e0", phonetic:["/wɪð/","/ðiːz/","/ˈbɑːksɪz/"], pos:"介宾短语", meaning:"搬这些箱子"}
    ],
    explanations: [
      "**A little help** = 帮个小忙。用 little 把请求说小，显得不麻烦别人，比 Can you help me 更客气。",
      "近义：Could you give me a hand? 例句：A little help here — this thing weighs a ton."
    ]
  },
  {
    sentence: "No matter what happens, my heart belongs to you.",
    cid: fnv8("No matter what happens, my heart belongs to you."),
    translation: "不管发生什么，我的心都属于你。",
    chunks: ["No matter what happens,","my heart belongs to you."],
    hints: ["不管发生什么","我的心都属于你"],
    grammar: [
      {role:"让步状语", color:"#3358e0", phonetic:["/noʊ/","/ˈmætər/","/wʌt/","/ˈhæpənz/"], pos:"让步状语从句", meaning:"不管发生什么"},
      {role:"主谓宾", color:"#c87033", phonetic:["/maɪ/","/hɑːrt/","/bɪˈlɔːŋz/","/tə/","/juː/"], pos:"主谓宾", meaning:"我的心属于你"}
    ],
    explanations: [
      "**My heart belongs to you** = 我的心属于你。很重的一句表白，belong to 是「归属于」，比 I love you 更庄重。",
      "近义：I'm yours. 例句：No matter how far apart we are, my heart belongs to you."
    ]
  },
  {
    sentence: "Why don't you take the lead on this one?",
    cid: fnv8("Why don't you take the lead on this one?"),
    translation: "这件事你来牵头吧。",
    chunks: ["Why don't you take the lead","on this one?"],
    hints: ["你来牵头吧","就这件事"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/teɪk/","/ðə/","/liːd/"], pos:"习语", meaning:"牵头、带头"},
      {role:"介词短语", color:"#3358e0", phonetic:["/ɑːn/","/ðɪs/","/wʌn/"], pos:"介宾短语", meaning:"就这一件"}
    ],
    explanations: [
      "**Take the lead** = 牵头、带头、挑大梁。用 Why don't you... 提建议，语气委婉不生硬。",
      "近义：Lead the way / Head it up. 例句：You know the client best, so take the lead on this one."
    ]
  },
  {
    sentence: "I dropped the ball on the last order — sorry.",
    cid: fnv8("I dropped the ball on the last order — sorry."),
    translation: "上一单我搞砸了，抱歉。",
    chunks: ["I dropped the ball","on the last order — sorry."],
    hints: ["我把事情搞砸了","上一单，抱歉"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/drɑːpt/","/ðə/","/bɔːl/"], pos:"习语", meaning:"搞砸了、掉链子"},
      {role:"状语", color:"#3358e0", phonetic:["/ɑːn/","/ðə/","/læst/","/ˈɔːrdər/"], pos:"介宾短语", meaning:"在上一单上"}
    ],
    explanations: [
      "**Drop the ball** = 掉链子、把事情办砸了。源自运动里没接住球，职场里用来认错最常用。",
      "近义：Screw up / Mess up. 例句：Sorry, I dropped the ball on the invoice — I'll fix it today."
    ]
  },
  {
    sentence: "Go big or go home — this is your only chance.",
    cid: fnv8("Go big or go home — this is your only chance."),
    translation: "要么全力以赴，要么别干。",
    chunks: ["Go big or go home —","this is your only chance."],
    hints: ["要么全力以赴","要么干脆别做"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/ɡoʊ/","/bɪɡ/","/ɔːr/","/ɡoʊ/","/hoʊm/"], pos:"习语", meaning:"要么全力以赴，要么别做"},
      {role:"主系表", color:"#c87033", phonetic:["/ðɪs/","/ɪz/","/jʊr/","/ˈoʊnli/","/tʃæns/"], pos:"主系表", meaning:"这是你唯一的机会"}
    ],
    explanations: [
      "**Go big or go home** = 要么干票大的，要么干脆别干。强调不留后路、全力投入的拼劲。",
      "近义：All in. 例句：We're pitching to the biggest client — go big or go home."
    ]
  },
  {
    sentence: "Please come in one at a time, not all together.",
    cid: fnv8("Please come in one at a time, not all together."),
    translation: "请一个一个进来，别一起挤。",
    chunks: ["Please come in one at a time,","not all together."],
    hints: ["请一个一个进来","不要一起"],
    grammar: [
      {role:"祈使句", color:"#c87033", phonetic:["/kʌm/","/ɪn/","/wʌn/","/æt/","/ə/","/taɪm/"], pos:"祈使句", meaning:"请一个一个来"},
      {role:"补充否定", color:"#3358e0", phonetic:["/nɑːt/","/ɔːl/","/təˈɡeðər/"], pos:"否定短语", meaning:"不是一起"}
    ],
    explanations: [
      "**One at a time** = 一次一个、一个一个来。维持秩序时的标准说法，常搭配 please 使用。",
      "近义：One by one. 例句：One at a time, please — the elevator is small."
    ]
  },
  {
    sentence: "I'll try my best, but I can't promise anything.",
    cid: fnv8("I'll try my best, but I can't promise anything."),
    translation: "我会尽力，但不能保证什么。",
    chunks: ["I'll try my best,","but I can't promise anything."],
    hints: ["我会尽力","但不能保证什么"],
    grammar: [
      {role:"主谓宾", color:"#7c5cbf", phonetic:["/traɪ/","/maɪ/","/best/"], pos:"习语", meaning:"我会尽力"},
      {role:"并列句", color:"#c87033", phonetic:["/bʌt/","/aɪ/","/kænt/","/ˈprɑːmɪs/"], pos:"主谓宾", meaning:"但我不能保证"}
    ],
    explanations: [
      "**Try my best** = 尽我所能。比 I'll try 更认真；后面加 but I can't promise 就是先把预期压住。",
      "对比：do my best 更侧重「尽力做」；try my best 侧重「尝试」。例句：I'll try my best — no promises though."
    ]
  },
  {
    sentence: "Be ready for anything — the plan may change.",
    cid: fnv8("Be ready for anything — the plan may change."),
    translation: "做好万全准备，计划可能变。",
    chunks: ["Be ready for anything —","the plan may change."],
    hints: ["做好万全准备","计划可能变"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/biː/","/ˈredi/","/fər/","/ˈeniθɪŋ/"], pos:"祈使句", meaning:"对任何情况都做好准备"},
      {role:"主谓", color:"#c87033", phonetic:["/ðə/","/plæn/","/meɪ/","/tʃeɪndʒ/"], pos:"主谓", meaning:"计划可能会变"}
    ],
    explanations: [
      "**Be ready for sth** = 为某事做好准备。加 anything 就是「什么情况都可能，都得有准备」。",
      "近义：Expect the unexpected. 例句：Be ready for anything — the client loves changing specs."
    ]
  },
  {
    sentence: "Could you speed up a little — we're running late.",
    cid: fnv8("Could you speed up a little — we're running late."),
    translation: "你能快点吗，我们要迟到了。",
    chunks: ["Could you speed up a little —","we're running late."],
    hints: ["你能快一点吗","我们要迟到了"],
    grammar: [
      {role:"短语动词", color:"#7c5cbf", phonetic:["/spiːd/","/ʌp/"], pos:"短语动词", meaning:"加快速度"},
      {role:"主谓", color:"#c87033", phonetic:["/wɪr/","/ˈrʌnɪŋ/","/leɪt/"], pos:"主谓", meaning:"我们要迟到了"}
    ],
    explanations: [
      "**Speed up** = 加快速度。反义是 slow down；加 a little 让催促听起来不那么冲。",
      "近义：Hurry up / Step on it. 例句：Could you speed up a bit — the train leaves at six."
    ]
  }
,
  {
    sentence: "Could you back up a little — you're blocking the door.",
    cid: fnv8("Could you back up a little — you're blocking the door."),
    translation: "你能退后一点吗，你挡住门了。",
    chunks: ["Could you back up a little —","you're blocking the door."],
    hints: ["你能退后一点吗","你挡住门了"],
    grammar: [
      {role:"短语动词", color:"#7c5cbf", phonetic:["/bæk/","/ʌp/"], pos:"短语动词", meaning:"后退"},
      {role:"主谓宾", color:"#c87033", phonetic:["/jʊr/","/ˈblɑːkɪŋ/","/ðə/","/dɔːr/"], pos:"主谓宾", meaning:"你挡着门"}
    ],
    explanations: [
      "**Back up** = 后退（空间）；同一短语另有「支持」和「备份」两义，靠语境区分。",
      "近义：Step back / Move back. 例句：Back up — you're standing too close to the edge."
    ]
  },
  {
    sentence: "Drink some water and sober up before you leave.",
    cid: fnv8("Drink some water and sober up before you leave."),
    translation: "喝点水，醒醒酒再走。",
    chunks: ["Drink some water","and sober up before you leave."],
    hints: ["喝点水","醒醒酒再走"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/drɪŋk/","/sʌm/","/ˈwɔːtər/"], pos:"祈使句", meaning:"喝点水"},
      {role:"短语动词", color:"#7c5cbf", phonetic:["/ˈsoʊbər/","/ʌp/"], pos:"短语动词", meaning:"醒酒"}
    ],
    explanations: [
      "**Sober up** = 醒酒、清醒过来。sober 本身是形容词「清醒的」，加 up 变成「从醉态里出来」。",
      "近义：Sleep it off. 例句：He needs an hour to sober up before he can drive."
    ]
  },
  {
    sentence: "We strive to make every customer feel welcome.",
    cid: fnv8("We strive to make every customer feel welcome."),
    translation: "我们努力让每位顾客感到宾至如归。",
    chunks: ["We strive to","make every customer feel welcome."],
    hints: ["我们努力做到","让每位顾客感到宾至如归"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/wiː/","/straɪv/","/tə/"], pos:"主谓", meaning:"我们努力"},
      {role:"宾语补足语", color:"#3358e0", phonetic:["/meɪk/","/ˈkʌstəmər/","/fel/","/ˈwelkəm/"], pos:"宾补结构", meaning:"让顾客感到受欢迎"}
    ],
    explanations: [
      "**Strive to do sth** = 力求、努力做某事。比 try hard 更书面、更有使命感，企业文案和演讲高频。",
      "近义：Endeavor to. 例句：We strive to improve our service every single day."
    ]
  },
  {
    sentence: "The moment the alarm rang, the crew sprang into action.",
    cid: fnv8("The moment the alarm rang, the crew sprang into action."),
    translation: "警报一响，全组人立刻行动起来。",
    chunks: ["The moment the alarm rang,","the crew sprang into action."],
    hints: ["警报一响","全组人立刻行动"],
    grammar: [
      {role:"时间状语", color:"#3358e0", phonetic:["/ðə/","/moʊmənt/","/ðə/","/əˈlɑːrm/","/ræŋ/"], pos:"时间状语从句", meaning:"警报一响"},
      {role:"习语", color:"#7c5cbf", phonetic:["/spræŋ/","/ˈɪntə/","/ˈækʃn/"], pos:"习语", meaning:"迅速投入行动"}
    ],
    explanations: [
      "**Spring into action** = 立刻行动起来。spring 是「像弹簧一样弹起」，过去式 sprang，画面感强。",
      "近义：Jump into action. 例句：Emergency teams sprang into action right after the quake."
    ]
  },
  {
    sentence: "Don't be too hard on yourself — tomorrow is another day.",
    cid: fnv8("Don't be too hard on yourself — tomorrow is another day."),
    translation: "别太苛责自己，明天又是新的一天。",
    chunks: ["Don't be too hard on yourself —","tomorrow is another day."],
    hints: ["别太苛责自己","明天又是新的一天"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/doʊnt/","/biː/","/hɑːrd/","/ɔn/","/jʊrˈself/"], pos:"祈使句", meaning:"别对自己太苛刻"},
      {role:"主系表", color:"#c87033", phonetic:["/təˈmɑːroʊ/","/ɪz/","/əˈnʌðər/","/deɪ/"], pos:"主系表", meaning:"明天是崭新的一天"}
    ],
    explanations: [
      "**Tomorrow is another day** = 明天又是新的一天。《乱世佳人》结尾名句，用来安慰人翻篇、别纠结当下。",
      "近义：There's always tomorrow. 例句：We lost this one, but tomorrow is another day."
    ]
  },
  {
    sentence: "Don't let the grass grow under your feet — apply now.",
    cid: fnv8("Don't let the grass grow under your feet — apply now."),
    translation: "别让机会从脚下溜走，现在就申请。",
    chunks: ["Don't let the grass grow under your feet —","apply now."],
    hints: ["别磨蹭","现在就申请"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/ɡræs/","/ɡroʊ/","/ʌndər/","/jʊr/","/fiːt/"], pos:"习语", meaning:"别让时光虚度"},
      {role:"祈使句", color:"#c87033", phonetic:["/əˈplaɪ/","/naʊ/"], pos:"祈使句", meaning:"现在就申请"}
    ],
    explanations: [
      "**Don't let the grass grow under your feet** = 别磨蹭、趁热打铁。画面是人在原地站太久，脚下都长草了。",
      "近义：Strike while the iron is hot. 例句：Don't let the grass grow under your feet — the offer expires Friday."
    ]
  },
  {
    sentence: "He was on his knees, begging for a second chance.",
    cid: fnv8("He was on his knees, begging for a second chance."),
    translation: "他跪了下来，乞求第二次机会。",
    chunks: ["He was on his knees,","begging for a second chance."],
    hints: ["他跪了下来","乞求第二次机会"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ɑn/","/hɪz/","/niːz/"], pos:"介宾短语", meaning:"跪着"},
      {role:"伴随状语", color:"#3358e0", phonetic:["/ˈbeɡɪŋ/","/fər/","/ə/","/ˈsekənd/","/tʃæns/"], pos:"现在分词短语", meaning:"乞求第二次机会"}
    ],
    explanations: [
      "**On one's knees** = 跪下、跪着。字面跪地乞求；引申义是「濒临崩溃」（The company was on its knees.）。",
      "近义：Beg and plead. 例句：She was on her knees scrubbing the floor all morning."
    ]
  },
  {
    sentence: "Get down from there — you'll hurt yourself.",
    cid: fnv8("Get down from there — you'll hurt yourself."),
    translation: "快下来，你会伤到自己的。",
    chunks: ["Get down from there —","you'll hurt yourself."],
    hints: ["快下来","你会伤到自己"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/ɡet/","/daʊn/","/frəm/","/ðer/"], pos:"祈使句", meaning:"从那上面下来"},
      {role:"主谓", color:"#c87033", phonetic:["/jʊl/","/hɜːrt/","/jʊrˈself/"], pos:"主谓宾", meaning:"你会伤到自己"}
    ],
    explanations: [
      "**Get down** = 下来（从高处）。注意别和「趴下」的 Get down!（危险时喊的）搞混——那个靠语气和场景区分。",
      "近义：Come down. 例句：Get down from the ladder — I'll hold it steady."
    ]
  },
  {
    sentence: "It's getting late — let me walk you out.",
    cid: fnv8("It's getting late — let me walk you out."),
    translation: "天色晚了，我送你出去。",
    chunks: ["It's getting late —","let me walk you out."],
    hints: ["天色晚了","我送你出去"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/ˈɡetɪŋ/","/leɪt/"], pos:"主系表", meaning:"天色晚了"},
      {role:"习语", color:"#7c5cbf", phonetic:["/wɔːk/","/juː/","/aʊt/"], pos:"习语", meaning:"送你出去"}
    ],
    explanations: [
      "**Walk you out** = 送你出去（陪走到门口或车边）。待客、约会结束时都常用，比 goodbye 多一分周到。",
      "近义：See you to the door. 例句：Stay a while — I'll walk you out whenever you're ready."
    ]
  },
  {
    sentence: "It's midnight — how are you gonna get home?",
    cid: fnv8("It's midnight — how are you gonna get home?"),
    translation: "都半夜了，你打算怎么回家？",
    chunks: ["It's midnight —","how are you gonna get home?"],
    hints: ["都半夜了","你打算怎么回家"],
    grammar: [
      {role:"主系表", color:"#c87033", phonetic:["/ɪts/","/ˈmɪdnaɪt/"], pos:"主系表", meaning:"已经是半夜"},
      {role:"疑问句", color:"#3358e0", phonetic:["/haʊ/","/ɑːr/","/juː/","/ˈɡənə/","/ɡet/","/hoʊm/"], pos:"疑问句", meaning:"你打算怎么回家"}
    ],
    explanations: [
      "**How are you gonna...?** = 你打算怎么……？gonna 是 going to 的口语缩写，这句话是关心对方的安排。",
      "近义：How will you get back? 例句：The buses stopped running — how are you gonna get home?"
    ]
  },
  {
    sentence: "He worked his way through college by washing dishes.",
    cid: fnv8("He worked his way through college by washing dishes."),
    translation: "他靠洗碗打工读完了大学。",
    chunks: ["He worked his way through college","by washing dishes."],
    hints: ["他一路打工读完了大学","靠洗碗挣钱"],
    grammar: [
      {role:"习语", color:"#7c5cbf", phonetic:["/wɜːrkt/","/hɪz/","/weɪ/","/θruː/","/ˈkɑːlɪdʒ/"], pos:"习语", meaning:"靠打工完成学业"},
      {role:"方式状语", color:"#3358e0", phonetic:["/baɪ/","/ˈwɑːʃɪŋ/","/ˈdɪʃɪz/"], pos:"介宾短语", meaning:"靠洗碗"}
    ],
    explanations: [
      "**Work one's way (through)** = 靠打工、一步一步奋斗着完成。强调过程辛苦但没有外援。",
      "近义：Put oneself through school. 例句：She worked her way up from intern to manager."
    ]
  }
,
  {
    sentence: "I'm working — get out of my face!",
    cid: fnv8("I'm working — get out of my face!"),
    translation: "我在工作——别来烦我！",
    chunks: ["I'm working —","get out of my face!"],
    hints: ["我在工作","别来烦我"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/aɪm/","/ˈwɜːrkɪŋ/"], pos:"主谓", meaning:"我在忙"},
      {role:"习语", color:"#7c5cbf", phonetic:["/ɡet/","/aʊt/","/əv/","/maɪ/","/feɪs/"], pos:"习语", meaning:"别在我眼前晃；滚开"}
    ],
    explanations: [
      "**Get out of my face** = 别在我眼前晃、滚远点。字面是「从我脸前消失」，比 Get lost 更冲，多用于被反复打扰时。",
      "近义：Get out of my sight / Back off. 例句：I'm on a deadline — get out of my face!"
    ]
  },
  {
    sentence: "Don't suck up to the boss — just do your job.",
    cid: fnv8("Don't suck up to the boss — just do your job."),
    translation: "别拍老板马屁——把自己的活干好就行。",
    chunks: ["Don't suck up to the boss —","just do your job."],
    hints: ["别拍老板马屁","把自己的活干好就行"],
    grammar: [
      {role:"祈使句", color:"#e74c7a", phonetic:["/doʊnt/","/sʌk/","/ʌp/"], pos:"祈使句", meaning:"别拍马屁"},
      {role:"祈使句", color:"#e74c7a", phonetic:["/dʒʌst/","/duː/","/jʊr/","/dʒɑːb/"], pos:"祈使句", meaning:"把活干好"}
    ],
    explanations: [
      "**Suck up to sb** = 拍某人马屁、谄媚讨好。名词形式 **suck-up** 就是「马屁精」。",
      "近义：Butter sb up / Kiss up to sb. 例句：He's always sucking up to the manager."
    ]
  },
  {
    sentence: "He got loaded at the party and couldn't drive home.",
    cid: fnv8("He got loaded at the party and couldn't drive home."),
    translation: "他在聚会上喝大了，没法开车回家。",
    chunks: ["He got loaded at the party","and couldn't drive home."],
    hints: ["他在聚会上喝大了","没法开车回家"],
    grammar: [
      {role:"主谓", color:"#c87033", phonetic:["/hi/","/ɡɑːt/","/ˈloʊdɪd/"], pos:"主谓", meaning:"他喝醉了"},
      {role:"谓语", color:"#3358e0", phonetic:["/kʊdnt/","/draɪv/","/hoʊm/"], pos:"谓语", meaning:"开不了车回家"}
    ],
    explanations: [
      "**Get loaded** = 喝醉（美式俚语）。load 本义「装载」，引申成把人「灌满酒」，比 get drunk 更随意。",
      "近义：Get wasted / Tie one on. 例句：They got loaded and sang all night."
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
