import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Alert, Vibration } from 'react-native';
import { useUser } from '../../context/UserContext';
import { Accelerometer } from 'expo-sensors';

const SHAKE_THRESHOLD = 2.5;
const SHAKE_COOLDOWN = 3000;

export default function HomeScreen() {
  const { sosSize, fontSize, reduceMotion, colorBlindMode, shakeToSOS, darkMode } = useUser();

  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring3 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.4)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.15)).current;
  const lastShake = useRef(0);

  const bg = darkMode ? '#111' : '#faf5f5';
  const textColor = darkMode ? '#fff' : '#333';
  const titleColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#888';
  const shakeTagBg = darkMode
    ? (colorBlindMode ? '#2a1e0a' : '#2a1010')
    : (colorBlindMode ? '#FFF3E0' : '#fff0f0');
  const sosColor = colorBlindMode ? '#E87722' : '#d64045';
  const ringColor = colorBlindMode ? '#E87722' : '#e8424a';

  // Ripple animations
  useEffect(() => {
    if (reduceMotion) return;

    const pulse = (scale, opacity, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.6, duration: 1800, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );

    const a1 = pulse(ring1, opacity1, 0);
    const a2 = pulse(ring2, opacity2, 400);
    const a3 = pulse(ring3, opacity3, 800);
    a1.start(); a2.start(); a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [reduceMotion]);

  // Shake to SOS
  const triggerSOS = useCallback(() => {
    Vibration.vibrate([0, 300, 100, 300, 100, 300]);
    Alert.alert(
      '🚨 SOS Triggered',
      'Shake detected — SOS alert sent to nearby mesh devices.',
      [{ text: 'OK' }]
    );
  }, []);

  useEffect(() => {
    if (!shakeToSOS) {
      Accelerometer.removeAllListeners();
      return;
    }

    Accelerometer.setUpdateInterval(200);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > SHAKE_THRESHOLD && now - lastShake.current > SHAKE_COOLDOWN) {
        lastShake.current = now;
        triggerSOS();
      }
    });

    return () => subscription.remove();
  }, [shakeToSOS, triggerSOS]);

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingHorizontal: 20 }}>

      {/* Header */}
      <View style={{ marginTop: 60 }}>
        <Text style={{ color: textColor, fontSize: 18 * fontSize, fontWeight: '500' }}>
          Devices Connected
        </Text>
      </View>

      {/* Shake to SOS indicator */}
      {shakeToSOS && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: shakeTagBg,
          paddingHorizontal: 12, paddingVertical: 6,
          borderRadius: 20, alignSelf: 'flex-start', marginTop: 10,
        }}>
          <Text style={{ fontSize: 14 }}>📳</Text>
          <Text style={{ fontSize: 12 * fontSize, color: sosColor, fontWeight: '600' }}>
            Shake to SOS active
          </Text>
        </View>
      )}

      {/* Title */}
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ fontSize: 28 * fontSize, fontWeight: '700', color: titleColor, letterSpacing: 0.5 }}>
          Do you need help?
        </Text>
      </View>
      <Text style={{ marginTop: 6, fontSize: 14 * fontSize, color: subColor, fontWeight: '400', textAlign: 'center' }}>
        Press the SOS button to alert authorities and nearby devices instantly
      </Text>

      {/* SOS Button with Rings */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>

        {!reduceMotion && [ring3, ring2, ring1].map((ring, i) => {
          const opacities = [opacity3, opacity2, opacity1];
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                width: sosSize,
                height: sosSize,
                borderRadius: sosSize / 2,
                backgroundColor: ringColor,
                opacity: opacities[i],
                transform: [{ scale: [ring3, ring2, ring1][i] }],
              }}
            />
          );
        })}

        <TouchableOpacity
          activeOpacity={0.85}
          style={{
            width: sosSize,
            height: sosSize,
            borderRadius: sosSize / 2,
            backgroundColor: sosColor,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: sosColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 12,
          }}
        >
          <Text style={{ color: 'white', fontSize: sosSize * 0.18, fontWeight: 'bold', letterSpacing: 3 }}>
            SOS
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dark mode subtle footer indicator */}
      {darkMode && (
        <View style={{ alignItems: 'center', paddingBottom: 20 }}>
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: '#333',
          }} />
        </View>
      )}
    </View>
  );
}