import { getAttrConfig, flattenDisplayContents, removeCMSList, getIxConfig } from '../utilities';
export const tabs = function () {
  //animation ID
  const ANIMATION_ID = 'tabs';
  //elements
  const WRAP = '[data-ix-tabs="wrap"]';
  const CONTENT = '[data-ix-tabs="content"]';
  const LINK = '[data-ix-tabs="link"]';
  const LINKS = '[data-ix-tabs="links"]';

  const NEXT_BTN = '[data-ix-tabs="next"]';
  const PREV_BTN = '[data-ix-tabs="previous"]';
  const PLAY_BTN = '[data-ix-tabs="toggle"]';

  const ACTIVE_CLASS = 'is-active';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //select all the wrap elements
  const tabWraps = [...document.querySelectorAll(WRAP)];
  if (tabWraps.length === 0) return;
  //for each tabs elements
  tabWraps.forEach((tabWrap, componentIndex) => {
    //get options
    const tabConfig = getAttrConfig(tabWrap, ANIMATION_ID, {
      loopControls: true,
      slideTabs: false,
      autoplayDuration: 0,
      duration: 0.2,
      pauseOnHover: false,
      autoplayVideos: false,
      ease: 'power1.out',
    });
    const loopControls = tabConfig.loopControls;
    let autoplay = tabConfig.autoplayDuration; // let — reassigned in URL params handler
    const slideTabs = tabConfig.slideTabs;
    const duration = tabConfig.duration;
    const pauseOnHover = tabConfig.pauseOnHover;
    const autoplayVideos = tabConfig.autoplayVideos;
    const ease = tabConfig.ease;

    //get elements
    let previousButton = tabWrap.querySelector(`${PREV_BTN} button`),
      nextButton = tabWrap.querySelector(`${NEXT_BTN} button`),
      toggleWrap = tabWrap.querySelector(PLAY_BTN),
      toggleButton = tabWrap.querySelector(`${PLAY_BTN} button`),
      buttons = [...tabWrap.querySelectorAll(LINK)],
      panelList = tabWrap.querySelector(CONTENT),
      buttonList = tabWrap.querySelector(LINKS),
      animating = false,
      canPlay = true,
      autoplayTl;

    // flattenDisplayContents(buttonList);
    flattenDisplayContents(panelList);

    // removeCMSList(buttonList);
    removeCMSList(panelList);

    let buttonItems = buttons;
    let panelItems = Array.from(panelList.children);

    if (!buttonList || !panelList || !buttonItems.length || !panelItems.length) {
      console.warn('Missing elements in:', tabWrap);
      return;
    }

    panelItems.forEach((panel, i) => {
      panel.style.display = 'none';
      panel.setAttribute('role', 'tabpanel');
    });
    buttonItems.forEach((button, i) => {
      button.setAttribute('role', 'tab');
    });

    panelList.removeAttribute('role');
    buttonList.setAttribute('role', 'tablist');
    buttonItems.forEach((btn) => btn.setAttribute('role', 'tab'));
    panelItems.forEach((panel) => panel.setAttribute('role', 'tabpanel'));

    let activeIndex = 0;
    //function to active tab panel
    const makeActive = (index, focus = false, animate = true, pause = true) => {
      if (animating) return;

      //Pause videos inside the previously active panel when panels are changed
      const previousPanel = panelItems[activeIndex];
      if (previousPanel) {
        const videos = previousPanel.querySelectorAll('video');
        videos.forEach((video) => {
          if (!video.paused) video.pause();
        });
      }

      buttonItems.forEach((btn, i) => {
        btn.classList.toggle('is-active', i === index);
        btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
        btn.setAttribute('tabindex', i === index ? '0' : '-1');
      });
      panelItems.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
      if (nextButton) nextButton.disabled = index === buttonItems.length - 1 && !loopControls;
      if (previousButton) previousButton.disabled = index === 0 && !loopControls;
      if (focus) buttonItems[index].focus();
      // moved previousPanel declaration earlier so video-pause can run
      // const previousPanel = panelItems[activeIndex];
      const currentPanel = panelItems[index];
      let direction = 1;
      if (activeIndex > index) direction = -1;
      // If Autoplay Videos is set to true play videos inside the active panel when it becomes active.
      if (autoplayVideos && currentPanel) {
        const currentVideos = currentPanel.querySelectorAll('video');
        currentVideos.forEach((video) => {
          // Only play if video is allowed to autoplay and user interaction rules do not block it
          if (video.paused) {
            const playPromise = video.play();
            if (playPromise instanceof Promise) {
              playPromise.catch(() => {
                // autoplay was prevented — do nothing, fail silently
              });
            }
          }
        });
      }

      if (typeof gsap !== 'undefined' && animate && activeIndex !== index) {
        if (autoplayTl && !canPlay && typeof autoplayTl.restart === 'function') {
          autoplayTl.restart();
        }
        animating = true;
        let tl = gsap.timeline({
          onComplete: () => {
            animating = false;
            if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
          },
          defaults: { duration: duration, ease: ease },
        });
        //slider animation
        if (slideTabs) {
          tl.set(currentPanel, { display: 'block', position: 'relative' });
          if (previousPanel)
            tl.set(previousPanel, { position: 'absolute', top: 0, left: 0, width: '100%' });
          if (previousPanel)
            tl.fromTo(previousPanel, { xPercent: 0 }, { xPercent: -120 * direction });
          tl.fromTo(currentPanel, { xPercent: 120 * direction }, { xPercent: 0 }, '<');
          if (previousPanel) tl.set(previousPanel, { display: 'none' });
        } else {
          if (previousPanel) tl.to(previousPanel, { opacity: 0 });
          if (previousPanel) tl.set(previousPanel, { display: 'none' });
          tl.set(currentPanel, { display: 'block' });
          tl.fromTo(currentPanel, { opacity: 0 }, { opacity: 1 });
        }
      } else {
        if (previousPanel) previousPanel.style.display = 'none';
        if (currentPanel) currentPanel.style.display = 'block';
      }
      buttonList.scrollTo({ left: buttonItems[index].offsetLeft, behavior: 'smooth' });
      activeIndex = index;
    };

    makeActive(0, false, false);

    const updateIndex = (delta, focus = false, pause = true) =>
      makeActive(
        (activeIndex + delta + buttonItems.length) % buttonItems.length,
        focus,
        true,
        pause
      );
    nextButton?.addEventListener('click', () => updateIndex(1));
    previousButton?.addEventListener('click', () => updateIndex(-1));

    buttonItems.forEach((btn, index) => {
      let tabId = tabWrap.getAttribute('data-tab-component-id');
      tabId = tabId ? tabId.toLowerCase().replaceAll(' ', '-') : componentIndex + 1;
      let itemId = btn.getAttribute('data-tab-item-id');
      itemId = itemId ? itemId.toLowerCase().replaceAll(' ', '-') : index + 1;

      btn.setAttribute('id', 'tab-button-' + tabId + '-' + itemId);
      btn.setAttribute('aria-controls', 'tab-panel-' + tabId + '-' + itemId);
      panelItems[index]?.setAttribute('id', 'tab-panel-' + tabId + '-' + itemId);
      panelItems[index]?.setAttribute('aria-labelledby', btn.id);

      if (new URLSearchParams(location.search).get('tab-id') === tabId + '-' + itemId)
        makeActive(index),
          (autoplay = 0),
          tabWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          history.replaceState(
            {},
            '',
            ((u) => (u.searchParams.delete('tab-id'), u))(new URL(location.href))
          );
      btn.addEventListener('click', () => makeActive(index));
      btn.addEventListener('keydown', (e) => {
        if (['ArrowRight', 'ArrowDown'].includes(e.key)) updateIndex(1, true);
        else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) updateIndex(-1, true);
      });
    });

    if (autoplay !== 0 && typeof gsap !== 'undefined') {
      autoplayTl = gsap.timeline({ repeat: -1 }).fromTo(
        tabWrap,
        { '--progress': 0 },
        {
          onComplete: () => updateIndex(1, false, false),
          '--progress': 1,
          ease: 'none',
          duration: autoplay,
        }
      );
      let isHovered = false,
        hasFocusInside = false,
        prefersReducedMotion = false,
        inView = true;
      function updateAuto() {
        if (prefersReducedMotion || !inView || canPlay || isHovered || hasFocusInside)
          autoplayTl.pause();
        else autoplayTl.play();
      }
      function setButton() {
        canPlay = !canPlay;
        toggleButton?.setAttribute('aria-pressed', !canPlay ? 'true' : 'false');
        toggleWrap?.classList.toggle('is-pressed', !canPlay);
        if (!canPlay) isHovered = hasFocusInside = prefersReducedMotion = false;
        updateAuto();
      }
      setButton();
      toggleButton?.addEventListener('click', function () {
        setButton();
      });
      function handleMotionChange(e) {
        prefersReducedMotion = e.matches;
        updateAuto();
        canPlay = !e.matches;
        setButton();
      }
      handleMotionChange(window.matchMedia('(prefers-reduced-motion: reduce)'));
      window
        .matchMedia('(prefers-reduced-motion: reduce)')
        .addEventListener('change', handleMotionChange);
      if (pauseOnHover)
        tabWrap.addEventListener('mouseenter', () => {
          isHovered = true;
          updateAuto();
        });
      if (pauseOnHover)
        tabWrap.addEventListener('mouseleave', () => {
          hasFocusInside = false;
          isHovered = false;
          updateAuto();
        });
      tabWrap.addEventListener('focusin', () => {
        hasFocusInside = true;
        updateAuto();
      });
      tabWrap.addEventListener('focusout', (e) => {
        if (!e.relatedTarget || !tabWrap.contains(e.relatedTarget)) {
          hasFocusInside = false;
          updateAuto();
        }
      });
      new IntersectionObserver(
        (e) => {
          inView = e[0].isIntersecting;
          updateAuto();
        },
        { threshold: 0 }
      ).observe(tabWrap);
    }
  });
};
