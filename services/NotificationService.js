import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { EventEmitter } from 'eventemitter3';

export const alertEmitter = new EventEmitter();
export const ALERT_EVENT  = 'EMERGENCY_ALERT';

const SOUND_FILE_MAP = {
  '1': 'fire-alert.mp3',
  '2': 'signal-alert.mp3',
  '3': 'simple-tone-loop.mp3',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge:  false,
  }),
});

class NotificationService {
  constructor() {
    this._alertSoundId   = '1';
    this._alertSound     = true;
    this._channelCreated = false;
  }

  setPreferences({ alertSoundId, alertSound } = {}) {
    if (alertSoundId !== undefined) this._alertSoundId = String(alertSoundId);
    if (alertSound   !== undefined) this._alertSound   = alertSound;
    this._channelCreated = false;
  }

  async requestPermissions() {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async _ensureChannel() {
    if (Platform.OS !== 'android' || this._channelCreated) return;
    await Notifications.setNotificationChannelAsync('sos_emergency', {
      name:                 'SOS Emergency Alerts',
      importance:           Notifications.AndroidImportance.MAX,
      sound:                this._alertSound
                              ? (SOUND_FILE_MAP[this._alertSoundId] ?? 'fire-alert.mp3')
                              : null,
      vibrationPattern:     [0, 300, 200, 300, 200, 300],
      lightColor:           '#FF0000',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd:            true,
      enableLights:         true,
      enableVibrate:        true,
      showBadge:            true,
    });
    this._channelCreated = true;
  }

  async showAlert(packet) {
    const appState = AppState.currentState;
    if (appState === 'active') {
      alertEmitter.emit(ALERT_EVENT, packet);
    } else {
      await this._sendNotification(packet);
    }
  }

  async _sendNotification(packet) {
    try {
      await this._ensureChannel();
      const isAuthority = packet.target === 'authority';
      const timeStr     = new Date(packet.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const locationStr = (packet.lat && packet.lon)
        ? `📍 ${packet.lat.toFixed(4)}, ${packet.lon.toFixed(4)}`
        : '📍 Location unavailable';
      const soundFile = this._alertSound
        ? (SOUND_FILE_MAP[this._alertSoundId] ?? 'fire-alert.mp3')
        : undefined;
      await Notifications.scheduleNotificationAsync({
        identifier: packet.id,
        content: {
          title:   isAuthority ? '🚨 SOS — Encrypted for Authorities' : '🚨 Emergency SOS Nearby!',
          body:    `${packet.msg}\n${locationStr} · ${timeStr}`,
          sound:   soundFile,
          vibrate: [0, 300, 200, 300],
          data:    { packet },
          ...(Platform.OS === 'android' && { channelId: 'sos_emergency', color: '#d64045' }),
        },
        trigger: null,
      });
    } catch (e) {
      console.error('❌ Notification error:', e);
    }
  }

  registerBackgroundHandler(onTap) {
    return Notifications.addNotificationResponseReceivedListener(response => {
      const packet = response.notification.request.content.data?.packet;
      if (packet && onTap) onTap(packet);
    });
  }
}

export default new NotificationService();