
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

// Tracks whether we've run this session already
let hasRun = false;
let cachedResults = null;

const PermissionManager = {

  // ── Call this once in App.js before rendering screens ───────────────────
  async requestAll() {
    // Only run once per app session
    if (hasRun && cachedResults) return cachedResults;

    const results = {
      location: false,
      notifications: false,
    };

    // ── Step 1: Location ───────────────────────────────────────────────────
    // Must come first — Bluetooth scanning also needs location on Android
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      if (existingStatus === 'granted') {
        results.location = true;
      } else if (existingStatus === 'undetermined') {
        // Not asked yet — show the system dialog
        const { status } = await Location.requestForegroundPermissionsAsync();
        results.location = status === 'granted';
      } else {
        // 'denied' — user previously denied, can't show dialog again
        // Must send them to settings
        results.location = false;
      }
    } catch (e) {
      console.log('PermissionManager location error:', e);
    }

    // ── Step 2: Notifications ──────────────────────────────────────────────
    // Wait 400ms after location dialog closes before showing next one.
    // Android needs a brief gap or it drops the second dialog silently.
    await delay(400);

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus === 'granted') {
        results.notifications = true;
      } else if (existingStatus === 'undetermined') {
        const { status } = await Notifications.requestPermissionsAsync();
        results.notifications = status === 'granted';
      } else {
        results.notifications = false;
      }
    } catch (e) {
      console.log('PermissionManager notifications error:', e);
    }

    // ── Step 3: Warn about denied permissions ──────────────────────────────
    // Only show the settings prompt if something critical was denied.
    // We wait 600ms so the last dialog is fully dismissed first.
    await delay(600);

    const denied = [];
    if (!results.location)      denied.push('Location');
    if (!results.notifications) denied.push('Notifications');

    if (denied.length > 0) {
      Alert.alert(
        '⚠️ Permissions Required',
        `${denied.join(' and ')} ${denied.length === 1 ? 'permission is' : 'permissions are'} required for the app to work properly.\n\n` +
        `• Location — needed for GPS tracking and mesh network\n` +
        `• Notifications — needed for background SOS alerts\n\n` +
        `Please enable ${denied.length === 1 ? 'it' : 'them'} in Settings.`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }

    hasRun = true;
    cachedResults = results;
    return results;
  },

  // ── Get last known results without requesting again ──────────────────────
  getResults() {
    return cachedResults ?? { location: false, notifications: false };
  },

  // ── Check if location is granted (for components that need to know) ──────
  async isLocationGranted() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  // ── Check if notifications are granted ───────────────────────────────────
  async isNotificationsGranted() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  // ── Reset for testing (call in dev only) ─────────────────────────────────
  reset() {
    hasRun = false;
    cachedResults = null;
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default PermissionManager;