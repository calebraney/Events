import { checkRunProp, getIxConfig, getAttrConfig } from '../utilities';

export const logoSwitch = function () {
  const ANIMATION_ID = 'logoswitch';
  const WRAP = '[data-ix-logoswitch="wrap"]';
  const TARGET_ITEM = '[data-ix-logoswitch="target-item"]';
  const SOURCE_ITEM = '[data-ix-logoswitch="source-item"]';

  // animation type values
  const TYPE_FADE = 'fade';
  const TYPE_SLIDE_UP = 'slide-up';
  const TYPE_SLIDE_DOWN = 'slide-down';
  const TYPE_SCALE_UP = 'scale-up';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const wraps = [...document.querySelectorAll(WRAP)];
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    const runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    const targetItems = [...wrap.querySelectorAll(TARGET_ITEM)];
    const sourceItems = [...wrap.querySelectorAll(SOURCE_ITEM)];

    if (targetItems.length === 0 || sourceItems.length === 0) return;

    const config = getAttrConfig(wrap, ANIMATION_ID, {
      duration: 0.8,
      delay: 1.5, // seconds — pause between switches
      type: TYPE_SLIDE_UP, // 'fade' | 'slide-up' | 'slide-down' | 'scale-up'
      'slide-distance': 3, // rem — how far content travels on slide-up
      ease: 'power2.out', // GSAP ease for slide-up; fade uses power2.in/out directionally
    });

    const numTargets = targetItems.length;

    // Build the rotation queue:
    // The first `numTargets` source items mirror what's already shown in the target slots,
    // so start with the extras (index numTargets onward) and loop back to the initials at the end.
    const extraSources = sourceItems.slice(numTargets);
    const initialSources = sourceItems.slice(0, numTargets);
    const queue =
      extraSources.length > 0 ? [...extraSources, ...initialSources] : [...initialSources];

    let queueIndex = 0;
    let lastTargetIndex = -1;

    const runSwitch = () => {
      // Pick a random target slot — never the same one that just switched
      let targetIndex;
      if (targetItems.length === 1) {
        targetIndex = 0;
      } else {
        do {
          targetIndex = Math.floor(Math.random() * targetItems.length);
        } while (targetIndex === lastTargetIndex);
      }
      lastTargetIndex = targetIndex;

      const targetItem = targetItems[targetIndex];
      const sourceItem = queue[queueIndex % queue.length];
      queueIndex++;

      const clonedContent = [...sourceItem.children].map((child) => child.cloneNode(true));
      const oldChildren = [...targetItem.children];
      const { duration, type, ease } = config;
      const slideDistance = `${config['slide-distance']}rem`;

      // Simultaneous types animate in one duration; sequential types take two (out then in)
      const isSimultaneous =
        type === TYPE_SLIDE_UP || type === TYPE_SLIDE_DOWN || type === TYPE_SCALE_UP;
      const animDuration = isSimultaneous ? duration : duration * 2;

      if (type === TYPE_SLIDE_UP || type === TYPE_SLIDE_DOWN) {
        // Old and new content animate simultaneously along the y axis.
        // slide-up: old exits upward, new enters from below.
        // slide-down: old exits downward, new enters from above.
        // Requires overflow:hidden on the target-item in CSS.
        const exitY = type === TYPE_SLIDE_UP ? `-${slideDistance}` : slideDistance;
        const enterY = type === TYPE_SLIDE_UP ? slideDistance : `-${slideDistance}`;
        clonedContent.forEach((child) => {
          gsap.set(child, { opacity: 0, y: enterY });
          targetItem.appendChild(child);
        });
        gsap.to(oldChildren, {
          opacity: 0,
          y: exitY,
          duration,
          ease,
          onComplete: () => oldChildren.forEach((child) => child.remove()),
        });
        gsap.to(clonedContent, {
          opacity: 1,
          y: 0,
          duration,
          ease,
        });
      } else if (type === TYPE_SCALE_UP) {
        // Old and new content animate simultaneously on scale.
        // Old scales up and fades out, new scales up from small and fades in.
        // Requires overflow:hidden on the target-item in CSS.
        clonedContent.forEach((child) => {
          gsap.set(child, { opacity: 0, scale: 0.6 });
          targetItem.appendChild(child);
        });
        gsap.to(oldChildren, {
          opacity: 0,
          scale: 1.4,
          duration,
          ease,
          onComplete: () => {
            oldChildren.forEach((child) => child.remove());
          },
        });
        gsap.to(clonedContent, {
          opacity: 1,
          scale: 1,
          duration,
          ease,
        });
      } else {
        // Fade: old content fades out, then new content fades in
        gsap.to(oldChildren, {
          opacity: 0,
          duration,
          ease,
          onComplete: () => {
            oldChildren.forEach((child) => child.remove());
            clonedContent.forEach((child) => {
              gsap.set(child, { opacity: 0 });
              targetItem.appendChild(child);
            });
            gsap.to(clonedContent, {
              opacity: 1,
              duration,
              ease,
            });
          },
        });
      }

      setTimeout(runSwitch, (animDuration + config.delay) * 1000);
    };

    // Start the loop after the initial delay
    setTimeout(runSwitch, config.delay * 1000);
  });
};
