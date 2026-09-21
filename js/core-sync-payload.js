(() => {
  // src/core/sync-payload.mjs
  function defaultIdsOf(list, keyOf) {
    const out = {};
    (list || []).forEach((item) => {
      out[keyOf(item)] = 1;
    });
    return out;
  }
  function defaultDeltaHasRows(delta) {
    return Object.keys(delta.up || {}).length > 0 || (delta.gone || []).length > 0;
  }
  function buildSyncPayload(options) {
    const input = options || {};
    const pendingList = input.pendingList;
    const pendingMap = input.pendingMap;
    const pendingGone = input.pendingGone;
    const discardSupersededDeletes = input.discardSupersededDeletes;
    const memForCloud = input.memForCloud;
    const idsOf = input.idsOf || defaultIdsOf;
    const deltaHasRows = input.deltaHasRows || defaultDeltaHasRows;
    if (!pendingList || !pendingMap || !pendingGone || !discardSupersededDeletes || !memForCloud) {
      throw new TypeError("buildSyncPayload requires pending and cloud-shaping helpers");
    }
    const memObj = input.memObj || {};
    const meta = input.meta || { revs: { decks: {}, kv: {} }, deleted: { decks: [], kv: [] } };
    const cmeta = input.cmeta || {
      revs: { courses: {}, courseProgress: {} },
      deleted: { courses: [], courseProgress: [] }
    };
    const pendingDecks = input.pendingDecks;
    const pendingCourses = input.pendingCourses;
    const pendingProgress = input.pendingProgress;
    const intents = Array.isArray(input.intents) ? input.intents : [];
    const canReplayCourses = !!input.canReplayCourses;
    const protectedCourses = input.protectedCourses || /* @__PURE__ */ Object.create(null);
    const protectedProgress = input.protectedProgress || /* @__PURE__ */ Object.create(null);
    let deckPayload = pendingList(pendingDecks, memObj.decks || [], (item) => item.id);
    let coursePayload = pendingList(pendingCourses, input.courses || [], (item) => item.courseId);
    const progPayload = pendingMap(pendingProgress, input.progress || {});
    if (canReplayCourses) {
      intents.forEach((record) => {
        (record.entity === "courses" ? protectedCourses : protectedProgress)[record.id] = true;
      });
      coursePayload = coursePayload.filter((course) => !protectedCourses[course.courseId]);
      Object.keys(progPayload).forEach((id) => {
        if (protectedProgress[id]) delete progPayload[id];
      });
    }
    const sentDecks = idsOf(deckPayload, (item) => item.id);
    const sentCourses = idsOf(coursePayload, (item) => item.courseId);
    const sentProgress = {};
    Object.keys(progPayload).forEach((courseId) => {
      sentProgress[courseId] = 1;
    });
    const deckGone = pendingGone(pendingDecks, meta.deleted.decks);
    const courseGone = pendingGone(pendingCourses, cmeta.deleted.courses);
    const progGone = pendingGone(pendingProgress, cmeta.deleted.courseProgress);
    if (canReplayCourses) {
      courseGone.list = courseGone.list.filter((item) => !protectedCourses[item.id]);
      progGone.list = progGone.list.filter((item) => !protectedProgress[item.id]);
    }
    discardSupersededDeletes(pendingDecks, deckGone, sentDecks, meta.revs.decks || {});
    discardSupersededDeletes(pendingCourses, courseGone, sentCourses, cmeta.revs.courses || {});
    discardSupersededDeletes(pendingProgress, progGone, sentProgress, cmeta.revs.courseProgress || {});
    const memToSend = memForCloud(memObj) || {};
    memToSend.decks = deckPayload;
    const payload = {
      mem: memToSend,
      courses: coursePayload,
      courseProgress: progPayload,
      revs: {
        decks: meta.revs.decks,
        kv: meta.revs.kv,
        courses: cmeta.revs.courses,
        courseProgress: cmeta.revs.courseProgress
      },
      deleted: {
        decks: deckGone.list,
        kv: (meta.deleted.kv || []).concat((input.rejectedDeletesKv || []).filter((item) => {
          return !(meta.deleted.kv || []).some((current) => current.k === item.k);
        })),
        courses: courseGone.list,
        courseProgress: progGone.list
      }
    };
    const delta = input.delta || { sbs: {}, sbsGone: [], evs: [] };
    if (Object.keys(delta.sbs).length || delta.sbsGone.length || delta.evs.length) {
      payload.statsDelta = { sbs: delta.sbs, sbsGone: delta.sbsGone, evs: delta.evs };
    }
    const entityDelta = input.entityDelta;
    if (entityDelta && (deltaHasRows(entityDelta.mastered) || deltaHasRows(entityDelta.reinforceBook) || deltaHasRows(entityDelta.deletedItems))) {
      payload.entityDelta = {};
      if (deltaHasRows(entityDelta.mastered)) {
        payload.entityDelta.mastered = { up: entityDelta.mastered.up, gone: entityDelta.mastered.gone };
      }
      if (deltaHasRows(entityDelta.reinforceBook)) {
        payload.entityDelta.reinforceBook = { up: entityDelta.reinforceBook.up, gone: entityDelta.reinforceBook.gone };
      }
      if (deltaHasRows(entityDelta.deletedItems)) {
        payload.entityDelta.deletedItems = { up: entityDelta.deletedItems.up, gone: entityDelta.deletedItems.gone };
      }
    }
    const sentEvents = /* @__PURE__ */ Object.create(null);
    (delta.evs || []).forEach((event) => {
      sentEvents[event.id] = event;
    });
    return {
      payload,
      deckPayload,
      coursePayload,
      progPayload,
      sentDecks,
      sentCourses,
      sentProgress,
      deckGone,
      courseGone,
      progGone,
      sentEvents,
      sentGone: new Set(delta.sbsGone || [])
    };
  }
  var CoreSyncPayload = Object.freeze({ buildSyncPayload });

  // scripts/core-sync-payload-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreSyncPayload = CoreSyncPayload;
})();
