import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ShieldCheck, CheckCircle2, Clock, AlertCircle, Smile, PauseCircle } from 'lucide-react';
import { locationService } from '../services/locationService';
import { reverseGeocode, getClientDeviceInfo } from '../services/geocoding';
import './VisitorLanding.css';

export const VisitorLanding = ({ onNavigateAdmin }) => {
  // Demonstration location state
  const demoLocation = {
    title: 'Pune, Maharashtra, India',
    latitude: 18.5204,
    longitude: 73.8567,
    accuracy: null,
    isDemo: true,
  };

  const [currentLocation, setCurrentLocation] = useState(demoLocation);
  const [permissionStatus, setPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied', 'unavailable'
  const [denialMessage, setDenialMessage] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [isSharing, setIsSharing] = useState(false);

  // References to handle interval & cleanup
  const intervalRef = useRef(null);
  const permissionRequestedRef = useRef(false);
  const sessionIdRef = useRef(null);

  // Helper to format friendly time
  const formatTime = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  /**
   * Request location from browser once on mount
   */
  useEffect(() => {
    if (permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;

    if (!('geolocation' in navigator)) {
      setPermissionStatus('unavailable');
      setDenialMessage('Geolocation is not supported by your browser.');
      return;
    }

    // Automatically attempt to request browser location permission once
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setPermissionStatus('granted');
        setIsSharing(true);

        // Reverse geocode actual location
        const resolved = await reverseGeocode(latitude, longitude);

        const realLocation = {
          title: resolved,
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          isDemo: false,
        };

        setCurrentLocation(realLocation);
        const now = new Date();
        setLastUpdateTime(now);

        // Start location sharing session
        const deviceInfo = getClientDeviceInfo();
        try {
          const session = await locationService.startSession({
            displayName: 'Live Visitor',
            deviceInfo: deviceInfo.formattedDevice,
            browserInfo: deviceInfo.browser,
            initialCoords: {
              latitude,
              longitude,
              accuracyMeters: accuracy,
              resolvedAddress: resolved,
            },
          });

          if (session) {
            setActiveSession(session);
            sessionIdRef.current = session.id;
          }
        } catch (err) {
          console.warn('Could not register session:', err);
        }
      },
      (error) => {
        setPermissionStatus('denied');
        if (error.code === error.PERMISSION_DENIED) {
          setDenialMessage('Location access was denied. Showing sample Pune demonstration data.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setDenialMessage('Location information is currently unavailable from GPS hardware.');
        } else if (error.code === error.TIMEOUT) {
          setDenialMessage('Location request timed out. Showing demo location.');
        } else {
          setDenialMessage('Location unavailable. Showing demo location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // Stop location updates when the page is unloaded or hidden
    const handleVisibilityChange = () => {
      if (document.hidden && sessionIdRef.current) {
        // Paused while hidden to respect battery and privacy
      }
    };

    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        locationService.endSession(sessionIdRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  /**
   * Location updates: Request fresh location every 2 minutes while active
   */
  useEffect(() => {
    if (!isSharing || permissionStatus !== 'granted' || !sessionIdRef.current) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Interval: 2 minutes (120,000 ms)
    intervalRef.current = setInterval(() => {
      if (document.hidden) return; // Do not update if tab is minimized

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const resolved = await reverseGeocode(latitude, longitude);

          setCurrentLocation({
            title: resolved,
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            isDemo: false,
          });

          const now = new Date();
          setLastUpdateTime(now);

          // Send authorized location update to backend
          await locationService.recordUpdate({
            sessionId: sessionIdRef.current,
            latitude,
            longitude,
            accuracyMeters: accuracy,
            resolvedAddress: resolved,
            isDemo: false,
          });
        },
        (err) => {
          console.warn('Periodic location update error:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }, 120000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSharing, permissionStatus]);

  /**
   * Stop sharing handler
   */
  const handleStopSharing = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsSharing(false);
    if (sessionIdRef.current) {
      await locationService.endSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };

  return (
    <div className="visitor-page-container">
      <main className="visitor-card animate-fade-in">
        {/* Header */}
        <header className="visitor-header">
          <div className="visitor-brand">
            <img
              src="/assets/monkey_logo.jpg"
              alt="MonkeyOnki Logo"
              className="visitor-logo-img"
            />
            <span className="visitor-brand-name">MonkeyOnki</span>
          </div>

          <div className="visitor-header-right">
            {/* Subtle avatar/emoji - allows administrators to switch to /admin */}
            <button
              className="visitor-avatar-icon"
              title="Admin Access (Navigate to /admin)"
              onClick={() => onNavigateAdmin?.()}
              aria-label="Admin Access"
            >
              <Smile size={18} />
            </button>
          </div>
        </header>

        {/* Hero Mascot Illustration */}
        <section className="visitor-hero-section">
          <div className="visitor-mascot-wrapper animate-float">
            <img
              src="/assets/monkey_mascot.jpg"
              alt="MonkeyOnki Mascot — Cute friendly cartoon monkey"
              className="visitor-mascot-img"
            />
          </div>
        </section>

        {/* Welcome Headings */}
        <section className="visitor-content-section">
          <h1 className="visitor-title">Welcome to Pune!</h1>
          <p className="visitor-subtitle">
            Exploring new places, one moment at a time.
            <span role="img" aria-label="leaf">🍃</span>
          </p>
        </section>

        {/* Privacy & Purpose Explanation Notice */}
        <div className="visitor-notice-banner">
          <ShieldCheck size={16} color="#16a34a" style={{ minWidth: 16, marginTop: 2 }} />
          <span>
            {permissionStatus === 'granted'
              ? 'Real-time location sharing is active with end-to-end privacy controls.'
              : 'MonkeyOnki uses your location to provide a dynamic, tailored geographical experience.'}
          </span>
        </div>

        {/* Location Display Card */}
        <section className={`visitor-location-card ${currentLocation.isDemo ? '' : 'verified'}`}>
          <div className="visitor-location-card-top">
            <div className="visitor-location-info-left">
              <div className="visitor-pin-icon-wrap">
                <MapPin size={22} />
              </div>
              <div className="visitor-location-text-wrap">
                <h2 className="visitor-location-heading">{currentLocation.title}</h2>
                <span className="visitor-location-coords">
                  {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                  {currentLocation.accuracy ? ` (±${currentLocation.accuracy}m)` : ''}
                </span>
              </div>
            </div>

            {currentLocation.isDemo ? (
              <span className="visitor-badge-demo" title="Sample demonstration location">
                Demo Location
              </span>
            ) : (
              <span className="visitor-badge-verified">
                <CheckCircle2 size={12} />
                Verified
              </span>
            )}
          </div>

          <p className="visitor-location-description">
            {currentLocation.isDemo
              ? (denialMessage || 'This is a sample location. The actual location will be shown after permission is granted.')
              : `Authorized GPS coordinates active. Updates occur periodically while browsing.`}
          </p>
        </section>

        {/* Unobtrusive Active Sharing Status Indicator */}
        {isSharing && permissionStatus === 'granted' && (
          <div className="visitor-sharing-status-bar animate-fade-in">
            <div className="visitor-sharing-status-info">
              <div className="pulse-dot" />
              <span>Location Sharing Active</span>
              {lastUpdateTime && (
                <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 4 }}>
                  (Updated {formatTime(lastUpdateTime)})
                </span>
              )}
            </div>

            <button
              onClick={handleStopSharing}
              className="visitor-stop-sharing-btn"
              title="End location session and cease sharing"
            >
              <PauseCircle size={13} />
              Stop Sharing
            </button>
          </div>
        )}

        {/* Scenic Pune Fortress Footer Illustration */}
        <footer className="visitor-scenic-footer">
          <div className="visitor-scenic-overlay" />
          <img
            src="/assets/pune_landscape.jpg"
            alt="Scenic view of historic Pune fortress and green hills"
            className="visitor-scenic-img"
          />
        </footer>
      </main>
    </div>
  );
};
