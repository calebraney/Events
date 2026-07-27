import { attr, attrIfSet, checkRunProp, checkContainer, buildFromToVars, getIxConfig } from '../utilities';

export const loop = function () {
  //animation ID
  const ANIMATION_ID = 'loop';
  //elements
  const ITEM = `[data-ix-loop="item"]`;

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const items = [...document.querySelectorAll(ITEM)];
  items.forEach((item) => {
    // return if items are null
    if (!item) return;
    //check if the run prop is set to true
    let runProp = checkRunProp(item, ANIMATION_ID);
    if (runProp === false) return;

    const animation = function (match) {
      if (match) return;

      //////////////////////
      // Adding tweens

      let tl = gsap.timeline({
        defaults: {
          repeat: -1,
          ease: 'none',
        },
      });

      // Use buildFromToVars for all animatable property pairs (x, y, scale, rotate, etc.)
      const { varsFrom, varsTo } = buildFromToVars(item, 'loop');

      // Add loop-specific tween properties that only this interaction uses
      varsTo.yoyo = attrIfSet(item, 'data-ix-loop-yoyo', false);
      varsTo.delay = attrIfSet(item, 'data-ix-loop-delay', 0);
      varsTo.repeatDelay = attrIfSet(item, 'data-ix-loop-repeat-delay', 0);
      varsTo.duration = attrIfSet(item, 'data-ix-loop-duration', 1);
      varsTo.ease = attrIfSet(item, 'data-ix-loop-ease', 'none');

      //create tween
      let tween = tl.fromTo(item, varsFrom, varsTo);
    };

    const breakpoint = attr('none', item.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(item, breakpoint, animation);
  });
};
