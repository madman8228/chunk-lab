/* ============================================================
   jqka.top 词库数据 —— 词组（第一批 50 条）

   与 data/deck.js 共用同一套 schema，差别只在 t 字段与「没有 ph/pos」：
     t   'phrase'
     w   词组本体（多词）
     lv  CEFR 等级，决定归入哪一段：A1/A2→J，B1→Q，B2→K，C1/C2→A
     cn  中文释义
     col 该词组的固定用法 / 常见搭配环境
     eg  例句 / zh 例句翻译
     tip 易错提醒（可选）

   加第二批时：照抄下面的结构往数组里追加即可，页面会自动按 lv 归段、
   自动在类型筛选里出现，无需改页面代码。
   ============================================================ */
window.JQKA_PHRASES = [
  /* ---------- A2 · 15 条（归入 Jack 段） ---------- */
  {t:'phrase',w:'take a break',lv:'A2',cn:'休息一下',col:'take a break from sth',eg:"Let's take a break and come back in ten minutes.",zh:'我们休息一下，十分钟后回来。'},
  {t:'phrase',w:'get up',lv:'A2',cn:'起床',col:'get up early',eg:'I get up at six on weekdays.',zh:'工作日我六点起床。'},
  {t:'phrase',w:'look for',lv:'A2',cn:'寻找',col:'look for sth',eg:'I am looking for my notebook.',zh:'我在找我的笔记本。'},
  {t:'phrase',w:'wait for',lv:'A2',cn:'等待',col:'wait for sb',eg:'Wait for me at the gate.',zh:'在门口等我。'},
  {t:'phrase',w:'be late for',lv:'A2',cn:'迟到',col:'be late for sth',eg:'Sorry, I was late for the meeting.',zh:'抱歉，我开会迟到了。'},
  {t:'phrase',w:'on time',lv:'A2',cn:'准时',col:'arrive on time',eg:'The train arrived on time.',zh:'火车准点到达。'},
  {t:'phrase',w:'a lot of',lv:'A2',cn:'许多',col:'a lot of time',eg:'She spends a lot of time on listening.',zh:'她在听力上花很多时间。'},
  {t:'phrase',w:'make friends',lv:'A2',cn:'交朋友',col:'make friends with sb',eg:'He made friends with his classmate.',zh:'他和同学交上了朋友。'},
  {t:'phrase',w:'take care of',lv:'A2',cn:'照顾；处理',col:'take care of sb / sth',eg:'I will take care of the details.',zh:'细节我来负责。'},
  {t:'phrase',w:'be busy with',lv:'A2',cn:'忙于',col:'be busy with sth',eg:'She is busy with her final exam.',zh:'她在忙期末考试。'},
  {t:'phrase',w:'turn off',lv:'A2',cn:'关掉',col:'turn off the light',eg:'Turn off your phone before bed.',zh:'睡前把手机关了。'},
  {t:'phrase',w:'have a look',lv:'A2',cn:'看一下',col:'have a look at sth',eg:'Have a look at this sentence.',zh:'看一下这个句子。'},
  {t:'phrase',w:'be good at',lv:'A2',cn:'擅长',col:'be good at doing sth',eg:'He is good at remembering faces.',zh:'他很擅长记人脸。'},
  {t:'phrase',w:'come back',lv:'A2',cn:'回来',col:'come back home',eg:'I came back home late last night.',zh:'我昨晚很晚才回家。'},
  {t:'phrase',w:'at the weekend',lv:'A2',cn:'在周末',col:'at the weekend（美式说 on the weekend）',eg:'I review my notes at the weekend.',zh:'我周末复习笔记。',tip:'英式 at，美式 on'},

  /* ---------- B1 · 20 条（归入 Queen 段） ---------- */
  {t:'phrase',w:'run out of',lv:'B1',cn:'用完，耗尽',col:'run out of time',eg:'We ran out of time before the last question.',zh:'我们在最后一题前就没时间了。'},
  {t:'phrase',w:'put off',lv:'B1',cn:'推迟',col:'put off doing sth',eg:'Do not put off today’s practice.',zh:'别把今天的练习往后推。',tip:'off 后面接 doing，不接 to do'},
  {t:'phrase',w:'look forward to',lv:'B1',cn:'期待',col:'look forward to doing sth',eg:'I look forward to hearing from you.',zh:'期待你的回复。',tip:'这里的 to 是介词，后面必须接 doing'},
  {t:'phrase',w:'get used to',lv:'B1',cn:'习惯于',col:'get used to doing sth',eg:'She got used to speaking English every day.',zh:'她习惯了每天说英语。'},
  {t:'phrase',w:'make up your mind',lv:'B1',cn:'下定决心',col:'make up your mind about sth',eg:'Make up your mind before you start.',zh:'开始前先拿定主意。'},
  {t:'phrase',w:'take part in',lv:'B1',cn:'参加',col:'take part in sth',eg:'He took part in the speaking club.',zh:'他参加了口语俱乐部。'},
  {t:'phrase',w:'come up with',lv:'B1',cn:'想出，提出',col:'come up with an idea',eg:'She came up with a great idea.',zh:'她想出了一个好主意。'},
  {t:'phrase',w:'keep up with',lv:'B1',cn:'跟上',col:'keep up with sb / sth',eg:'It is hard to keep up with new words.',zh:'生词很难跟得上。'},
  {t:'phrase',w:'end up',lv:'B1',cn:'最终成为，结果是',col:'end up doing sth',eg:'We ended up talking for two hours.',zh:'我们最后聊了两个小时。'},
  {t:'phrase',w:'deal with',lv:'B1',cn:'处理，应对',col:'deal with sth',eg:'How do you deal with new words?',zh:'你怎么处理生词？'},
  {t:'phrase',w:'rely on',lv:'B1',cn:'依赖，依靠',col:'rely on sb / sth',eg:'Do not rely on translation apps.',zh:'别依赖翻译软件。'},
  {t:'phrase',w:'be aware of',lv:'B1',cn:'意识到',col:'be aware of sth',eg:'Be aware of your own mistakes.',zh:'要意识到自己的错误。'},
  {t:'phrase',w:'in charge of',lv:'B1',cn:'负责',col:'be in charge of sth',eg:'She is in charge of the project.',zh:'她负责这个项目。'},
  {t:'phrase',w:'on purpose',lv:'B1',cn:'故意地',col:'do sth on purpose',eg:'I did not do it on purpose.',zh:'我不是故意的。'},
  {t:'phrase',w:'by the way',lv:'B1',cn:'顺便说一句',col:'话题转换时的插入语',eg:'By the way, did you finish your review?',zh:'顺便问一句，你复习完了吗？'},
  {t:'phrase',w:'take advantage of',lv:'B1',cn:'利用（机会）',col:'take advantage of sth',eg:'Take advantage of every chance to speak.',zh:'利用每个开口的机会。'},
  {t:'phrase',w:'get along with',lv:'B1',cn:'与…相处',col:'get along with sb',eg:'He gets along with his teammates.',zh:'他和队友相处得很好。'},
  {t:'phrase',w:'make progress',lv:'B1',cn:'取得进步',col:'make progress in sth',eg:'You are making progress in listening.',zh:'你的听力在进步。'},
  {t:'phrase',w:'set a goal',lv:'B1',cn:'设定目标',col:'set a goal for yourself',eg:'Set a goal you can actually reach.',zh:'定一个你真够得着的目标。'},
  {t:'phrase',w:'keep in mind',lv:'B1',cn:'记住',col:'keep sth in mind',eg:'Keep this rule in mind.',zh:'把这条规则记在心里。'},

  /* ---------- B2 · 10 条（归入 King 段） ---------- */
  {t:'phrase',w:'take sth for granted',lv:'B2',cn:'认为…理所当然',col:'take it for granted that',eg:'Do not take your progress for granted.',zh:'别把进步当成理所当然。'},
  {t:'phrase',w:'make a difference',lv:'B2',cn:'有影响，起作用',col:'make a difference to sth',eg:'Ten minutes a day makes a difference.',zh:'每天十分钟是有差别的。'},
  {t:'phrase',w:'come to terms with',lv:'B2',cn:'接受（不愉快的事实）',col:'come to terms with sth',eg:'He came to terms with his accent.',zh:'他接受了自己的口音。'},
  {t:'phrase',w:'fall behind',lv:'B2',cn:'落后',col:'fall behind on sth',eg:'I fell behind on my review schedule.',zh:'我的复习进度落后了。'},
  {t:'phrase',w:'get the hang of',lv:'B2',cn:'掌握窍门',col:'get the hang of sth',eg:'Once you get the hang of it, it is easy.',zh:'一旦摸到窍门就简单了。'},
  {t:'phrase',w:'in the long run',lv:'B2',cn:'从长远来看',col:'句首或句末作状语',eg:'In the long run, habits beat motivation.',zh:'长远看，习惯胜过动力。'},
  {t:'phrase',w:'weigh up',lv:'B2',cn:'权衡',col:'weigh up the pros and cons',eg:'Weigh up the pros and cons before you choose.',zh:'选择前权衡一下利弊。'},
  {t:'phrase',w:'rule out',lv:'B2',cn:'排除，不考虑',col:'rule out sth',eg:'Do not rule out reading aloud.',zh:'别把朗读排除在外。'},
  {t:'phrase',w:'come across as',lv:'B2',cn:'给人的印象是',col:'come across as adj.',eg:'He comes across as very confident.',zh:'他给人的印象是很自信。'},
  {t:'phrase',w:'take into account',lv:'B2',cn:'考虑到',col:'take sth into account',eg:'Take your schedule into account.',zh:'把你的时间安排考虑进去。'},

  /* ---------- C1 · 5 条（归入 Ace 段） ---------- */
  {t:'phrase',w:'be on the same page',lv:'C1',cn:'意见一致',col:'be on the same page about sth',eg:'Let us make sure we are on the same page.',zh:'我们确认一下理解是否一致。'},
  {t:'phrase',w:'read between the lines',lv:'C1',cn:'读出言外之意',col:'习语，多用于正式或半正式语境',eg:'Reading between the lines, he was not happy.',zh:'从字里行间看，他并不高兴。'},
  {t:'phrase',w:'hit the ground running',lv:'C1',cn:'一上手就进入状态',col:'多用于职场语境',eg:'She hit the ground running on her first day.',zh:'她第一天就迅速进入了状态。'},
  {t:'phrase',w:'go the extra mile',lv:'C1',cn:'格外努力',col:'go the extra mile to do sth',eg:'He goes the extra mile to help learners.',zh:'他为了帮学习者格外用心。'},
  {t:'phrase',w:'take it with a grain of salt',lv:'C1',cn:'对…持保留态度',col:'take sth with a grain of salt',eg:'Take online advice with a grain of salt.',zh:'网上的建议要持保留态度。'}
];
