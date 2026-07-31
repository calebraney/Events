# Events — Claude Instructions

## What This Repo Is

A reusable Webflow events system: recurring-event CMS logic, a month/week List View, a linear Feed View, and a Calendar. Vanilla JS + GSAP, driven entirely by `data-ix-*` attributes, no framework. Built from the same starter template as Caleb's Interactions library, so it shares that repo's conventions (see below) — but the two repos are independent; this one is not a dependency of Interactions and vice versa.

Core idea: recurrence (Daily/Weekly/Monthly/Yearly + interval + skip dates + optional end date) is computed once by a shared engine (`getOccurrences(event, rangeStart, rangeEnd)`) and consumed by every view, so recurrence logic only ever lives in one place.

---

## File Structure

```
src/
  index.js             — entry point; imports and calls eventList(), eventFeed(), calendar()
  utilities.js         — shared utility functions (attr, uniquifyIds)
  date-utils.js        — shared date math + formatting (range stepping, token formatting, FULLDATE), no DOM
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
| `uniquifyIds(root, suffix)` | Strips duplicate `id`/`data-w-id` from a cloned subtree — used by both `event-list.js` (occurrence clones) and `calendar.js` (pill clones) |

This is a trimmed subset of the Interactions starter's full utility set — only what `event-list.js` and `calendar.js` actually use. Don't port other utilities over from the Interactions repo speculatively; add something here only once a real need for it exists in this repo.

Date math and formatting (`formatOccurrenceDate`, `formatFullDate`/`FULLDATE`, `setDateFields`, range-stepping helpers) live in `src/date-utils.js` instead, since `calendar.js` needs the exact same formatting contract as `event-list.js`'s date elements — see the Interaction Inventory below.

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
- `date-utils.js` — shared date math + formatting: `formatOccurrenceDate`/token vocabulary, `formatFullDate`/`FULLDATE`, `setDateFields` (writes formatted text into any `[data-ix-events="date"]` element), `formatWeekLabel`, and range-stepping helpers (`anchorFor`, `getRangeBounds`, `stepCurrent`, `stepPeriodEnd`, `startOfWeek`, `startOfDay`, `addDays`). No DOM except `setDateFields`. Used by both `event-list.js` and `calendar.js` so date formatting/range math only ever works one way
- `event-list.js` — exports two views, sharing internal helpers (`buildEntries`, `whenListReady`, `createOccurrenceCard`) since they overlap heavily:
  - `eventList()` — month/week List View (`data-ix-events-layout="list"`), expands/filters a native Webflow Collection List in place via Finsweet (see below), with prev/next/today stepping
  - `eventFeed()` — linear Feed View (`data-ix-events-layout="feed"`), always-upcoming-from-today, grows via a `Load More` button, optional month-boundary divider elements. Bypasses Finsweet's filter/render pipeline entirely (see below) — purely additive rendering, so there's nothing to filter
- `calendar.js` — month/week grid Calendar (`data-ix-events-layout="calendar"`), rebuilt to be fully Webflow-authored (see "Calendar rendering model" below) — no Finsweet dependency, no Collection List; day cells/pills/hover-card are all Designer-built elements the script fills in and positions

All three (`eventList`, `eventFeed`, `calendar`) read `[data-ix-events="wrap"]` elements and self-filter on `data-ix-events-layout`, so any combination on one page shares one attribute contract instead of separate ones.

List View's and Feed View's cards can both live in the same Collection List as the JSON data, or in a completely separate one — `buildEntries()` auto-detects per item (JSON nested in the item = combined; no JSON = looks up by `data-ix-events-slug` against the page's data-wrap instead). Calendar's optional hover-cards use the same slug-matching idea (see README §4) but there's no `buildEntries()`-style shared helper for it — it's a much simpler one-off `Map` built directly in `calendar.js`, since a hover-card isn't a per-occurrence clone the way List/Feed cards are.

### Calendar rendering model

`calendar.js` treats every occurrence — single- or multi-day — as one or more "segments": clipped to the visible day cells, split at week-row boundaries (`splitIntoSegments`), then lane-assigned within each row (`assignLanes`) so overlapping events stack instead of colliding — this part of the pipeline is unchanged from earlier revisions. What changed (per Caleb's request to drop absolute positioning in favor of normal document flow) is how a segment becomes DOM: there is **no** `[data-ix-events="pill-overlay"]`, no `getBoundingClientRect` measurement, and no `ResizeObserver` anywhere. Instead every day-cell a segment crosses gets its own pill *piece*, cloned from `[data-ix-events="calendar-pill"]` and appended as a normal-flow child of that day's own `[data-ix-events="day-pills"]` — a 3-day event clones the template 3 times. Only the `is-start`/`is-single` piece is populated with real content; `is-middle`/`is-end` pieces stay empty and use `min-width: calc(100% + var(--cell-padding))` (plus a matching negative `margin-left` on `is-middle`/`is-end`, since growing width alone only extends an element's right edge) to bleed past `--cell-padding` into the neighboring day-cell's own piece, reading as one continuous bar. A day-cell's height grows automatically (flex/grid normal flow) to fit however many pieces it holds — nothing computes or sets height in JS. Keeping a multi-day bar's lanes aligned across day-cells relies on every pill/spacer sharing a fixed `--pill-height`; where a day's active lanes have a gap (an event touches lane 2 but not lane 1 on that particular day), `renderGrid()` clones `[data-ix-events="calendar-pill-spacer"]` into the gap so alignment holds. `assignLanes` sorts multi-day segments ahead of same-start single-day ones within a row (via a per-segment `isMultiDay` flag set from the occurrence's true start/end, not the clipped segment), so multi-day bars always claim the lowest lanes and land at the top of the stack, connecting seamlessly across cells instead of landing under whichever single-day event grabbed a lower lane first — one accepted trade-off documented inline is a minor loss of lane-packing efficiency for a non-overlapping single-day event that starts before a multi-day one in the same row. What happens to lanes beyond `data-ix-events-day-pill-limit` still depends on `data-ix-events-overflow-items` (`expand` default/`hide`/`show` — see README §4 "Overflow behavior"), but there's no more explicit row-growing step (`growRow` was removed) — a row's day-cells simply grow with whatever's actually rendered in them. `[data-ix-events="day-more"]` is a real `<button>`, not a div, so its click never bubbles into "the whole cell is clickable" territory — pills stay independently linkable to their own event pages. `data-ix-events-show-outside-month` (README §4 "Outside-month events") clips occurrence segments to `inMonthBounds()` when off, rather than dropping or misplacing events that touch the leading/trailing adjacent-month days. `data-ix-events-hide-inactive-row` shrinks `renderGrid()`'s own `cellCount` from 42 to 35 whenever the grid's 6th row is entirely next-month (`cellDates.slice(35, 42).every((c) => !c.inMonth)`) — reusing the existing `i >= cellCount` cell-hiding branch rather than a separate hide step, which also means every downstream index-clamped calculation (occurrence clipping, lane assignment, overflow) automatically stops touching those cells too, with no extra guards needed. Re-evaluated on every render (not cached), since which months need 5 vs. 6 rows changes as you navigate. Week mode (`data-ix-events-range="week"`) doesn't require the full 42 `day-cell` elements the way month mode does — `calendar.js` only ever shows/populates `Math.min(cellCount, dayCells.length)` cells, so a week-only instance can just be authored with 7 (as `design/calendar-mockup.html`'s Part 3 does) — see README §4 "Week mode" for why the `is-range-week` state class has to be applied to each visible cell individually, not just the grid (Lumos forbids descendant selectors, so CSS alone can't cascade it down); the same reasoning is why `overflow-items="expand"`'s hidden-lane-reveal logic is JS-driven (`expandedRows` Set + a single delegated click listener on the grid) rather than attempted via CSS. The hover card remains the one `position: absolute` element in the component (Caleb's explicit exception) since it floats freely next to whichever pill is hovered — it's absolute permanently (even while hidden) so `showHoverCard()` can measure its size before positioning it, and its DOM position itself never changes on hover (only inline `left`/`top` and classes do). It left-aligns with the pill (clamped horizontally within `offsetParent`'s bounds, never centered), and shows below the pill if the pill is in the top half of the *viewport* or above it if in the bottom half (clamped vertically the same way) — see README §4 "Hover card reveal" for the full rule. The reveal itself is opacity+`transform`-based (`is-above`/`is-below` pick a directional slide of `--hover-card-move`, default `0.75rem`; `is-active` drives the fade/slide-in via a CSS transition) rather than `display`-based; `is-above`/`is-below` are applied a `requestAnimationFrame` tick before `is-active` (with a forced `void card.offsetHeight` reflow in between) specifically so the browser paints the offset/hidden starting state before the transition to the resting/visible state — otherwise both states land in one synchronous batch and the transition never plays. This only gates when the reveal *animation* starts, never the `left`/`top` positioning itself, which stays synchronous. `hideHoverCard()` just removes `is-active` — the same transition plays back out (fade + slide back toward whichever `is-above`/`is-below` is still set) with no extra JS. The one asymmetry is `visibility`, which has its own `transition-delay`: `0s` on `.is-active` (paintable the instant a hover starts) vs. `150ms` — the fade duration — on the base rule (stays visible for the whole fade-out instead of vanishing the instant `is-active` is removed).

A small set of CSS custom properties (`--cell-padding`, `--cell-border-width-top`/`-right`/`-bottom`/`-left`, `--cell-border-color`, `--grid-radius`, `--pill-height`, `--pill-gap`, `--pill-radius`, `--cell-min-height`), scoped to `.calendar_wrap` rather than `:root` (Lumos reserves `:root` for the site's own theme variables), centralize the values that used to be hard-coded across several classes — see README §4 "Global design tokens". Each day-cell's border is a full 4-sided border-collapse (own border on every side, pulled over its neighbors via a negative margin equal to each side's own width, padding compensated back) so adjacent cells' borders never double up regardless of per-side width — including asymmetric widths or `0` on a given side. `design/calendar-mockup.html` is a single file meant to be pasted into Webflow in ONE operation — it has exactly one shared `<style>` block (in its first part) that all three parts (styleguide/month/week) reuse; splitting the paste into separate operations, each redefining the same classes in its own `<style>` block, is what caused Webflow to duplicate classes the first time this was tried. The pre-rewrite absolute-overlay version (measurement-based positioning, `growRow`, `ResizeObserver`) is preserved at `backup/calendar.js` / `backup/calendar-mockup.html` in case it's ever needed again.

Reference markup demonstrating the full contract lives at `design/calendar-mockup.html` (Lumos-conformant, built via `/anthropic-skills:lumos-skill` — see [[feedback_lumos_variable_naming]] in memory for this project's actual `--_theme---*`/`--border-radius--*` variable names, which differ from that skill's generic documented examples).

### Known footgun: hover-card nested inside a hidden template holder

Confirmed live (not hypothetical): a Designer build reused List View's `item`/`data-ix-events-slug` Collection List pattern for hover-cards, which is fine, but nested the whole list inside a `u-display-none`-carrying holder meant only for the pill template — a hidden ancestor keeps a child hidden no matter what the child's own `is-active` class does, so the cards could never show regardless of hover logic being otherwise correct. `buildHoverCardMap()`'s `unwrapFromHiddenAncestor()` now relocates a hover-card's container out from under any hidden ancestor automatically at init, so this self-heals without a Designer change — but it's still worth flagging in review if you see a `hover-card` nested under `u-display-none`/`.calendar_hidden`, since it signals someone reused the wrong template location as a starting point.

### External dependency: Finsweet Attributes (List View always; Feed View only for >100 events)

`eventList()` delegates its DOM lifecycle (filtering, item creation, rendering) to [Finsweet Attributes' List solution](https://finsweet.com/attributes/list-filter), used via its **programmatic API** (`List.addHook`, `List.createItem`, `List.triggerHook`), not its declarative checkbox/select filtering — that mode has no concept of expanding one CMS item into multiple occurrence dates, so it can't replace `recurrence.js`. It only computes *which* occurrences exist for the active month and hands the result to Finsweet's `'filter'` hook; Finsweet owns the actual render. Requires, once per site:
- The Finsweet script in the `<head>`, scoped to only load the `list` module: `<script async type="module" src="https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js" fs-list></script>`
- `fs-list-element="list"` on the same Collection List element that carries `data-ix-events="data-wrap"` (or the separate card Collection List, in separate-list mode).

`eventFeed()` never registers with Finsweet's filter/render pipeline — it only ever appends new cards, never hides a previously-shown one, so there's nothing for Finsweet to filter. It only touches Finsweet at all (via the shared `whenListReady()` helper, `required: false`) to await `loadingPaginatedItems` when a feed's Collection List also uses `fs-list-load="all"` for >100 events; without that attribute, Finsweet isn't involved at all for a feed instance.

`calendar.js` is unaffected either way — Finsweet's list/pagination model doesn't apply to a month-grid calendar.

### Known Finsweet quirk: `watchAndUnhide()`

Finsweet's own render step applies an inline `display: none` to `eventList()`'s clone elements at some point after they're created — confirmed live, only on the very first `triggerHook('filter')` call ever made against a given list instance (every call after that is fine). No documented hook (including `afterRender`, the last phase) catches it in time. The fix is a `MutationObserver` per clone (`watchAndUnhide()` in `event-list.js`) that reverts `display: none` back to `''` the instant it's set, regardless of timing. Applied uniformly via `createOccurrenceCard()`, so `eventFeed()`'s clones get it too even though they shouldn't need it (Feed View never asks Finsweet to manage them) — cheap insurance, not a requirement.
