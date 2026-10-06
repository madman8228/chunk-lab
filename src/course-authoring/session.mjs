import { CourseCreationPreferences } from './preferences.mjs';

const allowedStages = new Set(['setup', 'waiting-result', 'needs-fix', 'preview', 'saving', 'saved', 'joining', 'complete']);

export class AuthoringSession {
  constructor(snapshot) {
    if (!snapshot || !snapshot.sessionId || !snapshot.identity || !allowedStages.has(snapshot.stage)) throw new Error('制作会话数据不完整');
    this.snapshot = Object.freeze({ ...snapshot });
  }

  transition(event, patch = {}) {
    const transitions = {
      copySucceeded: { setup: 'waiting-result' },
      acceptResult: { setup: 'preview', 'waiting-result': 'preview', 'needs-fix': 'preview', preview: 'preview' },
      validationFailed: { setup: 'needs-fix', 'waiting-result': 'needs-fix', 'needs-fix': 'needs-fix', preview: 'needs-fix' },
      beginSave: { preview: 'saving' }, saveSucceeded: { saving: 'saved' }, beginJoin: { saved: 'joining' },
      joinSucceeded: { joining: 'complete' }, saveFailed: { saving: 'preview' }, joinFailed: { joining: 'saved' },
      revisePrompt: { 'waiting-result': 'waiting-result', 'needs-fix': 'waiting-result', preview: 'waiting-result' },
      backToSetup: { 'waiting-result': 'setup', 'needs-fix': 'setup' }
    };
    const nextStage = transitions[event] && transitions[event][this.snapshot.stage];
    if (!nextStage) { const error = /** @type {Error & {code:string}} */ (new Error(`不能从 ${this.snapshot.stage} 执行 ${event}`)); error.code = 'INVALID_TRANSITION'; throw error; }
    const next = new AuthoringSession({ ...this.snapshot, ...patch, stage: nextStage, revision: this.snapshot.revision + 1, updatedAt: Date.now() });
    return next;
  }

  value() { return { ...this.snapshot }; }

  updateBrief(brief) {
    if (['saving', 'saved', 'joining', 'complete'].includes(this.snapshot.stage)) throw new Error('这份课程已保存。请新建改编草稿再修改需求。');
    return new AuthoringSession({ ...this.snapshot, brief: String(brief || '').slice(0, 1200), rawResult: '', validatedDraft: null, compiledCourse: null, validationReport: null, revision: this.snapshot.revision + 1, updatedAt: Date.now() });
  }

  updatePreferences(preferences) {
    if (['saving', 'saved', 'joining', 'complete'].includes(this.snapshot.stage)) throw new Error('这份课程已保存。请新建改编草稿再修改方案。');
    return new AuthoringSession({ ...this.snapshot, preferences: CourseCreationPreferences.normalize(preferences), rawResult: '', validatedDraft: null, compiledCourse: null, validationReport: null, lastError: null, revision: this.snapshot.revision + 1, updatedAt: Date.now() });
  }

  static create({ sessionId, courseId, identity, sourceCourseId = '', now = Date.now() }) {
    if (!sessionId || !courseId || !identity) throw new Error('创建制作会话需要会话 ID、课程 ID 和账号作用域');
    return new AuthoringSession({ sessionVersion: 1, sessionId, courseId, identity, sourceCourseId, revision: 0, stage: 'setup', brief: '', preferences: CourseCreationPreferences.defaults(), rawResult: '', validatedDraft: null, validationReport: null, saveReceipt: null, lastError: null, updatedAt: now });
  }
}
