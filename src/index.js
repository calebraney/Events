import { eventList, eventFeed } from './event-list';
import { eventDetail } from './event-detail';
import { calendar } from './calendar';

document.addEventListener('DOMContentLoaded', function () {
  //////////////////////////////
  //Control Functions on page load
  eventList();
  eventFeed();
  eventDetail();
  calendar();
});
