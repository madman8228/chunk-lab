# Consolidated optimization review — 2026-10-17

## Scope and verdict

Reviewed the current performance changes in compression, API serialization,
request logging, usage tracking, snapshot SQL/transactions, course policy reads,
detail-shard request coalescing and SW optional-resource installation. The dirty
workspace contains unrelated product work; this is not a repository-wide review
or approval of all uncommitted changes.

No new blocking regression was identified in the scoped review and tests.
One existing size guard remains failing. No runtime code was changed in this
review. No live service restart or remote deployment was performed.

## Re-run results

25 distinct scripts: **24 passed; 1 failed**. Counts refer to scripts, not their
individual assertions. All data-bearing tests use isolated temporary directories
or in-memory SQLite, and browser tests allocate fresh contexts.

Passed:

- server/request-overhead.test.js
- server/response-efficiency.test.js
- server/hotpath-efficiency.test.js
- server/services/data-snapshot-contract.test.js
- server/routes/snapshot-boundary.test.js
- server/services/usage-analytics.test.js
- server/services/usage-client-budget.test.js
- server/operations.test.js
- api.test.js
- account-storage.test.js
- js/study-usage.test.js
- js/content-repository-concurrency.test.js
- js/server-store-save-health.test.js
- scripts/sw-install-budget.test.cjs
- scripts/sw-navigation-coherence.test.cjs
- scripts/sw-hash.test.js
- scripts/check-sw.js
- js/server-store.test.js
- js/server-store-cache-conflict.test.js
- server/compress.test.js (31 checks)
- server/api-compress.test.js (24 checks)
- e2e/sw-install-budget.test.js
- e2e/sw-cache.test.js (23 checks)
- e2e/server-store-queue.test.js

Failed:

- sw-policy.test.js: 20 checks pass, raw atomic bundle budget fails. The 116
  atomic URLs total 1,962,601 bytes against 1,572,864 bytes (1.5 MiB). The threshold
  has not been relaxed. This is raw file size, not measured compressed transfer.

## Reviewed invariants

- SQL statements are shared only inside each service/database; account bindings,
  rows and results are not cached. Full/delta reads retain transaction boundaries,
  sequence limits, tombstones and fresh data after writes or read failures.
- Permission query deduplication is within one course projection only. Policy
  changes remain visible on the next request; there is no cross-request rights cache.
- Shared compression accounting uses independent entry objects before replacing
  bytes; concurrent encodings and budget eviction are tested. Early 304 still
  uses the encoding-specific validator and existing stat-based version policy.
- Small API responses reuse serialized text with Express JSON settings and the
  normal send path. HEAD and legacy overload delegation are retained. Larger
  compression behavior is not being redesigned in this review.
- Study context baselines and pending retry identities remain intact. Account
  changes do not replay old usage under the new account. Empty suppression does
  not reduce the frequency of positive-duration writes.
- Detail downloads coalesce only in flight, with URL/hash/count/mode/version in
  the key. Failure removes the task; batch callers do not gain lasting memory
  retention. Hydrated result items remain independent for each caller.
- Optional resources are no longer fetched during SW installation. They remain
  version-hashed and load on demand. They are not copied across releases. New
  platform learning still requires server authorization even with cached bytes.
- Save retries retain request IDs, account scope, serialized drain, cross-tab
  locking where available, Retry-After and exponential delay with jitter.
  Authentication/session changes pause retry rather than deleting queued work.

## Tradeoffs and limits

- Optional pages/assets not visited in the current release are not guaranteed
  offline; upgrades do not preserve every optional asset offline automatically.
- No live-load benchmark, 2c2g equivalence, 10,000-DAU guarantee or full repository
  suite claim is made. Existing live processes still need an authorized restart
  to load backend changes.
- Further reduction in request count needs endpoint-specific measurements and
  tests; do not remove save confirmation, authorization or retry requests merely
  because they appear frequent. Diagnostic reports already have signature-based
  suppression; visit heartbeats already skip hidden pages; the one-second study
  sampler is local and does not issue one HTTP request per second.
