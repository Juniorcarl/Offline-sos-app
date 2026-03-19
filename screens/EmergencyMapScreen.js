import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import PermissionManager from '../services/PermissionManager';

// ── Haversine distance calculator ─────────────────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const metres = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return metres < 1000 ? `${Math.round(metres)}m` : `${(metres / 1000).toFixed(1)}km`;
}

export default function EmergencyMapScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Accept pre-fetched location from HomeScreen so map centres instantly
  const passedLocation = route.params?.userLocation ?? null;
  const messages = route.params?.messages || [];

  const webviewRef = useRef(null);
  const mapReadyRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [userLocation, setUserLocation] = useState(passedLocation);
  const [locationDenied, setLocationDenied] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    mapReadyRef.current = mapReady;
  }, [mapReady]);

  useEffect(() => {
    let locationSubscription = null;

    async function prepare() {
      // ── Permission check — no dialog shown here, App.js already handled it ─
      // We just check the result and show the denied screen if needed
      const granted = await PermissionManager.isLocationGranted();

      if (!granted) {
        setLocationDenied(true);
        setReady(true);
        return;
      }

      // Skip slow GPS fix if HomeScreen already passed us a location
      if (!passedLocation) {
        try {
          const initial = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setUserLocation({
            lat: initial.coords.latitude,
            lng: initial.coords.longitude,
          });
        } catch (err) {
          console.log('Map initial location error:', err);
        }
      }

      // Continuous tracking as the user moves
      try {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (loc) => {
            const newPos = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            };
            setUserLocation(newPos);

            if (mapReadyRef.current && webviewRef.current) {
              webviewRef.current.injectJavaScript(`
                (function() {
                  if (window.userMarker && window.leafletMap) {
                    window.userMarker.setLatLng([${newPos.lat}, ${newPos.lng}]);
                    window.leafletMap.setView([${newPos.lat}, ${newPos.lng}]);
                  }
                })();
                true;
              `);
            }
          }
        );
      } catch (err) {
        console.log('Map watch location error:', err);
      }

      setReady(true);
    }

    prepare();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  // Build marker data with real calculated distance
  const markers = messages.map((m) => {
    let distance = m.distance ?? '?';
    if (userLocation && m.latitude != null && m.longitude != null) {
      distance = haversineDistance(
        userLocation.lat, userLocation.lng,
        m.latitude, m.longitude
      );
    }
    return {
      lat: m.latitude,
      lng: m.longitude,
      name: m.name,
      message: m.message,
      distance,
      hops: m.hops,
    };
  });

  const center = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [-22.5763, 27.1322];

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { width: 100%; height: 100%; }
        .leaflet-tile-error { background: #2a2a2a !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        window.leafletMap = L.map('map').setView(${JSON.stringify(center)}, 14);

        const tileLayer = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            minZoom: 10,
            maxZoom: 19,
          }
        ).addTo(window.leafletMap);

        let offlineTileCount = 0;
        tileLayer.on('tileerror', function() {
          offlineTileCount++;
          if (offlineTileCount === 3) {
            window.ReactNativeWebView &&
              window.ReactNativeWebView.postMessage('TILES_OFFLINE');
          }
        });
        tileLayer.on('tileload', function() {
          offlineTileCount = 0;
          window.ReactNativeWebView &&
            window.ReactNativeWebView.postMessage('TILES_ONLINE');
        });

        ${userLocation ? `
        const userIcon = L.divIcon({
          html: '<div style="background:#007AFF;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 5px rgba(0,122,255,0.25)"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          className: ''
        });
        window.userMarker = L.marker(
          [${userLocation.lat}, ${userLocation.lng}],
          { icon: userIcon, zIndexOffset: 1000 }
        )
          .addTo(window.leafletMap)
          .bindPopup('<b>📍 You are here</b>');
        ` : `
        window.userMarker = null;
        `}

        const sosMarkers = ${JSON.stringify(markers)};
        const sosIcon = L.divIcon({
          html: '<div style="background:#d64045;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(214,64,69,0.5)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          className: ''
        });

        sosMarkers.forEach(function(m) {
          L.marker([m.lat, m.lng], { icon: sosIcon })
            .addTo(window.leafletMap)
            .bindPopup(
              '<b>🚨 ' + m.name + '</b><br>' +
              '<i>"' + m.message + '"</i><br>' +
              '<small>' + m.distance + ' away · ' + m.hops + ' hop(s)</small>'
            );
        });

        window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage('MAP_READY');
      </script>
    </body>
    </html>
  `;

  const handleWebViewMessage = (event) => {
    switch (event.nativeEvent.data) {
      case 'MAP_READY':    setMapReady(true);    break;
      case 'TILES_OFFLINE': setIsOnline(false);  break;
      case 'TILES_ONLINE':  setIsOnline(true);   break;
      default: break;
    }
  };

  if (!ready) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#d64045" />
        <Text style={styles.loadingText}>
          {passedLocation ? 'Loading map…' : 'Getting your location…'}
        </Text>
      </View>
    );
  }

  if (locationDenied) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.deniedTitle}>📍 Location Access Denied</Text>
        <Text style={styles.deniedText}>
          This screen needs location permission to show where you are on the
          map. Please enable it in your device Settings and reopen the app.
        </Text>
        <TouchableOpacity style={styles.backBtnCentered} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📶 No internet — map tiles not available for new areas.
            {'\n'}GPS tracking and SOS markers still work.
          </Text>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ html: mapHTML }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        onMessage={handleWebViewMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 16, backgroundColor: '#fff' },
  loadingText: { fontSize: 16, color: '#666' },
  deniedTitle: { fontSize: 20, fontWeight: '700', color: '#d64045', textAlign: 'center' },
  deniedText: { fontSize: 15, color: '#444', textAlign: 'center', lineHeight: 22 },
  backBtnCentered: { marginTop: 12, backgroundColor: '#d64045', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  backBtn: { position: 'absolute', top: 55, left: 16, zIndex: 999, backgroundColor: '#d64045', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  backText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  offlineBanner: { position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 999, backgroundColor: 'rgba(20,20,20,0.82)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, elevation: 6 },
  offlineBannerText: { color: '#fff', fontSize: 13, lineHeight: 20, textAlign: 'center' },
});