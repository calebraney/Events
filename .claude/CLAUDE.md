# Events — Claude Instructions

## What This Repo Is

A reusable Webflow events system: recurring-event CMS logic, a month-based List View, and a Calendar. Vanilla JS + GSAP, driven entirely by `data-ix-*` attributes, no framework. Built from the same starter template as Caleb's Interactions library, so it shares that repo's conventions (see below) — but the two repos are independent; this one is not a dependency of Interactions and vice versa.

Core idea: recurrence (Daily/Weekly/Monthly/Yearly + interval + skip dates + optional end date) is computed once by a shared engine (`getOccurrences(event, rangeStart, rangeEnd)`) and consumed by both the List View and the Calendar, so recurrence logic only ever lives in one place.

---

## File Structure

```
src/
  index.js             — entry point; imports and calls eventList() and calendar()
  utilities.js         — shared utility functions (attr)
  recurrence.js        — shared recurrence engine (getOccurrences), no DOM
  recurrence.test.js   — unit tests for recurrence.js (node --test)
  event-data.js        — shared data lookup (whenEvents)
  event-list.js        — List View (data-ix-events-layout="list")
  calendar.js          — Calendar (data-ix-events-layout="calendar")
```

### index.js

`index.js` is flat — no matchMedia/reduceMotion block, no Lenis instance. It just calls `eventList()` and `calendar()` on `DOMContentLoaded`; each function no-ops if its wrap selector isn't found on the page.

---

## Code Conventions

### File & Function Naming
- File: `kebab-case.js` in `src/`
- Export function: `camelCase` matching filename
- `ANIMATION_ID`: camelCase string, no hyphens (e.g. `'scrollIn'`, `'hoverActive'`)

### Attribute Convention
- Element roles: `data-ix-{name}="{role}"` (e.g. `data-ix-events="wrap"`)
- Options: `data-ix-{name}-{property}` (e.g. `data-ix-events-duplicate-recurring`)

No run gates (`-site-run`/`-page-run`/`-run`) or breakpoint disabling — those are animation-library concepts (opting out of a *decorative* effect on a page/breakpoint). `event-list.js` and `calendar.js` are functional: if their elements/attributes are on the page, they're meant to run there, unconditionally.

### Guard Clause Order (always this order)
1. `querySelectorAll(WRAP)` length check → exit whole function
2. child element length check inside `forEach` → skip instance

### Options Pattern
Every option is a single `attr()` call — no batch reader:
```js
let speed = attr(1, wrap.getAttribute('data-ix-foo-speed'));
```

---

## Key Utilities (`src/utilities.js`)

| Utility | Purpose |
|---|---|
| `attr(default, attrVal)` | Type-safe attribute reader with coercion |

This is a trimmed subset of the Interactions starter's full utility set — only what `event-list.js` and `calendar.js` actually use. Don't port other utilities over from the Interactions repo speculatively; add something here only once a real need for it exists in this repo.

---

## Preferences & Working Style

- **Concise responses** — lead with the action or answer, skip filler
- **No unnecessary extras** — don't add comments, docstrings, error handling, or features beyond what was asked
- **No backwards-compat hacks** — remove things cleanly, don't leave stubs
- **Prefer editing existing files** over creating new ones
- **Keep `README.md` current** — it's the public-facing reference (GitHub repo page), covering CMS field setup, the hidden JSON contract, and the full `data-ix-events-*` element/option/format-token tables for both `event-list.js` and `calendar.js`. Any time a feature is added, an attribute is added/renamed/removed, or existing behavior changes (new option, new default, new format token, changed CMS field), update the relevant table/section in `README.md` in the same change — don't let it drift out of sync with the code.

---

## Interaction Inventory

All interactions live flat in `src/`:

- `recurrence.js` — shared recurrence engine (`getOccurrences`), no DOM, used by both interactions below
- `event-data.js` — shared data lookup (`whenEvents`); finds the one `[data-ix-events="data-wrap"]` Collection List on the page, used by both interactions below so they can't read two different sources
- `event-list.js` — month-based List View (`data-ix-events-layout="list"`), expands/filters a native Webflow Collection List in place
- `calendar.js` — month grid Calendar (`data-ix-events-layout="calendar"`), ported from the original Webflow AI React component

Both `event-list.js` and `calendar.js` read `[data-ix-events="wrap"]` elements and self-filter on `data-ix-events-layout`, so a List View / Calendar toggle on one page shares one attribute contract instead of two.

The List View's cards can live in the same Collection List as the JSON data, or in a completely separate one — `event-list.js` auto-detects per item (JSON nested in the item = combined; no JSON = looks up by `data-ix-events-slug` against the page's data-wrap instead).

### External dependency: Finsweet Attributes (List View only)

`event-list.js` delegates its DOM lifecycle (filtering, item creation, rendering) to [Finsweet Attributes' List solution](https://finsweet.com/attributes/list-filter), used via its **programmatic API** (`List.addHook`, `List.createItem`, `List.triggerHook`), not its declarative checkbox/select filtering — that mode has no concept of expanding one CMS item into multiple occurrence dates, so it can't replace `recurrence.js`. This module only computes *which* occurrences exist for the active month and hands the result to Finsweet's `'filter'` hook; Finsweet owns the actual render.

Requires, once per site:
- The Finsweet script in the `<head>`, scoped to only load the `list` module: `<script async type="module" src="https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js" fs-list></script>`
- `fs-list-element="list"` on the same Collection List element that carries `data-ix-events="data-wrap"` (or the separate card Collection List, in separate-list mode).

`calendar.js` is unaffected — Finsweet's list/pagination model doesn't apply to a month-grid calendar.
