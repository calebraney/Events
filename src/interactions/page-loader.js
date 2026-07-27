import {
  attr,
  getAttrConfig,
  checkRunProp,
  getIxConfig,
  checkContainer,
  stopScroll,
  startScroll,
} from '../utilities';
import { createAnimation } from './animations';

/*
Required CSS — add to page <head>:
<style>
[data-ix-pageloader="wrap"] {
  display: flex;
  position: fixed;
  inset: 0;
  z-index: 2000;
}
body:has([data-ix-pageloader="wrap"]:not([style*="display: none"])) {
  overflow: hidden;
}
html.ix-pl-skip [data-ix-pageloader="wrap"] { display: none; }
scale-x progress elements: transform-origin: left center
scale-y progress elements: transform-origin: center bottom
</style>

Head script — prevents flash when loader is hidden by storage. Add before </head>:
<script>
(function(){
  var k='ix-pageloader-seen';
  if(sessionStorage.getItem(k)||localStorage.getItem(k))
    document.documentElement.classList.add('ix-pl-skip');
})();
</script>
*/

/*
Element attributes:

[data-ix-pageloader="wrap"]          — required. 
Gets a progress variable that animates 0→1 during the loading phase, then plays an exit animation before revealing the page.
[data-ix-pageloader="background"]    — optional. 
[data-ix-pageloader="item"]          — optional, repeatable. UI elements that exit before the background.
  data-ix-pageloader-animate-out     — exit animation type (default: 'slide-up-out')
  data-ix-pageloader-position-out    — GSAP timeline position (default: '0' first item, '<0.2' subsequent)
  data-ix-pageloader-duration        — overrides wrap out-duration for this element
  data-ix-pageloader-ease            — overrides wrap out-ease for this element
  data-ix-pageloader-stagger         — stagger delay between children if > 0 (default: 0)

[data-ix-pageloader="wrap"] also receives a --progress CSS variable (0→1) during the loading phase,
                             usable in CSS as var(--progress) for custom driven styles.

[data-ix-pageloader-loading="progress"] — optional, repeatable. Animates 0→100% during the loading phase.
  data-ix-pageloader-type              — 'scale-x' (default), 'scale-y', 'clip-right', 'clip-left',
                                         'clip-top', 'clip-bottom'

[data-ix-pageloader-loading="counter"]  — optional, repeatable. Text element counting up during loading phase.
  data-ix-pageloader-end               — target number (default: 100)
*/

export const pageLoader = function (lenis) {
  const ANIMATION_ID = 'pageloader';
  const ATTRIBUTE = 'data-ix-pageloader';
  const WRAP_SEL = `[${ATTRIBUTE}="wrap"]`;
  const BG_SEL = `[${ATTRIBUTE}="background"]`;
  const ITEM_SEL = `[${ATTRIBUTE}="item"]`;
  const LOADING_ATTR = `${ATTRIBUTE}-loading`;
  const PROGRESS_SEL = `[${LOADING_ATTR}="progress"]`;
  const COUNTER_SEL = `[${LOADING_ATTR}="counter"]`;

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = [...document.querySelectorAll(WRAP_SEL)];
  if (wraps.length === 0) return;

  const STORAGE_KEY = 'ix-pageloader-seen';
  const checkStorage = function (storageValue) {
    if (!storageValue || storageValue === 'none') return false;
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

  // buildLoadTimeline — animates progress bars and counters during the loading phase
  const buildLoadTimeline = function (wrap, duration, ease, startPercent) {
    const tl = gsap.timeline({ paused: true });

    // Animate --progress (0→1) on the wrap so CSS can use it for custom driven styles
    tl.fromTo(wrap, { '--progress': startPercent / 100 }, { '--progress': 1, duration, ease }, 0);

    const progressEls = [...wrap.querySelectorAll(PROGRESS_SEL)];
    progressEls.forEach(function (el) {
      const elConfig = getAttrConfig(el, ANIMATION_ID, { type: 'scale-x' });
      const type = elConfig.type;
      const pct = 100 - startPercent;

      if (type === 'scale-x') {
        tl.fromTo(el, { scaleX: startPercent / 100 }, { scaleX: 1, duration, ease }, 0);
      } else if (type === 'scale-y') {
        tl.fromTo(el, { scaleY: startPercent / 100 }, { scaleY: 1, duration, ease }, 0);
      } else {
        const clipFrom =
          {
            'clip-right': `inset(0% ${pct}% 0% 0%)`,
            'clip-left': `inset(0% 0% 0% ${pct}%)`,
            'clip-top': `inset(${pct}% 0% 0% 0%)`,
            'clip-bottom': `inset(0% 0% ${pct}% 0%)`,
          }[type] || `inset(0% ${pct}% 0% 0%)`;
        tl.fromTo(
          el,
          { clipPath: clipFrom },
          { clipPath: 'inset(0% 0% 0% 0%)', duration, ease },
          0
        );
      }
    });

    const counterEls = [...wrap.querySelectorAll(COUNTER_SEL)];
    counterEls.forEach(function (el) {
      const elConfig = getAttrConfig(el, ANIMATION_ID, { end: 100 });
      const proxy = { value: startPercent };
      el.textContent = Math.round(startPercent);
      tl.to(
        proxy,
        {
          value: elConfig.end,
          duration,
          ease,
          onUpdate: function () {
            el.textContent = Math.round(proxy.value);
          },
        },
        0
      );
    });

    // Ensure the timeline always holds for the full duration even with no progress elements
    if (tl.totalDuration() === 0) tl.to({}, { duration });

    return tl;
  };

  // buildExitTimeline — animates items then background out (visible → hidden, forward-playing)
  const buildExitTimeline = function (wrap, config) {
    const tl = gsap.timeline({
      paused: true,
      defaults: { duration: config.outDuration, ease: config.outEase },
    });

    const items = [...wrap.querySelectorAll(ITEM_SEL)];
    items.forEach(function (item, index) {
      const itemConfig = getAttrConfig(item, ANIMATION_ID, {
        animateOut: 'slide-up-out',
        duration: config.outDuration,
        ease: config.outEase,
        positionOut: index === 0 ? '0' : '<0.2',
        stagger: 0,
      });
      const target = itemConfig.stagger > 0 ? [...item.children] : item;
      createAnimation(tl, target, itemConfig.animateOut, {
        duration: itemConfig.duration,
        ease: itemConfig.ease,
        position: itemConfig.positionOut,
        stagger: itemConfig.stagger,
      });
    });

    const bg = wrap.querySelector(BG_SEL);
    if (bg) {
      const bgConfig = getAttrConfig(bg, ANIMATION_ID, {
        animateOut: 'move-up-out',
        duration: config.outDuration,
        ease: config.outEase,
        positionOut: '>-0.3',
      });
      createAnimation(tl, bg, bgConfig.animateOut, {
        duration: bgConfig.duration,
        ease: bgConfig.ease,
        position: bgConfig.positionOut,
      });
    }

    return tl;
  };

  wraps.forEach(function (wrap) {
    const runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    const config = getAttrConfig(wrap, ANIMATION_ID, {
      timing: 'asset', // 'fixed' = set duration; 'asset' = wait for window.onload
      duration: 3, // loading phase duration (fixed) or max duration (asset)
      ease: 'none', // ease for progress/counter animations
      minDuration: 1, // (asset mode) minimum seconds before exit can start
      outDuration: 0.8, // exit animation element duration
      outEase: 'power3.out', // exit animation ease
      delay: 0.2, // pause between loading phase end and exit start
      storage: 'none', // skip after first visit: 'session', '1d', '7d', etc. 'none' = always show
      fastMode: false, // true = use fastDuration on return visits instead of skipping
      fastDuration: 1.5, // loading duration for return visits (fastMode only)
      fastStart: 0, // counter/progress start value for return visits (0–100)
      disableLoad: false, // true = skip load interaction while preloader plays
      loadOffset: 0.6, // seconds before exit ends that the load interaction starts
    });

    const isReturnVisit = checkStorage(config.storage);

    const hideWrap = function () {
      gsap.set(wrap, { display: 'none' });
    };

    if (isReturnVisit && !config.fastMode) return;

    const loadDuration = isReturnVisit ? config.fastDuration : config.duration;
    const loadStart = isReturnVisit ? config.fastStart : 0;

    if (config.disableLoad) document.body.setAttribute('data-ix-load-page-run', 'false');
    if (!config.disableLoad) {
      const tempExitTl = buildExitTimeline(wrap, config);
      window.__ixPageTransitionLoadDelay = Math.max(
        0,
        loadDuration + config.delay + tempExitTl.totalDuration() - config.loadOffset
      );
    }

    stopScroll(lenis);

    const runExit = function () {
      const exitTl = buildExitTimeline(wrap, config);

      // Correct load.js timing — in asset mode the actual exit fires earlier than the
      // max duration used for the initial estimate, leaving a gap before load animations start.
      // Kill the originally-scheduled delayed calls and reschedule from now.
      if (!config.disableLoad && window.__ixLoadDelays && window.__ixLoadDelays.length) {
        const correctDelay = Math.max(0, config.delay + exitTl.totalDuration() - config.loadOffset);
        const pending = window.__ixLoadDelays;
        window.__ixLoadDelays = null;
        const minOffset = pending.reduce(function (min, d) { return Math.min(min, d.offset); }, Infinity);
        pending.forEach(function (item) {
          item.dc.kill();
          gsap.delayedCall(correctDelay + (item.offset - minOffset), item.fn);
        });
      }

      gsap.delayedCall(config.delay, function () {
        exitTl.play();
        gsap.delayedCall(exitTl.totalDuration(), function () {
          hideWrap();
          startScroll(lenis);
        });
      });
    };

    const loadTl = buildLoadTimeline(wrap, loadDuration, config.ease, loadStart);

    if (config.timing === 'asset') {
      let exitTriggered = false;
      const triggerExit = function () {
        if (exitTriggered) return;
        exitTriggered = true;
        runExit();
      };
      let isLoaded = false;
      let isMinDone = false;
      const tryFastForward = function () {
        if (!isLoaded || !isMinDone) return;
        if (loadTl.progress() < 1) {
          gsap.to(loadTl, {
            progress: 1,
            duration: 0.5,
            ease: 'power2.out',
            onComplete: triggerExit,
          });
        } else {
          triggerExit();
        }
      };
      window.addEventListener(
        'load',
        function () {
          isLoaded = true;
          tryFastForward();
        },
        { once: true }
      );
      gsap.delayedCall(config.minDuration, function () {
        isMinDone = true;
        tryFastForward();
      });
      loadTl.eventCallback('onComplete', triggerExit); // hard fallback at maxDuration
    } else {
      loadTl.eventCallback('onComplete', runExit);
    }

    loadTl.play();

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(wrap, breakpoint, function (match) {
      if (match) {
        hideWrap();
        startScroll(lenis);
      }
    });
  });

  window.onpageshow = function (event) {
    if (event.persisted) window.location.reload();
  };
};
