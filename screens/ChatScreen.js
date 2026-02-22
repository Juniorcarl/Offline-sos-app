import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const DUMMY_MESSAGES = [
  {
    id: '1',
    type: 'text',
    text: 'Fell hiking - injured ankle, need help ASAP',
    fromMe: false,
    time: '2:14 PM',
    hops: 1,
  },
  {
    id: '2',
    type: 'text',
    text: 'We are on our way, stay where you are',
    fromMe: true,
    time: '2:15 PM',
    hops: 1,
  },
  {
    id: '3',
    type: 'location',
    text: '📍 Location shared',
    fromMe: false,
    time: '2:16 PM',
    hops: 1,
    coords: '37.7749° N, 122.4194° W',
  },
];

function MessageBubble({ msg }) {
  const isMe = msg.fromMe;
  const isSOS = msg.type === 'sos';
  const isLocation = msg.type === 'location';

  return (
    <View
      style={[
        styles.bubbleWrapper,
        isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
      ]}
    >
      {isSOS && (
        <View style={styles.sosBubble}>
          <Text style={styles.sosIcon}>🚨</Text>
          <Text style={styles.sosText}>SOS ALERT SENT</Text>
          <Text style={styles.sosSubText}>Emergency services notified via mesh</Text>
        </View>
      )}

      {isLocation && (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, styles.locationBubble]}>
          <Text style={styles.locationIcon}>📍</Text>
          <View>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>Location shared</Text>
            <Text style={styles.coordsText}>{msg.coords}</Text>
          </View>
        </View>
      )}

      {!isSOS && !isLocation && (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {msg.text}
          </Text>
        </View>
      )}

      <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeRight]}>
        {msg.hops > 1 ? `↻ ${msg.hops} hops · ` : ''}{msg.time}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // These come from navigation params when you wire up MessagesScreen
  const name = route.params?.name ?? 'Sarah Chen';
  const distance = route.params?.distance ?? '0.2mi';

  const [messages, setMessages] = useState(DUMMY_MESSAGES);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef(null);

  const sendMessage = (type = 'text', override = null) => {
    const text = override ?? inputText.trim();
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
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSOS = () => {
    Alert.alert(
      '🚨 Send SOS Alert',
      'This will broadcast an emergency SOS to all nearby mesh devices. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SEND SOS',
          style: 'destructive',
          onPress: () => sendMessage('sos', 'SOS ALERT'),
        },
      ]
    );
  };

  const handleLocation = () => {
    sendMessage('location', '📍 Location shared');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{name}</Text>
          <Text style={styles.headerMeta}>📍 {distance} away · Mesh connected</Text>
        </View>

        {/* Live indicator */}
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
          <MessageBubble key={msg.id} msg={msg} />
        ))}
      </ScrollView>

      {/* Compose bar */}
      <View style={styles.composeBar}>
        {/* SOS button */}
        <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
          <Text style={styles.sosBtnText}>SOS</Text>
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#aaa"
          multiline
          maxLength={300}
        />

        {/* Location pin */}
        <TouchableOpacity style={styles.iconBtn} onPress={handleLocation}>
          <Text style={styles.iconBtnText}>📍</Text>
        </TouchableOpacity>

        {/* Send */}
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtn: {
    paddingRight: 12,
  },
  backArrow: {
    fontSize: 24,
    color: '#1a1a1a',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#d64045',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d64045',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 20,
  },
  bubbleWrapper: {
    marginBottom: 14,
    maxWidth: '75%',
  },
  bubbleWrapperLeft: {
    alignSelf: 'flex-start',
  },
  bubbleWrapperRight: {
    alignSelf: 'flex-end',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: '#d64045',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#fff',
  },
  bubbleTime: {
    fontSize: 10,
    color: '#bbb',
    marginTop: 4,
    marginLeft: 4,
  },
  bubbleTimeRight: {
    textAlign: 'right',
    marginRight: 4,
  },
  sosBubble: {
    backgroundColor: '#d64045',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: 220,
  },
  sosIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  sosText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  sosSubText: {
    color: '#ffcccc',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  locationBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationIcon: {
    fontSize: 22,
  },
  coordsText: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  composeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  sosBtn: {
    backgroundColor: '#d64045',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sosBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  input: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
    maxHeight: 100,
  },
  iconBtn: {
    padding: 6,
  },
  iconBtnText: {
    fontSize: 22,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#d64045',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#ddd',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});