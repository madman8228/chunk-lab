import { lessons, validatePreviewLesson, visibleAnnotations, matchesTransfer } from './lessons-v3.mjs?v=20261026-9';
import { nodes, getNodeLessonIds, getNodeLessonLabel, loadNodeLesson } from './catalog.mjs';
import { createSchemaRunner } from './renderers.mjs?v=20261025-41';
import { appendSceneVisual } from './scene-view.mjs?v=20261026-9';
import { visualScenes } from './visual-scenes.mjs?v=20261026-9';
const $ = id => document.getElementById(id);
const schemaRunner = createSchemaRunner({ document, window, activity: $('activity'), teachingBoard: $('teaching-board'), trail: $('trail'), feedback: $('feedback'), progress: $('progress'), next: $('next'), reviewEntry: $('review-entry'), catalog: nodes, getNodeLessonIds, getNodeLessonLabel, loadNodeLesson });
const freshState = () => ({ index: 0, selected: [], bank: [], solved: false, finished: false, lastSelected: null, answer: '', transferAttempts: 0, transferOutcome: null, editSlot: null, checkIndex: 0, checkConfirmed: false, changeIndex: 0, grammarAttempts: 0, grammarFeedback: '', grammarError: false, syntaxEvidence: {} });
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
  $('feedback').textContent = '';
  $('teaching-board').querySelector('.blackboard-feedback')?.remove();
  if (text) {
    const message = node('p', text, `blackboard-feedback ${kind}`);
    message.setAttribute('role', 'status');
    $('teaching-board').append(message);
  }
}
function successIndicator(answer) {
  const slot = node('div', null, 'identification-feedback-slot');
  const success = node('div', null, `identification-success${state.animateSuccess ? ' is-animated' : ''}`);
  success.setAttribute('role', 'status');
  success.append(node('span', `回答正确：${answer}`, 'identification-announcement'));
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 64 64'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
  icon.innerHTML = '<circle cx="32" cy="32" r="27" fill="#deebd6" stroke="currentColor" stroke-width="2"/><path class="identification-check" d="M19 33l9 9 18-21" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>';
  success.append(icon); slot.append(success); state.animateSuccess = false;
  return slot;
}
function annotatedWords(step, selected, editable = false, showLabels = !editable, showGlosses = false) {
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
  if (showGlosses) {
    const glossRow = Math.max(2, ...annotations.map(annotation => annotation.level + 3)) + 1;
    selected.forEach((id, index) => {
      const gloss = node('span', lesson.words[id].zh, 'syntax-word-gloss');
      gloss.style.gridColumn = String(index + 1);
      gloss.style.gridRow = String(glossRow);
      line.append(gloss);
    });
  }
  scroll.append(line);
  return scroll;
}
function appendBlackboardExplanation(board, text) {
  const paragraph = node('p');
  for (const sentence of text.match(/[^。！？]+[。！？]*[”’」』）)]*/gu) ?? []) {
    const line = node('span', sentence.trim());
    line.style.display = 'block';
    paragraph.append(line);
  }
  board.append(paragraph);
}
function renderBlackboard() {
  const board = $('teaching-board');
  board.replaceChildren();
  board.classList.remove('is-prompt', 'has-visual');
  const completedIndex = state.solved && lesson.sequence[state.index].type !== 'teach' ? state.index : state.index - 1;
  const current = lesson.sequence[state.index];
  const lastWord = state.selected.at(-1);
  const wordNote = !state.solved && current.wordLearningNotes?.[lastWord];
  const step = !state.solved && lastWord ? current : lesson.sequence[completedIndex];
  const focusedWordId = current.type === 'identify'
    ? (state.checkConfirmed ? current.checks[state.checkIndex].wordId : null)
    : current.type === 'classify' ? (state.solved ? current.focusWordId : null)
    : (!state.solved && lastWord ? lastWord : step?.wordIds.length === 1 ? step.wordIds[0] : null);
  const focusedWord = lesson.words[focusedWordId];
  const visual = focusedWord
    ? (focusedWord.visualSceneId ? { sceneId: focusedWord.visualSceneId } : null)
    : (current.visual ?? (state.solved ? step?.visual : null));
  board.hidden = false;
  const instruction = current.type === 'identify' ? current.checks[state.checkIndex].prompt
    : current.type === 'quantity' ? current.changes[state.changeIndex]?.prompt
    : current.type === 'transfer' ? (!state.solved ? '用英文写出这句话。' : null) : current.prompt;
  if (instruction) {
    if (['identify', 'classify'].includes(current.type)) board.append(node('h2', instruction, 'blackboard-title blackboard-instruction'));
    else board.append(node('h2', current.meaning, 'blackboard-title blackboard-instruction'), node('p', instruction, 'blackboard-question blackboard-instruction'));
    if (current.type === 'quantity' && !state.solved) appendBlackboardExplanation(board, current.changes[state.changeIndex].explanation);
    if (current.type === 'insert-modifier' && state.editSlot !== null && !state.solved) {
      board.append(node('p', `把 ${lesson.words[current.modifierWordId].en} 加到 ${lesson.words[current.headWordId].en} 前面，说明这个${lesson.words[current.headWordId].zh}是什么样的。`));
    }
    if (!state.solved && !state.checkConfirmed) return;
  }
  if ((!current.type || current.type === 'compose') && !state.solved && !lastWord) {
    board.classList.add('is-prompt');
    board.append(node('p', current.meaning, 'blackboard-target'));
    return;
  }
  if (current.type === 'identify') {
    if (!state.checkConfirmed) return;
    const check = current.checks[state.checkIndex];
    const expression = `${focusedWord.en}（${focusedWord.zh}）`;
    if (visual) appendSceneVisual(board, visual, visualScenes);
    board.append(node('h2', `${check.learningNote?.term ?? '找对了'} ● ${expression}`, 'blackboard-title'));
    board.append(node('p', check.feedback, 'blackboard-question'));
    if (check.learningNote) appendBlackboardExplanation(board, check.learningNote.explanation);
    return;
  }
  if (current.type === 'classify') {
    if (visual) appendSceneVisual(board, visual, visualScenes);
    if (focusedWord) board.append(node('h2', `关系辨析 ● ${focusedWord.en}（${focusedWord.zh}）`, 'blackboard-title'));
    return;
  }
  if (!step || current.type === 'identify' || (current.type === 'transfer' && !state.solved)) return;
  const note = !state.solved && lastWord ? wordNote : step.learningNote;
  const expression = focusedWord ? `${focusedWord.en}（${focusedWord.zh}）` : step.wordIds.map(id => lesson.words[id].en).join(' ');
  if (visual) appendSceneVisual(board, visual, visualScenes);
  board.append(node('h2', `${note?.term ?? focusedWord?.part ?? step.meaning} ● ${expression}`, 'blackboard-title'));
  if (note) {
    board.append(node('p', `${note.question} → ${note.answer}`, 'blackboard-question'));
    appendBlackboardExplanation(board, note.explanation);
    if (note.illustration) {
      const illustration = node('img', null, 'blackboard-illustration');
      illustration.alt = note.illustration.alt;
      illustration.width = note.illustration.width;
      illustration.height = note.illustration.height;
      illustration.decoding = 'async';
      illustration.onerror = () => illustration.remove();
      illustration.src = note.illustration.src;
      board.prepend(illustration);
    }
  } else if (step.successFeedback) appendBlackboardExplanation(board, step.successFeedback);
}
function renderSentenceResult() {
  const area = $('sentence-result');
  area.replaceChildren();
  area.hidden = !lesson.sentenceStepIndexes?.length;
  const completedIndex = state.solved ? state.index : state.index - 1;
  const latestIndex = lesson.sentenceStepIndexes?.filter(index => index <= completedIndex).at(-1) ?? -1;
  const current = lesson.sequence[state.index];
  if (area.hidden || ['transfer', 'identify', 'classify'].includes(current.type)) return latestIndex;
  if (lesson.sentenceStepIndexes.includes(state.index) && !current.type && state.selected.length) {
    area.append(annotatedWords(current, state.selected, false, true, true));
    return latestIndex;
  }
  const clearedIndex = lesson.sequence.findLastIndex((step, index) => index <= completedIndex && step.clearSentenceResultOnComplete);
  if (latestIndex < 0 || clearedIndex > latestIndex || (lesson.sentenceStepIndexes.includes(state.index) && !state.solved)) return latestIndex;
  const step = lesson.sequence[latestIndex];
  area.append(annotatedWords(step, step.wordIds, false, true, true));
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
  const replaced = new Set(lesson.sequence.slice(0, state.index + 1).flatMap(step => step.replacesTrailIndexes ?? []));
  lesson.sequence.slice(0, state.index + 1).forEach((step, index) => {
    if (lesson.review && index !== state.index) return;
    if (replaced.has(index)) return;
    if (index <= latestSentence || lesson.sentenceStepIndexes?.includes(index)) return;
    if (lesson.sentenceStepIndexes?.includes(state.index) && !lesson.sequence[state.index].type && step.wordIds.every(id => state.selected.includes(id))) return;
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
    const content = node('div', null, 'semantic-growth-chunk');
    const heading = node('div', null, 'semantic-heading');
    heading.append(node('strong', step.meaning, 'semantic-meaning'));
    const selected = index === state.index && !complete && state.selected.length ? state.selected : step.wordIds;
    const expression = annotatedWords(step, selected, false, !lesson.review || complete);
    if (!complete) {
      if (selected === step.wordIds) {
        expression.classList.add('is-pending');
        expression.setAttribute('aria-hidden', 'true');
      }
      heading.style.visibility = 'hidden';
      heading.setAttribute('aria-hidden', 'true');
    }
    content.append(expression);
    content.append(heading);
    if (step.trailGroup) row.firstElementChild.append(content);
    else row.append(content);
  });
}
function compose(step) {
  const area = $('activity'), target = step.wordIds;
  renderTrail();
  area.replaceChildren();
  if (!state.solved) {
    const bank = node('div', null, 'bank');
    state.bank.forEach(id => {
      if (state.selected.includes(id)) return;
      const tile = button('', () => {
        if ((lesson.sentenceStepIndexes?.includes(state.index) || step.type === 'compose' || step.bankWordIds) && id !== target[state.selected.length]) {
          const nextWord = lesson.words[target[state.selected.length]];
          feedback(step.wordFeedback?.[id] ?? `顺序不对。下一步请选 ${nextWord.en}（${nextWord.zh}）。`, 'error');
          return;
        }
        feedback('');
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
  area.replaceChildren();
  const complete = message => {
    if (step.type === 'classify') state.animateSuccess = true;
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
  if (step.type === 'identify' && state.checkConfirmed) {
    const check = step.checks[state.checkIndex];
    const words = node('div', null, 'grammar-words');
    step.wordIds.forEach(id => {
      const token = button(lesson.words[id].en, () => {});
      token.disabled = true;
      token.classList.add('identification-result');
      if (id === check.wordId) token.classList.add('is-correct');
      words.append(token);
    });
    area.append(words, successIndicator(lesson.words[check.wordId].en));
    feedback('');
    $('next').hidden = false;
    $('next').textContent = state.solved ? (state.index === lesson.sequence.length - 1 ? '完成' : '继续') : '下一问';
    return;
  }
  if (state.solved) {
    area.append(annotatedWords(step, step.wordIds));
    if (step.type === 'classify') area.append(successIndicator(lesson.words[step.focusWordId].en));
    if (step.type === 'insert-modifier') {
      area.append(node('p', `${lesson.words[step.modifierWordId].en}（${lesson.words[step.modifierWordId].zh}） → ${lesson.words[step.headWordId].en}（${lesson.words[step.headWordId].zh}）`, 'modifier-relation'), node('p', state.grammarFeedback, 'grammar-reason'));
      feedback('');
    } else feedback(state.grammarFeedback);
    return;
  }
  if (step.type === 'classify') {
    const sentence = node('div', null, 'grammar-example');
    step.wordIds.forEach(id => sentence.append(node(id === step.focusWordId ? 'mark' : 'span', lesson.words[id].en)));
    area.append(sentence);
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
    area.append(choices, node('div', null, 'identification-feedback-slot'));
    feedback(state.grammarFeedback, state.grammarError ? 'error' : '');
    return;
  }
  const inserting = step.type === 'insert-modifier';
  const editing = step.type === 'replace' || inserting;
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
          state.animateSuccess = true; state.checkConfirmed = true; state.grammarFeedback = check.feedback; state.grammarError = false;
          if (state.checkIndex === step.checks.length - 1) { complete(check.feedback); return; }
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
  if (!editing) area.append(node('div', null, 'identification-feedback-slot'));
  if (editing && state.editSlot !== null) {
    const choices = node('div', null, 'grammar-choices');
    const token = button('', () => complete(step.successFeedback));
    const newWordId = inserting ? step.modifierWordId : step.replacement;
    appendHighlightedWord(token, newWordId);
    token.append(node('small', lesson.words[newWordId].zh));
    token.dataset.grammarKey = shortcutFor(newWordId);
    choices.append(token);
    area.append(choices);
  }
  feedback(state.grammarFeedback, state.grammarError ? 'error' : '');
}
function renderQuantity(step) {
  renderTrail();
  const area = $('activity');
  area.replaceChildren();
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
  area.append(example);
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
  area.replaceChildren();
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
  if (reset) { state.solved = step.type === 'teach'; state.selected = []; state.lastSelected = null; state.answer = ''; state.transferAttempts = 0; state.transferOutcome = null; state.editSlot = null; state.checkIndex = 0; state.checkConfirmed = false; state.changeIndex = 0; state.grammarAttempts = 0; state.grammarFeedback = ''; state.grammarError = false; }
  feedback('');
  $('progress').textContent = state.finished ? '完成' : `${state.index + 1} / ${lesson.sequence.length}`;
  $('next').hidden = !state.solved;
  $('next').textContent = state.finished ? '再练一遍' : state.index === lesson.sequence.length - 1 ? '完成' : '继续';
  $('activity').replaceChildren();
  state.bank = [...(step.bankWordIds ?? step.wordIds)].reverse();
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
  if (step.type === 'identify' && state.checkConfirmed && !state.solved) {
    state.checkIndex++; state.checkConfirmed = false; state.grammarFeedback = '';
    feedback(''); $('next').hidden = true;
    renderGrammar(step);
    return;
  }
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
    const id = state.bank.find(id => !state.selected.includes(id) && shortcutFor(id) === event.key.toLowerCase());
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
      $('teaching-board').hidden = false;
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
