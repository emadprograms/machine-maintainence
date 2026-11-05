# Phase 11 — The shell: context

## What exists

`public/index.html` holds a sticky `<header>` with the title and sign-out button,
then a `<nav>` row of seven pill buttons rendered by `buildTabs()` in `app.js`
from a `PAGES` array. Each section is a `<section data-page="...">` toggled by
`.hidden`. `showPage(key)` flips both the button state and the section visibility,
and calls a loader for that key.

That is the entire navigation. It works, and it has two problems:

1. **Seven pills wrap.** At laptop width the row wraps onto a second line, and the
   two admin-only pills vanish for technicians — so the navigation moves
   depending on who signed in.
2. **The content is boxed in.** `main` is capped at 1100px and the tabs sit above
   it, so the layout is a narrow column under a floating row of buttons. There is
   no persistent sense of place.

## Requirements

- **NAV-01** — a persistent sidebar listing every permitted screen, current one marked
- **NAV-02** — collapses to an icon rail and expands back; state survives reload
- **NAV-03** — only permitted screens appear; a technician never sees Users or Backup
- **NAV-04** — the screens themselves are unchanged in behaviour

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where the nav lives | A new `public/shell.js`, not more lines in `app.js` | `app.js` is 424 lines; the readability constraint is binding and this is the phase most likely to break it |
| How the sidebar is rendered | Same `PAGES` array, filtered by role | The data already exists; this is a rendering change, so admin-only filtering cannot drift from the screen list |
| Persisting collapsed state | `localStorage`, key `mm.sidebar.collapsed` | Cosmetic state that must not require a server round trip or a schema. A cleared browser resets it to expanded, which is the correct default |
| Icons | Inline SVG, drawn as text in the module | No CDN, no font icons, no image files — the offline constraint holds and an SVG path is readable |
| Accessibility | `aria-current` on the active entry; icon rail keeps an `aria-label` per link | A collapsed sidebar without names is unusable to a screen reader, and hard to use with a keyboard |
| Toggle | A real `<button>` with `aria-expanded` and a keyboard shortcut | Buttons that only respond to a mouse are a regression from the tab row, which was keyboard reachable |

## What must not change

The screen markup, the loaders, the ids the smoke suite looks up. Phase 13
restyles the screens; this phase only moves what navigates between them. If a
test needs to change in this phase, that is a signal the change went too far.

## Migration

None. No schema change, no server change.
