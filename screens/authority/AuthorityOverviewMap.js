import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Platform, ScrollView,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

const MOCK_INCIDENTS = [
  {
    id: '1', name: 'Kefilwe Moyo', type: 'Medical Emergency',
    distance: '0.3km', time: '2 min ago', priority: 'high',
    location: 'Gaborone, Block 6',
    latitude: -24.6282, longitude: 25.9231,
    message: 'I have been in an accident, I need help urgently',
  },
  {
    id: '2', name: 'Thabo Sithole', type: 'Fire Reported',
    distance: '0.8km', time: '5 min ago', priority: 'high',
    location: 'Gaborone, Extension 9',
    latitude: -24.6350, longitude: 25.9180,
    message: 'There is a fire at the building next to me',
  },
];

// Center map between all incidents
const MAP_CENTER = {
  latitude: -24.6316,
  longitude: 25.9206,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

function IncidentCallout({ incident, onChat, onClose, darkMode, fontSize }) {
  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const borderColor = darkMode ? '#2a2a2a' : '#f2f2f2';
  const priorityColor = incident.priority === 'high' ? '#d64045' : '#f5a623';

  return (
    <View style={[styles.callout, { backgroundColor: cardBg }]}>
      {/* Close */}
      <TouchableOpacity style={styles.calloutClose} onPress={onClose}>
        <Ionicons name="close" size={18} color={subColor} />
      </TouchableOpacity>

      {/* Type badge */}
      <View style={styles.calloutTypeRow}>
        <Ionicons name="warning-outline" size={12} color={priorityColor} />
        <Text style={[styles.calloutType, { fontSize: 11 * fontSize, color: priorityColor }]}>
          {incident.type}
        </Text>
      </View>

      {/* Name */}
      <Text style={[styles.calloutName, { fontSize: 15 * fontSize, color: textColor }]}>
        {incident.name}
      </Text>

      {/* Location */}
      <View style={styles.calloutRow}>
        <Ionicons name="location-outline" size={13} color={subColor} />
        <Text style={[styles.calloutSub, { fontSize: 12 * fontSize, color: subColor }]}>
          {incident.location} · {incident.distance}
        </Text>
      </View>

      {/* Time */}
      <View style={[styles.calloutRow, { borderTopWidth: 1, borderTopColor: borderColor, marginTop: 8, paddingTop: 8 }]}>
        <Ionicons name="time-outline" size={13} color={subColor} />
        <Text style={[styles.calloutSub, { fontSize: 12 * fontSize, color: subColor }]}>
          {incident.time}
        </Text>
      </View>

      {/* Message preview */}
      <Text
        style={[styles.calloutMessage, { fontSize: 12 * fontSize, color: subColor }]}
        numberOfLines={2}
      >
        "{incident.message}"
      </Text>

      {/* Chat button */}
      <TouchableOpacity style={styles.calloutChatBtn} onPress={onChat}>
        <Ionicons name="chatbubble-outline" size={14} color="#fff" />
        <Text style={[styles.calloutChatText, { fontSize: 13 * fontSize }]}>Open Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AuthorityOverviewMap() {
  const navigation = useNavigation();
  const { darkMode, fontSize } = useUser();
  const mapRef = useRef(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const textColor = darkMode ? '#fff' : '#1a1a1a';
  const subColor = darkMode ? '#888' : '#aaa';
  const cardBg = darkMode ? '#1e1e1e' : '#fff';

  const handleMarkerPress = (incident) => {
    setSelectedIncident(incident);
    mapRef.current?.animateToRegion({
      latitude: incident.latitude - 0.004,
      longitude: incident.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    }, 400);
  };

  const handleRecenter = () => {
    setSelectedIncident(null);
    mapRef.current?.animateToRegion(MAP_CENTER, 400);
  };

  return (
    <View style={styles.container}>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={MAP_CENTER}
        mapType="standard"
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {MOCK_INCIDENTS.map((incident) => {
          const priorityColor = incident.priority === 'high' ? '#d64045' : '#f5a623';
          const isSelected = selectedIncident?.id === incident.id;
          return (
            <React.Fragment key={incident.id}>
              <Circle
                center={{ latitude: incident.latitude, longitude: incident.longitude }}
                radius={120}
                fillColor={incident.priority === 'high' ? 'rgba(214,64,69,0.1)' : 'rgba(245,166,35,0.1)'}
                strokeColor={incident.priority === 'high' ? 'rgba(214,64,69,0.35)' : 'rgba(245,166,35,0.35)'}
                strokeWidth={1.5}
              />
              <Marker
                coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
                onPress={() => handleMarkerPress(incident)}
              >
                <View style={styles.markerContainer}>
                  <View style={[
                    styles.markerBubble,
                    { backgroundColor: priorityColor },
                    isSelected && styles.markerBubbleSelected,
                  ]}>
                    <Ionicons name="warning" size={isSelected ? 18 : 14} color="#fff" />
                  </View>
                  <View style={[styles.markerTail, { borderTopColor: priorityColor }]} />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Header overlay */}
      <View style={[styles.headerOverlay, { backgroundColor: cardBg }]}>
        <Text style={[styles.headerTitle, { fontSize: 16 * fontSize, color: textColor }]}>
          Live Incident Map
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.networkDot} />
          <Text style={[styles.headerSub, { fontSize: 11 * fontSize, color: '#2e7d32' }]}>
            {MOCK_INCIDENTS.length} active
          </Text>
        </View>
      </View>

      {/* Recenter button */}
      <TouchableOpacity
        style={[styles.recenterBtn, { backgroundColor: cardBg }]}
        onPress={handleRecenter}
      >
        <Ionicons name="locate-outline" size={22} color={textColor} />
      </TouchableOpacity>

      {/* Incident callout */}
      {selectedIncident && (
        <IncidentCallout
          incident={selectedIncident}
          darkMode={darkMode}
          fontSize={fontSize}
          onClose={() => setSelectedIncident(null)}
          onChat={() => navigation.navigate('Chat', {
            name: selectedIncident.name,
            distance: selectedIncident.distance,
          })}
        />
      )}

      {/* Legend when no incident selected */}
      {!selectedIncident && (
        <View style={[styles.legend, { backgroundColor: cardBg }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#d64045' }]} />
            <Text style={[styles.legendText, { fontSize: 11 * fontSize, color: subColor }]}>High Priority</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f5a623' }]} />
            <Text style={[styles.legendText, { fontSize: 11 * fontSize, color: subColor }]}>Medium Priority</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2196f3' }]} />
            <Text style={[styles.legendText, { fontSize: 11 * fontSize, color: subColor }]}>Your Location</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  headerTitle: { fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  networkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50' },
  headerSub: { fontWeight: '600' },

  recenterBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    right: 20,
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },

  markerContainer: { alignItems: 'center' },
  markerBubble: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  markerBubbleSelected: {
    width: 42, height: 42, borderRadius: 21,
  },
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },

  callout: {
    position: 'absolute',
    bottom: 100, left: 20, right: 20,
    borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
  },
  calloutClose: { position: 'absolute', top: 14, right: 14, padding: 4 },
  calloutTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  calloutType: { fontWeight: '600' },
  calloutName: { fontWeight: '800', marginBottom: 8 },
  calloutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  calloutSub: {},
  calloutMessage: { fontStyle: 'italic', marginTop: 8, marginBottom: 12 },
  calloutChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#d64045',
    borderRadius: 12, paddingVertical: 12,
  },
  calloutChatText: { color: '#fff', fontWeight: '700' },

  legend: {
    position: 'absolute',
    bottom: 100, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'center', gap: 20,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontWeight: '500' },
});