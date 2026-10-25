import { lesson as original, wordIdsForGroups } from './lesson-v3.mjs?v=20261024-5';
import { foundations } from './foundations-v3.mjs?v=20261025-22';
import { mixedReview } from './mixed-review-v3.mjs?v=20261024-1';
import { nounPhrase } from './noun-phrase-v3.mjs?v=20261024-2';
import { quantity } from './quantity-v3.mjs?v=20261024-1';

// Ranges are half-open token positions in this step, not permanent word roles.
const span = (start, end, label, level = 0) => ({ start, end, label, level });
const first = {
  ...original, label: '课程一 · 表达扩展',
  sequence: original.sequence.map((step, index) => ({
    ...step, wordIds: wordIdsForGroups(original, step.groupIds),
    dependsOn: index === 0 ? [] : index === 1 ? [] : [index - 1, ...(index === 2 ? [0] : [])],
    annotations: index === 0 ? [span(0, 1, '主语'), span(1, 2, '谓语')]
      : index === 1 ? [span(0, 3, '不定式短语')]
      : [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 5, '宾语（不定式）'),
        ...(index >= 3 ? [span(5, 7, '伴随状语')] : []),
        ...(index >= 4 ? [span(7, 9, '时间状语')] : [])],
  })),
};

const bookWords = {
  subjectThe: { en: 'The', zh: '那', part: '冠词' },
  book: { en: 'book', zh: '书', part: '名词' },
  on: { en: 'on', zh: '在……上', part: '介词' },
  deskThe: { en: 'the', zh: '那', part: '冠词' },
  desk: { en: 'desk', zh: '桌子', part: '名词' },
  is: { en: 'is', zh: '是', part: '动词' },
  mine: { en: 'mine', zh: '我的', part: '代词' },
};
const bookSubject = ['subjectThe', 'book', 'on', 'deskThe', 'desk'];
const bookAnnotations = [span(0, 2, '主语中心'), span(2, 5, '后置定语'), span(0, 5, '主语', 1)];
const book = {
  id: 'book-on-desk-preview', label: '课程二 · 主语里的修饰', words: bookWords,
  sentence: { wordIds: [...bookSubject, 'is', 'mine'], zh: '桌子上的那本书是我的。' },
  sequence: [
    { meaning: '那本书', wordIds: ['subjectThe', 'book'], dependsOn: [], annotations: [span(0, 2, '名词短语')] },
    { meaning: '在桌子上', wordIds: ['on', 'deskThe', 'desk'], dependsOn: [], annotations: [span(0, 3, '介词短语')] },
    { meaning: '桌子上的那本书', wordIds: bookSubject, dependsOn: [0, 1], annotations: bookAnnotations },
    { meaning: '是我的', wordIds: ['is', 'mine'], dependsOn: [], annotations: [span(0, 1, '系动词'), span(1, 2, '表语')] },
    { meaning: '桌子上的那本书是我的', wordIds: [...bookSubject, 'is', 'mine'], dependsOn: [2, 3], annotations: [...bookAnnotations, span(5, 6, '系动词'), span(6, 7, '表语')] },
  ],
};

const questionWords = {
  can: { en: 'Can', zh: '能', part: '情态动词' },
  you: { en: 'you', zh: '你', part: '代词' },
  help: { en: 'help', zh: '帮助', part: '动词' },
  me: { en: 'me', zh: '我', part: '代词' },
  carry: { en: 'carry', zh: '搬', part: '动词' },
  this: { en: 'this', zh: '这个', part: '限定词' },
  box: { en: 'box', zh: '箱子', part: '名词' },
  upstairs: { en: 'upstairs', zh: '上楼', part: '副词' },
};
const request = ['can', 'you', 'help', 'me'];
const action = ['carry', 'this', 'box'];
const requestAnnotations = [span(0, 1, '情态动词'), span(1, 2, '主语'), span(2, 3, '谓语动词'), span(3, 4, '宾语')];
const question = {
  id: 'help-carry-box-preview', label: '课程三 · 请求帮助', words: questionWords,
  sentence: { wordIds: [...request, ...action, 'upstairs'], zh: '你能帮我把这个箱子搬上楼吗？' },
  sequence: [
    { meaning: '你能帮我吗？', wordIds: request, dependsOn: [], annotations: requestAnnotations },
    { meaning: '搬这个箱子', wordIds: action, dependsOn: [], annotations: [span(0, 1, '动作'), span(1, 3, '宾语')] },
    { meaning: '你能帮我搬这个箱子吗？', wordIds: [...request, ...action], dependsOn: [0, 1], annotations: [...requestAnnotations, span(4, 5, '动作'), span(5, 7, '宾语'), span(4, 7, '宾语补足语', 1)] },
    { meaning: '你能帮我把这个箱子搬上楼吗？', wordIds: [...request, ...action, 'upstairs'], dependsOn: [2], annotations: [...requestAnnotations, span(4, 5, '动作'), span(5, 7, '宾语'), span(7, 8, '地点状语'), span(4, 8, '宾语补足语', 1)] },
  ],
};

export const lessons = [...foundations, mixedReview, nounPhrase, quantity, first, book, question];

export function normalizeAnswer(value) {
  return value.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[.!?。！？]+$/g, '').trim().replace(/\s+/g, ' ');
}

export function matchesTransfer(step, answer) {
  return step.answers.some(value => normalizeAnswer(value) === normalizeAnswer(answer));
}

export function validatePreviewLesson(course) {
  if (!course.id || !course.sequence.length) throw new Error('Missing preview lesson');
  course.sequence.forEach((step, index) => {
    if (step.type && !['compose', 'transfer', 'teach', 'replace', 'identify', 'classify', 'insert-modifier', 'quantity'].includes(step.type)) throw new Error('Unknown activity type');
    if (step.type === 'transfer') {
      if (index !== course.sequence.length - 1 || !step.answers?.length) throw new Error('Transfer must be last and have reviewed answers');
      const learned = new Set(course.sequence.slice(0, index).flatMap(item => item.wordIds));
      if (step.wordIds.some(id => !learned.has(id))) throw new Error('Transfer contains unlearned vocabulary');
    }
    if (!step.meaning || !step.wordIds.length || new Set(step.wordIds).size !== step.wordIds.length) throw new Error('Invalid step tokens');
    if (step.wordIds.some(id => !course.words[id] || !/^[a-z]+$/i.test(course.words[id].en))) throw new Error('Unknown or non-word token');
    if (step.type === 'teach' && (!step.notes?.length || step.notes.some(note => !step.wordIds.includes(note.wordId) || !note.term || !note.text))) throw new Error('Teaching needs word-bound explanations');
    if (step.type === 'teach') step.notes.forEach(note => {
      if (!note.focusWordIds) return;
      const start = step.wordIds.indexOf(note.focusWordIds[0]);
      if (!note.focusWordIds.length || !note.focusWordIds.includes(note.wordId) || start < 0 || !note.focusWordIds.every((id, offset) => step.wordIds[start + offset] === id)) throw new Error('Teaching focus must be one contiguous phrase');
    });
    if (step.type === 'replace') {
      if (!step.sourceWordIds?.length || step.sourceWordIds.some(id => !course.words[id]) || !Number.isInteger(step.replaceIndex) || step.replaceIndex < 0 || step.replaceIndex >= step.sourceWordIds.length || !course.words[step.replacement] || !step.prompt || !step.wrongFeedback || !step.successFeedback) throw new Error('Invalid component replacement');
      const target = [...step.sourceWordIds]; target[step.replaceIndex] = step.replacement;
      if (target.join('|') !== step.wordIds.join('|') || step.sourceWordIds[step.replaceIndex] === step.replacement) throw new Error('Replacement must change exactly the specified component');
    }
    if (step.type === 'insert-modifier') {
      if (!step.sourceWordIds?.includes(step.headWordId) || step.sourceWordIds.some(id => !course.words[id]) || !course.words[step.modifierWordId] || !Number.isInteger(step.insertIndex) || step.insertIndex < 0 || step.insertIndex > step.sourceWordIds.length || !step.prompt || !step.wrongFeedback || !step.successFeedback) throw new Error('Invalid modifier insertion');
      const target = [...step.sourceWordIds]; target.splice(step.insertIndex, 0, step.modifierWordId);
      if (target.join('|') !== step.wordIds.join('|')) throw new Error('Modifier insertion must preserve the original phrase');
    }
    if (step.type === 'quantity') {
      if (!step.sourceWordIds?.length || step.sourceWordIds.some(id => !course.words[id]) || !step.changes?.length || !step.successFeedback || new Set(step.changes.map(change => change.index)).size !== step.changes.length) throw new Error('Invalid quantity changes');
      const target = [...step.sourceWordIds];
      for (const change of step.changes) {
        if (!Number.isInteger(change.index) || change.index < 0 || change.index >= target.length || !course.words[change.to] || !change.prompt || !change.explanation || !change.wrongFeedback || !change.options?.some(item => item.wordId === change.to) || new Set(change.options.map(item => item.key)).size !== change.options.length || change.options.some(item => !course.words[item.wordId] || !/^[a-z]$/.test(item.key) || !course.words[item.wordId].en.toLowerCase().includes(item.key))) throw new Error('Invalid quantity option or position');
        target[change.index] = change.to;
      }
      if (target.join('|') !== step.wordIds.join('|')) throw new Error('Quantity changes must produce the complete target');
    }
    if (step.type === 'identify' && (!step.checks?.length || step.checks.some(check => !step.wordIds.includes(check.wordId) || !check.prompt || !check.feedback || !check.wrongFeedback))) throw new Error('Identification needs reviewed checks');
    if (step.type === 'classify') {
      if (!step.wordIds.includes(step.focusWordId) || !step.prompt || !step.options?.length || new Set(step.options.map(item => item.id)).size !== step.options.length || new Set(step.options.map(item => item.key)).size !== step.options.length || step.options.some(item => !/^[a-z]$/.test(item.key) || !item.label || !item.feedback) || !step.options.some(item => item.id === step.answer)) throw new Error('Invalid contextual classification');
    }
    if (step.type === 'transfer') {
      if (step.answers.some(value => typeof value !== 'string' || !value.trim())) throw new Error('Invalid reviewed transfer answer');
      if (!matchesTransfer(step, step.wordIds.map(id => course.words[id].en).join(' '))) throw new Error('Transfer reference must be an accepted answer');
    }
    if (step.dependsOn.some(value => !Number.isInteger(value) || value < 0 || value >= index)) throw new Error('Invalid step dependency');
    for (const annotation of step.annotations) {
      if (!Number.isInteger(annotation.start) || !Number.isInteger(annotation.end) || annotation.start < 0 || annotation.end > step.wordIds.length || annotation.start >= annotation.end || !annotation.label || !Number.isInteger(annotation.level) || annotation.level < 0) throw new Error('Invalid syntax range');
    }
    step.annotations.forEach((a, position) => step.annotations.slice(position + 1).forEach(b => {
      if (a.level === b.level && a.start < b.end && b.start < a.end) throw new Error('Overlapping syntax labels on same row');
    }));
  });
  const finalCompose = course.sequence.findLast(step => !step.type || ['compose', 'replace'].includes(step.type));
  if (!finalCompose || finalCompose.wordIds.join('|') !== course.sentence.wordIds.join('|')) throw new Error('Final compose step must compose target sentence');
  return course;
}

// Labels only appear when the whole annotated range has been selected in order.
export function visibleAnnotations(step, selected) {
  return step.annotations.flatMap(annotation => {
    const ids = step.wordIds.slice(annotation.start, annotation.end);
    const start = selected.indexOf(ids[0]);
    return start >= 0 && ids.every((id, offset) => selected[start + offset] === id)
      ? [{ ...annotation, start, end: start + ids.length }] : [];
  });
}
