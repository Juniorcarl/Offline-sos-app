import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';

const HOW_IT_WORKS = [
  { step: '1', title: 'Connect to Mesh Network', desc: 'The app automatically connects to nearby devices using Bluetooth and Wi-Fi to form a mesh network — no internet required.' },
  { step: '2', title: 'Send SOS', desc: 'Press the SOS button to broadcast an emergency alert to all connected devices within range. Your location is included automatically.' },
  { step: '3', title: 'Relay & Reach', desc: 'Each device in the network relays your message further, extending your reach even in areas with no signal.' },
  { step: '4', title: 'Receive Alerts', desc: 'Nearby users receive your emergency alert instantly with your distance, message, and signal strength shown.' },
];

const HELP_ITEMS = [
  { q: 'Why is my SOS not sending?', a: 'Make sure Bluetooth and Wi-Fi are both enabled. At least one other device running the app must be nearby to relay your message.' },
  { q: 'How far does the mesh network reach?', a: 'Each device can reach others within approximately 50–100 metres. Messages hop between devices, so the more users nearby, the greater the range.' },
  { q: 'Does this work without internet?', a: 'Yes. The app is designed to work entirely offline using device-to-device communication.' },
  { q: 'Why is shake to SOS not working?', a: 'Make sure Shake to SOS is enabled in Controls. Shake your phone firmly — a gentle tilt will not trigger it.' },
  { q: 'How do I change the alert sound?', a: 'Go to Settings → Emergency Alerts → Alert Sound and choose from the available tones.' },
];

const TERMS = `1. ACCEPTANCE
By using this app you agree to these terms. If you do not agree, do not use the app.

2. PURPOSE
This app is designed for emergency communication only. It must not be used to send false alerts or mislead other users.

3. NO GUARANTEE OF DELIVERY
Message delivery depends on nearby devices being available. We cannot guarantee your alert will reach emergency services or any specific person.

4. USER RESPONSIBILITY
You are responsible for the accuracy of any alert you send. Misuse of the SOS feature may have legal consequences.

5. DATA & PRIVACY
Messages are transmitted locally between devices and are not stored on external servers. Location data is only shared during an active SOS.

6. LIABILITY
We are not liable for any harm resulting from failure to deliver an emergency message or network unavailability.

7. CHANGES
These terms may be updated at any time. Continued use of the app constitutes acceptance of the revised terms.`;

export default function AboutScreen() {
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

  function SectionCard({ title, children }) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { fontSize: 11 * fontSize, color: subColor }]}>{title}</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>{children}</View>
      </View>
    );
  }

  function RowPress({ icon, label, onPress, last }) {
    return (
      <TouchableOpacity
        style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: borderColor }]}
        onPress={onPress}
        activeOpacity={0.6}
      >
        <View style={styles.rowLeft}>
          <Text style={styles.rowIcon}>{icon}</Text>
          <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>{label}</Text>
        </View>
        <Text style={[styles.chevron, { color: subColor }]}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backArrow, { color: textColor }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: 20 * fontSize, color: textColor }]}>About</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.appIdentity}>
          <View style={styles.appIconCircle}>
            <Text style={styles.appIconEmoji}>🆘</Text>
          </View>
          <Text style={[styles.appName, { fontSize: 22 * fontSize, color: textColor }]}>OFF_COMP</Text>
          <Text style={[styles.appTagline, { fontSize: 13 * fontSize, color: subColor }]}>
            Emergency mesh communication
          </Text>
        </View>

        <SectionCard title="APP INFO">
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: borderColor }]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>📱</Text>
              <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>Version</Text>
            </View>
            <Text style={[styles.rowValue, { fontSize: 14 * fontSize, color: subColor }]}>1.0.0</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: borderColor }]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🔨</Text>
              <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>Build</Text>
            </View>
            <Text style={[styles.rowValue, { fontSize: 14 * fontSize, color: subColor }]}>2026.02</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>⚡</Text>
              <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>Platform</Text>
            </View>
            <Text style={[styles.rowValue, { fontSize: 14 * fontSize, color: subColor }]}>Expo / React Native</Text>
          </View>
        </SectionCard>

        <SectionCard title="INFORMATION">
          <RowPress icon="💡" label="How the App Works" onPress={() => setHowModal(true)} />
          <RowPress icon="🙋" label="Help & FAQs" onPress={() => setHelpModal(true)} />
          <RowPress icon="📄" label="Terms & Conditions" onPress={() => setTermsModal(true)} last />
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* How It Works Modal */}
      <Modal visible={howModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: sheetBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { fontSize: 18 * fontSize, color: textColor }]}>How the App Works</Text>
              <TouchableOpacity onPress={() => setHowModal(false)}>
                <Text style={[styles.modalClose, { color: subColor }]}>✕</Text>
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
                <Text style={[styles.modalClose, { color: subColor }]}>✕</Text>
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
                    <Text style={[styles.faqChevron, { color: subColor }]}>{expandedHelp === index ? '∧' : '∨'}</Text>
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
                      placeholder="e.g. How do I add emergency contacts?"
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
                <Text style={[styles.modalClose, { color: subColor }]}>✕</Text>
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
  backArrow: { fontSize: 24 },
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
  rowIcon: { fontSize: 18 },
  rowLabel: { fontWeight: '500' },
  rowValue: {},
  chevron: { fontSize: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontWeight: '700' },
  modalClose: { fontSize: 18, padding: 4 },
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
  faqChevron: { fontSize: 14 },
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