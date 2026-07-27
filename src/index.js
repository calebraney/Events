import {
  attr,
  copyURL,
  scrollReset,
  updaterFooterYear,
  checkRunProp,
  checkContainer,
} from './utilities';
import { banner } from './interactions/banner';
import { activate } from './interactions/activate';
import { countUp } from './interactions/count-up';
import { cursor } from './interactions/cursor';
import { initLenis } from './interactions/lenis';
import { imageSwitch } from './interactions/image-switch';
import { logoSwitch } from './interactions/logo-switch';
import { lightbox } from './interactions/lightbox';
import { load } from './interactions/load';
import { loop } from './interactions/loop';
import { magnetic } from './interactions/magnetic';
import { marquee } from './interactions/marquee';
import { mouseOver } from './interactions/mouse-over';
import { modal } from './interactions/modal';
import { pageLoader } from './interactions/page-loader';
import { pageTransition } from './interactions/page-transition';
import { parallax } from './interactions/parallax';
import { pathHover } from './interactions/path-hover';
import { playSound } from './interactions/play-sound';
import { scrollIn } from './interactions/scroll-in';
import { scrolling } from './interactions/scrolling';
import { scrollProgress } from './interactions/scroll-progress';
import { scrollActivate } from './interactions/scroll-activate';
import { stickyNav } from './interactions/sticky-nav';
import { tabs } from './interactions/tabs';
import { slider } from './interactions/slider';
import { triggerEvent } from './interactions/trigger-event';
import { numberInput } from './interactions/number-input';
import { textScrub } from './interactions/text-scrub';
import { textLinks } from './interactions/text-links';
import { flipText } from './interactions/flip-text';
import { typeText } from './interactions/type-text';
import { videoPlyr } from './interactions/video-plyr';

document.addEventListener('DOMContentLoaded', function () {
  // Comment out for production
  // console.log('Local Script Loaded');

  //////////////////////////////
  //Global Variables
  let lenis;

  //////////////////////////////
  //Control Functions on page load
  const gsapInit = function () {
    //first interactions
    lenis = initLenis();
    pageTransition(lenis);
    pageLoader(lenis);
    //match media interactions
    let mm = gsap.matchMedia();
    mm.add(
      {
        screen: '(width > 0px)', //required for the callback to run regardless.
        reduceMotion: '(prefers-reduced-motion: reduce)',
        highContrast: '(prefers-contrast: more)',
        noHover: '(hover: none)',
      },
      (gsapContext) => {
        let { reduceMotion, highContrast, noHover } = gsapContext.conditions;
        //functional interactions with conditional properties.
        load(reduceMotion);
        //conditional interactions (if reduce motion is off)
        if (!reduceMotion) {
          countUp();
          loop();
          textScrub();
          mouseOver();
          parallax();
          scrollIn();
          scrolling();
          pathHover();
          scrollProgress();
          scrollActivate();
          magnetic();
          imageSwitch();
          banner();
          logoSwitch();
          flipText();
          typeText();
        }
        //setup video players
        const [players, components] = [videoPlyr()];
        //pass the players into the lightbox code
        lightbox(players, components);
        modal(lenis);
      }
    );
    //other interactions
    marquee();
    textLinks();
    slider();
    tabs();
    activate();
    playSound();
    stickyNav();
    triggerEvent();
    numberInput();
  };
  gsapInit();

  //utilities
  copyURL();
  scrollReset();
  updaterFooterYear();
});
