const CURRENT_VERSION = 2;

const MIGRATIONS = {
  1(raw) {
    /* v1 → v2: no shape change; establish the versioned envelope. */
    return raw;
  },
};

function migrate(raw) {
  let target = raw;
  if (!target || typeof target !== 'object') target = {};
  const version = typeof target.version === 'number' && target.version >= 1 ? target.version : 1;
  if (version >= CURRENT_VERSION) return target;
  for (let current = version; current < CURRENT_VERSION; current += 1) {
    const migration = MIGRATIONS[current];
    if (migration) {
      try {
        target = migration(target) || target;
      } catch (error) {
        /* Keep the legacy fail-open behavior: a bad optional migration does not
           discard the user's raw object; the version marker still advances. */
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[core.migrate] v${current}→v${current + 1}`, error);
        }
      }
    }
    target.version = current + 1;
  }
  return target;
}

function defaultMem() {
  return {
    decks: [],
    best: {},
    mastered: {},
    deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] },
    settings: {
      sound: true,
      shuffle: false,
      fxStack: true,
      celebrate: 'confetti',
      mode: 'choose',
      skipMastered: true,
      batchSize: 10,
      autoSpeak: false,
      darkMode: false,
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: '',
    },
  };
}

function mergeCourseProgressSources(localCourses, idbCourses, localProgress, idbProgress) {
  const courseMap = {};
  const local = Array.isArray(localCourses) ? localCourses : [];
  const durable = Array.isArray(idbCourses) ? idbCourses : [];
  local.concat(durable).forEach((course) => {
    if (!course || !course.courseId) return;
    courseMap[course.courseId] = course;
  });
  const localMap = localProgress && typeof localProgress === 'object' ? localProgress : {};
  const durableMap = idbProgress && typeof idbProgress === 'object' ? idbProgress : {};
  return {
    courses: Object.keys(courseMap).map((courseId) => courseMap[courseId]),
    progress: Object.assign({}, localMap, durableMap),
  };
}

function buildBusinessProjection(base, projected, sentenceStats, events) {
  const recovered = base && typeof base === 'object' ? base : defaultMem();
  const source = projected && typeof projected === 'object' ? projected : {};
  Object.keys(source).forEach((key) => {
    if (key !== 'stats') recovered[key] = source[key];
  });
  recovered.stats = Object.assign({}, recovered.stats, source.stats || {}, {
    bySentence: sentenceStats && typeof sentenceStats === 'object' ? sentenceStats : {},
    events: Array.isArray(events) ? events : [],
  });
  return recovered;
}

function buildStatsBusinessMeta(businessMem, owner, commitGeneration) {
  if (!businessMem || typeof businessMem !== 'object') return null;
  const light = {};
  const source = businessMem.stats && typeof businessMem.stats === 'object' ? businessMem.stats : {};
  Object.keys(source).forEach((key) => {
    if (key !== 'bySentence' && key !== 'events') light[key] = source[key];
  });
  return {
    owner: owner == null ? null : owner,
    localGeneration: Number.isSafeInteger(commitGeneration) && commitGeneration >= 0 ? commitGeneration : 0,
    data: {
      best: businessMem.best || {},
      settings: businessMem.settings || {},
      stats: light,
    },
  };
}

function buildStatsPersistencePlan(stats, previousSignatures, previousEventSnapshot, forceFullRewrite, statSignature, eventSnapshot) {
  const source = stats && typeof stats === 'object' ? stats : {};
  const by = source.bySentence && typeof source.bySentence === 'object' ? source.bySentence : {};
  const events = Array.isArray(source.events) ? source.events : [];
  const oldSignatures = previousSignatures && typeof previousSignatures === 'object' ? previousSignatures : {};
  const nextSignatures = Object.assign({}, oldSignatures);
  const signatureOf = typeof statSignature === 'function' ? statSignature : () => 0;
  const snapshotOf = typeof eventSnapshot === 'function' ? eventSnapshot : (items) => ({ count: items.length });
  const dirty = [];
  const gone = [];

  if (forceFullRewrite) {
    Object.keys(by).forEach((key) => { nextSignatures[key] = signatureOf(by[key]); });
    return {
      by, events, dirty: Object.keys(by), gone: [], changed: by,
      eventRows: events, eventFull: true, replaceStats: true,
      nextSignatures, nextEventSnapshot: snapshotOf(events),
    };
  }

  Object.keys(by).forEach((key) => {
    const signature = signatureOf(by[key]);
    if (oldSignatures[key] !== signature) dirty.push(key);
    nextSignatures[key] = signature;
  });
  Object.keys(oldSignatures).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(by, key)) {
      gone.push(key);
      delete nextSignatures[key];
    }
  });

  const prior = previousEventSnapshot && typeof previousEventSnapshot === 'object'
    ? previousEventSnapshot : null;
  let canAppend = false;
  if (prior && events.length >= prior.count) {
    if (prior.count === 0) canAppend = true;
    else canAppend = !!(events[0] && events[0].id) && events[0].id === prior.firstId &&
      !!(events[prior.count - 1] && events[prior.count - 1].id) &&
      events[prior.count - 1].id === prior.lastId;
  }
  const eventFull = !canAppend;
  const eventRows = canAppend ? events.slice(prior.count) : events;
  const changed = {};
  dirty.forEach((key) => { changed[key] = by[key]; });
  return {
    by, events, dirty, gone, changed, eventRows, eventFull, replaceStats: false,
    nextSignatures, nextEventSnapshot: snapshotOf(events),
  };
}

function buildCourseProgressWritePlan(kind, snapshot, diskBase, current, mergeCoursesList, mergeKeyedMap) {
  if (diskBase === null || equalJsonForStorage(current, diskBase)) {
    return { snapshot, merged: false };
  }
  const mergeCourses = typeof mergeCoursesList === 'function' ? mergeCoursesList : ((_, ours) => ours);
  const mergeMap = typeof mergeKeyedMap === 'function' ? mergeKeyedMap : ((_, ours) => ours);
  const nextSnapshot = kind === 'courses'
    ? mergeCourses(diskBase, snapshot, current)
    : mergeMap(diskBase || {}, (snapshot && typeof snapshot === 'object') ? snapshot : {}, current || {});
  return { snapshot: nextSnapshot, merged: true };
}

function parseLegacyStatsRaw(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    const stats = parsed && parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {};
    return {
      bySentence: stats.bySentence && typeof stats.bySentence === 'object' ? stats.bySentence : {},
      events: Array.isArray(stats.events) ? stats.events : [],
    };
  } catch (_) {
    return { bySentence: {}, events: [] };
  }
}

function equalJsonForStorage(left, right) {
  if (left === right) return true;
  try {
    return JSON.stringify(left === undefined ? null : left) === JSON.stringify(right === undefined ? null : right);
  } catch (_) {
    return false;
  }
}

export const CoreStorageState = Object.freeze({
  CURRENT_VERSION, MIGRATIONS, migrate, defaultMem, mergeCourseProgressSources,
  buildBusinessProjection, buildStatsBusinessMeta, buildStatsPersistencePlan,
  buildCourseProgressWritePlan, parseLegacyStatsRaw,
});
