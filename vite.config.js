import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

let devSessions = [];
let devUpdates = [];

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'telemetry-dev-api',
      configureServer(server) {
        server.middlewares.use('/api/telemetry', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            return res.end();
          }

          if (req.method === 'GET') {
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                sessions: devSessions,
                updates: devUpdates,
                timestamp: new Date().toISOString(),
              })
            );
          }

          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const { action } = body;

                if (action === 'startSession') {
                  const { session, initialCoords } = body;
                  const existingIdx = devSessions.findIndex((s) => s.id === session.id);
                  if (existingIdx >= 0) {
                    devSessions[existingIdx] = { ...devSessions[existingIdx], ...session };
                  } else {
                    devSessions.unshift(session);
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
                    devUpdates.unshift(upd);
                  }

                  res.statusCode = 200;
                  return res.end(JSON.stringify({ success: true, session }));
                }

                if (action === 'recordUpdate') {
                  const { update } = body;
                  const safeUpdate = {
                    ...update,
                    latitude: Number(update.latitude),
                    longitude: Number(update.longitude),
                    accuracy_meters: Number(update.accuracy_meters || 10),
                    recorded_at: update.recorded_at || new Date().toISOString(),
                  };
                  devUpdates.unshift(safeUpdate);
                  const s = devSessions.find((sess) => sess.id === update.session_id);
                  if (s) {
                    s.last_active = safeUpdate.recorded_at;
                  }
                  res.statusCode = 200;
                  return res.end(JSON.stringify({ success: true, update: safeUpdate }));
                }

                if (action === 'endSession') {
                  const { sessionId } = body;
                  const s = devSessions.find((sess) => sess.id === sessionId);
                  if (s) {
                    s.status = 'ended';
                    s.ended_at = new Date().toISOString();
                  }
                  res.statusCode = 200;
                  return res.end(JSON.stringify({ success: true }));
                }

                if (action === 'clearAll') {
                  devSessions = [];
                  devUpdates = [];
                  res.statusCode = 200;
                  return res.end(JSON.stringify({ success: true, cleared: true }));
                }

                res.statusCode = 400;
                return res.end(JSON.stringify({ error: `Unknown action: ${action}` }));
              } catch (err) {
                res.statusCode = 500;
                return res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Method not allowed' }));
        });
      },
    },
  ],
});
