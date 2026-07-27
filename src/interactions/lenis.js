//Setup
import Lenis from 'lenis';
import { getIxConfig } from '../utilities';

export const initLenis = function () {
  const ANIMATION_ID = 'lenis';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const lenis = new Lenis({
    duration: 0.5,
    wheelMultiplier: 0.75,
    gestureOrientation: 'vertical',
    normalizeWheel: false,
    smoothTouch: false,
    easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)), // https://easings.net
  });
  // Keep lenis and scrolltrigger in sync using a single gsap ticker source
  lenis.on('scroll', () => {
    if (!ScrollTrigger) return;
    ScrollTrigger.update();
  });
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  ////////////////////////////
  //Control Scrolling

  // re-calculate scroll length when clicked
  //utility function to refresh lenis after a delay of the click event
  let resizeTimeout;
  // Adjust delay as needed
  function refreshLenisTimeout(delay = 600) {
    clearTimeout(resizeTimeout); // Cancel previous resize calls
    resizeTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        lenis.resize();
      });
    }, delay);
  }

  function refreshScroll() {
    const triggers = [...document.querySelectorAll('[data-scroll="refresh"]')];
    if (triggers.length === 0) return;
    triggers.forEach((item) => {
      if (!item) return;
      item.addEventListener('click', (event) => {
        refreshLenisTimeout();
      });
    });
  }
  refreshScroll();

  function refreshScrollOnLazyLoad() {
    const images = [...document.querySelectorAll("img[loading='lazy']")];
    if (images.length === 0) return;
    images.forEach((img) => {
      img.addEventListener('load', refreshLenisTimeout);
    });
  }
  // refreshScrollOnLazyLoad();

  // anchor links
  //   function anchorLinks() {
  //     const anchorLinks = document.querySelectorAll('[scroll-to]');
  //     if (anchorLinks == null) {
  //       return;
  //     }
  //     anchorLinks.forEach((item) => {
  //       const targetID = item.getAttribute('scroll-to');
  //       const target = document.getElementById(targetID);
  //       if (!target) return;
  //       item.addEventListener('click', (event) => {
  //         lenis.scrollTo(target, {
  //           duration: 1.85,
  //           easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  //         });
  //       });
  //     });
  //   }
  //   anchorLinks();

  // stop page scrolling
  function stopScroll() {
    const stopScrollLinks = document.querySelectorAll('[data-scroll="stop"]');
    if (stopScrollLinks == null) {
      return;
    }
    stopScrollLinks.forEach((item) => {
      item.addEventListener('click', (event) => {
        lenis.stop();
      });
    });
  }
  stopScroll();

  // start page scrolling
  function startScroll() {
    const startScrollLinks = document.querySelectorAll('[data-scroll="start"]');
    if (startScrollLinks == null) {
      return;
    }
    startScrollLinks.forEach((item) => {
      item.addEventListener('click', (event) => {
        lenis.start();
      });
    });
  }
  startScroll();

  // toggle page scrolling
  function toggleScroll() {
    const toggleScrollLinks = document.querySelectorAll('[data-scroll="toggle"]');
    if (toggleScrollLinks == null) {
      return;
    }
    toggleScrollLinks.forEach((item) => {
      let stopScroll = false;
      item.addEventListener('click', (event) => {
        stopScroll = !stopScroll;
        if (stopScroll) lenis.stop();
        else lenis.start();
      });
    });
  }
  toggleScroll();
  //retun lenis so it can be accessed elsewhere
  return lenis;
};
