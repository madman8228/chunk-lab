/* 口语 8000 句 · 第六批数据源（批次 1/3：起床与睡眠）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch6-1.js */
var ORAL_BATCH = [
  {
    "sentence": "I want to stay in bed for another half an hour.",
    "translation": "我真想在床上多睡半个小时。",
    "chunks": ["I want to stay in bed", "for another half an hour."],
    "hints": ["我想赖在床上", "再多半个小时"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/wɑːnt/','/tə/','/steɪ/'],pos:'一般现在时',meaning:'我想待'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/fər/','/əˈnʌðər/','/hæf/','/ən/','/ˈaʊər/'],pos:'介词短语',meaning:'再多半个小时'}
    ],
    "explanations": [
      "`stay in bed` 指「赖在床上不起」，注意介词是 `in` 不是 `on`。常见错误：\n• \"stay **on** bed\" → 人躺在床上用 in bed\n• \"another half an hour\" 里 half an hour 本身带 an，前面再加 another 即可",
      "`another half an hour` = 再半个小时，口语常缩成 another half hour（美式）。"
    ],
    "distractors": [["I want stay in bed","I want to staying in bed","I want to stay on bed"],["for other half an hour.","for another half a hour.","of another half an hour."]]
  },
  {
    "sentence": "It's time to get up.",
    "translation": "该起床了。",
    "chunks": ["It's time", "to get up."],
    "hints": ["是时候", "起来了"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/taɪm/'],pos:'固定句型',meaning:'是时候了'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/ɡet/','/ʌp/'],pos:'不定式短语',meaning:'起床'}
    ],
    "explanations": [
      "`It's time to do sth` 是「该做某事了」的固定句型。常见错误：\n• \"It's time **for** get up\" → for 后面只能接名词，接动词要用 to\n• \"It time to get up\" → 不能丢 be 动词",
      "对比 `It's time for bed.`（该睡了）：for + 名词 / to + 动词原形。"
    ],
    "distractors": [["It's time for","It time","It's the time"],["to got up.","to get on.","to getting up."]]
  },
  {
    "sentence": "Let me sleep for ten minutes.",
    "translation": "让我再睡十分钟。",
    "chunks": ["Let me sleep", "for ten minutes."],
    "hints": ["让我睡", "十分钟"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/let/','/miː/','/sliːp/'],pos:'使役动词祈使',meaning:'让我睡'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/fər/','/ten/','/ˈmɪnɪts/'],pos:'介词短语',meaning:'十分钟'}
    ],
    "explanations": [
      "`Let me do sth` 表示请求允许自己做某事。常见错误：\n• \"Let me **to** sleep\" → let 后接动词原形，不加 to\n• \"Let **I** sleep\" → let 后面用宾格 me",
      "`for ten minutes` 用 for 表示持续时长，ten 后面 minutes 要用复数。"
    ],
    "distractors": [["Let me sleeping","Let me to sleep","Let I sleep"],["for ten minute.","in ten minutes.","for ten minites."]]
  },
  {
    "sentence": "When do you get up on Saturday?",
    "translation": "星期六你几点起床？",
    "chunks": ["When do you", "get up", "on Saturday?"],
    "hints": ["你什么时候", "起床", "在星期六"],
    "grammar": [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/wen/','/duː/','/juː/'],pos:'一般现在时疑问',meaning:'你什么时候'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/ɡet/','/ʌp/'],pos:'短语动词',meaning:'起床'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɒn/','/ˈsætərdeɪ/'],pos:'介词短语',meaning:'在星期六'}
    ],
    "explanations": [
      "问固定作息常用 `When do you ...?`，问某一次用 `When did you ...?`。常见错误：\n• \"When **does** you get up\" → 主语 you 用 do\n• \"**in** Saturday\" → 具体某天用 on",
      "`get up` 是「起床」，`wake up` 是「醒来」，两者不同。",
      "`on Saturday` 指（这个）星期六；泛指每个周六用 on Saturdays，星期前一律用 on，不用 in/at。"
    ],
    "distractors": [["When does you","When are you","When you"],["gets up","getting up","get on"],["in Saturday?","at Saturday?","on the Saturday?"]]
  },
  {
    "sentence": "Get up soon.",
    "translation": "快起床。",
    "chunks": ["Get up", "soon."],
    "hints": ["起来", "快点"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/ɡet/','/ʌp/'],pos:'短语动词祈使',meaning:'起来'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/suːn/'],pos:'副词',meaning:'很快、尽早'}
    ],
    "explanations": [
      "`Get up.` 是祈使句，主语 you 不出现。常见错误：\n• \"Get **on**\" → get on 是上车/进展，起床是 get up\n• \"Getting up soon\" → 祈使句要用动词原形",
      "`soon` 表「尽早、快点」，语气比 immediately 缓和，妈妈叫孩子起床常用。"
    ],
    "distractors": [["Get on","Got up","Get up to"],["later.","soonest.","more soon."]]
  },
  {
    "sentence": "I usually sleep late on Saturday.",
    "translation": "我星期六通常晚起。",
    "chunks": ["I usually sleep late", "on Saturday."],
    "hints": ["我通常睡到很晚", "在星期六"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/ˈjuːʒuəli/','/sliːp/','/leɪt/'],pos:'一般现在时+频度副词',meaning:'我通常睡到很晚'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɒn/','/ˈsætərdeɪ/'],pos:'介词短语',meaning:'在星期六'}
    ],
    "explanations": [
      "`sleep late` 是「睡懒觉、起得晚」，不是「睡得晚」（睡得晚是 go to bed late）。常见错误：\n• \"I usual sleep late\" → 修饰动词要用副词 usually\n• \"sleep **lately**\" → lately 是「最近」，性质完全不同",
      "频度副词 usually 放在实义动词 sleep 之前。"
    ],
    "distractors": [["I usual sleep late","I usually sleeps late","I usually sleep lately"],["in Saturday.","at Saturday.","on the Saturday."]]
  },
  {
    "sentence": "I don't want to get up.",
    "translation": "我真不想起床。",
    "chunks": ["I don't want", "to get up."],
    "hints": ["我不想", "起床"],
    "grammar": [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪ/','/doʊnt/','/wɑːnt/'],pos:'一般现在时否定',meaning:'我不想'},
      {role:'不定式',color:'#7c5cbf',phonetic:['/tə/','/ɡet/','/ʌp/'],pos:'不定式短语',meaning:'起床'}
    ],
    "explanations": [
      "`want to do` 表示「想做」，否定用 don't want。常见错误：\n• \"I **doesn't** want\" → 主语 I 用 don't\n• \"I don't want **get up**\" → want 后接不定式要带 to",
      "口语里常弱读成 I don' wanna get up。"
    ],
    "distractors": [["I doesn't want","I don't wants","I not want"],["to get on.","to got up.","for get up."]]
  },
  {
    "sentence": "Are you awake?",
    "translation": "你醒了吗？",
    "chunks": ["Are you", "awake?"],
    "hints": ["你", "醒着吗"],
    "grammar": [
      {role:'一般疑问句',color:'#e74c7a',phonetic:['/ɑːr/','/juː/'],pos:'be 动词疑问',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/əˈweɪk/'],pos:'形容词',meaning:'醒着的'}
    ],
    "explanations": [
      "`awake` 是形容词，前面用 be 动词。常见错误：\n• \"**Do** you awake?\" → awake 是形容词，问「醒着吗」用 be 动词\n• \"Are you **wake**?\" → wake 是动词，形容词形式是 awake",
      "对比 `Are you up?`（你起来了吗）：awake 指醒着，up 指已下床。"
    ],
    "distractors": [["Do you","Is you","Are your"],["wake?","awaked?","waking?"]]
  },
  {
    "sentence": "It's too early for getting up.",
    "translation": "现在起床还太早。",
    "chunks": ["It's too early", "for getting up."],
    "hints": ["太早了", "为起床"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/tuː/','/ˈɜːrli/'],pos:'程度副词+形容词',meaning:'太早了'},
      {role:'介词短语',color:'#7c5cbf',phonetic:['/fər/','/ˈɡetɪŋ/','/ʌp/'],pos:'for+动名词',meaning:'为起床'}
    ],
    "explanations": [
      "`too early` 意为「太早」，too 修饰形容词表程度过分。常见错误：\n• \"too **earlier**\" → too 后面用原级，不叠加比较级\n• \"for **get** up\" → for 后接动名词 getting",
      "口语里更常说 It's too early to get up，用不定式更简练。"
    ],
    "distractors": [["It's too earlier","It's so much early","It's very too early"],["to getting up.","for get up.","for getting on."]]
  },
  {
    "sentence": "It's still early.",
    "translation": "时间还早。",
    "chunks": ["It's still", "early."],
    "hints": ["还是", "早"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/ɪts/','/stɪl/'],pos:'still+be',meaning:'还是（处于）'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈɜːrli/'],pos:'形容词',meaning:'早的'}
    ],
    "explanations": [
      "`still` 表示「仍然、还」，放在 be 动词之后。常见错误：\n• \"It's **yet** early\" → yet 多用于否定句和疑问句\n• \"It's already early\" → already 表「已经」，语义相反",
      "对比 `It's already late.`（已经很晚了）：still 强调延续，already 强调完成。"
    ],
    "distractors": [["It's still yet","It's yet","It's ever"],["earlier.","late.","so early."]]
  },
  {
    "sentence": "Why didn't the alarm go off?",
    "translation": "闹钟为什么没响呢？",
    "chunks": ["Why didn't the alarm", "go off?"],
    "hints": ["为什么闹钟", "没响"],
    "grammar": [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/waɪ/','/ˈdɪdnt/','/ði/','/əˈlɑːrm/'],pos:'过去时否定疑问',meaning:'为什么闹钟没有'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/ɡoʊ/','/ɔːf/'],pos:'短语动词',meaning:'（闹钟）响起来'}
    ],
    "explanations": [
      "`go off` 指闹钟「响起来」，是固定短语动词。常见错误：\n• \"Why the alarm didn't go off\" → 疑问句助动词 didn't 要提到主语前\n• \"go **on**\" → go on 是「继续」，闹钟响是 go off",
      "对比 `set the alarm`（设闹钟）/ `the alarm went off`（闹钟响了）。"
    ],
    "distractors": [["Why the alarm didn't","Why didn't the alarms","Why does the alarm didn't"],["go on?","go out?","went off?"]]
  },
];
