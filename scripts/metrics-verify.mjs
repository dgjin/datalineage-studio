/**
 * Deep verification for P2-9: Actuator + Micrometer Prometheus monitoring.
 * Pure HTTP (no browser): asserts the public scrape endpoint, business gauges,
 * and the collector success-rate counter round-trip (trigger -> finish -> +1).
 *
 * Prereqs: backend on :8080 (new build with micrometer-registry-prometheus).
 */
import fs from 'fs';

const API = 'http://localhost:8080/api/v1';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
const log = (s) => { console.log('[VERIFY] ' + s); report.push(s); };
const ok = (name, cond) => { log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };

const scrape = async () => (await fetch(`${API}/actuator/prometheus`)).text();
/** Sum every sample line of a metric across label combinations. */
const sumMetric = (text, name) =>
  text.split('\n')
    .filter((l) => l.startsWith(name + '{') || l.startsWith(name + ' '))
    .reduce((sum, l) => sum + Number(l.split(' ').pop() || 0), 0);
const singleGauge = (text, name) => {
  const m = text.match(new RegExp('^' + name + '(\\{[^}]*\\})? (\\S+)$', 'm'));
  return m ? Number(m[2]) : null;
};

// ---------- 1. health ----------
const healthRes = await fetch(`${API}/actuator/health`);
const health = await healthRes.json();
ok('1. /actuator/health -> 200 UP', healthRes.status === 200 && health.status === 'UP');

// ---------- 2. prometheus scrape (public, RBAC unaffected) ----------
const promRes = await fetch(`${API}/actuator/prometheus`);
const text = await promRes.text();
ok('2. /actuator/prometheus -> 200 without token', promRes.status === 200);
ok('3. application tag present', text.includes('application="datalineage-studio"'));
ok('4. HTTP server meters present (API response time)', text.includes('http_server_requests_seconds_count'));
ok('5. latency histogram enabled', text.includes('http_server_requests_seconds_bucket'));
ok('6. JVM meters present', text.includes('jvm_memory_used_bytes'));

// ---------- 3. business gauges (live DB counts) ----------
const assets = singleGauge(text, 'datalineage_assets_total');
const edges = singleGauge(text, 'datalineage_lineage_edges_total');
const openIssues = singleGauge(text, 'datalineage_validation_open_issues');
const pending = singleGauge(text, 'datalineage_changes_pending_approval');
ok(`7. gauge datalineage_assets_total = ${assets} (>0)`, assets !== null && assets > 0);
ok(`8. gauge datalineage_lineage_edges_total = ${edges} (>0)`, edges !== null && edges > 0);
ok(`9. gauge datalineage_validation_open_issues = ${openIssues} (>=0)`, openIssues !== null && openIssues >= 0);
ok(`10. gauge datalineage_changes_pending_approval = ${pending} (>=0)`, pending !== null && pending >= 0);

// ---------- 4. collector metrics round-trip ----------
const runsBefore = sumMetric(text, 'datalineage_collector_runs_total');
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
}).then((r) => r.json());
const token = login.data.token;

const tasks = await fetch(`${API}/collect-tasks`).then((r) => r.json());
const taskId = tasks.data[0].id;
const runRes = await fetch(`${API}/collect-tasks/${taskId}/run`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
ok('11. admin triggers a collection run (200)', runRes.status === 200);

let finished = false;
for (let i = 0; i < 25; i++) {
  await new Promise((r) => setTimeout(r, 700));
  const st = await fetch(`${API}/collect-tasks/${taskId}/run-status`).then((r) => r.json());
  const status = st.data?.status;
  if (status === 'SUCCESS' || status === 'FAILED') { finished = true; break; }
}
ok('12. collection run finished', finished);

await new Promise((r) => setTimeout(r, 400));
const after = await scrape();
const runsAfter = sumMetric(after, 'datalineage_collector_runs_total');
ok(`13. datalineage_collector_runs_total increased (${runsBefore} -> ${runsAfter})`, runsAfter > runsBefore);
ok('14. runs tagged by status (success/failed)', after.includes('status="success"') || after.includes('status="failed"'));
const durCount = sumMetric(after, 'datalineage_collector_run_duration_seconds_count');
ok('15. collector.run.duration timer recorded', durCount >= 1);

// ---------- 5. write endpoints still protected ----------
const putRes = await fetch(`${API}/notifications/read-all`, { method: 'PUT' });
ok('16. write without token still 401 (RBAC intact)', putRes.status === 401);

fs.writeFileSync(OUT + '/metrics-verify-report.txt', report.join('\n'));
console.log('DONE');
