// Dev-only logging — `__DEV__` is set by esbuild's `define` in bin/build.js
// (true for `npm run dev`, false for `npm run build`), so these calls are
// stripped from the minified production bundle without touching call sites.
export const debugLog = __DEV__ ? console.log.bind(console) : () => {};

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

// Toggles a visual "disabled" class alongside aria-disabled, so a
// non-native-<button> disabled state (a class-based convention, since a real
// `disabled` attribute isn't always used on Webflow-authored buttons) is
// still communicated to assistive tech, not just conveyed visually.
export function setDisabledState(el, isDisabled, disabledClass = 'is-disabled') {
  if (!el) return;
  el.classList.toggle(disabledClass, isDisabled);
  if (isDisabled) el.setAttribute('aria-disabled', 'true');
  else el.removeAttribute('aria-disabled');
}

// Creates (once) or reuses a visually-hidden aria-live="polite" element as a
// direct child of `container` and sets its text — for announcing dynamic
// content changes (e.g. "N more events loaded") to screen reader users who
// wouldn't otherwise notice a silent DOM update, since visible text changing
// elsewhere on the page isn't itself announced. Uses the `u-sr-only`
// convention already used elsewhere in these Webflow templates rather than
// requiring a new CSS class from the Designer.
export function announceLiveRegion(container, message) {
  let region = container.querySelector('[data-live-region]');
  if (!region) {
    region = document.createElement('div');
    region.setAttribute('data-live-region', '');
    region.setAttribute('aria-live', 'polite');
    region.className = 'u-sr-only';
    container.appendChild(region);
  }
  region.textContent = message;
}

// Duplicating a template element for a repeated occurrence duplicates any
// `id`/`data-w-id` it carries. Duplicate `id`s break getElementById/aria-*
// lookups; duplicate `data-w-id`s can make Webflow's native Interactions
// panel misfire across instances. Strip both from clones.
export function uniquifyIds(root, suffix) {
  if (root.hasAttribute('id')) root.id = `${root.id}-${suffix}`;
  root.removeAttribute('data-w-id');
  root.querySelectorAll('[id]').forEach((el) => {
    el.id = `${el.id}-${suffix}`;
  });
  root.querySelectorAll('[data-w-id]').forEach((el) => {
    el.removeAttribute('data-w-id');
  });
}
