import { attr, checkRunProp, checkContainer, getIxConfig } from '../utilities';

/*
CSS to include
can also use pointer to check for non fine pointers

// /* Cursor - Fade out when not hovering on body */
// body:hover .cursor_component {opacity:1;}
// body:has(.cursor_component) {cursor: none;}
// /*hide default cursor*/
// body:has(.cursor_component) :is(button, a, input) {cursor: none;}
// /*cursor hover styles*/
// .cursor_innner.is-hover .cursor_dot {width: 12px; height: 12px;}
// .cursor_outer.is-hover .cursor_circle {width: 24px; height: 24px;}
// /* Cursor - No pointer events */
// .cursor_component { pointer-events: none; }
//  /* Cursor - Hide on touch screens */
// @media (pointer: coarse) {
//   .cursor_component {display: none;}
// }
// @media (pointer: fine) {
//   .cursor_component {display: block;}
// }

export const cursor = function () {
  //animation ID
  const ANIMATION_ID = 'cursor';
  //elements
  const WRAP = '[data-ix-cursor="wrap"]';
  const INNER = '[data-ix-cursor="inner"]'; //inner cursor point that stays with the actual cursor
  const OUTER = '[data-ix-cursor="outer"]'; //outer cursor circle that has a delay
  const DOT = '[data-ix-cursor="dot"]'; // visual element within the inner cursor
  const HOVER = '[data-ix-cursor="hover"]';
  const NO_HOVER = '[data-ix-cursor="no-hover"]';
  //options
  const INNER_DELAY = 0.01; //cannot be 0
  const OUTER_DELAY = 0.4;
  //classes
  const HOVER_CLASS = 'is-hover';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  // select the items
  const wrap = document.querySelector(WRAP);
  const cursorInner = document.querySelector(INNER);
  const cursorOuter = document.querySelector(OUTER);
  // const cursorDot = document.querySelector(DOT);
  const disableCursor = function () {
    wrap.style.display = 'none';
  };

  // return if items are null
  if (!wrap || !cursorInner) return;
  //check if the device has a touch screen if it does hide the cursor and return function
  if ('ontouchstart' in window || navigator.maxTouchPoints) {
    disableCursor();
    return;
  }

  //check if the run prop is set to true
  let runProp = checkRunProp(wrap, ANIMATION_ID);
  if (runProp === false) return;

  const cursorHover = function () {
    // get all links without a no-hover attribute and any other elements with a hover attribute into an array
    const hoverElements = gsap.utils.toArray(`${HOVER}, :is(a, button):not(${NO_HOVER})`);
    hoverElements.forEach((item) => {
      if (!item || !cursorInner) return;
      item.addEventListener('mouseover', function (e) {
        cursorInner.classList.add(HOVER_CLASS);
        // cursorOuter.classList.add(HOVER_CLASS);

        //optional add on if you want text in the cursor
        // gsap.to('.cursor_text', {
        //   scrambleText: {
        //     text: text,
        //     chars: 'lowercase',
        //     speed: 2,
        //   },
        //   duration: 0.8,
        // });
      });
      item.addEventListener('mouseleave', function (e) {
        cursorInner.classList.remove(HOVER_CLASS);
        // cursorOuter.classList.remove(HOVER_CLASS);
      });
    });
  };
  cursorHover();
  const cursorClick = function () {
    // if (!cursorDot) return;
    // document.addEventListener('click', function (e) {
    //   let tl = gsap.timeline({});
    //   tl.fromTo(cursorDot, { rotateZ: -45 }, { rotateZ: 45, ease: 'power1.out', duration: 0.3 });
    // });
  };
  cursorClick();

  //handle cursor movement
  const cursorMove = function () {
    //center elements
    gsap.set(cursorInner, { xPercent: -50, yPercent: -50 });
    gsap.set(cursorOuter, { xPercent: -50, yPercent: -50 });
    //innner timelines
    let innerX = gsap.quickTo(cursorInner, 'x', { duration: INNER_DELAY, ease: 'non' });
    let innerY = gsap.quickTo(cursorInner, 'y', { duration: INNER_DELAY, ease: 'non' });
    //outer timelines
    let outerX = gsap.quickTo(cursorOuter, 'x', { duration: OUTER_DELAY, ease: 'power3' });
    let outerY = gsap.quickTo(cursorOuter, 'y', { duration: OUTER_DELAY, ease: 'power3' });
    //animate on mouse mouve
    window.addEventListener('mousemove', (e) => {
      if (isDisabled) return;
      innerX(e.clientX);
      innerY(e.clientY);
      outerX(e.clientX);
      outerY(e.clientY);
    });
  };
  let isDisabled = false;
  cursorMove();

  const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
  checkContainer(wrap, breakpoint, (match) => { isDisabled = match; });
};
