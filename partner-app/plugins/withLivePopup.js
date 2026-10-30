const { withAndroidManifest } = require('expo/config-plugins');

/**
 * The full-screen pop-up for new jobs / orders (modules/live-popup): the main activity may show
 * over the lock screen and wake it, like an incoming-call screen, when the pop-up opens it.
 */
module.exports = function withLivePopup(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    const main = app?.activity?.find((activity) => activity.$['android:name'] === '.MainActivity');
    if (main) {
      main.$['android:showWhenLocked'] = 'true';
      main.$['android:turnScreenOn'] = 'true';
    }
    return mod;
  });
};
