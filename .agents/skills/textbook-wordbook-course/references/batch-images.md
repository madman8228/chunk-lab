# Four-panel vocabulary images

Use a 2×2 atlas for four ordinary scenes. Request a landscape 16:9 total image so each equal panel is also 16:9. Keep scenes separate, without shared objects across seams, labels, or decorative margins. A narrow seam is acceptable; inspect the actual image before selecting crop rectangles. Keep each teaching action fully inside its panel. Desktop and mobile share the complete 16:9 illustration.

Before generating, build the complete shared illustration catalog and save a JSON batch manifest with `batchId`, `unit`, `version`, `styleReference`, `draft`, and four `cells`. Each cell binds `position` (`top-left`, `top-right`, `bottom-left`, `bottom-right`), exact `word`, exact `meaning`, exact `itemId`, and unique ASCII lowercase hyphenated `slug`. Never infer identity from a returned filename or file ordering. Run the metadata-only `package-vocabulary-atlas.cjs --preflight` against that exact manifest/catalog before requesting artwork. The preflight records input hashes and a plan; if any cell has a reusable candidate or needs review, it blocks the batch. Resolve those cases first and do not generate duplicates. Visually confirm the panel-to-word mapping before packaging. If the generator changes the layout, correct the mapping or provide an explicit pixel `rect: [x,y,width,height]` per cell.

For a final partial batch, use one to three mapped cells in the same 2×2 layout and ask for unused panels to remain blank. The script accepts one to four cells; only mapped panels receive named output files or draft references.

Naming:

- Atlas original: `ref/words-pic/atlases/<batchId>.png`
- Cropped original: `ref/words-pic/split/masters/<slug>-v<version>.png`
- Delivery: one `assets/vocab-u<unit>-<slug>-wide-v<version>.webp` per word; no new AVIF or mobile-specific file.
- Names use the vocabulary slug, never `image1`, `crop2`, or a translated meaning. Phrases use hyphens, e.g. `count down` → `count-down`. Resolve collisions before generation by selecting a distinct slug/version.

Run from the repository root:

```powershell
node scripts/package-vocabulary-atlas.cjs --manifest <manifest.json> --catalog <catalog.json> --plan <manifest.plan.json> --source <generated.png>
```

The script preserves the source and atlas, crops named masters, and generates one 512×288 WebP per mapped word, enforcing strictly fewer than 20,000 bytes per delivery file. It fits the complete cropped panel into the 16:9 delivery frame without cutting its sides. Reports record `deliveryPolicy: "single-wide-webp-v1"`, coordinates, hashes, filenames, and sizes. It refuses existing output names. Default quadrant crops trim four pixels at panel edges to remove seams; explicit rectangles override this. Inspect the cropped files before accepting them.

After visual review, apply only this batch's draft references with:

```powershell
node scripts/package-vocabulary-atlas.cjs --manifest <manifest.json> --catalog <catalog.json> --plan <manifest.plan.json> --apply-draft
```

Application rechecks the report, source/cropped hashes, identity bindings, dimensions and delivery file sizes. For new-policy reports it also requires the same current `--catalog` and `--plan` used during packaging. It requires empty references for these new items and writes the same WebP path into both `images.wide` and `images.mobile`. Count unique delivery paths: a four-word batch produces four delivery files, plus its separately retained originals. Existing learning-page responsive scaling and `object-fit:contain` support these shared references. Future previews should use the same file on narrow and wide layouts.

Old reports without `deliveryPolicy` remain readable as the legacy four-file workflow. Do not rewrite their mapping, reuse their occupied filenames, delete their assets, or migrate real courses as part of new production. Application modifies the reviewable draft only. Repair one failed panel separately, preserving successful panels and originals. Record generation/packaging time and approved panel count; count these as a speed experiment until the observed results justify broader use.
