import { CoreStatsSignature } from './stats-signature.mjs';

const ROW_ENTITY_KEYS = ['mastered', 'reinforceBook', 'deletedItems'];

function memForCloud(mem) {
  if (!mem) return mem;
  const out = {};
  Object.keys(mem).forEach((key) => { out[key] = mem[key]; });
  const stats = mem.stats;
  if (stats && typeof stats === 'object' && (stats.bySentence || stats.events)) {
    const light = {};
    Object.keys(stats).forEach((key) => {
      if (key !== 'bySentence' && key !== 'events') light[key] = stats[key];
    });
    out.stats = light;
  }
  ROW_ENTITY_KEYS.forEach((key) => { delete out[key]; });
  return out;
}

function buildStatsDelta(mem, marks) {
  const stats = (mem && mem.stats) || {};
  const bySentence = stats.bySentence && typeof stats.bySentence === 'object' ? stats.bySentence : {};
  const events = Array.isArray(stats.events) ? stats.events : [];
  const current = marks || {};
  const previousStats = current.bsSig;
  const previousEvents = current.evIds;
  const statSig = CoreStatsSignature.statSig;
  const sbs = {};
  const sbsGone = [];
  if (previousStats === null || previousStats === undefined) {
    Object.keys(bySentence).forEach((key) => { sbs[key] = bySentence[key]; });
  } else {
    Object.keys(bySentence).forEach((key) => {
      if (previousStats[key] !== statSig(bySentence[key])) sbs[key] = bySentence[key];
    });
    Object.keys(previousStats).forEach((key) => {
      if (!(key in bySentence)) sbsGone.push(key);
    });
  }
  const evs = previousEvents === null || previousEvents === undefined
    ? events
    : events.filter((event) => event && event.id && !previousEvents[event.id]);
  const nextBs = {};
  if (previousStats) Object.keys(previousStats).forEach((key) => { nextBs[key] = previousStats[key]; });
  Object.keys(bySentence).forEach((key) => { nextBs[key] = statSig(bySentence[key]); });
  sbsGone.forEach((key) => { delete nextBs[key]; });
  const nextEvIds = {};
  if (previousEvents) Object.keys(previousEvents).forEach((key) => { nextEvIds[key] = 1; });
  events.forEach((event) => { if (event && event.id) nextEvIds[event.id] = 1; });
  return { sbs, sbsGone, evs, mark: { bsSig: nextBs, evIds: nextEvIds } };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach((key) => { out[key] = stableValue(value[key]); });
    return out;
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function createPendingSet() {
  return { all: true, dirty: {}, gone: {} };
}

function markPending(pending, id) {
  pending.dirty[id] = 1;
}

function markGone(pending, id, rev) {
  pending.gone[id] = rev;
}

function pendingList(pending, list, keyOf) {
  if (pending.all) return list;
  return list.filter((item) => Boolean(pending.dirty[keyOf(item)]));
}

function pendingMap(pending, map) {
  if (pending.all) return map;
  const out = {};
  Object.keys(map).forEach((key) => {
    if (pending.dirty[key]) out[key] = map[key];
  });
  return out;
}

function pendingGone(pending, diffList) {
  const sent = {};
  const list = [];
  Object.keys(pending.gone).forEach((id) => {
    sent[id] = 1;
    list.push({ id, rev: pending.gone[id] });
  });
  (diffList || []).forEach((item) => {
    if (!sent[item.id]) {
      sent[item.id] = 1;
      list.push(item);
    }
  });
  return { list, sent };
}

function ackPending(pending, sentUp, sentGone) {
  Object.keys(sentUp || {}).forEach((id) => { delete pending.dirty[id]; });
  Object.keys(sentGone || {}).forEach((id) => { delete pending.gone[id]; });
  pending.all = false;
}

function discardSupersededDeletes(pending, batch, sentUp, revs) {
  batch.list = batch.list.filter((item) => {
    if (sentUp[item.id] && (revs[item.id] || 0) > item.rev) {
      delete pending.gone[item.id];
      delete batch.sent[item.id];
      return false;
    }
    return true;
  });
}

function idsOf(list, keyOf) {
  const out = {};
  (list || []).forEach((item) => { out[keyOf(item)] = 1; });
  return out;
}

function entitiesNeedingPush(list, keyOf, localRevisions, remoteRevisions) {
  const out = {};
  const local = localRevisions || {};
  const remote = remoteRevisions || {};
  (list || []).forEach((item) => {
    const id = keyOf(item);
    if (!(id in remote)) {
      out[id] = 1;
    } else if ((local[id] || 0) > (remote[id] || 0)) {
      out[id] = 1;
    }
  });
  return out;
}

export const CoreSyncDelta = Object.freeze({
  memForCloud,
  buildStatsDelta,
  sameValue,
  createPendingSet,
  markPending,
  markGone,
  pendingList,
  pendingMap,
  pendingGone,
  ackPending,
  discardSupersededDeletes,
  idsOf,
  entitiesNeedingPush,
});
