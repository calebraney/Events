import { attr, checkRunProp, checkContainer, getAttrConfig, getIxConfig } from '../utilities';

// Required GSAP TextPlugin for text animations

export const typeText = function () {
  //animation ID
  const ANIMATION_ID = 'typetext';
  //selectors
  const WRAP = '[data-ix-typetext="wrap"]';
  const TEXT = '[data-ix-typetext="text"]';
  const CURSOR = '[data-ix-typetext="cursor"]';
  const PHRASE_ITEM = '[data-ix-typetext="phrase"]';
  //options (phrases and delimiter handled separately — delimiter depends on phrases being set)
  const OPTION_PHRASES = 'data-ix-typetext-phrases';
  const OPTION_DELIMITER = 'data-ix-typetext-delimiter';
  const DEFAULT_DELIMITER = ';';
  // type option values
  const TYPE_YOYO = 'yoyo'; // type out the text by reversing the tween (creates a "ping pong" effect)
  const TYPE_REPLACE = 'replace'; // replace the text instantly after the hold delay, instead of animating out first
  const TYPE_BACKSPACE = 'backspace'; // animate out by backspacing one character at a time (only for type-out, not replace)

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = document.querySelectorAll(WRAP);
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    const textEl = wrap.querySelector(TEXT);
    if (!textEl) return;

    const animation = function (match) {
      if (match) return;
      // get options
      const config = getAttrConfig(wrap, ANIMATION_ID, {
        type: TYPE_YOYO, // 'yoyo' | 'replace' | 'backspace'
        duration: 1,
        repeat: false,
        delay: 1,
        repeatDelay: 1,
        ease: 'none',
        cursorDuration: 0.5,
        cursorEase: 'power2.inOut',
        typeFirst: false,
      });

      // build phrases array — prefer the data attribute, fall back to child phrase elements
      let phrases = [];
      const phrasesAttr = wrap.getAttribute(OPTION_PHRASES);

      if (phrasesAttr) {
        const delimiter = attr(DEFAULT_DELIMITER, wrap.getAttribute(OPTION_DELIMITER));
        phrases = phrasesAttr
          .split(delimiter)
          .map((p) => p.trimStart())
          .filter((p) => p !== '');
      } else {
        const phraseEls = wrap.querySelectorAll(PHRASE_ITEM);
        phraseEls.forEach((el) => {
          const text = el.textContent.trim();
          if (text) phrases.push(text);
        });
      }

      if (phrases.length === 0) return;

      // if type-first is false, set first phrase immediately so it can be animated out
      gsap.set(textEl, { text: config.typeFirst ? '' : phrases[0] });

      // animate cursor blink if present
      const cursorEl = wrap.querySelector(CURSOR);
      if (cursorEl) {
        gsap.to(cursorEl, {
          opacity: 0,
          repeat: -1,
          yoyo: true,
          duration: config.cursorDuration,
          ease: config.cursorEase,
        });
      }

      // builds the "animate out" portion of a phrase timeline (hold then remove text)
      const addAnimateOut = function (tl) {
        if (config.type === TYPE_REPLACE) {
          // instant clear after the hold
          tl.set(textEl, {}, `+=${config.repeatDelay}`);
        } else if (config.type === TYPE_BACKSPACE || config.type === TYPE_YOYO) {
          // tween out to '' — yoyo uses this path only for the first-no-type case;
          // normal yoyo phrases are handled by GSAP's built-in yoyo mechanism
          tl.to(textEl, {
            duration: config.duration,
            text: '',
            ease: config.ease,
            delay: config.repeatDelay,
          });
        }
      };

      const masterRepeat = config.repeat ? -1 : 0;
      const tlMaster = gsap.timeline({ repeat: masterRepeat, delay: config.delay });

      phrases.forEach((phrase, index) => {
        const isLast = index === phrases.length - 1;
        const isFirstNoType = !config.typeFirst && index === 0;
        const staysAtEnd = !config.repeat && isLast;

        // when type-first is false, the first phrase is already set — only animate it out
        if (isFirstNoType) {
          const tlPhrase = gsap.timeline();
          if (config.type === TYPE_YOYO) {
            // replicate yoyo's right-to-left deletion by counting characters down from the end
            const counter = { n: phrase.length };
            tlPhrase.to(counter, {
              n: 0,
              duration: config.duration,
              ease: config.ease,
              delay: config.repeatDelay,
              onUpdate() {
                textEl.textContent = phrase.slice(0, Math.round(counter.n));
              },
            });
          } else {
            addAnimateOut(tlPhrase);
          }
          tlMaster.add(tlPhrase);
          return;
        }

        if (config.type === TYPE_YOYO && !staysAtEnd) {
          // yoyo: let GSAP reverse the tween automatically
          const tlPhrase = gsap.timeline({
            repeat: 1,
            yoyo: true,
            repeatDelay: config.repeatDelay,
          });
          tlPhrase.to(textEl, { duration: config.duration, text: phrase, ease: config.ease });
          tlMaster.add(tlPhrase);
        } else {
          // replace / backspace / last phrase staying: build the timeline explicitly
          const tlPhrase = gsap.timeline();
          tlPhrase.to(textEl, { duration: config.duration, text: phrase, ease: config.ease });
          // only add the animate-out if this phrase doesn't stay
          if (!staysAtEnd) addAnimateOut(tlPhrase);
          tlMaster.add(tlPhrase);
        }
      });
    };

    //check container breakpoint and run callback
    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(textEl, breakpoint, animation);
  });
};
