import { attr, uniquifyIds, debugLog, setDisabledState } from './utilities';
import { getOccurrences } from './recurrence';
import { whenEvents } from './event-data';
import { startOfDay, addDays, anchorFor, getRangeBounds, stepCurrent, formatOccurrenceDate, formatWeekLabel, setDateFields } from './date-utils';

// ============================================================================
// calendar: month/week-grid Calendar (data-ix-events-layout="calendar")
// ============================================================================
//
// Webflow-authored, JS-driven — every visual element (grid, day cells, pills,
// hover card, loading/demo states) is built by the Designer; this script
// only supplies dates/data and appends pills into normal document flow. See
// design/calendar-mockup.html for a reference build and plan §9
// (gentle-singing-tome.md) for the design rationale. Reads event data
// through event-data.js's whenEvents(wrap, callback) — the same
// local-data-wrap-first-then-page-level-fallback lookup event-list.js uses,
// scoped to this specific instance's own wrap.
//
// Required structure per instance (see the mockup for the full markup):
//   [data-ix-events="wrap"] [data-ix-events-layout="calendar"]
//     [data-ix-events="prev"] / "next"        optional — step back/forward
//                                               one month or week (per range)
//     [data-ix-events="today"]                optional — jump to today
//     [data-ix-events="label"]                text — active month/week
//     [data-ix-events="weekday-label"]        x7 — weekday header text
//     [data-ix-events="grid"]
//       [data-ix-events="day-cell"]           x42, DOM order = row-major
//         [data-ix-events="day-number"]
//         [data-ix-events="day-pills"]        empty — JS appends pill/spacer
//                                               pieces here, in normal flow
//         [data-ix-events="day-more"]         optional — "+N more" overflow
//     [data-ix-events="loading"]              optional — visible by default
//     [data-ix-events="demo-note"]            optional — hidden by default
//     [data-ix-events="hover-cards"]          optional — one hover-card per event.
//                                               No specific wrapper role is
//                                               required — every hover-card is
//                                               found directly, wherever it
//                                               lives. If it's inside a Finsweet
//                                               fs-list-element="list" Collection
//                                               List (e.g. fs-list-load="all" to
//                                               go beyond ~100 events), resolution
//                                               waits for pagination to finish
//                                               first — same reasoning as
//                                               event-data.js's whenEvents().
//       [data-ix-events="hover-card"]
//         data-ix-events-slug="{{wf:Slug}}"
//     [data-ix-events="calendar-pill"]        hidden template, cloned once
//                                               per day a segment covers.
//                                               Root is an <a>; may contain:
//       [data-ix-events="name"|"slug"|"event-type"|"short-description"
//                        |"location"|"address"|"timezone"|"show-start-time"
//                        |"show-end-time"|"show-end-date"
//                        |"recurring-frequency"|"recurring-interval"
//                        |"recurring-days"|"recurring-skip-dates"]
//                                               plain text, see PILL_TEXT_FIELDS
//       [data-ix-events="date"]                time-only — set
//                                               data-ix-events-date-format to
//                                               "TIME"/"TIME-SHORT" (or a
//                                               plain token string) on it
//     [data-ix-events="calendar-pill-spacer"] hidden template, cloned to
//                                               keep lanes aligned across a
//                                               row (see rendering model)
//
// Options (all read from the wrap element):
//   data-ix-events-months="6" (default)
//     how many months back/forward navigation is allowed, in both range modes.
//   data-ix-events-range="month" (default) | "week"
//     same meaning as List View's range option. Week mode reuses the same 42
//     day-cell elements, only showing/using the first 7.
//   data-ix-events-week-start="sunday" (default) | "monday"
//     only consulted when range="week" — also drives weekday-label order.
//   data-ix-events-label-format="{format}"
//     optional override, same token vocabulary as List View's label format.
//   data-ix-events-day-pill-limit="3" (default)
//     max visible occurrence lanes per day before folding into "+N more"
//     (see overflow-items below).
//   data-ix-events-link-format="/event/{slug}" (default)
//     pill href template, {slug} token-replaced.
//   data-ix-events-overflow-items="expand" (default) | "hide" | "show"
//     what happens to lanes beyond day-pill-limit in a given week-row. Both
//     hide and expand render the same "+N more" text — only whether it's
//     clickable differs:
//       hide   — static "+N more" count on each overflowing day, nothing
//                else rendered, never responds to a click.
//       expand — clickable "+N more" on each overflowing day; clicking it
//                reveals every hidden lane for that WHOLE week-row (lanes
//                are row-scoped, not per-day, so revealing is too). Resets
//                whenever the active month/week changes.
//       show   — day-pill-limit is bypassed entirely; every lane a row
//                actually needs renders immediately. "+N more" never
//                appears.
//     In every mode, a day-cell's own height grows automatically (normal
//     flow — see rendering model) to fit however many lanes are actually
//     rendered in it; there's no separate row-growing step to configure.
//   data-ix-events-show-outside-month="false" (default) | "true"
//     range="month" only. false — occurrences are never added to the
//     leading/trailing days from adjacent months (a multi-day event is
//     clipped to just its portion inside the active month). true — outside
//     days get occurrences exactly like any other visible day.
//   data-ix-events-hide-inactive-row="false" (default) | "true"
//     range="month" only. true — the grid's 6th row (cells 35-41) is hidden
//     whenever every day in it belongs to the next month (i.e. the active
//     month only needed 5 rows to lay out), so the grid doesn't carry a
//     trailing blank-looking row. Re-evaluated on every render, since
//     whether a given month needs 5 or 6 rows changes as you navigate.
//
// Rendering model: every occurrence (single- or multi-day) is clipped to the
// visible day cells, split into one segment per week-row it crosses, and
// lane-assigned within that row so overlapping events stack instead of
// colliding (unchanged from the original design — see splitIntoSegments/
// assignLanes below). Where segments turn into pixels is what changed: a
// segment is no longer one absolutely-positioned spanning-bar element.
// Instead, EVERY day-cell a segment crosses gets its own pill piece
// (is-start/is-middle/is-end/is-single per its position within the
// segment), appended as a normal-flow child of that day's own
// [data-ix-events="day-pills"] container — no getBoundingClientRect
// measurement, no ResizeObserver, nothing to go stale on resize, since nothing
// is ever positioned in pixels. Continuation edges (is-start's right side,
// is-middle's both sides, is-end's left side) bridge into the cell's own
// padding via a CSS negative margin (see the mockup's --cell-padding-driven
// rule), so adjacent pieces in neighboring day-cells touch at the shared
// cell border and read as one continuous bar; only a segment's TRUE outer
// edges get rounded corners. Only the is-start/is-single piece carries the
// pill's actual text content — is-middle/is-end pieces render as an empty
// colored bar for visual continuity.
//
// Within a row, lanes are assigned by start index first (segments starting
// earlier in the row get first pick of the lowest lane). For segments that
// share the same start day, priority is: 1) multi-day segments before
// single-day ones (longer-span-first among ties within that group), then
// 2) single-day occurrences with no visible start time (Show Start Time
// off) before ones that show a time, then 3) among the remaining timed
// single-day occurrences, earliest start time first — see assignLanes'
// sameDayPriority(). A segment still reuses the lowest lane whose previous
// occupant has already ended regardless of any of this, so two genuinely
// non-overlapping events (a single-day one on one day, a multi-day one
// starting later and never touching that day) naturally end up sharing
// lane 0 instead of one being pushed into a higher lane — and needing a
// spacer — for no real reason.
//
// Vertical lane alignment across a row (so a bar reads as one straight band)
// depends on every pill/spacer sharing the same fixed height (--pill-height
// in the mockup's CSS). A day whose active lanes have a gap — e.g. an event
// touches this day at lane 2 but not lane 1, because the lane-1 event
// doesn't span this particular day — gets a cloned
// [data-ix-events="calendar-pill-spacer"] in the gap so the lane-2 piece
// still lines up with lane-2 pieces in neighboring cells. A day whose lanes
// have no gap (or no events at all) never gets a spacer, so its cell stays
// exactly as tall as it needs to be.
// ============================================================================

const ANIMATION_ID = 'events';
const LAYOUT = 'calendar';
const WRAP = '[data-ix-events="wrap"]';
const PREV_BTN = '[data-ix-events="prev"]';
const NEXT_BTN = '[data-ix-events="next"]';
const TODAY_BTN = '[data-ix-events="today"]';
const LABEL = '[data-ix-events="label"]';
const WEEKDAY_LABEL = '[data-ix-events="weekday-label"]';
const GRID = '[data-ix-events="grid"]';
const DAY_CELL = '[data-ix-events="day-cell"]';
const DAY_NUMBER = '[data-ix-events="day-number"]';
const DAY_PILLS = '[data-ix-events="day-pills"]';
const DAY_MORE = '[data-ix-events="day-more"]';
const PILL_TEMPLATE = '[data-ix-events="calendar-pill"]';
const PILL_SPACER_TEMPLATE = '[data-ix-events="calendar-pill-spacer"]';
const LOADING = '[data-ix-events="loading"]';
const DEMO_NOTE = '[data-ix-events="demo-note"]';
const HOVER_CARD = '[data-ix-events="hover-card"]';
const FS_LIST_SELECTOR = '[fs-list-element="list"]';
const SLUG_ATTR = 'data-ix-events-slug';
const HIDDEN_CLASS = 'u-display-none';
const INITIALIZED_ATTR = 'data-ix-events-initialized';

// Guards against initCalendar() running twice for the same wrap (e.g. a
// page-transition script re-running this bundle on soft navigation) —
// otherwise nav button listeners, the hover-card MutationObserver, etc.
// would all get bound a second time. Same pattern as event-list.js's and
// event-detail.js's claimForInit().
function claimForInit(wrap) {
  if (wrap.hasAttribute(INITIALIZED_ATTR)) return false;
  wrap.setAttribute(INITIALIZED_ATTR, '');
  return true;
}

// Every plain-text field a pill can bind, kebab-case attribute name ->
// reader off the parsed `event` object (see parseEventFromJSON in
// recurrence.js for the full shape). Booleans/numbers/arrays are stringified
// so they're always safe to drop straight into textContent — arrays (the
// two recurring-* CSV fields) join with ", ". Date/time fields aren't here:
// they need real formatting, not raw display, and are already covered by
// the `date` element + TIME/TIME-SHORT/FULLDATE/token formats (see
// setDateFields in date-utils.js).
const PILL_TEXT_FIELDS = {
  name: (event) => event.name,
  slug: (event) => event.slug,
  'event-type': (event) => event.eventType,
  'short-description': (event) => event.shortDescription,
  location: (event) => event.location,
  address: (event) => event.address,
  timezone: (event) => event.timezone,
  'show-start-time': (event) => String(event.showStartTime),
  'show-end-time': (event) => String(event.showEndTime),
  'show-end-date': (event) => String(event.showEndDate),
  'recurring-frequency': (event) => (event.recurringFrequency === 'None' ? '' : event.recurringFrequency),
  'recurring-interval': (event) => String(event.recurringInterval),
  'recurring-days': (event) => event.recurringDays.join(', '),
  'recurring-skip-dates': (event) => event.recurringSkipDates.join(', '),
};

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const calendar = function () {
  const wraps = [...document.querySelectorAll(WRAP)].filter(
    (wrap) => wrap.getAttribute('data-ix-events-layout') === LAYOUT
  );
  debugLog('[calendar] wraps with layout="calendar" found:', wraps.length, wraps);
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    if (!claimForInit(wrap)) {
      debugLog('[calendar] wrap already initialized, skipping:', wrap);
      return;
    }
    initCalendar(wrap);
  });
};

function initCalendar(wrap) {
  const grid = wrap.querySelector(GRID);
  const dayCells = grid ? [...grid.querySelectorAll(DAY_CELL)] : [];
  const pillTemplate = wrap.querySelector(PILL_TEMPLATE);
  const spacerTemplate = wrap.querySelector(PILL_SPACER_TEMPLATE);
  if (!grid || dayCells.length === 0) {
    console.warn('calendar: no [data-ix-events="grid"] with [data-ix-events="day-cell"] children found.', wrap);
    return;
  }

  // ARIA grid semantics — entirely JS-set, no Designer/HTML changes needed.
  // day-cells carry aria-rowindex/aria-colindex directly (no DOM row-wrapper
  // element exists — the grid is flat CSS Grid, one row-major list of
  // cells — this is a valid ARIA 1.2 pattern for exactly that shape, not a
  // workaround) instead of nesting them under role="row" containers.
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Event calendar');
  dayCells.forEach((cell, i) => {
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-rowindex', String(Math.floor(i / 7) + 1));
    cell.setAttribute('aria-colindex', String((i % 7) + 1));
  });

  const months = attr(6, wrap.getAttribute(`data-ix-${ANIMATION_ID}-months`));
  let range = attr('month', wrap.getAttribute(`data-ix-${ANIMATION_ID}-range`)?.toLowerCase());
  if (range !== 'month' && range !== 'week') range = 'month';
  const weekStartDay =
    attr('sunday', wrap.getAttribute(`data-ix-${ANIMATION_ID}-week-start`)?.toLowerCase()) === 'monday' ? 1 : 0;
  const dayPillLimit = attr(3, wrap.getAttribute(`data-ix-${ANIMATION_ID}-day-pill-limit`));
  const linkFormat = attr('/event/{slug}', wrap.getAttribute(`data-ix-${ANIMATION_ID}-link-format`));
  let overflowMode = attr('expand', wrap.getAttribute(`data-ix-${ANIMATION_ID}-overflow-items`)?.toLowerCase());
  if (!['hide', 'expand', 'show'].includes(overflowMode)) overflowMode = 'hide';
  const showOutsideMonthEvents = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-show-outside-month`));
  const hideInactiveRow = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-hide-inactive-row`));

  const label = wrap.querySelector(LABEL);
  // Announces month/week nav changes to screen reader users the instant its
  // text updates in refresh() — see utilities.js's announceLiveRegion()
  // header comment for the same pattern used for List/Feed/Detail's Load
  // More announcements.
  label?.setAttribute('aria-live', 'polite');
  const prevBtn = wrap.querySelector(PREV_BTN);
  const nextBtn = wrap.querySelector(NEXT_BTN);
  const todayBtn = wrap.querySelector(TODAY_BTN);
  const weekdayLabels = [...wrap.querySelectorAll(WEEKDAY_LABEL)];
  const loadingEl = wrap.querySelector(LOADING);
  const demoNoteEl = wrap.querySelector(DEMO_NOTE);
  // Populated in place (see resolveHoverCards below) rather than reassigned,
  // so the reference closed over by renderGrid()/pill listeners below stays
  // valid even if resolution finishes asynchronously, after they're created.
  const hoverCardsBySlug = new Map();
  resolveHoverCards(wrap, hoverCardsBySlug, () => {
    debugLog('[calendar] hover-cards found:', hoverCardsBySlug.size, '| slugs:', [...hoverCardsBySlug.keys()]);
    if (hoverCardsBySlug.size === 0) {
      console.warn(
        'calendar: no [data-ix-events="hover-card"] elements with a resolved data-ix-events-slug were found — hover cards will never show for this instance. If you haven\'t yet wrapped the hover-card template in a live Webflow Collection List bound to your Events collection (see the TODO comment in the mockup), that\'s almost certainly why — the un-wired template only carries the literal, unresolved "{{wf:Slug}}" text.',
        wrap
      );
    }
    // Re-render so the "unmatched slugs" diagnostic (in renderGrid) reflects
    // final data instead of whatever was known at an earlier, possibly
    // pre-population pass. Not required for hover itself to work — pill
    // listeners look hoverCardsBySlug up fresh on every hover — this is
    // purely to keep that one diagnostic warning accurate.
    refresh();
  });

  if (!pillTemplate) {
    console.warn('calendar: no [data-ix-events="calendar-pill"] template found — no events will render.', wrap);
  }
  if (!spacerTemplate) {
    console.warn(
      'calendar: no [data-ix-events="calendar-pill-spacer"] template found — lane alignment across a row may look off for days with a gap lane.',
      wrap
    );
  }

  setWeekdayLabels(weekdayLabels, weekStartDay);

  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth() - months, 1);
  const maxDate = new Date(today.getFullYear(), today.getMonth() + months, 1);
  const canGoPrev = (current) => stepCurrent(current, range, -1) >= minDate;
  const canGoNext = (current) => stepCurrent(current, range, 1) <= maxDate;
  const isTodayActive = (current) => {
    const { start, end } = getRangeBounds(current, range);
    return today >= start && today <= end;
  };

  let current = anchorFor(today, range, weekStartDay);
  let state = { events: [] };
  // Which week-rows (index into the active grid) have had their overflow
  // manually revealed via a "+N more" click — overflow-items="expand" only.
  // Row indices are meaningless once the active month/week changes, so this
  // resets on every navigation (see the nav click handlers below).
  const expandedRows = new Set();
  // Tracks whichever hover card is currently shown (at most one, ever) so a
  // new mouseenter can force-hide a previous card even if its own
  // mouseleave was somehow missed — see the pill listeners in renderGrid().
  const hoverState = { activeCard: null };

  function updateNavState() {
    setDisabledState(prevBtn, !canGoPrev(current));
    setDisabledState(nextBtn, !canGoNext(current));
    setDisabledState(todayBtn, isTodayActive(current));
  }

  function refresh() {
    if (label) {
      const format = attr('', label.getAttribute('data-ix-events-label-format'));
      label.textContent =
        range === 'week' ? formatWeekLabel(current, format || undefined) : formatOccurrenceDate(current, format || 'MMMM YYYY');
    }
    updateNavState();
    renderGrid({
      wrap,
      grid,
      dayCells,
      pillTemplate,
      spacerTemplate,
      hoverCardsBySlug,
      current,
      range,
      weekStartDay,
      dayPillLimit,
      linkFormat,
      overflowMode,
      expandedRows,
      showOutsideMonthEvents,
      hideInactiveRow,
      hoverState,
      events: state.events,
      today,
    });
  }

  refresh(); // render an empty grid immediately, then fill in once events load

  // Backstop for hoverState.activeCard: if the pointer leaves the grid
  // entirely without a pill's own mouseleave having fired first (e.g. a
  // very fast pointer move, or the browser skipping a hit-test), this still
  // guarantees nothing is left stuck visible.
  grid.addEventListener('mouseleave', () => {
    if (hoverState.activeCard) {
      hideHoverCard(hoverState.activeCard);
      hoverState.activeCard = null;
    }
  });

  if (overflowMode === 'expand') {
    // Delegated once, not re-bound per render — lanes are row-scoped, so
    // clicking "+N more" on any day in a row reveals that whole row's
    // hidden segments, not just the day that was clicked.
    grid.addEventListener('click', (e) => {
      const moreEl = e.target.closest(DAY_MORE);
      if (!moreEl || !moreEl.classList.contains('is-active')) return;
      const cellIndex = dayCells.indexOf(moreEl.closest(DAY_CELL));
      if (cellIndex === -1) return;
      expandedRows.add(Math.floor(cellIndex / 7));
      refresh();
    });
  }

  prevBtn?.addEventListener('click', () => {
    if (!canGoPrev(current)) return;
    expandedRows.clear();
    current = stepCurrent(current, range, -1);
    refresh();
  });
  nextBtn?.addEventListener('click', () => {
    if (!canGoNext(current)) return;
    expandedRows.clear();
    current = stepCurrent(current, range, 1);
    refresh();
  });
  todayBtn?.addEventListener('click', () => {
    if (isTodayActive(current)) return;
    expandedRows.clear();
    current = anchorFor(new Date(), range, weekStartDay);
    refresh();
  });

  whenEvents(wrap, (events) => {
    debugLog('[calendar] whenEvents callback fired, events received:', events.length, events);
    const usedDemo = events.length === 0;
    state.events = usedDemo ? demoEvents() : events;
    loadingEl?.classList.remove('is-active');
    if (usedDemo) demoNoteEl?.classList.add('is-active');
    refresh();
  });
}

// ── Weekday header ───────────────────────────────────────────────────────

function setWeekdayLabels(weekdayLabels, weekStartDay) {
  weekdayLabels.forEach((el, i) => {
    el.textContent = DOW_SHORT[(weekStartDay + i) % 7];
  });
}

// ── Hover cards ──────────────────────────────────────────────────────────

// getComputedStyle().getPropertyValue() on a custom property returns the RAW
// declared string (e.g. "3rem"), not a resolved pixel number — parseFloat()
// alone silently drops the unit, treating "3rem" as if it were "3px" (i.e.
// effectively inert, since 1rem vs. 10rem would only ever differ by a few
// px). Converts rem using the root font-size; px passes through as-is.
// Returns null (not 0) for an empty/unset value so callers can tell "unset"
// apart from "explicitly 0" and apply their own fallback.
function cssLengthToPx(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('rem')) {
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const num = parseFloat(trimmed);
    return Number.isNaN(num) ? null : num * rootFontSize;
  }
  const num = parseFloat(trimmed);
  return Number.isNaN(num) ? null : num;
}

// Cards don't need a dedicated [data-ix-events="hover-cards"] wrapper — any
// [data-ix-events="hover-card"] anywhere in the wrap is found directly. The
// slug can live on the card itself OR any ancestor up to the card (e.g. a
// CMS Collection Item wrapper carrying the slug, with the visible card as
// its child — the same shape List View's separate mode already uses).
function buildHoverCardMap(wrap, map) {
  wrap.querySelectorAll(HOVER_CARD).forEach((card) => {
    unwrapFromHiddenAncestor(card, wrap);
    disableCardFocusability(card);
    const slugEl = card.closest(`[${SLUG_ATTR}]`);
    const slug = slugEl?.getAttribute(SLUG_ATTR);
    if (slug) map.set(slug, card);
  });
}

// The hover card is revealed by focusING ITS PILL, not by tabbing into the
// card's own content — so nothing inside it (or the card root itself, if a
// Designer used a focusable tag there) should be its own tab stop. Without
// this, native Webflow CMS bindings (a link, a "Learn More" button) inside
// the card would insert extra tab stops between one pill and the next,
// making keyboard navigation of the calendar as a whole harder to follow.
// Idempotent — safe to call repeatedly as buildHoverCardMap() re-runs.
const CARD_FOCUSABLE_SELECTOR = 'a[href], button, input, select, textarea, [tabindex]';
function disableCardFocusability(card) {
  const targets = card.matches(CARD_FOCUSABLE_SELECTOR)
    ? [card, ...card.querySelectorAll(CARD_FOCUSABLE_SELECTOR)]
    : [...card.querySelectorAll(CARD_FOCUSABLE_SELECTOR)];
  targets.forEach((el) => el.setAttribute('tabindex', '-1'));
}

// If the hover-cards live inside a Finsweet-paginated Collection List
// (fs-list-element="list", typically paired with fs-list-load="all" to go
// beyond Webflow's native per-page item cap — see event-data.js's identical
// concern for the main data source), scanning synchronously at init time
// would only ever find whichever cards happened to already be in the DOM on
// Finsweet's first page, well before its own async pagination finishes —
// exactly the same class of bug event-data.js's whenEvents() already guards
// against. Waits for that first; a same-tick no-op when there's no such
// list (the common case — hover-cards usually isn't Finsweet-driven at all).
function resolveHoverCards(wrap, map, callback) {
  const list = wrap.querySelector(FS_LIST_SELECTOR);
  if (!list) {
    // Deferred (not called inline) so this is always async regardless of
    // which branch runs — lets the caller schedule work after this that
    // depends on variables declared later in its own function body, without
    // worrying about which branch executes synchronously.
    queueMicrotask(() => {
      buildHoverCardMap(wrap, map);
      callback();
    });
    return;
  }

  window.FinsweetAttributes ||= [];
  window.FinsweetAttributes.push([
    'list',
    (listInstances) => {
      const listInstance = listInstances.find((l) => l.listElement === list);
      Promise.resolve(listInstance?.loadingPaginatedItems).then(() => {
        buildHoverCardMap(wrap, map);
        callback();
      });

      // Belt-and-suspenders, confirmed necessary live: loadingPaginatedItems
      // can resolve before Finsweet is actually done mutating this list's
      // DOM for a multi-page fetch — cards for a couple of events were still
      // missing from the DOM at that point, only appearing moments later.
      // Rather than chase a second, more precise timing hook, watch the list
      // directly and pick up anything new the instant it lands, regardless
      // of when or why Finsweet adds it. Only re-fires callback() when a
      // mutation actually grew the map — harmless no-op on any of the many
      // unrelated mutations a live list can otherwise produce. Disconnects
      // itself once the list goes quiet for 2s (no growth, no mutations) —
      // pagination is long done by then, and there's no reason to keep a
      // subtree observer running on this list for the rest of the page's
      // lifetime.
      let quietTimer;
      const observer = new MutationObserver(() => {
        clearTimeout(quietTimer);
        const sizeBefore = map.size;
        buildHoverCardMap(wrap, map);
        if (map.size !== sizeBefore) callback();
        quietTimer = setTimeout(() => observer.disconnect(), 2000);
      });
      observer.observe(list, { childList: true, subtree: true });
      quietTimer = setTimeout(() => observer.disconnect(), 2000);
    },
  ]);
}

// A hover-card accidentally left nested inside a permanently-hidden
// template holder (e.g. one carrying u-display-none) can never become
// visible via its own is-active toggle — a hidden ancestor always wins.
// Rather than require a Webflow restructure, walk up from the card and, the
// moment a hidden ancestor is found, relocate that ancestor's child (not
// the card itself, so everything below it — a whole CMS Collection List,
// for instance — moves as one piece) out to be a direct child of wrap.
// Safe to call once per card; already-relocated cards no-op immediately.
function unwrapFromHiddenAncestor(el, wrap) {
  let node = el;
  while (node.parentElement && node.parentElement !== wrap) {
    if (node.parentElement.classList.contains(HIDDEN_CLASS)) {
      wrap.appendChild(node);
      return;
    }
    node = node.parentElement;
  }
}

// The hover card is the one place absolute positioning still applies — it
// floats freely next to whichever pill is hovered and can't be expressed as
// normal document flow the way pills now are. It's always position:absolute
// (see the mockup's CSS), even while hidden, so its size can be measured via
// getBoundingClientRect() before it's shown. Its DOM position never changes
// on hover — same element, same spot in the tree the whole time (the only
// time it ever moves in the DOM is once, at init, if
// unwrapFromHiddenAncestor() has to rescue it from a hidden holder). Only
// its inline left/top and its classes change.
function showHoverCard(card, occurrence, event, pillEl, wrap, hoverState) {
  setDateFields(card, occurrence, event);

  // is-above/is-below (and whatever transform they carry — translate,
  // scale, anything the Designer adds) persist across a hide, since
  // hideHoverCard() only ever removes is-active. Just removing them here
  // isn't enough on its own, though: transform is covered by this
  // element's own `transition: transform ...` (see the mockup CSS), so
  // removing the class doesn't make the RENDERED transform snap to `none`
  // — it starts a brand-new transition FROM whatever scaled/translated
  // value was left over from the last time this card was shown, and
  // getBoundingClientRect() reports whatever's actually rendered
  // mid-transition, not the eventual target (unlike layout properties,
  // transform changes aren't forced to complete by reading layout — that's
  // the whole point of using transform for animation in the first place).
  // Killing the transition inline, then forcing a reflow so the browser
  // actually commits transform:none before we read anything, guarantees
  // cardRect below is the card's true, fully-settled, untransformed size —
  // regardless of what it was still animating from a moment ago. Restored
  // right after measuring so the reveal itself still animates normally.
  card.classList.remove('is-active', 'is-above', 'is-below');
  card.style.transition = 'none';
  void card.offsetHeight; // commit transition:none + the class removal above

  // Position relative to card.offsetParent — the nearest positioned
  // ancestor, i.e. exactly whichever element position:absolute actually
  // resolves against (see the .calendar_hover_card_wrap CSS rule in the
  // mockup). This is normally wrap itself (guaranteed position:relative —
  // see the mockup's .calendar_wrap rule — so it's always a valid stopping
  // point no matter where in the wrap the card physically lives, including
  // after unwrapFromHiddenAncestor() relocates it). Falling back to wrap
  // directly (not card.parentElement) if offsetParent is somehow null keeps
  // that same guarantee rather than risking an arbitrary, possibly
  // unpositioned, ancestor.
  const parent = card.offsetParent || wrap;
  const parentRect = parent.getBoundingClientRect();
  const targetRect = pillEl.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const gap = cssLengthToPx(getComputedStyle(card).getPropertyValue('--hover-card-gap')) ?? 16;
  card.style.transition = ''; // restore the CSS-defined transition for the reveal below

  // Left-align with the pill by default (not centered) — clamp so the card
  // never runs past the left or right edge of the calendar as a whole.
  const rawLeft = targetRect.left - parentRect.left;
  const left = Math.max(0, Math.min(rawLeft, parentRect.width - cardRect.width));

  // Vertical placement, in strict priority order:
  //   1. Distance from the pill — always exactly `gap`, never less. The card
  //      must never touch/cover the pill it's describing, full stop (an
  //      overlapping card also breaks hovering itself, since it then sits on
  //      top of the pill and intercepts the pointer, firing a premature
  //      mouseleave).
  //   2. Which side — above if the pill is in the top half of the
  //      *viewport*, below if it's in the bottom half. Always honored;
  //      never flipped based on available space, so the card is always on
  //      the side you'd expect.
  //   3. Staying within the calendar's own bounds — lowest priority, and
  //      NOT enforced: if honoring 1 and 2 means the card runs past the
  //      calendar's own top/bottom edge, that's accepted. The alternative
  //      (clamping) is what caused the overlap bug in the first place — it
  //      pushed the card back across the gap and into the pill whenever
  //      there wasn't enough room on the preferred side.
  const showBelow = targetRect.top < window.innerHeight / 2;
  const top = showBelow ? targetRect.bottom - parentRect.top + gap : targetRect.top - parentRect.top - cardRect.height - gap;

  debugLog('[calendar] showHoverCard — event:', event.name, '| left:', left, '| top:', top, '| showBelow:', showBelow, '| parent:', parent);

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;

  // is-above/is-below pick which direction the entrance slide comes from
  // (see the mockup's CSS) — set separately from is-active, and a frame
  // ahead of it, so the browser actually paints the offset/hidden starting
  // state instead of collapsing straight to the resting state (which is
  // what happens if every class changes in one synchronous batch — a
  // transition needs two distinct painted states to interpolate between).
  // This only delays the CSS transition's start, never the positioning
  // above, which is already applied synchronously. (is-active was already
  // cleared up front, before measuring — see the comment at the top of this
  // function.)
  card.classList.toggle('is-above', !showBelow);
  card.classList.toggle('is-below', showBelow);
  void card.offsetHeight; // force layout so the above state is committed/painted
  // Guard against a stale reveal: moving the mouse quickly across several
  // pills queues one of these rAF callbacks per hover, but a card's own
  // mouseenter/mouseleave already run synchronously and can flip
  // hoverState.activeCard on to someone else *before* this frame paints.
  // Without this check, an earlier card's queued callback would still fire
  // and force is-active back on after its own mouseleave already hid it —
  // this was the actual cause of cards getting stuck visible during fast
  // mouse movement, not a timing/duration issue a delay would have fixed.
  requestAnimationFrame(() => {
    if (hoverState.activeCard === card) card.classList.add('is-active');
  });
}

function hideHoverCard(card) {
  card?.classList.remove('is-active');
}

// ── Grid rendering ──────────────────────────────────────────────────────

function renderGrid({
  wrap,
  grid,
  dayCells,
  pillTemplate,
  spacerTemplate,
  hoverCardsBySlug,
  current,
  range,
  weekStartDay,
  dayPillLimit,
  linkFormat,
  overflowMode,
  expandedRows,
  showOutsideMonthEvents,
  hideInactiveRow,
  hoverState,
  events,
  today,
}) {
  const cellDates = range === 'week' ? computeWeekCells(current) : computeMonthCells(current, weekStartDay);
  let cellCount = Math.min(cellDates.length, dayCells.length);
  // The grid's 6th row (indices 35-41) is only ever needed when the active
  // month spills into it — shrinking cellCount here (instead of a separate
  // hide step) reuses the existing "beyond cellCount gets display:none"
  // logic below, and also keeps every downstream index-clamped calculation
  // (occurrence clipping, lane assignment, overflow) from ever touching
  // those now-hidden cells.
  if (hideInactiveRow && range === 'month' && cellCount === 42 && cellDates.slice(35, 42).every((c) => !c.inMonth)) {
    cellCount = 35;
  }
  const baseDate = cellDates[0].date;

  grid.classList.toggle('is-range-week', range === 'week');

  dayCells.forEach((cell, i) => {
    if (i >= cellCount) {
      cell.style.display = 'none';
      return;
    }
    cell.style.display = '';
    cell.classList.toggle('is-range-week', range === 'week');
    const { date, inMonth } = cellDates[i];
    cell.classList.toggle('is-outside', !inMonth);

    const numberEl = cell.querySelector(DAY_NUMBER);
    if (numberEl) {
      numberEl.textContent = String(date.getDate());
      numberEl.classList.toggle('is-today', isSameDay(date, today));
    }
    cell.querySelector(DAY_PILLS)?.replaceChildren();
    const moreEl = cell.querySelector(DAY_MORE);
    if (moreEl) {
      moreEl.textContent = '';
      moreEl.classList.remove('is-active');
      moreEl.removeAttribute('aria-expanded');
    }
  });

  if (!pillTemplate) return;

  // Widen the occurrence-collection window by one period on each side so a
  // multi-day event that crosses into the visible grid still generates.
  const paddedStart = getRangeBounds(stepCurrent(current, range, -1), range).start;
  const paddedEnd = getRangeBounds(stepCurrent(current, range, 1), range).end;

  // range="week" cells are always inMonth:true (see computeWeekCells), so
  // this clip is a no-op there regardless of the option's value.
  const inMonthClip = range === 'month' && !showOutsideMonthEvents ? inMonthBounds(cellDates) : null;

  const segments = [];
  events.forEach((event) => {
    getOccurrences(event, paddedStart, paddedEnd).forEach((occurrence) => {
      const rawStart = dayIndexOf(baseDate, occurrence.start);
      const rawEnd = dayIndexOf(baseDate, occurrence.end);
      if (rawEnd < 0 || rawStart > cellCount - 1) return; // doesn't touch the visible grid
      let startIndex = Math.max(0, rawStart);
      let endIndex = Math.min(cellCount - 1, rawEnd);
      if (inMonthClip) {
        // Clip further to the in-month portion only — a multi-day event
        // that starts in a leading outside-month day still shows, just
        // starting from the 1st rather than its true (off-grid) start.
        startIndex = Math.max(startIndex, inMonthClip.first);
        endIndex = Math.min(endIndex, inMonthClip.last);
        if (startIndex > endIndex) return; // entirely outside the current month
      }
      splitIntoSegments(startIndex, endIndex).forEach((seg, i, all) => {
        segments.push({
          ...seg,
          pos: all.length === 1 ? 'single' : i === 0 ? 'start' : i === all.length - 1 ? 'end' : 'middle',
          event,
          occurrence,
        });
      });
    });
  });

  assignLanes(segments);

  // Split into what actually renders (within this row's effective lane
  // limit) vs. what folds into "+N more", then fan each visible segment out
  // into one entry per day it covers — day-cell height and lane alignment
  // are both handled by CSS from here (see rendering model), no pixel math
  // needed.
  const overflowCount = new Array(cellCount).fill(0);
  const segmentsByDay = Array.from({ length: cellCount }, () => []);
  segments.forEach((seg) => {
    const row = Math.floor(seg.startIndex / 7);
    const rowFullyShown = overflowMode === 'show' || expandedRows.has(row);
    if (!rowFullyShown && seg.lane >= dayPillLimit) {
      for (let i = seg.startIndex; i <= seg.endIndex; i++) overflowCount[i]++;
      return;
    }
    for (let i = seg.startIndex; i <= seg.endIndex; i++) segmentsByDay[i].push(seg);
  });

  overflowCount.forEach((count, i) => {
    if (count === 0) return;
    const moreEl = dayCells[i]?.querySelector(DAY_MORE);
    if (!moreEl) return;
    moreEl.textContent = `+${count} more`;
    moreEl.classList.add('is-active');
    // aria-expanded only applies in "expand" mode — "hide" isn't a real
    // disclosure control (it never responds to a click) and "show" never
    // has anything to fold in the first place (day-pill-limit is bypassed
    // entirely, so overflowCount is always 0 there).
    if (overflowMode === 'expand') {
      const row = Math.floor(i / 7);
      moreEl.setAttribute('aria-expanded', expandedRows.has(row) ? 'true' : 'false');
    }
  });

  // aria-label per cell, combining the date with how many events actually
  // touch that day — segmentsByDay[i].length + overflowCount[i] is exactly
  // the count of distinct events on that day (a day only ever holds one
  // segment PIECE per event, never more than one, so no double-counting).
  for (let i = 0; i < cellCount; i++) {
    const cell = dayCells[i];
    if (!cell) continue;
    const eventCount = segmentsByDay[i].length + overflowCount[i];
    const dateLabel = formatOccurrenceDate(cellDates[i].date, 'dddd, MMMM D, YYYY');
    const countLabel = eventCount === 0 ? 'no events' : `${eventCount} event${eventCount === 1 ? '' : 's'}`;
    cell.setAttribute('aria-label', `${dateLabel}, ${countLabel}`);
  }

  const unmatchedSlugs = new Set();

  segmentsByDay.forEach((daySegments, dayIndex) => {
    if (daySegments.length === 0) return;
    const pillsEl = dayCells[dayIndex]?.querySelector(DAY_PILLS);
    if (!pillsEl) return;

    daySegments.sort((a, b) => a.lane - b.lane);
    let nextLane = 0;
    daySegments.forEach((seg) => {
      // A gap before this segment's lane (e.g. lane 0 is used by another
      // segment that doesn't touch this day, lane 1 is free here, this
      // segment is at lane 2) needs a spacer per skipped lane so this
      // piece still lines up with its true lane in neighboring day-cells.
      while (nextLane < seg.lane) {
        if (spacerTemplate) pillsEl.appendChild(spacerTemplate.cloneNode(true));
        nextLane++;
      }
      const pos =
        dayIndex === seg.startIndex && dayIndex === seg.endIndex
          ? 'single'
          : dayIndex === seg.startIndex
            ? 'start'
            : dayIndex === seg.endIndex
              ? 'end'
              : 'middle';
      const pill = createPill(pillTemplate, seg, pos, linkFormat, `cal-${dayIndex}-${seg.lane}`);
      pillsEl.appendChild(pill);
      // Diagnostic snapshot only, taken once at render time — the listeners
      // below look the card up fresh on every hover instead of closing over
      // this value, since hoverCardsBySlug can still be populating
      // asynchronously (see resolveHoverCards) when this pill is created; a
      // value baked in here could go stale the moment that population lands.
      if (!hoverCardsBySlug.has(seg.event.slug)) unmatchedSlugs.add(seg.event.slug);
      // Shared by mouse AND keyboard — a keyboard user tabbing to a pill
      // (focus) gets the exact same card reveal a mouse user hovering it
      // does; blur mirrors mouseleave. Focus/blur fire synchronously and
      // always paired correctly (unlike mouse events, which can be missed
      // during fast pointer movement — see the mouseleave-vs-focus split
      // below and the grid-level mouseleave backstop above), so no separate
      // keyboard backstop is needed the way the mouse path has one.
      const revealCard = () => {
        const card = hoverCardsBySlug.get(seg.event.slug);
        debugLog('[calendar] pill hover/focus — event:', seg.event.name, '| slug:', seg.event.slug, '| card found:', !!card);
        if (!card) return;
        // Force-hide whatever was previously shown first — a defensive
        // guarantee that at most one card is ever visible, even if some
        // prior mouseleave/blur was missed (e.g. because an earlier
        // positioning bug let a card overlap and intercept pointer events
        // for another pill — fixed above, but this stays as cheap insurance
        // regardless).
        if (hoverState.activeCard && hoverState.activeCard !== card) {
          hideHoverCard(hoverState.activeCard);
        }
        hoverState.activeCard = card;
        showHoverCard(card, seg.occurrence, seg.event, pill, wrap, hoverState);
      };
      const dismissCard = () => {
        const card = hoverCardsBySlug.get(seg.event.slug);
        debugLog('[calendar] pill unhover/blur — event:', seg.event.name);
        hideHoverCard(card);
        if (hoverState.activeCard === card) hoverState.activeCard = null;
      };
      pill.addEventListener('mouseenter', revealCard);
      pill.addEventListener('mouseleave', dismissCard);
      pill.addEventListener('focus', revealCard);
      pill.addEventListener('blur', dismissCard);
      nextLane++;
    });
  });

  if (unmatchedSlugs.size > 0) {
    console.warn(
      `calendar: rendered pill(s) for slug(s) with no matching [data-ix-events="hover-card"]: ${[...unmatchedSlugs].join(', ')}. Known hover-card slugs: ${[...hoverCardsBySlug.keys()].join(', ')}`
    );
  }
}

// The first/last row-major index in cellDates whose day genuinely belongs
// to the active month — used to clip occurrences out of the leading/
// trailing outside-month cells when show-outside-month is off. Relies on
// computeMonthCells always producing one contiguous inMonth run.
function inMonthBounds(cellDates) {
  const first = cellDates.findIndex((c) => c.inMonth);
  let last = first;
  cellDates.forEach((c, i) => {
    if (c.inMonth) last = i;
  });
  return { first, last };
}

function computeMonthCells(current, weekStartDay) {
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const leadingCount = (firstWeekday - weekStartDay + 7) % 7;
  const daysInThisMonth = daysInMonth(year, month);
  const prevMonthDays = daysInMonth(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);

  const cells = [];
  for (let i = leadingCount - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    cells.push({ date: new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d), inMonth: false });
  }
  for (let d = 1; d <= daysInThisMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: addDays(last, 1), inMonth: false });
  }
  return cells;
}

function computeWeekCells(current) {
  return Array.from({ length: 7 }, (_, i) => ({ date: addDays(current, i), inMonth: true }));
}

// ── Occurrence -> segment -> lane pipeline ──────────────────────────────

function dayIndexOf(baseDate, date) {
  return Math.round((startOfDay(date) - startOfDay(baseDate)) / 86400000);
}

// Clips one occurrence's [startIndex, endIndex] (already clamped to the
// visible grid) into one segment per week-row it crosses.
function splitIntoSegments(startIndex, endIndex) {
  const segments = [];
  let segStart = startIndex;
  for (let idx = startIndex; idx <= endIndex; idx++) {
    const isRowEnd = idx % 7 === 6;
    if (isRowEnd || idx === endIndex) {
      segments.push({ startIndex: segStart, endIndex: idx });
      segStart = idx + 1;
    }
  }
  return segments;
}

// Greedy lane assignment within each week-row so overlapping segments stack
// into separate lanes instead of colliding, while non-overlapping segments
// share a lane whenever possible. Mutates each segment with `.lane`. Sorted
// by start index first (unchanged — this is what an earlier revision got
// wrong: prioritizing multi-day segments into the lowest lanes
// UNCONDITIONALLY, regardless of start order, meant a single-day event with
// no real overlap could get displaced out of lane 0 by a multi-day event
// elsewhere in the row that starts later and never even touches that day,
// forcing an unnecessary [data-ix-events="calendar-pill-spacer"] above it
// purely for alignment with a lane it has nothing to do with — a real
// reported bug, visible as extra blank space above a pill for no apparent
// reason). The greedy reuse check below (`laneEnds[lane] < seg.startIndex`)
// already lets a later, non-overlapping segment reuse an earlier one's lane
// correctly regardless of which one is multi-day.
//
// For segments that share the same start day, sameDayPriority() breaks the
// tie in three tiers (confirmed with Caleb): 1) multi-day before single-day
// (longer-span-first among multi-day ties — the prior tiebreak, preserved
// for that narrower case), 2) among single-day segments, ones with no
// visible start time (Show Start Time off) before ones that show a time,
// 3) among the remaining timed single-day segments, earliest start time
// first. This is deliberately scoped to same-start-day ties only — it does
// NOT resurrect the reverted whole-row multi-day-first behavior above.
function sameDayPriority(seg) {
  if (seg.endIndex > seg.startIndex) return 0; // multi-day
  if (!seg.event.showStartTime) return 1; // single-day, no visible time
  return 2; // single-day, timed
}

function assignLanes(segments) {
  const byRow = new Map();
  segments.forEach((seg) => {
    const row = Math.floor(seg.startIndex / 7);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(seg);
  });
  byRow.forEach((rowSegments) => {
    rowSegments.sort((a, b) => {
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
      const priorityDiff = sameDayPriority(a) - sameDayPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      if (sameDayPriority(a) === 0) return b.endIndex - b.startIndex - (a.endIndex - a.startIndex);
      if (sameDayPriority(a) === 2) return a.occurrence.start - b.occurrence.start;
      return 0;
    });
    const laneEnds = [];
    rowSegments.forEach((seg) => {
      let lane = laneEnds.findIndex((end) => end < seg.startIndex);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(seg.endIndex);
      } else {
        laneEnds[lane] = seg.endIndex;
      }
      seg.lane = lane;
    });
  });
}

// ── Pill creation ────────────────────────────────────────────────────────

// Creates one pill PIECE for a single day-cell within a segment's span. Only
// the is-start/is-single piece (pos) carries real content — is-middle/
// is-end pieces stay empty so they render as a plain colored continuation
// of the bar (see the mockup's negative-margin bridging CSS). The date/time
// element is handled generically by setDateFields — set
// data-ix-events-date-format="TIME" or "TIME-SHORT" on it in the Designer
// for a time-only display driven by Show Start/End Time (see date-utils.js).
function createPill(pillTemplate, segment, pos, linkFormat, suffix) {
  const { event, occurrence } = segment;
  const clone = pillTemplate.cloneNode(true);
  uniquifyIds(clone, suffix);
  const hasContent = pos === 'start' || pos === 'single';
  if (hasContent) {
    setDateFields(clone, occurrence, event);
    Object.entries(PILL_TEXT_FIELDS).forEach(([attrName, getValue]) => {
      setField(clone, `[data-ix-events="${attrName}"]`, getValue(event));
    });
  } else {
    // is-middle/is-end pieces carry no text — they're a plain colored
    // continuation of the bar (see the rendering-model header comment) and
    // still keep their href so clicking/tapping anywhere along the bar
    // works, but they'd otherwise be empty, indistinguishable tab stops for
    // a keyboard user and empty "link" announcements for a screen reader.
    // Removed from the tab order and the accessibility tree entirely — the
    // is-start/is-single piece is what both should encounter instead.
    clone.setAttribute('tabindex', '-1');
    clone.setAttribute('aria-hidden', 'true');
  }
  clone.href = linkFormat.replace('{slug}', event.slug || '');
  clone.classList.add(`is-${pos}`);
  clone.classList.add(colorClass(event));
  return clone;
}

function setField(root, selector, value) {
  const el = root.querySelector(selector);
  if (el) el.textContent = value || '';
}

// Event Type-driven by default (e.g. "Gala" -> is-type-gala) so color-coding
// is meaningful and client-customizable directly in Webflow; falls back to a
// deterministic hash rotation when Event Type is blank.
function colorClass(event) {
  const slug = slugify(event.eventType);
  if (slug) return `is-type-${slug}`;
  return `is-color-${(simpleHash(event.id) % 3) + 1}`;
}

function slugify(str) {
  return (str || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash;
}

// ── Demo fallback ───────────────────────────────────────────────────────

function demoEvents() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  return [
    {
      id: 'demo-1',
      name: 'Community Meetup',
      slug: 'community-meetup',
      startDate: new Date(y, m, 8, 18, 0),
      endDate: new Date(y, m, 8, 20, 0),
      showStartTime: true,
      showEndTime: true,
      showEndDate: false,
      eventType: 'Meeting',
      shortDescription: 'Join us for our monthly community gathering.',
      location: 'Community Center',
      address: '',
      timezone: '',
      recurringFrequency: 'None',
      recurringInterval: 1,
      recurringDays: [],
      recurringSkipDates: [],
    },
    {
      id: 'demo-2',
      name: 'Volunteer Week',
      slug: 'volunteer-week',
      startDate: new Date(y, m, 20, 9, 0),
      endDate: new Date(y, m, 24, 17, 0),
      showStartTime: false,
      showEndTime: false,
      showEndDate: true,
      eventType: 'Workshop',
      shortDescription: 'A full week of volunteer opportunities.',
      location: 'Various Locations',
      address: '',
      timezone: '',
      recurringFrequency: 'None',
      recurringInterval: 1,
      recurringDays: [],
      recurringSkipDates: [],
    },
    {
      id: 'demo-3',
      name: 'Small Group',
      slug: 'small-group',
      startDate: new Date(y, m, 3, 18, 0),
      endDate: new Date(y, m, 3, 19, 30),
      showStartTime: true,
      showEndTime: true,
      showEndDate: false,
      eventType: 'Meeting',
      shortDescription: 'Biweekly small group discussion.',
      location: 'Room 204',
      address: '',
      timezone: '',
      recurringFrequency: 'Weekly',
      recurringInterval: 2,
      recurringDays: [],
      recurringSkipDates: [],
    },
  ];
}

// ── Helpers ─────────────────────────────────────────────────────────────

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
