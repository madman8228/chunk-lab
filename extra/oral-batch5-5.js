/* 口语 8000 句 · 第五批数据源（批次 5/6）
 * 由 scripts/merge-oral-batch.mjs 合并进 oral8000.js，本文件仅作数据资产保留。
 * 自检：node scripts/check-oral-batch.mjs extra/oral-batch5-5.js */
var ORAL_BATCH = [
  {
    "sentence": "You're right.",
    "translation": "你说的对。",
    "chunks": ["You're", "right."],
    "hints": ["你是", "对的"],
    "grammar": [
      {role:'主语 + be',color:'#c87033',phonetic:['/jʊr/'],pos:'you are 缩写',meaning:'你是'},
      {role:'表语',color:'#3358e0',phonetic:['/raɪt/'],pos:'形容词',meaning:'对的'}
    ],
    "explanations": [
      "`You're right.` = 你说得对。常见错误：\n• \"Your right\" → your 是「你的」，要说 You're\n• 说成 \"You are right\" 也没错，只是口语更常缩写",
      "相关：That's right.（没错）/ You've got a point."
    ],
    "distractors": [["Your","You","Yours"],["wright.","rite.","rights."]]
  },
  {
    "sentence": "You look great today.",
    "translation": "你今天精神很好。",
    "chunks": ["You look", "great today."],
    "hints": ["你看起来", "今天很棒"],
    "grammar": [
      {role:'主系动词',color:'#c87033',phonetic:['/juː/','/lʊk/'],pos:'look + 形容词',meaning:'你看起来'},
      {role:'表语 + 时间状语',color:'#3358e0',phonetic:['/ɡreɪt/','/təˈdeɪ/'],pos:'形容词 + 副词',meaning:'今天很棒'}
    ],
    "explanations": [
      "`look` 作系动词后接形容词，不接副词。常见错误：\n• \"You look greatly\" → 要用形容词 great\n• \"You look like great\" → like 后面必须接名词",
      "相关：You look tired.（你看起来很累）/ You look nice today."
    ],
    "distractors": [["You looks","You looking","You are look"],["greatly today.","great to day.","great todays."]]
  },
  {
    "sentence": "I got enough sleep.",
    "translation": "我睡够了。",
    "chunks": ["I got", "enough sleep."],
    "hints": ["我得到", "足够的睡眠"],
    "grammar": [
      {role:'主谓',color:'#c87033',phonetic:['/aɪ/','/ɡɑːt/'],pos:'一般过去时',meaning:'我得到'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɪˈnʌf/','/sliːp/'],pos:'名词短语（不可数）',meaning:'足够的睡眠'}
    ],
    "explanations": [
      "`get enough sleep` 是「睡够了」的固定说法。常见错误：\n• \"I got enough sleeps\" → sleep 作名词不可数\n• \"I got sleep enough\" → enough 要放在名词前面",
      "相关：I didn't get much sleep.（我没睡够）/ I'm well rested."
    ],
    "distractors": [["I get","I'm got","I gotten"],["enough sleeps.","enough sleeping.","sleep enough."]]
  },
  {
    "sentence": "Make your bed.",
    "translation": "整理你的床。",
    "chunks": ["Make", "your bed."],
    "hints": ["整理", "你的床"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/meɪk/'],pos:'祈使句动词',meaning:'整理'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/bed/'],pos:'名词短语',meaning:'你的床'}
    ],
    "explanations": [
      "「铺床、整理被褥」用 `make your bed`，不用 clean。常见错误：\n• \"Clean your bed\" → 床铺用 make the bed\n• \"Make your beds\" → 一人一张床，用单数",
      "相关：make the bed（铺床）/ change the sheets（换床单）"
    ],
    "distractors": [["Makes","Making","Make of"],["your beds.","you bed.","your bed is."]]
  },
  {
    "sentence": "My alarm's set.",
    "translation": "我闹钟定好了。",
    "chunks": ["My alarm's", "set."],
    "hints": ["我的闹钟", "定好了"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/maɪ/','/əˈlɑːrmz/'],pos:'名词 + is 缩写',meaning:'我的闹钟（是）'},
      {role:'表语',color:'#e74c7a',phonetic:['/set/'],pos:'过去分词作形容词',meaning:'设定好的'}
    ],
    "explanations": [
      "`set` 在此是过去分词，表「已设定好」。常见错误：\n• \"My alarm set\" → 少了 's，句子不完整\n• 想说几点响要加 for：My alarm's set for six.",
      "相关：set an alarm（定个闹钟）/ My alarm went off.（闹钟响了）"
    ],
    "distractors": [["My alarm","My alarms is","My alarm is of"],["sets.","setting.","sit."]]
  },
  {
    "sentence": "Sleep in.",
    "translation": "多睡会儿。",
    "chunks": ["Sleep", "in."],
    "hints": ["睡", "（起得更晚）"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/sliːp/'],pos:'祈使句动词',meaning:'睡'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɪn/'],pos:'副词（固定搭配）',meaning:'（比平时起得晚）'}
    ],
    "explanations": [
      "`sleep in` = 睡懒觉、比平时起得晚，是固定搭配。常见错误：\n• \"Sleep in bed\" → 那是「睡在床上」，意思不同\n• 说成 \"sleep late\" 也行，但 sleep in 更地道",
      "相关：stay in bed（赖床不起）/ oversleep（睡过头，带责备意味）"
    ],
    "distractors": [["Sleeps","Sleeping","Slept"],["out.","on.","over."]]
  },
  {
    "sentence": "Read a book.",
    "translation": "读读书。",
    "chunks": ["Read", "a book."],
    "hints": ["读", "一本书"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/riːd/'],pos:'祈使句动词',meaning:'读'},
      {role:'宾语',color:'#3358e0',phonetic:['/ə/','/bʊk/'],pos:'名词短语',meaning:'一本书'}
    ],
    "explanations": [
      "`read` 现在式读 /riːd/，过去式拼写相同但读 /red/。常见错误：\n• 别写成 \"Look a book\"（look 要接 at）\n• \"Read book\" → 可数名词单数前要加 a",
      "相关：read to me（读给我听）/ read aloud（朗读）"
    ],
    "distractors": [["Reads","Reading","Reader"],["a books.","book.","a book of."]]
  },
  {
    "sentence": "Your room's messy.",
    "translation": "你的房间很乱。",
    "chunks": ["Your room's", "messy."],
    "hints": ["你的房间", "很乱"],
    "grammar": [
      {role:'主语',color:'#c87033',phonetic:['/jʊr/','/ruːmz/'],pos:'名词 + is 缩写',meaning:'你的房间（是）'},
      {role:'表语',color:'#3358e0',phonetic:['/ˈmesi/'],pos:'形容词',meaning:'乱的'}
    ],
    "explanations": [
      "`messy` = 乱七八糟的，很口语。常见错误：\n• \"Your room's mess\" → mess 是名词，这里要形容词 messy\n• \"Your room is a mess\" 也常用，两种说法都对",
      "相关：tidy up your room（把房间收拾整齐）/ a mess（一团乱）"
    ],
    "distractors": [["Your rooming","You room's","Your room is of"],["mess.","messily.","messes."]]
  },
  {
    "sentence": "Clean your room.",
    "translation": "打扫你的房间。",
    "chunks": ["Clean", "your room."],
    "hints": ["打扫", "你的房间"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/kliːn/'],pos:'祈使句动词',meaning:'打扫'},
      {role:'宾语',color:'#3358e0',phonetic:['/jʊr/','/ruːm/'],pos:'名词短语',meaning:'你的房间'}
    ],
    "explanations": [
      "`clean` 可作动词，指打扫干净。常见错误：\n• \"Clean up your room\" 也行，但 clean your room 就够\n• 宾语是代词时必须夹中间：clean it up",
      "相关：tidy up（收拾整齐）/ do the cleaning（打扫卫生）"
    ],
    "distractors": [["Cleans","Cleaning","Cleaner"],["your rooms.","you room.","your room is."]]
  },
  {
    "sentence": "Put on some music.",
    "translation": "放点音乐。",
    "chunks": ["Put on", "some music."],
    "hints": ["放上、打开", "一些音乐"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/pʊt/','/ɑːn/'],pos:'短语动词 put on',meaning:'打开、放上'},
      {role:'宾语',color:'#3358e0',phonetic:['/sʌm/','/ˈmjuːzɪk/'],pos:'名词短语（不可数）',meaning:'一些音乐'}
    ],
    "explanations": [
      "音乐、灯光都用 `put on` 表示「打开、放上」。常见错误：\n• \"Open the music\" → 中文说开音乐，英文用 put on\n• \"Put on some musics\" → music 不可数",
      "相关：play some music / turn up the music（把音乐调大）"
    ],
    "distractors": [["Put in","Putting on","Put of"],["some musics.","the music.","some musician."]]
  },
  {
    "sentence": "Smell some flowers.",
    "translation": "闻闻花香。",
    "chunks": ["Smell some", "flowers."],
    "hints": ["闻闻", "一些花"],
    "grammar": [
      {role:'谓语 + 限定词',color:'#e74c7a',phonetic:['/smel/','/sʌm/'],pos:'祈使 + 限定词',meaning:'闻闻'},
      {role:'宾语',color:'#3358e0',phonetic:['/ˈflaʊərz/'],pos:'名词（复数）',meaning:'花'}
    ],
    "explanations": [
      "`smell` 表「闻」时是及物动词。常见错误：\n• 说一片花丛用复数 flowers 更自然\n• smell 还能作系动词：It smells good.（闻起来很香）",
      "相关：take a deep breath（深呼吸）/ stop and smell the roses（享受生活）"
    ],
    "distractors": [["Smells some","Smelling some","Smell of"],["flower.","flowers's.","flour."]]
  },
  {
    "sentence": "Have a glass of wine.",
    "translation": "喝一杯酒。",
    "chunks": ["Have a glass of", "wine."],
    "hints": ["喝一杯", "葡萄酒"],
    "grammar": [
      {role:'谓语 + 量词',color:'#e74c7a',phonetic:['/hæv/','/ə/','/ɡlæs/','/əv/'],pos:'动词 + 量词短语',meaning:'喝一杯'},
      {role:'宾语',color:'#3358e0',phonetic:['/waɪn/'],pos:'不可数名词',meaning:'葡萄酒'}
    ],
    "explanations": [
      "液体用量词 `a glass of`。常见错误：\n• \"Have a wine\" → 一杯酒要说 a glass of wine\n• \"Have a glass wine\" → 少了 of",
      "相关：a cup of tea（一杯茶）/ a bottle of beer（一瓶啤酒）"
    ],
    "distractors": [["Have a glass","Have the glass of","Having a glass of"],["wines.","wine is.","win."]]
  },
  {
    "sentence": "Have some nice food.",
    "translation": "吃点好的。",
    "chunks": ["Have some", "nice food."],
    "hints": ["吃一点", "好吃的"],
    "grammar": [
      {role:'谓语 + 限定词',color:'#e74c7a',phonetic:['/hæv/','/sʌm/'],pos:'动词 + 限定词',meaning:'吃一点'},
      {role:'宾语',color:'#3358e0',phonetic:['/naɪs/','/fuːd/'],pos:'名词短语（不可数）',meaning:'好吃的'}
    ],
    "explanations": [
      "`nice food` 泛指好吃的；food 泛指时不可数。常见错误：\n• \"Have some nice foods\" → 泛指用不可数形式\n• \"Eat some nice food\" 也行，但 have 在招待语境更自然",
      "相关：treat yourself（犒劳一下自己）/ have a nice meal"
    ],
    "distractors": [["Have a","Have any","Had some"],["foods.","the food of.","nice foods."]]
  },
  {
    "sentence": "Let me hug you.",
    "translation": "让我抱抱你。",
    "chunks": ["Let me", "hug you."],
    "hints": ["让我", "抱你"],
    "grammar": [
      {role:'使役动词 + 宾语',color:'#e74c7a',phonetic:['/let/','/miː/'],pos:'let + 宾格',meaning:'让我'},
      {role:'谓语 + 宾语',color:'#3358e0',phonetic:['/hʌɡ/','/juː/'],pos:'动词 + 宾语',meaning:'抱你'}
    ],
    "explanations": [
      "`let me + 动词原形` 表请求允许自己做什么。常见错误：\n• \"Let me to hug you\" → let 后不加 to\n• \"Let I hug you\" → let 后要用宾格 me",
      "相关：Give me a hug.（抱一下）/ Can I hug you?"
    ],
    "distractors": [["Let I","Letting me","Let me to"],["hug yours.","hugging you.","to hug you."]]
  },
  {
    "sentence": "Get off of me.",
    "translation": "放开我。",
    "chunks": ["Get off of", "me."],
    "hints": ["从……上离开", "我"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/ɡet/','/ɔːf/','/əv/'],pos:'短语动词 get off of',meaning:'从……上离开'},
      {role:'宾语',color:'#3358e0',phonetic:['/miː/'],pos:'人称代词宾格',meaning:'我'}
    ],
    "explanations": [
      "`Get off of me.` = 放开我、别压着我，of 是口语里常加的。常见错误：\n• \"Get off me\" 也很常见，美式更爱加 of\n• \"Get of me\" → 少了 f，get off 不能漏",
      "相关：Let go of me.（放开我）/ Hands off!（别碰）"
    ],
    "distractors": [["Get out of","Get of","Getting off of"],["us.","him.","them."]]
  },
  {
    "sentence": "Come in.",
    "translation": "进来。",
    "chunks": ["Come", "in."],
    "hints": ["来", "进来"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/kʌm/'],pos:'祈使句动词',meaning:'来'},
      {role:'副词',color:'#7c5cbf',phonetic:['/ɪn/'],pos:'副词（表方向）',meaning:'进来'}
    ],
    "explanations": [
      "`Come in.` 是让人进屋最常用的说法，也用来回应敲门。常见错误：\n• \"Come into\" → into 后面必须接宾语（come into the room）\n• \"Enter in\" → enter 本身不接 in",
      "相关：Come on in.（快进来，更热情）/ After you.（您先请）"
    ],
    "distractors": [["Comes","Coming","Come to"],["into.","on.","out."]]
  },
  {
    "sentence": "Lock the door.",
    "translation": "把门锁上。",
    "chunks": ["Lock", "the door."],
    "hints": ["锁上", "门"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/lɑːk/'],pos:'祈使句动词',meaning:'锁'},
      {role:'宾语',color:'#3358e0',phonetic:['/ðə/','/dɔːr/'],pos:'名词短语',meaning:'门'}
    ],
    "explanations": [
      "`lock` 既是名词（锁）也是动词（锁上）。常见错误：\n• door 前要加 the\n• \"Close the door\" 只是关门，lock 才是上锁",
      "相关：lock up（把门窗锁好再走）/ unlock the door（开锁）"
    ],
    "distractors": [["Locks","Locking","Locker"],["the doors.","a door.","the door of."]]
  },
  {
    "sentence": "Don't mix them up.",
    "translation": "别把它们搞混了。",
    "chunks": ["Don't mix", "them up."],
    "hints": ["别弄混", "它们"],
    "grammar": [
      {role:'否定祈使',color:'#e74c7a',phonetic:['/doʊnt/','/mɪks/'],pos:'don\'t + 动词原形',meaning:'别弄混'},
      {role:'宾语 + 副词',color:'#7c5cbf',phonetic:['/ðem/','/ʌp/'],pos:'短语动词 mix up（代词夹中）',meaning:'把它们搞混'}
    ],
    "explanations": [
      "`mix up` = 弄混，代词宾语夹中间：mix **them** up。常见错误：\n• \"Don't mix up them\" → 代词要放中间\n• \"Don't mix them\" → 不加 up 会变成「别把它们搅在一起」",
      "相关：I always mix them up.（我总分不清）/ tell them apart（把它们区分开）"
    ],
    "distractors": [["Doesn't mix","Don't mix up","No mix"],["they up.","them on.","ups them."]]
  },
  {
    "sentence": "Sort them out.",
    "translation": "把它们分清楚。",
    "chunks": ["Sort", "them out."],
    "hints": ["分类、理清", "它们"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/sɔːrt/'],pos:'祈使句动词',meaning:'分类、理清'},
      {role:'宾语 + 副词',color:'#7c5cbf',phonetic:['/ðem/','/aʊt/'],pos:'短语动词 sort out（代词夹中）',meaning:'把它们理清楚'}
    ],
    "explanations": [
      "`sort out` = 整理、理清、分清，代词夹中间：sort **them** out。常见错误：\n• \"Sort out them\" → 代词要放中间\n• \"Sort them\" 单说意思不完整",
      "相关：figure it out（弄明白）/ work it out（解决）"
    ],
    "distractors": [["Sorts","Sorting","Sorted"],["they out.","them off.","out them."]]
  },
  {
    "sentence": "Keep it.",
    "translation": "你留着吧。",
    "chunks": ["Keep", "it."],
    "hints": ["留着、收下", "它"],
    "grammar": [
      {role:'谓语',color:'#e74c7a',phonetic:['/kiːp/'],pos:'祈使句动词',meaning:'留着、收下'},
      {role:'宾语',color:'#3358e0',phonetic:['/ɪt/'],pos:'人称代词宾格',meaning:'它'}
    ],
    "explanations": [
      "`Keep it.` = 收下吧、你留着，送东西时最常说。常见错误：\n• \"Take it\" 语气更硬，像命令，不是送礼口吻\n• \"Keep it for you\" → 应为 keep it for yourself",
      "相关：It's yours.（给你了）/ Keep the change.（零钱不用找了）"
    ],
    "distractors": [["Keeps","Keeping","Keep of"],["them.","its.","it is."]]
  }
];
