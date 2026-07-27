# Interactions Library — Claude Instructions

## What This Repo Is

A reusable Webflow interactions library. All interactions are vanilla JS + GSAP, driven entirely by `data-ix-*` attributes. No framework — components are set up in Webflow using data attributes. Built for cross-site reuse across a wide variety of Webflow projects.

---

## File Structure

```
src/
  index.js              — entry point; imports and calls all interactions
  utilities.js          — shared utility functions
  interactions/         — one file per interaction, named export function
```

### index.js call locations

| Interaction type | Where to call |
|---|---|
| Scroll/motion animations | Inside `if (!reduceMotion) { }` block in matchMedia callback |
| UI interactions (accordion, modal, tabs, etc.) | After the matchMedia block |
| Lenis-dependent interactions | Pass `lenis` as argument |

---

## Code Conventions

### File & Function Naming
- File: `kebab-case.js` in `src/interactions/`
- Export function: `camelCase` matching filename
- `ANIMATION_ID`: camelCase string, no hyphens (e.g. `'scrollIn'`, `'hoverActive'`)

### Attribute Convention
- Element roles: `data-ix-{name}="{role}"` (e.g. `data-ix-magnetic="target"`)
- Options: `data-ix-{name}-{property}` (e.g. `data-ix-magnetic-strength`)
- Run gates: `data-ix-{name}-site-run`, `data-ix-{name}-page-run`, `data-ix-{name}-run`
- Breakpoint: `data-ix-{name}-breakpoint`

### Guard Clause Order (always this order)
1. `getIxConfig(ANIMATION_ID, true)` → exit whole function if `=== false`
2. `querySelectorAll(WRAP)` length check → exit whole function
3. `checkRunProp(wrap, ANIMATION_ID)` inside forEach → skip instance
4. child element length check → skip instance

### Options Pattern
- **≤ 2 options**: individual `attr()` calls
  ```js
  let speed = attr(1, wrap.getAttribute('data-ix-foo-speed'));
  ```
- **> 2 options**: use `getAttrConfig` — cleaner and self-documenting
  ```js
  const config = getAttrConfig(wrap, ANIMATION_ID, {
    speed: 1,
    ease: 'power1.out',
    duration: 0.6,
  });
  // Access as config.speed, config.ease, config.duration
  // Hyphenated keys use bracket notation: config['active-class']
  ```
  Remove individual `const OPTION_* = 'data-ix-...'` constants when replacing with `getAttrConfig` — the utility constructs attribute names as `data-ix-{prefix}-{key}` automatically.

### Breakpoints
```js
const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
checkContainer(items[0], breakpoint, animationCallback);
```

---

## Key Utilities (`src/utilities.js`)

| Utility | Purpose |
|---|---|
| `attr(default, attrVal)` | Type-safe attribute reader with coercion |
| `attrIfSet(item, attrName, default)` | Returns `undefined` if attr not set (use for optional GSAP props) |
| `getAttrConfig(element, prefix, defaults)` | Batch attr reader — use for > 2 options |
| `buildFromToVars(item, prefix)` | Builds GSAP fromTo vars from data attrs |
| `getIxConfig(animationID, defaults)` | Reads `window.ixConfig` and handles page-run gate |
| `checkRunProp(item, animationID)` | Checks per-instance run gate |
| `checkContainer(child, breakpoint, callback)` | Container-query-based breakpoint support |
| `getClipDirection(value)` | Converts direction keywords to clip-path polygons |
| `runSplit(text, types)` | GSAP SplitText wrapper with autoSplit |
| `getNonContentsChildren(item)` | Gets children ignoring `display: contents` wrappers |
| `flattenDisplayContents(slot)` | Removes `.u-display-contents` wrapper divs (Webflow) |
| `removeCMSList(slot)` | Unwraps Webflow CMS collection list structure |
| `ClassWatcher` | MutationObserver for class additions/removals |
| `stopScroll(lenis)` / `startScroll(lenis)` | Pause/resume scroll (Lenis-aware) |

---

## Preferences & Working Style

- **Concise responses** — lead with the action or answer, skip filler
- **No unnecessary extras** — don't add comments, docstrings, error handling, or features beyond what was asked
- **No backwards-compat hacks** — remove things cleanly, don't leave stubs
- **Prefer editing existing files** over creating new ones
- **Use the create-interaction skill** (`/create-interaction`) when adding a new interaction

---

## Interaction Inventory

All interactions live in `src/interactions/`:

`accordion`, `animations`, `banner`, `click-active`, `count-up`, `cursor`, `horizontal`, `hover-active`, `image-switch`, `lenis`, `lightbox`, `load`, `loop`, `magnetic`, `marquee`, `modal`, `mouse-over`, `page-transition`, `parallax`, `path-hover`, `play-sound`, `scroll-in`, `scroll-progress`, `scrolling`, `slider`, `sticky-nav`, `tabs`, `text-links`, `text-scrub`, `type-text`, `video-plyr`
