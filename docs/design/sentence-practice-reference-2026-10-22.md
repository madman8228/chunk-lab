# Sentence practice reference layout

Owner reference: compact white navigation/progress row; shortcuts and mode settings below; white task card with a light-gold outline, large centered Chinese prompt, quieter inset chunk area, compact familiarity/explanation actions and footer audio. Preserve the existing sky/garden background and real learning state.

## Scope

- `assets/practice-reference-layout.css` is scoped to active sentence practice. Other workspaces and wordbook pages keep their own presentation.
- `js/practice-layout.js` relocates the existing practice-context node into the existing top bar only while a loaded practice task is visible. It restores the same node on exit or an access error. IDs, event handlers and state remain intact. It has no account, content or persistence dependency.
- `main.html` groups existing settings/shortcuts into a toolbar and places sentence replay in the task footer. The owner's subsequent request explicitly enables full-sentence listening before completion and resetting an unfinished selection; see the footer behavior below.
- Prompt text now participates in normal layout, so long translations expand the card instead of overlapping controls or chunk hints.
- Chunk roles and translations precede answer lines visually. Input order and keyboard/answer logic are unchanged.
- Chunk alignment correction: choice-mode chunks share grid rows for role labels, Chinese hints and answers (`subgrid`). Long or missing labels and multiline answers remain visible without per-state fixed heights. Every answer state uses a 2px solid underline; colors retain active/correct/error/revealed distinctions. Blank and completed blocks use the same column sizing. `scripts/practice-chunk-alignment.test.cjs` verifies all states and shared baselines at 1043/390/320px without loading application data.
- Header controls wrap on narrow screens; coarse-pointer icon and primary task controls keep 44px targets. The existing bottom choice tray is retained.
- Header detail correction: exit uses the shared exit SVG, combo uses the existing fire SVG, and the existing `mProgress` node sits at the right above the bar with “学习进度” at the left. The bar remains bound to the original `progFill`; no parallel progress state is introduced.
- No live service restart, course release, data migration or browser-storage reset is needed for this frontend-only delivery. The current attempt is not automatically reloaded to apply styles.

## Verification

Passed targeted tests:

- `scripts/practice-reference-layout.test.cjs`: actual HTML and chunk renderer, 1043/390/320px, compact header, control node identity/handler preservation, question/track ordering, long text, footer replay location, page-exit restoration and unloaded-course state. No account storage is loaded.
- Existing preference/batch UI tests: narrow settings patches, retained answers/queues and failure recovery.
- Practice help, markup, state and policy tests.
- Existing home/practice background continuity tests in light/dark.
- `e2e/ai-course-native-learning.test.js`: temporary server/database, real native-course entry, retry, learning state retention, exit and mobile layout.
- SW install budget/hash and deployment-dependency coverage.

The design detector reported advisory palette/type/radius differences from the broader garden tokens. The user-supplied reference intentionally authorizes this scoped white/slate/gold learning-paper treatment. This is not a claim that the entire repository suite has passed.

## Footer behavior (owner-requested follow-up)

- “听全句朗读” is available before completion in ordinary practice. It reuses the existing full-answer exposure operation and marks the attempt assisted. Assessments do not expose this control before completion.
- Three decorative bars animate only on actual audio `playing` or speech `start/resume` events, and stop on pause, completion, error, question change or practice exit. Playback generations reject stale callbacks. Authored audio keeps the existing browser-speech fallback. Reduced-motion users get a static playing-state treatment.
- “重置选择” resets only the current unfinished answer UI, in the same attempt. Attempt/session IDs, submitted operations, historical rows, cumulative choice counters, wrong attempts and wrong answers are retained. Reset marks the attempt assisted and cannot produce a fresh perfect/first-attempt result. Saving, completed, retry-save and assessment states block reset.
- Role labels and correct/revealed answers share a validated per-chunk color, toned for readable light/dark text. Incorrect-answer feedback remains explicitly red.
- `scripts/practice-footer-actions.test.cjs` tests actual playback adapters/handlers with deterministic speech/audio events, stale callbacks, reset guards and evidence preservation, matching colors and reduced motion in an isolated page.
- `PRACTICE_FOOTER_ACCEPTANCE=1 node e2e/ai-course-native-learning.test.js` verifies durable exposure, wrong answer, partial correct answer, reset/reselect and completion against a newly allocated test server/database. Exactly one sentence completion is saved; prior wrong evidence remains; reset is disabled afterward. The original regression path also passed without this flag.
