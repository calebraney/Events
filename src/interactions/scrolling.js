import {
  attr,
  checkRunProp,
  checkContainer,
  getAttrConfig,
  buildFromToVars,
  getIxConfig,
} from '../utilities';

export const scrolling = function () {
  //animation ID
  const ANIMATION_ID = 'scrolling';
  //elements
  const WRAP = `[data-ix-scrolling="wrap"]`;
  const TRIGGER = `[data-ix-scrolling="trigger"]`;
  const ITEM = '[data-ix-scrolling="item"]';
  //per-item tween options (not handled by buildFromToVars)
  const POSITION = 'data-ix-scrolling-position'; // sequential by default, use "<" to start tweens together
  const DURATION = 'data-ix-scrolling-duration';
  const EASE = 'data-ix-scrolling-ease';
  //breakpoint overrides
  const BREAKPOINT_START = 'data-ix-scrolling-start-breakpoint';
  const BREAKPOINT_END = 'data-ix-scrolling-end-breakpoint';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = gsap.utils.toArray(WRAP);
  wraps.forEach((wrap) => {
    const items = wrap.querySelectorAll(ITEM);

    // return if items are null
    if (!wrap || items.length === 0) return;
    // find the target element if one exists, otherwise the parent is the target
    let trigger = wrap.querySelector(TRIGGER);
    if (!trigger) {
      trigger = wrap;
    }

    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    const animation = function (match) {
      if (match) return;

      // Inner callback: builds (or rebuilds) the timeline using alt start/end if altMatch is true
      let tl;
      const buildTimeline = function (altMatch) {
        if (tl) tl.kill();
        // Use getAttrConfig to read all timeline settings in one call
        const tlSettings = getAttrConfig(wrap, 'scrolling', {
          scrub: 0.5,
          start: 'top bottom',
          end: 'bottom top',
          ease: 'none',
        });

        // Apply alt start/end values when altMatch is true
        if (altMatch && wrap.getAttribute(BREAKPOINT_START)) {
          tlSettings.start = attr(tlSettings.start, wrap.getAttribute(BREAKPOINT_START));
        }
        if (altMatch && wrap.getAttribute(BREAKPOINT_END)) {
          tlSettings.end = attr(tlSettings.end, wrap.getAttribute(BREAKPOINT_END));
        }

        // create timeline
        tl = gsap.timeline({
          scrollTrigger: {
            trigger: trigger,
            start: tlSettings.start,
            end: tlSettings.end,
            scrub: tlSettings.scrub,
            markers: false,
          },
          defaults: {
            duration: 1,
            ease: tlSettings.ease,
          },
        });
        //////////////////////
        // Adding tweens
        items.forEach((item) => {
          if (!item) return;

          // Use buildFromToVars to read all animatable property pairs in one call
          const { varsFrom, varsTo } = buildFromToVars(item, 'scrolling');

          // get per-item tween settings
          const position = attr('<', item.getAttribute(POSITION));
          varsTo.duration = attr(1, item.getAttribute(DURATION));
          varsTo.ease = attr('none', item.getAttribute(EASE));

          //add tween
          let tween = tl.fromTo(item, varsFrom, varsTo, position);
        });
      };

      // Check alt-values breakpoint separately from the disable breakpoint
      const altBreakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-alt-breakpoint`));
      checkContainer(items[0], altBreakpoint, buildTimeline);
    };

    //check container breakpoint and run callback.
    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(items[0], breakpoint, animation);
  });
};
