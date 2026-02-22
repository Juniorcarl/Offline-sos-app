import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import MessagesScreen from '../screens/MessagesScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

const ICONS = {
  Home: ({ active }) => (
    <Ionicons name={active ? 'home' : 'home-outline'} size={24} color={active ? '#111' : '#aaa'} />
  ),
  Messages: ({ active }) => (
    <Ionicons name={active ? 'chatbubble' : 'chatbubble-outline'} size={24} color={active ? '#111' : '#aaa'} />
  ),
  Settings: ({ active }) => (
    <Ionicons name={active ? 'settings' : 'settings-outline'} size={24} color={active ? '#111' : '#aaa'} />
  ),
};

const TAB_COUNT = 3;
const BAR_HORIZONTAL_MARGIN = 20;
const BAR_WIDTH = width - BAR_HORIZONTAL_MARGIN * 2;
const TAB_WIDTH = BAR_WIDTH / TAB_COUNT;
const CIRCLE_SIZE = 54;
const BAR_HEIGHT = 64;
const NOTCH_RADIUS = CIRCLE_SIZE / 2 + 6;

function CustomTabBar({ state, descriptors, navigation }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const activeIndex = state.index;

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
        Animated.timing(scaleAnim, {
          toValue: 0.75,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 6,
        }),
      ]),
    ]).start();

    navigation.navigate(routeName);
  };

  React.useEffect(() => {
    translateX.setValue(activeIndex * TAB_WIDTH);
  }, []);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <Animated.View
          style={[
            styles.notch,
            {
              transform: [{ translateX }],
            },
          ]}
        />

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const Icon = ICONS[route.name] || ICONS.Home;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => handlePress(index, route.name, isFocused)}
              activeOpacity={0.7}
              style={styles.tab}
            >
              {!isFocused && <Icon active={false} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <Animated.View
        style={[
          styles.activeCircle,
          {
            transform: [{ translateX }, { scale: scaleAnim }],
          },
        ]}
      >
        {state.routes[activeIndex] && (() => {
          const Icon = ICONS[state.routes[activeIndex].name] || ICONS.Home;
          return <Icon active={true} />;
        })()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 28,
    left: BAR_HORIZONTAL_MARGIN,
    width: BAR_WIDTH,
    height: BAR_HEIGHT + CIRCLE_SIZE / 2,
    alignItems: 'flex-end',
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
    backgroundColor: '#39e84e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#39e84e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 10,
  },
});

export default function BottomTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}