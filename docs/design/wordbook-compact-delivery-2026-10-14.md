# Wordbook compact study delivery — 2026-10-14

## Overview

Surface: `wordbook.html`. Mode: **Operate**. This is a bounded extension of the established homepage sky/garden world: the learner sees the teaching scene, reads the meaning, completes the sentence and confirms within a compact exercise surface. It does not establish a replacement global brand or a new learning system.

This document follows the impeccable-documenter extraction approach, scoped by the owner's explicit instruction to write only this delivery record. Context checked: `PRODUCT.md`, `DESIGN.md`, `docs/design/system-context-2026-10-13.md`, and `C:/Users/Administrator/.codex/skills/impeccable/reference/document.md`. Root `DESIGN.md`, `.impeccable/design.json` and implementation files are outside this documentation write.

The implementation being documented is in `wordbook.html`, `assets/wordbook-study.css` and `landing/wordbook-study.js`, with shared scenery in `assets/learning-sky.css` and `js/learning-sky.js`. These files were already present in the working tree; this documentation pass does not claim authorship of their existing changes. Many unrelated changes are present and must remain intact.

## Colors

Use the shared sky gradient, sun, clouds and garden rather than a second page background. `assets/learning-sky.css` owns the shared `--v4-*` tokens: cream study paper (`--v4-card`, #fffdf5), the sky-to-paper gradient (`--v4-sky1` through `--v4-sky4`) and sun yellow (`--v4-sun`). Existing workspace ink and muted text tokens continue to support navigation and status.

The local answer action uses warm yellow (#ffe08a), with a honey border (#ccad62). Buttons and the exercise outline use the quiet paper border (#d8c7a9). Blue (#3768b4) identifies keyboard focus; the answer-error underline uses red (#ad3827), alongside the existing validation feedback and `aria-invalid` state.

## Typography

Retain the inherited font stack; this surface adds no font download or global font replacement. The compact page title is 22px, the word/meaning title 26px and the cloze sentence 22px. At widths up to 600px these become 20px, 23px and 20px. Position is 14px with tabular numerals; status is 12px with a 1.5 line height and wrapping.

The existing `DESIGN.md` describes legacy landing typography, including a bold, cream-filled, outlined vocabulary-section headline. That description differs from this current compact study surface and the homepage sky/workspace implementation. Record this as scoped documentation drift, not authorization to rewrite the global design contract. Teaching text remains selectable HTML.

## Layout

The page shell is transparent with no border, rounding or shadow. Compact navigation, title/position and live status sit directly above one exercise surface. Listening, pause, skip and return controls sit beneath it without another enclosing card.

| Viewport | Exercise arrangement | Illustration | Local spacing |
| --- | --- | --- | --- |
| Above 600px | Image left, answer right; grid proportions 0.9fr / 1.1fr | Maximum height 290px; contain, preserve proportions | 24px column gap; 18px exercise padding |
| Up to 600px | Image above answer; one column | Maximum height 190px; contain, preserve proportions | 16px gap; 14px exercise padding |

The shell is capped at 1040px with a width of viewport minus 36px; mobile uses viewport minus 24px. Bottom padding is 110px. Input and sentence wrapping allow narrow-screen use. The current image source profile switches at 700px; that delivery breakpoint is separate from the 600px layout breakpoint.

First-screen confirmation is the acceptance target. The compact fixture asserts that the confirmation button's bottom is below 700px from the top at all four tested widths, with a viewport height of 932px. This is evidence for the tested initial exercise, not a guarantee for every future sentence, zoom level or shorter viewport.

## Elevation & Depth

Depth comes from the shared sky and edge garden. The outer shell and practice wrapper have no shadow or panel fill; the single cream exercise panel has a thin outline. Decorative nodes remain behind content and do not intercept pointer interaction.

The shared scenery injector filters parsed children to **only** `.home-sky-deco` and `.home-garden` before insertion. Its source markup still contains a canvas, but that canvas is not inserted; this avoids a normal-flow canvas reserving blank space above the study UI. This is node selection, not a color filter on teaching imagery. `body.learning-page::before { content:none }` removes the old pseudo-element background so the shared scenery remains authoritative.

## Shapes

The exercise surface uses a 16px radius; the teaching image uses 10px. Controls use a quiet 9px radius. Each button has a minimum height and width of 44px; navigation links retain a minimum 44px height. The compact appearance must not reduce interaction targets.

## Components

- Navigation: retain the existing homepage, personal-learning and discovery routes. Preserve current labels and destinations; no new parallel content-management path.
- Status: `role="status"` and polite live announcements report loading, experience mode, pending saves, confirmed saves and errors through the existing controller.
- Exercise: one scene/meaning/cloze surface, using the existing `JQKAClozeView` and authored teaching material. The confirmation label is “确认”.
- Answer blanks: a single bottom underline, with no box, shadow or additional focus outline. Focus changes that underline to a 2px blue line. Buttons and links use a visible 2px focus outline with a 3px offset. Preserve the existing Enter-based answer flow and native Tab navigation.
- Session controls: retain listening, pause/resume, skip, return and next-word behavior. Pause hides the exercise without rebuilding it, retaining unfinished input; resume returns focus to the form. Completion retains sentence feedback and sentence listening. Skip does not create successful practice or mastery.
- Images: from the owner's 2026-10-15 update, new production uses one shared 16:9 WebP per word, strictly below 20,000 bytes; `images.wide` and `images.mobile` reference the same path. Preserve the complete image on narrow screens using proportional scaling and `object-fit:contain`, with image and text stacked. Existing mobile/wide AVIF/WebP courses remain supported. Use scene alt text and lazy loading; retain originals separately, with no large-original fallback or vocabulary-library precache. Reuse browser caching when revisiting content.

The compact redesign is presentation work. Existing `VocabularyStudyStore.submit` calls for `vocabulary.complete` and `vocabulary.session`, identity checks, conflict handling and the existing durable save path remain the intended contract; no storage-write behavior change is part of this delivery. Source inspection confirms continued use of those contracts, but the blocked full E2E run does not independently validate every persistence branch. Assisted completion must still be described as assisted practice, not verified mastery.

## Do's and Don'ts

- Do preserve the authored actions, objects, meaning, example sentence and functional learning controls.
- Do keep the unified browser-facing illustration budget strictly below 20,000 bytes for each actual file, including fallback and alternative formats. This supersedes historical 10 KB mobile wording.
- Do keep all real courses, learning records, original browser data, artwork, archives and backups intact. A missing display is not permission to clear storage.
- Don't expand this delivery into a global brand, typography, discovery or persistence redesign.
- Don't restart or switch the live service to verify this UI. Persistence tests must allocate a new temporary data directory and isolated port; never use `server/data` or real account/course archives.

## Evidence checked and verification limits

The owner's supplied delivery result reports these two scripts passing. In this documentation pass their source and existing screenshot artifacts were checked; the scripts were **not rerun**, because they write screenshot outputs and this request permits only the specified Markdown write.

| Evidence | Coverage and limits |
| --- | --- |
| `scripts/wordbook-compact-ui.test.cjs` — reported passing | Widths 1440, 918, 390 and 360; no horizontal overflow; first-screen confirmation; image height limits; requested illustration file sizes below 20,000 bytes; pause/resume preserving input; invalid answer state; correct submission via Enter; next position 2 / 6; no page errors. Uses a routed six-item fixture and stubbed guest bootstrap, not real account persistence. |
| `scripts/vocabulary-background.test.cjs` — reported passing | Shared vocabulary-practice background and sun match the homepage at 1853, 918 and 390px; one garden; practice entry remains visible. This is adjacent-page scenery regression evidence, not full wordbook acceptance. |
| `e2e/wordbook-study.test.js` — reported blocked | The prior run stopped waiting for the discovery heading “六词练习”, before entering `wordbook.html`. It cannot be reported as a passing wordbook flow or as evidence of successful save, replay, cross-device resume, offline retry, skip persistence or account isolation after that point. The script source allocates temporary data and an isolated port. No discovery fix or alternate direct-entry run was performed in this documentation task. |

All four existing compact captures were opened and visually checked. They show a single exercise surface, desktop columns at 1440/918, stacked content at 390/360, visible confirmation and compact controls:

- [1440px screenshot](../../output/playwright/wordbook-compact/wordbook-1440.png)
- [918px screenshot](../../output/playwright/wordbook-compact/wordbook-918.png)
- [390px screenshot](../../output/playwright/wordbook-compact/wordbook-390.png)
- [360px screenshot](../../output/playwright/wordbook-compact/wordbook-360.png)

The captures were present with a local modification time of 2026-10-14 10:14. The documentation pass also independently enumerated the six-word pilot's referenced mobile/wide AVIF and WebP files and checked actual file sizes read-only: **24 files, all below 20,000 bytes; maximum 19,998 bytes**. This includes alternatives and WebP fallbacks and does not assert that every unrelated asset in the repository was audited. Screenshot PNG sizes are not vocabulary-delivery asset sizes and are outside that budget.

This pass wrote only `docs/design/wordbook-compact-delivery-2026-10-14.md`. It did not modify UI, storage, courses, records, originals or unrelated worktree changes, and did not deploy, restart or switch the live service. Live deployment status was not verified.
