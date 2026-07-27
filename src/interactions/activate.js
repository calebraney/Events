import { checkRunProp, attr, getAttrConfig, getIxConfig, checkContainer } from '../utilities';

export const activate = function () {
  //animation ID
  const ANIMATION_ID = 'activate';
  //elements
  const WRAP = '[data-ix-activate="wrap"]';
  const ITEM = '[data-ix-activate="item"]'; // required: the element(s) that will receive the active class toggle and optional aria-expanded attribute update when their trigger is clicked or hovered
  const TRIGGER = '[data-ix-activate="trigger"]'; // optional child element — if present, used as the event listener target inside an item
  const TARGET = '[data-ix-activate="target"]'; // additional element to activate (matched by ID attribute)
  const ID = 'data-ix-activate-id';
  //per-item option
  const OPTION_START_ACTIVE = 'data-ix-activate-start-active';
  const ACTIVE_CLASS = 'is-active';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  // Core logic — runs once per group (either a wrap element or the non-wrapped item set)
  const activateList = function (rootElement, overrideItems) {
    const isWrap = rootElement.matches(WRAP);

    const config = getAttrConfig(rootElement, ANIMATION_ID, {
      activeClass: ACTIVE_CLASS,
      type: 'click', // or hover
      firstActive: false, // for click type: whether to automatically activate the first item on load
      oneActive: false, // for click type: whether to allow multiple active items at once, or to always deactivate others when activating a new one
      keepOneActive: false, // whether to keep at least one item active (click: prevents deactivating last item; hover: keeps item active on mouseleave)
      scrollRefresh: true, // whether to call ScrollTrigger.refresh() after activation
      scrollRefreshDelay: 800, //miliseconds to delay ScrollTrigger.refresh()
      ariaLabels: true, //add aria-expanded attributes to the trigger elements for better accessibility
      deactivateDelay: 0, // seconds; if > 0, auto-deactivates the item after this delay
      secondClickDeactivate: true, // for click type: if false, clicking an active trigger does nothing
      breakpointState: 'preserve', // 'preserve', 'active', or 'inactive' — state items are forced to when the interaction is disabled at the breakpoint
    });
    const breakpoint = attr('none', rootElement.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));

    if (isWrap) {
      if (checkRunProp(rootElement, ANIMATION_ID) === false) return;
    }

    const items = overrideItems ?? Array.from(rootElement.querySelectorAll(ITEM));
    if (items.length === 0) return;

    const getTrigger = function (item) {
      return item.querySelector(TRIGGER) ?? item;
    };

    const findTarget = function (item) {
      const itemID = item.getAttribute(ID);
      if (!itemID) return null;
      const scope = isWrap ? rootElement : document;
      return scope.querySelector(`${TARGET}[${ID}="${itemID}"]`);
    };

    // Activate or deactivate an item, its trigger child, and its matching target
    const activateItem = function (item, makeActive = true) {
      if (!item) return;
      const activeClass = attr(
        config.activeClass,
        item.getAttribute(`data-ix-${ANIMATION_ID}-active-class`)
      );
      const targetEl = findTarget(item);
      item.classList.toggle(activeClass, makeActive);
      if (targetEl) targetEl.classList.toggle(activeClass, makeActive);
      if (config.ariaLabels) {
        const triggerEl = getTrigger(item);
        triggerEl.setAttribute('aria-expanded', makeActive ? 'true' : 'false');
      }
    };
    let isDisabled = false;

    // hover type
    if (config.type === 'hover') {
      items.forEach((item) => {
        //set initial active state based on per-item option
        const startActive = attr(false, item.getAttribute(OPTION_START_ACTIVE));
        activateItem(item, startActive);

        const triggerEl = getTrigger(item);
        // mouseenter/mouseleave avoids re-firing when hovering over child elements
        triggerEl.addEventListener('mouseenter', function () {
          if (isDisabled) return;
          items.forEach((child) => activateItem(child, child === item));
        });
        triggerEl.addEventListener('mouseleave', function () {
          if (isDisabled) return;
          if (!config.keepOneActive) activateItem(item, false);
        });
      });
    } else {
      // click type
      const deactivateTimers = new Map();

      const scheduleDeactivate = function (item) {
        if (config.deactivateDelay <= 0) return;
        if (deactivateTimers.has(item)) clearTimeout(deactivateTimers.get(item));
        const timer = setTimeout(() => {
          activateItem(item, false);
          deactivateTimers.delete(item);
        }, config.deactivateDelay * 1000);
        deactivateTimers.set(item, timer);
      };

      items.forEach((item) => {
        //set initial active state based on per-item option
        const startActive = attr(false, item.getAttribute(OPTION_START_ACTIVE));
        activateItem(item, startActive);

        const triggerEl = getTrigger(item);
        triggerEl.addEventListener('click', function () {
          if (isDisabled) return;
          const itemIsActive = item.classList.contains(config.activeClass);

          if (!itemIsActive) {
            if (config.oneActive) {
              items.forEach((el) => activateItem(el, el === item));
            } else {
              activateItem(item);
            }
            scheduleDeactivate(item);
          } else if (config.secondClickDeactivate) {
            if (!config.keepOneActive) {
              activateItem(item, false);
            } else {
              const activeCount = items.filter((el) =>
                el.classList.contains(config.activeClass)
              ).length;
              if (activeCount > 1) activateItem(item, false);
            }
          }

          if (
            config.scrollRefresh &&
            typeof gsap !== 'undefined' &&
            gsap.ScrollTrigger !== undefined
          ) {
            setTimeout(() => ScrollTrigger.refresh(), config.scrollRefreshDelay);
          }
        });
      });
    }
    if (config.firstActive) {
      activateItem(items[0]);
    }

    checkContainer(items[0], breakpoint, (match) => {
      isDisabled = match;
      if (config.breakpointState === 'preserve') return;
      if (match) {
        const makeActive = config.breakpointState === 'active';
        items.forEach((item) => activateItem(item, makeActive));
      } else {
        items.forEach((item) => {
          const startActive = attr(false, item.getAttribute(OPTION_START_ACTIVE));
          activateItem(item, startActive);
        });
        if (config.firstActive) activateItem(items[0]);
      }
    });
  };

  const wraps = Array.from(document.querySelectorAll(WRAP));

  if (wraps.length === 0) {
    // No wraps anywhere — run on the full item set with defaults
    const allItems = Array.from(document.querySelectorAll(ITEM));
    if (allItems.length > 0) activateList(document.body, allItems);
  } else {
    // Run each wrap as its own isolated group
    wraps.forEach((wrap) => activateList(wrap));

    // Any items that sit outside all wraps form their own independent group
    const nonWrappedItems = Array.from(document.querySelectorAll(ITEM)).filter(
      (item) => !item.closest(WRAP)
    );
    if (nonWrappedItems.length > 0) {
      activateList(document.body, nonWrappedItems);
    }
  }
};
