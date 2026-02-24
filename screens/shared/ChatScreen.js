import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

const DUMMY_MESSAGES = [
  {
    id: '1', type: 'text',
    text: 'Fell hiking - injured ankle, need help ASAP',
    fromMe: false, time: '2:14 PM', hops: 1,
  },
  {
    id: '2', type: 'text',
    text: 'We are on our way, stay where you are',
    fromMe: true, time: '2:15 PM', hops: 1,
  },
  {
    id: '3', type: 'location',
    text: '📍 Location shared', fromMe: false,
    time: '2:16 PM', hops: 1,
    coords: '37.7749° N, 122.4194° W',
  },
];

function MessageBubble({ msg, darkMode }) {
  const isMe = msg.fromMe;
  const isSOS = msg.type === 'sos';
  const isLocation = msg.type === 'location';
  const bubbleThem = darkMode ? '#2a2a2a' : '#fff';
  const bubbleThemText = darkMode ? '#fff' : '#1a1a1a';
  const timeColor = darkMode ? '#666' : '#bbb';
  const coordsColor = darkMode ? '#888' : '#888';

  return (
    <View style={[styles.bubbleWrapper, isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
      {isSOS && (
        <View style={styles.sosBubble}>
          <Text style={styles.sosIcon}>🚨</Text>
          <Text style={styles.sosText}>SOS ALERT SENT</Text>
          <Text style={styles.sosSubText}>Emergency services notified via mesh</Text>
        </View>
      )}

      {isLocation && (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : [styles.bubbleThem, { backgroundColor: bubbleThem }], styles.locationBubble]}>
          <Text style={styles.locationIcon}>📍</Text>
          <View>
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : { color: bubbleThemText }]}>
              Location shared
            </Text>
            <Text style={[styles.coordsText, { color: coordsColor }]}>{msg.coords}</Text>
          </View>
        </View>
      )}

      {!isSOS && !isLocation && (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : [styles.bubbleThem, { backgroundColor: bubbleThem }]]}>
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : { color: bubbleThemText }]}>
            {msg.text}
          </Text>
        </View>
      )}

      <Text style={[styles.bubbleTime, { color: timeColor }, isMe && styles.bubbleTimeRight]}>
        {msg.hops > 1 ? `↻ ${msg.hops} hops · ` : ''}{msg.time}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { darkMode, fontSize, role } = useUser();

  const name = route.params?.name ?? 'Sarah Chen';
  const distance = route.params?.distance ?? '0.2mi';

  const bg = darkMode ? '#111' : '#faf5f5';
  const headerBg = darkMode ? '#1a1a1a' : '#fff';
  const headerBorder = darkMode ? '#2a2a2a' : '#eee';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#888';
  const inputBg = darkMode ? '#2a2a2a' : '#f2f2f2';
  const inputText = darkMode ? '#fff' : '#1a1a1a';
  const composeBg = darkMode ? '#1a1a1a' : '#fff';
  const composeBorder = darkMode ? '#2a2a2a' : '#eee';

  const [messages, setMessages] = useState(DUMMY_MESSAGES);
  const [inputTextVal, setInputTextVal] = useState('');
  const scrollRef = useRef(null);

  const sendMessage = (type = 'text', override = null) => {
    const text = override ?? inputTextVal.trim();
    if (!text && type === 'text') return;

    const newMsg = {
      id: Date.now().toString(),
      type,
      text,
      fromMe: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hops: 1,
      ...(type === 'location' && { coords: '37.7749° N, 122.4194° W' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputTextVal('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSOS = () => {
    Alert.alert(
      '🚨 Send SOS Alert',
      'This will broadcast an emergency SOS to all nearby mesh devices. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'SEND SOS', style: 'destructive', onPress: () => sendMessage('sos', 'SOS ALERT') },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: textColor }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { fontSize: 17 * fontSize, color: textColor }]}>{name}</Text>
          <Text style={[styles.headerMeta, { fontSize: 12 * fontSize, color: subColor }]}>
            📍 {distance} away · Mesh connected
          </Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} darkMode={darkMode} />
        ))}
      </ScrollView>

      {/* Compose bar */}
      <View style={[styles.composeBar, { backgroundColor: composeBg, borderTopColor: composeBorder }]}>
        {/* Only show SOS button for civilian users */}
        {role !== 'Authority' && (
          <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: inputBg, color: inputText }]}
          value={inputTextVal}
          onChangeText={setInputTextVal}
          placeholder="Type a message..."
          placeholderTextColor={darkMode ? '#555' : '#aaa'}
          multiline
          maxLength={300}
        />

        <TouchableOpacity style={styles.iconBtn} onPress={() => sendMessage('location', '📍 Location shared')}>
          <Text style={styles.iconBtnText}>📍</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendBtn, !inputTextVal.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!inputTextVal.trim()}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  backBtn: { paddingRight: 12 },
  backArrow: { fontSize: 24 },
  headerInfo: { flex: 1 },
  headerName: { fontWeight: '700' },
  headerMeta: { marginTop: 2 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#d64045' },
  liveText: { fontSize: 11, fontWeight: '700', color: '#d64045' },
  messageList: { paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 20 },
  bubbleWrapper: { marginBottom: 14, maxWidth: '75%' },
  bubbleWrapperLeft: { alignSelf: 'flex-start' },
  bubbleWrapperRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: '#d64045', borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, marginTop: 4, marginLeft: 4 },
  bubbleTimeRight: { textAlign: 'right', marginRight: 4 },
  sosBubble: { backgroundColor: '#d64045', borderRadius: 16, padding: 16, alignItems: 'center', width: 220 },
  sosIcon: { fontSize: 28, marginBottom: 4 },
  sosText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  sosSubText: { color: '#ffcccc', fontSize: 11, marginTop: 4, textAlign: 'center' },
  locationBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  locationIcon: { fontSize: 22 },
  coordsText: { fontSize: 11, marginTop: 2 },
  composeBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 10, borderTopWidth: 1, gap: 8 },
  sosBtn: { backgroundColor: '#d64045', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  sosBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 22 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#d64045', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ddd' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});