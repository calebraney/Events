# Events

A reusable Webflow events system built by Caleb Raney: recurring-event CMS logic, a List View (month or week), a Feed View (linear, upcoming-only), and a Calendar — all driven by `data-ix-*` attributes and one shared recurrence engine, no framework required.

- **`recurrence.js`** — computes occurrence dates for an event (including recurring patterns) for any date range. No DOM. Used by every view below so recurrence is only ever calculated one way.
- **`event-data.js`** — finds the one page-wide event data source and parses it, shared by every view so they can never read two different data sets.
- **`event-list.js`** — List View (`data-ix-events-layout="list"`) and Feed View (`data-ix-events-layout="feed"`). Both expand/filter a native Webflow Collection List in place; List View shows a fixed month/week window with prev/next stepping, Feed View is a linear, always-upcoming list that grows via a "Load More" button.
- **`calendar.js`** — a month-grid Calendar rendered entirely in JS (`data-ix-events-layout="calendar"`).

Any combination of these views can live on the same page and will read the same event data automatically.

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
| Recurring Frequency                                             | Option              | `None`, `Daily`, `Weekly`, `Monthly (same date)`, `Monthly (same day of the week)`, `Yearly`. Unset/empty is treated as `None`.                                                                                                                                                                                                                                                                                                       |
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

Place this **once**, anywhere on the page — it's the single source every view on the same page will read:

```
[data-ix-events="data-wrap"]     the Collection List
  [data-ix-events="item"]          one per CMS item
    [data-ix-events="data"]          the <script type="application/json"> above
```

This can be the same Collection List that also displays the List View's cards (see Combined mode below), or a separate, invisible one used purely as a data source (recommended).

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

**Combined vs. Separate mode** (auto-detected per item — the two can even be mixed on the same page):

- **Combined** — the same Collection List holds both the JSON data and the visible card. Each item carries both `[data-ix-events="data"]` and `[data-ix-events="card"]`.
- **Separate** — the cards are their own Collection List (bound to the same `events` collection), nested wherever you want in the wrap. Each item skips the JSON and instead carries `data-ix-events-slug="{{wf:Slug}}"`, matched against the page's shared `[data-ix-events="data-wrap"]` (§1) by slug.

### Option attributes (all on the `wrap` element)

| Attribute                            | Values               | Default  | Purpose                                                                                                                                                                                                    |
| ------------------------------------ | -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-ix-events-duplicate-recurring` | `true` \| `false`    | `true`   | `true` clones the card once per occurrence date in the active range. `false` shows the original card once regardless of occurrence count (still only shown if at least one occurrence falls in the range). |
| `data-ix-events-range`               | `month` \| `week`    | `month`  | The size of window prev/next/today step through, and what `getOccurrences()` is queried against. Invalid/unset values normalize to `month`.                                                                |
| `data-ix-events-week-start`          | `sunday` \| `monday` | `sunday` | Only consulted when `range="week"` — which day a week starts on.                                                                                                                                           |
| `data-ix-events-hide-past-events`    | `true` \| `false`    | `false`  | `true` excludes occurrences that have already ended from what's shown. For a recurring event this is per-occurrence — only its past occurrences are hidden, future ones in the same active range still show. With `duplicate-recurring="false"`, the single card still shows as long as at least one occurrence in the active range hasn't ended yet. Also disables the `prev` and `today` buttons (see Element attributes above) once there's nowhere non-past left to navigate to. |

All `true`/`false` values above are case-insensitive (`"True"`, `"FALSE"`, etc. all work).

### Format attributes

| Attribute                     | Applied to                             | Values                                       | Default                   |
| ----------------------------- | -------------------------------------- | -------------------------------------------- | ------------------------- |
| `data-ix-events-date-format`  | the `[data-ix-events="date"]` element  | a format token string (below), or `FULLDATE` | `MMMM D, YYYY`            |
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
| `data-ix-events="load-more"`            | A button, anywhere inside wrap    | No                   | Reveals the next batch of upcoming occurrences.                                                                                                                                                  |
| `data-ix-events="item"` / `"card"` / `"data"`, `data-ix-events-slug` | Collection List item + children | Yes (same as List View) | Same Combined/Separate mode contract as List View — see above.                                                                                                                    |
| `data-ix-events="date"`                 | Any text element inside the card  | No (needed to display dates) | Same as List View, including `FULLDATE` — see [Format attributes](#format-attributes) above.                                                                                          |
| `data-ix-events="feed-divider"`         | A standalone element, sibling of the card Collection List (not inside it) | No | Divider template. Give it Lumos's `u-hide` class in the Designer so it's invisible in its authored position — each inserted copy has that class removed (an inline style override can't reliably win against a typically-`!important` hide class). One is inserted automatically before the very first card in the feed, and again at every month boundary after that. If the card container is a CSS grid (multi-column feed), each divider automatically gets `grid-column: 1 / -1` so it spans every column as a full-width row — no CSS setup needed on your end, and a no-op for single-column/flex feeds. |
| `data-ix-events="feed-divider-text"`    | Child of the divider above         | Yes, if using dividers | JS updates this element's text per divider instance.                                                                                                                                    |

### Option attributes (all on the `wrap` element)

| Attribute                          | Values            | Default | Purpose                                                                                                                                                                                                          |
| ----------------------------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-ix-events-duplicate-recurring` | `true` \| `false` | `true`  | Same meaning as List View — `false` caps each event to its single next upcoming occurrence.                                                                                                                     |
| `data-ix-events-feed-count`          | number             | `12`    | How many occurrence-cards to reveal on init and per `Load More` click.                                                                                                                                          |
| `data-ix-events-feed-period`         | `month` \| `week`  | `month` | The granularity `Load More`'s internal search expands by when looking for enough occurrences to fill a batch. Doesn't change what's shown — only how the search is chunked internally.                        |
| `data-ix-events-feed-divider`        | `true` \| `false`  | `true`  | Enables inserting month-divider elements, including the very first one (marking the current month, before the first card). Requires a `[data-ix-events="feed-divider"]` element in the wrap.                  |
| `data-ix-events-feed-divider-today`  | `true` \| `false`  | `false` | Only meaningful when `feed-divider` is `true`. Overrides the text of that very first divider to the literal word "Today" instead of the current month's formatted label. No effect if `feed-divider` is `false`. |

### Divider text format

`data-ix-events-date-format` on the `[data-ix-events="feed-divider-text"]` element — same token vocabulary as the card's date-format (see [Format tokens](#format-tokens) above), but no `FULLDATE` support (a divider isn't tied to a specific occurrence's show-flags). Default `"MMMM, YYYY"` → `"July, 2026"`.

### Load More behavior

Each click reveals the next `feed-count` occurrences, searched chronologically forward from today across every event (recurring events contribute one card per upcoming occurrence, same as List View with `duplicate-recurring="true"`). The button hides/disables itself once there are no more upcoming occurrences to reveal — including on a feed with genuinely nothing left, or after searching up to 3 years forward (month period) / ~8 months forward (week period) without finding a full batch, whichever search granularity is configured.

---

## 4. Calendar (`calendar.js`)

`data-ix-events-layout="calendar"` — a month-grid calendar rendered entirely in JS inside the wrap element (no Collection List needed on the page for this one; it renders its own DOM from the shared data source in §1).

| Attribute                                                    | Applied to  | Values | Default | Purpose                                                                                 |
| ------------------------------------------------------------ | ----------- | ------ | ------- | --------------------------------------------------------------------------------------- |
| `data-ix-events="wrap"` + `data-ix-events-layout="calendar"` | Mount point | —      | —       | Everything is rendered inside this element.                                             |
| `data-ix-events-months`                                      | wrap        | number | `6`     | How many months back/forward navigation is allowed, relative to the current real month. |

If no `[data-ix-events="data-wrap"]` is found on the page, the calendar falls back to sample demo events (with a small on-page note) rather than rendering empty — useful for previewing the component before CMS content exists.

---

## Notes

- No run gates (`-site-run` / `-page-run` / `-run`) and no breakpoint disabling — every view is functional, not decorative, so it always runs if its elements/attributes are present.
- Any combination of List View, Feed View, and Calendar can coexist on the same page (e.g. a layout toggle) and will read the same `[data-ix-events="data-wrap"]` source — no risk of them drifting apart.
