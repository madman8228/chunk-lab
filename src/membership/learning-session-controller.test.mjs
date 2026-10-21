import assert from 'node:assert/strict';
import { LearningSessionController } from './learning-session-controller.mjs';
import { MembershipClient } from './client.mjs';

let mono = 0, scope = 'account-a', count = 0;
const timers = new Map(), actions = [], starts = [], states = [];
let loseStart = true, loseHeartbeat = false;
const mock = {
  async start(input) {
    starts.push(input);
    if (loseStart) { loseStart = false; throw new Error('lost response'); }
    return { allowed: true, serverNow: 100000 + mono, mode: 'trial', sessionId: 'session', sequence: 0,
      leaseEndsAt: 130000 + mono, remainingSeconds: 1800, unit: { items: [{ cid: 'a', sentence: 'Do not retain batches in the timer controller.' }] } };
  },
  async action(sessionId, sequence, action) {
    actions.push({ sessionId, sequence, action });
    if (loseHeartbeat) { loseHeartbeat = false; throw new Error('lost response'); }
    return { serverNow: 100000 + mono, sessionId, sequence, leaseEndsAt: 130000 + mono, paused: action === 'pause' };
  },
  async read() { return { allowed: true, serverNow: 100000 + mono, mode: 'trial', sessionId: 'session', leaseEndsAt: 130000 + mono, unit: { items: [] } }; }
};
const create = () => new LearningSessionController({ client: mock, newRequestId: () => 'request-' + ++count,
  monotonicNow: () => mono, captureScope: () => scope, onState: state => states.push(state),
  setTimer: (callback, ms) => { const id = ++count; timers.set(id, { callback, at: mono + ms }); return id; },
  clearTimer: id => timers.delete(id) });
const input = { courseId: 'course', unitId: 'unit', cursor: 0 };
const controller = create();
await assert.rejects(controller.start(input), /lost response/);
assert.equal(controller.canAdvance(), false);
await assert.rejects(controller.start({ ...input, cursor: 1 }), /START_RETRY_REQUIRED/);
await controller.start(input);
assert.equal(controller.current.unit, undefined, 'timer state never retains an earlier content batch');
assert.equal(starts[0].requestId, starts[1].requestId, 'lost start keeps original receipt key');
assert.equal(controller.canAdvance(), true);
loseHeartbeat = true;
await assert.rejects(controller.heartbeat(), /lost response/);
assert.equal(controller.canAdvance(), true, 'prior lease stays valid after lost heartbeat');
await controller.heartbeat();
assert.equal(actions[0].sequence, actions[1].sequence, 'lost heartbeat retries same sequence');
controller.setVisible(false);
await new Promise(resolve => setImmediate(resolve));
assert.equal(controller.canAdvance(), false);
assert.equal(actions.at(-1).action, 'pause');
assert.equal(actions.at(-1).sequence, 2);
assert.equal(controller.current, null);
controller.setVisible(true);
assert.equal(controller.canAdvance(), false, 'visibility restoration does not silently grant new permission');
await controller.start(input);
assert.notEqual(starts.at(-1).requestId, starts[1].requestId);
mono += 30001;
assert.equal(controller.canAdvance(), false, 'monotonic deadline forbids cached advancement before any timer fires');
await assert.rejects(controller.read('course', 'unit', 10), /AUTHORIZATION_REQUIRED/);
controller.reset();
await controller.start(input);
scope = 'account-b';
assert.equal(controller.canAdvance(), false);
await assert.rejects(controller.read('course', 'unit', 10), /SESSION_CHANGED/);
assert.equal(controller.current, null);

// Even a response from a different account that arrives late cannot install its lease.
const late = create();
/** @type {(value:any)=>void} */
let release = () => { assert.fail('start promise was not initialized'); };
late.client = { ...mock, start: () => new Promise(resolve => { release = resolve; }) };
const loading = late.start(input);
scope = 'account-c';
release({ allowed: true, mode: 'free' });
await assert.rejects(loading, /SESSION_CHANGED/);
assert.equal(late.canAdvance(), false);

// Hidden during an in-flight heartbeat: settle that sequence, then pause with the next one.
const racing = create();
await racing.start(input);
const actionLog = [];
/** @type {()=>void} */
let heartbeatRelease = () => { assert.fail('heartbeat promise was not initialized'); };
racing.client = { ...mock, action: async (sessionId, sequence, action) => {
  actionLog.push({ sequence, action });
  if (action === 'heartbeat') await new Promise(resolve => { heartbeatRelease = () => resolve(undefined); });
  return { serverNow: 100000 + mono, sessionId, sequence, leaseEndsAt: 130000 + mono };
} };
const beating = racing.heartbeat();
racing.setVisible(false);
heartbeatRelease();
await beating;
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(actionLog, [{ sequence: 1, action: 'heartbeat' }, { sequence: 2, action: 'pause' }]);
assert.equal(racing.canAdvance(), false);

// Network time is counted conservatively from request dispatch, never added to a lease.
const delayed = create();
delayed.client = { ...mock, start: async () => {
  mono += 10000;
  return { allowed: true, mode: 'member', serverNow: 100000, endsAt: 130000 };
} };
const dispatched = mono;
await delayed.start(input);
assert.equal(delayed.current.deadline, dispatched + 30000);
assert.equal([...timers.values()].some(timer => timer.at === delayed.current.deadline), true);

const calls = [];
const client = new MembershipClient({ request: async (url, options) => { calls.push({ url, options }); return {}; } });
await client.read('course/id', 'unit/id', 10, 'lease');
assert.equal(calls[0].url, '/api/course-content/course%2Fid/units/unit%2Fid?cursor=10');
assert.equal(calls[0].options.headers['X-Learning-Session'], 'lease');
console.log('membership client: receipt retries, sequence retries, hidden races, account scope, monotonic expiry passed');
