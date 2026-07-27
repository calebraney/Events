import { attr, checkRunProp, checkContainer, getIxConfig } from '../utilities';

export const banner = function () {
  //animation ID
  const ANIMATION_ID = 'banner';
  //selectors
  const WRAP = '[data-ix-banner="wrap"]';
  const TRACK = '[data-ix-banner="track"]';
  //options
  const START = 'data-ix-banner-start';
  const END = 'data-ix-banner-end';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //elements
  const wraps = [...document.querySelectorAll(WRAP)];
  wraps.forEach((wrap) => {
    //get elements
    const track = wrap.querySelector(TRACK);

    if (!wrap || !track) return;

    const animation = function (match) {
      if (match) return;
      let start = attr('center 80%', wrap.getAttribute(START));
      let end = attr('center 20%', wrap.getAttribute(END));

      // create main horizontal scroll timeline
      let tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap,
          start: start,
          end: end,
          scrub: 1,
          markers: false,
        },
      });
      tl.to(track, { xPercent: -100, ease: 'none', duration: 1 });
    };
    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;
    //check container breakpoint and run callback.
    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(track, breakpoint, animation);
  });
};
