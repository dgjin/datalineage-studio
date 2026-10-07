/**
 * Batch-1 deep verification: bitemporal lineage + collect reliability.
 * Pure HTTP (plus one read-only DB count via the dev mysql container).
 *
 * 1) collect retry: unreachable datasource -> 3 attempts with 2s/8s backoff,
 *    run FAILED, runLog.detail.attempts = 3
 * 2) point-in-time replay: /lineage/edges/at-time past = 0 edges (differs from
 *    current), future = current head count (valid_to-aware predicate)
 * 3) valid-edge filtering: live API count == DB rows with valid_to IS NULL
 * 4) retention sweep endpoint (90-day policy) responds
 *
 * Prereqs: backend :8080 (V14+), mysql 3307 container 'dl-mysql-test'.
 * Run from the repo root: node scripts/bitemporal-verify.mjs
 */
import { execFileSync } from 'child_process';
import fs from 'fs';

const API = 'http://localhost:8080/api/v1';
const MYSQL_CONTAINER = 'dl-mysql-test';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
let failures = 0;
const log = (s) => { console.log('[VERIFY] ' + s); report.push(s); };
const ok = (name, cond) => { if (!cond) failures++; log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- login ----------
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
});
const token = (await loginRes.json())?.data?.token;
ok('0. admin login (token issued)', !!token);

const api = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

// ---------- 1. collect retry: 3 attempts, FAILED, detail.attempts=3 ----------
const stamp = Date.now().toString().slice(-6);
const dsRes = await api('POST', '/datasources', {
  name: `SMOKE-bad-ds-${stamp}`, type: 'MYSQL', host: '127.0.0.1', port: 59999,
  databaseName: 'nope', username: 'root', passwordEncrypted: 'bad', sslEnabled: false,
  status: 'ACTIVE',
});
const dsId = dsRes.json?.data?.id;
ok('1. unreachable datasource created', dsRes.status === 200 && !!dsId);

const taskRes = await api('POST', '/collect-tasks', {
  dataSourceId: dsId, taskName: `SMOKE-bad-task-${stamp}`, collectScope: 'SCHEMA_ONLY',
  targetSchemas: ['nope'], autoRegisterAsset: true, autoDiscoverLineage: true,
  status: 'ACTIVE',
});
const taskId = taskRes.json?.data?.id;
ok('2. collect task created', taskRes.status === 200 && !!taskId);

const runRes = await api('POST', `/collect-tasks/${taskId}/run`);
ok('3. run accepted (async)', runRes.json?.data?.accepted === true);

let status = null;
for (let i = 0; i < 45; i++) {
  await sleep(2000);
  const st = await api('GET', `/collect-tasks/${taskId}/run-status`);
  status = st.json?.data;
  if (status && status.running === false) break;
}
ok('4. run finished (not running anymore)', !!status && status.running === false);

const logs = await api('GET', `/collect-tasks/${taskId}/logs?limit=1`);
const lastLog = logs.json?.data?.[0];
ok('5. run log status = FAILED', lastLog?.status === 'FAILED');
const detail = lastLog?.detail || {};
ok(`6. detail.attempts = 3 (got ${detail.attempts})`, detail.attempts === 3);
// 2s + 8s backoff between the three attempts; connection-refused fails instantly
ok(`7. backoff evidence: durationMs >= 9000 (got ${lastLog?.durationMs})`, (lastLog?.durationMs || 0) >= 9000);
ok('8. error message captured on the log', !!lastLog?.errors?.[0]?.message);

// cleanup the smoke datasource/task (run logs intentionally left for audit trail)
if (taskId) await api('DELETE', `/collect-tasks/${taskId}`);
if (dsId) await api('DELETE', `/datasources/${dsId}`);

// ---------- 2. point-in-time replay ----------
const current = await api('GET', '/lineage/edges');
const currentCount = (current.json?.data || []).length;
ok(`9. current head edge set non-empty (${currentCount})`, currentCount > 0);

const past = await api('GET', `/lineage/edges/at-time?time=${encodeURIComponent('2020-01-01 00:00:00')}`);
const pastCount = past.json?.data?.edgeCount;
ok(`10. replay far past returns 0 edges (got ${pastCount})`, pastCount === 0);
ok('11. historical edge set differs from current head', pastCount !== currentCount);

const future = await api('GET', `/lineage/edges/at-time?time=${encodeURIComponent('2030-01-01 00:00:00')}`);
const futureCount = future.json?.data?.edgeCount;
ok(`12. replay future equals current head (${futureCount} == ${currentCount})`, futureCount === currentCount);

// ---------- 3. valid-edge filtering (API == DB) ----------
try {
  const q = (sql) => execFileSync('docker', ['exec', MYSQL_CONTAINER, 'mysql',
    '-uroot', '-proot123', '-N', '-e', sql], { encoding: 'utf8' }).trim();
  const validDb = Number(q('SELECT COUNT(*) FROM datalineage.lineage_edges WHERE valid_to IS NULL'));
  const totalDb = Number(q('SELECT COUNT(*) FROM datalineage.lineage_edges'));
  ok(`13. live API count == valid_to IS NULL rows (${currentCount} == ${validDb})`, currentCount === validDb);
  if (totalDb > validDb) {
    log(`INFO  ${totalDb - validDb} retired edge(s) exist and are excluded from the live graph`);
  } else {
    log('INFO  no retired edges in this dataset (filter equality still asserted)');
  }
} catch (e) {
  log('SKIP  DB count unavailable (' + String(e.message).split('\n')[0] + ')');
}

// ---------- 4. retention sweep (90-day policy) ----------
const sweep = await api('POST', '/lineage/retention/sweep');
ok('14. retention sweep responds', sweep.status === 200);
ok('15. retention policy = 90 days', sweep.json?.data?.retentionDays === 90);
log(`INFO  sweep expired ${sweep.json?.data?.expiredEdges} stale edge(s)`);

// ---------- summary ----------
fs.writeFileSync(`${OUT}/bitemporal-verify-report.txt`, report.join('\n'));
console.log(`\n${report.filter((l) => l.startsWith('PASS')).length}/${report.filter((l) => l.startsWith('PASS') || l.startsWith('FAIL')).length} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
