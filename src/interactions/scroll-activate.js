import { attr, checkRunProp, checkContainer, getAttrConfig, getIxConfig } from '../utilities';

export const scrollActivate = function () {
  const ANIMATION_ID = 'scrollactivate';

  const WRAP    = '[data-ix-scrollactivate="wrap"]';
  const ITEM    = '[data-ix-scrollactivate="item"]';
  const TRIGGER = '[data-ix-scrollactivate="trigger"]';
  const TARGET  = '[data-ix-scrollactivate="target"]';
  const ID      = 'data-ix-scrollactivate-id';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = [...document.querySelectorAll(WRAP)];
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    if (checkRunProp(wrap, ANIMATION_ID) === false) return;

    const items = [...wrap.querySelectorAll(ITEM)];
    if (items.length === 0) return;

    // scrub defaults to 0 (number) so attr() can coerce numeric strings (e.g. '0.5').
    // Pass `scrub: itemScrub || false` to ScrollTrigger so 0 maps to false (no scrub).
    const config = getAttrConfig(wrap, ANIMATION_ID, {
      keepActiveOnScrollOut:    false,
      keepActiveBeforeScrollIn: false,
      startFirstActive:         false,
      start:                    'top center',
      end:                      'bottom center',
      scrub:                    0,
      ease:                     'none',
      activeClass:              'is-active',
    });

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));

    const activateItem = function (item, makeActive = true) {
      const activeClass = attr(config.activeClass, item.getAttribute('data-ix-scrollactivate-active-class'));
      const itemID = item.getAttribute(ID);
      const targetEl = itemID ? wrap.querySelector(`${TARGET}[${ID}="${itemID}"]`) : null;
      item.classList.toggle(activeClass, makeActive);
      if (targetEl) targetEl.classList.toggle(activeClass, makeActive);
    };

    const animation = function (match) {
      if (match) return;

      items.forEach((item) => activateItem(item, false));
      if (config.startFirstActive || config.keepActiveBeforeScrollIn) {
        activateItem(items[0]);
      }

      items.forEach((item, index) => {
        const triggerEl = item.querySelector(TRIGGER) || item;
        const itemStart = attr(config.start, item.getAttribute('data-ix-scrollactivate-start'));
        const itemEnd   = attr(config.end,   item.getAttribute('data-ix-scrollactivate-end'));
        const itemScrub = attr(config.scrub, item.getAttribute('data-ix-scrollactivate-scrub'));
        const itemEase  = attr(config.ease,  item.getAttribute('data-ix-scrollactivate-ease'));

        ScrollTrigger.create({
          trigger: triggerEl,
          start:   itemStart,
          end:     itemEnd,
          scrub:   itemScrub || false,
          ease:    itemEase,
          onEnter:     () => { activateItem(item); },
          onLeave:     () => {
            if (config.keepActiveOnScrollOut && index === items.length - 1) return;
            activateItem(item, false);
          },
          onEnterBack: () => { activateItem(item); },
          onLeaveBack: () => {
            if (config.keepActiveBeforeScrollIn && index === 0) return;
            activateItem(item, false);
          },
        });
      });
    };

    checkContainer(items[0], breakpoint, animation);
  });
};
