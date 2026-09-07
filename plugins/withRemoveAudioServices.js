const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withRemoveAudioServices(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const app = androidManifest.manifest.application[0];
    if (!app.service) app.service = [];

    app.service.push({
      $: {
        'android:name': 'expo.modules.audio.service.AudioControlsService',
        'tools:node': 'remove',
      },
    });

    app.service.push({
      $: {
        'android:name': 'expo.modules.audio.service.AudioRecordingService',
        'tools:node': 'remove',
      },
    });

    return config;
  });
};
