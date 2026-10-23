import assert from 'node:assert/strict';
import { NativeCourseSession } from './native-course-session.mjs';

const noop = () => {};
const nodes = [];
const doc = { visibilityState: 'visible', createElement(tag) { const node = { tag, children: [], hidden: false, append(...items) { this.children.push(...items); }, prepend(...items) { this.children.unshift(...items); }, after(item) { nodes.push(item); }, setAttribute: noop, remove: noop }; nodes.push(node); return node; }, addEventListener: noop, removeEventListener: noop };
const host = { classList: { add: noop, remove: noop }, ownerDocument: doc, querySelector: () => null, prepend: node => nodes.push(node) };
let resolveLearning, readyCalls = 0;
const catalog = { courses: [{ courseId: 'platform-course', title: 'Available course', accessLevel: 'free', units: [{ unitId: 'unit-1', itemCount: 3, itemIds: ['a','b','c'], recordIdentity: { deckId: 'record', generationScope: 'course:record' } }] }] };
const win = {
  location: { href: 'http://localhost/main.html?course=platform-course', pathname: '/main.html', search: '?course=platform-course' },
  AccountStorage: { owner: '["http://localhost","7"]', sessionEpoch: 'session-1' },
  ChunkAPI: { getBase: () => 'http://localhost', getToken: () => 'token', getCourseCatalog: async () => catalog, request: async () => ({}) },
  LearningSessionBootstrap: { ready() { readyCalls++; return new Promise(resolve => { resolveLearning = resolve; }); } },
  CourseEnrollment: { isJoined: () => true }, crypto: { randomUUID: () => 'request-id' }, addEventListener: noop, removeEventListener: noop,
  setInterval: () => 1, clearInterval: noop, setTimeout: noop, clearTimeout: noop
};
const session = new NativeCourseSession({ host, courseId: 'platform-course', unitId: 'unit-1', getMem: () => ({ progress: {} }), onBatch: noop, win });
await Promise.race([session.open(), new Promise((_, reject) => setTimeout(() => reject(new Error('catalog waited for learning bootstrap')), 250))]);
assert.equal(session.course.title, 'Available course');
assert.equal(readyCalls, 0, 'opening an authorized course catalog is independent of personal learning sync');
assert.equal(session.button.hidden, false);
session.dispose();
resolveLearning?.();

const personalItem = { id: 'preview-line', text: { en: 'A protected sentence.', 'zh-CN': '一条私有测试句。' }, chunks: ['A protected', 'sentence.'] };
const personalIdentity = { deckId: 'private-course', generationScope: 'course:private-course' };
let personalBatches = 0, previewDeck = null, snapshotReads = 0;
const personalWin = {
  location: { href: 'http://localhost/main.html?personalCourse=private-course', pathname: '/main.html', search: '?personalCourse=private-course', origin: 'http://localhost' },
  AccountStorage: { owner: '["http://localhost", "7"]', sessionEpoch: 'session-1' },
  ChunkAPI: { isLoggedIn: () => true, getBase: () => 'http://localhost', getToken: () => 'token', async request() {
    personalBatches++;
    return { courseId: 'private-course', title: 'Private fixture', unitId: 'default', itemCount: 1,
      contentVersion: 'release-1', recordIdentity: personalIdentity,
      batch: { cursor: 0, nextCursor: null, contentType: 'sentence', items: [personalItem], assetIds: [], recordIdentity: personalIdentity } };
  } },
  LearningSessionBootstrap: { async ready() { throw Object.assign(new Error('学习记录尚未确认'), { code: 'LEARNING_STATE_UNCONFIRMED' }); } },
  ServerCache: { async read() { snapshotReads++; throw new Error('must not read an unconfirmed learning snapshot'); } },
  CL: { isItemDeleted: () => false },
  crypto: { randomUUID: () => 'request-id' }, setInterval: () => 1, clearInterval: noop,
  URL: { createObjectURL: () => 'blob:unused', revokeObjectURL: noop }
};
const previewHost = { classList: { add: noop, remove: noop }, ownerDocument: doc, querySelector: () => null, prepend: node => nodes.push(node) };
const preview = new NativeCourseSession({ host: previewHost, courseId: 'private-course', origin: 'personal', getMem: () => ({ progress: {} }),
  onBatch(deck) { previewDeck = deck; }, win: personalWin });
await preview.open(); await preview.start();
assert.equal(personalBatches, 2, 'the authorized personal course body loads independently of learning sync');
assert.equal(previewDeck._learningReadOnly, true, 'unconfirmed learning state presents authorized content as a non-interactive preview');
assert.equal(preview.button.hidden, false, 'the user can retry learning-state confirmation from the preview');
assert.match(preview.status.textContent, /只读预览/);
assert.equal(snapshotReads, 0, 'unconfirmed bootstrap never reads or guesses a progress generation');
preview.dispose();

const platformItem = { id: 'platform-line', sentence: 'An authorized course line.', translation: '一条授权课程内容。', chunks: ['An authorized', 'course line.'] };
const platformIdentity = { deckId: 'platform-course', generationScope: 'course:platform-course' };
let platformPreviewDeck = null, platformStartCalls = 0, previewGrantCalls = 0, previewCursor = null, platformSnapshotReads = 0, enrollmentChecks = 0;
const platformGrant = { contentVersion: 'release-1', grant: 'one-use-preview-grant', headerName: 'X-Course-Grant', expiresAt: 5000, serverNow: 1000,
  fragments: [{ fragmentId: 'fragment-1', cursor: 0, itemIds: [platformItem.id], assetIds: [] }] };
const platformBatch = { cursor: 0, nextCursor: null, contentType: 'sentence', items: [platformItem], assetIds: [], recordIdentity: platformIdentity };
const platformWin = {
  location: { href: 'http://localhost/main.html?course=platform-course', pathname: '/main.html', search: '?course=platform-course', origin: 'http://localhost' },
  AccountStorage: { owner: '["http://localhost", "7"]', sessionEpoch: 'session-1' },
  ChunkAPI: { getBase: () => 'http://localhost', getToken: () => 'token', getCourseCatalog: async () => catalog,
    async request(url, options = {}) {
      if (url === '/api/learning-sessions/start') { platformStartCalls++; throw new Error('read-only preview must not start a learning session'); }
      if (url === '/api/course-content/preview-grant') { previewGrantCalls++; previewCursor = JSON.parse(options.body).cursor; return platformGrant; }
      throw new Error('unexpected request: ' + url);
    } },
  LearningSessionBootstrap: { async ready() { throw Object.assign(new Error('学习记录尚未确认'), { code: 'LEARNING_STATE_UNCONFIRMED' }); } },
  ServerCache: { async read() { platformSnapshotReads++; throw new Error('must not read an unconfirmed learning snapshot'); } },
  CourseEnrollment: { isJoined() { enrollmentChecks++; return false; }, async join() { throw new Error('must not join before learning state is confirmed'); } },
  CL: { isItemDeleted: () => false }, crypto: { randomUUID: () => 'request-id' },
  fetch: async () => ({ ok: true, async json() { return platformBatch; } }),
  addEventListener: noop, removeEventListener: noop, setInterval: () => 1, clearInterval: noop,
  setTimeout: noop, clearTimeout: noop, URL: { createObjectURL: () => 'blob:unused', revokeObjectURL: noop }
};
const platformHost = { classList: { add: noop, remove: noop }, ownerDocument: doc, querySelector: () => null, prepend: node => nodes.push(node) };
const platformPreview = new NativeCourseSession({ host: platformHost, courseId: 'platform-course', unitId: 'unit-1',
  getMem: () => ({ progress: { record: { idx: 2 } } }), onBatch(deck) { platformPreviewDeck = deck; }, win: platformWin });
await platformPreview.open(); await platformPreview.start();
assert.equal(platformStartCalls, 0, 'unconfirmed records must not start or reserve a trial-learning session');
assert.equal(previewGrantCalls, 1, 'authorized platform content uses a separate short-lived preview grant');
assert.equal(previewCursor, 0, 'an unconfirmed saved cursor is not used for read-only preview');
assert.equal(platformPreviewDeck._learningReadOnly, true, 'platform content is explicitly marked read-only while records are unconfirmed');
assert.equal(platformSnapshotReads, 0, 'platform preview does not read unconfirmed learning data');
assert.equal(enrollmentChecks, 0, 'platform preview does not write a course-enrollment reference');
assert.match(platformPreview.status.textContent, /只读预览/);
platformPreview.dispose();
console.log('catalog and authorized personal content load independently of learning sync; unconfirmed records remain read-only and retryable');
