// ============================================================================
// Shared recurrence engine — no DOM. Used by both event-list.js and calendar.js
// so recurrence is only ever computed one way.
// ============================================================================
//
// getOccurrences(event, rangeStart, rangeEnd) walks each calendar day in
// [rangeStart, rangeEnd] and tests it against the event's recurrence rule.
// This unified day-by-day approach (rather than stepping forward/backward by
// N iterations per frequency type) makes month-end clamping ("Monthly (same
// date)" landing on the 31st of a 30-day month), Nth-weekday-of-month
// ("2nd Sunday"), skip dates, and the start-date lower bound all fall out of
// one loop instead of being handled separately per frequency.
//
// Event shape expected:
//   {
//     startDate: Date,               // includes time-of-day
//     endDate: Date | null,          // see note below
//     recurringFrequency: 'None' | 'Daily' | 'Weekly' | 'Monthly (same date)'
//                        | 'Monthly (same day of the week)' | 'Yearly',
//     recurringInterval: number,     // every N [frequency units], >= 1
//     recurringDays: string[],       // e.g. ['Tue','Thu'], only used when Weekly
//     recurringSkipDates: string[],  // 'YYYY-MM-DD' strings
//   }
//
// End Date/Time is dual-purpose when the event is recurring: its TIME-OF-DAY
// portion is applied to every occurrence as its end time; its DATE portion is
// the series cutoff (the last day an occurrence can start on) *only when it
// falls on a different calendar day than Start Date/Time* — same-day just
// means "today's end time" (e.g. a weekly 6–8pm class), which is indefinite,
// not a one-occurrence series. Per-occurrence duration is derived from the
// time-of-day alone, never from raw (endDate - startDate), since that
// difference between a first occurrence and a far-future series cutoff isn't
// a meaningful "duration." For a non-recurring event, End Date/Time keeps its
// plain meaning: that single event's actual end (which may be a different day).
// ============================================================================

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function getOccurrences(event, rangeStart, rangeEnd) {
  const {
    startDate,
    endDate,
    recurringFrequency = 'None',
    recurringInterval = 1,
    recurringDays = [],
    recurringSkipDates = [],
  } = event;

  if (!startDate) return [];

  // Non-recurring: a single occurrence if it overlaps the requested range.
  if (!recurringFrequency || recurringFrequency === 'None') {
    const occEnd = endDate || startDate;
    if (occEnd < rangeStart || startDate > rangeEnd) return [];
    return [{ start: startDate, end: occEnd }];
  }

  const interval = recurringInterval > 0 ? recurringInterval : 1;
  const skipSet = new Set(recurringSkipDates);
  const startDay = startOfDay(startDate);

  // Series cutoff (date-only) and per-occurrence end time-of-day — see header note.
  // End Date/Time only counts as a cutoff when it falls on a *different* calendar
  // day than Start Date/Time — same-day just means "today's end time" (indefinite),
  // which is what most recurring events (e.g. a weekly 6–8pm class) will have.
  const endDateDay = endDate ? startOfDay(endDate) : null;
  const seriesEndDate = endDateDay && endDateDay.getTime() !== startDay.getTime() ? endDateDay : null;
  const endHours = endDate ? endDate.getHours() : startDate.getHours();
  const endMinutes = endDate ? endDate.getMinutes() : startDate.getMinutes();

  const loopStart = startDate > rangeStart ? startDate : rangeStart;
  const loopEndDate = seriesEndDate && seriesEndDate < rangeEnd ? seriesEndDate : rangeEnd;
  const finalDay = startOfDay(loopEndDate);
  let cursor = loopStart > startDate ? startOfDay(loopStart) : startDay;
  if (cursor > finalDay) return [];

  const targetWeekdays = recurringDays.length
    ? recurringDays.map((d) => WEEKDAY_INDEX[d]).filter((n) => n !== undefined)
    : [startDate.getDay()];

  const matchesFrequency = (day) => {
    switch (recurringFrequency) {
      case 'Daily':
        return daysBetween(startDay, day) % interval === 0;
      case 'Weekly':
        return (
          targetWeekdays.includes(day.getDay()) &&
          weeksBetween(startOfWeek(startDay), startOfWeek(day)) % interval === 0
        );
      case 'Monthly (same date)': {
        const target = Math.min(startDate.getDate(), daysInMonth(day.getFullYear(), day.getMonth()));
        return day.getDate() === target && monthsBetween(startDay, day) % interval === 0;
      }
      case 'Monthly (same day of the week)':
        return (
          day.getDay() === startDate.getDay() &&
          Math.ceil(day.getDate() / 7) === Math.ceil(startDate.getDate() / 7) &&
          monthsBetween(startDay, day) % interval === 0
        );
      case 'Yearly': {
        const target = Math.min(startDate.getDate(), daysInMonth(day.getFullYear(), startDate.getMonth()));
        return (
          day.getMonth() === startDate.getMonth() &&
          day.getDate() === target &&
          (day.getFullYear() - startDate.getFullYear()) % interval === 0
        );
      }
      default:
        return false;
    }
  };

  const results = [];
  while (cursor <= finalDay) {
    if (matchesFrequency(cursor) && !skipSet.has(toDateKey(cursor))) {
      results.push({
        start: combineDateAndTime(cursor, startDate.getHours(), startDate.getMinutes()),
        end: combineDateAndTime(cursor, endHours, endMinutes),
      });
    }
    cursor = addDays(cursor, 1);
  }
  return results;
}

// ── Parsing: raw hidden-JSON payload → normalized event object ─────────────
// Shared by event-list.js and calendar.js so the two never parse differently.

export function parseEventFromJSON(raw) {
  return {
    id: raw.slug || raw.name,
    name: raw.name || '',
    slug: raw.slug || '',
    startDate: parseDynamoDateTime(raw.startDateTime),
    endDate: parseDynamoDateTime(raw.endDateTime),
    showStartTime: parseBool(raw.showStartTime),
    showEndTime: parseBool(raw.showEndTime),
    showEndDate: parseBool(raw.showEndDate),
    eventType: raw.eventType || '',
    shortDescription: raw.shortDescription || '',
    location: raw.location || '',
    address: raw.address || '',
    timezone: raw.timezone || '',
    recurringFrequency: raw.recurringFrequency && raw.recurringFrequency.trim() ? raw.recurringFrequency.trim() : 'None',
    recurringInterval: parseRecurringInterval(raw.recurringInterval),
    recurringDays: parseCsv(raw.recurringDays),
    recurringSkipDates: parseCsv(raw.recurringSkipDates),
  };
}

// Dynamo renders dates as "YYYY-MM-DD h:mm a" (e.g. "2026-06-02 6:00 pm").
// Native Date parse is kept only as a fallback safety net.
export function parseDynamoDateTime(str) {
  if (!str) return null;
  const s = str.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m) {
    const [, y, mo, d, h, min, ampm] = m;
    let hours = parseInt(h, 10);
    if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
    return new Date(+y, +mo - 1, +d, hours, +min);
  }
  const native = new Date(s);
  return isNaN(native.getTime()) ? null : native;
}

function parseRecurringInterval(raw) {
  if (raw === undefined || raw === null) return 1;
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed === '-1') return 1;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseCsv(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.trim().toLowerCase() === 'true';
  return false;
}

// ── Date helpers ─────────────────────────────────────────────────────────

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

function weeksBetween(a, b) {
  return Math.round(daysBetween(a, b) / 7);
}

function monthsBetween(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function combineDateAndTime(day, hours, minutes) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
