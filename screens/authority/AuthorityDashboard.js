import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

const MOCK_INCIDENTS = [
  {
    id: '1', name: 'Kefilwe Moyo', type: 'Medical Emergency',
    distance: '0.3km', time: '2 min ago', priority: 'high',
    location: 'Gaborone, Block 6', hops: 2, signal: 4,
    latitude: -24.6282, longitude: 25.9231,
    message: 'I have been in an accident, I need help urgently',
  },
  {
    id: '2', name: 'Thabo Sithole', type: 'Fire Reported',
    distance: '0.8km', time: '5 min ago', priority: 'high',
    location: 'Gaborone, Extension 9', hops: 3, signal: 3,
    latitude: -24.6350, longitude: 25.9180,
    message: 'There is a fire at the building next to me',
  },
];

function StatCard({ iconName, label, value, color, darkMode }) {
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  return (
    <View style={[styles.statCard, { backgroundColor: cardBg }]}>
      <Ionicons name={iconName} size={20} color={color || (darkMode ? '#fff' : '#1a1a1a')} />
      <Text style={[styles.statValue, { color: color || textColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: subColor }]}>{label}</Text>
    </View>
  );
}

function IncidentCard({ incident, onPress, onMapPress, darkMode, fontSize }) {
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const priorityColor = incident.priority === 'high' ? '#d64045' : '#f5a623';
  const actionBg = darkMode ? '#2a2a2a' : '#f2f2f2';
  const actionText = darkMode ? '#ddd' : '#333';

  return (
    <TouchableOpacity
      style={[styles.incidentCard, { backgroundColor: cardBg, borderLeftColor: priorityColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top row */}
      <View style={styles.incidentHeader}>
        <View style={styles.incidentHeaderLeft}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={[styles.incidentName, { fontSize: 15 * fontSize, color: textColor }]}>
            {incident.name}
          </Text>
        </View>
        <Text style={[styles.incidentTime, { fontSize: 11 * fontSize, color: subColor }]}>
          {incident.time}
        </Text>
      </View>

      {/* Type */}
      <View style={styles.incidentTypeRow}>
        <Ionicons name="warning-outline" size={13} color={priorityColor} />
        <Text style={[styles.incidentType, { fontSize: 13 * fontSize, color: priorityColor }]}>
          {incident.type}
        </Text>
      </View>

      {/* Location */}
      <View style={styles.incidentLocationRow}>
        <Ionicons name="location-outline" size={13} color={subColor} />
        <Text style={[styles.incidentLocation, { fontSize: 12 * fontSize, color: subColor }]}>
          {incident.location} · {incident.distance}
        </Text>
      </View>

      {/* Message preview */}
      <Text
        style={[styles.incidentMessage, { fontSize: 12 * fontSize, color: subColor }]}
        numberOfLines={1}
      >
        "{incident.message}"
      </Text>

      {/* MAP button only */}
      <TouchableOpacity
        style={[styles.mapBtn, { backgroundColor: actionBg }]}
        onPress={onMapPress}
      >
        <Ionicons name="map-outline" size={14} color={actionText} />
        <Text style={[styles.mapBtnText, { fontSize: 12 * fontSize, color: actionText }]}>
          View on Map
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function AuthorityDashboard() {
  const navigation = useNavigation();
  const { darkMode, fontSize, name, authorityType } = useUser();
  const [incidents] = useState(MOCK_INCIDENTS);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);

  const bg = darkMode ? '#111' : '#faf5f5';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const sheetBg = darkMode ? '#1a1a1a' : '#fff';
  const borderColor = darkMode ? '#2a2a2a' : '#f2f2f2';
  const inputBg = darkMode ? '#2a2a2a' : '#f7f7f7';
  const inputBorder = darkMode ? '#3a3a3a' : '#eee';

  const activeCount = incidents.length;
  const highPriority = incidents.filter(i => i.priority === 'high').length;

  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    setBroadcastSent(true);
    setTimeout(() => {
      setBroadcastModal(false);
      setBroadcastMessage('');
      setBroadcastSent(false);
      Alert.alert('📢 Broadcast Sent', 'Your message has been sent to all connected devices on the mesh network.');
    }, 1200);
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerGreeting, { fontSize: 13 * fontSize, color: subColor }]}>
              {authorityType || 'Authority'}
            </Text>
            <Text style={[styles.headerName, { fontSize: 22 * fontSize, color: textColor }]}>
              {name} 👮
            </Text>
          </View>
          <TouchableOpacity
            style={styles.broadcastBtn}
            onPress={() => setBroadcastModal(true)}
          >
            <Ionicons name="megaphone-outline" size={16} color="#fff" />
            <Text style={[styles.broadcastBtnText, { fontSize: 12 * fontSize }]}>Broadcast</Text>
          </TouchableOpacity>
        </View>

        {/* Network status */}
        <View style={[styles.networkBanner, { backgroundColor: darkMode ? '#1a2a1a' : '#f0fff0' }]}>
          <View style={styles.networkDot} />
          <Text style={[styles.networkText, { fontSize: 12 * fontSize, color: darkMode ? '#88cc88' : '#2e7d32' }]}>
            Mesh network active · 6 devices connected
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard iconName="alert-circle-outline" label="Active" value={activeCount} color="#d64045" darkMode={darkMode} />
          <StatCard iconName="flag-outline" label="High Priority" value={highPriority} color="#d64045" darkMode={darkMode} />
          <StatCard iconName="radio-outline" label="Devices" value="6" darkMode={darkMode} />
          <StatCard iconName="checkmark-circle-outline" label="Resolved" value="3" color="#4caf50" darkMode={darkMode} />
        </View>

        {/* Active Incidents */}
        <Text style={[styles.sectionLabel, { fontSize: 11 * fontSize, color: subColor }]}>
          ACTIVE INCIDENTS
        </Text>

        {incidents.length > 0 ? (
          incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              darkMode={darkMode}
              fontSize={fontSize}
              onPress={() => navigation.navigate('Chat', {
                name: incident.name,
                distance: incident.distance,
              })}
              onMapPress={() => navigation.navigate('Map', {
                latitude: incident.latitude,
                longitude: incident.longitude,
                name: incident.name,
                location: incident.location,
                type: incident.type,
                distance: incident.distance,
              })}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#4caf50" />
            <Text style={[styles.emptyText, { fontSize: 16 * fontSize, color: textColor }]}>
              No active incidents
            </Text>
            <Text style={[styles.emptySubText, { fontSize: 13 * fontSize, color: subColor }]}>
              All clear in your area
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Broadcast Modal */}
      <Modal visible={broadcastModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: sheetBg }]}>

            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="megaphone-outline" size={20} color="#d64045" />
                <Text style={[styles.modalTitle, { fontSize: 17 * fontSize, color: textColor }]}>
                  Broadcast Message
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setBroadcastModal(false);
                setBroadcastMessage('');
                setBroadcastSent(false);
              }}>
                <Ionicons name="close" size={22} color={subColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { fontSize: 12 * fontSize, color: subColor }]}>
                This message will be sent to all 6 devices connected on the mesh network.
              </Text>

              <TextInput
                style={[styles.broadcastInput, {
                  backgroundColor: inputBg,
                  borderColor: inputBorder,
                  color: textColor,
                  fontSize: 15 * fontSize,
                }]}
                placeholder="Type your broadcast message..."
                placeholderTextColor={subColor}
                value={broadcastMessage}
                onChangeText={setBroadcastMessage}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { fontSize: 11 * fontSize, color: subColor }]}>
                {broadcastMessage.length}/300
              </Text>

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  !broadcastMessage.trim() && styles.sendBtnDisabled,
                  broadcastSent && styles.sendBtnSent,
                ]}
                onPress={handleBroadcast}
                disabled={!broadcastMessage.trim() || broadcastSent}
              >
                {broadcastSent ? (
                  <View style={styles.sendBtnInner}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={[styles.sendBtnText, { fontSize: 15 * fontSize }]}>Sending...</Text>
                  </View>
                ) : (
                  <View style={styles.sendBtnInner}>
                    <Ionicons name="megaphone-outline" size={18} color="#fff" />
                    <Text style={[styles.sendBtnText, { fontSize: 15 * fontSize }]}>Send Broadcast</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 16 },
  headerGreeting: { fontWeight: '500' },
  headerName: { fontWeight: '800' },
  broadcastBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#d64045', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  broadcastBtnText: { color: '#fff', fontWeight: '700' },
  networkBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: 20 },
  networkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50' },
  networkText: { fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '500', textAlign: 'center' },
  sectionLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  incidentCard: { borderRadius: 16, padding: 14, marginBottom: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  incidentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  incidentHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  incidentName: { fontWeight: '700' },
  incidentTime: {},
  incidentTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  incidentType: { fontWeight: '600' },
  incidentLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  incidentLocation: {},
  incidentMessage: { fontStyle: 'italic', marginBottom: 10 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  mapBtnText: { fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontWeight: '700' },
  emptySubText: {},
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontWeight: '700' },
  modalBody: { padding: 20 },
  modalSubtitle: { marginBottom: 16 },
  broadcastInput: { borderRadius: 12, padding: 14, minHeight: 120, borderWidth: 1, marginBottom: 6 },
  charCount: { textAlign: 'right', marginBottom: 16 },
  sendBtn: { backgroundColor: '#d64045', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ddd' },
  sendBtnSent: { backgroundColor: '#4caf50' },
  sendBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendBtnText: { color: '#fff', fontWeight: '700' },
});