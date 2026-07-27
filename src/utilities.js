// ============================================================================
// getAttrConfig: Batch Attribute Reader
// ============================================================================
//
// HOW IT WORKS:
// Most interactions follow the same pattern — read 5-15 data attributes from
// an element and fall back to defaults. This utility does that in one call.
//
// It takes three arguments:
//   1. element  — the DOM element to read attributes from
//   2. prefix   — the interaction name (e.g. 'scrolling', 'marquee', 'load')
//   3. defaults — an object where keys are the attribute suffix and values
//                  are the default values (the types of the defaults drive
//                  the type coercion via the existing `attr` function)
//
// ============================================================================
export const getAttrConfig = function (element, prefix, defaults) {
  const config = {};
  for (const [key, defaultVal] of Object.entries(defaults)) {
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const attrName = `data-ix-${prefix}-${kebabKey}`;
    config[key] = attr(defaultVal, element.getAttribute(attrName));
  }
  return config;
};

// attribute value checker
export const attr = function (defaultVal, attrVal) {
  //get the type of the default
  const defaultValType = typeof defaultVal;
  if (typeof attrVal !== 'string' || attrVal.trim() === '') return defaultVal;
  if (attrVal?.toLowerCase() === 'true' && defaultValType === 'boolean') return true;
  if (attrVal?.toLowerCase() === 'false' && defaultValType === 'boolean') return false;
  if (isNaN(attrVal) && defaultValType === 'string') return attrVal;
  if (!isNaN(attrVal) && defaultValType === 'number') return +attrVal;
  return defaultVal;
};
//function to process data attributes and return the correct value if set (or nothing if not set)
export const attrIfSet = function (item, attributeName, defaultValue) {
  const hasAttribute = item.hasAttribute(attributeName);
  const attributeValue = attr(defaultValue, item.getAttribute(attributeName));
  // if the attribute is not set retun, otherwise update the attribute
  // (alternatively, could just include the default value)
  if (hasAttribute) {
    return attributeValue;
  } else {
    return;
  }
};

export class ClassWatcher {
  constructor(targetNode, classToWatch, classAddedCallback, classRemovedCallback) {
    this.targetNode = targetNode;
    this.classToWatch = classToWatch;
    this.classAddedCallback = classAddedCallback;
    this.classRemovedCallback = classRemovedCallback;
    this.observer = null;
    this.lastClassState = targetNode.classList.contains(this.classToWatch);

    this.init();
  }

  init() {
    this.observer = new MutationObserver(this.mutationCallback);
    this.observe();
  }

  observe() {
    this.observer.observe(this.targetNode, { attributes: true });
  }

  disconnect() {
    this.observer.disconnect();
  }

  mutationCallback = (mutationsList) => {
    for (let mutation of mutationsList) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        let currentClassState = mutation.target.classList.contains(this.classToWatch);
        if (this.lastClassState !== currentClassState) {
          this.lastClassState = currentClassState;
          if (currentClassState) {
            this.classAddedCallback();
          } else {
            this.classRemovedCallback();
          }
        }
      }
    }
  };
}

//utility for finding children of an element without display: contents
// will go down layer by layer until it finds children without that value.
export function getNonContentsChildren(item) {
  if (!item || !(item instanceof Element)) return [];

  const result = [];

  function processChildren(parent) {
    const children = Array.from(parent.children);
    for (const child of children) {
      const display = window.getComputedStyle(child).display;
      if (display === 'contents') {
        processChildren(child); // Recurse into children of 'contents' elements
      } else {
        result.push(child); // Keep non-'contents' element
      }
    }
  }

  processChildren(item);
  return result;
}

export const copyURL = function () {
  //get all copy clip elements
  const elements = [...document.querySelectorAll('[fs-copyclip-text]')];
  //if the value is set to URL, change the attribute value to the current url.
  if (elements.length === 0) return;
  elements.forEach((el) => {
    const val = el.getAttribute('fs-copyclip-text');
    if (val === 'url') {
      el.setAttribute('fs-copyclip-text', window.location.href);
    }
  });
};

//reset gsap on click of reset triggers
export const scrollReset = function () {
  //selector
  const RESET_EL = '[data-ix-reset]';
  //time option
  const RESET_TIME = 'data-ix-reset-time';
  const resetScrollTriggers = document.querySelectorAll(RESET_EL);
  resetScrollTriggers.forEach(function (item) {
    item.addEventListener('click', function (e) {
      //reset scrolltrigger
      ScrollTrigger.refresh();
      //if item has reset timer reset scrolltriggers after timer as well.
      if (item.hasAttribute(RESET_TIME)) {
        let time = attr(1000, item.getAttribute(RESET_TIME));
        //get potential timer reset
        setTimeout(() => {
          ScrollTrigger.refresh();
        }, time);
      }
    });
  });
};

export const flattenDisplayContents = function (slot) {
  if (!slot) return;
  let child = slot.firstElementChild;
  while (child && child.classList.contains('u-display-contents')) {
    while (child.firstChild) {
      slot.insertBefore(child.firstChild, child);
    }
    slot.removeChild(child);
    child = slot.firstElementChild;
  }
};

// removeCMSList:
// Webflow CMS collections wrap items in `.w-dyn-list > .w-dyn-items > .w-dyn-item`.
// For sliders/tabs, we need the actual content elements as direct children of the
// slot (e.g. the swiper wrapper or tab panel list). This function extracts the
// visible CMS items and removes the wrapping structure.
export const removeCMSList = function (slot) {
  const dynList = Array.from(slot.children).find((child) => child.classList.contains('w-dyn-list'));
  if (!dynList) return;
  const nestedItems = dynList?.querySelector('.w-dyn-items')?.children;
  if (!nestedItems) return;
  const staticWrapper = [...slot.children];
  [...nestedItems].forEach((el) => {
    const c = [...el.children].find((c) => !c.classList.contains('w-condition-invisible'));
    c && slot.appendChild(c);
  });
  staticWrapper.forEach((el) => el.remove());
};
