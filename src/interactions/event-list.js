import { attr, getIxConfig, checkRunProp } from '../utilities';
import { getOccurrences, parseEventFromJSON } from './recurrence';
import { whenEvents } from './event-data';

// ============================================================================
// event-list: month-based List View (data-ix-events-layout="list")
// ============================================================================
//
// Shares the data-ix-events-* attribute prefix with calendar.js — both read
// event data through event-data.js's whenEvents(), which finds the one
// [data-ix-events="data-wrap"] Collection List on the page, so a List View /
// Calendar toggle on one page can't end up reading two different sources.
//
// DOM lifecycle (filtering, item creation/removal, render) is delegated to
// Finsweet Attributes' List solution — https://finsweet.com/attributes/list-filter,
// API: https://github.com/finsweet/attributes/blob/master/packages/list/README.md
// — via its programmatic API, not its declarative checkbox/select filtering
// (which has no concept of expanding one CMS item into multiple occurrence
// dates, so it can't replace getOccurrences()). This module only decides
// WHICH occurrences exist for the active month and hands the result to
// Finsweet's `List.addHook('filter', ...)`; Finsweet owns rendering it.
//
// Requires the Finsweet script (once, in the site's <head>), scoped to only
// load the `list` module:
//   <script async type="module" src="https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js" fs-list></script>
// ...and `fs-list-element="list"` on the same element that carries
// `data-ix-events="data-wrap"` (combined mode) or the separate card
// Collection List (separate mode) — see the mode notes below.
//
// Cards can live in EITHER of two places, auto-detected per item:
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
// Required structure per instance:
//   [data-ix-events="wrap"] [data-ix-events-layout="list"]   component root (duplicate-recurring option lives here)
//     [data-ix-events="prev"]          prev month button
//     [data-ix-events="label"]         text element — JS sets the month/year
//     [data-ix-events="next"]          next month button
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
// Options: data-ix-events-duplicate-recurring="true" (default) | "false"
//   true  — clone the item once per occurrence date in the active month
//   false — show the item once regardless of occurrence count, no clones
//           (still only shown if at least one occurrence falls in the month)
// ============================================================================

const ANIMATION_ID = 'events';
const LAYOUT = 'list';

const WRAP = '[data-ix-events="wrap"]';
const PREV_BTN = '[data-ix-events="prev"]';
const NEXT_BTN = '[data-ix-events="next"]';
const LABEL = '[data-ix-events="label"]';
const ITEM = '[data-ix-events="item"]';
const DATA_EL = '[data-ix-events="data"]';
const CARD_EL = '[data-ix-events="card"]';
const DATE_EL = '[data-ix-events="date"]';
const SLUG_ATTR = 'data-ix-events-slug';
const CLONE_ATTR = 'data-ix-events-clone';

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const eventList = function () {
  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = [...document.querySelectorAll(WRAP)].filter(
    (wrap) => wrap.getAttribute('data-ix-events-layout') === LAYOUT
  );
  console.log('[event-list] DEBUG wraps with layout="list" found:', wraps.length, wraps);
  if (wraps.length === 0) return;

  // Needed for slug matching in the separate-Collection-List case (B).
  // Combined-mode items (A) never need this, since they carry their own JSON.
  whenEvents((events) => {
    console.log('[event-list] DEBUG whenEvents callback fired, events received:', events.length, events);
    const eventsBySlug = new Map(events.map((event) => [event.slug, event]));

    const configs = wraps.map((wrap) => buildListConfig(wrap, eventsBySlug)).filter(Boolean);
    console.log('[event-list] DEBUG configs built:', configs.length, configs);
    if (configs.length === 0) return;

    // Finsweet's List module loads async — this queue runs the callback once
    // it's ready, handing back every fs-list-element="list" instance on the page.
    window.FinsweetAttributes ||= [];
    window.FinsweetAttributes.push([
      'list',
      (listInstances) => {
        console.log('[event-list] DEBUG Finsweet list callback fired, listInstances found:', listInstances.length, listInstances);
        configs.forEach((config) => {
          const listInstance = listInstances.find((l) => l.listElement === config.list);
          console.log('[event-list] DEBUG matching Finsweet instance for config.list:', config.list, '-> found:', !!listInstance);
          if (!listInstance) {
            console.warn(
              'event-list: no Finsweet List instance found for this Collection List — add fs-list-element="list" to it.',
              config.list
            );
            return;
          }
          initList(config, listInstance);
        });
      },
    ]);
  });
};

// Guard clauses + item↔event pairing — unchanged regardless of what renders the result.
function buildListConfig(wrap, eventsBySlug) {
  if (checkRunProp(wrap, ANIMATION_ID) === false) {
    console.log('[event-list] DEBUG buildListConfig: checkRunProp returned false for wrap', wrap);
    return null;
  }

  const duplicateRecurring = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-duplicate-recurring`));
  const label = wrap.querySelector(LABEL);
  const prevBtn = wrap.querySelector(PREV_BTN);
  const nextBtn = wrap.querySelector(NEXT_BTN);
  console.log('[event-list] DEBUG buildListConfig: duplicateRecurring =', duplicateRecurring, '| label found:', !!label, '| prevBtn found:', !!prevBtn, '| nextBtn found:', !!nextBtn);

  const cardItems = [...wrap.querySelectorAll(ITEM)].filter((item) => item.querySelector(CARD_EL));
  console.log('[event-list] DEBUG buildListConfig: items with a card descendant found in wrap:', cardItems.length, cardItems);
  if (cardItems.length === 0) return null;

  const entries = cardItems
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

  console.log('[event-list] DEBUG buildListConfig: successfully paired entries:', entries.length, entries);
  if (entries.length === 0) return null;

  // Whatever directly contains the card items (in Webflow, normally the
  // Collection List element itself) — this is what needs fs-list-element="list".
  const list = entries[0].item.parentElement;
  console.log('[event-list] DEBUG buildListConfig: resolved `list` container element:', list);

  return { duplicateRecurring, label, prevBtn, nextBtn, entries, list };
}

function initList(config, listInstance) {
  const { duplicateRecurring, label, prevBtn, nextBtn, entries, list } = config;
  const eventByElement = new Map(entries.map(({ item, event }) => [item, event]));
  console.log('[event-list] DEBUG initList: registering hook, listInstance =', listInstance);

  const current = new Date();
  current.setDate(1); // avoids month-length rollover bugs on setMonth()

  listInstance.addHook('filter', (items) => {
    console.log('[event-list] DEBUG filter hook FIRED. items received from Finsweet:', items.length, items, '| active month:', current.getFullYear(), current.getMonth() + 1);

    // Defensive cleanup: remove any clones from a previous pass in case
    // Finsweet doesn't drop DOM nodes that fall out of the returned array —
    // see the "known risk" note in the plan for why this stays even though
    // the map lookup below would also exclude stale clones on its own.
    const removedClones = list.querySelectorAll(`[${CLONE_ATTR}]`);
    console.log('[event-list] DEBUG removing stale clones from previous pass:', removedClones.length);
    removedClones.forEach((el) => el.remove());

    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
    const result = [];

    items.forEach((listItem) => {
      const event = eventByElement.get(listItem.element);
      if (!event) {
        console.log('[event-list] DEBUG no matching event for this listItem.element (stale/unrecognized) — dropping:', listItem.element);
        return;
      }

      const occurrences = getOccurrences(event, monthStart, monthEnd).sort((a, b) => a.start - b.start);
      console.log('[event-list] DEBUG event', event.name, '-> occurrences this month:', occurrences.length);
      if (occurrences.length === 0) return;

      const [first, ...rest] = occurrences;
      setDateFields(listItem.element, first, event);
      result.push({ listItem, date: first.start, showStartTime: event.showStartTime });

      if (duplicateRecurring) {
        let insertAfter = listItem.element;
        rest.forEach((occ, i) => {
          const clone = listItem.element.cloneNode(true);
          clone.setAttribute(CLONE_ATTR, '');
          uniquifyIds(clone, `occ-${i + 1}`);
          setDateFields(clone, occ, event);
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
    console.log('[event-list] DEBUG refresh() called — month now:', current.getFullYear(), current.getMonth() + 1);
    if (label) {
      label.textContent = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    listInstance.triggerHook('filter');
  };

  refresh();

  prevBtn?.addEventListener('click', () => {
    current.setMonth(current.getMonth() - 1);
    refresh();
  });
  nextBtn?.addEventListener('click', () => {
    current.setMonth(current.getMonth() + 1);
    refresh();
  });
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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Formats the occurrence's date fields — for a recurring event this is the
// computed date/time of THAT occurrence itself, never the event's original
// CMS start/end, so a "FULLDATE" range or the plain token formatter both
// naturally reflect the right day even when recurring.
function setDateFields(root, occurrence, event) {
  root.querySelectorAll(DATE_EL).forEach((el) => {
    const format = el.getAttribute('data-ix-events-date-format') || 'MMMM D, YYYY';
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
