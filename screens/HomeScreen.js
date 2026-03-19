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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { Accelerometer } from 'expo-sensors';
import DevicesModal from './DevicesModal';
import connectionManager from '../services/ConnectionManager';

const SHAKE_THRESHOLD = 2.5;
const SHAKE_COOLDOWN = 3000;
const DEFAULT_SOS_MESSAGE = 'Help! I need immediate assistance';

const { BluetoothModule } = NativeModules;

export default function HomeScreen() {
  const navigation = useNavigation();
  const {
    sosSize, fontSize, reduceMotion, colorBlindMode,
    shakeInBackground, setShakeInBackground, darkMode,
  } = useUser();

  const [devicesModalVisible, setDevicesModalVisible] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [wifiEnabled, setWifiEnabled] = useState(false);
  const [wifiDirectEnabled, setWifiDirectEnabled] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring3 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.4)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.15)).current;
  const lastShake = useRef(0);
  const hasPrompted = useRef(false);

  // We keep a ref to shakeInBackground so the accelerometer callback
  // always reads the latest value without restarting the listener
  const shakeInBackgroundRef = useRef(shakeInBackground);
  useEffect(() => {
    shakeInBackgroundRef.current = shakeInBackground;
  }, [shakeInBackground]);

  const appStateRef = useRef(AppState.currentState);

  const bg = darkMode ? '#111' : '#faf5f5';
  const textColor = darkMode ? '#fff' : '#333';
  const titleColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#888';
  const shakeTagBg = darkMode
    ? (colorBlindMode ? '#2a1e0a' : '#2a1010')
    : (colorBlindMode ? '#FFF3E0' : '#fff0f0');
  const sosColor = colorBlindMode ? '#E87722' : '#d64045';
  const ringColor = colorBlindMode ? '#E87722' : '#e8424a';
  const devicesCountColor = colorBlindMode ? '#E87722' : '#d64045';

  // ── Bluetooth polling ────────────────────────────────────────────────────
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

  const initializeConnections = async () => {
    const hasPermissions = await connectionManager.requestPermissions();
    if (!hasPermissions) {
      Alert.alert(
        'Permissions Required',
        'This app needs Bluetooth and Location permissions to create a mesh network for emergencies.',
        [{ text: 'OK' }]
      );
    }
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
        'Bluetooth is required to connect with nearby devices and create the emergency mesh network.',
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
    if (!BluetoothModule) {
      Alert.alert('Error', 'Bluetooth module not available');
      return;
    }
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
          {
            text: 'Open Settings',
            onPress: async () => {
              try { await BluetoothModule.openBluetoothSettings(); } catch (e) {}
            },
          },
        ]
      );
    }
  };

  const openWiFiSettings = () => {
    if (Platform.OS === 'android') Linking.sendIntent('android.settings.WIFI_SETTINGS');
  };

  const handleDevicesUpdate = (devices) => {
    setDeviceCount(devices.length);
    syncStats();
  };

  // ── Pulse animation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (reduceMotion) return;
    const pulse = (scale, opacity, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.6, duration: 1800, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
    const a1 = pulse(ring1, opacity1, 0);
    const a2 = pulse(ring2, opacity2, 400);
    const a3 = pulse(ring3, opacity3, 800);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [reduceMotion]);

  // ── Auto-send SOS via mesh ───────────────────────────────────────────────
  const autoSendSOS = useCallback(() => {
    Vibration.vibrate([0, 300, 100, 300, 100, 300]);
    // Send default message directly to authority through mesh
    connectionManager.sendMessage({
      message: DEFAULT_SOS_MESSAGE,
      target: 'authority',
      timestamp: Date.now(),
    });
    // Show a non-blocking heads-up when app is in foreground
    if (appStateRef.current === 'active') {
      Alert.alert(
        '🚨 SOS Sent',
        `"${DEFAULT_SOS_MESSAGE}" has been sent to authorities via the mesh network.`,
        [{ text: 'OK' }]
      );
    }
  }, []);

  // ── Shake detection — always active, background respects toggle ──────────
  // The accelerometer runs continuously. When the app is in the foreground
  // shake always triggers. When in the background/inactive it only triggers
  // if the user has enabled "Shake in Background" in Controls.
  useEffect(() => {
    Accelerometer.setUpdateInterval(200);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > SHAKE_THRESHOLD && now - lastShake.current > SHAKE_COOLDOWN) {
        const currentAppState = appStateRef.current;
        const isBackground = currentAppState === 'background' || currentAppState === 'inactive';

        // Block background shake if toggle is off
        if (isBackground && !shakeInBackgroundRef.current) return;

        lastShake.current = now;
        autoSendSOS();
      }
    });

    return () => subscription.remove();
  }, [autoSendSOS]); // only restarts if autoSendSOS reference changes

  const meshLimited = !bluetoothEnabled || (!wifiEnabled && !wifiDirectEnabled);

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingHorizontal: 20 }}>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <View style={{ marginTop: 60 }}>
        <TouchableOpacity
          onPress={() => setDevicesModalVisible(true)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={{ color: textColor, fontSize: 18 * fontSize, fontWeight: '500' }}>
            Devices Connected:
          </Text>
          <Text style={{ color: devicesCountColor, fontSize: 18 * fontSize, fontWeight: '700' }}>
            {deviceCount}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {/* Bluetooth */}
          <TouchableOpacity
            onPress={!bluetoothEnabled ? openBluetoothSettings : null}
            activeOpacity={bluetoothEnabled ? 1 : 0.7}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: bluetoothEnabled ? '#E3F2FD' : '#FFEBEE',
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 10 }}>{bluetoothEnabled ? '🔵' : '⚪'}</Text>
            <Text style={{ fontSize: 10 * fontSize, color: bluetoothEnabled ? '#1976D2' : '#C62828' }}>
              Bluetooth {!bluetoothEnabled && '(Tap to enable)'}
            </Text>
          </TouchableOpacity>

          {/* WiFi Direct */}
          <TouchableOpacity
            onPress={!wifiDirectEnabled ? openWiFiSettings : null}
            activeOpacity={wifiDirectEnabled ? 1 : 0.7}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: wifiDirectEnabled ? '#E8F5E9' : '#FFF3E0',
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 10 }}>{wifiDirectEnabled ? '📶' : '📴'}</Text>
            <Text style={{ fontSize: 10 * fontSize, color: wifiDirectEnabled ? '#388E3C' : '#F57C00' }}>
              WiFi Direct {!wifiDirectEnabled && '(tap to enable)'}
            </Text>
          </TouchableOpacity>

          {/* Shake always-on indicator */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: shakeTagBg,
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
          }}>
            <Text style={{ fontSize: 10 }}>📳</Text>
            <Text style={{ fontSize: 10 * fontSize, color: sosColor, fontWeight: '600' }}>
              Shake to SOS {shakeInBackground ? '(+ background)' : '(foreground only)'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Mesh limited warning ────────────────────────────────────────── */}
      {meshLimited && (
        <TouchableOpacity
          onPress={() => checkAndPromptConnectivity(bluetoothEnabled, wifiEnabled, wifiDirectEnabled)}
          activeOpacity={0.8}
          style={{
            marginTop: 12,
            backgroundColor: '#FFF3E0',
            paddingHorizontal: 12, paddingVertical: 10,
            borderRadius: 12,
            borderLeftWidth: 4, borderLeftColor: '#F57C00',
          }}
        >
          <Text style={{ fontSize: 13 * fontSize, color: '#E65100', fontWeight: '600' }}>
            ⚠️ Mesh network limited —{' '}
            {!bluetoothEnabled && 'Bluetooth'}
            {!bluetoothEnabled && !wifiDirectEnabled && ' and '}
            {!wifiDirectEnabled && 'WiFi Direct'} disabled
          </Text>
          <Text style={{ fontSize: 11 * fontSize, color: '#E65100', marginTop: 2 }}>
            Tap to enable for full coverage
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Heading ────────────────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ fontSize: 28 * fontSize, fontWeight: '700', color: titleColor, letterSpacing: 0.5 }}>
          Do you need help?
        </Text>
      </View>
      <Text style={{ marginTop: 6, fontSize: 14 * fontSize, color: subColor, textAlign: 'center' }}>
        Press or shake to alert authorities and nearby devices instantly
      </Text>

      {/* ── SOS Button ─────────────────────────────────────────────────── */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {!reduceMotion && [ring3, ring2, ring1].map((ring, i) => {
          const opacities = [opacity3, opacity2, opacity1];
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                width: sosSize, height: sosSize,
                borderRadius: sosSize / 2,
                backgroundColor: ringColor,
                opacity: opacities[i],
                transform: [{ scale: [ring3, ring2, ring1][i] }],
              }}
            />
          );
        })}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('EmergencyMessage')}
          style={{
            width: sosSize, height: sosSize,
            borderRadius: sosSize / 2,
            backgroundColor: sosColor,
            justifyContent: 'center', alignItems: 'center',
            shadowColor: sosColor,
            shadowOffset: { width: 0, height: 6 },
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

      <DevicesModal
        visible={devicesModalVisible}
        onClose={() => setDevicesModalVisible(false)}
      />
    </View>
  );
}