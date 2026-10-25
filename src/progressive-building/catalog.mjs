import { validateCatalog } from './schema.mjs';

const rows = [
  ['主谓：谁做什么', [], '主语与陈述对象|动作谓语|分别替换与独立复用'],
  ['主谓宾：动作涉及什么', ['PB01'], '动作对象|完整宾语|人物与对象替换迁移'],
  ['主系表：身份与状态', ['PB01'], '名词表语|形容词状态|介词短语表语|系动词连接与宾语对比'],
  ['名词短语内部修饰', ['PB02'], '形容词定语|中心名词与名词短语|主语和宾语位置复用'],
  ['可数、数量与指称', ['PB04'], 'a/an与发音|the与已知指称|复数|可数与不可数|数量和限定表达'],
  ['介词短语：位置与方向', ['PB05'], '地点介词短语|介词与宾语|位置语义和替换'],
  ['后置定语与主语扩展', ['PB03','PB06'], '介词短语后置定语|主语内部扩展|修饰对象'],
  ['时间、地点、方式与伴随', ['PB02','PB06'], '时间与频率|地点|方式|伴随|多项信息位置'],
  ['必需的地点与方向', ['PB06','PB08'], '必需地点方向|可省附加信息对比|地点变化保留骨架'],
  ['比较与程度', ['PB03','PB04'], '比较级与对象|最高级与范围|程度修饰'],
  ['双宾语：给谁什么', ['PB02','PB05'], '接收者与物品|间接与直接宾语|双宾迁移'],
  ['双宾结构的搭配变化', ['PB06','PB11'], 'give与to|buy与for|可转换与受限搭配'],
  ['宾语补足语：宾语怎样', ['PB02','PB03'], '形容词宾补|名词宾补|宾补与双宾对比'],
  ['want/need to do', ['PB02','PB08'], '动词搭配不定式|整体不定式作宾语|不定式内部结构'],
  ['help sb do', ['PB02','PB13'], 'help两种形式|宾补动作与对象|扩展复用'],
  ['be句否定与疑问', ['PB03'], 'be否定|be一般疑问|简短回答'],
  ['实义动词否定与疑问', ['PB02'], 'do/does否定|一般疑问|动词原形和简短回答'],
  ['情态动词与请求', ['PB01','PB16','PB17'], '能力与许可|请求|义务与建议|推测'],
  ['特殊疑问句', ['PB16','PB17'], '问对象地点时间|问主语|主语疑问与宾语疑问'],
  ['指令与存在句', ['PB05','PB06','PB16'], '指令和禁止|there is/are|存在与位置'],
  ['一般现在时与主谓一致', ['PB01','PB17'], '习惯与事实|主谓一致|does与动词原形'],
  ['现在进行体', ['PB03','PB16','PB21'], '正在发生|be加-ing|习惯与当前对比'],
  ['过去的状态与位置', ['PB03','PB16'], '过去身份状态位置|was/were|否定与疑问'],
  ['一般过去时与did', ['PB17','PB21','PB23'], '过去事件与过去式|did否定|did疑问及主语疑问回访'],
  ['将来意图、安排与预测', ['PB18','PB21','PB22'], 'going to意图|will决定或预测|进行式安排'],
  ['过去进行体与事件背景', ['PB22','PB24'], '过去进行形式|背景与插入事件|一般过去对比'],
  ['现在完成体', ['PB21','PB24'], '经历|结果与现在联系|for/since延续|一般过去对比'],
  ['过去完成体与先后', ['PB24','PB27'], '过去参照点|之前发生|事件先后顺序'],
  ['完成进行与未来体', ['PB22','PB25','PB27'], '完成进行|未来进行|将来完成'],
  ['被动语态', ['PB02','PB24','PB27'], '主动被动角色|常用时态被动|情态与完成被动|宾补关系回访'],
  ['把动作当作一件事来表达', ['PB02','PB03','PB14'], '动作作主语|动作作宾语|短语整体与内部'],
  ['不定式的目的与其他作用', ['PB08','PB14'], '目的不定式|不定式主语与形式主语|作定语及宾语比较'],
  ['分词短语修饰名词', ['PB07','PB22','PB30'], '现在分词定语|过去分词定语|内部对象与修饰关系'],
  ['非谓语作宾补', ['PB13','PB15','PB31'], 'to do宾补|裸不定式宾补|doing/done对比'],
  ['多词动词与固定搭配', ['PB06','PB14','PB17'], '小品词动词与代词位置|介词搭配|to do/doing约束'],
  ['宾语从句', ['PB02','PB19','PB24'], 'that内容|wh/if/whether|从句陈述语序'],
  ['限定性定语从句', ['PB07','PB17','PB24'], '关系词作主语|作宾语与省略|主语整体扩展'],
  ['主语从句与形式主语', ['PB03','PB31','PB36'], '主语从句|it形式主语|后置内容及谓语关系'],
  ['表语从句', ['PB03','PB36'], 'that表语从句|wh表语从句|与宾语从句对比'],
  ['同位语与内容从句', ['PB05','PB36','PB37'], '名词同位说明|内容从句|与定语从句对比'],
  ['时间、原因与条件从句', ['PB08','PB21','PB24'], '时间从句|原因从句|现实条件|PB26/PB28回访'],
  ['目的、结果、让步与比较', ['PB10','PB32','PB41'], '目的|结果|让步|比较与方式|enough/too句型'],
  ['并列、转折与省略', ['PB17','PB41'], '并列|转折|允许的省略|长句链'],
  ['条件与非事实假设', ['PB18','PB24','PB25','PB41'], '现实条件与假设|现在将来非事实|过去非事实'],
  ['间接转述与过去视角', ['PB25','PB28','PB36'], '直接转间接|人称和时间视角|过去视角将来|不必后移的语境'],
  ['非限定性定语从句', ['PB37','PB43'], '补充与限定信息|关系形式|逗号与范围'],
  ['强调与信息焦点', ['PB03','PB37'], 'it强调|对比焦点|强调构式与普通it'],
  ['倒装、附加疑问与简答', ['PB16','PB18','PB21','PB43'], 'so/neither回应|附加疑问|常见否定前置倒装'],
  ['综合组句与不同表达路径', ['PB11','PB13','PB30','PB35','PB37','PB41'], '同义表达路径|新情境组合|自查纠错'],
  ['独立表达与延迟迁移', ['PB49'], '减少支架的即时表达|跨次延迟提取|帮助与未知答案|分层证据'],
];

export const nodes = validateCatalog(rows.map(([title, prerequisites, subgoals], index) => {
  const id = `PB${String(index + 1).padStart(2, '0')}`;
  return {
    id, title, prerequisites,
    subgoalIds: subgoals.split('|').map((_, subgoalIndex) => `${id}.${String.fromCharCode(97 + subgoalIndex)}`),
    subgoals: subgoals.split('|'),
    status: ['PB01', 'PB02', 'PB03', 'PB04', 'PB05', 'PB06', 'PB07', 'PB08', 'PB09', 'PB10', 'PB11', 'PB12', 'PB13', 'PB14', 'PB15', 'PB16', 'PB17', 'PB18', 'PB19', 'PB20', 'PB21', 'PB22', 'PB23', 'PB24', 'PB25', 'PB26', 'PB27', 'PB28', 'PB29', 'PB30', 'PB31', 'PB32', 'PB33', 'PB34', 'PB35', 'PB36', 'PB37', 'PB38', 'PB39', 'PB40', 'PB41', 'PB42', 'PB43', 'PB44', 'PB45', 'PB46', 'PB47', 'PB48', 'PB49', 'PB50'].includes(id) ? 'preview' : 'planned',
  };
}));

export const legacyLessonIds = [
  'foundation-sv-preview', 'foundation-svo-preview', 'foundation-svc-preview',
  'mixed-foundation-review', 'noun-phrase-preview', 'quantity-preview',
  'expression-expansion-preview', 'book-on-desk-preview', 'help-carry-box-preview',
];

const courseLoaders = {
  PB01: [{ id: 'pb01-subject-predicate-v1', label: '主语与动作谓语', load: () => import('./content/pb01.mjs') }],
  PB02: [{ id: 'pb02-subject-verb-object-v1', label: '动作涉及什么', load: () => import('./content/pb02.mjs') }],
  PB03: [
    { id: 'pb03-noun-predicative-v1', label: '名词说明身份', load: () => import('./content/pb03.mjs') },
    { id: 'pb03-adjective-predicative-v1', label: '形容词说明状态', load: () => import('./content/pb03.mjs') },
    { id: 'pb03-pp-predicative-v1', label: '介词短语说明位置', load: () => import('./content/pb03.mjs') },
    { id: 'pb03-predicative-object-contrast-v1', label: '表语与宾语对比', load: () => import('./content/pb03.mjs') },
  ],
  PB04: [{ id: 'pb04-adjective-modifier-v1', label: '形容词定语与整组范围', load: () => import('./content/pb04.mjs') }],
  PB05: [
    { id: 'pb05-article-sound-v1', label: 'a / an 按开头发音', load: () => import('./content/pb05.mjs') },
    { id: 'pb05-known-reference-v1', label: 'the 与已知对象', load: () => import('./content/pb05.mjs') },
    { id: 'pb05-plural-forms-v1', label: '规则与不规则复数', load: () => import('./content/pb05.mjs') },
    { id: 'pb05-countability-v1', label: '可数与不可数', load: () => import('./content/pb05.mjs') },
    { id: 'pb05-quantity-determiners-v1', label: 'many 与 much', load: () => import('./content/pb05.mjs') },
  ],
  PB06: [
    { id: 'pb06-location-phrase-v1', label: '介词短语与地点', load: () => import('./content/pb06.mjs') },
    { id: 'pb06-position-meaning-v1', label: '位置关系与替换', load: () => import('./content/pb06.mjs') },
  ],
  PB07: [{ id: 'pb07-postpositive-modifier-v1', label: '后置定语与完整主语', load: () => import('./content/pb07.mjs') }],
  PB08: [
    { id: 'pb08-time-frequency-v1', label: '时间与频率状语', load: () => import('./content/pb08.mjs') },
    { id: 'pb08-place-adverbial-v1', label: '地点状语', load: () => import('./content/pb08.mjs') },
    { id: 'pb08-manner-adverbial-v1', label: '方式状语', load: () => import('./content/pb08.mjs') },
    { id: 'pb08-company-adverbial-v1', label: '伴随状语', load: () => import('./content/pb08.mjs') },
    { id: 'pb08-multiple-adverbials-v1', label: '多项信息与语序', load: () => import('./content/pb08.mjs') },
  ],
  PB09: [
    { id: 'pb09-required-destination-v1', label: '动作需要的目的地', load: () => import('./content/pb09.mjs') },
    { id: 'pb09-optional-location-v1', label: '可省略的地点信息', load: () => import('./content/pb09.mjs') },
  ],
  PB10: [
    { id: 'pb10-comparative-v1', label: '比较级与比较对象', load: () => import('./content/pb10.mjs') },
    { id: 'pb10-superlative-v1', label: '最高级与比较范围', load: () => import('./content/pb10.mjs') },
    { id: 'pb10-degree-modifier-v1', label: '程度修饰', load: () => import('./content/pb10.mjs') },
  ],
  PB11: [{ id: 'pb11-double-object-v1', label: '双宾语：给谁、给什么', load: () => import('./content/pb11.mjs') }],
  PB12: [
    { id: 'pb12-give-to-v1', label: 'give 与 to 结构', load: () => import('./content/pb12.mjs') },
    { id: 'pb12-buy-for-v1', label: 'buy 与 for 结构', load: () => import('./content/pb12.mjs') },
    { id: 'pb12-verb-constraints-v1', label: '动词搭配限制', load: () => import('./content/pb12.mjs') },
  ],
  PB13: [
    { id: 'pb13-adjective-complement-v1', label: '形容词宾语补足语', load: () => import('./content/pb13.mjs') },
    { id: 'pb13-noun-complement-v1', label: '名词宾语补足语', load: () => import('./content/pb13.mjs') },
    { id: 'pb13-complement-vs-double-object-v1', label: '宾补与双宾语对比', load: () => import('./content/pb13.mjs') },
  ],
  PB14: [{ id: 'pb14-want-to-do-v1', label: 'want to do：整体与内部', load: () => import('./content/pb14.mjs') }],
  PB15: [
    { id: 'pb15-help-bare-infinitive-v1', label: 'help sb do', load: () => import('./content/pb15.mjs') },
    { id: 'pb15-help-to-infinitive-v1', label: 'help sb to do', load: () => import('./content/pb15.mjs') },
  ],
  PB16: [{ id: 'pb16-be-negative-question-v1', label: 'be 句的否定、疑问与简答', load: () => import('./content/pb16.mjs') }],
  PB17: [
    { id: 'pb17-do-negation-v1', label: 'do / does 否定与动词原形', load: () => import('./content/pb17.mjs') },
    { id: 'pb17-general-question-v1', label: 'do / does 一般疑问句', load: () => import('./content/pb17.mjs') },
  ],
  PB18: [
    { id: 'pb18-ability-permission-v1', label: 'can：能力与许可', load: () => import('./content/pb18.mjs') },
    { id: 'pb18-request-v1', label: 'can：礼貌请求', load: () => import('./content/pb18.mjs') },
    { id: 'pb18-obligation-advice-v1', label: 'must / should：义务与建议', load: () => import('./content/pb18.mjs') },
    { id: 'pb18-deduction-v1', label: 'must：推断', load: () => import('./content/pb18.mjs') },
  ],
  PB19: [
    { id: 'pb19-what-question-v1', label: 'What：询问宾语', load: () => import('./content/pb19.mjs') },
    { id: 'pb19-where-when-v1', label: 'Where / When：地点与时间', load: () => import('./content/pb19.mjs') },
    { id: 'pb19-subject-object-who-v1', label: 'Who：主语还是宾语', load: () => import('./content/pb19.mjs') },
  ],
  PB20: [
    { id: 'pb20-imperative-v1', label: '指令与禁止', load: () => import('./content/pb20.mjs') },
    { id: 'pb20-existential-v1', label: 'There be：存在与位置', load: () => import('./content/pb20.mjs') },
  ],
  PB21: [{ id: 'pb21-present-agreement-v1', label: '一般现在时与主谓一致', load: () => import('./content/pb21.mjs') }],
  PB22: [{ id: 'pb22-present-progressive-v1', label: '现在进行：此刻正在发生', load: () => import('./content/pb22.mjs') }],
  PB23: [{ id: 'pb23-past-be-v1', label: '过去状态与 was / were', load: () => import('./content/pb23.mjs') }],
  PB24: [{ id: 'pb24-past-did-v1', label: '一般过去时与 did', load: () => import('./content/pb24.mjs') }],
  PB25: [
    { id: 'pb25-going-to-v1', label: 'be going to：已有计划', load: () => import('./content/pb25.mjs') },
    { id: 'pb25-will-v1', label: 'will：决定与预测', load: () => import('./content/pb25.mjs') },
    { id: 'pb25-arrangement-v1', label: '现在进行式：已安排的行程', load: () => import('./content/pb25.mjs') },
  ],
  PB26: [{ id: 'pb26-past-progressive-background-v1', label: '过去进行：背景与插入事件', load: () => import('./content/pb26.mjs') }],
  PB27: [{ id: 'pb27-present-perfect-v1', label: '现在完成：过去与现在的联系', load: () => import('./content/pb27.mjs') }],
  PB28: [{ id: 'pb28-past-perfect-order-v1', label: '过去完成：事件先后', load: () => import('./content/pb28.mjs') }],
  PB29: [
    { id: 'pb29-perfect-progressive-v1', label: '现在完成进行：持续到现在', load: () => import('./content/pb29.mjs') },
    { id: 'pb29-future-progressive-v1', label: '将来进行：未来某时正在做', load: () => import('./content/pb29.mjs') },
    { id: 'pb29-future-perfect-v1', label: '将来完成：未来参照点之前完成', load: () => import('./content/pb29.mjs') },
  ],
  PB30: [
    { id: 'pb30-basic-passive-v1', label: '被动语态：动作承受者作主语', load: () => import('./content/pb30.mjs') },
    { id: 'pb30-modal-perfect-passive-v1', label: '情态与完成被动', load: () => import('./content/pb30.mjs') },
    { id: 'pb30-passive-complement-v1', label: '被动句与宾语补足语', load: () => import('./content/pb30.mjs') },
  ],
  PB31: [
    { id: 'pb31-gerund-subject-v1', label: '游泳这件事：动作原形还是 -ing', load: () => import('./content/pb31.mjs') },
    { id: 'pb31-gerund-object-v1', label: '动名词作宾语', load: () => import('./content/pb31.mjs') },
    { id: 'pb31-gerund-phrase-v1', label: '动名词短语整体与内部', load: () => import('./content/pb31.mjs') },
  ],
  PB32: [
    { id: 'pb32-purpose-infinitive-v1', label: '目的不定式', load: () => import('./content/pb32.mjs') },
    { id: 'pb32-infinitive-subject-v1', label: '不定式作主语与形式主语', load: () => import('./content/pb32.mjs') },
    { id: 'pb32-infinitive-modifier-contrast-v1', label: '不定式作定语与宾语对比', load: () => import('./content/pb32.mjs') },
  ],
  PB33: [
    { id: 'pb33-present-participle-modifier-v1', label: '现在分词作定语', load: () => import('./content/pb33.mjs') },
    { id: 'pb33-past-participle-modifier-v1', label: '过去分词作定语', load: () => import('./content/pb33.mjs') },
    { id: 'pb33-participle-attachment-v1', label: '分词短语内部与修饰范围', load: () => import('./content/pb33.mjs') },
  ],
  PB34: [
    { id: 'pb34-to-infinitive-complement-v1', label: 'to do 作宾语补足语', load: () => import('./content/pb34.mjs') },
    { id: 'pb34-bare-infinitive-complement-v1', label: '裸不定式作宾语补足语', load: () => import('./content/pb34.mjs') },
    { id: 'pb34-ing-ed-complement-v1', label: 'doing / done 作宾语补足语', load: () => import('./content/pb34.mjs') },
  ],
  PB35: [
    { id: 'pb35-particle-verb-position-v1', label: '小品词动词与代词位置', load: () => import('./content/pb35.mjs') },
    { id: 'pb35-preposition-object-position-v1', label: '介词搭配与宾语位置', load: () => import('./content/pb35.mjs') },
    { id: 'pb35-verb-complement-patterns-v1', label: '动词后的 to do / doing', load: () => import('./content/pb35.mjs') },
  ],
  PB36: [
    { id: 'pb36-that-object-clause-v1', label: 'that 内容从句作宾语', load: () => import('./content/pb36.mjs') },
    { id: 'pb36-wh-indirect-question-v1', label: 'wh / if / whether 嵌入疑问', load: () => import('./content/pb36.mjs') },
    { id: 'pb36-embedded-statement-order-v1', label: '从句内部陈述语序', load: () => import('./content/pb36.mjs') },
  ],
  PB37: [
    { id: 'pb37-relative-subject-v1', label: '关系词在从句中作主语', load: () => import('./content/pb37.mjs') },
    { id: 'pb37-relative-object-omission-v1', label: '关系词作宾语与省略', load: () => import('./content/pb37.mjs') },
    { id: 'pb37-relative-whole-subject-v1', label: '逐层组成定语从句主语', load: () => import('./content/pb37.mjs') },
  ],
  PB38: [
    { id: 'pb38-subject-clause-v1', label: '主语从句', load: () => import('./content/pb38.mjs') },
    { id: 'pb38-formal-subject-it-v1', label: '形式主语 it', load: () => import('./content/pb38.mjs') },
    { id: 'pb38-postposed-clause-predicate-v1', label: '后置内容与谓语关系', load: () => import('./content/pb38.mjs') },
  ],
  PB39: [
    { id: 'pb39-that-predicative-clause-v1', label: 'that 从句作表语', load: () => import('./content/pb39.mjs') },
    { id: 'pb39-wh-predicative-clause-v1', label: 'wh 从句作表语', load: () => import('./content/pb39.mjs') },
    { id: 'pb39-object-predicative-contrast-v1', label: '同一从句作宾语或表语', load: () => import('./content/pb39.mjs') },
  ],
  PB40: [
    { id: 'pb40-noun-apposition-v1', label: '名词同位说明', load: () => import('./content/pb40.mjs') },
    { id: 'pb40-content-clause-after-noun-v1', label: '名词后的内容从句', load: () => import('./content/pb40.mjs') },
    { id: 'pb40-content-vs-relative-clause-v1', label: '内容从句与定语从句对比', load: () => import('./content/pb40.mjs') },
  ],
  PB41: [
    { id: 'pb41-time-clause-v1', label: '时间状语从句', load: () => import('./content/pb41.mjs') },
    { id: 'pb41-cause-clause-v1', label: '原因状语从句', load: () => import('./content/pb41.mjs') },
    { id: 'pb41-real-condition-v1', label: '现实条件从句', load: () => import('./content/pb41.mjs') },
    { id: 'pb41-time-sequence-review-v1', label: 'when / before 时间关系回访', load: () => import('./content/pb41.mjs') },
  ],
  PB42: [
    { id: 'pb42-purpose-clause-v1', label: '目的不定式', load: () => import('./content/pb42.mjs') },
    { id: 'pb42-result-clause-v1', label: 'so…that 结果结构', load: () => import('./content/pb42.mjs') },
    { id: 'pb42-concession-clause-v1', label: 'although 让步从句', load: () => import('./content/pb42.mjs') },
    { id: 'pb42-comparison-manner-clause-v1', label: '比较与方式从句', load: () => import('./content/pb42.mjs') },
    { id: 'pb42-enough-too-v1', label: 'enough / too 程度结构', load: () => import('./content/pb42.mjs') },
  ],
  PB43: [
    { id: 'pb43-coordination-v1', label: 'and 并列完整意思', load: () => import('./content/pb43.mjs') },
    { id: 'pb43-contrast-coordination-v1', label: 'but 转折并列', load: () => import('./content/pb43.mjs') },
    { id: 'pb43-licensed-omission-v1', label: '并列中的许可省略', load: () => import('./content/pb43.mjs') },
    { id: 'pb43-user-long-chain-v1', label: 'enough…to…but…not 长句', load: () => import('./content/pb43.mjs') },
  ],
  PB44: [
    { id: 'pb44-real-vs-unreal-condition-v1', label: '现实条件与假设对照', load: () => import('./content/pb44.mjs') },
    { id: 'pb44-present-unreal-condition-v1', label: '现在/将来非事实假设', load: () => import('./content/pb44.mjs') },
    { id: 'pb44-past-unreal-condition-v1', label: '过去非事实假设', load: () => import('./content/pb44.mjs') },
  ],
  PB45: [
    { id: 'pb45-direct-to-reported-v1', label: '直接表达与间接转述', load: () => import('./content/pb45.mjs') },
    { id: 'pb45-person-time-viewpoint-v1', label: '转述中的人称和时间视角', load: () => import('./content/pb45.mjs') },
    { id: 'pb45-future-in-past-v1', label: '过去视角的将来 would', load: () => import('./content/pb45.mjs') },
    { id: 'pb45-backshift-not-required-v1', label: '仍成立事实的时态选择', load: () => import('./content/pb45.mjs') },
  ],
  PB46: [
    { id: 'pb46-supplement-vs-restrictive-v1', label: '补充与限定信息', load: () => import('./content/pb46.mjs') },
    { id: 'pb46-relative-forms-v1', label: 'who / which 关系形式', load: () => import('./content/pb46.mjs') },
    { id: 'pb46-comma-scope-v1', label: '逗号与补充范围', load: () => import('./content/pb46.mjs') },
  ],
  PB47: [
    { id: 'pb47-object-focus-v1', label: 'it-cleft 突出宾语', load: () => import('./content/pb47.mjs') },
    { id: 'pb47-focus-contrast-v1', label: '切换信息焦点', load: () => import('./content/pb47.mjs') },
    { id: 'pb47-cleft-vs-ordinary-it-v1', label: '强调 it 与普通 it', load: () => import('./content/pb47.mjs') },
  ],
  PB48: [
    { id: 'pb48-so-neither-v1', label: 'so / neither 简短回应', load: () => import('./content/pb48.mjs') },
    { id: 'pb48-tag-questions-v1', label: '附加疑问句', load: () => import('./content/pb48.mjs') },
    { id: 'pb48-negative-inversion-v1', label: '否定词前置与倒装', load: () => import('./content/pb48.mjs') },
  ],
  PB49: [
    { id: 'pb49-double-object-paths-v1', label: '同义结构的两种路径', load: () => import('./content/pb49.mjs') },
    { id: 'pb49-clause-paths-v1', label: '原因结果的不同从句路径', load: () => import('./content/pb49.mjs') },
    { id: 'pb49-self-correct-v1', label: '自查主谓和动词搭配', load: () => import('./content/pb49.mjs') },
  ],
  PB50: [{ id: 'pb50-independent-delayed-retrieval-v1', label: '独立表达与延迟提取', load: () => import('./content/pb50.mjs') }],
};

export function getNode(id) {
  return nodes.find(node => node.id === id) ?? null;
}

export async function loadNodeLesson(id, lessonId) {
  if (!getNode(id)) throw new RangeError(`Unknown knowledge node: ${id}`);
  const courses = courseLoaders[id] ?? [];
  if (courses.length === 0) throw new Error(`${id} 的课程内容尚未接入预览。`);
  const course = lessonId ? courses.find(item => item.id === lessonId) : courses.length === 1 ? courses[0] : null;
  if (!course) throw new Error(lessonId ? '没有找到对应的预览课程。' : `${id} 有多门预览课，请先选择课程。`);
  const module = await course.load();
  return module.lesson ?? module.courses?.find(item => item.id === course.id);
}

export function getNodeLessonIds(id) {
  return (courseLoaders[id] ?? []).map(course => course.id);
}

export function getNodeLessonLabel(nodeId, lessonId) {
  return courseLoaders[nodeId]?.find(course => course.id === lessonId)?.label ?? lessonId;
}
