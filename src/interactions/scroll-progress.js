import { attr, checkRunProp, checkContainer, getAttrConfig, getIxConfig } from '../utilities';

export const scrollProgress = function () {
  //animation ID
  const ANIMATION_ID = 'scrollprogress';
  //elements
  const WRAP = '[data-ix-scrollprogress="wrap"]';
  const BAR = '[data-ix-scrollprogress="bar"]'; // the visual bar element (will be scaled 0→1)
  const TRIGGER = '[data-ix-scrollprogress="trigger"]'; // optional custom trigger element
  //options
  const SCOPE = 'data-ix-scrollprogress-scope'; // "page" (full page) or "section" (scoped to wrap)
  const AXIS = 'data-ix-scrollprogress-axis'; // "x" (horizontal bar) or "y" (vertical bar)
  const EASE = 'data-ix-scrollprogress-ease';
  const SCRUB = 'data-ix-scrollprogress-scrub';
  const START = 'data-ix-scrollprogress-start';
  const END = 'data-ix-scrollprogress-end';
  const ACTIVE_CLASS = 'data-ix-scrollprogress-active-class'; // class added to wrap while scrolltrigger is active

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = [...document.querySelectorAll(WRAP)];
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    const bar = wrap.querySelector(BAR);
    if (!wrap || !bar) return;

    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    const animation = function (match) {
      if (match) return;
      // Read all options from data attributes
      let scope = attr('page', wrap.getAttribute(SCOPE));
      let axis = attr('x', wrap.getAttribute(AXIS));
      let ease = attr('none', wrap.getAttribute(EASE));
      let scrub = attr(0.3, wrap.getAttribute(SCRUB));
      let activeClass = attr('is-active', wrap.getAttribute(ACTIVE_CLASS));

      // Determine the scroll trigger element
      // If scope is "page", use the body to track the full page scroll
      // If scope is "section", use a custom trigger element or the wrap itself
      let trigger;
      if (scope === 'page') {
        trigger = document.body;
      } else {
        trigger = wrap.querySelector(`${TRIGGER}`) || wrap;
      }

      // Set default start/end based on scope
      let start, end;
      if (scope === 'page') {
        start = attr('top top', wrap.getAttribute(START));
        end = attr('bottom bottom', wrap.getAttribute(END));
      } else {
        start = attr('top bottom', wrap.getAttribute(START));
        end = attr('bottom top', wrap.getAttribute(END));
      }

      // Determine which scale property to animate based on axis
      // Using scaleX/scaleY instead of width/height for GPU-accelerated performance
      const scaleFrom = axis === 'y' ? { scaleY: 0 } : { scaleX: 0 };
      const scaleTo = axis === 'y' ? { scaleY: 1 } : { scaleX: 1 };

      // Create scroll-linked timeline
      let tl = gsap.timeline({
        scrollTrigger: {
          trigger: trigger,
          start: start,
          end: end,
          scrub: scrub,
          onEnter: () => {
            wrap.classList.add(activeClass);
          },
          onLeave: () => {
            wrap.classList.remove(activeClass);
          },
          onEnterBack: () => {
            wrap.classList.add(activeClass);
          },
          onLeaveBack: () => {
            wrap.classList.remove(activeClass);
          },
        },
      });
      tl.fromTo(bar, { ...scaleFrom, ease: ease }, { ...scaleTo, ease: ease, duration: 1 });
    };

    //check container breakpoint and run callback.
    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(bar, breakpoint, animation);
  });
};
