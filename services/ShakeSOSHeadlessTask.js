import messageService from './MessageService';
import connectionManager from './ConnectionManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAG = '[ShakeSOSHeadlessTask]';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getStoredDeviceId = async () => {
  const possibleKeys = [
    'deviceId',
    'DEVICE_ID',
    'localDeviceId',
    'sosDeviceId',
  ];

  for (const key of possibleKeys) {
    const value = await AsyncStorage.getItem(key);

    if (value) {
      console.log(`${TAG} ✅ found deviceId using key="${key}" value=${value}`);
      return value;
    }
  }

  console.log(`${TAG} ❌ No existing deviceId found in AsyncStorage`);
  return null;
};

const waitForConnection = async () => {
  for (let i = 1; i <= 10; i++) {
    try {
      const devices = connectionManager.getDevices?.() || [];
      const connected = devices.filter(d => d.isConnected);

      console.log(`${TAG} 🔍 connection attempt ${i}/10`);
      console.log(`${TAG} devices count=${devices.length}`);
      console.log(`${TAG} connected count=${connected.length}`);
      console.log(`${TAG} devices=`, devices);

      if (connected.length > 0) {
        console.log(`${TAG} ✅ connected device found`);
        return true;
      }
    } catch (e) {
      console.log(`${TAG} ⚠️ getDevices failed`, e?.message || e);
    }

    await wait(1000);
  }

  console.log(`${TAG} ⚠️ no connected devices after waiting`);
  return false;
};

module.exports = async (data) => {
  console.log('════════════════════════════════════════════');
  console.log(`${TAG} 🚀 START`);
  console.log(`${TAG} data=`, data);
  console.log('════════════════════════════════════════════');

  try {
    const message = data?.message || 'Help me!!!';
    const target = data?.target || 'local';

    console.log(`${TAG} message="${message}"`);
    console.log(`${TAG} target="${target}"`);

    const deviceId = await getStoredDeviceId();

    if (!deviceId) {
      console.log(`${TAG} ❌ ABORTING — no stored deviceId`);
      console.log(`${TAG} Open the app once first so it creates/stores the deviceId`);
      return;
    }

    console.log(`${TAG} 🔧 Initializing ConnectionManager`);
    if (typeof connectionManager.initialize === 'function') {
      await connectionManager.initialize();
    }

    console.log(`${TAG} 🔧 Initializing MessageService with stored deviceId`);
    messageService.init(connectionManager, deviceId);

    console.log(`${TAG} 🔍 ConnectionManager methods:`);
    console.log(`${TAG} initialize=${typeof connectionManager.initialize}`);
    console.log(`${TAG} setBluetoothEnabled=${typeof connectionManager.setBluetoothEnabled}`);
    console.log(`${TAG} startScanning=${typeof connectionManager.startScanning}`);
    console.log(`${TAG} sendMessage=${typeof connectionManager.sendMessage}`);
    console.log(`${TAG} getDevices=${typeof connectionManager.getDevices}`);

    try {
      if (typeof connectionManager.setBluetoothEnabled === 'function') {
        console.log(`${TAG} 📡 setBluetoothEnabled(true)`);
        await connectionManager.setBluetoothEnabled(true);
      }
    } catch (e) {
      console.log(`${TAG} ⚠️ setBluetoothEnabled failed`, e?.message || e);
    }

    try {
      if (typeof connectionManager.startScanning === 'function') {
        console.log(`${TAG} 🔎 startScanning()`);
        await connectionManager.startScanning();
      }
    } catch (e) {
      console.log(`${TAG} ⚠️ startScanning failed`, e?.message || e);
    }

    await waitForConnection();

    console.log(`${TAG} 🚨 Calling messageService.sendSOS() with skipLocation=true`);

    const packet = await messageService.sendSOS(message, target, {
      skipLocation: true,
      source: 'background-shake',
    });

    console.log(`${TAG} ✅ SOS SENT`);
    console.log(`${TAG} packetId=${packet?.id}`);
    console.log(`${TAG} packet=`, packet);

    await wait(3000);

  } catch (error) {
    console.log(`${TAG} ❌ FAILED`);
    console.error(error);
  }

  console.log(`${TAG} 🏁 END`);
};