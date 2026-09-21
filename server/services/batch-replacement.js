'use strict';

/* Build a conditional replacement batch for account-level resolution. */
function createBatchReplacement(options) {
  const buildMemSnapshot = options.buildMemSnapshot;

  function makeBatchReplacement(userId, local, remote, requestId) {
    const current = remote || buildMemSnapshot(userId);
    const mem = local.mem;
    const currentRevs = current.revs || {};
    const revs = { decks: {}, kv: {}, courses: {}, courseProgress: {} };
    const baseRevs = { decks: {}, kv: {}, courses: {}, courseProgress: {} };
    const deleted = { decks: [], kv: [], courses: [], courseProgress: [] };
    const next = (group, id) => {
      const previous = currentRevs[group] && currentRevs[group][id];
      baseRevs[group][id] = Number.isSafeInteger(previous) ? previous : null;
      revs[group][id] = (Number.isSafeInteger(previous) ? previous : 0) + 1;
    };
    (mem.decks || []).forEach(d => next('decks', d.id));
    (current.mem.decks || []).forEach(d => {
      if (!(mem.decks || []).some(localDeck => localDeck.id === d.id)) {
        next('decks', d.id); deleted.decks.push({ id: d.id, rev: revs.decks[d.id] });
      }
    });
    ['best', 'stats', 'settings'].forEach(k => next('kv', k));
    (local.courses || []).forEach(c => next('courses', c.courseId));
    (current.courses || []).forEach(c => {
      if (!(local.courses || []).some(localCourse => localCourse.courseId === c.courseId)) {
        next('courses', c.courseId); deleted.courses.push({ id: c.courseId, rev: revs.courses[c.courseId] });
      }
    });
    Object.keys(local.courseProgress || {}).forEach(cid => next('courseProgress', cid));
    Object.keys(current.courseProgress || {}).forEach(cid => {
      if (!Object.prototype.hasOwnProperty.call(local.courseProgress || {}, cid)) {
        next('courseProgress', cid); deleted.courseProgress.push({ id: cid, rev: revs.courseProgress[cid] });
      }
    });
    const localBy = (mem.stats && mem.stats.bySentence) || {};
    const remoteBy = (current.mem.stats && current.mem.stats.bySentence) || {};
    const sbsGone = Object.keys(remoteBy).filter(k => !Object.prototype.hasOwnProperty.call(localBy, k));
    const localEventIds = new Set(((mem.stats && mem.stats.events) || []).map(ev => ev && ev.id).filter(Boolean));
    const evsGone = ((current.mem.stats && current.mem.stats.events) || [])
      .map(ev => ev && ev.id).filter(id => id && !localEventIds.has(id));
    const localMastered = mem.mastered || {}, remoteMastered = current.mem.mastered || {};
    const localDeleted = mem.deletedItems || {}, remoteDeleted = current.mem.deletedItems || {};
    const localBook = {}, remoteBook = {};
    (mem.reinforceBook || []).forEach(item => { if (item && item._key) localBook[item._key] = item; });
    (current.mem.reinforceBook || []).forEach(item => { if (item && item._key) remoteBook[item._key] = item; });
    return {
      mem,
      courses: local.courses,
      courseProgress: local.courseProgress,
      revs,
      baseRevs,
      deleted,
      baseSeq: current.seq,
      requestId,
      statsDelta: { sbs: localBy, sbsGone, evs: (mem.stats && mem.stats.events) || [], evsGone },
      entityDelta: {
        mastered: { up: localMastered, gone: Object.keys(remoteMastered).filter(k => !Object.prototype.hasOwnProperty.call(localMastered, k)) },
        reinforceBook: { up: localBook, gone: Object.keys(remoteBook).filter(k => !Object.prototype.hasOwnProperty.call(localBook, k)) },
        deletedItems: { up: localDeleted, gone: Object.keys(remoteDeleted).filter(k => !Object.prototype.hasOwnProperty.call(localDeleted, k)) }
      }
    };
  }
  

  return makeBatchReplacement;
}

module.exports = { createBatchReplacement };

