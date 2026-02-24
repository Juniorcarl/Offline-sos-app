import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';

import AuthorityDashboard from '../screens/authority/AuthorityDashboard';
import AuthorityOverviewMap from '../screens/authority/AuthorityOverviewMap';
import SettingsScreen from '../screens/shared/SettingsScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import AuthorityControlsScreen from '../screens/authority/AuthorityControlsScreen';
import AuthorityEmergencyAlertsScreen from '../screens/authority/AuthorityEmergencyAlertsScreen';
import AuthorityAboutScreen from '../screens/authority/AuthorityAboutScreen';
import MapScreen from '../screens/authority/MapScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const { width } = Dimensions.get('window');

const TABS = [
  { name: 'Dashboard', icon: 'grid-outline', iconActive: 'grid', label: 'Dashboard' },
  { name: 'Overview', icon: 'map-outline', iconActive: 'map', label: 'Map' },
  { name: 'Settings', icon: 'settings-outline', iconActive: 'settings', label: 'Settings' },
];

const BAR_HORIZONTAL_MARGIN = 20;
const BAR_WIDTH = width - BAR_HORIZONTAL_MARGIN * 2;
const TAB_COUNT = 3;
const TAB_WIDTH = BAR_WIDTH / TAB_COUNT;
const CIRCLE_SIZE = 54;
const BAR_HEIGHT = 64;
const NOTCH_RADIUS = CIRCLE_SIZE / 2 + 6;

function CustomTabBar({ state, navigation }) {
  const { darkMode } = useUser();
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    translateX.setValue(state.index * TAB_WIDTH);
  }, []);

  const handlePress = (index, routeName, isFocused) => {
    if (isFocused) return;
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: index * TAB_WIDTH,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.75, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 6 }),
      ]),
    ]).start();
    navigation.navigate(routeName);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <Animated.View style={[styles.notch, { transform: [{ translateX }] }]} />
        {state.routes.map((route, index) => {
          const tab = TABS[index];
          const isFocused = state.index === index;
          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={() => handlePress(index, route.name, isFocused)}
              activeOpacity={0.7}
            >
              {!isFocused && (
                <Ionicons name={tab.icon} size={24} color="#aaa" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Animated.View style={[styles.activeCircle, { transform: [{ translateX }, { scale: scaleAnim }] }]}>
        <Ionicons
          name={TABS[state.index].iconActive}
          size={24}
          color="#111"
        />
      </Animated.View>
    </View>
  );
}

function AuthorityTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={AuthorityDashboard} />
      <Tab.Screen name="Overview" component={AuthorityOverviewMap} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AuthorityTabs() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AuthorityMain" component={AuthorityTabNavigator} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="AuthorityControls" component={AuthorityControlsScreen} />
      <Stack.Screen name="AuthorityEmergencyAlerts" component={AuthorityEmergencyAlertsScreen} />
      <Stack.Screen name="AuthorityAbout" component={AuthorityAboutScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 28,
    left: BAR_HORIZONTAL_MARGIN,
    width: BAR_WIDTH,
    height: BAR_HEIGHT + CIRCLE_SIZE / 2,
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    backgroundColor: '#1c1c1e',
    borderRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  tab: {
    width: TAB_WIDTH,
    height: BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notch: {
    position: 'absolute',
    top: -(NOTCH_RADIUS * 0.85),
    left: TAB_WIDTH / 2 - NOTCH_RADIUS,
    width: NOTCH_RADIUS * 2,
    height: NOTCH_RADIUS * 2,
    borderRadius: NOTCH_RADIUS,
    backgroundColor: '#f0f0f0',
  },
  activeCircle: {
    position: 'absolute',
    top: 0,
    left: TAB_WIDTH / 2 - CIRCLE_SIZE / 2,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#d64045',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d64045',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 10,
  },
});