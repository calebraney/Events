import { eventList } from './interactions/event-list';
import { calendar } from './interactions/calendar';

document.addEventListener('DOMContentLoaded', function () {
  // Comment out for production
  // console.log('Local Script Loaded');
  //////////////////////////////
  //Control Functions on page load
  eventList();
  calendar();
});
