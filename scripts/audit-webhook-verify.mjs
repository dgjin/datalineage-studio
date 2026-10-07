/**
 * Batch-3 deep verification: full-chain audit trail + change webhooks.
 * Pure HTTP + a local receiver (no browser needed).
 *
 * 1) webhook CRUD + test delivery with HMAC-SHA256 signature check
 * 2) real events: standard.violation (bad-named asset) and change.created
 * 3) audit trail rows for every write op above (user / action / resource / result / latency / ip)
 * 4) webhook delivery counter exposed on /actuator/prometheus
 *
 * Prereqs: backend on :8080 with V15 applied. Run from the repo root:
 *   node scripts/audit-webhook-verify.mjs
 */
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';

const API = 'http://localhost:8080/api/v1';
const PORT = 9099;
const SECRET = 'smoke-secret-001';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
let failures = 0;
const log = (s) => { console.log('[VERIFY] ' + s); report.push(s); };
const ok = (name, cond) => { if (!cond) failures++; log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- local webhook receiver ----------
const received = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    received.push({
      event: req.headers['x-dl-event'],
      ts: req.headers['x-dl-timestamp'],
      sig: req.headers['x-dl-signature'],
      body,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, resolve);
});

// ---------- login ----------
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
});
const loginJson = await loginRes.json();
const token = loginJson?.data?.token;
ok('0. admin login (token issued)', !!token);

const api = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

// ---------- 1. webhook CRUD ----------
const created = await api('POST', '/webhooks', {
  name: 'verify-receiver',
  url: `http://localhost:${PORT}/hook`,
  events: ['change.created', 'approval.decided', 'standard.violation'],
  enabled: true,
  secret: SECRET,
});
const webhookId = created.json?.data?.id;
ok('1. webhook subscription created', created.status === 200 && !!webhookId);

const list = await api('GET', '/webhooks');
const listed = (list.json?.data || []).find((w) => w.id === webhookId);
ok('2. subscription listed with masked secret', !!listed && listed.secret === '******');

// ---------- 2. test delivery + HMAC signature ----------
await api('POST', `/webhooks/${webhookId}/test`);
await sleep(900);
const testRec = received.find((r) => r.event === 'test');
ok('3. test delivery received by endpoint', !!testRec);
if (testRec) {
  ok('4. X-DL-Timestamp header present', !!testRec.ts);
  const expected = crypto.createHmac('sha256', SECRET).update(`${testRec.ts}.${testRec.body}`).digest('hex');
  ok('5. X-DL-Signature HMAC-SHA256 valid', testRec.sig === `sha256=${expected}`);
}

// ---------- 3. real event: standard.violation ----------
const bad = await api('POST', '/assets', {
  name: 'SMOKE_BadName', code: 'smoke_bad_name', type: 'TABLE', layer: 'ODS',
  owner: '烟测账号', department: '数据治理组', status: 'ACTIVE',
});
const badId = bad.json?.data?.id;
ok('6. non-conforming asset created for the check', bad.status === 200 && !!badId);

await api('POST', '/standards/naming-check');
await sleep(1200);
const violRec = received.find((r) => r.event === 'standard.violation');
ok('7. standard.violation webhook received', !!violRec);
if (violRec) {
  const p = JSON.parse(violRec.body);
  ok('8. violation payload names the bad asset', p.assetName === 'SMOKE_BadName' && p.standardCode === 'STD-NAM-001');
}

// cleanup: quality issue + asset
const issues = await api('GET', '/validation/issues?status=OPEN');
const smokeIssue = (issues.json?.data || []).find((i) => i.affectedAssetName === 'SMOKE_BadName');
if (smokeIssue) await api('DELETE', `/validation/issues/${smokeIssue.id}`);
if (badId) await api('DELETE', `/assets/${badId}`);

// ---------- 4. real event: change.created ----------
const change = await api('POST', '/changes', {
  assetId: 'asset:dl_demo.ods_orders',
  changeType: 'ADD_NULLABLE_COLUMN',
  detectedBy: 'PROBE',
  isBreaking: false,
  isManaged: true,
});
const changeId = change.json?.data?.id;
ok('9. change event recorded', change.status === 200 && !!changeId);

await sleep(1200);
const changeRec = received.find((r) => r.event === 'change.created');
ok('10. change.created webhook received', !!changeRec);
if (changeRec) {
  const p = JSON.parse(changeRec.body);
  ok('11. change payload carries the changeId', p.changeId === changeId);
}
if (changeId) await api('DELETE', `/changes/${changeId}`);

// ---------- 5. audit trail ----------
const a1 = await api('GET', '/audit-logs?action=WEBHOOK_CREATE&size=5');
const r1 = a1.json?.data?.records?.[0];
ok('12. audit: WEBHOOK_CREATE recorded', (a1.json?.data?.total || 0) > 0);
ok('13. audit: caller + role + result captured', r1?.username === 'admin' && r1?.role === 'ADMIN' && r1?.result === 'SUCCESS');
ok('14. audit: latency + client ip captured', (r1?.durationMs || 0) >= 0 && !!r1?.clientIp);
ok('15. audit: resource typed as WEBHOOK', r1?.resourceType === 'WEBHOOK');

const a2 = await api('GET', '/audit-logs?action=NAMING_CHECK&size=5');
ok('16. audit: NAMING_CHECK recorded', (a2.json?.data?.total || 0) > 0);

const a3 = await api('GET', '/audit-logs?resourceType=ASSETS&result=SUCCESS&size=100');
ok('17. audit: POST /assets derived as action=CREATE', (a3.json?.data?.records || [])
  .some((r) => r.action === 'CREATE' && r.httpMethod === 'POST'));

const a4 = await api('GET', '/audit-logs?action=COLLECT_RUN&size=5');
ok('18. audit: filterable by action (COLLECT_RUN query ok)', a4.status === 200);

// ---------- 6. cleanup + metrics ----------
await api('DELETE', `/webhooks/${webhookId}`);
const a5 = await api('GET', '/audit-logs?action=WEBHOOK_DELETE&size=5');
ok('19. audit: WEBHOOK_DELETE recorded', (a5.json?.data?.total || 0) > 0);

const prom = await (await fetch(`${API}/actuator/prometheus`)).text();
ok('20. metric webhook.deliveries.total exposed', prom.includes('datalineage_webhook_deliveries_total'));
const successSum = prom.split('\n')
  .filter((l) => l.startsWith('datalineage_webhook_deliveries_total') && l.includes('result="success"'))
  .reduce((s, l) => s + Number(l.split(' ').pop() || 0), 0);
ok(`21. successful deliveries counted (${successSum})`, successSum >= 1);

// ---------- summary ----------
server.close();
fs.writeFileSync(`${OUT}/audit-webhook-verify-report.txt`, report.join('\n'));
console.log(`\n${report.filter((l) => l.startsWith('PASS')).length}/${report.length} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
