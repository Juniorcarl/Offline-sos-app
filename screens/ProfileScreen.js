import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';

const LANGUAGES = ['English', 'Setswana'];
const ROLES = ['User', 'Authority'];

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
  const { name, setName, fontSize, darkMode, clearAllData } = useUser();

  const bg = darkMode ? '#111' : '#faf5f5';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';

  const [editedName, setEditedName] = useState(name);
  const [language, setLanguage] = useState('English');
  const [role, setRole] = useState('User');
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const handleSave = () => {
    if (editedName.trim()) {
      setName(editedName.trim());
      Alert.alert('Saved', 'Your profile has been updated.');
    }
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
            setRole('User');
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backArrow, { color: textColor }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: 20 * fontSize, color: textColor }]}>Profile</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtn, { fontSize: 16 * fontSize }]}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: darkMode ? '#333' : '#e8e0e0' }]}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
        </View>

        {/* Edit Name */}
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

        {/* Language */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.fieldLabel, { fontSize: 11 * fontSize, color: subColor }]}>LANGUAGE</Text>
          <TouchableOpacity style={styles.dropdownRow} onPress={() => setLangModalVisible(true)}>
            <Text style={[styles.dropdownValue, { fontSize: 16 * fontSize, color: textColor }]}>{language}</Text>
            <Text style={[styles.dropdownArrow, { color: subColor }]}>⌄</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Role */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.fieldLabel, { fontSize: 11 * fontSize, color: subColor }]}>EMERGENCY ROLE</Text>
          <TouchableOpacity style={styles.dropdownRow} onPress={() => setRoleModalVisible(true)}>
            <Text style={[styles.dropdownValue, { fontSize: 16 * fontSize, color: textColor }]}>{role}</Text>
            <Text style={[styles.dropdownArrow, { color: subColor }]}>⌄</Text>
          </TouchableOpacity>
        </View>

        {/* Clear All Data */}
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
        title="Select Language"
        fontSize={fontSize}
        darkMode={darkMode}
      />
      <DropdownModal
        visible={roleModalVisible}
        options={ROLES}
        selected={role}
        onSelect={setRole}
        onClose={() => setRoleModalVisible(false)}
        title="Select Emergency Role"
        fontSize={fontSize}
        darkMode={darkMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 60, marginBottom: 24,
  },
  backArrow: { fontSize: 24 },
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
  card: {
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  fieldLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  textInput: { paddingVertical: 4 },
  dropdownRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 4,
  },
  dropdownValue: {},
  dropdownArrow: { fontSize: 18 },
  clearBtn: {
    marginTop: 8, paddingVertical: 16, alignItems: 'center',
    borderRadius: 16, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  clearBtnText: { fontWeight: '700', color: '#d64045' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    borderRadius: 20, width: '80%', paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  modalTitle: {
    fontWeight: '700', color: '#aaa', letterSpacing: 1,
    textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1,
  },
  modalOption: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 16, borderBottomWidth: 1,
  },
  modalOptionText: {},
  checkmark: { fontSize: 16, color: '#d64045', fontWeight: '700' },
});