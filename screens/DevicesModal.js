import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useUser } from '../context/UserContext';
import connectionManager from '../services/ConnectionManager';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSignalColor(rssi) {
  if (!rssi || rssi === 0) return '#9E9E9E';
  if (rssi > -60) return '#4CAF50';
  if (rssi > -75) return '#FFC107';
  return '#FF5722';
}

function getSignalStrength(rssi) {
  if (!rssi || rssi === 0) return '📶 Unknown';
  if (rssi > -60) return '📶 Strong';
  if (rssi > -75) return '📶 Medium';
  return '📶 Weak';
}

function getTransportBadge(transport) {
  switch (transport) {
    case 'bluetooth':
      return { label: '🔵 BLE', color: '#1976D2', bg: '#E3F2FD' };
    case 'wifi-direct':
      return { label: '📶 WiFi Direct', color: '#388E3C', bg: '#E8F5E9' };
    case 'both':
      return { label: '🔵📶 BLE + WiFi', color: '#6A1B9A', bg: '#F3E5F5' };
    default:
      return { label: '❓ Unknown', color: '#888', bg: '#eee' };
  }
}

/**
 * Best-effort display name for a device.
 * Priority: name → localName → deviceName → last 8 chars of ID → "Unknown Device"
 */
function resolveDeviceName(device, index) {
  const raw =
    device.name ||
    device.localName ||
    device.deviceName ||
    device.advertisedName ||
    null;

  if (raw && raw.trim().length > 0) return raw.trim();

  // Fall back to a shortened device ID so the card isn't blank
  if (device.id) {
    const short = device.id.replace(/:/g, '').slice(-8).toUpperCase();
    return `Device …${short}`;
  }

  return `Device ${index + 1}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DevicesModal({ visible, onClose }) {
  const { darkMode, fontSize } = useUser();
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({
    totalDevices: 0,
    bluetoothEnabled: false,
    wifiEnabled: false,
    wifiDirectEnabled: false,
    isScanning: false,
  });

  const bg          = darkMode ? '#111'    : '#faf5f5';
  const textColor   = darkMode ? '#fff'    : '#1a1a1a';
  const subColor    = darkMode ? '#666'    : '#aaa';
  const handleBg    = darkMode ? '#333'    : '#ddd';
  const closeBg     = darkMode ? '#222'    : '#f0f0f0';
  const closeColor  = darkMode ? '#fff'    : '#333';
  const cardBg      = darkMode ? '#1e1e1e' : '#fff';
  const idColor     = darkMode ? '#555'    : '#ccc';

  useEffect(() => {
    if (!visible) return;
    updateDevices();
    connectionManager.addListener(handleDeviceUpdate);
    const interval = setInterval(updateDevices, 1000);
    return () => {
      connectionManager.removeListener(handleDeviceUpdate);
      clearInterval(interval);
    };
  }, [visible]);

  const updateDevices = () => {
    const deviceList  = connectionManager.getDevices();
    const deviceStats = connectionManager.getStats();
    setDevices(deviceList);
    setStats(deviceStats);
  };

  const handleDeviceUpdate = (deviceList) => {
    setDevices(deviceList);
    setStats(connectionManager.getStats());
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.card, { backgroundColor: bg }]} onPress={() => {}}>

          <View style={[styles.handle, { backgroundColor: handleBg }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: textColor, fontSize: 20 * fontSize }]}>
                Mesh Network
              </Text>
              <Text style={[styles.subtitle, { color: subColor, fontSize: 12 * fontSize }]}>
                {stats.totalDevices} {stats.totalDevices === 1 ? 'device' : 'devices'} found
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: closeBg }]}>
              <Text style={[styles.closeText, { color: closeColor }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Status badges */}
          <View style={styles.statusRow}>
            <StatusBadge
              active={stats.bluetoothEnabled}
              activeIcon="🔵" inactiveIcon="⚪"
              label={`BLE ${stats.bluetoothEnabled ? 'ON' : 'OFF'}`}
              activeColor="#1976D2" inactiveBg="#FFEBEE" activeBg="#E3F2FD"
              inactiveColor="#C62828" fontSize={fontSize}
            />
            <StatusBadge
              active={stats.wifiDirectEnabled}
              activeIcon="📶" inactiveIcon="📴"
              label={`WiFi Direct ${stats.wifiDirectEnabled ? 'ON' : 'OFF'}`}
              activeColor="#388E3C" inactiveBg="#FFF3E0" activeBg="#E8F5E9"
              inactiveColor="#F57C00" fontSize={fontSize}
            />
            {stats.isScanning && (
              <View style={[styles.statusBadge, { backgroundColor: '#FFF3E0' }]}>
                <Text style={{ fontSize: 12 }}>🔍</Text>
                <Text style={[styles.statusText, { color: '#F57C00', fontSize: 11 * fontSize }]}>
                  Scanning...
                </Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {devices.length > 0 ? (
              <>

                {/* Device list */}
                <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontSize }]}>
                  Nearby Devices
                </Text>

                {devices.map((device, index) => {
                  const badge       = getTransportBadge(device.transport);
                  const displayName = resolveDeviceName(device, index);
                  const hasDistance = device.distance != null && device.distance > 0;
                  const hasRssi     = device.rssi != null && device.rssi !== 0;

                  return (
                    <View key={device.name || index} style={[styles.deviceCard, { backgroundColor: cardBg }]}>

                      {/* Icon */}
                      <View style={styles.deviceIcon}>
                        <Text style={{ fontSize: 24 }}>📱</Text>
                      </View>

                      <View style={styles.deviceInfo}>

                        {/* Name */}
                        <Text style={[styles.deviceName, { color: textColor, fontSize: 15 * fontSize }]}>
                          {displayName}
                        </Text>

                        {/* Raw ID — subtle, helps debugging */}
                        {device.id ? (
                          <Text style={[styles.deviceId, { color: idColor, fontSize: 10 * fontSize }]}>
                            {device.id}
                          </Text>
                        ) : null}

                        {/* Distance + transport */}
                        <View style={styles.deviceMeta}>
                          {hasDistance && (
                            <Text style={{ color: subColor, fontSize: 12 * fontSize }}>
                              📍 ~{device.distance}m
                            </Text>
                          )}
                          <View style={[styles.transportBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.transportText, { color: badge.color, fontSize: 10 * fontSize }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>

                        {/* Signal + connected */}
                        <View style={[styles.deviceMeta, { marginTop: 4 }]}>
                          {device.transport !== 'wifi-direct' && hasRssi && (
                            <Text style={{ color: getSignalColor(device.rssi), fontSize: 12 * fontSize, fontWeight: '600' }}>
                              {getSignalStrength(device.rssi)}
                              <Text style={{ color: subColor, fontWeight: '400' }}> ({device.rssi} dBm)</Text>
                            </Text>
                          )}
                          {device.isConnected && (
                            <View style={styles.connectedBadge}>
                              <Text style={[styles.connectedText, { fontSize: 11 * fontSize }]}>
                                🔗 Connected
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Signal dot */}
                      <View style={[styles.signalDot, {
                        backgroundColor: device.isConnected ? '#4CAF50' : getSignalColor(device.rssi)
                      }]} />
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 64, marginBottom: 16 }}>📡</Text>
                <Text style={[styles.emptyTitle, { color: textColor, fontSize: 18 * fontSize }]}>
                  No devices found
                </Text>
                <Text style={[styles.emptyText, { color: subColor, fontSize: 14 * fontSize }]}>
                  {!stats.bluetoothEnabled && !stats.wifiDirectEnabled
                    ? 'Enable Bluetooth or WiFi to discover nearby devices'
                    : stats.isScanning
                      ? 'Scanning for nearby devices...'
                      : 'Make sure other devices have the app open'}
                </Text>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Small reusable status badge ───────────────────────────────────────────────
function StatusBadge({ active, activeIcon, inactiveIcon, label, activeColor, inactiveColor, activeBg, inactiveBg, fontSize }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: active ? activeBg : inactiveBg }]}>
      <Text style={{ fontSize: 12 }}>{active ? activeIcon : inactiveIcon}</Text>
      <Text style={[styles.statusText, { color: active ? activeColor : inactiveColor, fontSize: 11 * fontSize }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 16, marginBottom: 16,
  },
  title:    { fontWeight: '700' },
  subtitle: { marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 14, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontWeight: '600' },
  content: { flex: 1 },
  sectionTitle: { fontWeight: '700', marginTop: 8, marginBottom: 12 },
  deviceCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  deviceIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontWeight: '600', marginBottom: 2 },
  deviceId:   { marginBottom: 4, fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace' },
  deviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  transportBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  transportText:  { fontWeight: '600' },
  connectedBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  connectedText:  { color: '#388E3C', fontWeight: '600' },
  signalDot: { width: 12, height: 12, borderRadius: 6 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontWeight: '700', marginBottom: 8 },
  emptyText:  { textAlign: 'center', lineHeight: 20 },
});