import { createKeyboardState, handleChunkKey, confirmChunkCandidate, cancelChunkCandidate } from './keyboard.mjs';
import { visibleSyntax } from './annotations.mjs';
import { createReviewStore } from './review.mjs';
import { createRun, recordAttempt, completeStep, restoreRun, serializeRun, exposeSupport } from './runtime.mjs';
import { validateLessonV3 } from './schema.mjs';

const normalize = value => value.normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[.!?。！？]+$/u, '').replace(/\s+/g, ' ');

export function createSchemaRunner({ document, window, activity, teachingBoard, trail, feedback, progress, next, reviewEntry, catalog, getNodeLessonIds, getNodeLessonLabel, loadNodeLesson }) {
  let lesson = null;
  let run = null;
  let keyboard = createKeyboardState();
  let selected = [];
  let floatedId = null;
  let transformFocus = null;
  let finished = false;
  let reviewMode = false;
  let reviewComplete = false;
  let hintShown = false;
  let reviewTimer = null;
  let warningShown = false;
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const review = createReviewStore(storage);

  const make = (tag, text = '', className = '') => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const button = (text, action, className = '') => {
    const element = make('button', text, className);
    element.type = 'button'; element.onclick = action;
    return element;
  };
  const tokenById = id => lesson.tokens.find(token => token.id === id);
  const currentStep = () => lesson.steps.find(step => step.id === run.currentStepId);
  const announce = (text, kind = '') => {
    if (!teachingBoard) { feedback.textContent = text; feedback.className = kind; return; }
    feedback.textContent = '';
    teachingBoard.querySelector('.blackboard-feedback')?.remove();
    if (text) {
      const message = make('p', text, `blackboard-feedback ${kind}`);
      message.setAttribute('role', 'status');
      teachingBoard.append(message);
    }
  };
  const stepIsComplete = id => run.completedStepIds.includes(id);
  const persist = () => review.saveSession(lesson.id, serializeRun(run));
  const record = (step, response, outcome) => {
    run = recordAttempt(run, { eventId: window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, stepId: step.id, response, outcome, now: Date.now() });
    persist();
  };

  function drawSyntax(step, tokenIds, interactive = false, onToken = null) {
    const row = make('div', '', 'schema-syntax syntax-scroll');
    const words = make('div', '', 'schema-syntax-words');
    words.style.gridTemplateColumns = `repeat(${Math.max(tokenIds.length, 1)}, max-content)`;
    tokenIds.forEach((id, index) => {
      const token = tokenById(id);
      const item = interactive ? button(token.text, () => onToken?.(id), `schema-word${id === floatedId ? ' chunk-rising' : ''}`) : make('strong', token.text, 'schema-word');
      item.style.gridColumn = String(index + 1); item.style.gridRow = '1';
      if (token.kind === 'punctuation') item.classList?.add('punctuation-token');
      words.append(item);
      if (!interactive && token.kind === 'word' && token.partOfSpeech) {
        const part = make('span', token.partOfSpeech, 'schema-part-label');
        part.style.gridColumn = String(index + 1);
        part.style.gridRow = '2';
        words.append(part);
      }
    });
    const selectedNow = interactive ? selected : tokenIds;
    for (const annotation of interactive ? [] : visibleSyntax(step, selectedNow)) {
      for (const segment of annotation.segments) {
        const segmentIds = segment.tokenIds;
        const start = tokenIds.indexOf(segmentIds[0]);
        if (start < 0 || !segmentIds.every((id, offset) => tokenIds[start + offset] === id)) continue;
        const label = make('span', annotation.role, 'schema-syntax-label');
        label.style.gridColumn = `${start + 1} / ${start + segmentIds.length + 1}`;
        label.style.gridRow = String(annotation.level + 3);
        words.append(label);
      }
    }
    row.append(words);
    return row;
  }

  function drawTrail() {
    trail.replaceChildren();
    trail.hidden = false;
    const identifyingStructure = currentStep()?.activity === 'range-identify';
    for (const step of lesson.steps) {
      if (!stepIsComplete(step.id) || !['compose', 'transform'].includes(step.activity)) continue;
      const item = make('li', '', 'semantic-item');
      const heading = make('strong', step.meaning, 'semantic-meaning');
      const hideAnswer = identifyingStructure && step.activity === 'compose';
      item.append(drawSyntax(hideAnswer ? { ...step, syntax: [] } : step, step.targetTokenIds), heading);
      trail.append(item);
    }
  }

  function revealNext() {
    next.hidden = false;
    next.textContent = run.currentStepId === lesson.steps.at(-1).id ? '完成' : '继续';
  }

  function markComplete(step, response = '') {
    record(step, response, 'correct');
    run = completeStep(run, lesson, step.id);
    selected = []; keyboard = createKeyboardState(); floatedId = null; transformFocus = null;
    finished = step.id === lesson.steps.at(-1).id;
    persist();
    render();
    if (finished) revealNext();
  }

  function chooseToken(step, id) {
    if (selected.includes(id)) return;
    if (step.distractorTokenIds?.includes(id)) {
      record(step, tokenById(id).text, 'incorrect');
      selected = []; keyboard = createKeyboardState(); floatedId = null;
      render();
      announce(step.distractorFeedback?.[id] ?? '这个词不符合当前意思，再选一次。', 'error');
      return;
    }
    selected.push(id); floatedId = null;
    const target = step.targetTokenIds.filter(tokenId => tokenById(tokenId).kind === 'word');
    if (selected.length === target.length) {
      if (selected.every((item, index) => item === target[index])) {
        markComplete(step, selected.map(tokenId => tokenById(tokenId).text).join(' '));
        return;
      }
      record(step, selected.map(tokenId => tokenById(tokenId).text).join(' '), 'incorrect');
      render();
      announce('顺序还不对。按 Backspace 撤回后重拼。', 'error');
      return;
    }
    render();
  }

  function chooseRangeToken(step, id) {
    if (selected.includes(id)) return;
    selected.push(id); selected.sort((left, right) => step.targetTokenIds.indexOf(left) - step.targetTokenIds.indexOf(right)); floatedId = null;
    const syntax = step.syntax.find(item => item.id === step.focusSyntaxId);
    const expected = syntax.segments.flat();
    if (selected.length === expected.length) {
      if (selected.length === expected.length && expected.every(tokenId => selected.includes(tokenId))) {
        markComplete(step, selected.map(tokenId => tokenById(tokenId).text).join(' '));
        return;
      }
      record(step, selected.map(tokenId => tokenById(tokenId).text).join(' '), 'incorrect');
      selected = []; keyboard = createKeyboardState();
      render(); announce('范围还没选完整。可以撤回后重选。', 'error');
      return;
    }
    render();
  }

  function chooseTransformToken(step, operation, id) {
    if (selected.includes(id)) return;
    selected.push(id);
    if (selected.length < operation.to.length) { render(); return; }
    if (!selected.every((tokenId, index) => tokenId === operation.to[index])) {
      selected = []; keyboard = createKeyboardState(); floatedId = null;
      render(); announce('这组词还没拼完整，重新选择。', 'error'); return;
    }
    applyTransform(step, operation);
  }

  function applyTransform(step, operation) {
    const source = [...step.sourceTokenIds];
    let result;
    if (operation.type === 'delete') {
      result = source.filter(id => !operation.from.includes(id));
    } else if (operation.type === 'replace') {
      const start = source.indexOf(operation.from[0]);
      result = [...source.slice(0, start), ...operation.to, ...source.slice(start + operation.from.length)];
    } else if (operation.type === 'insert') {
      const anchor = source.indexOf(operation.anchorId);
      const index = anchor + (operation.position === 'after' ? 1 : 0);
      result = [...source.slice(0, index), ...operation.to, ...source.slice(index)];
    } else {
      const moved = operation.from;
      const remainder = source.filter(id => !moved.includes(id));
      const anchor = remainder.indexOf(operation.anchorId);
      const index = anchor + (operation.position === 'after' ? 1 : 0);
      result = [...remainder.slice(0, index), ...moved, ...remainder.slice(index)];
    }
    if (result.join('|') !== step.targetTokenIds.join('|')) {
      record(step, result.map(tokenId => tokenById(tokenId).text).join(' '), 'incorrect');
      selected = []; keyboard = createKeyboardState(); floatedId = null; transformFocus = null;
      render(); announce('这次变化不符合目标句，重新试一次。', 'error'); return;
    }
    markComplete(step, result.map(tokenId => tokenById(tokenId).text).join(' '));
  }

  function activateTransform(step, operation) {
    transformFocus = step.operations.indexOf(operation);
    selected = []; keyboard = createKeyboardState(); floatedId = null;
    if (['delete', 'move'].includes(operation.type)) applyTransform(step, operation);
    else render();
  }

  function renderCompose(step) {
    if (step.instruction && !teachingBoard) activity.append(make('p', step.instruction, 'schema-explanation'));
    const output = make('div', '', 'assembly schema-assembly');
    const selectedStep = { ...step, targetTokenIds: selected };
    output.append(drawSyntax(selectedStep, selected, true, id => {
      selected = selected.filter(tokenId => tokenId !== id); announce(''); render();
    }));
    const bank = make('div', '', 'bank schema-bank');
    for (const id of step.bankTokenIds ?? step.targetTokenIds) {
      const token = tokenById(id);
      if (token.kind === 'punctuation' || selected.includes(id)) continue;
      const initial = token.text[0]?.toLowerCase();
      const chip = button('', () => chooseToken(step, id), `schema-choice${id === floatedId ? ' is-floated chunk-rising' : ''}`);
      chip.dataset.tokenId = id;
      chip.setAttribute('aria-label', `按 ${initial?.toUpperCase()} 选择 ${token.text}`);
      chip.append(make('span', token.text[0], 'shortcut-letter'));
      chip.append(document.createTextNode(token.text.slice(1)));
      bank.append(chip);
    }
    activity.append(output, bank);
    if (review.warning) announce(review.warning);
  }

  function renderRangeIdentify(step) {
    const syntax = step.syntax.find(item => item.id === step.focusSyntaxId);
    const available = step.bankTokenIds ?? step.sourceTokenIds;
    const source = make('div', '', 'reference schema-reference range-source');
    for (const id of step.sourceTokenIds) {
      const token = tokenById(id);
      source.append(make('strong', token.text, `schema-word${selected.includes(id) ? ' is-selected' : ''}`), document.createTextNode(' '));
    }
    const bank = make('div', '', 'bank schema-bank');
    for (const id of available) {
      const token = tokenById(id);
      if (token.kind === 'punctuation' || selected.includes(id)) continue;
      const initial = token.text[0]?.toLowerCase();
      const chip = button('', () => chooseRangeToken(step, id), `schema-choice${id === floatedId ? ' is-floated chunk-rising' : ''}`);
      chip.setAttribute('aria-label', `按 ${initial?.toUpperCase()} 选择 ${token.text}`);
      chip.append(make('span', token.text[0], 'shortcut-letter'), document.createTextNode(token.text.slice(1)));
      bank.append(chip);
    }
    activity.append(make('p', syntax.role, 'range-role'), source, drawSyntax(step, selected), bank);
  }

  function renderTeach(step) {
    activity.append(make('div', '', 'reference schema-reference'));
    const sentence = activity.lastChild;
    sentence.style.display = 'block';
    step.targetTokenIds.forEach((id, index) => {
      const token = tokenById(id);
      if (index > 0 && token.kind !== 'punctuation') sentence.append(document.createTextNode(' '));
      sentence.append(make('strong', token.text));
    });
    activity.append(drawSyntax(step, step.targetTokenIds));
    activity.append(make('p', step.explanation, 'schema-explanation'));
    revealNext();
  }

  function renderTransform(step) {
    if (step.instruction && !teachingBoard) activity.append(make('p', step.instruction, 'schema-explanation'));
    const source = make('div', '', 'reference schema-reference');
    for (const [index, id] of step.sourceTokenIds.entries()) {
      const operationIndex = step.operations.findIndex(item => (item.type === 'insert' ? item.anchorId : item.from[0]) === id);
      const operation = step.operations[operationIndex];
      source.append(button(tokenById(id).text, () => {
        if (!operation) return;
        activateTransform(step, operation);
      }, `schema-word${operation && operationIndex === transformFocus ? ' is-focused' : ''}${id === floatedId ? ' chunk-rising' : ''}${operation ? ' is-actionable' : ''}`), document.createTextNode(' '));
      if (tokenById(id).kind === 'punctuation') source.lastChild.remove();
      else if (step.sourceTokenIds[index + 1] && tokenById(step.sourceTokenIds[index + 1]).kind === 'punctuation') source.lastChild.remove();
    }
    activity.append(source);
    if (transformFocus !== null) {
      const operation = step.operations[transformFocus];
      if (operation.type === 'insert') (teachingBoard ?? activity).append(make('p', `在 ${tokenById(operation.anchorId).text} ${operation.position === 'after' ? '后' : '前'}加入词块`, 'schema-explanation'));
      const choices = make('div', '', 'bank schema-bank');
      for (const id of operation.to) {
        const token = tokenById(id);
        const choice = button('', () => chooseTransformToken(step, operation, id), `schema-choice${id === floatedId ? ' is-floated chunk-rising' : ''}`);
        choice.dataset.shortcut = token.text[0].toLowerCase();
        choice.append(make('span', token.text[0], 'shortcut-letter'), document.createTextNode(token.text.slice(1)));
        choices.append(choice);
      }
      if (operation.to.length) activity.append(choices);
      if (operation.explanation) activity.append(make('p', operation.explanation, 'schema-explanation'));
    }
  }

  function renderOutput(step) {
    const input = make('input');
    input.type = 'text'; input.id = 'schema-answer'; input.autocomplete = 'off';
    input.setAttribute('aria-label', '输入英文句子');
    const submit = () => {
      if (!input.value.trim()) { announce(''); return; }
      const accepted = step.acceptedAnswers.some(answer => normalize(answer) === normalize(input.value));
      record(step, input.value, accepted ? 'correct' : 'unmatched');
      if (accepted) {
        const attempt = run.attempts.at(-1);
        if (reviewMode) {
          review.schedule({ lessonId: lesson.id, lessonVersion: lesson.version, stepId: step.id, independentCorrect: attempt.independent, allowAssisted: step.scheduleAssistedReview });
          reviewMode = false; reviewComplete = true;
          refreshReviewEntry();
          render();
          return;
        }
        if (step.phase === 'transfer' && (attempt.independent || step.scheduleAssistedReview)) {
          review.schedule({ lessonId: lesson.id, lessonVersion: lesson.version, stepId: step.id, independentCorrect: attempt.independent, allowAssisted: step.scheduleAssistedReview });
          refreshReviewEntry();
        }
        run = completeStep(run, lesson, step.id); persist(); finished = step.id === lesson.steps.at(-1).id;
        render(); revealNext();
      } else {
        run = { ...run, exposure: { ...run.exposure, hint: true } }; persist();
        announce('这次没有匹配到本课目标。可以修改后再提交。', 'error');
      }
    };
    input.onkeydown = event => {
      if (event.key === 'Enter' && !event.isComposing && !event.nativeEvent?.isComposing) { event.preventDefault(); submit(); }
    };
    activity.append(input, button('检查', submit, 'schema-submit'));
    if (step.hintText || step.allowUnknownResponse) {
      const support = make('div', '', 'schema-support');
      if (step.hintText) {
        const hint = make('p', step.hintText, 'schema-hint'); hint.hidden = !hintShown;
        support.append(button('提示', () => {
          hintShown = true; run = exposeSupport(run, 'hint'); persist(); hint.hidden = false;
        }, 'schema-support-button'), hint);
      }
      if (step.allowUnknownResponse) support.append(button('暂时不会', () => {
        record(step, null, 'unknown');
        run = exposeSupport(run, 'hint'); persist();
        announce('已记为“暂时不会”，不是答错；可以看提示后再试。');
      }, 'schema-support-button'));
      activity.append(support);
    }
    input.focus();
  }

  function render() {
    if (!lesson || !run) return;
    if (teachingBoard) {
      teachingBoard.hidden = false;
      teachingBoard.classList.remove('is-prompt', 'has-visual');
      teachingBoard.replaceChildren();
      const step = currentStep();
      teachingBoard.append(make('h2', step.meaning, 'blackboard-title blackboard-instruction'));
      if (step.instruction) teachingBoard.append(make('p', step.instruction, 'blackboard-question blackboard-instruction'));
    }
    activity.replaceChildren();
    announce('');
    const step = currentStep();
    if (!warningShown && review.warning) { announce(review.warning); warningShown = true; }
    progress.textContent = finished ? '完成' : `${lesson.steps.findIndex(item => item.id === step.id) + 1} / ${lesson.steps.length}`;
    next.hidden = !finished;
    next.textContent = finished ? '再练一遍' : '继续';
    if (reviewMode || step.hideHistory || ['independent-output', 'delayed-review'].includes(step.activity)) {
      trail.replaceChildren(); trail.hidden = true;
    } else drawTrail();
    if (!teachingBoard) activity.append(make('h2', step.meaning, 'target-meaning'));
    if (reviewComplete || finished) {
      const lastAttempt = [...run.attempts].reverse().find(attempt => attempt.stepId === step.id);
      activity.append(make('p', lastAttempt?.response ?? '', 'reference schema-result'));
      if (step.showEvidence && lastAttempt) activity.append(make('p', lastAttempt.independent ? '独立完成' : '有提示或反馈支持后完成', 'schema-evidence'));
      if (step.syntax) activity.append(drawSyntax(step, step.targetTokenIds));
      if (reviewComplete) progress.textContent = '复习完成';
      return;
    }
    if (step.activity === 'compose') renderCompose(step);
    else if (step.activity === 'teach') renderTeach(step);
    else if (step.activity === 'transform') renderTransform(step);
    else if (step.activity === 'range-identify') renderRangeIdentify(step);
    else if (['independent-output', 'delayed-review'].includes(step.activity)) renderOutput(step);
  }

  async function openNode(id, lessonId) {
    try {
      lesson = await loadNodeLesson(id, lessonId);
      validateLessonV3(lesson);
      run = restoreRun(review.getSession(lesson.id), lesson) ?? createRun(lesson);
      selected = []; keyboard = createKeyboardState(); floatedId = null; transformFocus = null; finished = false; reviewMode = false; reviewComplete = false; hintShown = false;
      if (run.completedStepIds.includes(lesson.steps.at(-1).id)) finished = true;
      if (!run.completedStepIds.length) run = createRun(lesson);
      persist(); render(); refreshReviewEntry();
    } catch (error) {
      lesson = null; run = null;
      activity.replaceChildren(make('p', error.message || '课程暂时无法加载。'));
      trail.replaceChildren(); trail.hidden = true; next.hidden = true;
    }
  }

  function close() {
    if (reviewTimer !== null) window.clearTimeout(reviewTimer);
    reviewTimer = null;
    lesson = null; run = null; selected = []; keyboard = createKeyboardState(); floatedId = null;
    transformFocus = null; finished = false; reviewMode = false; reviewComplete = false; hintShown = false;
  }

  function mountCatalog(select) {
    const groups = new Map();
    for (const node of catalog) {
      const groupLabel = `课程节点 PB${String(Math.floor((Number(node.id.slice(2)) - 1) / 5) * 5 + 1).padStart(2, '0')}–PB${String(Math.floor((Number(node.id.slice(2)) - 1) / 5) * 5 + 5).padStart(2, '0')}`;
      if (!groups.has(groupLabel)) {
        const group = document.createElement('optgroup'); group.label = groupLabel; groups.set(groupLabel, group); select.append(group);
      }
      const lessonIds = getNodeLessonIds(node.id);
      if (lessonIds.length) {
        for (const lessonId of lessonIds) {
          const label = getNodeLessonLabel(node.id, lessonId);
          const option = make('option', `${node.id} · ${node.title} — ${label}${node.status === 'draft' ? '（部分预览）' : ''}`);
          option.value = lessonIds.length === 1 ? `node:${node.id}` : `node:${node.id}:${lessonId}`;
          if (node.id === 'PB01' && lessonId === 'pb01-subject-predicate-v1') option.hidden = true;
          groups.get(groupLabel).append(option);
        }
      } else {
        const option = make('option', `${node.id} · ${node.title}（待制作）`);
        option.value = `node:${node.id}`; option.disabled = node.status === 'planned';
        groups.get(groupLabel).append(option);
      }
    }
    refreshReviewEntry();
  }

  function refreshReviewEntry() {
    const due = review.dueReviews();
    if (!reviewEntry) return;
    if (reviewTimer != null) clearTimeout(reviewTimer);
    reviewTimer = null;
    reviewEntry.hidden = due.length === 0;
    reviewEntry.textContent = `复习（${due.length}）`;
    if (due.length) return;
    const nextDue = Object.values(review.snapshot().reviews)
      .filter(item => item.status === 'scheduled')
      .map(item => item.dueAt)
      .sort((left, right) => left - right)[0];
    if (nextDue != null) reviewTimer = setTimeout(refreshReviewEntry, Math.max(1, nextDue - Date.now() + 1));
  }

  async function startDueReview() {
    const due = review.dueReviews()[0];
    if (!due) return;
    const owner = catalog.find(node => getNodeLessonIds(node.id).includes(due.lessonId));
    if (!owner) { reviewEntry.hidden = true; return; }
    if (lesson?.id !== due.lessonId) await openNode(owner.id, due.lessonId);
    const step = lesson.steps.find(item => item.id === due.stepId);
    if (!step || step.activity !== 'independent-output') return;
    reviewMode = true; finished = false; selected = []; keyboard = createKeyboardState();
    reviewComplete = false;
    run = { ...run, currentStepId: step.id };
    render();
    progress.textContent = '复习';
  }

  function handleKey(event) {
    if (!lesson || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing || event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return false;
    const step = currentStep();
    if (!step) return false;
    if (event.key === 'Escape') {
      keyboard = cancelChunkCandidate(keyboard); floatedId = null;
      if (step.activity === 'transform' && transformFocus !== null) { transformFocus = null; selected = []; }
      render(); return true;
    }
    if (event.key === 'Enter' && keyboard.candidateIndex >= 0) {
      const result = confirmChunkCandidate(keyboard); keyboard = result.state; floatedId = null;
      if (result.candidate && step.activity === 'compose') chooseToken(step, result.candidate.id);
      else if (result.candidate && step.activity === 'range-identify') chooseRangeToken(step, result.candidate.id);
      else if (result.candidate && step.activity === 'transform') {
        const operation = step.operations.find(item => (item.type === 'insert' ? item.anchorId : item.from[0]) === result.candidate.id);
        if (operation) activateTransform(step, operation);
      }
      return true;
    }
      if (event.key === 'Backspace' && ['compose', 'range-identify'].includes(step.activity) && selected.length) {
      selected.pop(); floatedId = null; keyboard = createKeyboardState(); announce(''); render(); return true;
    }
    if (/^[a-z]$/i.test(event.key) && step.activity === 'compose') {
      const candidates = (step.bankTokenIds ?? step.targetTokenIds).filter(id => !selected.includes(id) && tokenById(id).kind === 'word').map(id => ({ id, initial: tokenById(id).text[0] }));
      const result = handleChunkKey(keyboard, event.key, candidates);
      keyboard = result.state; floatedId = result.candidate?.id ?? null;
      if (result.action === 'select') chooseToken(step, result.candidate.id); else render();
      return true;
    }
    if (/^[a-z]$/i.test(event.key) && step.activity === 'range-identify') {
      const candidates = (step.bankTokenIds ?? step.sourceTokenIds).filter(id => !selected.includes(id) && tokenById(id).kind === 'word').map(id => ({ id, initial: tokenById(id).text[0] }));
      const result = handleChunkKey(keyboard, event.key, candidates);
      keyboard = result.state; floatedId = result.candidate?.id ?? null;
      if (result.action === 'select') chooseRangeToken(step, result.candidate.id); else render();
      return true;
    }
    if (/^[a-z]$/i.test(event.key) && step.activity === 'transform') {
      const candidates = transformFocus !== null
        ? step.operations[transformFocus].to.filter(id => !selected.includes(id)).map(id => ({ id, initial: tokenById(id).text[0] }))
        : step.operations.map(item => item.type === 'insert' ? item.anchorId : item.from[0]).map(id => ({ id, initial: tokenById(id).text[0] }));
      const result = handleChunkKey(keyboard, event.key, candidates);
      keyboard = result.state; floatedId = result.candidate?.id ?? null;
      if (result.action === 'select') {
        if (transformFocus !== null) chooseTransformToken(step, step.operations[transformFocus], result.candidate.id);
        else {
          const operation = step.operations.find(item => (item.type === 'insert' ? item.anchorId : item.from[0]) === result.candidate.id);
          if (operation) activateTransform(step, operation);
        }
      } else render();
      return true;
    }
    if (event.key === 'Enter' && !next.hidden && finished) return false;
    return false;
  }

  function advance() {
    if (!lesson) return false;
    if (finished) {
      run = createRun(lesson); finished = false; selected = []; persist(); render(); return true;
    }
    const step = currentStep();
    if (step?.activity !== 'teach') return false;
    run = completeStep(run, lesson, step.id); persist(); render(); return true;
  }

  return { mountCatalog, openNode, close, handleKey, advance, startDueReview, get active() { return Boolean(lesson); } };
}
