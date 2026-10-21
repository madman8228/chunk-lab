# Course catalog request sharing and answer-flow budget — 2026-10-17

## Implemented change

`ChunkAPI.getCourseCatalog()` shares only overlapping reads of `/api/course-content/catalog`, using the existing scope boundary (API base, token, session generation/epoch and account owner). Each consumer receives an independent parsed object. Settled success/error responses are removed immediately; subsequent explicit reads still contact the server. No TTL catalog/rights cache is introduced.

`ContentRepo.loadProtectedCatalog()` uses that named wrapper when available, preserving its previous metadata fallback and the raw-fetch compatibility path for isolated older hosts. `MembershipClient` accepts an optional `readCatalog` adapter; the native course entry injects the same named wrapper. Other membership clients retain their original request interface. Catalog timeout is 8 seconds, matching the existing native entry contract.

No answer POST, grant request, receipt handling, queue draining, delta application, pending-operation retirement or cross-device freshness check is removed. In particular, the answer POST followed by a confirmed delta GET is not treated as an accidental duplicate: pending operations retire only after recoverable confirmation has been applied locally.

## Controlled measurements

Actual Chromium against a freshly allocated temporary server/database and synthetic platform course, with SW active:

- Two repository readers + native entry catalog + explicit API catalog simultaneously: **4 callers → 1 HTTP request**.
- Three real typing answers: all confirmed in the local server-confirmed snapshot. Observed **4 operation POSTs + 4 incremental snapshot GETs**, **0 catalog reads**; no snapshot GET without `since`. The extra operation is retained rather than assumed redundant; this is a whole-window count, not a one-request-per-answer assertion.
- Return using the real exit button: homepage becomes visible, pending home projection is applied, no full snapshot or catalog reread in the observed return window.
- Unrelated API usage/session traffic is not suppressed or counted as catalog savings.

These are bounded synthetic regression measurements, not a production throughput estimate. The performance implementation reduces overlapping catalog work; it does not claim that each answer previously made four catalog requests.

## Verification

- `js/catalog-request-sharing.test.mjs`: pass; actual API and repository source plus native client adapter, startup overlap, response independence, sequential freshness, metadata fallback and retry.
- `api-read-coalescing.test.js`: pass for me/config/catalog, including account/base changes, stale 401, independent results, errors/retry and non-coalesced writes.
- `api.test.js`: pass.
- `js/content-repository-concurrency.test.js`: pass.
- Existing membership session-controller, course gateway, native projection/syntax and image-cache unit tests: pass.
- `e2e/sw-cache.test.js`: **28 checks passed**, including the above answer-flow budgets and existing offline/grant isolation, confirmed synthetic learning writes and image-cache preservation.
- `e2e/stats-request-budget.test.js`, `e2e/course-image-cache.test.js`: pass.
- `scripts/check-sw.js`: pass; generated browser membership bundle and SW hash updated.

Original courses, accounts, browser data and backups were not cleared or migrated. No live service restart or server implementation change. Client must load the new frontend version to use the catalog-sharing adapter.
