import { lessons, validatePreviewLesson, visibleAnnotations, matchesTransfer } from './lessons-v3.mjs?v=20261025-22';
import { nodes, getNodeLessonIds, getNodeLessonLabel, loadNodeLesson } from './catalog.mjs';
import { createSchemaRunner } from './renderers.mjs?v=20261025-17';
const $ = id => document.getElementById(id);
const schemaRunner = createSchemaRunner({ document, window, activity: $('activity'), trail: $('trail'), feedback: $('feedback'), progress: $('progress'), next: $('next'), reviewEntry: $('review-entry'), catalog: nodes, getNodeLessonIds, getNodeLessonLabel, loadNodeLesson });
const freshState = () => ({ index: 0, selected: [], bank: [], solved: false, finished: false, lastSelected: null, answer: '', transferAttempts: 0, transferOutcome: null, editSlot: null, checkIndex: 0, changeIndex: 0, grammarAttempts: 0, grammarFeedback: '', grammarError: false, syntaxEvidence: {} });
let lesson = lessons[0], state = freshState();
const sessions = new Map([[lesson.id, state]]);

function node(tag, text, cls) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (cls) element.className = cls;
  return element;
}
function button(text, action) {
  const element = node('button', text);
  element.type = 'button'; element.onclick = action;
  return element;
}
function shortcutFor(id) { return lesson.words[id].en[0].toLowerCase(); }
function appendHighlightedWord(element, id) {
  const text = lesson.words[id].en;
  element.append(node('span', text[0], 'shortcut-letter'), document.createTextNode(text.slice(1)));
}
function feedback(text, kind = '') {
  $('feedback').textContent = text;
  $('feedback').className = kind;
}
function annotatedWords(step, selected, editable = false, showLabels = !editable) {
  const scroll = node('div', null, editable ? 'assembly syntax-scroll' : 'semantic-words syntax-scroll');
  const line = node('div', null, 'syntax-line');
  line.style.gridTemplateColumns = `repeat(${Math.max(1, selected.length)}, max-content)`;
  if (editable) line.setAttribute('aria-label', '当前已选单词');
  const annotations = showLabels ? visibleAnnotations(step, selected) : [];
  selected.forEach((id, index) => {
    const token = editable ? button(lesson.words[id].en, () => {
      state.selected.splice(index, 1); state.lastSelected = null; feedback(''); compose(step);
    }) : node('span', null, 'practice-chunk');
    if (!editable) appendHighlightedWord(token, id);
    token.classList.add('syntax-token');
    token.style.gridColumn = String(index + 1); token.style.gridRow = '1';
    if (editable) {
      token.disabled = state.solved;
      token.setAttribute('aria-label', `撤回 ${lesson.words[id].en}`);
      if (id === state.lastSelected) token.classList.add('chunk-rising');
    }
    line.append(token);
    if (showLabels && lesson.words[id].part) {
      const role = annotations.find(item => item.level === 0 && item.end - item.start === 1 && step.wordIds[item.start] === id);
      const part = node('span', [lesson.words[id].part, role?.label].filter((value, position, values) => value && values.indexOf(value) === position).join(' · '), 'syntax-part-label');
      part.style.gridColumn = String(index + 1);
      part.style.gridRow = '2';
      line.append(part);
    }
  });
  annotations.forEach(annotation => {
    if (annotation.level === 0 && annotation.end - annotation.start === 1 && lesson.words[step.wordIds[annotation.start]].part) return;
    const label = node('span', annotation.label, 'syntax-label');
    label.style.gridColumn = `${annotation.start + 1} / ${annotation.end + 1}`;
    label.style.gridRow = String(annotation.level + 3);
    line.append(label);
  });
  scroll.append(line);
  return scroll;
}
function renderBlackboard() {
  const board = $('teaching-board');
  board.replaceChildren();
  const completedIndex = state.solved && lesson.sequence[state.index].type !== 'teach' ? state.index : state.index - 1;
  const step = lesson.sequence[completedIndex];
  board.hidden = false;
  if (!step || ['transfer', 'identify', 'classify'].includes(lesson.sequence[state.index].type)) return;
  const note = step.learningNote;
  const expression = step.wordIds.map(id => lesson.words[id].en).join(' ');
  board.append(node('h2', `${note?.term ?? step.meaning} ● ${expression}`, 'blackboard-title'));
  if (note) {
    board.append(node('p', `${note.question} → ${note.answer}`, 'blackboard-question'));
    board.append(node('p', note.explanation));
  } else if (step.successFeedback) board.append(node('p', step.successFeedback));
}
function renderSentenceResult() {
  const area = $('sentence-result');
  area.replaceChildren();
  area.hidden = !lesson.sentenceStepIndexes?.length;
  const completedIndex = state.solved ? state.index : state.index - 1;
  const latestIndex = lesson.sentenceStepIndexes?.filter(index => index <= completedIndex).at(-1) ?? -1;
  if (area.hidden || latestIndex < 0 || ['transfer', 'identify', 'classify'].includes(lesson.sequence[state.index].type)) return latestIndex;
  const step = lesson.sequence[latestIndex];
  area.append(node('strong', step.wordIds.map(id => lesson.words[id].en).join(' '), 'sentence-result-en'));
  area.append(node('span', step.meaning, 'sentence-result-zh'));
  return latestIndex;
}
function renderTrail() {
  renderBlackboard();
  const latestSentence = renderSentenceResult();
  const trail = $('trail');
  trail.classList.toggle('has-sentence-level', Boolean(lesson.sentenceStepIndexes?.length));
  trail.replaceChildren();
  if (['transfer', 'teach', 'replace', 'identify', 'classify', 'insert-modifier', 'quantity'].includes(lesson.sequence[state.index].type)) { trail.hidden = true; return; }
  trail.hidden = false;
  const growthRows = new Map();
  lesson.sequence.slice(0, state.index + 1).forEach((step, index) => {
    if (index <= latestSentence || lesson.sentenceStepIndexes?.includes(index)) return;
    if (['teach', 'identify'].includes(step.type)) return;
    const complete = index < state.index || state.solved;
    let row = step.trailGroup ? growthRows.get(step.trailGroup) : null;
    if (!row) {
      row = node('li', null, 'semantic-item');
      trail.append(row);
      if (step.trailGroup) {
        row.append(node('div', null, 'semantic-growth-chunks'));
        growthRows.set(step.trailGroup, row);
      }
    }
    const content = step.trailGroup ? node('div', null, 'semantic-growth-chunk') : row;
    const heading = node('div', null, 'semantic-heading');
    heading.append(node('strong', step.meaning, 'semantic-meaning'));
    const expression = annotatedWords(step, step.wordIds);
    if (!complete) {
      expression.classList.add('is-pending');
      expression.setAttribute('aria-hidden', 'true');
    }
    content.append(expression);
    content.append(heading);
    if (content !== row) row.firstElementChild.append(content);
  });
}
function compose(step) {
  const area = $('activity'), target = step.wordIds;
  renderTrail();
  area.replaceChildren();
  area.append(node('h2', step.meaning, 'target-meaning'));
  if (!state.solved) {
    const bank = node('div', null, 'bank');
    state.bank.forEach(id => {
      if (state.selected.includes(id)) return;
      const tile = button('', () => {
        state.selected.push(id); state.lastSelected = id;
        if (state.selected.length === target.length) {
          if (state.selected.every((wordId, index) => wordId === target[index])) {
            state.solved = true;
            renderTrail();
            feedback(''); $('next').hidden = false; $('next').textContent = state.index === lesson.sequence.length - 1 ? '完成' : '继续';
          } else feedback('顺序不对', 'error');
        }
        compose(step);
      });
      tile.dataset.wordId = id;
      tile.classList.add('practice-chunk');
      tile.dataset.shortcut = shortcutFor(id);
      tile.setAttribute('aria-label', `按 ${shortcutFor(id).toUpperCase()} 选择 ${lesson.words[id].en}`);
      appendHighlightedWord(tile, id);
      bank.append(tile);
    });
    area.append(bank);
  } else area.append(node('div', null, 'bank'));
}
function renderGrammar(step) {
  renderTrail();
  const area = $('activity');
  area.replaceChildren(node('h2', step.meaning, 'target-meaning'));
  const complete = message => {
    state.solved = true; state.grammarFeedback = message; state.grammarError = false;
    state.syntaxEvidence[state.index] = { type: step.type, attempts: state.grammarAttempts, firstAttempt: state.grammarAttempts === (step.type === 'identify' ? step.checks.length : 1) };
    $('next').hidden = false; $('next').textContent = state.index === lesson.sequence.length - 1 ? '完成' : '继续';
    renderGrammar(step);
  };
  if (step.type === 'teach') {
    area.append(annotatedWords(step, step.wordIds));
    step.notes.forEach(note => {
      const text = node('div', null, 'grammar-note');
      const example = node('div', null, 'grammar-example');
      const focus = note.focusWordIds ?? [note.wordId];
      step.wordIds.forEach(id => example.append(node(focus.includes(id) ? 'mark' : 'span', lesson.words[id].en)));
      text.append(node('strong', note.term), example);
      if (note.question) text.append(node('p', `${note.question} → ${note.answer}`, 'grammar-reason'));
      text.append(node('span', note.text));
      area.append(text);
    });
    return;
  }
  if (state.solved) {
    area.append(annotatedWords(step, step.wordIds));
    if (step.type === 'insert-modifier') {
      area.append(node('p', `${lesson.words[step.modifierWordId].en}（${lesson.words[step.modifierWordId].zh}） → ${lesson.words[step.headWordId].en}（${lesson.words[step.headWordId].zh}）`, 'modifier-relation'), node('p', state.grammarFeedback, 'grammar-reason'));
      feedback('');
    } else feedback(state.grammarFeedback);
    return;
  }
  if (step.type === 'classify') {
    const sentence = node('div', null, 'grammar-example');
    step.wordIds.forEach(id => sentence.append(node(id === step.focusWordId ? 'mark' : 'span', lesson.words[id].en)));
    area.append(sentence, node('p', step.prompt, 'grammar-prompt'));
    const choices = node('div', null, 'grammar-options');
    step.options.forEach(option => {
      const choice = button('', () => {
        state.grammarAttempts++;
        if (option.id === step.answer) complete(option.feedback);
        else { state.grammarFeedback = option.feedback; state.grammarError = true; renderGrammar(step); }
      });
      choice.dataset.grammarKey = option.key;
      choice.append(node('span', option.key.toUpperCase(), 'shortcut-letter'), document.createTextNode(` ${option.label}`));
      choices.append(choice);
    });
    area.append(choices);
    feedback(state.grammarFeedback, state.grammarError ? 'error' : '');
    return;
  }
  const inserting = step.type === 'insert-modifier';
  const editing = step.type === 'replace' || inserting;
  const prompt = editing ? step.prompt : step.checks[state.checkIndex].prompt;
  area.append(node('p', prompt, 'grammar-prompt'));
  const words = node('div', null, 'grammar-words');
  const ids = editing ? step.sourceWordIds : step.wordIds;
  ids.forEach((id, index) => {
    const token = button('', () => {
      state.grammarAttempts++;
      if (editing) {
        if (inserting ? id !== step.headWordId : index !== step.replaceIndex) { state.grammarFeedback = step.wrongFeedback; state.grammarError = true; }
        else { state.editSlot = index; state.grammarFeedback = ''; state.grammarError = false; }
      } else {
        const check = step.checks[state.checkIndex];
        if (id !== check.wordId) { state.grammarFeedback = check.wrongFeedback; state.grammarError = true; }
        else {
          state.checkIndex++; state.grammarFeedback = check.feedback; state.grammarError = false;
          if (state.checkIndex === step.checks.length) { complete(step.successFeedback ?? '主语说的是谁，谓语说明做什么。两部分都找对了。'); return; }
        }
      }
      renderGrammar(step);
    });
    appendHighlightedWord(token, id);
    if (inserting) token.append(node('small', lesson.words[id].zh));
    if (!editing || state.editSlot === null) token.dataset.grammarKey = shortcutFor(id);
    token.setAttribute('aria-label', `选择 ${lesson.words[id].en}`);
    if (index === state.editSlot) token.classList.add('grammar-selected');
    words.append(token);
  });
  area.append(words);
  if (editing && state.editSlot !== null) {
    const choices = node('div', null, 'grammar-choices');
    const token = button('', () => complete(step.successFeedback));
    const newWordId = inserting ? step.modifierWordId : step.replacement;
    appendHighlightedWord(token, newWordId);
    token.append(node('small', lesson.words[newWordId].zh));
    token.dataset.grammarKey = shortcutFor(newWordId);
    choices.append(token);
    if (inserting) area.append(node('p', `把 ${lesson.words[step.modifierWordId].en} 加到 ${lesson.words[step.headWordId].en} 前面，说明这个${lesson.words[step.headWordId].zh}是什么样的。`, 'grammar-reason'));
    area.append(choices);
  }
  feedback(state.grammarFeedback, state.grammarError ? 'error' : '');
}
function renderQuantity(step) {
  renderTrail();
  const area = $('activity');
  area.replaceChildren(node('h2', step.meaning, 'target-meaning'));
  if (state.solved) {
    area.append(annotatedWords(step, step.wordIds));
    const before = step.sourceWordIds.map(id => lesson.words[id].en).join(' ');
    const after = step.wordIds.map(id => lesson.words[id].en).join(' ');
    area.append(node('p', `${before} → ${after}`, 'modifier-relation'), node('p', step.successFeedback, 'grammar-reason'));
    feedback(''); return;
  }
  const change = step.changes[state.changeIndex];
  const current = [...step.sourceWordIds];
  step.changes.slice(0, state.changeIndex).forEach(item => { current[item.index] = item.to; });
  const example = node('div', null, 'grammar-example');
  current.forEach((id, index) => example.append(node(index === change.index ? 'mark' : 'span', lesson.words[id].en)));
  area.append(example, node('p', change.prompt, 'grammar-prompt'), node('p', change.explanation, 'grammar-reason'));
  const options = node('div', null, 'grammar-choices');
  change.options.forEach(option => {
    const choice = button('', () => {
      state.grammarAttempts++;
      if (option.wordId !== change.to) {
        state.grammarFeedback = change.wrongFeedback; state.grammarError = true;
      } else {
        state.changeIndex++; state.grammarFeedback = ''; state.grammarError = false;
        if (state.changeIndex === step.changes.length) {
          state.solved = true;
          state.syntaxEvidence[state.index] = { type: 'quantity', attempts: state.grammarAttempts, assisted: true };
          $('next').hidden = false; $('next').textContent = state.index === lesson.sequence.length - 1 ? '完成' : '继续';
        }
      }
      renderQuantity(step);
    });
    const word = lesson.words[option.wordId], keyIndex = word.en.toLowerCase().indexOf(option.key);
    choice.append(document.createTextNode(word.en.slice(0, keyIndex)), node('span', word.en[keyIndex], 'shortcut-letter'), document.createTextNode(word.en.slice(keyIndex + 1)), node('small', word.zh));
    choice.dataset.grammarKey = option.key;
    choice.setAttribute('aria-label', `按 ${option.key.toUpperCase()} 选择 ${word.en}`);
    options.append(choice);
  });
  area.append(options); feedback(state.grammarFeedback, state.grammarError ? 'error' : '');
}
function renderTransfer(step) {
  renderTrail();
  const area = $('activity');
  area.replaceChildren(node('h2', step.meaning, 'target-meaning'));
  if (state.solved) {
    area.append(annotatedWords(step, step.wordIds));
    feedback(state.transferOutcome === 'example' ? '已查看示例' : state.transferOutcome === 'retry' ? '重试后答对' : '本次独立文本作答正确');
    return;
  }
  const input = node('input');
  input.id = 'transfer-answer'; input.type = 'text'; input.value = state.answer;
  input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('aria-label', '用英文表达当前中文意思');
  input.placeholder = '用英文写出这句话';
  input.oninput = () => { state.answer = input.value; };
  const check = () => {
    state.answer = input.value;
    if (!state.answer.trim()) { feedback('请先输入英文。'); return; }
    state.transferAttempts++;
    if (matchesTransfer(step, state.answer)) {
      state.solved = true;
      state.transferOutcome = state.transferAttempts === 1 ? 'independent' : 'retry';
      $('next').hidden = false; $('next').textContent = '完成';
      renderTransfer(step);
    } else feedback('尚未匹配本课目标表达，请检查用词和词序。', 'error');
  };
  input.onkeydown = event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); check(); } };
  const actions = node('div', null, 'transfer-actions');
  actions.append(button('检查', check), button('查看示例', () => {
    state.answer = input.value; state.solved = true; state.transferOutcome = 'example';
    $('next').hidden = false; $('next').textContent = '完成'; renderTransfer(step);
  }));
  area.append(input, actions);
  input.focus();
}
function render(reset = true) {
  const step = lesson.sequence[state.index];
  if (reset) { state.solved = step.type === 'teach'; state.selected = []; state.lastSelected = null; state.answer = ''; state.transferAttempts = 0; state.transferOutcome = null; state.editSlot = null; state.checkIndex = 0; state.changeIndex = 0; state.grammarAttempts = 0; state.grammarFeedback = ''; state.grammarError = false; }
  feedback('');
  $('progress').textContent = state.finished ? '完成' : `${state.index + 1} / ${lesson.sequence.length}`;
  $('next').hidden = !state.solved;
  $('next').textContent = state.finished ? '再练一遍' : state.index === lesson.sequence.length - 1 ? '完成' : '继续';
  $('activity').replaceChildren();
  state.bank = [...step.wordIds].reverse();
  if (step.type === 'transfer') renderTransfer(step);
  else if (step.type === 'quantity') renderQuantity(step);
  else if (['teach', 'replace', 'identify', 'classify', 'insert-modifier'].includes(step.type)) renderGrammar(step);
  else compose(step);
  if (state.finished && lesson.review) feedback(reviewSummary());
  $('activity').scrollIntoView({ block: 'nearest' });
}
function reviewSummary() {
  const evidence = Object.values(state.syntaxEvidence);
  const first = evidence.filter(item => item.firstAttempt).length;
  return `本次 ${first} / ${evidence.length} 项首次完成；${evidence.length - first} 项经反馈后完成。`;
}
function advance() {
  if (schemaRunner.active) { schemaRunner.advance(); return; }
  const step = lesson.sequence[state.index];
  if (state.finished) { state.finished = false; state.index = 0; state.syntaxEvidence = {}; render(); return; }
  if (!state.solved) return;
  if (state.index === lesson.sequence.length - 1) {
    state.finished = true;
    $('progress').textContent = '完成'; $('next').textContent = '再练一遍';
    if (lesson.review) feedback(reviewSummary());
    return;
  }
  state.index++; render();
}

$('next').onclick = advance;
window.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing || event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return;
  if (schemaRunner.active) {
    if (schemaRunner.handleKey(event)) { event.preventDefault(); return; }
    if (event.key === 'Enter' && !$('next').hidden) { event.preventDefault(); schemaRunner.advance(); }
    return;
  }
  const step = lesson.sequence[state.index];
  if (event.key === 'Enter' && !$('next').hidden) { event.preventDefault(); advance(); return; }
  if (state.solved) return;
  if (step.type === 'transfer') return;
  if (['replace', 'identify', 'classify', 'insert-modifier', 'quantity'].includes(step.type)) {
    if (/^[a-z]$/i.test(event.key)) {
      const target = document.querySelector(`#activity button[data-grammar-key="${event.key.toLowerCase()}"]`);
      if (target) { event.preventDefault(); target.click(); }
    }
    return;
  }
  if (/^[a-z]$/i.test(event.key)) {
    const id = step.wordIds.find(id => !state.selected.includes(id) && shortcutFor(id) === event.key.toLowerCase());
    if (id) {
      event.preventDefault();
      document.querySelector(`.bank button[data-word-id="${id}"]`)?.click();
    }
  } else if (event.key === 'Backspace' && state.selected.length) {
    event.preventDefault(); state.selected.pop(); state.lastSelected = null; feedback(''); compose(step);
  }
});

try {
  lessons.forEach(validatePreviewLesson);
  lessons.forEach(course => {
    const option = node('option', course.label); option.value = course.id;
    $('lesson-select').append(option);
  });
  schemaRunner.mountCatalog($('lesson-select'));
  $('review-entry').onclick = () => schemaRunner.startDueReview();
  $('lesson-select').onchange = event => {
    if (event.target.value.startsWith('node:')) {
      $('teaching-board').hidden = true;
      $('sentence-result').hidden = true;
      const [, nodeId, lessonId] = event.target.value.split(':');
      schemaRunner.openNode(nodeId, lessonId);
      event.target.blur?.();
      return;
    }
    schemaRunner.close();
    lesson = lessons.find(course => course.id === event.target.value);
    state = sessions.get(lesson.id) ?? freshState(); sessions.set(lesson.id, state);
    render(false);
    event.target.blur?.();
  };
  const params = new URLSearchParams(window.location?.search ?? '');
  const requestedNode = params.get('node');
  const requestedLesson = params.get('lesson');
  if (requestedNode || requestedLesson) {
    const matchingNode = nodes.find(item => item.id === requestedNode);
    if (matchingNode && (!requestedLesson || getNodeLessonIds(matchingNode.id).includes(requestedLesson))) {
      const ids = getNodeLessonIds(matchingNode.id);
      $('lesson-select').value = ids.length > 1 ? `node:${matchingNode.id}:${requestedLesson ?? ids[0]}` : `node:${matchingNode.id}`;
      schemaRunner.openNode(matchingNode.id, ids.length > 1 ? (requestedLesson ?? ids[0]) : requestedLesson);
    } else if (!requestedNode && lessons.some(item => item.id === requestedLesson)) {
      $('lesson-select').value = requestedLesson;
      $('lesson-select').onchange({ target: $('lesson-select') });
    } else {
      $('activity').textContent = '没有找到对应的预览课程。';
      $('feedback').textContent = '请从课程目录中选择已接入的课程。';
      $('next').hidden = true;
    }
  } else render();
}
catch (error) { $('activity').textContent = '课程数据无法加载，请刷新重试。'; $('next').hidden = true; console.error(error); }
