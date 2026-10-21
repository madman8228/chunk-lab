# Server hot-path reductions — 2026-10-17

Scope: three behavior-preserving changes only. No real data migration, live
service restart, remote deployment, write-frequency change or permission cache.

1. Static compression cache accounting: subtract the old entry before replacing
   it. Copy entries before adding another encoding, preserving the previous byte
   count. The 24 MiB budget, output encoding, ETags and HTTP policy are unchanged.
2. Course catalog: read each course policy once for both access level and revision.
   Every catalog request still reads current policy; no cross-request rights cache.
3. Study telemetry: prepare five pulse SQL statements once per service/database.
   Parameters, validation, immediate transaction, replay handling and accounting
   queries are unchanged. This caches SQL statements, not user rows.

`server/hotpath-efficiency.test.js` failed before the changes:

- Second encoding: counter 350 versus 250 actual bytes.
- Synthetic 66-course catalog: 132 reads versus 66 expected.
- Ten pulses: 49 runtime preparations versus zero expected after initialization.

After changes, all three regressions pass. Additional assertions cover concurrent
encoding requests, eviction and retained cache hits, immediate visibility of a
policy change, unchanged earlier responses, retries and independent account totals.

Also passed: `server/compress.test.js` (31 checks), `server/api-compress.test.js`
(24 checks), `e2e/sw-cache.test.js` (23 checks), `server/membership-content.test.js`,
`server/services/usage-analytics.test.js` and `server/services/usage-client-budget.test.js`.
Data-bearing tests use fresh temporary databases/directories or in-memory SQLite;
the production database and existing browser profile are not used.

No CPU-percentage reduction or concurrent-user capacity is claimed. These tests
establish removal of redundant work and preservation of scoped behavior, not a
full repository test-suite pass or production load-test result.

## Response-path follow-up

- Static conditional GET/HEAD checks the existing encoding-specific ETag after
  stat, before reading or compressing a file. A matching cold-cache request now
  does zero body reads and zero encodes. Validator/encoding/Vary/cache headers
  and Range passthrough remain unchanged.
- API JSON is serialized once using Express' current replacer, spaces and escape
  settings. Small responses reuse that text through `res.send`, retaining normal
  Express status, ETag, conditional response and content-length handling. Undefined
  JSON stays an empty JSON-typed response. Legacy multi-argument calls and HEAD
  remain delegated to Express. Compression-failure fallback reuses the same text.
- New `server/response-efficiency.test.js` failed before the changes: one body
  read for a matching ETag, and two toJSON calls for a small response. Both pass
  after the changes. Comparisons against plain Express cover response bytes,
  status/type/ETag, conditional 304, JSON escaping/replacer/indentation, undefined,
  null, 204, custom JSON type and serialization errors, including large gzip JSON.
- Static compression (31 checks), API compression (24 checks), prior hot-path
  efficiency tests and the isolated native/SW browser flow were rechecked.
- No front-end resource policy, permission policy, database schema, live data or
  service process was changed by this response-path follow-up. Backend changes
  are not active in the existing live process until an authorized restart/deploy.

## Snapshot and time-summary statement reuse

- Snapshot SQL is now lazily prepared once per fixed SQL shape, inside each
  reader's database scope. Templates have only full/delta variants; user IDs,
  sequence numbers, rows and results never enter the statement cache keys.
- The snapshot transaction function is constructed once but executed separately
  on every read. The transaction boundary and full/delta/tombstone SQL are intact.
- Time summaries lazily prepare three fixed statements once per analytics service.
  Each call still queries current rows and resolves current resource names.
- Red/green evidence: ten warmed mixed full/delta reads previously prepared 345
  statements; after the change they prepare zero additional statements. Five
  warmed detailed time queries previously prepared 15 statements; now zero.
  Actual query executions and writes are not eliminated or deferred.
- Tests also verify external row changes are immediately visible, independent
  accounts, ahead-of-server cursor fallback, transaction presence on every read,
  rollback after a synthetic read failure, and subsequent successful reads.
- Passed: snapshot-contract, snapshot-boundary, hotpath-efficiency,
  usage-analytics, usage-client-budget, operations, and the 23-check isolated
  native/SW browser flow. No application data or running service was changed.

## Per-request logging and heartbeat overhead

- Request-finish logging reuses the authenticated request's user ID when auth is
  enabled and the request has a Bearer header. It no longer verifies that JWT a
  second time for log attribution. No-token, open-mode and unhandled-route log
  behavior retain the original fallback. Route authorization is unchanged; there
  is no token cache across requests.
- Shanghai day formatting reuses one Intl.DateTimeFormat object. Each call still
  formats the supplied timestamp. Heartbeat SQL is compiled once and executed
  for every heartbeat with the current account/day/time; counts are not throttled.
- `server/request-overhead.test.js` runs extracted actual entry-point functions
  with an isolated in-memory database and instrumented verifier/formatter. It
  failed before the change (one redundant verification; 12 SQL preparations),
  and now passes. Twelve synthetic heartbeats use one SQL statement and formatter
  while preserving three per-account/day rows across Shanghai midnight.
- Also passed: credential suite (33 checks), native/SW browser flow (23 checks),
  response-efficiency, snapshot-contract, hotpath-efficiency and usage analytics.
  These optimizations reduce per-request work, not HTTP request count. Existing
  live processes have not been restarted or remotely deployed.
