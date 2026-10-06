/* Confirmed server snapshot cache. Pending operations remain owned by
 * ServerStore; this module only merges downlink data and commits its watermark. */
(function (global) {
  'use strict';

  var CACHE_KEY = 'server-cache-v3';
  var inFlight = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function array(value) { return Array.isArray(value) ? value : []; }
  function hasOnlyKeys(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(function(key){return keys.indexOf(key)>=0;});
  }
  function keyed(rows, key) {
    var out = {};
    array(rows).forEach(function (row) { if (row && row[key] != null) out[String(row[key])] = row; });
    return out;
  }
  function mergeObject(base, incoming) { return Object.assign({}, object(base), object(incoming)); }
  function mergeRows(base, incoming, key, full) {
    var out = full ? {} : keyed(base, key);
    Object.keys(keyed(incoming, key)).forEach(function (id) { out[id] = keyed(incoming, key)[id]; });
    return Object.keys(out).map(function (id) { return out[id]; });
  }
  function removeKeys(map, keys) { (array(keys)).forEach(function (key) { delete map[String(key)]; }); }
  function mergeUnique(base, incoming, key, full) {
    var out = full ? {} : {};
    if (!full) array(base).forEach(function (row) { if (row && row[key] != null) out[String(row[key])] = row; });
    array(incoming).forEach(function (row) { if (row && row[key] != null) out[String(row[key])] = row; });
    return Object.keys(out).map(function (id) { return out[id]; });
  }
  function mergeMap(base, incoming, full) { return full ? Object.assign({}, object(incoming)) : mergeObject(base, incoming); }
  function mergeTombstones(base, incoming, full) {
    var out = full ? {} : clone(object(base));
    Object.keys(object(incoming)).forEach(function (kind) {
      var known = new Set(array(out[kind]));
      array(incoming[kind]).forEach(function (id) { known.add(id); });
      out[kind] = Array.from(known);
    });
    return out;
  }

  function mergeSnapshot(current, incoming) {
    if (!incoming || !Number.isSafeInteger(Number(incoming.seq)) || Number(incoming.seq) < 0 ||
        !incoming.mem || typeof incoming.mem !== 'object') {
      throw new Error('服务端下行数据格式无效');
    }
    var full = incoming.delta !== true;
    if (full && current && Number(incoming.seq) < Number(current.appliedSeq)) {
      var rollback = new Error('服务端数据序号早于本机确认缓存，缓存保持不变');
      rollback.code = 'SERVER_SEQ_ROLLBACK';
      throw rollback;
    }
    var previous = current && current.snapshot;
    if (!full && !previous) {
      var missingBase = new Error('增量缓存缺少全量基线');
      missingBase.code = 'CACHE_BASE_REQUIRED';
      throw missingBase;
    }
    var old = previous || {};
    var oldMem = object(old.mem), nextMem = full ? clone(incoming.mem) : clone(oldMem);
    var newMem = object(incoming.mem);
    if (full) {
      nextMem = clone(newMem);
    } else {
      nextMem.decks = mergeRows(oldMem.decks, newMem.decks, 'id', false);
      ['best', 'settings'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(newMem, key)) nextMem[key] = clone(newMem[key]);
      });
      var priorStats = object(oldMem.stats), deltaStats = object(newMem.stats);
      var stats = Object.assign({}, priorStats, deltaStats);
      stats.bySentence = mergeMap(priorStats.bySentence, deltaStats.bySentence, false);
      stats.events = mergeUnique(priorStats.events, deltaStats.events, 'id', false);
      nextMem.stats = stats;
      nextMem.mastered = mergeMap(oldMem.mastered, newMem.mastered, false);
      nextMem.deletedItems = mergeMap(oldMem.deletedItems, newMem.deletedItems, false);
      nextMem.logicalCourses = mergeMap(oldMem.logicalCourses, newMem.logicalCourses, false);
      nextMem.reinforceBook = mergeUnique(oldMem.reinforceBook, newMem.reinforceBook, '_key', false);
      var gone = object(incoming.entityGone);
      removeKeys(nextMem.mastered, gone.mastered);
      removeKeys(nextMem.deletedItems, gone.deletedItem);
      removeKeys(nextMem.logicalCourses, gone.logicalCourse);
      var goneReinforce = new Set(array(gone.reinforce));
      nextMem.reinforceBook = nextMem.reinforceBook.filter(function (row) { return !row || !goneReinforce.has(row._key); });
    }

    var deleted = object(incoming.deleted), nextStats = object(nextMem.stats);
    if (!full) {
      var goneDecks = new Set(array(deleted.decks));
      nextMem.decks = array(nextMem.decks).filter(function (row) { return !row || !goneDecks.has(row.id); });
      array(deleted.kv).forEach(function (key) {
        if (key !== 'stats') delete nextMem[key];
      });
      if (array(deleted.kv).indexOf('stats') >= 0) {
        nextStats = Object.assign({ totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }, object(newMem.stats));
      }
      removeKeys(nextStats.bySentence = object(nextStats.bySentence), deleted.sentences);
      var goneEvents = new Set(array(deleted.events));
      nextStats.events = array(nextStats.events).filter(function (row) { return !row || !goneEvents.has(row.id); });
    } else if (array(deleted.events).length) {
      var fullGoneEvents = new Set(array(deleted.events));
      nextStats.events = array(nextStats.events).filter(function (row) { return !row || !fullGoneEvents.has(row.id); });
    }
    nextMem.stats = nextStats;

    var oldRevs = object(old.revs), newRevs = object(incoming.revs);
    var revs = full ? clone(newRevs) : clone(oldRevs);
    ['decks', 'kv', 'courses', 'courseProgress', 'logicalCourses'].forEach(function (group) {
      revs[group] = full ? Object.assign({}, object(newRevs[group])) : mergeObject(oldRevs[group], newRevs[group]);
    });
    var deletedCourses = object(old.deleted), nextDeleted = full ? {} : clone(deletedCourses);
    Object.keys(deleted).forEach(function (group) {
      nextDeleted[group] = full ? array(deleted[group]).slice() : Array.from(new Set(array(nextDeleted[group]).concat(array(deleted[group]))));
    });

    var courses = mergeRows(old.courses, incoming.courses, 'courseId', full);
    var courseProgress = mergeMap(old.courseProgress, incoming.courseProgress, full);
    var learningResumes = mergeMap(old.learningResumes, incoming.learningResumes, full);
    var learningGenerations = clone(object(incoming.learningGenerations));
    if (!full) {
      removeKeys(courseProgress, deleted.courseProgress);
      removeKeys(learningResumes, deleted.learningResumes);
      var goneCourses = new Set(array(deleted.courses));
      courses = courses.filter(function (row) { return !row || !goneCourses.has(row.courseId); });
    }

    var entityGone = mergeTombstones(old.entityGone, incoming.entityGone, full);
    if (!full) {
      var liveMastered = new Set(Object.keys(object(newMem.mastered)));
      var liveDeletedItems = new Set(Object.keys(object(newMem.deletedItems)));
      var liveLogicalCourses = new Set(Object.keys(object(newMem.logicalCourses)));
      var liveReinforce = new Set(array(newMem.reinforceBook).map(function (row) { return row && row._key; }).filter(Boolean));
      entityGone.mastered = array(entityGone.mastered).filter(function (id) { return !liveMastered.has(id); });
      entityGone.deletedItem = array(entityGone.deletedItem).filter(function (id) { return !liveDeletedItems.has(id); });
      entityGone.logicalCourse = array(entityGone.logicalCourse).filter(function (id) { return !liveLogicalCourses.has(id); });
      entityGone.reinforce = array(entityGone.reinforce).filter(function (id) { return !liveReinforce.has(id); });
    }

    return {
      key: CACHE_KEY,
      owner: current && current.owner,
      scope: current && current.scope,
      appliedSeq: Number(incoming.seq),
      snapshot: {
        mem: nextMem,
        courses: courses,
        courseProgress: courseProgress,
        learningResumes: learningResumes,
        learningGenerations: learningGenerations,
        revs: revs,
        entityGone: entityGone,
        seq: Number(incoming.seq), delta: false, deleted: {}
      },
      updatedAt: Date.now()
    };
  }

  function identity() {
    if (!global.AccountStorage || !global.ChunkAPI || !global.IDBStore) throw new Error('服务端缓存尚未初始化');
    global.AccountStorage.assertCurrent();
    var base = new URL(global.ChunkAPI.getBase() || global.location.origin, global.location.origin);
    base.hash = ''; base.search = '';
    return { owner: global.AccountStorage.owner, scope: JSON.stringify([base.href.replace(/\/+$/, ''), global.AccountStorage.owner, 3]) };
  }

  function apply(incoming, requestIdentity, expectedSeq) {
    var full = incoming.delta !== true;
    if (!full && Number(incoming.seq) < Number(expectedSeq)) {
      var invalidRange = new Error('服务端增量水位倒退'); invalidRange.code = 'INVALID_CACHE_DELTA';
      return Promise.reject(invalidRange);
    }
    return global.IDBStore.readServerCache(requestIdentity.scope, requestIdentity.owner).then(function (current) {
      if (!full && (!current || current.appliedSeq !== expectedSeq)) {
        return { applied: false, stale: true, retired: [] };
      }
      var row = mergeSnapshot(current, incoming);
      row.owner = requestIdentity.owner; row.scope = requestIdentity.scope;
      global.AccountStorage.assertCurrent();
      return global.IDBStore.commitServerCache(row, current ? current.appliedSeq : null, full).then(function (result) {
        if (result && result.applied && global.LogicalCourseStore && global.LogicalCourseStore.setConfirmed) {
          try { global.LogicalCourseStore.setConfirmed(Object.keys(object(row.snapshot.mem.logicalCourses)).map(function(key){return row.snapshot.mem.logicalCourses[key];})); }
          catch (error) { console.warn('[server-cache] 逻辑课程确认视图未刷新：',error&&error.message||error); }
        }
        if (result && result.applied && typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
          global.dispatchEvent(new global.CustomEvent('server-cache-applied', {
            detail: { owner:requestIdentity.owner, scope:requestIdentity.scope, seq:row.appliedSeq }
          }));
        }
        return result;
      });
    });
  }

  function refresh() {
    if (inFlight) return inFlight;
    var captured = identity();
    inFlight = global.IDBStore.readServerCache(captured.scope, captured.owner).then(function (current) {
      if (!identityMatches(captured)) throw sessionChanged();
      var since = current ? current.appliedSeq : null;
      return global.ChunkAPI.getData(since).then(function (snapshot) {
        if (!identityMatches(captured)) throw sessionChanged();
        return apply(snapshot, captured, since).then(function (result) {
          if (result.stale) return refreshAfterStale(captured);
          return global.IDBStore.readServerCache(captured.scope, captured.owner).then(function (row) {
            return { cache: row, retired: result.retired || [] };
          });
        });
      });
    }).finally(function () { inFlight = null; });
    return inFlight;
  }

  function refreshAfterStale(captured) {
    if (!identityMatches(captured)) return Promise.reject(sessionChanged());
    return global.IDBStore.readServerCache(captured.scope, captured.owner).then(function (current) {
      if (!identityMatches(captured)) throw sessionChanged();
      return global.ChunkAPI.getData(current ? current.appliedSeq : null).then(function (snapshot) {
        if (!identityMatches(captured)) throw sessionChanged();
        return apply(snapshot, captured, current ? current.appliedSeq : null).then(function (result) {
          if (result.stale) return refreshAfterStale(captured);
          return global.IDBStore.readServerCache(captured.scope, captured.owner).then(function (row) {
            return { cache: row, retired: result.retired || [] };
          });
        });
      });
    });
  }

  function identityMatches(captured) {
    try { var now = identity(); return now.owner === captured.owner && now.scope === captured.scope; }
    catch (_) { return false; }
  }
  function sessionChanged() { var error = new Error('账号或服务已切换，确认缓存未应用'); error.code = 'SESSION_CHANGED'; return error; }

  function projectCourseProgress(row, pending) {
    var progress = JSON.parse(JSON.stringify(row.snapshot.courseProgress || {}));
    var deletedCourses = Object.create(null);
    var completedRestarts = Object.create(null);
    var confirmedEvents = array(row.snapshot.mem && row.snapshot.mem.stats && row.snapshot.mem.stats.events);
    (pending || []).slice().sort(function(a,b){ return a.ordinal - b.ordinal; }).forEach(function(item){
      if (item.owner !== row.owner || item.scope !== row.scope || item.status === 'blocked') return;
      if (item.receipt && Number(item.receipt.seq) <= row.appliedSeq) return;
      var op = item.operation || {}, p = op.payload || {};
      if (op.type === 'course.delete' && p.courseId) {
        deletedCourses[p.courseId] = true;
        delete progress[p.courseId];
        delete progress['enrollment:v1:' + encodeURIComponent(p.courseId)];
      } else if (op.type === 'course.enrollment' && p.courseId && typeof p.joined === 'boolean') {
        if (deletedCourses[p.courseId]) return;
        var membershipKey = 'enrollment:v1:' + encodeURIComponent(p.courseId);
        var priorMembership = progress[membershipKey] || {};
        var changedAt = Number(item.createdAt) || 0;
        progress[membershipKey] = {kind:'course-enrollment',schemaVersion:1,courseId:p.courseId,joined:p.joined,
          joinedAt:priorMembership.joinedAt || changedAt,changedAt:changedAt};
        return;
      } else if (op.type === 'course.restart' && p.courseId) {
        if (deletedCourses[p.courseId]) return;
        if (completedRestarts[p.eventId] || confirmedEvents.some(function(event){return event&&event.id===p.eventId;})) return;
        completedRestarts[p.eventId] = true;
        var restarted = progress[p.courseId] || {};
        var scopeKey = 'course:' + p.courseId;
        var generation = Math.max(Number(restarted.generation) || 0,
          Number(object(row.snapshot.learningGenerations)[scopeKey]) || 0) + 1;
        var history = Array.isArray(restarted.history) ? restarted.history.slice() : [];
        if ((array(restarted.seen).length) || (array(restarted.passed).length) || restarted.completed === true) {
          history.push({generation:Number(restarted.generation) || 0,
            seen:array(restarted.seen).slice(), passed:array(restarted.passed).slice(),
            completed:restarted.completed === true, completedAt:Number(restarted.completedAt) || 0,
            restartedAt:Number(item.createdAt) || 0});
        }
        progress[p.courseId] = {generation:generation,seen:[],passed:[],completed:false,history:history};
        if (p.currentNodeId) progress[p.courseId].currentNodeId = p.currentNodeId;
        return;
      } else if (op.type === 'deck.delete' && p.deckId) {
        delete progress['enrollment:v1:' + encodeURIComponent(p.deckId)];
        return;
      }
      if (op.type !== 'course.progress' || !p.courseId) return;
      if (deletedCourses[p.courseId]) return;
      var current = progress[p.courseId] || {};
      if ((Number(p.generation) || 0) !== (Number(current.generation) || 0)) return;
      current.seen = Array.isArray(current.seen) ? current.seen : [];
      current.passed = Array.isArray(current.passed) ? current.passed : [];
      if (p.nodeId && current.seen.indexOf(p.nodeId) < 0) current.seen.push(p.nodeId);
      if (p.nodeId && p.passed && current.passed.indexOf(p.nodeId) < 0) current.passed.push(p.nodeId);
      current.completed = !!current.completed || !!p.completed;
      if (p.currentNodeId) current.currentNodeId = p.currentNodeId;
      if (p.courseVersion) current.courseVersion = p.courseVersion;
      if (p.runtimeProfile) current.runtimeProfile = p.runtimeProfile;
      progress[p.courseId] = current;
    });
    return progress;
  }

  function projectCatalog(row, pending) {
    var courses = JSON.parse(JSON.stringify(row.snapshot.courses || []));
    var decks = JSON.parse(JSON.stringify(row.snapshot.mem && row.snapshot.mem.decks || []));
    function put(list, item, key) {
      var id = item && item[key]; if (!id) return;
      var index = list.findIndex(function(existing){ return existing && existing[key] === id; });
      if(index < 0) list.push(item); else list[index] = item;
    }
    function remove(list, id, key) {
      var index = list.findIndex(function(item){ return item && item[key] === id; });
      if(index >= 0) list.splice(index,1);
    }
    (pending || []).slice().sort(function(a,b){return a.ordinal-b.ordinal;}).forEach(function(item){
      if(item.owner !== row.owner || item.scope !== row.scope || item.status === 'blocked') return;
      if(item.receipt && Number(item.receipt.seq) <= row.appliedSeq) return;
      var operation=item.operation||{}, payload=operation.payload||{};
      if(operation.type==='course.put' && payload.course) put(courses,payload.course,'courseId');
      else if(operation.type==='course.delete') remove(courses,payload.courseId,'courseId');
      else if(operation.type==='deck.put' && payload.deck) put(decks,payload.deck,'id');
      else if(operation.type==='deck.delete') remove(decks,payload.deckId,'id');
      else if(operation.type==='deck.publish') {
        var deck=decks.find(function(value){return value.id===payload.deckId;});
        if(deck && typeof payload.publish==='boolean') deck.isPublic=payload.publish;
      }
    });
    var deletedItems=JSON.parse(JSON.stringify(row.snapshot.mem&&row.snapshot.mem.deletedItems||{}));
    var logicalCourses=JSON.parse(JSON.stringify(row.snapshot.mem&&row.snapshot.mem.logicalCourses||{}));
    (pending||[]).slice().sort(function(a,b){return a.ordinal-b.ordinal;}).forEach(function(item){
      if(item.owner!==row.owner||item.scope!==row.scope||item.status==='blocked') return;
      if(item.receipt&&Number(item.receipt.seq)<=row.appliedSeq) return;
      var operation=item.operation||{},payload=operation.payload||{};
      if(operation.type==='deck.itemsVisibility'&&Array.isArray(payload.keys)&&typeof payload.hidden==='boolean'){
        payload.keys.forEach(function(key){if(payload.hidden)deletedItems[key]=true;else delete deletedItems[key];});
      } else if(operation.type==='logicalCourse.put'&&payload.course&&payload.course.id){
        logicalCourses[payload.course.id]=payload.course;
      } else if(operation.type==='logicalCourse.delete'&&payload.courseId){
        delete logicalCourses[payload.courseId];
      }
    });
    return {courses:courses,decks:decks,courseProgress:projectCourseProgress(row,pending),deletedItems:deletedItems,logicalCourses:Object.keys(logicalCourses).map(function(key){return logicalCourses[key];})};
  }

  function projectMainMem(row, pending) {
    if (!row || !row.snapshot || !object(row.snapshot.mem)) return { ready:false, reason:'cache-unavailable' };
    var relevantPending = (pending || []).filter(function(item){
      return item && item.owner === row.owner && item.scope === row.scope &&
        !(item.receipt && Number(item.receipt.seq) <= Number(row.appliedSeq));
    }).slice().sort(function(a,b){ return a.ordinal - b.ordinal; });
    var canProjectPending = relevantPending.every(function(item){
      var operation = item.operation || {};
      return item.status !== 'blocked' &&
        (operation.type === 'learning.answer' || operation.type === 'learning.exposure' || operation.type === 'learning.roundComplete' ||
          operation.type === 'learning.mark' || operation.type === 'mistake.remove' ||
          operation.type === 'learning.resume' || operation.type === 'settings.patch' ||
          operation.type === 'assessment.start' || operation.type === 'assessment.answer' || operation.type === 'assessment.finalize' ||
          operation.type === 'learning.reset' ||
          operation.type === 'course.progress' || operation.type === 'course.enrollment' || operation.type === 'course.restart' ||
          operation.type === 'course.delete' || operation.type === 'deck.delete' ||
          operation.type === 'deck.itemsVisibility' || operation.type === 'logicalCourse.put' || operation.type === 'logicalCourse.delete' ||
          operation.type === 'deck.put' || operation.type === 'deck.publish');
    });
    if (!canProjectPending) return { ready:false, reason:'pending-operations' };
    if (!validatePendingCourseAndVisibilityOperations(row,relevantPending)) return { ready:false, reason:'pending-course-projection' };
    if (!validatePendingCourseRestarts(row,relevantPending)) return { ready:false, reason:'pending-course-restart-projection' };
    if (!validatePendingLearningResets(row,relevantPending)) return { ready:false, reason:'pending-learning-reset-projection' };
    if (!validatePendingLogicalCourses(row,relevantPending)) return { ready:false, reason:'pending-logical-course-projection' };
    if (!validatePendingDeckWrites(row,relevantPending)) return { ready:false, reason:'pending-deck-write-projection' };
    if (!validatePendingCourseDeletes(row,relevantPending)) return { ready:false, reason:'pending-course-delete-projection' };

    var courseProgress = projectCourseProgress(row,relevantPending);
    var mem = JSON.parse(JSON.stringify(row.snapshot.mem));
    mem.settings = object(mem.settings);
    var learningGenerations = JSON.parse(JSON.stringify(object(row.snapshot.learningGenerations) ? row.snapshot.learningGenerations : {}));
    projectPendingCourseRestarts(mem,relevantPending,courseProgress);
    if (!projectPendingLearningResets(mem,relevantPending,learningGenerations)) return { ready:false, reason:'pending-learning-reset-projection' };
    if (!projectPendingAnswers(mem, relevantPending, row)) return { ready:false, reason:'pending-learning-projection' };
    if (!projectPendingMarks(mem, relevantPending, row)) return { ready:false, reason:'pending-learning-mark-projection' };
    if (!projectPendingMistakeRemovals(mem, relevantPending)) return { ready:false, reason:'pending-mistake-projection' };
    if (!projectPendingVisibility(mem, relevantPending)) return { ready:false, reason:'pending-visibility-projection' };
    projectPendingLogicalCourses(mem,relevantPending);
    projectPendingDeckWrites(mem,relevantPending);
    if (!projectPendingContentDeletes(mem,relevantPending,learningGenerations)) return { ready:false, reason:'pending-content-delete-projection' };
    var progress = Object.create(null);
    var resumes = object(row.snapshot.learningResumes) ? row.snapshot.learningResumes : {};
    Object.keys(resumes).forEach(function(sessionId){
      var resume = resumes[sessionId];
      if (!object(resume) || typeof resume.deckId !== 'string' || !resume.deckId ||
          !Number.isSafeInteger(Number(resume.idx)) || Number(resume.idx) < 0) return;
      if (relevantPending.some(function(item){
        var operation=item.operation||{}, payload=operation.payload||{};
        return (operation.type==='deck.delete'&&payload.deckId===resume.deckId) ||
          (operation.type==='course.delete'&&(payload.courseId===resume.deckId||payload.courseId===resume.courseId));
      })) return;
      var previous = progress[resume.deckId];
      var updatedAt = Number(resume.updatedAt) || 0;
      if (previous && (previous.time > updatedAt || (previous.time === updatedAt && previous.sessionId >= String(resume.sessionId || sessionId)))) return;
      var projected = { idx:Number(resume.idx), time:updatedAt, sessionId:String(resume.sessionId || sessionId),
        generation:Number(resume.generation) || 0 };
      if (typeof resume.practiceMode === 'string' && resume.practiceMode) projected.practiceMode = resume.practiceMode;
      if (resume.contentCursor != null) projected.contentCursor = resume.contentCursor;
      progress[resume.deckId] = projected;
    });
    relevantPending.forEach(function(item){
      var operation = item.operation || {}, payload = operation.payload || {};
      // Assessment sessions live in their own durable draft/session stores. They must not
      // mutate the account-wide learning projection (especially with an unconfirmed score).
      if (operation.type === 'assessment.start' || operation.type === 'assessment.answer' || operation.type === 'assessment.finalize') return;
      if (operation.type === 'settings.patch') {
        mem.settings = mergeObject(mem.settings, object(payload.patch));
        return;
      }
      if (operation.type !== 'learning.resume' || typeof payload.deckId !== 'string' || !payload.deckId ||
          typeof payload.sessionId !== 'string' || !payload.sessionId ||
          !Number.isSafeInteger(Number(payload.idx)) || Number(payload.idx) < 0) return;
      var generation = Number(payload.generation) || 0;
      var generationKey = 'course:' + (payload.courseId || payload.deckId);
      if (generation !== (Number(object(row.snapshot.learningGenerations)[generationKey]) || 0)) return;
      var previous = progress[payload.deckId];
      var updatedAt = Number(item.createdAt) || 0;
      if (previous && (previous.time > updatedAt ||
          (previous.time === updatedAt && previous.sessionId >= payload.sessionId))) return;
      var projected = { idx:Number(payload.idx), time:updatedAt, sessionId:payload.sessionId, generation:generation };
      if (typeof payload.practiceMode === 'string' && payload.practiceMode) projected.practiceMode = payload.practiceMode;
      if (payload.contentCursor != null) projected.contentCursor = payload.contentCursor;
      progress[payload.deckId] = projected;
    });
    if (!projectPendingRounds(mem, relevantPending, progress)) return { ready:false, reason:'pending-round-projection' };
    Object.keys(courseProgress).forEach(function(courseId){
      var item=courseProgress[courseId];
      if (object(item) && Number.isSafeInteger(Number(item.generation))) learningGenerations['course:'+courseId]=Number(item.generation);
    });
    var catalogProjection=projectCatalog(row,relevantPending);
    restoreRoundMetrics(progress, array(mem.stats && mem.stats.events));
    return {
      ready:true,
      mem:mem,
      courses:catalogProjection.courses,
      courseProgress:courseProgress,
      progress:progress,
      learningGenerations:learningGenerations,
      appliedSeq:Number(row.appliedSeq)
    };
  }

  function restoreRoundMetrics(progress, events) {
    var sessions = Object.create(null);
    Object.keys(progress).forEach(function(deckId){
      var resume = progress[deckId];
      sessions[JSON.stringify([resume.sessionId,resume.generation])] = {resume:resume,answers:[],seen:new Set()};
    });
    events.forEach(function(event){
      if(!event || event.type !== 'practice') return;
      // Downlink events omit deckId, and review sessions can span source decks.
      // The stable account-scoped session and generation identify the round.
      var session = sessions[JSON.stringify([event.sessionId,Number(event.generation)||0])];
      if(!session || session.seen.has(event.id)) return;
      session.seen.add(event.id);
      session.answers.push(event);
    });
    Object.keys(sessions).forEach(function(key){
      var session=sessions[key], answers=session.answers.sort(function(a,b){return a.answerOrder-b.answerOrder;});
      if(!answers.length) return;
      var metrics={answerOrder:answers.length,chunkRight:0,chunkTotal:0,combo:0,maxCombo:0,perfectCount:0};
      for(var i=0;i<answers.length;i++){
        var answer=answers[i];
        if(answer.answerOrder!==i || !Number.isSafeInteger(answer.chunkRight) ||
            !Number.isSafeInteger(answer.chunkTotal) || answer.chunkRight<0 || answer.chunkTotal<answer.chunkRight) return;
        metrics.chunkRight+=answer.chunkRight;
        metrics.chunkTotal+=answer.chunkTotal;
        metrics.combo=answer.ok?metrics.combo+1:0;
        metrics.maxCombo=Math.max(metrics.maxCombo,metrics.combo);
        if(answer.ok) metrics.perfectCount++;
      }
      Object.assign(session.resume,metrics);
    });
  }

  function validatePendingCourseRestarts(row,pending) {
    var restarts=pending.filter(function(item){return item.operation && item.operation.type==='course.restart';});
    var seen=Object.create(null), events=array(row.snapshot.mem && row.snapshot.mem.stats && row.snapshot.mem.stats.events);
    for(var i=0;i<restarts.length;i++) {
      var item=restarts[i], payload=item.operation.payload||{}, eventId=payload.eventId, courseId=payload.courseId;
      if(typeof eventId!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(eventId)||
          typeof courseId!=='string'||!courseId||courseId.length>200||
          (payload.currentNodeId!==undefined&&(typeof payload.currentNodeId!=='string'||payload.currentNodeId.length>200))) return false;
      if(seen[eventId] && stableJson(seen[eventId])!==stableJson(payload)) return false;
      seen[eventId]=payload;
      var existing=events.find(function(event){return event&&event.id===eventId;});
      if(existing && (existing.kind!=='courseRestart'||existing.courseId!==courseId)) return false;
      var interleaved=pending.some(function(other){
        if(other===item||!other.operation) return false;
        var op=other.operation, p=op.payload||{};
        if(op.type==='course.restart'&&p.eventId===eventId&&stableJson(p)===stableJson(payload)) return false;
        var target=p.courseId || p.deckId;
        return target===courseId && ['learning.answer','learning.exposure','learning.mark','learning.roundComplete',
          'learning.resume','course.progress','course.restart'].includes(op.type);
      });
      if(interleaved) return false;
    }
    return true;
  }

  function validatePendingLearningResets(row,pending) {
    var resets=pending.filter(function(item){return item.operation&&item.operation.type==='learning.reset';});
    var seen=Object.create(null), generations=object(row.snapshot.learningGenerations)?row.snapshot.learningGenerations:{};
    var events=array(row.snapshot.mem&&row.snapshot.mem.stats&&row.snapshot.mem.stats.events);
    for(var i=0;i<resets.length;i++) {
      var item=resets[i], payload=item.operation.payload||{}, eventId=payload.eventId, courseId=payload.courseId;
      if(!hasOnlyKeys(payload,['eventId','courseId','expectedGeneration'])||
          typeof eventId!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(eventId)||
          typeof courseId!=='string'||!courseId||courseId.length>200||
          !Number.isSafeInteger(payload.expectedGeneration)||payload.expectedGeneration<0||
          payload.expectedGeneration!==(Number(generations['course:'+courseId])||0)) return false;
      if(seen[eventId]&&stableJson(seen[eventId])!==stableJson(payload)) return false;
      seen[eventId]=payload;
      var existing=events.find(function(event){return event&&event.id===eventId;});
      if(existing&&(existing.kind!=='learningReset'||existing.courseId!==courseId||
          Number(existing.generation)!==payload.expectedGeneration+1)) return false;
      var interleaved=pending.some(function(other){
        if(other===item||!other.operation)return false;
        var op=other.operation,p=op.payload||{};
        if(op.type==='learning.reset'&&p.eventId===eventId&&stableJson(p)===stableJson(payload)) return false;
        var target=p.courseId||p.deckId;
        return target===courseId&&['learning.answer','learning.exposure','learning.mark','learning.roundComplete',
          'learning.resume','learning.reset','course.progress','course.restart','course.delete','deck.delete'].includes(op.type);
      });
      if(interleaved) return false;
    }
    return true;
  }

  function projectPendingLearningResets(mem,pending,generations) {
    var resets=pending.filter(function(item){return item.operation&&item.operation.type==='learning.reset';});
    if(!resets.length)return true;
    var stats=object(mem.stats)?mem.stats:{}, bySentence=object(stats.bySentence)?stats.bySentence:{}, events=array(stats.events).slice();
    var applied=Object.create(null);
    for(var i=0;i<resets.length;i++) {
      var item=resets[i], payload=item.operation.payload||{}, eventId=payload.eventId, courseId=payload.courseId;
      if(applied[eventId])continue;
      applied[eventId]=true;
      var prefix=courseId+'#', resetCount=0;
      Object.keys(bySentence).forEach(function(key){
        if(!key.startsWith(prefix))return;
        var previous=object(bySentence[key])?bySentence[key]:{};
        bySentence[key]={deckId:typeof previous.deckId==='string'?previous.deckId:courseId,
          times:0,okTimes:0,wrongTimes:0,streak:0,maxStreak:0,lastAt:0,
          interval:1,ease:2.5,dueAt:0,
          learningV1:{version:1,evidence:[],baselineAt:Number(item.createdAt)||Date.now(),lastExposureAt:0,
            interval:1,ease:2.5,repetition:0}};
        resetCount++;
      });
      var existing=events.find(function(event){return event&&event.id===eventId;});
      if(existing) {
        if(existing.kind!=='learningReset'||existing.courseId!==courseId||
            Number(existing.generation)!==payload.expectedGeneration+1) return false;
      } else {
        events.push({id:eventId,kind:'learningReset',courseId:courseId,
          generation:payload.expectedGeneration+1,resetSentenceCount:resetCount,at:Number(item.createdAt)||Date.now()});
      }
      generations['course:'+courseId]=payload.expectedGeneration+1;
    }
    stats.bySentence=bySentence;
    stats.events=events;
    mem.stats=stats;
    return true;
  }

  function validatePendingLogicalCourses(row,pending) {
    var base=object(object(row.snapshot.mem).logicalCourses);
    var revisionRoot=object(row.snapshot.revs);
    var revisions=object(revisionRoot.logicalCourses);
    var touched=Object.create(null);
    for(var i=0;i<pending.length;i++) {
      var operation=pending[i].operation||{}, payload=operation.payload||{}, id, course;
      if(operation.type==='logicalCourse.put') {
        course=payload.course; id=course&&course.id;
        if(!hasOnlyKeys(payload,['course','expectedSeq'])||!object(course)||
            !hasOnlyKeys(course,['id','title','coverImage','catalogKey','origin','contentType','createdAt','updatedAt'])||
            typeof id!=='string'||!id.startsWith('logical-course:')||id.length>200||
            typeof course.title!=='string'||!course.title.trim()||course.title.length>120||
            typeof course.coverImage!=='string'||course.coverImage.length>2*1024*1024||
            typeof course.catalogKey!=='string'||course.catalogKey!=='logical:'+id||
            course.origin!=='user'||course.contentType!=='story'||
            typeof course.createdAt!=='string'||course.createdAt.length>50||
            typeof course.updatedAt!=='string'||course.updatedAt.length>50||
            (payload.expectedSeq!==null&&(!Number.isSafeInteger(payload.expectedSeq)||payload.expectedSeq<0))) return false;
      } else if(operation.type==='logicalCourse.delete') {
        id=payload.courseId;
        if(!hasOnlyKeys(payload,['courseId','expectedSeq'])||typeof id!=='string'||!id.startsWith('logical-course:')||
            id.length>200||!Number.isSafeInteger(payload.expectedSeq)||payload.expectedSeq<0) return false;
      } else continue;
      if(touched[id]) return false;
      touched[id]=true;
      var currentRevision=Object.prototype.hasOwnProperty.call(revisions,id)?revisions[id]:null;
      if(payload.expectedSeq!==currentRevision) return false;
      if(operation.type==='logicalCourse.delete'&&!Object.prototype.hasOwnProperty.call(base,id)) return false;
    }
    return true;
  }

  function projectPendingLogicalCourses(mem,pending) {
    var courses=object(mem.logicalCourses)?mem.logicalCourses:{};
    pending.forEach(function(item){
      var operation=item.operation||{}, payload=operation.payload||{};
      if(operation.type==='logicalCourse.put') courses[payload.course.id]=JSON.parse(JSON.stringify(payload.course));
      else if(operation.type==='logicalCourse.delete') delete courses[payload.courseId];
    });
    mem.logicalCourses=courses;
  }

  function validatePendingDeckWrites(row,pending) {
    var revisions=object(object(row.snapshot.revs).decks), decks=array(object(row.snapshot.mem).decks);
    var touched=Object.create(null);
    for(var i=0;i<pending.length;i++) {
      var item=pending[i], operation=item.operation||{}, payload=operation.payload||{}, id, current;
      if(operation.type==='deck.put') {
        var deck=payload.deck;
        id=deck&&deck.id;
        if(!hasOnlyKeys(payload,['deck','clearRetiredMarker'])||!object(deck)||
            typeof id!=='string'||!id||id.length>64||!Array.isArray(deck.items)||
            (payload.clearRetiredMarker!==undefined&&typeof payload.clearRetiredMarker!=='boolean')||
            !Object.prototype.hasOwnProperty.call(operation,'expectedRev')||
            (operation.expectedRev!==null&&(!Number.isSafeInteger(operation.expectedRev)||operation.expectedRev<0))) return false;
      } else if(operation.type==='deck.publish') {
        id=payload.deckId;
        if(!hasOnlyKeys(payload,['deckId','publish'])||typeof id!=='string'||!id||id.length>64||
            typeof payload.publish!=='boolean'||!Number.isSafeInteger(operation.expectedRev)||operation.expectedRev<0) return false;
      } else if(operation.type==='deck.delete') {
        id=payload.deckId;
        if(!hasOnlyKeys(payload,['deckId'])||typeof id!=='string'||!id||id.length>200||
            !Object.prototype.hasOwnProperty.call(operation,'expectedRev')||
            (operation.expectedRev!==null&&(!Number.isSafeInteger(operation.expectedRev)||operation.expectedRev<0))) return false;
      } else continue;
      if(touched[id]) return false;
      touched[id]=true;
      var revision=Object.prototype.hasOwnProperty.call(revisions,id)?revisions[id]:null;
      if(operation.expectedRev!==revision) return false;
      current=decks.find(function(value){return value&&value.id===id;});
      if((operation.type==='deck.publish'||operation.type==='deck.delete')&&!current) return false;
      if(operation.type==='deck.delete') {
        var interleaved=pending.some(function(other){
          if(other===item||!other.operation)return false;
          var op=other.operation,p=op.payload||{}, target=p.deckId||p.courseId||p.deck&&p.deck.id||p.course&&p.course.courseId;
          return target===id&&['course.put','course.delete','deck.put','deck.delete','deck.publish',
            'course.progress','course.enrollment','course.restart','learning.answer','learning.exposure','learning.mark',
            'learning.roundComplete','learning.resume','learning.reset','deck.itemsVisibility'].includes(op.type);
        });
        if(interleaved)return false;
      }
    }
    return true;
  }

  function validatePendingCourseDeletes(row,pending) {
    var deletes=pending.filter(function(item){return item.operation&&item.operation.type==='course.delete';});
    var courses=array(row.snapshot.courses), revisions=object(object(row.snapshot.revs).courses), touched=Object.create(null);
    for(var i=0;i<deletes.length;i++) {
      var item=deletes[i], operation=item.operation||{}, payload=operation.payload||{}, id=payload.courseId;
      if(!hasOnlyKeys(payload,['courseId'])||typeof id!=='string'||!id||id.length>200||
          !Object.prototype.hasOwnProperty.call(operation,'expectedRev')||
          (operation.expectedRev!==null&&(!Number.isSafeInteger(operation.expectedRev)||operation.expectedRev<0))||
          !Object.prototype.hasOwnProperty.call(revisions,id)||operation.expectedRev!==revisions[id]||
          !courses.some(function(course){return course&&course.courseId===id;})) return false;
      if(touched[id])return false;
      touched[id]=true;
      var interleaved=pending.some(function(other){
        if(other===item||!other.operation)return false;
        var op=other.operation,p=op.payload||{}, target=p.courseId||p.deckId||p.course&&p.course.courseId||p.deck&&p.deck.id;
        return target===id&&['course.put','course.delete','deck.put','deck.delete','deck.publish',
          'course.progress','course.enrollment','course.restart','learning.answer','learning.exposure','learning.mark',
          'learning.roundComplete','learning.resume','learning.reset','deck.itemsVisibility'].includes(op.type);
      });
      if(interleaved)return false;
    }
    return true;
  }

  function projectPendingDeckWrites(mem,pending) {
    var decks=array(mem.decks).slice(), deletedItems=object(mem.deletedItems);
    function put(deck) {
      var index=decks.findIndex(function(value){return value&&value.id===deck.id;});
      if(index<0) decks.push(JSON.parse(JSON.stringify(deck)));
      else decks[index]=JSON.parse(JSON.stringify(deck));
    }
    pending.forEach(function(item){
      var operation=item.operation||{}, payload=operation.payload||{};
      if(operation.type==='deck.put') {
        put(payload.deck);
        if(payload.clearRetiredMarker===true) delete deletedItems['ai-course-retired:'+payload.deck.id];
      } else if(operation.type==='deck.publish') {
        var deck=decks.find(function(value){return value&&value.id===payload.deckId;});
        if(deck) deck.isPublic=payload.publish;
      }
    });
    mem.decks=decks;
    mem.deletedItems=deletedItems;
  }

  function projectPendingContentDeletes(mem,pending,generations) {
    var deletes=pending.filter(function(item){return item.operation&&
      (item.operation.type==='course.delete'||item.operation.type==='deck.delete');});
    if(!deletes.length)return true;
    var ids=Object.create(null), decks= array(mem.decks).slice(), best=object(mem.best)?mem.best:{},
      mastered=object(mem.mastered)?mem.mastered:{}, stats=object(mem.stats)?mem.stats:{},
      bySentence=object(stats.bySentence)?stats.bySentence:{}, reinforce=array(mem.reinforceBook).slice();
    for(var i=0;i<deletes.length;i++) {
      var item=deletes[i], operation=item.operation||{}, payload=operation.payload||{};
      var isDeck=operation.type==='deck.delete', id=isDeck?payload.deckId:payload.courseId;
      if(ids[id])return false;
      ids[id]=true;
      var sentencePrefix=id+'#', mistakePrefix=id+'::';
      Object.keys(bySentence).forEach(function(key){if(key.startsWith(sentencePrefix))delete bySentence[key];});
      Object.keys(mastered).forEach(function(key){if(key.startsWith(sentencePrefix))delete mastered[key];});
      reinforce=reinforce.filter(function(row){return !(row&&typeof row._key==='string'&&row._key.startsWith(mistakePrefix));});
      if(isDeck) {
        decks=decks.filter(function(deck){return !deck||deck.id!==id;});
        delete best[id];
      }
      generations['course:'+id]=(Number(generations['course:'+id])||0)+1;
    }
    stats.bySentence=bySentence;
    mem.stats=stats;
    mem.decks=decks;
    mem.best=best;
    mem.mastered=mastered;
    mem.reinforceBook=reinforce;
    return true;
  }

  function projectPendingCourseRestarts(mem,pending,courseProgress) {
    var stats=object(mem.stats), events=array(stats.events).slice(), seen=Object.create(null);
    pending.filter(function(item){return item.operation&&item.operation.type==='course.restart';}).forEach(function(item){
      var payload=item.operation.payload||{}, eventId=payload.eventId;
      if(seen[eventId]) return;
      seen[eventId]=true;
      if(events.some(function(event){return event&&event.id===eventId;})) return;
      events.push({id:eventId,kind:'courseRestart',courseId:payload.courseId,
        generation:Number(object(courseProgress[payload.courseId]) && courseProgress[payload.courseId].generation)||1,
        at:Number(item.createdAt)||0});
    });
    if(seen && Object.keys(seen).length){stats.events=events;mem.stats=stats;}
  }

  function projectPendingAnswers(mem, pending, row) {
    var learningRows = pending.filter(function(item){return item.operation &&
      (item.operation.type === 'learning.answer' || item.operation.type === 'learning.exposure');});
    if (!learningRows.length) return true;
    var engine = global.LearningEngine, srs = global.CL && global.CL.srs;
    if (!engine || typeof engine.reducePracticeEvents !== 'function' || !srs || typeof srs.recordResult !== 'function') return false;
    var stats = object(mem.stats), bySentence = object(stats.bySentence), seen = Object.create(null), byKey = Object.create(null);
    var serverEvents = array(stats.events), generations = object(row.snapshot.learningGenerations);
    function alreadyApplied(id, stat) {
      if (serverEvents.some(function(event){return event && event.id === id;})) return true;
      return array(object(stat && stat.learningV1).evidence).some(function(event){return event && event.id === id;});
    }
    function eventDay(time, zone) {
      try {
        var parts = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(time);
        function part(type){var value=parts.find(function(item){return item.type===type;});return value&&value.value;}
        var year=part('year'),month=part('month'),day=part('day');
        return year&&month&&day ? year+'-'+month+'-'+day : null;
      } catch (_) { return null; }
    }
    learningRows.forEach(function(item){
      if (seen.invalid) return;
      var payload = item.operation.payload || {}, operationType = item.operation.type;
      var isAnswer = operationType === 'learning.answer', eventId = payload.eventId;
      if (typeof eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(eventId) ||
          typeof payload.key !== 'string' || typeof payload.deckId !== 'string' ||
          !payload.key.startsWith(payload.deckId+'#') || (isAnswer && typeof payload.ok !== 'boolean')) { seen.invalid = true; return; }
      if (seen[eventId]) {
        if (stableJson(seen[eventId]) !== stableJson(payload)) seen.invalid = true;
        return;
      }
      seen[eventId] = payload;
      var scopeKey = 'course:' + (payload.courseId || payload.deckId);
      if ((Number(payload.generation)||0) !== (Number(generations[scopeKey])||0)) return;
      var stat = object(bySentence[payload.key]);
      if (alreadyApplied(eventId, stat)) return;
      var at = Number(payload.occurredAt), now = Date.now();
      if (!Number.isFinite(at) || at <= 0 || (isAnswer && at <= Number(stat.lastAt||0)) || at > now + 5*60*1000) { seen.invalid = true; return; }
      var day = null;
      if (isAnswer) {
        var timeZone = typeof payload.timeZone === 'string' && payload.timeZone ? payload.timeZone : 'UTC';
        day = eventDay(at, timeZone);
        if (!day) { seen.invalid = true; return; }
      }
      var event = { id:eventId, key:payload.key, deckId:payload.deckId,
        sessionId:payload.sessionId || eventId, at:at, generation:Number(payload.generation)||0,
        type:isAnswer?'practice':'exposure', mode:typeof payload.mode==='string'?payload.mode:'unknown',
        contentFingerprint:typeof payload.contentFingerprint==='string'?payload.contentFingerprint:'',
        policyVersion:Number.isSafeInteger(payload.policyVersion)?payload.policyVersion:1,
        ok:isAnswer&&payload.ok, assisted:isAnswer&&payload.assisted===true,
        firstAttempt:isAnswer&&payload.firstAttempt===true, earlyPractice:isAnswer&&payload.earlyPractice===true };
      if (!byKey[payload.key]) byKey[payload.key] = { events:[], rows:[] };
      byKey[payload.key].events.push(event);
      byKey[payload.key].rows.push(isAnswer
        ? { id:eventId, kind:'answer', key:payload.key, ok:payload.ok, at:at, day:day,
            sessionId:event.sessionId, generation:event.generation, type:'practice', mode:event.mode,
            contentFingerprint:event.contentFingerprint, policyVersion:event.policyVersion,
            assisted:event.assisted, firstAttempt:event.firstAttempt, earlyPractice:event.earlyPractice,
            ...(Number.isSafeInteger(payload.chunkRight)?{chunkRight:payload.chunkRight}:{}),
            ...(Number.isSafeInteger(payload.chunkTotal)?{chunkTotal:payload.chunkTotal}:{}),
            ...(Number.isSafeInteger(payload.answerOrder)?{answerOrder:payload.answerOrder}:{}) }
        : { id:eventId, kind:'learning', type:'exposure', key:payload.key, at:at,
            sessionId:event.sessionId, generation:event.generation });
      if (isAnswer && payload.mistake && object(payload.mistake.row) && typeof payload.mistake.key === 'string') {
        mem.reinforceBook = array(mem.reinforceBook);
        var mistakeIndex = mem.reinforceBook.findIndex(function(existing){return existing && existing._key===payload.mistake.key;});
        if (mistakeIndex < 0) mem.reinforceBook.push(payload.mistake.row);
        else mem.reinforceBook[mistakeIndex] = payload.mistake.row;
      }
    });
    if (seen.invalid) return false;
    Object.keys(byKey).forEach(function(key){
      var result = engine.reducePracticeEvents(bySentence[key] || {}, byKey[key].events, {srs:srs});
      bySentence[key] = result.stat;
    });
    if (!Object.keys(byKey).length) return true;
    stats.bySentence = bySentence;
    stats.totalAnswered = (Number(stats.totalAnswered)||0) + learningRows.reduce(function(total,item){
      return total + (item.operation && item.operation.type === 'learning.answer' ? 1 : 0);
    },0);
    stats.events = serverEvents;
    Object.keys(byKey).forEach(function(key){stats.events=mergeUnique(stats.events,byKey[key].rows,'id',false);});
    mem.stats = stats;
    return true;
  }

  function projectPendingRounds(mem, pending, progress) {
    var rounds = pending.filter(function(item){return item.operation && item.operation.type === 'learning.roundComplete';});
    if (!rounds.length) return true;
    var stats = object(mem.stats), events = array(stats.events), best = object(mem.best);
    var seen = Object.create(null);
    rounds.forEach(function(item){
      if (seen.invalid) return;
      var payload=item.operation.payload||{}, id=payload.eventId;
      if(typeof id!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(id)||
          typeof payload.timeZone!=='string'||!payload.timeZone||
          !Number.isFinite(Number(payload.occurredAt))||Number(payload.occurredAt)<=0||
          (payload.recordBest===true&&(!payload.deckId||!Number.isSafeInteger(payload.answerCount)))){
        seen.invalid=true;return;
      }
      if(seen[id]){
        if(stableJson(seen[id])!==stableJson(payload)) seen.invalid=true;
        return;
      }
      seen[id]=payload;
      if(events.some(function(event){return event&&event.id===id;})) return;
      var at=Number(payload.occurredAt);
      if(at>Date.now()+5*60*1000){seen.invalid=true;return;}
      var parts;
      try{parts=new Intl.DateTimeFormat('en-CA',{timeZone:payload.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);}
      catch(_){seen.invalid=true;return;}
      function part(type){var value=parts.find(function(item){return item.type===type;});return value&&value.value;}
      var year=part('year'),month=part('month'),day=part('day');
      if(!year||!month||!day){seen.invalid=true;return;}
      var dayKey=year+'-'+month+'-'+day, metrics=null;
      if(payload.answerCount!==undefined){
        var sessionAnswers=events.filter(function(event){return event&&event.type==='practice'&&event.sessionId===payload.sessionId;})
          .slice().sort(function(left,right){return Number(left.answerOrder)-Number(right.answerOrder);});
        if(sessionAnswers.length!==payload.answerCount){seen.invalid=true;return;}
        var chunkRight=0,chunkTotal=0,combo=0,maxCombo=0,perfectCount=0;
        for(var answerIndex=0;answerIndex<sessionAnswers.length;answerIndex++){
          var answer=sessionAnswers[answerIndex];
          if(answer.answerOrder!==answerIndex||!Number.isSafeInteger(answer.chunkRight)||
              !Number.isSafeInteger(answer.chunkTotal)||answer.chunkRight<0||answer.chunkTotal<0||answer.chunkRight>answer.chunkTotal){
            seen.invalid=true;return;
          }
          chunkRight+=answer.chunkRight;chunkTotal+=answer.chunkTotal;combo=answer.ok?combo+1:0;
          if(answer.ok)perfectCount++;maxCombo=Math.max(maxCombo,combo);
        }
        metrics={answerCount:sessionAnswers.length,chunkRight:chunkRight,chunkTotal:chunkTotal,
          accuracy:chunkTotal?Math.round(chunkRight/chunkTotal*100):0,maxCombo:maxCombo,perfectCount:perfectCount};
      }
      stats.totalRounds=(Number(stats.totalRounds)||0)+1;
      stats.daysLog=object(stats.daysLog);
      var slot=object(stats.daysLog[dayKey]);
      slot.rounds=(Number(slot.rounds)||0)+1;stats.daysLog[dayKey]=slot;
      var roundEvent=Object.assign({id:id,kind:'round',at:at,sessionId:payload.sessionId||id,day:dayKey},
        payload.deckId?{deckId:payload.deckId}:{},metrics||{});
      events=mergeUnique(events,[roundEvent],'id',false);
      if(payload.recordBest===true&&metrics){
        var previous=object(best[payload.deckId]);
        var previousAcc=Number(previous.acc)||0;
        var improved=metrics.accuracy>previousAcc||
          (metrics.accuracy===previousAcc&&metrics.maxCombo>(Number(previous.combo)||0));
        best[payload.deckId]={acc:improved?metrics.accuracy:previousAcc,
          perfect:improved?metrics.perfectCount:(Number(previous.perfect)||0),
          combo:improved?metrics.maxCombo:(Number(previous.combo)||0),lastPlayed:at,lastAcc:metrics.accuracy};
      }
      if(payload.sessionId&&payload.deckId&&progress[payload.deckId]&&progress[payload.deckId].sessionId===payload.sessionId){
        delete progress[payload.deckId];
      }
    });
    if(seen.invalid) return false;
    stats.events=events;mem.stats=stats;mem.best=best;
    return true;
  }

  function projectPendingMarks(mem, pending, row) {
    var marks = pending.filter(function(item){return item.operation && item.operation.type === 'learning.mark';});
    if (!marks.length) return true;
    var engine=global.LearningEngine, stats=object(mem.stats), events=array(stats.events);
    var mastered=object(mem.mastered), bySentence=object(stats.bySentence), generations=object(row.snapshot.learningGenerations);
    var learningRows=pending.filter(function(item){return item.operation &&
      (item.operation.type==='learning.answer'||item.operation.type==='learning.exposure');});
    var keys=Object.create(null), seen=Object.create(null);
    learningRows.forEach(function(item){var payload=item.operation.payload||{};if(typeof payload.key==='string')keys[payload.key]=true;});
    if (!engine || typeof engine.scheduleFamiliarity!=='function') return false;
    for (var i=0;i<marks.length;i++) {
      var item=marks[i], payload=item.operation.payload||{}, eventId=payload.eventId;
      if(typeof eventId!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(eventId)||
          typeof payload.key!=='string'||payload.key.length>500||typeof payload.deckId!=='string'||!payload.deckId||payload.deckId.length>200||
          !payload.key.startsWith(payload.deckId+'#')||typeof payload.active!=='boolean'||
          (payload.sentence!==undefined&&(typeof payload.sentence!=='string'||payload.sentence.length>1000))||
          (payload.courseId!==undefined&&(typeof payload.courseId!=='string'||!payload.courseId))||
          (payload.generation!==undefined&&(!Number.isSafeInteger(payload.generation)||payload.generation<0))||
          (payload.markedAt!==undefined&&(!Number.isFinite(payload.markedAt)||payload.markedAt<=0))||
          (payload.legacyMigration!==undefined&&(payload.legacyMigration!==true||!payload.active))) return false;
      if(seen[eventId]) {
        if(stableJson(seen[eventId])!==stableJson(payload)) return false;
        continue;
      }
      seen[eventId]=payload;
      if(keys[payload.key]) return false;
      var generation=Number(payload.generation)||0;
      if(generation!==(Number(generations['course:'+(payload.courseId||payload.deckId)])||0)) continue;
      if(events.some(function(event){return event&&event.id===eventId;})) continue;
      var at=payload.markedAt===undefined&&payload.legacyMigration===true
        ? Number(item.createdAt) : Number(payload.markedAt);
      var now=Date.now();
      if(!Number.isFinite(at)||at<=0||at>now+5*60*1000) return false;
      if(payload.active) {
        mastered[payload.key]={deckId:payload.deckId,sentence:payload.sentence||'',markedAt:at};
        var stat=object(bySentence[payload.key]);
        if(!Object.keys(stat).length) stat={deckId:payload.deckId,times:0,okTimes:0,wrongTimes:0,streak:0,maxStreak:0,
          lastAt:0,interval:1,ease:2.5,dueAt:0};
        stat.learningV1=engine.scheduleFamiliarity(stat.learningV1||{version:1,evidence:[],baselineAt:at,
          lastExposureAt:Number(stat.lastAt)||0},{markedAt:at});
        if(!Number(stat.dueAt)) stat.dueAt=stat.learningV1.dueAt;
        bySentence[payload.key]=stat;
      } else {
        delete mastered[payload.key];
      }
      var markEvent={id:eventId,kind:'learning',type:'familiaritySchedule',key:payload.key,at:at,
        active:payload.active,generation:generation};
      if(payload.legacyMigration===true) markEvent.legacyMigration=true;
      events=mergeUnique(events,[markEvent],'id',false);
    }
    mem.mastered=mastered;
    stats.events=events;
    stats.bySentence=bySentence;
    mem.stats=stats;
    return true;
  }

  function projectPendingMistakeRemovals(mem, pending) {
    var removals=pending.filter(function(item){return item.operation&&item.operation.type==='mistake.remove';});
    if(!removals.length)return true;
    var stats=object(mem.stats),events=array(stats.events),reinforceBook=array(mem.reinforceBook).slice(),seen=Object.create(null);
    for(var i=0;i<removals.length;i++){
      var item=removals[i],payload=item.operation.payload||{},eventId=payload.eventId;
      if(typeof eventId!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(eventId)||
          typeof payload.key!=='string'||!payload.key||payload.key.length>600)return false;
      if(seen[eventId]){
        if(seen[eventId].key!==payload.key)return false;
        continue;
      }
      seen[eventId]=payload;
      if(events.some(function(event){return event&&event.id===eventId;}))continue;
      reinforceBook=reinforceBook.filter(function(entry){return !entry||entry._key!==payload.key;});
      events=mergeUnique(events,[{id:eventId,kind:'mistakeRemoved',key:payload.key,at:Number(item.createdAt)||Date.now()}],'id',false);
    }
    mem.reinforceBook=reinforceBook;
    stats.events=events;
    mem.stats=stats;
    return true;
  }

  function validatePendingCourseAndVisibilityOperations(row,pending) {
    var progress=JSON.parse(JSON.stringify(object(row.snapshot.courseProgress)));
    var joinedCourses=Object.create(null), memberships=Object.keys(progress).map(function(key){return progress[key];})
      .filter(function(value){return value&&value.kind==='course-enrollment'&&value.joined===true;});
    memberships.forEach(function(value){if(typeof value.courseId==='string'&&value.courseId)joinedCourses[value.courseId]=true;});
    var deletedItems=JSON.parse(JSON.stringify(object(row.snapshot.mem.deletedItems)));
    var events=array(row.snapshot.mem.stats&&row.snapshot.mem.stats.events), seen=Object.create(null);
    for(var i=0;i<pending.length;i++) {
      var item=pending[i],operation=item.operation||{},payload=operation.payload||{};
      if(operation.type==='course.progress') {
        if(!hasOnlyKeys(payload,['courseId','nodeId','passed','completed','currentNodeId','courseVersion','runtimeProfile','generation'])||
            typeof payload.courseId!=='string'||!payload.courseId||payload.courseId.length>200||
            (payload.nodeId!=null&&(typeof payload.nodeId!=='string'||payload.nodeId.length>200))||
            (payload.currentNodeId!=null&&(typeof payload.currentNodeId!=='string'||payload.currentNodeId.length>200))||
            (payload.generation!==undefined&&(!Number.isSafeInteger(payload.generation)||payload.generation<0))||
            typeof payload.passed!=='boolean'||typeof payload.completed!=='boolean'||
            (payload.courseVersion!=null&&typeof payload.courseVersion!=='string')||
            (payload.runtimeProfile!=null&&(typeof payload.runtimeProfile!=='string'||payload.runtimeProfile.length>80))) return false;
        var courseProgress=progress[payload.courseId]||{};
        if((Number(payload.generation)||0)===(Number(courseProgress.generation)||0)) {
          courseProgress.seen=array(courseProgress.seen).slice();courseProgress.passed=array(courseProgress.passed).slice();
          if(payload.nodeId&&courseProgress.seen.indexOf(payload.nodeId)<0)courseProgress.seen.push(payload.nodeId);
          if(payload.nodeId&&payload.passed&&courseProgress.passed.indexOf(payload.nodeId)<0)courseProgress.passed.push(payload.nodeId);
          courseProgress.completed=!!courseProgress.completed||payload.completed;
          if(payload.currentNodeId)courseProgress.currentNodeId=payload.currentNodeId;
          if(payload.courseVersion)courseProgress.courseVersion=payload.courseVersion;
          if(payload.runtimeProfile)courseProgress.runtimeProfile=String(payload.runtimeProfile).slice(0,80);
          progress[payload.courseId]=courseProgress;
        }
      } else if(operation.type==='course.enrollment') {
        if(!hasOnlyKeys(payload,['courseId','joined'])||typeof payload.courseId!=='string'||!payload.courseId||
            payload.courseId.length>200||typeof payload.joined!=='boolean'||!Number.isFinite(Number(item.createdAt))||Number(item.createdAt)<=0) return false;
        var membershipKey='enrollment:v1:'+encodeURIComponent(payload.courseId), prior=progress[membershipKey]||{};
        if(payload.joined&&!joinedCourses[payload.courseId]) {
          if(Object.keys(joinedCourses).length>=3)return false;
          joinedCourses[payload.courseId]=true;
        } else if(!payload.joined) delete joinedCourses[payload.courseId];
        progress[membershipKey]={kind:'course-enrollment',schemaVersion:1,courseId:payload.courseId,joined:payload.joined,
          joinedAt:prior.joinedAt||Number(item.createdAt),changedAt:Number(item.createdAt)};
      } else if(operation.type==='deck.itemsVisibility') {
        if(!hasOnlyKeys(payload,['eventId','deckId','keys','hidden','expectedHidden'])||
            typeof payload.eventId!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(payload.eventId)||
            typeof payload.deckId!=='string'||!payload.deckId||payload.deckId.length>200||
            !Array.isArray(payload.keys)||!payload.keys.length||payload.keys.length>2000||
            typeof payload.hidden!=='boolean'||typeof payload.expectedHidden!=='boolean'||
            payload.keys.some(function(key){return typeof key!=='string'||!key.startsWith(payload.deckId+'#')||key.length>500;})||
            new Set(payload.keys).size!==payload.keys.length||!Number.isFinite(Number(item.createdAt))||Number(item.createdAt)<=0) return false;
        if(seen[payload.eventId]) {
          if(stableJson(seen[payload.eventId])!==stableJson(payload))return false;
          continue;
        }
        seen[payload.eventId]=payload;
        var committedEvent=events.find(function(event){return event&&event.id===payload.eventId;});
        if(committedEvent) {
          if(stableJson({eventId:committedEvent.id,deckId:committedEvent.deckId,keys:committedEvent.keys,hidden:committedEvent.hidden})!==
              stableJson({eventId:payload.eventId,deckId:payload.deckId,keys:payload.keys,hidden:payload.hidden}))return false;
          continue;
        }
        for(var keyIndex=0;keyIndex<payload.keys.length;keyIndex++) {
          var key=payload.keys[keyIndex], currentHidden=!!deletedItems[key];
          if(currentHidden!==payload.expectedHidden)return false;
          if(payload.hidden)deletedItems[key]=1;else delete deletedItems[key];
        }
      }
    }
    return true;
  }

  function projectPendingVisibility(mem,pending) {
    var stats=object(mem.stats),events=array(stats.events),deletedItems=object(mem.deletedItems),seen=Object.create(null);
    for(var i=0;i<pending.length;i++) {
      var item=pending[i],operation=item.operation||{};
      if(operation.type!=='deck.itemsVisibility')continue;
      var payload=operation.payload||{}, eventId=payload.eventId;
      if(seen[eventId])continue;
      seen[eventId]=true;
      if(events.some(function(event){return event&&event.id===eventId;}))continue;
      payload.keys.forEach(function(key){if(payload.hidden)deletedItems[key]=1;else delete deletedItems[key];});
      events=mergeUnique(events,[{id:eventId,kind:'deckItemsVisibility',deckId:payload.deckId,
        keys:payload.keys.slice(),hidden:payload.hidden,at:Number(item.createdAt)||Date.now()}],'id',false);
    }
    mem.deletedItems=deletedItems;stats.events=events;mem.stats=stats;
    return true;
  }

  function stableJson(value) {
    if (Array.isArray(value)) return '['+value.map(stableJson).join(',')+']';
    if (!value || typeof value !== 'object') return JSON.stringify(value);
    return '{'+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+':'+stableJson(value[key]);}).join(',')+'}';
  }

  global.ServerCache = {
    projectCourseProgress: projectCourseProgress,
    projectCatalog: projectCatalog,
    projectMainMem: projectMainMem,
    mergeSnapshot: mergeSnapshot,
    refresh: refresh,
    read: function () { var id = identity(); return global.IDBStore.readServerCache(id.scope, id.owner); },
    apply: apply
  };
})(window);
