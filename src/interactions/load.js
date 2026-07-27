import {
  attr,
  getNonContentsChildren,
  checkRunProp,
  checkContainer,
  getIxConfig,
} from '../utilities';
import { createAnimation, isAnimationType } from './animations';

/* CSS in PAGE Head
body:not([data-ix-load-page-run="false" i]) [data-ix-load="wrap"]:not([data-ix-load-run="false" i]) {
  & [data-ix-load]:not([data-ix-load-run="false" i], [data-ix-load="stagger"]) {
    visibility: hidden;
  }
  & [data-ix-load="stagger"]:not([data-ix-load-run="false" i]) > *:not(.u-display-contents) {
    visibility: hidden;
  }
  & [data-ix-load="stagger"]:not([data-ix-load-run="false" i]) > .u-display-contents > * {
    visibility: hidden;
  }
}
*/

export const load = function (reduceMotion) {
  // Animation ID used for data attribute construction and run checks
  const ANIMATION_ID = 'load';
  const ATTRIBUTE = 'data-ix-load';

  // Element-type keyword constants (values for the data-ix-load attribute)
  const WRAP = 'wrap';
  const HEADING = 'heading';
  const PARAGRAPH = 'paragraph';
  const ITEM = 'item';
  const IMAGE = 'image';
  const LINE = 'line';
  const STAGGER = 'stagger';

  // Timeline positioning attributes
  const POSITION = 'data-ix-load-position'; // sequential by default; use "<" to overlap tweens
  const DEFAULT_STAGGER = '<0.2'; // default gap between consecutive load items

  // ── Config resolution ─────────────────────────────────────────────────────
  // Maps element-type keywords to animation types.
  // Override per-site via window.ixConfig.load in <head>:
  //   window.ixConfig = { load: { heading: 'slide-up-words' } }
  //   window.ixConfig = { load: false }  // disables entire load interaction
  const ELEMENT_TYPE_DEFAULTS = {
    [HEADING]: 'slide-up-words', // strong 3D flip — matches original loadHeading behaviour
    [PARAGRAPH]: 'slide-up',
    [ITEM]: 'slide-up',
    [IMAGE]: 'scale-up', // scale from 0.8 + fade — matches original loadImage behaviour
    [LINE]: 'clip-left',
    [STAGGER]: 'slide-up',
  };
  const ixConfig = getIxConfig(ANIMATION_ID, ELEMENT_TYPE_DEFAULTS);
  // Exit if the entire load interaction is disabled in site config
  if (ixConfig === false) {
    // Disable the FOUC CSS rule so content stays visible without the load animation
    document.body.setAttribute('data-ix-load-page-run', 'false');
    return;
  }
  // Exit if page-transition has disabled the load interaction for this page load
  if (document.body.getAttribute('data-ix-load-page-run')?.toLowerCase() === 'false') return;

  // ── Main loop ─────────────────────────────────────────────────────────────
  // Each wrap element creates its own timeline. Multiple wraps are staggered
  // sequentially using totalDuration so later sections don't overlap with earlier ones.
  // If page-transition is active, totalDuration starts at the synced load delay.
  let totalDuration = window.__ixPageTransitionLoadDelay || 0;
  const wraps = gsap.utils.toArray(`[${ATTRIBUTE}="${WRAP}"]`);
  wraps.forEach((wrap) => {
    // Collect all load elements inside this wrap.
    // :not(...-run="false" i) excludes disabled elements; `i` is case-insensitive
    // (handles both "false" and "False").
    const items = [...wrap.querySelectorAll(`[${ATTRIBUTE}]:not([${ATTRIBUTE}-run="false" i])`)];
    if (items.length === 0) return;

    // Allow individual wraps to opt out via data-ix-load-run="false"
    const runProp = checkRunProp(wrap, ANIMATION_ID);
    const wrapRunAttribute = wrap.getAttribute('data-ix-load-run')?.toLowerCase();
    if (runProp === false && wrapRunAttribute === 'false') return;

    // Build this wrap's timeline. It starts paused and is played after
    // all items are added (see tl.play() below).
    const tl = gsap.timeline({
      paused: true,
      defaults: {
        ease: ixConfig.ease ?? 'power1.out',
        duration: ixConfig.duration ?? 0.8,
      },
    });
    // Make the wrap itself visible immediately when the timeline starts
    tl.set(wrap, { autoAlpha: 1 });

    const animation = function (match) {
      if (match) return;
      items.forEach((item) => {
        if (!item) return;

        const attrValue = item.getAttribute(ATTRIBUTE);
        // Skip the wrap element itself
        if (attrValue === WRAP) return;

        // ── Reduced motion fallback ────────────────────────────────────────
        // If the user prefers reduced motion, replace every animation with a
        // simple fade-in so the page still reveals without motion effects.
        if (reduceMotion) {
          // Disable the FOUC CSS rule so the element stays visible after GSAP completes
          item.setAttribute(`${ATTRIBUTE}-run`, 'false');
          tl.fromTo(item, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, '<');
          return;
        }

        // Resolve animation type:
        // Direct type name (e.g. data-ix-load="clip-bottom") → use directly.
        // Element-type keyword (e.g. data-ix-load="heading") → look up config.
        const animationType = isAnimationType(attrValue) ? attrValue : ixConfig[attrValue];

        // Skip if type is unknown or explicitly disabled (false) in config
        if (!animationType) return;

        // Read per-element timeline position, defaulting to DEFAULT_STAGGER
        const position = attr(DEFAULT_STAGGER, item.getAttribute(POSITION));

        // Disable the FOUC CSS rule for this element. The CSS hides [data-ix-load]
        // elements (and children of stagger containers) until animated.
        item.setAttribute(`${ATTRIBUTE}-run`, 'false');

        // ── stagger ───────────────────────────────────────────────────────
        // Reveal each child of the stagger container sequentially.
        // The container itself is made visible first, then each child is
        // added to the shared timeline with its own position offset.
        if (attrValue === STAGGER) {
          gsap.set(item, { autoAlpha: 1 });
          const children = getNonContentsChildren(item);
          if (children.length === 0) return;
          children.forEach((child, index) => {
            // Ensure the container is visible before the first child animates
            if (index === 0) gsap.set(item, { autoAlpha: 1 });
            createAnimation(tl, child, animationType, { ...ixConfig, position });
          });
          return;
        }

        // ── all other types ────────────────────────────────────────────────
        // Single element added to the shared load timeline at the resolved position
        createAnimation(tl, item, animationType, { ...ixConfig, position });
      });

      // Stack subsequent wrap sections so they play after the previous one ends.
      // Subtracting 0.4 creates a slight overlap for a more natural feel.
      const wrapOffset = totalDuration;
      totalDuration = totalDuration + tl.duration() - 0.4;

      // Store delayed call reference so page-loader can correct timing in asset mode
      const playFn = function () { tl.play(); };
      const dc = gsap.delayedCall(wrapOffset, playFn);
      (window.__ixLoadDelays = window.__ixLoadDelays || []).push({ dc, fn: playFn, offset: wrapOffset });
    };

    // Check container breakpoint and run animation callback
    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(items[0], breakpoint, animation);
  });
};
