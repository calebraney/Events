import { attr, checkRunProp, checkContainer, getAttrConfig, getIxConfig } from '../utilities';

/*
CSS required for the "ticker" type — include in page head:

<style>
  [data-ix-countup="item"] {
    display: inline-flex;
    overflow: hidden;
    line-height: 1;
  }
  .ticker_column {
    display: inline-flex;
    flex-direction: column;
    line-height: 1;
  }
  .ticker_digit {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ticker_separator {
    display: inline-flex;
    align-items: center;
  }
</style>
*/

export const countUp = function () {
  //animation ID
  const ANIMATION_ID = 'countup';
  //selectors
  const ITEM = '[data-ix-countup="item"]';
  const TEXT = '[data-ix-countup="text"]'; // optional child element containing the number

  // Shared options
  const OPTION_TYPE = 'data-ix-countup-type'; // "count" (default) or "ticker"

  // Ticker CSS classes for generated elements
  const COLUMN_CLASS = 'ticker_column';
  const DIGIT_CLASS = 'ticker_digit';
  const SEPARATOR_CLASS = 'ticker_separator';

  // Defaults
  const DEFAULT_TYPE = 'count'; // count or ticker
  const DEFAULT_TRIGGER = 'scroll'; // scroll or load
  const DEFAULT_ACTIVE_CLASS = 'is-active';
  const DEFAULT_COUNT_DURATION = 2.5;
  const DEFAULT_COUNT_START = 'top bottom';
  const DEFAULT_COUNT_EASE = 'power3.out';
  const DEFAULT_TICKER_DURATION = 1.5;
  const DEFAULT_TICKER_START = 'top 90%';
  const DEFAULT_TICKER_STAGGER = 0.1;
  const DEFAULT_TICKER_EASE = 'power2.out';
  const DEFAULT_TICKER_DIRECTION = 'down'; //down or up
  const DEFAULT_TICKER_USE_GROUPING = true;

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  // --- Count type animation ---
  const runCountAnimation = function (item, { duration, start, activeClass, triggerType, format }) {
    const parent = item.parentElement;
    // if a child element with the text attribute exists, use it as the number source; otherwise use the item itself
    const textEl = item.querySelector(TEXT) || item;

    // strip commas and trim, then parse as a number
    const rawText = textEl.textContent.trim();
    const cleanedText = rawText.replace(/,/g, '');
    const targetNumber = parseFloat(cleanedText);
    if (!targetNumber || isNaN(targetNumber)) return;

    // count decimal places from the cleaned string (not the parsed number)
    const decimalParts = cleanedText.split('.');
    const decimalPlaces = decimalParts.length > 1 ? decimalParts[1].length : 0;

    const formatValue = function (val) {
      let result = decimalPlaces > 0 ? val.toFixed(decimalPlaces) : Math.round(val).toString();
      if (format) {
        const parts = result.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        result = parts.join('.');
      }
      return result;
    };

    // set element to zero before animating
    textEl.textContent = formatValue(0);

    const startAnimation = function () {
      const counter = { value: 0 };
      gsap.to(counter, {
        value: targetNumber,
        duration: duration,
        ease: DEFAULT_COUNT_EASE,
        onUpdate: function () {
          textEl.textContent = formatValue(counter.value);
        },
        onComplete: function () {
          // ensure exact final value
          textEl.textContent = formatValue(targetNumber);
        },
      });
      parent.classList.add(activeClass);
      // remove active class after animation completes
      setTimeout(() => {
        parent.classList.remove(activeClass);
      }, duration * 1000);
    };

    if (triggerType === 'load') {
      startAnimation();
    } else {
      // trigger count on scroll enter
      gsap.timeline({
        scrollTrigger: {
          trigger: item,
          start: start,
          end: 'top 10%',
          scrub: true,
          onEnter: startAnimation,
        },
      });
    }
  };

  // --- Ticker type animation ---
  const runTickerAnimation = function (item, { duration, start, activeClass, triggerType }) {
    // ticker-specific options
    const tickerConfig = getAttrConfig(item, ANIMATION_ID, {
      stagger: DEFAULT_TICKER_STAGGER,
      ease: DEFAULT_TICKER_EASE,
      direction: DEFAULT_TICKER_DIRECTION,
      useGrouping: DEFAULT_TICKER_USE_GROUPING,
    });
    const { stagger, ease, direction, useGrouping } = tickerConfig;

    // if a child element with the text attribute exists, use it as the number source
    const textEl = item.querySelector(TEXT) || item;

    // get the target number from text content
    const rawText = textEl.textContent.trim();
    // strip existing formatting (commas, spaces) to get the pure number
    const cleanedText = rawText.replace(/[,\s]/g, '');
    const targetNumber = parseFloat(cleanedText);
    if (isNaN(targetNumber)) return;

    // determine decimal places from the original text
    const decimalParts = cleanedText.split('.');
    const decimalPlaces = decimalParts.length > 1 ? decimalParts[1].length : 0;

    // format a number as a string matching the target's decimal and grouping style
    const formatNumber = function (num) {
      let formatted;
      if (decimalPlaces > 0) {
        formatted = Math.abs(num).toFixed(decimalPlaces);
      } else {
        formatted = Math.abs(Math.round(num)).toString();
      }
      // add grouping (commas) if enabled
      if (useGrouping) {
        const parts = formatted.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        formatted = parts.join('.');
      }
      // add negative sign if needed
      if (num < 0) {
        formatted = '-' + formatted;
      }
      return formatted;
    };

    const targetString = formatNumber(targetNumber);

    // detect any prefix or suffix around the number (e.g. "$", "%", "k")
    const numberMatch = rawText.match(/^([^0-9\-]*)([\-]?[\d,.\s]+)([^0-9]*)$/);
    const prefix = numberMatch ? numberMatch[1] : '';
    const suffix = numberMatch ? numberMatch[3] : '';

    // clear the entire item and build the ticker DOM structure
    item.textContent = '';
    item.setAttribute('aria-label', rawText);

    // add prefix as a static separator
    if (prefix) {
      const prefixEl = document.createElement('span');
      prefixEl.classList.add(SEPARATOR_CLASS);
      prefixEl.textContent = prefix;
      prefixEl.setAttribute('aria-hidden', 'true');
      item.appendChild(prefixEl);
    }

    // build digit columns for the target number.
    // each digit gets a vertical column of repeated 0-9 cycles that scrolls to the correct position.
    // each column spins through a position-dependent number of extra digits before landing,
    // ensuring animation always occurs even when the target digit is 0.
    const EXTRA_TICKS = [1, 3, 6, 10, 15]; // extra digits to travel per column position (left to right)
    const columns = [];
    const targetDigits = targetString.replace('-', '');
    let digitColumnIndex = 0; // tracks only digit columns (excludes separators)

    for (let i = 0; i < targetDigits.length; i++) {
      const char = targetDigits[i];

      // non-digit characters (commas, decimals) are static separators
      if (isNaN(parseInt(char))) {
        const sep = document.createElement('span');
        sep.classList.add(SEPARATOR_CLASS);
        sep.textContent = char;
        sep.setAttribute('aria-hidden', 'true');
        item.appendChild(sep);
        continue;
      }

      const targetDigit = parseInt(char);
      const extraTicks = EXTRA_TICKS[Math.min(digitColumnIndex, EXTRA_TICKS.length - 1)];

      // number of full 0-9 cycles needed so targetIndex - extraTicks >= 0
      const numCycles = Math.max(0, Math.ceil((extraTicks - targetDigit) / 10));
      // targetIndex is the position of the final digit in the column
      const targetIndex = numCycles * 10 + targetDigit;
      // startIndex is exactly extraTicks before the target — travel is always exactly extraTicks
      const startIndex = targetIndex - extraTicks;

      // create a column with (numCycles + 1) full sets of 0–9 stacked vertically
      const column = document.createElement('span');
      column.classList.add(COLUMN_CLASS);
      column.setAttribute('aria-hidden', 'true');

      for (let cycle = 0; cycle <= numCycles; cycle++) {
        for (let d = 0; d <= 9; d++) {
          const digitEl = document.createElement('span');
          digitEl.classList.add(DIGIT_CLASS);
          digitEl.textContent = d;
          column.appendChild(digitEl);
        }
      }

      item.appendChild(column);
      columns.push({ element: column, targetIndex, startIndex });
      digitColumnIndex++;
    }

    // add suffix as a static separator
    if (suffix) {
      const suffixEl = document.createElement('span');
      suffixEl.classList.add(SEPARATOR_CLASS);
      suffixEl.textContent = suffix;
      suffixEl.setAttribute('aria-hidden', 'true');
      item.appendChild(suffixEl);
    }

    if (columns.length === 0) return;

    // measure a single digit height — all digits share font styles from the parent
    const firstDigitEl = columns[0].element.querySelector(`.${DIGIT_CLASS}`);
    const digitHeight = firstDigitEl.offsetHeight;

    // set each column to its starting position
    columns.forEach(({ element, startIndex }) => {
      gsap.set(element, { y: -startIndex * digitHeight });
    });

    const animateColumns = function () {
      const tl = gsap.timeline({
        onComplete: () => {
          item.classList.add(activeClass);
        },
      });

      columns.forEach(({ element, targetIndex }, index) => {
        const targetY = -targetIndex * digitHeight;

        // calculate stagger position for this column
        // rightmost digits animate first for a "counting" feel (like an odometer)
        let position;
        if (direction === 'down') {
          // right to left: last column starts first
          position = (columns.length - 1 - index) * stagger;
        } else {
          // left to right: first column starts first
          position = index * stagger;
        }

        tl.to(element, { y: targetY, duration: duration, ease: ease }, position);
      });

      return tl;
    };

    if (triggerType === 'load') {
      animateColumns();
    } else {
      // animate on scroll entry (plays once)
      ScrollTrigger.create({
        trigger: item,
        start: start,
        once: true,
        onEnter: () => {
          animateColumns();
        },
      });
    }
  };

  //elements
  const items = document.querySelectorAll(ITEM);
  items.forEach((item) => {
    //animation function
    const animation = function (match) {
      if (match) return;
      // shared options — type is read first because duration/start defaults depend on it
      const type = attr(DEFAULT_TYPE, item.getAttribute(OPTION_TYPE));
      const sharedConfig = getAttrConfig(item, ANIMATION_ID, {
        duration: type === 'ticker' ? DEFAULT_TICKER_DURATION : DEFAULT_COUNT_DURATION,
        start: type === 'ticker' ? DEFAULT_TICKER_START : DEFAULT_COUNT_START,
        active: DEFAULT_ACTIVE_CLASS,
        trigger: DEFAULT_TRIGGER,
        format: true,
      });
      const { duration, start, format } = sharedConfig;
      const activeClass = sharedConfig.active;
      const triggerType = sharedConfig.trigger;

      if (type === 'ticker') {
        runTickerAnimation(item, { duration, start, activeClass, triggerType });
      } else {
        runCountAnimation(item, { duration, start, activeClass, triggerType, format });
      }
    };

    //check if the run prop is set to true
    let runProp = checkRunProp(item, ANIMATION_ID);
    if (runProp === false) return;
    //check container breakpoint and run callback
    const breakpoint = attr('none', item.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(item, breakpoint, animation);
  });
};
