(() => {
  // src/core/sync-intents.mjs
  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }
  function receipt(record) {
    return { key: record.key, operationId: record.operationId };
  }
  function deletedContains(list, id) {
    return Array.isArray(list) && list.some((item) => item && item.id === id);
  }
  function findCourseValue(coursePayload, id) {
    return (Array.isArray(coursePayload) ? coursePayload : []).find((item) => item && item.courseId === id);
  }
  function buildReceipts(options) {
    const input = options || {};
    const equalJson = typeof input.equalJson === "function" ? input.equalJson : Object.is;
    const sameValue = typeof input.sameValue === "function" ? input.sameValue : equalJson;
    const deleted = input.deleted || {};
    const coursePayload = Array.isArray(input.coursePayload) ? input.coursePayload : [];
    const progressPayload = input.progressPayload && typeof input.progressPayload === "object" ? input.progressPayload : {};
    const receipts = [];
    (Array.isArray(input.intents) ? input.intents : []).forEach((record) => {
      if (!record) return;
      if (record.deleted) {
        if (deletedContains(deleted[record.entity], record.id)) receipts.push(receipt(record));
        return;
      }
      const value = record.entity === "courses" ? findCourseValue(coursePayload, record.id) : progressPayload[record.id];
      if (value !== void 0 && equalJson(value, record.value)) receipts.push(receipt(record));
    });
    const statsDelta = input.statsDelta || { sbs: {}, sbsGone: [] };
    const sentEvents = input.sentEvents || {};
    const sentGone = input.sentGone instanceof Set ? input.sentGone : new Set(input.sentGone || []);
    (Array.isArray(input.learningIntents) ? input.learningIntents : []).forEach((record) => {
      if (!record) return;
      const matches = record.entity === "events" ? !record.deleted && !!sentEvents[record.id] : record.deleted ? sentGone.has(record.id) : own(statsDelta.sbs, record.id) && sameValue(statsDelta.sbs[record.id], record.value);
      if (matches) receipts.push(receipt(record));
    });
    return receipts;
  }
  var CoreSyncIntents = Object.freeze({ buildReceipts });

  // scripts/core-sync-intents-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreSyncIntents = CoreSyncIntents;
})();
