import {
  attr,
  checkRunProp,
  checkContainer,
  getNonContentsChildren,
  getAttrConfig,
  getIxConfig,
} from '../utilities';
import { createAnimation, isAnimationType } from './animations';

export const scrollIn = function () {
  // Animation ID used for data attribute construction and run checks
  const ANIMATION_ID = 'scrollin';
  // Base attribute — also used as the element-type selector
  const ATTRIBUTE = 'data-ix-scrollin';
  const ELEMENT = 'data-ix-scrollin';

  // Element-type keyword constants (values for the data-ix-scrollin attribute)
  const WRAP = 'wrap';
  const HEADING = 'heading';
  const PARAGRAPH = 'paragraph';
  const ITEM = 'item';
  const CONTAINER = 'container';
  const STAGGER = 'stagger';
  const RICH_TEXT = 'rich-text';
  const IMAGE = 'image';
  const LINE = 'line';

  // ScrollTrigger option attributes
  const SCROLL_STAGGER = 'data-ix-scrollin-stagger';

  // Default stagger for stagger-type elements (can be overridden via attribute)
  const DEFAULT_STAGGER_AMOUNT = 0.1;

  // ── Config resolution ─────────────────────────────────────────────────────
  // Maps element-type keywords to animation types.
  // Override any of these per-site via window.ixConfig.scrollin in <head>:
  //   window.ixConfig = { scrollin: { heading: 'fade-lines', line: false } }
  const ELEMENT_TYPE_DEFAULTS = {
    [HEADING]: 'slide-up-words',
    [PARAGRAPH]: 'slide-up',
    [ITEM]: 'slide-up',
    [CONTAINER]: 'slide-up',
    [STAGGER]: 'slide-up',
    [RICH_TEXT]: 'slide-up',
    [IMAGE]: 'image-zoom',
    [LINE]: 'clip-left',
  };
  const ixConfig = getIxConfig(ANIMATION_ID, ELEMENT_TYPE_DEFAULTS);
  // Exit if the entire scrollin interaction is disabled in site config
  if (ixConfig === false) return;

  // ── ScrollTrigger timeline factory ────────────────────────────────────────
  // Creates a per-element GSAP timeline with a ScrollTrigger attached.
  // Options can be customised per-element via data attributes.
  // duration/ease pull from ixConfig so window.ixConfig.scrollin overrides apply.
  const scrollInTL = function (item) {
    const settings = getAttrConfig(item, ANIMATION_ID, {
      toggleActions: ixConfig.toggleActions ?? 'play none none none',
      scrub: ixConfig.scrub ?? false,
      start: ixConfig.start ?? 'top 90%',
      end: ixConfig.end ?? 'top 75%',
    });
    return gsap.timeline({
      defaults: {
        duration: ixConfig.duration ?? 0.6,
        ease: ixConfig.ease ?? 'power1.out',
      },
      scrollTrigger: {
        trigger: item,
        start: settings.start,
        end: settings.end,
        toggleActions: settings.toggleActions,
        scrub: settings.scrub,
      },
    });
  };

  // ── Main loop ─────────────────────────────────────────────────────────────
  // Find all wrap elements; each one is an independent scroll-in section
  const wraps = [...document.querySelectorAll(`[${ATTRIBUTE}="${WRAP}"]`)];
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    // Allow individual wraps to opt out via data-ix-scrollin-run="false"
    const runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    // Collect all scroll-in elements inside this wrap.
    // The :not(...-run="false" i) selector excludes elements disabled at the
    // element level; the `i` flag makes the match case-insensitive
    // (handles both "false" and "False").
    const items = [...wrap.querySelectorAll(`[${ATTRIBUTE}]:not([${ATTRIBUTE}-run="false" i])`)];
    if (items.length === 0) return;

    const animation = function (match) {
      if (match) return;
      items.forEach((item) => {
        if (!item) return;

        const attrValue = item.getAttribute(ELEMENT);
        // Skip the wrap element itself if it appears in the query
        if (attrValue === WRAP) return;

        // Resolve animation type:
        // If the attribute value is itself a registered animation type name
        // (e.g. data-ix-scrollin="clip-bottom"), use it directly.
        // Otherwise treat it as an element-type keyword and look up the config.
        const animationType = isAnimationType(attrValue) ? attrValue : ixConfig[attrValue];

        // Skip if the type is unknown or explicitly disabled (false) in config
        if (!animationType) return;

        // ── container ─────────────────────────────────────────────────────
        // Each direct child gets its own independent ScrollTrigger timeline
        if (attrValue === CONTAINER) {
          gsap.utils.toArray(item.children).forEach((child) => {
            createAnimation(scrollInTL(child), child, animationType, ixConfig);
          });
          return;
        }

        // ── stagger ───────────────────────────────────────────────────────
        // All children animate together on a single ScrollTrigger, staggered.
        // Uses getNonContentsChildren to skip display:contents wrappers.
        // Custom stagger amount can be set via data-ix-scrollin-stagger.
        if (attrValue === STAGGER) {
          const staggerAmount = attr(DEFAULT_STAGGER_AMOUNT, item.getAttribute(SCROLL_STAGGER));
          const children = getNonContentsChildren(item);
          if (children.length === 0) return;
          createAnimation(scrollInTL(item), children, animationType, { ...ixConfig, stagger: staggerAmount });
          return;
        }

        // ── rich-text ─────────────────────────────────────────────────────
        // Dispatches a separate animation per child element of the rich-text
        // block. Headings get the heading animation, figures get image, and
        // everything else gets the item animation. Each child has its own
        // ScrollTrigger so they can trigger independently as the user scrolls.
        // Note: the child elements themselves are animated — no SplitText is
        // applied here (use data-ix-scrollin="heading" on a heading directly
        // if you want split-text behaviour).
        if (attrValue === RICH_TEXT) {
          gsap.utils.toArray(item.children).forEach((child) => {
            const tag = child.tagName;
            const childType = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)
              ? ixConfig[HEADING]
              : tag === 'FIGURE'
              ? ixConfig[IMAGE]
              : ixConfig[ITEM];
            if (!childType) return;
            createAnimation(scrollInTL(child), child, childType, ixConfig);
          });
          return;
        }

        // ── all other types ────────────────────────────────────────────────
        // Single element with its own ScrollTrigger
        createAnimation(scrollInTL(item), item, animationType, ixConfig);
      });
    };

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(items[0], breakpoint, animation);
  });
};
