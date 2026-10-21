# Frontend presentation: phase 1

Scope: `main.html?view=home`, `view=my-learning`, `view=discover`, and `stats.html`.
This extends the existing garden/workspace visual language; no redesign, data migration, new persistence layer, or account mutation is part of this change.

## Shared contract

- First visit to each route shows a non-animated, accessible loading placeholder until its required reads settle. Do not render a provisional empty collection or zero statistics as confirmed facts.
- Loading is per route and account, not merely per document. Rapid navigation must not publish a late response into a different route. Changing account invalidates presentation readiness.
- Previously readable content stays visible during background refresh. Failed reads preserve that content and expose recovery; they never authorize clearing browser storage or server data.
- Input composition and open filter dialogs defer same-route background replacement. Preserve search draft, caret, keyboard focus, and mobile expanded sentence details. Explicit route/filter navigation still takes precedence.
- Failed cover images retain their allocated layout box. No additional image-library downloads or vocabulary assets are introduced.

## Implemented coordination

`LearningWorkspaceRuntime` tracks readiness for each workspace route, shares in-flight reads, and retries the newly selected route if navigation overtakes an earlier request. `LearningWorkspaceView` retains its existing focus/menu support and defers updates during IME composition or an open mobile filter drawer.

The archive waits for the initial sentence and vocabulary reads together, with its existing bounded local-fallback path retained. Vocabulary background refresh and pagination failures retain confirmed records. Old-account vocabulary records are not reused. Sentence detail expansion and search selections survive redraws.

## Verification (isolated data only)

- `node scripts/workspace-first-paint.test.cjs`
- `node scripts/workspace-route-readiness.test.cjs`
- `node scripts/workspace-background-retry.test.cjs`
- `node scripts/archive-refresh-stability.test.cjs`
- `node scripts/stats-auto-confirmation.test.cjs`
- `node scripts/stats-confirmed-cross-tab.test.cjs`
- `node e2e/home-first-paint.test.js`
- `node e2e/account-entry.test.js`
- `node e2e/presentation-first-batch.test.js`

Browser fixtures use newly allocated temporary data directories and isolated ports. The phase-1 browser test covers 1041px/390px, delayed directory/archive reads, navigation overtaking an outstanding read, IME/caret preservation, and a real mobile filter dialog including keyboard focus restoration. Archive unit/UI verification includes failed refresh and account isolation. These are targeted checks, not a claim that the entire repository test suite passes.

Screenshots: `output/playwright/presentation-first-batch/` (synthetic account, not the owner's records).

## Remaining phases

Course lists/details and wordbooks remain phase 2. Practice, story courses, authoring and admin remain phase 3. Apply the same presentation contract at existing data/readiness seams; do not introduce a global fixed delay or hide all pages with CSS. Input and learning-state safety take priority over reducing render counts.
