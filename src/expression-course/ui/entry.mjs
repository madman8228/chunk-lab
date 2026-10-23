import { renderActivity } from './renderers.mjs';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const returnHref = window.CourseReturn.destination();
window.CourseReturn.bind(document.querySelector('.back-link'), { href: returnHref });
const courseId = params.get('course') || '';
let lessonId = params.get('lesson') || '';
let courseLessons = [];
let courseProgress = null;
const status = $('courseStatus'), body = $('activityBody'), footer = $('activityActions');
let current = null, accessSessionId = null, heartbeat = null, sequence = 0, audio = null, busy = false, pendingActionRequest = null;
const requestId = () => crypto.randomUUID();
const setStatus = value => { status.textContent = value; };
const accessMessages = {
  AUTHORIZATION_EXPIRED: '学习权限已到期。已完成的步骤会保留；当前答案尚未提交，请恢复权限后继续。',
  SESSION_EXPIRED: '本次学习时段已结束。已完成的步骤会保留；当前答案尚未提交，请重新进入课程。',
  TRIAL_EXPIRED: '体验已结束。已完成的步骤会保留；恢复学习权限后可继续。',
  TRIAL_DAILY_LIMIT: '今日学习时长已用完。已完成的步骤会保留，之后可继续。',
  MEMBERSHIP_REQUIRED: '当前课程需要有效学习权限。已完成的步骤会保留，获得权限后可继续。'
};
const fail = error => { setStatus(error?.code === 'SESSION_CHANGED' ? '登录账号已切换，请重新打开课程。' : accessMessages[error?.code] || error?.message || '暂时无法连接，请检查网络后重试。'); };

async function start() {
  $('retryCourse').hidden = true;
  $('retryCourse').onclick = start;
  if (!window.ChunkAPI?.isLoggedIn()) { $('courseIntro').textContent = '请先登录，再开始学习。'; setStatus('可以返回首页登录后重新进入课程。'); return; }
  $('courseIntro').textContent = '正在读取课程…';
  $('courseTitle').setAttribute('aria-busy', 'true');
  try {
    const meta = await ChunkAPI.request('/api/expression-courses/' + encodeURIComponent(courseId), { timeoutMs: 15000 });
    $('lessonCards').replaceChildren();
    courseLessons = meta.lessons;
    courseProgress = meta.progress;
    const lesson = meta.lessons.find(item => item.lessonId === lessonId) || (!lessonId ? meta.lessons.find(item => item.lessonId === courseProgress?.nextLessonId) || meta.lessons[0] : null);
    if (!lesson) throw new Error('找不到这节课程。');
    lessonId = lesson.lessonId;
    $('courseTitle').textContent = params.has('lesson') ? meta.title + ' · ' + lesson.title : meta.title;
    $('courseIntro').textContent = params.has('lesson') ? lesson.communicationGoal : meta.description || '按单元逐步练习，完成每一步后自动保存学习进度。';
    if (!params.has('lesson') && !params.has('mode')) {
      $('expressionLearning').classList.add('course-overview');
      $('overviewProgress').hidden = false;
      $('overviewProgressText').textContent = `${courseProgress?.percent || 0}% · 已完成 ${courseProgress?.completed || 0} / ${meta.lessons.length} 单元`;
      $('overviewProgressBar').value = courseProgress?.percent || 0;
      $('courseDirectory').hidden = false;
      $('courseLabels').hidden = false;
      const minutes = meta.lessons.reduce((sum,unit)=>sum+unit.activityCount,0);
      $('courseDuration').textContent = `预计 ${Math.round(minutes*.7)}–${Math.round(minutes*1.3)} 分钟（按练习量估算）`;
      const wrongIds = new Set(courseProgress?.wrongLessonIds || []);
      $('reviewWrongUnits').hidden = false;
      $('reviewWrongUnits').textContent = `复习错题单元（${wrongIds.size}）`;
      $('reviewWrongUnits').disabled = wrongIds.size === 0;
      $('wrongReviewHelp').hidden = false;
      let indexedUnit = null;
      let wrongOnly = false;
      const indexPanel = document.createElement('nav'); indexPanel.className = 'unit-quick-index'; indexPanel.setAttribute('aria-label','章节快速索引');
      const indexHeading = document.createElement('h2'); indexHeading.textContent = '章节快速索引'; indexPanel.append(indexHeading);
      $('courseDirectory').querySelector('.unit-quick-index')?.remove();
      $('courseDirectory').prepend(indexPanel);
      const indexButtons = [];
      $('directorySummary').textContent = `共 ${meta.lessons.length} 个单元，已完成 ${courseProgress?.completed || 0} 个 · 总进度 ${courseProgress?.percent || 0}%。选择单元开始或继续学习。`;
      for (const [index, unit] of meta.lessons.entries()) {
        const unitProgress = courseProgress?.lessons.find(item => item.lessonId === unit.lessonId);
        const stateLabel = unitProgress?.status === 'completed' ? '已完成' : unitProgress?.status === 'in_progress' ? `学习中 ${unitProgress.percent}%` : '未开始';
        const shared = window.LessonCard.create({ title: unit.title, index: index + 1,
          image: window.CourseCovers.fallback({ id: courseId + ':' + unit.lessonId }),
          meta: `${unit.activityCount} 个练习 · ${stateLabel}` });
        const card = document.createElement('a'); card.className = shared.card.className;
        card.dataset.status = unitProgress?.status || 'not_started';
        card.dataset.lessonId = unit.lessonId;
        card.dataset.search = (unit.title + ' ' + (unit.communicationGoal || '')).toLowerCase();
        card.append(...shared.card.childNodes);
        window.LessonCard.setStatus(card,unitProgress?.status || 'not_started',unitProgress?.percent || 0);
        const goal = document.createElement('p'); goal.className = 'unit-goal'; goal.textContent = unit.communicationGoal || '';
        card.insertBefore(goal, shared.footer);
        card.setAttribute('aria-label', `第 ${index + 1} 单元：${unit.title}。${unit.communicationGoal || ''}`);
        card.title = unit.communicationGoal || unit.title;
        const query = new URLSearchParams({ course: courseId, lesson: unit.lessonId });
        const directory = 'expression-learn.html?' + new URLSearchParams({ course: courseId, returnTo: returnHref });
        card.href = window.CourseReturn.forward('expression-learn.html?' + query, directory);
        $('lessonCards').append(card);
        const indexButton = document.createElement('button'); indexButton.type = 'button'; indexButton.textContent = `${index+1}. ${unit.title}`;
        const indexState = document.createElement('small'); indexState.textContent = stateLabel; indexButton.append(indexState); indexButton.setAttribute('aria-pressed','false');
        indexButton.onclick = () => { indexedUnit = indexedUnit === unit.lessonId ? null : unit.lessonId; indexButtons.forEach(item=>item.button.setAttribute('aria-pressed',String(item.id===indexedUnit))); filterUnits(); };
        indexButtons.push({button:indexButton,id:unit.lessonId}); indexPanel.append(indexButton);
      }
      const total = meta.lessons.length, done = courseProgress?.completed || 0;
      $('unitFilters').querySelector('[data-filter=all]').textContent = `全部（${total}）`;
      $('unitFilters').querySelector('[data-filter=unfinished]').textContent = `未完成（${total-done}）`;
      $('unitFilters').querySelector('[data-filter=completed]').textContent = `已完成（${done}）`;
      let activeFilter = 'all';
      const filterUnits = () => {
        const query = $('unitSearch').value.trim().toLowerCase(); let visible = 0;
        for (const card of $('lessonCards').children) {
          const matches = (!indexedUnit || card.dataset.lessonId===indexedUnit) && (!wrongOnly || wrongIds.has(card.dataset.lessonId)) && card.dataset.search.includes(query) && (activeFilter === 'all' || (activeFilter === 'completed' ? card.dataset.status === 'completed' : card.dataset.status !== 'completed'));
          card.hidden = !matches; if (matches) visible++;
        }
        $('unitEmpty').hidden = visible > 0;
      };
      $('unitSearch').oninput = filterUnits;
      $('reviewWrongUnits').onclick = () => { wrongOnly=!wrongOnly; indexedUnit=null; activeFilter='all'; $('unitSearch').value=''; indexButtons.forEach(item=>item.button.setAttribute('aria-pressed','false')); $('reviewWrongUnits').textContent=wrongOnly?'显示全部单元':`复习错题单元（${wrongIds.size}）`; filterUnits(); $('courseDirectory').scrollIntoView({block:'start'}); };
      $('unitFilters').querySelectorAll('button').forEach(button => { button.onclick = () => { activeFilter = button.dataset.filter; $('unitFilters').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button))); filterUnits(); }; });
    }
    $('startButton').hidden = false;
    if (!params.has('lesson') && courseProgress?.lessons.some(item => item.status === 'in_progress')) $('startButton').textContent = '继续学习';
    const requestedMode = params.get('mode') === 'review' ? 'review' : 'learn';
    const requested = { mode: requestedMode, reviewSkillId: params.get('skill') || undefined,
      reviewActivityId: params.get('activity') || undefined, releaseId: params.get('release') || undefined };
    if (requestedMode === 'review') $('startButton').textContent = '开始复习';
    $('startButton').onclick = () => beginSession(requested);
    if (!params.has('mode')) await loadDueReviews();
    setStatus('准备好了就点“开始学习”。');
  } catch (error) {
    $('courseIntro').textContent = '课程暂时未能加载。';
    $('retryCourse').hidden = false;
    fail(error);
  } finally { $('courseTitle').removeAttribute('aria-busy'); }
}

async function beginSession({ mode, reviewSkillId, reviewActivityId, releaseId, lessonId: targetLessonId = lessonId } = {}) {
      $('startButton').disabled = true;
      try {
        const unitId = 'lesson-' + targetLessonId;
        const access = await ChunkAPI.request('/api/learning-sessions/start', { method: 'POST', body: JSON.stringify({
          courseId, unitId, requestId: requestId(), cursor: 0
        }) });
        if (!access.allowed) throw Object.assign(new Error(access.reasonCode || '当前暂时无法进入这门课'), { code: access.reasonCode });
        accessSessionId = access.sessionId || null;
        current = await ChunkAPI.request('/api/expression-sessions', { method: 'POST', body: JSON.stringify({
          courseId, lessonId: targetLessonId, mode, accessSessionId, requestId: requestId(), reviewSkillId, reviewActivityId, releaseId
        }) });
        const selectedLesson = courseLessons.find(item => item.lessonId === targetLessonId);
        $('courseDirectory').hidden = true;
        $('overviewProgress').hidden = true;
        if (selectedLesson) $('courseTitle').textContent = selectedLesson.title;
        render();
        if (accessSessionId) heartbeat = setInterval(ping, 30000);
      } catch (error) { fail(error); $('startButton').disabled = false; }
}

async function loadDueReviews() {
  try {
    const { items } = await ChunkAPI.request('/api/expression-reviews/due');
    const due = items.filter(item => item.courseId === courseId);
    if (!due.length) return;
    const list = $('dueReviewList'); $('dueReviews').hidden = false;
    for (const item of due) {
      const button = document.createElement('button'); button.className = 'button button-secondary'; button.type = 'button';
      button.textContent = '复习：' + item.title;
      button.onclick = () => { history.replaceState(null, '', `?course=${encodeURIComponent(item.courseId)}&lesson=${encodeURIComponent(item.lessonId)}&mode=review&skill=${encodeURIComponent(item.skillId)}&activity=${encodeURIComponent(item.activityId)}&release=${encodeURIComponent(item.releaseId)}`); beginSession({ mode: 'review', lessonId: item.lessonId, reviewSkillId: item.skillId, reviewActivityId: item.activityId, releaseId: item.releaseId }); };
      list.append(button);
    }
  } catch (_) { /* Due review is supplementary; course start remains available. */ }
}

async function ping() {
  if (!accessSessionId || !current || !ChunkAPI?.isLoggedIn()) return;
  try { await ChunkAPI.request('/api/learning-sessions/' + encodeURIComponent(accessSessionId) + '/heartbeat', { method: 'POST', body: JSON.stringify({ sequence: ++sequence }) }); }
  catch (error) { clearInterval(heartbeat); heartbeat = null; fail(error); }
}

function render() {
  if (!current) return;
  const state = current.state;
  $('startButton').hidden = true;
  $('activityCard').hidden = false;
  $('progressLabel').textContent = state.completed ? '本节完成' : `第 ${state.index + 1} 步`;
  $('progressBar').value = state.completed ? 1 : state.index / Math.max(1, current.stepCount || state.index + 1);
  footer.replaceChildren();
  if (state.completed) {
    body.replaceChildren();
    const heading = document.createElement('h2'); heading.textContent = '这节完成了';
    const note = document.createElement('p'); note.textContent = '流程完成和掌握情况分开记录；到期后可以从学习记录进入复习。';
    ChunkAPI.request('/api/expression-courses/' + encodeURIComponent(courseId)).then(meta => {
      if (!note.isConnected || !meta.progress) return;
      note.textContent = meta.progress.completed === meta.progress.total
        ? `全部 ${meta.progress.total} 个单元已完成！可以返回课程目录再次练习，或在到期后复习。`
        : `已完成 ${meta.progress.completed} / ${meta.progress.total} 个单元。可以继续下一单元，或返回课程目录。`;
    }).catch(() => {});
    body.append(heading, note);
    const lessonIndex = courseLessons.findIndex(item => item.lessonId === current.lessonId);
    const nextLesson = current.mode !== 'review' && lessonIndex >= 0 ? courseLessons[lessonIndex + 1] : null;
    if (nextLesson) {
      const next = document.createElement('a'); next.className = 'button button-primary';
      const query = new URLSearchParams({ course: courseId, lesson: nextLesson.lessonId });
      query.set('returnTo', returnHref);
      next.href = '?' + query; next.textContent = '下一课：' + nextLesson.title; body.append(next);
    }
    const back = document.createElement('a'); back.className = 'button ' + (nextLesson ? 'button-secondary' : 'button-primary'); window.CourseReturn.bind(back, { href: returnHref }); body.append(back);
    setStatus('学习进度已保存。'); return;
  }
  const rendered = renderActivity(body, state.activity, { onAction: action => act(action), playAudio });
  if (rendered.informational && state.activity.payload?.audioAssetId) {
    const listen = document.createElement('button'); listen.className = 'button button-secondary'; listen.type = 'button';
    listen.textContent = '播放示范'; listen.onclick = () => playAudio(state.activity.payload.audioAssetId, listen);
    footer.append(listen);
  }
  if (state.revealed && state.revealedAnswer) {
    const answer = document.createElement('p');
    answer.className = 'activity-answer';
    answer.textContent = '参考答案：' + state.revealedAnswer;
    body.append(answer);
  }
  if (rendered.informational || !rendered.autoSubmit) {
    const primary = document.createElement('button'); primary.className = 'button button-primary'; primary.type = 'button';
    primary.textContent = rendered.informational ? '继续' : '检查答案';
    primary.onclick = () => act(rendered.informational ? { type: 'continue' } : { type: 'submit', response: rendered.response() });
    footer.append(primary);
  }
  setStatus(current.result?.feedback || '完成当前这一步即可自动保存。');
}

async function act(action) {
  if (busy || !current) return;
  const actionKey = JSON.stringify([current.sessionId, current.revision, action]);
  if (pendingActionRequest?.key !== actionKey) pendingActionRequest = { key: actionKey, requestId: requestId() };
  busy = true; footer.querySelectorAll('button').forEach(button => button.setAttribute('disabled', ''));
  try {
    current = await ChunkAPI.request('/api/expression-sessions/' + encodeURIComponent(current.sessionId) + '/actions', {
      method: 'POST', headers: accessSessionId ? { 'X-Learning-Session': accessSessionId } : {},
      body: JSON.stringify({ requestId: pendingActionRequest.requestId, expectedRevision: current.revision, action })
    });
    pendingActionRequest = null;
    if (action.type === 'audio_played') setStatus('音频播放完成，可以继续作答。');
    else render();
    return { status: 'success' };
  } catch (error) {
    if (error.code === 'REVISION_CONFLICT') {
      pendingActionRequest = null;
      try { current = await ChunkAPI.request('/api/expression-sessions/' + encodeURIComponent(current.sessionId), { headers: accessSessionId ? { 'X-Learning-Session': accessSessionId } : {} }); render(); }
      catch (reloadError) { fail(reloadError); }
      return { status: 'blocked', message: error.message || '学习进度已更新，请继续。' };
    } else {
      fail(error);
      const blocked = ['AUTHORIZATION_EXPIRED', 'SESSION_EXPIRED', 'TRIAL_EXPIRED', 'TRIAL_DAILY_LIMIT', 'MEMBERSHIP_REQUIRED', 'SESSION_CHANGED'].includes(error?.code);
      return { status: blocked ? 'blocked' : 'retryable-error', message: error?.message || '暂时无法连接，请检查网络后重试。' };
    }
  } finally { busy = false; footer.querySelectorAll('button').forEach(button => button.removeAttribute('disabled')); }
}

async function playAudio(assetId, button) {
  if (!assetId || !current) return;
  button.disabled = true;
  try {
    const url = `${ChunkAPI.getBase()}/api/expression-courses/${encodeURIComponent(courseId)}/releases/${encodeURIComponent(current.releaseId)}/assets/${encodeURIComponent(assetId)}`;
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + ChunkAPI.getToken(), ...(accessSessionId ? { 'X-Learning-Session': accessSessionId } : {}) }, cache: 'no-store' });
    if (!response.ok) throw new Error('音频暂时无法播放，请稍后重试。');
    if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); }
    const source = URL.createObjectURL(await response.blob()); audio = new Audio(source); await audio.play();
    await act({ type: 'audio_played' });
  } catch (error) { fail(error); } finally { button.disabled = false; }
}

window.addEventListener('pagehide', () => {
  if (heartbeat) clearInterval(heartbeat);
  if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); }
  if (accessSessionId && ChunkAPI?.isLoggedIn()) ChunkAPI.request('/api/learning-sessions/' + encodeURIComponent(accessSessionId) + '/end', { method: 'POST', body: JSON.stringify({ sequence: ++sequence }) }).catch(() => {});
});
if (!courseId) setStatus('课程地址无效。'); else start();
