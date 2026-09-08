/* 日常口语8000句 · 完整教学版（种子库 v2，100 句）
 * 本文件 = 纯数据资产：window.DATA_ORAL8000（100 句，2026-09-07 起并入 builtin-daily，不再独立成 deck）。
 * 第一批 50 句（2026-09-07）+ 第二批 50 句（2026-09-08，电话/就医/酒店/出行/工作/学习/地道句型）。
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
    ],
    distractors: [["How do you doing","How are you feel","How are you does"],["this days?","these day?","those days?"]]
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
    ],
    distractors: [["Nice too","Nice","Nice to to"],["meeting you.","met you.","meet yours."]]
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
    ],
    distractors: [["Could your","Could you to","Do you could"],["do me the favor?","does me a favor?","doing me a favor?"]]
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
    ],
    distractors: [["I'm really angry","I'm really sad","I'm really sorries"],["at that.","of that.","about those."]]
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
    ],
    distractors: [["Could us get","Could we to get","Could we getting"],["the bill,","the table,","the food,"],["pleased?","pleases?"]]
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
    ],
    distractors: [["Where can me find","Where can I to find","Where can I found"],["the check-in?","the checkouts?","the checking?"]]
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
    ],
    distractors: [["Whose bus","Which buses","Which a bus"],["go to","going to","goes for"],["the stop?","the stations?","a station?"]]
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
    ],
    distractors: [["It's snowing","It's blowing","It's showing"],["outdoor","in outside"],["right away.","just now.","right soon."]]
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
    ],
    distractors: [["Can me","Can I to","Am I"],["leave a message","write a message","send a message"],["to you?","from you?","with you?"]]
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
    ],
    distractors: [["Do you free","Are you freely","Are you freedom"],["this week?","that weekend?","this weekends?"]]
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
    ],
    distractors: [["I really thank","I really need","I really expect"],["you help.","your helps.","a help."]]
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
    ],
    distractors: [["See you late,","See you letter,","Seeing you later,"],["take cares.","took care.","care take."]]
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
    ],
    distractors: [["That sound like","That sounds as","That sounding like"],["a great ideal.","great idea.","a great ideas."]]
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
    ],
    distractors: [["I afraid","I'm feared"],["I can't take it","I don't make it","I can't makes it"],["today.","this night."]]
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
    ],
    distractors: [["Why don't us","Why not we","Why aren't we"],["grab a bite to drink?","grab a bit to eat?","grab a bite eat?"]]
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
    ],
    distractors: [["Are there","Is their","Does there"],["the pharmacy","some pharmacy","pharmacy"],["near by?","near?","next door?"]]
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
    ],
    distractors: [["I like","I'd liked","I'd wants"],["a middle latte,","a medium late,","a medium lattes,"],["pleased.","please me."]]
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
    ],
    distractors: [["What times","When time","How time"],["should us meet up?","should we to meet up?","should we meets up?"]]
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
    ],
    distractors: [["How many","How money","How prices"],["do this one cost?","does this ones cost?","costs this one?"]]
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
    ],
    distractors: [["I'm not feeling me","I'm not feel myself","I don't feeling myself"],["this day.","todays.","the today."]]
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
    ],
    distractors: [["I have meeting","I has a meeting","I having a meeting"],["on three","at threes","at the three"],["today afternoon.","that afternoon.","in the afternoon."]]
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
    ],
    distractors: [["Are you enjoy","Do you enjoying","Does you enjoy"],["watch movies?","to watch movies?","watched movies?"]]
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
    ],
    distractors: [["I pretty good","I'm pretty well","I'm pretty better"],["in cooking.","for cooking.","to cooking."]]
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
    ],
    distractors: [["This one are","This is one","This one"],["ways cheaper","very cheaper","cheaper way"],["then that.","as that.","than this."]]
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
    ],
    distractors: [["I usual","I'm usually","Usual I"],["go to a run","go for run","going for a run"],["on the morning.","at the morning.","in morning."]]
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
    ],
    distractors: [["I planing to","I'm planned to","I planning to"],["visiting Japan","visit to Japan","visits Japan"],["next years.","the next year.","in next year."]]
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
    ],
    distractors: [["We go hiking","We went hike","We gone hiking"],["the last Sunday.","on last Sunday.","last Saturdays."]]
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
    ],
    distractors: [["If it rain,","If it will rain,","If it rainy,"],["we just stay home.","we'll just staying home.","we'll just stays home."]]
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
    ],
    distractors: [["You definite should","You should definately","You definitely should"],["to try this place.","trying this place.","try this places."]]
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
    ],
    distractors: [["What beautiful view","How a beautiful view","What a beautifully view"],["up from here!","from up there!","from down here!"]]
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
    ],
    distractors: [["Could you spoke","Could your speak","Could you to speak"],["a bit more slower,","a bit of more slowly,","a more bit slowly,"],["pleased?","pleases?"]]
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
    ],
    distractors: [["I sorry","I'm sorries","I'm sorrys"],["to kept you waiting.","to keep you wait.","for keep you waiting."]]
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
    ],
    distractors: [["Can you gives me","Can you to give me","Can you give I"],["discount?","a discounts?","the discount?"]]
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
    ],
    distractors: [["I'd like steak,","I'd likes the steak,","I like the steak,"],["well done,","rare,","medium well,"],["pleased.","pleases."]]
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
    ],
    distractors: [["Are the meeting","Is a meeting","The meeting is"],["still in","still be on","on still"],["on tomorrow?","to tomorrow?","in tomorrow?"]]
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
    ],
    distractors: [["I think we lost,","I think we're lose,","I thinks we're lost,"],["can you helps us?","can you help we?","can your help us?"]]
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
    ],
    distractors: [["How far","How often","How time"],["do it take","does it takes","it takes"],["to get to there?","to getting there?","to get here?"]]
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
    ],
    distractors: [["I'm in cooking","I into cooking","I'm into cook"],["this days.","those days.","theses days."]]
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
    ],
    distractors: [["Let's staying in touch,","Let's stay in the touch,","Let we stay in touch,"],["okays?","okey?"]]
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
    ],
    distractors: [["It's boiled hot","It's boiling hotter","It's boiling hots"],["outdoor","in outside"],["to day.","the today."]]
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
    ],
    distractors: [["I can't remembered","I cann't remember","I can't to remember"],["where I putted","where did I put","where I puts"],["my key.","mine keys.","keys."]]
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
    ],
    distractors: [["You should take break","You should takes a break","You should to take a break"],["just now.","for now.","nows."]]
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
    ],
    distractors: [["Are you have","Do you has","Do you having"],["any tables availables","any tables is available"],["to two?","for second?","for two person?"]]
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
    ],
    distractors: [["Could me get this","Could I to get this","Could I gets this"],["to going,","go,","for go,"],["pleased.","pleases."]]
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
    ],
    distractors: [["We just looking,","We're just look,","We're just looks,"],["but thank anyway.","but thanks any way.","but thanks anyways."]]
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
    ],
    distractors: [["What sizes","How size","What a size"],["are you take","do you takes","you take"],["of shoes?","on shoes?","for shoes?"]]
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
    ],
    distractors: [["I should has","I should of","I should to have"],["call you","calling you","called your"],["early.","more earlier.","earliest."]]
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
    ],
    distractors: [["Mind that I","Minds if I","Mind do I"],["join with you","joins you","joining you"],["to lunch?","for the lunch?","at lunch?"]]
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
    ],
    distractors: [["The subway are faster","Subway is faster","The subway is more faster"],["than drive","then driving","to driving"],["down town.","to downtown.","in downtown."]]
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
    ],
    distractors: [["Could us get","Could we to get","Could we gets"],["the checks,","check,","the checkout,"],["pleased.","pleases."]]
  },
  {
    sentence: "Is that Mr. Chen speaking?",
    cid: "e138468c",
    translation: "请问是陈先生在说话吗？",
    chunks: ["Is that", "Mr. Chen", "speaking?"],
    hints: ["那是", "陈先生", "在讲话"],
    grammar: [
      {role:'系动词+指示代词',color:'#c87033',phonetic:['/ɪz/','/ðæt/'],pos:'确认疑问',meaning:'那是'},
      {role:'称呼',color:'#3358e0',phonetic:['/ˈmɪstər/','/tʃen/'],pos:'称谓短语',meaning:'陈先生'},
      {role:'现在分词',color:'#e74c7a',phonetic:['/ˈspiːkɪŋ/'],pos:'进行时谓语',meaning:'在讲话'}
    ],
    explanations: [
      "打电话确认对方身份的经典句式。常见错误：\n• \"Is that **speak** Mr. Chen\" → 词序混乱，正确为 Is that + 人名 + speaking\n• \"Are you Mr. Chen **speaking**\" → Are you 用于面对面，电话里用 Is that",
      "`Mr. Chen` 姓氏前加 Mr./Ms. 表尊称。注意 Mr. 的缩写点不是句号，不影响断句。",
      "`speaking?` 是进行时的省略（Is that Mr. Chen **who is** speaking?）。口语中 who is 常省略。"
    ],
    distractors: [["Is this","Was that","Is there"],["Mr. Smith","the Mr. Chen","Mr. Chen's"],["talk?","speaks?","spoke?"]]
  },
  {
    sentence: "He's not in the office at the moment.",
    cid: "9c89ba9b",
    translation: "他现在不在办公室。",
    chunks: ["He's not in the office", "at the moment."],
    hints: ["他不在办公室", "此刻"],
    grammar: [
      {role:'主系表+地点',color:'#c87033',phonetic:['/hiːz/','/nɒt/','/ɪn/','/ði/','/ˈɒfɪs/'],pos:'否定陈述',meaning:'他不在办公室'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/æt/','/ðə/','/ˈməʊmənt/'],pos:'介词短语',meaning:'此刻'}
    ],
    explanations: [
      "`not in the office` 表「不在办公室」，是 in 表地点的否定。常见错误：\n• \"He's not **at** the office\" → at/office 搭配也对，但 in the office 更常用\n• \"He doesn't in the office\" → be 动词否定用 isn't，不是 doesn't",
      "`at the moment` = right now（此刻），常用于电话里说明现状。同义表达：right now / at present。"
    ],
    distractors: [["He doesn't in the office","He's not on the office","He not in the office"],["at the minute.","in the moment.","for the moment."]]
  },
  {
    sentence: "Could you tell him I called?",
    cid: "5893e7b7",
    translation: "你能告诉他我打过电话吗？",
    chunks: ["Could you tell him", "I called?"],
    hints: ["你能告诉他", "我打过电话"],
    grammar: [
      {role:'情态+谓语+宾语',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/tel/','/hɪm/'],pos:'委婉请求',meaning:'你能告诉他'},
      {role:'宾语从句',color:'#7c5cbf',phonetic:['/aɪ/','/kɔːld/'],pos:'过去时从句',meaning:'我打过电话'}
    ],
    explanations: [
      "留言常用句式。`tell him + 从句` 结构。常见错误：\n• \"tell **to** him\" → tell 是双宾动词，直接接人（tell him / tell me）\n• \"tell him I **call**\" → 电话已打完要用过去式 called",
      "`I called` 过去式表「刚才打过电话」。接电话的人回来说：He called earlier.（他之前来过电话）。"
    ],
    distractors: [["Can you told him","Could you tell to him","Could your tell him"],["I call?","I calling?","I calls?"]]
  },
  {
    sentence: "Sorry, you must have the wrong number.",
    cid: "00d6253f",
    translation: "抱歉，你一定是打错电话了。",
    chunks: ["Sorry,", "you must have", "the wrong number."],
    hints: ["抱歉", "你一定是", "拨错了号码"],
    grammar: [
      {role:'致歉词',color:'#7c5cbf',phonetic:['/ˈsɒri/'],pos:'礼貌用语',meaning:'抱歉'},
      {role:'情态+完成式',color:'#e74c7a',phonetic:['/juː/','/mʌst/','/hæv/'],pos:'推测结构',meaning:'你一定是'},
      {role:'名词短语',color:'#3358e0',phonetic:['/ðə/','/rɒŋ/','/ˈnʌmbər/'],pos:'宾语',meaning:'错误的号码'}
    ],
    explanations: [
      "`Sorry,` 开头加逗号表道歉语气。注意是 sorry 不是 apologize（口语更自然）。",
      "`must have + 名词` = 一定是（对现在的推测）。这里 must have the wrong number = 一定是拿错号码了。常见错误：\n• \"you must **has**\" → must 后接动词原形 have\n• \"you **must to** have\" → 情态动词后不加 to",
      "`the wrong number` 固定说法 = 错误号码/打错电话。完整句常接：Sorry, wrong number.（打错了）。"
    ],
    distractors: [["Apology,","Sorry,please","Excuse me,"],["you must has","you must to have","you have must"],["the wrong call.","a wrong number.","the wrongly number."]]
  },
  {
    sentence: "I've got a terrible headache and a sore throat.",
    cid: "35fcfee6",
    translation: "我头疼得厉害，嗓子也疼。",
    chunks: ["I've got", "a terrible headache", "and a sore throat."],
    hints: ["我得了", "剧烈的头痛", "和嗓子疼"],
    grammar: [
      {role:'主谓结构',color:'#e74c7a',phonetic:['/aɪv/','/ɡɒt/'],pos:'现在完成',meaning:'我得了'},
      {role:'名词短语',color:'#3358e0',phonetic:['/ə/','/ˈterəbl/','/ˈhedeɪk/'],pos:'宾语',meaning:'剧烈的头痛'},
      {role:'并列宾语',color:'#3358e0',phonetic:['/ænd/','/ə/','/sɔːr/','/θrəʊt/'],pos:'名词短语',meaning:'和嗓子疼'}
    ],
    explanations: [
      "`I've got + 病症` = 我得了…病，比 I have 更口语。常见错误：\n• \"I **have got** headache\" → headache 是可数名词，需 a terrible headache\n• \"I got a headache\" → 口语可以，但 have got 表状态更准",
      "`terrible` 表「极其严重的」，口语常用来形容疼痛程度。同义：awful / really bad.",
      "`a sore throat` = 嗓子疼（sore 表酸痛）。固定搭配：have a sore throat / a runny nose（流鼻涕）。"
    ],
    distractors: [["I'm got","I has got","I've gotten"],["a terrible headsick","terrible headache","the terrible headache"],["and sore throat.","and a sour throat.","and a throat sore."]]
  },
  {
    sentence: "How long have you been feeling like this?",
    cid: "f5a21d52",
    translation: "你这样感觉有多久了？",
    chunks: ["How long", "have you been feeling", "like this?"],
    hints: ["多久", "你一直感觉", "像这样"],
    grammar: [
      {role:'疑问副词',color:'#7c5cbf',phonetic:['/haʊ/','/lɒŋ/'],pos:'疑问短语',meaning:'多久'},
      {role:'现在完成进行',color:'#e74c7a',phonetic:['/hæv/','/juː/','/bɪn/','/ˈfiːlɪŋ/'],pos:'完成进行时',meaning:'你一直感觉'},
      {role:'介词短语',color:'#3358e0',phonetic:['/laɪk/','/ðɪs/'],pos:'方式状语',meaning:'像这样'}
    ],
    explanations: [
      "医生问病史的标准句。`How long + 现在完成进行` 问持续时长。常见错误：\n• \"How long **are** you feeling\" → 问持续至今要用完成进行时\n• \"How **often** have you been feeling\" → often 问频率，long 问时长",
      "`have been feeling` 现在完成进行时表「从过去一直持续到现在」。强调 still 在持续。",
      "`like this` 指代病人描述的症状，口语高频。"
    ],
    distractors: [["How much","How soon","What long"],["have you feel","did you been feeling","are you been feeling"],["for like this?","like that?","liked this?"]]
  },
  {
    sentence: "Have you taken anything for it?",
    cid: "2f17c3e6",
    translation: "你吃过什么药吗？",
    chunks: ["Have you taken", "anything for it?"],
    hints: ["你吃过", "针对它的任何药"],
    grammar: [
      {role:'现在完成疑问',color:'#e74c7a',phonetic:['/hæv/','/juː/','/ˈteɪkən/'],pos:'完成时疑问',meaning:'你吃过'},
      {role:'不定代词短语',color:'#3358e0',phonetic:['/ˈeniθɪŋ/','/fɔːr/','/ɪt/'],pos:'宾语',meaning:'针对它的药'}
    ],
    explanations: [
      "`take` 表「吃药/喝药」，不用 eat/drink。常见错误：\n• \"Have you **eaten** anything\" → eat 表吃食物，吃药用 take\n• \"Did you taken\" → 现在完成用 have + 过去分词 taken",
      "`anything for it` 中 it 指代病症。for it = 针对这个病。也可说 medicine for it."
    ],
    distractors: [["Did you took","Have you take","Has you taken"],["something to it?","anything about it?","anything for that?"]]
  },
  {
    sentence: "You'd better get some rest and drink plenty of water.",
    cid: "c55bb082",
    translation: "你最好休息一下，多喝水。",
    chunks: ["You'd better", "get some rest", "and drink plenty of water."],
    hints: ["你最好", "休息一下", "并喝大量的水"],
    grammar: [
      {role:'情态结构',color:'#e74c7a',phonetic:['/juːd/','/ˈbetər/'],pos:'建议结构',meaning:'你最好'},
      {role:'动词短语',color:'#3358e0',phonetic:['/ɡet/','/sʌm/','/rest/'],pos:'祈使谓语',meaning:'休息一下'},
      {role:'并列谓语',color:'#3358e0',phonetic:['/ænd/','/drɪŋk/','/ˈplenti/','/əv/','/ˈwɔːtər/'],pos:'动词短语',meaning:'并大量喝水'}
    ],
    explanations: [
      "`You'd better` = You had better，表强烈建议（带警告意味）。常见错误：\n• \"You'd better **to** get\" → had better 后接动词原形\n• \"You **better** get\" → 口语可省略 had，书面保留更正式",
      "`get some rest` 固定搭配 = 休息。同义：have a rest / take a break.",
      "`plenty of water` = 大量的水。plenty of 后可接可数/不可数名词，比 a lot of 更口语。常见错误：\n• \"plenty **waters**\" → water 不可数，不加 s\n• \"a plenty of\" → 多了一个 a"
    ],
    distractors: [["You've better","You had better to","Your better"],["take some rests","make some rest","get any rest"],["and drink plenty waters.","and drinking plenty of water.","and drink lot of water."]]
  },
  {
    sentence: "My stomach has been hurting since this morning.",
    cid: "df0d93d3",
    translation: "我从早上起胃就一直疼。",
    chunks: ["My stomach", "has been hurting", "since this morning."],
    hints: ["我的胃", "一直在疼", "自从今天早上"],
    grammar: [
      {role:'主语',color:'#3358e0',phonetic:['/maɪ/','/ˈstʌmək/'],pos:'名词短语',meaning:'我的胃'},
      {role:'现在完成进行',color:'#e74c7a',phonetic:['/hæz/','/bɪn/','/ˈhɜːtɪŋ/'],pos:'完成进行时',meaning:'一直在疼'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/sɪns/','/ðɪs/','/ˈmɔːnɪŋ/'],pos:'介词短语',meaning:'自从今早'}
    ],
    explanations: [
      "`has been hurting` 现在完成进行时表「从过去持续到现在还在疼」。常见错误：\n• \"has been **hurt**\" → 主动持续用 hurting，被动受伤才是 hurt\n• \"is hurting since morning\" → 有 since 的时间段用完成进行时",
      "`since this morning` 表起点。注意：since + 时间点，for + 时间段（for two hours）。"
    ],
    distractors: [["My stomachs","The my stomach","Mine stomach"],["has been hurt","have been hurting","has hurting"],["for this morning.","since morning ago.","after this morning."]]
  },
  {
    sentence: "Does it hurt when I press here?",
    cid: "3e523059",
    translation: "我按这里会疼吗？",
    chunks: ["Does it hurt", "when I press here?"],
    hints: ["它会疼吗", "当我按这里"],
    grammar: [
      {role:'助动词疑问',color:'#e74c7a',phonetic:['/dʌz/','/ɪt/','/hɜːt/'],pos:'一般疑问',meaning:'它会疼吗'},
      {role:'时间状语从句',color:'#7c5cbf',phonetic:['/wen/','/aɪ/','/pres/','/hɪər/'],pos:'when 从句',meaning:'当我按这里'}
    ],
    explanations: [
      "医生按压检查时的问句。`Does it hurt` 一般现在时问当下反应。常见错误：\n• \"Is it hurt\" → hurt 是动词，问句用 Does\n• \"Does it **hurts**\" → 助动词后动词用原形",
      "`when I press here` = 当我按这里。here 直接作地点副词，前面不加介词（不说 press at here）。"
    ],
    distractors: [["Is it hurt","Does it hurts","Do it hurt"],["when I pressing here?","when I pressed here?","when I press there?"]]
  },
  {
    sentence: "I have a reservation under the name Chen.",
    cid: "faaa45bb",
    translation: "我以陈这个名字订了房间。",
    chunks: ["I have a reservation", "under the name Chen."],
    hints: ["我有一个预订", "以陈这个名字"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/hæv/','/ə/','/ˌrezəˈveɪʃn/'],pos:'完成陈述',meaning:'我有预订'},
      {role:'介词短语',color:'#7c5cbf',phonetic:['/ˈʌndər/','/ðə/','/neɪm/','/tʃen/'],pos:'方式状语',meaning:'以陈这个名字'}
    ],
    explanations: [
      "酒店前台报预订名的标准句。`have a reservation` = 有预订。常见错误：\n• \"I **reserved** a room\" → 也正确但 hotel 场景用 have a reservation 更自然\n• \"I have reservation\" → 可数名词要加 a",
      "`under the name Chen` = 以…名义预订，介词用 under 不用 with/in。"
    ],
    distractors: [["I've reservation","I have the reservation","I'm have a reservation"],["with the name Chen.","on the name Chen.","under name Chen."]]
  },
  {
    sentence: "What time is check-out tomorrow morning?",
    cid: "32facf35",
    translation: "明天早上几点退房？",
    chunks: ["What time is", "check-out", "tomorrow morning?"],
    hints: ["几点是", "退房", "明天早上"],
    grammar: [
      {role:'疑问结构',color:'#e74c7a',phonetic:['/wɒt/','/taɪm/','/ɪz/'],pos:'特殊疑问句',meaning:'几点是'},
      {role:'名词',color:'#3358e0',phonetic:['/ˈtʃekaʊt/'],pos:'复合名词',meaning:'退房'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/təˈmɒrəʊ/','/ˈmɔːnɪŋ/'],pos:'名词短语',meaning:'明天早上'}
    ],
    explanations: [
      "酒店场景问退房时间。`check-out`（退房）对应 check-in（入住）。常见错误：\n• \"What time **is it** check-out\" → 直接 What time is + 事件，不加 it\n• \"when is checkout\" → 也可以，但 what time 更精确到几点",
      "`tomorrow morning` 时间状语，前面不加 in/on。同系列：this morning / yesterday morning。"
    ],
    distractors: [["What time does","Which time is","What time was"],["check in","the check-out","checking-out"],["in tomorrow morning?","next morning?","on tomorrow morning?"]]
  },
  {
    sentence: "Could I have a room with a view?",
    cid: "c0724b3e",
    translation: "我能要一间看得见风景的房间吗？",
    chunks: ["Could I have", "a room with a view?"],
    hints: ["我能要", "一间带风景的房间"],
    grammar: [
      {role:'情态疑问',color:'#e74c7a',phonetic:['/kʊd/','/aɪ/','/hæv/'],pos:'委婉请求',meaning:'我能要'},
      {role:'名词短语',color:'#3358e0',phonetic:['/ə/','/ruːm/','/wɪð/','/ə/','/vjuː/'],pos:'宾语',meaning:'带风景的房间'}
    ],
    explanations: [
      "`Could I have...` 酒店委婉索取句式（同 Could we have / May I have）。",
      "`a room with a view` = 景观房。with 引导后置定语修饰 room。常见错误：\n• \"a view room\" → 不地道，用 a room with a view\n• \"a room **has** a view\" → 定语用 with，不能直接接动词"
    ],
    distractors: [["Can I had","Could I to have","Could me have"],["a view room?","a room in a view?","a room with view?"]]
  },
  {
    sentence: "The air conditioner doesn't seem to work.",
    cid: "e0229bb6",
    translation: "空调好像坏了。",
    chunks: ["The air conditioner", "doesn't seem to work."],
    hints: ["空调", "似乎不工作了"],
    grammar: [
      {role:'主语',color:'#3358e0',phonetic:['/ði/','/eər/','/kənˈdɪʃənər/'],pos:'名词短语',meaning:'空调'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈdʌznt/','/siːm/','/tuː/','/wɜːk/'],pos:'seem 结构',meaning:'似乎不工作'}
    ],
    explanations: [
      "`the air conditioner` 空调（口语常缩略为 the AC）。",
      "`doesn't seem to work` = 似乎坏了。seem to do = 看起来…。常见错误：\n• \"doesn't seems to work\" → 助动词后接原形 seem\n• \"doesn't work\" → 少了 seem 的委婉，直接说坏了语气太绝对"
    ],
    distractors: [["The air conditioners","An air conditioner","The air's conditioner"],["doesn't seems to work.","isn't seem to work.","doesn't work to seem."]]
  },
  {
    sentence: "Could you send someone up to fix it?",
    cid: "8f6161c2",
    translation: "你能派人上来修一下吗？",
    chunks: ["Could you send someone up", "to fix it?"],
    hints: ["你能派个人上来", "修理它"],
    grammar: [
      {role:'情态+谓语',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/send/','/ˈsʌmwʌn/','/ʌp/'],pos:'委婉请求',meaning:'你能派人上来'},
      {role:'不定式目的',color:'#7c5cbf',phonetic:['/tuː/','/fɪks/','/ɪt/'],pos:'目的状语',meaning:'去修理'}
    ],
    explanations: [
      "酒店报修用语。`send someone up` = 派人上来（up 指上楼到客房）。常见错误：\n• \"send someone **to** up\" → up 是副词，直接接在宾语后\n• \"send up someone\" → 宾语长时 up 放后更自然",
      "`to fix it` 不定式表目的 = 来修理。同义：to repair it / to take a look at it."
    ],
    distractors: [["Could you sent someone up","Can you to send someone up","Could you send anyone up"],["fixing it?","to fixing it?","for fix it?"]]
  },
  {
    sentence: "Could I see your boarding pass, please?",
    cid: "cf1b44ab",
    translation: "请出示您的登机牌好吗？",
    chunks: ["Could I see", "your boarding pass,", "please?"],
    hints: ["我能看一下", "您的登机牌", "请"],
    grammar: [
      {role:'情态疑问',color:'#e74c7a',phonetic:['/kʊd/','/aɪ/','/siː/'],pos:'委婉请求',meaning:'我能看'},
      {role:'宾语',color:'#3358e0',phonetic:['/jɔːr/','/ˈbɔːdɪŋ/','/pɑːs/'],pos:'名词短语',meaning:'您的登机牌'},
      {role:'礼貌词',color:'#7c5cbf',phonetic:['/pliːz/'],pos:'语气词',meaning:'请'}
    ],
    explanations: [
      "机场登机口查验登机牌的用语。`boarding pass` = 登机牌（boarding card 同义）。",
      "`your boarding pass,` 名词短语作宾语，后接 please 表请求。注意 boarding pass 中间不加空格外的词：不说 boarding **the** pass。",
      "`please?` 放在句尾升调表请求。也可前置：Please, could I see…?"
    ],
    distractors: [["Can I saw","Could me see","Could I seeing"],["your board pass,","you boarding pass,","your boarding ticket,"],["pleased?","pleases?"]]
  },
  {
    sentence: "How many bags are you checking in?",
    cid: "df26fb4e",
    translation: "您要托运几件行李？",
    chunks: ["How many bags", "are you checking in?"],
    hints: ["多少件行李", "你要托运"],
    grammar: [
      {role:'疑问短语',color:'#7c5cbf',phonetic:['/haʊ/','/ˈmeni/','/bæɡz/'],pos:'疑问词+名词',meaning:'多少件行李'},
      {role:'现在进行疑问',color:'#e74c7a',phonetic:['/ɑːr/','/juː/','/ˈtʃekɪŋ/','/ɪn/'],pos:'进行时疑问',meaning:'你要托运'}
    ],
    explanations: [
      "值机柜台问行李数。`bags` 口语指行李箱。常见错误：\n• \"How **much** bags\" → bags 可数用 many\n• \"How many **baggage**\" → baggage 不可数，不用 many 修饰",
      "`check in` 此处指「托运行李」（check in bags）。注意拆开使用：checking **in** 的 in 不能丢。"
    ],
    distractors: [["How much bags","How many bag","How many luggages"],["you are checking in?","are you check in?","are you checking on?"]]
  },
  {
    sentence: "Could you drop me off at the airport?",
    cid: "afd0eb9f",
    translation: "你能送我到机场吗？",
    chunks: ["Could you drop me off", "at the airport?"],
    hints: ["你能送我下车", "在机场"],
    grammar: [
      {role:'情态+短语动词',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/drɒp/','/miː/','/ɒf/'],pos:'委婉请求',meaning:'你能送我'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/æt/','/ði/','/ˈeəpɔːt/'],pos:'介词短语',meaning:'在机场'}
    ],
    explanations: [
      "打车/搭顺风车用语。`drop someone off` = 把某人送到（下车）。常见错误：\n• \"drop off **me**\" → 代词宾语放短语中间：drop me off\n• \"drop me **at**\" → 需要 off 组成短语动词",
      "`at the airport` 表到达地点。机场相关：at the airport / to the airport（去机场）。"
    ],
    distractors: [["Could you drop off me","Can you to drop me off","Could your drop me off"],["to the airport?","in the airport?","at an airport?"]]
  },
  {
    sentence: "Please pull over here, that's fine.",
    cid: "20563507",
    translation: "请靠边停在这里，这就行。",
    chunks: ["Please pull over here,", "that's fine."],
    hints: ["请靠边停这", "那就可以了"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/pliːz/','/pʊl/','/ˈəʊvər/','/hɪər/'],pos:'短语动词祈使',meaning:'请靠边停这'},
      {role:'主系表',color:'#c87033',phonetic:['/ðæts/','/faɪn/'],pos:'肯定回应',meaning:'这就行'}
    ],
    explanations: [
      "打车到目的地让司机停车的用语。`pull over` = 靠边停车。常见错误：\n• \"pull **on** here\" → 靠边是 pull over\n• \"stop here\" → 也可以，但 pull over 强调靠路边",
      "`that's fine.` = 那就可以/这里就行。回应司机的确认询问。"
    ],
    distractors: [["Please pull up here,","Please pull in here,","Pulling over here,"],["that's okay?","it's fine.","that fine."]]
  },
  {
    sentence: "Keep the change, please.",
    cid: "515d82ef",
    translation: "不用找零了，谢谢。",
    chunks: ["Keep the change,", "please."],
    hints: ["留着零钱", "请"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/kiːp/','/ðə/','/tʃeɪndʒ/'],pos:'动词短语',meaning:'留着零钱'},
      {role:'礼貌词',color:'#7c5cbf',phonetic:['/pliːz/'],pos:'语气词',meaning:'请'}
    ],
    explanations: [
      "给小费/付现金不用找零的用语。`keep the change` = 零钱不用找了。常见错误：\n• \"keep **changes**\" → change 表零钱不可数\n• \"don't give me change\" → 不自然，固定说 keep the change",
      "`the change` 特指「该找的零钱」。付现金多于车费时说这句。"
    ],
    distractors: [["Keeping the change,","Keep the changes,","Take the change,"],["thank you.","pleased.","thanks a lot."]]
  },
  {
    sentence: "I'm afraid I have to ask for a day off.",
    cid: "13fee10d",
    translation: "恐怕我得请一天假。",
    chunks: ["I'm afraid", "I have to ask for", "a day off."],
    hints: ["恐怕", "我得请求", "一天假"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/əˈfreɪd/'],pos:'委婉表达',meaning:'恐怕'},
      {role:'主谓结构',color:'#e74c7a',phonetic:['/aɪ/','/hæv/','/tuː/','/ɑːsk/','/fɔːr/'],pos:'have to 结构',meaning:'我得请求'},
      {role:'名词短语',color:'#3358e0',phonetic:['/ə/','/deɪ/','/ɒf/'],pos:'宾语',meaning:'一天假'}
    ],
    explanations: [
      "`I'm afraid` 委婉开头，软化请求的唐突感。常见错误：\n• \"I'm afraid **of** I have to\" → afraid 接从句不加 of\n• \"I afraid\" → 缺 be 动词，要 I'm afraid",
      "`have to ask for` = 不得不请求。have to 表客观必须。",
      "`a day off` = 一天假（off 表休假）。常见错误：\n• \"a **off** day\" → 顺序颠倒，是 a day off\n• \"ask for day off\" → 可数，要 a day off"
    ],
    distractors: [["I afraid","I'm afraid of","I'm feared"],["I has to ask for","I have to asking for","I must to ask for"],["a off day.","one day offs.","a day of."]]
  },
  {
    sentence: "Could we reschedule the meeting to Friday?",
    cid: "4d2656c9",
    translation: "我们能把会议改到周五吗？",
    chunks: ["Could we reschedule", "the meeting", "to Friday?"],
    hints: ["我们能重新安排", "会议", "改到周五"],
    grammar: [
      {role:'情态疑问',color:'#e74c7a',phonetic:['/kʊd/','/wiː/','/riːˈʃedjuːl/'],pos:'委婉请求',meaning:'我们能重排'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈmiːtɪŋ/'],pos:'名词短语',meaning:'会议'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/tuː/','/ˈfraɪdeɪ/'],pos:'介词短语',meaning:'改到周五'}
    ],
    explanations: [
      "改期用语。`reschedule` = 重新安排时间。常见错误：\n• \"reschedule the meeting **for** Friday\" → for 也可以，但 to 强调改到的目标\n• \"re-schedule\" → 不加连字符更常见",
      "`the meeting` 特指已知的那场会议。",
      "`to Friday` = 改到周五。星期几前不加 on（改期到某日用 to/for + 星期）。"
    ],
    distractors: [["Could we reschedules","Can we to reschedule","Could us reschedule"],["a meeting","meetings","the meeting's"],["at Friday?","on Friday?","to the Friday?"]]
  },
  {
    sentence: "I'll get back to you by the end of the day.",
    cid: "ddff4543",
    translation: "我今天之内会回复你。",
    chunks: ["I'll get back to you", "by the end of the day."],
    hints: ["我会回复你", "在今天结束前"],
    grammar: [
      {role:'主谓结构',color:'#e74c7a',phonetic:['/aɪl/','/ɡet/','/bæk/','/tuː/','/juː/'],pos:'将来时',meaning:'我会回复你'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/baɪ/','/ði/','/end/','/əv/','/ðə/','/deɪ/'],pos:'介词短语',meaning:'在今日结束前'}
    ],
    explanations: [
      "商务跟进用语。`get back to someone` = 回复/再联系某人。常见错误：\n• \"get back **you**\" → 要带 to：get back to you\n• \"reply you\" → 同样漏了 to（reply to you）",
      "`by the end of the day` = 今天之内（截止）。by + 时间点表「不迟于」。注意不是 at the end。"
    ],
    distractors: [["I get back to you","I'll get you back","I'll back to you"],["at the end of the day.","until the end of the day.","by end of day."]]
  },
  {
    sentence: "I didn't quite catch what you said.",
    cid: "9dc552cd",
    translation: "我没太听清你说的话。",
    chunks: ["I didn't quite catch", "what you said."],
    hints: ["我没太听清", "你说的话"],
    grammar: [
      {role:'主谓结构',color:'#e74c7a',phonetic:['/aɪ/','/ˈdɪdnt/','/kwaɪt/','/kætʃ/'],pos:'过去时否定',meaning:'我没太听清'},
      {role:'宾语从句',color:'#7c5cbf',phonetic:['/wɒt/','/juː/','/sed/'],pos:'what 从句',meaning:'你说的话'}
    ],
    explanations: [
      "没听清时请对方重复。`catch` 此处 = 听清/听懂。常见错误：\n• \"I didn't **heard**\" → didn't 后接动词原形 hear/catch\n• \"I didn't quite **listen** what you said\" → 听清用 catch/hear，不用 listen",
      "`what you said` = 你说的话（what 引导名词性从句）。注意从句语序是陈述语序（you said，不是 did you say）。"
    ],
    distractors: [["I don't quite catch","I didn't quite caught","I didn't quite catching"],["what did you said.","what you say.","that you said."]]
  },
  {
    sentence: "Could you run that by me one more time?",
    cid: "a5317c23",
    translation: "你能再给我说一遍吗？",
    chunks: ["Could you run that by me", "one more time?"],
    hints: ["你能给我过一遍", "再一次"],
    grammar: [
      {role:'情态+短语动词',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/rʌn/','/ðæt/','/baɪ/','/miː/'],pos:'委婉请求',meaning:'你能给我讲一遍'},
      {role:'频率状语',color:'#7c5cbf',phonetic:['/wʌn/','/mɔːr/','/taɪm/'],pos:'名词短语',meaning:'再一次'}
    ],
    explanations: [
      "`run that by me` = 给我讲一遍/过一遍（美式口语，常用于确认理解）。常见错误：\n• \"run **me** by that\" → 语序固定：run that by me\n• \"say that to me again\" → 也对，但 run by 更口语",
      "`one more time` = 再一次。同义：once more / again."
    ],
    distractors: [["Could you run that to me","Can you run me by that","Could your run that by me"],["one another time?","more one time?","one more times?"]]
  },
  {
    sentence: "Let me know if you need anything else.",
    cid: "3a6102e6",
    translation: "如果你还需要什么，告诉我。",
    chunks: ["Let me know", "if you need", "anything else."],
    hints: ["告诉我", "如果你需要", "其他任何东西"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/let/','/miː/','/nəʊ/'],pos:'使役结构',meaning:'让我知道'},
      {role:'条件从句',color:'#7c5cbf',phonetic:['/ɪf/','/juː/','/niːd/'],pos:'if 从句',meaning:'如果你需要'},
      {role:'不定代词',color:'#3358e0',phonetic:['/ˈeniθɪŋ/','/els/'],pos:'宾语',meaning:'其他任何东西'}
    ],
    explanations: [
      "服务收尾常用语。`let me know` = 告诉我（let + 人 + 动词原形）。常见错误：\n• \"Let me **to** know\" → let 后接原形，不加 to\n• \"Tell me know\" → 中式表达，正确是 let me know",
      "`if you need anything else` = 如果你还需要别的。else 放 anything 后。"
    ],
    distractors: [["Let me to know","Lets me know","Tell me know"],["when you need","if you needing","if your need"],["anything others.","else anything.","something else."]]
  },
  {
    sentence: "May I hand in my homework tomorrow?",
    cid: "9850dabd",
    translation: "我明天交作业可以吗？",
    chunks: ["May I hand in", "my homework", "tomorrow?"],
    hints: ["我可以上交", "我的作业", "明天"],
    grammar: [
      {role:'情态疑问',color:'#e74c7a',phonetic:['/meɪ/','/aɪ/','/hænd/','/ɪn/'],pos:'正式请求',meaning:'我可以上交'},
      {role:'宾语',color:'#3358e0',phonetic:['/maɪ/','/ˈhəʊmwɜːk/'],pos:'名词短语',meaning:'我的作业'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/təˈmɒrəʊ/'],pos:'副词',meaning:'明天'}
    ],
    explanations: [
      "学生向老师请求用语。`May I` 比 Can I 更正式礼貌。常见错误：\n• \"May I to hand in\" → 情态动词后接原形\n• \"Can I hand in\" → 口语可以，对老师用 May 更得体",
      "`hand in` = 上交（作业）。同义：turn in / submit。",
      "`tomorrow` 作时间副词，不加介词（不说 on tomorrow）。"
    ],
    distractors: [["Can I handing in","May me hand in","Might I hand in"],["my homeworks","the homework","mine homework"],["on tomorrow?","in tomorrow?","next morning?"]]
  },
  {
    sentence: "I'm having trouble understanding this part.",
    cid: "2c67da0d",
    translation: "我理解这部分有困难。",
    chunks: ["I'm having trouble", "understanding this part."],
    hints: ["我有困难", "理解这部分"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪm/','/ˈhævɪŋ/','/ˈtrʌbl/'],pos:'现在进行',meaning:'我有困难'},
      {role:'动名词短语',color:'#7c5cbf',phonetic:['/ˌʌndəˈstændɪŋ/','/ðɪs/','/pɑːt/'],pos:'动名词宾语',meaning:'理解这部分'}
    ],
    explanations: [
      "`have trouble doing` = 做…有困难（固定搭配 trouble 后接动名词）。常见错误：\n• \"have trouble **to** understand\" → trouble 后接 doing 不接 to do\n• \"have troubles\" → trouble 此处不可数",
      "`understanding this part` = 理解这部分。part 指课程/材料的某部分。"
    ],
    distractors: [["I'm having troubles","I have trouble to understand","I'm having a trouble"],["understand this part.","understanding these parts.","understood this part."]]
  },
  {
    sentence: "Could you explain it in a simpler way?",
    cid: "adb3d11f",
    translation: "你能用更简单的方式解释吗？",
    chunks: ["Could you explain it", "in a simpler way?"],
    hints: ["你能解释它", "用更简单的方式"],
    grammar: [
      {role:'情态疑问',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/ɪkˈspleɪn/','/ɪt/'],pos:'委婉请求',meaning:'你能解释它'},
      {role:'方式状语',color:'#7c5cbf',phonetic:['/ɪn/','/ə/','/ˈsɪmplər/','/weɪ/'],pos:'介词短语',meaning:'用更简单的方式'}
    ],
    explanations: [
      "请老师换种方式讲解。`explain it` = 解释它（explain 是及物动词，直接接宾语）。常见错误：\n• \"explain **me** it\" → explain 接 explain sth to sb，不接双宾\n• \"explain it **me**\" → 漏了 to：explain it to me",
      "`in a simpler way` = 用更简单的方式。simpler 是 simple 的比较级。"
    ],
    distractors: [["Could you explaining it","Can you to explain it","Could your explain it"],["with a simpler way?","in a more simple way?","in a simplest way?"]]
  },
  {
    sentence: "I'll try my best to catch up with the class.",
    cid: "b0d272f4",
    translation: "我会尽最大努力赶上班级进度。",
    chunks: ["I'll try my best", "to catch up with", "the class."],
    hints: ["我会尽我最大努力", "去赶上", "全班"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪl/','/traɪ/','/maɪ/','/best/'],pos:'将来时',meaning:'我会尽力'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tuː/','/kætʃ/','/ʌp/','/wɪð/'],pos:'短语动词',meaning:'去赶上'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/klɑːs/'],pos:'名词短语',meaning:'全班'}
    ],
    explanations: [
      "`try my best` = 尽最大努力。常见错误：\n• \"try **me** best\" → 物主代词 my 对应主语 I\n• \"do my best\" → 同义，try my best 也可",
      "`catch up with` = 赶上（进度/某人）。catch up 后可跟 with + 对象。常见错误：\n• \"catch up the class\" → 需 with：catch up with the class",
      "`the class` 此处指「全班同学/课程进度」。"
    ],
    distractors: [["I try my best","I'll try mines best","I'll trying my best"],["to catch the class up with","catch up with","to catch up"],["class.","a class.","the classes."]]
  },
  {
    sentence: "Practice makes perfect.",
    cid: "f7458ab4",
    translation: "熟能生巧。",
    chunks: ["Practice", "makes perfect."],
    hints: ["练习", "造就完美"],
    grammar: [
      {role:'主语',color:'#3358e0',phonetic:['/ˈpræktɪs/'],pos:'不可数名词',meaning:'练习'},
      {role:'谓语+表语',color:'#e74c7a',phonetic:['/meɪks/','/ˈpɜːfɪkt/'],pos:'主谓宾谚语',meaning:'造就完美'}
    ],
    explanations: [
      "经典谚语，意为「熟能生巧」。practice 是不可数名词。常见错误：\n• \"**Practices** makes perfect\" → practice 此处不可数，不加 s\n• \"Practice **make** perfect\" → 主语第三人称单数，谓语要 makes",
      "`makes perfect` 中 perfect 是名词性用法（表完美状态）。此谚语结构简洁，不可逐字改动。"
    ],
    distractors: [["Practices","The practice","To practice"],["make perfect.","makes perfectly.","made perfect."]]
  },
  {
    sentence: "I've been meaning to call you all week.",
    cid: "9e19d0bc",
    translation: "我这一整周都想给你打电话。",
    chunks: ["I've been meaning to", "call you", "all week."],
    hints: ["我一直打算", "给你打电话", "整个星期"],
    grammar: [
      {role:'现在完成进行',color:'#e74c7a',phonetic:['/aɪv/','/bɪn/','/ˈmiːnɪŋ/','/tuː/'],pos:'完成进行时',meaning:'我一直打算'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/kɔːl/','/juː/'],pos:'不定式',meaning:'给你打电话'},
      {role:'时间状语',color:'#3358e0',phonetic:['/ɔːl/','/wiːk/'],pos:'名词短语',meaning:'整个星期'}
    ],
    explanations: [
      "`have been meaning to do` = 一直打算做（但没做）。常见错误：\n• \"I meant to call\" → 过去时只表曾打算，完成进行强调一直拖到现在\n• \"I've been meaning **call**\" → 漏了 to：meaning to + 原形",
      "`call you` = 给你打电话（美式，英式常用 ring you）。",
      "`all week` = 整个星期。时间状语，前面不加介词。"
    ],
    distractors: [["I've meaning to","I've been meaning","I been meaning to"],["calling you","to call your","call to you"],["the all week.","all weeks.","for all week."]]
  },
  {
    sentence: "It's up to you, I'm fine either way.",
    cid: "0951976a",
    translation: "你决定吧，我怎么样都行。",
    chunks: ["It's up to you,", "I'm fine", "either way."],
    hints: ["由你决定", "我没问题", "任何一种方式"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ʌp/','/tuː/','/juː/'],pos:'惯用表达',meaning:'由你决定'},
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/faɪn/'],pos:'陈述',meaning:'我没问题'},
      {role:'状语',color:'#7c5cbf',phonetic:['/ˈaɪðər/','/weɪ/'],pos:'短语',meaning:'任何一种方式'}
    ],
    explanations: [
      "`It's up to you` = 由你决定（把选择权交给对方）。常见错误：\n• \"It's **up to your**\" → your 是物主代词，要用宾格 you\n• \"up to you\" → 缺 it's：It's up to you",
      "`I'm fine either way` = 我哪种都行。either way = 无论哪种方式。"
    ],
    distractors: [["It's up for you,","It's up to yours,","It's depends on you,"],["I fine","I'm very fine,","I'm well and"],["either ways.","neither way.","any way."]]
  },
  {
    sentence: "No wonder you look so tired.",
    cid: "f5fe9a5f",
    translation: "难怪你看起来这么累。",
    chunks: ["No wonder", "you look so tired."],
    hints: ["难怪", "你看起来这么累"],
    grammar: [
      {role:'固定表达',color:'#3358e0',phonetic:['/nəʊ/','/ˈwʌndər/'],pos:'惯用语',meaning:'难怪'},
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/lʊk/','/səʊ/','/ˈtaɪəd/'],pos:'系动词+表语',meaning:'你看起来这么累'}
    ],
    explanations: [
      "`No wonder` = 难怪/怪不得（It's no wonder 的省略）。常见错误：\n• \"No **wonders**\" → wonder 此处不可数\n• \"Not wonder\" → 固定是 No wonder",
      "`look tired` = 看起来累。look 是系动词接形容词 tired，不接副词 tiredly。"
    ],
    distractors: [["No wonders","Not wonder","Wonder no"],["you are look so tired.","you looks so tired.","you look so tiredly."]]
  },
  {
    sentence: "Guess what happened to me today!",
    cid: "f40f7098",
    translation: "你猜我今天发生了什么！",
    chunks: ["Guess what", "happened to me today!"],
    hints: ["猜猜什么", "发生在我身上今天"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/ɡes/','/wɒt/'],pos:'祈使+疑问词',meaning:'猜猜什么'},
      {role:'谓语+状语',color:'#7c5cbf',phonetic:['/ˈhæpənd/','/tuː/','/miː/','/təˈdeɪ/'],pos:'过去时',meaning:'发生在我身上今天'}
    ],
    explanations: [
      "分享新闻的开场白。`Guess what` = 你猜怎么着。常见错误：\n• \"Guess **that** what\" → what 引导从句，不加 that\n• \"Guessing what\" → 祈使用动词原形 Guess",
      "`happened to me` = 发生在我身上。happen 是不及物动词，接人用 happen to sb。"
    ],
    distractors: [["Guess that","Guessing what","Guess who"],["happened to you today!","happens to me today!","happened to me yesterday!"]]
  },
  {
    sentence: "I used to play the piano when I was little.",
    cid: "2458e206",
    translation: "我小时候常常弹钢琴。",
    chunks: ["I used to play", "the piano", "when I was little."],
    hints: ["我过去常常弹", "钢琴", "当我小的时候"],
    grammar: [
      {role:'过去习惯',color:'#e74c7a',phonetic:['/aɪ/','/juːst/','/tuː/','/pleɪ/'],pos:'used to 结构',meaning:'我过去常常弹'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/piˈænəʊ/'],pos:'名词短语',meaning:'钢琴'},
      {role:'时间状语从句',color:'#7c5cbf',phonetic:['/wen/','/aɪ/','/wɒz/','/ˈlɪtl/'],pos:'when 从句',meaning:'当我小的时候'}
    ],
    explanations: [
      "`used to do` = 过去常常做（现在不再）。常见错误：\n• \"I **use** to play\" → 表过去习惯用 used to\n• \"I was used to play\" → be used to 后接 doing（习惯做），与 used to do 不同义",
      "`the piano` 弹乐器前要加 the：play the piano / the guitar。常见错误：\n• \"play piano\" → 漏了 the",
      "`when I was little` = 我小时候。little 修饰小时候，也可用 young。"
    ],
    distractors: [["I use to play","I used to playing","I was used to play"],["piano","a piano","the pianos"],["when I was small boy.","when I am little.","while I was little."]]
  },
  {
    sentence: "I'd rather stay in than go out tonight.",
    cid: "c8ebde21",
    translation: "我今晚宁愿待在家里也不愿出去。",
    chunks: ["I'd rather stay in", "than go out", "tonight."],
    hints: ["我宁愿待在家", "而不出去", "今晚"],
    grammar: [
      {role:'主谓结构',color:'#e74c7a',phonetic:['/aɪd/','/ˈrɑːðər/','/steɪ/','/ɪn/'],pos:'would rather 结构',meaning:'我宁愿待在家'},
      {role:'比较连词+动词',color:'#7c5cbf',phonetic:['/ðæn/','/ɡəʊ/','/aʊt/'],pos:'than 比较',meaning:'而不出去'},
      {role:'时间状语',color:'#3358e0',phonetic:['/təˈnaɪt/'],pos:'副词',meaning:'今晚'}
    ],
    explanations: [
      "`would rather do A than do B` = 宁愿 A 也不 B。常见错误：\n• \"I'd rather **to** stay\" → rather 后接原形\n• \"rather than **going** out\" → than 后接与 stay 平行的原形 go out",
      "`stay in` = 待在家（反义 go out）。",
      "`tonight` 时间副词不加介词。"
    ],
    distractors: [["I rather stay in","I'd rather staying in","I'd rather to stay in"],["than going out","rather than go out","than go to out"],["at tonight.","yesterday.","in tonight."]]
  },
  {
    sentence: "As long as you're happy, that's all that matters.",
    cid: "f138b191",
    translation: "只要你开心，其他都不重要。",
    chunks: ["As long as you're happy,", "that's all", "that matters."],
    hints: ["只要你开心", "那就全部", "重要的"],
    grammar: [
      {role:'条件从句',color:'#7c5cbf',phonetic:['/æz/','/lɒŋ/','/æz/','/jɔːr/','/ˈhæpi/'],pos:'as long as 从句',meaning:'只要你开心'},
      {role:'主句',color:'#c87033',phonetic:['/ðæts/','/ɔːl/'],pos:'主系表',meaning:'那就是全部'},
      {role:'定语从句',color:'#3358e0',phonetic:['/ðæt/','/ˈmætərz/'],pos:'that 从句',meaning:'重要的'}
    ],
    explanations: [
      "`As long as` = 只要（条件连词）。常见错误：\n• \"As **long** you're happy\" → 漏第二个 as\n• \"So long as\" → 也可，但 as long as 更口语",
      "`that's all` = 那就是全部（就够了）。",
      "`that matters` 定语从句修饰 all。matter = 重要。常见错误：\n• \"that **is** matters\" → matter 是动词，不加 is\n• \"what matters\" → 可换 but 后者语气不同"
    ],
    distractors: [["As long you're happy,","As far as you're happy,","As long as your happy,"],["that all","that's every","it's all"],["that matter.","that is matters.","what matters."]]
  },
  {
    sentence: "By the way, do you know where the bank is?",
    cid: "9a4f0134",
    translation: "顺便问一下，你知道银行在哪吗？",
    chunks: ["By the way,", "do you know where", "the bank is?"],
    hints: ["顺便说一下", "你知道哪里", "银行是"],
    grammar: [
      {role:'插入语',color:'#7c5cbf',phonetic:['/baɪ/','/ðə/','/weɪ/'],pos:'固定短语',meaning:'顺便说一下'},
      {role:'疑问主句',color:'#e74c7a',phonetic:['/duː/','/juː/','/nəʊ/','/wer/'],pos:'一般疑问',meaning:'你知道哪里'},
      {role:'宾语从句',color:'#3358e0',phonetic:['/ðə/','/bæŋk/','/ɪz/'],pos:'名词短语',meaning:'银行在'}
    ],
    explanations: [
      "`By the way` = 顺便说一下（转换话题）。常见错误：\n• \"By the **ways**\" → 固定短语不加 s\n• \"By a way\" → 是 the way",
      "`do you know where...` 后接宾语从句，用陈述语序：where **the bank is**（不是 where is the bank）。",
      "`the bank is` = 银行在（某处）。注意从句语序 be 动词后置。"
    ],
    distractors: [["By a way,","By the ways,","Anyway, is"],["do you know where is","did you know where","you know where"],["the bank?","is the bank?","a bank is?"]]
  },
  {
    sentence: "To be honest, I didn't expect it to be so good.",
    cid: "841bd042",
    translation: "说实话，我没料到会这么好。",
    chunks: ["To be honest,", "I didn't expect it", "to be so good."],
    hints: ["说实话", "我没料到它", "会这么好"],
    grammar: [
      {role:'插入语',color:'#7c5cbf',phonetic:['/tuː/','/biː/','/ˈɒnɪst/'],pos:'固定短语',meaning:'说实话'},
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/ˈdɪdnt/','/ɪkˈspekt/','/ɪt/'],pos:'过去时否定',meaning:'我没料到它'},
      {role:'不定式',color:'#3358e0',phonetic:['/tuː/','/biː/','/səʊ/','/ɡʊd/'],pos:'结果补语',meaning:'会这么好'}
    ],
    explanations: [
      "`To be honest` = 说实话（坦率开场）。常见错误：\n• \"To be **honesty**\" → honest 是形容词，honesty 是名词\n• \"Honest\" → 单独说太生硬，用 to be honest",
      "`didn't expect it` = 没料到它。expect 后接不定式 it to be…。常见错误：\n• \"didn't **expected**\" → didn't 后接原形 expect",
      "`to be so good` = 会这么好。so 修饰形容词表程度。"
    ],
    distractors: [["To be honesty,","Being honest,","To be honestly,"],["I didn't expected it","I don't expect it","I didn't expect that"],["to being so good.","to be very good.","so good to be."]]
  },
  {
    sentence: "Make sure you lock the door when you leave.",
    cid: "4bb2e115",
    translation: "你离开时一定锁好门。",
    chunks: ["Make sure", "you lock the door", "when you leave."],
    hints: ["确保", "你锁门", "当你离开时"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/meɪk/','/ʃʊər/'],pos:'祈使短语',meaning:'确保'},
      {role:'宾语从句',color:'#7c5cbf',phonetic:['/juː/','/lɒk/','/ðə/','/dɔːr/'],pos:'从句',meaning:'你锁门'},
      {role:'时间状语从句',color:'#3358e0',phonetic:['/wen/','/juː/','/liːv/'],pos:'when 从句',meaning:'当你离开时'}
    ],
    explanations: [
      "`Make sure` = 确保（后接从句）。常见错误：\n• \"Make **sure** you will lock\" → 表将来用一般现在即可，不加 will\n• \"Be sure lock\" → 漏了 that 或结构错：make sure (that) you lock",
      "`you lock the door` = 你锁门。lock the door 固定搭配。",
      "`when you leave` = 当你离开时。主将从现：主句祈使（现在时），when 从句也用现在时 leave。"
    ],
    distractors: [["Making sure","Be sure","Make certain"],["you locking the door","you locks the door","you lock a door"],["when you leaving.","while you leave.","when you left."]]
  },
  {
    sentence: "I can't stand the noise from the street.",
    cid: "2b0c3220",
    translation: "我受不了街上传来的噪音。",
    chunks: ["I can't stand", "the noise", "from the street."],
    hints: ["我无法忍受", "噪音", "来自街道"],
    grammar: [
      {role:'主谓结构',color:'#e74c7a',phonetic:['/aɪ/','/kɑːnt/','/stænd/'],pos:'情态否定',meaning:'我无法忍受'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/nɔɪz/'],pos:'名词',meaning:'噪音'},
      {role:'介词短语',color:'#7c5cbf',phonetic:['/frɒm/','/ðə/','/striːt/'],pos:'后置定语',meaning:'来自街道'}
    ],
    explanations: [
      "`can't stand` = 受不了/无法忍受（比 don't like 语气强）。常见错误：\n• \"can't **standing**\" → stand 此处是动词，can't stand + 名词\n• \"can't stand it noise\" → 直接接 the noise，不需要 it",
      "`the noise` = 噪音（不可数）。",
      "`from the street` 介词短语后置修饰 noise = 街上传来的噪音。"
    ],
    distractors: [["I couldn't stand","I can't staying","I can't stands"],["the noises","noise","this noise"],["from the streets.","in the street.","of the street."]]
  },
  {
    sentence: "That's exactly what I was thinking.",
    cid: "aab6ad64",
    translation: "那正是我刚才想的。",
    chunks: ["That's exactly", "what I was thinking."],
    hints: ["那正是", "我正在想的"],
    grammar: [
      {role:'主系表+副词',color:'#c87033',phonetic:['/ðæts/','/ɪɡˈzæktli/'],pos:'强调结构',meaning:'那正是'},
      {role:'表语从句',color:'#7c5cbf',phonetic:['/wɒt/','/aɪ/','/wɒz/','/ˈθɪŋkɪŋ/'],pos:'what 从句',meaning:'我刚才想的'}
    ],
    explanations: [
      "附和对方观点的用语。`That's exactly...` = 那正是…。常见错误：\n• \"That's **exact**\" → 修饰动词用副词 exactly\n• \"Exactly that's\" → 语序：That's exactly + 从句",
      "`what I was thinking` = 我刚才在想的事。过去进行时表「刚才那个时刻的想法」。"
    ],
    distractors: [["That's exact","That exactly","It's exactly"],["what I thinking.","what was I thinking.","that I was thinking."]]
  },
  {
    sentence: "You're not going to believe this.",
    cid: "9d0c16ea",
    translation: "你不会相信这个的。",
    chunks: ["You're not going to", "believe this."],
    hints: ["你不会要", "相信这个"],
    grammar: [
      {role:'将来时否定',color:'#e74c7a',phonetic:['/jʊər/','/nɒt/','/ˈɡəʊɪŋ/','/tuː/'],pos:'be going to',meaning:'你不会要'},
      {role:'动词短语',color:'#3358e0',phonetic:['/bɪˈliːv/','/ðɪs/'],pos:'谓语',meaning:'相信这个'}
    ],
    explanations: [
      "预告惊人消息的口语开场。`be going to` 表将来。常见错误：\n• \"You're not **go** to believe\" → going to 结构：be + going to\n• \"You won't believe\" → 同义，但 you're not going to 更口语",
      "`believe this` = 相信这件事。this 指代即将讲述的消息。"
    ],
    distractors: [["You not going to","You're not going","You're no going to"],["believes this.","believed this.","believe it."]]
  },
  {
    sentence: "It depends on the weather, I guess.",
    cid: "09a7c3c3",
    translation: "这取决于天气，我想。",
    chunks: ["It depends on", "the weather,", "I guess."],
    hints: ["它取决于", "天气", "我猜"],
    grammar: [
      {role:'主谓结构',color:'#e74c7a',phonetic:['/ɪt/','/dɪˈpendz/','/ɒn/'],pos:'短语动词',meaning:'它取决于'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈweðər/'],pos:'名词',meaning:'天气'},
      {role:'插入语',color:'#7c5cbf',phonetic:['/aɪ/','/ɡes/'],pos:'口语表达',meaning:'我猜'}
    ],
    explanations: [
      "`depend on` = 取决于（on 不可省）。常见错误：\n• \"It depends **of**\" → 介词是 on\n• \"It's depend on\" → be 动词多余：It depends on",
      "`the weather` = 天气。注意 weather 与 whether（是否）同音不同拼。",
      "`I guess` = 我想/我猜（句尾缓和语气）。"
    ],
    distractors: [["It depend on","It depends","It is depends on"],["a weather,","weather,","the whether,"],["I guessed.","I think.","I'm guess."]]
  },
  {
    sentence: "Do you have this in a bigger size?",
    cid: "6fc23ceb",
    translation: "这个有大一号的吗？",
    chunks: ["Do you have this", "in a bigger size?"],
    hints: ["你有这个", "更大尺码"],
    grammar: [
      {role:'一般疑问',color:'#e74c7a',phonetic:['/duː/','/juː/','/hæv/','/ðɪs/'],pos:'一般疑问',meaning:'你有这个'},
      {role:'介词短语',color:'#7c5cbf',phonetic:['/ɪn/','/ə/','/ˈbɪɡər/','/saɪz/'],pos:'方式状语',meaning:'更大尺码'}
    ],
    explanations: [
      "购物换尺码用语。`this` 指代看中的商品。常见错误：\n• \"Do you **has** this\" → 助动词后接原形 have\n• \"Is there bigger\" → 商品场景用 Do you have this in…",
      "`in a bigger size` = 更大一码。比较级 bigger。常见错误：\n• \"in **bigger** size\" → 缺 a：in a bigger size"
    ],
    distractors: [["Do you has this","Are you have this","Do you have it"],["in a big size?","in bigger size?","on a bigger size?"]]
  },
  {
    sentence: "I'd like to return this, it doesn't fit.",
    cid: "350e2601",
    translation: "我想退掉这个，它不合身。",
    chunks: ["I'd like to return this,", "it doesn't fit."],
    hints: ["我想退掉这个", "它不合身"],
    grammar: [
      {role:'主谓结构',color:'#e74c7a',phonetic:['/aɪd/','/laɪk/','/tuː/','/rɪˈtɜːn/','/ðɪs/'],pos:'would like 结构',meaning:'我想退掉这个'},
      {role:'主谓结构',color:'#3358e0',phonetic:['/ɪt/','/ˈdʌznt/','/fɪt/'],pos:'原因陈述',meaning:'它不合身'}
    ],
    explanations: [
      "退换货用语。`I'd like to return` = 我想退。常见错误：\n• \"I'd like return\" → would like 后接 to + 原形\n• \"I want to give back\" → give back 也可以，return 更正式",
      "`it doesn't fit` = 不合身。fit 指尺寸合适。常见错误：\n• \"it doesn't **fits**\" → 助动词后接原形 fit"
    ],
    distractors: [["I'd like return this,","I like to return this,","I'd like to returning this,"],["it doesn't fits.","it isn't fit.","they don't fit."]]
  },
  {
    sentence: "Could I try this on?",
    cid: "62ff1252",
    translation: "我能试穿一下这个吗？",
    chunks: ["Could I try", "this on?"],
    hints: ["我能试试", "这个穿"],
    grammar: [
      {role:'情态疑问',color:'#e74c7a',phonetic:['/kʊd/','/aɪ/','/traɪ/'],pos:'委婉请求',meaning:'我能试试'},
      {role:'代词+副词',color:'#3358e0',phonetic:['/ðɪs/','/ɒn/'],pos:'短语动词宾语',meaning:'试穿这个'}
    ],
    explanations: [
      "试穿用语。`try on` = 试穿。代词宾语放中间：try **this** on。常见错误：\n• \"try on **this**\" → this 放 on 后不自然（名词可后置，代词前置）\n• \"try this clothes\" → 试穿用 try on",
      "`this on` 中 on 是副词，不能丢。同场景：Can I try these on?"
    ],
    distractors: [["Can I trying","Could me try","Could I to try"],["on this?","it on?","this up?"]]
  },
  {
    sentence: "Let's split the bill, shall we?",
    cid: "352ea243",
    translation: "我们平摊账单吧，好吗？",
    chunks: ["Let's split the bill,", "shall we?"],
    hints: ["我们分摊账单", "好吗"],
    grammar: [
      {role:'祈使提议',color:'#e74c7a',phonetic:['/lets/','/splɪt/','/ðə/','/bɪl/'],pos:"let's 结构",meaning:'我们分摊账单'},
      {role:'反意疑问',color:'#7c5cbf',phonetic:['/ʃæl/','/wiː/'],pos:'附加问句',meaning:'好吗'}
    ],
    explanations: [
      "AA 制用语。`split the bill` = 平摊账单。常见错误：\n• \"split the **bills**\" → 一张账单用单数 the bill\n• \"divide the bill\" → 也可以，split 更口语",
      "`Let's..., shall we?` = 我们…吧，好吗？Let's 开头的祈使句反意疑问固定用 shall we。常见错误：\n• \"Let's..., will we?\" → will we 不配 let's\n• \"Let us split\" → let us 正式，let's 口语"
    ],
    distractors: [["Let's splitting the bill,","Let split the bill,","Let's split the check,"],["will we?","should we?","shall us?"]]
  },
  {
    sentence: "Thanks for having me, I had a great time.",
    cid: "28b5e31b",
    translation: "谢谢招待，我玩得很开心。",
    chunks: ["Thanks for having me,", "I had", "a great time."],
    hints: ["谢谢招待我", "我度过了", "一段美好时光"],
    grammar: [
      {role:'致谢结构',color:'#7c5cbf',phonetic:['/θæŋks/','/fɔːr/','/ˈhævɪŋ/','/miː/'],pos:'thanks for 结构',meaning:'谢谢招待我'},
      {role:'主谓结构',color:'#e74c7a',phonetic:['/aɪ/','/hæd/'],pos:'过去时',meaning:'我度过了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ɡreɪt/','/taɪm/'],pos:'名词短语',meaning:'一段美好时光'}
    ],
    explanations: [
      "做客/聚会后道谢。`thanks for having me` = 谢谢邀请/招待我。常见错误：\n• \"thanks for **have** me\" → for 后接动名词 having\n• \"thanks to have me\" → 搭配是 thanks for doing",
      "`I had` = 我度过了（过去时）。",
      "`a great time` = 美好时光。固定搭配 have a great time。常见错误：\n• \"have great time\" → 缺 a"
    ],
    distractors: [["Thanks for have me,","Thank for having me,","Thanks to having me,"],["I have","I've had","I was had"],["great time.","a great times.","a good time."]]
  }
];


/* 数据并入 builtin-daily（2026-09-07 去冗余决策：不再注册独立 deck builtin-oral-8000）
 * 100 句（日常进阶 · Beyond Basics）运行时 concat 进 builtin-daily.items，共 188 句。
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
