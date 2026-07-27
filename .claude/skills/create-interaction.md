# Create Interaction Skill

You are helping create a new reusable interaction for a Webflow interaction library. These are vanilla JS + GSAP animations driven entirely by `data-ix-*` attributes — no framework, no CSS classes for behavior, just DOM attribute conventions.

## Step 1 — Gather Requirements

Before writing any code, ask the user:

1. **What is the goal of this interaction?** Get a description of what it should do and how it should behave.
2. **Do you have a visual reference?** Ask if they have an image, screenshot, or Figma link that shows how it should work.
3. **What is the interaction name?** This becomes the `ANIMATION_ID` (camelCase, no spaces). If they don't have one, suggest one based on the description.

Wait for answers before proceeding.

---

## Step 2 — Analyze the Codebase Before Writing

Before writing any code, read these files to orient yourself:

- `src/utilities.js` — understand all available utility functions
- `src/index.js` — understand how interactions are imported and called
- 1–2 existing interactions most similar to what you're building (from `src/interactions/`)

This ensures you reuse existing utilities rather than duplicating logic, and wire the interaction into `index.js` correctly.

---

## Step 3 — Design Decisions to Think Through

Before writing, reason through:

**Interaction category** — Is this:
- A scroll-triggered animation? → goes inside the `!reduceMotion` block in `index.js`
- A UI interaction (accordion, modal, tabs)? → goes outside matchMedia, no reduce motion guard
- A page-level utility? → may just be called directly like `marquee()` or `textLinks()`

**DOM structure** — What elements does it need?
- A wrapping element (`data-ix-{name}="wrap"`) is almost always required
- Child elements use `data-ix-{name}="item"`, `"trigger"`, `"target"`, `"content"`, etc.
- Name these semantically — they map directly to Webflow component structure

**Options** — What should be configurable per-instance?
- Think about duration, easing, direction, stagger, breakpoints, hover behavior, active classes, etc.
- Every configurable value gets a `data-ix-{name}-{property}` attribute with a sensible default
- Use the `attr(default, element.getAttribute(ATTR_NAME))` pattern for all options
- Use `getAttrConfig(element, prefix, defaults)` if there are > 2 options — cleaner than individual `attr()` calls

**Breakpoints** — Does this need to stop at certain screen sizes or input types?
- Every interaction should support `data-ix-{name}-breakpoint` for disabling at a given breakpoint.
- Use `checkContainer(referenceEl, breakpoint, callback)` — always the last thing set up inside the wrap loop.
- The callback receives `match` (boolean). `match=true` means the disable condition is active.
- **Pattern A** (event-listener interactions): `isDisabled` flag, checked at the top of each handler.
- **Pattern B** (GSAP animation interactions): `if (match) return;` at the top of the animation callback — this prevents initialization when disabled.

Available breakpoint keywords (all mean "disabled when condition is true"):

| Keyword | Disabled when | Enabled when |
|---|---|---|
| `medium` | width < 50em | Large screens only |
| `small` | width < 35em | Medium + large |
| `xsmall` | width < 20em | Small + medium + large |
| `large-and-up` | width ≥ 50em | Small screens only |
| `medium-and-up` | width ≥ 35em | Xsmall only |
| `small-and-up` | width ≥ 20em | Xsmall only |
| `touch` | pointer: coarse | Mouse/trackpad only |
| `pointer` | pointer: fine | Touch devices only |

**Utility functions** — Review `src/utilities.js` before writing. Available utilities:
- `attr(default, attrVal)` — type-safe attribute reader with coercion
- `attrIfSet(item, attrName, default)` — returns undefined if attribute not present (use for optional GSAP props)
- `getAttrConfig(element, prefix, defaults)` — batch attribute reader for many options
- `buildFromToVars(item, prefix)` — builds GSAP fromTo vars from data attributes (use for scroll/tween animations)
- `getIxConfig(animationID, true)` — checks global config to allow disabling the interaction; returns `false` if disabled
- `checkRunProp(item, animationID)` — checks `data-ix-{name}-run` on each wrap element to skip individual instances
- `checkContainer(containerChild, breakpoint, callback)` — runs callback when a container query matches
- `getClipDirection(value)` — converts 'left'/'right'/'top'/'bottom'/'full' to clip-path polygons
- `runSplit(text, types)` — wraps GSAP SplitText with autoSplit
- `getNonContentsChildren(item)` — gets children ignoring `display: contents` wrappers (Webflow components)
- `flattenDisplayContents(slot)` — removes `.u-display-contents` wrapper divs
- `removeCMSList(slot)` — unwraps Webflow CMS collection list structure
- `ClassWatcher` — MutationObserver class for watching class additions/removals
- `stopScroll(lenis)` / `startScroll(lenis)` — pause/resume scroll

**New utility functions** — If you find yourself writing reusable logic that isn't already in `utilities.js`, add it there. Export it and import it into the interaction. Keep it generic — utility functions should work for any interaction, not be tied to one.

---

## Step 4 — Write the Interaction File

Create `src/interactions/{kebab-case-name}.js`.

### File Template

```javascript
import { attr, checkRunProp, getIxConfig /*, other utilities */ } from '../utilities';

export const {camelCaseName} = function () {
  // ─── IDs & Selectors ────────────────────────────────────────────────────────
  const ANIMATION_ID = '{animationID}'; // used in all data-ix-{name}-* attributes

  // Element selectors — values map to data-ix-{name}="{value}" attributes
  const WRAP    = '[data-ix-{name}="wrap"]';
  const ITEM    = '[data-ix-{name}="item"]';      // add/remove as needed
  const TRIGGER = '[data-ix-{name}="trigger"]';   // optional
  const TARGET  = '[data-ix-{name}="target"]';    // optional

  // Option attribute names — follow data-ix-{name}-{property} convention
  const OPTION_DURATION   = 'data-ix-{name}-duration';
  const OPTION_EASE       = 'data-ix-{name}-ease';
  const OPTION_ACTIVE_CLASS = 'data-ix-{name}-active-class';
  // ... add relevant options

  // ─── Global Enable Gate ─────────────────────────────────────────────────────
  // Exits early if the interaction has been disabled via global config
  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  // ─── Per-Instance Setup ──────────────────────────────────────────────────────
  const wraps = [...document.querySelectorAll(WRAP)];
  if (wraps.length === 0) return; // exit if no instances on page

  wraps.forEach((wrap) => {
    // Guard: allow per-instance opt-out via data-ix-{name}-run="false"
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    // ─── Read Options ────────────────────────────────────────────────────────
    // Each option reads from the attribute with a typed default.
    // `attr` handles string/number/boolean coercion automatically.
    let duration    = attr(0.6,         wrap.getAttribute(OPTION_DURATION));
    let ease        = attr('power1.out', wrap.getAttribute(OPTION_EASE));
    let activeClass = attr('is-active',  wrap.getAttribute(OPTION_ACTIVE_CLASS));
    // ... read all options

    // ─── Get Elements ────────────────────────────────────────────────────────
    const items = [...wrap.querySelectorAll(ITEM)];
    if (items.length === 0) return; // guard against empty wrap

    // Optional elements — fall back to wrap if not present
    // const trigger = wrap.querySelector(TRIGGER) || wrap;
    // const target  = wrap.querySelector(TARGET)  || wrap;

    // ─── Animation Logic ─────────────────────────────────────────────────────
    // ... core animation or event logic here

  });
};
```

### Key Rules to Follow

**Naming conventions:**
- File: `kebab-case.js` matching the interaction name
- Export function: `camelCase` matching the file name
- `ANIMATION_ID`: camelCase string, no hyphens (e.g. `'scrollIn'`, `'hoverActive'`)
- Selector constants: `SCREAMING_SNAKE_CASE`
- Option attribute constants: `SCREAMING_SNAKE_CASE` with `OPTION_` prefix recommended
- Attribute values for element roles: lowercase with hyphens (e.g. `"wrap"`, `"image-wrap"`)

**Guard clause order** (always in this order):
1. `getIxConfig` → exit entire function if disabled
2. `querySelectorAll(WRAP)` → exit if none found
3. `checkRunProp` inside forEach → skip individual instance
4. `querySelectorAll(ITEM)` inside forEach → skip if no children

**Options pattern:**
```javascript
// Simple (< 4 options): individual attr() calls
let duration = attr(0.6, wrap.getAttribute(OPTION_DURATION));

// Batch (> 2 options): use getAttrConfig
const config = getAttrConfig(wrap, ANIMATION_ID, {
  duration: 0.6,
  ease: 'power1.out',
  start: 'top 90%',
  end: 'top 75%',
  scrub: false,
});
// Access as config.duration, config.ease, etc.
```

**Breakpoint support:**

Pattern A — event-listener interactions (modal, hover effects, etc.):
```javascript
let isDisabled = false;
// ... set up event listeners, each starting with: if (isDisabled) return;
const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
checkContainer(wrap, breakpoint, (match) => { isDisabled = match; });
```

Pattern B — GSAP animation interactions (scroll animations, timelines, etc.):
```javascript
const animation = function (match) {
  if (match) return; // disabled at this breakpoint — skip initialization
  // ... GSAP setup
};
const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
checkContainer(items[0], breakpoint, animation);
```

`checkContainer` always goes last inside the wrap loop. `match=false` (default when `breakpoint='none'`) → interaction runs normally.

**Comments:** Add a comment above each logical section (ID block, options block, element queries, animation logic). For non-obvious logic, add inline comments explaining the why.

---

## Step 5 — Check for New Utility Functions

After writing the interaction, look at your code critically:

- Is there a self-contained helper function (not tied to this specific animation) that could be reused by future interactions?
- Examples of what belongs in `utilities.js`: a new DOM normalization helper, a new easing value parser, a new scroll position calculator, a new event delegation helper.
- If yes, extract it into `utilities.js` as a named export, import it into the interaction, and make it as generic as possible. Write a brief comment block above it explaining what it does and when to use it.

---

## Step 6 — Wire Into index.js

Read `src/index.js` first to understand where to insert.

**Import** at the top with the other imports (alphabetical by function name):
```javascript
import { {camelCaseName} } from './interactions/{kebab-case-name}';
```

**Call** in the correct location inside `gsapInit()`:

| Interaction type | Where to call |
|---|---|
| Scroll/motion animation | Inside `if (!reduceMotion) { ... }` block |
| Functional UI (modal, accordion, etc.) | After the matchMedia block, with `marquee()`, `tabs()`, etc. |
| Needs lenis reference | Pass `lenis` as argument: `{camelCaseName}(lenis)` |

---

## Step 7 — Final Checklist

Before presenting the code:

- [ ] `getIxConfig` called before any DOM queries; exits if `=== false`
- [ ] `wraps.length === 0` guard present
- [ ] `checkRunProp` called inside the `wraps.forEach` loop
- [ ] Options follow the pattern: `attr()` for ≤ 2 options, `getAttrConfig()` for > 2 options
- [ ] All element queries have `if (!element) return` or length guards
- [ ] `checkContainer` wired up with the correct pattern (A or B) as the last step inside the wrap loop
- [ ] Interaction correctly placed in `index.js` (reduce motion block or not)
- [ ] Import added to `index.js`
- [ ] Any new utility functions added to `utilities.js` and imported
- [ ] Comments added to explain non-obvious logic

---

## Attribute Naming Reference

| Purpose | Pattern | Example |
|---|---|---|
| Element role | `data-ix-{name}="{role}"` | `data-ix-magnetic="target"` |
| Run gate (global) | `data-ix-{name}-site-run="false"` | `data-ix-accordion-site-run="false"` |
| Run gate (page) | `data-ix-{name}-page-run="false"` | `data-ix-accordion-page-run="false"` |
| Run gate (instance) | `data-ix-{name}-run="false"` | `data-ix-accordion-run="false"` |
| Option | `data-ix-{name}-{property}` | `data-ix-magnetic-strength="0.5"` |
| Breakpoint | `data-ix-{name}-breakpoint` | `data-ix-marquee-breakpoint="medium"` |
