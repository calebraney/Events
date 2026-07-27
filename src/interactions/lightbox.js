import { attr, checkRunProp, checkContainer, startScroll, stopScroll, getIxConfig } from '../utilities';

export const lightbox = function (pagePlayers, pagePlayerComponents, lenis) {
  const ANIMATION_ID = 'lightbox';
  //Selectors
  const LIGHTBOX_WRAP = '[data-ix-lightbox="wrap"]'; //a list of lightboxes (to prevent lists from intersecting)
  const LIGHTBOX_COMPONENT = '[data-ix-lightbox="component"]'; //lightbox element (needs to be a child of the trigger element)
  const LIGHTBOX_TRIGGER = '[data-ix-lightbox="trigger"]'; //element to trigger lightbox
  const LIGHTBOX_CLOSE_BTN = '[data-ix-lightbox="close"]';
  const LIGHTBOX_NEXT_BTN = '[data-ix-lightbox="next"]';
  const LIGHTBOX_PREVIOUS_BTN = '[data-ix-lightbox="previous"]';
  // elements used for lightbox thumbnails
  //   const LIGHTBOX_IMAGE = '[data-ix-lightbox="image"]';
  //   const LIGHTBOX_THUMBNAIL = '[data-ix-lightbox="thumbnail"]';
  //   const LIGHTBOX_VID_THUMBNAIL = '[data-ix-lightbox="video-thumbnail"]';
  //   const LIGHTBOX_VID = '[data-ix-lightbox="video"]';
  //   const LIGHTBOX_VID_WRAP = '[data-ix-lightbox="video-wrap"]';

  //classes
  const VIDEO_CLASS = '.plyr_component';
  const NO_SCROLL = 'no-scroll';
  //global variables
  let activeLightbox = false;

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //function to activate lightboxes
  const activateLightboxes = function (listElement) {
    let isDisabled = false;
    //utility function to filter out the players that aren't in lightboxes
    const filterPlayers = function (pagePlayers, pagePlayerComponents) {
      // players = pagePlayers.filter((player) => Boolean(player.closest(LIGHTBOX_COMPONENT)));
      if (!pagePlayerComponents || pagePlayerComponents.length === 0) return;
      pagePlayerComponents.forEach((component, index) => {
        const matchingPlayer = pagePlayers[index];
        //if the player component is in a lightbox
        if (Boolean(component.closest(LIGHTBOX_COMPONENT))) {
          //add the component and the player object to a new array
          players.push(pagePlayers[index]);
          plyrComponents.push(pagePlayerComponents[index]);
        }
      });
    };

    //utility function to find a player based on its lightbox
    const findPlayer = function (lightbox) {
      if (!plyrComponents || plyrComponents.length === 0) return;
      function findMatchingVideo(plyrComponents, videoEl) {
        return plyrComponents.findIndex((videoElement) => videoElement === videoEl);
      }
      const videoEl = lightbox.querySelector(VIDEO_CLASS);
      if (!videoEl) return false;
      let playerIndex = findMatchingVideo(plyrComponents, videoEl);
      player = players[playerIndex];
      return player;
    };

    //Arrays of lightbox and video player elements
    const lightboxTriggers = [...listElement.querySelectorAll(LIGHTBOX_TRIGGER)];
    const lightboxElements = [];
    const players = [];
    const plyrComponents = [];

    filterPlayers(pagePlayers, pagePlayerComponents);
    if (lightboxTriggers.length === 0) return;
    lightboxTriggers.forEach((trigger, index) => {
      //get the parent element of the trigger, and find the lightbox within that element
      const parent = trigger.parentElement;
      const lightbox = trigger.querySelector(LIGHTBOX_COMPONENT);
      //add parent and lightboxes to the array
      lightboxElements.push(lightbox);

      if (!lightbox) return;

      //get the player for this lightbox
      let player = false;
      player = findPlayer(lightbox);

      // process key events in the lightbox
      parent.addEventListener('keydown', (e) => {
        // if key is Enter and the target is the lightbox trigger, open lightbox
        if (e.key === 'Enter' && e.target === trigger) {
          if (isDisabled) return;
          openModal(lightbox);
        }
        // if escape is pressed when lightbox is open, close lightbox
        if (e.key === 'Escape' && activeLightbox !== false) {
          closeModal(lightbox);
        }
      });

      // process click events in the lightbox
      parent.addEventListener('click', (e) => {
        // if the click target was in the lightbox trigger
        if (e.target.closest(LIGHTBOX_TRIGGER) !== null) {
          if (isDisabled) return;
          // Find the next dialog sibling and open it
          openModal(lightbox);
        }
        // Check if the clicked element is a close button inside a dialog
        else if (e.target.closest(LIGHTBOX_CLOSE_BTN) !== null) {
          // Find the closest dialog parent and close it
          closeModal(lightbox);
          if (player) {
            player.pause();
          }
        }
        // Check if the clicked element is a close button inside a dialog
        else if (e.target.closest(LIGHTBOX_NEXT_BTN) !== null) {
          //get next lightbox
          let nextLightbox = lightboxElements[index + 1];
          //if next lightbox doesn't exist get the first lightbox
          if (index === lightboxElements.length - 1) {
            nextLightbox = lightboxElements[0];
          }
          closeModal(lightbox);
          openModal(nextLightbox);
        }
        // Check if the clicked element is a close button inside a dialog
        else if (e.target.closest(LIGHTBOX_PREVIOUS_BTN) !== null) {
          //get the previous lightbox
          let previousLightbox = lightboxElements[index - 1];
          //if previous lightbox doesn't exist get the last lightbox
          if (index === 0) {
            previousLightbox = lightboxElements[lightboxElements.length - 1];
          }
          closeModal(lightbox);
          openModal(previousLightbox);
        }
      });
    });

    const openModal = function (lightbox) {
      if (!lightbox) return;
      lightbox.showModal();
      //   lightboxThumbnails(lightbox, player);
      startScroll(lenis);
      activeLightbox = lightbox;
    };
    const closeModal = function (lightbox) {
      if (!lightbox) return;
      player = findPlayer(lightbox);
      if (player) {
        player.pause();
      }
      lightbox.close();
      stopScroll(lenis);
      activeLightbox = false;
    };

    const breakpoint = attr('none', listElement.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(listElement, breakpoint, (match) => { isDisabled = match; });

    //handled updating the image for lightbox thumbnails
    // const lightboxThumbnails = function (lightbox, player) {
    //   const thumbnails = lightbox.querySelectorAll(LIGHTBOX_THUMBNAIL);
    //   const lightboxImage = lightbox.querySelector(LIGHTBOX_IMAGE);
    //   const videoThumbnail = lightbox.querySelector(LIGHTBOX_VID_THUMBNAIL);
    //   const videoWrap = lightbox.querySelector(LIGHTBOX_VID_WRAP);

    //   thumbnails.forEach(function (thumbnail) {
    //     thumbnail.addEventListener('click', function () {
    //       videoWrap.classList.add(HIDE_CLASS);
    //       source = thumbnail.src;
    //       lightboxImage.src = source;
    //       if (player) {
    //         player.pause();
    //       }
    //     });
    //   });
    //   videoThumbnail.addEventListener('click', function () {
    //     videoWrap.classList.remove(HIDE_CLASS);
    //   });
    // };
  };
  //elements
  const body = document.querySelector('body');
  //select all the wrap elements
  const wraps = [...document.querySelectorAll(LIGHTBOX_WRAP)];
  //if wraps exist run on each wrap, otherwise run on the body
  if (wraps.length > 0) {
    wraps.forEach((wrap) => {
      //check if the run prop is set to true
      let runProp = checkRunProp(wrap, ANIMATION_ID);
      if (runProp === false) return;
      activateLightboxes(wrap);
    });
  } else {
    activateLightboxes(body);
  }
};
