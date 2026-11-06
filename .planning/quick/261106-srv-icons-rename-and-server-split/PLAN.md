# Quick task 261106-srv — three fixes and a code review

**Requested:** History and Report have no icons in the sidebar; `starter/` is not a
starter, it is the source code; and the `server.js` debt should be paid.

## 1. The missing icons
`public/shell.js` holds one inline SVG per screen in `ICONS`. `PAGES` in `app.js` lists
the screens. Nothing compared the two, so when History and Report were added in v3.0
they rendered an empty `<svg>` — a blank column that reads as a layout fault.
Plan: assert the two lists agree in both directions **first**, watch it fail, then add
the two icons.

## 2. `starter/` → `app/`
The name described November, not the product. Rename, then update code, launchers,
`.gitignore` and every live document; archived milestone records keep their original
wording with a note explaining the rename.

## 3. `server.js`, 814 lines
The project's rule is that ~600 lines is a signal to split. Split at the section
comments rather than by retyping, so no handler logic can drift; verify the route set is
unchanged; then make the rule self-enforcing with an assertion.

## 4. Code review
Read the whole of `app/` with fresh eyes, probe each suspicion against a running server
before recording it, and fix what is genuinely wrong.
