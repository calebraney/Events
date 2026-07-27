import { attr, checkRunProp, checkContainer, getIxConfig } from '../utilities';

/*
CSS
<style>
.line {
  position: relative;
}
.line-mask {
  position: absolute;
  top: 0;
  right: 0;
  background-color: var(--theme--background-1, #000);
  opacity: 0.65;
  height: 100%;
  width: 100%;
  z-index: 2;
}
</style>
*/

export const textScrub = function (gsapContext) {
  //animation ID
  const ANIMATION_ID = 'textscrub';
  //elements
  const ITEM = '[data-ix-textscrub="item"]';
  //options
  const LINE_CLASS = 'line-mask';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //element selector
  const items = gsap.utils.toArray(ITEM);
  items.forEach((item) => {
    if (!item) return;
    //check if the run prop is set to true
    let runProp = checkRunProp(item, ANIMATION_ID);
    if (runProp === false) return;
    let splitText;
    const lineMasks = [];

    const animateLines = function (self) {
      //if line masks exist delete them.
      if (lineMasks.length !== 0) {
        lineMasks.forEach((line) => {
          line.remove();
        });
      }
      //for each line of text
      self.lines.forEach((line) => {
        // create a new div element
        const lineMask = document.createElement('div');
        lineMasks.push(lineMask);
        //give it a class
        lineMask.classList.add(LINE_CLASS);
        // add the new div to a parent
        line.appendChild(lineMask);

        let tl = gsap.timeline({
          scrollTrigger: {
            trigger: line,
            start: 'top 70%',
            end: 'bottom 70%',
            scrub: 1.5,
          },
        });
        tl.fromTo(
          lineMask,
          {
            width: '100%',
          },
          {
            width: '0%',
            ease: 'power1.out',
            duration: 1,
          }
        );
      });
    };

    //animation functoin
    function createAnimation() {
      //split the text
      const splitText = SplitText.create(item, {
        type: 'lines',
        linesClass: 'line',
        autoSplit: true,
        onSplit: (self) => {
          return animateLines(self);
        },
      });
      if (!splitText) return;

      return splitText;
    }
    const animation = function (match) {
      if (match) return;
      splitText = createAnimation();
    };

    const breakpoint = attr('none', item.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(item, breakpoint, animation);
  });
};
