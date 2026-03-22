import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Vibration,
  StyleSheet,
} from 'react-native';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { alertEmitter, ALERT_EVENT } from '../services/NotificationService';

const SOUND_ASSETS = {
  '1': require('../assets/sounds/fire-alert.mp3'),
  '2': require('../assets/sounds/signal-alert.mp3'),
  '3': require('../assets/sounds/simple-tone-loop.mp3'),
};

export default function EmergencyAlertOverlay() {
  const navigation = useNavigation();
  const {
    darkMode,
    alertSound,
    alertVibration,
    alertVolume,
    alertRepeat,
    alertSoundId,
  } = useUser();

  const [visible, setVisible] = useState(false);
  const [packet,  setPacket]  = useState(null);

  const soundRef     = useRef(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const slideAnim    = useRef(new Animated.Value(60)).current;
  const opacityAnim  = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef(null);

  // ── Listen for real incoming SOS ──────────────────────────────────────────
  useEffect(() => {
    const handler = (incomingPacket) => {
      setPacket(incomingPacket);
      setVisible(true);
    };
    alertEmitter.on(ALERT_EVENT, handler);
    return () => alertEmitter.off(ALERT_EVENT, handler);
  }, []);

  // ── Animate + sound + vibrate when shown ─────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    slideAnim.setValue(60);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.spring(slideAnim,   { toValue: 0, useNativeDriver: true, tension: 100, friction: 9 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();

    _playSound();
    if (alertVibration) {
      Vibration.vibrate(
        alertRepeat ? [0, 400, 200, 400, 200, 400] : [0, 400, 200, 400],
        alertRepeat
      );
    }

    return () => {
      pulseLoopRef.current?.stop();
      _stopSound();
      Vibration.cancel();
    };
  }, [visible]);

  const _playSound = async () => {
    if (!alertSound) return;
    try {
      await _stopSound();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      const asset = SOUND_ASSETS[String(alertSoundId)] ?? SOUND_ASSETS['1'];
      const { sound } = await Audio.Sound.createAsync(asset, {
        volume:     alertVolume ?? 1,
        isLooping:  alertRepeat,
        shouldPlay: true,
      });
      soundRef.current = sound;
      if (!alertRepeat) {
        sound.setOnPlaybackStatusUpdate(s => {
          if (s.didJustFinish) soundRef.current = null;
        });
      }
    } catch (e) {
      console.error('Alert sound error:', e);
    }
  };

  const _stopSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (_) {}
      soundRef.current = null;
    }
  };

  const dismiss = useCallback(async () => {
    pulseLoopRef.current?.stop();
    await _stopSound();
    Vibration.cancel();
    setVisible(false);
    setPacket(null);
  }, []);

  const openMap = useCallback(async () => {
    await dismiss();
    navigation.navigate('EmergencyMap', {
      messages: packet ? [{
        id:        packet.id,
        name:      `Device ${packet.sid?.slice(-6) ?? 'Unknown'}`,
        message:   packet.msg,
        distance:  '?',
        time:      new Date(packet.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hops:      5 - (packet.ttl ?? 0),
        signal:    3,
        delivered: true,
        latitude:  packet.lat,
        longitude: packet.lon,
      }] : [],
    });
  }, [packet, dismiss, navigation]);

  if (!visible || !packet) return null;

  const isAuthority = packet.target === 'authority';
  const timeStr     = new Date(packet.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hasLocation = packet.lat != null && packet.lon != null;
  const senderShort = packet.sid ? `...${packet.sid.slice(-6).toUpperCase()}` : 'Unknown';

  const bg       = darkMode ? '#1c1c1e' : '#ffffff';
  const textColor = darkMode ? '#ffffff' : '#1a1a1a';
  const subColor  = darkMode ? '#8e8e93' : '#6b6b6b';
  const msgBg     = darkMode ? '#2c2c2e' : '#f5f5f5';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[
          styles.card,
          { backgroundColor: bg },
          { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
        ]}>

          {/* Pulsing ring */}
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.sosCircle}>
              <Text style={styles.sosText}>SOS</Text>
            </View>
          </Animated.View>

          {/* Title */}
          <Text style={[styles.title, { color: '#d64045' }]}>
            {isAuthority ? 'Encrypted SOS' : 'Emergency Nearby'}
          </Text>
          <Text style={[styles.sender, { color: subColor }]}>
            {senderShort}  ·  {timeStr}
          </Text>

          {/* Message bubble */}
          <View style={[styles.msgBubble, { backgroundColor: msgBg }]}>
            <Text style={[styles.msgText, { color: textColor }]}>
              "{packet.msg}"
            </Text>
          </View>

          {/* Location */}
          <Text style={[styles.location, { color: subColor }]}>
            {hasLocation
              ? `${packet.lat.toFixed(4)},  ${packet.lon.toFixed(4)}`
              : 'Location unavailable'}
          </Text>

          {/* Buttons */}
          <View style={styles.btnRow}>
            {hasLocation && (
              <TouchableOpacity style={[styles.btn, styles.btnMap]} onPress={openMap} activeOpacity={0.85}>
                <Text style={styles.btnText}>View on map</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnDismiss]} onPress={dismiss} activeOpacity={0.85}>
              <Text style={styles.btnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  pulseRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: '#d64045',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sosCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#d64045',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  sender: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  msgBubble: {
    width: '100%',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  msgText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  location: {
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnMap: {
    backgroundColor: '#2c2c2e',
  },
  btnDismiss: {
    backgroundColor: '#d64045',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});