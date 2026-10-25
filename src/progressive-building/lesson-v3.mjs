// Content identities and teaching order are independent of the page renderer.
export const lesson = {
  schemaVersion: 'progressive-building/2',
  id: 'want-to-learn-english-preview',
  title: '我想和你一起学英语',
  words: {
    i: { en: 'I', zh: '我', part: '代词', role: '主语（S）', component: '主语' },
    want: { en: 'want', zh: '想要', part: '动词', role: '谓语（V）', component: '谓语' },
    to: { en: 'to', zh: '不定式标记', part: '不定式标记', role: '与动词原形构成 to do', component: '不定式标记' },
    learn: { en: 'learn', zh: '学习', part: '动词', role: '不定式中的动作', component: '动作' },
    english: { en: 'English', zh: '英语', part: '名词', role: 'learn 的宾语（O）', component: '宾语' },
    with: { en: 'with', zh: '和；与', part: '介词', role: '与 you 构成介词短语', component: '介词' },
    you: { en: 'you', zh: '你', part: '代词', role: '介词 with 的宾语', component: '介词宾语' },
    every: { en: 'every', zh: '每；每个', part: '限定词', role: '限定 day', component: '限定词' },
    day: { en: 'day', zh: '天', part: '名词', role: '与 every 构成时间表达', component: '时间名词' },
  },
  groups: [
    {
      id: 'core', wordIds: ['i', 'want'], meaning: '我想要',
      component: '主语 + 谓语',
      explanation: 'I 是主语（谁）；want 是谓语（想要）。',
    },
    {
      id: 'action', wordIds: ['to', 'learn', 'english'], meaning: '学英语',
      component: 'want 的宾语（to do 不定式）',
      explanation: '说明想要做什么；learn 是动作，English 是 learn 的宾语（O）。',
    },
    {
      id: 'companion', wordIds: ['with', 'you'], meaning: '和你一起',
      component: '伴随状语',
      explanation: '说明和谁一起学；with you 是介词短语。',
    },
    {
      id: 'frequency', wordIds: ['every', 'day'], meaning: '每天',
      component: '时间状语',
      explanation: '说明学习发生的时间和频率。',
    },
  ],
  sentence: {
    wordIds: ['i', 'want', 'to', 'learn', 'english', 'with', 'you', 'every', 'day'],
    zh: '我想每天和你一起学英语。',
  },
  sequence: [
    { type: 'compose', groupIds: ['core'], meaning: '我想要' },
    { type: 'compose', groupIds: ['action'], meaning: '学英语' },
    { type: 'compose', groupIds: ['core', 'action'], meaning: '我想要学英语' },
    { type: 'compose', groupIds: ['core', 'action', 'companion'], meaning: '我想要和你学英语' },
    { type: 'compose', groupIds: ['core', 'action', 'companion', 'frequency'], meaning: '我想要每天和你学英语' },
  ],
};

export function wordIdsForGroups(course, groupIds) {
  return groupIds.flatMap(id => course.groups.find(group => group.id === id)?.wordIds ?? []);
}

export function groupText(course, groupId) {
  const group = course.groups.find(item => item.id === groupId);
  return group.wordIds.map(id => course.words[id].en).join(' ');
}

export function sentenceText(course) {
  return `${course.sentence.wordIds.map(id => course.words[id].en).join(' ')}.`;
}

export function wordForShortcut(course, groupIds, selectedIds, key) {
  return wordIdsForGroups(course, groupIds).find(id =>
    !selectedIds.includes(id) && course.words[id].en[0].toLowerCase() === key.toLowerCase(),
  ) ?? null;
}

export function validateLesson(course) {
  if (course.schemaVersion !== 'progressive-building/2') throw new Error('Unsupported lesson schema');
  const wordIds = Object.keys(course.words);
  if (wordIds.some(id => !/^[a-z]+$/i.test(course.words[id].en) || !course.words[id].zh || !course.words[id].part || !course.words[id].role || !course.words[id].component)) {
    throw new Error('Each selectable word needs one-word text, meaning, and grammar role');
  }

  const groupIds = new Set();
  const groupedWords = [];
  for (const group of course.groups) {
    if (groupIds.has(group.id) || !group.wordIds.length || !group.meaning || !group.component || !group.explanation) {
      throw new Error(`Invalid semantic group: ${group.id}`);
    }
    groupIds.add(group.id);
    for (const id of group.wordIds) {
      if (!course.words[id] || groupedWords.includes(id)) throw new Error(`Invalid word in semantic group: ${id}`);
      groupedWords.push(id);
    }
  }
  if (groupedWords.join('|') !== wordIds.join('|')) throw new Error('Every word must belong to exactly one ordered semantic group');
  if (wordIdsForGroups(course, course.groups.map(group => group.id)).join('|') !== course.sentence.wordIds.join('|')) {
    throw new Error('Sentence words do not match semantic groups');
  }

  const introduced = new Set();
  for (const step of course.sequence) {
    if (step.type !== 'compose' || !step.meaning || !step.groupIds.length) throw new Error('Compose activity needs a meaning and semantic groups');
    if (new Set(step.groupIds).size !== step.groupIds.length || step.groupIds.some(id => !groupIds.has(id))) {
      throw new Error('Activity references invalid semantic groups');
    }
    if (step.groupIds.filter(id => !introduced.has(id)).length > 1) throw new Error('Introduce at most one new semantic group per activity');
    step.groupIds.forEach(id => introduced.add(id));
  }
  const finalStep = course.sequence.at(-1);
  if (!finalStep || finalStep.groupIds.join('|') !== course.groups.map(group => group.id).join('|')) {
    throw new Error('Lesson must end by composing the complete sentence');
  }
}
