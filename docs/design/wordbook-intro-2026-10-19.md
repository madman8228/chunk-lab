# Wordbook introduction delivery record — 2026-10-19

## Overview

This is a surface-specific Impeccable documentation record for `wordbook-intro.html`, not a new global design system. The approved preview and pinned learning-garden/paper direction remain the visual authority. The surface is in Operate mode: understand the current word, phrase or sentence, hear its demonstration, and continue while distinguishing local durable browsing records from server confirmation. Browsing is not mastery.

Documentation scope is this new file only. The explicit task scope overrides the document playbook's usual root `DESIGN.md` and sidecar outputs; neither is updated. Implementation evidence was read from `.impeccable/surfaces/wordbook-intro.md`, `wordbook-intro.html`, `assets/wordbook-intro.css`, `landing/wordbook-intro.js`, `js/vocabulary-browse-store.js`, and `landing/wordbook-details.js`. Review history below is supplied by the parent workflow; this documentation pass does not claim to have repeated it.

## Colors

Warm paper, brown ink and honey-colored actions inherit the approved garden/preview family. The local primary action uses honey (`#ffe08a`) with a warm border (`#ccad62`); secondary browsing actions use the existing card token and a quiet border (`#d8c7a9`). Selection uses honey with brown text (`#523019`). The directory summary retains a visible blue focus outline (`#3768b4`). These are observed surface values, not newly established global tokens.

## Typography

Typography inherits the existing learning styles. English target text remains selectable live text, marked `lang="en"`, at 26px with 1.5 line height and wrapping for narrow screens. Teaching explanations use 1.6 line height and a maximum measure of 65ch; the browsing disclaimer uses 14px with 1.5 line height. Explicit step changes focus the step heading. Live save feedback and errors occupy separate status and alert regions.

## Layout

The approved preview composition is retained: compact navigation, title and step count; save status and the browsing disclaimer; warm-paper teaching content with the complete 16:9 image beside text on wider screens and above it on narrow screens. The same complete image is displayed responsively, without a dedicated mobile crop. Image, English, Chinese meaning, explanation and listening action describe the current teaching step. The characteristic progression is word → phrase → sentence while retaining the associated teaching scene.

The course directory is collapsed by default and fetched only when opened. It requests 20 steps per page and provides previous/next directory-page controls. Reading directory pages does not preload the whole course's media. The current step has one primary forward action, “继续” or “结束本节”, alongside “上一步” and “暂停”. At the end, “再看一遍” starts browsing again. Ending browsing does not prove every step was viewed.

## Elevation & Depth

Paper, garden context and existing study-container depth are inherited from the approved preview and shared styles. This delivery introduces no replacement visual world or decorative animation. The local stylesheet concentrates on hierarchy, controls, disclosure and focus rather than adding a new elevation system.

## Shapes

Existing paper containers and button shapes remain inherited. Directory and optional-exercise disclosures use native `details`/`summary`; directory summaries have a minimum 44px height. No new raster assets were generated. Existing original artwork and assets remain unchanged.

## Components and behavior

### Real details entry and teaching steps

The real wordbook details page conditionally exposes “认识词与表达” when `features.vocabularyBrowse` is enabled and a matching teaching option exists. Its link binds the book, immutable plan revision and optional unit. This is an optional entry; it does not replace the existing practice entry or invent a plan for books without one. The introduction validates the plan parameter and reads real teaching-step data. The reported nine-step acceptance case is a synthetic fixture, not a claim that all private courses have available teaching plans.

### Current media only

The current item's `images.wide[0]` supplies one lazy, asynchronously decoded image. A failed image yields a readable message rather than loading a large original. Listening is explicitly requested with “听示范”; the acceptance report records no audio preload. No course-wide image download or precache is introduced. Future browser-facing vocabulary deliveries remain subject to the strict per-file limit below 20,000 bytes and the approved shared 16:9 WebP policy; this documentation pass does not claim to have recompressed or audited all legacy assets.

### Optional exercise, without assessment

Sentence steps may expose a collapsed “试一试（可选）” section when authored word-choice or chunk-order material exists. Completion feedback explicitly calls it assisted practice and says it does not represent mastery. This path does not write correct-answer, assessment or mastery evidence. Browsing operations use `vocabulary.browse`, separately from assessment.

### Durable local position versus confirmed position

The browse store reuses the existing IndexedDB/server queue and server-confirmed cache. Pending actions carry either an expected confirmed resume revision or a predecessor request ID, preserving the offline action chain. Cached teaching data is scoped by service, account, book, plan and optional unit; step and directory caches are bounded. Offline use depends on already cached content, not an unconditional offline-course guarantee.

The status text distinguishes a local durable pending position from a cloud-confirmed position. Experience mode explicitly says that browsing records are not saved. Server-state and reconnect notifications reconcile save status without rebuilding the active exercise form or cancelling pause. Account/service identity guards retain prior pending records and require reopening in the appropriate context.

Conflicts retain pending records and block progress; this is retention plus blocking, not a completed conflict-recovery workflow. Reconnection or a reread must not be described as guaranteed recovery from every conflict. No clearing, snapshot replacement or destructive repair is authorized.

### Pause and error handling

Pause hides the active area and directory, stops media/form activity, and retains the mounted form and its selection for resume. Reconnection does not discard that form. Changing steps or explicitly reloading has a different lifecycle and must not be presented as durable persistence of unfinished form input across reloads.

Read failures have a separate alert with an explicit retry action. Ordinary save-status updates must not erase that error. Successful boot now clears the stale error only after the course/end state has loaded successfully. This is the specific review finding resolved below.

## Verification and review evidence

The actual E2E report is [summary.json](../../output/test-results/vocabulary-browse-ui-1792412157223/summary.json). Its recorded assertions are true for actual details entry, nine steps, durable offline chain, reconnect preserving the form, pause preserving selection, refresh, second-context resume, error surviving save-status updates, retry, end/restart, current-image-only requests, no audio preload, no assessment writes, unchanged source, and synthetic-review-only execution. `productionPublished` is false. Tested widths are 1440, 925, 390 and 320 pixels.

The offline result covers the predecessor-linked pending chain and subsequent reconnect. Refresh and second-context resume are separate recorded checks; they do not establish a full offline reload. The error scenario used HTTP 503: the error survived unrelated save-status updates, and successful retry cleared it.

The parent viewed the following four phrase-step screenshots in two own inspection rounds:

- [1440px](../../.impeccable/review/wordbook-intro/phrase-1440.png)
- [925px](../../.impeccable/review/wordbook-intro/phrase-925.png)
- [390px](../../.impeccable/review/wordbook-intro/phrase-390.png)
- [320px](../../.impeccable/review/wordbook-intro/phrase-320.png)

The detector ran once. Its reported deviations concerned inherited cream treatment, the navigation stripe and token deviations. These were recorded against the pinned inherited world; they are not evidence of a new palette approval or a clean site-wide detector result.

The first reviewer was usage-limited and performed no review; that attempt failed and was replaced. Fresh reviewer Kant initially identified only the stale error remaining after successful boot. The subsequent scored verdict marked that one finding resolved. This is a bounded verdict about that finding, not comprehensive approval of every course, accessibility mode or production deployment. No numeric score is asserted here.

The final full-server test run was still ongoing at this documentation checkpoint. No result, pass count or successful completion is claimed for that run.

## Guardrails and remaining bounds

- Preserve the approved preview/garden inheritance, complete-image presentation, collapsed paged directory and single forward action. Keep exercise optional and browsing distinct from assessment or mastery.
- Keep durable local pending state distinct from server confirmation. Preserve active form and pause during status reconciliation; retain and block conflicted records rather than claiming recovery.
- The read-only preview on port 4267 remains untouched. Validation uses synthetic accounts, newly allocated temporary data directories and isolated ports; this record does not authorize a live-service restart or switch.
- Private teaching plans were unavailable for validation. Synthetic fixtures establish the tested integration, not private-course coverage or human judgment of teaching quality.
- Full offline reload, assistive-technology use, Safari, real microphone use and human teaching-quality review were not tested. Semantic controls and screenshot checks do not establish those results.
- No production authorization, course publication, import into a real account, learning-record migration or live-service update is conveyed by this document. Real course content, browser data, archives, backups and unrelated worktree changes remain protected.
- No new rasters were produced; existing originals were unchanged. Review screenshots are evidence captures, not replacement teaching artwork.
