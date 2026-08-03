# Events

A reusable Webflow events system built by Caleb Raney: recurring-event CMS logic, a List View (month or week), a Feed View (linear, upcoming-only), and a Calendar — all driven by `data-ix-*` attributes and one shared recurrence engine, no framework required.

- **`recurrence.js`** — computes occurrence dates for an event (including recurring patterns) for any date range. No DOM. Used by every view below so recurrence is only ever calculated one way.
- **`event-data.js`** — finds the one page-wide event data source and parses it, shared by every view so they can never read two different data sets.
- **`date-utils.js`** — shared date math and formatting (range stepping, token-based date formatting, `FULLDATE`). No DOM. Used by `event-list.js` and `calendar.js` so date formatting only ever works one way.
- **`event-list.js`** — List View (`data-ix-events-layout="list"`) and Feed View (`data-ix-events-layout="feed"`). Both expand/filter a native Webflow Collection List in place; List View shows a fixed month/week window with prev/next stepping, Feed View is a linear, always-upcoming list that grows via a "Load More" button.
- **`calendar.js`** — a month/week-grid Calendar (`data-ix-events-layout="calendar"`), built entirely from Webflow-authored elements — the Designer builds every visual piece (grid, day cells, pills, hover card), and the script only supplies dates/data and positions the pill layer.

Any combination of these views can live on the same page and will read the same event data automatically — see [Shared data source markup](#shared-data-source-markup) (§1) for exactly how each instance resolves which data source that is.

---

## Setup

```bash
npm install
npm run dev     # esbuild watch + local server at http://localhost:3000/index.js
npm run build   # production build to dist/index.js (minified)
```

Host the built `dist/index.js` (e.g. via jsDelivr pointing at this repo, or self-hosted) and add it to the Webflow site, once:

```html
<script src="[hosted dist/index.js URL]"></script>
```

List View also requires Finsweet Attributes' List module, once per site — see [List View → Requirements](#requirements) below. Feed View only needs it if you're also using `fs-list-load="all"` (see [More than ~100 events](#more-than-100-events) under List View).

---

## 1. CMS Collection Setup

Every view reads the same `events` CMS collection through one hidden JSON payload per item — no visible-text scraping, so display formatting in the Designer never has to match what the script parses.

### Fields

| Field                                                           | Type                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name / Slug                                                     | built-in            |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Start Date/Time                                                 | Date/Time           | Required. Includes time-of-day.                                                                                                                                                                                                                                                                                                                                                                                                       |
| End Date/Time                                                   | Date/Time           | This occurrence's own end. For a non-recurring event: its plain end date/time. For a recurring event: only its **time-of-day** and **day offset from Start Date** are reused (see Recurring Days note below) — reapplied to every generated occurrence, so a recurring multi-day event (e.g. "the first Saturday–Sunday of every month") still spans the right number of days each time. Leave unset for a same-day, same-time event. |
| **Recurring End Date**                                          | Date only           | The recurring series cutoff — the last day an occurrence can start on. Independent of End Date/Time. Leave empty for an indefinitely recurring event; if set at all (even to Start Date's own day), the series stops there.                                                                                                                                                                                                           |
| Show Start Time / Show End Time / Show End Date                 | Switch              | Drive the `FULLDATE` composite format (see below) — not read anywhere else.                                                                                                                                                                                                                                                                                                                                                           |
| Recurring Frequency                                             | Option              | `Daily`, `Weekly`, `Monthly (same date)`, `Monthly (same day of the week)`, `Yearly`. Not required — leave it unset for a non-recurring event (this also makes it easy to filter on natively in Webflow: "is set" instead of "is set or equals None").                                                                                                                                                                            |
| Recurring Interval                                              | Number, default `1` | "Every N [frequency units]" — e.g. Weekly + interval `2` = biweekly. Unset or `-1` is treated as `1`.                                                                                                                                                                                                                                                                                                                                 |
| Recurring Days                                                  | Plain text          | CSV of weekday abbreviations, e.g. `Tue,Thu`. Only read when Frequency = Weekly; empty = use Start Date's own weekday. When set, each listed weekday becomes its own single-day occurrence and End Date/Time's day-offset is ignored (its time-of-day still applies).                                                                                                                                                                 |
| Recurring Skip Dates                                            | Plain text          | CSV of `YYYY-MM-DD` dates to exclude from the series.                                                                                                                                                                                                                                                                                                                                                                                 |
| Event Type, Short Description, Location Name, Address, Timezone | any                 | Passed through as plain data, not used by the recurrence engine.                                                                                                                                                                                                                                                                                                                                                                      |

### Hidden JSON embed

Add a Rich Text or Code Embed field inside the collection item template (or bind it directly if using Dynamo bindings) rendering:

```html
<script type="application/json">
  {
    "name": "{{wf:Name|Dynamo}}",
    "slug": "{{wf:Slug|Dynamo}}",
    "startDateTime": "{{wf:Start Date/Time|Dynamo}}",
    "endDateTime": "{{wf:End Date/Time|Dynamo}}",
    "recurringEndDate": "{{wf:Recurring End Date|Dynamo}}",
    "showStartTime": "{{wf:Show Start Time|Dynamo}}",
    "showEndTime": "{{wf:Show End Time|Dynamo}}",
    "showEndDate": "{{wf:Show End Date|Dynamo}}",
    "eventType": "{{wf:Event Type/Name|Dynamo}}",
    "shortDescription": "{{wf:Short Description|Dynamo}}",
    "location": "{{wf:Location Name|Dynamo}}",
    "address": "{{wf:Address|Dynamo}}",
    "timezone": "{{wf:Timezone|Dynamo}}",
    "recurringFrequency": "{{wf:Recurring Frequency|Dynamo}}",
    "recurringInterval": "{{wf:Recurring Interval|Dynamo}}",
    "recurringDays": "{{wf:Recurring Days|Dynamo}}",
    "recurringSkipDates": "{{wf:Recurring Skip Dates|Dynamo}}"
  }
</script>
```

Dynamo renders `Start Date/Time`/`End Date/Time` as `"YYYY-MM-DD h:mm a"` and `Recurring End Date` as `"MMMM D, YYYY"` — both are parsed accordingly; don't add custom Dynamo formatting to those three fields.

### Shared data source markup

```
[data-ix-events="data-wrap"]     the Collection List
  [data-ix-events="item"]          one per CMS item
    [data-ix-events="data"]          the <script type="application/json"> above
```

This can be the same Collection List that also displays a view's cards (see Combined mode below), or a separate, invisible one used purely as a data source (recommended).

**Where to put it**: each `[data-ix-events="wrap"]` resolves its own data source independently — no attribute to set for the common case:

1. A `data-wrap` nested **inside** that specific wrap — a local override, used if present, no matter what else exists on the page.
2. Otherwise, the first `data-wrap` anywhere on the page that isn't nested inside *any* wrap (a genuinely page-level one) — a shared fallback every wrap without its own local source uses.
3. Neither found — a console warning, and that instance gets no events.

In practice: for a typical page, place **one** `data-wrap` outside every wrap and every view reads it — that's the whole "shared data source" setup, no per-instance configuration needed. If one specific instance needs its own, smaller or differently-filtered set of events (e.g. a widget that should only ever show a pre-filtered subset), just nest a `data-wrap` inside *that instance's own wrap* — it'll use its own local one and ignore the page-level source entirely, with no attribute anywhere signaling the override; it's purely a matter of where you put it in the Designer's layer tree.

---

## 2. List View (`event-list.js`)

`data-ix-events-layout="list"` — expands a native Webflow Collection List in place: one card per event, or one card per _occurrence_ for recurring events (e.g. a weekly event shows once per week within the active month/week).

### Requirements

DOM rendering is delegated to [Finsweet Attributes' List module](https://finsweet.com/attributes/list-filter) (programmatic API, not its declarative filter UI). Add once per site:

```html
<script
  async
  type="module"
  src="https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js"
  fs-list
></script>
```

And add `fs-list-element="list"` to the Collection List wrapper that holds the cards (same element in Combined mode, or the separate card list in Separate mode — see below).

#### More than ~100 events

Webflow only renders a Collection List's first ~100 items natively. To go beyond that, add `fs-list-load="all"` (alongside the already-required `fs-list-element="list"`) to whichever list(s) actually hold the overflow — the card list, the shared `data-wrap` (§1), or both, depending on which mode you're using and where the item count is coming from. Both `event-list.js` and `event-data.js` (and therefore `calendar.js`, which reads through it) wait for Finsweet to finish loading every paginated page before scanning for items, so nothing past the first page gets silently missed. Sites under 100 events can leave this off entirely — nothing changes for them.

### Element attributes

| Attribute                                                | Applied to                                          | Required                     | Purpose                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `data-ix-events="wrap"` + `data-ix-events-layout="list"` | Component root                                      | Yes                          | Marks this element as a List View instance. Every option below is read from this element.     |
| `data-ix-events="prev"`                                  | A button, anywhere inside wrap                      | No                           | Steps back one month/week. Gets class `is-disabled` (and does nothing when clicked) when `hide-past-events="true"` and stepping back would land entirely before today. |
| `data-ix-events="next"`                                  | A button, anywhere inside wrap                      | No                           | Steps forward one month/week.                                                                 |
| `data-ix-events="today"`                                 | A button, anywhere inside wrap                      | No                           | Jumps back to the month/week containing today's real date. Gets class `is-disabled` (and does nothing when clicked) when the active range already contains today. |
| `data-ix-events="label"`                                 | A text element, anywhere inside wrap                | No                           | JS sets its text to the active month/week (see format options below).                         |
| `data-ix-events="item"`                                  | Collection List item                                | Yes                          | One per repeating item.                                                                       |
| `data-ix-events="card"`                                  | Element inside each item                            | Yes                          | The visible card content — this is what gets cloned for additional occurrences.               |
| `data-ix-events="data"`                                  | `<script type="application/json">` inside each item | Combined mode only           | The item's own event JSON (see §1).                                                           |
| `data-ix-events-slug="{{wf:Slug}}"`                      | Item, Separate mode                                 | Separate mode only           | Binds this card to its event data by slug — see below.                                        |
| `data-ix-events="date"`                                  | Any text element inside the card                    | No (needed to display dates) | JS replaces its text content with the occurrence's formatted date — see format options below. |
| `data-ix-events="load-more-wrap"`                        | Wrapper, anywhere inside wrap                        | No, only used when `item-count` is set | Optional ancestor of `load-more` (see below) — if present, this whole wrapper is what's shown/hidden. |
| `data-ix-events="load-more"`                             | A button, inside `load-more-wrap` if present, otherwise anywhere inside wrap | No, only used when `item-count` is set | Reveals the next batch of occurrences within the active range — see `data-ix-events-item-count` below. |

**Combined vs. Separate mode** (auto-detected per item — the two can even be mixed on the same page):

- **Combined** — the same Collection List holds both the JSON data and the visible card. Each item carries both `[data-ix-events="data"]` and `[data-ix-events="card"]`.
- **Separate** — the cards are their own Collection List (bound to the same `events` collection), nested wherever you want in the wrap. Each item skips the JSON and instead carries `data-ix-events-slug="{{wf:Slug}}"`, matched against this wrap's resolved `[data-ix-events="data-wrap"]` (§1) by slug.

### Option attributes (all on the `wrap` element)

| Attribute                            | Values               | Default  | Purpose                                                                                                                                                                                                    |
| ------------------------------------ | -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-ix-events-duplicate-recurring` | `true` \| `false`    | `true`   | `true` clones the card once per occurrence date in the active range. `false` shows the original card once regardless of occurrence count (still only shown if at least one occurrence falls in the range). |
| `data-ix-events-range`               | `month` \| `week`    | `month`  | The size of window prev/next/today step through, and what `getOccurrences()` is queried against. Invalid/unset values normalize to `month`.                                                                |
| `data-ix-events-week-start`          | `sunday` \| `monday` | `sunday` | Only consulted when `range="week"` — which day a week starts on.                                                                                                                                           |
| `data-ix-events-hide-past-events`    | `true` \| `false`    | `false`  | `true` excludes occurrences that have already ended from what's shown. For a recurring event this is per-occurrence — only its past occurrences are hidden, future ones in the same active range still show. With `duplicate-recurring="false"`, the single card still shows as long as at least one occurrence in the active range hasn't ended yet. Also disables the `prev` and `today` buttons (see Element attributes above) once there's nowhere non-past left to navigate to. |
| `data-ix-events-item-count`          | number               | unset    | Unset (default) — no limit, every occurrence in the active range shows at once, same as before this option existed. Set it (e.g. `9`) to instead reveal only the first N occurrence-cards — chronologically, across every event in the active range, not per event — with a `load-more` button revealing N more per click. The button (or its `load-more-wrap`, if present) is only shown while more remain in the active range. The revealed count resets back to N every time the range changes (prev/next/today). Shares its name and meaning with Feed View's option of the same name. |

All `true`/`false` values above are case-insensitive (`"True"`, `"FALSE"`, etc. all work).

### Format attributes

| Attribute                     | Applied to                             | Values                                       | Default                   |
| ----------------------------- | -------------------------------------- | -------------------------------------------- | ------------------------- |
| `data-ix-events-date-format`  | the `[data-ix-events="date"]` element  | a format token string (below), or `FULLDATE`, `TIME`, `TIME-SHORT` | `MMMM D, YYYY`            |
| `data-ix-events-label-format` | the `[data-ix-events="label"]` element | a format token string (below)                | smart default — see below |

**`data-ix-events-date-format`** always formats the occurrence's own **start** date/time — for a recurring event, that's the specific date of _that_ occurrence, never the CMS item's original Start Date.

**`data-ix-events-label-format`** formats the active range's anchor date (the 1st of the month, or the first day of the active week). With no override:

- `range="month"` → `"MMMM YYYY"`, e.g. `August 2026`.
- `range="week"` → a smart default that always spells out the month on both ends, and adds the start year too when the week crosses a year boundary, so it stays unambiguous: `"Aug 3 - Aug 9, 2026"`, `"Dec 29, 2025 - Jan 4, 2026"`.

With an override on `range="week"`, the same format string is applied to both the week's start and end dates and joined with `" - "` (e.g. `"MMM D"` → `"Aug 3 - Aug 9"`).

#### Format tokens

Same vocabulary as Webflow's own Date field formatting UI. Examples below use **Tuesday, August 4, 2026, 6:05 PM**:

| Token  | Meaning                   | Example   |
| ------ | ------------------------- | --------- |
| `YYYY` | 4-digit year              | `2026`    |
| `YY`   | 2-digit year              | `26`      |
| `MMMM` | Full month name           | `August`  |
| `MMM`  | Short month name          | `Aug`     |
| `MM`   | 2-digit month             | `08`      |
| `M`    | Month, no padding         | `8`       |
| `DD`   | 2-digit day               | `04`      |
| `Do`   | Day with ordinal suffix   | `4th`     |
| `D`    | Day, no padding           | `4`       |
| `dddd` | Full weekday name         | `Tuesday` |
| `ddd`  | Short weekday name        | `Tue`     |
| `mm`   | 2-digit minutes           | `05`      |
| `H`    | Hour, 24-hour, no padding | `18`      |
| `h`    | Hour, 12-hour, no padding | `6`       |
| `A`    | AM/PM, uppercase          | `PM`      |
| `a`    | am/pm, lowercase          | `pm`      |

Tokens combine freely, e.g. `"dddd, MMMM Do"` → `"Tuesday, August 4th"`, `"MM/DD/YYYY"` → `"08/04/2026"`. The `h`/`H`/`A`/`a`/`mm` time tokens are most useful on the per-card date element (which carries the occurrence's real start time) — a **label**'s anchor date has no meaningful time-of-day, so time tokens there would just render midnight.

#### `FULLDATE` (date element only)

Instead of a token string, `data-ix-events-date-format="FULLDATE"` composes a full human-readable string from the occurrence's own start/end plus the event's **Show Start Time** / **Show End Time** / **Show End Date** switches:

| Show Start Time | Show End Time | Show End Date | Example output           |
| --------------- | ------------- | ------------- | ------------------------ |
| off             | off           | off           | `June 14th`              |
| on              | off           | off           | `June 14th at 8pm`       |
| on              | on            | off           | `June 14th, 8-9pm`       |
| on              | on            | on            | `June 14-16th, 12pm-5pm` |

A shared meridiem is dropped from the start time when it wouldn't be ambiguous (e.g. `8-9pm` not `8pm-9pm`), but kept on 12 (noon/midnight) since "12" alone is ambiguous. `FULLDATE` isn't available on `data-ix-events-label-format` — it needs a specific occurrence's show-flags, which a label isn't tied to.

#### `TIME` / `TIME-SHORT` (date element only)

Like `FULLDATE`, but time-only — never a date. Most useful on a calendar pill, which already lives inside a specific day-cell (repeating the date there would be redundant), but works on any date element. Driven by the same **Show Start Time** / **Show End Time** switches:

| Show Start Time | Show End Time | `TIME` | `TIME-SHORT` |
| --- | --- | --- | --- |
| off | — | *(element hidden entirely)* | *(element hidden entirely)* |
| on | off | `6:00pm` | `6pm` |
| on | on (same meridiem) | `8:00-9:30pm` | `9-10:15pm` |
| on | on (crosses meridiem) | `8:00am-5:00pm` | `7:30am-11:20pm` |

`TIME` always keeps `:00`; `TIME-SHORT` drops it per side whenever that side lands exactly on the hour (independently — one side can be shortened while the other isn't, as in `9-10:15pm`). Both apply the same meridiem-collapsing rule as `FULLDATE`. Neither ever shows a range if the occurrence has no genuine duration (start equals end), even with both switches on.

Unlike every other format, **`Show Start Time` off doesn't just change the output — it hides the element entirely** (`display: none`), reset back to visible (`display: ''`) the moment it would show something again. This matters specifically for calendar pills, which are freshly cloned from the template on every render, but also applies to any reused, non-cloned date element (e.g. List View's `duplicate-recurring="false"` mode, which keeps the same original card across re-filters).

---

## 3. Feed View (`event-list.js`)

`data-ix-events-layout="feed"` — a linear, always-upcoming list starting from today: every card is an occurrence-clone (originals stay hidden as templates, since occurrences from different events interleave chronologically across the whole feed), revealed a batch at a time via a "Load More" button rather than a fixed month/week window.

There's no steppable range and no past-events toggle here — the range always starts at today by definition, so `data-ix-events-range`, `-week-start`, `-hide-past-events`, and the `prev`/`next`/`today`/`label` elements are List-View-only and don't apply to feed instances.

### Requirements

None beyond the shared data source (§1) and Combined/Separate card setup (same as List View — see above). Finsweet isn't required unless a feed's Collection List also uses `fs-list-load="all"` for [more than ~100 events](#more-than-100-events) — Feed View doesn't use Finsweet's filter/render pipeline at all (it only ever appends, never hides a previously-shown card), so it only needs Finsweet's `loadingPaginatedItems` signal, when applicable.

### Element attributes

| Attribute                              | Applied to                       | Required            | Purpose                                                                                                                                                                                          |
| --------------------------------------- | --------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-ix-events="wrap"` + `data-ix-events-layout="feed"` | Component root       | Yes                  | Marks this element as a Feed View instance. Every option below is read from this element.                                                                                                       |
| `data-ix-events="load-more-wrap"`       | Wrapper, anywhere inside wrap      | No                   | Optional ancestor of `load-more` — if present, this whole wrapper is what's shown/hidden instead of the button itself.                                                                          |
| `data-ix-events="load-more"`            | A button, inside `load-more-wrap` if present, otherwise anywhere inside wrap | No | Reveals the next batch of upcoming occurrences.                                                                                                                                                  |
| `data-ix-events="item"` / `"card"` / `"data"`, `data-ix-events-slug` | Collection List item + children | Yes (same as List View) | Same Combined/Separate mode contract as List View — see above.                                                                                                                    |
| `data-ix-events="date"`                 | Any text element inside the card  | No (needed to display dates) | Same as List View, including `FULLDATE` — see [Format attributes](#format-attributes) above.                                                                                          |
| `data-ix-events="feed-divider"`         | A standalone element, sibling of the card Collection List (not inside it) | No | Divider template. Give it Lumos's `u-hide` class in the Designer so it's invisible in its authored position — each inserted copy has that class removed (an inline style override can't reliably win against a typically-`!important` hide class). One is inserted automatically before the very first card in the feed, and again at every month boundary after that. If the card container is a CSS grid (multi-column feed), each divider automatically gets `grid-column: 1 / -1` so it spans every column as a full-width row — no CSS setup needed on your end, and a no-op for single-column/flex feeds. |
| `data-ix-events="feed-divider-text"`    | Child of the divider above         | Yes, if using dividers | JS updates this element's text per divider instance.                                                                                                                                    |

### Option attributes (all on the `wrap` element)

| Attribute                          | Values            | Default | Purpose                                                                                                                                                                                                          |
| ----------------------------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-ix-events-duplicate-recurring` | `true` \| `false` | `true`  | Same meaning as List View — `false` caps each event to its single next upcoming occurrence.                                                                                                                     |
| `data-ix-events-item-count`          | number             | `12`    | How many occurrence-cards to reveal on init and per `Load More` click. Shares its name and meaning with List View's option of the same name — unlike List View, Feed always has a limit (its range is unbounded going forward, so "show everything" isn't an option). **Renamed from `data-ix-events-feed-count`** — existing instances need updating. |
| `data-ix-events-feed-period`         | `month` \| `week`  | `month` | The granularity `Load More`'s internal search expands by when looking for enough occurrences to fill a batch. Doesn't change what's shown — only how the search is chunked internally.                        |
| `data-ix-events-feed-divider`        | `true` \| `false`  | `true`  | Enables inserting month-divider elements, including the very first one (marking the current month, before the first card). Requires a `[data-ix-events="feed-divider"]` element in the wrap.                  |
| `data-ix-events-feed-divider-today`  | `true` \| `false`  | `false` | Only meaningful when `feed-divider` is `true`. Overrides the text of that very first divider to the literal word "Today" instead of the current month's formatted label. No effect if `feed-divider` is `false`. |

### Divider text format

`data-ix-events-date-format` on the `[data-ix-events="feed-divider-text"]` element — same token vocabulary as the card's date-format (see [Format tokens](#format-tokens) above), but no `FULLDATE` support (a divider isn't tied to a specific occurrence's show-flags). Default `"MMMM, YYYY"` → `"July, 2026"`.

### Load More behavior

Each click reveals the next `item-count` occurrences, searched chronologically forward from today across every event (recurring events contribute one card per upcoming occurrence, same as List View with `duplicate-recurring="true"`). The button (or its `load-more-wrap`, if present) hides itself once there are no more upcoming occurrences to reveal — including on a feed with genuinely nothing left, or after searching up to 3 years forward (month period) / ~8 months forward (week period) without finding a full batch, whichever search granularity is configured.

---

## 4. Calendar (`calendar.js`)

`data-ix-events-layout="calendar"` — a month or week grid, built entirely from Webflow-authored elements. Unlike List View/Feed View, there's no Collection List of cards here: the day-grid, weekday header, pills, hover card, loading state, and demo-data note are all real elements you build once in the Designer, and the script only fills in dates/text and appends pill pieces — so the whole thing can be restyled per client without touching code. Pills render as normal-flow children inside each day-cell (no absolute positioning, no pixel measurement) — see [Rendering model](#rendering-model) below. Neither view needs a `<section>`/`u-section` wrapper or a `u-container` — page-level layout (section, container, theme class) is expected to come from whatever Webflow structure you drop the calendar into.

A working reference build lives at [`design/calendar-mockup.html`](design/calendar-mockup.html) in this repo, with three clearly-commented pieces in ONE file — paste the whole file into Webflow in a single operation (pasting the pieces separately caused Webflow to duplicate classes, since each piece used to carry its own copy of the same `<style>` rules; the file now has exactly one shared `<style>` block, inside the first piece, that all three reuse): a **styleguide** block (one example of every class/combo-class the component uses, for selecting and styling each state in the Designer — keep it live on your site somewhere, since Webflow purges combo-class CSS that isn't applied to any element, and most of these classes are only ever added by JS at runtime), a **month view** (clean, paste-in-and-use, `data-ix-events-range` left at its default), and a **week view** (`data-ix-events-range="week"`, its own simpler 7-day-cell structure since a week-only instance never needs the other 35). That file also defines a small set of CSS custom properties (see [Global design tokens](#global-design-tokens)) scoped to `.calendar_wrap`, so the calendar's spacing/sizing can be retuned per project by editing those few values in one place instead of hunting through every class that used to hard-code them.

### Element attributes

| Attribute | Applied to | Required | Purpose |
| --- | --- | --- | --- |
| `data-ix-events="wrap"` + `data-ix-events-layout="calendar"` | Component root | Yes | Marks this element as a Calendar instance. Every option below is read from this element. |
| `data-ix-events="prev"` / `"next"` | A button, anywhere inside wrap | No | Steps back/forward one month or week (per `range`). Gets class `is-disabled` at the `months` bound (see Option attributes). |
| `data-ix-events="today"` | A button, anywhere inside wrap | No | Jumps to the month/week containing today's real date. Gets class `is-disabled` when the active range already contains today. |
| `data-ix-events="label"` | A text element, anywhere inside wrap | No | JS sets its text to the active month/week — same format vocabulary as List View's label, see [Format tokens](#format-tokens). |
| `data-ix-events="weekday-label"` | 7 text elements, anywhere inside wrap | No | JS sets each element's text to a weekday abbreviation, ordered per `week-start`. Skip this attribute if you'd rather type static weekday text yourself. |
| `data-ix-events="grid"` | A container, anywhere inside wrap | Yes | Holds the day cells. A plain CSS Grid (`repeat(7, minmax(0,1fr))`) — row height is left to the browser's own row auto-sizing, so each week-row grows independently to fit its tallest cell with zero JS involvement. |
| `data-ix-events="day-cell"` | 42 elements, direct structure inside grid | Yes | A fixed 6×7 grid, always. **DOM order must be row-major** — the 1st element is week-row 0/column 0, the 7th is week-row 0/column 6, the 8th is week-row 1/column 0, and so on. Build one, then duplicate it 41 times in the Designer. |
| `data-ix-events="day-number"` | Child of each day-cell | No (needed to show the date) | JS sets its text to the day's date number and toggles class `is-today`. |
| `data-ix-events="day-pills"` | An empty child of each day-cell | Yes (if any events should render) | JS appends that day's pill/spacer pieces here as normal-flow children (see [Rendering model](#rendering-model)) — leave empty in the Designer. Its parent day-cell's height grows automatically with however many pieces land inside it; there's nothing to size by hand. |
| `data-ix-events="day-more"` | A `<button>`, child of each day-cell | No | "+N more" overflow text for that specific day — JS sets its text and toggles class `is-active` only when that day has more occurrences than `day-pill-limit` allows. A real button, not a div — it's the only thing that responds to a click, never the whole cell, so pills stay independently clickable. |
| `data-ix-events="calendar-pill"` | A hidden template element, anywhere inside wrap | Yes (if any events should render) | Cloned once per **day** a segment covers (see [Rendering model](#rendering-model) below — a 3-day event gets 3 clones, one per day-cell it touches). Root element is the pill's own link (`<a>`) — its `href` is set from `data-ix-events-link-format` (see Option attributes). May contain any of the bindable child elements below; only include the ones you actually want visible. |
| `data-ix-events="calendar-pill-spacer"` | A hidden template element, anywhere inside wrap | Recommended (if any events should render) | An empty placeholder JS clones into a day whose active lanes have a gap, so a later lane's pill stays vertically aligned with the same lane in neighboring day-cells — see [Rendering model](#rendering-model). Give it the same height as your pill (a fixed `--pill-height` is what the mockup uses for this). |
| `data-ix-events="loading"` | An element, anywhere inside wrap | No | Author it visible by default — JS toggles class `is-active` off once real or demo event data has resolved. |
| `data-ix-events="demo-note"` | An element, anywhere inside wrap | No | Author it hidden by default — JS toggles class `is-active` on only when no `[data-ix-events="data-wrap"]` was found and sample demo events are being shown instead. |
| `data-ix-events="hover-card"` | Anywhere inside wrap | No | One per CMS event, matched to the hovered pill's event by slug. No specific container/wrapper role is required — every `hover-card` in the wrap is found directly. Build its content however you want — native Webflow CMS bindings (images, rich text) work here since, unlike the pill, this isn't a JS-cloned template. Author it with the mockup's default CSS (`opacity: 0; visibility: hidden;` — **not** `display: none`, since a fade/slide transition can't animate a display toggle) — JS toggles `is-active` on hover (fading and sliding it in — see [Hover card reveal](#hover-card-reveal) below), fills in its `[data-ix-events="date"]` element(s) with the specific hovered occurrence's date (the one field that can't come from a static per-event binding, since a recurring event's card doesn't know in advance which occurrence is being hovered), and positions it left-aligned with the hovered pill, directly below it if the pill is in the top half of the viewport or above it if the pill is in the bottom half, clamped so it never runs past any edge of the calendar as a whole. This is the one element in the whole component that's still `position: absolute` (permanently, even while hidden, so its size can be measured before it's shown) — it floats freely next to whichever pill is hovered, which can't be expressed as normal document flow. Its DOM position never changes on hover — only its inline `left`/`top` and its classes do; the only time it ever moves in the DOM at all is once, at init, if it needs rescuing from a hidden holder (next paragraph). **Must not** live inside a permanently-hidden template holder (e.g. one carrying `u-display-none`) at page load — if it does, the script automatically relocates it out to a direct child of `wrap` the first time it runs, so this fixes itself without a Designer change, but it's cleaner to just not nest it there in the first place. |
| `data-ix-events-slug="{{wf:Slug}}"` | The hover-card itself, **or any of its ancestors** (up to and including the card) | Yes, somewhere in that chain | Binds the card to its event. If you're reusing a CMS Collection List (the same shape as List View's separate mode — one `data-ix-events-slug` per Collection Item, with the visible card as a child of that item), the slug can stay on the Collection Item wrapper; it doesn't need to be on the same element as `data-ix-events="hover-card"`. |

**Pill bindable child elements** — every plain-text field from the [hidden JSON embed](#hidden-json-embed), kebab-case; all optional, JS leaves an element alone if it isn't present, so you only need to include the ones you actually want visible. Booleans/numbers/CSV lists are all safe to bind directly — they're stringified (a CSV field like Recurring Days becomes `"Tue, Thu"`) before being dropped into `textContent`:

| Attribute | Source |
| --- | --- |
| `data-ix-events="name"` | Name |
| `data-ix-events="slug"` | Slug |
| `data-ix-events="event-type"` | Event Type |
| `data-ix-events="short-description"` | Short Description |
| `data-ix-events="location"` | Location Name |
| `data-ix-events="address"` | Address |
| `data-ix-events="timezone"` | Timezone |
| `data-ix-events="show-start-time"` | Show Start Time (`"true"`/`"false"`) |
| `data-ix-events="show-end-time"` | Show End Time (`"true"`/`"false"`) |
| `data-ix-events="show-end-date"` | Show End Date (`"true"`/`"false"`) |
| `data-ix-events="recurring-frequency"` | Recurring Frequency (e.g. `"Weekly"`, or blank for a non-recurring event) |
| `data-ix-events="recurring-interval"` | Recurring Interval |
| `data-ix-events="recurring-days"` | Recurring Days, comma-joined (e.g. `"Tue, Thu"`) |
| `data-ix-events="recurring-skip-dates"` | Recurring Skip Dates, comma-joined |
| `data-ix-events="date"` | Time-only — see [`TIME` / `TIME-SHORT`](#time--time-short-date-element-only) above. |

Date/time fields themselves (Start Date/Time, End Date/Time, Recurring End Date) aren't in this list — they need real formatting, not raw display, and are already covered by the `date` element above.

The hover-card supports only `date` from this list (via a normal format string, same convention as List View/Feed View — see [Format attributes](#format-attributes)) — its other content (name, images, location, etc.) is expected to come from native Webflow CMS bindings, since unlike the pill it isn't a JS-cloned template.

### Option attributes (all on the `wrap` element)

| Attribute | Values | Default | Purpose |
| --- | --- | --- | --- |
| `data-ix-events-months` | number | `6` | How many months back/forward navigation is allowed, relative to the current real month — applies in both range modes. |
| `data-ix-events-range` | `month` \| `week` | `month` | Same meaning as List View's range option. Week mode reuses the same 42 `day-cell` elements, using and showing only the first 7 — see [Week mode](#week-mode) below. |
| `data-ix-events-week-start` | `sunday` \| `monday` | `sunday` | Which day a week starts on — affects `weekday-label` ordering and, in month mode, which column the 1st of the month lands in. |
| `data-ix-events-label-format` | a format token string | smart default | Same convention as List View's label format — see [Format attributes](#format-attributes). |
| `data-ix-events-day-pill-limit` | number | `3` | Max visible occurrence lanes per day before folding into that day's "+N more" (see `overflow-items` below). No need to hand-size cell height for this — day-cells grow automatically to fit however many lanes actually render (see [Rendering model](#rendering-model)). |
| `data-ix-events-link-format` | a string containing `{slug}` | `/event/{slug}` | The pill's `href` template — `{slug}` is replaced with the event's slug. |
| `data-ix-events-overflow-items` | `expand` \| `hide` \| `show` | `expand` | What happens to lanes beyond `day-pill-limit` — see [Overflow behavior](#overflow-behavior) below. |
| `data-ix-events-show-outside-month` | `true` \| `false` | `false` | `range="month"` only. `false` — occurrences are never added to the leading/trailing days from adjacent months (a multi-day event is clipped to just its portion inside the active month). `true` — outside days get occurrences exactly like any other visible day. No effect on `range="week"`. |
| `data-ix-events-hide-inactive-row` | `true` \| `false` | `false` | `range="month"` only. `true` — the grid's 6th row (`day-cell`s 35-41) is hidden whenever every day in it belongs to the next month, i.e. the active month only needed 5 rows. Re-checked on every render, since which months need 5 vs. 6 rows changes as you navigate. No effect on `range="week"`. |

`data-ix-events-duplicate-recurring` doesn't apply to Calendar — a date grid has no equivalent of "show one card regardless of occurrence count," every occurrence in view always gets its own pill.

If no `[data-ix-events="data-wrap"]` is found on the page, the calendar falls back to 3 sample demo events (and shows `demo-note`) rather than rendering empty — useful for previewing the component before CMS content exists.

### Rendering model

Every occurrence — single- or multi-day — is clipped to the visible day cells, split into one segment per week-row it crosses (so a multi-day event that spans a week boundary becomes two capped spans, one per row), then lane-assigned within that row so overlapping events stack into separate lanes instead of colliding. That part of the pipeline is unchanged from a typical calendar UI. What's different here is how a segment becomes pixels: **there is no single "spanning bar" element and no `getBoundingClientRect` measurement anywhere.** Instead, every day-cell a segment crosses gets its own pill *piece*, appended as a normal-flow child of that day's `[data-ix-events="day-pills"]` — a 3-day event clones the pill template 3 times, once per day-cell. Each piece gets one of these classes, describing its position within its own event's span:

| Class | Meaning |
| --- | --- |
| `is-single` | A one-day occurrence — the whole span is this one piece. |
| `is-start` | The first day of a span that continues into the next day-cell (or the next row, if this is the last day-cell in its row). |
| `is-middle` | A day in the middle of a span, with more before and after it. |
| `is-end` | The last day of a span that continued from a previous day-cell (or a previous row). |

Only the `is-start`/`is-single` piece carries the pill's actual text content (name, date, etc.) — `is-middle`/`is-end` pieces are left empty, rendering as a plain colored continuation of the bar. Continuation edges bleed all the way to the cell's own border, ignoring `--cell-padding` on that side: `is-start` grows via `min-width: calc(100% + var(--cell-padding))` (its left edge is the occurrence's true start, so it only needs to extend rightward); `is-middle`/`is-end` also shift themselves left with a matching negative `margin-left`, since growing width alone only ever extends an element's right edge, not its left one. So adjacent pieces in neighboring day-cells touch exactly at the shared cell border and read as one continuous bar; a segment's true outer edges (the occurrence's real start/end) are the only ones that ever get rounded corners. This trades a single "true" spanning-bar element for a much simpler, bug-resistant layout — no pixel math, nothing that can go stale on resize, and no `ResizeObserver` needed anywhere, since nothing is ever positioned in pixels to begin with. A day-cell's own height grows automatically (normal flex/grid flow) to fit however many pieces land inside it.

Because pieces from the same segment live in separate day-cells, keeping a multi-day bar reading as one straight horizontal band relies on every pill/spacer sharing the same fixed height (`--pill-height`). If a day's active lanes have a gap — e.g. an event touches that day at lane 2 but not lane 1, because the lane-1 event doesn't span that particular day — JS clones `[data-ix-events="calendar-pill-spacer"]` into the gap so the lane-2 piece still lines up with lane-2 pieces in neighboring day-cells. A day with no gap in its lanes (or no events at all) never gets a spacer, so its cell stays exactly as tall as it needs to be.

Within a row, lanes are assigned purely by start day (a same-start tie goes to whichever segment spans more days), never by multi-day-ness on its own — a segment reuses the lowest lane whose previous occupant has already ended, regardless of which one is multi-day, so two events that don't actually overlap always end up sharing a lane rather than one being pushed into a higher lane (and needing a spacer above it) for no real reason. An earlier revision prioritized multi-day segments into the lowest lanes unconditionally, which could push a genuinely non-overlapping single-day event elsewhere in the row into an unnecessary spacer purely because a later, unrelated multi-day event existed somewhere in the same row — a real reported bug (visible as unexplained blank space above a pill, and a taller row than the actual content needed), not just a hypothetical edge case, so that priority was removed.

**"+N more" is a real `<button>`** (`[data-ix-events="day-more"]`), not a plain div — clicking it only ever triggers that day's expand behavior, never the whole cell, so every pill stays independently clickable/linkable to its own event page regardless of overflow state.

**Pill color** — JS adds a class based on the event's Event Type field: `is-type-{eventType}` (lowercased, non-alphanumeric characters replaced with `-`), e.g. `is-type-gala`. Define each type's actual look directly in the Designer — this is deliberately left unstyled by default so color-coding is meaningful and fully client-customizable, not a hard-coded palette. Falls back to a rotating `is-color-1`/`is-color-2`/`is-color-3` when Event Type is blank.

### Hover card reveal

The hover card's DOM position never changes — it's the same element in the same spot in the tree for the whole page's lifetime (the only exception is the one-time relocation described in the [Element attributes](#element-attributes) table above, if it needs rescuing from a hidden holder). Showing/hiding and moving it around is done entirely through inline `left`/`top` (in px, recalculated on every hover) plus classes — never `display`, since `display` can't be transitioned:

- **Position**: horizontally, left-aligned with the hovered pill's left edge, not centered — clamped so it never runs past the calendar's own left or right edge. Vertically, three rules apply in strict priority order: (1) distance from the pill is always exactly `--hover-card-gap` (default `1rem`) — the card must never touch or cover the pill it's describing, since an overlapping card (sitting on top, `pointer-events: auto`) would intercept the pointer and fire a premature `mouseleave` on the pill underneath it; (2) side — **below** the pill if it's in the top half of the browser viewport, **above** it if it's in the bottom half — always honored, never flipped based on available space; (3) staying within the calendar's own bounds — lowest priority, and deliberately *not* enforced: if honoring 1 and 2 means the card runs past the calendar's own top/bottom edge, that's accepted rather than clamped. Clamping used to sit above the gap rule, which is exactly what caused the overlap bug (clamping a too-tall card back down would push it across the gap and into the pill) — the current order fixes that by construction.
- **Reveal**: `is-active` toggles `opacity`/`visibility`/`pointer-events`/`transform` together, all driven by a CSS `transition` — a plain opacity fade would work, but JS also adds `is-above` or `is-below` (whichever direction the card was actually placed) so the entrance can slide `--hover-card-move` (default `0.75rem`) in that direction too: a card shown above its pill rises up into place, one shown below drops down into place. Feel free to add more to `is-above`/`is-below`'s `transform` beyond the slide — e.g. `scale(var(--hover-card-scale))` for a pop-in effect — it's a normal CSS transform, nothing about it is hardcoded to just translate. `is-above`/`is-below` are applied a frame before `is-active` (via `requestAnimationFrame`, after forcing a layout with `void card.offsetHeight`) — without that gap, the browser would collapse the "offset and hidden" starting state and the "resting and visible" end state into a single paint and skip the transition entirely, since both classes would otherwise land in the same synchronous batch. This only delays when the *reveal transition* starts, never the actual `left`/`top` positioning, which is always applied synchronously up front.
- **Why the card is always measured at its true size, no matter what `is-above`/`is-below` do**: `hideHoverCard()` only ever removes `is-active` — it deliberately leaves `is-above`/`is-below` in place, since they're what the *next* reveal transitions back out of. That's not fully safe to measure against on its own, though: `transform` is covered by this element's own `transition: transform ...`, so removing `is-above`/`is-below` doesn't make the *rendered* transform snap straight to `none` — it starts a brand-new transition from whatever scaled/translated value was left over (e.g. `scale(0.95)`), and `getBoundingClientRect()` reports whatever's actually rendered *mid-transition*, not the eventual target (transform changes, unlike layout changes, aren't forced to complete just by reading a layout property — that's the whole point of animating with transform). `showHoverCard()` clears `is-active`/`is-above`/`is-below`, then sets `card.style.transition = 'none'` and forces a reflow, *before* measuring `cardRect` — killing the transition guarantees the transform snaps to its cleared value instantly rather than animating toward it, so the measurement is always the card's true, fully-settled, untransformed size regardless of what it was still animating from. The inline `transition: none` is removed again immediately after measuring, so the reveal itself still animates normally.
- **Dismiss**: `hideHoverCard()` just removes `is-active` (leaving `is-above`/`is-below` alone) — the same CSS transition plays in reverse, so a card that rose up on the way in settles back down on the way out, and one that dropped down rises back up, while fading out. The one asymmetry is `visibility`: its own `transition-delay` is `0s` on `is-active` (so the card becomes paintable *immediately* when a hover starts) but `150ms` — the fade duration — on the base/hidden rule (so on the way out it stays visible for the entire fade instead of vanishing the instant `is-active` comes off, only actually flipping to `hidden` once the animation finishes).
- **At most one card, ever**: each instance tracks whichever card is currently shown; a new `mouseenter` force-hides the previous card first (even if its own `mouseleave` was somehow missed), and leaving the grid entirely (`mouseleave` on `[data-ix-events="grid"]` itself) hides whatever's active as a backstop. This exists as defense-in-depth against getting more than one card stuck visible at once — the main way that could happen (a card overlapping and covering its own pill, intercepting the pointer) is fixed by the position logic above, but this stays as cheap insurance regardless.

### Overflow behavior

`data-ix-events-overflow-items` controls what happens to lanes beyond `day-pill-limit` in a given week-row (lanes — and therefore what counts as "overflow" — are always row-scoped, not per-day, since one lane can span several days). In every mode, a day-cell's own height grows automatically (normal flow — see [Rendering model](#rendering-model)) to fit whatever's actually rendered inside it — you don't need to hand-tune cell height to exactly match `day-pill-limit`:

| Value | Behavior |
| --- | --- |
| `expand` (default) | Same "+N more" text as `hide`, but clickable. Up to `day-pill-limit` lanes render; overflowing days get a clickable `"+N more"` in `day-more`. Clicking any day's trigger reveals **that whole week-row's** hidden lanes (not just the clicked day, since lanes are row-scoped) — every day-cell in that row grows to fit them. Resets the next time the active month/week changes. |
| `hide` | Up to `day-pill-limit` lanes render. Anything beyond that folds into a static `"+N more"` in the overflowing day's `day-more` element — those extra lanes are never rendered at all (not even as spacers), so the day-cell never grows past what the limit needs. Not clickable. |
| `show` | `day-pill-limit` is bypassed entirely — every lane a row actually needs renders immediately. `day-more` never shows anything in this mode. |

### Outside-month events

`data-ix-events-show-outside-month` (month range only) controls whether the leading/trailing days from adjacent months — shown with class `is-outside` — ever get occurrences. Default `false`: those days stay empty, and a multi-day event that starts before the 1st (or ends after the last day) is clipped to just its in-month portion rather than being dropped or rendered off-grid. Set to `true` to have outside days behave exactly like any in-month day.

### Week mode

`data-ix-events-range="week"` doesn't strictly need 42 `day-cell` elements the way a month instance does — `calendar.js` only ever shows/populates `Math.min(cellCount, dayCells.length)` cells, so a week-only instance (one that will never be switched to `range="month"`) can simply be authored with 7 `day-cell` elements from the start, as the mockup's Part 3 does. If you'd rather share one component definition that supports both modes (e.g. toggled by a Designer setting), author the full 42 and let JS hide cells 8–42 via `style.display: none` when `range="week"` is active. Either way, JS adds class `is-range-week` to the grid **and** to each visible cell (not just the grid — Lumos's no-descendant-selector convention means a rule like `.calendar_grid.is-range-week .calendar_day_wrap { }` can't be used to cascade the state down, so the class needs to land directly on whichever elements should react to it). Style `.{your-day-cell-class}.is-range-week` for a taller/roomier week-mode cell if you want one.

### Global design tokens

`design/calendar-mockup.html` defines a handful of CSS custom properties scoped to `.calendar_wrap` (not `:root` — Lumos reserves `:root` for the site's own theme variables) so the calendar's spacing/sizing can be retuned in one place instead of across every class/combo-class that references it:

| Variable | Default | Controls |
| --- | --- | --- |
| `--cell-padding` | `var(--_spacing---space--3)` | Day-cell inner padding — also what pill continuation edges bleed past via `min-width` (see [Rendering model](#rendering-model)). |
| `--cell-min-height` | `6rem` | Floor for a day-cell's height — never a cap, since cells grow with their content. |
| `--cell-border-width-top` / `-right` / `-bottom` / `-left` | `var(--border-width--main)` (all four) | Each side's border width, independently customizable — e.g. a heavier top border per row, or `0` to remove a side's border entirely, without breaking the layout math (see below). |
| `--cell-border-color` | `var(--_theme---border--border-primary)` | Shared border color for the grid and every cell. |
| `--grid-radius` | `var(--border-radius--small)` | Outer corner radius of the whole grid (the grid clips to this via `overflow: clip`, so the outermost cells' square corners get visually rounded off automatically). |
| `--pill-height` | `1.75rem` | Fixed height every pill piece and spacer shares — this is what keeps a multi-day bar's lanes aligned across day-cells. |
| `--pill-gap` | `var(--_spacing---space--1)` | Vertical gap between stacked lanes inside a day-cell. |
| `--pill-radius` | `var(--border-radius--small)` | Corner radius on a segment's true outer edges. |
| `--hover-card-gap` | `1rem` | Space between a pill and its hover card — kept as its own token rather than reusing `--pill-gap`, since that one also controls the much tighter stacked-lane spacing inside a day-cell. Accepts `rem` or `px` (`calendar.js` converts it to a pixel value itself via `cssLengthToPx()` — a plain `parseFloat()` on the raw computed-style string would silently drop the unit and treat e.g. `3rem` as `3px`, making the token barely move anything regardless of its actual value). |
| `--hover-card-move` | `0.75rem` | Distance the hover card slides while fading in/out (see [Hover card reveal](#hover-card-reveal)) — `0` for a plain fade with no motion. |

**Border technique**: every day-cell carries its own full border on all four sides, then pulls itself over its neighbors by exactly its own border width via negative margins (and adds that same width back into its padding, so the content area doesn't shift) — the standard CSS border-collapse trick. Two adjacent cells' borders always render as a single line this way, regardless of what each side's width is set to (including asymmetric values, or `0` on a side you don't want a border on at all) — nothing about the layout math assumes any particular width.

Override any of these per-instance by setting the same custom property directly on a specific `[data-ix-events="wrap"]` element in the Designer — e.g. a denser calendar on one page, roomier on another — with no class edits needed.

---

## Notes

- No run gates (`-site-run` / `-page-run` / `-run`) and no breakpoint disabling — every view is functional, not decorative, so it always runs if its elements/attributes are present.
- Any combination of List View, Feed View, and Calendar can coexist on the same page (e.g. a layout toggle) and will, by default, read the same page-level `[data-ix-events="data-wrap"]` source — no risk of them drifting apart, unless one instance deliberately opts into its own local data-wrap (see §1).
