import { eventList, eventFeed } from './event-list';
import { eventDetail } from './event-detail';
import { calendar } from './calendar';

// Each view is independent — a page might only use one or two of the four.
// Isolating each call means an uncaught exception in one (e.g. from
// unexpectedly malformed page content) can't prevent the others from
// running, the way four unguarded sequential calls would otherwise allow.
function runSafely(name, fn) {
  try {
    fn();
  } catch (e) {
    console.error(`events: ${name}() threw and was stopped — other views on this page are unaffected.`, e);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  //////////////////////////////
  //Control Functions on page load
  runSafely('eventList', eventList);
  runSafely('eventFeed', eventFeed);
  runSafely('eventDetail', eventDetail);
  runSafely('calendar', calendar);
});
