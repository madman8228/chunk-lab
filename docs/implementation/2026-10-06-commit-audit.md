# Local checkpoint audit

Baseline: `4dce31a` (HEAD before this audit checkpoint).

## Course content

- Both manifests contain 66 decks and 3,677 content items.
- All 136 files referenced by the current manifest exist and match their declared SHA-256.
- The 136 unstaged deleted content files are old manifest shard/index filenames; none is still referenced by the current manifest. This explains their structural role, not the provenance or approval of the content changes.
- Six items retain their CID but differ in text:
  - `f19ef7b9`: `It's time to get up.` → `It's time to get up!`
  - `70c23bb5`: `Do the dishes.` → `Do the dishes!`
  - `d13966c5`: `So far so good.` → `So far, so good.`
  - `8a621293`: `I'm shocked.` → `I'm shocked!`
  - `2ec8b5a3`: `It's at of this street.` → `It's at the end of this street.`
  - `a3c4ec4a`: `all long` → `all along`
- Many additional items have non-identity field changes. Equal counts alone do not prove identical content. Keep content changes out of the infrastructure checkpoint until reviewed separately.

## This checkpoint

The asset-protection checkpoint contains `AGENTS.md`, the independent read-only `scripts/audit-course-assets.cjs`, and this report. Persistence work was subsequently recorded in local commits through `a521c28` (course package writes). The current branch is ahead of `origin/master`; these commits have not been pushed or deployed.

The persistence commits cover protocol fencing/schema, canonical hashing, replayable evidence, operation services, server route wiring/recovery, durable browser queue/cache, learning page integration, and course-package persistence. They do not yet represent a clean-checkout release candidate: changes to test/build manifests and some legacy sync tests remain in the worktree, and the latest commits have not been revalidated as a clean staged snapshot. No full-suite pass is claimed.

The audit command returns nonzero on exact identity differences, even when total counts match. Compare against `4dce31a` explicitly to preserve the original baseline after later commits. It reads Git and static content files only, never the live database or browser storage.

## Remaining work

1. Reconcile old sync/outbox/conflict tests with the retired endpoints and verify new tests are discovered by the committed test manifest.
2. Review build, service-worker and release-checklist changes so generated assets match the committed source tree.
3. Independently review content edits and generated filenames. Preserve original assets; do not authorize deletes implicitly through code cleanup. Six same-CID text edits and broad field changes still need owner/content review.
4. Run clean-snapshot and full acceptance checks before calling this a release candidate. Existing worktree test results do not prove all partial commits form a passing clean checkout.
5. Database files, environment credentials and user backups must not enter source commits. Git is not a consistent live SQLite backup.

No live course, database or backup was deleted, restored, regenerated or overwritten during this audit. Port 8787 was not restarted.
