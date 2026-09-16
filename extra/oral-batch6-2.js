/* 口语 8000 句 · 第六批数据源（批次 2/3：睡眠 / 身体 / 穿戴）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch6-2.js */
var ORAL_BATCH = [
  {
    "sentence": "Did you hear the alarm?",
    "translation": "你听到闹钟了吗？",
    "chunks": ["Did you hear", "the alarm?"],
    "hints": ["你听到", "闹钟了吗"],
    "grammar": [
      {role:'助动词+主语+谓语',color:'#e74c7a',phonetic:['/dɪd/','/juː/','/hɪr/'],pos:'一般过去时疑问',meaning:'你听到了'},
      {role:'宾语',color:'#3358e0',phonetic:['/ði/','/əˈlɑːrm/'],pos:'名词短语',meaning:'闹钟'}
    ],
    "explanations": [
      "`Did you + 动词原形`构成过去时一般疑问句。常见错误：\n• \"Did you **heard**\" → 助动词 did 后面动词要用原形\n• \"**Do** you hear\" → 问已经发生的事要用 did",
      "`hear` 强调「听见」（结果），`listen to` 强调「听」（动作）。"
    ],
    "distractors": [["Did you heard","Did you hearing","Does you hear"],["the alarms?","the alarming?","a alarming?"]]
  },
  {
    "sentence": "I've been dreaming all night.",
    "translation": "我一直在做梦。",
    "chunks": ["I've been dreaming", "all night."],
    "hints": ["我一直在做梦", "一整晚"],
    "grammar": [
      {role:'现在完成进行',color:'#e74c7a',phonetic:['/aɪv/','/bɪn/','/ˈdriːmɪŋ/'],pos:'现在完成进行时',meaning:'我一直在做梦'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɔːl/','/naɪt/'],pos:'名词短语作状语',meaning:'整晚'}
    ],
    "explanations": [
      "`have been doing` 表示从过去持续到现在的动作。常见错误：\n• \"I've been **dreamed**\" → 进行时用 dreaming\n• \"all **the** night\" → 地道说法是 all night（不加 the）",
      "`all night` 指整晚；想说「熬夜」是 stay up all night。"
    ],
    "distractors": [["I've been dreamed","I've dreaming","I was been dreaming"],["all the night.","all nights.","whole night."]]
  },
  {
    "sentence": "I feel dizzy.",
    "translation": "我觉得头昏脑涨的。",
    "chunks": ["I feel", "dizzy."],
    "hints": ["我觉得", "晕"],
    "grammar": [
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/fiːl/'],pos:'一般现在时',meaning:'我觉得'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈdɪzi/'],pos:'形容词',meaning:'头晕的'}
    ],
    "explanations": [
      "`feel` 是系动词，后面接形容词。常见错误：\n• \"I **feeling** dizzy\" → 一般现在时用 feel\n• \"I feel **dizziness**\" → 要说感觉晕用形容词 dizzy，名词 dizziness 是「眩晕症」",
      "同类表达：I feel light-headed.（我觉得头晕）"
    ],
    "distractors": [["I feeling","I'm feel","I feels"],["dizzily.","dizziness.","dizzying."]]
  },
  {
    "sentence": "Is David up yet?",
    "translation": "大卫起床了吗？",
    "chunks": ["Is David up", "yet?"],
    "hints": ["大卫起来了吗", "还没"],
    "grammar": [
      {role:'主语+系动词',color:'#c87033',phonetic:['/ɪz/','/ˈdeɪvɪd/','/ʌp/'],pos:'be+up 疑问',meaning:'大卫起来了吗'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/jet/'],pos:'副词',meaning:'（用于疑问）已经'}
    ],
    "explanations": [
      "`be up` 表示「已起床」。常见错误：\n• \"**Does** David up\" → up 是副词，与 be 连用，不用 do\n• \"Is David up **already**\" → 疑问句问「是否已经」用 yet",
      "`yet` 在疑问句里表示「（到目前）已经」，回答用 Not yet.（还没）。"
    ],
    "distractors": [["Does David up","Has David up","Is David up to"],["already?","even?","soon?"]]
  },
  {
    "sentence": "He is still in bed.",
    "translation": "他还没起。",
    "chunks": ["He is still", "in bed."],
    "hints": ["他还是", "在床上"],
    "grammar": [
      {role:'主系表',color:'#c87033',phonetic:['/hiː/','/ɪz/','/stɪl/'],pos:'still+be',meaning:'他还是（处于）'},
      {role:'地点状语',color:'#7c5cbf',phonetic:['/ɪn/','/bed/'],pos:'介词短语',meaning:'在床上'}
    ],
    "explanations": [
      "`in bed` 指「躺在床上（睡觉）」，不带冠词。常见错误：\n• \"**on** bed\" → 躺床上用 in bed\n• \"in **the** bed\" → 泛指睡觉状态时不加 the（加 the 指某张具体的床）",
      "`still` 放在 be 动词后，表示状态延续：He is still in bed = 他还没起来。"
    ],
    "distractors": [["He still is","He is yet","He is till"],["on bed.","at bed.","into bed."]]
  },
  {
    "sentence": "When did you go to bed last night?",
    "translation": "你昨晚几点睡的？",
    "chunks": ["When did you go to bed", "last night?"],
    "hints": ["你几点上床睡觉", "昨晚"],
    "grammar": [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/wen/','/dɪd/','/juː/','/ɡoʊ/'],pos:'过去时疑问',meaning:'你什么时候上床'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/læst/','/naɪt/'],pos:'名词短语作状语',meaning:'昨晚'}
    ],
    "explanations": [
      "`go to bed` 是「上床睡觉」，强调去睡这个动作。常见错误：\n• \"When **you did** go to bed\" → 疑问句助动词提前\n• \"go to bed **last night**\" 位置没问题，但注意 last night 前面不加介词",
      "对比 `go to sleep`（入睡）：go to bed 是上床，go to sleep 是睡着。"
    ],
    "distractors": [["When you did go to bed","When did you went to bed","When did you go to the bed"],["in last night?","on last night?","at last night?"]]
  },
  {
    "sentence": "When did you fall asleep?",
    "translation": "你几点睡着的？",
    "chunks": ["When did you", "fall asleep?"],
    "hints": ["你什么时候", "睡着"],
    "grammar": [
      {role:'疑问词+助动词',color:'#c87033',phonetic:['/wen/','/dɪd/','/juː/'],pos:'过去时疑问',meaning:'你什么时候'},
      {role:'动词短语',color:'#7c5cbf',phonetic:['/fɔːl/','/əˈsliːp/'],pos:'短语动词',meaning:'睡着'}
    ],
    "explanations": [
      "`fall asleep` 是「入睡」的固定搭配，fall 的过去式是 fell。常见错误：\n• \"**fell** asleep\" → 助动词 did 后面用原形 fall\n• \"fall **sleep**\" → sleep 是名词/动词，入睡是 fall asleep",
      "对比 `fall asleep`（睡着）/ `be asleep`（处于睡眠状态）。"
    ],
    "distractors": [["When you did","When does you","When did your"],["fell asleep?","fall sleep?","fall a sleep?"]]
  },
  {
    "sentence": "I never get up early.",
    "translation": "我从来不起早。",
    "chunks": ["I never get up", "early."],
    "hints": ["我从不", "起早"],
    "grammar": [
      {role:'主谓否定',color:'#e74c7a',phonetic:['/aɪ/','/ˈnevər/','/ɡet/','/ʌp/'],pos:'频度副词否定',meaning:'我从不起来'},
      {role:'时间副词',color:'#7c5cbf',phonetic:['/ˈɜːrli/'],pos:'副词',meaning:'早'}
    ],
    "explanations": [
      "`never` 本身已表否定，不再加 don't。常见错误：\n• \"I **don't never** get up\" → 双重否定错误\n• \"I never **gets** up\" → 主语 I 用原形 get",
      "never 是频度副词，位置在实义动词之前、be 动词之后。"
    ],
    "distractors": [["I never gets up","I don't never get up","I never getting up"],["earlier.","late.","soon."]]
  },
  {
    "sentence": "I have trouble waking up in the morning.",
    "translation": "早起对我是件困难的事。",
    "chunks": ["I have trouble", "waking up", "in the morning."],
    "hints": ["我很难", "醒来", "在早上"],
    "grammar": [
      {role:'主谓宾',color:'#e74c7a',phonetic:['/aɪ/','/hæv/','/ˈtrʌbl/'],pos:'have trouble 句型',meaning:'我有困难'},
      {role:'动名词宾语',color:'#3358e0',phonetic:['/ˈweɪkɪŋ/','/ʌp/'],pos:'动名词短语',meaning:'醒来'},
      {role:'时间状语',color:'#7c5cbf',phonetic:['/ɪn/','/ðə/','/ˈmɔːrnɪŋ/'],pos:'介词短语',meaning:'在早上'}
    ],
    "explanations": [
      "`have trouble doing sth` 是「做某事有困难」的固定句型，trouble 后接动名词。常见错误：\n• \"have trouble **to wake** up\" → 一定用 -ing，不用不定式\n• \"have **a** trouble\" → 此处 trouble 不可数，不加 a",
      "对比 `have a hard time doing sth`（同义）。",
      "`in the morning` 是「在早上」的固定说法，泛指时段用 in the + 名词，不用 on/at。"
    ],
    "distractors": [["I have troubles","I have a trouble","I am trouble"],["to wake up","wake up","woke up"],["on the morning.","in morning.","at the morning."]]
  },
  {
    "sentence": "What should I wear?",
    "translation": "穿什么好呢？",
    "chunks": ["What should", "I wear?"],
    "hints": ["我应该", "穿什么"],
    "grammar": [
      {role:'情态动词+主语',color:'#e74c7a',phonetic:['/wʌt/','/ʃʊd/'],pos:'特殊疑问句',meaning:'我应该（穿）什么'},
      {role:'主谓',color:'#e74c7a',phonetic:['/aɪ/','/wer/'],pos:'主语+动词',meaning:'我穿'}
    ],
    "explanations": [
      "`What should I do?` 是征询建议的常用句型。常见错误：\n• \"What should I **wearing**\" → should 后面用动词原形\n• \"What **do I should** wear\" → should 已是助动词，不再加 do",
      "`wear` 强调「穿着」的状态；`put on` 强调「穿上」的动作。"
    ],
    "distractors": [["What should I wearing","What I should","What do I should"],["to wear?","wear on?","wear it?"]]
  },
  {
    "sentence": "Fold up your bedding.",
    "translation": "把被子叠好。",
    "chunks": ["Fold up", "your bedding."],
    "hints": ["叠好", "你的被褥"],
    "grammar": [
      {role:'祈使句',color:'#e74c7a',phonetic:['/foʊld/','/ʌp/'],pos:'短语动词祈使',meaning:'叠起来'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/ˈbedɪŋ/'],pos:'名词短语',meaning:'你的被褥'}
    ],
    "explanations": [
      "`fold up` 意为「折叠起来、叠好」。常见错误：\n• \"Fold **on**\" → 折叠用 up\n• \"Folding up your bedding\" → 祈使句用动词原形",
      "`bedding` 是不可数名词，指「被褥床品」，不加 -s。"
    ],
    "distractors": [["Fold on","Folding up","Folded up"],["you bedding.","your beddings.","your beding."]]
  },
];
