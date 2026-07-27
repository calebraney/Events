import { attr, checkRunProp, checkContainer, getIxConfig } from '../utilities';

export const imageSwitch = function (gsapContext) {
  const ANIMATION_ID = 'imageswitch';

  const WRAP = '[data-ix-imageswitch="wrap"]';
  const ITEM = '[data-ix-imageswitch="item"]';
  const IMAGE = '[data-ix-imageswitch="image"]';
  const LINK = '[data-ix-imageswitch="link"]';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = [...document.querySelectorAll(WRAP)];
  if (wraps.length === 0) return;
  wraps.forEach((wrap) => {
    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;
    //within each section
    const tabLinks = [...wrap.querySelectorAll(LINK)];
    const items = [...wrap.querySelectorAll(ITEM)];
    const images = [...wrap.querySelectorAll(IMAGE)];
    const ACTIVE_CLASS = 'is-active';
    // for each tab link add an event listener that will scroll to the correct id
    if (items.length === 0 || images.length === 0) return;

    //utility function to activate or de-activate item
    const activateItem = function (index, activate = true) {
      //get the matching items
      const image = images[index];
      const item = items[index];
      const tab = tabLinks[index];
      // const tab = tabLinks[index]
      if (activate) {
        image.classList.add(ACTIVE_CLASS);
        item.classList.add(ACTIVE_CLASS);
        tab.classList.add(ACTIVE_CLASS);
      } else {
        image.classList.remove(ACTIVE_CLASS);
        item.classList.remove(ACTIVE_CLASS);
        tab.classList.remove(ACTIVE_CLASS);
      }
    };
    const animation = function (match) {
      if (match) return;
      // remove all active classes
      images.forEach((item) => item.classList.remove(ACTIVE_CLASS));
      //activate first item
      activateItem(0);
      // animate each item
      items.forEach((item, index) => {
        const image = images[index];
        const tab = tabLinks[index];
        if (!item || !image) return;
        const imageTL = gsap.timeline({
          scrollTrigger: {
            trigger: item,
            start: 'top center',
            end: 'bottom center',
            markers: false,
            scrub: true,
            onEnter: () => {
              activateItem(index);
            },
            onLeave: () => {
              // don't remove class on leave of the last item
              if (index !== items.length - 1) {
                activateItem(index, false);
              }
              tab.classList.remove(ACTIVE_CLASS);
            },
            onEnterBack: () => {
              activateItem(index);
            },
            onLeaveBack: () => {
              // don't remove class on leaveback of the first item
              if (index !== 0) {
                activateItem(index, false);
              }
              tab.classList.remove(ACTIVE_CLASS);
            },
          },
        });
      });

      //manage clicking of tab links (button elements)
      // tabLinks.forEach((link, index) => {
      //   if (!link) return;
      //   link.addEventListener('click', (e) => {
      //     const el = items[index];
      //     if (!el) return;
      //     el.scrollIntoView({
      //       behavior: 'smooth',
      //       block: 'center',
      //     });
      //   });
      // });
    };

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(items[0], breakpoint, animation);
  });
};
