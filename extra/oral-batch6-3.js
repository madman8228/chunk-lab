/* 口语 8000 句 · 第六批数据源（批次 3/3：对话与口语台词）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch6-3.js */
var ORAL_BATCH = [
  {
    "sentence": "Who's that woman you were talking to?",
    "translation": "跟你说话的那个女人是谁？",
    "chunks": ["Who's that woman", "you were talking to?"],
    "hints": ["那个女人是谁", "你在跟她说话的"],
    "grammar": [
      {role:'疑问词+系动词',color:'#c87033',phonetic:['/huːz/','/ðæt/','/ˈwʊmən/'],pos:'特殊疑问句',meaning:'那个女人是谁'},
      {role:'定语从句',color:'#3358e0',phonetic:['/juː/','/wɜːr/','/ˈtɔːkɪŋ/','/tuː/'],pos:'定语从句',meaning:'你刚才在跟她说话的'}
    ],
    "explanations": [
      "`talk to sb` 是「跟某人说话」，用介词 to。常见错误：\n• \"Who **that** woman\" → 缺 be 动词，应为 Who's\n• \"Who's that **women**\" → 单数用 woman，复数才是 women",
      "定语从句里介词 to 留在句尾：the woman (that) you were talking to。"
    ],
    "distractors": [["Who that woman","Who's that women","Whose that woman"],["you was talking to?","you were talked to?","you talking to?"]]
  },
  {
    "sentence": "Why would I need that?",
    "translation": "我要那个干嘛？",
    "chunks": ["Why would", "I need that?"],
    "hints": ["为什么会", "我需要那个"],
    "grammar": [
      {role:'疑问词+情态',color:'#e74c7a',phonetic:['/waɪ/','/wʊd/'],pos:'情态疑问',meaning:'为什么会'},
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/niːd/','/ðæt/'],pos:'主语+动词+宾语',meaning:'我需要那个'}
    ],
    "explanations": [
      "`Why would I ...?` 用虚拟语气反问，暗含「我没理由需要」。常见错误：\n• \"Why **will** I need\" → 反问用 would 更自然\n• \"Why would **me** need\" → 主语用主格 I",
      "这类 would 用于表达「假设/反问」，不是将来时。"
    ],
    "distractors": [["Why will","Why are","Why would me"],["I needed that?","I need this?","me need that?"]]
  },
  {
    "sentence": "I'm not gonna talk about Judy.",
    "translation": "我不想聊朱迪。",
    "chunks": ["I'm not gonna", "talk about Judy."],
    "hints": ["我不会", "谈朱迪"],
    "grammar": [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪm/','/nɑːt/','/ˈɡənə/'],pos:'be going to 否定',meaning:'我不打算'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/tɔːk/','/əˈbaʊt/','/ˈdʒuːdi/'],pos:'短语动词',meaning:'谈（关于）'}
    ],
    "explanations": [
      "`gonna` 是 going to 的口语缩略，用于非正式场合。常见错误：\n• \"I'm not **going talk**\" → 口语 gonna 对应 going to + 动词原形\n• \"talk **with** Judy\" → 谈及某事用 talk about",
      "`talk about sth` 谈某事；`talk to sb` 跟某人说话。"
    ],
    "distractors": [["I not gonna","I'm not going talk","I'm no gonna"],["talking about Judy.","talk about Judys.","talked about Judy."]]
  },
  {
    "sentence": "I think you do.",
    "translation": "我觉着你有（你不承认而已）。",
    "chunks": ["I think", "you do."],
    "hints": ["我觉得", "你是的"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/θɪŋk/'],pos:'一般现在时',meaning:'我觉得'},
      {role:'宾语从句',color:'#7c5cbf',phonetic:['/juː/','/duː/'],pos:'宾语从句',meaning:'你确实（有/是）'}
    ],
    "explanations": [
      "`you do` 是替代式肯定，用 do 代指上文动词，起强调作用。常见错误：\n• \"I **thinking**\" → 一般现在时用 think\n• \"you **does**\" → 主语 you 配 do",
      "这种 `do` 叫代动词（pro-verb），避免重复上文动词：I think you do = I think you do have it."
    ],
    "distractors": [["I thinking","I thinks","I am think"],["you does.","you doing.","you will."]]
  },
  {
    "sentence": "I don't give a shit.",
    "translation": "我才不在乎（粗俗，比 I don't care 语气强烈得多）。",
    "chunks": ["I don't", "give a shit."],
    "hints": ["我一点也不", "在乎"],
    "grammar": [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪ/','/doʊnt/'],pos:'一般现在时否定',meaning:'我不'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɡɪv/','/ə/','/ʃɪt/'],pos:'固定俚语',meaning:'（表示）毫不在乎'}
    ],
    "explanations": [
      "`not give a shit` 是粗俗表达，意为「一点都不在乎」。常见错误：\n• \"give a **damn**\" 是同级替代说法，不是错误形式\n• \"I don't give a shit\" 中间不加 the",
      "语域警告：这是粗话，正式场合与陌生人勿用；礼貌说法是 I don't care. / It doesn't bother me."
    ],
    "distractors": [["I doesn't","I not","I don't gives"],["care a shit.","give the shit.","giving a shit."]]
  },
  {
    "sentence": "I was sitting next to her on the plane.",
    "translation": "在飞机上我坐她旁边。",
    "chunks": ["I was sitting next to her", "on the plane."],
    "hints": ["我当时坐在她旁边", "在飞机上"],
    "grammar": [
      {role:'过去进行时',color:'#e74c7a',phonetic:['/aɪ/','/wʌz/','/ˈsɪtɪŋ/','/nekst/'],pos:'过去进行时',meaning:'我当时坐在她旁边'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ɒn/','/ðə/','/pleɪn/'],pos:'介词短语',meaning:'在飞机上'}
    ],
    "explanations": [
      "`next to` 是「在……旁边」的固定搭配。常见错误：\n• \"next **her**\" → 必须带 to：next to her\n• \"I **were** sitting\" → 主语 I 配 was",
      "`on the plane` 指在飞机上；注意 train/bus 也用 on。"
    ],
    "distractors": [["I was sitting next her","I was sat next to her","I were sitting next to her"],["in the plane.","on plane.","at the plane."]]
  },
  {
    "sentence": "I thought she said something to me.",
    "translation": "我以为她在跟我搭话。",
    "chunks": ["I thought", "she said something", "to me."],
    "hints": ["我以为", "她说了什么", "对我"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/θɔːt/'],pos:'一般过去时',meaning:'我以为'},
      {role:'宾语从句',color:'#7c5cbf',phonetic:['/ʃiː/','/sed/','/ˈsʌmθɪŋ/'],pos:'宾语从句',meaning:'她说了些什么'},
      {role:'对象状语',color:'#7c5cbf',phonetic:['/tə/','/miː/'],pos:'介词短语',meaning:'对我'}
    ],
    "explanations": [
      "`say sth to sb` 是「对某人说某事」的固定搭配。常见错误：\n• \"say something **for** me\" → 对某人说用 to\n• \"she **says** something\" → 与主句时态一致，用过去式 said",
      "注意 say 后面直接接内容，tell 需接人：say to me = tell me。",
      "`I thought ...` 用过去时表示「我（原）以为」，常暗含事实上并非如此。"
    ],
    "distractors": [["I think","I was thought","I thought that"],["she says something","she say something","she said anything"],["for me.","on me.","in me."]]
  },
  {
    "sentence": "You would be the last person I'd want to see.",
    "translation": "我最不想见的人就是你了。",
    "chunks": ["You would be the last person", "I'd want to see."],
    "hints": ["你会是最后一个人", "我想见到的"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/juː/','/wʊd/','/biː/','/læst/'],pos:'虚拟语气',meaning:'你会是最后一个人'},
      {role:'定语从句',color:'#3358e0',phonetic:['/aɪd/','/wɑːnt/','/tə/','/siː/'],pos:'定语从句',meaning:'我想见的'}
    ],
    "explanations": [
      "`the last person I'd want to ...` 是「我最不想……的人」的地道说法。常见错误：\n• \"the last person\" 后面定语从句省略了 that，不要加 what\n• \"I'd want to **saw**\" → 不定式用原形 see",
      "这种 last 表「最不可能的」，语气很强：you'd be the last person = 最不想见的就是你。"
    ],
    "distractors": [["You will be the last person","You would be the last people","You would the last person"],["I want to see.","I'd want to saw.","I'd wanted to see."]]
  },
  {
    "sentence": "Yeah, maybe run into her at the gym.",
    "translation": "也许能在健身房和她偶遇。",
    "chunks": ["Yeah, maybe run into her", "at the gym."],
    "hints": ["也许碰到她", "在健身房"],
    "grammar": [
      {role:'省略句',color:'#e74c7a',phonetic:['/jæ/','/ˈmeɪbi/','/rʌn/','/ˈɪntuː/'],pos:'省略主语的口语句',meaning:'嗯，也许（我）会遇到她'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/æt/','/ðə/','/dʒɪm/'],pos:'介词短语',meaning:'在健身房'}
    ],
    "explanations": [
      "`run into sb` 是「偶然遇到某人」的固定搭配。常见错误：\n• \"run **to** her\" → 偶遇用 run into，不是 run to\n• \"maybe **running**\" → maybe 后面接动词原形（省略了 I might）",
      "对比 `run into`（偶遇）/ `bump into`（同义）/ `meet`（约见或相遇）。"
    ],
    "distractors": [["Yeah, maybe run to her","Yeah, maybe running into her","Yeah, maybe ran into her"],["on the gym.","at gym.","to the gym."]]
  },
];
