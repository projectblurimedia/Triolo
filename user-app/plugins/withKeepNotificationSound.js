const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/*
 * (Copied between user-app and partner-app — keep in sync.)
 *
 * Release builds shrink resources, and the shrinker drops any res/raw file no code names
 * directly. expo-notifications finds the notification sound by name at run time, so without
 * this rule the sound (once triolo_chime.wav) was stripped from the APK and every notification fell back to the
 * phone's default sound.
 */
module.exports = function withKeepNotificationSound(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'keep_notification_sound.xml'),
        '<?xml version="1.0" encoding="utf-8"?>\n' +
          '<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="@raw/nearbyu_notification" />\n',
      );
      return mod;
    },
  ]);
};
