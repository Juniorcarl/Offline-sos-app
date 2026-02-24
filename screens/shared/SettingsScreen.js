import React from 'react';
import {
  View, Text, ScrollView,
  TouchableOpacity, Switch, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { name, fontSize, darkMode, setDarkMode, role, authorityType } = useUser();

  const bg = darkMode ? '#111' : '#faf5f5';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#aaa' : '#999';
  const borderColor = darkMode ? '#2a2a2a' : '#f2f2f2';

  const isAuthority = role === 'Authority';

  const sections = [
    { icon: 'moon-outline', label: 'Dark Mode', isDarkMode: true },
    { icon: 'person-outline', label: 'Profile', screen: 'Profile' },
    {
      icon: 'notifications-outline', label: 'Emergency Alerts',
      screen: isAuthority ? 'AuthorityEmergencyAlerts' : 'EmergencyAlerts',
    },
    {
      icon: 'options-outline', label: 'Controls',
      screen: isAuthority ? 'AuthorityControls' : 'Controls',
    },
    {
      icon: 'information-circle-outline', label: 'About',
      screen: isAuthority ? 'AuthorityAbout' : 'About',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.headerTitle, { fontSize: 26 * fontSize, color: textColor }]}>
          Settings
        </Text>

        <View style={styles.profileSection}>
          <View style={[styles.avatarCircle, { backgroundColor: darkMode ? '#333' : '#e8e0e0' }]}>
            <Text style={styles.avatarIcon}>{isAuthority ? '👮' : '👤'}</Text>
          </View>
          <Text style={[styles.profileName, { fontSize: 20 * fontSize, color: textColor }]}>
            {name}
          </Text>
          {isAuthority && (
            <View style={styles.authorityBadge}>
              <Text style={[styles.authorityBadgeText, { fontSize: 11 * fontSize }]}>
                🔐 {authorityType || 'AUTHORITY'}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {sections.map((item, index) => {
            const isLast = index === sections.length - 1;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: borderColor }]}
                onPress={() => item.screen && navigation.navigate(item.screen)}
                activeOpacity={item.isDarkMode ? 1 : 0.6}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name={item.icon} size={20} color={textColor} />
                  <Text style={[styles.rowLabel, { fontSize: 15 * fontSize, color: textColor }]}>
                    {item.label}
                  </Text>
                </View>
                {item.isDarkMode ? (
                  <Switch
                    value={darkMode}
                    onValueChange={setDarkMode}
                    trackColor={{ false: '#ddd', true: '#d64045' }}
                    thumbColor="#fff"
                  />
                ) : (
                  <Text style={[styles.chevron, { color: subColor }]}>›</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  headerTitle: { fontWeight: '700', marginTop: 60, marginBottom: 24 },
  profileSection: { alignItems: 'center', marginBottom: 32 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  avatarIcon: { fontSize: 44 },
  profileName: { fontWeight: '700', marginBottom: 8 },
  authorityBadge: {
    backgroundColor: '#d64045', paddingHorizontal: 14,
    paddingVertical: 4, borderRadius: 20,
  },
  authorityBadgeText: { color: '#fff', fontWeight: '700', letterSpacing: 1 },
  card: {
    borderRadius: 16, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2, overflow: 'hidden',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { fontSize: 18 },
  rowLabel: { fontWeight: '500' },
  chevron: { fontSize: 22 },
});