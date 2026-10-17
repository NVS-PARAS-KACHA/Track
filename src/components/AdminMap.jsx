import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { RotateCcw } from 'lucide-react';
import './AdminMap.css';

// Fix for default Leaflet icon paths in bundlers
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

  // Initialize Map once
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

  // Update Markers whenever sessions change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);
    let validMarkerCount = 0;
    let singleLatLng = null;

    sessions.forEach((session) => {
      const loc = session.latestUpdate;
      if (!loc) return;

      const lat = parseFloat(loc.latitude);
      const lng = parseFloat(loc.longitude);

      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      const latLng = [lat, lng];
      bounds.extend(latLng);
      validMarkerCount++;
      singleLatLng = latLng;

      const color = session.color || '#16a34a';
      const timeStr = getRelativeTime(loc.recorded_at);
      const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

      // Custom Clean HTML Marker Pin with pulsing dot
      const customIcon = L.divIcon({
        className: 'custom-leaflet-div-icon',
        html: `
          <div class="map-marker-wrapper">
            <div class="map-marker-pill">
              <span class="map-marker-pulse-dot" style="background-color: ${color};"></span>
              <span class="map-marker-name">${session.display_name || 'Candidate'}</span>
              <span class="map-marker-time">${timeStr}</span>
            </div>
            <div class="map-marker-pin" style="background-color: ${color};">
              <div class="map-marker-pin-inner"></div>
            </div>
          </div>
        `,
        iconSize: [160, 56],
        iconAnchor: [80, 56],
        popupAnchor: [0, -56],
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(map);

      // Hover Tooltip with user name & exact coordinates
      marker.bindTooltip(
        `<div style="font-weight:700;">${session.display_name || 'Candidate'}</div><div style="font-family:monospace;font-size:10px;margin-top:2px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`,
        {
          direction: 'top',
          offset: [0, -56],
          className: 'custom-leaflet-tooltip',
        }
      );

      // Detailed On-Click Popup
      const popupHtml = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <div>
              <div class="map-popup-title">${session.display_name || 'Candidate'}</div>
              <div class="map-popup-id">Session: ${session.id}</div>
            </div>
            <span class="map-popup-badge ${loc.is_demo ? 'demo' : 'live'}">
              ${loc.is_demo ? 'Demo' : '🟢 Live GPS'}
            </span>
          </div>

          <div class="map-popup-field">
            <span class="map-field-label">Address:</span>
            <span class="map-field-value">${loc.resolved_address || 'Resolving Address...'}</span>
          </div>

          <div class="map-popup-coords-box">
            <div class="map-coords-text">
              <strong>${lat.toFixed(6)}, ${lng.toFixed(6)}</strong>
            </div>
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="map-coords-link" title="Open coordinates in Google Maps">
              Google Maps ↗
            </a>
          </div>

          <div class="map-popup-grid">
            <div class="map-grid-item">
              <span class="map-grid-label">Accuracy</span>
              <span class="map-grid-val">±${Math.round(loc.accuracy_meters || 10)}m</span>
            </div>
            <div class="map-grid-item">
              <span class="map-grid-label">Device</span>
              <span class="map-grid-val">${session.device_info || 'Mobile/Web'}</span>
            </div>
            <div class="map-grid-item">
              <span class="map-grid-label">Recorded</span>
              <span class="map-grid-val">${timeStr}</span>
            </div>
            <div class="map-grid-item">
              <span class="map-grid-label">Status</span>
              <span class="map-grid-val" style="color: #16a34a; font-weight: 700;">${session.status || 'active'}</span>
            </div>
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

    // Auto-fit bounds or center
    if (!focusLocation) {
      if (validMarkerCount === 1 && singleLatLng) {
        map.setView(singleLatLng, 15, { animate: true });
      } else if (validMarkerCount > 1 && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [sessions]);

  // Focus specific location when row clicked
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusLocation) return;

    const lat = parseFloat(focusLocation.latitude);
    const lng = parseFloat(focusLocation.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    map.flyTo([lat, lng], 15, { duration: 1.2 });

    if (focusLocation.sessionId && markersRef.current.has(focusLocation.sessionId)) {
      setTimeout(() => {
        const marker = markersRef.current.get(focusLocation.sessionId);
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
          title="Recenter Map"
        >
          <RotateCcw size={14} />
          Reset View
        </button>
      </div>
      <div ref={mapContainerRef} className="admin-map-leaflet" />
    </div>
  );
};
