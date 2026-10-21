# Shared illustrations and OSS delivery

Keep course/word/item identities independent of image identity. `images.wide` and `images.mobile` retain the same local `assets/<name>.webp` reference; different courses can share that key. Delivery uses the content hash, not the course/item ID, as its cache identity. Do not migrate existing course references or delete duplicates during authoring.

## Before generation

1. In the review page, save an audit snapshot using **保存审核快照到项目**. It writes an additive file under `output/vocabulary-illustrations/reviews/` and does not replace browser marks. Downloads now include the same unit identities and image hashes. Old downloads without hashes are not evidence of approval for an image that may have changed.
2. Build a new catalog from the 20 current textbooks in the progress tables. Extra or new course directories can be selected explicitly with repeated `--course`; when provided this replaces the default set, so include all intended courses.

```powershell
node scripts/vocabulary-illustrations.cjs build --reviews <saved-review.json> --out <new-catalog.json>
node scripts/package-vocabulary-atlas.cjs --manifest <batch.json> --preflight --catalog <new-catalog.json> --stage primary --out <new-plan.json>
```

Use `--stage junior` for middle school. Preserve the approved style reference in the manifest. Preflight is metadata-only; no images are generated or changed. `select-approved-image` means a source review passed and word/gloss/stage/style match; it does not certify the target scene. `review-existing-candidates` requires visual/semantic review (including alternate glosses, age and style). `generate` means no matching headword was found. Generate only genuinely missing or explicitly rejected unsuitable scenes; preserve the panel/word/slug mapping for those new scenes.

The catalog groups identical bytes by SHA-256, while maintaining each source course/unit/item binding. Same spelling does not merge different senses. Exact meaning matching is intentionally conservative. No semantic equivalence is inferred automatically from similar Chinese glosses.

## Apply reviewed reuse

Write a selections JSON array containing `itemId`, `assetId`, `sourceKey`, and `sceneReviewed: true` after checking each selected picture against the target lesson. The plan supplies IDs. Do not invent scene approval merely to make the command pass.

```powershell
node scripts/vocabulary-illustrations.cjs apply --catalog <catalog.json> --manifest <batch.json> --stage primary --draft <original-draft.json> --selections <selections.json> --out <new-draft.json>
```

Only selected items with empty image references are populated; hashes and source approval are rechecked. Both profiles reference one file. The output must be a new file. Existing courses and old assets are untouched. No general-purpose image tool is needed for reuse.

## Delivery and OSS

See `docs/architecture/shared-vocabulary-illustrations-2026-10-19.md` for server configuration and deployment. Catalog and review files are authoring artifacts, not a replacement course library. Uploading assets is not approval to publish or alter learning records.
