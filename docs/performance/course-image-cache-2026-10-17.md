# Persistent authorized course images — 2026-10-17

## Scope and behavior

Platform course images fetched through `NativeCourseSession` / `PlatformCourseSource` now use a separate persistent Cache Storage namespace. Only images actually used by a delivered learning batch are stored. No course-wide download, new dependency, original-asset changes, audio persistence, or learning-record migration is introduced.

- Stable cache namespace: SHA-256 of API base and account owner; no bearer token or short grant is stored.
- Entry identity: course ID, content version and asset ID. No time-based expiration or conditional image request on a cache hit.
- Every read still requires the existing active authorization and fragment asset allowlist. Expired grants are renewed before accessing cached bytes. Cache existence cannot authorize offline learning or bypass account changes.
- Identical concurrent loads share a download. Duplicate assets within a delivered batch reuse one blob URL; URLs are released through the existing lifecycle.
- Image MIME, positive size and stored byte length are checked before reuse. Missing/damaged entries download only the requested asset. Failed downloads are not retained as successful cache entries.
- Storage unavailable/full: learning falls back to normal downloads without evicting courses, records, backups, or unrelated browser data.
- New site versions preserve `course-images-v1-<64 hex digits>` while retaining existing cleanup for other old caches.

## User control

Personal settings → account group → **图片缓存** shows current-account image count and payload MB. **清除图片缓存** requires confirmation and deletes only that account's separate image cache. Cancelling changes nothing. Existing downloads cannot refill a cleared cache within the current page's cache module. Existing displayed blob URLs remain valid until their normal release; future use fetches the cleared images again.

This is browser-local caching, not guaranteed permanent storage: private browsing, manual site-data removal or browser storage eviction can remove entries. Changed course content versions use new cache entries. Old-version entries remain until user cleanup. The byte display counts cached image payload, not browser metadata or other page-image caches.

## Validation

- `node src/learning/course-image-cache.test.mjs`: pass. Concurrent deduplication, new-instance reuse, owner/version isolation, manual clear, clear during pending download, retry, unavailable storage, next-day grant renewal without image download, denied/unauthorized assets, SW retention guard.
- `node e2e/course-image-cache.test.js`: pass, real Chromium with a new context and temporary isolated server/database. Two concurrent consumers produce one image request; page reload produces zero further image requests. Desktop 1231px and mobile 390px settings checked; cancel keeps the cache; confirmed clear affects only images; subsequent use makes one new download. Image endpoint uses a synthetic fixture; production authorization contracts are separately tested below.
- `node e2e/sw-cache.test.js`: 24 checks pass, including retention of a synthetic independent image cache during actual SW activation, original authorization/offline isolation, and confirmed synthetic learning writes.
- Existing course gateway, native course projection/syntax, SW hash check and settings-group browser tests pass.

No live server restart, production browser-data clear, course mutation, or real-account migration performed. Client bundle and SW hash regenerated; browsers must load the new frontend/SW version to use this behavior.

UI follows the incumbent settings layout and colors per impeccable; no settings redesign was performed.
