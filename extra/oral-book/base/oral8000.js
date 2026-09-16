/* 日常口语8000句 · 完整教学版（种子库 v3，408 句）
 * 本文件 = 纯数据资产：window.DATA_ORAL8000（408 句，2026-09-07 起并入 builtin-daily，不再独立成 deck）。
 * 第一批 50 句（2026-09-07）+ 第二批 50 句（2026-09-08，电话/就医/酒店/出行/工作/学习/地道句型）+ 第三批 50 句（2026-09-08，租房/银行邮局/理发健身/车辆/数码/电影/家务/情绪/邀约/地道句型）。
 * 第四批 108 句（2026-09-15，生活对话/家庭日常/身体小毛病/二手与付款/邻里探访/工作日程/图书馆礼仪/鼓励与情感支持/健康作息）。
 * 第五批 119 句（2026-09-15，洗漱与早晨/出门与天气/身体与就医/穿戴与退换/电话与情绪/睡眠与房间/居家与家务）。
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
  },
  {
    sentence: "I'm looking for an apartment near the university.",
    cid: "7f041d4e",
    translation: "我在找大学附近的公寓。",
    chunks: ["I'm looking for", "an apartment", "near the university."],
    hints: ["我在寻找", "一间公寓", "大学附近"],
    grammar: [
      {role:'主谓宾(进行时)',color:'#e74c7a',phonetic:['/aɪm/','/ˈlʊkɪŋ/','/fɔːr/'],pos:'look for 进行时',meaning:'正在寻找'},
      {role:'宾语',color:'#3358e0',phonetic:['/ən/','/əˈpɑːrtmənt/'],pos:'名词短语',meaning:'一间公寓'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/nɪr/','/ðə/','/ˌjuːnɪˈvɜːrsəti/'],pos:'介词短语',meaning:'大学附近'}
    ],
    explanations: [
      "找房用语。`look for` = 寻找（过程），`find` = 找到（结果）。常见错误：\n• \"I **looking for**\" → 进行时缺 be 动词\n• \"I look for\" → 一般现在时表习惯，当下找房用进行时",
      "`an apartment` — apartment 以元音音素开头用 an。常见错误：\n• \"a apartment\" → 元音前必须 an",
      "`near the university` = 大学附近。常见错误：\n• \"near to the university\" → near 直接接地点不加 to\n• \"nearby the university\" → nearby 多作形容词/副词"
    ],
    distractors: [["I looking for","I'm looking at","I look for"],["a apartment","apartments","an apartments"],["near to the university.","nearby the university.","near the universities."]]
  },
  {
    sentence: "How much is the rent for this apartment?",
    cid: "26516f50",
    translation: "这套公寓的租金是多少？",
    chunks: ["How much is", "the rent for", "this apartment?"],
    hints: ["多少钱是", "……的租金", "这套公寓"],
    grammar: [
      {role:'疑问句',color:'#e74c7a',phonetic:['/haʊ/','/mʌtʃ/','/ɪz/'],pos:'how much 句型',meaning:'多少钱是'},
      {role:'主语',color:'#3358e0',phonetic:['/ðə/','/rent/','/fɔːr/'],pos:'名词短语',meaning:'……的租金'},
      {role:'介词宾语',color:'#7c5cbf',phonetic:['/ðɪs/','/əˈpɑːrtmənt/'],pos:'指示代词+名词',meaning:'这套公寓'}
    ],
    explanations: [
      "问租金。`how much` 问不可数/价格，`how many` 问可数数量。常见错误：\n• \"How much **are** the rent\" → rent 不可数用 is\n• \"How many is the rent\" → 问钱用 how much",
      "`the rent for` = 为……付的租金。常见错误：\n• \"the rent of\" → of/for 混用，此处 for 表用途\n• 漏 the → 特指这套房要加 the",
      "`this apartment` — this 接单数。常见错误：\n• \"this apartments\" → this 后不加 s"
    ],
    distractors: [["How much are","How many is","What much is"],["rent for","the rents for","a rent for"],["this apartments?","that apartment?","an apartment?"]]
  },
  {
    sentence: "Does the rent include the utilities?",
    cid: "d89f94fa",
    translation: "房租包含水电燃气这些费用吗？",
    chunks: ["Does the rent", "include", "the utilities?"],
    hints: ["房租是否", "包含", "各项杂费"],
    grammar: [
      {role:'一般疑问句',color:'#e74c7a',phonetic:['/dʌz/','/ðə/','/rent/'],pos:'does 助动词',meaning:'房租是否……'},
      {role:'谓语动词',color:'#3358e0',phonetic:['/ɪnˈkluːd/'],pos:'及物动词',meaning:'包含'},
      {role:'宾语',color:'#7c5cbf',phonetic:['/ðə/','/juːˈtɪlətiz/'],pos:'名词(恒复数)',meaning:'杂费(水电燃气)'}
    ],
    explanations: [
      "看房必问。`utilities` 指水电燃气网费等，通常用复数。常见错误：\n• \"Does the rent **includes**\" → does 后动词用原形\n• \"Do the rent\" → rent 第三人称单数，助动词用 does",
      "`include` = 包含。",
      "`the utilities` — 各项杂费合称。常见错误：\n• \"the utility\" → 泛指全部杂费用复数"
    ],
    distractors: [["Do the rent","Does rents","Is the rent"],["includes","included","to include"],["the utility?","a utilities?","these utilities?"]]
  },
  {
    sentence: "I need to sign a one-year lease.",
    cid: "42feb2af",
    translation: "我需要签一份一年期的租约。",
    chunks: ["I need to sign", "a one-year", "lease."],
    hints: ["我需要签", "一份一年的", "租约"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/niːd/','/tə/','/saɪn/'],pos:'need to do',meaning:'我需要签'},
      {role:'定语',color:'#3358e0',phonetic:['/ə/','/wʌn/','/jɪr/'],pos:'复合形容词',meaning:'一年期的'},
      {role:'宾语',color:'#7c5cbf',phonetic:['/liːs/'],pos:'名词',meaning:'租约'}
    ],
    explanations: [
      "签约用语。`sign a lease` = 签租约。常见错误：\n• \"I need **signing**\" → need 后接 to do\n• \"I need to signed\" → to 后动词原形",
      "`a one-year lease` — 复合形容词 one-year 用单数加连字符，作定语。常见错误：\n• \"one-year **lease**\" 丢了 a\n• \"a one-year **leases**\" → 单数租约不加 s",
      "`lease` = 租约（美式常用 lease/rental agreement）。"
    ],
    distractors: [["I need signing","I need to signed","I'm need to sign"],["a one-years","one-year","a one-years lease"],["leases.","the lease.","a lease now?"]]
  },
  {
    sentence: "I can't wait to move into my new place.",
    cid: "1319af65",
    translation: "我迫不及待要搬进新家了。",
    chunks: ["I can't wait to", "move into", "my new place."],
    hints: ["我迫不及待要", "搬进", "我的新住处"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/kænt/','/weɪt/','/tə/'],pos:"can't wait to do",meaning:'迫不及待要'},
      {role:'谓语',color:'#3358e0',phonetic:['/muːv/','/ˈɪntuː/'],pos:'短语动词',meaning:'搬进'},
      {role:'宾语',color:'#7c5cbf',phonetic:['/maɪ/','/nuː/','/pleɪs/'],pos:'名词短语',meaning:'我的新住处'}
    ],
    explanations: [
      "`can't wait to do sth` = 迫不及待做某事。常见错误：\n• \"I can't **waiting** to\" → 固定 can't wait to + 原形\n• \"I don't wait to\" → 没有这个说法",
      "`move into` = 搬进（新居）。常见错误：\n• \"move in **to** my place\" → move in 后直接接地点也可，move into 是完整短语\n• \"move to\" → 表搬到某城市/国家，搬进具体房子用 into",
      "`place` 口语中指「住处」。"
    ],
    distractors: [["I don't wait to","I can't waiting to","I can't wait for"],["moving into","to move in","move on"],["my new places.","mine new place.","my news place."]]
  },
  {
    sentence: "Do you still have the apartment for rent?",
    cid: "65a045ff",
    translation: "这套公寓还在出租吗？",
    chunks: ["Do you still have", "the apartment", "for rent?"],
    hints: ["你是否还有", "这套公寓", "在出租"],
    grammar: [
      {role:'一般疑问句',color:'#e74c7a',phonetic:['/duː/','/juː/','/stɪl/','/hæv/'],pos:'do 助动词+still',meaning:'是否还有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/əˈpɑːrtmənt/'],pos:'名词短语',meaning:'这套公寓'},
      {role:'补语',color:'#7c5cbf',phonetic:['/fɔːr/','/rent/'],pos:'介词短语',meaning:'待出租'}
    ],
    explanations: [
      "租房电话常用语。`still` 表「仍然」，放助动词后。常见错误：\n• \"Are you still **have**\" → have 是实义动词，疑问用 Do you have\n• \"Do you still **has**\" → do 后原形",
      "`the apartment` 特指那套。",
      "`for rent` = 出租中（美式；英式 to let）。常见错误：\n• \"for renting\" → 固定搭配 for rent\n• \"for a rent\" → 多冠词"
    ],
    distractors: [["Are you still have","Do you still has","Do you still got"],["an apartment","the apartments","apartment"],["for renting?","to rent?","for a rent?"]]
  },
  {
    sentence: "I'd like to open a savings account.",
    cid: "9e0805f0",
    translation: "我想开一个储蓄账户。",
    chunks: ["I'd like to open", "a savings", "account."],
    hints: ["我想开", "一个储蓄", "账户"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪd/','/laɪk/','/tə/','/ˈoʊpən/'],pos:'would like to',meaning:'我想开'},
      {role:'定语',color:'#3358e0',phonetic:['/ə/','/ˈseɪvɪŋz/'],pos:'名词作定语',meaning:'储蓄的'},
      {role:'宾语',color:'#7c5cbf',phonetic:['/əˈkaʊnt/'],pos:'名词',meaning:'账户'}
    ],
    explanations: [
      "银行业务。`open an account` = 开户。常见错误：\n• \"I like to open\" → 表喜好，开卡要用 would like to\n• \"I'd like opening\" → would like 后接 to do",
      "`a savings account` — savings 用复数形式作定语（checking account 同理）。常见错误：\n• \"a saving account\" → 固定 savings account\n• \"an savings\" → savings 虽以 s 开头但音素 /s/ 前用 a",
      "`account` 账户。"
    ],
    distractors: [["I like to open","I'd like opening","I'd like to opening"],["a saving","an savings","the savings"],["accounts.","a account.","to account."]]
  },
  {
    sentence: "Could you tell me today's exchange rate?",
    cid: "82e48821",
    translation: "你能告诉我今天的汇率吗？",
    chunks: ["Could you tell me", "today's", "exchange rate?"],
    hints: ["你能告诉我", "今天的", "汇率"],
    grammar: [
      {role:'委婉请求',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/tel/','/miː/'],pos:'could 请求句',meaning:'你能告诉我'},
      {role:'定语(所有格)',color:'#3358e0',phonetic:['/təˈdeɪz/'],pos:"名词所有格",meaning:'今天的'},
      {role:'宾语',color:'#7c5cbf',phonetic:['/ɪksˈtʃeɪndʒ/','/reɪt/'],pos:'名词短语',meaning:'汇率'}
    ],
    explanations: [
      "银行换汇用语。`Could you tell me...` = 比 Can you 更礼貌。常见错误：\n• \"Could you **told** me\" → could 后原形\n• \"Could you to tell me\" → 情态动词后直接原形",
      "`today's` = 今天的，名词所有格表时间。常见错误：\n• \"today exchange rate\" → 缺 's\n• \"todays\" → 所有格要加撇号",
      "`exchange rate` = 汇率。"
    ],
    distractors: [["Can you tell me","Could you told me","Could you to tell me"],["today","today date","the today's"],["exchange rates?","the exchange rate?","exchange rate now?"]]
  },
  {
    sentence: "How much would it cost to send this to China?",
    cid: "66658ed3",
    translation: "把这个寄到中国要多少钱？",
    chunks: ["How much would", "it cost", "to send this to China?"],
    hints: ["多少钱会", "它花费", "寄这个到中国"],
    grammar: [
      {role:'疑问句',color:'#e74c7a',phonetic:['/haʊ/','/mʌtʃ/','/wʊd/'],pos:'how much would',meaning:'多少钱会'},
      {role:'主谓',color:'#3358e0',phonetic:['/ɪt/','/kɔːst/'],pos:'情态动词+原形',meaning:'它花费'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/tə/','/send/','/ðɪs/','/tə/','/ˈtʃaɪnə/'],pos:'to do 不定式',meaning:'寄这个到中国'}
    ],
    explanations: [
      "邮局寄件问价。`How much would it cost to...` = ……要花多少钱。常见错误：\n• \"How many would\" → 钱用 how much\n• \"What would it cost\" → 也可以，但 how much 最常用",
      "`it cost` — would 后用动词原形 cost（过去式也是 cost）。",
      "`to send this to China` — send sth to + 地点。常见错误：\n• \"send this **for** China\" → 搭配 send to\n• \"to sent\" → to 后原形"
    ],
    distractors: [["How much will","How many would","What would"],["it costs","it to cost","it costing"],["for sending this to China?","to send these to China?","to sent this to China?"]]
  },
  {
    sentence: "I'd like to get a haircut, please.",
    cid: "8094f354",
    translation: "我想理发。",
    chunks: ["I'd like to get", "a haircut,", "please."],
    hints: ["我想", "理个发", "谢谢"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪd/','/laɪk/','/tə/','/ɡet/'],pos:'would like to',meaning:'我想做'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈherkʌt/'],pos:'名词',meaning:'理发'},
      {role:'礼貌词',color:'#7c5cbf',phonetic:['/pliːz/'],pos:'语气词',meaning:'谢谢'}
    ],
    explanations: [
      "理发店进门第一句。`get a haircut` = 理发。常见错误：\n• \"get **haircut**\" → 漏 a\n• \"I'd like **cutting**\" → would like to + 原形\n• \"cut my hair\" → 也可以，但 get a haircut 是地道说法",
      "美发店常见对话：How would you like it?（想怎么剪？）/ Just a trim, please.（稍微修一下）"
    ],
    distractors: [["I like to get","I'd like get","I'd like to getting"],["a hair cut,","haircuts,","the haircut,"],["pleased.","please now."]]
  },
  {
    sentence: "Could you trim my beard a little?",
    cid: "4eb6f313",
    translation: "你能帮我把胡子修短一点吗？",
    chunks: ["Could you trim", "my beard", "a little?"],
    hints: ["你能修剪", "我的胡子", "一点点"],
    grammar: [
      {role:'委婉请求',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/trɪm/'],pos:'could 请求句',meaning:'你能修剪'},
      {role:'宾语',color:'#3358e0',phonetic:['/maɪ/','/bɪrd/'],pos:'名词',meaning:'我的胡子'},
      {role:'程度状语',color:'#7c5cbf',phonetic:['/ə/','/ˈlɪtl/'],pos:'短语',meaning:'一点点'}
    ],
    explanations: [
      "`trim` = 修剪（不是全剃）。常见错误：\n• \"Could you **trimmed**\" → could 后原形\n• \"cut off my beard\" → 那是全剃掉，修短用 trim",
      "`a little` = 一点点。常见错误：\n• \"a little **bit**\" → 也可说 a little bit，但 a little 已够\n• 注意 a little 修饰不可数"
    ],
    distractors: [["Can you trim","Could you trimmed","Could you to trim"],["my beards","mine beard","the beard"],["little?","a bit little?","a little now?"]]
  },
  {
    sentence: "Could you take a little off the top?",
    cid: "0c594885",
    translation: "能把头顶稍微剪短点吗？",
    chunks: ["Could you take", "a little off", "the top?"],
    hints: ["你能去掉", "一点点", "头顶的头发"],
    grammar: [
      {role:'委婉请求',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/teɪk/'],pos:'could 请求句',meaning:'你能去掉'},
      {role:'数量短语',color:'#3358e0',phonetic:['/ə/','/ˈlɪtl/','/ɔːf/'],pos:'短语',meaning:'一点点'},
      {role:'宾语',color:'#7c5cbf',phonetic:['/ðə/','/tɑːp/'],pos:'名词',meaning:'头顶'}
    ],
    explanations: [
      "理发店高频句。`take a little off the top` = 头顶剪短一点。常见错误：\n• \"take a little **of** the top\" → 固定 off the top\n• \"take off the top\" → 少了 a little 程度",
      "理发店其他说法：Make it shorter on the sides.（两侧短一点）"
    ],
    distractors: [["Can you take","Could you takes","Could you to take"],["a little of","a lot off","little off"],["top?","the tops?","a top?"]]
  },
  {
    sentence: "I go to the gym twice a week.",
    cid: "6ea7ddb2",
    translation: "我每周去两次健身房。",
    chunks: ["I go to", "the gym", "twice a week."],
    hints: ["我去", "健身房", "每周两次"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/ɡoʊ/','/tə/'],pos:'一般现在时',meaning:'我去'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/dʒɪm/'],pos:'名词',meaning:'健身房'},
      {role:'频度状语',color:'#7c5cbf',phonetic:['/twaɪs/','/ə/','/wiːk/'],pos:'频度短语',meaning:'每周两次'}
    ],
    explanations: [
      "表达频率。`twice a week` = 每周两次（once 一次 / twice 两次 / three times 三次）。常见错误：\n• \"two times a week\" → 也可以但 twice 更地道\n• \"twice every week\" → a week 更常用",
      "`go to the gym` — 固定搭配，gym 前要 the。常见错误：\n• \"go to gym\" → 漏 the"
    ],
    distractors: [["I going to","I goes to","I go at"],["gym","a gym","the gyms"],["twice every week.","two times a week.","twice in a week."]]
  },
  {
    sentence: "I'm really out of shape these days.",
    cid: "b9a6bed9",
    translation: "我最近身体状况真的很差。",
    chunks: ["I'm really", "out of shape", "these days."],
    hints: ["我真的很", "身体走样/状态差", "最近"],
    grammar: [
      {role:'主系表',color:'#e74c7a',phonetic:['/aɪm/','/ˈriːəli/'],pos:'be + 表语',meaning:'我真的很'},
      {role:'表语',color:'#3358e0',phonetic:['/aʊt/','/əv/','/ʃeɪp/'],pos:'固定短语',meaning:'身材走样/状态差'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ðiːz/','/deɪz/'],pos:'短语',meaning:'最近'}
    ],
    explanations: [
      "`out of shape` = 身材走样/体能差，反义 in shape。常见错误：\n• \"out of **the** shape\" → 固定短语不加 the\n• \"my shape is bad\" → 中式，直接用 out of shape",
      "`these days` = 最近/这些天，常配现在时或现在完成。"
    ],
    distractors: [["I really","I'm real","I'm very much"],["out of the shape","out of shapes","out in shape"],["this days.","those day.","these day."]]
  },
  {
    sentence: "I'd like to send this package by air mail.",
    cid: "3270501d",
    translation: "我想用航空邮件寄这个包裹。",
    chunks: ["I'd like to send", "this package", "by air mail."],
    hints: ["我想寄", "这个包裹", "用航空邮件"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪd/','/laɪk/','/tə/','/send/'],pos:'would like to',meaning:'我想寄'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðɪs/','/ˈpækɪdʒ/'],pos:'名词',meaning:'这个包裹'},
      {role:'方式状语',color:'#7c5cbf',phonetic:['/baɪ/','/er/','/meɪl/'],pos:'介词短语',meaning:'用航空邮件'}
    ],
    explanations: [
      "邮局寄件。`by air mail` = 航空邮件（相对 surface mail 平邮/海运）。常见错误：\n• \"send **to** air mail\" → 方式状语用 by\n• \"by the air mail\" → by + 方式名词不加 the",
      "寄件常用：How long will it take?（要多久？）"
    ],
    distractors: [["I like to send","I'd like sending","I'd like to sending"],["this packages","these package","a package"],["by the air mail.","on air mail.","for air mail."]]
  },
  {
    sentence: "What's the postage for a letter to Japan?",
    cid: "742e248f",
    translation: "寄一封信到日本的邮费是多少？",
    chunks: ["What's", "the postage for", "a letter to Japan?"],
    hints: ["什么是", "……的邮费", "一封寄到日本的信"],
    grammar: [
      {role:'疑问词',color:'#e74c7a',phonetic:['/wʌts/'],pos:'what is 缩写',meaning:'是多少'},
      {role:'主语',color:'#3358e0',phonetic:['/ðə/','/ˈpoʊstɪdʒ/','/fɔːr/'],pos:'名词短语',meaning:'……的邮费'},
      {role:'介词宾语',color:'#7c5cbf',phonetic:['/ə/','/ˈletər/','/tə/','/dʒəˈpæn/'],pos:'名词短语',meaning:'寄到日本的信'}
    ],
    explanations: [
      "`postage` = 邮费/邮资。常见错误：\n• \"How much is postage\" → 口语可说，What's the postage for... 更完整\n• \"postage of a letter\" → 表「寄给谁/到哪」用 for + to",
      "`a letter to Japan` = 寄到日本的信，介词 to 表方向。"
    ],
    distractors: [["How's","What are","What is it"],["the postages for","postage to","a postage for"],["a letters to Japan?","letter to Japan?","a letter for Japan?"]]
  },
  {
    sentence: "My car broke down on the highway.",
    cid: "0bdabc0d",
    translation: "我的车在高速公路上抛锚了。",
    chunks: ["My car", "broke down", "on the highway."],
    hints: ["我的车", "抛锚了", "在高速公路上"],
    grammar: [
      {role:'主语',color:'#e74c7a',phonetic:['/maɪ/','/kɑːr/'],pos:'名词',meaning:'我的车'},
      {role:'谓语(短语动词)',color:'#3358e0',phonetic:['/broʊk/','/daʊn/'],pos:'break down 过去式',meaning:'抛锚'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ɑːn/','/ðə/','/ˈhaɪweɪ/'],pos:'介词短语',meaning:'在高速公路上'}
    ],
    explanations: [
      "车辆故障。`break down` = 抛锚（机器/车），过去式 broke down。常见错误：\n• \"break **off**\" → 断开，抛锚用 break down\n• \"my car is break down\" → be 动词后要 broken down",
      "`on the highway` = 在高速上（美式 highway，英式 motorway）。"
    ],
    distractors: [["Mine car","My cars","The my car"],["breaks down","broke off","was broken"],["in the highway.","on highway.","at the highway."]]
  },
  {
    sentence: "Could you check the tire pressure for me?",
    cid: "69d57e53",
    translation: "你能帮我检查一下轮胎气压吗？",
    chunks: ["Could you check", "the tire pressure", "for me?"],
    hints: ["你能检查", "轮胎气压", "为我"],
    grammar: [
      {role:'委婉请求',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/tʃek/'],pos:'could 请求句',meaning:'你能检查'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈtaɪər/','/ˈpreʃər/'],pos:'名词短语',meaning:'轮胎气压'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/fɔːr/','/miː/'],pos:'介词短语',meaning:'为我'}
    ],
    explanations: [
      "加油站/修车店用语。`tire pressure` = 胎压（英式 tyre）。常见错误：\n• \"check the tire **press**\" → 气压是 pressure\n• \"check tire pressure\" → 特指时加 the",
      "`Could you... for me?` = 能帮我……吗？很礼貌。"
    ],
    distractors: [["Can you check","Could you checked","Could you to check"],["the tires pressure","a tire pressure","tire pressures"],["to me?","with me?","for I?"]]
  },
  {
    sentence: "The Wi-Fi keeps dropping in my room.",
    cid: "19c737bd",
    translation: "我房间的无线网络老是断。",
    chunks: ["The Wi-Fi", "keeps dropping", "in my room."],
    hints: ["无线网络", "老是断", "在我房间"],
    grammar: [
      {role:'主语',color:'#e74c7a',phonetic:['/ðə/','/ˈwaɪfaɪ/'],pos:'名词',meaning:'无线网络'},
      {role:'谓语',color:'#3358e0',phonetic:['/kiːps/','/ˈdrɑːpɪŋ/'],pos:'keep doing',meaning:'老是掉线'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ɪn/','/maɪ/','/ruːm/'],pos:'介词短语',meaning:'在我房间'}
    ],
    explanations: [
      "酒店/租房网络抱怨。`keep doing` = 一直/老是做。常见错误：\n• \"keeps **to drop**\" → keep 接 doing\n• \"the Wi-Fi is drop\" → 现在进行时是 is dropping",
      "`drop` = 掉线（信号中断）。同义：cut out。"
    ],
    distractors: [["Wi-Fi","The Wi-Fis","A Wi-Fi"],["keep dropping","keeps to drop","keeps dropped"],["in my rooms.","at my room.","in mine room."]]
  },
  {
    sentence: "Could I borrow your charger for a sec?",
    cid: "b4dc4363",
    translation: "我能借用一下你的充电器吗？",
    chunks: ["Could I borrow", "your charger", "for a sec?"],
    hints: ["我能借用", "你的充电器", "一下下"],
    grammar: [
      {role:'委婉请求',color:'#e74c7a',phonetic:['/kʊd/','/aɪ/','/ˈbɑːroʊ/'],pos:'could 请求句',meaning:'我能借用'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/ˈtʃɑːrdʒər/'],pos:'名词',meaning:'你的充电器'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/fɔːr/','/ə/','/sek/'],pos:'短语',meaning:'一小会儿'}
    ],
    explanations: [
      "`borrow` = 借入（别人给你），`lend` = 借出（你给别人）。常见错误：\n• \"Could I **lend** your charger\" → 借入用 borrow\n• \"borrow your charger **to** me\" → 语序错",
      "`for a sec` = for a second 口语缩略，表短暂借用。"
    ],
    distractors: [["Can I borrow","Could I borrowed","Could me borrow"],["your charges","you charger","the chargers"],["for a seconds?","in a sec?","for sec?"]]
  },
  {
    sentence: "My phone is running out of battery.",
    cid: "5ae33cc0",
    translation: "我的手机快没电了。",
    chunks: ["My phone", "is running out of", "battery."],
    hints: ["我的手机", "快用完", "电量"],
    grammar: [
      {role:'主语',color:'#e74c7a',phonetic:['/maɪ/','/foʊn/'],pos:'名词',meaning:'我的手机'},
      {role:'谓语',color:'#3358e0',phonetic:['/ɪz/','/ˈrʌnɪŋ/','/aʊt/','/əv/'],pos:'run out of 进行时',meaning:'快耗尽'},
      {role:'宾语',color:'#7c5cbf',phonetic:['/ˈbætəri/'],pos:'名词',meaning:'电量'}
    ],
    explanations: [
      "`run out of` = 用完/耗尽。常见错误：\n• \"is running out **off**\" → 是 out of\n• \"my phone is out of battery\" → 也可，running out of 表「正在耗尽」",
      "口语同义：My phone is dying. / It's almost dead."
    ],
    distractors: [["Mine phone","My phones","The phone my"],["is running out","are running out of","is run out of"],["the battery.","batteries.","a battery."]]
  },
  {
    sentence: "Have you seen the latest movie yet?",
    cid: "48a08dbe",
    translation: "你看过那部最新的电影了吗？",
    chunks: ["Have you seen", "the latest movie", "yet?"],
    hints: ["你看过", "最新的那部电影", "了吗"],
    grammar: [
      {role:'现在完成疑问',color:'#e74c7a',phonetic:['/hæv/','/juː/','/siːn/'],pos:'have done 疑问',meaning:'你看过……吗'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈleɪtɪst/','/ˈmuːvi/'],pos:'名词短语',meaning:'最新电影'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/jet/'],pos:'副词',meaning:'已经(疑问句)'}
    ],
    explanations: [
      "`Have you seen...?` 现在完成表「到现在为止看过吗」。常见错误：\n• \"Did you seen\" → did 后原形 see\n• \"Have you saw\" → 完成时用过去分词 seen",
      "`yet` 用于疑问/否定句尾。`latest` = 最新的（late 的最高级），勿混 lasted（持续）。"
    ],
    distractors: [["Did you seen","Have you saw","Do you seen"],["the latest movies","a latest movie","latest movie"],["already?","now?","yet now?"]]
  },
  {
    sentence: "The book is way better than the movie.",
    cid: "f265bd24",
    translation: "这本书比电影好看多了。",
    chunks: ["The book is", "way better than", "the movie."],
    hints: ["这本书是", "远远好于", "那部电影"],
    grammar: [
      {role:'主系表',color:'#e74c7a',phonetic:['/ðə/','/bʊk/','/ɪz/'],pos:'主系表',meaning:'这本书是'},
      {role:'比较级',color:'#3358e0',phonetic:['/weɪ/','/ˈbetər/','/ðæn/'],pos:'比较级+than',meaning:'远好于'},
      {role:'比较对象',color:'#7c5cbf',phonetic:['/ðə/','/ˈmuːvi/'],pos:'名词',meaning:'那部电影'}
    ],
    explanations: [
      "`way better` = 好得多（way 口语作程度副词 = much/far）。常见错误：\n• \"more better\" → better 已是比较级不加 more\n• \"way more better\" → 双重比较",
      "`than` 引出比较对象。常见错误：\n• \"better **then**\" → 比较用 than（then 是然后）"
    ],
    distractors: [["A book is","The book are","Books is"],["much more better than","way better as","more better than"],["a movie.","movies.","the movies."]]
  },
  {
    sentence: "I can't put this novel down.",
    cid: "574f6eb0",
    translation: "这本小说让我爱不释手。",
    chunks: ["I can't put", "this novel", "down."],
    hints: ["我无法放下", "这本小说", "下来"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/kænt/','/pʊt/'],pos:"can't + 动词",meaning:'我不能放下'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðɪs/','/ˈnɑːvl/'],pos:'名词',meaning:'这本小说'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'小品词',meaning:'下(来)'}
    ],
    explanations: [
      "`can't put sth down` = 放不下手/爱不释手（书太好看了）。常见错误：\n• \"can't put down this novel\" → 也可以，但 put + 宾语 + down 是常见语序\n• \"can't put it down\" 更口语",
      "`novel` = 长篇小说；`story` = 故事。"
    ],
    distractors: [["I can't putting","I don't put","I can't to put"],["this novels","these novel","a novel"],["up.","down now.","to down."]]
  },
  {
    sentence: "Could you keep the noise down?",
    cid: "0ab455be",
    translation: "你能小声一点吗？",
    chunks: ["Could you keep", "the noise", "down?"],
    hints: ["你能保持", "噪音", "低一些"],
    grammar: [
      {role:'委婉请求',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/kiːp/'],pos:'could 请求句',meaning:'你能让……保持'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/nɔɪz/'],pos:'名词',meaning:'噪音'},
      {role:'补语',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词',meaning:'低下来'}
    ],
    explanations: [
      "邻里/室友提醒。`keep it down` = 小声点。常见错误：\n• \"keep **down** the noise\" → 也可，但 keep the noise down 常见\n• \"turn the noise down\" → 噪音不是音量旋钮，keep down 更贴切",
      "更直接的祈使：Keep it down, please!"
    ],
    distractors: [["Can you keep","Could you keeps","Could you to keep"],["a noise","noises","the noisy"],["down? ok","to down?","downed?"]]
  },
  {
    sentence: "I'll take out the trash after dinner.",
    cid: "3d052989",
    translation: "晚饭后我会把垃圾拿出去。",
    chunks: ["I'll take out", "the trash", "after dinner."],
    hints: ["我会拿出", "垃圾", "晚饭后"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪl/','/teɪk/','/aʊt/'],pos:'一般将来时',meaning:'我会拿出去'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/træʃ/'],pos:'名词(不可数)',meaning:'垃圾'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ˈæftər/','/ˈdɪnər/'],pos:'介词短语',meaning:'晚饭后'}
    ],
    explanations: [
      "家务用语。`take out the trash` = 倒垃圾（英式 take out the rubbish）。常见错误：\n• \"take the trash **off**\" → 搭配 take out\n• \"throw the trash\" → 扔进垃圾桶是 throw away；拿到屋外是 take out",
      "`trash` 不可数，不加 s。"
    ],
    distractors: [["I take out","I'll take off","I'll taking out"],["the trashes","a trash","trash"],["after the dinner.","before dinner.","after dinner now."]]
  },
  {
    sentence: "I'm really stressed out about the exam.",
    cid: "0c31e53d",
    translation: "我对考试真的压力很大。",
    chunks: ["I'm really", "stressed out", "about the exam."],
    hints: ["我真的很", "压力山大", "关于考试"],
    grammar: [
      {role:'主系表',color:'#e74c7a',phonetic:['/aɪm/','/ˈriːəli/'],pos:'be + 表语',meaning:'我真的很'},
      {role:'表语',color:'#3358e0',phonetic:['/strest/','/aʊt/'],pos:'固定短语',meaning:'压力很大'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/əˈbaʊt/','/ðə/','/ɪɡˈzæm/'],pos:'介词短语',meaning:'关于考试'}
    ],
    explanations: [
      "`stressed out` = 压力极大的。常见错误：\n• \"stress out\" → 作表语要 be stressed out\n• \"I'm stress\" → stress 是名词/动词，形容词是 stressed",
      "`about + 事由`。同义：I'm under a lot of pressure."
    ],
    distractors: [["I really","I'm real","I very am"],["stress out","stressed of","stressing out"],["about exam.","to the exam.","about the exams."]]
  },
  {
    sentence: "Cheer up, it's not the end of the world.",
    cid: "c66af01f",
    translation: "打起精神来，又不是世界末日。",
    chunks: ["Cheer up,", "it's not", "the end of the world."],
    hints: ["振作起来", "这不是", "世界末日"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/tʃɪr/','/ʌp/'],pos:'祈使句',meaning:'打起精神'},
      {role:'主系表(否定)',color:'#3358e0',phonetic:['/ɪts/','/nɑːt/'],pos:"it's not",meaning:'这不是'},
      {role:'表语',color:'#7c5cbf',phonetic:['/ðə/','/end/','/əv/','/ðə/','/wɜːrld/'],pos:'名词短语',meaning:'世界末日'}
    ],
    explanations: [
      "安慰朋友。`Cheer up!` = 振作点！常见错误：\n• \"Cheer up you\" → 祈使不加宾语\n• \"Cheer!\" → 加油欢呼，安慰用 cheer up",
      "`It's not the end of the world.` 固定表达 = 没那么糟。"
    ],
    distractors: [["Cheering up,","Cheer up yourself,","Keep cheer up,"],["It isn't","It not is","It's no"],["an end of the world.","the end of world.","end of the world."]]
  },
  {
    sentence: "I'm worried about the job interview tomorrow.",
    cid: "edc8aa29",
    translation: "我很担心明天的求职面试。",
    chunks: ["I'm worried about", "the job interview", "tomorrow."],
    hints: ["我担心", "求职面试", "明天"],
    grammar: [
      {role:'主系表',color:'#e74c7a',phonetic:['/aɪm/','/ˈwɜːrid/','/əˈbaʊt/'],pos:'be worried about',meaning:'我担心'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/dʒɑːb/','/ˈɪntərvjuː/'],pos:'名词短语',meaning:'求职面试'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/təˈmɑːroʊ/'],pos:'副词',meaning:'明天'}
    ],
    explanations: [
      "`be worried about` = 担心……。常见错误：\n• \"I worried about\" → 缺 be 动词（worried 是形容词/过去分词）\n• \"worry about\" 动词短语：I worry about... 也可",
      "`job interview` = 求职面试。"
    ],
    distractors: [["I worry about","I'm worrying of","I'm worried to"],["a job interview","the job interviews","job's interview"],["in tomorrow.","tomorrow now.","the tomorrow."]]
  },
  {
    sentence: "Don't worry, everything will work out fine.",
    cid: "b6a7287e",
    translation: "别担心，一切都会好起来的。",
    chunks: ["Don't worry,", "everything will", "work out fine."],
    hints: ["别担心", "一切都会", "顺利解决"],
    grammar: [
      {role:'祈使句(否定)',color:'#e74c7a',phonetic:['/doʊnt/','/ˈwɜːri/'],pos:"don't + 动词",meaning:'别担心'},
      {role:'主谓',color:'#3358e0',phonetic:['/ˈevriθɪŋ/','/wɪl/'],pos:'不定代词+will',meaning:'一切都会'},
      {role:'谓语',color:'#7c5cbf',phonetic:['/wɜːrk/','/aʊt/','/faɪn/'],pos:'短语动词',meaning:'顺利解决'}
    ],
    explanations: [
      "安慰他人。`Don't worry` = 别担心。常见错误：\n• \"Not worry\" → 祈使否定用 Don't\n• \"Don't worrying\" → 祈使后原形",
      "`work out` = 解决/进展顺利。常见错误：\n• \"work out **well**\" → 也可，fine/well 皆可\n• \"work it out\" 带宾语时放中间"
    ],
    distractors: [["Not worry,","Don't worrying,","Doesn't worry,"],["everything is","anything will","all will"],["works out fine.","working out fine.","work fine out."]]
  },
  {
    sentence: "I'm looking forward to seeing you again.",
    cid: "6159c055",
    translation: "我期待再次见到你。",
    chunks: ["I'm looking forward to", "seeing you", "again."],
    hints: ["我期待着", "见到你", "再次"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪm/','/ˈlʊkɪŋ/','/ˈfɔːrwərd/','/tə/'],pos:'look forward to',meaning:'我期待着'},
      {role:'动名词宾语',color:'#3358e0',phonetic:['/ˈsiːɪŋ/','/juː/'],pos:'动名词短语',meaning:'见到你'},
      {role:'频度副词',color:'#7c5cbf',phonetic:['/əˈɡen/'],pos:'副词',meaning:'再次'}
    ],
    explanations: [
      "`look forward to` = 期待，**to 是介词**后接动名词。常见错误：\n• \"look forward to **see** you\" → to 后要 doing\n• \"looking forward to see\" → 同一错误\n• 漏 be：I look forward to 也可（正式）",
      "`again` = 再一次。"
    ],
    distractors: [["I look forward to","I'm looking forward","I'm looking forward for"],["to see you","seeing yours","seen you"],["again now.","one again.","again soon."]]
  },
  {
    sentence: "I'm supposed to meet him at six.",
    cid: "141237b8",
    translation: "我六点应该和他见面。",
    chunks: ["I'm supposed to", "meet him", "at six."],
    hints: ["我按约定要", "见他", "在六点"],
    grammar: [
      {role:'主系表',color:'#e74c7a',phonetic:['/aɪm/','/səˈpoʊzd/','/tə/'],pos:'be supposed to',meaning:'按约定应该'},
      {role:'谓语',color:'#3358e0',phonetic:['/miːt/','/hɪm/'],pos:'动词+宾语',meaning:'见他'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/æt/','/sɪks/'],pos:'介词短语',meaning:'在六点'}
    ],
    explanations: [
      "`be supposed to` = 按计划/规定应该。常见错误：\n• \"suppose to\" → 缺 be 且 supposed 不能省 d\n• \"I'm suppose to\" → 漏 d",
      "`at six` — 钟点前用 at。常见错误：\n• \"in six\" → 钟点用 at（in 表在一段时间之后）"
    ],
    distractors: [["I suppose to","I'm suppose to","I'm supposed"],["meets him","meet he","to meeting him"],["in six.","at six o'clock now.","on six."]]
  },
  {
    sentence: "What if it rains on the wedding day?",
    cid: "96308679",
    translation: "万一下雨那天结婚怎么办？",
    chunks: ["What if", "it rains", "on the wedding day?"],
    hints: ["万一", "天下雨", "在婚礼那天"],
    grammar: [
      {role:'疑问短语',color:'#e74c7a',phonetic:['/wʌt/','/ɪf/'],pos:'what if',meaning:'万一……怎么办'},
      {role:'从句主谓',color:'#3358e0',phonetic:['/ɪt/','/reɪnz/'],pos:'一般现在时(表将来)',meaning:'天下雨'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɑːn/','/ðə/','/ˈwedɪŋ/','/deɪ/'],pos:'介词短语',meaning:'在婚礼那天'}
    ],
    explanations: [
      "`What if...?` = 万一……怎么办？假设建议。常见错误：\n• \"What about if\" → 直接用 what if\n• \"If what\" → 语序错",
      "条件句用一般现在时表将来：What if it **rains**（不是 will rain）。"
    ],
    distractors: [["How if","What about if","Whatever if"],["it will rain","it rain","it rained now"],["on wedding day?","in the wedding day?","at the wedding day?"]]
  },
  {
    sentence: "I bet he's already left for work.",
    cid: "03cbee2b",
    translation: "我打赌他已经去上班了。",
    chunks: ["I bet", "he's already left", "for work."],
    hints: ["我敢打赌", "他已经离开了", "去上班"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/bet/'],pos:'I bet',meaning:'我敢打赌'},
      {role:'现在完成',color:'#3358e0',phonetic:['/hiːz/','/ɔːlˈredi/','/left/'],pos:'have done',meaning:'他已经离开'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/fɔːr/','/wɜːrk/'],pos:'介词短语',meaning:'去上班'}
    ],
    explanations: [
      "`I bet` = 我敢打赌/我肯定（口语）。常见错误：\n• \"I bet **on**\" → 表断言不加 on\n• \"I'm bet\" → bet 是动词不加 be",
      "`leave for + 目的地` = 动身去……。常见错误：\n• \"leave to work\" → 搭配 leave for\n• \"left to work\" → 离开去某地用 for"
    ],
    distractors: [["I'm bet","I bet on","I better"],["he has already leave","he already left","he's left already for"],["to work.","work.","for the work."]]
  },
  {
    sentence: "No matter what happens, I'll be here for you.",
    cid: "79d9ff2f",
    translation: "无论发生什么，我都会在你身边。",
    chunks: ["No matter what happens,", "I'll be here", "for you."],
    hints: ["无论发生什么", "我都会在这里", "为你"],
    grammar: [
      {role:'让步状语从句',color:'#e74c7a',phonetic:['/noʊ/','/ˈmætər/','/wʌt/','/ˈhæpənz/'],pos:'no matter + 疑问词',meaning:'无论发生什么'},
      {role:'主谓',color:'#3358e0',phonetic:['/aɪl/','/biː/','/hɪr/'],pos:'将来时',meaning:'我会在这里'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/fɔːr/','/juː/'],pos:'介词短语',meaning:'为你'}
    ],
    explanations: [
      "`No matter what...` = 无论什么……（让步从句）。常见错误：\n• \"No matter **whatever**\" → no matter what 或 whatever 二选一\n• \"No matter what will happen\" → 从句用一般现在时 happens",
      "`be here for you` = 陪着你/支持你。"
    ],
    distractors: [["No matter whatever happens,","Whatever no matter happens,","No matter what happen,"],["I be here","I'll be there","I'll am here"],["with you.","for yours.","to you."]]
  },
  {
    sentence: "There's no point in waiting any longer.",
    cid: "725fe013",
    translation: "再等下去没有意义了。",
    chunks: ["There's no point in", "waiting", "any longer."],
    hints: ["没有意义", "等待", "再继续"],
    grammar: [
      {role:'存在句',color:'#e74c7a',phonetic:['/ðerz/','/noʊ/','/pɔɪnt/','/ɪn/'],pos:"there's no point in",meaning:'……没有意义'},
      {role:'动名词',color:'#3358e0',phonetic:['/ˈweɪtɪŋ/'],pos:'动名词',meaning:'等待'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ˈeni/','/ˈlɔːŋɡər/'],pos:'短语',meaning:'再继续下去'}
    ],
    explanations: [
      "`There's no point in doing` = 做……没意义。常见错误：\n• \"no point to wait\" → in 后接动名词\n• \"It's no point\" → 固定 There's no point",
      "`any longer` = 再（用于否定）。同义 no more。"
    ],
    distractors: [["It's no point in","There's no point to","There're no point in"],["to wait","waited","wait"],["any more longer.","no longer.","any long."]]
  },
  {
    sentence: "It's worth trying one more time.",
    cid: "59f78fc3",
    translation: "值得再试一次。",
    chunks: ["It's worth", "trying", "one more time."],
    hints: ["这是值得的", "尝试", "再一次"],
    grammar: [
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪts/','/wɜːrθ/'],pos:'be worth doing',meaning:'值得'},
      {role:'动名词',color:'#3358e0',phonetic:['/ˈtraɪɪŋ/'],pos:'动名词(主语为it)',meaning:'尝试'},
      {role:'状语',color:'#7c5cbf',phonetic:['/wʌn/','/mɔːr/','/taɪm/'],pos:'短语',meaning:'再一次'}
    ],
    explanations: [
      "`be worth doing` = 值得做，主动形式表被动。常见错误：\n• \"worth to try\" → worth 后接动名词\n• \"worth **of** trying\" → 多 of\n• \"It's worthy trying\" → worth/worthy 不同搭配",
      "`one more time` = 再一次。"
    ],
    distractors: [["It's worth to","It's worthy","It worth"],["to try","tried","try"],["one time more.","one more times.","more one time."]]
  },
  {
    sentence: "Sorry I'm late, the traffic was terrible.",
    cid: "f22bd74d",
    translation: "抱歉我迟到了，路上堵得厉害。",
    chunks: ["Sorry I'm late,", "the traffic", "was terrible."],
    hints: ["抱歉我迟到了", "交通", "非常糟糕"],
    grammar: [
      {role:'道歉',color:'#e74c7a',phonetic:['/ˈsɑːri/','/aɪm/','/leɪt/'],pos:'be late',meaning:'抱歉我迟到'},
      {role:'主语',color:'#3358e0',phonetic:['/ðə/','/ˈtræfɪk/'],pos:'名词(不可数)',meaning:'交通'},
      {role:'系表',color:'#7c5cbf',phonetic:['/wʌz/','/ˈterəbl/'],pos:'过去时',meaning:'非常糟糕'}
    ],
    explanations: [
      "迟到解释。`traffic` 不可数。常见错误：\n• \"the traffics\" → traffic 不可数\n• \"I late\" → 缺 be 动词，要说 I'm late",
      "`was terrible` = 糟透了。同义：awful / a nightmare。"
    ],
    distractors: [["Sorry I late,","Sorry for I'm late,","Sorry I'm lately,"],["traffics","a traffic","the traffics"],["is terrible.","was terribly.","was a terrible."]]
  },
  {
    sentence: "I'll be there in about ten minutes.",
    cid: "8eea26b2",
    translation: "我大约十分钟后到。",
    chunks: ["I'll be there", "in about", "ten minutes."],
    hints: ["我会到那里", "在大约", "十分钟后"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪl/','/biː/','/ðer/'],pos:'将来时',meaning:'我会到那儿'},
      {role:'介词',color:'#3358e0',phonetic:['/ɪn/','/əˈbaʊt/'],pos:'in + 时段',meaning:'在大约(之后)'},
      {role:'时间名词',color:'#7c5cbf',phonetic:['/ten/','/ˈmɪnɪts/'],pos:'名词短语',meaning:'十分钟'}
    ],
    explanations: [
      "`in + 一段时间` = 多久之后（将来时）。常见错误：\n• \"after ten minutes\" → 将来时用 in，after 多接时间点/过去\n• \"in ten minute\" → 复数 minutes",
      "`about` = 大约。同义 around / roughly。"
    ],
    distractors: [["I'll there be","I be there","I'm going there"],["after about","in around of","about in"],["ten minute.","a ten minutes.","the ten minutes."]]
  },
  {
    sentence: "Would you like to grab dinner sometime?",
    cid: "9352bdcd",
    translation: "改天一起吃个晚饭怎么样？",
    chunks: ["Would you like to", "grab dinner", "sometime?"],
    hints: ["你愿意", "随便吃点晚饭", "改天"],
    grammar: [
      {role:'委婉邀约',color:'#e74c7a',phonetic:['/wʊd/','/juː/','/laɪk/','/tə/'],pos:'would you like to',meaning:'你愿意……吗'},
      {role:'谓语',color:'#3358e0',phonetic:['/ɡræb/','/ˈdɪnər/'],pos:'grab + 餐',meaning:'随便吃晚饭'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/ˈsʌmtaɪm/'],pos:'副词',meaning:'改天/某个时候'}
    ],
    explanations: [
      "`Would you like to...?` 比 Do you want to 更礼貌的邀约。常见错误：\n• \"Would you like dinner?\" → 也可以但少了动作\n• \"Do you like to grab dinner\" → like 表喜好不是邀约",
      "`grab` = 匆匆吃点/随便吃。`sometime` = 某时（一个词），`some time` = 一些时间。"
    ],
    distractors: [["Do you like to","Would you to","Could you like to"],["grabbing dinner","grab a dinner","get dinner over"],["sometimes?","some time?","anytime soon?"]]
  },
  {
    sentence: "Let's catch up over coffee this weekend.",
    cid: "e4eb1b2b",
    translation: "这周末我们喝咖啡聊聊近况吧。",
    chunks: ["Let's catch up", "over coffee", "this weekend."],
    hints: ["我们聊聊近况吧", "边喝咖啡", "这周末"],
    grammar: [
      {role:'祈使提议',color:'#e74c7a',phonetic:['/lets/','/kætʃ/','/ʌp/'],pos:'let\'s + 动词',meaning:'我们……吧'},
      {role:'方式状语',color:'#3358e0',phonetic:['/ˈoʊvər/','/ˈkɔːfi/'],pos:'介词短语',meaning:'边喝咖啡'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ðɪs/','/ˌwiːkˈend/'],pos:'名词短语',meaning:'这周末'}
    ],
    explanations: [
      "`catch up` = 叙旧/聊近况。常见错误：\n• \"catch up **with each other**\" → 也可，简说 catch up\n• \"catch **on**\" → 那是赶上潮流",
      "`over coffee` = 喝着咖啡（时）。`this weekend` 前不加介词。"
    ],
    distractors: [["Let us catch up","Let's catching up","Let we catch up"],["on coffee","with coffee","for a coffee over"],["in this weekend.","at weekend.","this weekends."]]
  },
  {
    sentence: "Could you turn the music down a bit?",
    cid: "5b616a39",
    translation: "你能把音乐声调小一点吗？",
    chunks: ["Could you turn", "the music", "down a bit?"],
    hints: ["你能调", "音乐", "小一点"],
    grammar: [
      {role:'委婉请求',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/tɜːrn/'],pos:'could 请求句',meaning:'你能调'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈmjuːzɪk/'],pos:'名词(不可数)',meaning:'音乐'},
      {role:'补语',color:'#7c5cbf',phonetic:['/daʊn/','/ə/','/bɪt/'],pos:'短语',meaning:'调低一点'}
    ],
    explanations: [
      "`turn down` = 调小（音量），`turn up` = 调大。常见错误：\n• \"turn **off**\" → 那是关掉\n• \"turn down the music\" 或 turn the music down 都行",
      "`a bit` = 一点。"
    ],
    distractors: [["Can you turn","Could you turns","Could you to turn"],["a music","musics","the musics"],["down a bits?","up a bit?","a bit down?"]]
  },
  {
    sentence: "The laundry is almost dry now.",
    cid: "1ea989e8",
    translation: "洗的衣服现在差不多干了。",
    chunks: ["The laundry", "is almost dry", "now."],
    hints: ["洗好的衣物", "差不多干了", "现在"],
    grammar: [
      {role:'主语',color:'#e74c7a',phonetic:['/ðə/','/ˈlɔːndri/'],pos:'名词(不可数)',meaning:'洗好的衣物'},
      {role:'系表',color:'#3358e0',phonetic:['/ɪz/','/ˈɔːlmoʊst/','/draɪ/'],pos:'be + 形容词',meaning:'差不多干'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/naʊ/'],pos:'副词',meaning:'现在'}
    ],
    explanations: [
      "家务用语。`laundry` = 待洗/洗好的衣物，不可数。常见错误：\n• \"the laundries\" → 不可数\n• \"wash laundry\" → 常说 do the laundry",
      "`almost` = 差不多/几乎。"
    ],
    distractors: [["Laundry","A laundry","The laundries"],["is dry almost","almost is dry","is almost dried"],["yet.","right now.","now already."]]
  },
  {
    sentence: "Could you give me a hand with this box?",
    cid: "10dca05a",
    translation: "你能帮我搬一下这个箱子吗？",
    chunks: ["Could you give me", "a hand", "with this box?"],
    hints: ["你能给我", "帮个忙", "搬这个箱子"],
    grammar: [
      {role:'委婉请求',color:'#e74c7a',phonetic:['/kʊd/','/juː/','/ɡɪv/','/miː/'],pos:'give sb a hand',meaning:'你能帮我'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/hænd/'],pos:'固定搭配',meaning:'一个忙'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/wɪð/','/ðɪs/','/bɑːks/'],pos:'介词短语',meaning:'搬这个箱子'}
    ],
    explanations: [
      "`give sb a hand with sth` = 帮某人做某事。常见错误：\n• \"give me hand\" → 缺 a\n• \"give a hand to me with\" → 搭配混乱，give me a hand 已含宾语",
      "同义：help me with...（更直接）。"
    ],
    distractors: [["Can you give me","Could you give","Could you to give me"],["hands","a hands","the hand"],["to this box?","for this box?","with these box?"]]
  },
  {
    sentence: "Is there a bank around here?",
    cid: "551d0bc0",
    translation: "这附近有银行吗？",
    chunks: ["Is there", "a bank", "around here?"],
    hints: ["是否有", "一家银行", "在这附近"],
    grammar: [
      {role:'存在句疑问',color:'#e74c7a',phonetic:['/ɪz/','/ðer/'],pos:'is there',meaning:'有……吗'},
      {role:'主语',color:'#3358e0',phonetic:['/ə/','/bæŋk/'],pos:'名词短语',meaning:'一家银行'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/əˈraʊnd/','/hɪr/'],pos:'短语',meaning:'这附近'}
    ],
    explanations: [
      "问路找店。`Is there...?` = 有……吗？常见错误：\n• \"There is a bank?\" → 疑问句要倒装 Is there\n• \"Is there bank\" → 可数名词要 a",
      "`around here` = 这附近。同义：nearby / in this area。"
    ],
    distractors: [["Are there","There is","Does there"],["banks","the bank","one banks"],["near here?","around there?","in here?"]]
  },
  {
    sentence: "How do I get to the train station?",
    cid: "d7f8b9c8",
    translation: "去火车站怎么走？",
    chunks: ["How do I get to", "the train station?"],
    hints: ["我该怎么去", "火车站"],
    grammar: [
      {role:'疑问句',color:'#e74c7a',phonetic:['/haʊ/','/duː/','/aɪ/','/ɡet/','/tə/'],pos:'how do I get to',meaning:'我怎么去'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/treɪn/','/ˈsteɪʃn/'],pos:'名词短语',meaning:'火车站'}
    ],
    explanations: [
      "问路万能句。`How do I get to...?` = 去……怎么走？常见错误：\n• \"How can I get to\" → 也可，do 更口语\n• \"How to get to\" → 从句可用，独立问句不完整",
      "同义：Could you tell me the way to...?"
    ],
    distractors: [["How I get to","How do I go","What do I get to"],["the train stations?","a train station?","to the station train?"]]
  },
  {
    sentence: "I completely forgot about our appointment.",
    cid: "777f5c9d",
    translation: "我完全忘了我们的约会。",
    chunks: ["I completely forgot", "about our", "appointment."],
    hints: ["我完全忘了", "关于我们的", "约定"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/kəmˈpliːtli/','/fərˈɡɑːt/'],pos:'一般过去时',meaning:'我完全忘了'},
      {role:'介词',color:'#3358e0',phonetic:['/əˈbaʊt/','/aʊər/'],pos:'介词+限定词',meaning:'关于我们的'},
      {role:'宾语',color:'#7c5cbf',phonetic:['/əˈpɔɪntmənt/'],pos:'名词',meaning:'约定/约会'}
    ],
    explanations: [
      "`forget about` = 忘掉某事。常见错误：\n• \"forgot to about\" → 搭配混乱\n• \"I forget\" → 讲过去发生的忘记用 forgot",
      "`appointment` = 预约（看病/商务）；`date` = 约会（浪漫）。"
    ],
    distractors: [["I complete forgot","I completely forgetted","I'm completely forgot"],["to our","about hour","for our"],["appointments.","a appointment.","the appointment now."]]
  },
  {
    sentence: "Why don't you come over for dinner tonight?",
    cid: "ea7d8a4b",
    translation: "今晚你过来一起吃晚饭吧？",
    chunks: ["Why don't you", "come over", "for dinner tonight?"],
    hints: ["你何不", "过来", "今晚吃晚饭"],
    grammar: [
      {role:'建议句型',color:'#e74c7a',phonetic:['/waɪ/','/doʊnt/','/juː/'],pos:"why don't you",meaning:'你何不'},
      {role:'谓语',color:'#3358e0',phonetic:['/kʌm/','/ˈoʊvər/'],pos:'短语动词',meaning:'过来'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/fɔːr/','/ˈdɪnər/','/təˈnaɪt/'],pos:'介词短语',meaning:'今晚吃晚饭'}
    ],
    explanations: [
      "`Why don't you...?` = 建议/邀约。常见错误：\n• \"Why you don't\" → 疑问句助动词提前\n• \"Why not come over\" → 也可，省主语",
      "`come over` = 到（某人）家来。"
    ],
    distractors: [["Why you don't","Why don't to you","Why not you"],["come up","coming over","come on"],["for the dinner tonight?","tonight for dinner?","at tonight for dinner?"]]
  },
  {
    sentence: "Take your time, there's no rush.",
    cid: "1417566d",
    translation: "慢慢来，不用急。",
    chunks: ["Take your time,", "there's no", "rush."],
    hints: ["慢慢来", "没有", "急的必要"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/teɪk/','/jʊr/','/taɪm/'],pos:'祈使句',meaning:'慢慢来'},
      {role:'存在句',color:'#3358e0',phonetic:['/ðerz/','/noʊ/'],pos:"there's no",meaning:'没有'},
      {role:'名词',color:'#7c5cbf',phonetic:['/rʌʃ/'],pos:'名词',meaning:'匆忙的必要'}
    ],
    explanations: [
      "`Take your time` = 慢慢来/别着急。常见错误：\n• \"Take time\" → 少了 your，语义变「花时间」\n• \"Take your times\" → time 此处不可数",
      "`there's no rush` = 不赶时间。同义：No hurry."
    ],
    distractors: [["Take time,","Takes your time,","Take you time,"],["there's not","there're no","there no"],["rushing.","a rush.","hurry up."]]
  },
  {
    sentence: "My computer just froze again.",
    cid: "304eb970",
    translation: "我的电脑刚刚又死机了。",
    chunks: ["My computer", "just froze", "again."],
    hints: ["我的电脑", "刚刚死机", "又"],
    grammar: [
      {role:'主语',color:'#e74c7a',phonetic:['/maɪ/','/kəmˈpjuːtər/'],pos:'名词',meaning:'我的电脑'},
      {role:'谓语',color:'#3358e0',phonetic:['/dʒʌst/','/froʊz/'],pos:'freeze 过去式',meaning:'死机'},
      {role:'频度副词',color:'#7c5cbf',phonetic:['/əˈɡen/'],pos:'副词',meaning:'又'}
    ],
    explanations: [
      "电脑故障。`freeze` = 死机/卡住（画面不动），过去式 froze。常见错误：\n• \"freezed\" → freeze 不规则变化 froze\n• \"my computer is froze\" → 被动是 frozen",
      "`just` = 刚刚（与过去时连用）。口语同义：It crashed.（崩了）"
    ],
    distractors: [["Mine computer","My computers","Computer"],["just freezes","just frozen","just freeze now"],["again now.","one more.","again later."]]
  },
  {
    sentence: "You want some?",
    cid: "e520881b",
    translation: "你要来点吗？",
    chunks: ["You want","some?"],
    hints: ["你想要","一些"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/juː/','/wɑːnt/'],pos:'省略 Do 的口语问句',meaning:'你想要'},
      {role:'宾语',color:'#3358e0',phonetic:['/sʌm/'],pos:'不定代词',meaning:'一些'}
    ],
    explanations: [
      "口语里 `Do you want some?` 常省略句首的 Do，只靠语气表疑问。常见错误：\n• 用降调读成 \"You want some.\" → 变成陈述句（你要一些），问答语气完全变了\n• \"You want any?\" → 期待对方接受时用 some，any 多用于不确定的场合",
      "`some` 在提议/邀请里带「来一点吧」的期待。同义：Want some? / Would you like some?"
    ],
    distractors: [["You wants","You wanting","You want to"],["any?","anything?","some of?"]]
  },
  {
    sentence: "I got it here.",
    cid: "61133093",
    translation: "我这儿有。",
    chunks: ["I got it","here."],
    hints: ["我拿到了","在这儿"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/ɡɑːt/','/ɪt/'],pos:'一般过去时',meaning:'我拿到了'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/hɪr/'],pos:'副词',meaning:'在这儿'}
    ],
    explanations: [
      "`got` 是 get 的过去式，口语里常表「已经拿到/有了」。常见错误：\n• \"I get it here.\" → 一般现在时表习惯，说这一次要用 got\n• 升调读 \"I got it here?\" → 才成疑问句",
      "`here` 放句末表地点。同义：I have some here. / I already got one."
    ],
    distractors: [["I get it","I got them","I am got it"],["there.","in here.","here are."]]
  },
  {
    sentence: "Veggies are good.",
    cid: "7036eef2",
    translation: "蔬菜挺好的。",
    chunks: ["Veggies","are good."],
    hints: ["蔬菜","挺好的"],
    grammar: [
      {role:'主语',color:'#e74c7a',phonetic:['/ˈvedʒiz/'],pos:'名词（veggie 复数）',meaning:'蔬菜'},
      {role:'主系表',color:'#c87033',phonetic:['/ɑːr/','/ɡʊd/'],pos:'系动词+形容词',meaning:'很好'}
    ],
    explanations: [
      "`veggies` 是 vegetables 的口语简称，日常对话更常用。常见错误：\n• \"Veggies is good\" → 复数主语要用 are\n• \"Veggie are good\" → 复数别忘加 s",
      "`be good` 表「有好处/不错」。常见错误：\n• \"are well\" → well 指身体好，说食物好要用 good"
    ],
    distractors: [["Veggie","Veggies's","The veggies"],["is good.","are well.","are good at."]]
  },
  {
    sentence: "They have nutrients.",
    cid: "2836375b",
    translation: "它们有营养。",
    chunks: ["They have","nutrients."],
    hints: ["它们含有","营养"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/ðeɪ/','/hæv/'],pos:'一般现在时',meaning:'它们含有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈnuːtriənts/'],pos:'名词复数',meaning:'营养'}
    ],
    explanations: [
      "`have` 在这里表「含有」。常见错误：\n• \"They has\" → 第三人称复数用 have\n• \"They are have\" → be 和 have 不能叠用",
      "`nutrient` 是可数名词，泛指营养时用复数。常见错误：\n• \"They have nutrient\" → 泛指要复数才自然"
    ],
    distractors: [["They has","They having","Them have"],["nutrient.","nutritions.","a nutrients."]]
  },
  {
    sentence: "What did you eat?",
    cid: "3fcc4d24",
    translation: "你吃了什么？",
    chunks: ["What did","you eat?"],
    hints: ["什么（过去）","你吃了"],
    grammar: [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/wʌt/','/dɪd/'],pos:'疑问词+did',meaning:'什么'},
      {role:'主语+谓语',color:'#e74c7a',phonetic:['/juː/','/iːt/'],pos:'you + 动词原形',meaning:'你吃'}
    ],
    explanations: [
      "疑问句里 did 之后动词必须用原形，时态已经由 did 承担。常见错误：\n• \"What did you ate?\" → did 后不能用过去式\n• \"What you ate?\" → 缺助动词 did",
      "`eat` 用原形与 did 搭配；对应的陈述句是 You ate ..."
    ],
    distractors: [["What do","What does","What were"],["you ate?","you eats?","you eating?"]]
  },
  {
    sentence: "Leftover pizza.",
    cid: "1dcd6542",
    translation: "吃剩的披萨。",
    chunks: ["Leftover","pizza."],
    hints: ["剩下的","披萨"],
    grammar: [
      {role:'定语',color:'#c87033',phonetic:['/ˈleftoʊvər/'],pos:'形容词',meaning:'剩下的'},
      {role:'主语/表语',color:'#3358e0',phonetic:['/ˈpiːtsə/'],pos:'名词',meaning:'披萨'}
    ],
    explanations: [
      "`leftover` 写成一个词，作形容词表「吃剩的」。常见错误：\n• \"left over pizza\" → 写成两个词会被读成「留在……上面」\n• \"leftovers pizza\" → leftovers 是名词（剩菜），修饰名词要用单数形式 leftover",
      "这是省略主语的答句（It's leftover pizza.）。同义：Pizza from last night."
    ],
    distractors: [["Left over","Leftovers","Left"],["pizzas.","the pizza.","pizza pie."]]
  },
  {
    sentence: "It's homemade.",
    cid: "7849de8e",
    translation: "自己做的。",
    chunks: ["It's","homemade."],
    hints: ["它是","自家做的"],
    alts: [["It is"], null],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/ɪts/'],pos:'it + is 缩写',meaning:'它是'},
      {role:'表语',color:'#3358e0',phonetic:['/ˌhoʊmˈmeɪd/'],pos:'形容词',meaning:'自家做的'}
    ],
    explanations: [
      "`It's` = It is，缩写必须带撇号。常见错误：\n• \"Its homemade.\" → Its 是「它的」，句首位置放不下\n• \"It homemade.\" → 缺 be 动词",
      "`homemade` 写成一个词，表「家里做的」。常见错误：\n• \"home made\" → 作形容词时连写"
    ],
    distractors: [["It has","It was","It were"],["home made.","made home.","homemade it."]]
  },
  {
    sentence: "Pretty good.",
    cid: "382f5358",
    translation: "挺好吃的。",
    chunks: ["Pretty","good."],
    hints: ["挺、相当","好"],
    grammar: [
      {role:'程度状语',color:'#7c5cbf',phonetic:['/ˈprɪti/'],pos:'副词（口语）',meaning:'挺、相当'},
      {role:'表语',color:'#3358e0',phonetic:['/ɡʊd/'],pos:'形容词',meaning:'好'}
    ],
    explanations: [
      "口语里 `pretty` 作副词 = 挺、相当，比 very 轻。常见错误：\n• \"pretty well\" → well 形容状态，说东西好要用 good\n• \"prettily\" → 那是「漂亮地」，日常几乎不用",
      "省略了主语（It's pretty good.）。同义：Not bad. / Pretty decent."
    ],
    distractors: [["Pretty much","Prettier","Pretty well"],["better.","good at.","goodly."]]
  },
  {
    sentence: "How'd you sleep?",
    cid: "959fa9a7",
    translation: "你睡得怎么样？",
    chunks: ["How'd you","sleep?"],
    hints: ["你（怎么）","睡"],
    alts: [["How did you"], null],
    grammar: [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/haʊd/','/juː/'],pos:'How did 的口语缩写',meaning:'你（怎么）'},
      {role:'谓语',color:'#e74c7a',phonetic:['/sliːp/'],pos:'动词原形',meaning:'睡'}
    ],
    explanations: [
      "`How'd` = How did 的口语缩写，问的是过去的状况。常见错误：\n• \"How'd you slept?\" → did 之后要用原形\n• 完整形式 How did you sleep? 同样正确，只是没那么口语",
      "早上问候常用。同义：Did you sleep well? / How was your sleep?"
    ],
    distractors: [["How'd you been","How do you","How'd your"],["sleepy?","sleeping?","slept?"]]
  },
  {
    sentence: "You look refreshed.",
    cid: "757da6a9",
    translation: "你气色不错。",
    chunks: ["You look","refreshed."],
    hints: ["你看起来","精神焕发"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/lʊk/'],pos:'系动词 look',meaning:'你看起来'},
      {role:'表语',color:'#3358e0',phonetic:['/rɪˈfreʃt/'],pos:'过去分词作形容词',meaning:'精神好的'}
    ],
    explanations: [
      "`look` 作系动词时后面接形容词，不能接副词。常见错误：\n• \"You look refreshingly\" → 表语位置要用形容词\n• \"You looks\" → you 用 look",
      "`refreshed` 是过去分词作形容词，表「休息好了、精神好」。常见错误：\n• \"refreshing\" → 那是「令人清爽的」，修饰事物而不是人"
    ],
    distractors: [["You looks","You looking","Your look"],["refresh.","refreshing.","refreshment."]]
  },
  {
    sentence: "Yeah, I slept in.",
    cid: "a941aad4",
    translation: "嗯，我睡懒觉了。",
    chunks: ["Yeah,","I slept in."],
    hints: ["嗯、对","我睡到很晚"],
    grammar: [
      {role:'应答词',color:'#7c5cbf',phonetic:['/jeə/'],pos:'口语肯定词',meaning:'嗯、对'},
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/slept/','/ɪn/'],pos:'sleep in 的过去式',meaning:'我睡到很晚'}
    ],
    explanations: [
      "`Yeah` 比 yes 更随意，日常对话里高频。常见错误：\n• 正式场合要用 Yes，Yeah 偏随意\n• 别把 Yeah 和口语里的 ya（= you）混用",
      "`sleep in` 是固定短语，表「睡懒觉、睡到自然醒」（不是失眠）。常见错误：\n• \"sleep on\" → 那是「先睡一晚再考虑」，意思完全不同\n• \"slept in late\" → 也有人说，但 in 已经含「晚」的意思"
    ],
    distractors: [["Yes,","Yep,","No,"],["I sleep in.","I slept on.","I sleeping in."]]
  },
  {
    sentence: "I woke up at 10.",
    cid: "b2921029",
    translation: "我十点醒的。",
    chunks: ["I woke up","at 10."],
    hints: ["我醒了","在十点"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/woʊk/','/ʌp/'],pos:'wake up 的过去式',meaning:'我醒了'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/æt/','/ten/'],pos:'介词短语',meaning:'在十点'}
    ],
    explanations: [
      "`wake up` 的过去式是 woke up（不规则变化）。常见错误：\n• \"I waked up\" → 应作 woke\n• \"I woke at 10\" → 也通，但日常更常说 wake up",
      "`at 10` 读作 at ten，具体钟点用 at。常见错误：\n• \"in 10\" → 具体钟点用 at，in 用于月/年\n• \"on 10\" → on 用于星期和日期"
    ],
    distractors: [["I wake up","I woken up","I waking up"],["in 10.","on 10.","for 10."]]
  },
  {
    sentence: "You feelin' okay?",
    cid: "b613eb7d",
    translation: "感觉还好吗？",
    chunks: ["You feelin'","okay?"],
    hints: ["你感觉","还好吗"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/ˈfiːlɪn/'],pos:'Are you feeling 的省略',meaning:'你感觉'},
      {role:'表语',color:'#3358e0',phonetic:['/ˌoʊˈkeɪ/'],pos:'形容词',meaning:'还好'}
    ],
    explanations: [
      "口语省略句首的 Are，feelin' 用撇号代替词尾的 g。常见错误：\n• \"You feels okay\" → you 用 feel\n• 正式书写要写 Are you feeling okay?",
      "`okay` 也写作 OK，用来问健康状况。同义：You all right? / Are you doing okay?"
    ],
    distractors: [["You feel","You feels","You're feelin'"],["OK?","fine?","all right?"]]
  },
  {
    sentence: "Super good.",
    cid: "b5a62b5d",
    translation: "很好。",
    chunks: ["Super","good."],
    hints: ["超级","好"],
    grammar: [
      {role:'程度状语',color:'#7c5cbf',phonetic:['/ˈsuːpər/'],pos:'副词（口语加强）',meaning:'超级'},
      {role:'表语',color:'#3358e0',phonetic:['/ɡʊd/'],pos:'形容词',meaning:'好'}
    ],
    explanations: [
      "`super` 作副词表「超级」，年轻人常用，比 very 更夸张。常见错误：\n• \"super goodly\" → goodly 不是 good 的副词\n• 正式场合要说 very good",
      "省略了主语（I'm super good.）。同义：Awesome. / Great. / Doing great."
    ],
    distractors: [["Superb","Superly","Very"],["well.","good at.","goodness."]]
  },
  {
    sentence: "Wanna go for a run?",
    cid: "6c4276f8",
    translation: "想去跑步吗？",
    chunks: ["Wanna","go for a run?"],
    hints: ["想要","去跑步"],
    grammar: [
      {role:'情态+主语',color:'#c87033',phonetic:['/ˈwɑːnə/'],pos:'want to 的口语缩写',meaning:'想要'},
      {role:'固定表达',color:'#7c5cbf',phonetic:['/ɡoʊ/','/fɔːr/','/ə/','/rʌn/'],pos:'go for a run 惯用短语',meaning:'去跑步'}
    ],
    explanations: [
      "`wanna` = want to 的连读写法，只用于非正式场合。常见错误：\n• \"Wanna to go\" → wanna 已含 to，不能再加\n• 书面写作要用 want to",
      "`go for a run` 是固定搭配「去跑步」，整体是一个 chunk 不可拆。常见错误：\n• \"go for run\" → 漏掉冠词 a\n• \"go to a run\" → 介词是 for 不是 to\n同义：Want to go running? / Feel like a run?"
    ],
    distractors: [["Want","Wanna to","Wanted to"],["go for run?","go to a run?","go for a running?"]]
  },
  {
    sentence: "I'm down for it.",
    cid: "d6700842",
    translation: "我没问题。",
    chunks: ["I'm down","for it."],
    hints: ["我愿意","做这件事"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/daʊn/'],pos:'be down 口语习语',meaning:'我愿意'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/fɔːr/','/ɪt/'],pos:'介词短语',meaning:'做这件事'}
    ],
    explanations: [
      "`be down for sth` 是口语习语，表「乐意、算我一个」，跟「在下面」无关。常见错误：\n• \"I'm down to it\" → 固定搭配用 for\n• 按字面理解成「我在下面」→ 会完全跑偏",
      "`for it` 指代前面提到的那件事。同义：I'm in. / Count me in. / I'm up for it."
    ],
    distractors: [["I'm up","I'm down on","I down"],["to it.","on it.","at it."]]
  },
  {
    sentence: "Did you get taller?",
    cid: "d7c85ebc",
    translation: "你长高了吗？",
    chunks: ["Did you get","taller?"],
    hints: ["你变得","更高"],
    grammar: [
      {role:'助动词+主语',color:'#e74c7a',phonetic:['/dɪd/','/juː/','/ɡet/'],pos:'一般过去时疑问',meaning:'你变（高）了'},
      {role:'补语',color:'#3358e0',phonetic:['/ˈtɔːlər/'],pos:'形容词比较级',meaning:'更高'}
    ],
    explanations: [
      "`get + 形容词` 表「变得」，这里 get 是系动词。常见错误：\n• \"Did you got taller?\" → did 之后用原形 get\n• \"Did you get tall?\" → 跟过去比要用比较级 taller",
      "`taller` 是比较级，隐含「比你以前高」。常见错误：\n• \"more tall\" → 单音节词加 -er\n• \"tallest\" → 最高级用于三者以上"
    ],
    distractors: [["Do you get","Did you got","Did you getting"],["tall?","more tall?","tallest?"]]
  },
  {
    sentence: "You are growing fast.",
    cid: "c59cc387",
    translation: "你长得真快。",
    chunks: ["You are","growing fast."],
    hints: ["你正在","长得快"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/juː/','/ɑːr/'],pos:'you + are',meaning:'你正在'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈɡroʊɪŋ/','/fæst/'],pos:'现在进行时+副词',meaning:'长得快'}
    ],
    explanations: [
      "`grow` 表「长身体」时是不及物动词，用进行时表持续变化。常见错误：\n• \"You growing fast\" → 缺 are\n• \"You are grow fast\" → 进行时要用 growing",
      "`fast` 既是形容词也是副词，作副词时不加 -ly。常见错误：\n• \"growing fastly\" → fastly 不存在"
    ],
    distractors: [["You is","You're","You am"],["grow fast.","growing fastly.","grown fast."]]
  },
  {
    sentence: "How old are you?",
    cid: "4d62bdfa",
    translation: "你多大了？",
    chunks: ["How old","are you?"],
    hints: ["多大","你呢"],
    grammar: [
      {role:'疑问词+形容词',color:'#c87033',phonetic:['/haʊ/','/oʊld/'],pos:'询问年龄',meaning:'多大'},
      {role:'系动词+主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'倒装问句',meaning:'你呢'}
    ],
    explanations: [
      "问年龄固定用 `How old`。常见错误：\n• \"How age are you?\" → 错，age 是名词不能这样问\n• \"What old are you?\" → 疑问词用 How",
      "`are you` 是主谓倒装。常见错误：\n• \"How old you are?\" → 语序没倒装，这种语序只用在宾语从句里（I know how old you are.）"
    ],
    distractors: [["How age","What old","How older"],["you are?","are your?","do you?"]]
  },
  {
    sentence: "Twenty something.",
    cid: "7fde70a6",
    translation: "二十多岁吧。",
    chunks: ["Twenty","something."],
    hints: ["二十","多（岁左右）"],
    grammar: [
      {role:'数词',color:'#c87033',phonetic:['/ˈtwenti/'],pos:'基数词',meaning:'二十'},
      {role:'后缀',color:'#7c5cbf',phonetic:['/ˈsʌmθɪŋ/'],pos:'口语后缀',meaning:'多、左右'}
    ],
    explanations: [
      "`-something` 接在整十数后面，表示「……多岁」，用于说得不精确。常见错误：\n• \"twenty some\" → 要连写成一个词\n• \"twenty more\" → 意思变成「再多二十」",
      "标准书写带连字符：Twenty-something。同义：in my twenties（二十几岁）"
    ],
    distractors: [["Twenty's","The twenty","Twenties"],["some thing.","sometime.","somethings."]]
  },
  {
    sentence: "Where you goin'?",
    cid: "21d7bd02",
    translation: "你要去哪？",
    chunks: ["Where","you goin'?"],
    hints: ["哪里","你去"],
    alts: [null, ["are you going?"]],
    grammar: [
      {role:'疑问词',color:'#c87033',phonetic:['/wer/'],pos:'疑问副词',meaning:'哪里'},
      {role:'主语+谓语',color:'#e74c7a',phonetic:['/juː/','/ˈɡoʊɪn/'],pos:'are you going 的口语省略',meaning:'你去'}
    ],
    explanations: [
      "口语里句首的 Are 常被省掉，going 写成 goin'。常见错误：\n• \"Where you go?\" → 少 goin'，语义会变成「你（平时）去哪」\n• 正式书写是 Where are you going?",
      "同义：Where are you off to? / Where to?"
    ],
    distractors: [["When","What","Where's"],["you go?","you gone?","your goin'?"]]
  },
  {
    sentence: "Out for dinner.",
    cid: "6e85e8be",
    translation: "出去吃晚饭。",
    chunks: ["Out for","dinner."],
    hints: ["出去（为了）","晚饭"],
    grammar: [
      {role:'方向状语',color:'#7c5cbf',phonetic:['/aʊt/','/fɔːr/'],pos:'口语省略句',meaning:'出去（为了）'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/ˈdɪnər/'],pos:'名词',meaning:'晚饭'}
    ],
    explanations: [
      "回答 Where are you going 时省略了主句（I'm going out for dinner.）。常见错误：\n• \"Out for the dinner\" → 一日三餐前一般不加冠词",
      "三餐前不加冠词：have dinner / for dinner。常见错误：\n• \"for a dinner\" → 加冠词是错的"
    ],
    distractors: [["Out to","Out of","Out in"],["the dinners.","a dinner.","dinner plate."]]
  },
  {
    sentence: "I want you home by 10.",
    cid: "22684a18",
    translation: "我要你十点前回家。",
    chunks: ["I want you","home by 10."],
    hints: ["我要你","十点前到家"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/wɑːnt/','/juː/'],pos:'want + 宾语',meaning:'我要你'},
      {role:'补语',color:'#7c5cbf',phonetic:['/hoʊm/','/baɪ/','/ten/'],pos:'home + 介词短语',meaning:'十点前到家'}
    ],
    explanations: [
      "`want sb + 补语` 表「要求某人处于某状态」，这里 home 作副词。常见错误：\n• \"I want you to home\" → home 是副词，不加 to\n• \"I want that you home\" → 英语不用 that 从句，直接接宾语+补语",
      "`by 10` = 十点之前（含十点），强调截止时间。常见错误：\n• \"until 10\" → until 表持续到十点，不是「在十点前完成」\n• \"in 10\" → 那是「十分钟后」"
    ],
    distractors: [["I want you to","I wants you","I want your"],["home at 10.","home in 10.","home till 10."]]
  },
  {
    sentence: "Yes, ma'am.",
    cid: "7591c63d",
    translation: "好的，女士。",
    chunks: ["Yes,","ma'am."],
    hints: ["好的","女士"],
    grammar: [
      {role:'应答词',color:'#7c5cbf',phonetic:['/jes/'],pos:'肯定应答',meaning:'好的'},
      {role:'称呼',color:'#3358e0',phonetic:['/mæm/'],pos:'名词（尊称）',meaning:'女士'}
    ],
    explanations: [
      "`Yes` 是标准肯定应答，应答长辈或上级时更常用。常见错误：\n• 随意场合的 Yeah 不适合对长辈说\n• 逗号不能省：Yes ma'am 读起来会很赶",
      "`ma'am` 是对女性的尊称（= madam 的缩写），常含撇号。常见错误：\n• \"mam\" → 少了撇号，标准写法是 ma'am\n• 对男性用 sir，不是 mister"
    ],
    distractors: [["Yeah,","Yep,","Yes sir,"],["mam.","madam.","mister."]]
  },
  {
    sentence: "Let's go eat.",
    cid: "17386a3e",
    translation: "我们去吃吧。",
    chunks: ["Let's","go eat."],
    hints: ["我们（一起）","去吃"],
    grammar: [
      {role:'祈使提议',color:'#c87033',phonetic:['/lets/'],pos:'Let us 的缩写',meaning:'我们（一起）'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/','/iːt/'],pos:'go + 动词原形',meaning:'去吃'}
    ],
    explanations: [
      "`Let's` = Let us，表提议，后接动词原形。常见错误：\n• \"Let's to go\" → 不能加 to\n• \"Lets go\" → 少了撇号就变成「让（某人）」的第三人称单数",
      "口语里 `go + 动词原形` 表示「去做某事」，中间省略 and。常见错误：\n• \"go to eat\" → 也可以，但 go eat 更口语\n• \"go eating\" → 错了，-ing 不用于这个结构"
    ],
    distractors: [["Let us","Let","Let's to"],["go to eat.","going eat.","go eating."]]
  },
  {
    sentence: "Kay, burgers?",
    cid: "d917bc1b",
    translation: "好，汉堡吗？",
    chunks: ["Kay,","burgers?"],
    hints: ["好（口语）","汉堡"],
    grammar: [
      {role:'应答词',color:'#7c5cbf',phonetic:['/keɪ/'],pos:'OK 的口语变体',meaning:'好、行'},
      {role:'名词',color:'#3358e0',phonetic:['/ˈbɜːrɡərz/'],pos:'名词复数',meaning:'汉堡'}
    ],
    explanations: [
      "`Kay` 是 OK 的口语简读，常出现在轻松的对话里。常见错误：\n• 正式场合要用 OK / All right\n• 升调读 Kay? 是「行吗？」",
      "`burgers?` 是省略句（Do you want burgers? / How about burgers?）。常见错误：\n• 泛指一类食物要用复数 burgers"
    ],
    distractors: [["OK,","Hey,","K,"],["burger?","a burgers?","a burger."]]
  },
  {
    sentence: "How about the movies?",
    cid: "56db8fc9",
    translation: "看电影怎么样？",
    chunks: ["How about","the movies?"],
    hints: ["怎么样","电影（院）"],
    alts: [["What about"], null],
    grammar: [
      {role:'建议句型',color:'#c87033',phonetic:['/haʊ/','/əˈbaʊt/'],pos:'How about 固定句型',meaning:'……怎么样'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/ðə/','/ˈmuːviz/'],pos:'名词短语',meaning:'电影'}
    ],
    explanations: [
      "`How about + 名词/动名词` 是提建议的固定句型，about 是介词。常见错误：\n• \"How about go to the movies?\" → 后面接名词或 doing，不能接原形\n• \"How about the movie?\" → 去电影院说 the movies",
      "`the movies` 固定用复数，指「电影院、看电影这件事」。常见错误：\n• \"the movie\" → 指某一部影片，不指「去看电影」"
    ],
    distractors: [["How abouts","How for","How with"],["the movie?","movies?","the cinema?"]]
  },
  {
    sentence: "It's okay with Mom.",
    cid: "db783c1d",
    translation: "妈妈同意了。",
    chunks: ["It's okay","with Mom."],
    hints: ["（这件事）可以","对妈妈来说"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ˌoʊˈkeɪ/'],pos:'it + is + 形容词',meaning:'可以'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/wɪð/','/mɑːm/'],pos:'介词短语',meaning:'对妈妈而言'}
    ],
    explanations: [
      "`It's okay with sb` 表「某人没意见、某人同意」。常见错误：\n• \"It's okay for Mom\" → for 表「对……有好处」，表「同意」要用 with\n• 家庭称呼 Mom 首字母大写，作专有名词",
      "同义：Mom's fine with it. / Mom said it's fine."
    ],
    distractors: [["It's ok to","It's okay for","It's okay to"],["for Mom.","with my Mom.","with mom's."]]
  },
  {
    sentence: "It's dark in here.",
    cid: "b9aa8c19",
    translation: "这里很黑。",
    chunks: ["It's dark","in here."],
    hints: ["很黑","在这里面"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/dɑːrk/'],pos:'it + is + 形容词',meaning:'很黑'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ɪn/','/hɪr/'],pos:'介词短语',meaning:'在这里面'}
    ],
    explanations: [
      "`It's dark` 用 it 指环境（天气/光线/时间）。常见错误：\n• \"Here is dark\" → 英语习惯用 it 作形式主语\n• \"It's darkness\" → 形容词 dark 才对，darkness 是名词",
      "`in here` 强调「在里面」，与泛指的 here 有区别。常见错误：\n• \"in there\" → 那是「在那里面」，空间不同"
    ],
    distractors: [["It's darker","It's darkly","It's dark in"],["in there.","here.","in the here."]]
  },
  {
    sentence: "Watch your step.",
    cid: "89843067",
    translation: "小心脚下。",
    chunks: ["Watch","your step."],
    hints: ["注意","你的脚下"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/wɑːtʃ/'],pos:'祈使句动词',meaning:'注意、当心'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/step/'],pos:'名词短语',meaning:'你的脚下'}
    ],
    explanations: [
      "`watch` 在此表「留意、当心」，比 look 更有警觉意味。常见错误：\n• \"Look your step\" → 固定说法是 watch your step\n• \"Watching your step\" → 祈使句用原形",
      "`Watch your step` 既是「当心脚下」，也可引申为「小心行事」。同义：Mind the step."
    ],
    distractors: [["Watch out","Watching","Watches"],["you step.","your steps.","your stepping."]]
  },
  {
    sentence: "Want me to help?",
    cid: "9c364fa8",
    translation: "要我帮忙吗？",
    chunks: ["Want me","to help?"],
    hints: ["想要我","帮忙"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/wɑːnt/','/miː/'],pos:'省略 Do you 的问句',meaning:'想要我'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/help/'],pos:'不定式短语',meaning:'帮忙'}
    ],
    explanations: [
      "口语省略句首的 Do you，直接说 Want me...? 常见错误：\n• \"Want I to help?\" → 宾语用宾格 me\n• \"Wants me to help?\" → 省略了主语，动词不加 s",
      "`want sb to do sth` 是固定结构，不能省 to。常见错误：\n• \"Want me help?\" → 少了 to 就变错了"
    ],
    distractors: [["Want I","Wants me","Want my"],["help?","for help?","helping?"]]
  },
  {
    sentence: "I'm all right.",
    cid: "e24acc99",
    translation: "不用了。",
    chunks: ["I'm","all right."],
    hints: ["我","还好、不用"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/aɪm/'],pos:'I + am 缩写',meaning:'我'},
      {role:'表语',color:'#3358e0',phonetic:['/ɔːl/','/raɪt/'],pos:'形容词短语',meaning:'还好'}
    ],
    explanations: [
      "`I'm all right` 有两层意思：身体「我没事」，回答提议时是「不用了」。常见错误：\n• \"I'm alright\" → 也可接受，但规范写法是 all right\n• \"I'm right\" → 意思变成「我是对的」",
      "同义（拒绝提议）：I'm good. / No thanks."
    ],
    distractors: [["I am","I'm not","I'm in"],["alright.","all write.","all rights."]]
  },
  {
    sentence: "You tired?",
    cid: "d68791ff",
    translation: "你累了？",
    chunks: ["You","tired?"],
    hints: ["你","累了吗"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/juː/'],pos:'人称代词',meaning:'你'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈtaɪərd/'],pos:'形容词',meaning:'累了'}
    ],
    explanations: [
      "口语省略句首的 Are，只剩 You tired? 靠升调表疑问。常见错误：\n• \"You are tired?\" → 也对，但多是确认语气\n• \"You tiring?\" → tiring 是「令人累的」，形容人要用 tired",
      "`tired` 是过去分词作形容词，表「感到累」。常见错误：\n• \"tired of\" → 那是「对……厌倦」，不是身体累"
    ],
    distractors: [["Your","You're","Yours"],["tiring?","tire?","tired of?"]]
  },
  {
    sentence: "A little.",
    cid: "8e16eb62",
    translation: "有一点。",
    chunks: ["A","little."],
    hints: ["一","点儿"],
    grammar: [
      {role:'冠词',color:'#c87033',phonetic:['/ə/'],pos:'不定冠词',meaning:'一（个）'},
      {role:'名词',color:'#3358e0',phonetic:['/ˈlɪtl/'],pos:'不可数名词用法',meaning:'一点儿'}
    ],
    explanations: [
      "`a little` 是整体短语，表「一点点」，回答 Are you tired? 时常省略主句。常见错误：\n• \"a few\" → few 接可数名词，回答程度要用 a little\n• \"little\" 单用 → 表「几乎没有」，否定意味，跟 a little 相反",
      "同义：A bit. / Kind of. / Somewhat."
    ],
    distractors: [["An","The","Some"],["few.","bit.","lot."]]
  },
  {
    sentence: "I have a bump.",
    cid: "1834c3f7",
    translation: "我长了个包。",
    chunks: ["I have","a bump."],
    hints: ["我长了","一个包"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/hæv/'],pos:'一般现在时',meaning:'我有、我长了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/bʌmp/'],pos:'名词短语',meaning:'一个包'}
    ],
    explanations: [
      "描述身体的包/肿起用 `have`。常见错误：\n• \"I have a bump on my head\" → 说位置更清楚，on 表表面\n• \"I am a bump\" → be 与 have 混淆",
      "`bump` 多指撞出来的肿包。同义：I got a bump. / There's a bump on my head."
    ],
    distractors: [["I has","I had a","I have got"],["bumps.","the bump.","a bumb."]]
  },
  {
    sentence: "It's a pimple.",
    cid: "9b596270",
    translation: "是个痘痘。",
    chunks: ["It's a","pimple."],
    hints: ["它是一个","痘痘"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ə/'],pos:'it + is + a',meaning:'它是一个'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈpɪmpl/'],pos:'名词',meaning:'痘痘'}
    ],
    explanations: [
      "`It's a` 后面接可数名词单数。常见错误：\n• \"It's an pimple\" → p 是辅音音素，用 a\n• \"It's pimple\" → 可数名词单数前要加冠词",
      "`pimple` 指脸上的痘痘。口语也叫 zit。粉刺/痤疮是 acne。"
    ],
    distractors: [["It's an","It a","It's a the"],["pimples.","a pimple.","pimpl."]]
  },
  {
    sentence: "I might have a fever.",
    cid: "3a50b844",
    translation: "我可能发烧了。",
    chunks: ["I might","have a fever."],
    hints: ["我可能","发烧"],
    grammar: [
      {role:'情态+主语',color:'#c87033',phonetic:['/aɪ/','/maɪt/'],pos:'情态动词 might',meaning:'我可能'},
      {role:'谓语+宾语',color:'#e74c7a',phonetic:['/hæv/','/ə/','/ˈfiːvər/'],pos:'have + 名词短语',meaning:'发烧'}
    ],
    explanations: [
      "`might` 表「有可能」，比 may 更不确定，后面接动词原形。常见错误：\n• \"I might to have\" → 情态动词后不加 to\n• \"I might has\" → 用原形 have",
      "`have a fever` 是固定搭配，fever 前要加 a。常见错误：\n• \"have fever\" → 少了冠词"
    ],
    distractors: [["I may to","I might to","I mights"],["have fever.","has a fever.","have a fevers."]]
  },
  {
    sentence: "Let's take your temperature.",
    cid: "0e4cb67e",
    translation: "量一下你的体温吧。",
    chunks: ["Let's take","your temperature."],
    hints: ["我们来量","你的体温"],
    grammar: [
      {role:'祈使提议',color:'#e74c7a',phonetic:['/lets/','/teɪk/'],pos:'let us + 动词',meaning:'我们来量'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/ˈtemprətʃər/'],pos:'名词短语',meaning:'你的体温'}
    ],
    explanations: [
      "`take one's temperature` 是固定搭配，表「给某人量体温」。常见错误：\n• \"take you temperature\" → 要用所有格 your\n• \"measure your temperature\" → 也能懂，但地道的说法是 take",
      "`temperature` 注意拼写，中间是 -pera-。常见错误：\n• \"temperture\" → 漏了 a"
    ],
    distractors: [["Let's taking","Let's take you","Let's takes"],["your temperture.","you temperature.","your temperatures."]]
  },
  {
    sentence: "Your room's a mess.",
    cid: "7bf57efa",
    translation: "你房间很乱。",
    chunks: ["Your room's","a mess."],
    hints: ["你的房间是","一团乱"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/jʊr/','/ruːmz/'],pos:'your room + is 缩写',meaning:'你的房间是'},
      {role:'表语',color:'#3358e0',phonetic:['/ə/','/mes/'],pos:'名词短语',meaning:'一团乱'}
    ],
    explanations: [
      "`Your room's` = Your room is，缩写带撇号。常见错误：\n• \"Your rooms\" → 少了撇号就成复数「你的房间们」\n• \"You room's\" → 所有格要用 your",
      "`a mess` 是固定说法，表「一团糟」。常见错误：\n• \"a mess room\" → 语序错了，要说 This room is a mess."
    ],
    distractors: [["Your room is","You room's","Your rooms are"],["mess.","in a mess.","a messes."]]
  },
  {
    sentence: "Mom, it's already clean.",
    cid: "e8165154",
    translation: "妈，已经很干净了。",
    chunks: ["Mom,","it's already clean."],
    hints: ["妈","已经很干净了"],
    grammar: [
      {role:'称呼',color:'#7c5cbf',phonetic:['/mɑːm/'],pos:'呼语',meaning:'妈'},
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ɔːlˈredi/','/kliːn/'],pos:'it + is + 副词 + 形容词',meaning:'已经很干净'}
    ],
    explanations: [
      "呼语放句首，后面用逗号隔开。常见错误：\n• \"Mom it's already clean\" → 少逗号，读起来像从句\n• 呼语后不要再加 you，英语不像中文说「妈你」",
      "`already` 放 be 动词之后、实义动词之前。常见错误：\n• \"It's clean already\" → 口语可以，但书面更常放中间\n• \"already it's clean\" → 语序错"
    ],
    distractors: [["Mommy,","Ma,","Mama,"],["it's ready clean.","it's already cleaned.","it's already clear."]]
  },
  {
    sentence: "Stop nagging me.",
    cid: "3243ebfc",
    translation: "别唠叨我了。",
    chunks: ["Stop","nagging me."],
    hints: ["停止","唠叨我"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/stɑːp/'],pos:'祈使句动词',meaning:'停止'},
      {role:'动名词宾语',color:'#3358e0',phonetic:['/ˈnæɡɪŋ/','/miː/'],pos:'stop + doing',meaning:'唠叨我'}
    ],
    explanations: [
      "`stop doing sth` 表「停止做某事」，固定接动名词。常见错误：\n• \"Stop to nag me\" → stop to do 是「停下来去做另一件事」，意思完全变了\n• \"Stop nag me\" → 少了 -ing",
      "`nag` 指不停唠叨、抱怨。同义：Quit bugging me. / Cut it out."
    ],
    distractors: [["Stopping","Stops","Stopped"],["nag me.","to nag me.","nagging at me."]]
  },
  {
    sentence: "I'll do it soon.",
    cid: "54010f3c",
    translation: "我很快做。",
    chunks: ["I'll do","it soon."],
    hints: ["我会做","很快"],
    grammar: [
      {role:'主语+助动词',color:'#e74c7a',phonetic:['/aɪl/','/duː/'],pos:'I will 缩写 + 动词',meaning:'我会做'},
      {role:'宾语+时间状语',color:'#7c5cbf',phonetic:['/ɪt/','/suːn/'],pos:'代词 + 副词',meaning:'很快（做）它'}
    ],
    explanations: [
      "`I'll` = I will，表将来的承诺，后接动词原形。常见错误：\n• \"I'll doing\" → will 后接原形\n• \"I'll did\" → 不能接过去式",
      "`soon` 表「不久之后」，多与将来时连用。常见错误：\n• \"soonly\" → 不存在这个副词\n• \"quick\" → 那是形容词，时间上要用 soon"
    ],
    distractors: [["I'll doing","I do","I'll did"],["it soonly.","it quick.","its soon."]]
  },
  {
    sentence: "I like those pants.",
    cid: "3a4b732a",
    translation: "我喜欢那条裤子。",
    chunks: ["I like","those pants."],
    hints: ["我喜欢","那条裤子"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/laɪk/'],pos:'一般现在时',meaning:'我喜欢'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðoʊz/','/pænts/'],pos:'指示代词+名词',meaning:'那条裤子'}
    ],
    explanations: [
      "`like` 表喜好时是静态动词，一般不用进行时。常见错误：\n• \"I'm liking those pants\" → 一般现在时就好\n• \"I likes\" → I 后面不加 s",
      "`pants` 在英语里固定用复数，一条裤子也是 pants。常见错误：\n• \"this pants\" → 要用 these / those\n• \"a pant\" → 单数形式基本不用"
    ],
    distractors: [["I likes","I like to","I'm like"],["those pant.","that pants.","those pans."]]
  },
  {
    sentence: "Try them on.",
    cid: "84f32999",
    translation: "穿上试试。",
    chunks: ["Try","them on."],
    hints: ["试","把它们（穿上）"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/traɪ/'],pos:'祈使句动词',meaning:'试'},
      {role:'宾语+副词',color:'#3358e0',phonetic:['/ðem/','/ɑːn/'],pos:'代词 + 副词小品词',meaning:'把它们穿上'}
    ],
    explanations: [
      "`try sth on` = 试穿。代词作宾语时必须放中间。常见错误：\n• \"Try on them\" → 代词只能用 try them on\n• \"Try them\" → 少了 on，意思变「试一下」不一定是试穿",
      "名词可以放两边：try on the shoes / try the shoes on；代词只能放中间。"
    ],
    distractors: [["Trying","Tries","Try to"],["on them.","them in.","they on."]]
  },
  {
    sentence: "Do I look fat?",
    cid: "b6567a0a",
    translation: "我看起来胖吗？",
    chunks: ["Do I","look fat?"],
    hints: ["我（是不是）","看着胖"],
    grammar: [
      {role:'助动词+主语',color:'#c87033',phonetic:['/duː/','/aɪ/'],pos:'一般现在时疑问',meaning:'我（是不是）'},
      {role:'主系表',color:'#e74c7a',phonetic:['/lʊk/','/fæt/'],pos:'系动词 look + 形容词',meaning:'看着胖'}
    ],
    explanations: [
      "一般现在时疑问句用 do/does + 主语。常见错误：\n• \"Am I look fat?\" → look 是实义动词，不用 am\n• \"Do me look fat?\" → 主语用主格 I",
      "`look + 形容词` 表「看起来……」。常见错误：\n• \"look fatly\" → 表语用形容词\n• \"look like fat\" → look like 后面要接名词"
    ],
    distractors: [["Am I","Does I","Do me"],["looks fat?","look fatter?","looking fat?"]]
  },
  {
    sentence: "You look perfect.",
    cid: "13020328",
    translation: "你看起来很完美。",
    chunks: ["You look","perfect."],
    hints: ["你看起来","完美"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/lʊk/'],pos:'系动词 look',meaning:'你看起来'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈpɜːrfɪkt/'],pos:'形容词',meaning:'完美'}
    ],
    explanations: [
      "`perfect` 本身已含「最」的意思，不再用 more/most 修饰。常见错误：\n• \"more perfect\" → 语义重复\n• \"perfectly\" → 那是副词，表「完美地」",
      "`look` 作系动词后接形容词，同义结构：You look great. / You look amazing."
    ],
    distractors: [["You looks","You looking","Your look"],["perfectly.","perfection.","more perfect."]]
  },
  {
    sentence: "I've got dandruff.",
    cid: "b62f5200",
    translation: "我有头皮屑。",
    chunks: ["I've got","dandruff."],
    hints: ["我有","头皮屑"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪv/','/ɡɑːt/'],pos:'have got 缩写',meaning:'我有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈdændrʌf/'],pos:'不可数名词',meaning:'头皮屑'}
    ],
    explanations: [
      "`I've got` 是英式/口语里表「有」的常用说法，等于 I have。常见错误：\n• \"I've get\" → got 是过去分词，不能换成原形\n• \"I got dandruff\" → 美式口语也这么说，但强调当下状态用 I've got",
      "`dandruff` 是不可数名词，不加 s、不加 a。常见错误：\n• \"a dandruff\" → 不可数\n• \"dandruffs\" → 没有复数形式"
    ],
    distractors: [["I got","I've get","I've got to"],["dandruffs.","a dandruff.","the dandruff."]]
  },
  {
    sentence: "Try some shampoo.",
    cid: "3df31aab",
    translation: "试试洗发水。",
    chunks: ["Try","some shampoo."],
    hints: ["试试","一些洗发水"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/traɪ/'],pos:'祈使句动词',meaning:'试试'},
      {role:'宾语',color:'#3358e0',phonetic:['/sʌm/','/ʃæmˈpuː/'],pos:'名词（不可数）',meaning:'一些洗发水'}
    ],
    explanations: [
      "祈使句直接用动词原形开头。常见错误：\n• \"Trying some shampoo\" → 祈使句不带动名词\n• \"Try to some shampoo\" → try to 后面要接动词",
      "`shampoo` 是不可数名词，用 some 修饰。常见错误：\n• \"a shampoo\" → 说「一瓶洗发水」才用 a bottle of shampoo"
    ],
    distractors: [["Trying","Tries","Try to"],["some shampoos.","a shampoo.","some shampooing."]]
  },
  {
    sentence: "It's a used one.",
    cid: "17294bac",
    translation: "这是二手的。",
    chunks: ["It's a","used one."],
    hints: ["它是一个","用过的"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ə/'],pos:'it + is + a',meaning:'它是一个'},
      {role:'表语',color:'#3358e0',phonetic:['/juːzd/','/wʌn/'],pos:'形容词 + 代词',meaning:'用过的（那个）'}
    ],
    explanations: [
      "`It's a` 后接单数名词或代词 one。常见错误：\n• \"It's an used one\" → u 在此读 /juː/，是辅音音素，用 a\n• \"It's a use one\" → 形容词要用过去分词 used",
      "`used` 作形容词读 /juːzd/，表「用过的、二手的」。常见错误：\n• \"used one\" 读成 /juːst/ → 那是 be used to 的读音，语义不同"
    ],
    distractors: [["It's an","It a","It's a used"],["use one.","using one.","used ones."]]
  },
  {
    sentence: "But the price is right.",
    cid: "880a8346",
    translation: "但价格合适。",
    chunks: ["But the price","is right."],
    hints: ["但价格","是合适的"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/bʌt/','/ðə/','/praɪs/'],pos:'名词短语',meaning:'但价格'},
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪz/','/raɪt/'],pos:'is + 形容词',meaning:'是合适的'}
    ],
    explanations: [
      "`the price is right` 是固定说法，表「价钱公道」。常见错误：\n• \"the prize\" → prize 是奖品，别和 price 混\n• \"the prices is\" → 主语复数才用 are",
      "`right` 在这里是「合适的、公道的」，不是「正确的」。同义：It's a fair price."
    ],
    distractors: [["But the prices","But price","But the prize"],["are right.","is right's.","was right."]]
  },
  {
    sentence: "That comes to 30.",
    cid: "bd951c11",
    translation: "一共三十。",
    chunks: ["That comes","to 30."],
    hints: ["一共（算下来）","到三十"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/ðæt/','/kʌmz/'],pos:'一般现在时',meaning:'那算下来'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/tə/','/ˈθɜːrti/'],pos:'介词短语',meaning:'到三十'}
    ],
    explanations: [
      "`come to + 金额` 是结账固定搭配，表「总计」。常见错误：\n• \"That comes 30\" → 少了介词 to\n• \"That come to 30\" → 主语是 that，动词加 s",
      "金额读法：30 读 thirty。同义：That'll be 30. / Your total is 30."
    ],
    distractors: [["That come","That coming","Those comes"],["to thirteen.","at 30.","for 30."]]
  },
  {
    sentence: "Cash or credit?",
    cid: "3ec98065",
    translation: "现金还是刷卡？",
    chunks: ["Cash","or credit?"],
    hints: ["现金","还是刷卡"],
    grammar: [
      {role:'名词',color:'#3358e0',phonetic:['/kæʃ/'],pos:'不可数名词',meaning:'现金'},
      {role:'选择问句',color:'#c87033',phonetic:['/ɔːr/','/ˈkredɪt/'],pos:'or + 名词',meaning:'还是刷卡'}
    ],
    explanations: [
      "结账时的省略问句（Cash or credit? = Will you pay in cash or by credit card?）。常见错误：\n• \"Cash or credit card?\" → 也常听到，口语里 credit 单独用即可\n• 注意 cash 与 cache（缓存/藏匿）拼写不同",
      "选择疑问句用 or 连接两个选项，读时前项升调、后项降调。"
    ],
    distractors: [["Cash's","Cache","Cashier"],["and credit?","or credit card?","nor credit?"]]
  },
  {
    sentence: "How ya doin'?",
    cid: "c530aed7",
    translation: "最近怎么样？",
    chunks: ["How ya","doin'?"],
    hints: ["你（怎么）","过得"],
    alts: [null, ["doing?"]],
    grammar: [
      {role:'疑问词+主语',color:'#c87033',phonetic:['/haʊ/','/jə/'],pos:'How are you 的口语连读',meaning:'你（怎么）'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈduːɪn/'],pos:'doing 的口语拼写',meaning:'过得'}
    ],
    explanations: [
      "`ya` 是 you 的口语弱读，整句源自 How are you doing?。常见错误：\n• \"How ya doing?\" → 写成 doing 更规范，doin' 是口语拼写\n• \"How you doin'?\" → 也常见，但省略了 are 的读音",
      "这是非常随意的问候，正式场合要说 How are you?"
    ],
    distractors: [["How you","How are","How's ya"],["do?","done?","doin's?"]]
  },
  {
    sentence: "Not too bad.",
    cid: "c869e3f3",
    translation: "还不错。",
    chunks: ["Not too","bad."],
    hints: ["不算","太差"],
    grammar: [
      {role:'程度状语',color:'#7c5cbf',phonetic:['/nɑːt/','/tuː/'],pos:'否定 + 程度副词',meaning:'不算太'},
      {role:'表语',color:'#3358e0',phonetic:['/bæd/'],pos:'形容词',meaning:'差'}
    ],
    explanations: [
      "`not too bad` 是英语里典型的「保守式回答」，实际意思接近「挺好的」。常见错误：\n• \"not to bad\" → 程度副词是 too，不是 to\n• \"no too bad\" → 否定词用 not",
      "同义：Pretty good. / Can't complain. / Not bad at all."
    ],
    distractors: [["No too","Not to","Not to much"],["badly.","worse.","bads."]]
  },
  {
    sentence: "You moved?",
    cid: "ac537f80",
    translation: "你搬家了？",
    chunks: ["You","moved?"],
    hints: ["你","搬了"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/juː/'],pos:'人称代词',meaning:'你'},
      {role:'谓语',color:'#e74c7a',phonetic:['/muːvd/'],pos:'一般过去时',meaning:'搬了'}
    ],
    explanations: [
      "省略助动词 Did，只靠升调表疑问。常见错误：\n• \"You move?\" → 问已经发生的事要用过去式 moved\n• \"Did you moved?\" → 有 did 时动词要还原成 move",
      "`move` 表搬家时不及物，常说 move in / move out / move to a new place。"
    ],
    distractors: [["Your","You're","Yours"],["move?","moving?","moved away?"]]
  },
  {
    sentence: "Yes, nice place.",
    cid: "b0368ee8",
    translation: "是的，好地方。",
    chunks: ["Yes,","nice place."],
    hints: ["是的","好地方"],
    grammar: [
      {role:'应答词',color:'#7c5cbf',phonetic:['/jes/'],pos:'肯定应答',meaning:'是的'},
      {role:'名词短语',color:'#3358e0',phonetic:['/naɪs/','/pleɪs/'],pos:'形容词+名词',meaning:'好地方'}
    ],
    explanations: [
      "`nice place` 是省略句（It's a nice place.），口语常省掉冠词。常见错误：\n• \"nice places\" → 指一处住所要用单数\n• \"a nice place\" → 更完整，省略句里也常见",
      "同义：Nice spot. / Great location."
    ],
    distractors: [["Yeah,","Yep,","Yup,"],["a nice place.","nice places.","nice play."]]
  },
  {
    sentence: "What's the rent?",
    cid: "af8e14de",
    translation: "房租多少？",
    chunks: ["What's","the rent?"],
    hints: ["（是）多少","房租"],
    grammar: [
      {role:'疑问词+系动词',color:'#c87033',phonetic:['/wʌts/'],pos:'what + is 缩写',meaning:'（是）多少'},
      {role:'主语',color:'#e74c7a',phonetic:['/ðə/','/rent/'],pos:'名词短语',meaning:'房租'}
    ],
    explanations: [
      "`What's` = What is，问价格。常见错误：\n• \"Whats\" → 少了撇号\n• \"How much the rent?\" → 更完整的问法是 How much is the rent?",
      "`rent` 表房租，可作名词也可作动词（rent a place）。"
    ],
    distractors: [["What","What're","What was"],["the rents?","a rent?","the rant?"]]
  },
  {
    sentence: "300 a week.",
    cid: "cd8300eb",
    translation: "一周三百。",
    chunks: ["300","a week."],
    hints: ["三百","一周"],
    grammar: [
      {role:'数词',color:'#c87033',phonetic:['/ˈθriː/','/ˈhʌndrəd/'],pos:'金额',meaning:'三百'},
      {role:'频率状语',color:'#7c5cbf',phonetic:['/ə/','/wiːk/'],pos:'per 的口语形式',meaning:'一周'}
    ],
    explanations: [
      "报价时省略货币单位（300 dollars a week）。常见错误：\n• \"300 in a week\" → 表频率不加 in\n• \"300 every week\" → 也对，但 a week 更简洁",
      "`a week` 在这里 = per week，表费率。同义：300 weekly. / 300 per week."
    ],
    distractors: [["300's","Three hundreds","3000"],["a weeks.","the week.","per weeks."]]
  },
  {
    sentence: "Sounds real nice.",
    cid: "7cccaf62",
    translation: "听起来不错。",
    chunks: ["Sounds","real nice."],
    hints: ["听起来","真的很不错"],
    grammar: [
      {role:'系动词',color:'#c87033',phonetic:['/saʊndz/'],pos:'sound 第三人称单数',meaning:'听起来'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈriːəl/','/naɪs/'],pos:'副词 + 形容词',meaning:'真的很不错'}
    ],
    explanations: [
      "`sound + 形容词` 表「听起来」。常见错误：\n• \"Sound real nice\" → 主语省略了 It，但要保留 -s 的第三人称单数\n• \"Sounds like nice\" → sound like 后面接名词",
      "口语里 `real` 常代替 really 作副词。常见错误：\n• 正式写作要用 really nice"
    ],
    distractors: [["Sound","Sounding","Sounds like"],["really nice.","real nicer.","real nicely."]]
  },
  {
    sentence: "Kids okay?",
    cid: "af4c7939",
    translation: "孩子们还好吗？",
    chunks: ["Kids","okay?"],
    hints: ["孩子们","还好吗"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/kɪdz/'],pos:'名词复数',meaning:'孩子们'},
      {role:'表语',color:'#3358e0',phonetic:['/ˌoʊˈkeɪ/'],pos:'形容词',meaning:'还好'}
    ],
    explanations: [
      "`Kids` 前省略了冠词 the（口语中很常见）。常见错误：\n• \"The kids\" → 更完整，问熟人家里的事时省略也自然\n• \"Kids is\" → 复数主语用 are（这里省略了）",
      "完整句是 Are the kids okay? 同义：How are the kids doing?"
    ],
    distractors: [["Kid","The kids","Kids is"],["OK?","okay at?","alright?"]]
  },
  {
    sentence: "Yeah, they're fine.",
    cid: "c0abf276",
    translation: "嗯，他们都好。",
    chunks: ["Yeah,","they're fine."],
    hints: ["嗯","他们都好"],
    grammar: [
      {role:'应答词',color:'#7c5cbf',phonetic:['/jeə/'],pos:'口语肯定词',meaning:'嗯'},
      {role:'主系表',color:'#c87033',phonetic:['/ðer/','/faɪn/'],pos:'they are 缩写 + 形容词',meaning:'他们都好'}
    ],
    explanations: [
      "`they're` = they are，注意和 their（他们的）、there（那里）区分。常见错误：\n• \"their fine\" → 同音但含义不同\n• \"they fine\" → 少了 be 动词",
      "`fine` 表「身体好、没问题」。同义：They're doing well."
    ],
    distractors: [["Yes,","Yep,","Yup,"],["they fine.","their fine.","they're find."]]
  },
  {
    sentence: "Thanks for asking.",
    cid: "93a0fe58",
    translation: "谢谢关心。",
    chunks: ["Thanks","for asking."],
    hints: ["谢谢","来问（关心）"],
    grammar: [
      {role:'致谢结构',color:'#e74c7a',phonetic:['/θæŋks/'],pos:'名词（复数形式固定）',meaning:'谢谢'},
      {role:'介词+动名词',color:'#7c5cbf',phonetic:['/fɔːr/','/ˈæskɪŋ/'],pos:'for + doing',meaning:'来问我'}
    ],
    explanations: [
      "`Thanks` 比 Thank you 更随意，常用于熟人间。常见错误：\n• \"Thank you for asking\" → 更正式，也对\n• \"Thanks for ask\" → 介词 for 后要用动名词",
      "`for + 动名词` 表感谢的原因。这个结构固定，不能换成不定式。"
    ],
    distractors: [["Thank","Thanks to","Thanks for"],["to ask.","for ask.","for asked."]]
  },
  {
    sentence: "I brought you apples.",
    cid: "f1405f3f",
    translation: "我给你带了苹果。",
    chunks: ["I brought","you apples."],
    hints: ["我带了","给你苹果"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/brɔːt/'],pos:'bring 的过去式',meaning:'我带了'},
      {role:'双宾语',color:'#3358e0',phonetic:['/juː/','/ˈæplz/'],pos:'间接宾语+直接宾语',meaning:'给你苹果'}
    ],
    explanations: [
      "`bring` 的过去式是 brought（不规则）。常见错误：\n• \"I bringed\" → 错，应作 brought\n• \"I bought\" → bought 是「买」，读音接近但意思不同",
      "`bring sb sth` 双宾语结构，等于 bring sth to sb（给你带了苹果）。常见错误：\n• \"bring you apple\" → 可数名词泛指要复数"
    ],
    distractors: [["I bring","I bought","I bringed"],["you apple.","your apples.","you an apples."]]
  },
  {
    sentence: "This is way too much.",
    cid: "13553af7",
    translation: "这太多了。",
    chunks: ["This is","way too much."],
    hints: ["这是","实在太多了"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ðɪs/','/ɪz/'],pos:'this + is',meaning:'这是'},
      {role:'程度状语',color:'#7c5cbf',phonetic:['/weɪ/','/tuː/','/mʌtʃ/'],pos:'way + too much',meaning:'实在太多了'}
    ],
    explanations: [
      "`way` 在口语里作程度副词，等于 much / far，表「远远地」。常见错误：\n• \"very too much\" → 不能用 very 修饰 too\n• \"way to much\" → 是 too 不是 to",
      "`too much` 修饰不可数；可数名词复数用 too many。常见错误：\n• \"too many\" 接 apples 才对"
    ],
    distractors: [["This are","These is","This be"],["way to much.","way too many.","very too much."]]
  },
  {
    sentence: "It's partly rotten.",
    cid: "2af7c066",
    translation: "有点坏了。",
    chunks: ["It's","partly rotten."],
    hints: ["它是","部分烂了"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/ɪts/'],pos:'it + is 缩写',meaning:'它是'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈpɑːrtli/','/ˈrɑːtn/'],pos:'副词 + 形容词',meaning:'部分腐烂的'}
    ],
    explanations: [
      "`partly` 表「部分地」，修饰形容词。常见错误：\n• \"part rotten\" → 少了 -ly 就变成名词修饰\n• \"partly rottened\" → rotten 已是形容词",
      "`rotten` 是 rot 的过去分词作形容词，表「腐烂的」。常见错误：\n• \"rot\" → 那是动词原形\n• 水果「有点坏」也可说 It's going bad."
    ],
    distractors: [["It","It's part","It has"],["part rotten.","partly rottened.","partly rot."]]
  },
  {
    sentence: "Bite that piece off.",
    cid: "2ca094db",
    translation: "把那块咬下来。",
    chunks: ["Bite","that piece off."],
    hints: ["咬","那一块下来"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/baɪt/'],pos:'祈使句动词',meaning:'咬'},
      {role:'宾语+副词',color:'#3358e0',phonetic:['/ðæt/','/piːs/','/ɔːf/'],pos:'名词短语 + off',meaning:'把那块咬下来'}
    ],
    explanations: [
      "`bite off` 是短语动词，表「咬下来」。常见错误：\n• \"Bite that piece\" → 少了 off，就没「咬掉」的意思\n• \"Bite off that piece\" → 也通，但名词较长时更常放中间",
      "祈使句用动词原形开头。常见错误：\n• \"Biting that piece off\" → 祈使句不带动名词"
    ],
    distractors: [["Biting","Bites","Bite to"],["that pieces off.","that piece of.","that piece on."]]
  },
  {
    sentence: "I took that job.",
    cid: "4cb79c53",
    translation: "我接受了那份工作。",
    chunks: ["I took","that job."],
    hints: ["我接了","那份工作"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/tʊk/'],pos:'take 的过去式',meaning:'我接了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðæt/','/dʒɑːb/'],pos:'名词短语',meaning:'那份工作'}
    ],
    explanations: [
      "`take a job` 表「接受一份工作」。常见错误：\n• \"I taked\" → take 是不规则动词，过去式是 took\n• \"took that job\" 与 \"got that job\" → got 强调「得到」，took 强调「接受」",
      "`job` 是可数名词，特指某份工作时用 that / the。常见错误：\n• \"that works\" → job 指职位，work 是不可数名词"
    ],
    distractors: [["I take","I taked","I taken"],["that jobs.","this job.","that work."]]
  },
  {
    sentence: "Good for you.",
    cid: "d43245c6",
    translation: "真不错（为你高兴）。",
    chunks: ["Good","for you."],
    hints: ["好","对你来说"],
    grammar: [
      {role:'表语',color:'#c87033',phonetic:['/ɡʊd/'],pos:'形容词（省略主语）',meaning:'好'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/fɔːr/','/juː/'],pos:'介词短语',meaning:'对你来说'}
    ],
    explanations: [
      "`Good for you` 是回应别人好消息的固定说法，表「为你高兴」。常见错误：\n• 理解成「对你有好处」→ 那是 Good for your health 之类的含义，语境不同\n• \"Good to you\" → 固定搭配用 for",
      "同义：Nice! / That's great! / I'm happy for you."
    ],
    distractors: [["Good at","Good to","Better"],["for your.","to you.","for yours."]]
  },
  {
    sentence: "It's close to me.",
    cid: "b45ed857",
    translation: "离我很近。",
    chunks: ["It's close","to me."],
    hints: ["它是近的","对我来说"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/kloʊs/'],pos:'it + is + 形容词',meaning:'它是近的'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/tə/','/miː/'],pos:'介词短语',meaning:'离我'}
    ],
    explanations: [
      "`close` 作形容词读 /kloʊs/，表「近的」。常见错误：\n• \"It's closed\" → closed 读 /kloʊzd/，是「关门的」，意思完全不同\n• \"near to me\" → near 作形容词时不加 to，或直接用 close to me",
      "`close to sb/sth` 表「离……近」。常见错误：\n• \"close me\" → 缺介词 to"
    ],
    distractors: [["It's closed","It's closest","It's close by"],["to my.","for me.","to mine."]]
  },
  {
    sentence: "The pay is good.",
    cid: "4eb3eb33",
    translation: "薪水不错。",
    chunks: ["The pay","is good."],
    hints: ["薪水","不错"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/ðə/','/peɪ/'],pos:'不可数名词',meaning:'薪水'},
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪz/','/ɡʊd/'],pos:'is + 形容词',meaning:'不错'}
    ],
    explanations: [
      "`pay` 表薪水时不可数，不加 s。常见错误：\n• \"the pays\" → 不可数名词\n• \"the salary is good\" → salary 指固定月薪，pay 更泛",
      "表语用形容词 good。常见错误：\n• \"is well\" → well 表身体好"
    ],
    distractors: [["The pay's","A pay","The paying"],["are good.","is well.","is good at."]]
  },
  {
    sentence: "You got a minute?",
    cid: "bc810920",
    translation: "你有空吗？",
    chunks: ["You got","a minute?"],
    hints: ["你有","一分钟（时间）"],
    alts: [null, ["a second?","a moment?"]],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/juː/','/ɡɑːt/'],pos:'Do you have 的口语省略',meaning:'你有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈmɪnɪt/'],pos:'名词短语',meaning:'一分钟（时间）'}
    ],
    explanations: [
      "口语省略 Do，用 got 代替 have：You got a minute? = Do you have a minute?。常见错误：\n• \"You got a minute.\" 降调 → 变陈述句\n• \"Have you got a minute?\" → 英式更常这么说",
      "`a minute` 在口语里泛指「一点时间」，不是真的六十秒。常见错误：\n• \"a minutes\" → 前面有 a 要用单数"
    ],
    distractors: [["You have got","You get","You got to"],["a minutes?","the minute?","a minit?"]]
  },
  {
    sentence: "Sure, what's up?",
    cid: "ddab755e",
    translation: "有，怎么了？",
    chunks: ["Sure,","what's up?"],
    hints: ["当然、有","怎么了"],
    grammar: [
      {role:'应答词',color:'#7c5cbf',phonetic:['/ʃʊr/'],pos:'口语肯定词',meaning:'当然、有'},
      {role:'疑问句',color:'#c87033',phonetic:['/wʌts/','/ʌp/'],pos:'what is up 缩写',meaning:'怎么了'}
    ],
    explanations: [
      "`Sure` 在回应请求时等于「当然可以」。常见错误：\n• \"Surely\" → 那是「确实、无疑」，语气不对\n• \"Of course\" → 更正式，也可以",
      "`What's up?` 是极常用的口语问候/询问，等于「怎么了／最近怎么样」。常见错误：\n• \"What up?\" → 少 is，非常随意\n• \"What's up.\" 降调读 → 语气会显得敷衍"
    ],
    distractors: [["OK,","Yep,","Yeah,"],["what's on?","what up?","what's new?"]]
  },
  {
    sentence: "I'm not on today.",
    cid: "a732da43",
    translation: "我今天不上班。",
    chunks: ["I'm not on","today."],
    hints: ["我今天不上（班）","今天"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/nɑːt/','/ɑːn/'],pos:'be + not + on',meaning:'我不在班'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/təˈdeɪ/'],pos:'时间副词',meaning:'今天'}
    ],
    explanations: [
      "`be on` 在排班语境里表「上班/值班」，否定就是 I'm not on。常见错误：\n• \"I'm not work today\" → 要说 I'm not working today\n• \"I'm not in today\" → 也可以，但 on 更常用于班表",
      "`today` 作时间状语放句末。常见错误：\n• \"on today\" → today 前不加介词"
    ],
    distractors: [["I'm not in","I'm no on","I'm not at"],["todays.","the today.","in today."]]
  },
  {
    sentence: "It's my day off.",
    cid: "1da8e217",
    translation: "我今天休息。",
    chunks: ["It's my","day off."],
    hints: ["这是我的","休息日"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/ɪts/','/maɪ/'],pos:'it + is + 所有格',meaning:'这是我的'},
      {role:'表语',color:'#3358e0',phonetic:['/deɪ/','/ɔːf/'],pos:'名词短语',meaning:'休息日'}
    ],
    explanations: [
      "`It's my` 注意 Its（它的）与 It's（它是）的区别。常见错误：\n• \"Its my day off\" → 少了撇号\n• \"It's mine day off\" → 有名词时用 my",
      "`day off` 是固定搭配，表「休息日」。常见错误：\n• \"day of\" → 少一个 f，意思变「……的一天」\n• \"off day\" → 那是「状态不好的一天」，语序不同"
    ],
    distractors: [["It's mine","It's me","It's my the"],["day of.","day offs.","days off."]]
  },
  {
    sentence: "Are you off tomorrow?",
    cid: "f2c5b8eb",
    translation: "你明天休息吗？",
    chunks: ["Are you","off tomorrow?"],
    hints: ["你是","明天休息吗"],
    grammar: [
      {role:'系动词+主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'倒装疑问',meaning:'你是'},
      {role:'表语+时间状语',color:'#7c5cbf',phonetic:['/ɔːf/','/təˈmɑːroʊ/'],pos:'off + 副词',meaning:'明天休息'}
    ],
    explanations: [
      "`be off` 在排班语境里表「休息」。常见错误：\n• \"Do you off tomorrow?\" → off 是形容词，要用 be 动词\n• \"Are you off work?\" → 更完整的说法，也对",
      "`tomorrow` 作时间状语不加介词。常见错误：\n• \"on tomorrow\" → 错，tomorrow 前不加介词"
    ],
    distractors: [["Do you","Are your","Is you"],["of tomorrow?","off tomorow?","on tomorrow?"]]
  },
  {
    sentence: "I don't work Friday.",
    cid: "dfcf2e40",
    translation: "我周五不上班。",
    chunks: ["I don't","work Friday."],
    hints: ["我不","周五上班"],
    grammar: [
      {role:'主语+助动词',color:'#e74c7a',phonetic:['/aɪ/','/doʊnt/'],pos:'do not 缩写',meaning:'我不'},
      {role:'谓语+时间状语',color:'#7c5cbf',phonetic:['/wɜːrk/','/ˈfraɪdeɪ/'],pos:'动词原形 + 星期',meaning:'周五上班'}
    ],
    explanations: [
      "一般现在时否定用 don't + 动词原形。常见错误：\n• \"I not work\" → 缺助动词\n• \"I doesn't work\" → I 配 don't",
      "口语里星期前的 on 常省略：work Friday = work on Friday。常见错误：\n• \"work in Friday\" → 用 on 或省略"
    ],
    distractors: [["I doesn't","I not","I don't works"],["works Friday.","working Friday.","worked Friday."]]
  },
  {
    sentence: "I've been so busy.",
    cid: "2e8d5895",
    translation: "我最近太忙了。",
    chunks: ["I've been","so busy."],
    hints: ["我一直","这么忙"],
    grammar: [
      {role:'主语+助动词',color:'#e74c7a',phonetic:['/aɪv/','/bɪn/'],pos:'现在完成时',meaning:'我一直（是）'},
      {role:'表语',color:'#3358e0',phonetic:['/soʊ/','/ˈbɪzi/'],pos:'副词 + 形容词',meaning:'这么忙'}
    ],
    explanations: [
      "`I've been + 形容词` 表「（从过去到现在）一直处于某状态」。常见错误：\n• \"I been so busy\" → 少了 've\n• \"I've being busy\" → being 用错，be 的过去分词是 been",
      "`so` 表「这么、那么」，加强语气。同义：I've been super busy. / I've been swamped."
    ],
    distractors: [["I been","I've being","I've be"],["so busily.","such busy.","so busier."]]
  },
  {
    sentence: "Sometimes I forget.",
    cid: "5010e8ef",
    translation: "有时候会忘。",
    chunks: ["Sometimes","I forget."],
    hints: ["有时候","我会忘"],
    grammar: [
      {role:'频度状语',color:'#7c5cbf',phonetic:['/ˈsʌmtaɪmz/'],pos:'频度副词',meaning:'有时候'},
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/fərˈɡet/'],pos:'一般现在时',meaning:'我会忘'}
    ],
    explanations: [
      "`sometimes` 写成一个词，表「有时候」。常见错误：\n• \"sometime\" → 那是「某个时候」，指不确定的一个时间点\n• \"some times\" → 那是「几次」，指次数",
      "频度副词可放句首或句中。常见错误：\n• \"I sometimes forget\" → 也同样正确"
    ],
    distractors: [["Sometime","Some times","Sometimes's"],["I forgets.","I forgetting.","I forgotten."]]
  },
  {
    sentence: "I can't put up with it.",
    cid: "3689d2d6",
    translation: "我受不了这个。",
    chunks: ["I can't","put up with it."],
    hints: ["我不能","忍受它"],
    grammar: [
      {role:'主语+情态',color:'#c87033',phonetic:['/aɪ/','/kænt/'],pos:'can not 缩写',meaning:'我不能'},
      {role:'固定表达',color:'#7c5cbf',phonetic:['/pʊt/','/ʌp/','/wɪð/','/ɪt/'],pos:'put up with 短语动词',meaning:'忍受它'}
    ],
    explanations: [
      "`can't` = cannot，表能力或不允许。常见错误：\n• \"I can't to put\" → 情态动词后不加 to\n• \"I can not\" → 分开写也可，但口语几乎都缩写",
      "`put up with` 是三个词组成的短语动词，意思是「忍受」，不能拆开理解。常见错误：\n• \"put up it\" → 缺 with\n• \"put with it\" → 缺 up\n按字面理解成「把……放上去」会完全跑偏"
    ],
    distractors: [["I can","I can't to","I cannot to"],["put up it.","put with it.","put up on it."]]
  },
  {
    sentence: "What's bothering you?",
    cid: "b088786f",
    translation: "什么事烦你了？",
    chunks: ["What's","bothering you?"],
    hints: ["什么（是）","烦着你的"],
    grammar: [
      {role:'疑问词+系动词',color:'#c87033',phonetic:['/wʌts/'],pos:'what + is 缩写',meaning:'什么（是）'},
      {role:'谓语+宾语',color:'#e74c7a',phonetic:['/ˈbɑːðərɪŋ/','/juː/'],pos:'现在进行时',meaning:'烦着你'}
    ],
    explanations: [
      "`bother` 表「打扰、使烦恼」。常见错误：\n• \"What's brother you?\" → brother 是「兄弟」，正确拼写是 bothering\n• \"What's bother you?\" → 进行时要用 -ing",
      "现在进行时表「此刻正在」。同义：What's wrong? / What's on your mind?"
    ],
    distractors: [["What","What're","What was"],["bother you?","bothering your?","bothers you?"]]
  },
  {
    sentence: "We're in a library.",
    cid: "d99feea8",
    translation: "我们在图书馆。",
    chunks: ["We're in","a library."],
    hints: ["我们在","一个图书馆"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/wɪr/','/ɪn/'],pos:'we are 缩写 + 介词',meaning:'我们在'},
      {role:'介词宾语',color:'#3358e0',phonetic:['/ə/','/ˈlaɪbreri/'],pos:'名词短语',meaning:'一个图书馆'}
    ],
    explanations: [
      "`We're` = we are，注意与 Were（are 的过去式）区分。常见错误：\n• \"Were in a library\" → 少了撇号就成过去时陈述\n• \"We in a library\" → 缺 be 动词",
      "`library` 注意拼写，中间是 -brar-。常见错误：\n• \"librery\" / \"libary\" → 常见拼错\n• \"a libraries\" → 前有 a 用单数"
    ],
    distractors: [["We in","We was in","We're at"],["a libraries.","the library.","an library."]]
  },
  {
    sentence: "You're talking too loudly.",
    cid: "05cc4c9b",
    translation: "你说话太大声了。",
    chunks: ["You're talking","too loudly."],
    hints: ["你说话","太大声"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/jʊr/','/ˈtɔːkɪŋ/'],pos:'you are + 现在分词',meaning:'你正在说'},
      {role:'程度状语',color:'#7c5cbf',phonetic:['/tuː/','/ˈlaʊdli/'],pos:'副词',meaning:'太大声'}
    ],
    explanations: [
      "`You're` = you are，注意区分 your（你的）。常见错误：\n• \"Your talking too loudly\" → Your 是形容词，不能构成进行时\n• \"You talking\" → 口语可省略，但书面要写 You are",
      "`too` 表「过于」，修饰副词再 -ly。常见错误：\n• \"to loudly\" → 是 too 不是 to\n• \"too loud\" → 也可，但修饰 talking 用副词 loudly"
    ],
    distractors: [["You talking","Your talking","You're talk"],["to loudly.","too loudness.","too louder."]]
  },
  {
    sentence: "Keep it down.",
    cid: "c3dee22f",
    translation: "小声点。",
    chunks: ["Keep","it down."],
    hints: ["保持","声音低"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/kiːp/'],pos:'祈使句动词',meaning:'保持'},
      {role:'宾语+补语',color:'#3358e0',phonetic:['/ɪt/','/daʊn/'],pos:'keep + 宾语 + 副词',meaning:'把声音压低'}
    ],
    explanations: [
      "`keep sth down` 表「把（音量）压低」。常见错误：\n• \"Keep down it\" → 代词要放 keep 和 down 中间\n• \"Keep it up\" → up 意思是「继续保持」，正好相反",
      "祈使句用动词原形。同义：Lower your voice. / Quiet down."
    ],
    distractors: [["Keeping","Keeps","Keep to"],["it up.","it low.","it downs."]]
  },
  {
    sentence: "I'm trying to study.",
    cid: "744c4681",
    translation: "我在学习。",
    chunks: ["I'm trying","to study."],
    hints: ["我在努力","学习"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪm/','/ˈtraɪɪŋ/'],pos:'try 的进行时',meaning:'我在努力'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/ˈstʌdi/'],pos:'try to do',meaning:'学习'}
    ],
    explanations: [
      "`try to do sth` 表「努力做某事」。常见错误：\n• \"I trying\" → 缺 am\n• \"try studying\" → try doing 表「试试看（方法）」，语义不同",
      "进行时表「此刻正在」。同义：I'm studying. / I'm hitting the books."
    ],
    distractors: [["I trying","I'm try","I tries"],["to studying.","to studied.","to studies."]]
  },
  {
    sentence: "My test is tomorrow.",
    cid: "f8afdcf8",
    translation: "我明天有考试。",
    chunks: ["My test","is tomorrow."],
    hints: ["我的考试","在明天"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/maɪ/','/test/'],pos:'名词短语',meaning:'我的考试'},
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪz/','/təˈmɑːroʊ/'],pos:'is + 副词',meaning:'是在明天'}
    ],
    explanations: [
      "英语用 be + 时间词表达「某事在某时」。常见错误：\n• \"My test is in tomorrow\" → tomorrow 前不加介词\n• \"My test are tomorrow\" → test 单数用 is",
      "`test` 指考试、测验。同义：I have a test tomorrow."
    ],
    distractors: [["My tests","Mine test","My test are"],["are tomorrow.","in tomorrow.","on tomorrow."]]
  },
  {
    sentence: "You'll be fine.",
    cid: "85107210",
    translation: "你会没事的。",
    chunks: ["You'll","be fine."],
    hints: ["你会","没事"],
    grammar: [
      {role:'主语+助动词',color:'#c87033',phonetic:['/juːl/'],pos:'you will 缩写',meaning:'你会'},
      {role:'系表',color:'#e74c7a',phonetic:['/bi/','/faɪn/'],pos:'will be + 形容词',meaning:'没事'}
    ],
    explanations: [
      "`You'll` = you will，表安慰性的预测。常见错误：\n• \"You'll be fine.\" 写成 \"Your be fine\" → Your 是所有格\n• \"You will be fine\" → 不缩写也可以，语气更正式",
      "`fine` 表「没问题、没事」。同义：You'll do great. / You'll be okay."
    ],
    distractors: [["You","You're","You will be"],["be find.","being fine.","be finely."]]
  },
  {
    sentence: "You're in charge.",
    cid: "5a4799a1",
    translation: "你说了算。",
    chunks: ["You're","in charge."],
    hints: ["你是","负责的"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/jʊr/'],pos:'you are 缩写',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/ɪn/','/tʃɑːrdʒ/'],pos:'介词短语（固定）',meaning:'负责的'}
    ],
    explanations: [
      "`be in charge` 是固定短语，表「负责、主管」。常见错误：\n• \"in charged\" → charge 在此不加 ed\n• \"in the charge\" → 加 the 后意思变成「在……看管下」，正好相反",
      "`You're in charge` 口语里也可表「你说了算」。同义：It's up to you. / You're the boss."
    ],
    distractors: [["Your","You","You've"],["in charged.","in charge of.","in the charge."]]
  },
  {
    sentence: "I've got this.",
    cid: "e70c8cf4",
    translation: "我可以的。",
    chunks: ["I've got","this."],
    hints: ["我能搞定","这件事"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪv/','/ɡɑːt/'],pos:'have got 缩写',meaning:'我能搞定'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðɪs/'],pos:'指示代词',meaning:'这件事'}
    ],
    explanations: [
      "`I've got this` 是口语鼓励自己的固定说法，表「我能应付」。常见错误：\n• \"I got this\" → 也可以，语气更随意\n• \"I've got this to\" → 加 to 意思就变「我不得不处理这个」",
      "同义：I got it. / I can handle it. / I'm on it."
    ],
    distractors: [["I got","I've get","I've got to"],["that.","these.","this's."]]
  },
  {
    sentence: "You really changed.",
    cid: "b8116edf",
    translation: "你真的变了。",
    chunks: ["You really","changed."],
    hints: ["你真的","变了"],
    grammar: [
      {role:'主语+状语',color:'#c87033',phonetic:['/juː/','/ˈriːəli/'],pos:'副词修饰谓语',meaning:'你真的'},
      {role:'谓语',color:'#e74c7a',phonetic:['/tʃeɪndʒd/'],pos:'一般过去时',meaning:'变了'}
    ],
    explanations: [
      "`really` 修饰谓语时放在实义动词之前。常见错误：\n• \"You changed really\" → 语序错，副词不能放句末表程度\n• \"You real changed\" → 要用 really，real 是形容词",
      "`changed` 用过去式表「已经发生了变化」。常见错误：\n• \"You are changed\" → 也可表被动，但口语直接说 changed 更自然"
    ],
    distractors: [["You real","You really's","You really are"],["change.","changing.","changeed."]]
  },
  {
    sentence: "I'm so proud of you.",
    cid: "9e2532fc",
    translation: "我为你骄傲。",
    chunks: ["I'm so","proud of you."],
    hints: ["我非常","为你骄傲"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/aɪm/','/soʊ/'],pos:'be + so',meaning:'我非常'},
      {role:'表语',color:'#3358e0',phonetic:['/praʊd/','/əv/','/juː/'],pos:'be proud of 固定搭配',meaning:'为你骄傲'}
    ],
    explanations: [
      "`so` 修饰形容词，表程度。常见错误：\n• \"I so proud\" → 缺 be 动词\n• \"I'm such proud\" → such 后接名词短语",
      "`be proud of sb` 是固定搭配，介词用 of。常见错误：\n• \"proud for you\" → 不用 for\n• \"proud at you\" → 不用 at"
    ],
    distractors: [["I so","I'm very","I'm such"],["proud for you.","proud at you.","proud of your."]]
  },
  {
    sentence: "Don't beat yourself up.",
    cid: "21f94209",
    translation: "别太苛责自己。",
    chunks: ["Don't","beat yourself up."],
    hints: ["不要","责备你自己"],
    grammar: [
      {role:'祈使句(否定)',color:'#e74c7a',phonetic:['/doʊnt/'],pos:'do not 缩写',meaning:'不要'},
      {role:'固定表达',color:'#7c5cbf',phonetic:['/biːt/','/jərˈself/','/ʌp/'],pos:'beat oneself up 习语',meaning:'苛责自己'}
    ],
    explanations: [
      "否定祈使句用 Don't + 动词原形。常见错误：\n• \"Doesn't beat\" → 祈使句用 don't\n• \"Not beat\" → 缺助动词",
      "`beat yourself up` 是习语，表「过度自责」，与「打自己」无关。常见错误：\n• \"beat up yourself\" → 反身代词要放中间\n• \"beat yourself\" → 少了 up，习语不成立"
    ],
    distractors: [["Doesn't","Don't to","Not"],["beat up yourself.","beat yourself on.","beat yours up."]]
  },
  {
    sentence: "You matter to me.",
    cid: "fb895572",
    translation: "你对我很重要。",
    chunks: ["You matter","to me."],
    hints: ["你很重要","对我来说"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/juː/','/ˈmætər/'],pos:'matter 作动词',meaning:'你很重要'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/tə/','/miː/'],pos:'介词短语',meaning:'对我来说'}
    ],
    explanations: [
      "`matter` 作动词表「要紧、重要」。常见错误：\n• \"You matters\" → 主语 you 用原形\n• \"You are matter\" → be 与动词混用",
      "`matter to sb` 表「对某人重要」。常见错误：\n• \"matter for me\" → 固定介词是 to"
    ],
    distractors: [["You matters","You mattering","Your matter"],["to my.","for me.","to mine."]]
  },
  {
    sentence: "Just keep going.",
    cid: "de2d0d34",
    translation: "继续坚持。",
    chunks: ["Just","keep going."],
    hints: ["只管","继续走下去"],
    grammar: [
      {role:'程度/语气词',color:'#7c5cbf',phonetic:['/dʒʌst/'],pos:'副词（弱化语气）',meaning:'只管、就'},
      {role:'祈使句',color:'#e74c7a',phonetic:['/kiːp/','/ˈɡoʊɪŋ/'],pos:'keep doing 固定结构',meaning:'继续走'}
    ],
    explanations: [
      "`just` 在此弱化语气，表「就这样、只管」，不是「刚刚」。常见错误：\n• \"Only keep going\" → Only 表「只有」，语气不对",
      "`keep doing sth` 表「持续做某事」，固定接动名词。常见错误：\n• \"keep to go\" → 不能接不定式\n• \"keep go\" → 少了 -ing"
    ],
    distractors: [["Only","Justly","Just to"],["keep to go.","keep go.","keep going to."]]
  },
  {
    sentence: "I've been there.",
    cid: "cd379d3e",
    translation: "我是过来人。",
    chunks: ["I've been","there."],
    hints: ["我去过（经历过）","那里"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪv/','/bɪn/'],pos:'现在完成时',meaning:'我去过'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ðer/'],pos:'副词',meaning:'那里'}
    ],
    explanations: [
      "`I've been there` 字面是「我去过那里」，引申为「我也经历过、我懂你」。常见错误：\n• \"I been there\" → 少了 've\n• \"I've gone there\" → gone 强调去了没回，表「经历过」用 been",
      "这是安慰别人时的高频共情表达。同义：I know the feeling. / Been there."
    ],
    distractors: [["I been","I've being","I've be"],["here.","their.","there's."]]
  },
  {
    sentence: "You're nice to me.",
    cid: "09c464f6",
    translation: "你对我真好。",
    chunks: ["You're nice","to me."],
    hints: ["你很好","对我"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/jʊr/','/naɪs/'],pos:'you are + 形容词',meaning:'你很好'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/tə/','/miː/'],pos:'介词短语',meaning:'对我'}
    ],
    explanations: [
      "`You're` = you are，别和 your（你的）搞混。常见错误：\n• \"Your nice to me\" → Your 不能构成主系表\n• \"You're nicely to me\" → 表语要用形容词 nice",
      "`be nice to sb` 是固定搭配，介词用 to。常见错误：\n• \"nice for me\" → 对人态度用 to"
    ],
    distractors: [["Your nice","You nice","You're nicely"],["to my.","for me.","to mine."]]
  },
  {
    sentence: "You got it.",
    cid: "86ff7ccf",
    translation: "应该的。",
    chunks: ["You got","it."],
    hints: ["你拿到了","它"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/juː/','/ɡɑːt/'],pos:'口语省略 did',meaning:'你（做）到了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɪt/'],pos:'代词',meaning:'它'}
    ],
    explanations: [
      "`You got it` 回应感谢时表「应该的、小意思」。常见错误：\n• 用降调读 → 才表「没问题/包在我身上」，两种含义靠语境区分\n• \"You get it\" → 那是「你明白了」",
      "同义：No problem. / Anytime. / My pleasure."
    ],
    distractors: [["You get","You got to","You've got"],["that.","them.","it's."]]
  },
  {
    sentence: "I'm here for you.",
    cid: "9042ad50",
    translation: "我陪你。",
    chunks: ["I'm here","for you."],
    hints: ["我在这儿","为你"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/hɪr/'],pos:'be + here',meaning:'我在这儿'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/fɔːr/','/juː/'],pos:'介词短语',meaning:'为你'}
    ],
    explanations: [
      "`be here for sb` 表「陪着你、支持你」。常见错误：\n• \"I'm here to you\" → 固定搭配用 for\n• \"I hear for you\" → hear 是「听见」，同音但意思完全不同",
      "同义：I've got your back. / I'm with you."
    ],
    distractors: [["I here","I'm hear","I'm here to"],["for your.","to you.","for yours."]]
  },
  {
    sentence: "I'm willing to help.",
    cid: "529f6b92",
    translation: "我愿意帮忙。",
    chunks: ["I'm willing","to help."],
    hints: ["我愿意","帮忙"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪm/','/ˈwɪlɪŋ/'],pos:'be willing 固定用法',meaning:'我愿意'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/help/'],pos:'不定式',meaning:'帮忙'}
    ],
    explanations: [
      "`be willing to do` 表「愿意做某事」，willing 是形容词。常见错误：\n• \"I'm will to help\" → will 是情态动词，形容词形式是 willing\n• \"I willing to help\" → 缺 am",
      "同义：I'd be happy to help. / I'm glad to help."
    ],
    distractors: [["I willing","I'm will","I'm willing for"],["to helping.","to helped.","to helps."]]
  },
  {
    sentence: "I'm not feeling well.",
    cid: "b9af65ab",
    translation: "我不舒服。",
    chunks: ["I'm not","feeling well."],
    hints: ["我不","感觉好"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/aɪm/','/nɑːt/'],pos:'be + not',meaning:'我不'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈfiːlɪŋ/','/wel/'],pos:'feel well 进行时',meaning:'感觉好'}
    ],
    explanations: [
      "否定词 not 放在 be 之后。常见错误：\n• \"I not feeling well\" → 缺 am\n• \"I don't feeling well\" → 有 be 动词时不再用 don't",
      "`feel well` 中 well 是副词，表身体健康。常见错误：\n• \"feel good\" → 表情绪好、感觉不错，说身体不舒服要用 well\n这是英语里最容易混的一组：身体用 well，心情用 good"
    ],
    distractors: [["I not","I'm no","I don't"],["feeling good.","feel well.","feeling goodly."]]
  },
  {
    sentence: "Can I go home early?",
    cid: "475674ed",
    translation: "我能早点回家吗？",
    chunks: ["Can I","go home early?"],
    hints: ["我能","早点回家吗"],
    grammar: [
      {role:'情态+主语',color:'#c87033',phonetic:['/kæn/','/aɪ/'],pos:'can 引导疑问',meaning:'我能'},
      {role:'谓语+状语',color:'#e74c7a',phonetic:['/ɡoʊ/','/hoʊm/','/ˈɜːrli/'],pos:'go home + 副词',meaning:'早点回家'}
    ],
    explanations: [
      "`Can I ...?` 是请求许可的常用句型。常见错误：\n• \"Do I can go\" → 情态动词直接提前，不用 do\n• \"Can me go\" → 主语用主格 I",
      "`go home` 固定不加 to（home 作副词）。常见错误：\n• \"go to home\" → 错，go home 才是对的\n• \"early\" 是副词，修饰 go"
    ],
    distractors: [["Can me","Do I can","Can I to"],["go to home early?","go home earlily?","go home earlies?"]]
  },
  {
    sentence: "Did you eat something bad?",
    cid: "1d4b7d2d",
    translation: "你是不是吃坏东西了？",
    chunks: ["Did you","eat something","bad?"],
    hints: ["你是否","吃了什么","不好的"],
    grammar: [
      {role:'助动词+主语',color:'#c87033',phonetic:['/dɪd/','/juː/'],pos:'一般过去时疑问',meaning:'你是否'},
      {role:'谓语+宾语',color:'#e74c7a',phonetic:['/iːt/','/ˈsʌmθɪŋ/'],pos:'动词原形 + 不定代词',meaning:'吃了什么'},
      {role:'定语',color:'#3358e0',phonetic:['/bæd/'],pos:'形容词后置',meaning:'不好的'}
    ],
    explanations: [
      "有 did 时动词用原形。常见错误：\n• \"Did you ate\" → 用 eat\n• \"Did your eat\" → 主语用 you",
      "`something bad` 是形容词后置修饰不定代词。常见错误：\n• \"bad something\" → 修饰 something 时形容词必须放后面",
      "`bad` 修饰 something 作定语。同义：Did you eat anything bad? / Was it something you ate?"
    ],
    distractors: [["Do you","Did your","Does you"],["eat somethings","eating something","eats something"],["badly?","badder?","a bad?"]]
  },
  {
    sentence: "Hope you're feeling better.",
    cid: "d989d51c",
    translation: "希望你好点了。",
    chunks: ["Hope","you're feeling","better."],
    hints: ["希望","你感觉","好些了"],
    grammar: [
      {role:'谓语（省略主语）',color:'#e74c7a',phonetic:['/hoʊp/'],pos:'省略 I 的口语',meaning:'希望'},
      {role:'主谓',color:'#c87033',phonetic:['/jʊr/','/ˈfiːlɪŋ/'],pos:'you are + 现在分词',meaning:'你感觉'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈbetər/'],pos:'形容词比较级',meaning:'好些'}
    ],
    explanations: [
      "口语省略主语 I，直接以 Hope 开头。常见错误：\n• \"Hoping you're feeling better\" → 句子不能以动名词开头当谓语\n• \"I hope you feeling better\" → 从句里缺 are",
      "`better` 是 well 的比较级，表「好一些」。常见错误：\n• \"more better\" → 比较级不叠用",
      "同义：Hope you feel better soon."
    ],
    distractors: [["Hoping","Hopes","I hope"],["your feeling","you feeling","you're feel"],["good.","best.","weller."]]
  },
  {
    sentence: "I couldn't sleep.",
    cid: "81537529",
    translation: "我没睡着。",
    chunks: ["I couldn't","sleep."],
    hints: ["我没能","睡着"],
    grammar: [
      {role:'主语+情态',color:'#c87033',phonetic:['/aɪ/','/ˈkʊdnt/'],pos:'could not 缩写',meaning:'我没能'},
      {role:'谓语',color:'#e74c7a',phonetic:['/sliːp/'],pos:'动词原形',meaning:'睡着'}
    ],
    explanations: [
      "`couldn't` = could not，注意拼写是 couldn't，不是 could'nt。常见错误：\n• \"I could't sleep\" → 漏了 n\n• \"I couldn't to sleep\" → 情态动词后不加 to",
      "`sleep` 在此表「入睡」。常见错误：\n• \"I couldn't sleeping\" → 情态动词后接原形\n同义：I couldn't fall asleep."
    ],
    distractors: [["I couldn't to","I can't","I didn't could"],["sleeping.","slept.","sleepy."]]
  },
  {
    sentence: "I was up till one.",
    cid: "e72891e5",
    translation: "我熬到一点。",
    chunks: ["I was up","till one."],
    hints: ["我还没睡","一直到一点"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/aɪ/','/wʌz/','/ʌp/'],pos:'be up 表醒着',meaning:'我还没睡'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/tɪl/','/wʌn/'],pos:'介词短语',meaning:'一直到一点'}
    ],
    explanations: [
      "`be up` 表「还没睡、醒着」。常见错误：\n• \"I was up to one\" → 加 to 后意思变「我能做……」，这里 till 表一直到\n• \"I up till one\" → 缺 was",
      "`till` = until 的口语形式，接时间点。常见错误：\n• \"till to one\" → till 后面不加 to\n• one 表示「一点钟」，读 /wʌn/"
    ],
    distractors: [["I up","I was up to","I were up"],["till on.","till ones.","till once."]]
  },
  {
    sentence: "I went to bed early.",
    cid: "4231de9f",
    translation: "我睡得早。",
    chunks: ["I went","to bed early."],
    hints: ["我去了","早睡"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/went/'],pos:'go 的过去式',meaning:'我去了'},
      {role:'状语',color:'#7c5cbf',phonetic:['/tə/','/bed/','/ˈɜːrli/'],pos:'go to bed + 副词',meaning:'上床睡觉（早）'}
    ],
    explanations: [
      "`go` 的过去式是 went。常见错误：\n• \"I gone to bed\" → gone 要配 have\n• \"I was went\" → 两个过去形式不能叠用",
      "`go to bed` 是固定搭配，指「上床睡觉」，不加冠词。常见错误：\n• \"go to the bed\" → 那是「走到那张床旁边」\n• \"early\" 是副词，修饰整个动作"
    ],
    distractors: [["I go","I gone","I was went"],["to the bed early.","to bed earlily.","to bed late."]]
  },
  {
    sentence: "I got up late.",
    cid: "e13305a9",
    translation: "我起晚了。",
    chunks: ["I got up","late."],
    hints: ["我起来了","晚"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/ɡɑːt/','/ʌp/'],pos:'get up 的过去式',meaning:'我起来了'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/leɪt/'],pos:'副词',meaning:'晚'}
    ],
    explanations: [
      "`get up` 的过去式是 got up。常见错误：\n• \"I gotten up\" → gotten 要和 have 连用\n• \"I got\" → 少了 up，意思变「我得到」",
      "`late` 是副词，直接修饰 got up。常见错误：\n• \"lately\" → 那是「最近」，不是「晚」\n• \"later\" → 那是「稍后」"
    ],
    distractors: [["I get up","I got","I gotten up"],["later.","lately.","latly."]]
  },
  {
    sentence: "Get some more rest.",
    cid: "c093035a",
    translation: "多休息一下。",
    chunks: ["Get some","more rest."],
    hints: ["获得一些","更多的休息"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/ɡet/','/sʌm/'],pos:'祈使句 + 限定词',meaning:'获得一些'},
      {role:'宾语',color:'#3358e0',phonetic:['/mɔːr/','/rest/'],pos:'比较级 + 不可数名词',meaning:'更多的休息'}
    ],
    explanations: [
      "`get some rest` 是固定说法，表「休息一下」。常见错误：\n• \"Get any rest\" → 劝人时用 some，any 多用于疑问/否定\n• \"Take some rest\" → 也可以，但 get some rest 更口语",
      "`rest` 在此不可数，用 more 修饰。常见错误：\n• \"more rests\" → 不可数不加 s\n• \"much rest\" → 这是「很多休息」，而这里要「再多一点」"
    ],
    distractors: [["Get any","Got some","Get some more"],["more rests.","much rest.","more resting."]]
  },
  {
    sentence: "Sleep is important.",
    cid: "b134e4b0",
    translation: "睡眠很重要。",
    chunks: ["Sleep","is important."],
    hints: ["睡眠","是重要的"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/sliːp/'],pos:'不可数名词作主语',meaning:'睡眠'},
      {role:'主系表',color:'#e74c7a',phonetic:['/ɪz/','/ɪmˈpɔːrtnt/'],pos:'is + 形容词',meaning:'是重要的'}
    ],
    explanations: [
      "`sleep` 作名词时不可数，单独作主语用单数谓语。常见错误：\n• \"The sleep\" → 泛指睡眠不加冠词\n• \"Sleeping is important\" → 动名词也可以，但名词 sleep 更简洁",
      "表语用形容词 important。常见错误：\n• \"is importance\" → importance 是名词\n• \"is importantly\" → 那是副词，表语位置用形容词"
    ],
    distractors: [["Sleeping","Sleeps","The sleep"],["is importance.","are important.","is importantly."]]
  },
  {
    sentence: "Go clean up.",
    cid: "bb4983d7",
    translation: "去洗漱吧。",
    chunks: ["Go","clean up."],
    hints: ["去","收拾干净"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/'],pos:'祈使句动词',meaning:'去'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/kliːn/','/ʌp/'],pos:'短语动词 clean up',meaning:'收拾、洗漱干净'}
    ],
    explanations: [
      "`clean up` 是「把自己收拾干净」的短语动词，`up` 是固定成分。常见错误：\n• \"Go clean **yourself** up\" → 口语里针对自己时一般直接说 clean up\n• \"Go **to** clean up\" → 祈使句后直接跟动词原形，不加 to",
      "祈使句用动词原形，主语 you 不出现。对比 `wash up`：warm water 洗手洗脸，clean up 更泛。"
    ],
    distractors: [["Come","Get","Come on"],["cleans up.","clean on.","clean out."]]
  },
  {
    sentence: "Go wash up.",
    cid: "2684aa5f",
    translation: "去洗把脸、洗把手。",
    chunks: ["Go","wash up."],
    hints: ["去","洗洗（手脸）"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/'],pos:'祈使句动词',meaning:'去'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/wɑːʃ/','/ʌp/'],pos:'短语动词 wash up',meaning:'洗手洗脸'}
    ],
    explanations: [
      "`wash up` 在美式英语指「洗手洗脸」，英式还可指「洗碗」。常见错误：\n• \"Go wash up **you**\" → 反身代词多余，祈使句本身已隐含 you\n• \"Go **to** wash up\" → 祈使句后不加 to",
      "与 `clean up` 的区别：wash up 专指用水洗，clean up 泛指收拾弄干净。"
    ],
    distractors: [["Come","Get","Come in"],["washes up.","wash it up.","wash out."]]
  },
  {
    sentence: "Rinse your mouth.",
    cid: "c0af9f50",
    translation: "漱漱口。",
    chunks: ["Rinse","your mouth."],
    hints: ["冲洗","你的嘴"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/rɪns/'],pos:'祈使句动词',meaning:'冲洗、漱'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/maʊθ/'],pos:'名词短语',meaning:'你的嘴'}
    ],
    explanations: [
      "`rinse` 指用清水冲、漱，词尾是清音 /s/。常见错误：\n• 把 rinse 读成 /rɪnz/ → 动词原形清音，加了 -d 才浊化\n• \"Rinse your mouth water\" → 要喝水一起说就说 with water",
      "用漱口水则是 `rinse with mouthwash`，漱口水这个词本身是 mouthwash。"
    ],
    distractors: [["Rinse out","Wash","Clean out"],["your mouths.","you mouth.","your mouthing."]]
  },
  {
    sentence: "Rinse out your mouth.",
    cid: "5d687bf0",
    translation: "把嘴漱干净。",
    chunks: ["Rinse out","your mouth."],
    hints: ["漱干净","你的嘴"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/rɪns/','/aʊt/'],pos:'短语动词 rinse out',meaning:'漱干净'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/maʊθ/'],pos:'名词短语',meaning:'你的嘴'}
    ],
    explanations: [
      "`rinse out` 强调「漱干净、冲掉残留」，out 表彻底。常见错误：\n• \"Rinse out **of** your mouth\" → out 后面不接 of\n• \"Rinse out your mouths\" → 一个人只有一张嘴，用单数",
      "对比 `rinse`：加 out 有「冲干净」的结果意味；宾语是代词时要说 rinse it out。"
    ],
    distractors: [["Rinse of","Rinsing out","Rinse from"],["your mouths.","you mouth.","your mouth out."]]
  },
  {
    sentence: "Gargle with water.",
    cid: "3c1a2036",
    translation: "用水漱漱喉咙。",
    chunks: ["Gargle","with water."],
    hints: ["漱喉","用水"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈɡɑːrɡl/'],pos:'祈使句动词（不及物）',meaning:'漱喉咙'},
      {role:'方式状语',color:'#7c5cbf',phonetic:['/wɪð/','/ˈwɔːtər/'],pos:'介词短语',meaning:'用水'}
    ],
    explanations: [
      "`gargle` 专指「含一口水在喉咙里咕噜」，比 rinse 更具体，且是不及物动词。常见错误：\n• \"Gargle water\" → 漏了 with\n• 记住拼写：gargle → gargling（不双写 l）",
      "常见搭配：gargle with salt water（用盐水漱口），嗓子疼时常说。"
    ],
    distractors: [["Gargles","Swallow","Gargle out"],["with a water.","with waters.","by water."]]
  },
  {
    sentence: "Rinse it.",
    cid: "af665333",
    translation: "冲一冲。",
    chunks: ["Rinse","it."],
    hints: ["冲洗","它"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/rɪns/'],pos:'祈使句动词',meaning:'冲洗'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɪt/'],pos:'人称代词宾格',meaning:'它'}
    ],
    explanations: [
      "杯子、菜、手上沾了泡沫都能说 `Rinse it.` 常见错误：\n• \"Rinse it clean\" → 想说「冲到干净」应说 Rinse it until clean\n• \"Rinse out it\" → 代词不能放在 out 后面，要说 rinse it out",
      "代词作宾语放动词后：rinse it / rinse them，不能先说 it。"
    ],
    distractors: [["Rinses","Rinsing","Rinse from"],["them.","its.","it is."]]
  },
  {
    sentence: "Take a shower.",
    cid: "b9c23335",
    translation: "洗个澡。",
    chunks: ["Take a","shower."],
    hints: ["洗","淋浴"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ə/'],pos:'动词短语 take a shower',meaning:'洗（澡）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈʃaʊər/'],pos:'名词',meaning:'淋浴'}
    ],
    explanations: [
      "`take a shower` 是「洗淋浴」的固定搭配，泡澡用 `take a bath`。常见错误：\n• \"Wash a shower\" → wash 的宾语应是身体或衣物，不是淋浴设备\n• \"Take shower\" → 可数名词单数前要加 a",
      "同义：have a shower（英式更常用）。"
    ],
    distractors: [["Make a","Take the","Have the"],["show.","showers.","showering."]]
  },
  {
    sentence: "Dry your hands.",
    cid: "73504ae3",
    translation: "把手擦干。",
    chunks: ["Dry","your hands."],
    hints: ["擦干","你的手"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/draɪ/'],pos:'祈使句动词',meaning:'弄干'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/hændz/'],pos:'名词短语',meaning:'你的手'}
    ],
    explanations: [
      "`dry` 可以直接作动词，表示「弄干」。常见错误：\n• \"Dry your hand\" → 两只手用复数 hands\n• \"Make your hands dry\" → 啰嗦，dry 本身就能当动词",
      "同类：dry your hair（擦干头发）/ dry the clothes（晾干衣服）。"
    ],
    distractors: [["Dries","Drying","Dry up"],["your hand.","you hands.","your hands of."]]
  },
  {
    sentence: "Go to the bathroom.",
    cid: "54764003",
    translation: "去上厕所。",
    chunks: ["Go to","the bathroom."],
    hints: ["去","洗手间"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/','/tuː/'],pos:'动词短语',meaning:'去往'},
      {role:'地点宾语',color:'#3358e0',phonetic:['/ðə/','/ˈbæθruːm/'],pos:'名词短语（带定冠词）',meaning:'洗手间'}
    ],
    explanations: [
      "`bathroom` 是美式「洗手间」的礼貌说法；英式常用 toilet/loo。常见错误：\n• \"Go to bathroom\" → 漏定冠词 the\n• 美音读 /ˈbæθruːm/，英音才是 /ˈbɑːθruːm/",
      "委婉说法：use the restroom / go to the loo / excuse me for a moment。"
    ],
    distractors: [["Go in","Go at","Go for"],["the bath.","a bathroom.","the bathrooms."]]
  },
  {
    sentence: "Have some tea.",
    cid: "edb7eb4b",
    translation: "喝点茶。",
    chunks: ["Have some","tea."],
    hints: ["喝点","茶"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/hæv/','/sʌm/'],pos:'动词 + 限定词',meaning:'喝点'},
      {role:'宾语',color:'#3358e0',phonetic:['/tiː/'],pos:'不可数名词',meaning:'茶'}
    ],
    explanations: [
      "招待、建议喝什么时用 `have` 比 `drink` 更自然。常见错误：\n• \"Eat some tea\" → 喝用 have / drink，不跟 eat\n• \"Have some teas\" → tea 指饮料时不可数，不加 s",
      "同类：have some coffee / have some juice；「来杯茶」也可说 have a cup of tea。"
    ],
    distractors: [["Have any","Eat some","Having some"],["teas.","tea is.","the tea of."]]
  },
  {
    sentence: "Get out of bed.",
    cid: "e0bd95bb",
    translation: "起床了。",
    chunks: ["Get out of","bed."],
    hints: ["从……出来","床"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/aʊt/','/əv/'],pos:'短语动词 get out of',meaning:'从……出来'},
      {role:'宾语',color:'#3358e0',phonetic:['/bed/'],pos:'名词（表用途，不加冠词）',meaning:'床'}
    ],
    explanations: [
      "`get out of bed` 指「下床、起床」，bed 前不加冠词（表床的用途）。常见错误：\n• \"Get out of the bed\" → 指某张具体的床，不表起床这个动作\n• \"Get up of bed\" → 搭配是 out of",
      "同义：get up。区别：get up 还可表站起来，get out of bed 只指离开床。"
    ],
    distractors: [["Get out from","Get off of","Get up of"],["the bed.","a bed.","beds."]]
  },
  {
    sentence: "Get dressed.",
    cid: "e082afdd",
    translation: "穿好衣服。",
    chunks: ["Get","dressed."],
    hints: ["变得","穿好衣服的"],
    grammar: [
      {role:'系动词',color:'#c87033',phonetic:['/ɡet/'],pos:'get + 过去分词',meaning:'变得'},
      {role:'表语',color:'#3358e0',phonetic:['/drest/'],pos:'过去分词作形容词',meaning:'穿好衣服的'}
    ],
    explanations: [
      "`get dressed` = 把衣服穿好，dressed 是过去分词当形容词。常见错误：\n• \"Get dress\" → 必须是 dressed\n• \"Wear dressed\" → wear 后面接具体衣物，不接 dressed",
      "反义：get undressed（脱衣服）；换衣服说 get changed。"
    ],
    distractors: [["Get in","Be","Get on"],["dress.","dressing.","dresses."]]
  },
  {
    sentence: "Let's go downstairs.",
    cid: "e31c936a",
    translation: "下楼吧。",
    chunks: ["Let's go","downstairs."],
    hints: ["我们走吧","下楼"],
    grammar: [
      {role:'主谓（祈使）',color:'#e74c7a',phonetic:['/lets/','/ɡoʊ/'],pos:'let us + 动词原形',meaning:'我们走吧'},
      {role:'方向状语',color:'#7c5cbf',phonetic:['/ˌdaʊnˈsterz/'],pos:'副词',meaning:'下楼'}
    ],
    explanations: [
      "`Let's` = let us，后面接动词原形。常见错误：\n• \"Let's going downstairs\" → 不用 -ing\n• \"Let's to go downstairs\" → 不加 to",
      "`downstairs` 是副词，前面不加介词：go downstairs（不说 go to downstairs）。反义 upstairs。"
    ],
    distractors: [["Let's going","Let us to go","Let go"],["to downstairs.","downstair.","the downstairs."]]
  },
  {
    sentence: "Eat something.",
    cid: "e01f814d",
    translation: "吃点东西。",
    chunks: ["Eat","something."],
    hints: ["吃","一些东西"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/iːt/'],pos:'祈使句动词',meaning:'吃'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈsʌmθɪŋ/'],pos:'不定代词',meaning:'一些东西'}
    ],
    explanations: [
      "`something` 用于肯定、建议、邀请。常见错误：\n• \"Eat anything\" → 劝人吃点东西时用 something\n• \"Eat somethings\" → something 没有复数形式",
      "同类：have something to eat、grab a bite（随便吃点）。"
    ],
    distractors: [["Eats","Eating","Have eat"],["anything.","somethings.","some thing."]]
  },
  {
    sentence: "Come to dinner.",
    cid: "8c2306cc",
    translation: "来吃晚饭。",
    chunks: ["Come to","dinner."],
    hints: ["来参加","晚饭"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/kʌm/','/tuː/'],pos:'动词短语',meaning:'来（参加）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈdɪnər/'],pos:'名词（三餐不加冠词）',meaning:'晚饭'}
    ],
    explanations: [
      "三餐名词前一般不加冠词：come to dinner / have dinner。常见错误：\n• \"Come to a dinner\" → 三餐前通常不加 a\n• \"Come at dinner\" → 表「来吃饭」用 to，at 表时间点",
      "同类：come to lunch / come to breakfast；请客说 come for dinner 也常见。"
    ],
    distractors: [["Come in","Come at","Come for to"],["the dinner.","a dinner.","dinners."]]
  },
  {
    sentence: "Get off your phone.",
    cid: "0f6c6eb5",
    translation: "别看手机了。",
    chunks: ["Get off","your phone."],
    hints: ["离开、放下","你的手机"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/ɔːf/'],pos:'短语动词 get off',meaning:'离开、放下'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/foʊn/'],pos:'名词短语',meaning:'你的手机'}
    ],
    explanations: [
      "`get off your phone` 字面是「从手机上离开」，口语里就是「别老盯着手机」。常见错误：\n• \"Get off from your phone\" → get off 后面直接接宾语\n• \"Get out your phone\" → 那是「把手机拿出来」，意思正好相反",
      "同类说法：Put your phone down. / Get off the screen."
    ],
    distractors: [["Get out","Get on","Get from"],["you phone.","your phones.","your phone of."]]
  },
  {
    sentence: "It's getting cold.",
    cid: "9425b8e6",
    translation: "（饭）要凉了。",
    chunks: ["It's getting","cold."],
    hints: ["它正在变得","冷"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ˈɡetɪŋ/'],pos:'get + 形容词（进行时）',meaning:'它正在变得'},
      {role:'表语',color:'#3358e0',phonetic:['/koʊld/'],pos:'形容词',meaning:'凉的、冷的'}
    ],
    explanations: [
      "`get + 形容词` 表「逐渐变得」，比 be 更有变化感。常见错误：\n• \"It's get cold\" → 进行时要用 getting\n• \"It gets cold\" → 一般现在时表习惯，指眼下要变了用进行时",
      "指饭菜或天气都用 it：It's getting cold. Let's eat.（要凉了，吃吧）"
    ],
    distractors: [["It's get","It getting","It's got"],["colder of.","coldly.","the cold."]]
  },
  {
    sentence: "Warm it up first.",
    cid: "39241d16",
    translation: "先热一下。",
    chunks: ["Warm it up","first."],
    hints: ["把它热一下","先"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/wɔːrm/','/ɪt/','/ʌp/'],pos:'短语动词 warm up（代词夹中）',meaning:'把它加热'},
      {role:'状语',color:'#7c5cbf',phonetic:['/fɜːrst/'],pos:'副词',meaning:'先'}
    ],
    explanations: [
      "`warm up` 加热；宾语是代词时必须夹在中间：warm **it** up。常见错误：\n• \"Warm up it first\" → 代词不能放后面\n• \"Warm it up first\" 与 \"Warm it first\" 都对，加 up 更强调热透",
      "同类：heat it up / pop it in the microwave。"
    ],
    distractors: [["Warm up it","Warmer it up","Warm it from"],["the first.","firstly.","at first."]]
  },
  {
    sentence: "Get some fresh air.",
    cid: "a78144bd",
    translation: "去呼吸点新鲜空气。",
    chunks: ["Get some","fresh air."],
    hints: ["去弄点","新鲜空气"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/sʌm/'],pos:'动词 + 限定词',meaning:'去弄点'},
      {role:'宾语',color:'#3358e0',phonetic:['/freʃ/','/er/'],pos:'名词短语（不可数）',meaning:'新鲜空气'}
    ],
    explanations: [
      "`get some fresh air` 就是「出去透透气」。常见错误：\n• \"Get some fresh airs\" → air 不可数，不加 s\n• \"Get some fresh water\" → 那是淡水，fresh air 才是空气",
      "同类：take a walk / get some sun，都属「出门活动」这一族。"
    ],
    distractors: [["Get a","Get any","Got some"],["fresh airs.","fresh the air.","freshly air."]]
  },
  {
    sentence: "Get some sun.",
    cid: "8c273747",
    translation: "去晒晒太阳。",
    chunks: ["Get some","sun."],
    hints: ["去晒点","太阳"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/sʌm/'],pos:'动词 + 限定词',meaning:'去晒点'},
      {role:'宾语',color:'#3358e0',phonetic:['/sʌn/'],pos:'不可数名词',meaning:'阳光'}
    ],
    explanations: [
      "`get some sun` 是「晒太阳」最地道的口语说法。常见错误：\n• \"Get some suns\" → sun 不可数\n• sun 与 son 同音 /sʌn/，听写时靠上下文区分",
      "相关：get some sunshine（更强调暖阳）、get a tan（晒黑）。"
    ],
    distractors: [["Get a","Got some","Get any"],["suns.","the sun of.","son."]]
  },
  {
    sentence: "I'm heading out the door.",
    cid: "a80cfc73",
    translation: "我要出门了。",
    chunks: ["I'm heading out","the door."],
    hints: ["我正往外走","门"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/aɪm/','/ˈhedɪŋ/','/aʊt/'],pos:'现在进行时',meaning:'我正往外走'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ðə/','/dɔːr/'],pos:'名词短语',meaning:'门口'}
    ],
    explanations: [
      "`head out` 是「出门、出发」的口语说法，进行时表「马上就走」。常见错误：\n• \"I heading out\" → 漏 be 动词\n• \"I'm heading out of the door\" → 口语里不加 of，直接 the door",
      "家人告别常说：I'm heading out! 对方回 Have a good one!（路上顺利）"
    ],
    distractors: [["I heading out","I'm heading of","I'm head out"],["a door.","the doors.","the door out."]]
  },
  {
    sentence: "Get some groceries.",
    cid: "1381b0a8",
    translation: "买点菜。",
    chunks: ["Get some","groceries."],
    hints: ["买点","食品杂货"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/sʌm/'],pos:'动词 + 限定词',meaning:'买点'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈɡroʊsəriz/'],pos:'名词（恒用复数）',meaning:'食材杂货'}
    ],
    explanations: [
      "`groceries` 指超市买回来的食材、日用品，习惯用复数。常见错误：\n• \"Get some grocery\" → 一般用复数 groceries\n• 拼写别丢 c：gro**c**eries，不是 groseries",
      "美式也说 get some food / pick up some stuff；英式常说 do the shopping。"
    ],
    distractors: [["Get a","Get any","Got some"],["grocery.","grocerys.","the groceries of."]]
  },
  {
    sentence: "The sun's out.",
    cid: "d463d7c2",
    translation: "太阳出来了。",
    chunks: ["The sun's","out."],
    hints: ["太阳","出来了"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/ðə/','/sʌnz/'],pos:'名词 + is 缩写',meaning:'太阳（出来了）'},
      {role:'表语',color:'#3358e0',phonetic:['/aʊt/'],pos:'副词作表语',meaning:'出来了、露面'}
    ],
    explanations: [
      "`The sun's out.` 指太阳出来了，out 在此表「露面」。常见错误：\n• \"The sun's out of\" → out 后面不加东西\n• \"The sun comes out\" 也对，但 the sun's out 更即时",
      "同类：The moon's out. / The stars are out."
    ],
    distractors: [["The sun","The sunny","The sun is of"],["out of.","outs.","outing."]]
  },
  {
    sentence: "Take a walk.",
    cid: "d1fa43d8",
    translation: "去走走。",
    chunks: ["Take a","walk."],
    hints: ["去散个","步"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ə/'],pos:'动词短语 take a walk',meaning:'去散步'},
      {role:'宾语',color:'#3358e0',phonetic:['/wɔːk/'],pos:'名词',meaning:'走路'}
    ],
    explanations: [
      "`take a walk` 是「去走走、散步」的固定搭配。常见错误：\n• \"Take walk\" → 缺少 a\n• \"Go a walk\" → 动词用 take 或 have，不用 go",
      "同义：go for a walk / take a stroll（更悠闲）。"
    ],
    distractors: [["Take the","Make a","Go a"],["walks.","walking.","a walk."]]
  },
  {
    sentence: "It's raining.",
    cid: "c9dfafd6",
    translation: "下雨了。",
    chunks: ["It's","raining."],
    hints: ["天（它）","在下雨"],
    grammar: [
      {role:'形式主语',color:'#c87033',phonetic:['/ɪts/'],pos:'it 指天气',meaning:'天'},
      {role:'谓语（进行时）',color:'#e74c7a',phonetic:['/ˈreɪnɪŋ/'],pos:'现在进行时',meaning:'正在下雨'}
    ],
    explanations: [
      "谈天气时用 it 作形式主语，不能用 he/she。常见错误：\n• \"It rains now\" → 眼下正在下要用进行时\n• \"Rain is happening\" → 不地道，直接说 It's raining",
      "相关：It's pouring.（下大雨）/ It's drizzling.（下毛毛雨）"
    ],
    distractors: [["It","It is raining","There's"],["rains.","rained.","rainy."]]
  },
  {
    sentence: "It's getting windy.",
    cid: "6db16bc7",
    translation: "起风了。",
    chunks: ["It's getting","windy."],
    hints: ["正在变得","有风"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/ˈɡetɪŋ/'],pos:'get + 形容词（进行时）',meaning:'正在变得'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈwɪndi/'],pos:'形容词',meaning:'有风的'}
    ],
    explanations: [
      "`windy` = wind + y，表「起风的」。常见错误：\n• \"It's getting wind\" → 形容词形式是 windy\n• \"It's getting a wind\" → 不需要冠词",
      "同类天气变化：It's getting cloudy / foggy / chilly."
    ],
    distractors: [["It getting","It's got","It's get"],["wind.","windily.","winds."]]
  },
  {
    sentence: "Order some food.",
    cid: "f82f8fcf",
    translation: "点东西吃。",
    chunks: ["Order some","food."],
    hints: ["点一些","食物"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈɔːrdər/','/sʌm/'],pos:'动词 + 限定词',meaning:'点一些'},
      {role:'宾语',color:'#3358e0',phonetic:['/fuːd/'],pos:'不可数名词',meaning:'食物'}
    ],
    explanations: [
      "`order` 指在餐厅点餐或叫外卖。常见错误：\n• \"Order some foods\" → 泛指食物时 food 不可数\n• \"Order for some food\" → order 是及物动词，直接接宾语",
      "外卖：order in / order takeout；堂食点餐：order from the menu。"
    ],
    distractors: [["Order a","Order any","Buy for some"],["foods.","the food of.","feed."]]
  },
  {
    sentence: "Set the table.",
    cid: "14713e06",
    translation: "布置桌子（摆餐具）。",
    chunks: ["Set","the table."],
    hints: ["摆放","桌子"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/set/'],pos:'祈使句动词',meaning:'摆放'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈteɪbl/'],pos:'名词短语',meaning:'餐桌'}
    ],
    explanations: [
      "`set the table` 专指「摆好餐具、布置餐桌」。常见错误：\n• \"Put the table\" → put 不能表布置桌面\n• \"Set up the table\" → set up 是「组装」，摆餐具只用 set",
      "相关：clear the table（收拾桌子）/ do the dishes（洗碗）。"
    ],
    distractors: [["Sets","Sit","Setting"],["the tables.","a table.","the table up."]]
  },
  {
    sentence: "Stand up.",
    cid: "de31c7f6",
    translation: "起来（站起来）。",
    chunks: ["Stand","up."],
    hints: ["站","起来"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/stænd/'],pos:'祈使句动词',meaning:'站立'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ʌp/'],pos:'副词（表方向）',meaning:'起来'}
    ],
    explanations: [
      "`stand up` 指从坐、躺到站起来。常见错误：\n• \"Stand up you\" → 祈使句不重复主语\n• \"Stand on\" → 意思变成「站在……上面」，需接宾语",
      "对比 `get up`：get up 还能表起床，stand up 只指站起来。"
    ],
    distractors: [["Stands","Sit","Standing"],["upstairs.","down.","over."]]
  },
  {
    sentence: "Sit down.",
    cid: "25f410a9",
    translation: "坐下。",
    chunks: ["Sit","down."],
    hints: ["坐","下"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/sɪt/'],pos:'祈使句动词',meaning:'坐'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词（表方向）',meaning:'下'}
    ],
    explanations: [
      "`sit down` 是「坐下」的固定表达，与 stand up 相对。常见错误：\n• \"Sit down you\" → 祈使句不加主语\n• \"Sit on\" → 必须接宾语（sit on the chair）",
      "更客气：Have a seat. / Please, take a seat."
    ],
    distractors: [["Sits","Stand","Sitting"],["upstairs.","up.","over."]]
  },
  {
    sentence: "I'll have a burger.",
    cid: "a08f34b7",
    translation: "我要一个汉堡。",
    chunks: ["I'll have","a burger."],
    hints: ["我要（点）","一个汉堡"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪl/','/hæv/'],pos:'will + 动词原形',meaning:'我要（点）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈbɜːrɡər/'],pos:'名词短语',meaning:'一个汉堡'}
    ],
    explanations: [
      "点餐用 `I'll have...` 最自然，比 I want 礼貌。常见错误：\n• \"I have a burger\" → 少 will，听起来像陈述已有\n• \"I'd have a burger\" → 那是虚拟语气，点餐该用 I'll",
      "同类：I'll take the soup. / I'll go with the salad."
    ],
    distractors: [["I have","I'll having","I would had"],["the burger.","burger.","a burgers."]]
  },
  {
    sentence: "That's everything.",
    cid: "81e9a11f",
    translation: "就这些。",
    chunks: ["That's","everything."],
    hints: ["那就（是）","全部"],
    grammar: [
      {role:'主语 + be',color:'#c87033',phonetic:['/ðæts/'],pos:'that is 缩写',meaning:'那就是'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈevriθɪŋ/'],pos:'不定代词',meaning:'全部、所有'}
    ],
    explanations: [
      "点完单或收拾完东西时用 `That's everything.` = 就这些。常见错误：\n• \"These are everything\" → 主语用 that\n• \"That's anything\" → 意思完全不对，anything 用于疑问否定",
      "同类收尾语：That's it. / That's all for now."
    ],
    distractors: [["That","These","That is of"],["anything.","everythings.","all thing."]]
  },
  {
    sentence: "Get in the car.",
    cid: "867d1dff",
    translation: "上车吧。",
    chunks: ["Get in","the car."],
    hints: ["进","车"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/ɪn/'],pos:'短语动词 get in',meaning:'进入'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/kɑːr/'],pos:'名词短语',meaning:'汽车'}
    ],
    explanations: [
      "私家车这类「钻进里面」的用 `get in`，公交车、飞机、火车用 get on。常见错误：\n• \"Get on the car\" → 会被理解成爬到车上去\n• \"Get into the car\" 也对，into 更强调进入的动作",
      "对比：get in the car / get on the bus / get on the plane。"
    ],
    distractors: [["Get on","Get at","Get of"],["the cars.","a car.","the car of."]]
  },
  {
    sentence: "Get on the plane.",
    cid: "284f75cd",
    translation: "上飞机。",
    chunks: ["Get on","the plane."],
    hints: ["登上","飞机"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/ɑːn/'],pos:'短语动词 get on',meaning:'登上'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/pleɪn/'],pos:'名词短语',meaning:'飞机'}
    ],
    explanations: [
      "飞机、公交、火车、船这类「登上去」的交通工具用 `get on`。常见错误：\n• \"Get in the plane\" → in 指进到某个内部空间，登机用 on\n• \"Get the plane\" → 少了 on，意思变成得到飞机",
      "下机：get off the plane。"
    ],
    distractors: [["Get in","Get at","Get of"],["the planes.","a plane.","the plane of."]]
  },
  {
    sentence: "Be careful.",
    cid: "14d3f87e",
    translation: "当心。",
    chunks: ["Be","careful."],
    hints: ["要（保持）","小心"],
    grammar: [
      {role:'系动词（祈使）',color:'#c87033',phonetic:['/biː/'],pos:'be 的祈使形式',meaning:'要（处于某状态）'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈkerfl/'],pos:'形容词',meaning:'小心的'}
    ],
    explanations: [
      "祈使句里 be 用原形：Be careful. 常见错误：\n• \"Are careful\" → 祈使句不用 are\n• \"Be carefully\" → carefully 是副词，这里需要形容词 careful",
      "加限定：Be careful with the knife.（用刀当心）/ Be careful out there."
    ],
    distractors: [["Are","Being","Was"],["carefully.","care.","cares."]]
  },
  {
    sentence: "Don't fall down.",
    cid: "5b99a19c",
    translation: "别摔了。",
    chunks: ["Don't","fall down."],
    hints: ["别","摔下来"],
    grammar: [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/'],pos:'do not 缩写',meaning:'别'},
      {role:'谓语',color:'#7c5cbf',phonetic:['/fɔːl/','/daʊn/'],pos:'短语动词 fall down',meaning:'摔倒、掉下来'}
    ],
    explanations: [
      "否定祈使用 `Don't + 动词原形`。常见错误：\n• \"Don't falls down\" → 不用第三人称单数\n• \"No fall down\" → 英语没有 no + 动词 的祈使形式",
      "`fall down` 指摔倒、跌落；从某物上掉下来用 fall off（fall off the bike）。"
    ],
    distractors: [["Doesn't","No","Not"],["falls down.","fell down.","fall on."]]
  },
  {
    sentence: "Hold on.",
    cid: "4436b78d",
    translation: "抓紧（也可以表示等一下）。",
    chunks: ["Hold","on."],
    hints: ["抓","住"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/hoʊld/'],pos:'祈使句动词',meaning:'抓住'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɑːn/'],pos:'副词（固定搭配）',meaning:'持住、继续'}
    ],
    explanations: [
      "`hold on` 有两义：① 抓紧 ② 等一下（打电话时最常听）。常见错误：\n• \"Hold on to\" 后面要接宾语（hold on to the rail）\n• \"Hold up\" 也可表等等，但「抓紧」只用 hold on",
      "电话里听到 Hold on, please. 就是「请稍等」。"
    ],
    distractors: [["Holds","Holding","Hold of"],["on to.","off.","out."]]
  },
  {
    sentence: "Let go.",
    cid: "2d1e7fe6",
    translation: "松手。",
    chunks: ["Let","go."],
    hints: ["让","走"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/let/'],pos:'祈使句动词',meaning:'让'},
      {role:'宾语补足语',color:'#7c5cbf',phonetic:['/ɡoʊ/'],pos:'动词原形（固定搭配）',meaning:'松开'}
    ],
    explanations: [
      "`let go` = 松手、放手，是固定搭配，中间不加 to。常见错误：\n• \"Let to go\" → let 后接动词原形\n• \"Let go it\" → 要说 let it go，代词夹在中间",
      "引申义：Let it go.（放下吧、别纠结了）"
    ],
    distractors: [["Lets","Letting","Let to"],["goes.","going.","gone."]]
  },
  {
    sentence: "Turn around.",
    cid: "f090a897",
    translation: "转过来、转过去。",
    chunks: ["Turn","around."],
    hints: ["转","过来（转身）"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/tɜːrn/'],pos:'祈使句动词',meaning:'转'},
      {role:'副词',color:'#7c5cbf',phonetic:['/əˈraʊnd/'],pos:'副词',meaning:'转身、转一圈'}
    ],
    explanations: [
      "`turn around` 既表「转过来」也表「转过去」，靠语境。常见错误：\n• \"Turn around of\" → around 后面不加介词\n• 英式常说 turn round，美式说 around",
      "相关：turn left / turn right（转弯）；turn back（往回走）。"
    ],
    distractors: [["Turns","Turning","Turn to"],["around of.","round of.","arounds."]]
  },
  {
    sentence: "Back away.",
    cid: "dfc5d91e",
    translation: "后退。",
    chunks: ["Back","away."],
    hints: ["向后退","离开"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/bæk/'],pos:'动词（后退）',meaning:'后退'},
      {role:'副词',color:'#7c5cbf',phonetic:['/əˈweɪ/'],pos:'副词',meaning:'离开'}
    ],
    explanations: [
      "`back away` 指「慢慢往后退」，常用来让人让出空间。常见错误：\n• back away **from** + 宾语 表「从……退开」（back away from the dog）\n• 与 `go back`（回去）不同，别混用",
      "更急的说法：Get back!（退后！）"
    ],
    distractors: [["Backs","Backing","Back of"],["away from.","out.","off."]]
  },
  {
    sentence: "Don't stare.",
    cid: "0718c5bc",
    translation: "别盯着看。",
    chunks: ["Don't","stare."],
    hints: ["别","盯着看"],
    grammar: [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/'],pos:'do not 缩写',meaning:'别'},
      {role:'谓语',color:'#7c5cbf',phonetic:['/ster/'],pos:'动词原形',meaning:'盯着看'}
    ],
    explanations: [
      "`stare` 指长时间盯着看，带不礼貌的意味。常见错误：\n• \"Don't staring\" → 否定祈使后接动词原形\n• \"Don't stare me\" → 盯住某人要说 stare at me",
      "提醒别人时可以说：Don't stare, it's rude."
    ],
    distractors: [["Doesn't","Not","No"],["stares.","staring.","stare at."]]
  },
  {
    sentence: "Close your eyes.",
    cid: "a11e56c2",
    translation: "闭上眼睛。",
    chunks: ["Close","your eyes."],
    hints: ["闭上","你的眼睛"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/kloʊz/'],pos:'祈使句动词',meaning:'闭上'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/aɪz/'],pos:'名词短语',meaning:'你的眼睛'}
    ],
    explanations: [
      "作动词的 `close` 读 /kloʊz/，不读 /kloʊs/。常见错误：\n• \"Close your eye\" → 两只眼睛用复数 eyes\n• \"Shut your eyes\" 也对，但 close 更通用",
      "相关：open your eyes（睁开眼）/ cover your eyes（捂住眼睛）"
    ],
    distractors: [["Closes","Closing","Open"],["your eye.","you eyes.","your eyes of."]]
  },
  {
    sentence: "Blow your nose.",
    cid: "40fa1f77",
    translation: "擤鼻涕。",
    chunks: ["Blow","your nose."],
    hints: ["擤","你的鼻子"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/bloʊ/'],pos:'祈使句动词',meaning:'擤'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/noʊz/'],pos:'名词短语',meaning:'你的鼻子'}
    ],
    explanations: [
      "擤鼻涕的动词是 `blow`，名词是 nose。常见错误：\n• \"Blow your noses\" → 一人一个鼻子，用单数\n• \"Wipe your nose\" 是用纸巾擦，blow 才是擤",
      "相关：a runny nose（流鼻涕）/ a stuffy nose（鼻塞）"
    ],
    distractors: [["Blows","Blowing","Blow out"],["your nose's.","you nose.","your nose is."]]
  },
  {
    sentence: "I sneezed.",
    cid: "ad88d5dc",
    translation: "我打了个喷嚏。",
    chunks: ["I","sneezed."],
    hints: ["我","打了喷嚏"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/aɪ/'],pos:'第一人称代词',meaning:'我'},
      {role:'谓语',color:'#e74c7a',phonetic:['/sniːzd/'],pos:'一般过去时',meaning:'打了喷嚏'}
    ],
    explanations: [
      "打喷嚏的动词是 `sneeze`，过去式读 /sniːzd/。常见错误：\n• \"I sneeze\" → 刚打过要用过去式\n• 拼写别漏 e：snee**ze**，不是 snez",
      "别人打喷嚏后说 Bless you!，回一句 Thank you. 就行。"
    ],
    distractors: [["Me","My","I've"],["sneezes.","sneezing.","sneeze."]]
  },
  {
    sentence: "I need help.",
    cid: "1792dc97",
    translation: "我需要帮助。",
    chunks: ["I need","help."],
    hints: ["我需要","帮助"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/niːd/'],pos:'一般现在时',meaning:'我需要'},
      {role:'宾语',color:'#3358e0',phonetic:['/help/'],pos:'不可数名词',meaning:'帮助'}
    ],
    explanations: [
      "求助最直接的表达，`help` 不可数。常见错误：\n• \"I need a help\" → help 不可数，不加 a\n• \"I need helps\" → 也不加 s",
      "更礼貌：Could you help me? / I need some assistance."
    ],
    distractors: [["I wants","I am need","I needs"],["helps.","a help.","helper."]]
  },
  {
    sentence: "Are you sick?",
    cid: "45ae00d9",
    translation: "你生病了吗？",
    chunks: ["Are you","sick?"],
    hints: ["你是","生病的"],
    grammar: [
      {role:'系动词 + 主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'一般疑问句',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/sɪk/'],pos:'形容词',meaning:'生病的'}
    ],
    explanations: [
      "美式用 `sick` 表生病，英式更常说 ill。常见错误：\n• \"Do you sick?\" → sick 是形容词，要用 be 动词提问\n• 说这句话时句尾语调要上扬",
      "关心两句：Are you feeling okay? / You look pale."
    ],
    distractors: [["Is you","Are your","Do you"],["sickly?","tired?","sad?"]]
  },
  {
    sentence: "Take some medicine.",
    cid: "dc756c88",
    translation: "吃点药。",
    chunks: ["Take some","medicine."],
    hints: ["服用一些","药"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/sʌm/'],pos:'动词 + 限定词',meaning:'服用一些'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈmedɪsn/'],pos:'不可数名词',meaning:'药'}
    ],
    explanations: [
      "英文「吃药」用 `take`，不用 eat。常见错误：\n• \"Eat some medicine\" → 中文说吃药，英文是 take medicine\n• \"Take some medicines\" → 泛指药物时不可数",
      "相关：take a pill（吃一片药）/ take it twice a day（一天吃两次）"
    ],
    distractors: [["Eat some","Take a","Takes some"],["medicines.","a medicine.","medical."]]
  },
  {
    sentence: "Where does it hurt?",
    cid: "7fdbc9e4",
    translation: "哪里疼？",
    chunks: ["Where","does it hurt?"],
    hints: ["哪里","它疼"],
    grammar: [
      {role:'疑问词',color:'#7c5cbf',phonetic:['/wer/'],pos:'疑问副词',meaning:'哪里'},
      {role:'助动词 + 主语 + 谓语',color:'#e74c7a',phonetic:['/dʌz/','/ɪt/','/hɜːrt/'],pos:'一般现在时疑问句',meaning:'它疼'}
    ],
    explanations: [
      "`hurt` 可及物可不及物，问哪里疼这样说最自然。常见错误：\n• \"Where does it hurts?\" → 助动词 does 后动词要用原形\n• \"Where it hurts?\" → 疑问句缺助动词",
      "医生还会问：Does it hurt here?（这里疼吗）"
    ],
    distractors: [["What","When","Which"],["do it hurt?","does it hurts?","is it hurt?"]]
  },
  {
    sentence: "Is it your stomach?",
    cid: "9dd8fc89",
    translation: "是肚子吗？",
    chunks: ["Is it","your stomach?"],
    hints: ["是它","你的肚子"],
    grammar: [
      {role:'系动词 + 主语',color:'#c87033',phonetic:['/ɪz/','/ɪt/'],pos:'一般疑问句',meaning:'（它）是'},
      {role:'表语',color:'#3358e0',phonetic:['/jʊr/','/ˈstʌmək/'],pos:'名词短语',meaning:'你的胃、肚子'}
    ],
    explanations: [
      "确认疼痛位置时医生常这样问。常见错误：\n• 回答别背整句，简短答 Yes, it is. 就好\n• stomach 读 /ˈstʌmək/，ch 不发 /tʃ/；口语里也说 tummy",
      "相关部位：chest（胸口）/ throat（喉咙）/ back（背）"
    ],
    distractors: [["Are it","Is your","Does it"],["your stomachs?","you stomach?","your stomach ache?"]]
  },
  {
    sentence: "Take a rest.",
    cid: "0d637f69",
    translation: "休息一下。",
    chunks: ["Take a","rest."],
    hints: ["休息","一下"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ə/'],pos:'动词短语 take a rest',meaning:'休息'},
      {role:'宾语',color:'#3358e0',phonetic:['/rest/'],pos:'名词',meaning:'休息'}
    ],
    explanations: [
      "`take a rest` 与 `take a break` 都能表休息，rest 更偏身体恢复。常见错误：\n• \"Take rest\" → 缺少 a\n• \"Do a rest\" → 动词用 take 或 have",
      "相关：get some rest（好好休息）/ rest up（充分休息）"
    ],
    distractors: [["Take the","Make a","Do a"],["rests.","resting.","a rest."]]
  },
  {
    sentence: "Have some water.",
    cid: "f863d500",
    translation: "喝点水。",
    chunks: ["Have some","water."],
    hints: ["喝点","水"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/hæv/','/sʌm/'],pos:'动词 + 限定词',meaning:'喝点'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈwɔːtər/'],pos:'不可数名词',meaning:'水'}
    ],
    explanations: [
      "劝人喝点水用 `have` 比 drink 更日常。常见错误：\n• \"Have some waters\" → water 不可数\n• \"Eat some water\" → 喝用 have / drink",
      "相关：drink plenty of water（多喝水）/ stay hydrated"
    ],
    distractors: [["Have any","Eat some","Having some"],["waters.","a water.","water is."]]
  },
  {
    sentence: "Lie down.",
    cid: "6c5b5c7b",
    translation: "躺下。",
    chunks: ["Lie","down."],
    hints: ["躺","下"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/laɪ/'],pos:'祈使句动词（不及物）',meaning:'躺'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词（表方向）',meaning:'下'}
    ],
    explanations: [
      "`lie down` 的 lie 是不及物动词，过去式是 lay。常见错误：\n• \"Lay down\" → lay 需要宾语（lay the book down），自己躺要用 lie\n• \"Lie down you\" → 祈使句不加主语",
      "相关：lie on the bed（躺在床上）/ lie still（躺着别动）"
    ],
    distractors: [["Lay","Lies","Lying"],["downstairs.","up.","over."]]
  },
  {
    sentence: "Just relax.",
    cid: "45b93a39",
    translation: "放松一下。",
    chunks: ["Just","relax."],
    hints: ["就、尽管","放松"],
    grammar: [
      {role:'副词',color:'#7c5cbf',phonetic:['/dʒʌst/'],pos:'副词（缓和语气）',meaning:'就、只管'},
      {role:'谓语',color:'#e74c7a',phonetic:['/rɪˈlæks/'],pos:'祈使句动词',meaning:'放松'}
    ],
    explanations: [
      "`just` 在这里缓和语气，等于「你就放松吧」。常见错误：\n• \"Just relax you\" → 祈使句不加主语\n• \"Just relaxing\" → 祈使句要用动词原形",
      "安慰别人：Take it easy. / Relax, it's fine. / Just breathe."
    ],
    distractors: [["Only","Just be","Very"],["relaxing.","relaxes.","relaxed."]]
  },
  {
    sentence: "Your fever broke.",
    cid: "978cb905",
    translation: "你的烧退了。",
    chunks: ["Your fever","broke."],
    hints: ["你的发烧","退了"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/jʊr/','/ˈfiːvər/'],pos:'名词短语',meaning:'你的发烧'},
      {role:'谓语',color:'#e74c7a',phonetic:['/broʊk/'],pos:'break 的过去式（此处指退烧）',meaning:'退了'}
    ],
    explanations: [
      "`break` 用于发烧指「退烧」，非常地道。常见错误：\n• break 的过去式是 broke，不是 breaked\n• \"Your fever went down\" 也对，但 break 更地道",
      "退烧药是 a fever reducer；量体温是 take your temperature。"
    ],
    distractors: [["You fever","Your fevers","Your fever is"],["breaks.","breaked.","broken."]]
  },
  {
    sentence: "I still have a little cough.",
    cid: "381f72db",
    translation: "我还有点咳嗽。",
    chunks: ["I still have","a little cough."],
    hints: ["我还有","一点咳嗽"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/stɪl/','/hæv/'],pos:'一般现在时',meaning:'我还有'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈlɪtl/','/kɔːf/'],pos:'名词短语',meaning:'一点咳嗽'}
    ],
    explanations: [
      "描述症状用 `have a + 症状`。常见错误：\n• \"I still have little cough\" → 少了 a\n• cough 读 /kɔːf/，词尾是 /f/ 不是 /k/",
      "相关：have a cold（感冒）/ have a runny nose（流鼻涕）/ have a sore throat（嗓子疼）"
    ],
    distractors: [["I still has","I have still","I'm still have"],["a little coughs.","little cough.","a cough little."]]
  },
  {
    sentence: "What size are you?",
    cid: "0d6e7a1e",
    translation: "你穿多大码？",
    chunks: ["What size","are you?"],
    hints: ["什么尺码","你是"],
    grammar: [
      {role:'疑问词 + 名词',color:'#7c5cbf',phonetic:['/wʌt/','/saɪz/'],pos:'疑问短语',meaning:'什么尺码'},
      {role:'系动词 + 主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'疑问句语序',meaning:'你是'}
    ],
    explanations: [
      "买衣服问尺码最常用这句。常见错误：\n• \"What size you are?\" → 疑问句要用 are you 的语序\n• \"What's your size?\" 也对，但店员更常说 What size are you?",
      "回答：I'm a medium. / I wear a size 8."
    ],
    distractors: [["What sizes","How size","Which size of"],["you are?","are your?","is you?"]]
  },
  {
    sentence: "Just pick out anything.",
    cid: "ce389d98",
    translation: "随便挑。",
    chunks: ["Just pick out","anything."],
    hints: ["随便挑","任何东西"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/dʒʌst/','/pɪk/','/aʊt/'],pos:'短语动词 pick out（祈使）',meaning:'随便挑'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈeniθɪŋ/'],pos:'不定代词',meaning:'任何东西'}
    ],
    explanations: [
      "`pick out` = 挑选；表「随便挑」时宾语用 anything。常见错误：\n• \"Pick out something\" → 随便挑要用 anything\n• \"Pick of\" → 少了 out，pick 单独用意思变成「采、摘」",
      "同类：Choose whichever you like. / Take your pick."
    ],
    distractors: [["Pick up out","Just pick of","Just picks out"],["something.","anythings.","anything is."]]
  },
  {
    sentence: "Put it on.",
    cid: "6a78132a",
    translation: "穿上。",
    chunks: ["Put it","on."],
    hints: ["把它","穿上"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/pʊt/','/ɪt/'],pos:'短语动词 put on（代词夹中）',meaning:'把它（穿）上'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɑːn/'],pos:'副词',meaning:'上（穿戴）'}
    ],
    explanations: [
      "`put on` 表穿戴，代词宾语必须放中间：put **it** on。常见错误：\n• \"Put on it\" → 代词不能放后面\n• put on 是穿的动作，wear 是穿着的状态",
      "反义：take it off（脱下来）。"
    ],
    distractors: [["Put on it","Putting it on","Put it of"],["off.","in.","up."]]
  },
  {
    sentence: "Take it off.",
    cid: "2b8d1614",
    translation: "脱下来。",
    chunks: ["Take it","off."],
    hints: ["把它","脱下"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ɪt/'],pos:'短语动词 take off（代词夹中）',meaning:'把它脱下来'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɔːf/'],pos:'副词',meaning:'下（脱下）'}
    ],
    explanations: [
      "`take off` 表脱下衣物，代词夹在中间：take **it** off。常见错误：\n• \"Take off it\" → 代词要放中间\n• take off 还能表「飞机起飞」，靠上下文区分",
      "反义：put it on（穿上）。"
    ],
    distractors: [["Take off it","Taking it off","Take it of"],["on.","in.","out."]]
  },
  {
    sentence: "It doesn't fit.",
    cid: "2bfa5969",
    translation: "它不合身。",
    chunks: ["It doesn't","fit."],
    hints: ["它不","合身"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/ɪt/','/ˈdʌznt/'],pos:'第三人称否定',meaning:'它不'},
      {role:'谓语',color:'#e74c7a',phonetic:['/fɪt/'],pos:'动词原形',meaning:'合身'}
    ],
    explanations: [
      "衣服合不合身穿 `fit`；太紧太松则说 too tight / too loose. 常见错误：\n• \"It doesn't fits\" → 助动词 doesn't 后跟动词原形\n• \"It's not fit\" → 意思会变成「它不健康」",
      "相关：It fits perfectly.（正合适）/ It fits like a glove."
    ],
    distractors: [["It don't","It isn't","They doesn't"],["fits.","fitting.","fit on."]]
  },
  {
    sentence: "Can I return it?",
    cid: "433047e6",
    translation: "可以退吗？",
    chunks: ["Can I","return it?"],
    hints: ["我可以","退掉它吗"],
    grammar: [
      {role:'情态动词 + 主语',color:'#e74c7a',phonetic:['/kæn/','/aɪ/'],pos:'请求许可',meaning:'我可以'},
      {role:'谓语 + 宾语',color:'#3358e0',phonetic:['/rɪˈtɜːrn/','/ɪt/'],pos:'动词短语',meaning:'退掉它'}
    ],
    explanations: [
      "退货用 `return`，拿回钱说 get a refund。常见错误：\n• \"Can I return back it?\" → return 已含「回」，不加 back\n• 指着商品时也可说 Can I return this?",
      "相关：exchange it（换货）/ get a refund（退款）"
    ],
    distractors: [["Can I do","Could I to","Can me"],["returning it?","return it back?","return of it?"]]
  },
  {
    sentence: "What's your number?",
    cid: "cd3e07aa",
    translation: "你号码多少？",
    chunks: ["What's","your number?"],
    hints: ["什么是","你的号码"],
    grammar: [
      {role:'疑问词 + be',color:'#7c5cbf',phonetic:['/wʌts/'],pos:'what is 缩写',meaning:'什么是'},
      {role:'表语',color:'#3358e0',phonetic:['/jʊr/','/ˈnʌmbər/'],pos:'名词短语',meaning:'你的号码'}
    ],
    explanations: [
      "问电话号码、房号都用这句。常见错误：\n• \"What your number?\" → 漏了 's\n• 口语里 What's 的 /ts/ 与后面的 your 连读",
      "更礼貌：Could I get your number?"
    ],
    distractors: [["What","What are","How's"],["your numbers?","you number?","your number is?"]]
  },
  {
    sentence: "Pick up the phone.",
    cid: "31d5d360",
    translation: "接电话。",
    chunks: ["Pick up","the phone."],
    hints: ["拿起、接起","电话"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/pɪk/','/ʌp/'],pos:'短语动词 pick up',meaning:'拿起、接起'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/foʊn/'],pos:'名词短语',meaning:'电话'}
    ],
    explanations: [
      "`pick up the phone` = 接电话，也可说 answer the phone。常见错误：\n• \"Pick up phone\" → phone 前要加 the\n• 代词宾语要夹中间：pick it up",
      "相关：hang up（挂电话）/ put the phone down（放下电话）"
    ],
    distractors: [["Pick on","Picking up","Pick of"],["the phones.","a phone.","the phone up."]]
  },
  {
    sentence: "Stop calling me.",
    cid: "2a729d81",
    translation: "别给我打电话了。",
    chunks: ["Stop","calling me."],
    hints: ["停止","给我打电话"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/stɑːp/'],pos:'祈使句动词',meaning:'停止'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈkɔːlɪŋ/','/miː/'],pos:'动名词短语',meaning:'给我打电话'}
    ],
    explanations: [
      "`stop doing` 表停止正在做的事，动词要用 -ing。常见错误：\n• \"Stop to call me\" → stop to do 是「停下来去打电话」，意思正好相反\n• \"Stop call me\" → 少了 -ing",
      "想更坚决：Don't call me again."
    ],
    distractors: [["Stops","Stopping","Stop to"],["call me.","to call me.","calling my."]]
  },
  {
    sentence: "Ma'am, you called us.",
    cid: "6592bb2c",
    translation: "女士，是你打给我们的。",
    chunks: ["Ma'am,","you called us."],
    hints: ["女士","你打给我们了"],
    grammar: [
      {role:'称呼语',color:'#7c5cbf',phonetic:['/mæm/'],pos:'名词（尊称）',meaning:'女士'},
      {role:'主谓宾',color:'#e74c7a',phonetic:['/juː/','/kɔːld/','/ʌs/'],pos:'一般过去时',meaning:'你打给我们'}
    ],
    explanations: [
      "`Ma'am` 是对女性的礼貌称呼，读 /mæm/。常见错误：\n• 拼写别写成 Mam / Maam，标准写法是 Ma'am\n• 称呼语后面要加逗号：Ma'am, ...",
      "男性对应 Sir；服务场景常见：Sir, you dropped your card."
    ],
    distractors: [["Mam,","Maams,","Mister,"],["you call us.","you called we.","you called ours."]]
  },
  {
    sentence: "Why didn't you wake me?",
    cid: "319a8e05",
    translation: "为什么不叫醒我？",
    chunks: ["Why didn't you","wake me?"],
    hints: ["为什么你没有","叫醒我"],
    grammar: [
      {role:'疑问词 + 助动词',color:'#7c5cbf',phonetic:['/waɪ/','/ˈdɪdnt/','/juː/'],pos:'过去时否定疑问',meaning:'你为什么不'},
      {role:'谓语 + 宾语',color:'#e74c7a',phonetic:['/weɪk/','/miː/'],pos:'动词原形 + 宾语',meaning:'叫醒我'}
    ],
    explanations: [
      "`wake` 是叫醒，代词宾语跟在后面：wake me。常见错误：\n• \"Why didn't you woke me?\" → 助动词后要用原形 wake\n• \"Why you didn't wake me?\" → 疑问句语序是 Why didn't you...",
      "相关：wake me up（把我叫醒，代词夹中间）/ wake up（自己醒来）"
    ],
    distractors: [["Why you didn't","Why don't you","Why didn't not"],["woke me?","waking me?","wake up me?"]]
  },
  {
    sentence: "I overslept.",
    cid: "85c69d3a",
    translation: "我睡过头了。",
    chunks: ["I","overslept."],
    hints: ["我","睡过头了"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/aɪ/'],pos:'第一人称代词',meaning:'我'},
      {role:'谓语',color:'#e74c7a',phonetic:['/ˌoʊvərˈslept/'],pos:'oversleep 的过去式',meaning:'睡过头了'}
    ],
    explanations: [
      "`oversleep` = 睡过头，过去式 overslept。常见错误：\n• \"I oversleep\" → 说的是这次的事，要用过去式\n• \"I sleep over\" → sleep over 是「在别人家过夜」，意思完全不同",
      "相关：I slept in.（我睡了个懒觉）/ I didn't hear my alarm."
    ],
    distractors: [["Me","My","I've"],["oversleeps.","oversleep.","oversleeping."]]
  },
  {
    sentence: "What time will you finish?",
    cid: "b4cd5f6b",
    translation: "你什么时候结束？",
    chunks: ["What time","will you finish?"],
    hints: ["什么时间","你会结束"],
    grammar: [
      {role:'疑问短语',color:'#7c5cbf',phonetic:['/wʌt/','/taɪm/'],pos:'疑问词 + 名词',meaning:'什么时候'},
      {role:'助动词 + 主语 + 谓语',color:'#e74c7a',phonetic:['/wɪl/','/juː/','/ˈfɪnɪʃ/'],pos:'一般将来时疑问句',meaning:'你会结束'}
    ],
    explanations: [
      "问具体几点结束用 `What time...?` 比 When 更聚焦。常见错误：\n• \"What time you will finish?\" → 语序应是 will you finish\n• 也可换说法：What time will you be done?",
      "回答模板：I'll finish at two.（我两点结束）"
    ],
    distractors: [["What times","Which time","How time"],["you will finish?","will you finishes?","do you will finish?"]]
  },
  {
    sentence: "I'll finish at two.",
    cid: "9a127097",
    translation: "我两点结束。",
    chunks: ["I'll finish","at two."],
    hints: ["我会结束","在两点"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪl/','/ˈfɪnɪʃ/'],pos:'will + 动词原形',meaning:'我会结束'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/æt/','/tuː/'],pos:'介词短语',meaning:'在两点'}
    ],
    explanations: [
      "具体钟点前用介词 `at`。常见错误：\n• \"I'll finish in two\" → in two 会被听成「两小时后」\n• \"I'll finish on two\" → 钟点前不用 on",
      "相关：at noon（中午）/ at half past two（两点半）"
    ],
    distractors: [["I finish","I'll finishing","I will finished"],["in two.","on two.","at the two."]]
  },
  {
    sentence: "Let's hang out.",
    cid: "01b8d6e2",
    translation: "出去玩吧。",
    chunks: ["Let's","hang out."],
    hints: ["我们","一起玩、闲逛"],
    grammar: [
      {role:'主谓（祈使）',color:'#e74c7a',phonetic:['/lets/'],pos:'let us 缩写',meaning:'我们'},
      {role:'谓语',color:'#7c5cbf',phonetic:['/hæŋ/','/aʊt/'],pos:'短语动词 hang out',meaning:'一起玩、闲逛'}
    ],
    explanations: [
      "`hang out` = 一起消磨时间、闲逛，超常用。常见错误：\n• 别写成 \"hang on\"，那是「等一下」\n• \"Let's hanging out\" → Let's 后接动词原形",
      "更随意：Wanna hang out? / Hang out sometime?"
    ],
    distractors: [["Let is","Let us to","Let's to"],["hangs out.","hanging out.","hang on."]]
  },
  {
    sentence: "I'm coming to get you.",
    cid: "46bc4117",
    translation: "我来接你了。",
    chunks: ["I'm coming","to get you."],
    hints: ["我正过来","接你"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/aɪm/','/ˈkʌmɪŋ/'],pos:'现在进行时',meaning:'我正过来'},
      {role:'目的状语',color:'#7c5cbf',phonetic:['/tuː/','/ɡet/','/juː/'],pos:'不定式短语',meaning:'去接你'}
    ],
    explanations: [
      "`come to get you` = 过来接你，进行时表马上就到。常见错误：\n• \"I'm coming to pick up you\" → 代词要夹中间：pick you up\n• \"I coming\" → 漏 be 动词",
      "相关：I'll pick you up at seven.（我七点来接你）"
    ],
    distractors: [["I coming","I'm come","I've coming"],["to get yours.","for get you.","to getting you."]]
  },
  {
    sentence: "Lend me 10 bucks.",
    cid: "9187c8c7",
    translation: "借我10块钱。",
    chunks: ["Lend me","10 bucks."],
    hints: ["借给我","十块钱"],
    grammar: [
      {role:'谓语 + 宾语',color:'#e74c7a',phonetic:['/lend/','/miː/'],pos:'动词 + 间接宾语',meaning:'借给我'},
      {role:'宾语',color:'#3358e0',phonetic:['/ten/','/bʌks/'],pos:'数量 + 名词',meaning:'十块钱'}
    ],
    explanations: [
      "`lend` 是「借出」（我借给你），`borrow` 是「借入」（我向你借）。常见错误：\n• \"Borrow me 10 bucks\" → 想说「借我钱」要用 lend me\n• bucks 是口语的「美元」，正式说法 10 dollars",
      "还钱时说：I'll pay you back."
    ],
    distractors: [["Borrow me","Lends me","Lend to me"],["10 buck.","ten bucks of.","10 bucks to."]]
  },
  {
    sentence: "I want my money.",
    cid: "fc023e5e",
    translation: "还我钱。",
    chunks: ["I want","my money."],
    hints: ["我要","我的钱"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/wɑːnt/'],pos:'一般现在时',meaning:'我要'},
      {role:'宾语',color:'#3358e0',phonetic:['/maɪ/','/ˈmʌni/'],pos:'名词短语',meaning:'我的钱'}
    ],
    explanations: [
      "催人还钱最直接的表达；`money` 不可数。常见错误：\n• \"I want my moneys\" → money 没有复数\n• 想客气一点：Could you pay me back?",
      "相关：I need it back.（我得把钱要回来）"
    ],
    distractors: [["I wants","I wanting","Me want"],["my moneys.","mine money.","my monies."]]
  },
  {
    sentence: "Are you angry?",
    cid: "db59a3b8",
    translation: "你生气了吗？",
    chunks: ["Are you","angry?"],
    hints: ["你是","生气的"],
    grammar: [
      {role:'系动词 + 主语',color:'#c87033',phonetic:['/ɑːr/','/juː/'],pos:'一般疑问句',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈæŋɡri/'],pos:'形容词',meaning:'生气的'}
    ],
    explanations: [
      "`angry` 重音在第一音节 /ˈæŋɡri/。常见错误：\n• \"Are you anger?\" → anger 是名词，这里用形容词 angry\n• 对某人生气要说 angry with me",
      "程度递进：annoyed（有点烦）< angry < furious（暴怒）"
    ],
    distractors: [["Is you","Are your","Do you"],["anger?","angrily?","angry with?"]]
  },
  {
    sentence: "Of course not.",
    cid: "85acd6c2",
    translation: "当然没有。",
    chunks: ["Of course","not."],
    hints: ["当然","不"],
    grammar: [
      {role:'状语',color:'#7c5cbf',phonetic:['/əv/','/kɔːrs/'],pos:'固定短语',meaning:'当然'},
      {role:'否定答语',color:'#e74c7a',phonetic:['/nɑːt/'],pos:'副词',meaning:'不'}
    ],
    explanations: [
      "`Of course not.` 用来强烈否认，回答一般疑问句。常见错误：\n• \"Of course no\" → 否定答语用 not\n• 肯定回答是 Of course.，别在肯定回答里带 not",
      "相关：Not at all. / Absolutely not.（语气更强）"
    ],
    distractors: [["Of the course","On course","Of cause"],["no.","none.","not to."]]
  },
  {
    sentence: "I'm shocked.",
    cid: "8a621293",
    translation: "我很震惊。",
    chunks: ["I'm","shocked."],
    hints: ["我","感到震惊的"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/aɪm/'],pos:'I am 缩写',meaning:'我'},
      {role:'表语',color:'#e74c7a',phonetic:['/ʃɑːkt/'],pos:'过去分词作形容词',meaning:'震惊的'}
    ],
    explanations: [
      "`shocked` 表「感到震惊的」，是过去分词作形容词。常见错误：\n• \"I'm shocking\" → shocking 是「令人震惊的」，形容事物\n• \"I shock\" → 要加 be 动词",
      "同类：I'm surprised.（惊讶）/ I'm stunned.（惊呆了）"
    ],
    distractors: [["I","I've","Me"],["shocking.","shock.","shocks."]]
  },
  {
    sentence: "I'm offended.",
    cid: "6ba05043",
    translation: "我觉得被冒犯了。",
    chunks: ["I'm","offended."],
    hints: ["我","被冒犯的"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/aɪm/'],pos:'I am 缩写',meaning:'我'},
      {role:'表语',color:'#e74c7a',phonetic:['/əˈfendɪd/'],pos:'过去分词作形容词',meaning:'被冒犯的'}
    ],
    explanations: [
      "`be offended` = 感到被冒犯，被谁冒犯用 by。常见错误：\n• 拼写：offe**nd**ed，两个 f\n• \"I'm offending\" → offending 是「冒犯别人的」，说自己要用 offended",
      "相关：That's offensive.（那话很冒犯）/ No offense.（无意冒犯）"
    ],
    distractors: [["I","I've","Me"],["offending.","offense.","offend."]]
  },
  {
    sentence: "Don't be sad.",
    cid: "6010cb80",
    translation: "别伤心。",
    chunks: ["Don't be","sad."],
    hints: ["别","伤心"],
    grammar: [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/'],pos:'do not 缩写',meaning:'别'},
      {role:'表语',color:'#c87033',phonetic:['/sæd/'],pos:'形容词',meaning:'伤心的'}
    ],
    explanations: [
      "`Don't be + 形容词` 是安慰别人时的固定否定式。常见错误：\n• \"Don't sad\" → 形容词前必须加 be\n• \"No be sad\" → 否定祈使用 don't",
      "相关安慰语：Cheer up. / It's okay. / I'm here for you."
    ],
    distractors: [["Doesn't","Not be","No"],["sadly.","sadness.","sading."]]
  },
  {
    sentence: "Get yourself together.",
    cid: "ac89bfd8",
    translation: "振作起来。",
    chunks: ["Get yourself","together."],
    hints: ["把你自己","聚拢、振作"],
    grammar: [
      {role:'谓语 + 反身代词',color:'#e74c7a',phonetic:['/ɡet/','/jərˈself/'],pos:'动词 + 反身代词',meaning:'把你自己'},
      {role:'补足语',color:'#7c5cbf',phonetic:['/təˈɡeðər/'],pos:'副词',meaning:'聚拢、振作'}
    ],
    explanations: [
      "`get yourself together` = 振作起来、把状态调回来。常见错误：\n• \"Get together yourself\" → yourself 要紧跟 get\n• \"Get you together\" → 反身代词要用 yourself",
      "更常用：Pull yourself together. / Get a grip."
    ],
    distractors: [["Get you","Getting yourself","Get your"],["togetherness.","togather.","to gather."]]
  },
  {
    sentence: "Great job.",
    cid: "8ec45499",
    translation: "做得好。",
    chunks: ["Great","job."],
    hints: ["很棒的","活儿、表现"],
    grammar: [
      {role:'形容词',color:'#c87033',phonetic:['/ɡreɪt/'],pos:'形容词',meaning:'很棒的'},
      {role:'名词',color:'#3358e0',phonetic:['/dʒɑːb/'],pos:'名词',meaning:'活儿、表现'}
    ],
    explanations: [
      "`Great job.` 是表扬别人的固定说法，前面常省略 What a。常见错误：\n• 说成 \"Great work\" 也对，但 job 更口语\n• 想完整表达：You did a great job.",
      "同类：Nice work. / Well done. / Good for you."
    ],
    distractors: [["Greatly","Greater","Greeting"],["jop.","job's.","jobb."]]
  },
  {
    sentence: "You're right.",
    cid: "0f9b4d48",
    translation: "你说的对。",
    chunks: ["You're","right."],
    hints: ["你是","对的"],
    grammar: [
      {role:'主语 + be',color:'#c87033',phonetic:['/jʊr/'],pos:'you are 缩写',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/raɪt/'],pos:'形容词',meaning:'对的'}
    ],
    explanations: [
      "`You're right.` = 你说得对。常见错误：\n• \"Your right\" → your 是「你的」，要说 You're\n• 说成 \"You are right\" 也没错，只是口语更常缩写",
      "相关：That's right.（没错）/ You've got a point."
    ],
    distractors: [["Your","You","Yours"],["wright.","rite.","rights."]]
  },
  {
    sentence: "You look great today.",
    cid: "734357e7",
    translation: "你今天精神很好。",
    chunks: ["You look","great today."],
    hints: ["你看起来","今天很棒"],
    grammar: [
      {role:'主系动词',color:'#c87033',phonetic:['/juː/','/lʊk/'],pos:'look + 形容词',meaning:'你看起来'},
      {role:'表语 + 时间状语',color:'#3358e0',phonetic:['/ɡreɪt/','/təˈdeɪ/'],pos:'形容词 + 副词',meaning:'今天很棒'}
    ],
    explanations: [
      "`look` 作系动词后接形容词，不接副词。常见错误：\n• \"You look greatly\" → 要用形容词 great\n• \"You look like great\" → like 后面必须接名词",
      "相关：You look tired.（你看起来很累）/ You look nice today."
    ],
    distractors: [["You looks","You looking","You are look"],["greatly today.","great to day.","great todays."]]
  },
  {
    sentence: "I got enough sleep.",
    cid: "4aeb9a71",
    translation: "我睡够了。",
    chunks: ["I got","enough sleep."],
    hints: ["我得到","足够的睡眠"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/ɡɑːt/'],pos:'一般过去时',meaning:'我得到'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɪˈnʌf/','/sliːp/'],pos:'名词短语（不可数）',meaning:'足够的睡眠'}
    ],
    explanations: [
      "`get enough sleep` 是「睡够了」的固定说法。常见错误：\n• \"I got enough sleeps\" → sleep 作名词不可数\n• \"I got sleep enough\" → enough 要放在名词前面",
      "相关：I didn't get much sleep.（我没睡够）/ I'm well rested."
    ],
    distractors: [["I get","I'm got","I gotten"],["enough sleeps.","enough sleeping.","sleep enough."]]
  },
  {
    sentence: "Make your bed.",
    cid: "830c8e09",
    translation: "整理你的床。",
    chunks: ["Make","your bed."],
    hints: ["整理","你的床"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/meɪk/'],pos:'祈使句动词',meaning:'整理'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/bed/'],pos:'名词短语',meaning:'你的床'}
    ],
    explanations: [
      "「铺床、整理被褥」用 `make your bed`，不用 clean。常见错误：\n• \"Clean your bed\" → 床铺用 make the bed\n• \"Make your beds\" → 一人一张床，用单数",
      "相关：make the bed（铺床）/ change the sheets（换床单）"
    ],
    distractors: [["Makes","Making","Make of"],["your beds.","you bed.","your bed is."]]
  },
  {
    sentence: "My alarm's set.",
    cid: "f830f35a",
    translation: "我闹钟定好了。",
    chunks: ["My alarm's","set."],
    hints: ["我的闹钟","定好了"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/maɪ/','/əˈlɑːrmz/'],pos:'名词 + is 缩写',meaning:'我的闹钟（是）'},
      {role:'表语',color:'#e74c7a',phonetic:['/set/'],pos:'过去分词作形容词',meaning:'设定好的'}
    ],
    explanations: [
      "`set` 在此是过去分词，表「已设定好」。常见错误：\n• \"My alarm set\" → 少了 's，句子不完整\n• 想说几点响要加 for：My alarm's set for six.",
      "相关：set an alarm（定个闹钟）/ My alarm went off.（闹钟响了）"
    ],
    distractors: [["My alarm","My alarms is","My alarm is of"],["sets.","setting.","sit."]]
  },
  {
    sentence: "Sleep in.",
    cid: "31bd739b",
    translation: "多睡会儿。",
    chunks: ["Sleep","in."],
    hints: ["睡","（起得更晚）"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/sliːp/'],pos:'祈使句动词',meaning:'睡'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɪn/'],pos:'副词（固定搭配）',meaning:'（比平时起得晚）'}
    ],
    explanations: [
      "`sleep in` = 睡懒觉、比平时起得晚，是固定搭配。常见错误：\n• \"Sleep in bed\" → 那是「睡在床上」，意思不同\n• 说成 \"sleep late\" 也行，但 sleep in 更地道",
      "相关：stay in bed（赖床不起）/ oversleep（睡过头，带责备意味）"
    ],
    distractors: [["Sleeps","Sleeping","Slept"],["out.","on.","over."]]
  },
  {
    sentence: "Read a book.",
    cid: "623c5d57",
    translation: "读读书。",
    chunks: ["Read","a book."],
    hints: ["读","一本书"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/riːd/'],pos:'祈使句动词',meaning:'读'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/bʊk/'],pos:'名词短语',meaning:'一本书'}
    ],
    explanations: [
      "`read` 现在式读 /riːd/，过去式拼写相同但读 /red/。常见错误：\n• 别写成 \"Look a book\"（look 要接 at）\n• \"Read book\" → 可数名词单数前要加 a",
      "相关：read to me（读给我听）/ read aloud（朗读）"
    ],
    distractors: [["Reads","Reading","Reader"],["a books.","book.","a book of."]]
  },
  {
    sentence: "Your room's messy.",
    cid: "0e10399e",
    translation: "你的房间很乱。",
    chunks: ["Your room's","messy."],
    hints: ["你的房间","很乱"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/jʊr/','/ruːmz/'],pos:'名词 + is 缩写',meaning:'你的房间（是）'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈmesi/'],pos:'形容词',meaning:'乱的'}
    ],
    explanations: [
      "`messy` = 乱七八糟的，很口语。常见错误：\n• \"Your room's mess\" → mess 是名词，这里要形容词 messy\n• \"Your room is a mess\" 也常用，两种说法都对",
      "相关：tidy up your room（把房间收拾整齐）/ a mess（一团乱）"
    ],
    distractors: [["Your rooming","You room's","Your room is of"],["mess.","messily.","messes."]]
  },
  {
    sentence: "Clean your room.",
    cid: "e808c2e2",
    translation: "打扫你的房间。",
    chunks: ["Clean","your room."],
    hints: ["打扫","你的房间"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/kliːn/'],pos:'祈使句动词',meaning:'打扫'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/ruːm/'],pos:'名词短语',meaning:'你的房间'}
    ],
    explanations: [
      "`clean` 可作动词，指打扫干净。常见错误：\n• \"Clean up your room\" 也行，但 clean your room 就够\n• 宾语是代词时必须夹中间：clean it up",
      "相关：tidy up（收拾整齐）/ do the cleaning（打扫卫生）"
    ],
    distractors: [["Cleans","Cleaning","Cleaner"],["your rooms.","you room.","your room is."]]
  },
  {
    sentence: "Put on some music.",
    cid: "f256951c",
    translation: "放点音乐。",
    chunks: ["Put on","some music."],
    hints: ["放上、打开","一些音乐"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/pʊt/','/ɑːn/'],pos:'短语动词 put on',meaning:'打开、放上'},
      {role:'宾语',color:'#3358e0',phonetic:['/sʌm/','/ˈmjuːzɪk/'],pos:'名词短语（不可数）',meaning:'一些音乐'}
    ],
    explanations: [
      "音乐、灯光都用 `put on` 表示「打开、放上」。常见错误：\n• \"Open the music\" → 中文说开音乐，英文用 put on\n• \"Put on some musics\" → music 不可数",
      "相关：play some music / turn up the music（把音乐调大）"
    ],
    distractors: [["Put in","Putting on","Put of"],["some musics.","the music.","some musician."]]
  },
  {
    sentence: "Smell some flowers.",
    cid: "60c46056",
    translation: "闻闻花香。",
    chunks: ["Smell some","flowers."],
    hints: ["闻闻","一些花"],
    grammar: [
      {role:'谓语 + 限定词',color:'#e74c7a',phonetic:['/smel/','/sʌm/'],pos:'祈使 + 限定词',meaning:'闻闻'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈflaʊərz/'],pos:'名词（复数）',meaning:'花'}
    ],
    explanations: [
      "`smell` 表「闻」时是及物动词。常见错误：\n• 说一片花丛用复数 flowers 更自然\n• smell 还能作系动词：It smells good.（闻起来很香）",
      "相关：take a deep breath（深呼吸）/ stop and smell the roses（享受生活）"
    ],
    distractors: [["Smells some","Smelling some","Smell of"],["flower.","flowers's.","flour."]]
  },
  {
    sentence: "Have a glass of wine.",
    cid: "e5ed7518",
    translation: "喝一杯酒。",
    chunks: ["Have a glass of","wine."],
    hints: ["喝一杯","葡萄酒"],
    grammar: [
      {role:'谓语 + 量词',color:'#e74c7a',phonetic:['/hæv/','/ə/','/ɡlæs/','/əv/'],pos:'动词 + 量词短语',meaning:'喝一杯'},
      {role:'宾语',color:'#3358e0',phonetic:['/waɪn/'],pos:'不可数名词',meaning:'葡萄酒'}
    ],
    explanations: [
      "液体用量词 `a glass of`。常见错误：\n• \"Have a wine\" → 一杯酒要说 a glass of wine\n• \"Have a glass wine\" → 少了 of",
      "相关：a cup of tea（一杯茶）/ a bottle of beer（一瓶啤酒）"
    ],
    distractors: [["Have a glass","Have the glass of","Having a glass of"],["wines.","wine is.","win."]]
  },
  {
    sentence: "Have some nice food.",
    cid: "264a3504",
    translation: "吃点好的。",
    chunks: ["Have some","nice food."],
    hints: ["吃一点","好吃的"],
    grammar: [
      {role:'谓语 + 限定词',color:'#e74c7a',phonetic:['/hæv/','/sʌm/'],pos:'动词 + 限定词',meaning:'吃一点'},
      {role:'宾语',color:'#3358e0',phonetic:['/naɪs/','/fuːd/'],pos:'名词短语（不可数）',meaning:'好吃的'}
    ],
    explanations: [
      "`nice food` 泛指好吃的；food 泛指时不可数。常见错误：\n• \"Have some nice foods\" → 泛指用不可数形式\n• \"Eat some nice food\" 也行，但 have 在招待语境更自然",
      "相关：treat yourself（犒劳一下自己）/ have a nice meal"
    ],
    distractors: [["Have a","Have any","Had some"],["foods.","the food of.","nice foods."]]
  },
  {
    sentence: "Let me hug you.",
    cid: "77eefd93",
    translation: "让我抱抱你。",
    chunks: ["Let me","hug you."],
    hints: ["让我","抱你"],
    grammar: [
      {role:'使役动词 + 宾语',color:'#e74c7a',phonetic:['/let/','/miː/'],pos:'let + 宾格',meaning:'让我'},
      {role:'谓语 + 宾语',color:'#3358e0',phonetic:['/hʌɡ/','/juː/'],pos:'动词 + 宾语',meaning:'抱你'}
    ],
    explanations: [
      "`let me + 动词原形` 表请求允许自己做什么。常见错误：\n• \"Let me to hug you\" → let 后不加 to\n• \"Let I hug you\" → let 后要用宾格 me",
      "相关：Give me a hug.（抱一下）/ Can I hug you?"
    ],
    distractors: [["Let I","Letting me","Let me to"],["hug yours.","hugging you.","to hug you."]]
  },
  {
    sentence: "Get off of me.",
    cid: "2d1602f3",
    translation: "放开我。",
    chunks: ["Get off of","me."],
    hints: ["从……上离开","我"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/ɔːf/','/əv/'],pos:'短语动词 get off of',meaning:'从……上离开'},
      {role:'宾语',color:'#3358e0',phonetic:['/miː/'],pos:'人称代词宾格',meaning:'我'}
    ],
    explanations: [
      "`Get off of me.` = 放开我、别压着我，of 是口语里常加的。常见错误：\n• \"Get off me\" 也很常见，美式更爱加 of\n• \"Get of me\" → 少了 f，get off 不能漏",
      "相关：Let go of me.（放开我）/ Hands off!（别碰）"
    ],
    distractors: [["Get out of","Get of","Getting off of"],["us.","him.","them."]]
  },
  {
    sentence: "Come in.",
    cid: "6de68bea",
    translation: "进来。",
    chunks: ["Come","in."],
    hints: ["来","进来"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/kʌm/'],pos:'祈使句动词',meaning:'来'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɪn/'],pos:'副词（表方向）',meaning:'进来'}
    ],
    explanations: [
      "`Come in.` 是让人进屋最常用的说法，也用来回应敲门。常见错误：\n• \"Come into\" → into 后面必须接宾语（come into the room）\n• \"Enter in\" → enter 本身不接 in",
      "相关：Come on in.（快进来，更热情）/ After you.（您先请）"
    ],
    distractors: [["Comes","Coming","Come to"],["into.","on.","out."]]
  },
  {
    sentence: "Lock the door.",
    cid: "d403abf3",
    translation: "把门锁上。",
    chunks: ["Lock","the door."],
    hints: ["锁上","门"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/lɑːk/'],pos:'祈使句动词',meaning:'锁'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/dɔːr/'],pos:'名词短语',meaning:'门'}
    ],
    explanations: [
      "`lock` 既是名词（锁）也是动词（锁上）。常见错误：\n• door 前要加 the\n• \"Close the door\" 只是关门，lock 才是上锁",
      "相关：lock up（把门窗锁好再走）/ unlock the door（开锁）"
    ],
    distractors: [["Locks","Locking","Locker"],["the doors.","a door.","the door of."]]
  },
  {
    sentence: "Don't mix them up.",
    cid: "34b89c56",
    translation: "别把它们搞混了。",
    chunks: ["Don't mix","them up."],
    hints: ["别弄混","它们"],
    grammar: [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/','/mɪks/'],pos:'don\'t + 动词原形',meaning:'别弄混'},
      {role:'宾语 + 副词',color:'#7c5cbf',phonetic:['/ðem/','/ʌp/'],pos:'短语动词 mix up（代词夹中）',meaning:'把它们搞混'}
    ],
    explanations: [
      "`mix up` = 弄混，代词宾语夹中间：mix **them** up。常见错误：\n• \"Don't mix up them\" → 代词要放中间\n• \"Don't mix them\" → 不加 up 会变成「别把它们搅在一起」",
      "相关：I always mix them up.（我总分不清）/ tell them apart（把它们区分开）"
    ],
    distractors: [["Doesn't mix","Don't mix up","No mix"],["they up.","them on.","ups them."]]
  },
  {
    sentence: "Sort them out.",
    cid: "f15b18c1",
    translation: "把它们分清楚。",
    chunks: ["Sort","them out."],
    hints: ["分类、理清","它们"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/sɔːrt/'],pos:'祈使句动词',meaning:'分类、理清'},
      {role:'宾语 + 副词',color:'#7c5cbf',phonetic:['/ðem/','/aʊt/'],pos:'短语动词 sort out（代词夹中）',meaning:'把它们理清楚'}
    ],
    explanations: [
      "`sort out` = 整理、理清、分清，代词夹中间：sort **them** out。常见错误：\n• \"Sort out them\" → 代词要放中间\n• \"Sort them\" 单说意思不完整",
      "相关：figure it out（弄明白）/ work it out（解决）"
    ],
    distractors: [["Sorts","Sorting","Sorted"],["they out.","them off.","out them."]]
  },
  {
    sentence: "Keep it.",
    cid: "bbb7bec1",
    translation: "你留着吧。",
    chunks: ["Keep","it."],
    hints: ["留着、收下","它"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/kiːp/'],pos:'祈使句动词',meaning:'留着、收下'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɪt/'],pos:'人称代词宾格',meaning:'它'}
    ],
    explanations: [
      "`Keep it.` = 收下吧、你留着，送东西时最常说。常见错误：\n• \"Take it\" 语气更硬，像命令，不是送礼口吻\n• \"Keep it for you\" → 应为 keep it for yourself",
      "相关：It's yours.（给你了）/ Keep the change.（零钱不用找了）"
    ],
    distractors: [["Keeps","Keeping","Keep of"],["them.","its.","it is."]]
  },
  {
    sentence: "Throw it out.",
    cid: "b2294826",
    translation: "把它扔了。",
    chunks: ["Throw it","out."],
    hints: ["把它扔","出去"],
    grammar: [
      {role:'谓语 + 宾语',color:'#e74c7a',phonetic:['/θroʊ/','/ɪt/'],pos:'短语动词 throw out（代词夹中）',meaning:'把它扔掉'},
      {role:'副词',color:'#7c5cbf',phonetic:['/aʊt/'],pos:'副词',meaning:'出去'}
    ],
    explanations: [
      "`throw out` = 扔掉，代词宾语夹中间：throw **it** out。常见错误：\n• \"Throw out it\" → 代词要放中间\n• \"Throw it away\" 也常用，意思相同",
      "相关：take out the trash（倒垃圾）/ get rid of it（处理掉它）"
    ],
    distractors: [["Throw out it","Throwing it out","Throw it of"],["of.","out to.","out off."]]
  },
  {
    sentence: "Turn on the lights.",
    cid: "c7ea95cd",
    translation: "打开灯。",
    chunks: ["Turn on","the lights."],
    hints: ["打开","灯"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/tɜːrn/','/ɑːn/'],pos:'短语动词 turn on',meaning:'打开'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/laɪts/'],pos:'名词短语',meaning:'灯'}
    ],
    explanations: [
      "电器、水龙头、灯的「开」都用 `turn on`。常见错误：\n• \"Open the lights\" → 中文说开灯，英文用 turn on\n• 宾语是代词时要夹中间：turn them on",
      "相关：turn off the lights（关灯）/ switch on（偏英式）"
    ],
    distractors: [["Turn in","Turning on","Turn of"],["the lights of.","a lights.","the lights on."]]
  },
  {
    sentence: "The power's out.",
    cid: "78e4af03",
    translation: "停电了。",
    chunks: ["The power's","out."],
    hints: ["电力","断了、没了"],
    grammar: [
      {role:'主语',color:'#c87033',phonetic:['/ðə/','/ˈpaʊərz/'],pos:'名词 + is 缩写',meaning:'电（是）'},
      {role:'表语',color:'#3358e0',phonetic:['/aʊt/'],pos:'副词作表语',meaning:'断了、没了'}
    ],
    explanations: [
      "`The power's out.` = 停电了，out 表「断了」。常见错误：\n• \"The power is off\" 指「关着的」，停电用 out 更地道\n• \"The electricity's out\" 也行，但 power 更口语",
      "相关：a power outage（停电）/ The lights went out.（灯灭了）"
    ],
    distractors: [["The power","The powers is","The power is of"],["off.","down.","over."]]
  },
  {
    sentence: "Mop the floor.",
    cid: "fb98228c",
    translation: "拖地（擦地板）。",
    chunks: ["Mop","the floor."],
    hints: ["用拖把擦","地板"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/mɑːp/'],pos:'祈使句动词',meaning:'拖（地）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/flɔːr/'],pos:'名词短语',meaning:'地板'}
    ],
    explanations: [
      "`mop` 专指用拖把擦地。常见错误：\n• \"Wipe the floor\" 是用抹布擦，工具不同\n• mop 也可作名词：a mop（拖把）",
      "相关：sweep the floor（扫地）/ vacuum the carpet（吸地毯）"
    ],
    distractors: [["Mops","Mopping","Map"],["the floors.","a floor.","the floor of."]]
  },
  {
    sentence: "Do the dishes.",
    cid: "70c23bb5",
    translation: "洗碗。",
    chunks: ["Do","the dishes."],
    hints: ["做（这件事）","碗碟"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/duː/'],pos:'祈使句动词',meaning:'做（某事）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈdɪʃɪz/'],pos:'名词短语',meaning:'碗碟'}
    ],
    explanations: [
      "`do the dishes` = 洗碗，是固定搭配。常见错误：\n• \"Do the dish\" → 用复数 dishes\n• 英式也常说 wash up，意思一样",
      "相关：do the laundry（洗衣服）/ do the cooking（做饭）"
    ],
    distractors: [["Does","Doing","Done"],["the dish.","a dishes.","the dishes of."]]
  },
  {
    sentence: "Put it up.",
    cid: "fab59b9a",
    translation: "挂上去。",
    chunks: ["Put it","up."],
    hints: ["把它","挂上"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/pʊt/','/ɪt/'],pos:'短语动词 put up（代词夹中）',meaning:'把它挂起'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ʌp/'],pos:'副词',meaning:'上（挂）'}
    ],
    explanations: [
      "`put up` = 挂上去、张贴，代词夹中间：put **it** up。常见错误：\n• \"Put up it\" → 代词要放中间\n• put up 还能表「提高」（put up the price），靠语境区分",
      "反义：take it down（拿下来）。"
    ],
    distractors: [["Put up it","Putting it up","Put it of"],["in.","on.","over."]]
  },
  {
    sentence: "Take it down.",
    cid: "7389fce9",
    translation: "拿下来。",
    chunks: ["Take it","down."],
    hints: ["把它","取下"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ɪt/'],pos:'短语动词 take down（代词夹中）',meaning:'把它取下'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词',meaning:'下（取下）'}
    ],
    explanations: [
      "`take down` = 拿下来、取下，代词夹中间：take **it** down。常见错误：\n• \"Take down it\" → 代词要放中间\n• take down 还能表「记下」（take down notes）",
      "反义：put it up（挂上去）。"
    ],
    distractors: [["Take down it","Taking it down","Take it of"],["up.","over.","aside."]]
  },
  {
    sentence: "Climb up.",
    cid: "b070daa7",
    translation: "爬上去。",
    chunks: ["Climb","up."],
    hints: ["爬","上去"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/klaɪm/'],pos:'祈使句动词',meaning:'爬'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ʌp/'],pos:'副词（表方向）',meaning:'上去'}
    ],
    explanations: [
      "`climb up` 强调往上爬，反义 climb down。常见错误：\n• b 不发音，读 /klaɪm/\n• 后面接宾语时是「爬到……上」：climb up the tree",
      "相关：climb over（爬过去）/ climb in（爬进来）"
    ],
    distractors: [["Climbs","Climbing","Climbed"],["upstairs.","over.","down the."]]
  },
  {
    sentence: "Climb down.",
    cid: "b0bc4558",
    translation: "爬下来。",
    chunks: ["Climb","down."],
    hints: ["爬","下来"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/klaɪm/'],pos:'祈使句动词',meaning:'爬'},
      {role:'副词',color:'#7c5cbf',phonetic:['/daʊn/'],pos:'副词（表方向）',meaning:'下来'}
    ],
    explanations: [
      "`climb down` = 爬下来，也引申为「让步、认错」。常见错误：\n• b 不发音，读 /klaɪm/\n• 接宾语时是「从……下来」：climb down the ladder",
      "相关：get down（下来）/ come down（下来）"
    ],
    distractors: [["Climbs","Climbing","Climbed"],["upstairs.","over.","up the."]]
  },
  {
    sentence: "Do the laundry.",
    cid: "83eb9b90",
    translation: "洗衣服。",
    chunks: ["Do","the laundry."],
    hints: ["做（这件事）","要洗的衣物"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/duː/'],pos:'祈使句动词',meaning:'做（某事）'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/ˈlɔːndri/'],pos:'名词短语',meaning:'要洗的衣物'}
    ],
    explanations: [
      "`do the laundry` = 洗衣服，固定搭配。常见错误：\n• 拼写：lau**n**dry，容易错写成 launday\n• \"Wash the laundry\" 不地道，动词用 do",
      "相关：do the dishes（洗碗）/ hang the laundry（晾衣服）"
    ],
    distractors: [["Does","Doing","Done"],["the laundrys.","a laundry.","the laundry of."]]
  },
  {
    sentence: "Water the plants.",
    cid: "f1c0fcfb",
    translation: "给花浇水。",
    chunks: ["Water","the plants."],
    hints: ["浇水","植物"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ˈwɔːtər/'],pos:'动词（浇水）',meaning:'浇'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/plænts/'],pos:'名词短语',meaning:'植物'}
    ],
    explanations: [
      "`water` 作动词就是「浇水」。常见错误：\n• \"Give water the plants\" → 直接 water the plants 就行\n• plant 与 plan 容易听混，注意词尾 /t/",
      "相关：feed the dog（喂狗）/ walk the dog（遛狗）"
    ],
    distractors: [["Waters","Watering","Watered"],["the plants of.","a plants.","plans."]]
  },
  {
    sentence: "Take it out.",
    cid: "a36e08cb",
    translation: "拿出来。",
    chunks: ["Take it","out."],
    hints: ["把它","取出"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/teɪk/','/ɪt/'],pos:'短语动词 take out（代词夹中）',meaning:'把它取出'},
      {role:'副词',color:'#7c5cbf',phonetic:['/aʊt/'],pos:'副词',meaning:'出来'}
    ],
    explanations: [
      "`take out` = 拿出来、取出来，代词夹中间：take **it** out。常见错误：\n• \"Take out it\" → 代词要放中间\n• takeout（一个词）作名词时指「外卖」",
      "反义：put it back（放回去）。"
    ],
    distractors: [["Take out it","Taking it out","Take it of"],["in.","up.","off."]]
  },
  {
    sentence: "Put it back.",
    cid: "a73bf6b4",
    translation: "放回去。",
    chunks: ["Put it","back."],
    hints: ["把它","放回"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/pʊt/','/ɪt/'],pos:'短语动词 put back（代词夹中）',meaning:'把它放回'},
      {role:'副词',color:'#7c5cbf',phonetic:['/bæk/'],pos:'副词',meaning:'回去'}
    ],
    explanations: [
      "`put it back` = 放回原处，代词夹中间。常见错误：\n• \"Put back it\" → 代词要放中间\n• \"Put it back to\" → back 后面一般不加 to",
      "相关：put it away（收起来）/ return it（归还）"
    ],
    distractors: [["Put back it","Putting it back","Put it of"],["front.","down.","of."]]
  },
  {
    sentence: "Don't fall asleep.",
    cid: "97500516",
    translation: "别睡着了。",
    chunks: ["Don't fall","asleep."],
    hints: ["别","睡着的"],
    grammar: [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/','/fɔːl/'],pos:'don\'t + 动词原形',meaning:'别'},
      {role:'表语',color:'#3358e0',phonetic:['/əˈsliːp/'],pos:'形容词（表状态）',meaning:'睡着的'}
    ],
    explanations: [
      "`fall asleep` = 睡着，指进入睡眠状态。常见错误：\n• \"Don't fall sleep\" → 形容词是 asleep，不是 sleep\n• \"Don't sleep\" 只是「别睡」，fall asleep 更强调整个人睡过去",
      "相关：stay awake（保持清醒）/ I nodded off.（我打瞌睡了）"
    ],
    distractors: [["Doesn't fall","Don't fall to","No fall"],["sleep.","sleeping.","sleepy."]]
  },
  {
    sentence: "Don't stay up.",
    cid: "0da18463",
    translation: "别熬夜。",
    chunks: ["Don't stay","up."],
    hints: ["别","熬夜、不睡"],
    grammar: [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/','/steɪ/'],pos:'don\'t + 动词原形',meaning:'别'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ʌp/'],pos:'副词（固定搭配 stay up）',meaning:'熬夜、不睡'}
    ],
    explanations: [
      "`stay up` = 熬夜不睡，up 是固定成分。常见错误：\n• \"Don't stay wake\" → 想说不睡应该用 stay up / stay awake\n• 常说 \"Don't stay up late\"，指别熬到很晚",
      "相关：pull an all-nighter（通宵）/ get an early night（早点睡）"
    ],
    distractors: [["Doesn't stay","Don't stay to","No stay"],["out.","in.","down."]]
  },
  {
    sentence: "I had a nightmare.",
    cid: "bb4458df",
    translation: "我做了个噩梦。",
    chunks: ["I had","a nightmare."],
    hints: ["我做了","一个噩梦"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/hæd/'],pos:'一般过去时',meaning:'我做了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/ˈnaɪtmer/'],pos:'名词短语',meaning:'一个噩梦'}
    ],
    explanations: [
      "「做噩梦」用 `have a nightmare`，过去式 had。常见错误：\n• \"I have a nightmare\" → 说昨晚的事要用过去式\n• \"I made a nightmare\" → 噩梦不是「制作」的，用 have",
      "相关：a bad dream（也行）/ a sweet dream（好梦）"
    ],
    distractors: [["I have","I'm had","I had got"],["a nightmares.","nightmare.","a night mare."]]
  },
  {
    sentence: "Go to bed early.",
    cid: "95169b06",
    translation: "早点睡。",
    chunks: ["Go to bed","early."],
    hints: ["上床睡觉","早"],
    grammar: [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡoʊ/','/tuː/','/bed/'],pos:'动词短语 go to bed',meaning:'上床睡觉'},
      {role:'状语',color:'#7c5cbf',phonetic:['/ˈɜːrli/'],pos:'副词',meaning:'早'}
    ],
    explanations: [
      "`go to bed` 指「去睡觉」，bed 前不加冠词。常见错误：\n• \"Go to the bed\" → 那是「走到那张床边去」\n• \"Go to sleep early\" 也可，但 go to bed 更强调上床这个动作",
      "相关：get an early night（早点睡）/ stay up late（熬夜）"
    ],
    distractors: [["Go to the bed","Go to bed to","Going to bed"],["late.","earlier.","earliest."]]
  },
  {
    sentence: "Give me a thumbs up.",
    cid: "1bcdc1c7",
    translation: "给我竖个大拇指（点个赞）吧。",
    chunks: ["Give me","a thumbs up."],
    hints: ["给我","一个大拇指（赞成）"],
    grammar: [
      {role:'谓语 + 宾语',color:'#e74c7a',phonetic:['/ɡɪv/','/miː/'],pos:'动词 + 间接宾语',meaning:'给我'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/θʌmz/','/ʌp/'],pos:'名词短语（固定写法）',meaning:'一个大拇指'}
    ],
    explanations: [
      "`a thumbs up` = 竖大拇指表示赞成，固定带 s。常见错误：\n• \"a thumb up\" → 固定写法是 thumbs up\n• 引申为「点赞」：Give it a thumbs up.",
      "反义：a thumbs down（表示反对）"
    ],
    distractors: [["Give me to","Giving me","Give I"],["a thumb up.","a thumbs-ups.","thumb ups."]]
  },
  {
    sentence: "We have more like this.",
    cid: "2dc7b93b",
    translation: "我们还有更多像这样的。",
    chunks: ["We have","more like this."],
    hints: ["我们有","更多像这样的"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/wiː/','/hæv/'],pos:'一般现在时',meaning:'我们有'},
      {role:'宾语',color:'#3358e0',phonetic:['/mɔːr/','/laɪk/','/ðɪs/'],pos:'名词短语',meaning:'更多像这样的'}
    ],
    explanations: [
      "`more like this` = 更多像这样的，用于介绍同类内容。常见错误：\n• \"more like these\" → 指刚提到的那一类用 this 更稳\n• 只说 \"We have more\" 需要语境支撑，说完整更清楚",
      "相关：There's plenty more.（还有很多）/ Want to see more?"
    ],
    distractors: [["We has","We having","We are have"],["more like these.","more likes this.","much like this."]]
  },
  {
    sentence: "I want to stay in bed for another half an hour.",
    cid: "257c6484",
    translation: "我真想在床上多睡半个小时。",
    chunks: ["I want to stay in bed","for another half an hour."],
    hints: ["我想赖在床上","再多半个小时"],
    grammar: [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/wɑːnt/','/tə/','/steɪ/'],pos:'一般现在时',meaning:'我想待'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/fər/','/əˈnʌðər/','/hæf/','/ən/','/ˈaʊər/'],pos:'介词短语',meaning:'再多半个小时'}
    ],
    explanations: [
      "`stay in bed` 指「赖在床上不起」，注意介词是 `in` 不是 `on`。常见错误：\n• \"stay **on** bed\" → 人躺在床上用 in bed\n• \"another half an hour\" 里 half an hour 本身带 an，前面再加 another 即可",
      "`another half an hour` = 再半个小时，口语常缩成 another half hour（美式）。"
    ],
    distractors: [["I want stay in bed","I want to staying in bed","I want to stay on bed"],["for other half an hour.","for another half a hour.","of another half an hour."]]
  },
  {
    sentence: "It's time to get up.",
    cid: "f19ef7b9",
    translation: "该起床了。",
    chunks: ["It's time","to get up."],
    hints: ["是时候","起来了"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/taɪm/'],pos:'固定句型',meaning:'是时候了'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/ɡet/','/ʌp/'],pos:'不定式短语',meaning:'起床'}
    ],
    explanations: [
      "`It's time to do sth` 是「该做某事了」的固定句型。常见错误：\n• \"It's time **for** get up\" → for 后面只能接名词，接动词要用 to\n• \"It time to get up\" → 不能丢 be 动词",
      "对比 `It's time for bed.`（该睡了）：for + 名词 / to + 动词原形。"
    ],
    distractors: [["It's time for","It time","It's the time"],["to got up.","to get on.","to getting up."]]
  },
  {
    sentence: "Let me sleep for ten minutes.",
    cid: "3db64270",
    translation: "让我再睡十分钟。",
    chunks: ["Let me sleep","for ten minutes."],
    hints: ["让我睡","十分钟"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/let/','/miː/','/sliːp/'],pos:'使役动词祈使',meaning:'让我睡'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/fər/','/ten/','/ˈmɪnɪts/'],pos:'介词短语',meaning:'十分钟'}
    ],
    explanations: [
      "`Let me do sth` 表示请求允许自己做某事。常见错误：\n• \"Let me **to** sleep\" → let 后接动词原形，不加 to\n• \"Let **I** sleep\" → let 后面用宾格 me",
      "`for ten minutes` 用 for 表示持续时长，ten 后面 minutes 要用复数。"
    ],
    distractors: [["Let me sleeping","Let me to sleep","Let I sleep"],["for ten minute.","in ten minutes.","for ten minites."]]
  },
  {
    sentence: "When do you get up on Saturday?",
    cid: "4bc148af",
    translation: "星期六你几点起床？",
    chunks: ["When do you","get up","on Saturday?"],
    hints: ["你什么时候","起床","在星期六"],
    grammar: [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/wen/','/duː/','/juː/'],pos:'一般现在时疑问',meaning:'你什么时候'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/ɡet/','/ʌp/'],pos:'短语动词',meaning:'起床'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɒn/','/ˈsætərdeɪ/'],pos:'介词短语',meaning:'在星期六'}
    ],
    explanations: [
      "问固定作息常用 `When do you ...?`，问某一次用 `When did you ...?`。常见错误：\n• \"When **does** you get up\" → 主语 you 用 do\n• \"**in** Saturday\" → 具体某天用 on",
      "`get up` 是「起床」，`wake up` 是「醒来」，两者不同。",
      "`on Saturday` 指（这个）星期六；泛指每个周六用 on Saturdays，星期前一律用 on，不用 in/at。"
    ],
    distractors: [["When does you","When are you","When you"],["gets up","getting up","get on"],["in Saturday?","at Saturday?","on the Saturday?"]]
  },
  {
    sentence: "Get up soon.",
    cid: "d8351b8f",
    translation: "快起床。",
    chunks: ["Get up","soon."],
    hints: ["起来","快点"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/ɡet/','/ʌp/'],pos:'短语动词祈使',meaning:'起来'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/suːn/'],pos:'副词',meaning:'很快、尽早'}
    ],
    explanations: [
      "`Get up.` 是祈使句，主语 you 不出现。常见错误：\n• \"Get **on**\" → get on 是上车/进展，起床是 get up\n• \"Getting up soon\" → 祈使句要用动词原形",
      "`soon` 表「尽早、快点」，语气比 immediately 缓和，妈妈叫孩子起床常用。"
    ],
    distractors: [["Get on","Got up","Get up to"],["later.","soonest.","more soon."]]
  },
  {
    sentence: "I usually sleep late on Saturday.",
    cid: "615604c4",
    translation: "我星期六通常晚起。",
    chunks: ["I usually sleep late","on Saturday."],
    hints: ["我通常睡到很晚","在星期六"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/ˈjuːʒuəli/','/sliːp/','/leɪt/'],pos:'一般现在时+频度副词',meaning:'我通常睡到很晚'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɒn/','/ˈsætərdeɪ/'],pos:'介词短语',meaning:'在星期六'}
    ],
    explanations: [
      "`sleep late` 是「睡懒觉、起得晚」，不是「睡得晚」（睡得晚是 go to bed late）。常见错误：\n• \"I usual sleep late\" → 修饰动词要用副词 usually\n• \"sleep **lately**\" → lately 是「最近」，性质完全不同",
      "频度副词 usually 放在实义动词 sleep 之前。"
    ],
    distractors: [["I usual sleep late","I usually sleeps late","I usually sleep lately"],["in Saturday.","at Saturday.","on the Saturday."]]
  },
  {
    sentence: "I don't want to get up.",
    cid: "ad376550",
    translation: "我真不想起床。",
    chunks: ["I don't want","to get up."],
    hints: ["我不想","起床"],
    grammar: [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪ/','/doʊnt/','/wɑːnt/'],pos:'一般现在时否定',meaning:'我不想'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/ɡet/','/ʌp/'],pos:'不定式短语',meaning:'起床'}
    ],
    explanations: [
      "`want to do` 表示「想做」，否定用 don't want。常见错误：\n• \"I **doesn't** want\" → 主语 I 用 don't\n• \"I don't want **get up**\" → want 后接不定式要带 to",
      "口语里常弱读成 I don' wanna get up。"
    ],
    distractors: [["I doesn't want","I don't wants","I not want"],["to get on.","to got up.","for get up."]]
  },
  {
    sentence: "Are you awake?",
    cid: "83b90662",
    translation: "你醒了吗？",
    chunks: ["Are you","awake?"],
    hints: ["你","醒着吗"],
    grammar: [
      {role:'一般疑问句',color:'#e74c7a',phonetic:['/ɑːr/','/juː/'],pos:'be 动词疑问',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/əˈweɪk/'],pos:'形容词',meaning:'醒着的'}
    ],
    explanations: [
      "`awake` 是形容词，前面用 be 动词。常见错误：\n• \"**Do** you awake?\" → awake 是形容词，问「醒着吗」用 be 动词\n• \"Are you **wake**?\" → wake 是动词，形容词形式是 awake",
      "对比 `Are you up?`（你起来了吗）：awake 指醒着，up 指已下床。"
    ],
    distractors: [["Do you","Is you","Are your"],["wake?","awaked?","waking?"]]
  },
  {
    sentence: "It's too early for getting up.",
    cid: "2601c5bd",
    translation: "现在起床还太早。",
    chunks: ["It's too early","for getting up."],
    hints: ["太早了","为起床"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/tuː/','/ˈɜːrli/'],pos:'程度副词+形容词',meaning:'太早了'},
      {role:'介词短语',color:'#7c5cbf',phonetic:['/fər/','/ˈɡetɪŋ/','/ʌp/'],pos:'for+动名词',meaning:'为起床'}
    ],
    explanations: [
      "`too early` 意为「太早」，too 修饰形容词表程度过分。常见错误：\n• \"too **earlier**\" → too 后面用原级，不叠加比较级\n• \"for **get** up\" → for 后接动名词 getting",
      "口语里更常说 It's too early to get up，用不定式更简练。"
    ],
    distractors: [["It's too earlier","It's so much early","It's very too early"],["to getting up.","for get up.","for getting on."]]
  },
  {
    sentence: "It's still early.",
    cid: "a155ee83",
    translation: "时间还早。",
    chunks: ["It's still","early."],
    hints: ["还是","早"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/stɪl/'],pos:'still+be',meaning:'还是（处于）'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈɜːrli/'],pos:'形容词',meaning:'早的'}
    ],
    explanations: [
      "`still` 表示「仍然、还」，放在 be 动词之后。常见错误：\n• \"It's **yet** early\" → yet 多用于否定句和疑问句\n• \"It's already early\" → already 表「已经」，语义相反",
      "对比 `It's already late.`（已经很晚了）：still 强调延续，already 强调完成。"
    ],
    distractors: [["It's still yet","It's yet","It's ever"],["earlier.","late.","so early."]]
  },
  {
    sentence: "Why didn't the alarm go off?",
    cid: "3cfec5e3",
    translation: "闹钟为什么没响呢？",
    chunks: ["Why didn't the alarm","go off?"],
    hints: ["为什么闹钟","没响"],
    grammar: [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/waɪ/','/ˈdɪdnt/','/ði/','/əˈlɑːrm/'],pos:'过去时否定疑问',meaning:'为什么闹钟没有'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/ɡoʊ/','/ɔːf/'],pos:'短语动词',meaning:'（闹钟）响起来'}
    ],
    explanations: [
      "`go off` 指闹钟「响起来」，是固定短语动词。常见错误：\n• \"Why the alarm didn't go off\" → 疑问句助动词 didn't 要提到主语前\n• \"go **on**\" → go on 是「继续」，闹钟响是 go off",
      "对比 `set the alarm`（设闹钟）/ `the alarm went off`（闹钟响了）。"
    ],
    distractors: [["Why the alarm didn't","Why didn't the alarms","Why does the alarm didn't"],["go on?","go out?","went off?"]]
  },
  {
    sentence: "Did you hear the alarm?",
    cid: "27b1176e",
    translation: "你听到闹钟了吗？",
    chunks: ["Did you hear","the alarm?"],
    hints: ["你听到","闹钟了吗"],
    grammar: [
      {role:'助动词+主语+谓语',color:'#e74c7a',phonetic:['/dɪd/','/juː/','/hɪr/'],pos:'一般过去时疑问',meaning:'你听到了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ði/','/əˈlɑːrm/'],pos:'名词短语',meaning:'闹钟'}
    ],
    explanations: [
      "`Did you + 动词原形`构成过去时一般疑问句。常见错误：\n• \"Did you **heard**\" → 助动词 did 后面动词要用原形\n• \"**Do** you hear\" → 问已经发生的事要用 did",
      "`hear` 强调「听见」（结果），`listen to` 强调「听」（动作）。"
    ],
    distractors: [["Did you heard","Did you hearing","Does you hear"],["the alarms?","the alarming?","a alarming?"]]
  },
  {
    sentence: "I've been dreaming all night.",
    cid: "7d234a10",
    translation: "我一直在做梦。",
    chunks: ["I've been dreaming","all night."],
    hints: ["我一直在做梦","一整晚"],
    grammar: [
      {role:'现在完成进行',color:'#e74c7a',phonetic:['/aɪv/','/bɪn/','/ˈdriːmɪŋ/'],pos:'现在完成进行时',meaning:'我一直在做梦'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɔːl/','/naɪt/'],pos:'名词短语作状语',meaning:'整晚'}
    ],
    explanations: [
      "`have been doing` 表示从过去持续到现在的动作。常见错误：\n• \"I've been **dreamed**\" → 进行时用 dreaming\n• \"all **the** night\" → 地道说法是 all night（不加 the）",
      "`all night` 指整晚；想说「熬夜」是 stay up all night。"
    ],
    distractors: [["I've been dreamed","I've dreaming","I was been dreaming"],["all the night.","all nights.","whole night."]]
  },
  {
    sentence: "I feel dizzy.",
    cid: "0307af34",
    translation: "我觉得头昏脑涨的。",
    chunks: ["I feel","dizzy."],
    hints: ["我觉得","晕"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/fiːl/'],pos:'一般现在时',meaning:'我觉得'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈdɪzi/'],pos:'形容词',meaning:'头晕的'}
    ],
    explanations: [
      "`feel` 是系动词，后面接形容词。常见错误：\n• \"I **feeling** dizzy\" → 一般现在时用 feel\n• \"I feel **dizziness**\" → 要说感觉晕用形容词 dizzy，名词 dizziness 是「眩晕症」",
      "同类表达：I feel light-headed.（我觉得头晕）"
    ],
    distractors: [["I feeling","I'm feel","I feels"],["dizzily.","dizziness.","dizzying."]]
  },
  {
    sentence: "Is David up yet?",
    cid: "a5e554a7",
    translation: "大卫起床了吗？",
    chunks: ["Is David up","yet?"],
    hints: ["大卫起来了吗","还没"],
    grammar: [
      {role:'主语+系动词',color:'#c87033',phonetic:['/ɪz/','/ˈdeɪvɪd/','/ʌp/'],pos:'be+up 疑问',meaning:'大卫起来了吗'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/jet/'],pos:'副词',meaning:'（用于疑问）已经'}
    ],
    explanations: [
      "`be up` 表示「已起床」。常见错误：\n• \"**Does** David up\" → up 是副词，与 be 连用，不用 do\n• \"Is David up **already**\" → 疑问句问「是否已经」用 yet",
      "`yet` 在疑问句里表示「（到目前）已经」，回答用 Not yet.（还没）。"
    ],
    distractors: [["Does David up","Has David up","Is David up to"],["already?","even?","soon?"]]
  },
  {
    sentence: "He is still in bed.",
    cid: "4778de8a",
    translation: "他还没起。",
    chunks: ["He is still","in bed."],
    hints: ["他还是","在床上"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/hiː/','/ɪz/','/stɪl/'],pos:'still+be',meaning:'他还是（处于）'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ɪn/','/bed/'],pos:'介词短语',meaning:'在床上'}
    ],
    explanations: [
      "`in bed` 指「躺在床上（睡觉）」，不带冠词。常见错误：\n• \"**on** bed\" → 躺床上用 in bed\n• \"in **the** bed\" → 泛指睡觉状态时不加 the（加 the 指某张具体的床）",
      "`still` 放在 be 动词后，表示状态延续：He is still in bed = 他还没起来。"
    ],
    distractors: [["He still is","He is yet","He is till"],["on bed.","at bed.","into bed."]]
  },
  {
    sentence: "When did you go to bed last night?",
    cid: "2bb9dcf0",
    translation: "你昨晚几点睡的？",
    chunks: ["When did you go to bed","last night?"],
    hints: ["你几点上床睡觉","昨晚"],
    grammar: [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/wen/','/dɪd/','/juː/','/ɡoʊ/'],pos:'过去时疑问',meaning:'你什么时候上床'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/læst/','/naɪt/'],pos:'名词短语作状语',meaning:'昨晚'}
    ],
    explanations: [
      "`go to bed` 是「上床睡觉」，强调去睡这个动作。常见错误：\n• \"When **you did** go to bed\" → 疑问句助动词提前\n• \"go to bed **last night**\" 位置没问题，但注意 last night 前面不加介词",
      "对比 `go to sleep`（入睡）：go to bed 是上床，go to sleep 是睡着。"
    ],
    distractors: [["When you did go to bed","When did you went to bed","When did you go to the bed"],["in last night?","on last night?","at last night?"]]
  },
  {
    sentence: "When did you fall asleep?",
    cid: "5c36ca37",
    translation: "你几点睡着的？",
    chunks: ["When did you","fall asleep?"],
    hints: ["你什么时候","睡着"],
    grammar: [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/wen/','/dɪd/','/juː/'],pos:'过去时疑问',meaning:'你什么时候'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/fɔːl/','/əˈsliːp/'],pos:'短语动词',meaning:'睡着'}
    ],
    explanations: [
      "`fall asleep` 是「入睡」的固定搭配，fall 的过去式是 fell。常见错误：\n• \"**fell** asleep\" → 助动词 did 后面用原形 fall\n• \"fall **sleep**\" → sleep 是名词/动词，入睡是 fall asleep",
      "对比 `fall asleep`（睡着）/ `be asleep`（处于睡眠状态）。"
    ],
    distractors: [["When you did","When does you","When did your"],["fell asleep?","fall sleep?","fall a sleep?"]]
  },
  {
    sentence: "I never get up early.",
    cid: "fe96fbbe",
    translation: "我从来不起早。",
    chunks: ["I never get up","early."],
    hints: ["我从不","起早"],
    grammar: [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪ/','/ˈnevər/','/ɡet/','/ʌp/'],pos:'频度副词否定',meaning:'我从不起来'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/ˈɜːrli/'],pos:'副词',meaning:'早'}
    ],
    explanations: [
      "`never` 本身已表否定，不再加 don't。常见错误：\n• \"I **don't never** get up\" → 双重否定错误\n• \"I never **gets** up\" → 主语 I 用原形 get",
      "never 是频度副词，位置在实义动词之前、be 动词之后。"
    ],
    distractors: [["I never gets up","I don't never get up","I never getting up"],["earlier.","late.","soon."]]
  },
  {
    sentence: "I have trouble waking up in the morning.",
    cid: "9fa6d5b3",
    translation: "早起对我是件困难的事。",
    chunks: ["I have trouble","waking up","in the morning."],
    hints: ["我很难","醒来","在早上"],
    grammar: [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/hæv/','/ˈtrʌbl/'],pos:'have trouble 句型',meaning:'我有困难'},
      {role:'动名词宾语',color:'#3358e0',phonetic:['/ˈweɪkɪŋ/','/ʌp/'],pos:'动名词短语',meaning:'醒来'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɪn/','/ðə/','/ˈmɔːrnɪŋ/'],pos:'介词短语',meaning:'在早上'}
    ],
    explanations: [
      "`have trouble doing sth` 是「做某事有困难」的固定句型，trouble 后接动名词。常见错误：\n• \"have trouble **to wake** up\" → 一定用 -ing，不用不定式\n• \"have **a** trouble\" → 此处 trouble 不可数，不加 a",
      "对比 `have a hard time doing sth`（同义）。",
      "`in the morning` 是「在早上」的固定说法，泛指时段用 in the + 名词，不用 on/at。"
    ],
    distractors: [["I have troubles","I have a trouble","I am trouble"],["to wake up","wake up","woke up"],["on the morning.","in morning.","at the morning."]]
  },
  {
    sentence: "What should I wear?",
    cid: "7533e2a5",
    translation: "穿什么好呢？",
    chunks: ["What should","I wear?"],
    hints: ["我应该","穿什么"],
    grammar: [
      {role:'情态动词+主语',color:'#e74c7a',phonetic:['/wʌt/','/ʃʊd/'],pos:'特殊疑问句',meaning:'我应该（穿）什么'},
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/wer/'],pos:'主语+动词',meaning:'我穿'}
    ],
    explanations: [
      "`What should I do?` 是征询建议的常用句型。常见错误：\n• \"What should I **wearing**\" → should 后面用动词原形\n• \"What **do I should** wear\" → should 已是助动词，不再加 do",
      "`wear` 强调「穿着」的状态；`put on` 强调「穿上」的动作。"
    ],
    distractors: [["What should I wearing","What I should","What do I should"],["to wear?","wear on?","wear it?"]]
  },
  {
    sentence: "Fold up your bedding.",
    cid: "4af03e2d",
    translation: "把被子叠好。",
    chunks: ["Fold up","your bedding."],
    hints: ["叠好","你的被褥"],
    grammar: [
      {role:'祈使句',color:'#e74c7a',phonetic:['/foʊld/','/ʌp/'],pos:'短语动词祈使',meaning:'叠起来'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/ˈbedɪŋ/'],pos:'名词短语',meaning:'你的被褥'}
    ],
    explanations: [
      "`fold up` 意为「折叠起来、叠好」。常见错误：\n• \"Fold **on**\" → 折叠用 up\n• \"Folding up your bedding\" → 祈使句用动词原形",
      "`bedding` 是不可数名词，指「被褥床品」，不加 -s。"
    ],
    distractors: [["Fold on","Folding up","Folded up"],["you bedding.","your beddings.","your beding."]]
  },
  {
    sentence: "Who's that woman you were talking to?",
    cid: "46893aac",
    translation: "跟你说话的那个女人是谁？",
    chunks: ["Who's that woman","you were talking to?"],
    hints: ["那个女人是谁","你在跟她说话的"],
    grammar: [
      {role:'疑问词+系动词',color:'#c87033',phonetic:['/huːz/','/ðæt/','/ˈwʊmən/'],pos:'特殊疑问句',meaning:'那个女人是谁'},
      {role:'定语从句',color:'#3358e0',phonetic:['/juː/','/wɜːr/','/ˈtɔːkɪŋ/','/tuː/'],pos:'定语从句',meaning:'你刚才在跟她说话的'}
    ],
    explanations: [
      "`talk to sb` 是「跟某人说话」，用介词 to。常见错误：\n• \"Who **that** woman\" → 缺 be 动词，应为 Who's\n• \"Who's that **women**\" → 单数用 woman，复数才是 women",
      "定语从句里介词 to 留在句尾：the woman (that) you were talking to。"
    ],
    distractors: [["Who that woman","Who's that women","Whose that woman"],["you was talking to?","you were talked to?","you talking to?"]]
  },
  {
    sentence: "Why would I need that?",
    cid: "18e9ee1b",
    translation: "我要那个干嘛？",
    chunks: ["Why would","I need that?"],
    hints: ["为什么会","我需要那个"],
    grammar: [
      {role:'疑问词+情态',color:'#e74c7a',phonetic:['/waɪ/','/wʊd/'],pos:'情态疑问',meaning:'为什么会'},
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/niːd/','/ðæt/'],pos:'主语+动词+宾语',meaning:'我需要那个'}
    ],
    explanations: [
      "`Why would I ...?` 用虚拟语气反问，暗含「我没理由需要」。常见错误：\n• \"Why **will** I need\" → 反问用 would 更自然\n• \"Why would **me** need\" → 主语用主格 I",
      "这类 would 用于表达「假设/反问」，不是将来时。"
    ],
    distractors: [["Why will","Why are","Why would me"],["I needed that?","I need this?","me need that?"]]
  },
  {
    sentence: "I'm not gonna talk about Judy.",
    cid: "7bec57ab",
    translation: "我不想聊朱迪。",
    chunks: ["I'm not gonna","talk about Judy."],
    hints: ["我不会","谈朱迪"],
    grammar: [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪm/','/nɑːt/','/ˈɡənə/'],pos:'be going to 否定',meaning:'我不打算'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/tɔːk/','/əˈbaʊt/','/ˈdʒuːdi/'],pos:'短语动词',meaning:'谈（关于）'}
    ],
    explanations: [
      "`gonna` 是 going to 的口语缩略，用于非正式场合。常见错误：\n• \"I'm not **going talk**\" → 口语 gonna 对应 going to + 动词原形\n• \"talk **with** Judy\" → 谈及某事用 talk about",
      "`talk about sth` 谈某事；`talk to sb` 跟某人说话。"
    ],
    distractors: [["I not gonna","I'm not going talk","I'm no gonna"],["talking about Judy.","talk about Judys.","talked about Judy."]]
  },
  {
    sentence: "I think you do.",
    cid: "efcd6d0e",
    translation: "我觉着你有（你不承认而已）。",
    chunks: ["I think","you do."],
    hints: ["我觉得","你是的"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/θɪŋk/'],pos:'一般现在时',meaning:'我觉得'},
      {role:'宾语从句',color:'#7c5cbf',phonetic:['/juː/','/duː/'],pos:'宾语从句',meaning:'你确实（有/是）'}
    ],
    explanations: [
      "`you do` 是替代式肯定，用 do 代指上文动词，起强调作用。常见错误：\n• \"I **thinking**\" → 一般现在时用 think\n• \"you **does**\" → 主语 you 配 do",
      "这种 `do` 叫代动词（pro-verb），避免重复上文动词：I think you do = I think you do have it."
    ],
    distractors: [["I thinking","I thinks","I am think"],["you does.","you doing.","you will."]]
  },
  {
    sentence: "I don't give a shit.",
    cid: "96d9409c",
    translation: "我才不在乎（粗俗，比 I don't care 语气强烈得多）。",
    chunks: ["I don't","give a shit."],
    hints: ["我一点也不","在乎"],
    grammar: [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪ/','/doʊnt/'],pos:'一般现在时否定',meaning:'我不'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɡɪv/','/ə/','/ʃɪt/'],pos:'固定俚语',meaning:'（表示）毫不在乎'}
    ],
    explanations: [
      "`not give a shit` 是粗俗表达，意为「一点都不在乎」。常见错误：\n• \"give a **damn**\" 是同级替代说法，不是错误形式\n• \"I don't give a shit\" 中间不加 the",
      "语域警告：这是粗话，正式场合与陌生人勿用；礼貌说法是 I don't care. / It doesn't bother me."
    ],
    distractors: [["I doesn't","I not","I don't gives"],["care a shit.","give the shit.","giving a shit."]]
  },
  {
    sentence: "I was sitting next to her on the plane.",
    cid: "3aa31e0a",
    translation: "在飞机上我坐她旁边。",
    chunks: ["I was sitting next to her","on the plane."],
    hints: ["我当时坐在她旁边","在飞机上"],
    grammar: [
      {role:'过去进行时',color:'#e74c7a',phonetic:['/aɪ/','/wʌz/','/ˈsɪtɪŋ/','/nekst/'],pos:'过去进行时',meaning:'我当时坐在她旁边'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ɒn/','/ðə/','/pleɪn/'],pos:'介词短语',meaning:'在飞机上'}
    ],
    explanations: [
      "`next to` 是「在……旁边」的固定搭配。常见错误：\n• \"next **her**\" → 必须带 to：next to her\n• \"I **were** sitting\" → 主语 I 配 was",
      "`on the plane` 指在飞机上；注意 train/bus 也用 on。"
    ],
    distractors: [["I was sitting next her","I was sat next to her","I were sitting next to her"],["in the plane.","on plane.","at the plane."]]
  },
  {
    sentence: "I thought she said something to me.",
    cid: "307d29b1",
    translation: "我以为她在跟我搭话。",
    chunks: ["I thought","she said something","to me."],
    hints: ["我以为","她说了什么","对我"],
    grammar: [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/θɔːt/'],pos:'一般过去时',meaning:'我以为'},
      {role:'宾语从句',color:'#7c5cbf',phonetic:['/ʃiː/','/sed/','/ˈsʌmθɪŋ/'],pos:'宾语从句',meaning:'她说了些什么'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/tə/','/miː/'],pos:'介词短语',meaning:'对我'}
    ],
    explanations: [
      "`say sth to sb` 是「对某人说某事」的固定搭配。常见错误：\n• \"say something **for** me\" → 对某人说用 to\n• \"she **says** something\" → 与主句时态一致，用过去式 said",
      "注意 say 后面直接接内容，tell 需接人：say to me = tell me。",
      "`I thought ...` 用过去时表示「我（原）以为」，常暗含事实上并非如此。"
    ],
    distractors: [["I think","I was thought","I thought that"],["she says something","she say something","she said anything"],["for me.","on me.","in me."]]
  },
  {
    sentence: "You would be the last person I'd want to see.",
    cid: "de8bc536",
    translation: "我最不想见的人就是你了。",
    chunks: ["You would be the last person","I'd want to see."],
    hints: ["你会是最后一个人","我想见到的"],
    grammar: [
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/wʊd/','/biː/','/læst/'],pos:'虚拟语气',meaning:'你会是最后一个人'},
      {role:'定语从句',color:'#3358e0',phonetic:['/aɪd/','/wɑːnt/','/tə/','/siː/'],pos:'定语从句',meaning:'我想见的'}
    ],
    explanations: [
      "`the last person I'd want to ...` 是「我最不想……的人」的地道说法。常见错误：\n• \"the last person\" 后面定语从句省略了 that，不要加 what\n• \"I'd want to **saw**\" → 不定式用原形 see",
      "这种 last 表「最不可能的」，语气很强：you'd be the last person = 最不想见的就是你。"
    ],
    distractors: [["You will be the last person","You would be the last people","You would the last person"],["I want to see.","I'd want to saw.","I'd wanted to see."]]
  },
  {
    sentence: "Yeah, maybe run into her at the gym.",
    cid: "c1caeb1d",
    translation: "也许能在健身房和她偶遇。",
    chunks: ["Yeah, maybe run into her","at the gym."],
    hints: ["也许碰到她","在健身房"],
    grammar: [
      {role:'省略句',color:'#e74c7a',phonetic:['/jæ/','/ˈmeɪbi/','/rʌn/','/ˈɪntuː/'],pos:'省略主语的口语句',meaning:'嗯，也许（我）会遇到她'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/æt/','/ðə/','/dʒɪm/'],pos:'介词短语',meaning:'在健身房'}
    ],
    explanations: [
      "`run into sb` 是「偶然遇到某人」的固定搭配。常见错误：\n• \"run **to** her\" → 偶遇用 run into，不是 run to\n• \"maybe **running**\" → maybe 后面接动词原形（省略了 I might）",
      "对比 `run into`（偶遇）/ `bump into`（同义）/ `meet`（约见或相遇）。"
    ],
    distractors: [["Yeah, maybe run to her","Yeah, maybe running into her","Yeah, maybe ran into her"],["on the gym.","at gym.","to the gym."]]
  }
];

/* 与 DATA_ORAL8000 等长的场景归属（2026-09-15 拆分 deck 时生成）：
   h 居家生活 / s 外出社交 / c 日常闲聊 / b 口头禅万能 / e 情感表达 / w 职场商务 */
window.DATA_ORAL8000_SCENES = [
  'c', 'c', 'b', 'e', 's', 's', 's', 'c', 'b', 's', 'e', 'c', 'b', 's', 's', 'c', 's', 's', 's', 'c', 'w', 'c', 'c', 's', 'c', 's', 'c', 'c', 's', 'e', 'b', 'e', 's', 's', 'w', 's', 's', 'c', 'c', 'c',
  'h', 'e', 's', 's', 's', 's', 's', 's', 's', 's', 'w', 'w', 'w', 'w', 'c', 'c', 'c', 'c', 'c', 'c', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 'w', 'w', 'w', 'b', 'b', 'b', 'c', 'c', 'c', 'c',
  'b', 'c', 'b', 'e', 'c', 'c', 'c', 'e', 's', 'c', 'h', 'h', 'b', 'c', 'c', 's', 's', 's', 's', 'e', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'c', 'c', 'h', 'h', 'h', 'h', 'h', 'h',
  'h', 'c', 'c', 'c', 'h', 'h', 'e', 'e', 'w', 'e', 'e', 's', 'e', 'c', 'e', 'b', 'b', 's', 's', 's', 's', 'h', 'h', 'h', 's', 's', 's', 's', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h',
  'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'c', 's', 'h', 'h', 's', 's', 'c', 'h', 'h', 'h', 'h', 'h', 'c', 'h', 'c', 'c', 'c', 'c', 'h', 'h', 'e', 'h', 'h', 'h', 'h', 'e', 'h', 'h', 's', 's',
  's', 's', 'c', 'c', 'h', 'h', 'h', 'h', 'c', 'c', 'c', 'e', 'h', 'h', 'h', 'h', 'w', 'e', 'w', 'w', 'b', 'b', 'w', 'w', 'w', 'w', 'c', 'b', 'e', 'e', 'c', 'c', 'c', 'c', 'c', 'e', 'b', 'e', 'e', 'e',
  'e', 'e', 'e', 'e', 'e', 'b', 'e', 'e', 'c', 'w', 'c', 'e', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h',
  'c', 'c', 'c', 'c', 's', 'h', 'h', 'h', 's', 's', 's', 's', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'c', 'b', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'b', 'c', 'c', 's', 's', 'h', 'h', 's', 's', 'b',
  'b', 'b', 'b', 'c', 'h', 'w', 'w', 's', 's', 'b', 'b', 'e', 'b', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'h', 'h', 'h', 'h', 'c', 'h', 'h', 'h', 'h', 'h', 'h', 'e', 'e', 'h', 'h', 'h', 'h', 'h', 'h', 'h',
  'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'c', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'c',
  'c', 'c', 'c', 'c', 'c', 'c', 'e', 'c'
];
/* 数据并入 6 个场景 deck（2026-09-15 拆分；原为 concat 进单个 builtin-daily）
 * 按 DATA_ORAL8000_SCENES 把扩展句分发到 daily-home/social/chat/basic/emotion/work。
 * 引用页必须先加载 builtins.js 再加载本文件。 */
(function(){
  if(!window.BUILTIN){
    console.error('[oral8000.js] 未找到 window.BUILTIN：builtins.js 须在 oral8000.js 之前加载');
    return;
  }
  var items = window.DATA_ORAL8000 || [];
  var scenes = window.DATA_ORAL8000_SCENES || [];
  if(scenes.length !== items.length){
    console.error('[oral8000.js] DATA_ORAL8000_SCENES 与 DATA_ORAL8000 长度不一致');
    return;
  }
  var IDS = { h:'daily-home', s:'daily-social', c:'daily-chat', b:'daily-basic', e:'daily-emotion', w:'daily-work' };
  var buckets = {};
  for(var k in IDS) buckets[IDS[k]] = [];
  for(var i=0;i<items.length;i++){
    var id = IDS[scenes[i]];
    if(!id) continue;
    buckets[id].push(items[i]);
  }
  for(var d=0; d<window.BUILTIN.length; d++){
    var deck = window.BUILTIN[d];
    var extra = buckets[deck.id];
    if(extra && extra.length) deck.items = deck.items.concat(extra);
  }
})();
