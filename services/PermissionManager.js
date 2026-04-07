import { Alert, Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

let hasRun = false;
let cachedResults = null;

// Show an alert and wait for the user to tap Continue
function explain(title, message) {
  return new Promise(resolve => {
    Alert.alert(title, message, [{ text: 'Continue', onPress: resolve }], { cancelable: false });
  });
}

const PermissionManager = {

  async requestAll() {
    if (hasRun && cachedResults) return cachedResults;

    const results = {
      location:      false,
      notifications: false,
      bluetooth:     false,
    };

    // ── Step 1: Location ───────────────────────────────────────────────────
    try {
      const { status: existing } = await Location.getForegroundPermissionsAsync();
      if (existing === 'granted') {
        results.location = true;
      } else {
        await explain(
          '📍 Location Access',
          'This app needs your location to:\n\n' +
          '• Show your position on the offline map\n' +
          '• Help rescuers find you in an emergency\n' +
          '• Attach coordinates to SOS messages\n\n' +
          "We'll ask for location permission next."
        );
        const { status } = await Location.requestForegroundPermissionsAsync();
        results.location = status === 'granted';
      }
    } catch (e) {
      console.log('PermissionManager location error:', e);
    }

    await delay(300);

    // ── Step 2: Bluetooth (Android 12+) ───────────────────────────────────
    if (Platform.OS === 'android') {
      try {
        const btPermissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ].filter(p => p != null && p !== '');

        const checks = await Promise.all(btPermissions.map(p => PermissionsAndroid.check(p)));
        const allGranted = checks.every(Boolean);

        if (allGranted) {
          results.bluetooth = true;
        } else {
          await explain(
            '🔵 Bluetooth Access',
            'Bluetooth is the backbone of the offline mesh network.\n\n' +
            '• Discover nearby devices running this app\n' +
            '• Relay SOS messages without internet\n' +
            '• Extend the network range hop-by-hop\n\n' +
            "We'll ask for Bluetooth permission next."
          );
          const granted = await PermissionsAndroid.requestMultiple(btPermissions);
          results.bluetooth = btPermissions.every(
            p => granted[p] === PermissionsAndroid.RESULTS.GRANTED
          );
        }
      } catch (e) {
        console.log('PermissionManager bluetooth error:', e);
        results.bluetooth = false;
      }
    } else {
      results.bluetooth = true;
    }

    await delay(300);

    // ── Step 3: Notifications ──────────────────────────────────────────────
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') {
        results.notifications = true;
      } else {
        await explain(
          '🔔 Notifications',
          'Allow notifications so the app can:\n\n' +
          '• Alert you when a nearby SOS is received\n' +
          '• Warn you if the mesh network goes offline\n' +
          '• Confirm your own SOS was sent\n\n' +
          "We'll ask for notification permission next."
        );
        const { status } = await Notifications.requestPermissionsAsync();
        results.notifications = status === 'granted';
      }
    } catch (e) {
      console.log('PermissionManager notifications error:', e);
    }

    hasRun = true;
    cachedResults = results;
    return results;
  },

  getResults() {
    return cachedResults ?? { location: false, notifications: false, bluetooth: false };
  },

  async isLocationGranted() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  async isNotificationsGranted() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  async isBluetoothGranted() {
    if (Platform.OS !== 'android') return true;
    try {
      const status = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
      return status === true;
    } catch {
      return false;
    }
  },

  reset() {
    hasRun = false;
    cachedResults = null;
  },
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default PermissionManager;
