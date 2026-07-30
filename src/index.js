import { eventList, eventFeed } from './event-list';
import { calendar } from './calendar';

document.addEventListener('DOMContentLoaded', function () {
  // Comment out for production
  // console.log('Local Script Loaded');
  //////////////////////////////
  //Control Functions on page load
  eventList();
  eventFeed();
  calendar();
});
