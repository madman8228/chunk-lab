import assert from 'node:assert/strict';
import { lessons, validatePreviewLesson, visibleAnnotations, matchesTransfer } from './lessons-v3.mjs';

lessons.forEach(validatePreviewLesson);
assert.deepEqual(lessons.filter(course => ['want-to-learn-english-preview', 'book-on-desk-preview', 'help-carry-box-preview'].includes(course.id)).map(course => course.sequence.map(step => step.wordIds.length)), [[2, 3, 5, 7, 9], [2, 3, 5, 2, 7], [4, 3, 7, 8]]);
assert.equal(lessons.length, 9);
const quantity = lessons.find(course => course.knowledgeNode === 'PB05');
assert.deepEqual(quantity.sequence.filter(step => step.type === 'quantity').map(step => step.wordIds), [['two', 'bags'], ['two', 'books'], ['i', 'need', 'a', 'book']]);
const invalidQuantity = structuredClone(quantity);
invalidQuantity.sequence[2].changes.pop();
assert.throws(() => validatePreviewLesson(invalidQuantity), /complete target/);
for (const course of lessons.slice(0, 3)) {
  const introduction = course.sequence.findIndex(step => step.type === 'teach');
  assert.ok(introduction >= 0 && introduction < course.sequence.findIndex(step => ['replace', 'identify'].includes(step.type)));
}
const nounPhrase = lessons.find(course => course.knowledgeNode === 'PB04');
assert.deepEqual(nounPhrase.sequence[4].wordIds, ['a', 'red', 'bag']);
const objectStep = nounPhrase.sequence[5];
assert.ok(!visibleAnnotations(objectStep, ['i', 'need', 'a', 'red']).some(item => item.label === '宾语'));
assert.deepEqual(visibleAnnotations(objectStep, objectStep.wordIds).find(item => item.label === '宾语'), { start: 2, end: 5, label: '宾语', level: 1 });
const invalidFocus = structuredClone(nounPhrase);
invalidFocus.sequence[6].notes[0].focusWordIds = ['a', 'bag'];
assert.throws(() => validatePreviewLesson(invalidFocus), /contiguous phrase/);
const mixed = lessons.find(course => course.review);
assert.deepEqual(new Set(mixed.sequence.filter(step => step.type === 'classify').map(step => step.answer)), new Set(['subject', 'predicate', 'object', 'predicative', 'link']));
const invalidClassification = structuredClone(mixed);
invalidClassification.sequence[0].answer = 'missing';
assert.throws(() => validatePreviewLesson(invalidClassification), /classification/);
const book = lessons.find(course => course.id === 'book-on-desk-preview');
const original = lessons.find(course => course.id === 'want-to-learn-english-preview');
for (const course of lessons.slice(1, 3)) {
  const transfer = course.sequence.at(-1);
  assert.equal(transfer.type, 'transfer');
  assert.ok(matchesTransfer(transfer, transfer.answers[0].toUpperCase()));
  assert.ok(!matchesTransfer(transfer, ''));
  assert.ok(!course.sequence.slice(0, -1).some(step => step.wordIds.join('|') === transfer.wordIds.join('|')));
}
assert.ok(matchesTransfer(lessons[2].sequence.at(-1), '  YOU’RE ready!  '));
assert.deepEqual(lessons[0].sequence.filter(step => step.type).map(step => step.type), ['teach', 'replace', 'replace', 'identify']);
const invalidReplacement = structuredClone(lessons[0]);
invalidReplacement.sequence[5].replaceIndex = 1;
assert.throws(() => validatePreviewLesson(invalidReplacement), /specified component/);
assert.equal(book.words.subjectThe.en.toLowerCase(), book.words.deskThe.en);
assert.notEqual(book.sequence.at(-1).wordIds.indexOf('subjectThe'), book.sequence.at(-1).wordIds.indexOf('deskThe'));
assert.equal(visibleAnnotations(book.sequence[1], ['on']).length, 0);
assert.equal(visibleAnnotations(book.sequence[1], ['desk', 'deskThe', 'on']).length, 0);
assert.deepEqual(visibleAnnotations(book.sequence[1], ['on', 'deskThe', 'desk']).map(item => item.label), ['介词短语']);
assert.deepEqual(visibleAnnotations(book.sequence.at(-1), book.sentence.wordIds).find(item => item.label === '后置定语'), { start: 2, end: 5, label: '后置定语', level: 0 });
const invalid = structuredClone(book);
invalid.sequence[0].annotations[0].end = 3;
assert.throws(() => validatePreviewLesson(invalid), /syntax range/);

// Minimal DOM checks exercise rendering and event handlers; not browser layout.
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.style = {};
    this.hidden = false; this.disabled = false; this.className = ''; this.textContent = '';
    this.classList = { add: value => { this.className += ` ${value}`; } };
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute() {}
  scrollIntoView() {}
  focus() {}
  click() { if (!this.disabled) this.onclick?.(); }
}
const ids = Object.fromEntries(['trail', 'activity', 'feedback', 'progress', 'next', 'lesson-select', 'review-entry'].map(id => [id, new Element(id === 'lesson-select' ? 'select' : 'div')]));
const bank = () => ids.activity.children.find(item => item.className === 'bank');
const listeners = {};
globalThis.document = {
  getElementById: id => ids[id], createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }),
  querySelector: selector => {
    if (selector.includes('data-grammar-key')) {
      const visit = element => element.children.flatMap(child => [child, ...(child.children ? visit(child) : [])]);
      return visit(ids.activity).find(item => item.tagName === 'BUTTON' && item.dataset.grammarKey && selector.includes(`"${item.dataset.grammarKey}"`));
    }
    return bank()?.children.find(item => selector.includes(`"${item.dataset.wordId}"`));
  },
};
globalThis.window = { addEventListener: (name, handler) => { listeners[name] = handler; } };
await import('./view-v3.mjs');
const key = value => listeners.keydown({ key: value, target: { tagName: 'BODY' }, preventDefault() {} });
const chooseCourse = course => ids['lesson-select'].onchange({ target: { value: course.id } });
assert.equal(ids['lesson-select'].children.filter(item => item.tagName === 'OPTION').length, 9);
assert.equal(ids['lesson-select'].children.filter(item => item.tagName === 'OPTGROUP').length, 10);
chooseCourse(original);

key('w'); key('i');
assert.equal(ids.feedback.textContent, '顺序不对');
assert.equal(ids.next.hidden, true);
key('Backspace'); key('Backspace'); key('i');
chooseCourse(book); chooseCourse(original);
assert.equal(bank().children.find(item => item.dataset.wordId === 'i').disabled, true);
key('Backspace');

for (const course of lessons) {
  chooseCourse(course);
  for (const [index, step] of course.sequence.entries()) {
    if (step.type === 'quantity') {
      assert.equal(ids.trail.hidden, true);
      assert.equal(bank(), undefined);
      const progress = ids.progress.textContent;
      for (const [changeIndex, change] of step.changes.entries()) {
        key('Enter'); assert.equal(ids.progress.textContent, progress);
        const wrong = change.options.find(item => item.wordId !== change.to);
        key(wrong.key);
        assert.equal(ids.next.hidden, true);
        assert.equal(ids.feedback.textContent, change.wrongFeedback);
        chooseCourse(book); chooseCourse(course);
        assert.equal(ids.feedback.textContent, change.wrongFeedback);
        assert.ok(ids.activity.children.some(item => item.textContent === change.prompt));
        key(change.options.find(item => item.wordId === change.to).key);
        if (changeIndex < step.changes.length - 1) {
          assert.equal(ids.next.hidden, true);
          assert.ok(ids.activity.children.some(item => item.textContent === step.changes[changeIndex + 1].prompt));
        }
      }
      assert.equal(ids.next.hidden, false);
      const result = ids.activity.children.find(item => item.className.includes('semantic-words')).children[0];
      assert.deepEqual(result.children.filter(item => item.tagName === 'STRONG').map(item => item.textContent), step.wordIds.map(id => course.words[id].en));
      assert.ok(ids.activity.children.some(item => item.textContent === step.successFeedback));
      key('Enter'); continue;
    }
    if (step.type === 'classify') {
      assert.equal(ids.trail.hidden, true);
      assert.equal(ids.trail.children.length, 0);
      assert.equal(bank(), undefined);
      assert.ok(!ids.activity.children.some(item => item.className.includes('semantic-words')));
      const progress = ids.progress.textContent;
      key('Enter'); assert.equal(ids.progress.textContent, progress);
      const wrong = step.options.find(item => item.id !== step.answer);
      key(wrong.key);
      assert.equal(ids.next.hidden, true);
      assert.equal(ids.feedback.textContent, wrong.feedback);
      chooseCourse(book); chooseCourse(course);
      assert.equal(ids.feedback.textContent, wrong.feedback);
      const answer = step.options.find(item => item.id === step.answer);
      key(answer.key);
      assert.equal(ids.next.hidden, false);
      assert.equal(ids.feedback.textContent, answer.feedback);
      key('Enter'); continue;
    }
    if (step.type === 'teach') {
      assert.equal(ids.next.hidden, false);
      assert.equal(bank(), undefined);
      assert.equal(ids.activity.children.filter(item => item.className === 'grammar-note').length, step.notes.length);
      if (course === nounPhrase) {
        const note = ids.activity.children.filter(item => item.className === 'grammar-note')[0];
        assert.deepEqual(note.children.find(item => item.className === 'grammar-example').children.filter(item => item.tagName === 'MARK').map(item => item.textContent), ['a', 'red', 'bag']);
      }
      key('Enter'); continue;
    }
    if (['replace', 'identify', 'insert-modifier'].includes(step.type)) {
      assert.equal(ids.trail.hidden, true);
      assert.equal(bank(), undefined);
      assert.equal(ids.next.hidden, true);
      const progress = ids.progress.textContent;
      key('Enter'); assert.equal(ids.progress.textContent, progress);
      if (['replace', 'insert-modifier'].includes(step.type)) {
        const inserting = step.type === 'insert-modifier';
        const correctIndex = inserting ? step.sourceWordIds.indexOf(step.headWordId) : step.replaceIndex;
        const wrong = step.sourceWordIds[correctIndex === 0 ? 1 : 0];
        key(course.words[wrong].en[0]);
        assert.equal(ids.feedback.textContent, step.wrongFeedback);
        assert.equal(ids.next.hidden, true);
        assert.ok(!ids.activity.children.some(item => item.className === 'grammar-choices'));
        key(course.words[step.sourceWordIds[correctIndex]].en[0]);
        chooseCourse(book); chooseCourse(course);
        assert.ok(ids.activity.children.some(item => item.className === 'grammar-choices'));
        key(course.words[inserting ? step.modifierWordId : step.replacement].en[0]);
        if (inserting) {
          assert.ok(ids.activity.children.some(item => item.className === 'modifier-relation' && item.textContent.includes('red') && item.textContent.includes('bag')));
          assert.ok(ids.activity.children.some(item => item.textContent === step.successFeedback));
        } else assert.equal(ids.feedback.textContent, step.successFeedback);
      } else {
        const firstCheck = step.checks[0];
        key(course.words[step.wordIds.find(id => id !== firstCheck.wordId)].en[0]);
        assert.equal(ids.feedback.textContent, firstCheck.wrongFeedback);
        assert.equal(ids.next.hidden, true);
        for (const [checkIndex, check] of step.checks.entries()) {
          key(course.words[check.wordId].en[0]);
          if (checkIndex === 0) {
            assert.equal(ids.next.hidden, true);
            chooseCourse(book); chooseCourse(course);
            assert.ok(ids.activity.children.some(item => item.textContent === step.checks[1].prompt));
          }
        }
      }
      assert.equal(ids.next.hidden, false);
      const syntax = ids.activity.children.find(item => item.className.includes('semantic-words')).children[0];
      assert.deepEqual(syntax.children.filter(item => item.tagName === 'STRONG').map(item => item.textContent), step.wordIds.map(id => course.words[id].en));
      key('Enter'); continue;
    }
    if (step.type === 'transfer') {
      assert.equal(ids.trail.hidden, true);
      assert.equal(ids.trail.children.length, 0);
      assert.equal(bank(), undefined);
      const input = ids.activity.children.find(item => item.tagName === 'INPUT');
      assert.ok(input);
      assert.equal(input.value, '');
      const submit = () => input.onkeydown({ key: 'Enter', preventDefault() {} });
      submit();
      assert.equal(ids.next.hidden, true);
      if (course === lessons[1]) {
        input.value = 'work You'; input.oninput(); submit();
        assert.equal(ids.next.hidden, true);
        assert.equal(ids.feedback.className, 'error');
        chooseCourse(book); chooseCourse(course);
        assert.equal(ids.activity.children.find(item => item.tagName === 'INPUT').value, 'work You');
      }
      const activeInput = ids.activity.children.find(item => item.tagName === 'INPUT');
      activeInput.value = step.answers.at(-1);
      activeInput.onkeydown({ key: 'Enter', preventDefault() {} });
      assert.equal(ids.next.hidden, false);
      assert.equal(ids.trail.hidden, true);
      assert.equal(ids.feedback.textContent, course === lessons[1] ? '重试后答对' : '本次独立文本作答正确');
      key('Enter');
      continue;
    }
    assert.deepEqual(bank().children.map(item => item.dataset.wordId), [...step.wordIds].reverse());
    const shown = course.sequence.slice(0, index + 1).filter(item => !['teach', 'identify'].includes(item.type));
    assert.equal(ids.trail.children.length, shown.length);
    assert.equal(ids.trail.children.at(-1).children.length, 1);
    for (let previous = 0; previous < shown.length - 1; previous++) assert.equal(ids.trail.children[previous].children.length, 2);
    step.wordIds.forEach(id => key(course.words[id].en[0]));
    assert.equal(ids.next.hidden, false);
    assert.equal(ids.trail.children.at(-1).children.length, 2);
    const syntax = ids.trail.children.at(-1).children[1].children[0];
    const labels = syntax.children.filter(item => item.className === 'syntax-label');
    assert.equal(labels.length, step.annotations.length);
    assert.deepEqual(labels.map(item => item.style.gridColumn), step.annotations.map(item => `${item.start + 1} / ${item.end + 1}`));
    key('Enter');
  }
  assert.equal(ids.progress.textContent, '完成');
  if (course.review) assert.equal(ids.feedback.textContent, '本次 0 / 8 项首次完成；8 项经反馈后完成。');
  key('Enter');
  assert.equal(ids.progress.textContent, `1 / ${course.sequence.length}`);
  assert.equal(ids.trail.children.length, course.review ? 0 : 1);
}
chooseCourse(mixed);
for (const step of mixed.sequence) {
  if (step.type === 'classify') key(step.options.find(item => item.id === step.answer).key);
  else if (step.type === 'replace') {
    key(mixed.words[step.sourceWordIds[step.replaceIndex]].en[0]); key(mixed.words[step.replacement].en[0]);
  } else step.checks.forEach(check => key(mixed.words[check.wordId].en[0]));
  key('Enter');
}
assert.equal(ids.feedback.textContent, '本次 8 / 8 项首次完成；0 项经反馈后完成。');
chooseCourse(book); chooseCourse(mixed);
assert.equal(ids.feedback.textContent, '本次 8 / 8 项首次完成；0 项经反馈后完成。');
key('Enter'); assert.equal(ids.feedback.textContent, '');
// Viewing an example is completion with support, not an independent success.
chooseCourse(lessons[1]);
for (const step of lessons[1].sequence.slice(0, -1)) {
  if (step.type === 'replace') {
    key(lessons[1].words[step.sourceWordIds[step.replaceIndex]].en[0]);
    key(lessons[1].words[step.replacement].en[0]);
  } else if (step.type === 'identify') step.checks.forEach(check => key(lessons[1].words[check.wordId].en[0]));
  else if (step.type !== 'teach') step.wordIds.forEach(id => key(lessons[1].words[id].en[0]));
  key('Enter');
}
ids.activity.children.find(item => item.className === 'transfer-actions').children[1].click();
assert.equal(ids.feedback.textContent, '已查看示例');
chooseCourse(book); chooseCourse(lessons[1]);
assert.equal(ids.feedback.textContent, '已查看示例');
assert.equal(ids.trail.hidden, true);
console.log('Nine preview courses: early concept introductions, paired quantity/form changes, reverse changes, partial-change blocking, morphology keys, PB04 and existing lesson regression passed');
