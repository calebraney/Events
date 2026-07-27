import { getAttrConfig, flattenDisplayContents, removeCMSList, getIxConfig } from '../utilities';

export const slider = function () {
  //animation ID
  const ANIMATION_ID = 'slider';
  // hero animation attribute
  const ATTRIBUTE = 'data-ix-slider';
  const SLIDER = "[data-ix-slider='component']";
  const NEXT = "[data-ix-slider='next']";
  const PREVIOUS = "[data-ix-slider='previous']";
  const PAGINATION_BULLETS = '.slider_bullet_list';
  const PAGINATION_FRACTION = '.slider_fraction_wrap';
  const PAGINATION_PROGRESSBAR = '.slider_progressbar_wrap';
  const PAGINATION_BUTTON = 'slider_bullet_item';
  const PAGINATION_BUTTON_FILL = 'slider_bullet_item_fill';
  const SCROLLBAR = '.slider_scrollbar';
  const SCROLLBAR_HANDLE = 'slider_scrollbar_handle';
  const ACTIVE_CLASS = 'is-active';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const sliders = document.querySelectorAll(`${SLIDER}:not(${SLIDER} ${SLIDER})`);
  sliders.forEach((component) => {
    //lumos script initialization guard — prevents duplicate initialization when multiple slider components are present on the same page
    if (component.dataset.scriptInitialized) return;
    component.dataset.scriptInitialized = 'true';

    const swiperElement = component.querySelector('.slider_element');
    const swiperWrapper = component.querySelector('.slider_list');
    if (!swiperElement || !swiperWrapper) return;

    flattenDisplayContents(swiperWrapper);

    removeCMSList(swiperWrapper);

    [...swiperWrapper.children].forEach((el) => el.classList.add('swiper-slide'));
    const config = getAttrConfig(swiperElement, ANIMATION_ID, {
      followFinger: true,
      freeMode: true,
      mousewheel: true,
      slideToClicked: false,
      loop: false,
      speed: 600,
      autoplay: 0, // autoplay duration in MS
      paginationType: 'bullets', // bullets, fraction, progressbar
      fractionSeparator: ' of ',
      fractionPad: false,
      fade: false,
      parallax: false,
      centerSlides: false,
      showAutoplayProgress: true,
    });
    //create slider instance
    const swiper = new Swiper(swiperElement, {
      parallax: config.parallax,
      effect: config.fade ? 'fade' : 'slide',
      fadeEffect: { crossFade: true },
      slidesPerView: config.fade ? 1 : 'auto',
      followFinger: config.followFinger,
      freeMode: config.freeMode,
      slideToClickedSlide: config.slideToClicked,
      centeredSlides: config.centerSlides,
      autoHeight: false,
      loop: config.loop,
      speed: config.speed,
      mousewheel: {
        enabled: config.mousewheel,
        forceToAxis: true,
      },
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      autoplay: config.autoplay === 0 ? false : { delay: config.autoplay * 1000 },
      navigation: {
        nextEl: component.querySelector(NEXT),
        prevEl: component.querySelector(PREVIOUS),
      },
      pagination: {
        type: config.paginationType,
        el: component.querySelector(
          config.paginationType === 'fraction'
            ? PAGINATION_FRACTION
            : config.paginationType === 'progressbar'
            ? PAGINATION_PROGRESSBAR
            : PAGINATION_BULLETS
        ),
        ...(config.paginationType === 'bullets' && {
          bulletActiveClass: ACTIVE_CLASS,
          bulletClass: PAGINATION_BUTTON,
          bulletElement: 'button',
          clickable: true,
        }),
        ...(config.paginationType === 'fraction' && {
          renderFraction: function (currentClass, totalClass) {
            return (
              '<span class="' +
              currentClass +
              ' slider_fraction_current"></span>' +
              config.fractionSeparator +
              '<span class="' +
              totalClass +
              ' slider_fraction_total"></span>'
            );
          },
          ...(config.fractionPad && {
            formatFractionCurrent: (n) => String(n).padStart(2, '0'),
            formatFractionTotal: (n) => String(n).padStart(2, '0'),
          }),
        }),
        ...(config.paginationType === 'progressbar' && {
          renderProgressbar: function (progressbarFillClass) {
            return '<span class="' + progressbarFillClass + ' slider_progressbar_fill"></span>';
          },
        }),
      },
      scrollbar: {
        el: component.querySelector(SCROLLBAR),
        draggable: true,
        dragClass: SCROLLBAR_HANDLE,
        snapOnRelease: true,
      },
      slideActiveClass: ACTIVE_CLASS,
      slideDuplicateActiveClass: ACTIVE_CLASS,
    });
    //autoplay progress animation within pagination bullet
    if (config.autoplay > 0 && config.showAutoplayProgress) {
      const progressTL = gsap.timeline({ paused: false });
      progressTL.fromTo(
        component,
        { '--slider-autoplay-progress': '0%' },
        {
          '--slider-autoplay-progress': ' 100%',
          ease: 'none',
          duration: config.autoplay,
        }
      );
      //when slide changes, animate the progress fill
      swiper.on('slideChange', function () {
        progressTL.restart();
      });
    }
  });
};
