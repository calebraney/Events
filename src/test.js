pageFunctions.addFunction('imageSwitch', function () {
  // your code
  const imageSwitch = function () {
    const WRAP = '[data-ix-imageswitch="wrap"]';
    const IMAGE = '[data-ix-imageswitch="image"]';

    //elements
    const wraps = [...document.querySelectorAll(WRAP)];

    wraps.forEach((wrap) => {
      const image = wrap.querySelector(IMAGE);

      //guard clause
      if (!image) return;

      let tl = gsap.timeline({
        defaults: {
          duration: 0.8,
          ease: 'power2.out',
          delay: 1,
        },
      });
      tl.fromTo(
        image,
        {
          opacity: 0,
        },
        {
          opacity: 1,
        }
      );
    });
  };
});
