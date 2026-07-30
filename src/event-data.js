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

    const events = items
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
