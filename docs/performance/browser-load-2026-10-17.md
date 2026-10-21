# Browser load reduction — 2026-10-17

Scope: reduce optional installation traffic and redundant study telemetry. No
course assets, accounts, learning records or live database were changed. No live
service restart was performed.

## Changes

- SW installation downloads only the existing 126-file atomic learning bundle.
  The 104 optional URLs remain in `PRECACHE_SOFT` for dependency exclusion and
  release hashing, but download only when requested. Optional assets are not
  copied from old releases; this prevents stale unversioned content being reused.
- Optional resources total 7,795,836 raw bytes, including two garden PNGs totaling
  4,664,659 bytes. This is avoided automatic prefetch, not a measured reduction
  in compressed wire traffic. A page that needs an asset still downloads it.
- Optional pages not yet visited in the current release are not guaranteed to
  work offline. Previously visited resources are reused within that release.
- The study tracker suppresses zero-duration pulses only after acknowledging
  the current context. Initial/resume baselines, pending retries, positive study
  intervals, session changes and server deduplication remain intact.

## Verification

Passed:

- `node js/study-usage.test.js`
- `node server/services/usage-client-budget.test.js` (new in-memory SQLite only)
- `node server/services/usage-analytics.test.js` (in-memory SQLite)
- `node scripts/sw-install-budget.test.cjs` (VM install and failure paths)
- `node e2e/sw-install-budget.test.js` (fresh browser, OS-allocated port,
  static allowlisted server, no database): no optional prefetch; all 126 atomic
  resources plus a visited image readable offline; API requests bypass cache.
- `node scripts/sw-navigation-coherence.test.cjs`
- `node scripts/sw-hash.test.js`
- `node scripts/check-sw.js`

Not green:

- `node sw-policy.test.js`: 20 checks pass, existing raw atomic bundle size
  guard fails (2,020,197 bytes versus 1.5 MiB). This change does not expand the
  atomic list or relax the threshold.
- `node e2e/sw-cache.test.js`: installation and initial page checks pass, but
  the course-entry wait times out before offline learning checks. Its full
  learning-flow result is unverified; the focused browser test above does not
  substitute for that end-to-end course-entry check.

No concurrency-capacity claim is made. Existing course persistence and retry
protocols were not redesigned. Changes are in the working tree, not a remote
deployment; clients need to activate the new SW to use this release.

## Follow-up

- Moved five author-only files (studio CSS, metadata editor, illustration review
  CSS/JS and workbench glue) from the atomic bundle to the versioned optional
  list. The generator preserves this classification. No source assets removed.
- Detail shard hydration now coalesces in-flight reads by URL, hash, item count,
  mode and content version. Successful and failed requests leave the in-flight
  map. Per-caller memory preferences remain independent; batch callers do not
  acquire an unbounded memory cache as a side effect.
- New `node js/content-repository-concurrency.test.js` failed before the change
  (eight concurrent batch hydrations caused eight downloads) and passes after it
  (one download). It also checks failure retry, bounded batch memory, retained
  default memory caching and independently hydrated result objects.
- `node e2e/sw-install-budget.test.js` passes with the updated 121-file bundle.
  Current raw atomic size is 1,983,422 bytes; optional resources total 7,834,189
  bytes across 109 URLs. The raw atomic size is still above the 1.5 MiB guard.
- Full `e2e/sw-cache.test.js` now reports the actual course-entry failure:
  `CONTENT_PREPARATION_REQUIRED`. Its temporary database lacks prepared platform
  course content; old `startDeck` assumptions also omit the explicit native start
  action. The test now attempts that action and reports the underlying error.
  Authorization is not bypassed and the full course/offline test is still not
  green. Focused cache tests do not establish offline platform authorization.

## Latest verification — prepared isolated native fixture

This section supersedes the earlier course-entry failure status above.

- `e2e/sw-cache.test.js` now builds a synthetic two-item private platform course
  with the production fragment builder under its newly allocated temporary data
  directory. Test-only auth configuration and signing keys are explicit. It
  registers a synthetic account and uses the actual native start button.
- The test separates legacy offline shard reading from native platform access.
  Cached bytes do not authorize new platform sessions. No production permission
  checks were changed. The old assumption of starting a new platform session
  offline was replaced by an assertion that it is not authorized.
- `node e2e/sw-cache.test.js`: **23 passed / 0 failed**, including online answer
  persistence confirmed by ServerCache, offline shell/modules and cached content,
  no offline platform grant, reconnect and record retention, 401/403 refusal,
  account/version isolation, malformed metadata and SW installation independence.
- Five legacy icon URLs moved to the optional list; original files remain and
  current branded manifest icons remain atomic. Removed 20,821 bytes of automatic
  installation payload. The static test fixture declares a data favicon so the
  browser's implicit favicon request is not misclassified as SW prefetch.
- Current release: `chunklab-eac62c2e`, 116 atomic URLs / 1,962,601 raw bytes;
  114 optional URLs / 7,855,230 raw bytes.
- Focused real-browser install/offline test, install failure-path VM test,
  navigation coherence, SW hash checks, content concurrency, client study tracker
  and client/server usage budget tests pass.
- The **only failing check in the exercised set** remains the 1.5 MiB raw atomic
  budget in `sw-policy.test.js` (20 other checks pass). Its threshold is unchanged.
  This is not a full repository test-suite claim or a 10,000-DAU load test.
- No live database, course archive or existing browser storage accessed; no live
  service restart or remote deployment. The test cleanup validates its temporary
  directory boundary, and browser cleanup now also runs on assertion failures.
