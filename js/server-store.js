/* Durable client for narrow, server-authoritative operations.
 * IndexedDB holds only unacknowledged requests; it is not a business-data store.
 */
(function (global) {
  'use strict';

  var queue = Promise.resolve();
  var listeners = [];
  var state = { phase: 'idle', pending: 0, error: null, blocked: 0, traceId: null };
  var activity = 0;
  var retryTimer = null;
  var saveHealthTimer = null;
  var saveHealthHeartbeat = null;
  var saveHealthClientId = null;
  var lastSaveHealthSignature = '';
  var lastSaveHealthAt = 0;
  var retryDelay = 1000;
  var commitWaiters = Object.create(null);

  function saveHealthScopeSuffix() {
    var value = requestBase();
    var first = 2166136261, second = 2246822519;
    for (var index = 0; index < value.length; index++) {
      var code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619) >>> 0;
      second = Math.imul(second ^ code, 3266489917) >>> 0;
    }
    return ('00000000' + first.toString(16)).slice(-8) + ('00000000' + second.toString(16)).slice(-8);
  }

  function settleCommit(requestId, error, result) {
    var waiters = commitWaiters[requestId];
    if (!waiters || !waiters.length) return;
    delete commitWaiters[requestId];
    waiters.forEach(function (waiter) {
      if (error) waiter.reject(error); else waiter.resolve(result);
    });
  }

  function emit() {
    var snapshot = { phase: state.phase, pending: state.pending, error: state.error, blocked: state.blocked, traceId: state.traceId };
    listeners.slice().forEach(function (listener) { try { listener(snapshot); } catch (_) {} });
    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
      global.dispatchEvent(new global.CustomEvent('server-store-state', { detail: snapshot }));
    }
    scheduleSaveHealthReport();
  }

  function getSaveHealthClientId() {
    if (saveHealthClientId) return saveHealthClientId;
    var key = 'chunklab.save-health-client.v1';
    var installId = null;
    try {
      var existing = global.localStorage && global.localStorage.getItem(key);
      if (typeof existing === 'string' && /^[A-Za-z0-9_-]{16,100}$/.test(existing)) {
        installId = existing;
      }
    } catch (_) {}
    if (!installId) {
      installId = requestId();
      try { if (global.localStorage) global.localStorage.setItem(key, installId); } catch (_) {}
    }
    saveHealthClientId = installId + '_' + saveHealthScopeSuffix();
    if (saveHealthClientId.length > 100) saveHealthClientId = saveHealthClientId.slice(0, 100);
    return saveHealthClientId;
  }

  function scheduleSaveHealthReport() {
    if (!protocolAdvertised() || !global.ChunkAPI || typeof global.ChunkAPI.reportSaveHealth !== 'function' ||
        !global.AccountStorage || !global.AccountStorage.owner || saveHealthTimer != null) return;
    var captured = { owner: global.AccountStorage.owner, sessionEpoch: global.AccountStorage.sessionEpoch || '',
      scope: scope(), base: requestBase() };
    saveHealthTimer = global.setTimeout(function () {
      saveHealthTimer = null;
      readQueue().then(function (rows) {
        if (!current(captured)) return;
        var active = rows.filter(function (row) { return row.status !== 'blocked'; });
        var oldest = active.reduce(function (value, row) {
          var created = Number(row.createdAt);
          return Number.isFinite(created) && created > 0 ? Math.min(value, created) : value;
        }, Infinity);
        var latestFailure = rows.slice().sort(function (a, b) {
          return (Number(b.lastAttemptAt) || 0) - (Number(a.lastAttemptAt) || 0);
        }).find(function (row) { return row.lastError; });
        var rawCode = latestFailure && latestFailure.lastError || state.error;
        var errorCode = typeof rawCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(rawCode) ? rawCode : null;
        var traceId = latestFailure && latestFailure.lastTraceId || state.traceId || null;
        if (typeof traceId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(traceId)) traceId = null;
        var retryAttempts = rows.reduce(function (sum, row) { return sum + Math.max(0, Number(row.attempts) || 0); }, 0);
        var report = { version: 1, clientId: getSaveHealthClientId(), pending: active.length, blocked: rows.length - active.length,
          retryAttempts: Math.min(retryAttempts, 1000000), oldestPendingAt: Number.isFinite(oldest) ? oldest : null,
          errorCode: errorCode, traceId: traceId };
        var signature = JSON.stringify(report);
        var now = Date.now();
        if (signature === lastSaveHealthSignature && now - lastSaveHealthAt < 5 * 60 * 1000) return;
        return global.ChunkAPI.reportSaveHealth(report).then(function () {
          if (!current(captured)) return;
          lastSaveHealthSignature = signature;
          lastSaveHealthAt = now;
          if ((report.pending || report.blocked) && saveHealthHeartbeat == null) {
            saveHealthHeartbeat = global.setTimeout(function () {
              saveHealthHeartbeat = null;
              scheduleSaveHealthReport();
            }, 5 * 60 * 1000);
          }
        }).catch(function () {});
      }).catch(function () {});
    }, 1200);
  }

  function assertReady() {
    if (!global.AccountStorage || !global.IDBStore || !global.ChunkAPI) throw new Error('服务端保存尚未初始化');
    global.AccountStorage.assertCurrent();
  }

  function protocolAdvertised() {
    var config = global.CL && typeof global.CL.getCloudConfig === 'function'
      ? global.CL.getCloudConfig() : null;
    return !!(config && config.persistenceMode === 'server-authoritative' && Number(config.writeProtocol) === 3);
  }

  function protocolReady() {
    if (!protocolAdvertised()) return false;
    // The core keeps local durable enqueue available while the account cache is
    // pending, but network drain must wait until the current account's confirmed
    // server cache has loaded successfully.
    return !(global.CL && typeof global.CL.serverPersistenceReady === 'function') ||
      global.CL.serverPersistenceReady() === true;
  }

  function scope() {
    var base = new URL(global.ChunkAPI.getBase() || global.location.origin, global.location.origin);
    base.hash = ''; base.search = '';
    var normalized = base.href.replace(/\/+$/, '');
    return JSON.stringify([normalized, global.AccountStorage.owner, 3]);
  }

  function requestBase() {
    return new URL(global.ChunkAPI.getBase() || global.location.origin, global.location.origin).href.replace(/\/+$/, '');
  }

  function current(captured) {
    global.AccountStorage.assertCurrent();
    return captured.owner === global.AccountStorage.owner &&
      captured.sessionEpoch === (global.AccountStorage.sessionEpoch || '') &&
      captured.scope === scope() && captured.base === requestBase();
  }

  function byteLength(value) {
    return new global.Blob([JSON.stringify(value)]).size;
  }

  function requestId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
      var bytes = new Uint8Array(16);
      global.crypto.getRandomValues(bytes);
      return Array.prototype.map.call(bytes, function (byte) { return ('0' + byte.toString(16)).slice(-2); }).join('');
    }
    throw new Error('浏览器缺少安全随机数，无法安全创建请求编号');
  }

  function readQueue() {
    assertReady();
    return global.IDBStore.listPendingOperations().then(function (rows) {
      var activeScope = scope();
      rows = (rows || []).filter(function (row) { return row && row.scope === activeScope; });
      rows.sort(function (a, b) {
        var ao = Number(a.ordinal), bo = Number(b.ordinal);
        if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
        return a.createdAt - b.createdAt || (a.requestId < b.requestId ? -1 : a.requestId > b.requestId ? 1 : 0);
      });
      return rows;
    });
  }

  function refreshThrough(requiredSeq, attemptsLeft) {
    attemptsLeft = attemptsLeft == null ? 3 : attemptsLeft;
    if (!global.ServerCache) {
      var unavailable = new Error('服务端确认缓存尚未就绪'); unavailable.code = 'CACHE_NOT_READY';
      return Promise.reject(unavailable);
    }
    return global.ServerCache.refresh().then(function (applied) {
      (applied.retired || []).forEach(function (retired) {
        if (retired && retired.receipt) settleCommit(retired.requestId, null, retired.receipt);
      });
      if (Number(applied.cache && applied.cache.appliedSeq) >= Number(requiredSeq)) return applied;
      if (attemptsLeft > 1) return refreshThrough(requiredSeq, attemptsLeft - 1);
      var behind = new Error('服务端已确认，正在等待本地数据追上');
      behind.code = 'CACHE_NOT_CAUGHT_UP';
      throw behind;
    });
  }

  function send(row) {
    var captured = { owner: global.AccountStorage.owner, sessionEpoch: global.AccountStorage.sessionEpoch || '', scope: scope(), base: requestBase() };
    assertReady();
    if (row.scope !== captured.scope || row.owner !== captured.owner || row.base !== captured.base) {
      var scopeError = new Error('待提交操作与当前账号或服务地址不匹配，已暂停发送');
      scopeError.code = 'OPERATION_SCOPE_MISMATCH';
      return Promise.reject(scopeError);
    }
    /* Persist the first-send boundary before touching the network. Recovery may
       classify a new-format row without this marker as definitely unsubmitted;
       pre-marker rows remain ambiguous and must not be replayed automatically. */
    var attemptStartedAt = Number(row.attemptStartedAt) || Date.now();
    return global.IDBStore.updatePendingOperation(row.requestId, {
      attemptEvidenceVersion: 1, attemptStartedAt: attemptStartedAt
    }).then(function (marked) {
      if (!marked) throw new Error('待保存记录已变化；本次没有发送');
      if (!current(captured)) {
        var changedError = new Error('账号或服务地址已切换，操作保留待恢复');
        changedError.code = 'SESSION_CHANGED';
        throw changedError;
      }
      state.phase = 'sending'; state.error = null; state.traceId = null; emit();
      return row.operation && (row.operation.type === 'course.put' || row.operation.type === 'deck.put') && row.bytes > 256 * 1024
        ? global.ChunkAPI.importCourseContent(row.operation)
        : global.ChunkAPI.submitOperation(row.operation);
    }).then(function (result) {
      if (!current(captured)) {
        var changedError = new Error('账号或服务地址已切换，操作保留待恢复');
        changedError.code = 'SESSION_CHANGED';
        throw changedError;
      }
      if (!result || result.ok !== true || result.requestId !== row.requestId) {
        throw new Error('服务端未确认此操作');
      }
      if (!global.IDBStore.markPendingAcknowledged || !global.ServerCache) {
        var cacheError = new Error('服务端确认缓存尚未就绪，操作保留待恢复');
        cacheError.code = 'CACHE_NOT_READY';
        throw cacheError;
      }
      // A receipt is not yet a locally recoverable save. Persist the ACK first,
      // pull from appliedSeq, then retire the operation with the cache atomically.
      return global.IDBStore.markPendingAcknowledged(row.requestId, result).then(function (ack) {
        if (ack && ack.retired) {
          settleCommit(row.requestId, null, result);
          return result;
        }
        return refreshThrough(result.seq).then(function () {
          return result;
        }).catch(function (error) {
          error = error || new Error('确认数据暂未下载');
          error.code = error.code || 'CACHE_REFRESH_FAILED';
          throw error;
        });
      });
    });
  }

  function refreshAcknowledged(rows) {
    var acked = (rows || []).filter(function (row) { return row.status === 'acked-awaiting-apply'; });
    if (!acked.length) return Promise.resolve([]);
    if (!global.ServerCache) {
      var unavailable = new Error('服务端确认缓存尚未就绪'); unavailable.code = 'CACHE_NOT_READY';
      return Promise.reject(unavailable);
    }
    var requiredSeq = acked.reduce(function (highest, row) {
      return Math.max(highest, Number(row.receipt && row.receipt.seq) || 0);
    }, 0);
    return refreshThrough(requiredSeq).then(function (applied) {
      return applied.retired || [];
    });
  }

  function operationTargets(row) {
    var operation = row && row.operation;
    var payload = operation && operation.payload || {};
    var targets = [];
    function add(kind, value) {
      if (typeof value === 'string' && value) targets.push(kind + ':' + value);
    }
    switch (operation && operation.type) {
      case 'course.put': add('course', payload.course && payload.course.courseId); break;
      case 'course.delete':
      case 'course.progress':
      case 'course.progress.restore':
      case 'course.restart':
      case 'course.enrollment':
      case 'learning.reset': add('course', payload.courseId); break;
      case 'deck.put': add('deck', payload.deck && payload.deck.id); break;
      case 'deck.delete':
      case 'deck.publish': add('deck', payload.deckId); break;
      case 'logicalCourse.put': add('logical-course', payload.course && payload.course.id); break;
      case 'logicalCourse.delete': add('logical-course', payload.courseId); break;
      case 'learning.answer':
      case 'learning.exposure':
      case 'learning.mark':
      case 'mistake.remove': add('sentence', payload.key); break;
      case 'learning.statKeyMigrate':
        add('sentence', payload.oldKey);
        add('sentence', payload.newKey);
        break;
      case 'deck.itemsVisibility':
        (Array.isArray(payload.keys) ? payload.keys : []).forEach(function (key) { add('sentence', key); });
        break;
      case 'learning.resume':
      case 'learning.roundComplete': add('learning-session', payload.sessionId); break;
      case 'assessment.start':
      case 'assessment.answer':
      case 'assessment.finalize': add('assessment-session', payload.sessionId); break;
      case 'settings.patch':
        Object.keys(payload.patch && typeof payload.patch === 'object' ? payload.patch : {})
          .forEach(function (key) { add('setting', key); });
        break;
    }
    return targets.length ? targets : ['operation:' + String(operation && operation.type || 'unknown')];
  }

  function addBlockedTargets(row, blockedTargets) {
    operationTargets(row).forEach(function (target) { blockedTargets[target] = true; });
  }

  function hasBlockedTarget(row, blockedTargets) {
    return operationTargets(row).some(function (target) { return blockedTargets[target] === true; });
  }

  function drain() {
    if (!protocolReady()) {
      return readQueue().then(function (rows) {
        state.pending = rows.filter(function (row) { return row.status !== 'blocked'; }).length;
        state.blocked = rows.filter(function (row) { return row.status === 'blocked'; }).length;
        state.phase = state.pending ? 'paused' : state.blocked ? 'blocked' : 'idle';
        state.error = null; emit();
        return [];
      });
    }
    var upgradeRequired = false;
    return readQueue().then(refreshAcknowledged).then(function () { return readQueue(); }).then(function (rows) {
      var results = [], index = 0, blockedTargets = Object.create(null);
      function next() {
        if (upgradeRequired || index >= rows.length) return Promise.resolve(results);
        var row = rows[index++];
        if (row.status === 'blocked') { addBlockedTargets(row, blockedTargets); return next(); }
        if (row.status === 'acked-awaiting-apply') return next();
        if (hasBlockedTarget(row, blockedTargets)) { addBlockedTargets(row, blockedTargets); return next(); }
        return send(row).then(function (result) { results.push(result); return next(); }).catch(function (error) {
          var status = Number(error && error.status) || 0;
          if (status === 428 || error && error.code === 'CLIENT_UPDATE_REQUIRED') {
            upgradeRequired = true;
            state.phase = 'paused'; state.error = 'CLIENT_UPDATE_REQUIRED'; emit();
            return next();
          }
          var permanent = status >= 400 && status < 500 && status !== 408 && status !== 429 && status !== 401;
          var patch = { attempts: (Number(row.attempts) || 0) + 1,
            lastAttemptAt: Date.now(), lastError: String(error && (error.code || error.message) || 'NETWORK_ERROR').slice(0, 160) };
          if (error && typeof error.traceId === 'string') patch.lastTraceId = error.traceId;
          if (permanent) patch.status = 'blocked';
          return global.IDBStore.updatePendingOperation(row.requestId, patch).catch(function () {}).then(function () {
            if (permanent) {
              state.blocked++;
              addBlockedTargets(row, blockedTargets);
              settleCommit(row.requestId, error);
              return next();
            }
            if (status === 401 || error && (error.code === 'NOT_AUTH' || error.code === 'SESSION_CHANGED')) settleCommit(row.requestId, error);
            throw error;
          });
        });
      }
      return next();
    }).then(function (results) {
      return readQueue().then(function (rows) {
        state.pending = rows.filter(function (row) { return row.status !== 'blocked'; }).length;
        state.blocked = rows.filter(function (row) { return row.status === 'blocked'; }).length;
        state.phase = upgradeRequired ? 'paused' : state.pending ? 'pending' : state.blocked ? 'blocked' : 'saved';
        state.error = upgradeRequired ? 'CLIENT_UPDATE_REQUIRED' : null; state.traceId = null; retryDelay = 1000; emit();
        return results;
      });
    }).catch(function (error) {
      return readQueue().then(function (rows) {
        state.pending = rows.filter(function (row) { return row.status !== 'blocked'; }).length;
        state.blocked = rows.filter(function (row) { return row.status === 'blocked'; }).length;
        var authenticationExpired = Number(error && error.status) === 401 || error && error.code === 'NOT_AUTH';
        state.phase = authenticationExpired || error && error.code === 'SESSION_CHANGED' ? 'paused' : 'pending';
        state.error = error && (error.code || error.message) || 'NETWORK_ERROR';
        state.traceId = error && error.traceId || null;
        emit();
        scheduleRetry(error);
        return [];
      });
    });
  }

  function serialized(task) {
    var result = queue.then(task);
    queue = result.catch(function () {});
    return result;
  }

  function submit(type, payload, options) {
    options = options || {};
    if (typeof type !== 'string' || !type || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return Promise.reject(new Error('服务端操作格式无效'));
    }
    // Enqueue uses only IndexedDB's short read/write transaction. Never put
    // it behind the network drain: a stalled fetch must not block the next
    // locally durable answer or make leaving the page wait for the network.
    return Promise.resolve().then(function () {
      activity++;
      assertReady();
      if (!protocolAdvertised()) {
        var unsupported = new Error('当前服务尚未确认支持协议 3');
        unsupported.code = 'PROTOCOL_NOT_READY';
        throw unsupported;
      }
      return readQueue().then(function () {
        var id = options.requestId || requestId();
        var operation = { protocol: 3, requestId: id, type: type, payload: payload };
        if (Object.prototype.hasOwnProperty.call(options, 'expectedRev')) operation.expectedRev = options.expectedRev;
        if (options.expected) operation.expected = options.expected;
        var row = {
          requestId: id, operation: operation, owner: global.AccountStorage.owner,
          sessionEpoch: global.AccountStorage.sessionEpoch || '', base: requestBase(), scope: scope(),
          createdAt: Date.now(), attempts: 0, lastError: null, status: 'pending', bytes: byteLength(operation),
          attemptEvidenceVersion: 1
        };
        state.phase = 'queueing'; state.error = null; emit();
        // A single explicit content import may exceed the ordinary offline
        // queue budget. Keep it durable and retryable, while reserving a hard
        // bound for that import plus the normal learning queue.
        var isLargeContentImport = (type === 'course.put' || type === 'deck.put') && row.bytes > 20 * 1024 * 1024;
        var store = global.IDBStore.putPendingOperation(row, {
          maxCount: 10000,
          maxBytes: isLargeContentImport ? 100 * 1024 * 1024 : 20 * 1024 * 1024
        });
        return Promise.resolve(store).then(function () {
          return readQueue().then(function (rows) {
            state.pending = rows.filter(function (item) { return item.status !== 'blocked'; }).length;
            state.blocked = rows.filter(function (item) { return item.status === 'blocked'; }).length;
            state.phase = 'pending'; state.error = null; emit();
            var accepted = { accepted: true, requestId: id, durable: true };
            // A newly accepted user action should not wait behind a backoff
            // timer from an earlier transient failure. Start a fresh drain now;
            // failures from this drain still use the normal exponential backoff.
            kick(0, true);
            return accepted;
          });
        }).catch(function (error) {
          state.phase = error && error.code === 'PENDING_CAPACITY' ? 'capacity' : 'unavailable';
          state.error = error && (error.code || error.message) || 'STORAGE_UNAVAILABLE'; emit();
          throw error;
        });
      });
    });
  }

  /* Resolve only after a durable queued operation receives a server receipt.
     Transient network errors leave this promise pending while the same request
     ID remains queued for automatic retry. */
  function submitCommitted(type, payload, options) {
    options = options || {};
    var id = options.requestId || requestId();
    var committed = new Promise(function (resolve, reject) {
      (commitWaiters[id] || (commitWaiters[id] = [])).push({ resolve: resolve, reject: reject });
    });
    var enqueueOptions = Object.assign({}, options, { requestId: id });
    submit(type, payload, enqueueOptions).catch(function (error) { settleCommit(id, error); });
    return committed;
  }

  function scheduleRetry(error) {
    if (retryTimer != null || (error && (Number(error.status) === 401 || error.code === 'NOT_AUTH' || error.code === 'SESSION_CHANGED'))) return;
    var delay = Number(error && error.retryAfterMs);
    if (!Number.isFinite(delay) || delay < 0) delay = Math.min(retryDelay, 30000) * (0.8 + Math.random() * 0.4);
    retryDelay = Math.min(retryDelay * 2, 30000);
    retryTimer = global.setTimeout(function () { retryTimer = null; retryPending().catch(function () {}); }, delay);
  }

  function kick(delay, force) {
    if (retryTimer != null && !force) return;
    if (retryTimer != null) global.clearTimeout(retryTimer);
    retryTimer = global.setTimeout(function () { retryTimer = null; retryPending().catch(function () {}); }, delay || 0);
  }

  function retryPending() {
    activity++;
    var run = function () { return serialized(drain); };
    if (global.navigator && global.navigator.locks && typeof global.navigator.locks.request === 'function') {
      return global.navigator.locks.request('chunklab-operations:' + scope(), { mode: 'exclusive' }, run);
    }
    return run();
  }

  function refreshState() {
    var observedActivity = activity;
    return readQueue().then(function (rows) {
      if (observedActivity === activity) {
        state.pending = rows.filter(function (row) { return row.status !== 'blocked'; }).length;
        state.blocked = rows.filter(function (row) { return row.status === 'blocked'; }).length;
        state.phase = state.pending ? 'pending' : state.blocked ? 'blocked' : 'idle';
        state.error = null; state.traceId = null; emit();
      }
      return api.state();
    }).catch(function (error) {
      state.phase = 'unavailable'; state.error = error && (error.code || error.message) || 'STORAGE_UNAVAILABLE'; state.traceId = null; emit();
      throw error;
    });
  }

  var api = {
    submit: submit,
    submitCommitted: submitCommitted,
    retryPending: retryPending,
    discardBlockedContentConflict: function (requestId) {
      return readQueue().then(function (rows) {
        var row = rows.find(function (item) { return item.requestId === requestId; });
        var operation = row && row.operation;
        if (!row || row.status !== 'blocked' || row.lastError !== 'ENTITY_CHANGED' ||
            !operation || operation.type !== 'deck.put') return false;
        return global.IDBStore.removePendingOperation(requestId).then(function () {
          return refreshState().then(function () { return true; });
        });
      });
    },
    refreshState: refreshState,
    pending: function () { return readQueue(); },
    state: function () { return { phase: state.phase, pending: state.pending, blocked: state.blocked, error: state.error, traceId: state.traceId }; },
    onState: function (listener) {
      if (typeof listener !== 'function') return function () {};
      listeners.push(listener);
      listener(api.state());
      return function () { listeners = listeners.filter(function (item) { return item !== listener; }); };
    }
  };

  global.ServerStore = api;
  // Reconnect and resume retries when the learner returns to this page.
  refreshState().then(function () { if (protocolReady()) kick(0); }).catch(function () {});
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('cloud-config-changed', function () {
      if (protocolReady()) kick(0, true);
      else refreshState().catch(function () {});
    });
    global.addEventListener('online', function () { retryDelay = 1000; kick(0, true); });
    global.addEventListener('focus', function () { kick(0); });
    global.addEventListener('visibilitychange', function () { if (!global.document || !global.document.hidden) kick(0); });
  }
})(window);
