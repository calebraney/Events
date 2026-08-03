import { eventList, eventFeed } from './event-list';
import { calendar } from './calendar';

document.addEventListener('DOMContentLoaded', function () {
  //////////////////////////////
  //Control Functions on page load
  eventList();
  eventFeed();
  calendar();
});
