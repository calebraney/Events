import { attr, checkRunProp, checkContainer, getIxConfig } from '../utilities';

export const textLinks = function (gsapContext) {
  //animation ID
  const ANIMATION_ID = 'textlink';
  //elements
  const WRAP = '[data-ix-textlink="wrap"]';
  const FRONT = '[data-ix-textlink="front"]';
  const BACK = '[data-ix-textlink="back"]';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //get wraps
  const wraps = gsap.utils.toArray(WRAP);
  wraps.forEach((wrap) => {
    if (!wrap) return;
    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;
    //get front and back elements
    const front = wrap.querySelector(FRONT);
    const back = wrap.querySelector(BACK);
    if (!front || !back) return;
    const tl = gsap.timeline({
      paused: true,
      defaults: {
        duration: 0.4,
        ease: 'power1.out',
      },
    });
    tl.fromTo(
      front,
      {
        y: '200%',
        rotateZ: 6,
      },
      {
        y: '0%',
        rotateZ: 0,
      }
    );
    tl.fromTo(
      back,
      {
        y: '0%',
        rotateZ: 0,
      },
      {
        y: '-200%',
        rotateZ: -6,
      },
      0
    );
    let isDisabled = false;
    wrap.addEventListener('mouseover', function () {
      if (isDisabled) return;
      tl.play();
    });
    wrap.addEventListener('mouseleave', function () {
      if (isDisabled) return;
      tl.reverse();
    });

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(wrap, breakpoint, (match) => { isDisabled = match; });
  });
};
