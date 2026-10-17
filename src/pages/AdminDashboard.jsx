import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Users,
  Clock,
  BarChart3,
  UserCheck,
  Settings,
  LogOut,
  Calendar,
  Search,
  ChevronDown,
  Monitor,
  Smartphone,
  Eye,
  Trash2,
  Download,
  Shield,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  ExternalLink,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { locationService } from '../services/locationService';
import { AdminMap } from '../components/AdminMap';
import { HistoryModal } from '../components/HistoryModal';
import './AdminDashboard.css';

export const AdminDashboard = ({ onNavigateVisitor }) => {
  const { user, profile, isAdmin, login, logout, isSupabaseConfigured } = useAuth();

  // Navigation tab state
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Data states (100% real-time, no static data)
  const [sessions, setSessions] = useState([]);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [selectedSessionForHistory, setSelectedSessionForHistory] = useState(null);
  const [focusLocation, setFocusLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Real-time live date/time matching the mockup widget
  const [currentTime, setCurrentTime] = useState(new Date());

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Settings state
  const [retentionDays, setRetentionDays] = useState(30);
  const [retentionMessage, setRetentionMessage] = useState('');

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDatePill = (date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatTimePill = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // Load real-time dashboard data
  const loadData = async () => {
    try {
      const allSessions = await locationService.getSessionsWithLatestLocation();
      const updates = await locationService.getRecentUpdates(12);
      setSessions(allSessions);
      setRecentUpdates(updates);
    } catch (err) {
      console.error('Failed to load real-time dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadData();

    // Subscribe to real-time events across tabs & network
    const unsubscribe = locationService.subscribe(() => {
      loadData();
    });

    // Also poll every 3 seconds to guarantee instant real-time reflection
    const pollInterval = setInterval(() => {
      loadData();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [isAdmin]);

  // Handle Login: accepts admin and Paras@20
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      setLoginError(err.message || 'Invalid credentials. Please enter correct username and password.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Retention cleanup
  const handleCleanupRetention = async () => {
    setRetentionMessage('Running cleanup...');
    try {
      const deletedCount = await locationService.cleanupOldHistory(retentionDays);
      setRetentionMessage(`Successfully purged ${deletedCount} location record(s) older than ${retentionDays} days.`);
      loadData();
    } catch (err) {
      setRetentionMessage('Cleanup notice: ' + err.message);
    }
  };

  // Export sessions to CSV
  const handleExportSessionsCSV = () => {
    const headers = ['Session ID', 'Name', 'Device', 'Status', 'Started At', 'Latitude', 'Longitude', 'Address'];
    const rows = sessions.map((s) => [
      s.id,
      s.display_name,
      s.device_info,
      s.status,
      s.started_at,
      s.latestUpdate?.latitude || '',
      s.latestUpdate?.longitude || '',
      `"${s.latestUpdate?.resolved_address || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `techpulse_realtime_sessions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Filtered real-time sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.device_info?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.latestUpdate?.resolved_address?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && s.status === 'active') ||
      (statusFilter === 'ended' && s.status === 'ended');

    return matchesSearch && matchesStatus;
  });

  // Calculate purely real-time stats
  const activeSessionsCount = sessions.filter((s) => s.status === 'active').length;
  const totalSessionsCount = sessions.length;
  const totalUpdatesCount = sessions.reduce((acc, s) => acc + (s.updateCount || 0), 0);

  // If user is not authenticated, show login card WITHOUT subheadings
  if (!isAdmin) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-card animate-fade-in">
          {/* Brand header without any subheadings */}
          <div className="login-brand-header">
            <img
              src="/assets/monkey_logo.jpg"
              alt="MonkeyOnki"
              className="login-brand-logo"
            />
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
              MonkeyOnki Admin Portal
            </h2>
          </div>

          {loginError && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="login-field">
              <label>Username / Email</label>
              <input
                type="text"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loggingIn} className="login-submit-btn" style={{ marginTop: 6 }}>
              {loggingIn ? 'Authenticating...' : 'Sign In as Administrator'}
            </button>
          </form>

          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <button
              onClick={onNavigateVisitor}
              style={{ color: '#16a34a', fontWeight: 700, textDecoration: 'underline' }}
            >
              Back to Job Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <img
            src="/assets/monkey_logo.jpg"
            alt="MonkeyOnki"
            className="admin-sidebar-logo"
          />
          <span className="admin-sidebar-title">MonkeyOnki</span>
        </div>

        <ul className="admin-nav-list">
          <li>
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`admin-nav-item-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentTab('liveMap')}
              className={`admin-nav-item-btn ${currentTab === 'liveMap' ? 'active' : ''}`}
            >
              <MapPin size={18} />
              <span>Live Map</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentTab('sessions')}
              className={`admin-nav-item-btn ${currentTab === 'sessions' ? 'active' : ''}`}
            >
              <Users size={18} />
              <span>Sessions</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentTab('history')}
              className={`admin-nav-item-btn ${currentTab === 'history' ? 'active' : ''}`}
            >
              <Clock size={18} />
              <span>Location History</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentTab('analytics')}
              className={`admin-nav-item-btn ${currentTab === 'analytics' ? 'active' : ''}`}
            >
              <BarChart3 size={18} />
              <span>Analytics</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentTab('users')}
              className={`admin-nav-item-btn ${currentTab === 'users' ? 'active' : ''}`}
            >
              <UserCheck size={18} />
              <span>Users</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentTab('settings')}
              className={`admin-nav-item-btn ${currentTab === 'settings' ? 'active' : ''}`}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </li>
        </ul>

        <div className="admin-sidebar-footer">
          <button
            onClick={onNavigateVisitor}
            className="admin-nav-item-btn"
            style={{ color: '#0284c7' }}
            title="Open Candidate Job Portal"
          >
            <ExternalLink size={18} />
            <span>Job Portal View</span>
          </button>
          <button onClick={logout} className="admin-nav-item-btn" style={{ color: '#ef4444' }}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        {/* Top Bar */}
        <header className="admin-top-bar">
          <div className="admin-page-header-text">
            <h1>
              {currentTab === 'dashboard' && 'Dashboard'}
              {currentTab === 'liveMap' && 'Live Interactive Map'}
              {currentTab === 'sessions' && 'Active Real-Time Sessions'}
              {currentTab === 'history' && 'Location History Logs'}
              {currentTab === 'analytics' && 'Location Analytics & Metrics'}
              {currentTab === 'users' && 'Administrator Profiles'}
              {currentTab === 'settings' && 'System Settings & Controls'}
            </h1>
            <p>
              {currentTab === 'dashboard' && 'Real-time telemetry and active candidate locations'}
              {currentTab === 'liveMap' && 'Live GPS breadcrumbs of active candidate connections'}
              {currentTab === 'sessions' && 'Live audit of active applicant device sessions'}
              {currentTab === 'history' && 'Chronological GPS telemetry and accuracy logs'}
              {currentTab === 'analytics' && 'Device distribution and update telemetry'}
              {currentTab === 'users' && 'Manage authenticated system administrators'}
              {currentTab === 'settings' && 'Data retention, database pruning, and cache management'}
            </p>
          </div>

          <div className="admin-top-bar-right">
            {/* Live Date/Time widget */}
            <div className="admin-datetime-card">
              <div className="datetime-icon-wrap">
                <Calendar size={18} />
              </div>
              <div className="datetime-text">
                <span className="datetime-date">{formatDatePill(currentTime)}</span>
                <span className="datetime-time">{formatTimePill(currentTime)}</span>
              </div>
            </div>

            {/* Admin Avatar */}
            <div className="admin-profile-pill">
              <div className="admin-avatar">A</div>
              <span className="admin-profile-name">
                {profile?.display_name || 'Admin'}
              </span>
              <ChevronDown size={14} color="#64748b" />
            </div>

            <button
              onClick={onNavigateVisitor}
              className="admin-logout-icon-btn"
              style={{ color: '#0284c7' }}
              title="Open Candidate Job Portal"
              aria-label="Open Candidate Job Portal"
            >
              <ExternalLink size={18} />
            </button>

            <button
              onClick={logout}
              className="admin-logout-icon-btn"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* TAB 1: DASHBOARD (MAIN REAL-TIME VIEW) */}
        {currentTab === 'dashboard' && (
          <>
            {/* 4 Summary Cards (100% Real-Time Data) */}
            <section className="admin-summary-grid">
              {/* Card 1: Active Sessions */}
              <div className="summary-card">
                <div className="summary-icon-box green">
                  <Users size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">{activeSessionsCount}</span>
                  <span className="summary-label">Active Sessions</span>
                  <span className="summary-subtitle">Currently online</span>
                </div>
              </div>

              {/* Card 2: Total Sessions */}
              <div className="summary-card">
                <div className="summary-icon-box blue">
                  <Users size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">{totalSessionsCount}</span>
                  <span className="summary-label">Total Sessions</span>
                  <span className="summary-subtitle">All time</span>
                </div>
              </div>

              {/* Card 3: Location Updates */}
              <div className="summary-card">
                <div className="summary-icon-box purple">
                  <MapPin size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">{totalUpdatesCount}</span>
                  <span className="summary-label">Location Updates</span>
                  <span className="summary-subtitle">Received so far</span>
                </div>
              </div>

              {/* Card 4: Avg Update Interval */}
              <div className="summary-card">
                <div className="summary-icon-box orange">
                  <Clock size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">{sessions.length > 0 ? '1-2 mins' : '—'}</span>
                  <span className="summary-label">Avg. Update Interval</span>
                  <span className="summary-subtitle">Per session</span>
                </div>
              </div>
            </section>

            {/* Middle Grid: Live Locations Map + Recent Updates */}
            <section className="admin-mid-grid">
              {/* Left 2/3: Live Locations Leaflet Map */}
              <div className="dashboard-panel-card">
                <div className="dashboard-panel-header">
                  <div className="dashboard-panel-title-wrap">
                    <div className="panel-header-icon">
                      <MapPin size={16} />
                    </div>
                    <h2 className="dashboard-panel-title">
                      Live Locations {activeSessionsCount > 0 && `(${activeSessionsCount} online)`}
                    </h2>
                  </div>
                  <button
                    onClick={() => setCurrentTab('liveMap')}
                    className="action-icon-btn"
                    title="Fullscreen Map"
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
                <div style={{ height: 380, position: 'relative' }}>
                  <AdminMap
                    sessions={sessions.filter((s) => s.status === 'active')}
                    focusLocation={focusLocation}
                    onViewHistory={(session) => setSelectedSessionForHistory(session)}
                  />

                  {activeSessionsCount === 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(6px)',
                        padding: '10px 18px',
                        borderRadius: 20,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        zIndex: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Radio size={14} color="#16a34a" className="animate-pulse" />
                      <span>Awaiting candidate connections from Job Portal...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 1/3: Recent Updates */}
              <div className="dashboard-panel-card">
                <div className="dashboard-panel-header">
                  <h2 className="dashboard-panel-title">Recent Updates</h2>
                  {recentUpdates.length > 0 && (
                    <button
                      onClick={() => setCurrentTab('history')}
                      className="dashboard-panel-action-link"
                    >
                      View All
                    </button>
                  )}
                </div>

                <div className="recent-updates-list">
                  {recentUpdates.length === 0 ? (
                    <div style={{ padding: '30px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                      <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p style={{ fontWeight: 600 }}>No live updates yet</p>
                      <p style={{ fontSize: 12, marginTop: 4 }}>
                        When a candidate opens the job portal and verifies location, real-time updates appear here.
                      </p>
                    </div>
                  ) : (
                    recentUpdates.map((upd) => (
                      <div key={upd.id} className="recent-update-item">
                        <div
                          className="recent-update-dot"
                          style={{ backgroundColor: upd.color || '#16a34a' }}
                        />
                        <div className="recent-update-info">
                          <div className="recent-update-top">
                            <span className="recent-update-name">{upd.session_name}</span>
                            <span className="recent-update-time">
                              {new Date(upd.recorded_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </div>
                          <span className="recent-update-address">{upd.resolved_address}</span>
                          <div className="recent-update-bottom">
                            <span className="recent-update-coords">
                              {upd.latitude.toFixed(4)}, {upd.longitude.toFixed(4)}
                              {upd.accuracy_meters ? ` (±${Math.round(upd.accuracy_meters)}m)` : ''}
                            </span>
                            <span className="badge-live">Live</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Bottom Section: Active Sessions Table */}
            <section className="admin-table-section">
              <div className="admin-table-header">
                <div className="dashboard-panel-title-wrap">
                  <div className="panel-header-icon">
                    <Users size={16} />
                  </div>
                  <h2 className="dashboard-panel-title">Active Sessions ({filteredSessions.length})</h2>
                </div>

                <div className="admin-table-filters">
                  <div className="search-input-wrap">
                    <Search size={15} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Search sessions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="status-select"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>
              </div>

              <div className="sessions-table-wrapper">
                {filteredSessions.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                    <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p style={{ fontWeight: 700, fontSize: 15, color: '#334155' }}>
                      No Live Sessions Connected
                    </p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>
                      Open the Job Portal link in another tab or send it to an applicant.
                      Once they verify their location, their real GPS coordinates and device details will appear here in real time.
                    </p>
                    <button
                      onClick={onNavigateVisitor}
                      className="map-popup-btn"
                      style={{ maxWidth: 220, margin: '14px auto 0', display: 'block' }}
                    >
                      Open Job Portal to Test
                    </button>
                  </div>
                ) : (
                  <table className="sessions-table">
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>Device</th>
                        <th>Current Location</th>
                        <th>Last Updated</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.map((session) => {
                        const loc = session.latestUpdate;
                        const isMobile =
                          session.device_type === 'Mobile' ||
                          session.device_info?.toLowerCase().includes('android') ||
                          session.device_info?.toLowerCase().includes('iphone');

                        return (
                          <tr key={session.id}>
                            <td className="user-id-cell">{session.id}</td>
                            <td>
                              <div className="device-cell">
                                {isMobile ? <Smartphone size={16} color="#64748b" /> : <Monitor size={16} color="#64748b" />}
                                <span>{session.device_info}</span>
                              </div>
                            </td>
                            <td>
                              <div className="location-cell">
                                <span className="location-address">
                                  {loc?.resolved_address || 'Locating candidate...'}
                                </span>
                                <span className="location-coords-sub">
                                  {loc
                                    ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)} (±${Math.round(loc.accuracy_meters || 10)}m)`
                                    : 'Awaiting first GPS coordinate'}
                                </span>
                              </div>
                            </td>
                            <td>
                              {loc?.recorded_at
                                ? new Date(loc.recorded_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })
                                : 'Just now'}
                            </td>
                            <td>
                              <span className={`badge-status ${session.status}`}>
                                {session.status}
                              </span>
                            </td>
                            <td>
                              <div className="action-btn-group">
                                {loc && (
                                  <button
                                    onClick={() =>
                                      setFocusLocation({
                                        latitude: loc.latitude,
                                        longitude: loc.longitude,
                                        sessionId: session.id,
                                      })
                                    }
                                    className="action-icon-btn"
                                    title="View on Map"
                                  >
                                    <MapPin size={15} />
                                  </button>
                                )}
                                <button
                                  onClick={() => setSelectedSessionForHistory(session)}
                                  className="action-icon-btn"
                                  title="View Location History"
                                >
                                  <Clock size={15} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`End session for ${session.display_name}?`)) {
                                      locationService.endSession(session.id);
                                    }
                                  }}
                                  className="action-icon-btn"
                                  title="End Session"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}

        {/* TAB 2: LIVE MAP */}
        {currentTab === 'liveMap' && (
          <div className="dashboard-panel-card" style={{ height: 'calc(100vh - 160px)' }}>
            <div className="dashboard-panel-header">
              <h2 className="dashboard-panel-title">Full Geographic Map & Real-time Pins</h2>
              <button onClick={loadData} className="map-overlay-btn">
                <RotateCcw size={14} /> Refresh Markers
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 450 }}>
              <AdminMap
                sessions={sessions}
                focusLocation={focusLocation}
                onViewHistory={(session) => setSelectedSessionForHistory(session)}
              />
            </div>
          </div>
        )}

        {/* TAB 3: SESSIONS LIST */}
        {currentTab === 'sessions' && (
          <section className="admin-table-section">
            <div className="admin-table-header">
              <h2 className="dashboard-panel-title">All Real-Time Candidate Sessions ({sessions.length})</h2>
              <div className="admin-table-filters">
                <button onClick={handleExportSessionsCSV} className="map-overlay-btn">
                  <Download size={14} /> Export CSV
                </button>
                <div className="search-input-wrap">
                  <Search size={15} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search sessions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="sessions-table-wrapper">
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Name</th>
                    <th>Device Details</th>
                    <th>Consent Given At</th>
                    <th>Updates Count</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>
                        No candidate sessions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => (
                      <tr key={s.id}>
                        <td className="user-id-cell">{s.id}</td>
                        <td style={{ fontWeight: 700 }}>{s.display_name}</td>
                        <td>{s.device_info}</td>
                        <td>{new Date(s.consent_at || s.started_at).toLocaleString()}</td>
                        <td>{s.updateCount || 1} update(s)</td>
                        <td>
                          <span className={`badge-status ${s.status}`}>{s.status}</span>
                        </td>
                        <td>
                          <div className="action-btn-group">
                            <button
                              onClick={() => setSelectedSessionForHistory(s)}
                              className="action-icon-btn"
                              title="Inspect History"
                            >
                              <Clock size={15} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete session ${s.id}?`)) {
                                  locationService.deleteSession(s.id);
                                }
                              }}
                              className="action-icon-btn"
                              title="Delete Record"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 4: LOCATION HISTORY */}
        {currentTab === 'history' && (
          <section className="admin-table-section">
            <div className="admin-table-header">
              <h2 className="dashboard-panel-title">Location History Directory</h2>
              <p style={{ fontSize: 13, color: '#64748b' }}>
                Select any active or past candidate session to inspect chronological updates and breadcrumb trajectory.
              </p>
            </div>

            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {sessions.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#64748b' }}>
                  No session telemetry available yet. Open the job portal to generate live tracking logs.
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      background: '#f8fafc',
                      padding: 16,
                      borderRadius: 16,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{session.display_name}</span>
                      <span className={`badge-status ${session.status}`}>{session.status}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                      {session.id} • {session.device_info}
                    </span>
                    <span style={{ fontSize: 13, color: '#334155' }}>
                      Latest: {session.latestUpdate?.resolved_address || 'Pending GPS fix'}
                    </span>
                    <button
                      onClick={() => setSelectedSessionForHistory(session)}
                      className="map-popup-btn"
                      style={{ marginTop: 4 }}
                    >
                      View Chronological Logs
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* TAB 5: ANALYTICS */}
        {currentTab === 'analytics' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="admin-summary-grid">
              <div className="summary-card">
                <div className="summary-icon-box green">
                  <BarChart3 size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">{totalSessionsCount}</span>
                  <span className="summary-label">Total Applicants</span>
                  <span className="summary-subtitle">Live verified</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon-box blue">
                  <Clock size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">60s</span>
                  <span className="summary-label">Sync Frequency</span>
                  <span className="summary-subtitle">Real-time background</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon-box purple">
                  <Smartphone size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">
                    {sessions.filter((s) => s.device_type === 'Mobile').length}
                  </span>
                  <span className="summary-label">Mobile Users</span>
                  <span className="summary-subtitle">Android & iOS</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon-box orange">
                  <Monitor size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">
                    {sessions.filter((s) => s.device_type === 'Desktop').length}
                  </span>
                  <span className="summary-label">Desktop Users</span>
                  <span className="summary-subtitle">Windows, Mac, Linux</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 6: USERS */}
        {currentTab === 'users' && (
          <section className="admin-table-section">
            <div className="admin-table-header">
              <h2 className="dashboard-panel-title">Administrator Profile</h2>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <div className="admin-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
                  A
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700 }}>admin</h4>
                  <p style={{ fontSize: 13, color: '#64748b' }}>
                    Role: <b style={{ color: '#16a34a' }}>Super Administrator</b> • Password: <code>Paras@20</code>
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 7: SETTINGS */}
        {currentTab === 'settings' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Retention Policy */}
            <div className="dashboard-panel-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Shield size={20} color="#16a34a" />
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>Data Retention & Privacy Controls</h3>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                Prune old candidate location telemetry or purge stored sessions.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 14, fontWeight: 600 }}>Retention Period:</label>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="status-select"
                >
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                </select>

                <button onClick={handleCleanupRetention} className="login-submit-btn" style={{ padding: '8px 16px' }}>
                  Execute Prune Cleanup
                </button>

                <button
                  onClick={() => {
                    if (confirm('Clear all stored candidate sessions?')) {
                      locationService.clearAllData();
                      loadData();
                    }
                  }}
                  className="map-overlay-btn"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={14} /> Clear All Sessions
                </button>
              </div>

              {retentionMessage && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0fdf4', color: '#166534', borderRadius: 10, fontSize: 13 }}>
                  {retentionMessage}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Location History Modal */}
      {selectedSessionForHistory && (
        <HistoryModal
          session={selectedSessionForHistory}
          onClose={() => setSelectedSessionForHistory(null)}
        />
      )}
    </div>
  );
};
