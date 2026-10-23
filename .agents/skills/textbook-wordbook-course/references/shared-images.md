# Shared illustrations and OSS delivery

Keep course/word/item identities independent of image identity. `images.wide` and `images.mobile` retain the same local `assets/<name>.webp` reference; different courses can share that key. Delivery uses the content hash, not the course/item ID, as its cache identity. Do not migrate existing course references or delete duplicates during authoring.

## Before generation

1. In the review page, save an audit snapshot using **保存审核快照到项目**. It writes an additive file under `output/vocabulary-illustrations/reviews/` and does not replace browser marks. Downloads now include the same unit identities and image hashes. Old downloads without hashes are not evidence of approval for an image that may have changed.
2. Build a new catalog from every in-scope textbook draft. Extra or new course directories can be selected explicitly with repeated `--course`; when provided this replaces the default set, so include all intended courses.

```powershell
node scripts/vocabulary-illustrations.cjs build --reviews <saved-review.json> --out <new-catalog.json>
node scripts/vocabulary-illustrations.cjs plan --catalog <new-catalog.json> --manifest <batch.json> --stage primary --out <inspection-plan.json>
```

Use `--stage junior` for middle school. Preserve the approved style reference in the manifest. The CLI plan is for inspection; before requesting any new artwork, create the packaging-bound preflight plan with the exact batch manifest and catalog:

```powershell
node scripts/package-vocabulary-atlas.cjs --manifest <batch.json> --catalog <new-catalog.json> --stage primary --preflight --out <batch.plan.json>
```

This step is metadata-only. The later packaging command must provide the same `--catalog` and `--plan`; it verifies both input hashes and recomputes every action. It refuses to package if even one cell is `select-approved-image` or `review-existing-candidates`. Resolve reuse/review first; do not bypass the gate. The current workflow does not yet provide a hash-bound “candidate unsuitable for this target; allow generation” decision, so such a candidate remains blocked until that decision path is implemented. `select-approved-image` means a source review passed and word/gloss/stage/style match; it does not certify the target scene. `review-existing-candidates` requires visual/semantic review (including alternate glosses, age and style). The cross-course reuse review may also group exact word-and-gloss matches across stages/styles; these are manual candidates only, and require explicit confirmation that the selected image suits every listed target course. `generate` means no matching headword was found. Generate only items whose current preflight action is `generate`; preserve the panel/word/slug mapping for those new scenes.

To include a separately verified textbook asset package in a new shared catalog, first ensure every package image hash already resolves to a `D:/06-project/chunk-practice/assets/` WebP, then merge without rewriting course references:

```powershell
node scripts/vocabulary-illustrations.cjs merge-package --catalog <existing-catalog.json> --package <verified-package-directory> --stage junior --style ref/words-pic/split/masters/connect-with-v2.png --out <new-catalog.json>
```

The merge requires package checksums and a checksum-listed `textbook-review-approval` whose image repairs are approved. The output is additive and versioned. Reuse still requires an explicit target-scene check before `apply`; no course image references are changed by catalog merging.

The catalog groups identical bytes by SHA-256, while maintaining each source course/unit/item binding. Same spelling does not merge different senses. Exact meaning matching is intentionally conservative. No semantic equivalence is inferred automatically from similar Chinese glosses.

## Apply reviewed reuse

Write a selections JSON array containing `itemId`, `assetId`, `sourceKey`, and `sceneReviewed: true` after checking each selected picture against the target lesson. The plan supplies IDs. Do not invent scene approval merely to make the command pass.

```powershell
node scripts/vocabulary-illustrations.cjs apply --catalog <catalog.json> --manifest <batch.json> --stage primary --draft <original-draft.json> --selections <selections.json> --out <new-draft.json>
```

Only selected items with empty image references are populated; hashes and source approval are rechecked. Both profiles reference one file. The output must be a new file. Existing courses and old assets are untouched. No general-purpose image tool is needed for reuse.

## Delivery and OSS

See `docs/architecture/shared-vocabulary-illustrations-2026-10-19.md` for server configuration and deployment. Catalog and review files are authoring artifacts, not a replacement course library. Uploading assets is not approval to publish or alter learning records.
