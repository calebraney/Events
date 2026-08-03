import { parseEventFromJSON } from './recurrence';
import { debugLog } from './utilities';

// ============================================================================
// event-data: shared data lookup for event-list.js and calendar.js
// ============================================================================
//
// Every layout resolves its data source the same way, scoped to its own
// wrap, so most pages can use ONE shared source with zero extra
// configuration while any individual instance can still opt into its own
// scoped data (e.g. a smaller, pre-filtered Collection List) just by DOM
// position — no attribute to set. Resolution, per wrap:
//   1. A [data-ix-events="data-wrap"] nested INSIDE this wrap — a local
//      override, always wins if present.
//   2. Otherwise, the first [data-ix-events="data-wrap"] found anywhere on
//      the page that ISN'T nested inside any OTHER wrap — i.e. a genuinely
//      page-level source, not "claimed" by a different instance. This is
//      what lets a page-wide fallback exist once and be shared by every
//      wrap that doesn't define its own local one.
//   3. Neither found — console.warn, callback([]).
//
// Expected structure for a data-wrap, wherever it lives:
//   [data-ix-events="data-wrap"]   the Webflow Collection List wrapper
//     [data-ix-events="item"]        one per CMS item
//       [data-ix-events="data"]        <script type="application/json"> — raw event fields
//
// This is the *data* source only. A view's visible cards may live in this
// same Collection List (each item carrying both the JSON and the card — see
// event-list.js's own item scan) or in a completely separate Collection
// List — event-list.js handles both, matching by slug in the separate case.
//
// More than ~100 events: Webflow only renders a Collection List's first ~100
// items natively. To go beyond that, add Finsweet's fs-list-element="list"
// and fs-list-load="all" to whichever data-wrap actually holds the overflow
// — when present, this module waits for Finsweet to finish loading every
// paginated page (via the List instance's `loadingPaginatedItems` promise)
// before scanning for events, so nothing past the first page gets silently
// missed. Sites that don't need this (under 100 events) can leave both
// attributes off — behavior is unchanged either way.
// ============================================================================

const WRAP = '[data-ix-events="wrap"]';
const DATA_WRAP = '[data-ix-events="data-wrap"]';
const ITEM = '[data-ix-events="item"]';
const DATA_EL = '[data-ix-events="data"]';

const MAX_ATTEMPTS = 20;
const RETRY_DELAY = 300;

// Local override (nested inside `wrap`) wins; otherwise the first page-level
// data-wrap not claimed by any other wrap. Re-run on every retry attempt (see
// whenEvents) in case a data-wrap renders into the DOM after this first runs.
//
// Classifies every data-wrap on the page by its NEAREST wrap ancestor
// (closest(WRAP)), in one pass, rather than searching inside `wrap` and
// page-wide separately — that distinction matters if a wrap ever ends up
// nested inside another wrap: wrap.querySelectorAll() is recursive, so a
// naive "search inside wrap" would incorrectly let an outer wrap steal a
// nested child wrap's own local data-wrap. Classifying by nearest ancestor
// instead means a data-wrap only ever belongs to the ONE wrap it's actually
// closest to — exactly `wrap` (local), no wrap at all (page-level,
// unclaimed), or some other wrap entirely (ignored here, it's not ours).
function resolveDataWrap(wrap) {
  const all = [...document.querySelectorAll(DATA_WRAP)];

  const local = all.filter((el) => el.closest(WRAP) === wrap);
  if (local.length > 0) {
    if (local.length > 1) {
      console.warn(
        `events: found ${local.length} elements matching ${DATA_WRAP} inside this wrap — using the first one.`,
        wrap
      );
    }
    debugLog('[event-data] resolveDataWrap — using LOCAL data-wrap for', wrap, '->', local[0]);
    return local[0];
  }

  const candidates = all.filter((el) => el.closest(WRAP) === null);
  if (candidates.length > 1) {
    console.warn(
      `events: found ${candidates.length} page-level elements matching ${DATA_WRAP} (not nested inside any wrap) — using the first one. Remove the extras, or nest one inside a specific wrap to scope it there instead.`
    );
  }
  debugLog(
    '[event-data] resolveDataWrap — no local data-wrap for',
    wrap,
    ', using page-level fallback ->',
    candidates[0] || null,
    `(${candidates.length} unclaimed candidate(s) found)`
  );
  return candidates[0] || null;
}

// Calls back with an array of parsed events once this wrap's resolved
// data-wrap has items (retrying briefly in case the Collection List renders
// after this script runs, or a local/page-level data-wrap doesn't exist yet),
// or with [] if none ever appear.
export function whenEvents(wrap, callback) {
  let attempts = 0;

  const tryLoad = () => {
    const dataWrap = resolveDataWrap(wrap);
    const items = dataWrap ? [...dataWrap.querySelectorAll(ITEM)] : [];

    if (items.length === 0) {
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(tryLoad, RETRY_DELAY);
        return;
      }
      if (!dataWrap) {
        console.warn(
          `events: no ${DATA_WRAP} found for this wrap — neither nested inside it, nor at the page level (outside any wrap).`,
          wrap
        );
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
