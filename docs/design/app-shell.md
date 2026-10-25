# Workspace shell

Home, My Learning, Discover and Learning Records share the existing `.topbar` in `main.html`.

- `showPage()` sets `html[data-workspace-shell]`; the head initializes it for direct workspace URLs before first paint.
- `assets/app-shell.css` owns header geometry, outer gutters, navigation appearance, workspace background and responsive breakpoints. Page styles must not override these elements.
- `LearningNavigation.mount()` retains the navigation DOM and updates the current entry and navigation callback. Content rerenders must not recreate the header.
- Page-specific spacing belongs to the content area. Discover keeps its internal result scrolling, while other pages scroll the document. A stable root scrollbar gutter prevents horizontal shifts.
- `--app-*` variables describe shell geometry and semantic colors; existing `--ui-radius-*` variables describe shared geometry.

Future themes should change semantic appearance variables under an explicit root theme attribute. Keep route selection and theme selection separate. Theme preferences should use their own settings key and must never rewrite course content or learning records. A theme selector, persistence and alternate palettes are not implemented by this refactor.

Acceptance: at the same viewport and scroll position, all four routes have the same header, logo, navigation and account-entry bounds. Verify active navigation, direct entry, back/forward navigation, narrow screens and Discover's result scrolling.
