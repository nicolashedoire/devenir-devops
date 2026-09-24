import http from 'node:http';
const events = [];
http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(events));
  }
  if (req.method !== 'POST' || req.url !== '/alerts') { res.writeHead(404); return res.end(); }
  try {
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 65536) throw Error(); }
    const value = JSON.parse(body);
    for (const alert of value.alerts || []) {
      if (!['firing', 'resolved'].includes(alert.status)) continue;
      const event = { time: new Date().toISOString(), status: alert.status,
        alert: alert.labels?.alertname === 'TaskboardLectureIndisponible'
          ? 'TaskboardLectureIndisponible' : 'autre_alerte' };
      events.push(event); if (events.length > 200) events.shift();
      console.log(JSON.stringify(event));
    }
    res.writeHead(200); res.end('reçu');
  } catch { res.writeHead(400); res.end('requête invalide'); }
}).listen(8090, '0.0.0.0');
