---
name: textbook-wordbook-course
description: Create, continue, review, and package textbook-based English vocabulary wordbook drafts from supplied pages or scans. Use for textbook vocabulary courses, their examples, illustrations, preview, and validation; do not use for AVG, reading-comprehension, or unrelated course formats.
---

# Textbook Wordbook Course

Follow the repository root `AGENTS.md` first. This skill governs the repeatable workflow; it does not grant permission to import, save, or publish a course.

## Start with the source and scope

1. Inspect repository guidance, current worktree changes, existing course drafts, and asset conventions. Preserve unrelated work and continue from the last approved checkpoint instead of rebuilding completed work.
2. Establish the exact textbook identity from user-provided evidence: publisher, title, edition/year, volume, unit, and the pages being transcribed. Keep names such as “全一册” exact. Ask only when the source identity or scope is genuinely ambiguous.
3. Use the requested vocabulary pages as the transcription source. An alphabetical vocabulary index is not a required secondary audit: consult it only when requested or when it resolves a specific mismatch. Distinguish printed textbook page numbers from scan/PDF/index page numbers.
4. Preserve multi-line entries as one item (especially people, places, festivals, and titles). Keep source glosses and page references traceable in a reference file.

## Build a reviewable text draft

1. Reconcile each requested item and total count against the source before writing examples. Do not silently add, omit, or merge entries.
2. Clearly separate transcribed headwords/glosses from newly authored English examples, Chinese translations, and scene descriptions. Do not copy textbook example sentences unless the user supplied them for exact transcription; label original examples as original.
3. Save the draft and human-readable review material in a new, clearly scoped output directory. Follow existing project schemas and scripts rather than inventing a parallel format. Typical artifacts are a draft JSON, source-reference manifest, review table, and README/status note.
4. Keep status explicit: `draft`, `reviewed`, `illustrations pending`, or equivalent. Mark reviewed only after the user's clear confirmation. Do not start image work before the text checkpoint is approved.

## Generate and package illustrations

Before generating new artwork, read [references/shared-images.md](references/shared-images.md) and run the shared-catalog preflight. Search across textbooks by sense, audience and style. Exact word-and-gloss matches across stages/styles may be shown as global-reuse candidates, but reuse is allowed only after a hash-bound reviewed image and explicit confirmation that the target scene suits every listed course. Never auto-merge cross-stage/style matches. Apply selections into a new draft file; preserve originals, prior references and review records. Unreviewed matches go to review rather than automatic regeneration.

1. Use the built-in image-generation tool by default. For ordinary scenes, prefer a four-panel 2×2 atlas followed by local cropping, as authorized by the owner. Use individual calls for difficult actions, targeted repairs, or a failed panel. Read [references/batch-images.md](references/batch-images.md) for panel mapping, naming, and the local packaging command. Do not claim a fixed speed or token saving before measuring actual results.
2. Make the target action/object immediately recognizable, age-appropriate, and faithful to the reviewed scene. Anchor this course's style to the approved Unit 1 campus original `ref/words-pic/split/masters/connect-with-v2.png`: natural proportions, detailed semi-realistic illustrated materials and restrained colors. Do not substitute a later generated image as the style reference. Scenes may change with the vocabulary; the visual treatment stays consistent. Avoid text, lettering, logos, and watermarks unless a particular lesson explicitly requires them.
3. Design one complete 16:9 landscape illustration shared by desktop and mobile. The owner's 2026-10-15 production policy is one WebP delivery file per word; do not create AVIF alternatives or dedicated mobile crops by default. Mobile layouts stack image and text and scale the complete image without cropping or stretching. Inspect generated masters before accepting them; correct confusing actions, anatomy, or salient artifacts with a targeted iteration.
4. Copy original generated artwork into the established master-art directory without deleting the generated source. Create browser delivery encodings separately. Never use a large master as an automatic browser fallback.
5. Use additive, versioned filenames following repository conventions (for example `vocab-u<unit>-<slug>-wide-v1.webp`). Keep the existing schema: `images.wide` and `images.mobile` both contain the same single WebP path. Never overwrite existing assets; update draft references only after each referenced file exists. Preserve legacy multi-file courses and reports; the new production policy does not authorize their migration or deletion.
6. Before accepting a batch, check each actual delivery file's byte size: strictly below 20,000 bytes. If one fails, adjust encoding/quality or simplify the illustration, preserve the original outside browser delivery, and re-check every output. Report unique delivery paths, not the sum of both profile arrays; four words normally produce four delivery files.

## Organize textbook source assets

- For a textbook-wide archive, follow [references/asset-packages.md](references/asset-packages.md). Keep source scans, course snapshots, illustrations, phonetics, audio and review evidence in a private, immutable, versioned package per exact textbook identity.
- Confirm the inventory adapter supports the requested textbook before packaging. Preserve approval distinctions, hash-bind assets to item IDs, and verify the package independently. Large original PNGs may live in a local-only companion archive if the course package remains independently verifiable and the companion has its own hash manifest. Packaging does not publish, migrate course data, or upload to OSS.

## Preview, validate, and hand off

1. Build or open a preview in the real learning layout when available. Check the shared full image on desktop and narrow screens, visual-to-word alignment, teaching action, and on-demand image loading. A contact sheet is useful for review but does not replace individual-file checks.
2. Run the existing draft/schema validation and verify every referenced path resolves. Report item totals, completed and remaining illustrations, actual delivery-file counts/size results, and anything still pending.
3. Stop at a reviewable draft/preview. Never import into a real account, save against a real user, update learning records, or publish unless the user explicitly authorizes that specific action. State whether the live application or account was changed (normally: no).

## Continuing an in-progress course

- Resume from the current draft and its review/status files. Do not repeat completed extraction or image-generation work.
- Generate illustrations in manageable, user-visible batches; record the completed item list and remaining count after each batch.
- If the user reports a defect, repair only the identified asset/content, preserve the old version, and update only the affected draft reference.
- If the user says “continue,” proceed with the next uncompleted stage already authorized; do not interpret that as permission to publish or alter account data.
