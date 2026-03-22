import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Alert,
  Vibration,
  Linking,
  Platform,
  AppState,
  NativeModules,
  NativeEventEmitter,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { Accelerometer } from 'expo-sensors';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import PermissionManager from '../services/PermissionManager';
import DevicesModal from './DevicesModal';
import connectionManager from '../services/ConnectionManager';

const SHAKE_THRESHOLD     = 2.5;
const SHAKE_COOLDOWN      = 3000;
const DEFAULT_SOS_MESSAGE = 'Help! I need immediate assistance';

const { BluetoothModule, ShakeModule } = NativeModules;
const shakeEmitter = ShakeModule ? new NativeEventEmitter(ShakeModule) : null;

export default function HomeScreen() {
  const navigation = useNavigation();
  const {
    sosSize, fontSize, reduceMotion, colorBlindMode,
    shakeInBackground, darkMode,
  } = useUser();

  const [devicesModalVisible, setDevicesModalVisible] = useState(false);
  const [deviceCount, setDeviceCount]                 = useState(0);
  const [bluetoothEnabled, setBluetoothEnabled]       = useState(false);
  const [wifiEnabled, setWifiEnabled]                 = useState(false);
  const [wifiDirectEnabled, setWifiDirectEnabled]     = useState(false);
  const [appState, setAppState]                       = useState(AppState.currentState);
  const [userLocation, setUserLocation]               = useState(null);

  const notifGranted = PermissionManager.getResults().notifications;

  const ring1    = useRef(new Animated.Value(1)).current;
  const ring2    = useRef(new Animated.Value(1)).current;
  const ring3    = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.4)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.15)).current;

  const lastShake       = useRef(0);
  const hasPrompted     = useRef(false);
  const appStateRef     = useRef(AppState.currentState);
  const userLocationRef = useRef(null);

  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  const shakeInBackgroundRef = useRef(shakeInBackground);
  useEffect(() => { shakeInBackgroundRef.current = shakeInBackground; }, [shakeInBackground]);

  const bg                = darkMode ? '#111'    : '#faf5f5';
  const textColor         = darkMode ? '#fff'    : '#333';
  const titleColor        = darkMode ? '#fff'    : '#1a1a1a';
  const subColor          = darkMode ? '#888'    : '#888';
  const shakeTagBg        = darkMode
    ? (colorBlindMode ? '#2a1e0a' : '#2a1010')
    : (colorBlindMode ? '#FFF3E0' : '#fff0f0');
  const sosColor          = colorBlindMode ? '#E87722' : '#d64045';
  const ringColor         = colorBlindMode ? '#E87722' : '#e8424a';
  const devicesCountColor = colorBlindMode ? '#E87722' : '#d64045';

  // ── Location ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const granted = await PermissionManager.isLocationGranted();
      if (!granted) return;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch (e) {
        console.log('HomeScreen initial location error:', e);
      }
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 10000 },
        (l) => setUserLocation({ lat: l.coords.latitude, lng: l.coords.longitude })
      );
    })();
  }, []);

  // ── Bluetooth polling ─────────────────────────────────────────────────────
  useEffect(() => {
    const checkBT = async () => {
      if (!BluetoothModule) return;
      try {
        const isEnabled = await BluetoothModule.isBluetoothEnabled();
        setBluetoothEnabled(isEnabled);
        connectionManager.setBluetoothEnabled(isEnabled);
      } catch (e) {}
    };
    checkBT();
    const interval = setInterval(checkBT, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    initializeConnections();
    return () => connectionManager.removeListener(handleDevicesUpdate);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      appStateRef.current = nextAppState;
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        if (BluetoothModule) {
          try {
            const isEnabled = await BluetoothModule.isBluetoothEnabled();
            setBluetoothEnabled(isEnabled);
            connectionManager.setBluetoothEnabled(isEnabled);
          } catch (e) {}
        }
        connectionManager.checkWifiState();
        syncStats();
      }
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, [appState]);

  const syncStats = () => {
    const stats = connectionManager.getStats();
    setWifiEnabled(stats.wifiEnabled);
    setWifiDirectEnabled(stats.wifiDirectEnabled);
  };

  // ── Permissions already handled by PermissionManager in App.js ───────────
  // We skip requestPermissions() here — just initialize and start scanning
  const initializeConnections = async () => {
    await connectionManager.initialize();

    let currentBT = false;
    if (BluetoothModule) {
      try {
        currentBT = await BluetoothModule.isBluetoothEnabled();
        setBluetoothEnabled(currentBT);
      } catch (e) {}
    }

    syncStats();
    connectionManager.addListener(handleDevicesUpdate);
    connectionManager.startScanning();

    if (!hasPrompted.current) {
      hasPrompted.current = true;
      setTimeout(() => {
        const stats = connectionManager.getStats();
        checkAndPromptConnectivity(currentBT, stats.wifiEnabled, stats.wifiDirectEnabled);
      }, 1500);
    }
  };

  const checkAndPromptConnectivity = (bluetooth, wifi, wifiDirect) => {
    if (!bluetooth) {
      Alert.alert(
        '🔵 Enable Bluetooth',
        'Bluetooth is required to create the emergency mesh network.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Enable Bluetooth', onPress: openBluetoothSettings },
        ]
      );
    } else if (!wifi && !wifiDirect) {
      Alert.alert(
        '📶 Enable WiFi',
        'WiFi or WiFi Direct extends the range of your mesh network.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.sendIntent('android.settings.WIFI_SETTINGS') },
        ]
      );
    }
  };

  const openBluetoothSettings = async () => {
    if (!BluetoothModule) { Alert.alert('Error', 'Bluetooth module not available'); return; }
    try {
      await BluetoothModule.enableBluetooth();
      const isEnabled = await BluetoothModule.isBluetoothEnabled();
      setBluetoothEnabled(isEnabled);
      if (isEnabled) {
        connectionManager.setBluetoothEnabled(true);
        Alert.alert('✅ Success', 'Bluetooth is now enabled!');
      }
    } catch (error) {
      Alert.alert(
        'Enable Bluetooth',
        'Please turn on Bluetooth in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: async () => { try { await BluetoothModule.openBluetoothSettings(); } catch (e) {} } },
        ]
      );
    }
  };

  const openWiFiSettings = () => {
    if (Platform.OS === 'android') Linking.sendIntent('android.settings.WIFI_SETTINGS');
  };

  const handleDevicesUpdate = (devices) => { setDeviceCount(devices.length); syncStats(); };

  // ── Pulse animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (reduceMotion) return;
    const pulse = (scale, opacity, delay) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.6, duration: 1800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,   duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ]));
    const a1 = pulse(ring1, opacity1, 0);
    const a2 = pulse(ring2, opacity2, 400);
    const a3 = pulse(ring3, opacity3, 800);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [reduceMotion]);

  // ── Core SOS send ─────────────────────────────────────────────────────────
  const autoSendSOS = useCallback(() => {
    Vibration.vibrate([0, 300, 100, 300, 100, 300]);
    const loc = userLocationRef.current;

    connectionManager.sendMessage({
      message:   DEFAULT_SOS_MESSAGE,
      target:    'authority',
      timestamp: Date.now(),
      latitude:  loc?.lat ?? null,
      longitude: loc?.lng ?? null,
    });

    connectionManager.sendMessage({
      message:   DEFAULT_SOS_MESSAGE,
      target:    'local',
      timestamp: Date.now(),
      latitude:  loc?.lat ?? null,
      longitude: loc?.lng ?? null,
    });

    if (appStateRef.current === 'active') {
      Alert.alert(
        '🚨 SOS Sent',
        `"${DEFAULT_SOS_MESSAGE}" has been sent to authorities and nearby users via the mesh network.`,
        [
          {
            text: 'View on Map',
            onPress: () => navigation.navigate('EmergencyMap', {
              userLocation: userLocationRef.current,
              messages: [{
                id:        Date.now().toString(),
                name:      'You',
                message:   DEFAULT_SOS_MESSAGE,
                distance:  '0m',
                time:      'Just now',
                hops:      0,
                signal:    5,
                delivered: true,
                latitude:  loc?.lat ?? -22.5763,
                longitude: loc?.lng ?? 27.1322,
              }],
            }),
          },
          { text: 'OK' },
        ]
      );
    }
  }, []);

  // ── Notification tap handler ──────────────────────────────────────────────
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.shake_sos_triggered) autoSendSOS();
    });
    return () => subscription.remove();
  }, [autoSendSOS]);

  // ── Foreground shake ──────────────────────────────────────────────────────
  useEffect(() => {
    Accelerometer.setUpdateInterval(200);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (appStateRef.current !== 'active') return;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - lastShake.current > SHAKE_COOLDOWN) {
        lastShake.current = now;
        autoSendSOS();
      }
    });
    return () => subscription.remove();
  }, [autoSendSOS]);

  // ── Background shake ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ShakeModule || !shakeEmitter) return;
    let subscription = null;
    if (shakeInBackground) {
      ShakeModule.startBackgroundShake();
      subscription = shakeEmitter.addListener('ShakeDetected', () => {
        const now = Date.now();
        if (now - lastShake.current > SHAKE_COOLDOWN) {
          lastShake.current = now;
          autoSendSOS();
        }
      });
    } else {
      ShakeModule.stopBackgroundShake();
    }
    return () => { if (subscription) subscription.remove(); };
  }, [shakeInBackground, autoSendSOS]);

  const meshLimited    = !bluetoothEnabled || (!wifiEnabled && !wifiDirectEnabled);
  const showNotifBanner = shakeInBackground && !notifGranted;

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingHorizontal: 20 }}>

      <View style={{ marginTop: 60 }}>
        <TouchableOpacity
          onPress={() => setDevicesModalVisible(true)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={{ color: textColor, fontSize: 18 * fontSize, fontWeight: '500' }}>Devices Connected:</Text>
          <Text style={{ color: devicesCountColor, fontSize: 18 * fontSize, fontWeight: '700' }}>{deviceCount}</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity
            onPress={!bluetoothEnabled ? openBluetoothSettings : null}
            activeOpacity={bluetoothEnabled ? 1 : 0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bluetoothEnabled ? '#E3F2FD' : '#FFEBEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 10 }}>{bluetoothEnabled ? '🔵' : '⚪'}</Text>
            <Text style={{ fontSize: 10 * fontSize, color: bluetoothEnabled ? '#1976D2' : '#C62828' }}>
              Bluetooth {!bluetoothEnabled && '(Tap to enable)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={!wifiDirectEnabled ? openWiFiSettings : null}
            activeOpacity={wifiDirectEnabled ? 1 : 0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: wifiDirectEnabled ? '#E8F5E9' : '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 10 }}>{wifiDirectEnabled ? '📶' : '📴'}</Text>
            <Text style={{ fontSize: 10 * fontSize, color: wifiDirectEnabled ? '#388E3C' : '#F57C00' }}>
              WiFi Direct {!wifiDirectEnabled && '(tap to enable)'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: shakeTagBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 10 }}>📳</Text>
            <Text style={{ fontSize: 10 * fontSize, color: sosColor, fontWeight: '600' }}>
              Shake SOS {shakeInBackground ? '(+ background)' : '(foreground only)'}
            </Text>
          </View>
        </View>
      </View>

      {showNotifBanner && (
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          activeOpacity={0.8}
          style={{ marginTop: 10, backgroundColor: darkMode ? '#2a1a00' : '#FFF3E0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#FF6F00' }}
        >
          <Text style={{ fontSize: 13 * fontSize, color: '#E65100', fontWeight: '700' }}>🔔 Notifications are off</Text>
          <Text style={{ fontSize: 11 * fontSize, color: '#E65100', marginTop: 2 }}>
            Background shake-to-SOS needs notifications. Tap to open Settings.
          </Text>
        </TouchableOpacity>
      )}

      {meshLimited && (
        <TouchableOpacity
          onPress={() => checkAndPromptConnectivity(bluetoothEnabled, wifiEnabled, wifiDirectEnabled)}
          activeOpacity={0.8}
          style={{ marginTop: 10, backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#F57C00' }}
        >
          <Text style={{ fontSize: 13 * fontSize, color: '#E65100', fontWeight: '600' }}>
            ⚠️ Mesh network limited —{' '}
            {!bluetoothEnabled && 'Bluetooth'}
            {!bluetoothEnabled && !wifiDirectEnabled && ' and '}
            {!wifiDirectEnabled && 'WiFi Direct'} disabled
          </Text>
          <Text style={{ fontSize: 11 * fontSize, color: '#E65100', marginTop: 2 }}>Tap to enable for full coverage</Text>
        </TouchableOpacity>
      )}

      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ fontSize: 28 * fontSize, fontWeight: '700', color: titleColor, letterSpacing: 0.5 }}>
          Do you need help?
        </Text>
      </View>
      <Text style={{ marginTop: 6, fontSize: 14 * fontSize, color: subColor, textAlign: 'center' }}>
        Press or shake to alert authorities and nearby users instantly
      </Text>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {!reduceMotion && [ring3, ring2, ring1].map((ring, i) => {
          const opacities = [opacity3, opacity2, opacity1];
          return (
            <Animated.View key={i} style={{
              position: 'absolute', width: sosSize, height: sosSize,
              borderRadius: sosSize / 2, backgroundColor: ringColor,
              opacity: opacities[i], transform: [{ scale: [ring3, ring2, ring1][i] }],
            }} />
          );
        })}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('EmergencyMessage')}
          style={{
            width: sosSize, height: sosSize, borderRadius: sosSize / 2,
            backgroundColor: sosColor, justifyContent: 'center', alignItems: 'center',
            shadowColor: sosColor, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
          }}
        >
          <Text style={{ color: 'white', fontSize: sosSize * 0.18, fontWeight: 'bold', letterSpacing: 3 }}>
            SOS
          </Text>
        </TouchableOpacity>
      </View>

      {darkMode && (
        <View style={{ alignItems: 'center', paddingBottom: 20 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#333' }} />
        </View>
      )}

      <DevicesModal visible={devicesModalVisible} onClose={() => setDevicesModalVisible(false)} />
    </View>
  );
}