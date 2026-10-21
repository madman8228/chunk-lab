# M2 发布与恢复基线

- Status: in-progress
- Updated: 2026-10-20
- Base HEAD observed: `7dc9bd0e738d5734c3adba2a54a72ef10f9c525d`
- Worktree observed after the isolated restart test change: 132 tracked modifications and 7,309 total status entries; HEAD is not a complete representation of the current product.
- Live service: `127.0.0.1:6979` was not restarted, switched, or modified.
- Real accounts, course archives, and production backups: not accessed or modified.

## Scope

Establish a safe release/recovery baseline after M1. This is not a production deployment, full repository test run, or verification that a real production backup can restore a real account. All persistence tests below used newly allocated temporary data directories and isolated ports; the recovery-baseline unit test used an in-memory SQLite database.

## Evidence collected

| Check | Result | Boundary |
| --- | --- | --- |
| `server/services/recovery-baseline.test.js` | Passed: lazy writer, non-empty-account protection, atomic restore | In-memory SQLite; no real account |
| `server/backup-cli-recovery.test.js` | Passed: isolated export, immutable archive, account-bound preview, confirmed apply, retry after lost response, and account data surviving an isolated server process restart | Temporary DB and isolated server; not a production archive |
| `e2e/recovery-handover-gate.test.js` | Passed: current learning remains available if archived-operation handover is unavailable | Isolated browser/server test |
| `e2e/batch-sync.test.js` | Passed 15 checks for persisted queue, stable retries, receipts, conflicts, and concurrency | Historical queue fixture; explicitly not full product-page integration |
| `e2e/server-store-queue.test.js` | Passed: IndexedDB queue retry test | Isolated SQLite server and fresh temporary data directory |
| `e2e/server-authoritative-startup.test.js` | Passed: startup, retry after reload, deduplication, server import, and second page | Isolated SQLite server and fresh temporary data directory |
| `e2e/upgrade-check.js` | Passed 36/36: legacy migration/data preservation, Service Worker cache transition, old-write rejection, protocol-3 answer persistence, reload deduplication, and zero page errors | Isolated temporary database, port, and browser contexts; test-owned temp directory removed by the test |
| `scripts/core-sync-replay.test.mjs` | Passed: offline sync-intent replay safeguards | In-memory test doubles; no network or account data |
| `server/static-guard.test.js` | Passed 179/179; confirms ordinary `/assets/...` paths remain publicly servable while sensitive paths are blocked | Temporary static test roots; no live server |
| `server/vocabulary-material-backup.test.js` | Passed: isolated WAL snapshot, provenance/delivery archive, reopen recovery, deduplication, failure cleanup, preservation of prior backups, and CLI integration | Synthetic source and fresh temporary data; not an owner archive |
| `scripts/deploy-safety.test.js` | Passed 38/38 after the fixes below | Temporary script copy and temporary database; no deployment |
| `scripts/check-deploy-files.js` | Passed: deployment manifest covers all 508 computed runtime dependencies | Static dependency/manifest check only |
| Deployment archive exclusion check | Passed across the full `assets/` tree: six delivery WebPs and the runtime garden background remained; all inventoried source/master files were excluded | Tar streamed directly through a listing/verification pipeline; no archive file or deployment created |
| `scripts/check-generated.mjs` | Passed: checked-in generated output matches current source | Build outputs written only to a newly allocated temporary directory; no repository outputs regenerated |
| `scripts/validate-content.mjs` | Passed: manifest, detail shards, and indexes are consistent (65 oral decks / 3,259 sentences; 418 high-frequency phrases) | Validates the existing content manifest/shards, not editorial approval of new material |
| `scripts/check-content-generated.mjs` | Passed: generated content matches source | Output built in a newly allocated temporary directory; no repository content regenerated |
| Untracked `content/**/*.json` syntax check | Passed: all 10 files parse as JSON | Syntax only; no schema, editorial, rights, or publication approval implied |
| `scripts/build-vocabulary-content.test.mjs` | Passed: six existing pilot lessons preserve artwork/revision identity; all referenced image and fallback files meet the byte limit | Synthetic build output in a fresh temp directory; does not approve publication |
| `scripts/vocabulary-course-contract.test.cjs` | Passed: classification, units, portable guided content, validation, read-only preflight, and strict new-package image policy | Package and test data isolated in a fresh temporary directory |
| `git diff --check` | Passed: no whitespace errors | Git reported line-ending conversion warnings only; no files were rewritten |

## Read-only scope inventory

- Current status inventory: 132 tracked modifications plus 7,177 untracked entries (including this report), 7,309 total. No attempt was made to classify, move, or clean these entries.
- `assets/` contains 6,225 untracked files and 3 modified tracked files. Of these, three high-school vocabulary asset directories contain 1,068 image files; each inspected image is strictly below 20,000 bytes (largest: 19,968 bytes). This confirms the current size constraint for these files only; it does not constitute a content, rights, or course-release approval.
- The worktree also contains untracked files across `scripts/`, `docs/`, `drafts/`, `server/`, `e2e/`, `js/`, and `landing/`. Their presence means the runtime dependency manifest alone cannot identify the approved product release scope.
- Recomputed the current `scripts/deploy-prod.sh` `FILES` array after the source-art exclusions: 279 manifest entries expand to 6,894 archive entries, 6,872 unique paths, 22 duplicate paths, and zero missing entries. The unique-file total is 95,717,617 bytes. A sorted unique-path + size + per-file SHA-256 aggregate fingerprint at this inspection time is `9559bc56f6e6423f67f0c83c57a8b05d600bde50c1ac0cd63fadbb95a9b532b`. This replaces the earlier pre-exclusion count/fingerprint; it identifies a momentary tree, not an approved immutable release.
- Asset/course boundary: `scripts/deploy-prod.sh` selects the entire `assets/` directory, and ordinary `/assets/...` requests pass the sensitive-path guard before `express.static`. Read-only inventory found six `vocabulary-*-landscape-master-v2.png` originals plus `vocabulary-scenes-v1.png` (7 files; 17,813,858 bytes total). Their paths are not classified sensitive. The deploy archive now explicitly excludes these files and `vocabulary-landscapes-v2.sources.json`; the originals remain in the workspace. A full-tree archive/listing check confirmed delivery WebPs and runtime garden backgrounds remain. This closes the identified package-boundary issue for these known sources, but is not evidence that the unavailable local/live service currently serves them or a complete audit of every image's editorial approval. The textbook draft notes distinguish the course package from reusable illustrations: source scans/extraction drafts are under excluded `output/`, and illustration review JSON is behind `adminOnly`; publishing reusable images alone does not publish the word list.
- Current deploy-manifest boundary review: `FILES` selects the whole `assets/` and `content/` directories, with the exact source-art exclusions applied during tar packaging. Untracked top-level `c/`, `g/`, `s/`, `tmp/`, and `output/` are not included. `content/` currently has 10 untracked JSON files and 1 modified tracked file, including vocabulary pilot entries and oral/SEO content; their JSON syntax and generated-content consistency pass, but this does not constitute editorial or publication approval. This inventory is not an approval or immutable snapshot.

## Documentation status reconciliation

| Document | Declared state/evidence | Reconciled interpretation |
| --- | --- | --- |
| `2026-10-20-project-review-and-learning-record-closure.md` | `complete`; its M1 implementation and acceptance checklist is checked, with visual/content review explicitly left voluntary/pending | Authoritative status for M1; does not close M2 or approve course publication |
| `2026-10-20-course-completion-and-textbook-delivery.md` | Its previous `complete` header conflicted with ten unchecked broad acceptance items; execution notes distinguish completed technical implementation from pending human review and later release work | Header now says `implementation-complete; broader acceptance pending`; original checklist remains unchecked rather than implying user acceptance |
| `2026-10-14-membership-entitlements-and-trial.md` / `2026-10-15-unified-static-course-delivery.md` | The 2026-10-14 handoff is marked `needs-planning` and explicitly superseded for content-delivery architecture; its historical continuation notes say `in-progress`. The 2026-10-15 successor is `in-progress` | Treat the 2026-10-15 document as the current content-delivery implementation tracker; do not interpret the older document's continuation notes as a competing active task. Neither is a reason to enable membership or delay free-course preparation |
| `2026-09-21-reliability-and-simplification.md` | `complete` with one unchecked clean-Linux/GitHub workflow item; the same document explicitly limits that item to an external gate outside its A1–A6 scope | Status is consistent with the stated scope; retain the external gate as pending rather than reopening completed local work |
| `2026-09-28-mistake-review-own-ai.md` | Status is completed; execution notes enumerate implementation of evidence capture/sync, stats UI, authoring flow/source linkage, and targeted unit/E2E/build checks. The original plan/validation/acceptance checklists were not reconciled; the recorded browser evidence includes 390px but does not establish the whole planned visual matrix | Treat implementation and the recorded targeted checks as complete. Leave the historical checklist untouched; do not infer full visual acceptance, user acceptance, commit, or deployment |
| `2026-09-29-mistake-export-batches.md` | Implementation and validation sections are checked and execution notes document the final 200-item click-to-copy flow, 450-item browser flow, 100,000-item synthetic batching, and relevant regressions. Six broad acceptance items remain unchecked; one still asks for download verification, although a later user-directed UX change removed download in favor of sequential copying | Treat the documented implementation/targeted tests as complete. The download criterion is superseded by the recorded product decision; synthetic 100,000-item batching is not a persistence-capacity claim. Do not equate unchecked owner-acceptance criteria with missing implementation |
| This M2 report | `in-progress` | Current active stage after M1; release snapshot, current runtime version, backup reconciliation, and candidate-specific recovery evidence remain open |

This is a targeted reconciliation of the current M1/M2 handoffs, their explicitly cross-referenced membership delivery dependency, and historical complete/checklist mismatches. The two mistake-review handoffs above are now reconciled by recorded scope and evidence without retroactively changing their checkboxes. This is not a claim that every historical implementation note in `docs/implementation/` has been normalized.

## Local backup and runtime inventory

- Read-only listing of `server/backups/` found six database snapshot files dated 2026-09-30 through 2026-10-15, three separately documented account/procedure snapshot folders, and a Unit 2 import record. The existing records describe online SQLite backups with successful integrity checks; those historical records are evidence of those snapshots only, not a current backup or restore approval.
- No `vocabulary_materials_*` archive was present under this repository's `server/backups/` at inspection time. The actual source material/assets remain in the worktree and must not be treated as backed up merely because they are in the deployment tree.
- `server/data/` contains `chunklab.db` alongside `chunklab.db-wal` and `chunklab.db-shm`. These files were not opened, copied, or hashed. Never treat the main SQLite file by itself as a consistent backup while WAL state exists.
- Read-only health check of `127.0.0.1:6979` was refused, and no listener was found on that port at inspection time. Therefore the current runtime version and its data-directory mapping are unknown; the service was not started or changed.

## Fix made

The deployment manifest omitted `server/services/vocabulary-course-progress.js`, although the runtime dependency checker correctly requires it after M1. The safety test caught the mismatch. Added this single service file to `scripts/deploy-prod.sh`'s `FILES` list. A separate static-asset audit found that the whole `assets/` directory is deployed, including source-only vocabulary masters. The archive command now excludes the six named `vocabulary-*-landscape-master-v2.png` files, `vocabulary-scenes-v1.png`, and `vocabulary-landscapes-v2.sources.json`; all originals remain in the workspace. The deployment safety test now asserts these exclusions. The 38/38 safety test, dependency checker, shell syntax check, and an isolated tar stream test passed. No deployment was attempted.

## Release decision

**No immutable release candidate is established.** The observed HEAD predates the actual current state, and the worktree contains 7,309 status entries, including M1 source files that are untracked. Passing generated-output and deployment-manifest checks prove consistency and dependency coverage, not that all current work is reviewed, committed, packaged, or approved for release. Do not run the production deployment script or claim 6979 reflects the new M1 behavior on this evidence.

## Remaining M2 work

1. Create an owner-reviewed release snapshot from the intended exact source state, without cleaning or resetting this worktree; identify included code, generated static assets, course/material assets, and their hashes. The current 7,309-entry working state and the 6,872-file deployment inventory are mutable inventories, not that approved snapshot.
2. Reconcile the approved snapshot to a fresh, verified database and materials backup inventory. Existing local snapshots are historical and no materials archive was found under the repository backup path. A new real backup, migration, or restore into a real account requires explicit authorization for the exact target; until then, keep verification synthetic and isolated.
3. Verify startup/upgrade and rollback behavior on a fresh isolated instance using only that candidate snapshot; record the tested revision, asset manifest, temporary database, and outcome.
4. Reassess whether a candidate is release-ready. Deployment remains a separate user-authorized action.

## Execution record

- 2026-10-20: Ran the isolated tests and static deployment checks listed above, including `e2e/upgrade-check.js` (36/36), `server/static-guard.test.js` (179/179), and the material-backup test. Added an isolated process-restart persistence assertion to `server/backup-cli-recovery.test.js`; rerun passed. Computed a read-only deployment-input fingerprint and inspected only backup filenames/metadata and service health. No broad `npm test` was run because its `pretest` generates project content; no live-service restart, browser storage clearing, real-data operation, or production deployment occurred.
- 2026-10-20: Fixed only the missing runtime service entry in the deploy manifest. Temporary test data and generated reports were left intact; no user/course data was removed.
- 2026-10-20: Rechecked generated output against source and ran `git diff --check`; both passed. No generated files were rewritten.
- 2026-10-20: Classified untracked changes by top-level path and compared new-content directories with the deployment manifest. Confirmed the manifest’s broad `assets/` and `content/` inclusion and the exclusion of `c/`, `g/`, `s/`, `tmp/`, and `output/`; did not alter deployment scope or content.
- 2026-10-20: Ran content integrity and generated-content checks in read-only/temporary-output mode. Separately parsed all 10 currently untracked content JSON files; syntax passed, but schema/editorial review remains open.
- 2026-10-20: Ran the vocabulary content-builder and course-contract tests. They confirm the six existing pilot entries and their image revision identities are preserved; all 24 referenced image paths exist and are below 20,000 bytes. Did not migrate their legacy multi-path image references or alter the entries.
- 2026-10-20: Audited the full deploy-included `assets/` tree by extension and size. Found six large named landscape masters and one large source-like scene PNG (17,813,858 bytes combined); static-path normalization does not classify these `/assets/...` paths as sensitive. No HTTP request was made to the live service, and no asset was moved, deleted, or changed. Treat curated static-asset packaging as a release gate.
- 2026-10-20: Updated only the deployment archive arguments and its safety contract to keep the seven original/source PNGs and their source map out of the public package while preserving them locally. Verified the complete `assets/` tree through a streamed archive/listing pipeline: delivery WebPs and the runtime garden background remain, while the source/master files are absent; no archive file or remote deployment was created. Re-ran deployment safety (38/38), dependency coverage, and shell syntax checks successfully.
- 2026-10-20: Reconciled the stale 2026-10-20 course-completion handoff header against its unchecked broad acceptance criteria and the newer M1 closure evidence. Clarified the older document as implementation-complete with broader/user acceptance pending, kept its original unchecked criteria, and updated the M1 finding. Audited historical `complete` documents with unchecked items; retained explicitly scoped external gates and left two ambiguous older workstreams unchanged pending criterion-by-criterion evidence.
