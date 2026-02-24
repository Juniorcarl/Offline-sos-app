import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

const MOCK_MESSAGES = [
  {
    id: '1', name: 'Kefilwe Moyo', type: 'Medical Emergency',
    message: 'I have been in an accident, I need help urgently',
    distance: '0.3km', time: '2 min ago', read: false, hops: 2, signal: 4, priority: 'high',
  },
  {
    id: '2', name: 'Thabo Sithole', type: 'Fire Reported',
    message: 'There is a fire at the building next to me',
    distance: '0.8km', time: '5 min ago', read: false, hops: 3, signal: 3, priority: 'high',
  },
  {
    id: '3', name: 'Unknown Device', type: 'SOS Alert',
    message: 'SOS signal detected from mesh network',
    distance: '1.2km', time: '12 min ago', read: true, hops: 4, signal: 2, priority: 'medium',
  },
];

function SignalBars({ strength, darkMode }) {
  return (
    <View style={styles.signalBars}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <View key={bar} style={[styles.bar, {
          backgroundColor: bar <= strength ? (darkMode ? '#aaa' : '#555') : (darkMode ? '#444' : '#ddd'),
        }]} />
      ))}
    </View>
  );
}

function MessageCard({ msg, onPress, darkMode, fontSize }) {
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const bodyColor = darkMode ? '#ccc' : '#444';
  const actionBg = darkMode ? '#2a2a2a' : '#f2f2f2';
  const actionText = darkMode ? '#ddd' : '#333';
  const priorityColor = msg.priority === 'high' ? '#d64045' : '#f5a623';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderLeftColor: priorityColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={[styles.cardName, { fontSize: 15 * fontSize, color: textColor }]}>
            🚨 {msg.name}
          </Text>
          {!msg.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={[styles.cardMeta, { fontSize: 11 * fontSize, color: subColor }]}>
          📍 {msg.distance} · {msg.time}
        </Text>
      </View>
      <Text style={[styles.cardType, { fontSize: 12 * fontSize, color: priorityColor }]}>
        {msg.type}
      </Text>
      <Text style={[styles.cardMessage, { fontSize: 13 * fontSize, color: bodyColor }]}>
        "{msg.message}"
      </Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.cardStatus, { fontSize: 11 * fontSize, color: subColor }]}>
          {msg.read ? '✓✓ READ' : '🔴 UNREAD'} · {msg.hops} hop
        </Text>
        <SignalBars strength={msg.signal} darkMode={darkMode} />
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.respondBtn}>
          <Text style={[styles.respondBtnText, { fontSize: 12 * fontSize }]}>⚡ Respond</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBg }]}>
          <Text style={[styles.actionBtnText, { fontSize: 12 * fontSize, color: actionText }]}>📍 MAP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBg }]} onPress={onPress}>
          <Text style={[styles.actionBtnText, { fontSize: 12 * fontSize, color: actionText }]}>💬 Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBg }]}>
          <Text style={[styles.actionBtnText, { fontSize: 12 * fontSize, color: actionText }]}>✅ ACK</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function AuthorityMessages() {
  const navigation = useNavigation();
  const { darkMode, fontSize } = useUser();
  const [messages] = useState(MOCK_MESSAGES);

  const bg = darkMode ? '#111' : '#faf5f5';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#666' : '#999';
  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { fontSize: 26 * fontSize, color: textColor }]}>
            Incidents
          </Text>
          {unreadCount > 0 && (
            <Text style={[styles.unreadBadge, { fontSize: 12 * fontSize }]}>
              {unreadCount} unread
            </Text>
          )}
        </View>
        <TouchableOpacity>
          <Text style={styles.headerIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      {messages.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={[styles.sectionLabel, { fontSize: 12 * fontSize, color: subColor }]}>
            🔴 ACTIVE INCIDENTS
          </Text>
          {messages.map((msg) => (
            <MessageCard
              key={msg.id}
              msg={msg}
              darkMode={darkMode}
              fontSize={fontSize}
              onPress={() => navigation.navigate('Chat', { name: msg.name, distance: msg.distance })}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={[styles.emptyTitle, { fontSize: 20 * fontSize, color: textColor }]}>No incidents</Text>
          <Text style={[styles.emptySubtitle, { fontSize: 14 * fontSize, color: subColor }]}>
            Mesh network active and{'\n'}monitoring your area.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, paddingHorizontal: 20, marginBottom: 12 },
  headerTitle: { fontWeight: '700' },
  unreadBadge: { color: '#d64045', fontWeight: '600', marginTop: 2 },
  headerIcon: { fontSize: 20 },
  list: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },
  sectionLabel: { fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 16, padding: 14, marginBottom: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d64045' },
  cardMeta: {},
  cardType: { fontWeight: '600', marginBottom: 4 },
  cardMessage: { lineHeight: 19, marginBottom: 8, fontStyle: 'italic' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardStatus: { fontWeight: '500' },
  signalBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 4, height: 10, borderRadius: 2 },
  cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  respondBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#d64045' },
  respondBtnText: { color: '#fff', fontWeight: '700' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  actionBtnText: { fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 20 },
  emptyTitle: { fontWeight: '700', marginBottom: 10 },
  emptySubtitle: { textAlign: 'center', lineHeight: 22 },
});