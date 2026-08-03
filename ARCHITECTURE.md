# Events Library — Internals

This is a code-level walkthrough of how the library actually works, not a usage guide (that's `README.md`) and not agent conventions (that's `.claude/CLAUDE.md`). Written for understanding what's already built, so you know where to hook in as you extend it.

---

## 1. Core architecture

Eight files in `src/`, four of them are the real "engine":

```
index.js          entry point — calls the three layout initializers
event-data.js      shared data lookup (the ONE place events get loaded from)
recurrence.js      pure date math — no DOM — expands one event into occurrences
date-utils.js      pure formatting + range-navigation math — no DOM except setDateFields
utilities.js       two tiny generic DOM helpers
event-list.js      List View + Feed View (data-ix-events-layout="list" | "feed")
calendar.js        Calendar (data-ix-events-layout="calendar")
recurrence.test.js unit tests for recurrence.js only
```

### `index.js`

```js
document.addEventListener('DOMContentLoaded', function () {
  eventList();
  eventFeed();
  calendar();
});
```

That's the entire file. Three independent calls, no shared state between them, no return values used. Each of the three functions is a complete no-op if it finds no matching wrap on the page — so having all three always run costs nothing on a page that only uses one view.

### `event-data.js` — `whenEvents(wrap, callback)`

The single source of truth for "what events does this specific instance see." Both `event-list.js` and `calendar.js` call this and only this to get event data — there is no second code path that reads the JSON differently. Called once **per wrap**, not once per page — each instance resolves its own data source independently.

What it does, in order:
1. **`resolveDataWrap(wrap)`** — finds which `[data-ix-events="data-wrap"]` this specific wrap should read from: a `data-wrap` nested *inside* `wrap` wins if present (a local override); otherwise the first `data-wrap` anywhere on the page whose nearest wrap ancestor is `null` (i.e. genuinely page-level, not nested inside any wrap at all — including some *other* wrap, which would mean it's already claimed as that instance's own local override, not available as a shared fallback). This is what lets most pages use one shared source with zero configuration, while any individual instance can opt into its own scoped data (e.g. a smaller, pre-filtered Collection List) purely by nesting a `data-wrap` inside its own wrap.
2. If nothing resolves yet, retry every 300ms, up to 20 times (6 seconds), then give up and call back with `[]`. This is the one "waiting for the page to catch up" spot outside of Finsweet — and also covers a local/page-level data-wrap that simply hasn't rendered into the DOM yet, since `resolveDataWrap` re-runs on every attempt.
3. Once resolved: if that data-wrap carries `fs-list-element="list"` (meaning Finsweet needs to paginate past Webflow's ~100-item cap), queue a callback via `window.FinsweetAttributes.push(['list', ...])` and wait on that List instance's `loadingPaginatedItems` promise before reading anything. If it doesn't carry that attribute, skip straight to parsing.
4. Parse every item's JSON via `parseEventFromJSON` (from `recurrence.js`), drop anything that fails to parse or has no valid start date, and call `callback(events)` with the final array.

Each layout calls this once per wrap it finds — `calendar.js` always did (`initCalendar(wrap)` runs per instance already); `event-list.js`'s `eventList()`/`eventFeed()` moved their `whenEvents(...)` call inside their own `wraps.forEach(...)` loop specifically to support this, since different wraps of even the *same* layout type can now resolve to different data sources. There's still no caching — if three wraps on a page all resolve to the same page-level data-wrap, that one Collection List gets independently re-scanned and re-`JSON.parse`d three times. Cheap in practice (it's just DOM queries + parsing on however many items exist), but worth knowing if you're ever chasing a performance question.

### `recurrence.js` — the engine, zero DOM

Two exports:

- **`getOccurrences(event, rangeStart, rangeEnd)`** — the recurrence expansion. Given one event and a date window, returns every `{ start, end }` occurrence that falls in that window. Implementation is a single day-by-day walk from `max(startDate, rangeStart)` to `min(seriesEndDate, rangeEnd)`, testing each calendar day against a `matchesFrequency(day)` switch (Daily/Weekly/Monthly-same-date/Monthly-same-weekday/Yearly). This unified walk is why month-end clamping, skip dates, and the start-date lower bound all fall out of one loop instead of six special-cased ones per frequency type.
- **`parseEventFromJSON(raw)`** — turns the raw JSON blob (camelCase strings, e.g. `"showStartTime": "true"`) into a normalized event object (real booleans, real `Date` objects, arrays for the CSV fields). This is the ONE place field names get decided — if you ever add a new CMS field, this is where it enters the system.

Nothing in this file touches the DOM, `window`, or any `data-ix-*` attribute. It's a pure function library, which is why it's the only file with its own test suite (`recurrence.test.js`, 25 tests).

### `date-utils.js` — shared formatting + range math, one DOM touchpoint

Two unrelated concerns living in one file because both List/Feed and Calendar need both:

- **Range/navigation math** (no DOM): `anchorFor`, `getRangeBounds`, `stepCurrent`, `stepPeriodEnd`, `startOfWeek`, `addDays`, `startOfDay`. These compute "what is the active month/week window" and "step it forward/backward by one" — used identically by List View's prev/next and Calendar's prev/next, so a month-boundary bug only ever needs fixing once.
- **Formatting** (no DOM, except the one function below): `formatOccurrenceDate` (the token engine — `MMMM`, `Do`, `h:mma`, etc.), `formatFullDate`/`formatTimeOnly` (the `FULLDATE`/`TIME`/`TIME-SHORT` composite formats, driven by the event's Show Start/End Time flags rather than a literal token string).
- **`setDateFields(root, occurrence, event)`** — the one function in this file that touches the DOM. Walks every `[data-ix-events="date"]` element under `root` and sets its text (or hides it, for `TIME`/`TIME-SHORT` when Show Start Time is off) based on that element's own `data-ix-events-date-format` attribute. Called identically by List View cards, Feed View cards, Calendar pills, and the Calendar hover-card — this is the reason all four have the exact same format-string vocabulary without any of them special-casing it.

### `utilities.js`

Two functions, both generic:
- **`attr(defaultVal, attrVal)`** — reads a `data-ix-*` attribute string and coerces it to match the default's type (`true`/`false` strings → booleans if the default is boolean, numeric strings → numbers if the default is a number, otherwise passes the string through). Every option-reading line in every layout goes through this.
- **`uniquifyIds(root, suffix)`** — strips `data-w-id` and suffixes `id` attributes on a cloned subtree, so duplicating a template doesn't produce duplicate DOM ids or confuse Webflow's native Interactions panel (which targets elements by `data-w-id`).

### `event-list.js` — List View + Feed View

One file, two exported functions (`eventList`, `eventFeed`), because they share enough machinery that splitting them would mean either duplicating it or an early, speculative refactor. Shared internals:

- **`buildEntries(wrap, eventsBySlug)`** — pairs each `[data-ix-events="item"]` with its event, either by parsing the item's own embedded JSON ("combined" mode) or by looking up its `data-ix-events-slug` against `eventsBySlug` ("separate" mode, for when the visible cards live in a different Collection List than the data). `eventsBySlug` is built from whatever this specific wrap's own `whenEvents(wrap, ...)` call resolved — the local data-wrap it has, or the page-level fallback — not necessarily the same map every other wrap on the page gets.
- **`whenListReady(wrap, required, callback)`** — resolves this wrap's Finsweet List instance (see §3). `required: true` for List View (no instance = a setup error, warns), `required: false` for Feed View (no instance = proceed immediately, Feed doesn't need one).
- **`createOccurrenceCard(templateItem, occurrence, event, suffix)`** — `cloneNode` + reset inline `display` + `uniquifyIds` + `setDateFields` + `watchAndUnhide`. Used for every extra occurrence card in both views.
- **`watchAndUnhide(el)`** — the Finsweet workaround, see §3.

List-View-specific: `buildListConfig`, `initList`, `compareListEntries`, `isPrevDisabled`/`isTodayDisabled`.
Feed-View-specific: `initFeed`, `loadMore`, `mergeOccurrences`, `createDivider`.

### `calendar.js` — Calendar

Self-contained; imports nothing from `event-list.js` and never touches Finsweet. Two top-level pieces:

- **`initCalendar(wrap)`** — one-time setup per instance: reads options, builds the hover-card slug map, wires nav button listeners, calls `refresh()` once immediately (renders an empty but structurally-correct grid before data even arrives), then calls `whenEvents(wrap, ...)` to get this instance's own resolved data.
- **`renderGrid(...)`** — the actual per-render work, called by `refresh()` on init and every nav click. Pipeline: occurrence → **segment** (clipped to the visible grid, split at week-row boundaries via `splitIntoSegments`) → **lane** (greedy overlap-packing via `assignLanes`, so overlapping events stack instead of colliding) → **pill piece** (one DOM clone per day-cell a segment crosses, via `createPill`, appended into that day's own `[data-ix-events="day-pills"]`).

Plus a self-contained hover-card subsystem (`showHoverCard`, `hideHoverCard`, `buildHoverCardMap`, `unwrapFromHiddenAncestor`) — the one place in the whole library that still uses `position: absolute` instead of normal document flow.

---

## 2. What happens when the page loads, in order

```
1. Browser parses HTML.
   Webflow's own runtime renders Collection Lists (including the hidden
   JSON data-wrap and any card Collection Lists) as part of normal page
   render — this already happened by the time step 2 fires, UNLESS
   Finsweet pagination is involved (see step 5).

2. DOMContentLoaded fires → index.js runs eventList(), eventFeed(),
   calendar() synchronously, in that order. Each:
     a. Scans the page for [data-ix-events="wrap"] elements matching its
        own layout attribute.
     b. Returns immediately (no-op) if it finds none.

3. calendar() specifically (independent of the other two) does its DOM
   setup RIGHT AWAY, synchronously, before any data has loaded:
     - reads options, builds the hover-card map, wires nav listeners
     - calls refresh() once → renders an empty grid: correct day numbers,
       correct "today" highlight, correct leading/trailing outside-month
       cells — all of this is pure date math, none of it needs event
       data, so the grid is visually correct and never flashes blank.

4. eventList() and eventFeed() do NOT render anything yet at this point —
   they only reach the "scan for wraps" step and then wait on data.

5. Every wrap found calls whenEvents(wrap, callback) — ONE call per WRAP,
   not one shared call per layout — this is the FIRST real waiting point:
     a. resolveDataWrap(wrap): a [data-ix-events="data-wrap"] nested
        INSIDE this wrap wins if present (a local override); otherwise
        the first page-level data-wrap not nested inside any wrap at all
        (a shared fallback). If neither exists yet, retry every 300ms, up
        to 6 seconds total, then give up with [].
     b. If the resolved data-wrap is marked for Finsweet pagination
        (fs-list-element="list"), queue onto window.FinsweetAttributes
        and wait for that List instance's loadingPaginatedItems promise
        — THIS is where the page can actually pause waiting on Finsweet's
        own script to have loaded AND initialized AND finished paginating.
        (No-op, proceeds immediately, if that attribute isn't present.)
     c. Parse every item's JSON, filter out anything invalid, call back
        with the array.

6. calendar()'s whenEvents callback fires, per wrap:
     - real events found → state.events = events
     - none found at all → falls back to 3 hardcoded demo events
       (this is Calendar-only — List/Feed have no fallback)
     - hides the loading overlay, calls refresh() AGAIN — this second
       render is what actually fills the grid with pills.

7. eventList()'s whenEvents callback fires, per list-layout wrap:
     - builds this wrap's OWN eventsBySlug map (from whatever data source
       IT resolved — could differ from another list-layout wrap on the
       same page, if that one has its own local data-wrap)
     - calls whenListReady(wrap, required: true, ...) — the SECOND
       waiting point, specific to List View: resolving Finsweet's own
       List module and finding the instance matching this wrap's
       fs-list-element="list", via the same window.FinsweetAttributes
       queue mechanism. Also re-awaits loadingPaginatedItems here
       (independently of step 5b — the DATA source and the CARD source
       can be two different, independently paginated Collection Lists in
       "separate" mode).
     - once ready: buildListConfig() pairs items↔events, initList()
       registers Finsweet's 'filter' hook, then calls refresh() once —
       which calls listInstance.triggerHook('filter') to manually fire
       Finsweet's filter pipeline for the first time (needed because
       Finsweet's own automatic initial pass runs BEFORE this module's
       hook is even registered).

8. eventFeed()'s whenEvents callback fires, per feed-layout wrap:
     - whenListReady(wrap, required: false, ...) — optional wait, only
       relevant if fs-list-load="all" is set on that specific feed's
       Collection List; proceeds immediately otherwise.
     - initFeed() hides every template item, calls loadMore() once (its
       own self-contained expanding-search + append logic, no Finsweet
       filter pipeline involved at all), wires the Load More button.

At this point the page is fully interactive: Calendar has pills and nav,
List View has its first month/week rendered via Finsweet, Feed has its
first batch of upcoming cards. Every subsequent interaction (nav click,
Load More click, month navigation) re-runs the RENDER step only — never
re-fetches or re-parses the underlying event data, which stays in memory
for the life of the page.
```

The two genuine "waiting on something external" points are **5b** (Finsweet pagination, only if `fs-list-load="all"` is in use) and **7**'s Finsweet-List-instance resolution (List View only, always). Calendar never hits either.

---

## 3. Where Finsweet fits in

**Scope: List View only, plus one optional, narrow use in Feed View. Calendar never touches it.**

### The mechanism

Finsweet's script is loaded externally (a `<script>` tag in the site's `<head>`, not part of this repo's bundle) and initializes asynchronously, on its own schedule, with no guaranteed ordering relative to this bundle's `DOMContentLoaded` handler. Finsweet's own public API for handling that race is:

```js
window.FinsweetAttributes ||= [];
window.FinsweetAttributes.push(['list', (listInstances) => { ... }]);
```

If Finsweet hasn't finished loading yet, this queues the callback; Finsweet drains the queue once it's ready. If Finsweet is already loaded, it (per Finsweet's own implementation) invokes the callback right away. This exact pattern appears in three places: `event-data.js`'s pagination-await, `event-list.js`'s `whenListReady()`, and nowhere else — Calendar has no reason to ever touch this array.

### The load/filter separation

This is the key architectural point:

- **Loading** (`event-data.js`'s `whenEvents`) happens once, at page load, completely independent of any active month/week. It just finds and parses every event on the page, unconditionally, into one in-memory array.
- **Filtering** (deciding which *occurrences* of those events fall in the *currently active* range) happens on every render — `getOccurrences(event, rangeStart, rangeEnd)`, called fresh against the already-loaded, in-memory data. No re-fetching, no re-parsing, no talking to Finsweet again for the data itself.

Finsweet's `filter` hook, from this codebase's point of view, is really a **re-render trigger with a result contract**, not a data source. `listInstance.triggerHook('filter')` just re-invokes the same registered hook function — which recomputes occurrences fresh from the in-memory `entries` — and hands Finsweet a new array to reconcile the DOM against.

### What Finsweet owns vs. what this code owns (List View)

| | Owner |
| --- | --- |
| Deciding which occurrences exist for the active range | **This code** — `getOccurrences()`, pure date math, has nothing to do with Finsweet |
| Creating a DOM clone for each extra occurrence beyond the first | **This code** — plain `cloneNode`, via `createOccurrenceCard()` |
| Registering a manually-created clone so Finsweet tracks it | **Finsweet** — `listInstance.createItem(clone)`, called once per clone |
| Actually showing/hiding/reordering DOM elements to match the array returned from `filter` | **Finsweet** — its own internal render pipeline (`beforeRender`/`filter`/`sort`/`afterRender`; this codebase only ever hooks `filter`) |
| Pagination past Webflow's ~100-item Collection List cap | **Finsweet** — `fs-list-load="all"` |
| The one thing this code fights *against* Finsweet on | See below |

**The one workaround, `watchAndUnhide()`:** confirmed live via devtools — Finsweet's own render step applies an inline `display: none` to newly-created clone elements, but only on the very first `triggerHook('filter')` call ever made against a given List instance (every call after that is fine). No documented hook catches it in time. The fix is a `MutationObserver` per clone that reverts `display: none` the instant it's set, regardless of timing. Feed View's clones get this too even though Feed never registers with Finsweet's render pipeline — cheap insurance, not a requirement.

### Feed View's relationship to Finsweet

Feed View does not use `addHook('filter', ...)`, does not call `createItem()`, and never gets diffed by Finsweet's render pipeline. It only ever *appends* (a card, once shown, is never hidden again — occurrences from different events interleave chronologically across the whole feed, so there's no sense in which any card needs to disappear). The **only** thing Feed optionally uses Finsweet for is `loadingPaginatedItems` — awaiting it, if a feed's own Collection List happens to use `fs-list-load="all"`, before scanning for items at all.

### Calendar's relationship to Finsweet

None. `calendar.js` doesn't import anything Finsweet-related, doesn't check for `fs-list-element`, doesn't queue onto `window.FinsweetAttributes`. It calls `whenEvents(wrap, ...)` like everyone else, but that function's own internal Finsweet-pagination-await (step 5b above) is invisible to the caller — Calendar just gets a plain array back, whether or not Finsweet was involved in producing it.

---

## 4. What's shared vs. unique across the three views

### Shared by all three

- **Data source** — the exact same `whenEvents(wrap, callback)` call, same resolution rule (local-then-page-level), same JSON schema, same `parseEventFromJSON`.
- **Recurrence engine** — the exact same `getOccurrences(event, rangeStart, rangeEnd)` call. They differ only in *what range* they pass and *how often* they call it, never in the underlying math.
- **Date-element convention** — any `[data-ix-events="date"]` element, in any of the three views' markup, is populated by the exact same `setDateFields()`, respecting the exact same `data-ix-events-date-format` vocabulary (plain tokens, `FULLDATE`, `TIME`, `TIME-SHORT`).
- **Attribute conventions** — `data-ix-events-*` prefix, `attr()` for type-coerced option reading, options live on the wrap, roles are `data-ix-events="{role}"`.
- **Range-navigation math** — `anchorFor`/`getRangeBounds`/`stepCurrent` from `date-utils.js` are genuinely shared code (not reimplemented per view) — List View's month/week stepping and Calendar's month/week stepping call the identical functions. Each view keeps its *own* `current` state (a closure variable), but the math itself is one implementation.

### Shared by List View + Feed View only (both live in `event-list.js`)

- `buildEntries()` — combined vs. separate mode item↔event pairing.
- `whenListReady()` — Finsweet List instance resolution (List View: required; Feed View: optional).
- `createOccurrenceCard()` — clone + populate + `watchAndUnhide` for every occurrence card.
- Both render Webflow-authored **cards** — native CMS field bindings for everything except the `date` element, which is the only JS-touched field.
- `duplicate-recurring` option, same meaning in both.
- `item-count` option (`readItemCount()`) and the `load-more-wrap`/`load-more` element pair (`resolveLoadMore()`) — same names, same "reveal N more, hide the button/wrap once nothing's left" meaning in both, though the two views implement the actual slicing differently (see below): List View's default is unset/unlimited (opt-in), Feed View's default is `12` (always paginated).

### Unique to List View

- The only view with a **steppable, bounded window** — prev/next/today, `range="month"|"week"`, and `hide-past-events`.
- The only view that touches Finsweet's actual render pipeline (`addHook('filter', ...)`).
- Re-renders by calling `listInstance.triggerHook('filter')` — Finsweet does the DOM diffing.
- When `item-count` is set: the whole active range's occurrences are already knowable in one shot (bounded by `getRangeBounds`), so the filter hook just sorts them all chronologically and slices — first N (`renderedCount`, tracked in a closure variable) get materialized into real elements/clones, the rest are never created at all (no hidden-then-revealed DOM state to manage, and nothing for `watchAndUnhide` to fight — see the Feed View note below). `renderedCount` resets to `item-count` on every `refresh()` (nav change) and grows by `item-count` on each Load More click, both via the same `triggerHook('filter')` re-render path.

### Unique to Feed View

- No steppable window at all — always "today forward," growing via Load More. No `range`/`week-start`/`hide-past-events`.
- Does not use Finsweet's filter/render pipeline — pure append-only custom logic (`loadMore()`).
- Its own expanding-window search (`mergeOccurrences` + a period-stepping loop with a safety cap of 36 steps) to find enough occurrences to fill a batch.
- Its own month-divider insertion (`createDivider`) — no equivalent concept in List View.
- Options unique to it: `feed-period`, `feed-divider`, `feed-divider-today` (`item-count` is shared — see above).
- Since it bypasses Finsweet's render pipeline, its Load More can't rely on "just don't create what shouldn't show" the way List View's filter-hook slicing does — every clone it ever creates is appended straight into the DOM and stays, which is exactly why `watchAndUnhide()` matters here: nothing in Feed View's own logic ever hides a clone after the fact.

### Unique to Calendar

- Renders **pills** into a 2D day-cell grid, not cards in a linear list — needs a collision-avoidance concept (segment → lane) that a linear list never does.
- Its own fully custom rendering pipeline: `splitIntoSegments` (clip to visible days, split at row boundaries) → `assignLanes` (greedy overlap-packing, sorted by start index then span length) → `createPill` (one clone *per day-cell* a segment touches, not one spanning element).
- The only view with an **empty-state render**: the grid's structural chrome (day numbers, today highlight) is pure date math independent of event data, so it renders correctly before data even arrives — List/Feed have no equivalent, since their entire visible output *is* the data.
- The only view with a **demo-data fallback** (3 hardcoded events) when no data-wrap is found at all.
- The only view with a **hover-card subsystem** — the one place in the whole library still using `position: absolute` instead of normal document flow, with its own reveal/dismiss animation timing logic.
- Options unique to it: `day-pill-limit`, `overflow-items`, `link-format`, `show-outside-month`, `hide-inactive-row`, plus its own nav-bounds check (`data-ix-events-months`, min/max `Date` clamping) — List View has no equivalent bounds option; you can navigate it indefinitely in either direction.
- Never uses `duplicate-recurring` — a date grid has no equivalent of "show one card regardless of occurrence count"; every occurrence in view always gets its own pill.
