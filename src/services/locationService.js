import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Local storage keys for instant local fallback
const SESSIONS_KEY = 'techpulse_realtime_sessions_v2';
const UPDATES_KEY = 'techpulse_realtime_updates_v2';

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('realtime_location_sync'));
    }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('realtime_location_sync'));
    }
  } catch (e) {
    console.error('Storage error', e);
  }
}

// In-memory listeners for cross-component and cross-tab sync
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

// Helper to send telemetry to serverless endpoint
async function sendServerlessTelemetry(action, payload) {
  try {
    const res = await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // silently fallback to client-side storage
  }
  return null;
}

// Helper to fetch telemetry from serverless endpoint
async function fetchServerlessTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    if (res.ok) {
      const data = await res.json();
      return {
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        updates: Array.isArray(data.updates) ? data.updates : [],
      };
    }
  } catch (e) {
    // fallback
  }
  return { sessions: [], updates: [] };
}

export const locationService = {
  /**
   * Start a visitor session (called when candidate allows location)
   */
  async startSession({ displayName, deviceInfo, browserInfo, initialCoords }) {
    const newSessionId = `CAND-${Date.now().toString().slice(-6)}`;
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

    // 1. Send to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: session, error } = await supabase
          .from('location_sessions')
          .upsert([
            {
              id: newSession.id,
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

        if (error) {
          console.warn('Supabase startSession insert notice:', error.message);
        }
      } catch (err) {
        console.warn('Supabase startSession error:', err.message);
      }
    }

    // 2. Broadcast to /api/telemetry (guarantees cross-device sync on Vercel)
    await sendServerlessTelemetry('startSession', {
      session: newSession,
      initialCoords,
    });

    // 3. Local real-time persistence
    const sessions = getStoredSessions();
    const existingIdx = sessions.findIndex((s) => s.id === newSession.id);
    if (existingIdx >= 0) {
      sessions[existingIdx] = { ...sessions[existingIdx], ...newSession };
    } else {
      sessions.unshift(newSession);
    }
    setStoredSessions(sessions);

    // 4. Record initial coordinates update
    if (initialCoords && typeof initialCoords.latitude === 'number') {
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
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy_meters: Number(accuracyMeters || 10),
      resolved_address:
        resolvedAddress || `Coordinates: ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`,
      is_demo: isDemo,
      recorded_at: nowIso,
    };

    // 1. Send to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('location_updates').insert([
          {
            id: newUpdate.id,
            session_id: sessionId,
            latitude: newUpdate.latitude,
            longitude: newUpdate.longitude,
            accuracy_meters: newUpdate.accuracy_meters,
            resolved_address: newUpdate.resolved_address,
            is_demo: isDemo,
            recorded_at: nowIso,
          },
        ]);
        if (error) {
          console.warn('Supabase recordUpdate notice:', error.message);
        }
      } catch (err) {
        console.warn('Supabase recordUpdate error:', err.message);
      }
    }

    // 2. Broadcast to /api/telemetry (cross-device sync on Vercel)
    await sendServerlessTelemetry('recordUpdate', { update: newUpdate });

    // 3. Local updates
    const updates = getStoredUpdates();
    updates.unshift(newUpdate);
    setStoredUpdates(updates);

    // Update session latest time
    const sessions = getStoredSessions();
    const updatedSessions = sessions.map((s) => {
      if (s.id === sessionId) {
        return { ...s, last_active: nowIso, latestUpdate: newUpdate };
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
    if (isSupabaseConfigured && supabase) {
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

    await sendServerlessTelemetry('endSession', { sessionId });

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
    let supabaseSessions = [];
    let supabaseUpdates = [];

    // 1. Fetch from Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sData } = await supabase
          .from('location_sessions')
          .select('*')
          .order('started_at', { ascending: false });

        const { data: uData } = await supabase
          .from('location_updates')
          .select('*')
          .order('recorded_at', { ascending: false });

        if (sData) supabaseSessions = sData;
        if (uData) supabaseUpdates = uData;
      } catch (err) {
        console.warn('Supabase fetch notice:', err.message);
      }
    }

    // 2. Fetch from Vercel Serverless Endpoint (Cross-device data)
    const serverless = await fetchServerlessTelemetry();

    // 3. Fetch from LocalStorage
    const localSessions = getStoredSessions();
    const localUpdates = getStoredUpdates();

    // 4. Merge all sources without duplication
    const sessionMap = new Map();
    [...localSessions, ...serverless.sessions, ...supabaseSessions].forEach((s) => {
      if (s && s.id && !sessionMap.has(s.id)) {
        sessionMap.set(s.id, s);
      }
    });

    const updateMap = new Map();
    [...localUpdates, ...serverless.updates, ...supabaseUpdates].forEach((u) => {
      if (u && u.id && !updateMap.has(u.id)) {
        updateMap.set(u.id, u);
      }
    });

    const allSessions = Array.from(sessionMap.values());
    const allUpdates = Array.from(updateMap.values());

    const palette = ['#16a34a', '#2563eb', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

    return allSessions.map((session, index) => {
      const sessionUpdates = allUpdates
        .filter((u) => u.session_id === session.id)
        .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

      const latest = sessionUpdates[0] || session.latestUpdate || null;
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
  async getRecentUpdates(limit = 15) {
    let supabaseUpdates = [];
    let supabaseSessions = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: uData } = await supabase
          .from('location_updates')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(limit);

        const { data: sData } = await supabase.from('location_sessions').select('*');

        if (uData) supabaseUpdates = uData;
        if (sData) supabaseSessions = sData;
      } catch (e) {
        console.warn('Supabase recent updates notice:', e.message);
      }
    }

    const serverless = await fetchServerlessTelemetry();
    const localUpdates = getStoredUpdates();
    const localSessions = getStoredSessions();

    const updateMap = new Map();
    [...localUpdates, ...serverless.updates, ...supabaseUpdates].forEach((u) => {
      if (u && u.id && !updateMap.has(u.id)) {
        updateMap.set(u.id, u);
      }
    });

    const sessionMap = new Map();
    [...localSessions, ...serverless.sessions, ...supabaseSessions].forEach((s) => {
      if (s && s.id && !sessionMap.has(s.id)) {
        sessionMap.set(s.id, s);
      }
    });

    const sortedUpdates = Array.from(updateMap.values())
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
      .slice(0, limit);

    return sortedUpdates.map((u) => {
      const s = sessionMap.get(u.session_id);
      return {
        ...u,
        latitude: Number(u.latitude),
        longitude: Number(u.longitude),
        accuracy_meters: Number(u.accuracy_meters || 10),
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
    let supabaseHistory = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('location_updates')
          .select('*')
          .eq('session_id', sessionId)
          .order('recorded_at', { ascending: false });

        if (data) supabaseHistory = data;
      } catch (e) {
        console.warn('Supabase history fetch notice:', e.message);
      }
    }

    const serverless = await fetchServerlessTelemetry();
    const localUpdates = getStoredUpdates();

    const updateMap = new Map();
    [...localUpdates, ...serverless.updates, ...supabaseHistory].forEach((u) => {
      if (u && u.session_id === sessionId && !updateMap.has(u.id)) {
        updateMap.set(u.id, u);
      }
    });

    return Array.from(updateMap.values()).sort(
      (a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)
    );
  },

  /**
   * Delete a specific session
   */
  async deleteSession(sessionId) {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('location_sessions').delete().eq('id', sessionId);
      } catch (e) {
        // ignore
      }
    }

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
  async clearAllData() {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('location_updates').delete().neq('id', 'keep_none');
        await supabase.from('location_sessions').delete().neq('id', 'keep_none');
      } catch (e) {
        // ignore
      }
    }
    await sendServerlessTelemetry('clearAll', {});
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
    if (isSupabaseConfigured && supabase) {
      try {
        supabaseChannel = supabase
          .channel('public:telemetry_feed')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'location_updates' }, () => {
            callback();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'location_sessions' }, () => {
            callback();
          })
          .subscribe();
      } catch (e) {
        console.warn('Supabase realtime subscription notice:', e.message);
      }
    }

    return () => {
      listeners.delete(callback);
      if (supabaseChannel && supabase) {
        try {
          supabase.removeChannel(supabaseChannel);
        } catch (e) {
          // ignore
        }
      }
    };
  },
};
