/* 日常口语8000句 · 完整教学版（种子库 v1，30 句）
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
    translation: "很高兴认识你。",
    chunks: ["Nice to", "meet you."],
    hints: ["很高兴", "认识你。"],
    grammar: [
      {role:'固定表达',color:'#3358e0',phonetic:['/naɪs/','/tuː/','/miːt/','/juː/'],pos:'省略主谓的惯用语',meaning:'很高兴认识你'}
    ],
    explanations: [
      "`Nice to meet you` 是初次见面的固定客套。常见错误：\n• \"Nice **meeting** you\" → 见面当时用 meet（进行时结构）；分手时可以说 Nice meeting you\n• \"**Glad** to meet you\" → 也可以，但 Nice 最常用",
      "这是省略了 `It is` 的结构（It is nice to meet you）。口语中 it is 省略很自然。"
    ]
  },
  {
    sentence: "Could you do me a favor?",
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
  }
];
