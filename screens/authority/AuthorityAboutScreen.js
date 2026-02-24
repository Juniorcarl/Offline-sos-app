import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

const HOW_IT_WORKS = [
  { step: '1', title: 'Monitor the Dashboard', desc: 'Your dashboard shows all active SOS alerts and incidents in your area relayed through the mesh network in real time.' },
  { step: '2', title: 'Receive Incident Alerts', desc: 'When a civilian sends an SOS, you receive an alert with their location, message and signal strength. High priority incidents trigger immediate notifications.' },
  { step: '3', title: 'Respond & Communicate', desc: 'Tap Respond to open a direct chat with the person in distress. Use the mesh network to communicate even without internet.' },
  { step: '4', title: 'Broadcast to Area', desc: 'Use the Broadcast button to send messages to all devices in your area — useful for crowd control or mass notifications during emergencies.' },
  { step: '5', title: 'Resolve Incidents', desc: 'Once an incident is handled, mark it as resolved. This updates the network and removes it from active incident lists.' },
];

const HELP_ITEMS = [
  { q: 'How do I respond to an incident?', a: 'Tap the incident card on your dashboard or incidents screen, then press Respond to open a direct chat with the person.' },
  { q: 'What does Broadcast do?', a: 'Broadcast sends a message to all devices connected to the mesh network in your area. Use it for area-wide announcements.' },
  { q: 'How do I change my alert settings?', a: 'Go to Settings → Emergency Alerts to configure how you are notified about new incidents including override silent mode and wake screen options.' },
  { q: 'What is High Priority Only mode?', a: 'When enabled in Controls, you will only receive alerts for incidents marked as high priority, reducing noise from lower urgency signals.' },
  { q: 'How do I resolve an incident?', a: 'Open the incident from your dashboard and tap the Resolve button. This marks it as handled and removes it from the active incidents list.' },
  { q: 'Does this work without internet?', a: 'Yes. The entire system runs on a device-to-device mesh network using Bluetooth and Wi-Fi. No internet connection is required.' },
];

const TERMS = `1. AUTHORITY RESPONSIBILITY
As an authority user you are responsible for responding appropriately to incidents received through this platform. Failure to act on genuine emergencies may have consequences.

2. DATA HANDLING
Incident data including civilian locations and messages are transmitted only through the local mesh network. No data is stored on external servers without consent.

3. BROADCAST USE
The broadcast feature must only be used for legitimate emergency communication. Misuse including sending false alerts or misleading messages is strictly prohibited.

4. CONFIDENTIALITY
Information received through this platform about civilians in distress must be treated with confidentiality and used solely for emergency response purposes.

5. PLATFORM LIMITATIONS
Message delivery depends on mesh network availability. The platform cannot guarantee delivery in all conditions.

6. LIABILITY
The platform developer is not liable for outcomes resulting from delayed or undelivered emergency messages.

7. CHANGES
These terms may be updated at any time. Continued use constitutes acceptance.`;

export default function AuthorityAboutScreen() {
  const navigation = useNavigation();
  const { fontSize, darkMode } = useUser();

  const bg = darkMode ? '#111' : '#faf5f5';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const sheetBg = darkMode ? '#1a1a1a' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const borderColor = darkMode ? '#2a2a2a' : '#f2f2f2';
  const bodyColor = darkMode ? '#ccc' : '#666';
  const inputBg = darkMode ? '#2a2a2a' : '#f7f7f7';
  const inputBorder = darkMode ? '#3a3a3a' : '#eee';

  const [howModal, setHowModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [termsModal, setTermsModal] = useState(false);
  const [expandedHelp, setExpandedHelp] = useState(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: 20 * fontSize, color: textColor }]}>About</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.appIdentity}>
          <View style={styles.appIconCircle}>
            <Text style={styles.appIconEmoji}>👮</Text>
          </View>
          <Text style={[styles.appName, { fontSize: 22 * fontSize, color: textColor }]}>OFF_COMP</Text>
          <Text style={[styles.appTagline, { fontSize: 13 * fontSize, color: subColor }]}>
            Authority Emergency Response
          </Text>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: 11 * fontSize, color: subColor }]}>APP INFO</Text>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {[
              { icon: 'phone-portrait-outline', label: 'Version', value: '1.0.0' },
              { icon: 'hammer-outline', label: 'Build', value: '2026.02' },
              { icon: 'flash-outline', label: 'Platform', value: 'Expo / React Native' },
            ].map((item, index, arr) => (
              <View key={item.label} style={[styles.row, index < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor }]}>
                <View style={styles.rowLeft}>
                  <Ionicons name={item.icon} size={20} color={textColor} />
                  <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>{item.label}</Text>
                </View>
                <Text style={[styles.rowValue, { fontSize: 14 * fontSize, color: subColor }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: 11 * fontSize, color: subColor }]}>INFORMATION</Text>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {[
              { icon: 'bulb-outline', label: 'How the App Works', onPress: () => setHowModal(true) },
              { icon: 'help-circle-outline', label: 'Help & FAQs', onPress: () => setHelpModal(true) },
              { icon: 'document-text-outline', label: 'Terms & Conditions', onPress: () => setTermsModal(true), last: true },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.row, !item.last && { borderBottomWidth: 1, borderBottomColor: borderColor }]}
                onPress={item.onPress}
                activeOpacity={0.6}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name={item.icon} size={20} color={textColor} />
                  <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={subColor} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* How It Works Modal */}
      <Modal visible={howModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: sheetBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { fontSize: 18 * fontSize, color: textColor }]}>How the App Works</Text>
              <TouchableOpacity onPress={() => setHowModal(false)}>
                <Ionicons name="close" size={22} color={subColor} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              {HOW_IT_WORKS.map((item) => (
                <View key={item.step} style={styles.stepCard}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNumber}>{item.step}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepTitle, { fontSize: 15 * fontSize, color: textColor }]}>{item.title}</Text>
                    <Text style={[styles.stepDesc, { fontSize: 13 * fontSize, color: bodyColor }]}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal visible={helpModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: sheetBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { fontSize: 18 * fontSize, color: textColor }]}>Help & FAQs</Text>
              <TouchableOpacity onPress={() => { setHelpModal(false); setSubmitted(false); setUserQuestion(''); }}>
                <Ionicons name="close" size={22} color={subColor} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {HELP_ITEMS.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.faqItem, { borderBottomColor: borderColor }]}
                  onPress={() => setExpandedHelp(expandedHelp === index ? null : index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.faqRow}>
                    <Text style={[styles.faqQuestion, { fontSize: 14 * fontSize, color: textColor }]}>{item.q}</Text>
                    <Ionicons name={expandedHelp === index ? 'chevron-up' : 'chevron-down'} size={16} color={subColor} />
                  </View>
                  {expandedHelp === index && (
                    <Text style={[styles.faqAnswer, { fontSize: 13 * fontSize, color: bodyColor }]}>{item.a}</Text>
                  )}
                </TouchableOpacity>
              ))}
              <View style={[styles.askSection, { borderTopColor: borderColor }]}>
                <Text style={[styles.askTitle, { fontSize: 15 * fontSize, color: textColor }]}>Still need help?</Text>
                <Text style={[styles.askSubtitle, { fontSize: 12 * fontSize, color: subColor }]}>
                  Type your question below and we'll get back to you.
                </Text>
                {submitted ? (
                  <View style={styles.submittedBox}>
                    <Text style={styles.submittedIcon}>✅</Text>
                    <Text style={[styles.submittedText, { fontSize: 14 * fontSize, color: textColor }]}>Question submitted!</Text>
                    <Text style={[styles.submittedSub, { fontSize: 12 * fontSize, color: subColor }]}>We'll respond as soon as possible.</Text>
                    <TouchableOpacity onPress={() => { setSubmitted(false); setUserQuestion(''); }}>
                      <Text style={[styles.askAgain, { fontSize: 13 * fontSize }]}>Ask another question</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <TextInput
                      style={[styles.askInput, { fontSize: 14 * fontSize, backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                      placeholder="e.g. How do I broadcast to my area?"
                      placeholderTextColor={subColor}
                      value={userQuestion}
                      onChangeText={setUserQuestion}
                      multiline
                      maxLength={300}
                    />
                    <Text style={[styles.charCount, { fontSize: 11 * fontSize, color: subColor }]}>{userQuestion.length}/300</Text>
                    <TouchableOpacity
                      style={[styles.submitBtn, !userQuestion.trim() && styles.submitBtnDisabled]}
                      onPress={() => { if (userQuestion.trim()) setSubmitted(true); }}
                      disabled={!userQuestion.trim()}
                    >
                      <Text style={[styles.submitBtnText, { fontSize: 14 * fontSize }]}>Submit Question</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Terms Modal */}
      <Modal visible={termsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: sheetBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { fontSize: 18 * fontSize, color: textColor }]}>Terms & Conditions</Text>
              <TouchableOpacity onPress={() => setTermsModal(false)}>
                <Ionicons name="close" size={22} color={subColor} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.termsText, { fontSize: 13 * fontSize, color: bodyColor }]}>{TERMS}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => setTermsModal(false)}>
              <Text style={[styles.acceptBtnText, { fontSize: 15 * fontSize }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 24 },
  headerTitle: { fontWeight: '700' },
  appIdentity: { alignItems: 'center', marginBottom: 32 },
  appIconCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#d64045', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#d64045', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  appIconEmoji: { fontSize: 38 },
  appName: { fontWeight: '800', letterSpacing: 1 },
  appTagline: { marginTop: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontWeight: '500' },
  rowValue: {},
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontWeight: '700' },
  modalScroll: { padding: 20 },
  stepCard: { flexDirection: 'row', gap: 14, marginBottom: 20, alignItems: 'flex-start' },
  stepBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#d64045', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNumber: { color: '#fff', fontWeight: '800', fontSize: 14 },
  stepContent: { flex: 1 },
  stepTitle: { fontWeight: '700', marginBottom: 4 },
  stepDesc: { lineHeight: 20 },
  faqItem: { paddingVertical: 14, borderBottomWidth: 1 },
  faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontWeight: '600', flex: 1, paddingRight: 12 },
  faqAnswer: { lineHeight: 20, marginTop: 10 },
  askSection: { marginTop: 24, paddingTop: 20, borderTopWidth: 1 },
  askTitle: { fontWeight: '700', marginBottom: 4 },
  askSubtitle: { marginBottom: 16 },
  askInput: { borderRadius: 12, padding: 14, minHeight: 100, textAlignVertical: 'top', borderWidth: 1 },
  charCount: { textAlign: 'right', marginTop: 4, marginBottom: 12 },
  submitBtn: { backgroundColor: '#d64045', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#ddd' },
  submitBtnText: { color: '#fff', fontWeight: '700' },
  submittedBox: { alignItems: 'center', paddingVertical: 24 },
  submittedIcon: { fontSize: 40, marginBottom: 12 },
  submittedText: { fontWeight: '700', marginBottom: 4 },
  submittedSub: { marginBottom: 16 },
  askAgain: { color: '#d64045', fontWeight: '600' },
  termsText: { lineHeight: 22 },
  acceptBtn: { margin: 16, paddingVertical: 14, backgroundColor: '#d64045', borderRadius: 14, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontWeight: '700' },
});