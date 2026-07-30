# Events — Claude Instructions

## What This Repo Is

A reusable Webflow events system: recurring-event CMS logic, a month/week List View, a linear Feed View, and a Calendar. Vanilla JS + GSAP, driven entirely by `data-ix-*` attributes, no framework. Built from the same starter template as Caleb's Interactions library, so it shares that repo's conventions (see below) — but the two repos are independent; this one is not a dependency of Interactions and vice versa.

Core idea: recurrence (Daily/Weekly/Monthly/Yearly + interval + skip dates + optional end date) is computed once by a shared engine (`getOccurrences(event, rangeStart, rangeEnd)`) and consumed by every view, so recurrence logic only ever lives in one place.

---

## File Structure

```
src/
  index.js             — entry point; imports and calls eventList(), eventFeed(), calendar()
  utilities.js         — shared utility functions (attr)
  recurrence.js        — shared recurrence engine (getOccurrences), no DOM
  recurrence.test.js   — unit tests for recurrence.js (node --test)
  event-data.js        — shared data lookup (whenEvents)
  event-list.js        — List View (data-ix-events-layout="list") + Feed View (data-ix-events-layout="feed")
  calendar.js          — Calendar (data-ix-events-layout="calendar")
```

### index.js

`index.js` is flat — no matchMedia/reduceMotion block, no Lenis instance. It just calls `eventList()`, `eventFeed()`, and `calendar()` on `DOMContentLoaded`; each function no-ops if its wrap selector isn't found on the page.

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

- `recurrence.js` — shared recurrence engine (`getOccurrences`), no DOM, used by every view below
- `event-data.js` — shared data lookup (`whenEvents`); finds the one `[data-ix-events="data-wrap"]` Collection List on the page, used by every view below so they can't read two different sources
- `event-list.js` — exports two views, sharing internal helpers (`buildEntries`, `whenListReady`, `createOccurrenceCard`, date/`FULLDATE` formatting) since they overlap heavily:
  - `eventList()` — month/week List View (`data-ix-events-layout="list"`), expands/filters a native Webflow Collection List in place via Finsweet (see below), with prev/next/today stepping
  - `eventFeed()` — linear Feed View (`data-ix-events-layout="feed"`), always-upcoming-from-today, grows via a `Load More` button, optional month-boundary divider elements. Bypasses Finsweet's filter/render pipeline entirely (see below) — purely additive rendering, so there's nothing to filter
- `calendar.js` — month grid Calendar (`data-ix-events-layout="calendar"`), ported from the original Webflow AI React component

All three (`eventList`, `eventFeed`, `calendar`) read `[data-ix-events="wrap"]` elements and self-filter on `data-ix-events-layout`, so any combination on one page shares one attribute contract instead of separate ones.

List View's and Feed View's cards can both live in the same Collection List as the JSON data, or in a completely separate one — `buildEntries()` auto-detects per item (JSON nested in the item = combined; no JSON = looks up by `data-ix-events-slug` against the page's data-wrap instead).

### External dependency: Finsweet Attributes (List View always; Feed View only for >100 events)

`eventList()` delegates its DOM lifecycle (filtering, item creation, rendering) to [Finsweet Attributes' List solution](https://finsweet.com/attributes/list-filter), used via its **programmatic API** (`List.addHook`, `List.createItem`, `List.triggerHook`), not its declarative checkbox/select filtering — that mode has no concept of expanding one CMS item into multiple occurrence dates, so it can't replace `recurrence.js`. It only computes *which* occurrences exist for the active month and hands the result to Finsweet's `'filter'` hook; Finsweet owns the actual render. Requires, once per site:
- The Finsweet script in the `<head>`, scoped to only load the `list` module: `<script async type="module" src="https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js" fs-list></script>`
- `fs-list-element="list"` on the same Collection List element that carries `data-ix-events="data-wrap"` (or the separate card Collection List, in separate-list mode).

`eventFeed()` never registers with Finsweet's filter/render pipeline — it only ever appends new cards, never hides a previously-shown one, so there's nothing for Finsweet to filter. It only touches Finsweet at all (via the shared `whenListReady()` helper, `required: false`) to await `loadingPaginatedItems` when a feed's Collection List also uses `fs-list-load="all"` for >100 events; without that attribute, Finsweet isn't involved at all for a feed instance.

`calendar.js` is unaffected either way — Finsweet's list/pagination model doesn't apply to a month-grid calendar.

### Known Finsweet quirk: `watchAndUnhide()`

Finsweet's own render step applies an inline `display: none` to `eventList()`'s clone elements at some point after they're created — confirmed live, only on the very first `triggerHook('filter')` call ever made against a given list instance (every call after that is fine). No documented hook (including `afterRender`, the last phase) catches it in time. The fix is a `MutationObserver` per clone (`watchAndUnhide()` in `event-list.js`) that reverts `display: none` back to `''` the instant it's set, regardless of timing. Applied uniformly via `createOccurrenceCard()`, so `eventFeed()`'s clones get it too even though they shouldn't need it (Feed View never asks Finsweet to manage them) — cheap insurance, not a requirement.
