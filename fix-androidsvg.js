const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withFixAndroidSVG(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents) {
      // Add resolution strategy to android block
      let contents = config.modResults.contents;
      
      // Find the android block and add resolutionStrategy
      if (contents.includes('android {')) {
        contents = contents.replace(
          'android {',
          `android {
    configurations.all {
        resolutionStrategy {
            // Force using only one version of androidsvg
            force 'com.caverock:androidsvg-aar:1.4'
            // Exclude the duplicate
            eachDependency { details ->
                if (details.requested.group == 'com.caverock' && details.requested.name == 'androidsvg') {
                    details.useTarget group: 'com.caverock', name: 'androidsvg-aar', version: '1.4'
                }
            }
        }
    }`
        );
      }
      
      config.modResults.contents = contents;
    }
    return config;
  });
};