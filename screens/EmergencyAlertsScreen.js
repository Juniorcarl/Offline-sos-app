import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Switch, StyleSheet, Modal, Vibration,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { useUser } from '../context/UserContext';

const ALERT_SOUNDS = [
  { id: '1', label: '🔥 Fire Alert', file: require('../assets/sounds/fire-alert.mp3') },
  { id: '2', label: '📡 Signal Alert', file: require('../assets/sounds/signal-alert.mp3') },
  { id: '3', label: '🔔 Simple Tone', file: require('../assets/sounds/simple-tone-loop.mp3') },
];

function RowToggle({ icon, label, sublabel, value, onValueChange, last, fontSize, textColor, subColor, borderColor, cardBg }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: borderColor }, { backgroundColor: cardBg }]}>
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

function RowPress({ icon, label, sublabel, value, onPress, last, fontSize, textColor, subColor, borderColor, cardBg }) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: borderColor }, { backgroundColor: cardBg }]}
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

export default function EmergencyAlertsScreen() {
  const navigation = useNavigation();
  const {
    fontSize, darkMode,
    alertSound, setAlertSound,
    alertVibration, setAlertVibration,
    alertFlashlight, setAlertFlashlight,
    alertRepeat, setAlertRepeat,
    alertVolume, setAlertVolume,
    alertSoundId, setAlertSoundId,
  } = useUser();

  const bg = darkMode ? '#111' : '#faf5f5';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const borderColor = darkMode ? '#2a2a2a' : '#f2f2f2';
  const modalBg = darkMode ? '#1e1e1e' : '#fff';

  const selectedSound = ALERT_SOUNDS.find(s => s.id === alertSoundId) ?? ALERT_SOUNDS[0];
  const [soundModalVisible, setSoundModalVisible] = useState(false);
  const [currentSound, setCurrentSound] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    return () => {
      if (currentSound) { currentSound.stopAsync(); currentSound.unloadAsync(); }
    };
  }, [currentSound]);

  const handleVibrationToggle = (val) => {
    setAlertVibration(val);
    if (val) Vibration.vibrate([0, 200, 100, 200]);
    else Vibration.cancel();
  };

  const stopCurrentSound = async () => {
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      setCurrentSound(null);
      setPlayingId(null);
    }
  };

  const playPreview = async (alertSoundObj) => {
    try {
      await stopCurrentSound();
      if (playingId === alertSoundObj.id) return;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(alertSoundObj.file, { volume: alertVolume });
      setCurrentSound(newSound);
      setPlayingId(alertSoundObj.id);
      await newSound.playAsync();
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) { setPlayingId(null); setCurrentSound(null); }
      });
    } catch (e) { console.log('Sound error:', e); }
  };

  const playVolumePreview = async (val) => {
    setAlertVolume(val);
    try {
      await stopCurrentSound();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(selectedSound.file, { volume: val });
      setCurrentSound(newSound);
      await newSound.playAsync();
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) { setCurrentSound(null); }
      });
    } catch (e) { console.log('Volume preview error:', e); }
  };

  const handleSelectSound = async (alertSoundObj) => {
    setAlertSoundId(alertSoundObj.id);
    await playPreview(alertSoundObj);
  };

  const handleCloseModal = async () => {
    await stopCurrentSound();
    setSoundModalVisible(false);
  };

  const rowProps = { fontSize, textColor, subColor, borderColor, cardBg };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: 20 * fontSize, color: textColor }]}>Emergency Alerts</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: 11 * fontSize, color: subColor }]}>SOUND</Text>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <RowToggle icon="volume-high-outline" label="Sound" sublabel="Play audio on alert" value={alertSound} onValueChange={setAlertSound} {...rowProps} />
            <RowPress icon="musical-notes-outline" label="Alert Sound" sublabel="Choose your alert tone" value={selectedSound.label} onPress={() => setSoundModalVisible(true)} {...rowProps} />
            <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: borderColor, backgroundColor: cardBg, flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 8 }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="volume-medium-outline" size={20} color={textColor} />
                <View>
                  <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>Alert Volume</Text>
                  <Text style={[styles.rowSublabel, { fontSize: 11 * fontSize, color: subColor }]}>{Math.round(alertVolume * 100)}%</Text>
                </View>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={alertVolume}
                onValueChange={setAlertVolume}
                onSlidingComplete={playVolumePreview}
                minimumTrackTintColor="#d64045"
                maximumTrackTintColor={darkMode ? '#444' : '#ddd'}
                thumbTintColor="#d64045"
              />
            </View>
            <RowToggle icon="repeat-outline" label="Repeat Alert" sublabel="Keep alerting until dismissed" value={alertRepeat} onValueChange={setAlertRepeat} last {...rowProps} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: 11 * fontSize, color: subColor }]}>HAPTICS</Text>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <RowToggle icon="phone-portrait-outline" label="Vibration" sublabel="Vibrate on alert" value={alertVibration} onValueChange={handleVibrationToggle} last {...rowProps} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: 11 * fontSize, color: subColor }]}>VISUAL</Text>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <RowToggle icon="flashlight-outline" label="Flashlight" sublabel="Flash torch on alert" value={alertFlashlight} onValueChange={setAlertFlashlight} last {...rowProps} />
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={soundModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={handleCloseModal} activeOpacity={1}>
          <View style={[styles.modalCard, { backgroundColor: modalBg }]}>
            <Text style={[styles.modalTitle, { fontSize: 11 * fontSize, borderBottomColor: borderColor }]}>SELECT ALERT SOUND</Text>
            {ALERT_SOUNDS.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.modalOption,
                  { borderBottomColor: borderColor },
                  selectedSound.id === s.id && { backgroundColor: darkMode ? '#2a1a1a' : '#fff5f5' },
                ]}
                onPress={() => handleSelectSound(s)}
              >
                <View style={styles.modalOptionLeft}>
                  <Text style={[
                    styles.modalOptionText,
                    { fontSize: 15 * fontSize, color: textColor },
                    selectedSound.id === s.id && { color: '#d64045', fontWeight: '600' },
                  ]}>
                    {s.label}
                  </Text>
                  {playingId === s.id && (
                    <Text style={[styles.playingBadge, { fontSize: 11 * fontSize }]}>▶ playing</Text>
                  )}
                </View>
                {selectedSound.id === s.id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalDoneBtn} onPress={handleCloseModal}>
              <Text style={[styles.modalDoneText, { fontSize: 15 * fontSize }]}>Done</Text>
            </TouchableOpacity>
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
  slider: { width: '100%', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { borderRadius: 20, width: '80%', paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontWeight: '700', color: '#aaa', letterSpacing: 1, textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalOptionText: {},
  checkmark: { fontSize: 16, color: '#d64045', fontWeight: '700' },
  playingBadge: { color: '#d64045', fontWeight: '600' },
  modalDoneBtn: { paddingVertical: 14, alignItems: 'center' },
  modalDoneText: { fontWeight: '700', color: '#d64045' },
});