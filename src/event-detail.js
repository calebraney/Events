import { attr, uniquifyIds, debugLog, announceLiveRegion } from './utilities';
import { getOccurrences, parseEventFromJSON } from './recurrence';
import { expandingWindowSearch, SEARCH_CAP, setDateFields, applyDateFormat } from './date-utils';
import { createOccurrenceCard, readItemCount, CLONE_ATTR } from './event-list';

// ============================================================================
// event-detail: single-event CMS template page (data-ix-events-layout="detail")
// ============================================================================
//
// For the Event collection's own item ("template") page — exactly one event,
// rendered directly by Webflow (no Collection List involved). Reads its own
// hidden JSON via parseEventFromJSON() synchronously, bypassing
// event-data.js's whenEvents() entirely — that module's retry loop and
// Finsweet-pagination-await exist for late-rendering Collection List items,
// neither of which applies to a single server-rendered blob.
//
// Safe to nest another instance's wrap inside this one — e.g. an "Other
// Upcoming Events" Feed section on the same template page. Every lookup
// below (queryOwn()) only matches elements whose NEAREST ancestor of the
// relevant kind (wrap, or dates-list — see below) is the container actually
// being searched, so a nested Feed's own elements — or a different
// dates-list's own template/load-more — are never mistaken for this one's
// own.
//
// Required structure per instance:
//   [data-ix-events="wrap"] [data-ix-events-layout="detail"]   component root
//     [data-ix-events="data"]   <script type="application/json"> — this
//                                 page's own event fields, same shape as
//                                 every other view's hidden JSON embed (see
//                                 README.md).
//     [data-ix-events="next-date"]   optional — the next upcoming
//                                 occurrence's date. Non-recurring events
//                                 always use their own Start/End Date (even
//                                 if in the past — there's no other sensible
//                                 value). For a recurring event whose series
//                                 has already ended, this element is hidden
//                                 entirely. Put data-ix-events-date-format
//                                 directly on this element and its own text
//                                 updates (same contract as every other view
//                                 — tokens / FULLDATE / TIME / TIME-SHORT) —
//                                 OR nest a separate [data-ix-events="date"]
//                                 child inside it instead, if you need other
//                                 markup (an icon, a label) alongside the
//                                 date text; when a nested date child exists,
//                                 that's what gets updated instead of this
//                                 element's own text.
//     [data-ix-events="dates-list"]   optional, repeatable — a wrapper
//                                 that both holds this list's own options
//                                 (below) and is what clones get appended
//                                 into. A page can have more than one, e.g. a
//                                 short "upcoming" list and a separate "past"
//                                 list — each configured independently.
//                                 Hidden entirely (display: none) if this
//                                 specific list has zero occurrences on
//                                 init — e.g. an "upcoming" list for an event
//                                 whose recurring series has already ended.
//       [data-ix-events="dates-item"]   template row for one occurrence.
//                                 Hidden after init; clones are appended
//                                 into dates-list, after this element.
//                                 Put data-ix-events-date-format directly on
//                                 this element and its own text updates —
//                                 same "one attribute is enough" fallback as
//                                 next-date — OR nest a separate
//                                 [data-ix-events="date"] child instead if
//                                 you need other markup alongside the date.
//         [data-ix-events="date"]    same date-format contract.
//       [data-ix-events="load-more-wrap"]   optional — see item-count below.
//         [data-ix-events="load-more"]        optional — button, reveals the
//                                 next batch of this list's occurrences.
//
// Options (read from each dates-list element, NOT the wrap — a page can have
// several dates-lists, each with its own settings):
//   data-ix-events-filter="upcoming" (default) | "past" | "all"
//     WHICH occurrences are candidates — independent of display order (see
//     data-ix-events-sort below). upcoming — only occurrences on/after
//     today. past — only occurrences that have already ended. all — no
//     time-based filtering, bounded to +/- 3 years from today (or the
//     event's own Start Date / Recurring End Date if those are narrower) —
//     a truly unbounded recurring series has no literal "all."
//   data-ix-events-sort="earliest-first" | "latest-first"
//     display order, independent of filter — unset (default) is contextual:
//     latest-first when filter="past", earliest-first otherwise. Set
//     explicitly to override, e.g. filter="all" + sort="latest-first" for
//     the full history newest-first instead of oldest-first.
//   data-ix-events-item-count="12" (default)
//     how many occurrence rows to reveal on init and per "Load More" click.
//     Same name/meaning as List View and Feed View's option.
//
// Renamed from data-ix-events-dates-filter, and split into two independent
// options (filter + sort) — existing instances need updating. Shares this
// filter/sort split with Feed View (event-list.js) — see that file's header
// comment for the "why split" rationale.
// ============================================================================

const ANIMATION_ID = 'events';
const DETAIL_LAYOUT = 'detail';

const WRAP = '[data-ix-events="wrap"]';
const DATA_EL = '[data-ix-events="data"]';
const NEXT_DATE_EL = '[data-ix-events="next-date"]';
const DATES_LIST = '[data-ix-events="dates-list"]';
const DATES_ITEM = '[data-ix-events="dates-item"]';
const DATE_EL = '[data-ix-events="date"]';
const LOAD_MORE_WRAP = '[data-ix-events="load-more-wrap"]';
const LOAD_MORE_BTN = '[data-ix-events="load-more"]';
const INITIALIZED_ATTR = 'data-ix-events-initialized';

const ALL_RANGE_YEARS = 3; // matches Feed View's existing forward-search safety margin

// Marks `wrap` as processed and returns true the FIRST time it's called for
// a given wrap, false every time after — guards against a wrap getting
// initialized twice (e.g. a page-transition script re-running this bundle
// on soft navigation, without a full page reload). Without this, a second
// pass's dates-item lookup could grab a clone left over from the first pass
// instead of the real template (see the CLONE_ATTR filter below), and each
// dates-list would independently append a whole extra batch on top of the
// first pass's, since renderedCount starts fresh at 0 in a new closure with
// no memory of what already rendered.
function claimForInit(wrap) {
  if (wrap.hasAttribute(INITIALIZED_ATTR)) return false;
  wrap.setAttribute(INITIALIZED_ATTR, '');
  return true;
}

// Finds descendant(s) of `scope` matching `selector` whose NEAREST ancestor
// matching `boundarySelector` is `scope` itself — not a plain
// scope.querySelector(All), which would recurse into a nested same-kind
// container's own elements too. Used both for wrap-nesting (a Feed section
// inside a detail wrap) and list-nesting (one dates-list's template/
// load-more never bleeding into a sibling dates-list's).
function queryOwn(scope, selector, boundarySelector = WRAP) {
  return [...scope.querySelectorAll(selector)].find((el) => el.closest(boundarySelector) === scope) || null;
}
function queryOwnAll(scope, selector, boundarySelector = WRAP) {
  return [...scope.querySelectorAll(selector)].filter((el) => el.closest(boundarySelector) === scope);
}

// Applies date-format text to a nested [data-ix-events="date"] child if one
// exists, otherwise to `el` itself (reading data-ix-events-date-format
// directly off it) — the "one attribute is enough" fallback shared by both
// next-date and each dates-item clone below.
function applyOwnOrNestedDate(el, occurrence, event) {
  if (el.querySelector(DATE_EL)) {
    setDateFields(el, occurrence, event);
  } else {
    applyDateFormat(el, occurrence, event);
  }
}

export const eventDetail = function () {
  const wraps = [...document.querySelectorAll(WRAP)].filter(
    (wrap) => wrap.getAttribute('data-ix-events-layout') === DETAIL_LAYOUT
  );
  debugLog('[event-detail] wraps with layout="detail" found:', wraps.length, wraps);
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    if (!claimForInit(wrap)) {
      debugLog('[event-detail] wrap already initialized, skipping:', wrap);
      return;
    }
    const event = parseWrapEvent(wrap);
    if (!event) return;
    renderNextOccurrence(wrap, event);
    queryOwnAll(wrap, DATES_LIST).forEach((listEl, i) => initDatesList(listEl, event, i));
  });
};

function parseWrapEvent(wrap) {
  const dataEl = queryOwn(wrap, DATA_EL);
  if (!dataEl) {
    console.warn('event-detail: no [data-ix-events="data"] found in this wrap.', wrap);
    return null;
  }
  try {
    const event = parseEventFromJSON(JSON.parse(dataEl.textContent));
    if (!event.startDate) {
      console.warn('event-detail: event JSON has no valid Start Date.', wrap);
      return null;
    }
    return event;
  } catch (e) {
    console.warn('event-detail: could not parse event JSON', wrap, e);
    return null;
  }
}

// Non-recurring events have nothing to search for — they simply ARE their
// own next (or only) occurrence, past or future. Recurring events search
// forward from today for the soonest occurrence that hasn't ended yet.
export function findNextOccurrence(event) {
  if (!event.recurringFrequency || event.recurringFrequency === 'None') {
    return { start: event.startDate, end: event.endDate || event.startDate };
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const results = expandingWindowSearch({
    anchor: today,
    period: 'month',
    direction: 'upcoming',
    targetCount: 1,
    maxIterations: SEARCH_CAP,
    search: (start, end) =>
      getOccurrences(event, start, end)
        .filter((occ) => occ.end >= now)
        .sort((a, b) => a.start - b.start),
  });
  return results[0] || null;
}

function renderNextOccurrence(wrap, event) {
  const el = queryOwn(wrap, NEXT_DATE_EL);
  if (!el) return;
  const occurrence = findNextOccurrence(event);
  debugLog('[event-detail] next occurrence for', event.name, ':', occurrence);
  if (!occurrence) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  applyOwnOrNestedDate(el, occurrence, event);
}

// data-ix-events-filter="all" isn't an expanding search — it's one bounded
// getOccurrences() call, computed once. The past bound is naturally finite
// (the event's own real Start Date), so only the future bound needs the
// arbitrary safety cap (recurringEndDate can be unset = indefinite).
// sortDirection ("earliest-first" default | "latest-first") is independent
// of filter — see initDatesList's header comment.
export function buildAllOccurrences(event, sortDirection = 'earliest-first') {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const earliestAllowed = new Date(today.getFullYear() - ALL_RANGE_YEARS, today.getMonth(), today.getDate());
  const rangeStart = event.startDate > earliestAllowed ? event.startDate : earliestAllowed;
  const cappedEnd = new Date(today.getFullYear() + ALL_RANGE_YEARS, today.getMonth(), today.getDate());
  const rangeEnd = event.recurringEndDate && event.recurringEndDate < cappedEnd ? event.recurringEndDate : cappedEnd;
  const isDescending = sortDirection === 'latest-first';
  return getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => (isDescending ? b.start - a.start : a.start - b.start));
}

// listIndex disambiguates clone id/data-w-id suffixes across multiple
// dates-lists on the same page — without it, list A's and list B's first
// clone would both end up suffixed "detail-0".
function initDatesList(listEl, event, listIndex) {
  // Excludes CLONE_ATTR-tagged elements — a clone carries the same
  // dates-item structure as its template, so without this a clone from an
  // earlier pass could get mistaken for the real template (see
  // claimForInit()'s header comment).
  const template = queryOwnAll(listEl, DATES_ITEM, DATES_LIST).find((el) => !el.hasAttribute(CLONE_ATTR)) || null;
  if (!template) return;

  let filter = attr('upcoming', listEl.getAttribute(`data-ix-${ANIMATION_ID}-filter`)?.toLowerCase());
  if (filter !== 'upcoming' && filter !== 'past' && filter !== 'all') filter = 'upcoming';
  let sortDirection = attr('', listEl.getAttribute(`data-ix-${ANIMATION_ID}-sort`)?.toLowerCase());
  if (sortDirection !== 'earliest-first' && sortDirection !== 'latest-first') sortDirection = undefined;
  const effectiveSort = sortDirection || (filter === 'past' ? 'latest-first' : 'earliest-first');
  const isDescending = effectiveSort === 'latest-first';
  const itemCount = readItemCount(listEl, 12);
  const container = template.parentElement;
  template.style.display = 'none';

  const loadMoreWrap = queryOwn(listEl, LOAD_MORE_WRAP, DATES_LIST);
  const loadMoreBtn = queryOwn(loadMoreWrap || listEl, LOAD_MORE_BTN, DATES_LIST);
  const loadMoreTarget = loadMoreWrap || loadMoreBtn;
  debugLog('[event-detail] initDatesList: filter =', filter, '| sort =', effectiveSort, '| itemCount =', itemCount, '| loadMoreBtn found:', !!loadMoreBtn);

  const allOccurrences = filter === 'all' ? buildAllOccurrences(event, effectiveSort) : null;
  let renderedCount = 0;

  function searchDirected(targetCount) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return expandingWindowSearch({
      anchor: today,
      period: 'month',
      direction: filter,
      targetCount,
      maxIterations: SEARCH_CAP,
      search: (start, end) => {
        const occurrences = getOccurrences(event, start, end).filter((occ) =>
          filter === 'past' ? occ.end < now : occ.end >= now
        );
        occurrences.sort((a, b) => (isDescending ? b.start - a.start : a.start - b.start));
        return occurrences;
      },
    });
  }

  function loadMore() {
    const targetCount = renderedCount + itemCount;
    const source = filter === 'all' ? allOccurrences : searchDirected(targetCount);
    const batch = source.slice(renderedCount, targetCount);
    debugLog('[event-detail] loadMore: targetCount =', targetCount, '| total found:', source.length, '| batch size:', batch.length);
    if (batch.length === 0) {
      if (loadMoreTarget) loadMoreTarget.style.display = 'none';
      return;
    }
    batch.forEach((occurrence, i) => {
      const clone = createOccurrenceCard(template, occurrence, event, `detail-${listIndex}-${renderedCount + i}`);
      // createOccurrenceCard() only updates a NESTED [data-ix-events="date"]
      // child (same shared helper List/Feed use, where the card root is
      // never itself a date target) — apply the same self-target fallback
      // next-date gets, so a bare dates-item with no separate date child
      // still updates its own text.
      applyOwnOrNestedDate(clone, occurrence, event);
      container.appendChild(clone);
    });
    renderedCount += batch.length;
    if (batch.length < itemCount && loadMoreTarget) loadMoreTarget.style.display = 'none';
  }

  loadMore();
  // Only the INITIAL call can mean "nothing at all" — a later Load More
  // click returning an empty batch just means "no more," already handled
  // above by hiding loadMoreTarget, not a reason to hide the whole list.
  if (renderedCount === 0) listEl.style.display = 'none';
  loadMoreBtn?.addEventListener('click', () => {
    const before = renderedCount;
    loadMore();
    const added = renderedCount - before;
    if (added > 0) announceLiveRegion(listEl, `${added} more date${added === 1 ? '' : 's'} loaded.`);
  });
}
