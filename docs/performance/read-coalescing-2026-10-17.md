# In-flight account/config reads — 2026-10-17

The home account entry, auth initialization and core cloud setup independently
call getConfig/me. Only these two named wrappers now coalesce same-scope reads
that overlap in time. Generic request(), course content, membership decisions,
heartbeats and all writes remain unchanged.

Scope includes API base, token, local session generation, persisted session epoch,
account owner and account epoch. A replaced scope never joins the old promise.
Settling an old promise cannot delete a newer scope's entry. Every success is
scope-checked per subscriber and deep-copied so consumers cannot mutate each
other's returned data. Success and failure both release the in-flight entry;
there is no completed-response cache or expiry interval.

Red/green test: `node api-read-coalescing.test.js` initially failed (eight me
calls sent eight requests), and now passes for both me/getConfig with one request
per eight concurrent callers. Additional checks: next read fetches fresh data,
network failure retry, response independence, new-account/new-base separation,
late old-account 401, old-promise cleanup, different endpoints and unchanged POSTs.

Also passed: api.test.js, account-storage.test.js, js/server-store.test.js,
scripts/sw-navigation-coherence.test.cjs, scripts/check-sw.js, the 23-check
e2e/sw-cache.test.js and e2e/server-store-queue.test.js. Browser/data tests use
fresh contexts and temporary isolated server databases, not live data.

SW release regenerated as chunklab-f8d54d77. Ordinary sequential calls are not
reduced; no production traffic-reduction percentage is claimed. No live restart
or remote deployment. Existing clients must activate the new frontend bundle.
