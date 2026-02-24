import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserContext = createContext();

const DEFAULTS = {
  name: 'Your Name',
  fontSize: 1,
  sosSize: 220,
  reduceMotion: false,
  colorBlindMode: false,
  shakeToSOS: false,
  darkMode: false,
  role: 'User',
  authorityType: '',
  alertSound: true,
  alertVibration: true,
  alertFlashlight: true,
  alertRepeat: true,
  alertVolume: 0.8,
  alertSoundId: '1',
};

export function UserProvider({ children }) {
  const [name, setNameState] = useState(DEFAULTS.name);
  const [fontSize, setFontSizeState] = useState(DEFAULTS.fontSize);
  const [sosSize, setSosSizeState] = useState(DEFAULTS.sosSize);
  const [reduceMotion, setReduceMotionState] = useState(DEFAULTS.reduceMotion);
  const [colorBlindMode, setColorBlindModeState] = useState(DEFAULTS.colorBlindMode);
  const [shakeToSOS, setShakeToSOSState] = useState(DEFAULTS.shakeToSOS);
  const [darkMode, setDarkModeState] = useState(DEFAULTS.darkMode);
  const [role, setRoleState] = useState(DEFAULTS.role);
  const [authorityType, setAuthorityTypeState] = useState(DEFAULTS.authorityType);
  const [alertSound, setAlertSoundState] = useState(DEFAULTS.alertSound);
  const [alertVibration, setAlertVibrationState] = useState(DEFAULTS.alertVibration);
  const [alertFlashlight, setAlertFlashlightState] = useState(DEFAULTS.alertFlashlight);
  const [alertRepeat, setAlertRepeatState] = useState(DEFAULTS.alertRepeat);
  const [alertVolume, setAlertVolumeState] = useState(DEFAULTS.alertVolume);
  const [alertSoundId, setAlertSoundIdState] = useState(DEFAULTS.alertSoundId);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const keys = [
          'name', 'fontSize', 'sosSize', 'reduceMotion',
          'colorBlindMode', 'shakeToSOS', 'darkMode',
          'role', 'authorityType',
          'alertSound', 'alertVibration', 'alertFlashlight',
          'alertRepeat', 'alertVolume', 'alertSoundId',
        ];
        const pairs = await AsyncStorage.multiGet(keys);
        pairs.forEach(([key, value]) => {
          if (value === null) return;
          const parsed = JSON.parse(value);
          if (key === 'name') setNameState(parsed);
          if (key === 'fontSize') setFontSizeState(parsed);
          if (key === 'sosSize') setSosSizeState(parsed);
          if (key === 'reduceMotion') setReduceMotionState(parsed);
          if (key === 'colorBlindMode') setColorBlindModeState(parsed);
          if (key === 'shakeToSOS') setShakeToSOSState(parsed);
          if (key === 'darkMode') setDarkModeState(parsed);
          if (key === 'role') setRoleState(parsed);
          if (key === 'authorityType') setAuthorityTypeState(parsed);
          if (key === 'alertSound') setAlertSoundState(parsed);
          if (key === 'alertVibration') setAlertVibrationState(parsed);
          if (key === 'alertFlashlight') setAlertFlashlightState(parsed);
          if (key === 'alertRepeat') setAlertRepeatState(parsed);
          if (key === 'alertVolume') setAlertVolumeState(parsed);
          if (key === 'alertSoundId') setAlertSoundIdState(parsed);
        });
      } catch (e) {
        console.log('Failed to load settings:', e);
      } finally {
        setLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const save = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.log(`Failed to save ${key}:`, e);
    }
  };

  const setName = (v) => { setNameState(v); save('name', v); };
  const setFontSize = (v) => { setFontSizeState(v); save('fontSize', v); };
  const setSosSize = (v) => { setSosSizeState(v); save('sosSize', v); };
  const setReduceMotion = (v) => { setReduceMotionState(v); save('reduceMotion', v); };
  const setColorBlindMode = (v) => { setColorBlindModeState(v); save('colorBlindMode', v); };
  const setShakeToSOS = (v) => { setShakeToSOSState(v); save('shakeToSOS', v); };
  const setDarkMode = (v) => { setDarkModeState(v); save('darkMode', v); };
  const setRole = (v) => { setRoleState(v); save('role', v); };
  const setAuthorityType = (v) => { setAuthorityTypeState(v); save('authorityType', v); };
  const setAlertSound = (v) => { setAlertSoundState(v); save('alertSound', v); };
  const setAlertVibration = (v) => { setAlertVibrationState(v); save('alertVibration', v); };
  const setAlertFlashlight = (v) => { setAlertFlashlightState(v); save('alertFlashlight', v); };
  const setAlertRepeat = (v) => { setAlertRepeatState(v); save('alertRepeat', v); };
  const setAlertVolume = (v) => { setAlertVolumeState(v); save('alertVolume', v); };
  const setAlertSoundId = (v) => { setAlertSoundIdState(v); save('alertSoundId', v); };

  const clearAllData = async () => {
    try {
      await AsyncStorage.multiRemove([
        'name', 'fontSize', 'sosSize', 'reduceMotion',
        'colorBlindMode', 'shakeToSOS', 'darkMode',
        'role', 'authorityType',
        'alertSound', 'alertVibration', 'alertFlashlight',
        'alertRepeat', 'alertVolume', 'alertSoundId',
      ]);
      setNameState(DEFAULTS.name);
      setFontSizeState(DEFAULTS.fontSize);
      setSosSizeState(DEFAULTS.sosSize);
      setReduceMotionState(DEFAULTS.reduceMotion);
      setColorBlindModeState(DEFAULTS.colorBlindMode);
      setShakeToSOSState(DEFAULTS.shakeToSOS);
      setDarkModeState(DEFAULTS.darkMode);
      setRoleState(DEFAULTS.role);
      setAuthorityTypeState(DEFAULTS.authorityType);
      setAlertSoundState(DEFAULTS.alertSound);
      setAlertVibrationState(DEFAULTS.alertVibration);
      setAlertFlashlightState(DEFAULTS.alertFlashlight);
      setAlertRepeatState(DEFAULTS.alertRepeat);
      setAlertVolumeState(DEFAULTS.alertVolume);
      setAlertSoundIdState(DEFAULTS.alertSoundId);
    } catch (e) {
      console.log('Failed to clear data:', e);
    }
  };

  if (!loaded) return null;

  return (
    <UserContext.Provider value={{
      name, setName,
      fontSize, setFontSize,
      sosSize, setSosSize,
      reduceMotion, setReduceMotion,
      colorBlindMode, setColorBlindMode,
      shakeToSOS, setShakeToSOS,
      darkMode, setDarkMode,
      role, setRole,
      authorityType, setAuthorityType,
      alertSound, setAlertSound,
      alertVibration, setAlertVibration,
      alertFlashlight, setAlertFlashlight,
      alertRepeat, setAlertRepeat,
      alertVolume, setAlertVolume,
      alertSoundId, setAlertSoundId,
      clearAllData,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}