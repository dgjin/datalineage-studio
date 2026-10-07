/**
 * Deep verification for M13 model versioning (V17):
 * PowerDesigner .pdm parsing, re-import version bump, version diff,
 * replay, baseline diff and markdown/csv export.
 *
 * Prereqs: backend on :8080 with V17 applied.
 * Idempotent: version assertions are relative to the existing version chain.
 */
import fs from 'fs';

const BASE = 'http://localhost:8080/api/v1';
const MODEL_NAME = 'PDM 冒烟模型';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const report = [];
const log = (s) => { console.log('[VERIFY] ' + s); report.push(s); };
let failures = 0;
const ok = (name, cond) => {
  log((cond ? 'PASS  ' : 'FAIL  ') + name);
  if (!cond) failures++;
  return cond;
};

// --- Auth ---
const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
});
const authData = (await loginRes.json()).data;
const auth = { Authorization: `Bearer ${authData.token}` };

async function apiJson(method, path) {
  const res = await fetch(BASE + path, { method, headers: auth });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(`${method} ${path}: HTTP ${res.status} ${json.message || ''}`);
  }
  return json.data;
}

async function importPdm(filePath, name) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/xml' }), filePath.split('/').pop());
  fd.append('name', name);
  fd.append('targetLayer', 'ODS');
  const res = await fetch(`${BASE}/models/import`, { method: 'POST', headers: auth, body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(`import: HTTP ${res.status} ${json.message || ''}`);
  }
  return json.data;
}

// --- Baseline: how many versions already exist for this model name ---
const models = await apiJson('GET', '/models');
const existing = models.find((m) => m.name === MODEL_NAME);
let baseVersion = 0;
if (existing) {
  const vs = await apiJson('GET', `/models/${existing.id}/versions`);
  baseVersion = vs.reduce((mx, v) => Math.max(mx, v.versionNo || 0), 0);
}
log(`baseline: existing model=${existing ? existing.id : 'none'}, maxVersionNo=${baseVersion}`);

// --- 1. Import PowerDesigner .pdm (first import) ---
const imp1 = await importPdm(`${ROOT}/fixtures/pdm-sample.pdm`, MODEL_NAME);
const v1No = baseVersion + 1;
ok(`1.1 .pdm imported as v${v1No}.0`, imp1.version === `v${v1No}.0`);
ok('1.2 sourceFormat = PD_PDM', imp1.sourceFormat === 'PD_PDM');
ok('1.3 tableCount = 3', imp1.tableCount === 3);
ok('1.4 columnCount = 13', imp1.columnCount === 13);

// --- 2. Re-import same name (v2) ---
const imp2 = await importPdm(`${ROOT}/fixtures/pdm-sample-v2.pdm`, MODEL_NAME);
const v2No = baseVersion + 2;
ok(`2.1 same-name re-import bumps to v${v2No}.0`, imp2.version === `v${v2No}.0`);
ok('2.2 same model id reused', imp2.id === imp1.id);
ok('2.3 tableCount = 4 after v2', imp2.tableCount === 4);
ok('2.4 columnCount = 16 after v2', imp2.columnCount === 16);

// --- 3. Version history ---
const versions = await apiJson('GET', `/models/${imp2.id}/versions`);
ok('3.1 version chain has >= 2 records', versions.length >= 2);
ok('3.2 newest version first', versions[0].versionNo === v2No);
ok('3.3 raw_xml not leaked in history', versions.every((v) => !v.rawXml));
const v1Record = versions.find((v) => v.versionNo === v1No);
const v2Record = versions.find((v) => v.versionNo === v2No);
ok('3.4 version labels rendered', v1Record?.versionLabel === `v${v1No}.0` && v2Record?.versionLabel === `v${v2No}.0`);

// --- 4. Version diff v1 -> v2 ---
const diff = await apiJson('GET', `/models/${imp2.id}/versions/diff?from=${v1No}&to=${v2No}`);
ok('4.1 tablesAdded = 1', diff.summary.tablesAdded === 1);
ok('4.2 tablesRemoved = 0', diff.summary.tablesRemoved === 0);
ok('4.3 columnsAdded = 1', diff.summary.columnsAdded === 1);
ok('4.4 columnsRemoved = 1', diff.summary.columnsRemoved === 1);
ok('4.5 columnsChanged = 1', diff.summary.columnsChanged === 1);
ok('4.6 total = 4', diff.summary.total === 4);
ok('4.7 added table is ODS_PRD_PRODUCT', diff.tablesAdded[0]?.table === 'ODS_PRD_PRODUCT');
ok('4.8 removed column is CUST_LEVEL', diff.columnsRemoved.some((c) => c.table === 'ODS_CRM_CUSTOMER' && c.column === 'CUST_LEVEL'));
ok('4.9 changed column ORDER_STATUS 32 -> 64', diff.columnsChanged.some((c) => c.column === 'ORDER_STATUS' && c.fromType === 'VARCHAR2(32)' && c.toType === 'VARCHAR2(64)'));
ok('4.10 added column PRODUCT_NAME in ORDER_ITEM', diff.columnsAdded.some((c) => c.table === 'ODS_OMS_ORDER_ITEM' && c.column === 'PRODUCT_NAME'));
ok('4.11 fromVersion label v' + v1No + '.0', diff.fromVersion?.versionLabel === `v${v1No}.0`);

// --- 5. Explicit empty baseline diff (from=0) ---
const bdiff = await apiJson('GET', `/models/${imp2.id}/versions/diff?from=0&to=${v2No}`);
ok('5.1 baseline: fromVersion = null', bdiff.fromVersion === null);
ok('5.2 baseline adds all 4 v2 tables', bdiff.summary.tablesAdded === 4);

// --- 6. Version replay (re-parse archived raw file) ---
const replayV1 = await apiJson('GET', `/model-versions/${v1Record.id}/tables`);
ok('6.1 replayed v1 has 3 tables', replayV1.length === 3);
const replayCustomer = replayV1.find((t) => t.tableName === 'ODS_CRM_CUSTOMER');
ok('6.2 replayed v1 still contains CUST_LEVEL', replayCustomer?.columns?.some((c) => c.name === 'CUST_LEVEL'));
ok('6.3 replay marks CUSTOMER_ID primary', replayCustomer?.columns?.some((c) => c.name === 'CUSTOMER_ID' && c.isPrimary === true));

// --- 7. FK direction from pdm References (child -> parent) ---
const replayV2 = await apiJson('GET', `/model-versions/${v2Record.id}/tables`);
const orderTable = replayV2.find((t) => t.tableName === 'ODS_OMS_ORDER');
const itemTable = replayV2.find((t) => t.tableName === 'ODS_OMS_ORDER_ITEM');
const fkCustomer = (orderTable?.relations || []).find((r) => r.toTable === 'ODS_CRM_CUSTOMER');
ok('7.1 FK order->customer parsed', !!fkCustomer);
ok('7.2 FK from = child col CUSTOMER_ID', fkCustomer?.fromCol === 'CUSTOMER_ID' && fkCustomer?.fromTable === 'ODS_OMS_ORDER');
ok('7.3 FK to = parent col CUSTOMER_ID', fkCustomer?.toCol === 'CUSTOMER_ID');
const fkOrder = (itemTable?.relations || []).find((r) => r.toTable === 'ODS_OMS_ORDER');
ok('7.4 FK item->order parsed', !!fkOrder && fkOrder.fromCol === 'ORDER_ID');

// --- 8. Export markdown ---
const mdRes = await fetch(`${BASE}/models/${imp2.id}/compare/export?format=markdown&from=${v1No}&to=${v2No}`, { headers: auth });
ok('8.1 markdown export HTTP 200', mdRes.status === 200);
const mdDisposition = mdRes.headers.get('content-disposition') || '';
ok('8.2 Content-Disposition attachment .md', mdDisposition.includes('attachment') && mdDisposition.includes('.md'));
const mdText = await mdRes.text();
ok('8.3 markdown contains report title', mdText.includes('模型版本对比报告'));
ok('8.4 markdown lists added table', mdText.includes('ODS_PRD_PRODUCT'));
ok('8.5 markdown lists changed column', mdText.includes('ORDER_STATUS') && mdText.includes('VARCHAR2(32)'));

// --- 9. Export csv ---
const csvRes = await fetch(`${BASE}/models/${imp2.id}/compare/export?format=csv&from=${v1No}&to=${v2No}`, { headers: auth });
ok('9.1 csv export HTTP 200', csvRes.status === 200);
const csvDisposition = csvRes.headers.get('content-disposition') || '';
ok('9.2 Content-Disposition attachment .csv', csvDisposition.includes('.csv'));
const csvText = await csvRes.text();
ok('9.3 csv header row', csvText.includes('diffType,table,column,fromValue,toValue'));
ok('9.4 csv TABLE_ADDED row', csvText.includes('TABLE_ADDED,ODS_PRD_PRODUCT'));
ok('9.5 csv COLUMN_CHANGED row', csvText.includes('COLUMN_CHANGED,ODS_OMS_ORDER,ORDER_STATUS,VARCHAR2(32),VARCHAR2(64)'));

// --- 10. Unsupported format is rejected with a clear message ---
{
  const fd = new FormData();
  fd.append('file', new Blob(['<diagram><contents/></diagram>'], { type: 'application/xml' }), 'fake.erm');
  fd.append('name', 'Unsupported Format Probe');
  const res = await fetch(`${BASE}/models/import`, { method: 'POST', headers: auth, body: fd });
  const json = await res.json().catch(() => ({}));
  ok('10.1 empty parse rejected (400)', res.status === 400 || json.code === 400);
  ok('10.2 error message mentions supported formats', (json.message || '').includes('ERMaster') || (json.message || '').includes('支持'));
}

// --- Report ---
const passed = report.filter((l) => l.startsWith('PASS')).length;
const total = report.filter((l) => l.startsWith('PASS') || l.startsWith('FAIL')).length;
log(`===== M13 VERIFY: ${passed}/${total} ${failures === 0 ? 'ALL PASS' : 'FAILURES=' + failures} =====`);
fs.mkdirSync(`${ROOT}/screenshots`, { recursive: true });
fs.writeFileSync(`${ROOT}/screenshots/m13-report.txt`, report.join('\n') + '\n');
process.exit(failures === 0 ? 0 : 1);
