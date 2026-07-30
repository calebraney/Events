# Events

A reusable Webflow events system built by Caleb Raney: recurring-event CMS logic, a List View (month or week), and a Calendar — all driven by `data-ix-*` attributes and one shared recurrence engine, no framework required.

- **`recurrence.js`** — computes occurrence dates for an event (including recurring patterns) for any date range. No DOM. Used by both components below so recurrence is only ever calculated one way.
- **`event-data.js`** — finds the one page-wide event data source and parses it, shared by both components so they can never read two different data sets.
- **`event-list.js`** — a List View that expands/filters a native Webflow Collection List in place (`data-ix-events-layout="list"`).
- **`calendar.js`** — a month-grid Calendar rendered entirely in JS (`data-ix-events-layout="calendar"`).

A List View and a Calendar can both live on the same page and will read the same event data automatically.

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

The List View also requires Finsweet Attributes' List module, once per site — see [List View → Requirements](#requirements) below.

---

## 1. CMS Collection Setup

Both components read the same `events` CMS collection through one hidden JSON payload per item — no visible-text scraping, so display formatting in the Designer never has to match what the script parses.

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

Place this **once**, anywhere on the page — it's the single source both a List View and a Calendar on the same page will read:

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

### Element attributes

| Attribute                                                | Applied to                                          | Required                     | Purpose                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `data-ix-events="wrap"` + `data-ix-events-layout="list"` | Component root                                      | Yes                          | Marks this element as a List View instance. Every option below is read from this element.     |
| `data-ix-events="prev"`                                  | A button, anywhere inside wrap                      | No                           | Steps back one month/week.                                                                    |
| `data-ix-events="next"`                                  | A button, anywhere inside wrap                      | No                           | Steps forward one month/week.                                                                 |
| `data-ix-events="today"`                                 | A button, anywhere inside wrap                      | No                           | Jumps back to the month/week containing today's real date.                                    |
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

## 3. Calendar (`calendar.js`)

`data-ix-events-layout="calendar"` — a month-grid calendar rendered entirely in JS inside the wrap element (no Collection List needed on the page for this one; it renders its own DOM from the shared data source in §1).

| Attribute                                                    | Applied to  | Values | Default | Purpose                                                                                 |
| ------------------------------------------------------------ | ----------- | ------ | ------- | --------------------------------------------------------------------------------------- |
| `data-ix-events="wrap"` + `data-ix-events-layout="calendar"` | Mount point | —      | —       | Everything is rendered inside this element.                                             |
| `data-ix-events-months`                                      | wrap        | number | `6`     | How many months back/forward navigation is allowed, relative to the current real month. |

If no `[data-ix-events="data-wrap"]` is found on the page, the calendar falls back to sample demo events (with a small on-page note) rather than rendering empty — useful for previewing the component before CMS content exists.

---

## Notes

- No run gates (`-site-run` / `-page-run` / `-run`) and no breakpoint disabling — both components are functional, not decorative, so they always run if their elements/attributes are present.
- A List View and a Calendar can coexist on the same page (e.g. a layout toggle) and will read the same `[data-ix-events="data-wrap"]` source — no risk of the two drifting apart.
