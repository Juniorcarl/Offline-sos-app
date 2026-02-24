import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

const LANGUAGES = ['English', 'Setswana'];

const AUTHORITY_TYPES = [
  'Police Officer',
  'Paramedic / Ambulance',
  'Fire Department',
  'Disaster Management',
  'Military',
  'Hospital Staff',
  'Other Emergency Responder',
];

function DropdownModal({ visible, options, selected, onSelect, onClose, title, fontSize, darkMode }) {
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const borderColor = darkMode ? '#2a2a2a' : '#f2f2f2';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.modalTitle, { fontSize: 13 * fontSize, borderBottomColor: borderColor }]}>
            {title}
          </Text>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.modalOption,
                { borderBottomColor: borderColor },
                selected === option && { backgroundColor: darkMode ? '#2a1a1a' : '#fff5f5' },
              ]}
              onPress={() => { onSelect(option); onClose(); }}
            >
              <Text style={[
                styles.modalOptionText,
                { fontSize: 16 * fontSize, color: textColor },
                selected === option && { color: '#d64045', fontWeight: '600' },
              ]}>
                {option}
              </Text>
              {selected === option && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const {
    name, setName,
    fontSize, darkMode,
    clearAllData,
    role, setRole,
    authorityType, setAuthorityType,
  } = useUser();

  const bg = darkMode ? '#111' : '#faf5f5';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';

  const [editedName, setEditedName] = useState(name);
  const [language, setLanguage] = useState('English');
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [authorityTypeModal, setAuthorityTypeModal] = useState(false);

  const isAuthority = role === 'Authority';

  const handleSave = () => {
    if (editedName.trim()) {
      setName(editedName.trim());
      Alert.alert('Saved', 'Your profile has been updated.');
    }
  };

  const handleSwitchToAuthority = () => {
    setAuthorityTypeModal(true);
  };

  const handleSwitchToUser = () => {
    Alert.alert(
      'Switch to User',
      'You will lose authority access. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            setRole('User');
            setAuthorityType('');
          },
        },
      ]
    );
  };

  const handleAuthorityTypeSelected = (type) => {
    Alert.alert(
      '👮 Authority Access Granted',
      `You are now set as ${type}.\n\nBy confirming this role you take full responsibility for appropriate use of authority features.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Understood',
          onPress: () => {
            setAuthorityType(type);
            setRole('Authority');
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will reset all your settings and data permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            setEditedName('Your Name');
            setLanguage('English');
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: 20 * fontSize, color: textColor }]}>Profile</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtn, { fontSize: 16 * fontSize }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: darkMode ? '#333' : '#e8e0e0' }]}>
            <Text style={styles.avatarIcon}>{isAuthority ? '👮' : '👤'}</Text>
          </View>
          {isAuthority && (
            <View style={styles.authorityBadge}>
              <Text style={[styles.authorityBadgeText, { fontSize: 11 * fontSize }]}>
                🔐 {authorityType}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.fieldLabel, { fontSize: 11 * fontSize, color: subColor }]}>NAME</Text>
          <TextInput
            style={[styles.textInput, { fontSize: 16 * fontSize, color: textColor }]}
            value={editedName}
            onChangeText={setEditedName}
            placeholder="Enter your name"
            placeholderTextColor={subColor}
            maxLength={40}
          />
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.fieldLabel, { fontSize: 11 * fontSize, color: subColor }]}>LANGUAGE</Text>
          <TouchableOpacity style={styles.dropdownRow} onPress={() => setLangModalVisible(true)}>
            <Text style={[styles.dropdownValue, { fontSize: 16 * fontSize, color: textColor }]}>{language}</Text>
            <Ionicons name="chevron-down" size={18} color={subColor} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.fieldLabel, { fontSize: 11 * fontSize, color: subColor }]}>EMERGENCY ROLE</Text>
          <View style={styles.roleToggleRow}>
            <TouchableOpacity
              style={[
                styles.roleToggleBtn,
                { backgroundColor: darkMode ? '#2a2a2a' : '#f2f2f2' },
                !isAuthority && styles.roleToggleBtnActive,
              ]}
              onPress={isAuthority ? handleSwitchToUser : null}
            >
              <Text style={[
                styles.roleToggleText,
                { fontSize: 14 * fontSize },
                !isAuthority && styles.roleToggleTextActive,
              ]}>
                👤 User
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleToggleBtn,
                { backgroundColor: darkMode ? '#2a2a2a' : '#f2f2f2' },
                isAuthority && styles.roleToggleBtnActive,
              ]}
              onPress={!isAuthority ? handleSwitchToAuthority : null}
            >
              <Text style={[
                styles.roleToggleText,
                { fontSize: 14 * fontSize },
                isAuthority && styles.roleToggleTextActive,
              ]}>
                👮 Authority
              </Text>
            </TouchableOpacity>
          </View>

          {isAuthority && (
            <TouchableOpacity
              style={[styles.authorityTypeRow, { borderTopColor: darkMode ? '#2a2a2a' : '#f0f0f0' }]}
              onPress={() => setAuthorityTypeModal(true)}
            >
              <Text style={[{ fontSize: 13 * fontSize, color: '#d64045', fontWeight: '600' }]}>
                {authorityType}
              </Text>
              <Ionicons name="chevron-down" size={18} color={subColor} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.clearBtn, { backgroundColor: cardBg }]}
          onPress={handleClearData}
        >
          <Text style={[styles.clearBtnText, { fontSize: 15 * fontSize }]}>Clear All Data</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <DropdownModal
        visible={langModalVisible}
        options={LANGUAGES}
        selected={language}
        onSelect={setLanguage}
        onClose={() => setLangModalVisible(false)}
        title="SELECT LANGUAGE"
        fontSize={fontSize}
        darkMode={darkMode}
      />

      <DropdownModal
        visible={authorityTypeModal}
        options={AUTHORITY_TYPES}
        selected={authorityType}
        onSelect={(type) => {
          setAuthorityTypeModal(false);
          handleAuthorityTypeSelected(type);
        }}
        onClose={() => setAuthorityTypeModal(false)}
        title="SELECT AUTHORITY TYPE"
        fontSize={fontSize}
        darkMode={darkMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 24 },
  headerTitle: { fontWeight: '700' },
  saveBtn: { fontWeight: '600', color: '#d64045' },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  avatarIcon: { fontSize: 44 },
  authorityBadge: {
    marginTop: 8, backgroundColor: '#d64045',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  authorityBadgeText: { color: '#fff', fontWeight: '700', letterSpacing: 1 },
  card: {
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  fieldLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  textInput: { paddingVertical: 4 },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  dropdownValue: {},
  roleToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  roleToggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  roleToggleBtnActive: { backgroundColor: '#d64045' },
  roleToggleText: { fontWeight: '600', color: '#aaa' },
  roleToggleTextActive: { color: '#fff' },
  authorityTypeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 10,
    borderTopWidth: 1, paddingTop: 10,
  },
  clearBtn: {
    marginTop: 8, paddingVertical: 16, alignItems: 'center',
    borderRadius: 16, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  clearBtnText: { fontWeight: '700', color: '#d64045' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    borderRadius: 20, width: '80%', paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  modalTitle: { fontWeight: '700', color: '#aaa', letterSpacing: 1, textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalOptionText: {},
  checkmark: { fontSize: 16, color: '#d64045', fontWeight: '700' },
});