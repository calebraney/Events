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
// Built on a native Webflow Collection List — cards stay in the Designer,
// this only filters/duplicates/reorders them in place for the active month.
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
//   [data-ix-events="wrap"] [data-ix-events-layout="list"]   component root (mode option lives here)
//     [data-ix-events="prev"]          prev month button
//     [data-ix-events="label"]         text element — JS sets the month/year
//     [data-ix-events="next"]          next month button
//     ...the card Collection List (A or B above)...
//       [data-ix-events-date="{token}"]  any text node inside the card whose
//                                        content should become the occurrence date
//
// Whatever element directly contains the card items (in Webflow, normally
// the Collection List element itself) MUST be display: flex or grid — see
// the reorder note below.
//
// Options: data-ix-events-mode="expand" (default) | "single"
//   expand — clone the item once per occurrence date in the active month
//   single — show the item once regardless of occurrence count, no clones
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
const DATE_EL = '[data-ix-events-date]';
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
  if (wraps.length === 0) return;

  // Needed for slug matching in the separate-Collection-List case (B).
  // Combined-mode items (A) never need this, since they carry their own JSON.
  whenEvents((events) => {
    const eventsBySlug = new Map(events.map((event) => [event.slug, event]));
    wraps.forEach((wrap) => initList(wrap, eventsBySlug));
  });
};

function initList(wrap, eventsBySlug) {
  if (checkRunProp(wrap, ANIMATION_ID) === false) return;

  const mode = attr('expand', wrap.getAttribute(`data-ix-${ANIMATION_ID}-mode`));
  const label = wrap.querySelector(LABEL);
  const prevBtn = wrap.querySelector(PREV_BTN);
  const nextBtn = wrap.querySelector(NEXT_BTN);

  const cardItems = [...wrap.querySelectorAll(ITEM)].filter((item) => item.querySelector(CARD_EL));
  if (cardItems.length === 0) return;

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

  if (entries.length === 0) return;

  // Whatever directly contains the card items (in Webflow, normally the
  // Collection List element itself) must be a flex/grid container for the
  // CSS `order` reordering below.
  const list = entries[0].item.parentElement;

  // Start on the 1st of the current month to avoid month-length rollover
  // bugs (e.g. Jan 31 -> setMonth(+1) landing on Mar 3 instead of Feb 28).
  const current = new Date();
  current.setDate(1);

  const render = () => {
    list.querySelectorAll(`[${CLONE_ATTR}]`).forEach((el) => el.remove());

    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
    const visible = [];

    entries.forEach(({ item, event }) => {
      const occurrences = getOccurrences(event, monthStart, monthEnd).sort((a, b) => a.start - b.start);

      if (occurrences.length === 0) {
        item.style.display = 'none';
        return;
      }
      item.style.display = '';

      const [first, ...rest] = occurrences;
      setDateFields(item, first, event);
      visible.push({ el: item, date: first.start });

      if (mode !== 'single') {
        let insertAfter = item;
        rest.forEach((occ, i) => {
          const clone = item.cloneNode(true);
          clone.setAttribute(CLONE_ATTR, '');
          uniquifyIds(clone, `occ-${i + 1}`);
          setDateFields(clone, occ, event);
          insertAfter.insertAdjacentElement('afterend', clone);
          insertAfter = clone;
          visible.push({ el: clone, date: occ.start });
        });
      }
    });

    // Reorder chronologically via CSS `order` — avoids physically moving DOM
    // nodes, but requires `list` to be a flex or grid container.
    visible.sort((a, b) => a.date - b.date);
    visible.forEach(({ el }, i) => {
      el.style.order = i;
    });

    if (label) {
      label.textContent = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  render();

  prevBtn?.addEventListener('click', () => {
    current.setMonth(current.getMonth() - 1);
    render();
  });
  nextBtn?.addEventListener('click', () => {
    current.setMonth(current.getMonth() + 1);
    render();
  });
}

function setDateFields(root, occurrence, event) {
  root.querySelectorAll(DATE_EL).forEach((el) => {
    const token = el.getAttribute('data-ix-events-date');
    el.textContent = formatDateToken(token, occurrence, event);
  });
}

function formatDateToken(token, occurrence, event) {
  const { start, end } = occurrence;
  switch (token) {
    case 'day':
      return String(start.getDate());
    case 'weekday-short':
      return DOW_SHORT[start.getDay()];
    case 'weekday-full':
      return DOW_FULL[start.getDay()];
    case 'month-short':
      return MONTH_SHORT[start.getMonth()];
    case 'month-full':
      return MONTH_FULL[start.getMonth()];
    case 'year':
      return String(start.getFullYear());
    case 'date-short':
      return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
    case 'date-full':
      return `${MONTH_FULL[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
    case 'time':
      return event.showStartTime ? formatTime(start) : '';
    case 'time-range':
      return event.showEndTime ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
    default:
      return '';
  }
}

function formatTime(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
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
