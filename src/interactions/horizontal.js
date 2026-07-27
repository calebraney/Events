import { attr, checkRunProp, checkContainer, getIxConfig } from '../utilities';
export const horizontal = function () {
  //animation ID
  const ANIMATION_ID = 'horizontal';
  //selectors
  const WRAP = '[data-ix-horizontal="wrap"]';
  const INNER = '[data-ix-horizontal="inner"]';
  const TRACK = '[data-ix-horizontal="track"]';

  //options
  const OPTION_MATCH_HEIGHT = 'data-ix-horizontal-start';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //elements
  const wraps = document.querySelectorAll(WRAP);
  wraps.forEach((wrap) => {
    //get elements
    let inner = wrap.querySelector(INNER);
    let track = wrap.querySelector(TRACK);
    if (!wrap || !inner || !track) return;
    const animation = function (match) {
      if (match) return;
      // function to set wrap height
      const setScrollDistance = function () {
        wrap.style.height = 'calc(' + track.offsetWidth + 'px + 100vh)';
      };
      //get option to see if height is matched
      let matchHeight = attr(true, wrap.getAttribute(OPTION_MATCH_HEIGHT));
      if (matchHeight) {
        setScrollDistance();
        ScrollTrigger.refresh();
        window.addEventListener('resize', setScrollDistance);
      }

      // create main horizontal scroll timeline
      let tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
        },
        defaults: { ease: 'none' },
      });
      tl.to(track, { xPercent: -100 });

      // get container left position
      function containerLeft() {
        return inner.offsetLeft + 'px';
      }
      // get container right position
      function containerRight() {
        return inner.offsetLeft + inner.offsetWidth + 'px';
      }

      //DEMO INNER TIMELINES
      //   let tl2 = gsap.timeline({
      //     scrollTrigger: {
      //       trigger: wrap.querySelector(".scroll_horizontal_hero_wrap"),
      //       containerAnimation: tl,
      //       // start when the left side of the element hits the left side of the container
      //       start: "left " + containerLeft(),
      //       end: "right " + containerLeft(),
      //       scrub: true,
      //       // markers: true,
      //     },
      //     defaults: { ease: "none" },
      //   });
      //   tl2.to(wrap.querySelector(".scroll_horizontal_hero_title"), { opacity: 0, filter: "blur(60px)" });

      //   //
      //   let tl3 = gsap.timeline({
      //     scrollTrigger: {
      //       trigger: wrap.querySelector(".scroll_horizontal_pin_wrap"),
      //       containerAnimation: tl,
      //       start: "left " + containerLeft(),
      //       end: "right " + containerRight(),
      //       scrub: true,
      //       // markers: true,
      //     },
      //     defaults: { ease: "none" },
      //   });
      //   tl3.to(wrap.querySelector(".scroll_horizontal_pin_element"), { xPercent: 100 });
      //   tl3.from(wrap.querySelector(".scroll_horizontal_img"), { scale: 0.5 }, "<");
    };
    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;
    //check container breakpoint and run callback.
    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(inner, breakpoint, animation);
  });
};
