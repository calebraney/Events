import { attr, checkRunProp, checkContainer, getIxConfig } from '../utilities';

export const parallax = function () {
  //animation ID
  const ANIMATION_ID = 'parallax';
  //elements
  const WRAP = `[data-ix-parallax="wrap"]`;
  const SECTION = `[data-ix-parallax="section"]`;
  const TRIGGER = `[data-ix-parallax="trigger"]`;
  //options
  const TYPE = 'data-ix-parallax-type'; //options are uncover, cover, or parallax
  const AMOUNT = 'data-ix-parallax-amount';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = gsap.utils.toArray(WRAP);
  wraps.forEach((wrap) => {
    const section = wrap.querySelector(SECTION);
    const trigger = wrap.querySelector(TRIGGER);
    if (!wrap || !section || !trigger) return;
    //set default animation type
    let animationType = 'uncover';
    animationType = attr('uncover', wrap.getAttribute(TYPE));
    moveAmount = attr(50, wrap.getAttribute(AMOUNT));

    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    const animation = function (match) {
      if (match) return;
      // default GSAP options for uncover animation
      const settings = {
        scrub: true,
        start: 'top bottom',
        end: 'top top',
        moveStart: '-100vh',
        moveEnd: '0vh',
      };
      //check for animationType of cover
      if (animationType === 'cover') {
        settings.start = 'bottom bottom';
        settings.end = 'bottom top';
        settings.moveStart = '0vh';
        settings.moveEnd = '100vh';
      }
      //check for animationType of parallax
      if (animationType === 'parallax') {
        settings.moveStart = `-${moveAmount}vh`;
        settings.moveEnd = '0vh';
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: trigger,
          markers: false,
          start: settings.start,
          end: settings.end,
          scrub: settings.scrub,
        },
        defaults: {
          duration: 1,
          ease: 'none',
        },
        onStart: () => {
          ScrollTrigger.refresh();
        },
      });
      tl.fromTo(section, { y: settings.moveStart }, { y: settings.moveEnd });
    };

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(section, breakpoint, animation);
  });
};
