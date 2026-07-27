import { attr, checkRunProp, checkContainer, getAttrConfig, getIxConfig } from '../utilities';

export const marquee = function () {
  //animation ID
  const ANIMATION_ID = 'marquee';
  const WRAP = '[data-ix-marquee="wrap"]';
  const LIST = '[data-ix-marquee="list"]'; // put on the CMS LIST WRAP element (NOT THE LIST)
  const ACCELERATE_ON_HOVER = 'accelerate';
  const DECELERATE_ON_HOVER = 'decelerate';
  const PAUSE_ON_HOVER = 'pause';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //for each wrap
  const wraps = document.querySelectorAll(WRAP);
  if (wraps.length === 0) return;
  wraps.forEach((wrap) => {
    //get lists
    const lists = [...wrap.querySelectorAll(LIST)];
    //animation function
    const animation = function (match) {
      if (match) return;
      const config = getAttrConfig(wrap, ANIMATION_ID, {
        vertical: false,
        reverse: false,
        duration: 30, //duration in seconds
        durationDynamic: false,
        durationPerItem: 5, // only used if durationDynamic is true — determines the duration based on the amount of items in the list
        hover: 'none', // or use one of the constants for hover behavior
      });
      // get the amount of items in the wrap
      let itemCount = lists[0].childElementCount;
      if (itemCount === 1) {
        //if there is only one item get the list element inside it and count the amount of elements in that
        itemCount = lists[0].firstElementChild.childElementCount;
      }
      //if duration is set to be dynamic make the duration based on the amount of items and the duration per item
      let duration = config.durationDynamic
        ? itemCount * config.durationPerItem
        : config.duration;

      let direction = 1;
      if (config.reverse) {
        direction = -1;
      }
      let tl = gsap.timeline({
        repeat: -1,
        defaults: {
          ease: 'none',
        },
      });
      tl.fromTo(
        lists,
        {
          xPercent: 0,
          yPercent: 0,
        },
        {
          // if vertical is true move yPercent, otherwise move x percent
          xPercent: config.vertical ? 0 : -100 * direction,
          yPercent: config.vertical ? -100 * direction : 0,
          duration: duration,
        }
      );
      if (config.hover === ACCELERATE_ON_HOVER) {
        wrap.addEventListener('mouseenter', (event) => {
          tl.timeScale(2);
        });
        wrap.addEventListener('mouseleave', (event) => {
          tl.timeScale(1);
        });
      }
      if (config.hover === DECELERATE_ON_HOVER) {
        wrap.addEventListener('mouseenter', (event) => {
          tl.timeScale(0.5);
        });
        wrap.addEventListener('mouseleave', (event) => {
          tl.timeScale(1);
        });
      }
      if (config.hover === PAUSE_ON_HOVER) {
        wrap.addEventListener('mouseenter', (event) => {
          tl.pause();
        });
        wrap.addEventListener('mouseleave', (event) => {
          tl.play();
        });
      }
    };
    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    //check container breakpoint and run callback.
    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(lists[0], breakpoint, animation);
  });
};
