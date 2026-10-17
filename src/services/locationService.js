import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Local storage keys for real-time live sessions
const SESSIONS_KEY = 'techpulse_realtime_sessions_v2';
const UPDATES_KEY = 'techpulse_realtime_updates_v2';
const RETENTION_KEY = 'techpulse_retention_days';

// Clean up any old mock data from previous version
try {
  localStorage.removeItem('monkeyonki_sessions_v1');
  localStorage.removeItem('monkeyonki_updates_v1');
} catch (e) {
  // ignore
}

// Helpers for localStorage
function getStoredSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    window.dispatchEvent(new Event('realtime_location_sync'));
  } catch (e) {
    console.error('Storage error', e);
  }
}

function getStoredUpdates() {
  try {
    const raw = localStorage.getItem(UPDATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredUpdates(updates) {
  try {
    localStorage.setItem(UPDATES_KEY, JSON.stringify(updates));
    window.dispatchEvent(new Event('realtime_location_sync'));
  } catch (e) {
    console.error('Storage error', e);
  }
}

// In-memory listeners for cross-component and cross-tab real-time sync
const listeners = new Set();
function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

// Listen to storage events from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSIONS_KEY || event.key === UPDATES_KEY) {
      notifyListeners();
    }
  });
  window.addEventListener('realtime_location_sync', () => {
    notifyListeners();
  });
}

export const locationService = {
  /**
   * Start a visitor session (called when candidate allows location)
   */
  async startSession({ displayName, deviceInfo, browserInfo, initialCoords }) {
    const newSessionId = `CAND-${Date.now().toString().slice(-5)}`;
    const nowIso = new Date().toISOString();

    const newSession = {
      id: newSessionId,
      display_name: displayName || `Candidate ${newSessionId}`,
      device_info: deviceInfo || 'Web Browser',
      browser_info: browserInfo || 'Modern Browser',
      device_type: deviceInfo?.includes('Mobile') ? 'Mobile' : 'Desktop',
      status: 'active',
      consent_at: nowIso,
      started_at: nowIso,
      ended_at: null,
      is_demo: false,
      color: '#16a34a',
    };

    if (isSupabaseConfigured) {
      try {
        const { data: session, error } = await supabase
          .from('location_sessions')
          .insert([
            {
              display_name: newSession.display_name,
              device_info: newSession.device_info,
              browser_info: newSession.browser_info,
              status: 'active',
              consent_at: nowIso,
              started_at: nowIso,
            },
          ])
          .select()
          .single();

        if (!error && session) {
          if (initialCoords) {
            await this.recordUpdate({
              sessionId: session.id,
              latitude: initialCoords.latitude,
              longitude: initialCoords.longitude,
              accuracyMeters: initialCoords.accuracyMeters,
              resolvedAddress: initialCoords.resolvedAddress,
              isDemo: false,
            });
          }
          return session;
        }
      } catch (err) {
        console.warn('Supabase startSession fallback to local:', err.message);
      }
    }

    // Local real-time persistence
    const sessions = getStoredSessions();
    sessions.unshift(newSession);
    setStoredSessions(sessions);

    if (initialCoords) {
      await this.recordUpdate({
        sessionId: newSession.id,
        latitude: initialCoords.latitude,
        longitude: initialCoords.longitude,
        accuracyMeters: initialCoords.accuracyMeters,
        resolvedAddress: initialCoords.resolvedAddress,
        isDemo: false,
      });
    }

    notifyListeners();
    return newSession;
  },

  /**
   * Record a location update
   */
  async recordUpdate({ sessionId, latitude, longitude, accuracyMeters, resolvedAddress, isDemo = false }) {
    const nowIso = new Date().toISOString();
    const newUpdate = {
      id: `upd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      session_id: sessionId,
      latitude,
      longitude,
      accuracy_meters: accuracyMeters,
      resolved_address: resolvedAddress || `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      is_demo: isDemo,
      recorded_at: nowIso,
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('location_updates')
          .insert([
            {
              session_id: sessionId,
              latitude,
              longitude,
              accuracy_meters: accuracyMeters,
              resolved_address: resolvedAddress,
              is_demo: isDemo,
              recorded_at: nowIso,
            },
          ])
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase recordUpdate fallback to local:', err.message);
      }
    }

    // Local updates
    const updates = getStoredUpdates();
    updates.unshift(newUpdate);
    setStoredUpdates(updates);

    // Also update session latest time
    const sessions = getStoredSessions();
    const updatedSessions = sessions.map((s) => {
      if (s.id === sessionId) {
        return { ...s, last_active: nowIso };
      }
      return s;
    });
    setStoredSessions(updatedSessions);

    notifyListeners();
    return newUpdate;
  },

  /**
   * End an active session
   */
  async endSession(sessionId) {
    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('location_sessions')
          .update({
            status: 'ended',
            ended_at: nowIso,
          })
          .eq('id', sessionId);
      } catch (err) {
        console.warn('Supabase endSession fallback:', err.message);
      }
    }

    const sessions = getStoredSessions();
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'ended', ended_at: nowIso } : s
    );
    setStoredSessions(updated);
    notifyListeners();
    return true;
  },

  /**
   * Fetch all real-time sessions with their latest location update
   */
  async getSessionsWithLatestLocation() {
    let sessions = [];
    let updates = [];

    if (isSupabaseConfigured) {
      try {
        const { data: sData } = await supabase
          .from('location_sessions')
          .select('*')
          .order('started_at', { ascending: false });

        const { data: uData } = await supabase
          .from('location_updates')
          .select('*')
          .order('recorded_at', { ascending: false });

        if (sData) sessions = sData;
        if (uData) updates = uData;
      } catch (err) {
        console.warn('Supabase fetch notice:', err.message);
      }
    }

    if (sessions.length === 0) {
      sessions = getStoredSessions();
      updates = getStoredUpdates();
    }

    const palette = ['#16a34a', '#2563eb', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

    return sessions.map((session, index) => {
      const sessionUpdates = updates
        .filter((u) => u.session_id === session.id)
        .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

      const latest = sessionUpdates[0] || null;
      const color = session.color || palette[index % palette.length];

      return {
        ...session,
        color,
        latestUpdate: latest,
        updateCount: sessionUpdates.length,
      };
    });
  },

  /**
   * Fetch recent real-time location updates across all sessions
   */
  async getRecentUpdates(limit = 10) {
    let updates = [];
    let sessions = [];

    if (isSupabaseConfigured) {
      try {
        const { data: uData } = await supabase
          .from('location_updates')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(limit);

        const { data: sData } = await supabase.from('location_sessions').select('*');

        if (uData) updates = uData;
        if (sData) sessions = sData;
      } catch (e) {
        console.warn('Supabase recent updates fallback:', e.message);
      }
    }

    if (updates.length === 0) {
      updates = getStoredUpdates().slice(0, limit);
      sessions = getStoredSessions();
    }

    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    return updates.map((u) => {
      const s = sessionMap.get(u.session_id);
      return {
        ...u,
        session_name: s ? s.display_name : 'Candidate',
        device_info: s ? s.device_info : 'Web Browser',
        color: s?.color || '#16a34a',
      };
    });
  },

  /**
   * Get location history for a specific session
   */
  async getSessionHistory(sessionId) {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('location_updates')
          .select('*')
          .eq('session_id', sessionId)
          .order('recorded_at', { ascending: false });

        if (data) return data;
      } catch (e) {
        console.warn('Supabase history fetch fallback:', e.message);
      }
    }

    const updates = getStoredUpdates();
    return updates
      .filter((u) => u.session_id === sessionId)
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
  },

  /**
   * Delete all data older than retention period
   */
  async cleanupOldHistory(days) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const updates = getStoredUpdates();
    const remaining = updates.filter((u) => new Date(u.recorded_at).toISOString() >= cutoff);
    const count = updates.length - remaining.length;
    setStoredUpdates(remaining);
    notifyListeners();
    return count;
  },

  /**
   * Delete a specific session
   */
  async deleteSession(sessionId) {
    const sessions = getStoredSessions().filter((s) => s.id !== sessionId);
    const updates = getStoredUpdates().filter((u) => u.session_id !== sessionId);
    setStoredSessions(sessions);
    setStoredUpdates(updates);
    notifyListeners();
    return true;
  },

  /**
   * Clear all sessions
   */
  clearAllData() {
    setStoredSessions([]);
    setStoredUpdates([]);
    notifyListeners();
  },

  /**
   * Subscribe to real-time changes
   */
  subscribe(callback) {
    listeners.add(callback);

    let supabaseChannel = null;
    if (isSupabaseConfigured) {
      supabaseChannel = supabase
        .channel('public:realtime_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'location_updates' }, () => {
          callback();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'location_sessions' }, () => {
          callback();
        })
        .subscribe();
    }

    return () => {
      listeners.delete(callback);
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
    };
  },
};
