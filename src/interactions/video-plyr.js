import { attr, getIxConfig } from '../utilities';
import Plyr from 'plyr';

export const videoPlyr = function () {
  const ANIMATION_ID = 'videoplyr';
  //selectors
  const COMPONENT = '.plyr_component';
  //custom classes
  const VIDEO_CLASS = '.plyr_video';
  const COVER_CLASS = '.plyr_cover';
  const HIDE_COVER_CLASS = 'hide-cover';
  const PAUSE_TRIGGER_CLASS = '.plyr_pause-trigger';
  const CONTAIN_CLASS = 'contain-video';
  const settings = {
    autoplay: false,
    loop: false,
    mute: false,
    hideControls: true,
  };
  //plyr.io classes
  const PLAYING_CLASS = '.plyr--playing';
  //array of video players
  const players = [];

  const ixEnabled = getIxConfig(ANIMATION_ID, true);
  if (ixEnabled === false) return;

  const components = [...document.querySelectorAll(COMPONENT)];
  if (components.length === 0) return;

  components.forEach((component, index) => {
    // create plyr settings
    const video = component.querySelector(VIDEO_CLASS);
    const cover = component.querySelector(COVER_CLASS);
    const pauseTrigger = component.querySelector(PAUSE_TRIGGER_CLASS);

    //optional
    //get settings from the components
    const loopSetting = attr(settings.loop, component.getAttribute('data-player-loop'));
    let muteSetting = attr(settings.mute, component.getAttribute('data-player-mute'));
    const showCoverOnPause = attr(false, component.getAttribute('data-player-show-cover-on-pause'));

    let player = new Plyr(video, {
      controls: ['play', 'progress', 'current-time', 'mute', 'fullscreen'],
      hideControls: settings.hideControls,
      loop: { active: loopSetting },
      resetOnEnd: true,
    });
    players.push(player);

    // custom video cover
    if (cover) {
      cover.addEventListener('click', () => {
        player.play();
      });
    }

    player.on('ended', (event) => {
      component.classList.remove(HIDE_COVER_CLASS);
    });
    //if attribute is set to true show the cover on pause of video
    if (showCoverOnPause) {
      player.on('pause', (event) => {
        component.classList.remove(HIDE_COVER_CLASS);
      });
    }

    // pause other playing videos when this one starts playing
    player.on('play', (event) => {
      //remove the hide cover class for all components and pause the player if it is not the current one.
      components.forEach((item, index) => {
        item.classList.remove(HIDE_COVER_CLASS);
        if (item !== component) {
          const player = players[index];
          player.pause();
        }
      });
      //add the hidecover class to the current component
      component.classList.add(HIDE_COVER_CLASS);
      //find the component that was previously playing
      let prevPlayingComponent = document.querySelector(PLAYING_CLASS).closest(COMPONENT);
      //if the previous component exists and it is not the current one pause it
      if (prevPlayingComponent && prevPlayingComponent !== component) {
        prevPlayingComponent.find(PAUSE_TRIGGER_CLASS)[0].click();
      }
    });

    //pause component on click trigger
    pauseTrigger.addEventListener('click', () => {
      player.pause();
    });
    // exit full screen when video ends
    player.on('ended', (event) => {
      if (player.fullscreen.active) {
        player.fullscreen.exit();
      }
    });
    // set video to contain instead of cover when in full screen mode
    player.on('enterfullscreen', (event) => {
      component.classList.add(CONTAIN_CLASS);
    });
    player.on('exitfullscreen', (event) => {
      component.classList.remove(CONTAIN_CLASS);
    });
  });
  return [players, components];
};
