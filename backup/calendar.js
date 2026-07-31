import { attr, uniquifyIds } from './utilities';
import { getOccurrences } from './recurrence';
import { whenEvents } from './event-data';
import { startOfDay, addDays, anchorFor, getRangeBounds, stepCurrent, formatOccurrenceDate, formatWeekLabel, setDateFields } from './date-utils';

// ============================================================================
// calendar: month/week-grid Calendar (data-ix-events-layout="calendar")
// ============================================================================
//
// Webflow-authored, JS-driven rewrite of the original JS-generated calendar —
// every visual element (grid, day cells, pills, hover card, loading/demo
// states) is built by the Designer; this script only supplies dates/data and
// positions the pill/spanning-bar layer. See design/calendar-mockup.html for
// a reference build and plan §9 (gentle-singing-tome.md) for the full design
// rationale. Reads event data through event-data.js's whenEvents(), the same
// page-wide [data-ix-events="data-wrap"] lookup event-list.js uses.
//
// Required structure per instance (see the mockup for the full markup):
//   [data-ix-events="wrap"] [data-ix-events-layout="calendar"]
//     [data-ix-events="prev"] / "next"        optional — step back/forward
//                                               one month or week (per range)
//     [data-ix-events="today"]                optional — jump to today
//     [data-ix-events="label"]                text — active month/week
//     [data-ix-events="weekday-label"]        x7 — weekday header text
//     [data-ix-events="grid"]                 CSS-position:relative container
//       [data-ix-events="day-cell"]           x42, DOM order = row-major
//         [data-ix-events="day-number"]
//         [data-ix-events="day-more"]         optional — "+N more" overflow
//       [data-ix-events="pill-overlay"]       empty — JS positions pills here
//     [data-ix-events="loading"]              optional — visible by default
//     [data-ix-events="demo-note"]            optional — hidden by default
//     [data-ix-events="hover-cards"]          optional — one hover-card per event
//       [data-ix-events="hover-card"]
//         data-ix-events-slug="{{wf:Slug}}"
//     [data-ix-events="calendar-pill"]        hidden template, cloned per
//                                               occurrence-segment. Root is an
//                                               <a>; may contain any of:
//       [data-ix-events="name"|"event-type"|"short-description"|"location"
//                        |"address"|"timezone"|"date"]
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
//     max visible occurrence lanes per day before folding into "+N more" (or
//     "Show more" — see overflow-items below).
//   data-ix-events-link-format="/event/{slug}" (default)
//     pill href template, {slug} token-replaced.
//   data-ix-events-overflow-items="hide" (default) | "expand" | "show"
//     what happens to lanes beyond day-pill-limit in a given week-row:
//       hide   — folds into a static "+N more" count on each overflowing day,
//                nothing else rendered. Size day-cell min-height to
//                comfortably fit day-pill-limit lanes; this is the only mode
//                where day cells never grow beyond their authored height.
//       expand — folds into a clickable "Show more" on each overflowing day;
//                clicking it reveals every hidden lane for that WHOLE
//                week-row (lanes are row-scoped, not per-day, so revealing
//                is too) and grows every day-cell in that row's min-height
//                to fit. Resets whenever the active month/week changes.
//       show   — day-pill-limit is bypassed entirely; every row's day-cells
//                grow (if needed) to fit however many lanes that row
//                actually needs, computed once when the calendar first
//                renders that range. No "+N more"/"Show more" ever appears.
//   data-ix-events-show-outside-month="false" (default) | "true"
//     range="month" only. false — occurrences are never added to the
//     leading/trailing days from adjacent months (a multi-day event is
//     clipped to just its portion inside the active month). true — outside
//     days get occurrences exactly like any other visible day.
//
// Rendering model: every occurrence (single- or multi-day) is clipped to the
// visible day cells, split into one segment per week-row it crosses, and
// lane-assigned within that row so overlapping events stack instead of
// colliding. Segments are positioned by MEASURING the actual rendered day
// cells (getBoundingClientRect), not by assuming a specific CSS grid — so the
// Designer can lay day cells out however they want (grid, flex-wrap,
// anything with 7-per-row and consistent geometry) and positioning adapts
// automatically. A segment's outer edges (the occurrence's true start/end)
// are inset by the day-cell's own horizontal padding, same as any other
// cell content; a segment's inner edges (where it continues to/from another
// week-row) run flush to the cell edge instead, so consecutive segments
// read as one continuous bar.
//
// Since that measurement is only ever a snapshot, a ResizeObserver on the
// grid re-measures and repositions the already-rendered pills (not a full
// re-render — the occurrences/segments/lanes haven't changed, only their
// pixel geometry) whenever the grid's box actually changes size — window
// resize, a Webflow breakpoint, a container query, anything — so pills
// never go visually stale relative to their day cells.
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
const DAY_MORE = '[data-ix-events="day-more"]';
const PILL_OVERLAY = '[data-ix-events="pill-overlay"]';
const PILL_TEMPLATE = '[data-ix-events="calendar-pill"]';
const LOADING = '[data-ix-events="loading"]';
const DEMO_NOTE = '[data-ix-events="demo-note"]';
const HOVER_CARD = '[data-ix-events="hover-card"]';
const SLUG_ATTR = 'data-ix-events-slug';
const NAME_EL = '[data-ix-events="name"]';
const EVENT_TYPE_EL = '[data-ix-events="event-type"]';
const SHORT_DESC_EL = '[data-ix-events="short-description"]';
const LOCATION_EL = '[data-ix-events="location"]';
const ADDRESS_EL = '[data-ix-events="address"]';
const TIMEZONE_EL = '[data-ix-events="timezone"]';
const DISABLED_CLASS = 'is-disabled';
const HIDDEN_CLASS = 'u-display-none';
const PILL_LANE_GAP = 4; // px, gap between stacked pill lanes in the same row

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const calendar = function () {
  const wraps = [...document.querySelectorAll(WRAP)].filter(
    (wrap) => wrap.getAttribute('data-ix-events-layout') === LAYOUT
  );
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => initCalendar(wrap));
};

function initCalendar(wrap) {
  const grid = wrap.querySelector(GRID);
  const dayCells = grid ? [...grid.querySelectorAll(DAY_CELL)] : [];
  const pillOverlay = grid?.querySelector(PILL_OVERLAY);
  const pillTemplate = wrap.querySelector(PILL_TEMPLATE);
  if (!grid || dayCells.length === 0) {
    console.warn('calendar: no [data-ix-events="grid"] with [data-ix-events="day-cell"] children found.', wrap);
    return;
  }

  const months = attr(6, wrap.getAttribute(`data-ix-${ANIMATION_ID}-months`));
  let range = attr('month', wrap.getAttribute(`data-ix-${ANIMATION_ID}-range`)?.toLowerCase());
  if (range !== 'month' && range !== 'week') range = 'month';
  const weekStartDay =
    attr('sunday', wrap.getAttribute(`data-ix-${ANIMATION_ID}-week-start`)?.toLowerCase()) === 'monday' ? 1 : 0;
  const dayPillLimit = attr(3, wrap.getAttribute(`data-ix-${ANIMATION_ID}-day-pill-limit`));
  const linkFormat = attr('/event/{slug}', wrap.getAttribute(`data-ix-${ANIMATION_ID}-link-format`));
  let overflowMode = attr('hide', wrap.getAttribute(`data-ix-${ANIMATION_ID}-overflow-items`)?.toLowerCase());
  if (!['hide', 'expand', 'show'].includes(overflowMode)) overflowMode = 'hide';
  const showOutsideMonthEvents = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-show-outside-month`));

  const label = wrap.querySelector(LABEL);
  const prevBtn = wrap.querySelector(PREV_BTN);
  const nextBtn = wrap.querySelector(NEXT_BTN);
  const todayBtn = wrap.querySelector(TODAY_BTN);
  const weekdayLabels = [...wrap.querySelectorAll(WEEKDAY_LABEL)];
  const loadingEl = wrap.querySelector(LOADING);
  const demoNoteEl = wrap.querySelector(DEMO_NOTE);
  const hoverCardsBySlug = buildHoverCardMap(wrap);

  if (!pillTemplate) {
    console.warn('calendar: no [data-ix-events="calendar-pill"] template found — no events will render.', wrap);
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
  // manually revealed via "Show more" — overflow-items="expand" only.
  // Row indices are meaningless once the active month/week changes, so this
  // resets on every navigation (see the nav click handlers below).
  const expandedRows = new Set();
  // The pills/row-lane-counts from the most recent renderGrid() call, kept
  // around so a resize can reposition the existing pills (see
  // repositionPills below) without redoing the whole occurrence/segment/lane
  // pipeline — only the pixel geometry needs recomputing, not what's visible.
  let lastRender = { created: [], rowLaneCounts: new Map(), cellCount: 0 };

  function updateNavState() {
    if (prevBtn) prevBtn.classList.toggle(DISABLED_CLASS, !canGoPrev(current));
    if (nextBtn) nextBtn.classList.toggle(DISABLED_CLASS, !canGoNext(current));
    if (todayBtn) todayBtn.classList.toggle(DISABLED_CLASS, isTodayActive(current));
  }

  function refresh() {
    if (label) {
      const format = attr('', label.getAttribute('data-ix-events-label-format'));
      label.textContent =
        range === 'week' ? formatWeekLabel(current, format || undefined) : formatOccurrenceDate(current, format || 'MMMM YYYY');
    }
    updateNavState();
    lastRender = renderGrid({
      grid,
      dayCells,
      pillOverlay,
      pillTemplate,
      hoverCardsBySlug,
      current,
      range,
      weekStartDay,
      dayPillLimit,
      linkFormat,
      overflowMode,
      expandedRows,
      showOutsideMonthEvents,
      events: state.events,
      today,
    });
  }

  refresh(); // render an empty grid immediately, then fill in once events load

  // The grid's own box changing size — window resize, a Webflow breakpoint
  // kicking in, a container query, a sidebar toggling — leaves every pill's
  // inline left/width/top stale, since those were only ever computed once
  // at render time. Re-measure and reposition (not a full re-render — the
  // occurrences/segments/lanes haven't changed, only their pixel geometry)
  // whenever the grid's rendered size actually changes. Debounced since
  // ResizeObserver can fire in rapid bursts during a continuous drag-resize.
  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => repositionPills(), 100);
  }).observe(grid);

  function repositionPills() {
    if (lastRender.created.length === 0) return;
    const overlayRect = pillOverlay.getBoundingClientRect();
    const laneHeight =
      Math.max(...lastRender.created.map(({ pill }) => pill.getBoundingClientRect().height)) + PILL_LANE_GAP;
    console.log('[calendar] DEBUG repositionPills: grid resized, repositioning', lastRender.created.length, 'pills | re-measured laneHeight:', laneHeight);
    lastRender.rowLaneCounts.forEach((laneCount, row) => {
      const rowFullyShown = overflowMode === 'show' || expandedRows.has(row);
      const laneTarget = rowFullyShown ? laneCount : Math.min(laneCount, dayPillLimit);
      growRow(dayCells, lastRender.cellCount, row, laneTarget, laneHeight);
    });
    lastRender.created.forEach(({ pill, seg }) => {
      positionPillLeftWidth(pill, seg, dayCells, overlayRect);
      positionPillTop(pill, seg, dayCells, overlayRect, laneHeight);
    });
  }

  if (overflowMode === 'expand') {
    // Delegated once, not re-bound per render — lanes are row-scoped, so
    // clicking "Show more" on any day in a row reveals that whole row's
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

  whenEvents((events) => {
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

// Cards don't need a dedicated [data-ix-events="hover-cards"] wrapper — any
// [data-ix-events="hover-card"] anywhere in the wrap is found directly. The
// slug can live on the card itself OR any ancestor up to the card (e.g. a
// CMS Collection Item wrapper carrying the slug, with the visible card as
// its child — the same shape List View's separate mode already uses).
function buildHoverCardMap(wrap) {
  const map = new Map();
  wrap.querySelectorAll(HOVER_CARD).forEach((card) => {
    unwrapFromHiddenAncestor(card, wrap);
    const slugEl = card.closest(`[${SLUG_ATTR}]`);
    const slug = slugEl?.getAttribute(SLUG_ATTR);
    if (slug) map.set(slug, card);
  });
  return map;
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

function showHoverCard(card, occurrence, event, pillEl) {
  setDateFields(card, occurrence, event);
  card.classList.add('is-active');

  // Position relative to card.offsetParent — the nearest positioned
  // ancestor, i.e. exactly whichever element position:absolute actually
  // resolves against (see the .calendar_hover_card_wrap.is-active CSS rule
  // in the mockup). Reading it directly from the DOM avoids hard-coding
  // which class/element the Designer used for that positioning context.
  const parent = card.offsetParent || card.parentElement;
  const parentRect = parent.getBoundingClientRect();
  const targetRect = pillEl.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  const rawX = targetRect.left - parentRect.left + targetRect.width / 2;
  const clampedCenterX = Math.max(cardRect.width / 2, Math.min(rawX, parentRect.width - cardRect.width / 2));
  const spaceAbove = targetRect.top - parentRect.top;
  const showAbove = spaceAbove >= cardRect.height + PILL_LANE_GAP * 2;

  card.style.left = `${clampedCenterX - cardRect.width / 2}px`;
  card.style.top = showAbove
    ? `${targetRect.top - parentRect.top - cardRect.height - PILL_LANE_GAP * 2}px`
    : `${targetRect.bottom - parentRect.top + PILL_LANE_GAP * 2}px`;
}

function hideHoverCard(card) {
  card?.classList.remove('is-active');
}

// ── Grid rendering ──────────────────────────────────────────────────────

function renderGrid({
  grid,
  dayCells,
  pillOverlay,
  pillTemplate,
  hoverCardsBySlug,
  current,
  range,
  weekStartDay,
  dayPillLimit,
  linkFormat,
  overflowMode,
  expandedRows,
  showOutsideMonthEvents,
  events,
  today,
}) {
  const cellDates = range === 'week' ? computeWeekCells(current) : computeMonthCells(current, weekStartDay);
  const cellCount = Math.min(cellDates.length, dayCells.length);
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
    const moreEl = cell.querySelector(DAY_MORE);
    if (moreEl) {
      moreEl.textContent = '';
      moreEl.classList.remove('is-active');
    }
  });

  if (pillOverlay) pillOverlay.replaceChildren();
  if (!pillTemplate || !pillOverlay) return { created: [], rowLaneCounts: new Map(), cellCount };

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
  const rowLaneCounts = maxLaneCountByRow(segments);

  const overflowCount = new Array(cellCount).fill(0);
  const visibleSegments = [];
  segments.forEach((seg) => {
    const row = Math.floor(seg.startIndex / 7);
    const rowFullyShown = overflowMode === 'show' || expandedRows.has(row);
    if (!rowFullyShown && seg.lane >= dayPillLimit) {
      for (let i = seg.startIndex; i <= seg.endIndex; i++) overflowCount[i]++;
    } else {
      visibleSegments.push(seg);
    }
  });

  overflowCount.forEach((count, i) => {
    if (count === 0) return;
    const moreEl = dayCells[i]?.querySelector(DAY_MORE);
    if (!moreEl) return;
    moreEl.textContent = overflowMode === 'expand' ? 'Show more' : `+${count} more`;
    moreEl.classList.add('is-active');
  });

  if (visibleSegments.length === 0) return { created: [], rowLaneCounts, cellCount };

  const overlayRect = pillOverlay.getBoundingClientRect();

  // Two-pass: first create every real pill (populated content, correct
  // left/width per segment) but hidden and with no `top` yet, so we can
  // measure each one's ACTUAL rendered height — a real pill's height
  // depends on its real text and its real (narrow, day-cell-width)
  // constraint, so an empty/unconstrained stand-in measured in isolation
  // reliably undershoots. Once every pill's true height is known, the
  // tallest one sets the lane height used to place them all.
  const created = visibleSegments.map((seg, i) => {
    const pill = createPill(pillTemplate, seg, dayCells, overlayRect, linkFormat, `cal-${i}`);
    pill.style.visibility = 'hidden';
    pillOverlay.appendChild(pill);
    if (hoverCardsBySlug.size > 0) {
      const card = hoverCardsBySlug.get(seg.event.slug);
      if (card) {
        pill.addEventListener('mouseenter', () => showHoverCard(card, seg.occurrence, seg.event, pill));
        pill.addEventListener('mouseleave', () => hideHoverCard(card));
      }
    }
    return { pill, seg };
  });

  const laneHeight = Math.max(...created.map(({ pill }) => pill.getBoundingClientRect().height)) + PILL_LANE_GAP;
  console.log('[calendar] DEBUG measured laneHeight from', created.length, 'real pills:', laneHeight, '| individual heights:', created.map(({ pill }) => pill.getBoundingClientRect().height));

  // Every row grows (only if needed — never shrinks below what the Designer
  // authored) to comfortably fit whatever's actually visible in it: up to
  // day-pill-limit lanes in "hide" mode or a not-yet-expanded "expand" row,
  // or every lane it needs in "show" mode / an expanded row. Must happen
  // before positioning below, since positioning measures each day-cell's
  // live rect and needs the grown height already in effect.
  rowLaneCounts.forEach((laneCount, row) => {
    const rowFullyShown = overflowMode === 'show' || expandedRows.has(row);
    const laneTarget = rowFullyShown ? laneCount : Math.min(laneCount, dayPillLimit);
    growRow(dayCells, cellCount, row, laneTarget, laneHeight);
  });

  created.forEach(({ pill, seg }) => {
    positionPillTop(pill, seg, dayCells, overlayRect, laneHeight);
    pill.style.visibility = '';
  });

  return { created, rowLaneCounts, cellCount };
}

// The tallest lane index used in each week-row (as a lane COUNT, i.e. +1),
// across every segment regardless of dayPillLimit — used to know how tall a
// row needs to grow in "show" mode or once a row is expanded.
function maxLaneCountByRow(segments) {
  const map = new Map();
  segments.forEach((seg) => {
    const row = Math.floor(seg.startIndex / 7);
    map.set(row, Math.max(map.get(row) || 0, seg.lane + 1));
  });
  return map;
}

// Grows every day-cell in a week-row's min-height (never shrinks below
// whatever the Designer authored) to comfortably fit laneCount lanes below
// the day-number. Setting it on every cell in the row (not just one) is
// belt-and-suspenders — CSS Grid's own auto-row-sizing would stretch the
// whole row to match its tallest cell regardless, but this keeps DevTools
// inspection unsurprising (every cell in an expanded/shown row reports the
// same min-height, not one mysterious outlier).
function growRow(dayCells, cellCount, row, laneCount, laneHeight) {
  for (let i = row * 7; i < Math.min(row * 7 + 7, cellCount); i++) {
    const cell = dayCells[i];
    if (!cell) continue;
    const cellTop = cell.getBoundingClientRect().top;
    const startOffset = pillsStartY(cell) - cellTop;
    const neededHeight = startOffset + laneCount * laneHeight + PILL_LANE_GAP;
    if (neededHeight > cell.getBoundingClientRect().height) {
      cell.style.minHeight = `${neededHeight}px`;
    }
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
// into separate lanes instead of colliding. Mutates each segment with `.lane`.
function assignLanes(segments) {
  const byRow = new Map();
  segments.forEach((seg) => {
    const row = Math.floor(seg.startIndex / 7);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(seg);
  });
  byRow.forEach((rowSegments) => {
    rowSegments.sort((a, b) => a.startIndex - b.startIndex || b.endIndex - b.startIndex - (a.endIndex - a.startIndex));
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

// ── Pill creation & positioning ─────────────────────────────────────────

// Creates one pill with real content and its correct left/width, but no
// `top` yet (see the two-pass comment at the call site) and position:
// absolute so its rendered height can be measured before anything is placed.
function createPill(pillTemplate, segment, dayCells, overlayRect, linkFormat, suffix) {
  const { event, occurrence, pos } = segment;
  const clone = pillTemplate.cloneNode(true);
  clone.classList.remove(HIDDEN_CLASS);
  uniquifyIds(clone, suffix);
  setDateFields(clone, occurrence, event);
  setField(clone, NAME_EL, event.name);
  setField(clone, EVENT_TYPE_EL, event.eventType);
  setField(clone, SHORT_DESC_EL, event.shortDescription);
  setField(clone, LOCATION_EL, event.location);
  setField(clone, ADDRESS_EL, event.address);
  setField(clone, TIMEZONE_EL, event.timezone);
  clone.href = linkFormat.replace('{slug}', event.slug || '');
  clone.classList.add(`is-${pos}`);
  clone.classList.add(colorClass(event));
  clone.style.position = 'absolute';
  positionPillLeftWidth(clone, segment, dayCells, overlayRect);
  return clone;
}

// Outer edges (the occurrence's true start/end) inset by the day-cell's own
// horizontal padding, same as any other cell content. Inner edges (where
// this segment continues to/from another week-row) run flush to the cell
// edge instead, so consecutive segments read as one bar. Shared between
// initial creation and resize-driven repositioning so both always agree.
function positionPillLeftWidth(el, segment, dayCells, overlayRect) {
  const { pos } = segment;
  const startCell = dayCells[segment.startIndex];
  const endCell = dayCells[segment.endIndex];
  const startRect = startCell.getBoundingClientRect();
  const endRect = endCell.getBoundingClientRect();
  const insetLeft = pos === 'single' || pos === 'start' ? parseFloat(getComputedStyle(startCell).paddingLeft) || 0 : 0;
  const insetRight = pos === 'single' || pos === 'end' ? parseFloat(getComputedStyle(endCell).paddingRight) || 0 : 0;
  el.style.left = `${startRect.left - overlayRect.left + insetLeft}px`;
  el.style.width = `${endRect.right - startRect.left - insetLeft - insetRight}px`;
}

function setField(root, selector, value) {
  const el = root.querySelector(selector);
  if (el) el.textContent = value || '';
}

function positionPillTop(el, segment, dayCells, overlayRect, laneHeight) {
  const startY = pillsStartY(dayCells[segment.startIndex]);
  const top = startY - overlayRect.top + segment.lane * laneHeight;
  el.style.top = `${top}px`;
  console.log('[calendar] DEBUG positionPillTop:', el.querySelector(NAME_EL)?.textContent, '| startIndex:', segment.startIndex, '| lane:', segment.lane, '| laneHeight:', laneHeight, '| top:', top, '| pill rendered rect:', el.getBoundingClientRect());
}

// Pills live in a separate absolutely-positioned overlay, not in each day
// cell's own document flow — so without this, they'd start flush with the
// cell's own top edge, landing directly on top of the day number instead of
// below it. Anchor to the day-number's own bottom edge (plus whatever gap
// the cell's own flex layout specifies between its children) instead of the
// cell's border-box top, so pills respect whatever spacing the Designer set
// without needing it duplicated/guessed here.
function pillsStartY(dayCell) {
  const numberEl = dayCell.querySelector(DAY_NUMBER);
  if (!numberEl) return dayCell.getBoundingClientRect().top;
  const rowGap = parseFloat(getComputedStyle(dayCell).rowGap) || 0;
  return numberEl.getBoundingClientRect().bottom + rowGap;
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
