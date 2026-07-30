import { attr } from './utilities';
import { getOccurrences, parseEventFromJSON } from './recurrence';
import { whenEvents } from './event-data';

// ============================================================================
// event-list: List View (month/week) and Feed View (linear, upcoming-only)
// (data-ix-events-layout="list" | "feed")
// ============================================================================
//
// Both views share the same data-ix-events-* attribute prefix as calendar.js
// — all three read event data through event-data.js's whenEvents(), which
// finds the one [data-ix-events="data-wrap"] Collection List on the page, so
// switching layouts on one page can't end up reading two different sources.
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
//    holds the card (i.e. IS the page's [data-ix-events="data-wrap"]):
//      [data-ix-events="item"]
//        [data-ix-events="data"]   <script type="application/json"> — raw event fields
//        [data-ix-events="card"]   the visible card
//
// B) Separate — the cards are their own Collection List, nested inside this
//    component's own wrap, bound to the same events collection. Each card
//    item is matched to its event by slug instead of carrying its own JSON:
//      [data-ix-events="item"]
//        data-ix-events-slug="{{wf:Slug}}"   bind directly to the Slug field
//        [data-ix-events="card"]   the visible card
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
//                                        Special value "FULLDATE" (instead of a token
//                                        string) composes a full human-readable string
//                                        from the occurrence's own start/end plus the
//                                        event's Show Start Time / Show End Time / Show
//                                        End Date flags, e.g. "June 14th", "June 14th at
//                                        8pm", "June 14th, 8-9pm", "June 14-16th, 12pm-5pm".
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
//     [data-ix-events="load-more"]     optional — button, reveals the next
//                                        batch of upcoming occurrences
//     ...the card Collection List (A or B above)...
//       [data-ix-events="date"]          same as List View, incl. FULLDATE
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
//                                        the card's date-format (no FULLDATE
//                                        support here — it needs a specific
//                                        occurrence's show-flags, which a
//                                        divider isn't tied to). Default
//                                        "MMMM, YYYY" (e.g. "July, 2026").
//
// Options (all read from the wrap element):
//   data-ix-events-duplicate-recurring="true" (default) | "false"
//     same meaning as List View — false caps each event to its single next
//     upcoming occurrence.
//   data-ix-events-feed-count="12" (default)
//     how many occurrence-cards to reveal on init and per "Load More" click.
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
//     month's formatted label. No effect if feed-divider is false.
// ============================================================================

const ANIMATION_ID = 'events';
const LIST_LAYOUT = 'list';
const FEED_LAYOUT = 'feed';

const WRAP = '[data-ix-events="wrap"]';
const PREV_BTN = '[data-ix-events="prev"]';
const NEXT_BTN = '[data-ix-events="next"]';
const TODAY_BTN = '[data-ix-events="today"]';
const LABEL = '[data-ix-events="label"]';
const ITEM = '[data-ix-events="item"]';
const DATA_EL = '[data-ix-events="data"]';
const CARD_EL = '[data-ix-events="card"]';
const DATE_EL = '[data-ix-events="date"]';
const SLUG_ATTR = 'data-ix-events-slug';
const CLONE_ATTR = 'data-ix-events-clone';
const DISABLED_CLASS = 'is-disabled';
const FS_LIST_SELECTOR = '[fs-list-element="list"]';
const LOAD_MORE_BTN = '[data-ix-events="load-more"]';
const FEED_DIVIDER_EL = '[data-ix-events="feed-divider"]';
const FEED_DIVIDER_TEXT_EL = '[data-ix-events="feed-divider-text"]';
const FEED_SEARCH_CAP = 36; // safety cap on how many extra period-steps Load More will search before giving up

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── List View ────────────────────────────────────────────────────────────

export const eventList = function () {
  const wraps = [...document.querySelectorAll(WRAP)].filter(
    (wrap) => wrap.getAttribute('data-ix-events-layout') === LIST_LAYOUT
  );
  console.log('[event-list] DEBUG wraps with layout="list" found:', wraps.length, wraps);
  if (wraps.length === 0) return;

  // Needed for slug matching in the separate-Collection-List case (B).
  // Combined-mode items (A) never need this, since they carry their own JSON.
  whenEvents((events) => {
    console.log('[event-list] DEBUG whenEvents callback fired, events received:', events.length, events);
    const eventsBySlug = new Map(events.map((event) => [event.slug, event]));

    wraps.forEach((wrap) => {
      whenListReady(wrap, true, (listInstance) => {
        const config = buildListConfig(wrap, listInstance.listElement, eventsBySlug);
        console.log('[event-list] DEBUG config built for wrap:', wrap, '-> ', config);
        if (!config) return;
        initList(config, listInstance);
      });
    });
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
  console.log('[event-list] DEBUG buildListConfig: duplicateRecurring =', duplicateRecurring, '| hidePastEvents =', hidePastEvents, '| range =', range, '| weekStartDay =', weekStartDay, '| label found:', !!label, '| prevBtn found:', !!prevBtn, '| nextBtn found:', !!nextBtn, '| todayBtn found:', !!todayBtn);

  const entries = buildEntries(wrap, eventsBySlug);
  console.log('[event-list] DEBUG buildListConfig: successfully paired entries:', entries.length, entries);
  if (entries.length === 0) return null;

  return { duplicateRecurring, hidePastEvents, range, weekStartDay, label, prevBtn, nextBtn, todayBtn, entries, list };
}

function initList(config, listInstance) {
  const { duplicateRecurring, hidePastEvents, range, weekStartDay, label, prevBtn, nextBtn, todayBtn, entries, list } =
    config;
  const eventByElement = new Map(entries.map(({ item, event }) => [item, event]));
  console.log('[event-list] DEBUG initList: registering hook, listInstance =', listInstance);

  let current = anchorFor(new Date(), range, weekStartDay);

  listInstance.addHook('filter', (items) => {
    const { start: rangeStart, end: rangeEnd } = getRangeBounds(current, range);
    console.log('[event-list] DEBUG filter hook FIRED. items received from Finsweet:', items.length, items, '| active range:', rangeStart, '-', rangeEnd);

    // Defensive cleanup: remove any clones from a previous pass in case
    // Finsweet doesn't drop DOM nodes that fall out of the returned array —
    // see the "known risk" note in the plan for why this stays even though
    // the map lookup below would also exclude stale clones on its own.
    const removedClones = list.querySelectorAll(`[${CLONE_ATTR}]`);
    console.log('[event-list] DEBUG removing stale clones from previous pass:', removedClones.length);
    removedClones.forEach((el) => el.remove());

    const result = [];

    items.forEach((listItem) => {
      const event = eventByElement.get(listItem.element);
      if (!event) {
        console.log('[event-list] DEBUG no matching event for this listItem.element (stale/unrecognized) — dropping:', listItem.element);
        return;
      }

      let occurrences = getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
      if (hidePastEvents) {
        const now = new Date();
        occurrences = occurrences.filter((occ) => occ.end >= now);
      }
      console.log('[event-list] DEBUG event', event.name, '-> occurrences in range:', occurrences.length);

      // Defensive: explicitly control the original (non-cloned) element's
      // visibility ourselves rather than trusting Finsweet to hide it just
      // because it's excluded from the array returned below — this element
      // was already in the DOM from Webflow's own render, not created via
      // listInstance.createItem(), so the same "known risk" noted above for
      // clones applies to it too.
      listItem.element.style.display = occurrences.length === 0 ? 'none' : '';
      if (occurrences.length === 0) return;

      const [first, ...rest] = occurrences;
      setDateFields(listItem.element, first, event);
      result.push({ listItem, date: first.start, showStartTime: event.showStartTime });

      if (duplicateRecurring) {
        let insertAfter = listItem.element;
        rest.forEach((occ, i) => {
          const clone = createOccurrenceCard(listItem.element, occ, event, `occ-${i + 1}`);
          insertAfter.insertAdjacentElement('afterend', clone);
          insertAfter = clone;
          result.push({ listItem: listInstance.createItem(clone), date: occ.start, showStartTime: event.showStartTime });
        });
      }
    });

    result.sort(compareListEntries);
    console.log('[event-list] DEBUG filter hook RETURNING', result.length, 'items to Finsweet');
    return result.map((r) => r.listItem);
  });

  const refresh = () => {
    console.log('[event-list] DEBUG refresh() called — range now:', current);
    if (label) {
      const format = attr('', label.getAttribute('data-ix-events-label-format'));
      label.textContent =
        range === 'week' ? formatWeekLabel(current, format || undefined) : formatOccurrenceDate(current, format || 'MMMM YYYY');
    }
    updateNavState();
    listInstance.triggerHook('filter');
  };

  const updateNavState = () => {
    if (prevBtn) prevBtn.classList.toggle(DISABLED_CLASS, isPrevDisabled(current, range, hidePastEvents));
    if (todayBtn) todayBtn.classList.toggle(DISABLED_CLASS, isTodayDisabled(current, range));
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
  console.log('[event-feed] DEBUG wraps with layout="feed" found:', wraps.length, wraps);
  if (wraps.length === 0) return;

  whenEvents((events) => {
    console.log('[event-feed] DEBUG whenEvents callback fired, events received:', events.length, events);
    const eventsBySlug = new Map(events.map((event) => [event.slug, event]));

    wraps.forEach((wrap) => {
      // Feed doesn't need a Finsweet List instance for its own rendering (see
      // header comment) — only, optionally, to know when fs-list-load="all"
      // pagination has finished. `required: false` means proceed immediately
      // if there's no fs-list-element="list" on this wrap at all.
      whenListReady(wrap, false, () => initFeed(wrap, eventsBySlug));
    });
  });
};

function initFeed(wrap, eventsBySlug) {
  const entries = buildEntries(wrap, eventsBySlug);
  console.log('[event-feed] DEBUG initFeed: entries found for wrap:', entries.length, wrap);
  if (entries.length === 0) return;

  const duplicateRecurring = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-duplicate-recurring`));
  const feedCount = attr(12, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-count`));
  let feedPeriod = attr('month', wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-period`)?.toLowerCase());
  if (feedPeriod !== 'month' && feedPeriod !== 'week') feedPeriod = 'month';
  const feedDivider = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-divider`));
  const feedDividerToday = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-divider-today`));

  // Templates only — every visible feed card is a clone, since occurrences
  // from different events interleave chronologically across the whole feed,
  // so no single event's "own" card can stay in its native DOM position.
  const container = entries[0].item.parentElement;
  entries.forEach(({ item }) => {
    item.style.display = 'none';
  });

  const loadMoreBtn = wrap.querySelector(LOAD_MORE_BTN);
  const dividerTemplate = wrap.querySelector(FEED_DIVIDER_EL);
  const dividerTextEl = dividerTemplate?.querySelector(FEED_DIVIDER_TEXT_EL);
  console.log('[event-feed] DEBUG initFeed: duplicateRecurring =', duplicateRecurring, '| feedCount =', feedCount, '| feedPeriod =', feedPeriod, '| feedDivider =', feedDivider, '| feedDividerToday =', feedDividerToday, '| loadMoreBtn found:', !!loadMoreBtn, '| dividerTemplate found:', !!dividerTemplate);
  if (feedDivider && !dividerTemplate) {
    console.warn('event-feed: feed-divider is enabled but no [data-ix-events="feed-divider"] element was found.', wrap);
  }

  let renderedCount = 0;
  let currentDividerMonthKey = null;

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
    const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetCount = renderedCount + feedCount;

    let searchEnd = stepPeriodEnd(rangeStart, feedPeriod);
    let merged = mergeOccurrences(entries, rangeStart, searchEnd, duplicateRecurring);
    let iterations = 0;
    while (merged.length < targetCount && iterations < FEED_SEARCH_CAP) {
      searchEnd = stepPeriodEnd(searchEnd, feedPeriod);
      merged = mergeOccurrences(entries, rangeStart, searchEnd, duplicateRecurring);
      iterations++;
    }

    const batch = merged.slice(renderedCount, targetCount);
    console.log('[event-feed] DEBUG loadMore: targetCount =', targetCount, '| total merged occurrences found:', merged.length, '(after', iterations, 'extra search steps) | batch size:', batch.length);
    if (batch.length === 0) {
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    batch.forEach(({ item, event, occurrence }, i) => {
      if (feedDivider && dividerTemplate) {
        const monthKey = `${occurrence.start.getFullYear()}-${occurrence.start.getMonth()}`;
        if (currentDividerMonthKey === null || monthKey !== currentDividerMonthKey) {
          const isFirstDividerEver = currentDividerMonthKey === null;
          const format = attr('MMMM, YYYY', dividerTextEl?.getAttribute('data-ix-events-date-format'));
          const text = isFirstDividerEver && feedDividerToday ? 'Today' : formatOccurrenceDate(occurrence.start, format);
          container.appendChild(createDivider(text));
          currentDividerMonthKey = monthKey;
        }
      }
      container.appendChild(createOccurrenceCard(item, occurrence, event, `feed-${renderedCount + i}`));
    });

    renderedCount += batch.length;
    if (batch.length < feedCount && loadMoreBtn) loadMoreBtn.style.display = 'none';
  }

  loadMore();
  loadMoreBtn?.addEventListener('click', loadMore);
}

// Flattens every event's occurrences within [rangeStart, rangeEnd] into one
// chronologically sorted list, applying duplicate-recurring the same way
// List View does (false = cap each event to its first occurrence).
function mergeOccurrences(entries, rangeStart, rangeEnd, duplicateRecurring) {
  const merged = [];
  entries.forEach(({ item, event }) => {
    let occurrences = getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
    if (!duplicateRecurring) occurrences = occurrences.slice(0, 1);
    occurrences.forEach((occurrence) => merged.push({ item, event, occurrence }));
  });
  merged.sort((a, b) => {
    const dayDiff = startOfDay(a.occurrence.start) - startOfDay(b.occurrence.start);
    if (dayDiff !== 0) return dayDiff;
    if (a.event.showStartTime !== b.event.showStartTime) return a.event.showStartTime ? -1 : 1;
    return a.occurrence.start - b.occurrence.start;
  });
  return merged;
}

// ── Shared: entries, Finsweet resolution, occurrence cards ────────────────

// Item↔event pairing, combined (A) or separate (B) mode — used by both views.
function buildEntries(wrap, eventsBySlug) {
  const cardItems = [...wrap.querySelectorAll(ITEM)].filter((item) => item.querySelector(CARD_EL));
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
        // Separate: match to the page's data-wrap by slug.
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
      return event.startDate ? { item, event } : null;
    })
    .filter(Boolean);
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
      Promise.resolve(listInstance.loadingPaginatedItems).then(() => callback(listInstance));
    },
  ]);
}

// Builds one occurrence's card from a template item — used for List View's
// clones and every card Feed View renders. Insertion into the DOM is left to
// the caller, since the two views position cards differently.
function createOccurrenceCard(templateItem, occurrence, event, suffix) {
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

// ── Shared date helpers ─────────────────────────────────────────────────

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function startOfWeek(date, weekStartDay) {
  const diff = (date.getDay() - weekStartDay + 7) % 7;
  return addDays(date, -diff);
}

// The anchor date for a range: the 1st of the month, or the first day of the
// week (per weekStartDay). Used both to seed `current` and by the "today" button.
function anchorFor(date, range, weekStartDay) {
  return range === 'week' ? startOfWeek(date, weekStartDay) : new Date(date.getFullYear(), date.getMonth(), 1);
}

// `current` is always an anchor date (see anchorFor) — this expands it to the
// actual [start, end] window passed to getOccurrences().
function getRangeBounds(current, range) {
  if (range === 'week') {
    const weekEnd = addDays(current, 6);
    return { start: current, end: new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59) };
  }
  return {
    start: current,
    end: new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59),
  };
}

function stepCurrent(current, range, direction) {
  if (range === 'week') return addDays(current, 7 * direction);
  const next = new Date(current.getFullYear(), current.getMonth(), 1);
  next.setMonth(next.getMonth() + direction);
  return next;
}

// Extends a date forward by one Feed View "period" step (month or week) —
// used only to grow Load More's search window, not tied to any calendar
// week/month boundary the way List View's range stepping is. Always pins to
// the 1st of the month first (matching stepCurrent's month-safe pattern) to
// avoid rollover bugs (e.g. Jan 31 + 1 month landing in March).
function stepPeriodEnd(date, period) {
  if (period === 'week') return addDays(date, 7);
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  next.setMonth(next.getMonth() + 1);
  return next;
}

// Formats the occurrence's date fields — for a recurring event this is the
// computed date/time of THAT occurrence itself, never the event's original
// CMS start/end, so a "FULLDATE" range or the plain token formatter both
// naturally reflect the right day even when recurring.
function setDateFields(root, occurrence, event) {
  root.querySelectorAll(DATE_EL).forEach((el) => {
    const format = attr('MMMM D, YYYY', el.getAttribute('data-ix-events-date-format'));
    el.textContent = isFullDateFormat(format)
      ? formatFullDate(occurrence, event)
      : formatOccurrenceDate(occurrence.start, format);
  });
}

const pad2 = (n) => String(n).padStart(2, '0');
const ordinal = (n) => {
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
};

// Moment-style date format tokens — the same vocabulary Webflow's own Date
// field formatting UI uses, so any preset or custom-built combination from
// that picker works here unchanged. Order matters: longer tokens must be
// tried before their shorter prefixes (MMMM before MMM before MM before M, etc).
const DATE_FORMAT_TOKEN = /YYYY|YY|MMMM|MMM|MM|M|DD|Do|D|dddd|ddd|mm|H|h|A|a/g;

function formatOccurrenceDate(date, format) {
  const hours = date.getHours();

  const tokens = {
    YYYY: () => String(date.getFullYear()),
    YY: () => String(date.getFullYear()).slice(-2),
    MMMM: () => MONTH_FULL[date.getMonth()],
    MMM: () => MONTH_SHORT[date.getMonth()],
    MM: () => pad2(date.getMonth() + 1),
    M: () => String(date.getMonth() + 1),
    DD: () => pad2(date.getDate()),
    Do: () => ordinal(date.getDate()),
    D: () => String(date.getDate()),
    dddd: () => DOW_FULL[date.getDay()],
    ddd: () => DOW_SHORT[date.getDay()],
    mm: () => pad2(date.getMinutes()),
    H: () => String(hours),
    h: () => String(hours % 12 || 12),
    A: () => (hours >= 12 ? 'PM' : 'AM'),
    a: () => (hours >= 12 ? 'pm' : 'am'),
  };

  return format.replace(DATE_FORMAT_TOKEN, (match) => tokens[match]());
}

// Label for range="week": `current` is the anchor (the week's first day, per
// weekStartDay). No override → a smart default that always spells out the
// month on both ends and adds the start year too when the week crosses a
// year boundary, so it stays unambiguous ("Aug 3 - Aug 9, 2026",
// "Dec 29, 2025 - Jan 4, 2026"). With an override, the same format string is
// applied to both ends and joined with " - ".
function formatWeekLabel(current, format) {
  const end = addDays(current, 6);
  if (format) {
    return `${formatOccurrenceDate(current, format)} - ${formatOccurrenceDate(end, format)}`;
  }
  const crossesYear = current.getFullYear() !== end.getFullYear();
  const startFormat = crossesYear ? 'MMM D, YYYY' : 'MMM D';
  return `${formatOccurrenceDate(current, startFormat)} - ${formatOccurrenceDate(end, 'MMM D, YYYY')}`;
}

function isFullDateFormat(format) {
  return format.trim().toUpperCase() === 'FULLDATE';
}

// "FULLDATE": a composite format driven by the event's Show Start Time / Show
// End Time / Show End Date flags rather than a token string, e.g.:
//   "June 14th"                    (all three off)
//   "June 14th at 8pm"             (start time only)
//   "June 14th, 8-9pm"             (start + end time)
//   "June 14-16th, 12pm-5pm"       (+ end date, spans multiple days)
// A shared meridiem is only dropped from the start time when it wouldn't be
// ambiguous — kept on 12 (noon/midnight) even if the end time matches it.
function formatFullDate(occurrence, event) {
  const { start, end } = occurrence;
  const { showStartTime, showEndTime, showEndDate } = event;

  const isMultiDay = showEndDate && startOfDay(end) !== startOfDay(start);
  const datePart = isMultiDay ? formatDateRange(start, end) : formatSingleDate(start);

  if (!showStartTime) return datePart;
  if (!showEndTime) return `${datePart} at ${formatClockTime(start)}`;

  const startTime = formatClockTime(start);
  const endTime = formatClockTime(end);
  const startPeriod = start.getHours() >= 12 ? 'pm' : 'am';
  const endPeriod = end.getHours() >= 12 ? 'pm' : 'am';
  const start12Hour = start.getHours() % 12 || 12;
  const hideStartPeriod = startPeriod === endPeriod && start12Hour !== 12;
  const startTimeText = hideStartPeriod ? startTime.slice(0, -2) : startTime;

  return `${datePart}, ${startTimeText}-${endTime}`;
}

function formatSingleDate(date) {
  return `${MONTH_FULL[date.getMonth()]} ${ordinal(date.getDate())}`;
}

function formatDateRange(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) return `${MONTH_FULL[start.getMonth()]} ${start.getDate()}-${ordinal(end.getDate())}`;
  return `${formatSingleDate(start)} - ${formatSingleDate(end)}`;
}

function formatClockTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const h12 = hours % 12 || 12;
  const period = hours >= 12 ? 'pm' : 'am';
  const minuteText = minutes === 0 ? '' : `:${pad2(minutes)}`;
  return `${h12}${minuteText}${period}`;
}

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

// Duplicating a Collection Item for a recurring occurrence duplicates any
// `id`/`data-w-id` it carries. Duplicate `id`s break getElementById/aria-*
// lookups; duplicate `data-w-id`s can make Webflow's native Interactions
// panel misfire across instances. Strip both from clones.
function uniquifyIds(root, suffix) {
  if (root.hasAttribute('id')) root.id = `${root.id}-${suffix}`;
  root.removeAttribute('data-w-id');
  root.querySelectorAll('[id]').forEach((el) => {
    el.id = `${el.id}-${suffix}`;
  });
  root.querySelectorAll('[data-w-id]').forEach((el) => {
    el.removeAttribute('data-w-id');
  });
}
