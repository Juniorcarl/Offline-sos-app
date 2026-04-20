import { Alert, Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

let hasRun = false;
let cachedResults = null;

// Show explanation dialog
function explain(title, message) {
  return new Promise(resolve => {
    Alert.alert(title, message, [{ text: 'Continue', onPress: resolve }], {
      cancelable: false,
    });
  });
}

const PermissionManager = {

  // ── MAIN ENTRY ─────────────────────────────────────────────
  async requestAll() {
    if (hasRun && cachedResults) return cachedResults;

    const results = {
      location: false,
      notifications: false,
      bluetooth: false,
    };

    // ── STEP 1: LOCATION ─────────────────────────────────────
    try {
      const { status: existing } = await Location.getForegroundPermissionsAsync();

      if (existing === 'granted') {
        results.location = true;
      } else {
        await explain(
          '📍 Location Access',
          'Needed for:\n\n• SOS location\n• Nearby devices\n• Wi-Fi Direct discovery'
        );

        const { status } = await Location.requestForegroundPermissionsAsync();
        results.location = status === 'granted';
      }
    } catch (e) {
      console.log('Location error:', e);
    }

    await delay(300);

    // ── STEP 2: BLUETOOTH + WIFI DIRECT ─────────────────────
    if (Platform.OS === 'android') {
      try {
        const btPermissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ].filter(Boolean);

        const wifiPermissions =
          Platform.Version >= 33
            ? ['android.permission.NEARBY_WIFI_DEVICES']
            : [];

        const allPermissions = [...btPermissions, ...wifiPermissions];

        console.log('📡 Requesting permissions:', allPermissions);

        const checks = await Promise.all(
          allPermissions.map(p => PermissionsAndroid.check(p))
        );

        const alreadyGranted = checks.every(Boolean);

        if (!alreadyGranted) {
          await explain(
            '📡 Nearby Devices',
            'Required for:\n\n• Wi-Fi Direct discovery\n• Device-to-device messaging\n• Offline SOS mesh network'
          );

          const granted = await PermissionsAndroid.requestMultiple(allPermissions);

          results.bluetooth = allPermissions.every(
            p => granted[p] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          results.bluetooth = true;
        }

        console.log('📡 Permissions result:', results.bluetooth);

      } catch (e) {
        console.log('Bluetooth/WiFi error:', e);
        results.bluetooth = false;
      }
    } else {
      results.bluetooth = true;
    }

    await delay(300);

    // ── STEP 3: NOTIFICATIONS ───────────────────────────────
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();

      if (existing === 'granted') {
        results.notifications = true;
      } else {
        await explain(
          '🔔 Notifications',
          'Used to alert you when SOS messages arrive.'
        );

        const { status } = await Notifications.requestPermissionsAsync();
        results.notifications = status === 'granted';
      }
    } catch (e) {
      console.log('Notifications error:', e);
    }

    hasRun = true;
    cachedResults = results;

    console.log('✅ FINAL PERMISSION STATE:', results);

    return results;
  },

  // ── 🔥 FIX: REQUIRED BY YOUR APP ──────────────────────────
  getResults() {
    return cachedResults ?? {
      location: false,
      notifications: false,
      bluetooth: false,
    };
  },

  // ── OPTIONAL HELPERS ─────────────────────────────────────
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