import { attr } from './utilities';

// ============================================================================
// date-utils: shared date math + formatting, used by event-list.js (List View,
// Feed View) and calendar.js. No DOM dependency except setDateFields, which
// only ever touches [data-ix-events="date"] elements — the same convention
// across all three views.
// ============================================================================

const DATE_EL = '[data-ix-events="date"]';

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Range / navigation math ─────────────────────────────────────────────

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function startOfWeek(date, weekStartDay) {
  const diff = (date.getDay() - weekStartDay + 7) % 7;
  return addDays(date, -diff);
}

// The anchor date for a range: the 1st of the month, or the first day of the
// week (per weekStartDay). Used both to seed `current` and by a "today" button.
export function anchorFor(date, range, weekStartDay) {
  return range === 'week' ? startOfWeek(date, weekStartDay) : new Date(date.getFullYear(), date.getMonth(), 1);
}

// `current` is always an anchor date (see anchorFor) — this expands it to the
// actual [start, end] window passed to getOccurrences().
export function getRangeBounds(current, range) {
  if (range === 'week') {
    const weekEnd = addDays(current, 6);
    return { start: current, end: new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59) };
  }
  return {
    start: current,
    end: new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59),
  };
}

export function stepCurrent(current, range, direction) {
  if (range === 'week') return addDays(current, 7 * direction);
  const next = new Date(current.getFullYear(), current.getMonth(), 1);
  next.setMonth(next.getMonth() + direction);
  return next;
}

// Extends a date forward by one "period" step (month or week) — used by Feed
// View to grow Load More's search window, not tied to any calendar
// week/month boundary the way the range stepping above is. Always pins to
// the 1st of the month first (matching stepCurrent's month-safe pattern) to
// avoid rollover bugs (e.g. Jan 31 + 1 month landing in March).
export function stepPeriodEnd(date, period) {
  if (period === 'week') return addDays(date, 7);
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  next.setMonth(next.getMonth() + 1);
  return next;
}

// Backward mirror of stepPeriodEnd — same 1st-of-month pinning, opposite
// direction. Used by direction="past" searches (Feed View, event-detail).
export function stepPeriodStart(date, period) {
  if (period === 'week') return addDays(date, -7);
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  next.setMonth(next.getMonth() - 1);
  return next;
}

// Safety cap on how many extra period-steps an expanding search will try
// before giving up — shared by every expandingWindowSearch() caller.
export const SEARCH_CAP = 36;

// Grows a bounded [windowStart, windowEnd] window one `period` step at a
// time — forward from `anchor` when direction="upcoming", backward when
// direction="past" — re-invoking `search(windowStart, windowEnd)` after each
// step until it returns >= targetCount results or maxIterations extra steps
// have been tried, whichever comes first. `search` must be pure (no DOM) and
// return an array; this function doesn't assume anything about its shape —
// it works the same whether the caller is merging occurrences across many
// events (Feed View) or querying a single event (event-detail).
export function expandingWindowSearch({ anchor, period, direction, targetCount, maxIterations, search }) {
  const isPast = direction === 'past';
  let windowStart = isPast ? stepPeriodStart(anchor, period) : anchor;
  let windowEnd = isPast ? anchor : stepPeriodEnd(anchor, period);
  let results = search(windowStart, windowEnd);
  let iterations = 0;
  while (results.length < targetCount && iterations < maxIterations) {
    if (isPast) windowStart = stepPeriodStart(windowStart, period);
    else windowEnd = stepPeriodEnd(windowEnd, period);
    results = search(windowStart, windowEnd);
    iterations++;
  }
  return results;
}

// ── Formatting ───────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, '0');
export const ordinal = (n) => {
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

export function formatOccurrenceDate(date, format) {
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
export function formatWeekLabel(current, format) {
  const end = addDays(current, 6);
  if (format) {
    return `${formatOccurrenceDate(current, format)} - ${formatOccurrenceDate(end, format)}`;
  }
  const crossesYear = current.getFullYear() !== end.getFullYear();
  const startFormat = crossesYear ? 'MMM D, YYYY' : 'MMM D';
  return `${formatOccurrenceDate(current, startFormat)} - ${formatOccurrenceDate(end, 'MMM D, YYYY')}`;
}

export function isFullDateFormat(format) {
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
export function formatFullDate(occurrence, event) {
  const { start, end } = occurrence;
  const { showStartTime, showEndTime, showEndDate } = event;

  const isMultiDay = showEndDate && startOfDay(end) !== startOfDay(start);
  const datePart = isMultiDay ? formatDateRange(start, end) : formatSingleDate(start);

  if (!showStartTime) return datePart;
  if (!showEndTime) return `${datePart} at ${formatClockTime(start)}`;

  const startTime = formatClockTime(start);
  const endTime = formatClockTime(end);
  return `${datePart}, ${hideStartMeridiem(startTime, start, end)}-${endTime}`;
}

// Drops the start time's am/pm suffix when it matches the end time's period
// (e.g. "8-9pm" instead of "8pm-9pm") — except when the start is 12
// (noon/midnight), since "12-1pm" would leave which meridiem the 12 itself
// is in ambiguous. Shared by formatFullDate and formatTimeOnly, which each
// format the individual start/end times differently (TIME-SHORT/
// formatClockTime hide :00, plain TIME keeps it) but want the same
// collapsing rule layered on top either way.
function hideStartMeridiem(startTimeText, start, end) {
  const startPeriod = start.getHours() >= 12 ? 'pm' : 'am';
  const endPeriod = end.getHours() >= 12 ? 'pm' : 'am';
  const start12Hour = start.getHours() % 12 || 12;
  return startPeriod === endPeriod && start12Hour !== 12 ? startTimeText.slice(0, -2) : startTimeText;
}

export function isTimeFormat(format) {
  const upper = format.trim().toUpperCase();
  return upper === 'TIME' || upper === 'TIME-SHORT';
}

// "TIME"/"TIME-SHORT": composite formats for a date element that should show
// only a time, never a date (e.g. a calendar pill, which already lives
// inside a specific day-cell) — driven by the event's Show Start Time / Show
// End Time flags rather than a token string, same spirit as FULLDATE but
// time-only. Returns null when nothing should show at all (Show Start Time
// off) — the caller (setDateFields) hides the element entirely in that case,
// since there's no date fallback to fall back to the way FULLDATE has one.
//   "TIME"       always keeps ":00"      — "8:00pm", "8:00-9:30pm", "8:00am-5:00pm"
//   "TIME-SHORT" drops ":00" per side     — "8pm",    "9-10:15pm",   "7:30am-11:20pm"
// Both apply the same meridiem-collapsing rule as FULLDATE's range.
export function formatTimeOnly(occurrence, event, short) {
  if (!event.showStartTime) return null;
  const { start, end } = occurrence;
  const formatSide = short ? formatClockTime : (date) => formatOccurrenceDate(date, 'h:mma');
  const startTime = formatSide(start);
  if (!event.showEndTime || end.getTime() === start.getTime()) return startTime;
  const endTime = formatSide(end);
  return `${hideStartMeridiem(startTime, start, end)}-${endTime}`;
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

// Formats an occurrence's date fields — for a recurring event this is the
// computed date/time of THAT occurrence itself, never the event's original
// CMS start/end, so a "FULLDATE"/"TIME"/"TIME-SHORT" composite or the plain
// token formatter all naturally reflect the right day even when recurring.
// Used by List View, Feed View, and Calendar — all four (pill, hover-card,
// list/feed card) tag date elements the same way. "TIME"/"TIME-SHORT" are
// the only formats that can return null (Show Start Time off, nothing to
// show) — that hides the element entirely rather than leaving stale or
// empty text; any other format always shows something, so the element is
// explicitly un-hidden first in case a previous render (or a shared,
// reused DOM node — see List View's duplicate-recurring="false" mode) had
// hidden it.
export function setDateFields(root, occurrence, event) {
  root.querySelectorAll(DATE_EL).forEach((el) => {
    const format = attr('MMMM D, YYYY', el.getAttribute('data-ix-events-date-format'));
    if (isTimeFormat(format)) {
      const text = formatTimeOnly(occurrence, event, format.trim().toUpperCase() === 'TIME-SHORT');
      el.style.display = text === null ? 'none' : '';
      el.textContent = text ?? '';
      return;
    }
    el.style.display = '';
    el.textContent = isFullDateFormat(format)
      ? formatFullDate(occurrence, event)
      : formatOccurrenceDate(occurrence.start, format);
  });
}
