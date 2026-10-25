export const lesson = {
  schemaVersion: 'progressive-building/3', id: 'pb04-adjective-modifier-v1', version: 1,
  knowledgeNode: 'PB04', subgoalIds: ['PB04.a', 'PB04.b', 'PB04.c'], prerequisites: ['PB02'],
  title: '形容词定语：修饰谁、整组作什么',
  tokens: [
    { id: 'i', text: 'I', kind: 'word', gloss: '我', partOfSpeech: '代词' },
    { id: 'need', text: 'need', kind: 'word', gloss: '需要', partOfSpeech: '动词' },
    { id: 'a', text: 'a', kind: 'word', gloss: '一个', partOfSpeech: '限定词' },
    { id: 'red1', text: 'red', kind: 'word', gloss: '红色的', partOfSpeech: '形容词' },
    { id: 'bag', text: 'bag', kind: 'word', gloss: '包', partOfSpeech: '名词' },
    { id: 'red2', text: 'red', kind: 'word', gloss: '红色的', partOfSpeech: '形容词' },
    { id: 'cars', text: 'cars', kind: 'word', gloss: '汽车', partOfSpeech: '名词', lemma: 'car', inflection: 'plural' },
    { id: 'win', text: 'win', kind: 'word', gloss: '赢', partOfSpeech: '动词' },
    { id: 'move', text: 'move', kind: 'word', gloss: '移动', partOfSpeech: '动词' },
  ],
  steps: [
    {
      id: 'pb04-explain-modifier', activity: 'teach', phase: 'introduction', meaning: '我需要一个红色的包',
      targetTokenIds: ['i', 'need', 'a', 'red1', 'bag'], focusTokenIds: ['red1', 'bag'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['need']], level: 0 },
        { id: 'o', role: '宾语', segments: [['a', 'red1', 'bag']], level: 0, headIds: ['bag'] },
        { id: 'adj', role: '定语', segments: [['red1']], level: 1, parentId: 'o', headIds: ['red1'], modifiesIds: ['bag'] },
      ],
      explanation: '在 I need a red bag 里，red 说明 bag 是什么颜色，修饰 bag，所以 red 在这里作定语。a red bag 整组回答“我需要什么”，作宾语。',
      coverage: ['PB04.a', 'PB04.b'],
    },
    {
      id: 'pb04-identify-modifier', activity: 'range-identify', phase: 'practice', meaning: '定语',
      targetTokenIds: ['i', 'need', 'a', 'red1', 'bag'], bankTokenIds: ['i', 'need', 'a', 'red1', 'bag'], sourceTokenIds: ['i', 'need', 'a', 'red1', 'bag'], focusSyntaxId: 'adj', dependsOn: ['pb04-explain-modifier'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['need']], level: 0 },
        { id: 'o', role: '宾语', segments: [['a', 'red1', 'bag']], level: 0, headIds: ['bag'] },
        { id: 'adj', role: '定语', segments: [['red1']], level: 1, parentId: 'o', headIds: ['red1'], modifiesIds: ['bag'] },
      ], coverage: ['PB04.a'],
    },
    { id: 'pb04-local-phrase', activity: 'compose', phase: 'introduction', meaning: '红色的包', targetTokenIds: ['red1', 'bag'], bankTokenIds: ['red1', 'bag'], dependsOn: ['pb04-identify-modifier'], syntax: [{ id: 'adj', role: '定语', segments: [['red1']], level: 0, headIds: ['red1'], modifiesIds: ['bag'] }, { id: 'head', role: '中心名词', segments: [['bag']], level: 0 }], coverage: ['PB04.a'] },
    {
      id: 'pb04-build-object', activity: 'compose', phase: 'practice', meaning: '我需要一个红色的包',
      targetTokenIds: ['i', 'need', 'a', 'red1', 'bag'], bankTokenIds: ['i', 'need', 'a', 'red1', 'bag'], dependsOn: ['pb04-local-phrase'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['need']], level: 0 },
        { id: 'o', role: '宾语', segments: [['a', 'red1', 'bag']], level: 0, headIds: ['bag'] },
        { id: 'adj', role: '定语', segments: [['red1']], level: 1, parentId: 'o', headIds: ['red1'], modifiesIds: ['bag'] },
      ], coverage: ['PB04.b'],
    },
    {
      id: 'pb04-identify-object', activity: 'range-identify', phase: 'practice', meaning: '完整宾语',
      targetTokenIds: ['i', 'need', 'a', 'red1', 'bag'], bankTokenIds: ['i', 'need', 'a', 'red1', 'bag'], sourceTokenIds: ['i', 'need', 'a', 'red1', 'bag'], focusSyntaxId: 'o', dependsOn: ['pb04-build-object'],
      syntax: [
        { id: 's', role: '主语', segments: [['i']], level: 0 },
        { id: 'v', role: '谓语', segments: [['need']], level: 0 },
        { id: 'o', role: '宾语', segments: [['a', 'red1', 'bag']], level: 0, headIds: ['bag'] },
        { id: 'adj', role: '定语', segments: [['red1']], level: 1, parentId: 'o', headIds: ['red1'], modifiesIds: ['bag'] },
      ], coverage: ['PB04.b'],
    },
    { id: 'pb04-local-subject', activity: 'compose', phase: 'introduction', meaning: '红色汽车', targetTokenIds: ['red2', 'cars'], bankTokenIds: ['red2', 'cars'], dependsOn: ['pb04-identify-object'], syntax: [{ id: 'adj', role: '定语', segments: [['red2']], level: 0, headIds: ['red2'], modifiesIds: ['cars'] }, { id: 'head', role: '中心名词', segments: [['cars']], level: 0 }], coverage: ['PB04.c'] },
    {
      id: 'pb04-build-subject', activity: 'compose', phase: 'practice', meaning: '红色汽车赢了',
      targetTokenIds: ['red2', 'cars', 'win'], bankTokenIds: ['red2', 'cars', 'win'], dependsOn: ['pb04-local-subject'],
      syntax: [
        { id: 's', role: '主语', segments: [['red2', 'cars']], level: 0, headIds: ['cars'] },
        { id: 'adj', role: '定语', segments: [['red2']], level: 1, parentId: 's', headIds: ['red2'], modifiesIds: ['cars'] },
        { id: 'v', role: '谓语', segments: [['win']], level: 0 },
      ], coverage: ['PB04.c'],
    },
    {
      id: 'pb04-explain-subject', activity: 'teach', phase: 'introduction', meaning: '红色汽车赢了',
      targetTokenIds: ['red2', 'cars', 'win'], focusTokenIds: ['red2', 'cars'], dependsOn: ['pb04-build-subject'],
      syntax: [
        { id: 's', role: '主语', segments: [['red2', 'cars']], level: 0, headIds: ['cars'] },
        { id: 'adj', role: '定语', segments: [['red2']], level: 1, parentId: 's', headIds: ['red2'], modifiesIds: ['cars'] },
        { id: 'v', role: '谓语', segments: [['win']], level: 0 },
      ],
      explanation: '在 Red cars win 里，red 仍然修饰 cars；但 red cars 整组回答“谁赢”，所以整个名词短语在这句话中作主语。名词短语内部的定语，不会决定整组在句中的成分。',
      coverage: ['PB04.c'],
    },
    {
      id: 'pb04-identify-subject', activity: 'range-identify', phase: 'practice', meaning: '完整主语',
      targetTokenIds: ['red2', 'cars', 'win'], bankTokenIds: ['red2', 'cars', 'win'], sourceTokenIds: ['red2', 'cars', 'win'], focusSyntaxId: 's', dependsOn: ['pb04-explain-subject'],
      syntax: [
        { id: 's', role: '主语', segments: [['red2', 'cars']], level: 0, headIds: ['cars'] },
        { id: 'adj', role: '定语', segments: [['red2']], level: 1, parentId: 's', headIds: ['red2'], modifiesIds: ['cars'] },
        { id: 'v', role: '谓语', segments: [['win']], level: 0 },
      ], coverage: ['PB04.c'],
    },
    {
      id: 'pb04-transfer', activity: 'independent-output', phase: 'transfer', meaning: '红色汽车移动',
      targetTokenIds: ['red2', 'cars', 'move'], dependsOn: ['pb04-identify-subject'], acceptedAnswers: ['Red cars move.'], revealTarget: false, hideHistory: true,
      syntax: [{ id: 's', role: '主语', segments: [['red2', 'cars']], level: 0, headIds: ['cars'] }, { id: 'adj', role: '定语', segments: [['red2']], level: 1, parentId: 's', headIds: ['red2'], modifiesIds: ['cars'] }, { id: 'v', role: '谓语', segments: [['move']], level: 0 }],
      coverage: ['PB04.a', 'PB04.b', 'PB04.c'],
    },
  ],
  review: { intervalsDays: [1, 3], stepIds: ['pb04-transfer'] },
};
