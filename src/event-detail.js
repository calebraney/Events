import { attr, uniquifyIds, debugLog } from './utilities';
import { getOccurrences, parseEventFromJSON } from './recurrence';
import { expandingWindowSearch, SEARCH_CAP, setDateFields, applyDateFormat } from './date-utils';
import { createOccurrenceCard, readItemCount } from './event-list';

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
// relevant kind (wrap, or occurrence-list — see below) is the container
// actually being searched, so a nested Feed's own elements — or a different
// occurrence-list's own template/load-more — are never mistaken for this
// one's own.
//
// Required structure per instance:
//   [data-ix-events="wrap"] [data-ix-events-layout="detail"]   component root
//     [data-ix-events="data"]   <script type="application/json"> — this
//                                 page's own event fields, same shape as
//                                 every other view's hidden JSON embed (see
//                                 README.md).
//     [data-ix-events="next-occurrence"]   optional — the next upcoming
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
//     [data-ix-events="occurrence-list"]   optional, repeatable — a wrapper
//                                 that both holds this list's own options
//                                 (below) and is what clones get appended
//                                 into. A page can have more than one, e.g. a
//                                 short "upcoming" list and a separate "past"
//                                 list — each configured independently.
//                                 Hidden entirely (display: none) if this
//                                 specific list has zero occurrences on
//                                 init — e.g. an "upcoming" list for an event
//                                 whose recurring series has already ended.
//       [data-ix-events="occurrence-item"]   template row for one occurrence.
//                                 Hidden after init; clones are appended
//                                 into occurrence-list, after this element.
//                                 Put data-ix-events-date-format directly on
//                                 this element and its own text updates —
//                                 same "one attribute is enough" fallback as
//                                 next-occurrence — OR nest a separate
//                                 [data-ix-events="date"] child instead if
//                                 you need other markup alongside the date.
//         [data-ix-events="date"]    same date-format contract.
//       [data-ix-events="load-more-wrap"]   optional — see item-count below.
//         [data-ix-events="load-more"]        optional — button, reveals the
//                                 next batch of this list's occurrences.
//
// Options (read from each occurrence-list element, NOT the wrap — a page can
// have several occurrence-lists, each with its own settings):
//   data-ix-events-detail-filter="upcoming" (default) | "past" | "all"
//     upcoming — occurrences on/after today, soonest first.
//     past — occurrences that have already ended, most recent first.
//     all — the event's full occurrence history, oldest to newest, in one
//     continuous list. Bounded to +/- 3 years from today (or the event's own
//     Start Date / Recurring End Date if those are narrower) — a truly
//     unbounded recurring series has no literal "all."
//   data-ix-events-item-count="12" (default)
//     how many occurrence rows to reveal on init and per "Load More" click.
//     Same name/meaning as List View and Feed View's option.
// ============================================================================

const ANIMATION_ID = 'events';
const DETAIL_LAYOUT = 'detail';

const WRAP = '[data-ix-events="wrap"]';
const DATA_EL = '[data-ix-events="data"]';
const NEXT_OCCURRENCE_EL = '[data-ix-events="next-occurrence"]';
const OCCURRENCE_LIST = '[data-ix-events="occurrence-list"]';
const OCCURRENCE_ITEM = '[data-ix-events="occurrence-item"]';
const DATE_EL = '[data-ix-events="date"]';
const LOAD_MORE_WRAP = '[data-ix-events="load-more-wrap"]';
const LOAD_MORE_BTN = '[data-ix-events="load-more"]';

const ALL_RANGE_YEARS = 3; // matches Feed View's existing forward-search safety margin

// Finds descendant(s) of `scope` matching `selector` whose NEAREST ancestor
// matching `boundarySelector` is `scope` itself — not a plain
// scope.querySelector(All), which would recurse into a nested same-kind
// container's own elements too. Used both for wrap-nesting (a Feed section
// inside a detail wrap) and list-nesting (one occurrence-list's template/
// load-more never bleeding into a sibling occurrence-list's).
function queryOwn(scope, selector, boundarySelector = WRAP) {
  return [...scope.querySelectorAll(selector)].find((el) => el.closest(boundarySelector) === scope) || null;
}
function queryOwnAll(scope, selector, boundarySelector = WRAP) {
  return [...scope.querySelectorAll(selector)].filter((el) => el.closest(boundarySelector) === scope);
}

// Applies date-format text to a nested [data-ix-events="date"] child if one
// exists, otherwise to `el` itself (reading data-ix-events-date-format
// directly off it) — the "one attribute is enough" fallback shared by both
// next-occurrence and each occurrence-item clone below.
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
    const event = parseWrapEvent(wrap);
    if (!event) return;
    renderNextOccurrence(wrap, event);
    queryOwnAll(wrap, OCCURRENCE_LIST).forEach((listEl, i) => initOccurrenceList(listEl, event, i));
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
  const el = queryOwn(wrap, NEXT_OCCURRENCE_EL);
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

// data-ix-events-detail-filter="all" isn't an expanding search — it's one
// bounded getOccurrences() call, computed once. The past bound is naturally
// finite (the event's own real Start Date), so only the future bound needs
// the arbitrary safety cap (recurringEndDate can be unset = indefinite).
export function buildAllOccurrences(event) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const earliestAllowed = new Date(today.getFullYear() - ALL_RANGE_YEARS, today.getMonth(), today.getDate());
  const rangeStart = event.startDate > earliestAllowed ? event.startDate : earliestAllowed;
  const cappedEnd = new Date(today.getFullYear() + ALL_RANGE_YEARS, today.getMonth(), today.getDate());
  const rangeEnd = event.recurringEndDate && event.recurringEndDate < cappedEnd ? event.recurringEndDate : cappedEnd;
  return getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
}

// listIndex disambiguates clone id/data-w-id suffixes across multiple
// occurrence-lists on the same page — without it, list A's and list B's
// first clone would both end up suffixed "detail-0".
function initOccurrenceList(listEl, event, listIndex) {
  const template = queryOwn(listEl, OCCURRENCE_ITEM, OCCURRENCE_LIST);
  if (!template) return;

  let filter = attr('upcoming', listEl.getAttribute(`data-ix-${ANIMATION_ID}-detail-filter`)?.toLowerCase());
  if (filter !== 'upcoming' && filter !== 'past' && filter !== 'all') filter = 'upcoming';
  const itemCount = readItemCount(listEl, 12);
  const container = template.parentElement;
  template.style.display = 'none';

  const loadMoreWrap = queryOwn(listEl, LOAD_MORE_WRAP, OCCURRENCE_LIST);
  const loadMoreBtn = queryOwn(loadMoreWrap || listEl, LOAD_MORE_BTN, OCCURRENCE_LIST);
  const loadMoreTarget = loadMoreWrap || loadMoreBtn;
  debugLog('[event-detail] initOccurrenceList: filter =', filter, '| itemCount =', itemCount, '| loadMoreBtn found:', !!loadMoreBtn);

  const allOccurrences = filter === 'all' ? buildAllOccurrences(event) : null;
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
        occurrences.sort((a, b) => (filter === 'past' ? b.start - a.start : a.start - b.start));
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
      // next-occurrence gets, so a bare occurrence-item with no separate
      // date child still updates its own text.
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
  loadMoreBtn?.addEventListener('click', loadMore);
}
