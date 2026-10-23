# Structured textbook unit titles

## Scope and cause

The Grade 7 lower (2024, People's Education Press) contents already recorded eight complete names. The admin-import generator used vocabulary section labels (`Unit 1`) instead. The browser rendered the stored value correctly; frontend title substitutions were not appropriate.

Keep the existing `units[].title` field. The generator now matches section labels against the source contents and fails on a missing/duplicate mapping. It does not infer names from list position. No duplicate title registry or account-owned course data was added.

## Revision boundary

- Unit IDs, item IDs, membership and order must remain fixed.
- Title revisions and item corrections cannot be combined in one release.
- The content revision remains unchanged. The existing full-unit structure digest changes because it includes titles; its integrity check remains intact.
- Compatibility is resolved centrally against actual immutable release history, only if all book data except unit titles and the derived structure digest is identical. Unknown versions and content/arrangement changes remain rejected.
- Offline bundles carry a fingerprint-covered `priorStructureRevision` only for a verified title-only alias. The current lesson stays pinned; background updates apply on reentry.
- Existing session scopes and resume sequence numbers remain unchanged. Old queued answers can be accepted without rewriting their original payload or clearing storage.
- Coverage projection selects the historical book using both content and structure revision, since multiple title revisions may have the same content revision.

## Published correction

Only `textbook-wordbook:pep-junior-grade7-lower-2024` was changed. Eight titles corrected; all 464 items and original asset references retained. No learning records modified by publication.

- Previous release: `87f3bdce82c25f56a44b544ab483512c34bc4b8554acf75a5b3602008cab082c`
- New release: `2f049c2521498bb897592f5929631173645f0903ab6a6b1001472c46159a6c9f`
- Previous structure: `50f95896af3044e6da2c623848ae9737e9e4da0da0ec75c42c65ec7a9e43a702`
- New structure: `a7b93aa0c18b1dae333d853f04213ac74c81029373904cc5e3db8974f8833255`
- Backup: `server/backups/unit-titles-2026-10-22T08-30-28-274Z`, with per-file verified publication copy, consistent SQLite backup, successful integrity check and target manifest.

The release script defaults to an isolated temporary-directory rehearsal. `--apply` repeats that rehearsal, backs up the real target, then activates an immutable release with a compare-and-swap base check. Older releases are preserved. The live backend was restarted after verification to load the new resolver; PID at delivery: 38076.

## Verification

Passed:

- `node server/wordbook-unit-titles.test.js`: exact source mappings for both Grade 7 volumes, immutable title release, unchanged learning rows, historical scope, queued old-version answer and unknown-version rejection.
- `node server/wordbook-publishing.test.js`
- `node server/admin-wordbook-imports.test.js`
- `node e2e/vocabulary-unit-cache-boundaries.test.cjs`: additionally verifies title-only alias acceptance and unknown alias rejection.
- `node e2e/vocabulary-unit-offline.test.cjs`: real worker, offline refresh, browser restart, two offline answers, reconnect, account isolation and retained pending writes.
- `node scripts/listen-word-ui.test.cjs`
- `node scripts/sw-install-budget.test.cjs`
- `node scripts/gen-sw.js --check`
- Live public details API returns all eight complete titles. The original old-structure offline-unit URL returns HTTP 200, `Unit 1 Animal Friends`, the verified prior structure and 47 items.

Not a full green suite: `server/vocabulary-study.test.js` fails at its existing library fixture setup (line 20, expected 200, got 422). It tries to publish a reference to the retired `pilot-six-v1` sample, which is not in the public catalog. This happens before study operations are created; no unrelated catalog rules were weakened. An anonymous fresh live browser correctly encounters the login gate, so it was not used to claim authenticated live UI/offline acceptance. Original browser data and real account records were not touched for testing.

## Read-only audit / remaining courses

Grade 7 upper (2024) still has 10 generic unit labels, including three starter units; Grade 8 upper (2024) has 8. Their publication packages were not altered in this release. Grade 9 full (2013) has complete names. A later authorized title-only release can use the same safeguards after checking those exact source contents.
