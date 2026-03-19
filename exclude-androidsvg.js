const { withProjectBuildGradle, withAppBuildGradle } = require('expo/config-plugins');

function withExcludeAndroidSVG(config) {
  // Add exclusion to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.contents) {
      // Add dependency exclusion in the dependencies block
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {
    implementation('com.caverock:androidsvg-aar:1.4') {
        exclude group: 'com.caverock', module: 'androidsvg'
    }`
      );
    }
    return config;
  });

  return config;
}

module.exports = withExcludeAndroidSVG;