function asParams(search) {
  if (search && typeof search.get === 'function') return search;
  return new URLSearchParams(String(search || ''));
}

function navigationType(performanceLike) {
  try {
    var nav = performanceLike && performanceLike.getEntriesByType
      ? performanceLike.getEntriesByType('navigation')[0]
      : null;
    if (nav && nav.type) return nav.type;
    if (performanceLike && performanceLike.navigation && performanceLike.navigation.type === 1) return 'reload';
  } catch (error) {
    /* Older browsers may expose neither navigation API. */
  }
  return 'navigate';
}

function isFreshNavigation(type) {
  return type === 'navigate';
}

function readObject(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    var raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

/* Consume one-shot handoffs without deciding how the page renders them. */
function consumeStartHandoff(options) {
  var opts = options || {};
  var sessionStorage = opts.sessionStorage;
  var businessStorage = opts.businessStorage;
  var now = typeof opts.now === 'number' ? opts.now : Date.now();

  var intent = readObject(sessionStorage, '_startIntent');
  if (intent) {
    try { sessionStorage.removeItem('_startIntent'); } catch (error) { /* best effort */ }
    if (intent.version === 1 && intent.kind === 'unit' && intent.unitId) {
      return { kind: 'unit', unitId: intent.unitId };
    }
  }

  var deck = readObject(sessionStorage, '_startDeck');
  if (deck) {
    try { sessionStorage.removeItem('_startDeck'); } catch (error) { /* best effort */ }
    return { kind: 'deck', deck: deck };
  }

  var review = readObject(businessStorage, 'chunklab_pending_review_deck');
  if (review) {
    try { businessStorage.removeItem('chunklab_pending_review_deck'); } catch (error) { /* best effort */ }
    if (now - Number(review.ts || 0) < 30000 && review.deck) {
      return { kind: 'review', deck: review.deck };
    }
  }

  return { kind: 'none' };
}

function resolveEntry(options) {
  var opts = options || {};
  var params = asParams(opts.search);
  var now = typeof opts.now === 'number' ? opts.now : Date.now();
  var type = opts.navigationType || 'navigate';
  var explicitCatalog = !!(params.get('course') && params.get('lesson'));
  if (params.get('protectedCourse')) return { kind: 'protected-course', courseId: params.get('protectedCourse'), unitId: params.get('unit'), explicit: true };
  if (params.get('membership') === '1') return { kind: 'membership', explicit: true };

  if (params.get('assessmentKey')) return { kind: 'assessment', key: params.get('assessmentKey'), explicit: true };

  if (explicitCatalog) {
    return { kind: 'catalog', course: params.get('course'), lesson: params.get('lesson'), explicit: true };
  }
  var reviewHandoff = params.get('reviewHandoff');
  if (params.get('autostart') === '1' && reviewHandoff) {
    return { kind: 'review-handoff', id: reviewHandoff, explicit: true };
  }
  if (params.get('direct') === '1') return { kind: 'direct', explicit: true };
  if (params.get('autostart') === '1') {
    var review = opts.review;
    if (review && review.deck && now - Number(review.ts || 0) < 30000) {
      return { kind: 'review', deck: review.deck, explicit: true };
    }
    return { kind: 'invalid', reason: 'review-expired', explicit: true };
  }

  // Explicit workspace URLs cannot be hijacked by an older study handoff.
  var view = params.get('view');
  if (['home', 'my-learning', 'discover'].includes(view)) return { kind: 'workspace', view: view, explicit: true };
  /* One-shot storage handoffs are valid only on a fresh navigation. */
  if (isFreshNavigation(type)) {
    if (opts.intent && opts.intent.kind === 'unit' && opts.intent.unitId) {
      return { kind: 'unit', unitId: opts.intent.unitId };
    }
    if (opts.deck) return { kind: 'deck', deck: opts.deck };
  }
  return { kind: 'home' };
}

export { consumeStartHandoff, isFreshNavigation, navigationType, resolveEntry };
