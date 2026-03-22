import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

let hasRun = false;
let cachedResults = null;

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
      } else if (existing === 'undetermined') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        results.location = status === 'granted';
      }
    } catch (e) {
      console.log('PermissionManager location error:', e);
    }

    await delay(400);

    // ── Step 2: Bluetooth (Android 12+) ───────────────────────────────────
    if (Platform.OS === 'android') {
      try {
        const btPermissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ].filter(p => p != null && p !== '');

        const granted = await PermissionsAndroid.requestMultiple(btPermissions);

        results.bluetooth = btPermissions.every(
          p => granted[p] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (e) {
        console.log('PermissionManager bluetooth error:', e);
        results.bluetooth = false;
      }
    } else {
      results.bluetooth = true;
    }

    await delay(400);

    // ── Step 3: Notifications ──────────────────────────────────────────────
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') {
        results.notifications = true;
      } else if (existing === 'undetermined') {
        const { status } = await Notifications.requestPermissionsAsync();
        results.notifications = status === 'granted';
      }
    } catch (e) {
      console.log('PermissionManager notifications error:', e);
    }

    await delay(600);

    // ── Step 4: Warn about denied permissions ──────────────────────────────
    const denied = [];
    if (!results.location)      denied.push('Location');
    if (!results.bluetooth)     denied.push('Bluetooth');
    if (!results.notifications) denied.push('Notifications');

    if (denied.length > 0) {
      Alert.alert(
        '⚠️ Permissions Required',
        `${denied.join(', ')} ${denied.length === 1 ? 'permission is' : 'permissions are'} required for the app to work properly.\n\n` +
        `• Location — GPS tracking and mesh network\n` +
        `• Bluetooth — mesh network discovery\n` +
        `• Notifications — background SOS alerts\n\n` +
        `Please enable ${denied.length === 1 ? 'it' : 'them'} in Settings.`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
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