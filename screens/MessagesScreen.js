import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import * as Location from 'expo-location';
import messageService from '../services/MessageService';
import { MAX_TTL } from '../services/MeshMessagePayload';

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const m = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

function formatTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10)    return 'just now';
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function packetToMessage(packet, userLoc) {
  const hops = Math.max(1, MAX_TTL - packet.ttl);
  const hasLocation = packet.lat != null && packet.lon != null;
  return {
    id:        packet.id,
    name:      packet.sid || 'Unknown',
    message:   packet.msg,
    distance:  (hasLocation && userLoc)
      ? haversineDistance(userLoc.lat, userLoc.lng, packet.lat, packet.lon)
      : '?',
    ts:        packet.ts,
    hops,
    signal:    Math.max(1, Math.min(5, 6 - hops)),
    delivered: false,
    latitude:  packet.lat,
    longitude: packet.lon,
    isMine:    packet._isMine || false,
  };
}

// ── Components ────────────────────────────────────────────────────────────────

function SignalBars({ strength, darkMode }) {
  return (
    <View style={styles.signalBars}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <View
          key={bar}
          style={[
            styles.bar,
            {
              backgroundColor:
                bar <= strength
                  ? darkMode ? '#aaa' : '#555'
                  : darkMode ? '#444' : '#ddd',
            },
          ]}
        />
      ))}
    </View>
  );
}

function MessageCard({ msg, onPress, onMapPress, fontSize, darkMode }) {
  const cardBg    = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff'    : '#1a1a1a';
  const subColor  = darkMode ? '#888'    : '#aaa';
  const bodyColor = darkMode ? '#ccc'    : '#444';
  const actionBg  = darkMode ? '#2a2a2a' : '#f2f2f2';
  const actionText = darkMode ? '#ddd'   : '#333';

  const hasLocation = msg.latitude != null && msg.longitude != null;
  const accentColor = msg.isMine ? '#22c55e' : '#d64045';

  const statusText = msg.isMine
    ? (msg.delivered ? '✅ DELIVERED' : '📡 BROADCASTING...')
    : `⏳ RELAYING · ${msg.hops} hop${msg.hops !== 1 ? 's' : ''}`;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderLeftColor: accentColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={[styles.cardName, { fontSize: 15 * fontSize, color: textColor }]}>
            {msg.isMine ? '📤 You' : `🚨 ${msg.name}`}
          </Text>
          {!msg.isMine && <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />}
        </View>
        <Text style={[styles.cardMeta, { fontSize: 11 * fontSize, color: subColor }]}>
          {hasLocation ? `📍 ${msg.distance} · ` : ''}{formatTime(msg.ts)}
        </Text>
      </View>

      <Text style={[styles.cardMessage, { fontSize: 13 * fontSize, color: bodyColor }]}>
        "{msg.message}"
      </Text>

      <View style={styles.cardFooter}>
        <Text style={[styles.cardStatus, { fontSize: 11 * fontSize, color: msg.isMine && msg.delivered ? '#22c55e' : subColor }]}>
          {statusText}
        </Text>
        {!msg.isMine && <SignalBars strength={msg.signal} darkMode={darkMode} />}
      </View>

      <View style={styles.cardActions}>
        {hasLocation && (
          <TouchableOpacity style={[styles.actionBtnRed, { backgroundColor: accentColor }]} onPress={onMapPress}>
            <Text style={[styles.actionBtnTextWhite, { fontSize: 12 * fontSize }]}>
              📍 VIEW LOCATION
            </Text>
          </TouchableOpacity>
        )}
        {!msg.isMine && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBg }]} onPress={onPress}>
            <Text style={[styles.actionBtnText, { fontSize: 12 * fontSize, color: actionText }]}>
              💬 Details
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ fontSize, darkMode }) {
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor  = darkMode ? '#888' : '#999';
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📡</Text>
      <Text style={[styles.emptyTitle, { fontSize: 20 * fontSize, color: textColor }]}>
        No messages yet
      </Text>
      <Text style={[styles.emptySubtitle, { fontSize: 14 * fontSize, color: subColor }]}>
        Your mesh network is active and{'\n'}listening for nearby devices.
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const navigation = useNavigation();
  const { fontSize, darkMode } = useUser();

  const [messages, setMessages] = useState([]);
  const [, setTick] = useState(0); // triggers re-render to refresh "X min ago"
  const userLocRef = useRef(null);

  // ── Location (for distance calculation) ────────────────────────────────────
  useEffect(() => {
    let sub = null;

    const startLocation = async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          userLocRef.current = { lat: last.coords.latitude, lng: last.coords.longitude };
        }
      } catch (e) {}

      try {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            userLocRef.current = loc;
            // Recalculate distances for all existing messages
            setMessages(prev =>
              prev.map(m =>
                m.latitude != null && m.longitude != null
                  ? { ...m, distance: haversineDistance(loc.lat, loc.lng, m.latitude, m.longitude) }
                  : m
              )
            );
          }
        );
      } catch (e) {}
    };

    startLocation();
    return () => sub?.remove();
  }, []);

  // ── MessageService listener ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (packet) => {
      setMessages(prev => {
        if (prev.find(m => m.id === packet.id)) return prev; // deduplicate
        return [packetToMessage(packet, userLocRef.current), ...prev];
      });
    };

    const ackHandler = (messageId) => {
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, delivered: true } : m)
      );
    };

    messageService.addListener(handler);
    messageService.addAckListener(ackHandler);
    return () => {
      messageService.removeListener(handler);
      messageService.removeAckListener(ackHandler);
    };
  }, []);

  // ── Refresh "X min ago" every 30 seconds ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const openMap = (singleMsg = null) => {
    navigation.navigate('EmergencyMap', {
      messages: singleMsg ? [singleMsg] : messages,
    });
  };

  const bg       = darkMode ? '#111'  : '#faf5f5';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor  = darkMode ? '#666' : '#999';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontSize: 26 * fontSize, color: textColor }]}>
          Messages
        </Text>
        {messages.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{messages.length}</Text>
          </View>
        )}
      </View>

      {messages.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {(() => {
            const sent     = messages.filter(m => m.isMine);
            const received = messages.filter(m => !m.isMine);
            return (
              <>
                {received.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { fontSize: 12 * fontSize, color: subColor }]}>
                      🔴 RECEIVED ({received.length})
                    </Text>
                    {received.map((msg) => (
                      <MessageCard
                        key={msg.id}
                        msg={msg}
                        fontSize={fontSize}
                        darkMode={darkMode}
                        onPress={() =>
                          navigation.navigate('Chat', { name: msg.name, distance: msg.distance })
                        }
                        onMapPress={() => openMap(msg)}
                      />
                    ))}
                  </>
                )}
                {sent.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { fontSize: 12 * fontSize, color: subColor, marginTop: received.length > 0 ? 16 : 12 }]}>
                      🟢 SENT BY YOU ({sent.length})
                    </Text>
                    {sent.map((msg) => (
                      <MessageCard
                        key={msg.id}
                        msg={msg}
                        fontSize={fontSize}
                        darkMode={darkMode}
                        onPress={() => {}}
                        onMapPress={() => openMap(msg)}
                      />
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </ScrollView>
      ) : (
        <EmptyState fontSize={fontSize} darkMode={darkMode} />
      )}

      {/* Map FAB — shows all messages with location */}
      <TouchableOpacity
        style={styles.mapButton}
        onPress={() => openMap()}
        activeOpacity={0.8}
      >
        <Text style={styles.mapButtonIcon}>🗺️</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerTitle: { fontWeight: '700' },
  badge: {
    backgroundColor: '#d64045',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },
  sectionLabel: {
    fontWeight: '700', letterSpacing: 1,
    marginTop: 12, marginBottom: 8, marginLeft: 4,
  },
  card: {
    borderRadius: 16, padding: 14, marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d64045' },
  cardMeta: {},
  cardMessage: { lineHeight: 19, marginBottom: 8, fontStyle: 'italic' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  cardStatus: { fontWeight: '500' },
  signalBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 4, height: 10, borderRadius: 2 },
  cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  actionBtnRed: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#d64045',
  },
  actionBtnText: { fontWeight: '600' },
  actionBtnTextWhite: { color: '#fff', fontWeight: '600' },
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 52, marginBottom: 20 },
  emptyTitle: { fontWeight: '700', marginBottom: 10 },
  emptySubtitle: { textAlign: 'center', lineHeight: 22 },
  mapButton: {
    position: 'absolute', bottom: 80, left: 20,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#d64045',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 8, zIndex: 999,
  },
  mapButtonIcon: { fontSize: 28 },
});
