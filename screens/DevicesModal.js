import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useUser } from '../context/UserContext';
import connectionManager from '../services/ConnectionManager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_SIZE = SCREEN_WIDTH - 80;

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

  const bg = darkMode ? '#111' : '#faf5f5';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#666' : '#aaa';
  const handleBg = darkMode ? '#333' : '#ddd';
  const closeBg = darkMode ? '#222' : '#f0f0f0';
  const closeColor = darkMode ? '#fff' : '#333';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';

  useEffect(() => {
    if (!visible) return;

    updateDevices();
    connectionManager.addListener(handleDeviceUpdate);
    const interval = setInterval(updateDevices, 2000);

    return () => {
      connectionManager.removeListener(handleDeviceUpdate);
      clearInterval(interval);
    };
  }, [visible]);

  const updateDevices = () => {
    const deviceList = connectionManager.getDevices();
    const deviceStats = connectionManager.getStats();
    setDevices(deviceList);
    setStats(deviceStats);
  };

  const handleDeviceUpdate = (deviceList) => {
    setDevices(deviceList);
    setStats(connectionManager.getStats());
  };

  const getDevicePositions = () => {
    if (devices.length === 0) return [];

    const centerX = MAP_SIZE / 2;
    const centerY = MAP_SIZE / 2;
    const radius = MAP_SIZE / 3;

    return devices.map((device, index) => {
      const angle = (index * 2 * Math.PI) / devices.length;
      const distanceFactor = Math.min(device.distance / 50, 1);
      const deviceRadius = radius * distanceFactor;

      return {
        ...device,
        x: centerX + deviceRadius * Math.cos(angle),
        y: centerY + deviceRadius * Math.sin(angle),
      };
    });
  };

  const devicePositions = getDevicePositions();

  // Returns label + color for the transport badge
  const getTransportBadge = (transport) => {
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
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.card, { backgroundColor: bg }]}
          onPress={() => {}}
        >
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
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: closeBg }]}
            >
              <Text style={[styles.closeText, { color: closeColor }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Status indicators */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, {
              backgroundColor: stats.bluetoothEnabled ? '#E3F2FD' : '#FFEBEE'
            }]}>
              <Text style={{ fontSize: 12 }}>{stats.bluetoothEnabled ? '🔵' : '⚪'}</Text>
              <Text style={[styles.statusText, {
                color: stats.bluetoothEnabled ? '#1976D2' : '#C62828',
                fontSize: 11 * fontSize
              }]}>
                BLE {stats.bluetoothEnabled ? 'ON' : 'OFF'}
              </Text>
            </View>

            <View style={[styles.statusBadge, {
              backgroundColor: stats.wifiDirectEnabled ? '#E8F5E9' : '#FFF3E0'
            }]}>
              <Text style={{ fontSize: 12 }}>{stats.wifiDirectEnabled ? '📶' : '📴'}</Text>
              <Text style={[styles.statusText, {
                color: stats.wifiDirectEnabled ? '#388E3C' : '#F57C00',
                fontSize: 11 * fontSize
              }]}>
                WiFi Direct {stats.wifiDirectEnabled ? 'ON' : 'OFF'}
              </Text>
            </View>

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
                {/* Mesh map */}
                <View style={styles.mapContainer}>
                  <Svg width={MAP_SIZE} height={MAP_SIZE}>
                    {devicePositions.map((device, index) => (
                      <Line
                        key={`line-${index}`}
                        x1={MAP_SIZE / 2}
                        y1={MAP_SIZE / 2}
                        x2={device.x}
                        y2={device.y}
                        stroke={device.isConnected
                          ? (darkMode ? '#4CAF50' : '#4CAF50')
                          : (darkMode ? '#444' : '#ddd')}
                        strokeWidth={device.isConnected ? '2.5' : '1.5'}
                        strokeDasharray={device.isConnected ? '0' : '5,5'}
                      />
                    ))}

                    {devicePositions.map((device, index) => {
                      const nodeColor = device.isConnected
                        ? '#4CAF50'
                        : getSignalColor(device.rssi);

                      return (
                        <React.Fragment key={`device-${index}`}>
                          <Circle
                            cx={device.x}
                            cy={device.y}
                            r="20"
                            fill={nodeColor}
                            opacity="0.9"
                          />
                          <SvgText
                            x={device.x}
                            y={device.y + 6}
                            fontSize="16"
                            textAnchor="middle"
                          >
                            📱
                          </SvgText>
                        </React.Fragment>
                      );
                    })}

                    {/* This device */}
                    <Circle
                      cx={MAP_SIZE / 2}
                      cy={MAP_SIZE / 2}
                      r="30"
                      fill="#d64045"
                      opacity="0.9"
                    />
                    <SvgText
                      x={MAP_SIZE / 2}
                      y={MAP_SIZE / 2 + 8}
                      fontSize="24"
                      textAnchor="middle"
                    >
                      📍
                    </SvgText>
                    <SvgText
                      x={MAP_SIZE / 2}
                      y={MAP_SIZE / 2 + 45}
                      fontSize="12"
                      fill={textColor}
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      YOU
                    </SvgText>
                  </Svg>
                </View>

                {/* Device list */}
                <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontSize }]}>
                  Nearby Devices
                </Text>

                {devices.map((device, index) => {
                  const badge = getTransportBadge(device.transport);

                  return (
                    <View
                      key={device.id}
                      style={[styles.deviceCard, { backgroundColor: cardBg }]}
                    >
                      <View style={styles.deviceIcon}>
                        <Text style={{ fontSize: 24 }}>📱</Text>
                      </View>

                      <View style={styles.deviceInfo}>
                        <Text style={[styles.deviceName, {
                          color: textColor,
                          fontSize: 15 * fontSize
                        }]}>
                          {device.name || `Device ${index + 1}`}
                        </Text>

                        <View style={styles.deviceMeta}>
                          <Text style={[{ color: subColor, fontSize: 12 * fontSize }]}>
                            📍 ~{device.distance}m
                          </Text>

                          {/* Transport badge */}
                          <View style={[styles.transportBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.transportText, {
                              color: badge.color,
                              fontSize: 10 * fontSize
                            }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.deviceMeta, { marginTop: 4 }]}>
                          {/* Signal strength — only meaningful for BLE */}
                          {device.transport !== 'wifi-direct' && (
                            <Text style={[{
                              color: getSignalColor(device.rssi),
                              fontSize: 12 * fontSize,
                              fontWeight: '600'
                            }]}>
                              {getSignalStrength(device.rssi)}
                            </Text>
                          )}

                          {/* Connected badge */}
                          {device.isConnected && (
                            <View style={styles.connectedBadge}>
                              <Text style={[styles.connectedText, { fontSize: 11 * fontSize }]}>
                                🔗 Connected
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={[styles.signalDot, {
                        backgroundColor: device.isConnected
                          ? '#4CAF50'
                          : getSignalColor(device.rssi)
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

function getSignalColor(rssi) {
  if (rssi > -60) return '#4CAF50';
  if (rssi > -75) return '#FFC107';
  return '#FF5722';
}

function getSignalStrength(rssi) {
  if (rssi > -60) return '📶 Strong';
  if (rssi > -75) return '📶 Medium';
  return '📶 Weak';
}

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
    paddingBottom: 40,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    alignItems: 'center',
    marginVertical: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  deviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  transportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  transportText: {
    fontWeight: '600',
  },
  connectedBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  connectedText: {
    color: '#388E3C',
    fontWeight: '600',
  },
  signalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  },
});