import { parseEventFromJSON } from './recurrence';

// ============================================================================
// event-data: shared data lookup for event-list.js and calendar.js
// ============================================================================
//
// Both layouts read the exact same source, found the exact same way, so
// there is only ever one place on a page events are pulled from — even if
// both a List View and a Calendar are present, they read the same items and
// can't drift into duplicate or conflicting event data.
//
// Expected structure, once, anywhere on the page:
//   [data-ix-events="data-wrap"]   the Webflow Collection List wrapper
//     [data-ix-events="item"]        one per CMS item
//       [data-ix-events="data"]        <script type="application/json"> — raw event fields
//
// This is the *data* source only. The List View's visible cards may live in
// this same Collection List (each item carrying both the JSON and the card —
// see event-list.js's own item scan) or in a completely separate Collection
// List — event-list.js handles both, matching by slug in the separate case.
//
// More than ~100 events: Webflow only renders a Collection List's first ~100
// items natively. To go beyond that, add Finsweet's fs-list-element="list"
// and fs-list-load="all" to the data-wrap — when present, this module waits
// for Finsweet to finish loading every paginated page (via the List instance's
// `loadingPaginatedItems` promise) before scanning for events, so nothing past
// the first page gets silently missed. Sites that don't need this (under 100
// events) can leave both attributes off — behavior is unchanged either way.
// ============================================================================

const DATA_WRAP = '[data-ix-events="data-wrap"]';
const ITEM = '[data-ix-events="item"]';
const DATA_EL = '[data-ix-events="data"]';

const MAX_ATTEMPTS = 20;
const RETRY_DELAY = 300;

// Calls back with an array of parsed events once the data-wrap's items are
// found (retrying briefly in case the Collection List renders after this
// script runs), or with [] if none ever appear.
export function whenEvents(callback) {
  let attempts = 0;

  const tryLoad = () => {
    const dataWraps = document.querySelectorAll(DATA_WRAP);
    if (dataWraps.length > 1) {
      console.warn(
        `events: found ${dataWraps.length} elements matching ${DATA_WRAP} — using the first one. Remove the extras to avoid duplicate or conflicting event data.`
      );
    }
    const dataWrap = dataWraps[0];
    const items = dataWrap ? [...dataWrap.querySelectorAll(ITEM)] : [];

    if (items.length === 0) {
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(tryLoad, RETRY_DELAY);
        return;
      }
      callback([]);
      return;
    }

    // Registered with Finsweet (fs-list-element="list") — e.g. because
    // fs-list-load="all" is also set to load past Webflow's ~100-item cap.
    // Wait for every paginated page to finish loading before scanning, so
    // this only ever runs against the final, complete item set.
    if (dataWrap.getAttribute('fs-list-element') === 'list') {
      window.FinsweetAttributes ||= [];
      window.FinsweetAttributes.push([
        'list',
        (listInstances) => {
          const listInstance = listInstances.find((l) => l.listElement === dataWrap);
          Promise.resolve(listInstance?.loadingPaginatedItems).then(() => finish(dataWrap));
        },
      ]);
      return;
    }

    finish(dataWrap);
  };

  const finish = (dataWrap) => {
    const events = [...dataWrap.querySelectorAll(ITEM)]
      .map((item) => {
        const dataEl = item.querySelector(DATA_EL);
        if (!dataEl) return null;
        try {
          const event = parseEventFromJSON(JSON.parse(dataEl.textContent));
          return event.startDate ? event : null;
        } catch (e) {
          console.warn('events: could not parse event JSON', item, e);
          return null;
        }
      })
      .filter(Boolean);

    callback(events);
  };

  tryLoad();
}
