import { attr, checkRunProp, checkContainer, getIxConfig } from '../utilities';

export const pathHover = function () {
  //animation ID
  const ANIMATION_ID = 'pathhover';
  //selectors
  const WRAP = '[data-ix-pathhover="wrap"]';
  const PATH = '[data-ix-pathhover="path"]';
  //options
  const DURATION = 'data-ix-pathhover-duration';
  const REVERSE = 'data-ix-pathhover-reverse';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //elements
  const wraps = document.querySelectorAll(WRAP);
  wraps.forEach((wrap) => {
    //get elements
    const paths = [...wrap.querySelectorAll(PATH)];

    if (!wrap || paths.length === 0) return;

    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;
    let duration = attr(1.2, wrap.getAttribute(DURATION));
    let reverse = attr(false, wrap.getAttribute(REVERSE));

    // create main horizontal scroll timeline
    let tl = gsap.timeline({
      paused: true,
    });
    tl.fromTo(
      paths,
      {
        drawSVG: '0%',
      },
      {
        drawSVG: '0% 100%',
        duration: duration,
        ease: 'power2.inOut',
      }
    );
    //set the animation to finished if reverse is true
    if (reverse) {
      tl.progress(1);
    }

    let isDisabled = false;
    wrap.addEventListener('mouseenter', () => {
      if (isDisabled) return;
      // if reverse is false, play animation on mouse enter, otherwise reverse on mouse enter
      if (!reverse) {
        tl.play();
      } else {
        tl.reverse();
      }
    });
    wrap.addEventListener('mouseleave', () => {
      if (isDisabled) return;
      // if reverse is false, reverse animation on mouse leave, otherwise play on mouse enter
      if (reverse) {
        tl.play();
      } else {
        tl.reverse();
      }
    });

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(wrap, breakpoint, (match) => { isDisabled = match; });
  });
};
