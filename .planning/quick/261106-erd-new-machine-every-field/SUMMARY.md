---
quick_id: 261106-erd
slug: new-machine-every-field
date: 2026-11-06
status: complete
commit: 8b31ed9
files_modified: [app/public/index.html, app/public/machines.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-erd — New machine asks for everything Edit asks for

**Asked for:** "when I am adding a new machine I only get the default four options … make sure
that when I'm adding a new machine I have as many options as well."

## What was wrong

| | New machine | Edit machine |
|---|---|---|
| Name, barcode, category, location | yes | yes |
| Manufacturer | **no** | yes |
| Notes | **no** | yes |
| Photograph | **no** | yes |

So a machine could only be described properly by creating it and immediately editing it
again — and `POST /api/equipment` had accepted `manufacturer` and `notes` since v2.0. The
form was the only thing missing them; this is the same shape of bug as the work-order notes
field found in 261106-erc.

## What changed

* **Manufacturer**, **Notes** and **Photograph** on the creating form, so it now renders the
  same seven labels as the editor.
* `addEquipment()` posts the whole record — including the trimmed fields, and `null` rather
  than an empty string — then uploads the photograph, because `/api/equipment/:id/photo`
  needs an id that does not exist until the machine does.
* A photograph that fails does not lose the machine: the machine is already saved and the
  message says *"… The machine itself was saved."*, then the list refreshes.
* The dialog's own subtitle now says the form asks for everything the editor does, so the
  next person does not have to discover it.

## The check that matters

The two dialogs are compared **by the labels they render**:

```
create: Barcode | Category | Location | Manufacturer | Name | Notes | Photograph — …
edit:   Barcode | Category | Location | Manufacturer | Name | Notes | Photograph — …
```

Anything added to one and not the other fails the suite. Counting fields, or checking that a
list of ids exists, would not have caught the state this task started from — every id it did
have was present and correct.

## Mutation proofs

Six mutations, **six caught** — after two survived.

| Mutation | Caught by |
|---|---|
| the creating form loses the manufacturer | *creating a machine asks for everything editing one asks for*, + the id lookup |
| the creating form stops asking for a photograph | same, + the id lookup |
| the photograph is never uploaded on create | *uploads the photograph only after the machine exists* |
| a new machine ignores the notes it was sent | *one request describes the whole machine* |
| **the form asks for notes and drops them** | *the creating form sends what it now asks for* |
| **the manufacturer is asked for and dropped** | same |

**Why two survived first:** the assertion searched the whole `addEquipment()` body for
`#e-notes` and `#e-maker` — and both ids appear in the line that clears the form *after*
saving. A field that is asked for, cleared, and never sent passed. The check now extracts the
`JSON.stringify({…})` argument and requires the three field reads inside it. A file-wide (or
even function-wide) search cannot tell a field that is sent from a field that is tidied away.

The first version of that fix also failed on the *unmutated* code, because the pattern
expected `}))` where the call ends `})}));`. A check that fails everything catches nothing —
it just looks like it is working.
