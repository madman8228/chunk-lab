/* ============================================================
   jqka.top 词库数据 —— 单词（J/Q/K/A 四段 × 10 条）

   为什么是 .js 而不是 .json：
     页面要能直接双击用 file:// 打开预览，而 file:// 下 fetch() 会被 CORS 拦成白屏；
     <script src> 不受此限制，本地预览和线上 http 都能跑。
     本文件只有数据、没有任何逻辑，改内容与改页面互不干扰。

   字段说明（与词组/句型/俚语共用同一套 schema）：
     t   类型：word / phrase / pattern / slang
     w   词形（单词为单字；词组为多词短语）
     ph  音标（仅单词）
     pos 词性（仅单词）
     lv  CEFR 等级，决定归入哪一段：A1/A2→J，B1→Q，B2→K，C1/C2→A
     cn  中文释义
     col 固定搭配 —— 这张卡的真正价值点
     eg  例句 / zh 例句翻译
     tip 易错提醒（可选）
   ============================================================ */
window.JQKA_DECK = {
  J:{name:'Jack',lv:'入门 · 侍从',cefr:'A1-A2 基础高频',color:'#E8503F',words:[
    {t:'word',w:'decide',ph:'/dɪˈsaɪd/',pos:'v.',lv:'A2',cn:'决定',col:'decide to do sth',eg:'I decided to practise English every morning.',zh:'我决定每天早上练英语。'},
    {t:'word',w:'borrow',ph:'/ˈbɒrəʊ/',pos:'v.',lv:'A2',cn:'借入',col:'borrow sth from sb',eg:'May I borrow your dictionary for a minute?',zh:'能借你的字典用一下吗？',tip:'易混：lend 才是借出'},
    {t:'word',w:'advice',ph:'/ədˈvaɪs/',pos:'n.',lv:'A2',cn:'建议（不可数）',col:'a piece of advice',eg:'She gave me a piece of useful advice.',zh:'她给了我一条有用的建议。',tip:'易错：没有 advices 这种写法'},
    {t:'word',w:'avoid',ph:'/əˈvɔɪd/',pos:'v.',lv:'A2',cn:'避免',col:'avoid doing sth',eg:'Avoid translating every word in your head.',zh:'别在心里逐字翻译。',tip:'易错：不说 avoid to do'},
    {t:'word',w:'explain',ph:'/ɪkˈspleɪn/',pos:'v.',lv:'A2',cn:'解释',col:'explain sth to sb',eg:'Can you explain this rule to me?',zh:'能给我讲讲这条规则吗？',tip:'易错：不说 explain me'},
    {t:'word',w:'enough',ph:'/ɪˈnʌf/',pos:'adj./adv.',lv:'A2',cn:'足够的',col:'修饰名词在前，修饰形容词在后',eg:'Ten minutes is enough for a quick review.',zh:'十分钟够快速复习一遍。'},
    {t:'word',w:'agree',ph:'/əˈɡriː/',pos:'v.',lv:'A2',cn:'同意',col:'agree with sb',eg:'I agree with you on this point.',zh:'这一点我同意你。'},
    {t:'word',w:'spend',ph:'/spend/',pos:'v.',lv:'A2',cn:'花费（时间、钱）',col:'spend time on sth',eg:'She spends an hour on English every day.',zh:'她每天在英语上花一小时。',tip:'易混：take、cost 的主语不同'},
    {t:'word',w:'ready',ph:'/ˈredi/',pos:'adj.',lv:'A2',cn:'准备好的',col:'be ready to do sth',eg:'Are you ready to speak in English?',zh:'你准备好开口说英语了吗？'},
    {t:'word',w:'improve',ph:'/ɪmˈpruːv/',pos:'v.',lv:'A2',cn:'提高，改善',col:'improve your speaking',eg:'Reading aloud improves your pronunciation.',zh:'朗读能改善发音。'}
  ]},
  Q:{name:'Queen',lv:'进阶 · 王后',cefr:'B1 日常进阶',color:'#EF8A2B',words:[
    {t:'word',w:'opportunity',ph:'/ˌɒpəˈtjuːnəti/',pos:'n.',lv:'B1',cn:'机会',col:'take an opportunity',eg:'Every mistake is an opportunity to learn.',zh:'每个错误都是学习的机会。'},
    {t:'word',w:'suggest',ph:'/səˈdʒest/',pos:'v.',lv:'B1',cn:'建议',col:'suggest doing sth',eg:'I suggest keeping a word notebook.',zh:'我建议随身记生词。',tip:'易错：不说 suggest sb to do'},
    {t:'word',w:'manage',ph:'/ˈmænɪdʒ/',pos:'v.',lv:'B1',cn:'设法做到；管理',col:'manage to do sth',eg:'She managed to finish the whole book.',zh:'她设法读完了整本书。',tip:'易错：manage to 不等于 can'},
    {t:'word',w:'effective',ph:'/ɪˈfektɪv/',pos:'adj.',lv:'B1',cn:'有效的',col:'an effective way to do sth',eg:'Shadowing is an effective way to fix pronunciation.',zh:'影子跟读是纠正发音的有效方法。'},
    {t:'word',w:'depend',ph:'/dɪˈpend/',pos:'v.',lv:'B1',cn:'取决于',col:'depend on sth',eg:'Progress depends on how often you practise.',zh:'进步取决于你练得多勤。',tip:'易错：on 不能省略'},
    {t:'word',w:'achieve',ph:'/əˈtʃiːv/',pos:'v.',lv:'B1',cn:'达成，取得',col:'achieve a goal',eg:'You can achieve fluency with daily practice.',zh:'每天练习就能达到流利。'},
    {t:'word',w:'familiar',ph:'/fəˈmɪliə/',pos:'adj.',lv:'B1',cn:'熟悉的',col:'be familiar with sth',eg:'I am familiar with this grammar point.',zh:'这个语法点我很熟。'},
    {t:'word',w:'require',ph:'/rɪˈkwaɪə/',pos:'v.',lv:'B1',cn:'需要，要求',col:'require sb to do sth',eg:'Fluency requires patience.',zh:'流利需要耐心。'},
    {t:'word',w:'prepare',ph:'/prɪˈpeə/',pos:'v.',lv:'B1',cn:'准备',col:'prepare for sth',eg:'She is preparing for an interview.',zh:'她在准备面试。'},
    {t:'word',w:'prefer',ph:'/prɪˈfɜː/',pos:'v.',lv:'B1',cn:'更喜欢',col:'prefer A to B',eg:'I prefer reading aloud to reading silently.',zh:'比起默读我更喜欢朗读。',tip:'易错：prefer A to B，不用 than'}
  ]},
  K:{name:'King',lv:'流利 · 国王',cefr:'B2 流利表达',color:'#3B7DD8',words:[
    {t:'word',w:'approach',ph:'/əˈprəʊtʃ/',pos:'n./v.',lv:'B2',cn:'方法，途径',col:'an approach to doing sth',eg:'We need a new approach to vocabulary.',zh:'我们需要新的词汇学习方法。'},
    {t:'word',w:'significant',ph:'/sɪɡˈnɪfɪkənt/',pos:'adj.',lv:'B2',cn:'显著的，重要的',col:'a significant increase in sth',eg:'There was a significant improvement in her accent.',zh:'她的口音有显著改善。'},
    {t:'word',w:'contribute',ph:'/kənˈtrɪbjuːt/',pos:'v.',lv:'B2',cn:'促成，贡献',col:'contribute to sth',eg:'Daily input contributes to long-term fluency.',zh:'每天的输入成就长期流利。'},
    {t:'word',w:'evidence',ph:'/ˈevɪdəns/',pos:'n.',lv:'B2',cn:'证据（不可数）',col:'there is evidence that',eg:'There is evidence that sleep helps memory.',zh:'有证据表明睡眠有助于记忆。',tip:'易错：不说 an evidence'},
    {t:'word',w:'maintain',ph:'/meɪnˈteɪn/',pos:'v.',lv:'B2',cn:'保持；主张',col:'maintain that',eg:'He maintains that practice beats talent.',zh:'他主张练习胜过天赋。'},
    {t:'word',w:'perspective',ph:'/pəˈspektɪv/',pos:'n.',lv:'B2',cn:'视角，观点',col:'from my perspective',eg:'From my perspective, mistakes are data.',zh:'在我看来，错误就是数据。'},
    {t:'word',w:'demonstrate',ph:'/ˈdemənstreɪt/',pos:'v.',lv:'B2',cn:'证明；演示',col:'demonstrate how to do sth',eg:'She demonstrated how to use the phrase.',zh:'她演示了怎么用这个短语。'},
    {t:'word',w:'consequence',ph:'/ˈkɒnsɪkwəns/',pos:'n.',lv:'B2',cn:'结果，后果',col:'as a consequence of sth',eg:'Small habits have big consequences.',zh:'小习惯有大后果。'},
    {t:'word',w:'efficient',ph:'/ɪˈfɪʃnt/',pos:'adj.',lv:'B2',cn:'高效的',col:'an efficient learner',eg:'Efficient learners review at intervals.',zh:'高效的学习者会间隔复习。'},
    {t:'word',w:'reluctant',ph:'/rɪˈlʌktənt/',pos:'adj.',lv:'B2',cn:'不情愿的',col:'be reluctant to do sth',eg:'Do not be reluctant to speak out loud.',zh:'别不愿意大声说出来。'}
  ]},
  A:{name:'Ace',lv:'精通 · 王牌',cefr:'C1-C2 母语级',color:'#3E9A2E',words:[
    {t:'word',w:'nuance',ph:'/ˈnjuːɑːns/',pos:'n.',lv:'C1',cn:'细微差别',col:'the nuances of a word',eg:'Native speakers feel the nuance of every word.',zh:'母语者能感知每个词的细微差别。'},
    {t:'word',w:'compelling',ph:'/kəmˈpelɪŋ/',pos:'adj.',lv:'C1',cn:'令人信服的；引人入胜的',col:'a compelling argument',eg:'She made a compelling case for reading widely.',zh:'她为广泛阅读给出了有力论据。'},
    {t:'word',w:'articulate',ph:'/ɑːˈtɪkjuleɪt/',pos:'v.',lv:'C1',cn:'清晰地表达',col:'articulate an idea',eg:'He can articulate complex ideas in simple words.',zh:'他能用简单的话清晰表达复杂的想法。'},
    {t:'word',w:'ubiquitous',ph:'/juːˈbɪkwɪtəs/',pos:'adj.',lv:'C2',cn:'无处不在的',col:'ubiquitous in sth',eg:'English is ubiquitous on the internet.',zh:'英语在互联网上无处不在。'},
    {t:'word',w:'pragmatic',ph:'/præɡˈmætɪk/',pos:'adj.',lv:'C1',cn:'务实的',col:'a pragmatic approach',eg:'Take a pragmatic approach to grammar.',zh:'用务实的态度对待语法。'},
    {t:'word',w:'inherent',ph:'/ɪnˈhɪərənt/',pos:'adj.',lv:'C2',cn:'固有的，内在的',col:'inherent in sth',eg:'Ambiguity is inherent in any language.',zh:'任何语言都有内在的模糊性。'},
    {t:'word',w:'leverage',ph:'/ˈliːvərɪdʒ/',pos:'v.',lv:'C1',cn:'利用（资源）',col:'leverage sth to do sth',eg:'Leverage your interests to learn faster.',zh:'利用你的兴趣学得更快。'},
    {t:'word',w:'acknowledge',ph:'/əkˈnɒlɪdʒ/',pos:'v.',lv:'C1',cn:'承认，认可',col:'acknowledge that',eg:'She acknowledged that she had been too shy.',zh:'她承认自己以前太害羞。'},
    {t:'word',w:'subtle',ph:'/ˈsʌtl/',pos:'adj.',lv:'C1',cn:'微妙的',col:'a subtle difference',eg:'There is a subtle difference between the two tenses.',zh:'这两个时态之间有微妙的差别。'},
    {t:'word',w:'proficient',ph:'/prəˈfɪʃnt/',pos:'adj.',lv:'C1',cn:'熟练的',col:'be proficient in sth',eg:'She is proficient in both speaking and writing.',zh:'她的口语和写作都很熟练。'}
  ]}
};
