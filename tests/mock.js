// Minimal stand-in for the Supabase auth + REST API, with the same row-level rules as the real project.
const http = require('http');
const db = { admins: [], rooms: [], versions: [], n: 0 };
module.exports = { db, start(port) {
  return new Promise((res) => http.createServer((req, rsp) => {
    const u = new URL(req.url, 'http://x'), q = u.searchParams;
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const send = (code, obj) => { rsp.writeHead(code, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Content-Type': 'application/json' }); rsp.end(JSON.stringify(obj)); };
      if (req.method === 'OPTIONS') return send(200, {});
      const j = body ? JSON.parse(body) : null;
      const authed = req.headers.authorization === 'Bearer tok-u1', admin = authed && db.admins.includes('u1');
      if (!req.headers.apikey) return send(401, { message: 'No API key' });
      if (u.pathname === '/auth/v1/token') {
        if (q.get('grant_type') === 'password' && j.password !== 'pw') return send(400, { msg: 'Invalid login credentials' });
        return send(200, { access_token: 'tok-u1', refresh_token: 'r1', user: { id: 'u1', email: j.email || 'dan@example.com' } });
      }
      const eq = (k) => (q.get(k) || '').startsWith('eq.') ? q.get(k).slice(3) : null;
      if (u.pathname === '/rest/v1/admins') return send(200, admin ? [{ user_id: 'u1' }] : []);
      if ((u.pathname === '/rest/v1/rooms' || u.pathname === '/rest/v1/rooms_wide')) {
        if (req.method === 'GET') {
          let rows = db.rooms.filter((r) => admin || r.published_version_id);
          if (q.get('published_version_id') === 'not.is.null') rows = rows.filter((r) => r.published_version_id);
          return send(200, rows.slice().reverse());
        }
        if (!admin) return req.method === 'POST' ? send(403, { message: 'new row violates row-level security policy for table "rooms"' }) : send(200, []);
        if (req.method === 'POST') { const r = Object.assign({ id: 'room-' + (++db.n), published_version_id: null }, j); db.rooms.push(r); return send(201, [r]); }
        const r = db.rooms.find((x) => x.id === eq('id')); if (!r) return send(200, []);
        Object.assign(r, j); return send(200, [r]);
      }
      if ((u.pathname === '/rest/v1/room_versions' || u.pathname === '/rest/v1/room_versions_wide')) {
        if (req.method === 'GET') {
          let rows = db.versions.filter((v) => admin || db.rooms.some((r) => r.published_version_id === v.id));
          if (eq('room_id')) rows = rows.filter((v) => v.room_id === eq('room_id'));
          if (eq('id')) rows = rows.filter((v) => v.id === eq('id'));
          const inn = /^in\.\((.*)\)$/.exec(q.get('id') || ''); if (inn) rows = rows.filter((v) => inn[1].split(',').includes(v.id));
          return send(200, rows.slice().reverse());
        }
        if (!admin) return send(403, { message: 'new row violates row-level security policy for table "room_versions"' });
        const v = Object.assign({ id: 'ver-' + (++db.n), created_at: new Date(Date.now() + db.n * 60000).toISOString() }, j); db.versions.push(v); return send(201, [v]);
      }
      send(404, { message: 'not found' });
    });
  }).listen(port, () => res()));
} };
