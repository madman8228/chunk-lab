/* 日常口语8000句 · 完整教学版（种子库 v2，50 句）
 * 本文件 = 纯数据资产：window.DATA_ORAL8000（50 句，2026-09-07 起并入 builtin-daily，不再独立成 deck）。
 * 数据由 AI 生成，格式与内置题库一致：
 *   { sentence, translation, chunks[2-5], hints[], alts?[null|string[]], grammar[{role,color,phonetic,pos,meaning}], explanations[] }
 * 后续分批扩展时，只需往 window.DATA_ORAL8000 数组里继续追加对象即可。
 * 注意：本文件通过 <script src> 引入，file:// 下可正常加载。
 *
 * ★★★ 数据规范（每次扩写前必读，写完跑 node validate_oral8000.js 自检）★★★
 *  1) 每句拆 2~5 个 chunk
 *  2) 标点（. ? ! , ; :）必须挂在所属词组的尾部，绝不单独成 chunk，也不出现在 chunk 开头
 *     反例(禁止): ["Nice to meet you", "."]  →  正确: ["Nice to", "meet you."]
 *  3) 句末标点(. ? !)只允许出现在【最后一个】chunk；中间 chunk 可带逗号(如 "the menu,")
 *  4) 每个 chunk 应是完整语义单元(动词/名词短语、从句、状语)，避免散碎单字
 *  5) 去空格后 chunks.join('') 必须等于 sentence，防脱字/多字
 *  6) alts（同义答案）可选字段；如提供须是与 chunks 等长的数组，每项为 null 或字符串数组
 *     用途：同一中文对应多种英文表达时（如"收银台"→checkout/cashier/counter），将替代表达放入 alts[i]
 *     例: alts: [null, ["the cashier?", "the counter?"]] 表示第2个chunk可接受3种答案
 *  7) 固定搭配/习语/短语动词不可拆分！常见不可拆列表：
 *     take a message · grab a bite (to eat) · feel oneself · stay home · make it ·
 *     meet up · go for a run · go hiking · have a meeting · do someone a favor ·
 *     sounds like · be good at · enjoy doing · plan to do · see you later · take care
 *     原则：如果两个词在一起构成惯用义≠字面义之和，必须同 chunk
 */
window.DATA_ORAL8000 = [
  {
    sentence: "How are you doing these days?",
    cid: "129c08c0",
    translation: "你最近过得怎么样？",
    chunks: ["How are you doing", "these days?"],
    hints: ["你最近怎么样", "这些天"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/haʊ/','/ɑːr/','/juː/','/ˈduːɪŋ/'],pos:'现在进行时问句',meaning:'你最近过得'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ðiːz/','/deɪz/'],pos:'名词短语',meaning:'这些天'}
    ],
    explanations: [
      "`How are you doing?` 比 `How are you?` 更口语、更关心近况。常见错误：\n• \"How **is** you doing\" → you 是第二人称，要用 are\n• \"How are you **do**\" → 助动词重复，doing 已含进行含义",
      "`these days` 表「最近、这些天」，常与现在时连用。常见错误：\n• \"this **day**\" → 单数不对，days 用复数表一段时期\n• \"in these days\" → 通常不加 in"
    ]
  },
  {
    sentence: "Nice to meet you.",
    cid: "a3d72107",
    translation: "很高兴认识你。",
    chunks: ["Nice to", "meet you."],
    hints: ["很高兴", "认识你"],
    grammar: [
      {role:'固定表达',color:'#3358e0',phonetic:['/naɪs/','/tuː/'],pos:'惯用语开头',meaning:'很高兴'},
      {role:'谓语+宾语',color:'#e74c7a',phonetic:['/miːt/','/juː/'],pos:'动词短语',meaning:'认识你'}
    ],
    explanations: [
      "`Nice to meet you` 是初次见面的固定客套。常见错误：\n• \"Nice **meeting** you\" → 见面当时用 meet（进行时结构）；分手时可以说 Nice meeting you\n• \"**Glad** to meet you\" → 也可以，但 Nice 最常用",
      "这是省略了 `It is` 的结构（It is nice to meet you）。口语中 it is 省略很自然。"
    ]
  },
  {
    sentence: "Could you do me a favor?",
    cid: "534483e8",
    translation: "你能帮我个忙吗？",
    chunks: ["Could you", "do me a favor?"],
    hints: ["你能", "帮我个忙"],
    grammar: [
      {role:'情态动词+主语',color:'#e74c7a',phonetic:['/kʊd/','/juː/'],pos:'委婉请求',meaning:'你能'},
      {role:'宾语+宾语补',color:'#3358e0',phonetic:['/duː/','/miː/','/ə/','/ˈfeɪvər/'],pos:'动词短语',meaning:'帮我个忙'}
    ],
    explanations: [
      "`Could you...` 比 `Can you...` 更礼貌委婉。常见错误：\n• \"Can you **to** do me a favor\" → 情态动词后接动词原形，不要 to\n• \"Could you **doing**\" → 同样要用原形",
      "`do someone a favor` 是固定搭配，中间用 a，不是 the。常见错误：\n• \"do me **the** favor\" → 泛指帮忙用 a\n• \"give me a favor\" → 搭配是 do，不是 give"
    ]
  },
  {
    sentence: "I'm really sorry about that.",
    cid: "b0be2b46",
    translation: "那件事我真的很抱歉。",
    chunks: ["I'm really sorry", "about that."],
    hints: ["我真的很抱歉", "关于那件事"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/ˈrɪəli/','/ˈsɒri/'],pos:'主系表结构',meaning:'我真的很抱歉'},
      {role:'介词宾语',color:'#7c5cbf',phonetic:['/əˈbaʊt/','/ðæt/'],pos:'介词短语',meaning:'关于那件事'}
    ],
    explanations: [
      "`be sorry about + 事` 为某事道歉。常见错误：\n• \"I'm sorry **for** that\" → for 也可以，但 about 更强调针对具体事件\n• \"I'm sorry **to** that\" → 错，about/for 才接名词",
      "`really` 加强语气。注意位置在 be 动词后、形容词前：`I'm really sorry`，不是 `I really am sorry`（后者语法对但语气不同）。"
    ]
  },
  {
    sentence: "Could we get the menu, please?",
    cid: "5e7afb03",
    translation: "请给我们菜单好吗？",
    chunks: ["Could we get", "the menu,", "please?"],
    hints: ["我们能要", "菜单", "请"],
    grammar: [
      {role:'情态+主语+谓语',color:'#e74c7a',phonetic:['/kʊd/','/wiː/','/ɡet/'],pos:'委婉请求',meaning:'我们能要'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈmenjuː/'],pos:'名词短语',meaning:'菜单'},
      {role:'礼貌词',color:'#7c5cbf',phonetic:['/pliːz/'],pos:'语气词',meaning:'请'}
    ],
    explanations: [
      "`Could we get...` 在餐厅向服务员要东西的委婉说法。常见错误：\n• \"Can we **to** get\" → 情态动词后不加 to\n• \"Give us the menu\" → 太直接，缺少 please 和委婉语气",
      "`the menu` 特指这家餐厅的菜单，用 the。餐厅场景是特指，不要 a menu。"
    ]
  },
  {
    sentence: "Where can I find the checkout?",
    cid: "8d72c5ea",
    translation: "我在哪儿能找到收银台？",
    chunks: ["Where can I find", "the checkout?"],
    hints: ["我在哪能找到", "收银台"],
    alts: [null, ["the cashier?", "the counter?"]],
    grammar: [
      {role:'疑问词+情态',color:'#e74c7a',phonetic:['/wer/','/kæn/','/aɪ/','/faɪnd/'],pos:'特殊疑问句',meaning:'我在哪能找到'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈtʃekaʊt/'],pos:'名词',meaning:'收银台'}
    ],
    explanations: [
      "`Where can I find...` 问某物位置。常见错误：\n• \"Where **I can** find\" → 疑问句情态动词要提前到主语前\n• \"Where can I **to** find\" → 不要 to",
      "`checkout` 在英美超市/商场指「收银台/结账处」。同义表达均可：`the cashier`（收银员）、`the counter`（柜台）。"
    ]
  },
  {
    sentence: "Which bus goes to the station?",
    cid: "eb546ded",
    translation: "哪路公交车去车站？",
    chunks: ["Which bus", "goes to", "the station?"],
    hints: ["哪路车", "去", "车站"],
    grammar: [
      {role:'疑问主语',color:'#e74c7a',phonetic:['/wɪtʃ/','/bʌs/'],pos:'疑问词+名词',meaning:'哪路车'},
      {role:'谓语',color:'#c87033',phonetic:['/ɡoʊz/','/tuː/'],pos:'第三人称单数',meaning:'去'},
      {role:'状语',color:'#7c5cbf',phonetic:['/ðə/','/ˈsteɪʃn/'],pos:'介词短语',meaning:'车站'}
    ],
    explanations: [
      "`Which bus` 当主语时，谓语动词用单数 `goes`。常见错误：\n• \"Which bus **go** to\" → 主语是单数 bus，要用 goes\n• \"Which **buses** goes\" → buses 是复数，应用 go",
      "`goes to the station` 中 the 特指对话双方都知道的那个车站。"
    ]
  },
  {
    sentence: "It's pouring outside right now.",
    cid: "8139df49",
    translation: "外面这会儿正下着倾盆大雨。",
    chunks: ["It's pouring", "outside", "right now."],
    hints: ["正下大雨", "外面", "此刻"],
    grammar: [
      {role:'主谓（天气）',color:'#c87033',phonetic:['/ɪts/','/ˈpɔːrɪŋ/'],pos:'主系表/进行',meaning:'正下大雨'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ˌaʊtˈsaɪd/'],pos:'副词',meaning:'外面'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/raɪt/','/naʊ/'],pos:'副词短语',meaning:'此刻'}
    ],
    explanations: [
      "`It's pouring` 是口语化「下倾盆大雨」。常见错误：\n• \"It **pours** outside\" → 也可，但 pouring 强调此刻正在下\n• \"It is **pour**\" → 进行时要用 pouring",
      "`right now` = 此刻、马上。区别于 `now`（较泛）。口语常缩写 it's = it is。"
    ]
  },
  {
    sentence: "Can I take a message for you?",
    cid: "a82159aa",
    translation: "要我帮你留言吗？",
    chunks: ["Can I", "take a message", "for you?"],
    hints: ["我能", "记下留言", "替你"],
    grammar: [
      {role:'情态+主语',color:'#e74c7a',phonetic:['/kæn/','/aɪ/'],pos:'委婉提议',meaning:'我能'},
      {role:'谓语+宾语（固定搭配）',color:'#3358e0',phonetic:['/teɪk/','/ə/','/ˈmesɪdʒ/'],pos:'动词短语',meaning:'记下留言'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/fɔːr/','/juː/'],pos:'介词短语',meaning:'替你'}
    ],
    explanations: [
      "`take a message` 是「记下留言」固定搭配。常见错误：\n• \"take **the** message\" → 泛指一条留言用 a\n• \"write a message **to** you\" → 也可以，但 take a message for you 更地道",
      "电话场景中，对方要找的人不在时，常用这句主动提议帮忙留言。"
    ]
  },
  {
    sentence: "Are you free this weekend?",
    cid: "15accdce",
    translation: "你这个周末有空吗？",
    chunks: ["Are you free", "this weekend?"],
    hints: ["你有空吗", "这个周末"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɑːr/','/juː/','/friː/'],pos:'主系表',meaning:'你有空吗'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ðɪs/','/ˈwiːkend/'],pos:'名词短语',meaning:'这个周末'}
    ],
    explanations: [
      "`Are you free...` 询问是否有空。常见错误：\n• \"Do you **have** free\" → 不自然，have free time 才搭配 have\n• \"Are you **freed**\" → free 是形容词，不是动词过去式",
      "`this weekend` 前不加介词（不说 on this weekend，尽管美语偶尔加 on，但 this weekend 最简洁常用）。"
    ]
  },
  {
    sentence: "I really appreciate your help.",
    cid: "cb22e2a1",
    translation: "我真的很感激你的帮助。",
    chunks: ["I really appreciate", "your help."],
    hints: ["我真的很感激", "你的帮助"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/ˈrɪəli/','/əˈpriːʃieɪt/'],pos:'主谓结构',meaning:'我真的很感激'},
      {role:'宾语',color:'#3358e0',phonetic:['/jɔːr/','/help/'],pos:'名词短语',meaning:'你的帮助'}
    ],
    explanations: [
      "`appreciate` 是及物动词，直接接名词/动名词。常见错误：\n• \"I appreciate **you**\" → 语法可，但 appreciate your help 更自然；appreciate 后不接人作宾语时易歧义\n• \"I appreciate **that you help**\" → 改用动名词：appreciate your helping",
      "`appreciate` 比 `thank` 更正式、更强调内心的感激，谢谢用 thank，感激用 appreciate。"
    ]
  },
  {
    sentence: "See you later, take care.",
    cid: "6b70763b",
    translation: "回头见，保重。",
    chunks: ["See you later,", "take care."],
    hints: ["回头见", "保重"],
    grammar: [
      {role:'告别语',color:'#3358e0',phonetic:['/siː/','/juː/','/ˈleɪtər/'],pos:'固定表达',meaning:'回头见'},
      {role:'祈使句',color:'#7c5cbf',phonetic:['/teɪk/','/ker/'],pos:'动词短语',meaning:'保重'}
    ],
    explanations: [
      "`See you later` 是口语道别，等于 See you soon / Catch you later。常见错误：\n• \"See **your** later\" → 用 you 不是 your\n• \"See you **latter**\" → latter（后者）拼写错误，应为 later（稍后）",
      "`take care` = 保重、注意身体。分开说时可加逗号：See you later, take care."
    ]
  },
  {
    sentence: "That sounds like a great idea.",
    cid: "9edbf706",
    translation: "那听起来是个好主意。",
    chunks: ["That sounds like", "a great idea."],
    hints: ["那听起来像", "一个好主意"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/ðæt/','/saʊndz/','/laɪk/'],pos:'主谓结构',meaning:'那听起来像'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ɡreɪt/','/aɪˈdɪə/'],pos:'名词短语',meaning:'一个好主意'}
    ],
    explanations: [
      "`sound like + 名词` 表示「听起来像…」。常见错误：\n• \"That sounds **good idea**\" → 缺冠词，应为 a good idea\n• \"That **is** sound like\" → sound 已含 be 含义，不要再加 is",
      "第三人称单数 `sounds`，that 是单数。口语中 like 后可接名词或句子。"
    ]
  },
  {
    sentence: "I'm afraid I can't make it tonight.",
    cid: "ef7de65b",
    translation: "恐怕今晚我抽不出时间。",
    chunks: ["I'm afraid", "I can't make it", "tonight."],
    hints: ["恐怕", "我没法去/参加", "今晚"],
    grammar: [
      {role:'引子',color:'#7c5cbf',phonetic:['/aɪm/','/əˈfreɪd/'],pos:'委婉开场',meaning:'恐怕'},
      {role:'主句',color:'#e74c7a',phonetic:['/aɪ/','/kænt/','/meɪk/','ɪt/'],pos:'否定句',meaning:'我没法去'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/təˈnaɪt/'],pos:'副词',meaning:'今晚'}
    ],
    explanations: [
      "`I'm afraid...` 是委婉拒绝/告知坏消息的开场，不是真的害怕。常见错误：\n• \"I'm **afraid of** I can't\" → afraid of 后接名词，接句子用 afraid (that)\n• 直译成「我害怕」→ 语境是礼貌，不是恐惧",
      "`make it` = 能到场/能成行。常见错误：\n• \"I can't **come** it\" → 搭配是 make it，不是 come it\n• \"I can't **do** it\" → do it 指做某事，make it 指能出席"
    ]
  },
  {
    sentence: "Why don't we grab a bite to eat?",
    cid: "966b3754",
    translation: "我们随便吃点东西怎么样？",
    chunks: ["Why don't we", "grab a bite to eat?"],
    hints: ["我们为什么不", "随便吃点东西"],
    grammar: [
      {role:'建议句型',color:'#e74c7a',phonetic:['/waɪ/','/doʊnt/','/wiː/'],pos:'建议疑问句',meaning:'我们为什么不'},
      {role:'谓语（固定习语）',color:'#c87033',phonetic:['/ɡræb/','/ə/','/baɪt/','/tuː/','/iːt/'],pos:'动词短语',meaning:'随便吃点东西'}
    ],
    explanations: [
      "`Why don't we...` 是提建议的委婉句式，等于 Let's...。常见错误：\n• \"Why **we don't** grab\" → 疑问句 don't 要提前\n• \"Why don't we **to** grab\" → 后接动词原形",
      "`grab a bite (to eat)` 是口语「随便吃点、填饱肚子」，非正式。bite 本义「一口」，这里指小吃。"
    ]
  },
  {
    sentence: "Is there a pharmacy nearby?",
    cid: "53af40c1",
    translation: "这附近有药店吗？",
    chunks: ["Is there", "a pharmacy", "nearby?"],
    hints: ["有吗", "一家药店", "附近"],
    grammar: [
      {role:'存在句',color:'#e74c7a',phonetic:['/ɪz/','/ðer/'],pos:'there be 疑问句',meaning:'有吗'},
      {role:'主语',color:'#3358e0',phonetic:['/ə/','/ˈfɑːrməsi/'],pos:'名词',meaning:'一家药店'},
      {role:'状语',color:'#7c5cbf',phonetic:['/ˌnɪrˈbaɪ/'],pos:'副词',meaning:'附近'}
    ],
    explanations: [
      "`Is there a...` 问某处是否有某物（单数）。常见错误：\n• \"**Are** there a pharmacy\" → 主语 pharmacy 单数，用 is\n• \"There **have** a pharmacy\" → 存在用 there be，不用 have",
      "`nearby` 既是形容词也是副词，这里作副词「在附近」。也可说 `near here`。"
    ]
  },
  {
    sentence: "I'd like a medium latte, please.",
    cid: "9d02a202",
    translation: "我要一杯中杯拿铁，谢谢。",
    chunks: ["I'd like", "a medium latte,", "please."],
    hints: ["我想要", "一杯中杯拿铁", "谢谢"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪd/','/laɪk/'],pos:'委婉点单',meaning:'我想要'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈmiːdiəm/','/ˈlɑːteɪ/'],pos:'名词短语',meaning:'中杯拿铁'},
      {role:'礼貌词',color:'#7c5cbf',phonetic:['/pliːz/'],pos:'语气词',meaning:'谢谢'}
    ],
    explanations: [
      "`I'd like = I would like`，点单比 I want 更礼貌。常见错误：\n• \"I **like** a latte\" → like 表喜好，点单要用 would like\n• \"I'd like **to** a latte\" → 接名词不要 to",
      "咖啡杯型：small / medium / large（或 tall / grande / venti 星巴克体系）。`a medium latte` 中 a 不能省。"
    ]
  },
  {
    sentence: "What time should we meet up?",
    cid: "09096d4a",
    translation: "我们几点碰面好？",
    chunks: ["What time", "should we meet up?"],
    hints: ["几点", "我们该碰面"],
    grammar: [
      {role:'疑问词',color:'#e74c7a',phonetic:['/wɒt/','/taɪm/'],pos:'特殊疑问词',meaning:'几点'},
      {role:'情态+主语+谓语',color:'#c87033',phonetic:['/ʃʊd/','/wiː/','/miːt/','ʌp/'],pos:'建议疑问句',meaning:'我们该碰面'}
    ],
    explanations: [
      "`What time` 问具体时刻（对比 When 问大概时间）。常见错误：\n• \"**Which** time should we\" → 用 what 不是 which\n• \"What time **we should**\" → 疑问句 should 提前",
      "`meet up` 强调「见面、碰头」（尤指约定会面）。也可只用 meet，meet up 更口语化。"
    ]
  },
  {
    sentence: "How much does this one cost?",
    cid: "f09dfd8b",
    translation: "这个多少钱？",
    chunks: ["How much", "does this one cost?"],
    hints: ["多少钱", "这个要"],
    grammar: [
      {role:'疑问词',color:'#e74c7a',phonetic:['/haʊ/','/mʌtʃ/'],pos:'价格疑问',meaning:'多少钱'},
      {role:'主谓',color:'#c87033',phonetic:['/dʌz/','/ðɪs/','/wʌn/','/kɒst/'],pos:'第三人称单数',meaning:'这个要'}
    ],
    explanations: [
      "`How much does ... cost?` 问价格。常见错误：\n• \"How much **is cost** this\" → cost 是动词，不用 is\n• \"How many **money**\" → money 不可数，用 much 不是 many",
      "`this one` 指代眼前这个商品（one 替代前面提到的名词，避免重复）。"
    ]
  },
  {
    sentence: "I'm not feeling myself today.",
    cid: "edcf60c8",
    translation: "我今天状态不太好（身体不适）。",
    chunks: ["I'm not feeling myself", "today."],
    hints: ["我今天状态不好", "今天"],
    grammar: [
      {role:'主谓表（习语）',color:'#c87033',phonetic:['/aɪm/','/nɒt/','/ˈfiːlɪŋ/','/maɪˈself/'],pos:'习语（≠字面义）',meaning:'状态不佳'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/təˈdeɪ/'],pos:'副词',meaning:'今天'}
    ],
    explanations: [
      "`not feeling myself` 是地道说法，指「不在状态/身体或精神不佳」，并非字面「感觉不到自己」。常见错误：\n• \"I'm not feeling **me**\" → 要用反身代词 myself\n• \"I don't **feel** myself\" → 也可用一般现在时",
      "比直接说 `I'm sick` 更委婉，常用于日常寒暄中解释为何没精神。"
    ]
  },
  {
    sentence: "I have a meeting at three this afternoon.",
    cid: "99c40243",
    translation: "我今天下午三点有个会。",
    chunks: ["I have a meeting", "at three", "this afternoon."],
    hints: ["我有个会", "在三点", "今天下午"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/hæv/','/ə/','/ˈmiːtɪŋ/'],pos:'主谓宾',meaning:'我有个会'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/æt/','/θriː/'],pos:'介词短语',meaning:'在三点'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ðɪs/','/ˌæftərˈnuːn/'],pos:'名词短语',meaning:'今天下午'}
    ],
    explanations: [
      "`have a meeting` 表示「开会」，have 表「有」。常见错误：\n• \"I **do** a meeting\" → 错，开会用 have，不是 do\n• \"I **am** a meeting\" → 错，meeting 不是状态",
      "具体时刻前用 `at`（at three）；泛指下午用 `this afternoon`，前不加 in/on（口语习惯）。"
    ]
  },
  {
    sentence: "Do you enjoy watching movies?",
    cid: "d338b9bb",
    translation: "你喜欢看电影吗？",
    chunks: ["Do you enjoy", "watching movies?"],
    hints: ["你喜欢", "看电影"],
    grammar: [
      {role:'助动词+主语+谓语',color:'#e74c7a',phonetic:['/duː/','/juː/','/ɪnˈdʒɔɪ/'],pos:'一般现在疑问',meaning:'你喜欢'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈwɒtʃɪŋ/','/ˈmuːviz/'],pos:'动名词短语',meaning:'看电影'}
    ],
    explanations: [
      "`enjoy + 动名词` 是固定用法（enjoy doing）。常见错误：\n• \"Do you enjoy **to watch**\" → enjoy 后必须接 doing，不接 to do\n• \"I **am enjoying** watch\" → 进行时虽可，但宾语仍用 watching",
      "`movies` 美语常用复数指代「电影」这种娱乐形式；单数 a movie 指具体一部影片。"
    ]
  },
  {
    sentence: "I'm pretty good at cooking.",
    cid: "d10b5dec",
    translation: "我挺擅长做饭的。",
    chunks: ["I'm pretty good", "at cooking."],
    hints: ["我挺擅长", "做饭"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/ˈprɪti/','/ɡʊd/'],pos:'主系表',meaning:'我挺擅长'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/æt/','/ˈkʊkɪŋ/'],pos:'动名词',meaning:'做饭'}
    ],
    explanations: [
      "`be good at + 名词/动名词` 表示擅长。常见错误：\n• \"I'm good **in** cooking\" → 搭配是 at，不是 in\n• \"I'm good **to** cook\" → 错，用 at + doing",
      "`pretty` 在这里是副词「挺、相当」（= quite），不是形容词「漂亮」。口语中 pretty good = 还不错。"
    ]
  },
  {
    sentence: "This one is way cheaper than that.",
    cid: "137ff5fe",
    translation: "这个比那个便宜多了。",
    chunks: ["This one is", "way cheaper", "than that."],
    hints: ["这个", "便宜得多", "比那个"],
    grammar: [
      {role:'主语+系',color:'#c87033',phonetic:['/ðɪs/','/wʌn/','/ɪz/'],pos:'主系',meaning:'这个'},
      {role:'表语',color:'#e74c7a',phonetic:['/weɪ/','/ˈtʃiːpər/'],pos:'比较级',meaning:'便宜得多'},
      {role:'比较对象',color:'#7c5cbf',phonetic:['/ðæn/','/ðæt/'],pos:'比较状语',meaning:'比那个'}
    ],
    explanations: [
      "`cheaper` 是 cheap 的比较级。常见错误：\n• \"more cheap\" → cheap 是单音节，加 -er，不用 more\n• \"cheap**er than** that\" ✓ 正确结构",
      "`way` 作副词加强比较级，表「…得多」（= much）。口语常用：`way better` `way bigger`。"
    ]
  },
  {
    sentence: "I usually go for a run in the morning.",
    cid: "334cfe4a",
    translation: "我通常早上跑步。",
    chunks: ["I usually", "go for a run", "in the morning."],
    hints: ["我通常", "去跑步", "在早上"],
    grammar: [
      {role:'主语+频度',color:'#c87033',phonetic:['/aɪ/','/ˈjuːʒuəli/'],pos:'主+频度副词',meaning:'我通常'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/','/fɔːr/','/ə/','/rʌn/'],pos:'动词短语',meaning:'去跑步'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɪn/','/ðə/','/ˈmɔːrnɪŋ/'],pos:'介词短语',meaning:'在早上'}
    ],
    explanations: [
      "`go for a run` = 去跑步（固定搭配）。常见错误：\n• \"go **to** a run\" → 不接 to\n• \"go **running** a run\" → 重复，go running 或 go for a run 二选一",
      "`usually` 频度副词放实义动词前、be 动词后。这里在主语 I 和谓语 go 之间，正确。"
    ]
  },
  {
    sentence: "I'm planning to visit Japan next year.",
    cid: "79068a2f",
    translation: "我计划明年去日本玩。",
    chunks: ["I'm planning to", "visit Japan", "next year."],
    hints: ["我打算", "去日本", "明年"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪm/','/ˈplænɪŋ/','/tuː/'],pos:'现在进行时表将来计划',meaning:'我打算'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈvɪzɪt/','/dʒəˈpæn/'],pos:'动词+专有名词',meaning:'去日本'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/nekst/','/jɪr/'],pos:'名词短语',meaning:'明年'}
    ],
    explanations: [
      "`plan to do` 表示计划做某事。常见错误：\n• \"I'm planning **visit**\" → 后接 to do\n• \"I plan **on** visit\" → plan on 后接 doing（plan on visiting）",
      "用现在进行时 `am planning` 表达已确定的近期计划，比一般现在时 `I plan` 更显计划在推进中。"
    ]
  },
  {
    sentence: "We went hiking last Sunday.",
    cid: "7e998d83",
    translation: "上周日我们去徒步了。",
    chunks: ["We went hiking", "last Sunday."],
    hints: ["我们去徒步", "上周日"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/wiː/','/went/','/ˈhaɪkɪŋ/'],pos:'一般过去时',meaning:'我们去徒步'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/læst/','/ˈsʌndeɪ/'],pos:'名词短语',meaning:'上周日'}
    ],
    explanations: [
      "`go hiking` = 去徒步（go + 动名词表户外活动）。常见错误：\n• \"We **go** hiking last Sunday\" → 过去时间要用 went\n• \"We went **to hike**\" → 也可，但 went hiking 更自然",
      "`last Sunday` 前不加介词（不说 on last Sunday）。对比 `next Sunday` 同样不加 on。"
    ]
  },
  {
    sentence: "If it rains, we'll just stay home.",
    cid: "362a9411",
    translation: "要是下雨，我们就待在家里。",
    chunks: ["If it rains,", "we'll just stay home."],
    hints: ["如果下雨", "我们就待在家"],
    grammar: [
      {role:'条件从句',color:'#7c5cbf',phonetic:['/ɪf/','/ɪt/','/reɪnz/'],pos:'if 条件状语从句',meaning:'如果下雨'},
      {role:'主句（短语动词）',color:'#e74c7a',phonetic:['/wiːl/','/dʒʌst/','/steɪ/','/hoʊm/'],pos:'一般将来时',meaning:'我们就待在家'}
    ],
    explanations: [
      "主将从现：if 从句用一般现在时（rains）表将来，主句用 will。常见错误：\n• \"If it **will** rain\" → if 从句不用 will\n• \"we **stay** home\" → 主句表将来要用 will stay",
      "`stay home` 中 home 是副词，前面不加 at（区别于 stay at home 也可，但 stay home 更口语）。"
    ]
  },
  {
    sentence: "You should definitely try this place.",
    cid: "ecc1d3c4",
    translation: "你一定要试试这家店。",
    chunks: ["You should definitely", "try this place."],
    hints: ["你一定要", "试试这家店"],
    grammar: [
      {role:'主语+情态',color:'#e74c7a',phonetic:['/juː/','/ʃʊd/','/ˈdefɪnətli/'],pos:'建议',meaning:'你一定要'},
      {role:'谓语',color:'#3358e0',phonetic:['/traɪ/','/ðɪs/','/pleɪs/'],pos:'动词短语',meaning:'试试这家店'}
    ],
    explanations: [
      "`should + 动词原形` 表建议。常见错误：\n• \"You should **to** try\" → 情态动词后不接 to\n• \"You **shoulded** try\" → should 无过去式变化",
      "`definitely` 加强语气「一定、绝对」。位置在情态动词后、实义动词前：`should definitely try`。"
    ]
  },
  {
    sentence: "What a beautiful view from up here!",
    cid: "c44e93b0",
    translation: "从这上面看风景真美啊！",
    chunks: ["What a beautiful view", "from up here!"],
    hints: ["多美的风景", "从这上面"],
    grammar: [
      {role:'感叹句',color:'#e74c7a',phonetic:['/wɒt/','/ə/','/ˈbjuːtɪfl/','/vjuː/'],pos:'What 引导感叹句',meaning:'多美的风景'},
      {role:'状语',color:'#7c5cbf',phonetic:['/frɒm/','/ʌp/','/hɪr/'],pos:'介词短语',meaning:'从这上面'}
    ],
    explanations: [
      "`What a + 形容词 + 名词` 是感叹句结构。常见错误：\n• \"**How** a beautiful view\" → How 后接形容词/副词，不接 a+名词；应为 How beautiful the view is\n• \"What beautiful **a** view\" → a 必须在形容词前",
      "`from up here` = 从这边上面（up 强调高度）。here 是地点副词，前不加介词（from 已充当介词）。"
    ]
  },
  {
    sentence: "Could you speak a bit more slowly, please?",
    cid: "c6319b49",
    translation: "你能说慢一点吗？",
    chunks: ["Could you speak", "a bit more slowly,", "please?"],
    hints: ["你能说", "稍微慢一点", "麻烦"],
    grammar: [
      {role:'情态+主谓',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/spiːk/'],pos:'委婉请求',meaning:'你能说'},
      {role:'程度状语',color:'#7c5cbf',phonetic:['/ə/','/bɪt/','/mɔːr/','/ˈsləʊli/'],pos:'副词短语',meaning:'稍微慢一点'},
      {role:'礼貌词',color:'#3358e0',phonetic:['/pliːz/'],pos:'语气词',meaning:'麻烦'}
    ],
    explanations: [
      "`Could you speak more slowly` 请求放慢语速。常见错误：\n• \"speak more **slow**\" → slow 是形容词，修饰动词要用副词 slowly\n• \"speak **slower**\" → 口语偶见，但 more slowly 更规范",
      "`a bit` = 稍微，用来缓和请求语气，也可换 a little。please 放句末更礼貌。"
    ]
  },
  {
    sentence: "I'm sorry to keep you waiting.",
    cid: "99621477",
    translation: "抱歉让你久等了。",
    chunks: ["I'm sorry", "to keep you waiting."],
    hints: ["我很抱歉", "让你久等"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/ˈsɒri/'],pos:'致歉表达',meaning:'我很抱歉'},
      {role:'不定式短语',color:'#e74c7a',phonetic:['/tuː/','/kiːp/','/juː/','/ˈweɪtɪŋ/'],pos:'不定式+宾补',meaning:'让你久等'}
    ],
    explanations: [
      "`sorry to do` 为做了某事道歉；`sorry for doing` 侧重为已发生的事道歉。常见错误：\n• \"sorry **for keep** you waiting\" → for 后接动名词 keeping，不是原形 keep\n• \"sorry **about** waiting\" → 语义含糊，keep you waiting 更清楚",
      "`keep sb doing` = 让某人一直处于某种状态。原形结构：keep + 宾语 + 现在分词（waiting）。"
    ]
  },
  {
    sentence: "Can you give me a discount?",
    cid: "c5710a04",
    translation: "能给我打个折吗？",
    chunks: ["Can you give me", "a discount?"],
    hints: ["你能给我", "一个折扣"],
    grammar: [
      {role:'情态+双宾谓语',color:'#e74c7a',phonetic:['/kæn/','/juː/','/ɡɪv/','/miː/'],pos:'情态动词+双宾语',meaning:'你能给我'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈdɪskaʊnt/'],pos:'名词短语',meaning:'折扣'}
    ],
    explanations: [
      "`give sb sth` = give sth to sb，双宾语结构。常见错误：\n• \"give **to me** a discount\" → 双宾时 give me a discount 更自然\n• \"a **discounting**\" → discount 作名词直接说 a discount",
      "砍价场景常用语。同义：\"Any discount?\" \"Can you do it for less?\" 注意 discount 前用 a（可数）。"
    ]
  },
  {
    sentence: "I'd like the steak, medium rare, please.",
    cid: "ef48bd78",
    translation: "我要牛排，五分熟，谢谢。",
    chunks: ["I'd like the steak,", "medium rare,", "please."],
    hints: ["我要牛排", "五分熟", "谢谢"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪd/','/laɪk/','/ðə/','/steɪk/'],pos:'委婉点餐',meaning:'我要牛排'},
      {role:'补充说明',color:'#7c5cbf',phonetic:['/ˈmiːdiəm/','/rer/'],pos:'形容词短语',meaning:'五分熟'},
      {role:'礼貌词',color:'#3358e0',phonetic:['/pliːz/'],pos:'语气词',meaning:'谢谢'}
    ],
    explanations: [
      "`medium rare` 是牛排熟度：rare 三分熟 / medium rare 五分熟 / medium 七分熟 / well done 全熟。常见错误：\n• \"**medium-rarely**\" → 熟度用形容词，不加 -ly\n• 把 medium rare 误当副词放句首",
      "点单结构：I'd like + 菜品 + 特殊要求 + please。the steak 用 the 因为菜单上已看到特指这道。"
    ]
  },
  {
    sentence: "Is the meeting still on for tomorrow?",
    cid: "bd1383e5",
    translation: "明天的会还照常开吗？",
    chunks: ["Is the meeting", "still on", "for tomorrow?"],
    hints: ["会议是", "仍按计划", "明天"],
    grammar: [
      {role:'主系',color:'#c87033',phonetic:['/ɪz/','/ðə/','/ˈmiːtɪŋ/'],pos:'主系结构',meaning:'会议是'},
      {role:'表语',color:'#e74c7a',phonetic:['/stɪl/','/ɒn/'],pos:'be on 进行中',meaning:'仍按计划'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/fɔːr/','/təˈmɒroʊ/'],pos:'介词短语',meaning:'明天'}
    ],
    explanations: [
      "`be on` = 按计划进行/上演中。常见错误：\n• \"Is the meeting still **open**\" → open 表开始报名，不表照常举行\n• \"Will the meeting **is** on\" → will 后接动词原形 be",
      "确认会议是否照常的办公口语。也可说：\"Is the meeting still happening tomorrow?\""
    ]
  },
  {
    sentence: "I think we're lost, can you help us?",
    cid: "4ca097f3",
    translation: "我想我们迷路了，你能帮我们吗？",
    chunks: ["I think we're lost,", "can you help us?"],
    hints: ["我想我们迷路了", "你能帮我们吗"],
    grammar: [
      {role:'陈述+请求',color:'#c87033',phonetic:['/aɪ/','/θɪŋk/','/wɪr/','/lɒst/'],pos:'主谓+宾语从句',meaning:'我想我们迷路了'},
      {role:'情态疑问句',color:'#e74c7a',phonetic:['/kæn/','/juː/','/help/','/ʌs/'],pos:'请求帮助',meaning:'你能帮我们吗'}
    ],
    explanations: [
      "`be lost` = 迷路，lost 是 lose 的过去分词作形容词。常见错误：\n• \"we **are lose**\" → 要用过去分词 lost\n• \"we **lost**\" → 缺 be 动词；若说 we lost our way 才不加 be",
      "问路求助开场白。help sb 直接接宾语：help us，不加 to 也正确（help (to) do）。"
    ]
  },
  {
    sentence: "How long does it take to get there?",
    cid: "179cbe0e",
    translation: "到那里要多久？",
    chunks: ["How long", "does it take", "to get there?"],
    hints: ["多长时间", "要花费", "到达那里"],
    grammar: [
      {role:'疑问词',color:'#e74c7a',phonetic:['/haʊ/','/lɔːŋ/'],pos:'时间疑问',meaning:'多长时间'},
      {role:'主谓（形式主语）',color:'#c87033',phonetic:['/dʌz/','/ɪt/','/teɪk/'],pos:'It takes 句型',meaning:'要花费'},
      {role:'不定式短语',color:'#7c5cbf',phonetic:['/tuː/','/ɡet/','/ðer/'],pos:'不定式',meaning:'到达那里'}
    ],
    explanations: [
      "句型 `It takes + 时间 + to do`。常见错误：\n• \"How long **does it cost**\" → cost 表花费金钱，花费时间用 take\n• \"How long **it takes**\" → 疑问句助动词要提前",
      "`get there` 中 there 是副词，前不加 to。比较：get to the station（到车站）要加 to，there/here/home 不加。"
    ]
  },
  {
    sentence: "I'm into cooking these days.",
    cid: "6de73a4a",
    translation: "我最近迷上做饭了。",
    chunks: ["I'm into cooking", "these days."],
    hints: ["我迷上做饭", "最近"],
    grammar: [
      {role:'主系+介词',color:'#c87033',phonetic:['/aɪm/','/ˈɪntuː/','/ˈkʊkɪŋ/'],pos:'be into 爱好',meaning:'我迷上做饭'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ðiːz/','/deɪz/'],pos:'名词短语',meaning:'最近'}
    ],
    explanations: [
      "`be into + 名词/动名词` = 对…着迷（口语）。常见错误：\n• \"I'm **interesting in** cooking\" → 用 interested in 或 be into，别混搭\n• \"I into cooking\" → 漏掉 be 动词",
      "表达兴趣爱好三件套：be into / be interested in / enjoy，后接动名词。`these days` = 近来，常与现在时/进行时连用。"
    ]
  },
  {
    sentence: "Let's stay in touch, okay?",
    cid: "4c95b52c",
    translation: "我们保持联系，好吗？",
    chunks: ["Let's stay in touch,", "okay?"],
    hints: ["我们保持联系", "好吗"],
    grammar: [
      {role:'祈使建议',color:'#e74c7a',phonetic:['/lets/','/steɪ/','/ɪn/','/tʌtʃ/'],pos:'固定搭配',meaning:'我们保持联系'},
      {role:'征询语气',color:'#3358e0',phonetic:['/ˌoʊˈkeɪ/'],pos:'附加问句',meaning:'好吗'}
    ],
    explanations: [
      "`stay/keep in touch` = 保持联系，固定搭配。常见错误：\n• \"keep **the** touch\" → 不加 the\n• \"keep touch **with** each other\" → 可以说 keep in touch with sb，但单独用不加 with",
      "道别收尾金句。答应别人可说 Sure / Definitely / I will! 更口语说法：Let's keep in touch!"
    ]
  },
  {
    sentence: "It's boiling hot outside today.",
    cid: "dd58f6c9",
    translation: "今天外面热死了。",
    chunks: ["It's boiling hot", "outside", "today."],
    hints: ["热死了", "外面", "今天"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ˈbɔɪlɪŋ/','/hɒt/'],pos:'口语夸张',meaning:'热死了'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ˌaʊtˈsaɪd/'],pos:'副词',meaning:'外面'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/təˈdeɪ/'],pos:'副词',meaning:'今天'}
    ],
    explanations: [
      "`boiling hot` = 滚烫/热得要命（boiling 原义沸腾，口语表夸张）。常见错误：\n• \"boiling **hotly**\" → hot 是形容词，不加 -ly\n• 说 It's boiling 即可表很热，别再叠 very",
      "对比说法：It's freezing (cold) 冷死了 / It's scorching 酷热。天气句用 it 作主语。"
    ]
  },
  {
    sentence: "I can't remember where I put my keys.",
    cid: "6abc41f7",
    translation: "我忘了把钥匙放哪儿了。",
    chunks: ["I can't remember", "where I put", "my keys."],
    hints: ["我想不起来", "我放在哪儿", "我的钥匙"],
    grammar: [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪ/','/kænt/','/rɪˈmembər/'],pos:'否定句',meaning:'我想不起来'},
      {role:'宾语从句',color:'#3358e0',phonetic:['/wer/','/aɪ/','/pʊt/'],pos:'名词性从句',meaning:'我放在哪儿'},
      {role:'宾语',color:'#3358e0',phonetic:['/maɪ/','/kiːz/'],pos:'名词短语',meaning:'我的钥匙'}
    ],
    explanations: [
      "`remember + where 从句` 用陈述语序。常见错误：\n• \"where **did I** put\" → 从句内不倒装，用 I put\n• \"remember **to find**\" → remember where 是宾语从句，不是 remember to do",
      "put 的过去式仍是 put（不规则动词不变形）。近义句：I can't find my keys anywhere."
    ]
  },
  {
    sentence: "You should take a break now.",
    cid: "abfe8204",
    translation: "你现在该休息一下了。",
    chunks: ["You should take a break", "now."],
    hints: ["你该休息一下", "现在"],
    grammar: [
      {role:'情态建议',color:'#e74c7a',phonetic:['/juː/','/ʃʊd/','/teɪk/','/ə/','/breɪk/'],pos:'should+动词',meaning:'你该休息一下'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/naʊ/'],pos:'副词',meaning:'现在'}
    ],
    explanations: [
      "`should + 动词原形` 表建议。常见错误：\n• \"You should **to take**\" → 情态动词后不接 to\n• \"You **shoulds** take\" → should 无第三人称变化",
      "`take a break` = 休息一下，固定搭配。同义：have a rest / take a breather（口语稍作喘息）。"
    ]
  },
  {
    sentence: "Do you have any tables available for two?",
    cid: "a46fda11",
    translation: "现在有两人位吗？",
    chunks: ["Do you have", "any tables available", "for two?"],
    hints: ["你们有", "空余的桌位", "两人"],
    grammar: [
      {role:'一般疑问句',color:'#e74c7a',phonetic:['/duː/','/juː/','/hæv/'],pos:'疑问句',meaning:'你们有'},
      {role:'宾语+后置定语',color:'#3358e0',phonetic:['/ˈeni/','/ˈteɪblz/','/əˈveɪləbl/'],pos:'名词+形容词',meaning:'空余桌位'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/fɔːr/','/tuː/'],pos:'介词短语',meaning:'两人'}
    ],
    explanations: [
      "`available` 作后置定语放在名词后：tables available = 空着的桌位。常见错误：\n• \"available **tables**\" → 也正确但 available 作前置定语语气不同，此处后置更常用\n• \"table **is** available for us\" → 用 there be 或 have 开头更像在询问",
      "餐厅等位专用句。答语：\"Yes, right this way.\" 或 \"Sorry, we're fully booked.\""
    ]
  },
  {
    sentence: "Could I get this to go, please?",
    cid: "577c7ac5",
    translation: "这个能打包带走吗？",
    chunks: ["Could I get this", "to go,", "please?"],
    hints: ["我能把这个", "外带", "麻烦"],
    grammar: [
      {role:'情态疑问',color:'#e74c7a',phonetic:['/kʊd/','/aɪ/','/ɡet/','/ðɪs/'],pos:'委婉请求',meaning:'我能把这个'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/tuː/','/ɡoʊ/'],pos:'固定表达',meaning:'外带'},
      {role:'礼貌词',color:'#3358e0',phonetic:['/pliːz/'],pos:'语气词',meaning:'麻烦'}
    ],
    explanations: [
      "`to go` = 外带（美式）。常见错误：\n• \"for **takeaway**\" → takeaway 是英式名词，美式点餐说 to go\n• \"to **going**\" → to 后接原形 go",
      "相对的说法是 dine in / for here（堂食）。点餐收尾常用：\"Is that for here or to go?\""
    ]
  },
  {
    sentence: "We're just looking, but thanks anyway.",
    cid: "8e299f97",
    translation: "我们只是看看，不过还是谢谢。",
    chunks: ["We're just looking,", "but thanks anyway."],
    hints: ["我们只是看看", "但还是要谢谢你"],
    grammar: [
      {role:'进行时态',color:'#e74c7a',phonetic:['/wɪr/','/dʒʌst/','/ˈlʊkɪŋ/'],pos:'现在进行时',meaning:'我们只是看看'},
      {role:'转折谢语',color:'#7c5cbf',phonetic:['/bʌt/','/θæŋks/','/ˈeniweɪ/'],pos:'固定表达',meaning:'但还是谢谢你'}
    ],
    explanations: [
      "`just looking` 是婉拒店员推销的标准话术（= 我自己看，不需要帮忙）。常见错误：\n• \"just **look**\" → 进行时强调当下状态更自然\n• \"we look **only**\" → only 位置不对，要用 just",
      "`thanks anyway` = 无论如何谢谢你（即使没接受帮助）。anyway 放句尾表「反正、无论如何」。"
    ]
  },
  {
    sentence: "What size do you take in shoes?",
    cid: "28fc81b5",
    translation: "你穿多大码的鞋？",
    chunks: ["What size", "do you take", "in shoes?"],
    hints: ["什么尺码", "你穿", "鞋"],
    grammar: [
      {role:'疑问词+名词',color:'#e74c7a',phonetic:['/wɒt/','/saɪz/'],pos:'尺码疑问',meaning:'什么尺码'},
      {role:'谓语疑问',color:'#c87033',phonetic:['/duː/','/juː/','/teɪk/'],pos:'疑问句',meaning:'你穿'},
      {role:'范围状语',color:'#7c5cbf',phonetic:['/ɪn/','/ʃuːz/'],pos:'介词短语',meaning:'在鞋子上'}
    ],
    explanations: [
      "问尺码：`What size do you take?`。常见错误：\n• \"How big **are** your shoes\" → 问鞋子大小不问人\n• \"What size **are** you take\" → 实义动词 take 要借助助动词 do",
      "`in shoes` = 在鞋子的品类里。类似：What size are you in?（你穿什么码？）。答：I take a size 8."
    ]
  },
  {
    sentence: "I should have called you earlier.",
    cid: "c3850bef",
    translation: "我本该早点给你打电话的。",
    chunks: ["I should have", "called you", "earlier."],
    hints: ["我本应该", "给你打电话", "更早"],
    grammar: [
      {role:'情态完成式',color:'#e74c7a',phonetic:['/aɪ/','/ʃʊd/','/hæv/'],pos:'should have done',meaning:'我本应该'},
      {role:'过去分词',color:'#3358e0',phonetic:['/kɔːld/','/juː/'],pos:'完成时谓语',meaning:'给你打电话'},
      {role:'比较状语',color:'#7c5cbf',phonetic:['/ˈɜːrliər/'],pos:'比较级副词',meaning:'更早'}
    ],
    explanations: [
      "`should have done` = 本应该做而没做（表后悔/责备）。常见错误：\n• \"I should **called**\" → 情态动词后接 have + 过去分词\n• \"I should have **call**\" → 需用过去分词 called",
      "表达后悔三兄弟：should have（本应该）/ could have（本可以）/ would have（本会）。earlier 是 early 的比较级。"
    ]
  },
  {
    sentence: "Mind if I join you for lunch?",
    cid: "5dea8d2a",
    translation: "介意我跟你们一起吃午饭吗？",
    chunks: ["Mind if I", "join you", "for lunch?"],
    hints: ["介意如果我", "加入你们", "吃午饭"],
    grammar: [
      {role:'省略问句',color:'#e74c7a',phonetic:['/maɪnd/','/ɪf/','/aɪ/'],pos:'口语省略 Do you',meaning:'介意如果我'},
      {role:'谓语',color:'#3358e0',phonetic:['/dʒɔɪn/','/juː/'],pos:'动词短语',meaning:'加入你们'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/fɔːr/','/lʌntʃ/'],pos:'介词短语',meaning:'吃午饭'}
    ],
    explanations: [
      "`Mind if I...` = Do you mind if I... 的口语省略版。常见错误：\n• 回答 \"Yes\" → 指「介意」，别让人家一起坐；不介意要说 No/Not at all\n• \"Mind **that** I join\" → if 从句表条件，不用 that",
      "`join sb` = 加入某人（一起做某事）。加入某活动可说 join sb for lunch / join the game。"
    ]
  },
  {
    sentence: "The subway is faster than driving downtown.",
    cid: "bfe52436",
    translation: "进城坐地铁比开车快。",
    chunks: ["The subway is faster", "than driving", "downtown."],
    hints: ["地铁更快", "比开车", "去市中心"],
    grammar: [
      {role:'比较级主句',color:'#c87033',phonetic:['/ðə/','/ˈsʌbweɪ/','/ɪz/','/ˈfɑːstər/'],pos:'比较级',meaning:'地铁更快'},
      {role:'比较对象',color:'#7c5cbf',phonetic:['/ðæn/','/ˈdraɪvɪŋ/'],pos:'than+动名词',meaning:'比开车'},
      {role:'方向副词',color:'#3358e0',phonetic:['/ˈdaʊntaʊn/'],pos:'副词',meaning:'去市中心'}
    ],
    explanations: [
      "比较结构 `A is + 比较级 + than + B`。常见错误：\n• \"more faster\" → fast 是单音节，比较级直接 faster，不加 more\n• \"than **drive**\" → 比较对象要对称，用动名词 driving",
      "`downtown` = 市中心/去市中心，副词用法前不加 to（比较 go downtown / go to the city center）。"
    ]
  },
  {
    sentence: "Could we get the check, please?",
    cid: "b83b9640",
    translation: "请给我们结账。",
    chunks: ["Could we get", "the check,", "please?"],
    hints: ["我们能要", "账单", "麻烦"],
    grammar: [
      {role:'情态疑问',color:'#e74c7a',phonetic:['/kʊd/','/wiː/','/ɡet/'],pos:'委婉请求',meaning:'我们能要'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/tʃek/'],pos:'名词',meaning:'账单'},
      {role:'礼貌词',color:'#7c5cbf',phonetic:['/pliːz/'],pos:'语气词',meaning:'麻烦'}
    ],
    explanations: [
      "结账用语分英美：美式 `the check`，英式 `the bill`。常见错误：\n• 混说 \"get the bill\" 英式场景也通，但美式餐厅多用 check\n• \"pay the check\" → 可以，但 get the check 是「请拿来账单」",
      "同义表达：\"Check, please!\"（最简洁）/ \"Can we have the bill, please?\""
    ]
  }
];


/* 数据并入 builtin-daily（2026-09-07 去冗余决策：不再注册独立 deck builtin-oral-8000）
 * 50 句（日常进阶 · Beyond Basics）运行时 concat 进 builtin-daily.items，共 108 句。
 * 引用页必须先加载 builtins.js 再加载本文件：
 *   main.html / decks.html / stats.html 均按 builtins.js → oral8000.js 顺序引入。
 * 数据资产仍保留在 window.DATA_ORAL8000（后续 8000 句分批扩展时往数组里追加即可）。 */
(function(){
  if(!window.BUILTIN){
    console.error('[oral8000.js] 未找到 window.BUILTIN：builtins.js 须在 oral8000.js 之前加载');
    return;
  }
  var target = null;
  for(var i=0;i<window.BUILTIN.length;i++){
    if(window.BUILTIN[i].id === 'builtin-daily'){ target = window.BUILTIN[i]; break; }
  }
  if(!target){
    console.error('[oral8000.js] 未找到 builtin-daily deck，数据无法并入（builtins.js 须先加载）');
    return;
  }
  target.items = target.items.concat(window.DATA_ORAL8000);
})();
