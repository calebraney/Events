import { attr, checkRunProp, getIxConfig } from '../utilities';

export const triggerEvent = function () {
  const ANIMATION_ID = 'triggerEvent';
  //elements
  const WRAP_SEL = '[data-ix-triggerevent="wrap"]';
  const TRIGGER_SEL = '[data-ix-triggerevent="trigger"]';
  const TARGET_SEL = '[data-ix-triggerevent="target"]';
  const ID_ATTR = 'data-ix-triggerevent-id';
  const EVENTS_ATTR = 'data-ix-triggerevent-events';
  const TARGET_EVENTS_ATTR = 'data-ix-triggerevent-target-events';
  const DELAY_ATTR = 'data-ix-triggerevent-delay';

  //event name aliases → resolved native event names
  const EVENT_MAP = {
    hover: 'mouseenter',
    hoverin: 'mouseenter',
    hoverout: 'mouseleave',
  };
  const resolveEvent = (name) => EVENT_MAP[name] || name;

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const fireEvent = function (element, eventName) {
    if (eventName === 'click') {
      element.click();
    } else if (eventName === 'focus') {
      // Defer so the browser's own focus management (e.g. focusing the clicked trigger) completes first
      setTimeout(() => element.focus(), 0);
    } else if (eventName === 'blur') {
      setTimeout(() => element.blur(), 0);
    } else {
      element.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true }));
    }
  };

  const triggerEventList = function (triggers) {
    if (triggers.length === 0) return;

    triggers.forEach((trigger) => {
      if (!checkRunProp(trigger, ANIMATION_ID)) return;

      const id = trigger.getAttribute(ID_ATTR);
      if (!id) return;

      // Scope target search to the same wrap as the trigger, or to unwrapped elements only
      const closestWrap = trigger.closest(WRAP_SEL);
      let matchingTargets;
      if (closestWrap) {
        matchingTargets = [...closestWrap.querySelectorAll(TARGET_SEL)].filter(
          (t) => t.getAttribute(ID_ATTR) === id
        );
      } else {
        matchingTargets = [...document.querySelectorAll(TARGET_SEL)]
          .filter((t) => !t.closest(WRAP_SEL) && t.getAttribute(ID_ATTR) === id);
      }
      if (matchingTargets.length === 0) return;

      const eventsRaw = attr('click', trigger.getAttribute(EVENTS_ATTR));
      const delay = attr(0, trigger.getAttribute(DELAY_ATTR));
      const triggerEvents = eventsRaw
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
        .map(resolveEvent);

      // Target events default to the same as trigger events if not set
      const targetEventsRaw = trigger.getAttribute(TARGET_EVENTS_ATTR);
      const targetEvents = targetEventsRaw
        ? targetEventsRaw.split(',').map((e) => e.trim()).filter(Boolean).map(resolveEvent)
        : triggerEvents;

      const singleTargetEvents = ['focus', 'blur'];
      const hasSingleTargetEvent = targetEvents.some((e) => singleTargetEvents.includes(e));
      if (hasSingleTargetEvent && matchingTargets.length > 1) {
        console.warn(
          `[triggerEvent] Events like "focus" or "blur" can only apply to one element at a time. Multiple targets found for id="${id}" — all events will fire but only the last target will remain focused/blurred.`
        );
      }

      triggerEvents.forEach((triggerEvent) => {
        trigger.addEventListener(triggerEvent, () => {
          const fire = () => {
            matchingTargets.forEach((target) => {
              targetEvents.forEach((targetEvent) => {
                fireEvent(target, targetEvent);
              });
            });
          };
          if (delay > 0) {
            setTimeout(fire, delay * 1000);
          } else {
            fire();
          }
        });
      });
    });
  };

  const allTriggers = [...document.querySelectorAll(TRIGGER_SEL)];
  triggerEventList(allTriggers);
};
