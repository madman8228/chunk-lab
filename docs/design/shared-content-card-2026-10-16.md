# Shared content card

Owner-approved scope: unify content shelf cards in `main.html?view=my-learning` and `view=discover`. Home progress rows and the learning archive are intentionally unchanged.

## Ownership

- `js/content-card.js`: one DOM template for cover, kind label, linked title, title bar and action disclosure; one controller for exclusive opening, outside dismissal, Escape/focus return, arrow keys and viewport bounds. Presentation only, no account reads, persistence or learning operations.
- `assets/content-card.css`: one visual contract for both routes, light/dark tokens and responsive columns. Default covers reveal the page background; authored/custom covers retain paper cards; title bars retain their paper background. Desktop controls are compact, touch controls remain at least 44px.
- `js/learning-workspace-view.js`: adapts the existing normalized resource, preferences, memberships and resume to a native preview/management link and supplied menu controls. Existing callbacks still own save/join/open/leave and confirmation behavior. No course identity or stored cover is rewritten.

`ContentCard.create({resource,variant,href,linkLabel,kindLabel,items})` receives normalized display data and already-bound menu nodes. `variant` selects page-specific entry points and legacy selector aliases, not an alternate visual template. New shelf presentation belongs in this component/CSS; do not add another discovery-only or library-only card rule.

The old 91-line context-branching card renderer is replaced by a 34-line page adapter. Approximately 90 lines of obsolete/duplicate card CSS were removed. Legacy class names remain as compatibility hooks for existing selectors.

## Verification

2026-10-22 metadata refinement: both shelves display the explicit `facets.textbookVersion` in an upper-left badge. With one grade, volume and edition, the visible title is derived from those fields; the full name remains authoritative for accessible links, search and details. Missing metadata and ordinary courses retain original titles. See `docs/architecture/course-card-metadata-2026-10-22.md` for production and safe revision rules.

- `node scripts/content-card-consistency.test.cjs`: same resources in both contexts, 902/390px and light/dark; equal computed visual properties, default/custom covers, long titles, unavailable content, route links, supplied action callbacks, cross-context menu exclusivity, wordbook resume, real coarse-pointer 44px targets.
- `node scripts/default-cover-preview.test.cjs`
- `node scripts/workspace-menu.test.cjs`
- `node scripts/course-covers.test.cjs`
- `node scripts/default-cover-alpha.test.cjs`
- `node e2e/presentation-first-batch.test.js`
- `node e2e/home-first-paint.test.js`
- `node e2e/account-entry.test.js` (independent rerun passed; the parallel run exposed an existing asynchronous account-name assertion timing issue).

These are targeted checks, not a full-suite pass. The pre-existing `e2e/learning-workspace.test.js` cannot reach the page in its isolated configuration: it sets `CHUNKLAB_APP_ROOT` to an app fixture with only the manifest; `/main.html?view=discover` returns 404. No live service or original data directory was switched to work around this test setup.

Screenshots are synthetic fixtures in `output/playwright/content-card/`. They are not copies or replacements of the owner's account data.
