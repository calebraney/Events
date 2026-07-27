import {
  attr,
  stopScroll,
  startScroll,
  checkContainer,
  getIxConfig,
  checkRunProp,
  getAttrConfig,
} from '../utilities';
import { createAnimation } from './animations';

/*
Required CSS — add to page <head>:
<style>
.transition_wrap {
  display: flex;
  position: fixed;
  inset: 0;
  z-index: 9999;
}
body:has([data-ix-pagetransition="wrap"]:not([style*="display: none"])) {
  overflow: hidden;
}
</style>
*/

export const pageTransition = function (lenis) {
  const ANIMATION_ID = 'pagetransition';
  const ATTRIBUTE = 'data-ix-pagetransition';
  const WRAP_SEL = `[${ATTRIBUTE}="wrap"]`;
  const BG_SEL = `[${ATTRIBUTE}="background"]`;
  const ITEM_SEL = `[${ATTRIBUTE}="item"]`;

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = [...document.querySelectorAll(WRAP_SEL)];
  if (wraps.length === 0) return;

  // Storage helper — returns true if the loader/transition should be skipped
  const STORAGE_KEY = 'ix-pagetransition-seen';
  const checkStorage = function (storageValue) {
    if (storageValue === 'none') return false;
    if (storageValue === 'session') {
      if (sessionStorage.getItem(STORAGE_KEY)) return true;
      sessionStorage.setItem(STORAGE_KEY, '1');
      return false;
    }
    const dayMatch = storageValue.match(/^(\d+)d$/i);
    if (dayMatch) {
      const days = parseInt(dayMatch[1], 10);
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && Date.now() < parseInt(stored, 10) + days * 86400000) return true;
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch (_) {
        return false;
      }
      return false;
    }
    return false;
  };

  // checkLink — returns true if a link should trigger the transition
  const checkLink = function (link) {
    if (!link || link.tagName !== 'A') return false;
    const hostname = link.hostname;
    const target = link.target;
    const href = link.getAttribute('href');
    const playTransition = attr(true, link.getAttribute(ATTRIBUTE));
    if (
      !hostname ||
      hostname !== window.location.hostname ||
      (target && target === '_blank') ||
      !href ||
      href.includes('#') ||
      !playTransition
    ) {
      return false;
    }
    return true;
  };

  // buildTimeline — builds a forward-playing animation timeline.
  // isOut=false: bg first → items (hidden→visible). isOut=true: items first → bg last (visible→hidden).
  const buildTimeline = function (wrap, config, isOut) {
    const tl = gsap.timeline({
      paused: true,
      defaults: { duration: config.duration, ease: config.ease },
    });

    const bg = wrap.querySelector(BG_SEL);

    const addBg = function () {
      const bgConfig = getAttrConfig(bg, ANIMATION_ID, {
        animateIn: 'move-up',
        animateOut: 'move-up-out',
        duration: config.duration,
        ease: config.ease,
        easeIn: config.easeIn,
        easeOut: config.easeOut,
        positionIn: '0',
        positionOut: '>-0.3',
      });
      bgConfig.easeIn = bgConfig.easeIn || bgConfig.ease;
      bgConfig.easeOut = bgConfig.easeOut || bgConfig.ease;
      createAnimation(tl, bg, isOut ? bgConfig.animateOut : bgConfig.animateIn, {
        duration: bgConfig.duration,
        ease: isOut ? bgConfig.easeOut : bgConfig.easeIn,
        position: isOut ? bgConfig.positionOut : bgConfig.positionIn,
      });
    };

    const items = [...wrap.querySelectorAll(ITEM_SEL)];
    const addItems = function () {
      items.forEach(function (item, index) {
        const itemConfig = getAttrConfig(item, ANIMATION_ID, {
          animateIn: 'slide-up',
          animateOut: 'slide-up-out',
          duration: config.duration,
          ease: config.ease,
          easeIn: config.easeIn,
          easeOut: config.easeOut,
          positionIn: index === 0 ? '<0.6' : '<0.1',
          positionOut: index === 0 ? '0' : '<0.1',
          stagger: 0,
        });
        itemConfig.easeIn = itemConfig.easeIn || itemConfig.ease;
        itemConfig.easeOut = itemConfig.easeOut || itemConfig.ease;
        const target = itemConfig.stagger > 0 ? [...item.children] : item;
        createAnimation(tl, target, isOut ? itemConfig.animateOut : itemConfig.animateIn, {
          duration: itemConfig.duration,
          ease: isOut ? itemConfig.easeOut : itemConfig.easeIn,
          position: isOut ? itemConfig.positionOut : itemConfig.positionIn,
          stagger: itemConfig.stagger,
        });
      });
    };

    if (isOut) {
      // OUT: items first (DOM order), bg last
      addItems();
      if (bg) addBg();
    } else {
      // IN: bg first, items after
      if (bg) addBg();
      addItems();
    }

    return tl;
  };

  wraps.forEach(function (wrap, wrapIndex) {
    const runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    const config = getAttrConfig(wrap, ANIMATION_ID, {
      mode: 'transition', // 'transition' (overlay on link click) or 'loader' (plays once on load)
      storage: 'none', // skip loader after first visit: 'session', '1d', '7d', etc. 'none' = always show
      duration: 0.8, // animation duration in seconds for all elements
      ease: 'bounce', // GSAP ease (fallback for ease-in/ease-out)
      easeIn: 'power3.out', // ease for the IN animation — defaults to ease
      easeOut: 'power3.in', // ease for the OUT animation — defaults to ease
      delay: 0.8, // seconds before out animation starts (loader) or half applied each side (transition)
      disableLoad: false, // true = skip load interaction entirely while transition plays
      loadOffset: 0.6, // seconds before transition ends that the load interaction starts
    });
    config.easeIn = config.easeIn || config.ease;
    config.easeOut = config.easeOut || config.ease;

    const wrapDisplay = 'flex';

    let isAnimating = false;
    let isDisabled = false;

    const hideWrap = function () {
      gsap.set(wrap, { display: 'none' });
    };

    const playOut = function (outDelay) {
      stopScroll(lenis);
      const tl = buildTimeline(wrap, config, true);
      const outDuration = tl.totalDuration();
      if (!config.disableLoad) {
        window.__ixPageTransitionLoadDelay = Math.max(
          0,
          outDelay + outDuration - config.loadOffset
        );
      }
      gsap.delayedCall(outDelay, function () {
        tl.play();
      });
      gsap.delayedCall(outDelay + outDuration, function () {
        hideWrap();
        startScroll(lenis);
      });
    };

    if (config.mode === 'loader') {
      if (checkStorage(config.storage)) {
        hideWrap();
        return;
      }
      if (config.disableLoad) document.body.setAttribute('data-ix-load-page-run', 'false');
      playOut(config.delay);
    } else {
      // transition mode: half delay on the new page before animating out
      if (config.disableLoad) document.body.setAttribute('data-ix-load-page-run', 'false');
      playOut(config.delay / 2);

      // Only the first wrap handles link clicks to avoid duplicate listeners
      if (wrapIndex === 0) {
        document.querySelectorAll('a').forEach(function (link) {
          if (!checkLink(link)) return;
          const linkURL = link.getAttribute('href');
          link.addEventListener('click', function (e) {
            if (isAnimating || isDisabled) return;
            isAnimating = true;
            e.preventDefault();
            gsap.set(wrap, { display: wrapDisplay });
            const tl = buildTimeline(wrap, config, false);
            // half delay after IN animation completes, before navigating
            tl.eventCallback('onComplete', function () {
              gsap.delayedCall(config.delay / 2, function () {
                window.location.href = linkURL;
              });
            });
            stopScroll(lenis);
            tl.play();
          });
        });
      }
    }

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(wrap, breakpoint, function (match) {
      isDisabled = match;
    });
  });

  // Prevents back button bug on safari
  window.onpageshow = function (event) {
    if (event.persisted) window.location.reload();
  };
};
