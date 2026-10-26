# Workspace commit audit — 2026-10-27

Scope: user requested reasonable commits of workspace code and explicitly skipped investigation of Failed to fetch. No remote push, service restart, course publication, account import, or learning-record changes were performed during this cleanup.

## Commits

- `8ef9be4`: listening controls, IPA placement, accent toggle, Enter shortcut, autoplay handling and page-level notices.
- `dcc8dc4`: metadata-only published-course directory indexing with selected-course integrity validation.
- `45b3267`: Cambridge IPA source, coverage, packaging, publication verification tools and review records.
- `409d9b1`: progressive grammar preview modules, semantic illustrations, stable layouts and teaching documentation. Preview only; known regression below.
- `cfeb3ed`: oral/idiom sentence-audio overrides and matching immutable content shards. Older shard versions remain intact.

## Validation

Passed: listening UI fixture (including top notification, retry, constant card height, accent switching and navigation); isolated published-index scale fixture; four phonetic test cases; generated-content consistency; service-worker consistency; 3677 audio references (local existence, exact byte size and SHA-256).

Progressive suite: 43 passed, 1 failed. `src/progressive-building/preview-v3.test.mjs:5` still asserts old step counts for the original three lessons. Its DOM harness and nine-course assumptions also predate current preview expansion. This suite is NOT fully green; no acceptance or formal-publication claim is made. Dedicated new preview tests passed. Follow-up should reconcile the legacy overview test with confirmed teaching behavior, without weakening semantic checks.

Existing service-worker warnings: oversized cached font and missing textbook-production.html. These were not introduced or repaired by this commit cleanup.

## Intentionally uncommitted, preserved on disk

- 3207 hash-named WebP files under assets/ and 16 expression WAV files: course/media assets, excluded from public code commits in accordance with docs/content-assets-repository.md. No private-repository synchronization or remote backup is claimed by this cleanup.
- Four WebP files under --manifest/assets/: apparent command-output directory; preserved for later asset provenance checks.
- Existing deletion records: assets/catalog/default-bubble-v2.webp, default-butterfly-v2.webp, default-dragonfly-v2.webp, and assets/vocabulary-scenes-v1.prompt.md. Their removal was not included in any commit; exact deletion authorization was not established.
- Ignored output/, ref/, drafts/, databases, server/data and backups remain outside the code commits. Published local course packages and their backups were not rewritten or deleted.

The working tree is intentionally not empty. Code changes are committed; the media/deletion items above remain visible for asset-specific handling. Nothing was pushed.
