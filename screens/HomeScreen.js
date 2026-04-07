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
import messageService from '../services/MessageService';

const SHAKE_THRESHOLD     = 2.5;
const SHAKE_COOLDOWN      = 3000;
const DEFAULT_SOS_MESSAGE = 'Help me!!!';

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
  const [connectedCount, setConnectedCount]           = useState(0);
  const [bluetoothEnabled, setBluetoothEnabled]       = useState(false);
  const [wifiEnabled, setWifiEnabled]                 = useState(false);
  const [wifiDirectEnabled, setWifiDirectEnabled]     = useState(false);
  const [appState, setAppState]                       = useState(AppState.currentState);
  const [userLocation, setUserLocation]               = useState(null);
  const [debugVisible, setDebugVisible]               = useState(false);
  const [debugInfo, setDebugInfo]                     = useState(null);

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

  // Refresh debug panel every 2 seconds when visible
  useEffect(() => {
    if (!debugVisible) return;
    refreshDebug();
    const interval = setInterval(refreshDebug, 2000);
    return () => clearInterval(interval);
  }, [debugVisible]);

  useEffect(() => {
    initializeConnections();

    const onAck = () => {
      Alert.alert(
        '✅ SOS Delivered',
        'A nearby device confirmed receiving your SOS message.',
        [{ text: 'OK' }]
      );
    };
    messageService.addAckListener(onAck);

    return () => {
      connectionManager.removeListener(handleDevicesUpdate);
      messageService.removeAckListener(onAck);
    };
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

  const handleDevicesUpdate = (devices) => {
    setDeviceCount(devices.length);
    setConnectedCount(devices.filter(d => d.isConnected).length);
    syncStats();
  };

  const refreshDebug = () => {
    try {
      setDebugInfo(connectionManager.getDebugInfo());
    } catch (e) {}
  };

  const sendTestMessage = async () => {
    console.log('════════════════════════════════');
    console.log('🧪 [DEBUG] sendTestMessage() TRIGGERED FROM DEBUG PANEL');
    const info = connectionManager.getDebugInfo();
    console.log('🧪 [DEBUG] connectedCount:', info.connectedCount);
    console.log('🧪 [DEBUG] knownCount:', info.knownCount);
    console.log('🧪 [DEBUG] devices:', JSON.stringify(info.devices));
    try {
      const packet = await messageService.sendSOS('DEBUG_TEST_MESSAGE', 'local');
      console.log('🧪 [DEBUG] sendSOS returned packet:', JSON.stringify(packet));
      Alert.alert('Debug Send', `sendSOS() called. Check logs for write result.\nPacket ID: ${packet?.id || 'none'}`);
    } catch (e) {
      console.error('🧪 [DEBUG] sendSOS threw:', e.message);
      Alert.alert('Debug Send Error', e.message);
    }
    console.log('════════════════════════════════');
  };

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

    // Use messageService.sendSOS so the packet goes through the full pipeline:
    // createPacket (UUID, TTL, GPS fetch) → encode → BLE broadcast → mesh relay
    messageService.sendSOS(DEFAULT_SOS_MESSAGE, 'local').then((packet) => {
      if (appStateRef.current === 'active') {
        Alert.alert(
          '🚨 SOS Sent',
          `"${DEFAULT_SOS_MESSAGE}" has been broadcast to nearby devices via the mesh network.`,
          [
            {
              text: 'View on Map',
              onPress: () => navigation.navigate('EmergencyMap', {
                userLocation: userLocationRef.current,
                messages: packet ? [{
                  id:        packet.id,
                  name:      'You',
                  message:   packet.msg,
                  distance:  '0m',
                  ts:        packet.ts,
                  hops:      0,
                  signal:    5,
                  delivered: true,
                  latitude:  packet.lat,
                  longitude: packet.lon,
                }] : [],
              }),
            },
            { text: 'OK' },
          ]
        );
      }
    }).catch(() => {});
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
          <Text style={{ color: devicesCountColor, fontSize: 18 * fontSize, fontWeight: '700' }}>
            {connectedCount}
            {deviceCount > connectedCount ? ` (${deviceCount} in range)` : ''}
          </Text>
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

          {/* Debug toggle */}
          <TouchableOpacity
            onPress={() => { setDebugVisible(v => !v); if (!debugVisible) refreshDebug(); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: darkMode ? '#1a1a1a' : '#f0f0f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 10 }}>🔧</Text>
            <Text style={{ fontSize: 10 * fontSize, color: darkMode ? '#aaa' : '#555' }}>
              Debug {debugVisible ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Debug panel */}
        {debugVisible && (
          <View style={{ marginTop: 8, backgroundColor: darkMode ? '#111' : '#f8f8f8', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: darkMode ? '#333' : '#ddd' }}>
            {debugInfo ? (
              <>
                <Text style={{ fontSize: 11, fontFamily: 'monospace', color: darkMode ? '#0f0' : '#060', fontWeight: '700', marginBottom: 4 }}>
                  BLE DEBUG
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'monospace', color: darkMode ? '#ccc' : '#333', lineHeight: 16 }}>
                  {'Name:     '}{debugInfo.deviceName}{'\n'}
                  {'BT On:    '}{debugInfo.isBluetoothOn ? '✅' : '❌'}{'  GATT:  '}{debugInfo.gattServerRunning ? '✅' : '❌'}{'\n'}
                  {'Scanning: '}{debugInfo.isScanning ? '✅' : '❌'}{'  Advert: '}{debugInfo.isAdvertising ? '✅' : '❌'}{'\n'}
                  {'In Range: '}{debugInfo.knownCount}{'  Connected: '}{debugInfo.connectedCount}{'  Connecting: '}{debugInfo.connectingCount}{'\n'}
                  {'PendingBackConn: '}{debugInfo.pendingBackConnect}{'  QueuedMsgs: '}{debugInfo.queuedMessages}
                </Text>
                {debugInfo.devices.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'monospace', color: darkMode ? '#aaa' : '#555', fontWeight: '700' }}>Peers:</Text>
                    {debugInfo.devices.map((d, i) => (
                      <Text key={i} style={{ fontSize: 10, fontFamily: 'monospace', color: d.connected ? (darkMode ? '#0f0' : '#060') : (darkMode ? '#f80' : '#a60'), lineHeight: 15 }}>
                        {d.connected ? '●' : '○'} {d.name}{'\n'}
                        {'  scan mac: '}{d.mac}  rssi:{d.rssi}  {d.lastSeen}s ago{'\n'}
                        {'  conn mac: '}{d.connMac || '(not connected)'}
                        {d.connected && d.mac !== d.connMac ? ' ⚠️STALE' : ''}
                      </Text>
                    ))}
                  </View>
                )}
                {debugInfo.devices.length === 0 && (
                  <Text style={{ fontSize: 10, fontFamily: 'monospace', color: darkMode ? '#666' : '#999', marginTop: 4 }}>
                    No peers discovered yet
                  </Text>
                )}

                {/* Test send button */}
                <TouchableOpacity
                  onPress={sendTestMessage}
                  style={{ marginTop: 8, backgroundColor: '#d64045', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                    🧪 SEND TEST MSG ({debugInfo.connectedCount} connected)
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontSize: 10, color: darkMode ? '#666' : '#999' }}>Loading debug info...</Text>
            )}
          </View>
        )}
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