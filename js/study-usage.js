/* Foreground learning telemetry. No course text, answers, or credentials are stored. */
(function (global) {
  'use strict';
  function createTracker(options) {
    var previous = null, pending = null, sequence = 0, lastTick = options.now(), lastInput = lastTick;
    var elapsed = 0, owner = '', sessionId = options.sessionId(), inFlight = false;
    var contextEpoch = 0, acknowledgedEpoch = -1, pendingEpoch = -1;
    function sample() {
      var time = options.now(), identity = options.identity() || '';
      if (identity !== owner) {
        owner = identity; sessionId = options.sessionId(); sequence = 0;
        pending = null; elapsed = 0; previous = null; lastTick = time; lastInput = time;
        contextEpoch = 0; acknowledgedEpoch = -1; pendingEpoch = -1;
      }
      var context = owner && options.visible() && time - lastInput < 60000 ? options.context() : null;
      var same = context && previous && context.kind === previous.kind && context.resourceId === previous.resourceId;
      // A suspended browser timer is not evidence of continuous study.
      if (same && time >= lastTick && time - lastTick <= 2000) elapsed = Math.min(30000, elapsed + time - lastTick);
      if (!same && previous) flush();
      if (!same) { elapsed = 0; contextEpoch++; }
      previous = context; lastTick = time;
      if (!same && context) flush();
    }
    function flush() {
      if (!owner || owner !== options.identity() || inFlight) return;
      if (!pending) {
        if (!previous) return;
        // Keep the first/resumed context baseline, but do not write empty
        // heartbeats after that baseline has been acknowledged by the server.
        if (elapsed === 0 && acknowledgedEpoch === contextEpoch) return;
        pendingEpoch = contextEpoch;
        pending = { sessionId: sessionId, sequence: ++sequence, elapsedMs: Math.floor(elapsed),
          kind: previous.kind, resourceId: previous.resourceId };
        elapsed = 0;
      }
      var sent = pending, sentOwner = owner, sentEpoch = pendingEpoch;
      inFlight = true;
      return Promise.resolve().then(function () {
        if (sentOwner !== options.identity()) return;
        return options.send(sent);
      }).then(function () {
        if (pending === sent) { pending = null; acknowledgedEpoch = sentEpoch; }
      }, function () {
        // Retry only the same bounded pulse. Never replay it under another account.
      }).finally(function () { inFlight = false; });
    }
    function interact() { sample(); lastInput = options.now(); }
    return { sample: sample, flush: flush, interact: interact };
  }
  function createVisitTracker(options) {
    var owner = '', nextAt = 0, retryDelay = 60000, pending = null;
    function visit() {
      var current = options.identity(), now = options.now();
      if (current !== owner) { owner = current; nextAt = 0; retryDelay = 60000; pending = null; }
      if (!current || !options.visible() || !options.online() || pending || now < nextAt) return;
      var attempt = { owner: current };
      pending = attempt; nextAt = now + 60000;
      return Promise.resolve().then(function () {
        if (options.identity() !== current) return;
        return options.send();
      }).then(function () {
        if (pending === attempt) retryDelay = 60000;
      }, function (error) {
        if (pending !== attempt) return;
        var hint = error && error.retryAfterMs;
        var delay = typeof hint === 'number' && Number.isFinite(hint) && hint > 0
          ? Math.max(retryDelay, Math.min(hint, 2147483647)) : retryDelay;
        nextAt = options.now() + delay;
        retryDelay = Math.min(retryDelay * 2, 300000);
      }).finally(function () { if (pending === attempt) pending = null; });
    }
    return { visit: visit };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createTracker: createTracker, createVisitTracker: createVisitTracker };
  if (!global.document || !global.ChunkAPI) return;
  var api = global.ChunkAPI;
  function identity() { try { return (api.getToken() || '') && api.getBase() + '|' + api.getToken(); } catch (_) { return ''; } }
  function context() {
    if (typeof global.studyUsageContext === 'function') return global.studyUsageContext();
    var page = document.getElementById('pagePractice'), state = global.S;
    if (page && !page.classList.contains('hidden') && state && !state.finished) {
      var params = new URLSearchParams(location.search);
      if (state.assessment && state.assessment.status === 'active' && document.querySelector('[data-assessment-answer]')) {
        return { kind: 'sentence', resourceId: state.assessment.deckId || params.get('protectedCourse') || 'sentence-assessment' };
      }
      var stage = document.getElementById('stage'), nativeSession = state.deck && state.deck._platformSession;
      if (!state.deck || !state.items || !state.items.length || !stage || stage.classList.contains('hidden')) return null;
      if (nativeSession && (nativeSession.disposed || !nativeSession.button.hidden || nativeSession.controller.phase !== 'active')) return null;
      return { kind: 'sentence', resourceId: nativeSession ? nativeSession.courseId : state.deck.id || 'sentence-practice' };
    }
    return null;
  }
  var tracker = createTracker({ now: Date.now, identity: identity, visible: function () {
    return document.visibilityState === 'visible' && !document.querySelector('#chunkauth-mask, [aria-modal="true"]');
  }, context: context, sessionId: function () { return global.crypto.randomUUID(); },
  send: function (body) { return api.request('/api/usage/study', { method: 'POST', timeoutMs: 8000, body: JSON.stringify(body) }); } });
  ['pointerdown', 'keydown', 'input', 'scroll'].forEach(function (event) {
    document.addEventListener(event, tracker.interact, { passive: true, capture: true });
  });
  document.addEventListener('visibilitychange', function () { tracker.sample(); tracker.flush(); });
  global.addEventListener('pagehide', function () { tracker.sample(); tracker.flush(); });
  global.setInterval(tracker.sample, 1000);
  global.setInterval(function () { tracker.sample(); tracker.flush(); }, 10000);
  var visits = createVisitTracker({ now: Date.now, identity: identity,
    visible: function () { return document.visibilityState === 'visible'; },
    online: function () { return !global.navigator || global.navigator.onLine !== false; },
    send: function () { return api.heartbeat(); } });
  global.StudyUsage = { visit: visits.visit };
  global.setInterval(visits.visit, 10000);
  visits.visit();
})(typeof window !== 'undefined' ? window : globalThis);
