const syntax = (id, role, ids, level = 0) => ({ id, role, segments: [ids], level });
const make = ({ id, title, words, modalTokenId, verbTokenId, meaning, explanation, transfer, transferAnswer, review, coverage, permissionWords }) => {
  const tokens = words.map(([id, text, gloss, partOfSpeech = '词语']) => ({ id, text, kind: 'word', gloss, partOfSpeech }));
  const sentenceIds = words.map(([id]) => id);
  const modalIndex = sentenceIds.indexOf(modalTokenId);
  const subjectId = sentenceIds[modalIndex === 0 ? 1 : 0];
  const verbId = verbTokenId ?? sentenceIds[modalIndex + 1];
  const sentenceSyntax = [syntax('m', '情态动词', [modalTokenId]), syntax('s', '主语', [subjectId]), syntax('v', '情态动词后的动词原形', [verbId]), ...sentenceIds.filter(tokenId => ![modalTokenId, subjectId, verbId].includes(tokenId)).map((tokenId, index) => syntax(`x${index}`, '动作补充信息', [tokenId]))];
  const transferIds = transfer.map(([id]) => id);
  const transferTokens = transfer.map(([id, text, gloss, partOfSpeech = '词语']) => ({ id, text, kind: 'word', gloss, partOfSpeech }));
  const permissionIds = permissionWords?.map(([id]) => id) ?? [];
  const permissionTokens = permissionWords?.map(([id, text, gloss, partOfSpeech = '词语']) => ({ id, text, kind: 'word', gloss, partOfSpeech })) ?? [];
  const steps = [
    { id: `${id}-teach`, activity: 'teach', phase: 'introduction', meaning, targetTokenIds: sentenceIds, focusTokenIds: sentenceIds, syntax: sentenceSyntax, explanation, coverage },
    { id: `${id}-local-modal`, activity: 'compose', phase: 'practice', meaning: words.find(([tokenId]) => tokenId === modalTokenId)[2], targetTokenIds: [modalTokenId], bankTokenIds: [modalTokenId], dependsOn: [`${id}-teach`], syntax: [syntax('m', '情态动词', [modalTokenId])], coverage },
    { id: `${id}-build`, activity: 'compose', phase: 'practice', meaning, targetTokenIds: sentenceIds, bankTokenIds: sentenceIds, dependsOn: [`${id}-local-modal`], syntax: sentenceSyntax, coverage },
  ];
  if (permissionWords) steps.push({ id: `${id}-permission`, activity: 'compose', phase: 'practice', meaning: '征求对方许可', targetTokenIds: permissionIds, bankTokenIds: permissionIds, dependsOn: [`${id}-build`], syntax: [syntax('m', '情态动词（许可）', [permissionIds[0]]), syntax('s', '主语', [permissionIds[1]]), syntax('v', '谓语动词原形', [permissionIds[2]]), syntax('o', '宾语', permissionIds.slice(3))], coverage });
  steps.push({ id: `${id}-transfer`, activity: 'independent-output', phase: 'transfer', meaning: review, targetTokenIds: transferIds, acceptedAnswers: [transferAnswer], revealTarget: false, hideHistory: true, dependsOn: [`${id}-${permissionWords ? 'permission' : 'build'}`], coverage });
  return {
    schemaVersion: 'progressive-building/3', id, version: 1, knowledgeNode: 'PB18', subgoalIds: coverage, prerequisites: ['PB01', 'PB16', 'PB17'], title,
    tokens: [...tokens, ...permissionTokens, ...transferTokens], review: { intervalsDays: [1, 3], stepIds: [`${id}-transfer`] }, steps,
  };
};

export const courses = [
  make({ id: 'pb18-ability-permission-v1', title: 'can：能力与许可', words: [['i', 'I', '我', '代词'], ['can', 'can', '能', '情态动词'], ['swim', 'swim', '游泳', '动词']], modalTokenId: 'can', meaning: '我会游泳', explanation: 'I can swim 中，can 表示能力；can 后直接接动词原形 swim。Can I use your phone? 中，同一个 can 是征求许可。判断含义要看说话目的和语境，而不是给 can 固定贴一个中文标签。', permissionWords: [['can-permission', 'Can', '可以', '情态动词'], ['i-permission', 'I', '我', '代词'], ['use', 'use', '使用', '动词原形'], ['your', 'your', '你的', '限定词'], ['phone', 'phone', '手机', '名词']], transfer: [['can-borrow', 'Can', '可以', '情态动词'], ['i-borrow', 'I', '我', '代词'], ['borrow', 'borrow', '借用', '动词原形'], ['a', 'a', '一支', '限定词'], ['pen', 'pen', '笔', '名词']], transferAnswer: 'Can I borrow a pen?', review: '我可以借一支笔吗', coverage: ['PB18.a'] }),
  make({ id: 'pb18-request-v1', title: 'can：礼貌请求', words: [['can', 'Can', '可以', '情态动词'], ['you', 'you', '你', '代词'], ['help', 'help', '帮助', '动词原形'], ['me', 'me', '我', '代词']], modalTokenId: 'can', verbTokenId: 'help', meaning: '你可以帮我吗', explanation: 'Can you help me? 用疑问句形式提出请求。can 放在主语 you 前，help 保持原形；同一个 can 在这里不是询问能力，而是请求对方帮忙。', transfer: [['can2', 'Can', '可以', '情态动词'], ['you2', 'you', '你', '代词'], ['wait', 'wait', '等', '动词原形']], transferAnswer: 'Can you wait?', review: '你可以等一下吗', coverage: ['PB18.b'] }),
  make({ id: 'pb18-obligation-advice-v1', title: 'must 与 should：义务和建议', words: [['you', 'You', '你', '代词'], ['must-modal', 'must', '必须', '情态动词'], ['wear', 'wear', '戴', '动词原形'], ['a', 'a', '一条', '限定词'], ['seat', 'seat', '座位', '名词'], ['belt', 'belt', '带子', '名词']], modalTokenId: 'must-modal', meaning: '你必须系安全带', explanation: 'You must wear a seat belt 中，must 表示较强义务；should 常表示建议，语气较轻。两者后面都直接接动词原形，不能再加 to，也不随主语变形。', transfer: [['should-s', 'You', '你', '代词'], ['should', 'should', '应该', '情态动词'], ['rest', 'rest', '休息', '动词原形']], transferAnswer: 'You should rest.', review: '你应该休息', coverage: ['PB18.c'] }),
  make({ id: 'pb18-deduction-v1', title: 'must：根据线索推断', words: [['she', 'She', '她', '代词'], ['must-modal', 'must', '一定', '情态动词'], ['be', 'be', '是', '动词原形'], ['at', 'at', '在', '介词'], ['home', 'home', '家', '名词']], modalTokenId: 'must-modal', meaning: '她一定在家', explanation: 'She must be at home 中，must 不是“必须”，而是说话者根据线索作出较有把握的推断。must 后仍用动词原形 be；意义由语境决定。', transfer: [['must2-s', 'He', '他', '代词'], ['must2', 'must', '一定', '情态动词'], ['be2', 'be', '是', '动词原形'], ['tired', 'tired', '累的', '形容词']], transferAnswer: 'He must be tired.', review: '他一定累了', coverage: ['PB18.d'] }),
];
