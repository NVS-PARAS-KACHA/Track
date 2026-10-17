import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { X, Clock, MapPin, Download, ShieldCheck } from 'lucide-react';
import { locationService } from '../services/locationService';
import './HistoryModal.css';

export const HistoryModal = ({ session, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (!session) return;
      setLoading(true);
      const updates = await locationService.getSessionHistory(session.id);
      if (mounted) {
        setHistory(updates);
        setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [session]);

  // Render polyline and points on mini map
  useEffect(() => {
    if (loading || !mapContainerRef.current || history.length === 0) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const latLngs = history.map((h) => [h.latitude, h.longitude]);

    // Draw route polyline
    const polyline = L.polyline(latLngs, {
      color: session.color || '#16a34a',
      weight: 4,
      dashArray: '4, 8',
    }).addTo(map);

    // Add circle markers for each point
    history.forEach((pt, index) => {
      const isLatest = index === 0;
      L.circleMarker([pt.latitude, pt.longitude], {
        radius: isLatest ? 8 : 5,
        fillColor: isLatest ? '#ef4444' : session.color || '#16a34a',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<b>Step ${history.length - index}</b><br/>${pt.resolved_address}<br/>${new Date(pt.recorded_at).toLocaleTimeString()}`
        )
        .addTo(map);
    });

    map.fitBounds(polyline.getBounds(), { padding: [30, 30], maxZoom: 15 });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [history, loading]);

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${session.id}_history.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!session) return null;

  return (
    <div className="history-modal-backdrop" onClick={onClose}>
      <div className="history-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="history-modal-header">
          <div className="history-modal-title-wrap">
            <div className="history-modal-icon">
              <Clock size={22} />
            </div>
            <div>
              <h3 className="history-modal-title">
                Location History: {session.display_name}
              </h3>
              <p className="history-modal-subtitle">
                ID: {session.id} • Device: {session.device_info}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleExportJSON}
              className="map-overlay-btn"
              title="Export as JSON"
            >
              <Download size={14} />
              Export
            </button>
            <button onClick={onClose} className="history-modal-close-btn">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="history-modal-body">
          {/* Stats Row */}
          <div className="history-stats-grid">
            <div className="history-stat-box">
              <span className="history-stat-label">Total Updates Logged</span>
              <span className="history-stat-val">{history.length}</span>
            </div>
            <div className="history-stat-box">
              <span className="history-stat-label">Device Type</span>
              <span className="history-stat-val">{session.device_type || 'Desktop'}</span>
            </div>
            <div className="history-stat-box">
              <span className="history-stat-label">Session Status</span>
              <span className="history-stat-val" style={{ textTransform: 'capitalize' }}>
                {session.status}
              </span>
            </div>
            <div className="history-stat-box">
              <span className="history-stat-label">Latest Accuracy</span>
              <span className="history-stat-val">
                ±{Math.round(history[0]?.accuracy_meters || 10)}m
              </span>
            </div>
          </div>

          {/* Interactive Trajectory Breadcrumbs Map */}
          {history.length > 0 && (
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#334155' }}>
                Trajectory & Breadcrumb Path
              </h4>
              <div ref={mapContainerRef} className="history-map-container" />
            </div>
          )}

          {/* Chronological Table */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#334155' }}>
              Chronological Updates ({history.length})
            </h4>

            {loading ? (
              <p style={{ padding: 20, textAlign: 'center' }}>Loading updates...</p>
            ) : history.length === 0 ? (
              <p style={{ padding: 20, textAlign: 'center' }}>No location updates recorded yet.</p>
            ) : (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Time (UTC)</th>
                      <th>Local Time</th>
                      <th>Resolved Location</th>
                      <th>Coordinates</th>
                      <th>Accuracy</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {new Date(item.recorded_at).toISOString().replace('T', ' ').slice(0, 19)}
                        </td>
                        <td>{new Date(item.recorded_at).toLocaleTimeString()}</td>
                        <td style={{ fontWeight: 600 }}>{item.resolved_address}</td>
                        <td style={{ fontFamily: 'monospace', color: '#64748b' }}>
                          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        </td>
                        <td>±{Math.round(item.accuracy_meters || 10)}m</td>
                        <td>
                          <span className={`history-badge ${item.is_demo ? 'demo' : 'live'}`}>
                            {item.is_demo ? 'Demo Record' : 'Live GPS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
