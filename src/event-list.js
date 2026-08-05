import { attr, uniquifyIds, debugLog, setDisabledState, announceLiveRegion } from './utilities';
import { getOccurrences, parseEventFromJSON } from './recurrence';
import { whenEvents } from './event-data';
import {
  startOfDay,
  anchorFor,
  getRangeBounds,
  stepCurrent,
  expandingWindowSearch,
  SEARCH_CAP,
  formatOccurrenceDate,
  formatWeekLabel,
  setDateFields,
} from './date-utils';

// ============================================================================
// event-list: List View (month/week) and Feed View (linear, upcoming-only)
// (data-ix-events-layout="list" | "feed")
// ============================================================================
//
// Both views share the same data-ix-events-* attribute prefix as calendar.js
// — all three read event data through event-data.js's whenEvents(wrap,
// callback), called once per wrap. Resolution per wrap: a
// [data-ix-events="data-wrap"] nested inside it wins if present; otherwise
// the first page-level one not claimed by (nested inside) any OTHER wrap.
// This means most pages can use ONE shared data-wrap with zero extra
// config, while any individual instance can still opt into its own scoped
// data (e.g. a smaller, pre-filtered Collection List) purely by nesting a
// data-wrap inside its own wrap — no attribute needed either way.
//
// A wrap whose cards are ALL combined-mode (every card carries its own
// [data-ix-events="data"], see mode A below) never calls whenEvents() at
// all — needsSharedData() checks this upfront. This matters for performance:
// whenEvents() retries for up to MAX_ATTEMPTS * RETRY_DELAY (6s) before
// giving up if no data-wrap exists ANYWHERE on the page, which is a real,
// confirmed-live scenario for a small combined-mode showcase Feed/List
// dropped on a page that has no shared data-wrap Collection List at all
// (e.g. a homepage). Without the skip, that instance visibly took ~6
// seconds to render its first cards even though it never needed the shared
// lookup's result in the first place.
//
// List View delegates its DOM lifecycle (filtering, item creation, render) to
// Finsweet Attributes' List solution — https://finsweet.com/attributes/list-filter,
// API: https://github.com/finsweet/attributes/blob/master/packages/list/README.md
// — via its programmatic API, not its declarative checkbox/select filtering
// (which has no concept of expanding one CMS item into multiple occurrence
// dates, so it can't replace getOccurrences()). It only decides WHICH
// occurrences exist for the active range and hands the result to Finsweet's
// `List.addHook('filter', ...)`; Finsweet owns rendering it.
//
// Feed View does NOT use Finsweet's filter/render pipeline at all — it only
// ever appends (never hides/toggles a previously-shown card), so there's
// nothing for Finsweet to filter. It still optionally uses the Finsweet List
// instance's `loadingPaginatedItems` promise (see "More than ~100 events"
// below), the only thing it needs from Finsweet.
//
// Requires the Finsweet script (once, in the site's <head>), scoped to only
// load the `list` module — needed for List View always, and for Feed View
// only if a feed's Collection List uses fs-list-load="all":
//   <script async type="module" src="https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js" fs-list></script>
// List View also needs `fs-list-element="list"` on the same element that
// carries `data-ix-events="data-wrap"` (combined mode) or the separate card
// Collection List (separate mode) — see the mode notes below.
//
// More than ~100 events: Webflow only renders a Collection List's first ~100
// items natively. To go beyond that, also add `fs-list-load="all"` to
// whichever list(s) need it (the card list, the data-wrap, or both, depending
// on mode) — this module waits for Finsweet to finish loading every paginated
// page (via the List instance's `loadingPaginatedItems` promise) before
// scanning for items, so nothing past the first page gets silently dropped.
// A no-op for sites under 100 events that don't set fs-list-load.
//
// Cards can live in EITHER of two places, auto-detected per item (both views):
//
// A) Combined — the same Collection List that holds the JSON data also
//    holds the card (i.e. IS the resolved [data-ix-events="data-wrap"] —
//    local or page-level, see the resolution rule above):
//      [data-ix-events="list"]    the Collection List wrapper — optional but
//                                   recommended (see below)
//        [data-ix-events="item"]
//          [data-ix-events="data"]   <script type="application/json"> — raw event fields
//          [data-ix-events="card"]   the visible card
//
// B) Separate — the cards are their own Collection List, nested inside this
//    component's own wrap, bound to the same events collection. Each card
//    item is matched to its event by slug instead of carrying its own JSON:
//      [data-ix-events="list"]
//        [data-ix-events="item"]
//          data-ix-events-slug="{{wf:Slug}}"   bind directly to the Slug field
//          [data-ix-events="card"]   the visible card
//
// [data-ix-events="list"] marks the Collection List wrapper itself (the same
// element that carries fs-list-element="list" when Finsweet's involved) —
// optional for backward compatibility (Feed View falls back to inferring the
// container from the first item's own parent if it's absent), but
// recommended: it removes the "feed-divider must be a sibling of the items,
// not inside them" fragility, since Feed's cards/dividers insert relative to
// this explicit, Designer-marked element instead of a structurally-guessed
// one. List View doesn't strictly need it (Finsweet's own fs-list-element
// already pins that element down unambiguously), but it's fine to add for
// symmetry.
//
// ── List View ───────────────────────────────────────────────────────────
//
// Required structure per instance:
//   [data-ix-events="wrap"] [data-ix-events-layout="list"]   component root (options below live here)
//     [data-ix-events="prev"]          prev month/week button — gets class "is-disabled"
//                                        (and its click is a no-op) when hide-past-events
//                                        is on and stepping back would land entirely
//                                        before today
//     [data-ix-events="label"]         text element — JS sets the active month/week
//       data-ix-events-label-format="{format}"  optional override, same token
//                                        vocabulary as data-ix-events-date-format below.
//                                        Default: "MMMM YYYY" for range="month" (e.g.
//                                        "August 2026"); a smart "Aug 3 - Aug 9, 2026"
//                                        for range="week" (always shows both months and,
//                                        when the week crosses a year boundary, both
//                                        years, so it stays unambiguous). An override
//                                        format string is applied to both the start and
//                                        end of the week and joined with " - ".
//     [data-ix-events="next"]          next month/week button
//     [data-ix-events="today"]         optional — resets the active range to whichever
//                                        month/week contains today's real date. Gets
//                                        class "is-disabled" (and its click is a no-op)
//                                        when the active range already contains today.
//     ...the card Collection List (A or B above), also carrying fs-list-element="list"...
//       [data-ix-events="date"]          any element inside the card whose content
//                                        should become the occurrence's start date/time
//         data-ix-events-date-format="{format}"  a Moment-style format string, e.g.
//                                        "MMMM D, YYYY" or "h:mm A" — same token
//                                        vocabulary as Webflow's own Date field
//                                        formatting UI. Always formats the occurrence's
//                                        START date/time (the recurring date for a
//                                        recurring event) — never the end.
//                                        Special values "DATE-TIME" and "DATE" (instead
//                                        of a token string) compose a human-readable
//                                        string from the occurrence's own start/end plus
//                                        the event's Show Start Time / Show End Time /
//                                        Show End Date flags — "DATE-TIME" includes time,
//                                        e.g. "June 14th", "June 14th at 8pm", "June 14th,
//                                        8-9pm", "June 14-16th, 12pm-5pm"; "DATE" never
//                                        includes a time, only the (potentially multi-day)
//                                        date, e.g. "June 14th" or "June 14-16th".
//     [data-ix-events="load-more-wrap"]  optional — see data-ix-events-item-count below.
//       [data-ix-events="load-more"]       optional — button, reveals the next
//                                          batch of occurrences within the active range.
//
// Options (all read from the wrap element):
//   data-ix-events-duplicate-recurring="true" (default) | "false"
//     true  — clone the item once per occurrence date in the active range
//     false — show the item once regardless of occurrence count, no clones
//             (still only shown if at least one occurrence falls in the range)
//   data-ix-events-range="month" (default) | "week"
//     which size window prev/next/today step through and getOccurrences() is
//     queried against. Invalid/unset values normalize to "month".
//   data-ix-events-week-start="sunday" (default) | "monday"
//     only consulted when range="week" — which day a week starts on.
//   data-ix-events-hide-past-events="true" | "false" (default)
//     true — excludes occurrences that have already ended (occurrence.end < now)
//     from what's shown. For a recurring event this is per-occurrence: only its
//     past occurrences are hidden, future ones in the same active range still
//     show. With duplicate-recurring="false", the single card still shows as
//     long as at least one occurrence in the active range hasn't ended yet.
//   data-ix-events-item-count unset (default)
//     no limit — every occurrence in the active range shows at once, exactly
//     as before this option existed. Set it (e.g. "9") to instead reveal only
//     the first N occurrence-cards (chronologically, across every event in
//     the active range — not per event) with a [data-ix-events="load-more"]
//     button revealing N more per click. The button (or its optional
//     [data-ix-events="load-more-wrap"] ancestor, if present — the button is
//     then looked up INSIDE it) is only shown while more remain, and hidden
//     again once everything in the active range is visible. The revealed
//     count resets back to N every time the active range changes (prev/next/
//     today). Shares its name and meaning with Feed View's option below.
//
// ── Feed View ───────────────────────────────────────────────────────────
//
// A linear, always-upcoming (never past) list starting from today, growing
// as the visitor clicks "Load More". Unlike List View there's no steppable
// window and no past-events toggle — the range always starts at today, so
// nothing before today is ever queried in the first place. `prev`/`next`/
// `today`/`label` and `data-ix-events-range`/`-week-start`/`-hide-past-events`
// don't apply here; List View owns those.
//
// Required structure per instance:
//   [data-ix-events="wrap"] [data-ix-events-layout="feed"]   component root (options below live here)
//     [data-ix-events="load-more-wrap"]  optional — see data-ix-events-item-count below.
//       [data-ix-events="load-more"]       optional — button, reveals the next
//                                          batch of upcoming occurrences. If no
//                                          load-more-wrap is present, this can
//                                          instead live anywhere inside wrap.
//     ...the card Collection List (A or B above)...
//       [data-ix-events="date"]          same as List View, incl. DATE-TIME/DATE
//     [data-ix-events="feed-divider"]  optional — divider template element,
//                                        a sibling of the card Collection List
//                                        (not inside it). Expected to carry
//                                        Lumos's "u-hide" class so it's
//                                        invisible in its authored position;
//                                        each inserted copy has that class
//                                        removed (an inline style override
//                                        can't reliably win against a
//                                        typically-!important hide class).
//                                        One is inserted automatically
//                                        before the very first card in the
//                                        feed, and again at every month
//                                        boundary after that. If the card
//                                        container is a CSS grid, each
//                                        divider gets grid-column: 1 / -1 so
//                                        it spans every column as a
//                                        full-width row instead of sitting
//                                        in one cell — a no-op otherwise.
//       [data-ix-events="feed-divider-text"]  child of the divider above,
//                                        text updated per instance.
//         data-ix-events-date-format="{format}"  same token vocabulary as
//                                        the card's date-format (no DATE-TIME/DATE
//                                        support here — it needs a specific
//                                        occurrence's show-flags, which a
//                                        divider isn't tied to). Default
//                                        "MMMM YYYY" (e.g. "July 2026") —
//                                        matches List View's/Calendar's own
//                                        label default.
//
// Options (all read from the wrap element):
//   data-ix-events-duplicate-recurring="true" (default) | "false"
//     same meaning as List View — false caps each event to its single next
//     upcoming occurrence.
//   data-ix-events-item-count="12" (default)
//     how many occurrence-cards to reveal on init and per "Load More" click.
//     Shares its name and meaning with List View's option above (unlike List
//     View, Feed always has a limit — there's no "show everything" mode,
//     since the feed's range is unbounded going forward). Renamed from
//     data-ix-events-feed-count — existing instances need updating.
//   data-ix-events-feed-period="month" (default) | "week"
//     the granularity Load More's internal search expands by when looking
//     for enough occurrences to fill a batch. Doesn't change what's shown,
//     only how the search is chunked internally.
//   data-ix-events-feed-divider="true" (default) | "false"
//     enables inserting month-divider elements, including the very first one
//     (which lands before the first card in the feed, marking the current
//     month) — requires a [data-ix-events="feed-divider"] element in the wrap.
//   data-ix-events-feed-divider-today="true" | "false" (default)
//     only meaningful when feed-divider is true. Overrides the text of that
//     very first divider to the literal word "Today" instead of the current
//     month's formatted label. No effect if feed-divider is false, and no
//     effect unless filter="upcoming" (see below) — a past or "all" feed's
//     first divider is essentially never literally today, so forcing "Today"
//     text there would just be wrong.
//   data-ix-events-filter="upcoming" (default) | "past" | "all"
//     WHICH occurrences are candidates — independent of display order (see
//     data-ix-events-sort below). upcoming — only occurrences on/after today.
//     past — only occurrences that have already ended (occ.end < now). all —
//     no time-based filtering at all, bounded to roughly ±3 years from today
//     (same bound as event-detail.js's own "all" mode) since a truly
//     unbounded recurring series has no literal "all." With
//     duplicate-recurring="false", which single occurrence represents an
//     event is a `filter` decision: upcoming/all keep the earliest one in
//     range, past keeps the most recent one.
//   data-ix-events-sort="earliest-first" | "latest-first"
//     display order, independent of filter — unset (default) is contextual:
//     latest-first when filter="past", earliest-first otherwise (matching
//     each filter's most natural reading order). Set explicitly to override,
//     e.g. filter="past" + sort="earliest-first" for a chronological (not
//     most-recent-first) history.
//
// Filtering vs. sorting: these used to be one combined data-ix-events-direction
// option ("upcoming" implied both "only future" and "soonest first"; "past"
// implied both "only past" and "most recent first"). Splitting them lets any
// filter pair with any sort — e.g. showing an event's full history oldest-
// first, or its past occurrences oldest-first instead of most-recent-first.
//
// A small, fixed-count showcase section anywhere on the site (e.g. "next 3
// workshops" in a page footer) is just a Feed View instance with no
// load-more/load-more-wrap element and feed-divider="false" — item-count
// renders exactly that many cards once, nothing else. Scope which events
// appear via Webflow's own Designer-side Collection List filter (event
// type, location, etc.) — this module only ever iterates whatever items are
// already in the list, so no extra filtering code is involved. Use
// filter="past" for a "just happened" section instead.
// ============================================================================

const ANIMATION_ID = 'events';
const LIST_LAYOUT = 'list';
const FEED_LAYOUT = 'feed';

const WRAP = '[data-ix-events="wrap"]';
const LIST_EL = '[data-ix-events="list"]';
const PREV_BTN = '[data-ix-events="prev"]';
const NEXT_BTN = '[data-ix-events="next"]';
const TODAY_BTN = '[data-ix-events="today"]';
const LABEL = '[data-ix-events="label"]';
const ITEM = '[data-ix-events="item"]';
const DATA_EL = '[data-ix-events="data"]';
const CARD_EL = '[data-ix-events="card"]';
const SLUG_ATTR = 'data-ix-events-slug';
export const CLONE_ATTR = 'data-ix-events-clone';
const FS_LIST_SELECTOR = '[fs-list-element="list"]';
const LOAD_MORE_WRAP = '[data-ix-events="load-more-wrap"]';
const LOAD_MORE_BTN = '[data-ix-events="load-more"]';
const FEED_DIVIDER_EL = '[data-ix-events="feed-divider"]';
const FEED_DIVIDER_TEXT_EL = '[data-ix-events="feed-divider-text"]';
const INITIALIZED_ATTR = 'data-ix-events-initialized';
const ALL_RANGE_YEARS = 3; // matches event-detail.js's own "all" mode bound
// List View's own default (unset attribute) — was previously unlimited
// (null), which could realistically render hundreds of clones for a page
// with several dense recurring events in one active month. 30 is a
// realistic ceiling for a month view; data-ix-events-item-count="unlimited"
// opts back into the old no-limit behavior explicitly.
const LIST_DEFAULT_ITEM_COUNT = 30;

// Marks `wrap` as processed and returns true the FIRST time it's called for
// a given wrap, false every time after — guards against a wrap getting
// initialized twice (e.g. a page-transition script re-running this bundle
// on soft navigation, without a full page reload). Without this, a second
// eventFeed() pass would re-scan the DOM for [data-ix-events="item"]
// elements, which by then ALSO matches clones from the first pass (they
// still carry the same item/card structure) — inflating the source pool —
// and, since Feed only ever appends and starts a fresh renderedCount=0 in
// its own closure with no memory of the first pass, would pile on an
// entirely separate batch on top rather than skipping cleanly. Confirmed
// live: exactly this symptom (more cards than item-count, inconsistent
// dates between what looks like two overlapping renders).
function claimForInit(wrap) {
  if (wrap.hasAttribute(INITIALIZED_ATTR)) return false;
  wrap.setAttribute(INITIALIZED_ATTR, '');
  return true;
}

// ── List View ────────────────────────────────────────────────────────────

export const eventList = function () {
  const wraps = [...document.querySelectorAll(WRAP)].filter(
    (wrap) => wrap.getAttribute('data-ix-events-layout') === LIST_LAYOUT
  );
  debugLog('[event-list] wraps with layout="list" found:', wraps.length, wraps);
  if (wraps.length === 0) return;

  // whenEvents is now called per-wrap (not once, shared) — each wrap can
  // resolve to its own local data-wrap, or fall back to the same page-level
  // one, per event-data.js's resolution rule. Needed for slug matching in
  // the separate-Collection-List case (B); combined-mode items (A) never
  // need this, since they carry their own JSON — skipped entirely via
  // needsSharedData() below so a combined-mode-only wrap never blocks on
  // whenEvents()'s retry loop resolving a shared data-wrap that may not even
  // exist on this page (confirmed live: up to MAX_ATTEMPTS * RETRY_DELAY,
  // 6 seconds, of pure wasted retrying before it gave up and proceeded
  // anyway with an eventsBySlug map nothing ended up using).
  wraps.forEach((wrap) => {
    if (!claimForInit(wrap)) {
      debugLog('[event-list] wrap already initialized, skipping:', wrap);
      return;
    }
    const withEvents = (events) => {
      debugLog('[event-list] whenEvents callback fired, events received:', events.length, events);
      const eventsBySlug = new Map(events.map((event) => [event.slug, event]));

      whenListReady(wrap, true, (listInstance) => {
        const config = buildListConfig(wrap, listInstance.listElement, eventsBySlug);
        debugLog('[event-list] config built for wrap:', wrap, '-> ', config);
        if (!config) return;
        initList(config, listInstance);
      });
    };

    if (needsSharedData(wrap)) {
      whenEvents(wrap, withEvents);
    } else {
      debugLog('[event-list] wrap is combined-mode only — skipping whenEvents()', wrap);
      withEvents([]);
    }
  });
};

// Item↔event pairing — unchanged regardless of what renders the result.
function buildListConfig(wrap, list, eventsBySlug) {
  const duplicateRecurring = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-duplicate-recurring`));
  const hidePastEvents = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-hide-past-events`));
  let range = attr('month', wrap.getAttribute(`data-ix-${ANIMATION_ID}-range`)?.toLowerCase());
  if (range !== 'month' && range !== 'week') range = 'month';
  const weekStartDay =
    attr('sunday', wrap.getAttribute(`data-ix-${ANIMATION_ID}-week-start`)?.toLowerCase()) === 'monday' ? 1 : 0;
  const label = wrap.querySelector(LABEL);
  const prevBtn = wrap.querySelector(PREV_BTN);
  const nextBtn = wrap.querySelector(NEXT_BTN);
  const todayBtn = wrap.querySelector(TODAY_BTN);
  const itemCount = readItemCount(wrap, LIST_DEFAULT_ITEM_COUNT);
  const { loadMoreWrap, loadMoreBtn } = itemCount ? resolveLoadMore(wrap) : {};
  debugLog('[event-list] buildListConfig: duplicateRecurring =', duplicateRecurring, '| hidePastEvents =', hidePastEvents, '| range =', range, '| weekStartDay =', weekStartDay, '| itemCount =', itemCount, '| label found:', !!label, '| prevBtn found:', !!prevBtn, '| nextBtn found:', !!nextBtn, '| todayBtn found:', !!todayBtn);

  const entries = buildEntries(wrap, eventsBySlug);
  debugLog('[event-list] buildListConfig: successfully paired entries:', entries.length, entries);
  if (entries.length === 0) return null;

  return {
    wrap,
    duplicateRecurring,
    hidePastEvents,
    range,
    weekStartDay,
    label,
    prevBtn,
    nextBtn,
    todayBtn,
    itemCount,
    loadMoreWrap,
    loadMoreBtn,
    entries,
    list,
  };
}

function initList(config, listInstance) {
  const {
    wrap,
    duplicateRecurring,
    hidePastEvents,
    range,
    weekStartDay,
    label,
    prevBtn,
    nextBtn,
    todayBtn,
    itemCount,
    loadMoreWrap,
    loadMoreBtn,
    entries,
    list,
  } = config;
  const eventByElement = new Map(entries.map(({ item, event }) => [item, event]));
  debugLog('[event-list] initList: registering hook, listInstance =', listInstance);
  // Announces range changes (via the label's own text updating) and Load
  // More batches to screen reader users — see utilities.js's
  // announceLiveRegion() header comment.
  label?.setAttribute('aria-live', 'polite');

  let current = anchorFor(new Date(), range, weekStartDay);
  // How many occurrence-cards are currently revealed for the active range —
  // only meaningful when itemCount is set; reset to itemCount on every nav
  // change (refresh()) and grown by itemCount on each Load More click.
  let renderedCount = itemCount || 0;
  // The ACTUAL count rendered by the most recent filter-hook pass (vs.
  // renderedCount, which is the requested/target count, clamped by `total`
  // inside the hook) — read by the Load More click handler below to
  // announce an accurate "N more" count.
  let lastVisibleCount = 0;

  listInstance.addHook('filter', (items) => {
    const { start: rangeStart, end: rangeEnd } = getRangeBounds(current, range);
    debugLog('[event-list] filter hook FIRED. items received from Finsweet:', items.length, items, '| active range:', rangeStart, '-', rangeEnd);

    // Defensive cleanup: remove any clones from a previous pass in case
    // Finsweet doesn't drop DOM nodes that fall out of the returned array —
    // see the "known risk" note in the plan for why this stays even though
    // the map lookup below would also exclude stale clones on its own.
    const removedClones = list.querySelectorAll(`[${CLONE_ATTR}]`);
    debugLog('[event-list] removing stale clones from previous pass:', removedClones.length);
    removedClones.forEach((el) => el.remove());

    // Pass 1: gather every occurrence across every item into one
    // chronologically sorted list — no DOM created yet. This is what lets
    // itemCount slice across events, not per-event.
    const pending = [];
    items.forEach((listItem) => {
      const event = eventByElement.get(listItem.element);
      if (!event) {
        debugLog('[event-list] no matching event for this listItem.element (stale/unrecognized) — dropping:', listItem.element);
        return;
      }

      let occurrences = getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
      if (hidePastEvents) {
        const now = new Date();
        occurrences = occurrences.filter((occ) => occ.end >= now);
      }
      if (!duplicateRecurring) occurrences = occurrences.slice(0, 1);
      debugLog('[event-list] event', event.name, '-> occurrences in range:', occurrences.length);

      occurrences.forEach((occurrence) => {
        pending.push({ listItem, event, occurrence, date: occurrence.start, showStartTime: event.showStartTime });
      });
    });
    pending.sort(compareListEntries);

    const total = pending.length;
    const visibleCount = itemCount ? Math.min(renderedCount, total) : total;
    const visible = pending.slice(0, visibleCount);
    lastVisibleCount = visibleCount;

    // Pass 2: materialize only the visible slice — hide every original
    // element by default, then un-hide/clone exactly what's needed. Nothing
    // beyond the slice is ever created, so there's no hidden-clone state for
    // Finsweet (or watchAndUnhide, see below) to fight over on Load More.
    items.forEach((listItem) => {
      listItem.element.style.display = 'none';
    });

    const claimedOriginal = new Set();
    const insertAfterByItem = new Map();
    const result = [];

    visible.forEach(({ listItem, event, occurrence, date, showStartTime }) => {
      if (!claimedOriginal.has(listItem)) {
        claimedOriginal.add(listItem);
        listItem.element.style.display = '';
        setDateFields(listItem.element, occurrence, event);
        insertAfterByItem.set(listItem, listItem.element);
        result.push({ listItem, date, showStartTime });
      } else {
        const prevEl = insertAfterByItem.get(listItem);
        const clone = createOccurrenceCard(listItem.element, occurrence, event, `occ-${result.length}`);
        prevEl.insertAdjacentElement('afterend', clone);
        insertAfterByItem.set(listItem, clone);
        result.push({ listItem: listInstance.createItem(clone), date, showStartTime });
      }
    });

    if (itemCount) {
      const target = loadMoreWrap || loadMoreBtn;
      if (target) target.style.display = visibleCount < total ? '' : 'none';
    }

    debugLog('[event-list] filter hook RETURNING', result.length, 'of', total, 'items to Finsweet');
    return result.map((r) => r.listItem);
  });

  const refresh = () => {
    if (itemCount) renderedCount = itemCount;
    debugLog('[event-list] refresh() called — range now:', current);
    if (label) {
      const format = attr('', label.getAttribute('data-ix-events-label-format'));
      label.textContent =
        range === 'week' ? formatWeekLabel(current, format || undefined) : formatOccurrenceDate(current, format || 'MMMM YYYY');
    }
    updateNavState();
    listInstance.triggerHook('filter');
  };

  const updateNavState = () => {
    setDisabledState(prevBtn, isPrevDisabled(current, range, hidePastEvents));
    setDisabledState(todayBtn, isTodayDisabled(current, range));
  };

  refresh();

  prevBtn?.addEventListener('click', () => {
    if (isPrevDisabled(current, range, hidePastEvents)) return;
    current = stepCurrent(current, range, -1);
    refresh();
  });
  nextBtn?.addEventListener('click', () => {
    current = stepCurrent(current, range, 1);
    refresh();
  });
  todayBtn?.addEventListener('click', () => {
    if (isTodayDisabled(current, range)) return;
    current = anchorFor(new Date(), range, weekStartDay);
    refresh();
  });
  loadMoreBtn?.addEventListener('click', () => {
    const before = lastVisibleCount;
    renderedCount += itemCount;
    listInstance.triggerHook('filter');
    const added = lastVisibleCount - before;
    if (added > 0) announceLiveRegion(wrap, `${added} more event${added === 1 ? '' : 's'} loaded.`);
  });
}

// prevBtn is disabled once stepping back would land entirely before today —
// only relevant when hide-past-events is on, since otherwise past ranges are
// perfectly navigable (they just show events that already happened).
function isPrevDisabled(current, range, hidePastEvents) {
  if (!hidePastEvents) return false;
  const prevBounds = getRangeBounds(stepCurrent(current, range, -1), range);
  return prevBounds.end < new Date();
}

// todayBtn is disabled when the active range already contains today — clicking
// it would just re-select the same range.
function isTodayDisabled(current, range) {
  const { start, end } = getRangeBounds(current, range);
  const now = new Date();
  return now >= start && now <= end;
}

// Sort chronologically by day first; within the same day, occurrences with
// Show Start Time checked sort by their actual time, and occurrences without
// a shown start time sort after all of that day's timed occurrences.
function compareListEntries(a, b) {
  const dayDiff = startOfDay(a.date) - startOfDay(b.date);
  if (dayDiff !== 0) return dayDiff;
  if (a.showStartTime !== b.showStartTime) return a.showStartTime ? -1 : 1;
  return a.date - b.date;
}

// ── Feed View ────────────────────────────────────────────────────────────

export const eventFeed = function () {
  const wraps = [...document.querySelectorAll(WRAP)].filter(
    (wrap) => wrap.getAttribute('data-ix-events-layout') === FEED_LAYOUT
  );
  debugLog('[event-feed] wraps with layout="feed" found:', wraps.length, wraps);
  if (wraps.length === 0) return;

  // whenEvents is called per-wrap — see the matching note (and needsSharedData
  // skip) in eventList().
  wraps.forEach((wrap) => {
    if (!claimForInit(wrap)) {
      debugLog('[event-feed] wrap already initialized, skipping:', wrap);
      return;
    }
    const withEvents = (events) => {
      debugLog('[event-feed] whenEvents callback fired, events received:', events.length, events);
      const eventsBySlug = new Map(events.map((event) => [event.slug, event]));

      // Feed doesn't need a Finsweet List instance for its own rendering (see
      // header comment) — only, optionally, to know when fs-list-load="all"
      // pagination has finished. `required: false` means proceed immediately
      // if there's no fs-list-element="list" on this wrap at all.
      whenListReady(wrap, false, () => initFeed(wrap, eventsBySlug));
    };

    if (needsSharedData(wrap)) {
      whenEvents(wrap, withEvents);
    } else {
      debugLog('[event-feed] wrap is combined-mode only — skipping whenEvents()', wrap);
      withEvents([]);
    }
  });
};

function initFeed(wrap, eventsBySlug) {
  const entries = buildEntries(wrap, eventsBySlug);
  const cardTotal = allCardItems(wrap).length;
  debugLog('[event-feed] initFeed: entries found for wrap:', entries.length, 'of', cardTotal, 'card item(s) total', wrap);
  if (cardTotal > entries.length) {
    console.warn(
      `event-feed: ${cardTotal - entries.length} card item(s) in this wrap failed to parse into usable events — see warnings above for which and why. Those cards are hidden (never shown), not included in the feed.`,
      wrap
    );
  }
  if (entries.length === 0) return;

  const duplicateRecurring = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-duplicate-recurring`));
  const itemCount = readItemCount(wrap, 12);
  let feedPeriod = attr('month', wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-period`)?.toLowerCase());
  if (feedPeriod !== 'month' && feedPeriod !== 'week') feedPeriod = 'month';
  const feedDivider = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-divider`));
  const feedDividerToday = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-divider-today`));
  let filter = attr('upcoming', wrap.getAttribute(`data-ix-${ANIMATION_ID}-filter`)?.toLowerCase());
  if (!['upcoming', 'past', 'all'].includes(filter)) filter = 'upcoming';
  let sortDirection = attr('', wrap.getAttribute(`data-ix-${ANIMATION_ID}-sort`)?.toLowerCase());
  if (!['earliest-first', 'latest-first'].includes(sortDirection)) sortDirection = undefined;

  // Templates only — every visible feed card is a clone, since occurrences
  // from different events interleave chronologically across the whole feed,
  // so no single event's "own" card can stay in its native DOM position.
  // Hides EVERY genuine card item (allCardItems(wrap)), not just the ones
  // that became valid `entries` — a card whose data failed to parse into a
  // usable entry (bad JSON, no Start Date, a missing slug match) must still
  // be hidden, not left visible with stale, un-computed placeholder text.
  // Confirmed live: a card missing its event data stayed permanently
  // visible in its native, unsorted position, showing whatever text a
  // content editor had originally typed into it in the Designer.
  // Prefers an explicit [data-ix-events="list"] role on the Collection List
  // wrapper (same element that carries fs-list-element="list", if present)
  // — falls back to inferring it from the first item's own parent for
  // instances built before this role existed. The explicit role removes the
  // old "feed-divider must be a sibling of the items, not inside them"
  // fragility, since dividers/cards now insert relative to an unambiguous,
  // Designer-marked container instead of a structurally-guessed one.
  const container = wrap.querySelector(LIST_EL) || entries[0].item.parentElement;
  allCardItems(wrap).forEach((item) => {
    item.style.display = 'none';
    watchAndKeepHidden(item);
  });
  watchForLateItems(container);

  const { loadMoreWrap, loadMoreBtn } = resolveLoadMore(wrap);
  const loadMoreTarget = loadMoreWrap || loadMoreBtn;
  const dividerTemplate = wrap.querySelector(FEED_DIVIDER_EL);
  const dividerTextEl = dividerTemplate?.querySelector(FEED_DIVIDER_TEXT_EL);
  debugLog('[event-feed] initFeed: duplicateRecurring =', duplicateRecurring, '| itemCount =', itemCount, '| feedPeriod =', feedPeriod, '| feedDivider =', feedDivider, '| feedDividerToday =', feedDividerToday, '| filter =', filter, '| sort =', sortDirection || '(default)', '| loadMoreBtn found:', !!loadMoreBtn, '| dividerTemplate found:', !!dividerTemplate);

  let renderedCount = 0;
  let currentDividerMonthKey = null;
  // Computed once, lazily, only for filter="all" — a bounded ±ALL_RANGE_YEARS
  // query (same bound as event-detail.js's own "all" mode), not an expanding
  // search, since "all" has no natural anchor/direction to grow from.
  let allOccurrencesMerged = null;

  function getAllOccurrencesMerged() {
    if (allOccurrencesMerged) return allOccurrencesMerged;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const earliestAllowed = new Date(today.getFullYear() - ALL_RANGE_YEARS, today.getMonth(), today.getDate());
    const cappedEnd = new Date(today.getFullYear() + ALL_RANGE_YEARS, today.getMonth(), today.getDate());
    allOccurrencesMerged = mergeOccurrences(entries, earliestAllowed, cappedEnd, duplicateRecurring, filter, sortDirection);
    return allOccurrencesMerged;
  }

  function createDivider(text) {
    const divider = dividerTemplate.cloneNode(true);
    // The template is expected to carry Lumos's "u-hide" class (typically
    // !important, so an inline style override can't win against it) — remove
    // it outright on each clone instead of trying to out-specificity it.
    divider.classList.remove('u-hide');
    // If the feed container is a CSS grid (e.g. Lumos's multi-column grid
    // utility), span every column so the divider reads as a full-width row
    // instead of sitting in a single cell — works regardless of how many
    // columns are configured at the current breakpoint. A harmless no-op if
    // the container isn't a grid at all (single-column / flex feeds).
    divider.style.gridColumn = '1 / -1';
    const textEl = divider.querySelector(FEED_DIVIDER_TEXT_EL);
    if (textEl) textEl.textContent = text;
    return divider;
  }

  function loadMore() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetCount = renderedCount + itemCount;

    const merged =
      filter === 'all'
        ? getAllOccurrencesMerged()
        : expandingWindowSearch({
            anchor: today,
            period: feedPeriod,
            direction: filter,
            targetCount,
            maxIterations: SEARCH_CAP,
            search: (start, end) => mergeOccurrences(entries, start, end, duplicateRecurring, filter, sortDirection),
          });

    const batch = merged.slice(renderedCount, targetCount);
    debugLog('[event-feed] loadMore: targetCount =', targetCount, '| total merged occurrences found:', merged.length, '| batch size:', batch.length);
    if (batch.length === 0) {
      if (loadMoreTarget) loadMoreTarget.style.display = 'none';
      return;
    }

    batch.forEach(({ item, event, occurrence }, i) => {
      if (feedDivider && dividerTemplate) {
        const monthKey = `${occurrence.start.getFullYear()}-${occurrence.start.getMonth()}`;
        if (currentDividerMonthKey === null || monthKey !== currentDividerMonthKey) {
          const isFirstDividerEver = currentDividerMonthKey === null;
          const format = attr('MMMM YYYY', dividerTextEl?.getAttribute('data-ix-events-date-format'));
          const showTodayLabel = isFirstDividerEver && feedDividerToday && filter === 'upcoming';
          const text = showTodayLabel ? 'Today' : formatOccurrenceDate(occurrence.start, format);
          container.appendChild(createDivider(text));
          currentDividerMonthKey = monthKey;
        }
      }
      container.appendChild(createOccurrenceCard(item, occurrence, event, `feed-${renderedCount + i}`));
    });

    renderedCount += batch.length;
    if (batch.length < itemCount && loadMoreTarget) loadMoreTarget.style.display = 'none';
  }

  loadMore();
  loadMoreBtn?.addEventListener('click', () => {
    const before = renderedCount;
    loadMore();
    const added = renderedCount - before;
    if (added > 0) announceLiveRegion(wrap, `${added} more event${added === 1 ? '' : 's'} loaded.`);
  });
}

// Flattens every event's occurrences within [rangeStart, rangeEnd] into one
// list, applying duplicate-recurring the same way List View does (false =
// cap each event to a single occurrence). `filter` and `sortDirection` are
// independent — see the header comment's "Filtering vs. sorting" note:
//   filter="upcoming" (default) — only occurrences on/after today.
//   filter="past" — only occurrences that have already ended (occ.end < now).
//   filter="all" — no time-based filtering at all.
// `sortDirection` ("earliest-first" | "latest-first") controls display
// order only, independent of filter. If omitted, it defaults contextually —
// "latest-first" when filter="past", "earliest-first" otherwise — matching
// this module's pre-split behavior. When duplicateRecurring is false, which
// SINGLE occurrence represents an event is a `filter` decision (the most
// relevant one for that filter), not a `sortDirection` one: "past" keeps the
// most recent past occurrence, "upcoming"/"all" keep the earliest one in range.
export function mergeOccurrences(entries, rangeStart, rangeEnd, duplicateRecurring, filter = 'upcoming', sortDirection) {
  const now = new Date();
  const effectiveSort = sortDirection || (filter === 'past' ? 'latest-first' : 'earliest-first');
  const isDescending = effectiveSort === 'latest-first';
  const merged = [];
  entries.forEach(({ item, event }) => {
    let occurrences = getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
    if (filter === 'past') occurrences = occurrences.filter((occ) => occ.end < now);
    else if (filter === 'upcoming') occurrences = occurrences.filter((occ) => occ.end >= now);
    if (!duplicateRecurring) occurrences = filter === 'past' ? occurrences.slice(-1) : occurrences.slice(0, 1);
    occurrences.forEach((occurrence) => merged.push({ item, event, occurrence }));
  });
  merged.sort((a, b) => {
    const dayDiff = startOfDay(a.occurrence.start) - startOfDay(b.occurrence.start);
    if (dayDiff !== 0) return isDescending ? -dayDiff : dayDiff;
    if (a.event.showStartTime !== b.event.showStartTime) return a.event.showStartTime ? -1 : 1;
    return isDescending ? b.occurrence.start - a.occurrence.start : a.occurrence.start - b.occurrence.start;
  });
  return merged;
}

// ── Shared: entries, Finsweet resolution, occurrence cards ────────────────

// True if any card item in wrap is separate-mode (relies on eventsBySlug —
// i.e. has no local [data-ix-events="data"] of its own). A combined-mode-only
// wrap (every card carries its own JSON) never needs whenEvents()'s shared
// data-wrap lookup at all, so callers use this to skip it entirely rather
// than block on a retry loop resolving a data-wrap that may not exist
// anywhere on the page.
function needsSharedData(wrap) {
  return [...wrap.querySelectorAll(ITEM)].some((item) => item.querySelector(CARD_EL) && !item.querySelector(DATA_EL));
}

// Every genuine (non-clone) card item in wrap, regardless of whether it goes
// on to successfully parse into a usable entry below — Feed View uses this
// (not buildEntries()'s return value) to decide what to hide, since a card
// whose data fails to parse must still be hidden as a template, not left
// visible with whatever placeholder text a content editor originally typed
// into it. Excludes CLONE_ATTR-tagged items — a clone carries the same
// item/card structure as its template, so without this a clone could get
// mistaken for a fresh source item (see claimForInit()'s header comment for
// when this matters: it shouldn't happen with that guard in place, but this
// is the correct invariant regardless of how initialization gets triggered).
function allCardItems(wrap) {
  return [...wrap.querySelectorAll(ITEM)].filter(
    (item) => item.querySelector(CARD_EL) && !item.hasAttribute(CLONE_ATTR)
  );
}

// Item↔event pairing, combined (A) or separate (B) mode — used by both views.
function buildEntries(wrap, eventsBySlug) {
  const cardItems = allCardItems(wrap);
  if (cardItems.length === 0) return [];

  return cardItems
    .map((item) => {
      const dataEl = item.querySelector(DATA_EL);
      let event;
      if (dataEl) {
        // Combined: this item carries its own JSON.
        try {
          event = parseEventFromJSON(JSON.parse(dataEl.textContent));
        } catch (e) {
          console.warn('event-list: could not parse event JSON', item, e);
          return null;
        }
      } else {
        // Separate: match to this wrap's resolved data-wrap by slug.
        const slug = item.getAttribute(SLUG_ATTR);
        event = slug ? eventsBySlug.get(slug) : null;
        if (!event) {
          console.warn(
            `event-list: no matching event data for slug "${slug}" — bind ${SLUG_ATTR} on this card to the Slug field.`,
            item
          );
          return null;
        }
      }
      if (!event.startDate) {
        console.warn('event-list: event JSON has no valid Start Date — this card will never be shown.', item);
        return null;
      }
      return { item, event };
    })
    .filter(Boolean);
}

// Shared by all three views: unset/blank/invalid => defaultValue (List
// View's own default is 30 — see LIST_DEFAULT_ITEM_COUNT; Feed/Detail default
// 12). The literal value "unlimited" (case-insensitive) explicitly opts into
// no-limit/show-everything behavior — returns null, the same value this
// resolved to before List View had a default at all, so every existing
// "no limit" code path (`itemCount ? ... : ...`) keeps working unchanged.
export function readItemCount(wrap, defaultValue) {
  const raw = wrap.getAttribute(`data-ix-${ANIMATION_ID}-item-count`);
  if (raw === null || raw.trim() === '') return defaultValue;
  if (raw.trim().toLowerCase() === 'unlimited') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

// Resolves the optional load-more-wrap/load-more pair, shared by both views.
// If a [data-ix-events="load-more-wrap"] is present, the button is looked up
// INSIDE it (and the wrap itself is what gets shown/hidden). If it's absent,
// falls back to a bare [data-ix-events="load-more"] button found anywhere in
// wrap (and the button itself is what gets shown/hidden) — keeps Feed View's
// original, already-shipped flat markup (no wrap) working unchanged.
// Both lookups exclude elements belonging to a NESTED [data-ix-events="wrap"]
// (closest(WRAP) === wrap) — needed now that event-detail.js's wrap can
// legitimately contain another instance's wrap inside it (e.g. an "Other
// Upcoming Events" Feed section on the same page), which would otherwise let
// this wrap's own resolveLoadMore() steal that nested instance's button.
export function resolveLoadMore(wrap) {
  const loadMoreWrap = [...wrap.querySelectorAll(LOAD_MORE_WRAP)].find((el) => el.closest(WRAP) === wrap) || null;
  const scope = loadMoreWrap || wrap;
  const loadMoreBtn = [...scope.querySelectorAll(LOAD_MORE_BTN)].find((el) => el.closest(WRAP) === wrap) || null;
  return { loadMoreWrap, loadMoreBtn };
}

// Resolves this wrap's Finsweet List instance, awaiting `loadingPaginatedItems`
// first (a no-op when fs-list-load="all" isn't in use). Calls `callback` once
// ready. `required` distinguishes List View (which needs the instance itself
// for createItem()/filter hooks, so a missing fs-list-element="list" is
// treated as a setup error and warned about) from Feed View (which only needs
// to know when any pagination is done, so it proceeds immediately if there's
// nothing to wait for, no warning).
function whenListReady(wrap, required, callback) {
  const list = wrap.querySelector(FS_LIST_SELECTOR);
  if (!list) {
    if (required) {
      console.warn('event-list: no element with fs-list-element="list" found inside this wrap.', wrap);
      return;
    }
    callback(null);
    return;
  }

  window.FinsweetAttributes ||= [];
  window.FinsweetAttributes.push([
    'list',
    (listInstances) => {
      const listInstance = listInstances.find((l) => l.listElement === list);
      if (!listInstance) {
        if (required) {
          console.warn(
            'event-list: no Finsweet List instance found for this Collection List — add fs-list-element="list" to it.',
            list
          );
          return;
        }
        callback(null);
        return;
      }
      Promise.resolve(listInstance.loadingPaginatedItems)
        .then(() => waitForDomSettle(list))
        .then(() => callback(listInstance));
    },
  ]);
}

// Builds one occurrence's card from a template item — used for List View's
// clones and every card Feed View renders. Insertion into the DOM is left to
// the caller, since the two views position cards differently.
export function createOccurrenceCard(templateItem, occurrence, event, suffix) {
  const clone = templateItem.cloneNode(true);
  // cloneNode() copies the template's CURRENT inline style too — harmless for
  // List View (its original is already reset to visible before cloning each
  // pass) but a real bug for Feed View, whose templates stay permanently
  // display:none, so every clone would otherwise inherit that and never show.
  clone.style.display = '';
  clone.setAttribute(CLONE_ATTR, '');
  uniquifyIds(clone, suffix);
  setDateFields(clone, occurrence, event);
  watchAndUnhide(clone);
  return clone;
}

// ── Finsweet quirk workaround ───────────────────────────────────────────

// Finsweet's own render step applies an inline hidden style to List View's
// clone elements at some point after they're created — confirmed live via
// devtools (an inline display:none appears on clones, but only after the
// very first triggerHook('filter') call ever made against a given list
// instance). Neither a deferred initial render nor an addHook('afterRender',
// ...) cleanup pass caught it, meaning it happens later or asynchronously
// relative to both — so instead of guessing further at timing, react to the
// actual DOM mutation the instant it happens and immediately undo it. Feed
// View never registers with Finsweet's render pipeline at all, so this
// shouldn't be needed there, but costs nothing to apply uniformly via
// createOccurrenceCard() as cheap insurance.
function watchAndUnhide(el) {
  const observer = new MutationObserver(() => {
    if (el.style.display === 'none') el.style.display = '';
  });
  observer.observe(el, { attributes: true, attributeFilter: ['style'] });
}

// The mirror-image bug: Feed View's original template items must STAY
// hidden once initFeed() hides them, but simply carrying
// fs-list-element="list" is enough for Finsweet to run its own independent
// render pass over the Collection List — on its own schedule, regardless of
// whether Feed ever calls addHook/createItem itself — which can reset an
// item's inline display back to visible at an unpredictable point AFTER our
// own hiding already ran. Confirmed live: a reload showed a different
// subset of originals stuck visible each time (a genuine race, not a
// deterministic bug — the count varied 5-9 across reloads of the same
// page). Same fix shape as watchAndUnhide() above, opposite direction.
function watchAndKeepHidden(el) {
  const observer = new MutationObserver(() => {
    if (el.style.display !== 'none') el.style.display = 'none';
  });
  observer.observe(el, { attributes: true, attributeFilter: ['style'] });
}

// Root cause of the "Feed shows more cards than item-count, wrong order,
// inconsistent count" bug: `listInstance.loadingPaginatedItems` resolving is
// NOT proof that every fs-list-load="all" page has actually landed in the
// DOM yet — confirmed live via a captured page snapshot where exactly the
// LAST Webflow-native page (page 4 of 4) of a paginated list was still fully
// visible (no display:none at all) while every earlier page's items were
// correctly hidden. Those items were never late-hidden by Finsweet re-
// showing them (that's watchAndKeepHidden's job, and it only protects
// elements it already knows about) — they simply didn't exist in the DOM
// yet when initFeed()'s one-time hide pass ran, and buildEntries() ran
// before them too, meaning even the *set of candidate events* the feed
// searched for its "next N" batch was incomplete. Waits for the list
// container to go quiet (no new child items appended) for `quietMs` before
// resolving, up to `maxWaitMs` total so a genuinely stalled/slow load can't
// hang initFeed() forever.
function waitForDomSettle(container, quietMs = 150, maxWaitMs = 4000) {
  return new Promise((resolve) => {
    let settled = false;
    let quietTimer;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    });
    observer.observe(container, { childList: true });
    quietTimer = setTimeout(finish, quietMs);
    const maxTimer = setTimeout(finish, maxWaitMs);
  });
}

// Defense-in-depth for the same bug: even after waitForDomSettle(), keep
// watching for any genuine (non-clone) card item appended to the container
// after initFeed()'s initial hide pass, and hide it immediately. Covers any
// page that still arrives later than expected (e.g. an unusually slow
// fs-list-load="all" fetch) without leaving a stray original card visible.
function watchForLateItems(container) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (!node.matches?.(ITEM)) return;
        if (node.hasAttribute(CLONE_ATTR)) return;
        if (!node.querySelector(CARD_EL)) return;
        node.style.display = 'none';
        watchAndKeepHidden(node);
      });
    });
  });
  observer.observe(container, { childList: true });
}
