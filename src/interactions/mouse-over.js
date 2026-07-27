import { attr, attrIfSet, checkRunProp, checkContainer, getIxConfig } from '../utilities';

export const mouseOver = function () {
  // animation ID
  const ANIMATION_ID = 'mouseover';
  //elements
  const WRAP = '[data-ix-mouseover="wrap"]';
  const LAYER = '[data-ix-mouseover="layer"]';
  const TARGET = '[data-ix-mouseover="target"]';
  //options
  const DURATION = 'data-ix-mouseover-duration';
  const EASE = 'data-ix-mouseover-ease';

  const X_MOVE_X = 'data-ix-mouseover-x-move-x';
  const X_MOVE_Y = 'data-ix-mouseover-x-move-y';
  const X_ROTATE_Z = 'data-ix-mouseover-x-rotate-z';
  const X_ROTATE_Y = 'data-ix-mouseover-x-rotate-y';
  const X_ROTATE_X = 'data-ix-mouseover-x-rotate-x';

  const Y_MOVE_X = 'data-ix-mouseover-y-move-x';
  const Y_MOVE_Y = 'data-ix-mouseover-y-move-y';
  const Y_ROTATE_Z = 'data-ix-mouseover-y-rotate-z';
  const Y_ROTATE_Y = 'data-ix-mouseover-y-rotate-y';
  const Y_ROTATE_X = 'data-ix-mouseover-y-rotate-x';

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  // select the items
  const wraps = document.querySelectorAll(WRAP);
  wraps.forEach((wrap) => {
    const layers = wrap.querySelectorAll(LAYER);
    // return if items are null
    if (layers.length === 0) return;

    //check if the run prop is set to true
    let runProp = checkRunProp(wrap, ANIMATION_ID);
    if (runProp === false) return;

    // find the target element if one exists, otherwise tge parent is the target
    let target = wrap.querySelector(TARGET);
    if (!target) {
      target = wrap;
    }

    //handle mouse movement
    const mouseMove = function () {
      /////////////////////////
      // Setting up Timeline

      // object that stores the value of the progress so it can be animated
      let initialProgress = { x: 0.5, y: 0.5 };
      let progressObject = { x: initialProgress.x, y: initialProgress.y };
      //create default duration and ease
      let duration = attr(0.5, wrap.getAttribute(DURATION));
      let ease = attr('power1.out', wrap.getAttribute(EASE));
      // Create X timeline
      let cursorXTimeline = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      // Create Y Timeline
      let cursorYTimeline = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      // For each image add a tween on the timeline

      //utility function to get value pairs from attributes
      const setVarsForOption = function (layer, attribute, defaultAttr) {
        let toValue = attrIfSet(layer, attribute, defaultAttr);
        let fromValue;
        //if the value is not set return the function.
        if (toValue === undefined) return [undefined, undefined];
        //switch values if attribute values starts with a negative
        if (String(toValue).startsWith('-')) {
          // if switch values is true make the from value positive
          if (typeof defaultAttr === 'number') {
            fromValue = -1 * toValue;
          }
          if (typeof defaultAttr === 'string') {
            fromValue = toValue.slice(1);
          }
        }
        // if switch values is false make the from value negative
        else {
          //check the value type
          if (typeof defaultAttr === 'number') {
            fromValue = -1 * toValue;
          }
          if (typeof defaultAttr === 'string') {
            fromValue = '-' + toValue;
          }
          // console.log('not', toValue, fromValue);
        }
        return [fromValue, toValue];
      };
      //////////////////////
      // Adding tweens
      layers.forEach((layer) => {
        //create vars objects
        let xVarsFrom = {};
        let xVarsTo = {};
        let yVarsFrom = {};
        let yVarsTo = {};
        // get custom move amounts or set them at the default of 10%
        // for each from
        //x axis options
        [xVarsFrom.x, xVarsTo.x] = setVarsForOption(layer, X_MOVE_X, '10%');
        [xVarsFrom.y, xVarsTo.y] = setVarsForOption(layer, X_MOVE_Y, '10%');
        [xVarsFrom.rotateZ, xVarsTo.rotateZ] = setVarsForOption(layer, X_ROTATE_Z, 0);
        [xVarsFrom.rotateY, xVarsTo.rotateY] = setVarsForOption(layer, X_ROTATE_Y, 0);
        [xVarsFrom.rotateX, xVarsTo.rotateX] = setVarsForOption(layer, X_ROTATE_X, 0);

        //y axis options
        [yVarsFrom.y, yVarsTo.y] = setVarsForOption(layer, Y_MOVE_Y, '10%');
        [yVarsFrom.x, yVarsTo.x] = setVarsForOption(layer, Y_MOVE_X, '10%');
        [yVarsFrom.rotateZ, yVarsTo.rotateZ] = setVarsForOption(layer, Y_ROTATE_Z, 0);
        [yVarsFrom.rotateY, yVarsTo.rotateY] = setVarsForOption(layer, Y_ROTATE_Y, 0);
        [yVarsFrom.rotateX, yVarsTo.rotateX] = setVarsForOption(layer, Y_ROTATE_X, 0);

        //log 4 vars objects
        // console.log(xVarsFrom, xVarsTo, yVarsFrom, yVarsTo);

        // horizontal timeline
        cursorXTimeline.fromTo(layer, xVarsFrom, xVarsTo, 0);
        //vertical timeline
        cursorYTimeline.fromTo(layer, yVarsFrom, yVarsTo, 0);
        // console.log(cursorXTimeline, cursorYTimeline);
      });

      //////////////////////
      // Function to update timeline progress based on an inputted value
      function setTimelineProgress(xValue, yValue) {
        // animate the timeline progress value and keep the timeline in sync onUpdate
        gsap.to(progressObject, {
          x: xValue,
          y: yValue,
          ease: ease,
          duration: duration,
          onUpdate: () => {
            cursorXTimeline.progress(progressObject.x);
            cursorYTimeline.progress(progressObject.y);
          },
        });
      }
      //Set the initial progress of the timeline
      setTimelineProgress(initialProgress.x, initialProgress.y);

      //////////////////////
      // Mouse events
      target.addEventListener('mousemove', function (e) {
        if (isDisabled) return;
        // get bounding rect of target
        const rect = target.getBoundingClientRect();
        // current mouse position - left offset of target: normalized with the targets width
        let mousePercentX = gsap.utils.clamp(
          0,
          1,
          gsap.utils.normalize(0, rect.width, e.clientX - rect.left)
        );
        // current mouse position - top offset of target: normalized with the targets height
        let mousePercentY = gsap.utils.clamp(
          0,
          1,
          gsap.utils.normalize(0, rect.height, e.clientY - rect.top)
        );
        // set the timeline progress
        setTimelineProgress(mousePercentX, mousePercentY);
      });
      target.addEventListener('mouseleave', function (e) {
        if (isDisabled) return;
        // on mouse leave set back to default state
        setTimelineProgress(initialProgress.x, initialProgress.y);
      });
    };
    let isDisabled = false;
    mouseMove();
    const breakpoint = attr('none', wrap.getAttribute(`data-ix-${ANIMATION_ID}-breakpoint`));
    checkContainer(wrap, breakpoint, (match) => { isDisabled = match; });
  });
};
