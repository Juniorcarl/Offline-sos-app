import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Switch, StyleSheet, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

const FONT_SIZES = [
  { label: 'Small', value: 0.8 },
  { label: 'Default', value: 1 },
  { label: 'Large', value: 1.2 },
  { label: 'Extra Large', value: 1.4 },
];

const BROADCAST_RANGES = [
  { label: 'Standard', value: 'standard', desc: 'Normal relay range' },
  { label: 'Extended', value: 'extended', desc: 'Wider relay range' },
  { label: 'Maximum', value: 'maximum', desc: 'Full network relay' },
];

const INCIDENT_TIMEOUTS = [
  { label: '30 minutes', value: '30' },
  { label: '1 hour', value: '60' },
  { label: '2 hours', value: '120' },
  { label: 'Manual only', value: 'manual' },
];

export default function AuthorityControlsScreen() {
  const navigation = useNavigation();
  const { fontSize, setFontSize, reduceMotion, setReduceMotion, colorBlindMode, setColorBlindMode, darkMode } = useUser();

  const bg = darkMode ? '#111' : '#faf5f5';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const borderColor = darkMode ? '#2a2a2a' : '#f2f2f2';
  const modalBg = darkMode ? '#1e1e1e' : '#fff';

  const [fontModal, setFontModal] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [timeoutModal, setTimeoutModal] = useState(false);
  const [broadcastRange, setBroadcastRange] = useState('standard');
  const [autoAcknowledge, setAutoAcknowledge] = useState(false);
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);
  const [incidentTimeout, setIncidentTimeout] = useState('60');

  const fontLabel = FONT_SIZES.find(f => f.value === fontSize)?.label ?? 'Default';
  const broadcastLabel = BROADCAST_RANGES.find(b => b.value === broadcastRange)?.label ?? 'Standard';
  const timeoutLabel = INCIDENT_TIMEOUTS.find(t => t.value === incidentTimeout)?.label ?? '1 hour';

  function SectionCard({ title, children }) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { fontSize: 11 * fontSize, color: subColor }]}>{title}</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>{children}</View>
      </View>
    );
  }

  function RowPress({ icon, label, sublabel, value, onPress, last }) {
    return (
      <TouchableOpacity
        style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: borderColor }]}
        onPress={onPress}
        activeOpacity={0.6}
      >
        <View style={styles.rowLeft}>
          <Ionicons name={icon} size={20} color={textColor} />
          <View>
            <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>{label}</Text>
            {sublabel && <Text style={[styles.rowSublabel, { fontSize: 11 * fontSize, color: subColor }]}>{sublabel}</Text>}
          </View>
        </View>
        <View style={styles.rowRight}>
          {value && <Text style={[styles.rowValue, { fontSize: 13 * fontSize, color: subColor }]}>{value}</Text>}
          <Ionicons name="chevron-forward" size={20} color={subColor} />
        </View>
      </TouchableOpacity>
    );
  }

  function RowToggle({ icon, label, sublabel, value, onValueChange, last }) {
    return (
      <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: borderColor }]}>
        <View style={styles.rowLeft}>
          <Ionicons name={icon} size={20} color={textColor} />
          <View>
            <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>{label}</Text>
            {sublabel && <Text style={[styles.rowSublabel, { fontSize: 11 * fontSize, color: subColor }]}>{sublabel}</Text>}
          </View>
        </View>
        <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#ddd', true: '#d64045' }} thumbColor="#fff" />
      </View>
    );
  }

  function PickerModal({ visible, onClose, title, options, selected, onSelect }) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.modalCard, { backgroundColor: modalBg }]}>
            <Text style={[styles.modalTitle, { fontSize: 11 * fontSize, borderBottomColor: borderColor }]}>{title}</Text>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.modalOption, { borderBottomColor: borderColor }, selected === opt.value && { backgroundColor: darkMode ? '#2a1a1a' : '#fff5f5' }]}
                onPress={() => { onSelect(opt.value); onClose(); }}
              >
                <View>
                  <Text style={[styles.modalOptionText, { fontSize: 15 * fontSize, color: textColor }, selected === opt.value && { color: '#d64045', fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                  {opt.desc && <Text style={[styles.modalOptionDesc, { fontSize: 11 * fontSize, color: subColor }]}>{opt.desc}</Text>}
                </View>
                {selected === opt.value && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: 20 * fontSize, color: textColor }]}>Controls</Text>
          <View style={{ width: 24 }} />
        </View>

        <SectionCard title="TEXT">
          <RowPress icon="text-outline" label="Text Size" sublabel="Adjust font size across the app" value={fontLabel} onPress={() => setFontModal(true)} last />
        </SectionCard>

        <SectionCard title="MESH NETWORK">
          <RowPress icon="radio-outline" label="Broadcast Range" sublabel="How far your messages relay" value={broadcastLabel} onPress={() => setBroadcastModal(true)} />
          <RowToggle icon="flash-outline" label="High Priority Mode" sublabel="Only alert for high priority incidents" value={highPriorityOnly} onValueChange={setHighPriorityOnly} last />
        </SectionCard>

        <SectionCard title="INCIDENT MANAGEMENT">
          <RowToggle icon="checkmark-circle-outline" label="Auto Acknowledge" sublabel="Automatically ACK incoming SOS signals" value={autoAcknowledge} onValueChange={setAutoAcknowledge} />
          <RowPress icon="time-outline" label="Incident Timeout" sublabel="Auto-close incidents after" value={timeoutLabel} onPress={() => setTimeoutModal(true)} last />
        </SectionCard>

        <SectionCard title="DISPLAY">
          <RowToggle icon="color-palette-outline" label="Color Blind Mode" sublabel="Replaces red with high-visibility orange" value={colorBlindMode} onValueChange={setColorBlindMode} />
          <RowToggle icon="sparkles-outline" label="Reduce Motion" sublabel="Minimise animations" value={reduceMotion} onValueChange={setReduceMotion} last />
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      <PickerModal visible={fontModal} onClose={() => setFontModal(false)} title="TEXT SIZE" options={FONT_SIZES} selected={fontSize} onSelect={setFontSize} />
      <PickerModal visible={broadcastModal} onClose={() => setBroadcastModal(false)} title="BROADCAST RANGE" options={BROADCAST_RANGES} selected={broadcastRange} onSelect={setBroadcastRange} />
      <PickerModal visible={timeoutModal} onClose={() => setTimeoutModal(false)} title="INCIDENT TIMEOUT" options={INCIDENT_TIMEOUTS} selected={incidentTimeout} onSelect={setIncidentTimeout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 28 },
  headerTitle: { fontWeight: '700' },
  section: { marginBottom: 24 },
  sectionLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { fontWeight: '500' },
  rowSublabel: { marginTop: 2 },
  rowValue: {},
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { borderRadius: 20, width: '80%', paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontWeight: '700', color: '#aaa', letterSpacing: 1, textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  modalOptionText: {},
  modalOptionDesc: { marginTop: 2 },
  checkmark: { fontSize: 16, color: '#d64045', fontWeight: '700' },
});