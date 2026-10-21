# Statistics auxiliary request budget — 2026-10-17

## Scope

Reduce unnecessary reads without changing persisted learning data, write queues, authorization, or statistics definitions. No dependency added; no live service restart. Generated `js/stats-page.js` and `sw.js` refreshed from their source generators.

## Changes

- Integrated statistics surface announces visibility when the main page changes.
- Hidden statistics handlers mark their projection dirty instead of fetching catalog/index data. Returning to the surface refreshes the dirty projection.
- Vocabulary overview loads only the summary. Event records load when the detail tab is opened, retaining pagination and explicit retry.
- Hidden save/config/focus invalidations are coalesced. Already-started reads may finish, but cannot trigger hidden detail loads.
- Vocabulary responses remain scoped to account owner, session epoch, API base, and generation. Account changes reset view data. Failed reads do not automatically loop through rendering.

## Verification

- `js/stats-request-budget.test.js`: passed; lazy events, repeated hidden invalidations, focus, account switching, completion while hidden, failed-read retry-loop prevention and explicit retry.
- `e2e/stats-request-budget.test.js`: passed in a fresh browser context against an isolated temporary server/database. Archive responses use deterministic route fixtures; catalog requests are counted from the actual app.
  - Three hidden save notifications: zero additional vocabulary summary, vocabulary event, or course catalog requests.
  - Reopen: one additional vocabulary summary request, zero event requests.
  - First detail visit: one event request; switching away/back without invalidation reuses it.
- Statistics page/growth/insights source tests: 7 passed.
- `api-read-coalescing.test.js`: passed.
- `e2e/server-store-queue.test.js`: passed.
- `e2e/sw-cache.test.js`: 23 checks passed, including synthetic authorized learning persistence and offline authorization isolation.
- Legacy `e2e/stats-protocol3.test.js` fails after reload: persistence reports ready, but its document-level `#statsTabs` selector no longer matches the integrated page. `stats.html` redirects to `main.html?view=stats`, whose archive is in a shadow root. This old test is not reported as passed and was left unchanged.

## Images: finding only, not changed here

`src/learning/native-course-session.mjs` loads assets per deck item. Items sharing an image asset ID can therefore invoke the protected download repeatedly and each create a blob URL. `platform-course-source.mjs` uses authorization grants; generic public image caching must not bypass those checks.

A narrowly scoped follow-up is deduplication within one authorized session/batch, preserving grant/owner/version boundaries and blob URL cleanup. SWR/TanStack Query offer mature request caching/deduplication, but do not themselves define these authorization boundaries. No framework or global protected-image cache was added.

All persistence tests used temporary data and isolated ports. Original courses, browser storage, and production data were not modified. These request counts are controlled regression evidence, not a production load/capacity claim.
