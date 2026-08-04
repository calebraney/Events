import { attr, uniquifyIds, debugLog } from './utilities';
import { getOccurrences, parseEventFromJSON } from './recurrence';
import { expandingWindowSearch, SEARCH_CAP, setDateFields } from './date-utils';
import { createOccurrenceCard, resolveLoadMore, readItemCount } from './event-list';

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
// Required structure per instance:
//   [data-ix-events="wrap"] [data-ix-events-layout="detail"]   component root
//     [data-ix-events="data"]   <script type="application/json"> — this
//                                 page's own event fields, same shape as
//                                 every other view's hidden JSON embed (see
//                                 README.md).
//     [data-ix-events="next-occurrence"]   optional — scope for the next
//                                 upcoming occurrence's date. Non-recurring
//                                 events always use their own Start/End Date
//                                 (even if in the past — there's no other
//                                 sensible value). For a recurring event
//                                 whose series has already ended, this
//                                 element is hidden entirely.
//       [data-ix-events="date"]    same data-ix-events-date-format contract
//                                 as every other view (tokens / FULLDATE /
//                                 TIME / TIME-SHORT).
//     [data-ix-events="occurrence-item"]   optional — template row for one
//                                 occurrence in the list below. Hidden after
//                                 init; clones are appended into its own
//                                 parentElement.
//       [data-ix-events="date"]    same date-format contract.
//     [data-ix-events="load-more-wrap"]   optional — see item-count below.
//       [data-ix-events="load-more"]        optional — button, reveals the
//                                 next batch of occurrences.
//
// Options (all read from the wrap element):
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
const OCCURRENCE_ITEM = '[data-ix-events="occurrence-item"]';

const ALL_RANGE_YEARS = 3; // matches Feed View's existing forward-search safety margin

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
    initOccurrenceList(wrap, event);
  });
};

function parseWrapEvent(wrap) {
  const dataEl = wrap.querySelector(DATA_EL);
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
  const el = wrap.querySelector(NEXT_OCCURRENCE_EL);
  if (!el) return;
  const occurrence = findNextOccurrence(event);
  debugLog('[event-detail] next occurrence for', event.name, ':', occurrence);
  if (!occurrence) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  setDateFields(el, occurrence, event);
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

function initOccurrenceList(wrap, event) {
  const template = wrap.querySelector(OCCURRENCE_ITEM);
  if (!template) return;

  let filter = attr('upcoming', wrap.getAttribute(`data-ix-${ANIMATION_ID}-detail-filter`)?.toLowerCase());
  if (filter !== 'upcoming' && filter !== 'past' && filter !== 'all') filter = 'upcoming';
  const itemCount = readItemCount(wrap, 12);
  const container = template.parentElement;
  template.style.display = 'none';

  const { loadMoreWrap, loadMoreBtn } = resolveLoadMore(wrap);
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
      container.appendChild(createOccurrenceCard(template, occurrence, event, `detail-${renderedCount + i}`));
    });
    renderedCount += batch.length;
    if (batch.length < itemCount && loadMoreTarget) loadMoreTarget.style.display = 'none';
  }

  loadMore();
  loadMoreBtn?.addEventListener('click', loadMore);
}
