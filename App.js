import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { UserProvider } from './context/UserContext';
import PermissionManager from './services/PermissionManager';
import BottomTabs from './navigation/BottomTabs';
import notificationService from './services/NotificationService';

export default function App() {
  const [permissionsReady, setPermissionsReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await notificationService.requestPermissions();
        await PermissionManager.requestAll();
      } catch (e) {
        console.error('Permission init error:', e);
      } finally {
        setPermissionsReady(true);
      }
    }

    init();
  }, []);

  if (!permissionsReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#d64045" />
      </View>
    );
  }

  return (
    <UserProvider>
      <NavigationContainer>
        <BottomTabs />
      </NavigationContainer>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#faf5f5',
  },
});