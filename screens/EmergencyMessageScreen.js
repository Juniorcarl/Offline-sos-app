// screens/EmergencyMessageScreen.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Vibration,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import connectionManager from '../services/ConnectionManager';

const SUGGESTED_MESSAGES = [
  "Help! I need immediate assistance",
  "Medical emergency - need doctor",
  "I'm injured and can't move",
  "Lost and need directions",
  "Vehicle breakdown - need help",
  "Need water urgently",
];

const AUTO_SEND_SECONDS = 20;
const SHOW_TIMER_AT = 5;

export default function EmergencyMessageScreen() {
  const navigation = useNavigation();
  const { darkMode, fontSize } = useUser();

  const [customMessage, setCustomMessage] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [location, setLocation] = useState('Getting location...');
  const [deviceCount, setDeviceCount] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Target modal
  const [targetModalVisible, setTargetModalVisible] = useState(false);

  // Success modal
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successTarget, setSuccessTarget] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  // Auto-send timer
  const [countdown, setCountdown] = useState(AUTO_SEND_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const autoSentRef = useRef(false);

  // Shake animation
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Modal scale animation
  const modalScaleAnim = useRef(new Animated.Value(0.85)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;

  const bg = darkMode ? '#111' : '#faf5f5';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#666';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const inputBg = darkMode ? '#2a2a2a' : '#f5f5f5';
  const borderColor = darkMode ? '#333' : '#e0e0e0';
  const overlayBg = darkMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)';

  useEffect(() => {
    const devices = connectionManager.getDevices();
    setDeviceCount(devices.length);
    setTimeout(() => setLocation('Palapye, Botswana'), 1000);
  }, []);

  // Animate modal in
  const animateModalIn = () => {
    modalScaleAnim.setValue(0.85);
    modalOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ── Auto-send timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (customMessage.trim().length > 0 && !isSending) {
      setTimerActive(true);
      setCountdown(AUTO_SEND_SECONDS);
      autoSentRef.current = false;

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            if (!autoSentRef.current) {
              autoSentRef.current = true;
              executeSend('authority');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setTimerActive(false);
      setCountdown(AUTO_SEND_SECONDS);
    }

    return () => clearInterval(timerRef.current);
  }, [customMessage]);

  // Shake at SHOW_TIMER_AT
  useEffect(() => {
    if (timerActive && countdown === SHOW_TIMER_AT) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [countdown]);

  // ── Send execution ────────────────────────────────────────────────────────
  const executeSend = (target) => {
    clearInterval(timerRef.current);
    setTimerActive(false);
    setTargetModalVisible(false);
    Vibration.vibrate([0, 100, 50, 100]);
    setIsSending(true);

    const finalMessage = customMessage.trim();

    setTimeout(() => {
      setIsSending(false);
      setSentMessage(finalMessage);
      setSuccessTarget(target);
      setSuccessModalVisible(true);
      animateModalIn();
    }, 1500);
  };

  // ── Send button pressed — show target modal ───────────────────────────────
  const handleSendPress = () => {
    if (!customMessage.trim()) return;
    clearInterval(timerRef.current);
    setTimerActive(false);
    setTargetModalVisible(true);
    animateModalIn();
  };

  const handleSelectSuggestion = (message) => {
    setCustomMessage(message);
    setDropdownOpen(false);
  };

  const resumeTimer = () => {
    if (customMessage.trim().length > 0 && !autoSentRef.current) {
      setTimerActive(true);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            if (!autoSentRef.current) {
              autoSentRef.current = true;
              executeSend('authority');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const showTimer = timerActive && countdown <= SHOW_TIMER_AT;
  const hasMessage = customMessage.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: cardBg }]}
        >
          <Text style={[styles.backButtonText, { color: textColor }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: textColor, fontSize: 22 * fontSize }]}>
            Send Emergency SOS
          </Text>
          <Text style={[styles.headerSubtitle, { color: subColor, fontSize: 13 * fontSize }]}>
            {deviceCount} nearby {deviceCount === 1 ? 'device' : 'devices'} · {location}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Auto-send timer banner ─────────────────────────────────── */}
        {showTimer && (
          <Animated.View
            style={[
              styles.timerBanner,
              { backgroundColor: countdown <= 3 ? '#d64045' : '#E65100' },
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            <Text style={styles.timerBannerText}>
              ⚡ Auto-sending to Authority in{' '}
              <Text style={styles.timerBannerCount}>{countdown}s</Text>
            </Text>
            <TouchableOpacity
              onPress={() => {
                clearInterval(timerRef.current);
                setTimerActive(false);
                setCountdown(AUTO_SEND_SECONDS);
              }}
              style={styles.timerCancelBtn}
            >
              <Text style={styles.timerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Message text field ─────────────────────────────────────── */}
        <Text style={[styles.label, { color: textColor, fontSize: 15 * fontSize }]}>
          Your Emergency Message
        </Text>

        <View style={[
          styles.inputContainer,
          { backgroundColor: inputBg, borderColor: hasMessage ? '#d64045' : borderColor },
        ]}>
          <TextInput
            style={[styles.input, { color: textColor, fontSize: 15 * fontSize }]}
            placeholder="Describe your emergency clearly..."
            placeholderTextColor={subColor}
            value={customMessage}
            onChangeText={(text) => {
              autoSentRef.current = false;
              setCustomMessage(text);
            }}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={200}
            editable={!isSending}
          />
          <Text style={[styles.charCount, { color: subColor, fontSize: 11 * fontSize }]}>
            {customMessage.length}/200
          </Text>
        </View>

        {/* ── Quick messages dropdown ─────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.dropdownToggle, { backgroundColor: cardBg, borderColor }]}
          onPress={() => setDropdownOpen(!dropdownOpen)}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownToggleText, { color: subColor, fontSize: 14 * fontSize }]}>
            ⚡ Quick Messages
          </Text>
          <Text style={[styles.dropdownChevron, { color: subColor }]}>
            {dropdownOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {dropdownOpen && (
          <View style={[styles.dropdownList, { backgroundColor: cardBg, borderColor }]}>
            {SUGGESTED_MESSAGES.map((message, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dropdownItem,
                  {
                    borderBottomColor: borderColor,
                    borderBottomWidth: index < SUGGESTED_MESSAGES.length - 1 ? 1 : 0,
                    backgroundColor: customMessage === message
                      ? (darkMode ? '#2a0e0e' : '#fff5f5')
                      : 'transparent',
                  },
                ]}
                onPress={() => handleSelectSuggestion(message)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dropdownItemText,
                  {
                    color: customMessage === message ? '#d64045' : textColor,
                    fontSize: 14 * fontSize,
                  },
                ]}>
                  {message}
                </Text>
                {customMessage === message && (
                  <Text style={styles.dropdownCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Info box ──────────────────────────────────────────────── */}
        <View style={[styles.infoBox, { backgroundColor: darkMode ? '#1a1a00' : '#FFFDE7' }]}>
          <Text style={{ fontSize: 15 }}>ℹ️</Text>
          <Text style={[styles.infoText, {
            color: darkMode ? '#FFD54F' : '#795548',
            fontSize: 12 * fontSize,
          }]}>
            If you write a message and do nothing for 20 seconds it will
            automatically be sent to authorities. You can also tap Send to
            choose between authorities or nearby users.
          </Text>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── Send button ─────────────────────────────────────────────────── */}
      <View style={[styles.buttonContainer, { backgroundColor: bg }]}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: hasMessage ? '#d64045' : '#999',
              opacity: isSending ? 0.6 : 1,
            },
          ]}
          onPress={handleSendPress}
          disabled={isSending || !hasMessage}
          activeOpacity={0.8}
        >
          {isSending ? (
            <Text style={[styles.sendButtonText, { fontSize: 17 * fontSize }]}>
              📡 Broadcasting...
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: 22, marginRight: 8 }}>🚨</Text>
              <Text style={[styles.sendButtonText, { fontSize: 17 * fontSize }]}>
                Send SOS
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════════════════════════
          TARGET MODAL — authority or local choice
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={targetModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => {
          setTargetModalVisible(false);
          resumeTimer();
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: overlayBg }]}>
          <Animated.View
            style={[
              styles.modalCard,
              { backgroundColor: cardBg },
              {
                opacity: modalOpacityAnim,
                transform: [{ scale: modalScaleAnim }],
              },
            ]}
          >
            {/* Modal header */}
            <View style={styles.modalIconRow}>
              <View style={[styles.modalIconBg, { backgroundColor: darkMode ? '#2a0e0e' : '#fff0f0' }]}>
                <Text style={{ fontSize: 30 }}>🚨</Text>
              </View>
            </View>

            <Text style={[styles.modalTitle, { color: textColor }]}>
              Who should receive this SOS?
            </Text>
            <Text style={[styles.modalSubtitle, { color: subColor }]}>
              Choose carefully — authority messages are encrypted.
            </Text>

            {/* Message preview */}
            <View style={[styles.messagePreview, { backgroundColor: inputBg, borderColor }]}>
              <Text style={[styles.messagePreviewLabel, { color: subColor }]}>Your message</Text>
              <Text style={[styles.messagePreviewText, { color: textColor }]} numberOfLines={2}>
                "{customMessage}"
              </Text>
            </View>

            {/* Authority button */}
            <TouchableOpacity
              style={styles.targetBtnAuthority}
              onPress={() => executeSend('authority')}
              activeOpacity={0.85}
            >
              <View style={styles.targetBtnContent}>
                <View style={styles.targetBtnIconWrap}>
                  <Text style={{ fontSize: 22 }}>🔒</Text>
                </View>
                <View style={styles.targetBtnTextWrap}>
                  <Text style={styles.targetBtnTitle}>Send to Authority</Text>
                  <Text style={styles.targetBtnDesc}>
                    Police, hospital, fire dept · RSA encrypted
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Local button */}
            <TouchableOpacity
              style={[styles.targetBtnLocal, { borderColor: darkMode ? '#333' : '#e0e0e0' }]}
              onPress={() => executeSend('local')}
              activeOpacity={0.85}
            >
              <View style={styles.targetBtnContent}>
                <View style={[
                  styles.targetBtnIconWrap,
                  { backgroundColor: darkMode ? '#1a2a1a' : '#f0fff0' },
                ]}>
                  <Text style={{ fontSize: 22 }}>👥</Text>
                </View>
                <View style={styles.targetBtnTextWrap}>
                  <Text style={[styles.targetBtnTitle, { color: textColor }]}>
                    Send to Nearby Users
                  </Text>
                  <Text style={[styles.targetBtnDesc, { color: subColor }]}>
                    People around you via mesh network
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => {
                setTargetModalVisible(false);
                resumeTimer();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: subColor }]}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          SUCCESS MODAL — after message is sent
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: overlayBg }]}>
          <Animated.View
            style={[
              styles.modalCard,
              { backgroundColor: cardBg },
              {
                opacity: modalOpacityAnim,
                transform: [{ scale: modalScaleAnim }],
              },
            ]}
          >
            {/* Success icon */}
            <View style={styles.modalIconRow}>
              <View style={[styles.modalIconBg, { backgroundColor: darkMode ? '#0a2a0a' : '#f0fff0' }]}>
                <Text style={{ fontSize: 34 }}>✅</Text>
              </View>
            </View>

            <Text style={[styles.modalTitle, { color: textColor }]}>SOS Delivered!</Text>
            <Text style={[styles.modalSubtitle, { color: subColor }]}>
              Your message was broadcast to{' '}
              <Text style={{ color: '#d64045', fontWeight: '700' }}>
                {successTarget === 'authority' ? '🔒 Authorities' : '👥 Nearby Users'}
              </Text>
              {' '}via {deviceCount} {deviceCount === 1 ? 'device' : 'devices'}.
            </Text>

            {/* Message preview */}
            <View style={[styles.messagePreview, { backgroundColor: inputBg, borderColor }]}>
              <Text style={[styles.messagePreviewLabel, { color: subColor }]}>Message sent</Text>
              <Text style={[styles.messagePreviewText, { color: textColor }]} numberOfLines={3}>
                "{sentMessage}"
              </Text>
            </View>

            {/* View on map */}
            <TouchableOpacity
              style={styles.targetBtnAuthority}
              onPress={() => {
                setSuccessModalVisible(false);
                navigation.replace('EmergencyMap', {
                  messages: [
                    {
                      id: Date.now().toString(),
                      name: 'You',
                      message: sentMessage,
                      distance: '0m',
                      time: 'Just now',
                      hops: 0,
                      signal: 5,
                      delivered: true,
                      latitude: -24.6282,
                      longitude: 25.9231,
                    },
                  ],
                });
              }}
              activeOpacity={0.85}
            >
              <View style={styles.targetBtnContent}>
                <View style={styles.targetBtnIconWrap}>
                  <Text style={{ fontSize: 22 }}>🗺️</Text>
                </View>
                <View style={styles.targetBtnTextWrap}>
                  <Text style={styles.targetBtnTitle}>View on Map</Text>
                  <Text style={styles.targetBtnDesc}>See your SOS location</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Done */}
            <TouchableOpacity
              style={[styles.targetBtnLocal, { borderColor: darkMode ? '#333' : '#e0e0e0' }]}
              onPress={() => {
                setSuccessModalVisible(false);
                navigation.goBack();
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.modalCancelText, { color: textColor, fontWeight: '600' }]}>
                Done
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButtonText: { fontSize: 24, fontWeight: '600' },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontWeight: '700', marginBottom: 2 },
  headerSubtitle: { fontWeight: '500' },

  // Content
  content: { flex: 1, paddingHorizontal: 20 },

  // Timer banner
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  timerBannerText: { color: '#fff', fontWeight: '600', fontSize: 13, flex: 1 },
  timerBannerCount: { fontWeight: '800', fontSize: 15 },
  timerCancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 10,
  },
  timerCancelText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Label
  label: { fontWeight: '700', marginBottom: 8 },

  // Text input
  inputContainer: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    marginBottom: 14,
  },
  input: { minHeight: 110, fontWeight: '400', paddingVertical: 4 },
  charCount: { textAlign: 'right', marginTop: 4 },

  // Dropdown
  dropdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  dropdownToggleText: { fontWeight: '600' },
  dropdownChevron: { fontSize: 12, fontWeight: '700' },
  dropdownList: {
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownItemText: { flex: 1, fontWeight: '500' },
  dropdownCheck: { color: '#d64045', fontWeight: '800', fontSize: 16, marginLeft: 8 },

  // Info box
  infoBox: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 16,
  },
  infoText: { flex: 1, lineHeight: 18 },

  // Send button
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 34,
  },
  sendButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#d64045',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButtonText: { color: '#fff', fontWeight: '700' },

  // ── Modal shared ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  modalCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalIconRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },

  // Message preview inside modal
  messagePreview: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 18,
  },
  messagePreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  messagePreviewText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Target buttons
  targetBtnAuthority: {
    backgroundColor: '#d64045',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#d64045',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  targetBtnLocal: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 10,
  },
  targetBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  targetBtnIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBtnTextWrap: { flex: 1 },
  targetBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  targetBtnDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },

  // Cancel
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 2,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});