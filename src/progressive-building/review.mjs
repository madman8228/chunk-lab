import { PREVIEW_STORAGE_KEY } from './runtime.mjs';

const EMPTY = () => ({ schemaVersion: 1, sessions: {}, reviews: {} });

export function createReviewStore(storage, now = () => Date.now()) {
  let state = EMPTY();
  let persistent = Boolean(storage);
  let warning = storage ? '' : '浏览器不支持保存；本次可继续学习，刷新后进度不会保留。';

  if (storage) {
    try {
      const raw = storage.getItem(PREVIEW_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.schemaVersion === 1 && parsed.sessions && parsed.reviews) state = parsed;
        else { persistent = false; warning = '预览记录格式无法识别；原数据保留，本次使用临时进度。'; }
      }
    } catch {
      persistent = false;
      warning = '预览记录无法读取；原数据保留，本次使用临时进度。';
    }
  }

  function save(next) {
    state = next;
    if (!persistent) return;
    try { storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(state)); }
    catch { persistent = false; warning = '浏览器未允许保存；本次可继续学习，刷新后进度不会保留。'; }
  }

  return {
    get persistent() { return persistent; },
    get warning() { return warning; },
    snapshot() { return structuredClone(state); },
    saveSession(lessonId, session) {
      save({ ...state, sessions: { ...state.sessions, [lessonId]: session } });
    },
    getSession(lessonId) { return state.sessions[lessonId] ?? null; },
    schedule({ lessonId, lessonVersion, stepId, independentCorrect, allowAssisted = false }) {
      const previous = state.reviews[`${lessonId}:${stepId}`];
      if (!independentCorrect && !allowAssisted) return previous ?? null;
      const successfulIndependentReviews = independentCorrect ? (previous?.successfulIndependentReviews ?? 0) + 1 : 0;
      const delay = independentCorrect && successfulIndependentReviews > 1 ? 3 : 1;
      const review = {
        lessonId, lessonVersion, stepId, successfulIndependentReviews,
        dueAt: now() + delay * 24 * 60 * 60 * 1000,
        status: 'scheduled', assisted: !independentCorrect,
      };
      save({ ...state, reviews: { ...state.reviews, [`${lessonId}:${stepId}`]: review } });
      return review;
    },
    dueReviews() {
      return Object.values(state.reviews).filter(review => review.status === 'scheduled' && review.dueAt <= now());
    },
  };
}
