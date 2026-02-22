import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';

const FONT_SIZES = [
  { label: 'Small', value: 0.8 },
  { label: 'Default', value: 1 },
  { label: 'Large', value: 1.2 },
  { label: 'Extra Large', value: 1.4 },
];

const SOS_SIZES = [
  { label: 'Small', value: 180 },
  { label: 'Default', value: 220 },
  { label: 'Large', value: 260 },
  { label: 'Extra Large', value: 300 },
];

export default function ControlsScreen() {
  const navigation = useNavigation();
  const {
    fontSize, setFontSize,
    sosSize, setSosSize,
    reduceMotion, setReduceMotion,
    colorBlindMode, setColorBlindMode,
    shakeToSOS, setShakeToSOS,
    darkMode,
  } = useUser();

  const [fontModal, setFontModal] = useState(false);
  const [sosModal, setSosModal] = useState(false);
  const [previewSosSize, setPreviewSosSize] = useState(sosSize);

  const fontLabel = FONT_SIZES.find(f => f.value === fontSize)?.label ?? 'Default';
  const sosLabel = SOS_SIZES.find(s => s.value === sosSize)?.label ?? 'Default';

  const bg = darkMode ? '#111' : '#faf5f5';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const borderColor = darkMode ? '#2a2a2a' : '#f2f2f2';
  const modalBg = darkMode ? '#1e1e1e' : '#fff';
  const sosColor = colorBlindMode ? '#E87722' : '#d64045';

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
          <Text style={styles.rowIcon}>{icon}</Text>
          <View>
            <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>{label}</Text>
            {sublabel && <Text style={[styles.rowSublabel, { fontSize: 11 * fontSize, color: subColor }]}>{sublabel}</Text>}
          </View>
        </View>
        <View style={styles.rowRight}>
          {value && <Text style={[styles.rowValue, { fontSize: 13 * fontSize, color: subColor }]}>{value}</Text>}
          <Text style={[styles.chevron, { color: subColor }]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function RowToggle({ icon, label, sublabel, value, onValueChange, last }) {
    return (
      <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: borderColor }]}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowIcon}>{icon}</Text>
          <View>
            <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>{label}</Text>
            {sublabel && <Text style={[styles.rowSublabel, { fontSize: 11 * fontSize, color: subColor }]}>{sublabel}</Text>}
          </View>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#ddd', true: '#d64045' }}
          thumbColor="#fff"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backArrow, { color: textColor }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: 20 * fontSize, color: textColor }]}>Controls</Text>
          <View style={{ width: 24 }} />
        </View>

        <SectionCard title="TEXT">
          <RowPress
            icon="🔤"
            label="Text Size"
            sublabel="Adjust font size across the app"
            value={fontLabel}
            onPress={() => setFontModal(true)}
            last
          />
        </SectionCard>

        <SectionCard title="SOS BUTTON">
          <RowPress
            icon="🔴"
            label="Button Size"
            sublabel="Resize the SOS button"
            value={sosLabel}
            onPress={() => { setPreviewSosSize(sosSize); setSosModal(true); }}
          />
          <RowToggle
            icon="📳"
            label="Shake to SOS"
            sublabel="Shake your phone to trigger SOS"
            value={shakeToSOS}
            onValueChange={setShakeToSOS}
            last
          />
        </SectionCard>

        <SectionCard title="DISPLAY">
          <RowToggle
            icon="🎨"
            label="Color Blind Mode"
            sublabel="Replaces red with high-visibility orange"
            value={colorBlindMode}
            onValueChange={setColorBlindMode}
          />
          <RowToggle
            icon="✨"
            label="Reduce Motion"
            sublabel="Minimise animations"
            value={reduceMotion}
            onValueChange={setReduceMotion}
            last
          />
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Font Size Modal */}
      <Modal visible={fontModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setFontModal(false)} activeOpacity={1}>
          <View style={[styles.modalCard, { backgroundColor: modalBg }]}>
            <Text style={[styles.modalTitle, { fontSize: 11 * fontSize, borderBottomColor: borderColor }]}>TEXT SIZE</Text>
            <View style={[styles.previewContainer, { borderBottomColor: borderColor }]}>
              <Text style={[styles.fontPreviewText, { fontSize: 16 * fontSize, color: textColor }]}>
                Emergency Alert
              </Text>
              <Text style={[styles.previewLabel, { color: subColor }]}>Preview</Text>
            </View>
            {FONT_SIZES.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.modalOption,
                  { borderBottomColor: borderColor },
                  fontSize === opt.value && { backgroundColor: darkMode ? '#2a1a1a' : '#fff5f5' },
                ]}
                onPress={() => { setFontSize(opt.value); setFontModal(false); }}
              >
                <Text style={[styles.modalOptionText, { fontSize: 15 * fontSize, color: textColor }, fontSize === opt.value && { color: '#d64045', fontWeight: '600' }]}>
                  {opt.label}
                </Text>
                {fontSize === opt.value && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SOS Size Modal */}
      <Modal visible={sosModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setSosModal(false)} activeOpacity={1}>
          <View style={[styles.modalCard, { backgroundColor: modalBg }]}>
            <Text style={[styles.modalTitle, { fontSize: 11 * fontSize, borderBottomColor: borderColor }]}>SOS BUTTON SIZE</Text>
            <View style={[styles.previewContainer, { borderBottomColor: borderColor }]}>
              <View style={[
                styles.previewCircle,
                {
                  width: previewSosSize * 0.45,
                  height: previewSosSize * 0.45,
                  borderRadius: previewSosSize * 0.225,
                  backgroundColor: sosColor,
                  shadowColor: sosColor,
                }
              ]}>
                <Text style={[styles.previewText, { fontSize: previewSosSize * 0.08 }]}>SOS</Text>
              </View>
              <Text style={[styles.previewLabel, { color: subColor }]}>Preview</Text>
            </View>
            {SOS_SIZES.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.modalOption,
                  { borderBottomColor: borderColor },
                  sosSize === opt.value && { backgroundColor: darkMode ? '#2a1a1a' : '#fff5f5' },
                ]}
                onPress={() => { setSosSize(opt.value); setSosModal(false); }}
                onPressIn={() => setPreviewSosSize(opt.value)}
              >
                <Text style={[styles.modalOptionText, { fontSize: 15 * fontSize, color: textColor }, sosSize === opt.value && { color: '#d64045', fontWeight: '600' }]}>
                  {opt.label}
                </Text>
                {sosSize === opt.value && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 28 },
  backArrow: { fontSize: 24 },
  headerTitle: { fontWeight: '700' },
  section: { marginBottom: 24 },
  sectionLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowIcon: { fontSize: 18 },
  rowLabel: { fontWeight: '500' },
  rowSublabel: { marginTop: 2 },
  rowValue: {},
  chevron: { fontSize: 22 },
  previewContainer: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, marginBottom: 4 },
  previewCircle: { justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  previewText: { color: '#fff', fontWeight: '800', letterSpacing: 2 },
  fontPreviewText: {},
  previewLabel: { fontSize: 11, marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { borderRadius: 20, width: '80%', paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontWeight: '700', color: '#aaa', letterSpacing: 1, textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalOptionText: {},
  checkmark: { fontSize: 16, color: '#d64045', fontWeight: '700' },
});