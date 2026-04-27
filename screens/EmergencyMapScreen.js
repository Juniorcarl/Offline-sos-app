import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import PermissionManager from '../services/PermissionManager';

// ── Haversine distance ────────────────────────────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const m = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

// Calculate numeric distance in meters for comparisons
function getDistanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Build the offline-capable map HTML ───────────────────────────────────────
function buildMapHTML(center, sosMarkers, singleMode) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;background:#1a1a2e}
    #no-leaflet{display:none;position:absolute;inset:0;z-index:9999;
      background:#1a1a2e;flex-direction:column;justify-content:center;
      align-items:center;gap:16px;padding:32px;text-align:center;font-family:sans-serif}
    #no-leaflet.show{display:flex}
    #no-leaflet h2{color:#d64045;font-size:20px}
    #no-leaflet p{color:#aaa;font-size:13px;line-height:1.6}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="no-leaflet">
    <h2>📶 Map Unavailable Offline</h2>
    <p>Open the map once while connected to the internet to cache tiles.
    GPS location and SOS markers will work once tiles are cached.</p>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    onerror="document.getElementById('no-leaflet').classList.add('show');
             window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('LEAFLET_FAILED')">
  </script>

  <script>
  (function() {
    if (typeof L === 'undefined') return;

    // ── IndexedDB tile cache ────────────────────────────────────────────────
    var _idb = null;
    (function() {
      try {
        var req = indexedDB.open('sos_tiles_v1', 1);
        req.onupgradeneeded = function(e) { e.target.result.createObjectStore('tiles'); };
        req.onsuccess = function(e) { _idb = e.target.result; };
        req.onerror = function() {};
      } catch(e) {}
    })();

    function _dbGet(key, cb) {
      if (!_idb) { cb(null); return; }
      try {
        var r = _idb.transaction('tiles','readonly').objectStore('tiles').get(key);
        r.onsuccess = function() { cb(r.result || null); };
        r.onerror   = function() { cb(null); };
      } catch(e) { cb(null); }
    }

    function _dbPut(key, val) {
      if (!_idb) return;
      try { _idb.transaction('tiles','readwrite').objectStore('tiles').put(val, key); }
      catch(e) {}
    }

    // ── Offline-capable tile layer ──────────────────────────────────────────
    var OfflineTileLayer = L.TileLayer.extend({
      createTile: function(coords, done) {
        var tile = document.createElement('img');
        tile.setAttribute('role', 'presentation');
        var key = coords.z + '/' + coords.x + '/' + coords.y;
        var url = this.getTileUrl(coords);

        _dbGet(key, function(cached) {
          if (cached) {
            tile.src = cached;
            done(null, tile);
            return;
          }
          fetch(url, { credentials: 'omit' })
            .then(function(r) { return r.ok ? r.blob() : Promise.reject(); })
            .then(function(blob) {
              var fr = new FileReader();
              fr.onloadend = function() {
                _dbPut(key, fr.result);
                tile.src = fr.result;
                done(null, tile);
                window.ReactNativeWebView &&
                  window.ReactNativeWebView.postMessage('TILES_ONLINE');
              };
              fr.readAsDataURL(blob);
            })
            .catch(function() {
              done(null, tile);
              window.ReactNativeWebView &&
                window.ReactNativeWebView.postMessage('TILES_OFFLINE');
            });
        });

        return tile;
      }
    });

    // ── Map init ────────────────────────────────────────────────────────────
    var center = ${JSON.stringify(center)};
    window.leafletMap = L.map('map').setView(center, 14);

    new OfflineTileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        minZoom: 3,
        maxZoom: 19,
      }
    ).addTo(window.leafletMap);

    // ── User marker ─────────────────────────────────────────────────────────
    var userIcon = L.divIcon({
      html: '<div style="background:#007AFF;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 5px rgba(0,122,255,0.25)"></div>',
      iconSize: [18,18], iconAnchor: [9,9], className: ''
    });
    window.userMarker = L.marker(center, { icon: userIcon, zIndexOffset: 1000 })
      .addTo(window.leafletMap)
      .bindPopup('<b>📍 You are here</b>');

    // ── SOS markers ─────────────────────────────────────────────────────────
    var sosIcon = L.divIcon({
      html: '<div style="background:#d64045;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(214,64,69,0.5)"></div>',
      iconSize: [16,16], iconAnchor: [8,8], className: ''
    });

    var markers = ${JSON.stringify(sosMarkers)};
    var singleMode = ${JSON.stringify(!!singleMode)};

    window.sosMarkerObjects = [];

    markers.forEach(function(m) {
      if (m.lat == null || m.lng == null) return;

      function popupHtml(dist) {
        return '<b>🚨 ' + m.name + '</b><br>' +
               '<i>"' + m.message + '"</i><br>' +
               '<small>📍 ' + dist + ' away &middot; ' + m.hops + ' hop(s)</small>';
      }

      var marker = L.marker([m.lat, m.lng], { icon: sosIcon })
        .addTo(window.leafletMap)
        .bindPopup(popupHtml(m.distance));

      window.sosMarkerObjects.push({ marker: marker, popupHtml: popupHtml, lat: m.lat, lng: m.lng });

      if (singleMode) {
        // Draw dashed line between user and sender
        L.polyline([center, [m.lat, m.lng]], {
          color: '#d64045',
          weight: 2.5,
          opacity: 0.75,
          dashArray: '8 6',
        }).addTo(window.leafletMap);

        // Fit map to show both markers with padding
        window.leafletMap.fitBounds(
          L.latLngBounds(center, [m.lat, m.lng]),
          { padding: [60, 60] }
        );

        // Auto-open the sender popup after a short delay
        setTimeout(function() { marker.openPopup(); }, 600);
      }
    });

    // Allow React Native to push a refreshed distance into the popup
    window.updateSosDistance = function(dist, lat, lng) {
      window.sosMarkerObjects.forEach(function(obj) {
        // Recalculate distance if coordinates provided
        var finalDist = dist;
        if (lat !== undefined && lng !== undefined && obj.lat && obj.lng) {
          // Calculate distance using Haversine formula
          var R = 6371000;
          var toRad = function(d) { return d * Math.PI / 180; };
          var dLat = toRad(obj.lat - lat);
          var dLng = toRad(obj.lng - lng);
          var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(toRad(lat)) * Math.cos(toRad(obj.lat)) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
          var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          var meters = R * c;
          finalDist = meters < 1000 ? Math.round(meters) + 'm' : (meters/1000).toFixed(1) + 'km';
        }
        
        var wasOpen = obj.marker.isPopupOpen();
        obj.marker.setPopupContent(obj.popupHtml(finalDist));
        if (wasOpen) obj.marker.openPopup();
      });
    };

    // Update polyline when user moves
    window.updatePolyline = function(lat, lng) {
      if (!singleMode) return;
      window.sosMarkerObjects.forEach(function(obj) {
        // Remove existing polylines and create new one
        if (window.currentPolyline) {
          window.leafletMap.removeLayer(window.currentPolyline);
        }
        window.currentPolyline = L.polyline([[lat, lng], [obj.lat, obj.lng]], {
          color: '#d64045',
          weight: 2.5,
          opacity: 0.75,
          dashArray: '8 6',
        }).addTo(window.leafletMap);
      });
    };

    window.ReactNativeWebView &&
      window.ReactNativeWebView.postMessage('MAP_READY');
  })();
  </script>
</body>
</html>`;
}

export default function EmergencyMapScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const passedLocation = route.params?.userLocation ?? null;
  const messages       = route.params?.messages || [];
  const singleMode     = messages.length === 1 && messages[0].latitude != null;

  const webviewRef  = useRef(null);
  const mapReadyRef = useRef(false);
  const isMounted   = useRef(true);

  const [ready, setReady]               = useState(false);
  const [mapHTML, setMapHTML]           = useState(null);
  const [userLocation, setUserLocation] = useState(passedLocation);
  const [locationDenied, setLocationDenied] = useState(false);
  const [mapReady, setMapReady]         = useState(false);
  const [isOnline, setIsOnline]         = useState(true);
  const [liveDistance, setLiveDistance] = useState(null);

  useEffect(() => { mapReadyRef.current = mapReady; }, [mapReady]);

  // Calculate distance whenever user location changes
  useEffect(() => {
    if (singleMode && userLocation && messages[0] && messages[0].latitude != null) {
      const distance = haversineDistance(
        userLocation.lat,
        userLocation.lng,
        messages[0].latitude,
        messages[0].longitude
      );
      setLiveDistance(distance);
      
      // Update map if ready
      if (mapReadyRef.current && webviewRef.current) {
        const distanceMeters = getDistanceInMeters(
          userLocation.lat,
          userLocation.lng,
          messages[0].latitude,
          messages[0].longitude
        );
        const distanceStr = distanceMeters < 1000 
          ? `${Math.round(distanceMeters)}m` 
          : `${(distanceMeters / 1000).toFixed(1)}km`;
        
        webviewRef.current.injectJavaScript(`
          (function() {
            if (window.updateSosDistance) {
              window.updateSosDistance(${JSON.stringify(distanceStr)}, ${userLocation.lat}, ${userLocation.lng});
            }
            if (window.updatePolyline) {
              window.updatePolyline(${userLocation.lat}, ${userLocation.lng});
            }
          })(); true;
        `);
      }
    }
  }, [userLocation, singleMode, messages]);

  useEffect(() => {
    isMounted.current = true;
    let locationSubscription = null;

    async function prepare() {
      const granted = await PermissionManager.isLocationGranted();

      if (!granted) {
        if (isMounted.current) {
          setLocationDenied(true);
          setReady(true);
        }
        return;
      }

      // Step 1: try last-known position for an instant result
      let initLoc = passedLocation;
      if (!initLoc) {
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            initLoc = { lat: last.coords.latitude, lng: last.coords.longitude };
          }
        } catch (e) {
          console.log('Map last-known location error:', e);
        }
      }

      // Step 2: render map immediately with whatever location we have
      if (isMounted.current && initLoc) setUserLocation(initLoc);

      const computeCenter = (loc) =>
        loc ? [loc.lat, loc.lng] : [-22.5763, 27.1322];

      const buildMarkers = (loc) =>
        messages
          .filter(m => m.latitude != null && m.longitude != null)
          .map(m => {
            let distance = '?';
            if (loc) {
              const meters = getDistanceInMeters(loc.lat, loc.lng, m.latitude, m.longitude);
              distance = meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
            }
            return {
              lat:      m.latitude,
              lng:      m.longitude,
              name:     m.name,
              message:  m.message,
              distance: distance,
              hops: m.hops ?? 1,
            };
          });

      const initialMarkers = buildMarkers(initLoc);
      const initialDistance = singleMode && initialMarkers.length > 0 ? initialMarkers[0].distance : null;
      
      if (isMounted.current) {
        setMapHTML(buildMapHTML(computeCenter(initLoc), initialMarkers, singleMode));
        if (singleMode && initialMarkers.length > 0) {
          setLiveDistance(initialDistance);
        }
        setReady(true);
      }

      // Step 3: refine with a fresh high-accuracy fix
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const refinedLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (isMounted.current) {
          setUserLocation(refinedLoc);
          initLoc = refinedLoc;
        }
      } catch (e) {
        console.log('Map refined location error:', e);
      }

      // Start watching location for real-time marker updates
      try {
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
          (loc) => {
            if (!isMounted.current) return;
            const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
            setUserLocation(pos);
          }
        );
      } catch (e) {
        console.log('Map watch location error:', e);
      }
    }

    prepare();

    return () => {
      isMounted.current = false;
      locationSubscription?.remove();
    };
  }, [messages, passedLocation, singleMode]);

  const handleWebViewMessage = (event) => {
    switch (event.nativeEvent.data) {
      case 'MAP_READY':       setMapReady(true);    break;
      case 'TILES_OFFLINE':   setIsOnline(false);   break;
      case 'TILES_ONLINE':    setIsOnline(true);    break;
      case 'LEAFLET_FAILED':  setIsOnline(false);   break;
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
          Enable location permission in Settings and reopen the app.
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
            📶 Offline — showing cached tiles. GPS and SOS markers still work.
          </Text>
        </View>
      )}

      {mapHTML && (
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
      )}

      {singleMode && liveDistance != null && (
        <View style={styles.distanceCard}>
          <View style={styles.distanceRow}>
            <Text style={styles.distanceName}>
              🚨 {messages[0].name}
            </Text>
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceBadgeText}>{liveDistance}</Text>
            </View>
          </View>
          <Text style={styles.distanceMsg} numberOfLines={2}>
            "{messages[0].message}"
          </Text>
          <View style={styles.distanceLegend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendLabel}>You</Text>
            <View style={styles.legendLine} />
            <View style={[styles.legendDot, { backgroundColor: '#d64045' }]} />
            <Text style={styles.legendLabel}>{messages[0].name}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centeredContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32, gap: 16, backgroundColor: '#fff',
  },
  loadingText: { fontSize: 16, color: '#666' },
  deniedTitle: { fontSize: 20, fontWeight: '700', color: '#d64045', textAlign: 'center' },
  deniedText:  { fontSize: 15, color: '#444', textAlign: 'center', lineHeight: 22 },
  backBtnCentered: {
    marginTop: 12, backgroundColor: '#d64045',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  backBtn: {
    position: 'absolute', top: 55, left: 16, zIndex: 999,
    backgroundColor: '#d64045', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  backText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  offlineBanner: {
    position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 999,
    backgroundColor: 'rgba(20,20,20,0.85)', paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 12, elevation: 6,
  },
  offlineBannerText: { color: '#fff', fontSize: 13, lineHeight: 20, textAlign: 'center' },

  // Single-message distance card
  distanceCard: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 15, 15, 0.92)',
    borderRadius: 16,
    padding: 14,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,64,69,0.35)',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  distanceName: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1, marginRight: 10 },
  distanceBadge: {
    backgroundColor: '#d64045',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  distanceBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  distanceMsg: { color: '#aaa', fontSize: 13, fontStyle: 'italic', marginBottom: 10, lineHeight: 18 },
  distanceLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  legendLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#d64045',
    borderStyle: Platform.OS === 'ios' ? 'solid' : 'solid',
    opacity: 0.7,
  },
  legendLabel: { color: '#bbb', fontSize: 11, fontWeight: '600' },
});