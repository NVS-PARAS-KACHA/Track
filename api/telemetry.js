import fs from 'fs';

// In-memory telemetry cache for active Vercel serverless containers
let inMemorySessions = global._telemetrySessions || [];
let inMemoryUpdates = global._telemetryUpdates || [];

const TMP_FILE = '/tmp/telemetry_store.json';

function loadPersistedData() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf8');
      const data = JSON.parse(content);
      if (Array.isArray(data.sessions)) inMemorySessions = data.sessions;
      if (Array.isArray(data.updates)) inMemoryUpdates = data.updates;
    }
  } catch (e) {
    // ignore
  }
}

function persistData() {
  try {
    global._telemetrySessions = inMemorySessions;
    global._telemetryUpdates = inMemoryUpdates;
    fs.writeFileSync(
      TMP_FILE,
      JSON.stringify({ sessions: inMemorySessions, updates: inMemoryUpdates }),
      'utf8'
    );
  } catch (e) {
    // ignore
  }
}

// Initial load
loadPersistedData();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  loadPersistedData();

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      sessions: inMemorySessions,
      updates: inMemoryUpdates,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action } = body || {};

      if (action === 'startSession') {
        const { session, initialCoords } = body;
        if (!session || !session.id) {
          return res.status(400).json({ error: 'Missing session data' });
        }

        const existingIdx = inMemorySessions.findIndex((s) => s.id === session.id);
        if (existingIdx >= 0) {
          inMemorySessions[existingIdx] = { ...inMemorySessions[existingIdx], ...session };
        } else {
          inMemorySessions.unshift(session);
        }

        if (initialCoords && typeof initialCoords.latitude === 'number') {
          const upd = {
            id: `upd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            session_id: session.id,
            latitude: Number(initialCoords.latitude),
            longitude: Number(initialCoords.longitude),
            accuracy_meters: Number(initialCoords.accuracyMeters || 10),
            resolved_address:
              initialCoords.resolvedAddress ||
              `Coordinates: ${initialCoords.latitude.toFixed(4)}, ${initialCoords.longitude.toFixed(4)}`,
            is_demo: false,
            recorded_at: new Date().toISOString(),
          };
          inMemoryUpdates.unshift(upd);
        }

        persistData();
        return res.status(200).json({ success: true, session });
      }

      if (action === 'recordUpdate') {
        const { update } = body;
        if (!update || !update.session_id) {
          return res.status(400).json({ error: 'Missing update data' });
        }

        const safeUpdate = {
          ...update,
          latitude: Number(update.latitude),
          longitude: Number(update.longitude),
          accuracy_meters: Number(update.accuracy_meters || 10),
          recorded_at: update.recorded_at || new Date().toISOString(),
        };

        inMemoryUpdates.unshift(safeUpdate);

        const s = inMemorySessions.find((sess) => sess.id === update.session_id);
        if (s) {
          s.last_active = safeUpdate.recorded_at;
          s.latestUpdate = safeUpdate;
        }

        persistData();
        return res.status(200).json({ success: true, update: safeUpdate });
      }

      if (action === 'endSession') {
        const { sessionId } = body;
        const s = inMemorySessions.find((sess) => sess.id === sessionId);
        if (s) {
          s.status = 'ended';
          s.ended_at = new Date().toISOString();
        }
        persistData();
        return res.status(200).json({ success: true });
      }

      if (action === 'clearAll') {
        inMemorySessions = [];
        inMemoryUpdates = [];
        persistData();
        return res.status(200).json({ success: true, cleared: true });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
