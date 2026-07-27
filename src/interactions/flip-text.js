import { attr, checkRunProp, checkContainer, getAttrConfig, getIxConfig } from '../utilities';

export const flipText = function () {
  const ANIMATION_ID = 'fliptext';
  const WRAP = '[data-ix-fliptext="wrap"]';
  const TEXT = '[data-ix-fliptext="text"]';
  const PHRASE_ITEM = '[data-ix-fliptext="phrase"]';
  const OPTION_PHRASES = 'data-ix-fliptext-phrases';
  const OPTION_DELIMITER = 'data-ix-fliptext-delimiter';
  const DEFAULT_DELIMITER = ';';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = document.querySelectorAll(WRAP);
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;
    const textEl = wrap.querySelector(TEXT);
    if (!textEl) return;

    const animation = function (match) {
      if (match) return;

      const config = getAttrConfig(wrap, ANIMATION_ID, {
        duration: 0.6,
        hold: 1.5,
        delay: 1,
        ease: 'power2.inOut',
        repeat: false,
        perspective: 600,
        rotate: 90,
        padding: 1.2, // in em
        transitionDelay: 0, // sentinel: -1 defaults to config.duration (sequential)
        direction: 'down', // 'up' or 'down'
        y: 1, // travel distance in em (0 = auto)
      });

      // build phrases — prefer the data attribute, fall back to child phrase elements
      let phrases = [];
      const phrasesAttr = wrap.getAttribute(OPTION_PHRASES);
      if (phrasesAttr) {
        const delimiter = attr(DEFAULT_DELIMITER, wrap.getAttribute(OPTION_DELIMITER));
        phrases = phrasesAttr
          .split(delimiter)
          .map((p) => p.trimStart())
          .filter((p) => p !== '');
      } else {
        wrap.querySelectorAll(PHRASE_ITEM).forEach((el) => {
          const text = el.textContent.trim();
          if (text) phrases.push(text);
        });
      }

      if (phrases.length <= 1) return;

      // Wrap textEl in a clipping stage so surrounding layout never shifts.
      // Height is fixed to the tallest phrase measured at the current container width.
      // Vertical padding prevents descenders from being clipped; negative margin
      // keeps the stage occupying the same layout space as without padding.
      const stage = document.createElement('div');
      stage.style.cssText =
        'overflow: clip; position: relative; display: block; box-sizing: content-box; width: 100%;';
      textEl.parentNode.insertBefore(stage, textEl);
      stage.appendChild(textEl);

      let maxHeight = 0;
      phrases.forEach((phrase) => {
        textEl.textContent = phrase;
        maxHeight = Math.max(maxHeight, textEl.getBoundingClientRect().height);
      });
      const pad = config.padding;
      stage.style.height = `${maxHeight}px`;
      stage.style.paddingTop = `${pad}em`;
      stage.style.paddingBottom = `${pad}em`;
      stage.style.marginTop = `-${pad}em`;
      stage.style.marginBottom = `-${pad}em`;
      // Read computed padding in px (em resolved by browser) so yDist is accurate
      const padPx = parseFloat(getComputedStyle(stage).paddingTop);
      const autoYDist = maxHeight + padPx;
      // If y option is set, convert em to px and use whichever is larger so text
      // always fully clears the clip regardless of phrase length
      const customYPx = config.y > 0 ? config.y * parseFloat(getComputedStyle(textEl).fontSize) : 0;
      const yDist = customYPx > 0 ? customYPx : autoYDist;
      // direction: 'up' exits upward (-), enters from below (+)
      //            'down' exits downward (+), enters from above (-)
      const dirMult = config.direction === 'down' ? 1 : -1;
      const transitionDelay = config.transitionDelay < 0 ? config.duration : config.transitionDelay;

      // Show first phrase at rest
      textEl.textContent = phrases[0];
      gsap.set(textEl, {
        y: 0,
        rotateX: 0,
        opacity: 1,
        transformPerspective: config.perspective,
        transformOrigin: 'center center',
      });

      let currentIndex = 0;

      const animateNext = function () {
        const nextIndex = (currentIndex + 1) % phrases.length;

        const onComplete = () => {
          currentIndex = nextIndex;
          const shouldContinue = config.repeat || nextIndex < phrases.length - 1;
          if (shouldContinue) {
            gsap.delayedCall(config.hold, animateNext);
          } else {
            stage.style.height = 'auto';
            stage.replaceWith(textEl);
            gsap.set(textEl, { clearProps: 'transform,opacity' });
          }
        };

        const nextEl = textEl.cloneNode(false);
        nextEl.textContent = phrases[nextIndex];
        nextEl.style.position = 'absolute';
        nextEl.style.top = `${padPx}px`;
        nextEl.style.left = '0';
        nextEl.style.right = '0';
        stage.appendChild(nextEl);
        gsap.set(nextEl, {
          y: -dirMult * yDist,
          rotateX: dirMult * config.rotate,
          opacity: 0,
          transformPerspective: config.perspective,
          transformOrigin: 'center center',
        });

        const tl = gsap.timeline({
          onComplete: () => {
            textEl.textContent = phrases[nextIndex];
            gsap.set(textEl, { y: 0, rotateX: 0, opacity: 1 });
            nextEl.remove();
            onComplete();
          },
        });

        tl.to(
          textEl,
          {
            y: dirMult * yDist,
            rotateX: -dirMult * config.rotate,
            opacity: 0,
            duration: config.duration,
            ease: config.ease,
          },
          0
        );
        tl.to(
          nextEl,
          { y: 0, rotateX: 0, opacity: 1, duration: config.duration, ease: config.ease },
          transitionDelay
        );
      };

      // First phrase holds for delay + hold seconds before the first transition
      gsap.delayedCall(config.delay + config.hold, animateNext);
    };

    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(textEl, breakpoint, animation);
  });
};
