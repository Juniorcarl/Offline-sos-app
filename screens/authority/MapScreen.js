import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

export default function MapScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { darkMode, fontSize } = useUser();

  const {
    latitude,
    longitude,
    name,
    location,
    type,
    distance,
  } = route.params;

  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const priorityColor = '#d64045';

  return (
    <View style={styles.container}>

      {/* Map */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        mapType="standard"
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* Incident marker */}
        <Marker
          coordinate={{ latitude, longitude }}
          title={name}
          description={type}
        >
          <View style={styles.markerContainer}>
            <View style={styles.markerBubble}>
              <Ionicons name="warning" size={16} color="#fff" />
            </View>
            <View style={styles.markerTail} />
          </View>
        </Marker>

        {/* Radius circle */}
        <Circle
          center={{ latitude, longitude }}
          radius={150}
          fillColor="rgba(214, 64, 69, 0.1)"
          strokeColor="rgba(214, 64, 69, 0.4)"
          strokeWidth={1.5}
        />
      </MapView>

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: cardBg }]}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={22} color={textColor} />
      </TouchableOpacity>

      {/* Info card at bottom */}
      <View style={[styles.infoCard, { backgroundColor: cardBg }]}>

        {/* Incident type badge */}
        <View style={styles.typeBadge}>
          <Ionicons name="warning-outline" size={13} color={priorityColor} />
          <Text style={[styles.typeText, { fontSize: 12 * fontSize, color: priorityColor }]}>
            {type}
          </Text>
        </View>

        {/* Name */}
        <Text style={[styles.incidentName, { fontSize: 18 * fontSize, color: textColor }]}>
          {name}
        </Text>

        {/* Location row */}
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={15} color={subColor} />
          <Text style={[styles.detailText, { fontSize: 13 * fontSize, color: subColor }]}>
            {location}
          </Text>
        </View>

        {/* Distance row */}
        <View style={styles.detailRow}>
          <Ionicons name="navigate-outline" size={15} color={subColor} />
          <Text style={[styles.detailText, { fontSize: 13 * fontSize, color: subColor }]}>
            {distance} from your location
          </Text>
        </View>

        {/* Coordinates row */}
        <View style={styles.detailRow}>
          <Ionicons name="globe-outline" size={15} color={subColor} />
          <Text style={[styles.detailText, { fontSize: 12 * fontSize, color: subColor }]}>
            {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
          </Text>
        </View>

        {/* Chat button */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => navigation.navigate('Chat', { name, distance })}
        >
          <Ionicons name="chatbubble-outline" size={16} color="#fff" />
          <Text style={[styles.chatBtnText, { fontSize: 14 * fontSize }]}>
            Open Chat with {name.split(' ')[0]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    width: 42, height: 42,
    borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  markerContainer: { alignItems: 'center' },
  markerBubble: {
    backgroundColor: '#d64045',
    width: 36, height: 36,
    borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#d64045', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
  },
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#d64045',
    marginTop: -1,
  },
  infoCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
  },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  typeText: { fontWeight: '600' },
  incidentName: { fontWeight: '800', marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailText: { flex: 1 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#d64045',
    borderRadius: 14, paddingVertical: 14,
    marginTop: 16,
  },
  chatBtnText: { color: '#fff', fontWeight: '700' },
});