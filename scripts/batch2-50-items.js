/* batch2 50 条——50 个 idiomatic 短语嵌入完整例句。
 * 风格与 batch1（60 条）一致。每条 schema：
 *   { sentence, translation, chunks[2-3], hints[2], grammar[2-3], explanations[2] }
 * 配色：#c87033 主/系/谓, #e74c7a 谓语, #3358e0 宾, #7c5cbf idiom/状语
 */
[
  {
    sentence: "No way! I won't sign that contract.",
    cid: fnv8("No way! I won't sign that contract."),
    translation: "没门！我绝不签那份合同。",
    chunks: ["No way!", "I won't sign that contract."],
    hints: ["强烈拒绝的感叹","我绝不签那份合同"],
    grammar: [
      {role:"感叹习语", color:"#7c5cbf", phonetic:["/noʊ/","/weɪ/"], pos:"习语·强烈拒绝", meaning:"不可能！没门！"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/woʊnt/","/saɪn/","/ðæt/","/ˈkɑːntrækt/"], pos:"否定陈述句", meaning:"我不会签合同"}
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
    chunks: ["Come on,", "the bus is almost here!"],
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
    chunks: ["Hold on", "a second —", "I'll get the door."],
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
    chunks: ["Hold it —", "I need to check this first."],
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
    sentence: "Back off! You're in my personal space.",
    cid: fnv8("Back off! You're in my personal space."),
    translation: "退后！你靠得太近了。",
    chunks: ["Back off!", "You're in my personal space."],
    hints: ["要求对方退后","你侵犯了我的私人空间"],
    grammar: [
      {role:"命令习语", color:"#7c5cbf", phonetic:["/bæk/","/ɔːf/"], pos:"习语·命令", meaning:"退后、别靠近"},
      {role:"主系表", color:"#c87033", phonetic:["/jʊr/","/ɪn/","/maɪ/","/ˈpɜːrsənl/","/speɪs/"], pos:"现在进行", meaning:"你进了我的私人空间"}
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
    chunks: ["Cheer up —", "things will get better."],
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
    sentence: "Get lost! I don't want to see you.",
    cid: fnv8("Get lost! I don't want to see you."),
    translation: "滚开！我不想见到你。",
    chunks: ["Get lost!", "I don't want to see you."],
    hints: ["命令对方离开","我不想见你"],
    grammar: [
      {role:"驱赶习语", color:"#7c5cbf", phonetic:["/ɡet/","/lɔːst/"], pos:"习语·命令粗鲁", meaning:"滚开、走开"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/doʊnt/","/wɑːnt/","/siː/","/juː/"], pos:"否定陈述句", meaning:"我不想见你"}
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
    chunks: ["Go ahead", "and start without me."],
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
    chunks: ["Have fun", "at the party tonight!"],
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
    chunks: ["Heads up —", "the meeting moved to 3."],
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
    chunks: ["So be it", "— I won't argue anymore."],
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
    chunks: ["I'll stand by", "you no matter what."],
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
    sentence: "You rock! That was an amazing save.",
    cid: fnv8("You rock! That was an amazing save."),
    translation: "你太棒了！那个救球绝了。",
    chunks: ["You rock!", "That was an amazing save."],
    hints: ["称赞对方","那个救球太神了"],
    grammar: [
      {role:"称赞习语", color:"#7c5cbf", phonetic:["/juː/","/rɑːk/"], pos:"习语·俚语赞誉", meaning:"你很棒、你太厉害了"},
      {role:"主系定语", color:"#c87033", phonetic:["/ðæt/","/wʌz/","/ən/","/əˈmeɪzɪŋ/","/seɪv/"], pos:"主系表", meaning:"那是个绝妙的救球"}
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
    chunks: ["After you —", "please, go in first."],
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
    sentence: "Chop chop! The taxi is leaving!",
    cid: fnv8("Chop chop! The taxi is leaving!"),
    translation: "快点快点！出租车要开走了！",
    chunks: ["Chop chop!", "The taxi is leaving!"],
    hints: ["赶紧","出租车要走"],
    grammar: [
      {role:"催促习语", color:"#7c5cbf", phonetic:["/tʃɑːp/","/tʃɑːp/"], pos:"拟声习语·催促", meaning:"快点快点（拟切菜声）"},
      {role:"主谓", color:"#c87033", phonetic:["/ðə/","/ˈtæksi/","/ɪz/","/ˈliːvɪŋ/"], pos:"现在进行表将来", meaning:"出租车要开走"}
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
    chunks: ["Fire away —", "I'm listening carefully."],
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
    chunks: ["Forget it —", "I don't care anymore."],
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
    chunks: ["Don't talk back", "to your elders."],
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
    chunks: ["That's it —", "I'm done with this job."],
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
    sentence: "What's up? I haven't seen you for ages.",
    cid: fnv8("What's up? I haven't seen you for ages."),
    translation: "最近怎么样？好久不见你啦。",
    chunks: ["What's up?", "I haven't seen you for ages."],
    hints: ["问候语","好久没见你了"],
    grammar: [
      {role:"问候习语", color:"#7c5cbf", phonetic:["/wʌts/","/ʌp/"], pos:"习语·招呼", meaning:"怎么了？最近怎样？"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈhævənt/","/siːn/","/juː/","/fɔːr/","/ˈeɪdʒɪz/"], pos:"现在完成时", meaning:"我很久没见你"}
    ],
    explanations: [
      "**What's up** 招呼/问候：怎么了？最近怎么样？非正式问候，回答常 Not much / Hey。",
      "也可表达"出了什么事"：What's up with him? He looks angry."
    ]
  },
  {
    sentence: "Ask around — somebody must know.",
    cid: fnv8("Ask around — somebody must know."),
    translation: "四处问问吧——总有人知道。",
    chunks: ["Ask around —", "somebody must know."],
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
    sentence: "Come again? I didn't catch that.",
    cid: fnv8("Come again? I didn't catch that."),
    translation: "你说啥？我没听清。",
    chunks: ["Come again?", "I didn't catch that."],
    hints: ["请再说一遍","我没听清"],
    grammar: [
      {role:"求复习语", color:"#7c5cbf", phonetic:["/kʌm/","/əˈɡen/"], pos:"习语·礼貌求复", meaning:"再说一遍？"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈdɪdnt/","/kætʃ/","/ðæt/"], pos:"一般过去否定", meaning:"我没听清"}
    ],
    explanations: [
      "**Come again?** 礼貌求复：请再说一遍？比 What? 更柔和，店员/电话常用。",
      "正式版：Could you repeat that, please? 例：— Room 305. — Come again? — Room 305."
    ]
  },
  {
    sentence: "Cut it out! I'm trying to study.",
    cid: fnv8("Cut it out! I'm trying to study."),
    translation: "别闹了！我正想学习呢。",
    chunks: ["Cut it out!", "I'm trying to study."],
    hints: ["让对方停止","我在学习"],
    grammar: [
      {role:"禁止习语", color:"#7c5cbf", phonetic:["/kʌt/","/ɪt/","/aʊt/"], pos:"习语·命令禁止", meaning:"住手、别闹"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪm/","/ˈtraɪɪŋ/","/ˈstʌdi/"], pos:"现在进行", meaning:"我正试图学习"}
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
    chunks: ["Be my guest —", "help yourself to coffee."],
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
    chunks: ["By no means", "should you open that door."],
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
    chunks: ["He runs the office", "by the book."],
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
    chunks: ["Go easy on", "the salt — I'm on a diet."],
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
    chunks: ["I can't get used to", "waking up early."],
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
    chunks: ["Keep it up —", "you're doing great."],
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
    chunks: ["No big deal —", "I'll fix it later."],
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
    chunks: ["Be there at three", "on the dot."],
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
    chunks: ["Can I take a rain check", "on dinner?"],
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
    chunks: ["Settle down, kids —", "it's bedtime."],
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
    chunks: ["Dinner's on me tonight —", "don't worry."],
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
    translation: "我在这两个 offer 之间犹豫不决。",
    chunks: ["I was torn", "between the two offers."],
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
    chunks: ["I'm low key worried", "about the exam."],
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
    chunks: ["I sort of forgot", "what you said."],
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
    chunks: ["Too bad", "you couldn't make it."],
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
    chunks: ["I said no,", "so there!"],
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
    chunks: ["She thinks", "she's hot stuff."],
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
    chunks: ["I'm good —", "I don't need help."],
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
    chunks: ["Let it go —", "it's not worth fighting."],
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
    chunks: ["Own up —", "you broke the vase."],
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
    chunks: ["My dad is an", "easy-going man."],
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
    chunks: ["Forgive me —", "I didn't mean to interrupt."],
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
    chunks: ["As I say,", "please pay attention."],
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
    chunks: ["No comment", "on the lawsuit."],
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
    chunks: ["Please see to it", "that the door is locked."],
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
    chunks: ["That's well put —", "I agree."],
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
    sentence: "Drop dead! I never want to see you again.",
    cid: fnv8("Drop dead! I never want to see you again."),
    translation: "去死吧！我再也不想见你。",
    chunks: ["Drop dead!", "I never want to see you again."],
    hints: ["极端咒骂","不想再见"],
    grammar: [
      {role:"咒骂习语", color:"#7c5cbf", phonetic:["/drɑːp/","/ded/"], pos:"习语·命令粗鲁", meaning:"去死"},
      {role:"主谓宾", color:"#c87033", phonetic:["/aɪ/","/ˈnevər/","/wɑːnt/","/siː/","/juː/","/əˈɡen/"], pos:"否定陈述句", meaning:"我再也不想见你"}
    ],
    explanations: [
      "**Drop dead** 极端咒骂：去死吧！极端不满/厌恶。注意：儿童/陌生人禁用，太粗鲁。",
      "近义（较轻）：Get lost. 例：— Can you lend me $1000? — Drop dead!"
    ]
  }
]
