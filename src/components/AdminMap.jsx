import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Maximize2, RotateCcw } from 'lucide-react';
import './AdminMap.css';

// Fix for default Leaflet icon paths in bundlers if needed
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper for relative time text
function getRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const diffSec = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 90) return '1 min ago';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export const AdminMap = ({
  sessions = [],
  focusLocation = null,
  onViewHistory = null,
  height = '100%',
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());

  // Default Pune coordinates
  const defaultCenter = [18.5204, 73.8567];
  const defaultZoom = 12;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Attribution
      L.control
        .attribution({ position: 'bottomright' })
        .addAttribution('Leaflet | © OpenStreetMap')
        .addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers when sessions change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);

    sessions.forEach((session) => {
      const loc = session.latestUpdate;
      if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return;

      const latLng = [loc.latitude, loc.longitude];
      bounds.extend(latLng);

      const color = session.color || '#16a34a';
      const timeStr = getRelativeTime(loc.recorded_at);

      // Custom HTML Marker matching the screenshot design
      const customIcon = L.divIcon({
        className: 'custom-leaflet-div-icon',
        html: `
          <div class="map-marker-container">
            <div class="map-marker-pill">
              <span class="map-marker-dot" style="background-color: ${color};"></span>
              <span>${session.display_name}</span>
              <span class="map-marker-time">${timeStr}</span>
            </div>
            <div class="map-marker-pin-body" style="background-color: ${color};"></div>
          </div>
        `,
        iconSize: [120, 50],
        iconAnchor: [60, 50],
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(map);

      // Popup Content
      const popupHtml = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <span class="map-popup-title">${session.display_name} (${session.id})</span>
            <span class="map-popup-badge ${loc.is_demo ? 'demo' : 'live'}">
              ${loc.is_demo ? 'Demo' : 'Live GPS'}
            </span>
          </div>
          <div class="map-popup-address">${loc.resolved_address || 'Pune Area'}</div>
          <div class="map-popup-coords">${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}</div>
          <div class="map-popup-meta">
            <span>Accuracy: ±${Math.round(loc.accuracy_meters || 10)}m</span>
            <span>${timeStr}</span>
          </div>
          <button id="btn-hist-${session.id}" class="map-popup-btn">
            View Location History
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-hist-${session.id}`);
        if (btn) {
          btn.onclick = () => {
            onViewHistory?.(session);
          };
        }
      });

      markersRef.current.set(session.id, marker);
    });

    // Auto fit bounds if multiple sessions exist
    if (bounds.isValid() && !focusLocation) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [sessions]);

  // Focus specific location when triggered by external action (table row click)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusLocation) return;

    const { latitude, longitude, sessionId } = focusLocation;
    map.flyTo([latitude, longitude], 15, { duration: 1.2 });

    if (sessionId && markersRef.current.has(sessionId)) {
      setTimeout(() => {
        const marker = markersRef.current.get(sessionId);
        marker?.openPopup();
      }, 1250);
    }
  }, [focusLocation]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(defaultCenter, defaultZoom, { duration: 1 });
    }
  };

  return (
    <div className="admin-map-container" style={{ height }}>
      <div className="admin-map-overlay-controls">
        <button
          onClick={handleRecenter}
          className="map-overlay-btn"
          title="Recenter Map to Pune"
        >
          <RotateCcw size={14} />
          Reset View
        </button>
      </div>
      <div ref={mapContainerRef} className="admin-map-leaflet" />
    </div>
  );
};
