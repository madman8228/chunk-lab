---
name: jqka.top illustrated learning garden
description: Parent homepage visual family derived from the owner's course-cover reference.
colors:
  line: "#523019"
  line-secondary: "#704626"
  ink: "#3c2818"
  ink-secondary: "#745333"
  ink-muted: "#876344"
  paper: "#fffbed"
  paper-warm: "#fff0ce"
  yellow: "#ffcf4e"
  background: "#f8edce"
rounded:
  filter: "9px"
  timber: "12px"
  button: "14px"
  panel: "15px"
spacing:
  tab-gap: "12px"
  card-padding: "20px"
typography:
  headline:
    fontSize: "27px"
    fontWeight: 900
    lineHeight: 1.25
components:
  filter:
    backgroundColor: "#fff8e2"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.filter}"
  filter-selected:
    backgroundColor: "#b64431"
    textColor: "#fff"
    rounded: "{rounded.filter}"
---

# Design System: jqka.top learning garden

The system-wordbook admin review keeps the content studio's established blue/white Operate surface. Images, examples and real audio lead; technical checks are automatic and collapsed, with issue marking only when needed. See `docs/design/admin-wordbook-review-2026-10-20.md`; this scoped admin surface does not use the learner garden theme.

## Overview

**Creative North Star: "课程封面的学习花园"**

The owner supplied their course covers as the visual authority: sunny painted scenery, layered foliage, warm wooden signage, cream paper and dark brown cartoon outlines. The parent homepage now carries this visual family while preserving its live navigation, phone login and flashcard interactions.

Scope is the parent homepage in index.html, shared landing/site.css and landing/theme.css, the vocabulary.html browsing page, the dedicated vocabulary-practice.html learning page, plus the shared phone-authentication dialog in auth-ui.js. The 2026-10-12 separation makes the homepage a portal, vocabulary.html the browsing workbench and vocabulary-practice.html the answer-taking surface; see docs/vocabulary-page-separation-2026-10-12.md. This document does not claim that the full Chunk Lab learning interface has been redesigned.

**Key Characteristics:**

- Painted scenic depth rather than flat geometric scenery.
- Honey-colored timber, warm paper and readable brown text.
- Real HTML controls above decorative imagery.

## Colors

Primary yellow brings the course-cover wooden signs into selected controls. Warm paper supports study content; brown ink and outlines provide readable structure. Rich garden greens and cyan skies belong to the illustrated asset, not to interface text backgrounds.

The frontmatter records implemented reusable colors. landing/theme.css remains the implementation source; gradients and shadows are detailed in the sidecar. Homepage decorative imagery uses a 28% warm-paper veil in the hero and a 48% veil in the body, scoped to home-page; keep UI and artwork color unfiltered. See docs/home-background-hierarchy-2026-10-12.md.

## Typography

Existing homepage font families remain unchanged. The vocabulary-section headline is bold, cream-filled and dark-outlined like the supplied cover titles, with a smaller 24px mobile size. Vocabulary, pronunciation and meaning remain selectable live text, never baked into background illustrations.

## Layout

Retain the incumbent centered navigation and vocabulary grid. The hero uses a wide garden illustration with open central space behind the live JQKA cards. Responsive adjustments at 900px and 620px change hero spacing and card sizes. On phones all primary navigation links remain available, including 段位路径 and 学科; do not hide features to fit one row.

Below the lake terrace, a companion painted path extends behind vocabulary, learning-path and subject sections in a shared garden-body container. Its quiet sandstone center supports opaque paper cards, while asymmetric flowers occupy the outer edges. Preserve the image aspect ratio using width-scaled vertical repetition rather than stretching the hero over the document. Sections are transparent; the old geometric footer grass is hidden. The lower illustration overlaps the hero's final 72px with an alpha mask; do not add a cream or white horizontal fog band. Compensating top padding preserves content positions, and the masked layer never intercepts controls.

## Elevation & Depth

Wooden controls combine inset highlights, a short solid lower edge and soft ambient shadows. Paper cards add a narrow inset honey frame. The recurring wood shadow is `0 3px 0 #a96f25,0 9px 18px rgba(66,42,18,.2)`.

## Shapes

Use warm brown outlines and modest rounded timber shapes: filters are compact, buttons slightly rounder, navigation and paper cards gently curved. Decorative foliage is naturally asymmetric, not mirrored UI geometry.

## Components

- Navigation: honey-gradient timber surface with inset highlights; preserve login/profile and every primary destination.
- JQKA hero cards: fronts retain familiar playing-card suits; backs share the learning-path stages 入门、进阶、流利、精通, with secondary English rank/CEFR labels, short learning outcomes and a real corresponding vocabulary link. Gold is the selected-card treatment, not an unlock/progress signal. Mobile uses two columns so full text and 44px actions remain readable. Only the visible face participates in keyboard focus; Escape flips back.
- Buttons: beveled wood or cream-paper surfaces; pressed state lowers the control by 2px.
- Filters: cream defaults, dark red selected state with white text.
- Flashcards: cream paper, brown outlines and inset honey frame. A focused nested button must activate its own action without triggering the card's keyboard flip handler.
- Vocabulary pilot: browsing belongs on the homepage; learning belongs on vocabulary-practice.html. Study paper and global navigation share outer edges. A compact timber header combines title and word progress. Vertical composition shows the scene above Chinese meaning and a fixed English sentence with critical inline blanks, without tabs, captions or reveal-step actions. Enter moves between blanks and checks the sentence at the last blank; Tab remains native navigation. Errors preserve all answers. Exit pauses, resume retains inputs, skip creates no success and restart resets UI only. Authored picture and sentence describe the same action. Desktop landscapes fill the 660px study column at 16:9, mobile images fill available width at 4:3. Mobile files and fallback formats stay below 10,000 bytes; owner-approved desktop and enlarged introduction files stay below 20,000 bytes. Select one format/profile on demand, no library precache. All cloze completions are assisted practice, including scheduled reviews, not independent mastery. Schema, pure evaluation, generic form rendering and round/persistence control are separate; see docs/sentence-cloze-architecture-2026-10-11.md. Originals and masters remain preserved. Background stays full-color with reduced opacity, without grayscale.
- Level badges: dark red A2 badge and opaque brown CEFR text retain contrast on light materials.
- Practice session controls: a bottom sticky bar exposes Exit, Skip word, and Restart round throughout study and composition. Exit pauses within the current page and retains unfinished input; skip never grants completion/mastery; restart retains saved records and resets only the current round. Summaries distinguish skipped words and skipped remedial attempts. A paused round defers automatic bundle refresh.
- Account panel: warm paper and timber-colored binding action; retain the existing verified-phone versus temporary-account behavior.
- Shared authentication dialog: honey wooden title, warm paper body and brown outlines. Default to phone/password login with no SMS fields. A separate registration action shows the code-send control beside the phone field and requires both the code and a password. Existing SMS-only accounts use the separate password setup/recovery action and keep their identity and records. Authenticated phone binding retains its optional password field. Password help states at least six characters. Hidden mode fields must not enter keyboard focus order. See `docs/design/phone-password-entry-2026-10-20.md`.
- Wordbook details unit directory: owner-approved 2026-10-20 reuse of oral-course lesson cards via `js/lesson-card.js` and `assets/lesson-card.css`, reflowing 3/2/1 columns. Use existing stable default covers, wrapping titles, item counts and unit actions. Keep the directory heading unboxed. Details live in `.impeccable/surfaces/landing-wordbook-details-js.md`.
- Course learning headers: oral, idiom and wordbook practice share `assets/course-learning-header.css`. Use a transparent row with title, exit, progress and optional method controls. Textbook headers separate the book title and unit subtitle using `js/course-learning-header.js`; titles wrap on phones. Reuse `LearningNavigation.create()` for global navigation. Keep all course-specific engine, account and persistence behavior outside the presentation component.
- Wordbook practice refinement: owner-approved 2026-10-20 removes the outer exercise card surface. Align the course header, full illustration and answer area to the same 560px content column; on phones use the available width. Use an 18px course title (16px on phones), a quieter unit subtitle and transparent spacing between image and task.
- Textbook default listening recognition: show the complete sentence with a warm yellow clickable target word. Do not create or request illustrations until the word is opened. Center authored phonetics (when available) and meaning inside the revealed image. Default sentence-audio autoplay on, retain the choice across words, and offer an inline replay control. Missing authored audio stays unavailable; do not substitute synthesized speech. This read-only view does not emit answer/completion events or change saved resume positions.

## Do's and Don'ts

### Temporary legacy login exception

When the server explicitly enables the legacy-password transition, the phone dialog offers a secondary old-account login action. It reuses the incumbent username/password form, never exposes username registration, and keeps the original account ID and course ownership. The form supports returning to phone login, busy-state submission exclusion, announced errors, keyboard focus containment, and cancellation only when the caller allows it. This exception does not restyle the existing form or authorize account merging. Independent review resolved the three identified submission/error/cancellation findings; that verdict is scoped to this transition, not the entire site.

### Vocabulary delivery budget correction

The owner's latest instruction is a unified per-file vocabulary illustration limit strictly below 20,000 bytes for every browser-facing format. Earlier 10,000-byte mobile references in this document are superseded by that instruction and AGENTS.md. Retain the original artwork; load only the illustration needed for current learning content.

### Do:

- Do use painted foliage and warm wooden materials consistent with the supplied course covers.
- Do keep live text and controls distinct from the background illustration.
- Do preserve navigation, keyboard interaction and phone login on narrow screens.

### Don't:

- Dedicated vocabulary introduction and practice paper must both align with the global navigation. Apply completed page-bundle updates only on the visible introduction, never while practice or account input is active; do not clear browser data to fix stale presentation.

- Don't replace real course assets or learning records during visual changes.
- Don't hide primary destinations to fit mobile navigation.
- Don't declare this homepage and authentication style as an already-completed redesign of Chunk Lab.

## Shared content shelves (owner-approved 2026-10-16)

Discovery and My Content use `js/content-card.js` and `assets/content-card.css` as one content-card component. Cover ratio, title/menu row, kind label, hover/focus, transparent default covers, responsive layout and menu behavior must remain identical across these two contexts. The page adapter supplies different links/actions without changing the visual template. Do not restyle one context independently. Default covers contain one small isolated bubble, butterfly or dragonfly with actual alpha transparency; their card cover region also reveals the page background, while the title bar retains paper. Custom covers remain unchanged. Home progress rows are a different task and are not replaced by shelf cards. See `docs/design/shared-content-card-2026-10-16.md` for boundaries and targeted verification.
