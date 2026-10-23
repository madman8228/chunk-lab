import { createExpressionState, publicExpressionState, transitionExpression } from '../src/expression-course/runtime.mjs';
import { renderActivity } from '../src/expression-course/ui/renderers.mjs';

const $ = id => document.getElementById(id);
const start = $('startButton');
const card = $('activityCard');
const body = $('activityBody');
const footer = $('activityActions');
const status = $('courseStatus');
const audioFiles = { l001_tea: 'expression-course-review-l001-tea.wav', l001_coffee: 'expression-course-review-l001-coffee.wav' };
let lesson = null;
let state = null;
let audio = null;

function apply(action) {
  const result = transitionExpression(state, action);
  state = result.state;
  const message = result.result.feedback || result.result.hint || (result.result.kind === 'revealed' ? '已显示参考答案。' : '');
  render(message);
}

function playAudio(assetId, button) {
  const file = audioFiles[assetId];
  if (!file) {
    status.textContent = '这句音频暂不可用。';
    return;
  }
  if (audio) audio.pause();
  audio = new Audio(`/assets/${file}`);
  button.disabled = true;
  status.textContent = '正在播放音频…';
  audio.addEventListener('ended', () => { button.disabled = false; status.textContent = '听完后继续完成这一步。'; }, { once: true });
  audio.addEventListener('error', () => { button.disabled = false; status.textContent = '音频暂时无法播放，请稍后重试。'; }, { once: true });
  audio.play().catch(() => { button.disabled = false; status.textContent = '音频暂时无法播放，请检查浏览器设置。'; });
}

function render(message = '') {
  const view = publicExpressionState(state);
  $('lessonStart').hidden = true;
  card.hidden = false;
  $('progressLabel').textContent = view.completed ? '本节完成' : `第 ${view.index + 1} 步，共 ${lesson.activities.length} 步`;
  $('progressBar').value = view.completed ? 1 : view.index / lesson.activities.length;
  footer.replaceChildren();

  if (view.completed) {
    body.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = '体验完成';
    const note = document.createElement('p');
    note.textContent = '你已经走完这节课的全部步骤。';
    body.append(heading, note);
    const replay = document.createElement('button');
    replay.type = 'button';
    replay.className = 'button button-primary';
    replay.textContent = '再体验一次';
    replay.addEventListener('click', () => { state = createExpressionState(lesson); render('准备好了就继续。'); });
    footer.append(replay);
    status.textContent = '演示结束；没有保存学习记录。';
    return;
  }

  const activity = view.activity;
  const rendered = renderActivity(body, activity, {
    onAction: apply,
    playAudio,
  });
  if (activity.type === 'meaning_intro' && activity.payload.audioAssetId) {
    const listen = document.createElement('button');
    listen.type = 'button';
    listen.className = 'button button-secondary';
    listen.textContent = '播放示范';
    listen.addEventListener('click', () => playAudio(activity.payload.audioAssetId, listen));
    body.append(listen);
  }
  if (view.revealedAnswer) {
    const answer = document.createElement('p');
    answer.className = 'activity-answer';
    answer.textContent = `参考答案：${view.revealedAnswer}`;
    body.append(answer);
  }

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'button button-primary';
  next.textContent = rendered.informational ? '继续' : '检查答案';
  next.addEventListener('click', () => apply(rendered.informational
    ? { type: 'continue' }
    : { type: 'submit', response: rendered.response() }));
  footer.append(next);
  status.textContent = message || '完成当前这一步即可继续。';
}

start.addEventListener('click', async () => {
  start.disabled = true;
  status.textContent = '正在准备课程…';
  try {
    const response = await fetch('/src/expression-course/fixtures/L001-like.reference.json');
    if (!response.ok) throw new Error('课程暂时无法读取。');
    lesson = await response.json();
    state = createExpressionState(lesson);
    render('准备好了就开始。');
  } catch (error) {
    status.textContent = error.message || '课程暂时无法读取，请刷新页面重试。';
    start.disabled = false;
  }
});

status.textContent = '这是可操作的学习流程演示，不会记录进度。';
