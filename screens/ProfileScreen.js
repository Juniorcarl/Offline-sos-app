import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import messageService from '../services/MessageService';

const LANGUAGES = ['English', 'Setswana'];

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
    role, setRole,
    adminType, setAdminType,
    fontSize, darkMode,
    clearAllData,
  } = useUser();  

  const bg = darkMode ? '#111' : '#faf5f5';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';

  const [editedName, setEditedName] = useState(name);
  const [language, setLanguage] = useState('English');
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState(role);
  const [editedAdminType, setEditedAdminType] = useState(adminType);

  const handleSave = () => {
    if (editedName.trim()) {
      setName(editedName.trim());
      setRole(selectedRole);
      const finalAdminType = selectedRole === 'Authority' ? editedAdminType.trim() : '';
      setAdminType(finalAdminType);
      messageService.setLocalRole(selectedRole, finalAdminType);
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
            setSelectedRole('User');
            setEditedAdminType('');
            messageService.setLocalRole('User', '');
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
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
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
          <Text style={[styles.fieldLabel, { fontSize: 11 * fontSize, color: subColor }]}>ROLE</Text>
          <View style={styles.roleToggleRow}>
            <TouchableOpacity
              style={[
                styles.roleBtn,
                selectedRole === 'User' && styles.roleBtnActive,
                { borderColor: selectedRole === 'User' ? '#d64045' : (darkMode ? '#444' : '#ddd') },
              ]}
              onPress={() => setSelectedRole('User')}
            >
              <Ionicons
                name="person-outline"
                size={15}
                color={selectedRole === 'User' ? '#d64045' : subColor}
              />
              <Text style={[
                styles.roleBtnText,
                { fontSize: 14 * fontSize, color: selectedRole === 'User' ? '#d64045' : subColor },
                selectedRole === 'User' && { fontWeight: '700' },
              ]}>
                User
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleBtn,
                selectedRole === 'Authority' && styles.roleBtnActive,
                { borderColor: selectedRole === 'Authority' ? '#d64045' : (darkMode ? '#444' : '#ddd') },
              ]}
              onPress={() => setSelectedRole('Authority')}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={15}
                color={selectedRole === 'Authority' ? '#d64045' : subColor}
              />
              <Text style={[
                styles.roleBtnText,
                { fontSize: 14 * fontSize, color: selectedRole === 'Authority' ? '#d64045' : subColor },
                selectedRole === 'Authority' && { fontWeight: '700' },
              ]}>
                Authority
              </Text>
            </TouchableOpacity>
          </View>

          {selectedRole === 'Authority' && (
            <View style={styles.adminTypeSection}>
              <Text style={[styles.adminTypeLabel, { fontSize: 11 * fontSize, color: subColor }]}>
                AUTHORITY TYPE (e.g. Security Police, Medics)
              </Text>
              <TextInput
                style={[
                  styles.adminTypeInput,
                  {
                    fontSize: 15 * fontSize,
                    color: textColor,
                    borderColor: darkMode ? '#444' : '#e8e0e0',
                    backgroundColor: darkMode ? '#2a2a2a' : '#faf5f5',
                  },
                ]}
                value={editedAdminType}
                onChangeText={setEditedAdminType}
                placeholder="Describe your role..."
                placeholderTextColor={subColor}
                maxLength={60}
              />
            </View>
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
  card: {
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  fieldLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  textInput: { paddingVertical: 4 },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  dropdownValue: {},
  roleToggleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
  },
  roleBtnActive: { backgroundColor: 'rgba(214,64,69,0.07)' },
  roleBtnText: {},
  adminTypeSection: { marginTop: 14 },
  adminTypeLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  adminTypeInput: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, marginTop: 2,
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