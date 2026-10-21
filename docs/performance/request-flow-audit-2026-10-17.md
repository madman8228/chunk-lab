# Server interaction flow audit — 2026-10-17

## Scope

Read-only audit of current frontend entry points, shared API wrapper, content
repository, snapshot/save queue, native course source/controller, vocabulary
learning, integrated statistics, telemetry, admin dashboard and content studio.
Generated stats/membership code was traced to its editable sources. No live data,
browser storage or service process was changed. This is source-flow coverage plus
synthetic probes, not a production network capture of every account/course type.

## Flow inventory

| Flow | Current interactions | Existing safeguards / assessment |
| --- | --- | --- |
| Boot / account | config, me, cloud snapshot, manifest, shard map, public platform catalog | me/config already share overlapping requests; snapshot refresh is single-flight; do not add broad credential/result caching |
| Public/discover catalog | public course catalog and content/index metadata | catalog has no in-flight deduplication and is re-read by stats history rebuilds |
| Native course start | catalog, bootstrap/confirmed state, learning-session start with initial batch/grant | current start already carries first batch; preserve authorization and start request IDs |
| Native batch advance | short grant if expired, immutable fragment, bounded prefetch/cache | batch cache and in-flight dedup already exist; do not preload the whole library |
| Image/audio | protected asset fetch using a grant, then blob URL | repeated asset IDs within a rendered batch are fetched repeatedly; sharing requires grant/session-aware boundaries |
| Learning persistence | durable operation POST, ACK, delta snapshot GET, atomic local apply/retire | POST+GET is not an accidental duplicate: removal needs a new confirmed-patch response protocol |
| Save failure recovery | durable request ID retry/receipt, serial drain, optional cross-tab lock, delay/jitter/Retry-After | preserve; do not merge arbitrary writes or discard ACK-awaiting-apply work |
| Wordbook study | item page, current state, individual item, session/complete operation, confirmed refresh, state read | fixed-revision item fetch may be reusable; state reads also carry cross-device concurrency semantics |
| Legacy vocabulary practice | explicit start/me, progress GET, per-result POST, pending-outbox flush | periodic timer exits without HTTP when queue is empty; not a polling GET every 30 seconds |
| Statistics | confirmed snapshot/index/history projection, vocabulary summary/events, focus refresh | main remaining source of avoidable background fan-out after mount |
| Visit / study usage | visible-page heartbeat about once/minute, active study pulse about once/10 seconds | zero-pulse repetition fixed; 1-second sampler is local; trial authorization heartbeat is separate |
| Save diagnostics | debounced aggregate report with signature suppression, pending heartbeat | avoid conflating with learning writes; significance of changing report fields should be measured before throttling |
| Admin dashboard | overview, user list, feedback and three diagnostic reads | user search and time-range changes call all-section load; no periodic dashboard polling found in this entry point |
| Content studio | explicit catalog/course read, validate, save draft, publish | publish persists draft before publish by design; do not drop revision/validation steps to save a request |

## Prioritized findings

### 1. Hidden integrated statistics keep making requests — high priority

Sources: main.html showStatsPage mounts StatsPage once; js/stats-vocabulary.js
load subscribes to global server-cache-applied, cloud-config-changed and focus.
There is no mounted-surface visibility check in load. Hiding pageStats leaves the
listeners active. Each non-overlapping event fetches both vocabulary summary and
events?limit=20, including sentence-only changes. stats.html's own save listener
also invokes loadStatsIndexes, which may fetch the platform catalog.

Synthetic VM probe of actual js/stats-vocabulary.js: initial load = 2 requests;
3 completed generic save events = 6 additional vocabulary reads. This is a
deterministic code-path count, not a measured production request rate. Events
overlapping an existing load are already coalesced, so this is not always +2.

Low-risk remedy: suspend *statistical reads* while the host is hidden, mark its
projection dirty, refresh once when reopening; do not suspend writes or trial
authorization. When visible, only invalidate vocabulary data for relevant
changes once a reliable change-domain signal exists. Do not infer domain merely
from a missing event field. Account changes must discard old projections.

### 2. Vocabulary event details fetched without display — high priority

js/stats-vocabulary.js load uses Promise.all(summary, first 20 events) for every
load, although overview renders summary totals. Fetch events only when the
detail/wrong-record view actually needs them, with independent summary/event
loading/error state and pagination. Preserve first-open behavior when the user
directly enters the detail view. Saves/focus should invalidate, not fetch hidden
detail pages automatically. This removes one request per summary-only refresh.

### 3. Catalog request duplication — high priority, bounded benefit

js/content-repository.js loadProtectedCatalog uses raw fetch every call. Its
startup ready promise and stats history can overlap; native MembershipClient
also reads the same URL through a separate client. Synthetic VM probe: repository
startup plus two simultaneous explicit readers = 3 requests to the same catalog.

Start with scope-aware in-flight sharing across the named catalog reader paths,
not a TTL rights cache. Reuse immutable catalog metadata within a projection
rebuild instead of refetching for every learner-progress change; explicit
publication/access refresh must still see changes. Sequential catalog reduction
requires defined invalidation and is riskier than in-flight sharing.

### 4. Admin all-section refresh — low risk, lower site-wide impact

admin.html load starts six section reads. User search/Enter, date-range changes
and a feedback-status PATCH all invoke that same load. Search can request just
users (1 instead of 6 section requests); a range change generally needs overview;
feedback status can refresh feedback only. Keep a separate explicit refresh-all
button and error/auth behavior. Admin traffic is not a 10,000-DAU hot path.

### 5. Repeated assets within a native batch — medium priority

src/learning/native-course-session.mjs loops each item's image/audio and calls
gateway.loadAssets for every occurrence; PlatformCourseSource/loadAssets has no
blob dedup. A batch that repeats one illustration may issue multiple authorized
reads. Sharing a blob/URL within one session/batch could help image-text courses;
keep per-use asset authorization, release URLs once, and never carry blobs across
accounts/grants without appropriate checks. Actual savings depend on course data.

### 6. Wordbook state reads — inspect further, not immediate low-risk deletion

landing/wordbook-study.js reads state after complete, then loadCurrent reads state
again when Next is clicked. A learner may wait, and another device may change
resume position in between; the second read is not provably redundant. It also
fetches item details by itemId+revision. Immutable-item reuse is a better candidate
than removing concurrency checks. Do not count a state read as safely removable
without tests for revision reset, cross-device resume and removed items.

## Expected impact and boundaries

Highest-confidence next change is a visible-only, dirty-on-hidden statistics
refresh plus lazy vocabulary details. It removes ancillary reads near every
save for users who previously opened stats, without altering the save protocol.
At source level the vocabulary component alone can add two reads per separated
save; with history catalog rebuilding another read is possible. Exact totals
depend on existing data, timing, scope and which views have been mounted.

Do not combine the visit/study/trial heartbeats casually: they implement distinct
analytics and authorization contracts. Do not delay answer persistence until tab
close. Do not cache all /api GET responses or extend permission lifetime.

This audit does not assert a percentage CPU/request reduction, a production peak
capacity, or that every custom/imported course and failure mode was exercised.
No runtime changes were made. Implement the first findings with synthetic request
count tests and isolated browser save/account/reconnect verification next.
