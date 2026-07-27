import { attr, checkRunProp, checkContainer, getAttrConfig, getIxConfig } from '../utilities';

export const magnetic = function () {
  //animation ID
  const ANIMATION_ID = 'magnetic';
  //elements
  const WRAP = '[data-ix-magnetic="wrap"]'; // the wrapper element
  const TRIGGER = '[data-ix-magnetic="trigger"]'; // optional: source of pointer events (defaults to wrap)
  const TARGET = '[data-ix-magnetic="target"]'; // optional: the element that moves (defaults to wrap)
  const INNER = '[data-ix-magnetic="inner"]'; // optional inner element that moves further (e.g. button text)

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  // Select all wraps
  const wraps = [...document.querySelectorAll(WRAP)];
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    if (!wrap) return;

    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    // Skip on touch devices — magnetic effects don't make sense without a cursor
    if ('ontouchstart' in window || navigator.maxTouchPoints) return;

    // Read options
    const config = getAttrConfig(wrap, ANIMATION_ID, {
      strength: 0.3,
      innerStrength: 0.5,
      duration: 0.6,
      ease: 'power1.out',
      returnDuration: 0.6,
      returnEase: 'elastic.out(1.2, 0.5)',
      activeClass: 'is-active',
      hoverScale: 1,
    });

    // Get optional elements — fall back to wrap if not present
    const trigger = wrap.querySelector(TRIGGER) || wrap; // source of pointer events
    const target = wrap.querySelector(TARGET) || wrap; // element that moves
    const inner = wrap.querySelector(INNER); // optional inner element

    let isDisabled = false;
    // Track mouse position within the trigger and apply magnetic pull
    trigger.addEventListener('mousemove', function (e) {
      if (isDisabled) return;
      const rect = trigger.getBoundingClientRect();
      // Calculate offset from center of the trigger, in pixels
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;

      // Move the target by strength amount
      gsap.to(target, {
        x: offsetX * config.strength,
        y: offsetY * config.strength,
        scale: config.hoverScale,
        duration: config.duration,
        ease: config.ease,
        overwrite: 'auto',
      });

      // Move the inner element further for a layered parallax-like effect
      if (inner) {
        gsap.to(inner, {
          x: offsetX * config.innerStrength,
          y: offsetY * config.innerStrength,
          duration: config.duration,
          ease: config.ease,
          overwrite: 'auto',
        });
      }
    });

    trigger.addEventListener('mouseenter', function () {
      if (isDisabled) return;
      wrap.classList.add(config.activeClass);
    });

    trigger.addEventListener('mouseleave', function () {
      if (isDisabled) return;
      wrap.classList.remove(config.activeClass);
      // Snap back to center
      gsap.to(target, {
        x: 0,
        y: 0,
        scale: 1,
        duration: config.returnDuration,
        ease: config.returnEase,
        overwrite: 'auto',
      });

      if (inner) {
        gsap.to(inner, {
          x: 0,
          y: 0,
          duration: config.returnDuration,
          ease: config.returnEase,
          overwrite: 'auto',
        });
      }
    });

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(wrap, breakpoint, (match) => { isDisabled = match; });
  });
};
