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

Only `AGENTS.md`, the independent read-only `scripts/audit-course-assets.cjs`, and this report belong to this checkpoint. It is not a saved snapshot of all persistence implementation changes, nor a deployable completion of that work.

The audit command returns nonzero on exact identity differences, even when total counts match. Compare against `4dce31a` explicitly to preserve the original baseline after later commits. It reads Git and static content files only, never the live database or browser storage.

## Pending commit groups

1. Review remaining persistence code and its new dependencies together; stage only coherent implementation groups with their tests. The working tree contains unrelated work, so blanket staging is prohibited.
2. Review content edits and generated filenames independently; preserve original assets and do not authorize deletes implicitly through code cleanup.
3. Review other UI, authoring and build edits separately.
4. Run staged-tree/full acceptance checks before claiming a complete release checkpoint. Existing working-tree tests do not prove every partial commit can run independently.
5. Database files, environment credentials and user backups must not enter source commits. Git is not a consistent live SQLite backup.

No live course, database or backup was deleted, restored, regenerated or overwritten during this audit. Port 8787 was not restarted.
