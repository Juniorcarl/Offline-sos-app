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

export default function EmergencyMapScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const messages = route.params?.messages || [];

  const webviewRef = useRef(null);
  const mapReadyRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Keep mapReadyRef in sync so the location watcher callback
  // always reads the latest value without a stale closure
  useEffect(() => {
    mapReadyRef.current = mapReady;
  }, [mapReady]);

  useEffect(() => {
    let locationSubscription = null;

    async function prepare() {
      // ── 1. Location permission & initial fix ──────────────────────────
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          setLocationDenied(true);
        } else {
          // Get an initial fast fix so the map centres immediately
          const initial = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const initialPos = {
            lat: initial.coords.latitude,
            lng: initial.coords.longitude,
          };
          setUserLocation(initialPos);

          // ── 2. Continuous tracking as the user moves ────────────────
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 10,  // fire every 10 metres moved
              timeInterval: 5000,    // or every 5 seconds, whichever first
            },
            (loc) => {
              const newPos = {
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
              };
              setUserLocation(newPos);

              // Push updated coordinates into the live Leaflet map
              // via injectJavaScript — no page reload needed
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
        }
      } catch (err) {
        console.log('Location error:', err);
      }

      setReady(true);
    }

    prepare();

    // ── Cleanup: remove location watcher when screen unmounts ─────────
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // ── Build marker data from incoming SOS messages ──────────────────────────
  const markers = messages.map((m) => ({
    lat: m.latitude,
    lng: m.longitude,
    name: m.name,
    message: m.message,
    distance: m.distance,
    hops: m.hops,
  }));

  // Default centre: user GPS position if known, else Palapye city centre
  const center = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [-22.5763, 27.1322];

  // ── Leaflet HTML loaded inside the WebView ────────────────────────────────
  // How tile caching works:
  //   - cacheEnabled={true} + cacheMode="LOAD_CACHE_ELSE_NETWORK" tells
  //     Android's WebView to store every tile it downloads into persistent
  //     device storage (survives app restarts and reboots).
  //   - First launch with internet: tiles load from OSM and are cached.
  //   - Every launch after (online or offline): cached tiles are used first.
  //     Only tiles the user has never panned to before will need internet.
  //   - This is the same model used by Maps.me and OsmAnd — they also require
  //     a one-time connected session to cache the area before going offline.
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

        /* Shown when a tile fails to load (grey tile with icon) */
        .leaflet-tile-error {
          background: #2a2a2a !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        window.leafletMap = L.map('map').setView(${JSON.stringify(center)}, 14);

        // OSM tile layer — tiles are cached by Android WebView automatically
        // because cacheEnabled and cacheMode are set on the WebView component
        const tileLayer = L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution: '© OpenStreetMap contributors',
            minZoom: 10,
            maxZoom: 18,
          }
        ).addTo(window.leafletMap);

        // Detect when a tile fails (no cache + no internet)
        let offlineTileCount = 0;
        tileLayer.on('tileerror', function() {
          offlineTileCount++;
          // Notify React Native if tiles are failing so we can show a banner
          if (offlineTileCount === 3) {
            window.ReactNativeWebView &&
              window.ReactNativeWebView.postMessage('TILES_OFFLINE');
          }
        });
        tileLayer.on('tileload', function() {
          // Tiles loading fine — reset counter and clear any banner
          offlineTileCount = 0;
          window.ReactNativeWebView &&
            window.ReactNativeWebView.postMessage('TILES_ONLINE');
        });

        // ── User location marker (blue dot) ──────────────────────────
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

        // ── SOS message markers (red dots) ───────────────────────────
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

        // Tell React Native the map finished initialising
        window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage('MAP_READY');
      </script>
    </body>
    </html>
  `;

  // ── Handle messages from inside the WebView ───────────────────────────────
  const handleWebViewMessage = (event) => {
    switch (event.nativeEvent.data) {
      case 'MAP_READY':
        setMapReady(true);
        break;
      case 'TILES_OFFLINE':
        setIsOnline(false);
        break;
      case 'TILES_ONLINE':
        setIsOnline(true);
        break;
      default:
        break;
    }
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#d64045" />
        <Text style={styles.loadingText}>Getting your location…</Text>
      </View>
    );
  }

  // ── Permission denied screen ──────────────────────────────────────────────
  if (locationDenied) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.deniedTitle}>📍 Location Access Denied</Text>
        <Text style={styles.deniedText}>
          This screen needs location permission to show where you are on the
          map. Please enable it in your device Settings and reopen the app.
        </Text>
        <TouchableOpacity
          style={styles.backBtnCentered}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main map screen ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {/* Offline tile notice — only shown when tiles are failing to load */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📶 No internet — map tiles not available for new areas.
            {'\n'}GPS tracking and SOS markers still work.
          </Text>
        </View>
      )}

      {/*
        cacheEnabled — tells WebView to use Android's HTTP cache for all
        requests including map tiles.

        cacheMode="LOAD_CACHE_ELSE_NETWORK" — serve from cache whenever
        a tile is already stored; only hit the network for new tiles.
        This means tiles downloaded on the first connected session remain
        available permanently offline, just like Maps.me or OsmAnd after
        their initial map download.
      */}
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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  // Loading / error screens
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#d64045',
    textAlign: 'center',
  },
  deniedText: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    lineHeight: 22,
  },
  backBtnCentered: {
    marginTop: 12,
    backgroundColor: '#d64045',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },

  // Overlaid back button
  backBtn: {
    position: 'absolute',
    top: 55,
    left: 16,
    zIndex: 999,
    backgroundColor: '#d64045',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  backText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Offline tiles banner
  offlineBanner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: 'rgba(20,20,20,0.82)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 6,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});