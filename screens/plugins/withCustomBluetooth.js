const { withAndroidManifest, withMainApplication, createRunOncePlugin } = require('@expo/config-plugins');

const withCustomBluetooth = (config) => {
  // Add Bluetooth permissions to AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Add permissions if they don't exist
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    
    const permissions = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ];
    
    permissions.forEach(permission => {
      if (!androidManifest['uses-permission'].some(p => p.$['android:name'] === permission)) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': permission }
        });
      }
    });
    
    return config;
  });

  // Ensure your BluetoothPackage is added to MainApplication
  config = withMainApplication(config, (config) => {
    if (config.modResults.contents.includes('new BluetoothPackage()')) {
      return config;
    }

    // Find the getPackages method and add your package
    const mainApplication = config.modResults.contents;
    const getPackagesRegex = /getPackages\(\)\s*{\s*return\s*PackageList\(this\)\.packages\s*(?:\/\/.*?\n)?\s*\.toMutableList\(\)/;
    
    const updatedMainApplication = mainApplication.replace(
      getPackagesRegex,
      (match) => {
        return `${match}\n            packages.add(new BluetoothPackage())`;
      }
    );

    config.modResults.contents = updatedMainApplication;
    return config;
  });

  return config;
};

module.exports = createRunOncePlugin(
  withCustomBluetooth,
  'with-custom-bluetooth',
  '1.0.0'
);