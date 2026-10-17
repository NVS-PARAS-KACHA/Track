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
  Database,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { locationService } from '../services/locationService';
import { AdminMap } from '../components/AdminMap';
import { HistoryModal } from '../components/HistoryModal';
import {
  getSupabaseConfigStatus,
  testSupabaseConnection,
  setCustomSupabaseCredentials,
  clearCustomSupabaseCredentials,
} from '../lib/supabase';
import './AdminDashboard.css';

const SCHEMA_SQL = `-- Supabase Telemetry Schema
CREATE TABLE IF NOT EXISTS public.location_sessions (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    device_info TEXT,
    browser_info TEXT,
    consent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.location_updates (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.location_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_meters DOUBLE PRECISION,
    resolved_address TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert sessions" ON public.location_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public select sessions" ON public.location_sessions FOR SELECT USING (true);
CREATE POLICY "Public update sessions" ON public.location_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sessions" ON public.location_sessions FOR DELETE USING (true);

CREATE POLICY "Public insert updates" ON public.location_updates FOR INSERT WITH CHECK (true);
CREATE POLICY "Public select updates" ON public.location_updates FOR SELECT USING (true);
CREATE POLICY "Public delete updates" ON public.location_updates FOR DELETE USING (true);`;

export const AdminDashboard = ({ onNavigateVisitor }) => {
  const { user, profile, isAdmin, login, logout } = useAuth();

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

  // Supabase Configuration & Diagnostics state
  const [supabaseStatus, setSupabaseStatus] = useState(getSupabaseConfigStatus());
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(supabaseStatus.url || '');
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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
      const updates = await locationService.getRecentUpdates(15);
      setSessions(allSessions);
      setRecentUpdates(updates);
      setSupabaseStatus(getSupabaseConfigStatus());
    } catch (err) {
      console.error('Failed to load real-time dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadData();

    // Subscribe to real-time events across network
    const unsubscribe = locationService.subscribe(() => {
      loadData();
    });

    // Real-time polling every 2.5s for instant updates
    const pollInterval = setInterval(() => {
      loadData();
    }, 2500);

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

  // Supabase test connection handler
  const handleTestConnection = async () => {
    setTestingSupabase(true);
    setTestResult(null);
    const res = await testSupabaseConnection(customUrlInput, customKeyInput);
    setTestingSupabase(false);
    setTestResult(res);
  };

  // Supabase save handler
  const handleSaveSupabase = () => {
    if (!customUrlInput || !customKeyInput) {
      alert('Please enter both Supabase URL and Anon Key');
      return;
    }
    const newStatus = setCustomSupabaseCredentials(customUrlInput, customKeyInput);
    setSupabaseStatus(newStatus);
    locationService.syncConfigToServerless({
      supabaseUrl: customUrlInput.trim(),
      supabaseAnonKey: customKeyInput.trim(),
    });
    setTestResult({
      success: true,
      message: 'Supabase credentials saved and activated! Synchronizing telemetry...',
    });
    loadData();
  };

  // Supabase clear custom credentials
  const handleClearSupabase = () => {
    clearCustomSupabaseCredentials();
    setCustomUrlInput('');
    setCustomKeyInput('');
    setSupabaseStatus(getSupabaseConfigStatus());
    locationService.syncConfigToServerless({
      supabaseUrl: '',
      supabaseAnonKey: '',
    });
    setTestResult(null);
    loadData();
  };

  // Copy SQL Schema to clipboard
  const handleCopySql = () => {
    navigator.clipboard.writeText(SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
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
          <div className="login-brand-header">
            <img
              src="/assets/monkey_logo.jpg"
              alt="MonkeyOnki"
              className="login-brand-logo"
            />
            <h1 className="login-brand-title">MonkeyOnki</h1>
          </div>

          {loginError && (
            <div className="login-error-alert animate-shake">
              <AlertTriangle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="login-field-group">
              <label className="login-label">Username</label>
              <input
                type="text"
                placeholder=""
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="login-input"
                autoFocus
              />
            </div>

            <div className="login-field-group">
              <label className="login-label">Password</label>
              <input
                type="password"
                placeholder=""
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="login-input"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="login-submit-btn"
            >
              {loggingIn ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={onNavigateVisitor}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              ← Back to Job Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sessions to display on the map
  const mapSessions = sessions.filter((s) => s.latestUpdate);

  return (
    <div className="admin-layout">
      {/* Left Sidebar */}
      <aside className="admin-sidebar">
        <a href="#dashboard" className="admin-sidebar-brand" onClick={() => setCurrentTab('dashboard')}>
          <img
            src="/assets/monkey_logo.jpg"
            alt="MonkeyOnki"
            className="admin-sidebar-logo"
          />
          <span className="admin-sidebar-title">MonkeyOnki</span>
        </a>

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
              <span>Active Sessions</span>
              {activeSessionsCount > 0 && (
                <span className="nav-count-badge">{activeSessionsCount}</span>
              )}
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
          <div className="admin-version-pill">
            <span className="live-dot" />
            <span>Telemetry v2.0 Live</span>
          </div>
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
              {currentTab === 'settings' && 'Supabase database configuration, retention & controls'}
            </p>
          </div>

          <div className="admin-top-bar-right">
            {/* Supabase Status Pill */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              className={`supabase-header-pill ${supabaseStatus.configured ? 'online' : 'offline'}`}
              title="Click to check or configure Supabase Database connection"
            >
              <Database size={14} />
              <span className="dot" />
              <span>{supabaseStatus.configured ? 'Supabase: Connected' : 'Supabase: Connect DB'}</span>
            </button>

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

              <div className="summary-card">
                <div className="summary-icon-box purple">
                  <MapPin size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">{totalUpdatesCount}</span>
                  <span className="summary-label">Location Updates</span>
                  <span className="summary-subtitle">GPS signals captured</span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon-box amber">
                  <Radio size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value" style={{ fontSize: 18, color: '#16a34a' }}>
                    {supabaseStatus.configured ? 'PostgreSQL' : 'Serverless Cloud'}
                  </span>
                  <span className="summary-label">Backend Sync</span>
                  <span className="summary-subtitle">
                    {supabaseStatus.configured ? 'Supabase Live' : 'Cross-Device Active'}
                  </span>
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
                      Live Locations {mapSessions.length > 0 && `(${mapSessions.length} pins on map)`}
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
                    sessions={mapSessions}
                    focusLocation={focusLocation}
                    onViewHistory={(session) => setSelectedSessionForHistory(session)}
                  />

                  {mapSessions.length === 0 && (
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
                  <h2 className="dashboard-panel-title">Recent GPS Updates</h2>
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
                        When a candidate opens the job portal and verifies location, their coordinates appear here.
                      </p>
                    </div>
                  ) : (
                    recentUpdates.map((upd) => {
                      const uLat = parseFloat(upd.latitude);
                      const uLng = parseFloat(upd.longitude);
                      const hasValidCoords = !isNaN(uLat) && !isNaN(uLng);

                      return (
                        <div
                          key={upd.id}
                          className="recent-update-item"
                          onClick={() => {
                            if (hasValidCoords) {
                              setFocusLocation({
                                latitude: uLat,
                                longitude: uLng,
                                sessionId: upd.session_id,
                              });
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Click to view on Leaflet map"
                        >
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
                                {hasValidCoords
                                  ? `${uLat.toFixed(5)}, ${uLng.toFixed(5)}`
                                  : 'Coords pending'}
                                {upd.accuracy_meters ? ` (±${Math.round(upd.accuracy_meters)}m)` : ''}
                              </span>
                              {hasValidCoords && (
                                <a
                                  href={`https://www.google.com/maps?q=${uLat},${uLng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="recent-update-maps-link"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open in Google Maps"
                                >
                                  Maps ↗
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
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
                  <h2 className="dashboard-panel-title">Candidate Sessions ({filteredSessions.length})</h2>
                </div>

                <div className="admin-table-filters">
                  <div className="search-input-wrap">
                    <Search size={15} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Search sessions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="status-select"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="ended">Ended</option>
                  </select>

                  <button
                    onClick={loadData}
                    className="table-refresh-btn"
                    title="Refresh Sessions Table"
                  >
                    <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
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
                        <th>Coordinates</th>
                        <th>Last Updated</th>
                        <th>GPS Fixes</th>
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

                        const lat = loc ? parseFloat(loc.latitude) : NaN;
                        const lng = loc ? parseFloat(loc.longitude) : NaN;
                        const hasCoords = !isNaN(lat) && !isNaN(lng);

                        const lastActiveTime = loc?.recorded_at ? new Date(loc.recorded_at).getTime() : 0;
                        const diffSeconds = Math.max(0, Math.floor((Date.now() - lastActiveTime) / 1000));
                        const diffMinutes = Math.floor(diffSeconds / 60);

                        let relativeText = 'Just now';
                        let isLiveActive = false;
                        if (lastActiveTime > 0) {
                          if (diffSeconds < 60) {
                            relativeText = 'Just now';
                            isLiveActive = true;
                          } else if (diffMinutes < 60) {
                            relativeText = `${diffMinutes}m ago`;
                            isLiveActive = diffMinutes <= 3;
                          } else {
                            const diffHours = Math.floor(diffMinutes / 60);
                            relativeText = `${diffHours}h ago`;
                          }
                        }

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
                              </div>
                            </td>
                            <td>
                              {hasCoords ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                                      {lat.toFixed(5)}, {lng.toFixed(5)}
                                    </span>
                                    <a
                                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="table-maps-link"
                                      title="Open in Google Maps"
                                    >
                                      Maps ↗
                                    </a>
                                  </div>
                                  {loc?.accuracy_meters && (
                                    <span style={{ fontSize: 10.5, color: '#64748b' }}>
                                      Accuracy: ±{Math.round(loc.accuracy_meters)}m
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 12 }}>Awaiting GPS fix</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {isLiveActive && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: '#16a34a',
                                        boxShadow: '0 0 6px rgba(22, 163, 74, 0.7)',
                                      }}
                                      title="Live active GPS signal"
                                    />
                                  )}
                                  <span style={{ fontWeight: 700, fontSize: 13, color: isLiveActive ? '#16a34a' : '#1e293b' }}>
                                    {relativeText}
                                  </span>
                                </div>
                                {loc?.recorded_at && (
                                  <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                                    {new Date(loc.recorded_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 12,
                                }}
                              >
                                <Radio size={12} color="#16a34a" />
                                {session.updateCount || 1} fix{(session.updateCount || 1) === 1 ? '' : 'es'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge-status ${session.status}`}>
                                {session.status}
                              </span>
                            </td>
                            <td>
                              <div className="action-btn-group">
                                {hasCoords && (
                                  <button
                                    onClick={() =>
                                      setFocusLocation({
                                        latitude: lat,
                                        longitude: lng,
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
              <h2 className="dashboard-panel-title">Full Geographic Map & Real-time GPS Pins</h2>
              <button onClick={loadData} className="map-overlay-btn">
                <RotateCcw size={14} /> Refresh Markers
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 450 }}>
              <AdminMap
                sessions={mapSessions}
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
              </div>
            </div>

            <div className="sessions-table-wrapper">
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Candidate</th>
                    <th>Device</th>
                    <th>Coordinates</th>
                    <th>Started At</th>
                    <th>Updates</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>
                        No session records captured yet.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => {
                      const lat = s.latestUpdate ? parseFloat(s.latestUpdate.latitude) : NaN;
                      const lng = s.latestUpdate ? parseFloat(s.latestUpdate.longitude) : NaN;
                      const hasCoords = !isNaN(lat) && !isNaN(lng);

                      return (
                        <tr key={s.id}>
                          <td className="user-id-cell">{s.id}</td>
                          <td style={{ fontWeight: 700 }}>{s.display_name}</td>
                          <td>{s.device_info}</td>
                          <td>
                            {hasCoords ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                  {lat.toFixed(5)}, {lng.toFixed(5)}
                                </span>
                                <a
                                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="table-maps-link"
                                >
                                  Maps ↗
                                </a>
                              </div>
                            ) : (
                              'Pending'
                            )}
                          </td>
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
                      );
                    })
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
                sessions.map((session) => {
                  const lat = session.latestUpdate ? parseFloat(session.latestUpdate.latitude) : NaN;
                  const lng = session.latestUpdate ? parseFloat(session.latestUpdate.longitude) : NaN;
                  const hasCoords = !isNaN(lat) && !isNaN(lng);

                  return (
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
                      {hasCoords && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                            {lat.toFixed(5)}, {lng.toFixed(5)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="table-maps-link"
                          >
                            Open in Google Maps ↗
                          </a>
                        </div>
                      )}
                      <button
                        onClick={() => setSelectedSessionForHistory(session)}
                        className="map-popup-btn"
                        style={{ marginTop: 4 }}
                      >
                        View Chronological Logs
                      </button>
                    </div>
                  );
                })
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
                  <span className="summary-label">Total Connections</span>
                  <span className="summary-subtitle">Candidate device records</span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon-box blue">
                  <Smartphone size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">
                    {sessions.filter((s) => s.device_type === 'Mobile' || s.device_info?.includes('Mobile') || s.device_info?.includes('Android') || s.device_info?.includes('iPhone')).length}
                  </span>
                  <span className="summary-label">Mobile Devices</span>
                  <span className="summary-subtitle">Smartphones connected</span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon-box purple">
                  <Monitor size={24} />
                </div>
                <div className="summary-info">
                  <span className="summary-value">
                    {sessions.filter((s) => s.device_type === 'Desktop' || s.device_info?.includes('Windows') || s.device_info?.includes('macOS') || s.device_info?.includes('Linux')).length}
                  </span>
                  <span className="summary-label">Desktop Devices</span>
                  <span className="summary-subtitle">Laptops & Workstations</span>
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
            {/* Supabase Database Settings Card */}
            <div className="dashboard-panel-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Database size={20} color="#16a34a" />
                  <h3 style={{ fontSize: 17, fontWeight: 700 }}>Supabase Database Configuration</h3>
                </div>
                <span className={`supabase-badge ${supabaseStatus.configured ? 'online' : 'offline'}`}>
                  {supabaseStatus.configured ? '🟢 Connected to Supabase' : '🟡 Using Serverless Fallback'}
                </span>
              </div>

              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                Connect your Supabase PostgreSQL project to persist candidate coordinates in the cloud and stream real-time GPS breadcrumbs across all devices.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, maxWidth: 640 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Supabase Project URL:
                  </label>
                  <input
                    type="text"
                    placeholder="https://xyzcompany.supabase.co"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    className="login-input"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Supabase Anon Public Key:
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOi..."
                    value={customKeyInput}
                    onChange={(e) => setCustomKeyInput(e.target.value)}
                    className="login-input"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  <button
                    onClick={handleTestConnection}
                    disabled={testingSupabase}
                    className="map-overlay-btn"
                  >
                    {testingSupabase ? 'Testing Connection...' : 'Test Connection'}
                  </button>

                  <button
                    onClick={handleSaveSupabase}
                    className="login-submit-btn"
                    style={{ width: 'auto', padding: '8px 18px' }}
                  >
                    Save & Activate
                  </button>

                  {supabaseStatus.source === 'custom' && (
                    <button
                      onClick={handleClearSupabase}
                      className="map-overlay-btn"
                      style={{ color: '#ef4444' }}
                    >
                      Reset to Default
                    </button>
                  )}

                  <button
                    onClick={handleCopySql}
                    className="map-overlay-btn"
                    style={{ marginLeft: 'auto' }}
                  >
                    {copiedSql ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {copiedSql ? 'SQL Copied!' : 'Copy Schema SQL'}
                  </button>
                </div>

                {testResult && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '12px 16px',
                      borderRadius: 10,
                      fontSize: 13,
                      background: testResult.success ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
                      color: testResult.success ? '#166534' : '#dc2626',
                    }}
                  >
                    <strong>{testResult.success ? '✅ Success: ' : '❌ Error: '}</strong>
                    {testResult.message || testResult.error}
                  </div>
                )}
              </div>
            </div>

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

      {/* Supabase Connection Modal */}
      {showSupabaseModal && (
        <div className="history-modal-backdrop" onClick={() => setShowSupabaseModal(false)}>
          <div
            className="history-modal-card animate-fade-in"
            style={{ maxWidth: 580 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="history-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Database size={22} color="#16a34a" />
                <div>
                  <h3 className="history-modal-title">Supabase Database Integration</h3>
                  <p style={{ fontSize: 12, color: '#64748b' }}>
                    Current status: {supabaseStatus.configured ? '🟢 Connected' : '🟡 Disconnected (Using Serverless)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSupabaseModal(false)}
                className="action-icon-btn"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Supabase Project URL:
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="login-input"
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Supabase Anon Public Key:
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  className="login-input"
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  onClick={handleTestConnection}
                  disabled={testingSupabase}
                  className="map-overlay-btn"
                >
                  {testingSupabase ? 'Testing Connection...' : 'Test Connection'}
                </button>

                <button
                  onClick={handleSaveSupabase}
                  className="login-submit-btn"
                  style={{ width: 'auto', padding: '8px 18px' }}
                >
                  Save & Connect
                </button>

                <button
                  onClick={handleCopySql}
                  className="map-overlay-btn"
                  style={{ marginLeft: 'auto' }}
                >
                  {copiedSql ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  {copiedSql ? 'SQL Copied!' : 'Copy Schema SQL'}
                </button>
              </div>

              {testResult && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    fontSize: 13,
                    background: testResult.success ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
                    color: testResult.success ? '#166534' : '#dc2626',
                  }}
                >
                  <strong>{testResult.success ? '✅ ' : '❌ '}</strong>
                  {testResult.message || testResult.error}
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                <strong>Tip:</strong> If you haven't run the SQL schema yet, click <strong>"Copy Schema SQL"</strong>, then go to your{' '}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#16a34a', fontWeight: 600 }}
                >
                  Supabase Dashboard → SQL Editor
                </a>
                , paste the SQL and click <strong>Run</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

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
