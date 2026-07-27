import { attr, startScroll, stopScroll, checkContainer, getIxConfig } from '../utilities';

export const modal = function (lenis) {
  const ANIMATION_ID = 'modal';
  //Selectors
  const MODAL_WRAP = '[data-ix-modal="wrap"]'; //a modal item
  const MODAL_TRIGGER = 'data-ix-modal-trigger'; //must match
  const MODAL_CLOSE = '[data-ix-modal="close"]';
  const TIMEOUT = 'data-ix-modal-timeout';
  const MODAL_TRIGGER_DEFAULT = 'blank-id';
  const DEFAULT_TIMEOUT = 0;

  //global variables
  let activeModal = false;

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  //Arrays of modal and video player elements
  const modals = [...document.querySelectorAll(MODAL_WRAP)];
  //get elements with the trigger attribute that are not a modal element
  const triggers = [...document.querySelectorAll(`[${MODAL_TRIGGER}]:not(${MODAL_WRAP})`)];

  if (modals.length === 0) return;
  modals.forEach((modal, index) => {
    //get the parent element of the trigger, and find the modal within that element
    const closeButtons = [...modal.querySelectorAll(MODAL_CLOSE)];
    const timeout = attr(DEFAULT_TIMEOUT, modal.getAttribute(TIMEOUT));
    const triggerID = attr(MODAL_TRIGGER_DEFAULT, modal.getAttribute(MODAL_TRIGGER));
    let isDisabled = false;

    function getModalTriggers(modal, triggers) {
      // 2. Filter triggers that match the modal ID, but exclude the modal itself
      const modalTriggers = Array.from(triggers).filter((trigger) => {
        return trigger.getAttribute(MODAL_TRIGGER) === triggerID && trigger !== modal;
      });
      // 3. Return the array of matching triggers
      return modalTriggers;
    }
    const modalTriggers = getModalTriggers(modal, triggers);

    //if trigger id attribute is not default
    if (triggerID !== MODAL_TRIGGER_DEFAULT) {
      //if there are no modal triggers
      if (modalTriggers.length !== 0) {
        //for each trigger open the modal if it is clicked
        modalTriggers.forEach((trigger, index) => {
          trigger.addEventListener('click', (e) => {
            if (isDisabled) return;
            // Find the closest dialog parent and close it
            openModal(modal);
          });
        });
      }
    }
    //if the modal timer is not set to 0
    if (timeout !== DEFAULT_TIMEOUT) {
      // open based on timer
      setTimeout(() => {
        if (isDisabled) return;
        openModal(modal);
      }, timeout * 1000);
    }

    // process key events in the modal
    modal.addEventListener('keydown', (e) => {
      // if escape is pressed when modal is open, close lightbox
      if (e.key === 'Escape' && activeModal !== false) {
        closeModal(modal);
      }
    });

    // process click events for close buttons
    closeButtons.forEach((item) => {
      item.addEventListener('click', (e) => {
        closeModal(modal);
      });
    });

    const breakpoint = attr('none', modal.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(modal, breakpoint, (match) => { isDisabled = match; });
  });

  const openModal = function (modal) {
    // console.log(modal);
    if (!modal) return;
    //if another modal is open close it.
    if (activeModal) {
      closeModal(activeModal);
    }
    modal.showModal();
    stopScroll(lenis);
    activeModal = modal;
  };
  const closeModal = function (modal) {
    if (!modal) return;
    modal.close();
    startScroll(lenis);
    activeModal = false;
  };
};
