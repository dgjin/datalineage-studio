/**
 * Closed-loop business verification: 7 end-to-end chains that must each
 * complete a full round trip (write -> side effect -> read-back -> cleanup).
 *
 *  C1  asset lifecycle     M1  create -> detail -> update -> search -> filter
 *  C2  naming governance   M12 naming-check -> quality issue in M7 -> hitCount++
 *                          -> idempotent re-run -> audit trail
 *  C3A change -> auto publish gate (HIGH/BLOCKER) -> reject -> records + notify
 *  C3B change -> manual submit -> approve -> records + "approved" notify + decisions
 *  C4  notification read + delete round trip (unread count returns to baseline)
 *  C5  contract vs asset schema consistency (valid formula + binding resolvable)
 *  C6  lineage graph / asset lineage / shortest path / subgraph are consistent
 *  C7  RBAC: viewer reads 200, viewer writes 403, data survives the attempt
 *
 * Cleanup restores every touched row (assets / changes / issues / notifications /
 * approval records / standard hit_count) so the script is re-runnable.
 *
 * Prereqs: backend on :8080, MySQL reachable via `docker exec dl-mysql-test`.
 * Run from the repo root: node scripts/closed-loop-verify.mjs
 */
import { execFileSync } from 'child_process';
import fs from 'fs';

const API = 'http://localhost:8080/api/v1';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
let failures = 0;
const log = (s) => { console.log('[LOOP] ' + s); report.push(s); };
const ok = (name, cond) => { if (!cond) failures++; log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };
const section = (t) => log('\n== ' + t + ' ==');

const enc = encodeURIComponent;
// Java String.hashCode -> unsigned hex (mirrors Integer.toHexString(name.hashCode()))
const javaHashHex = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).toUpperCase();
};

// ---------- auth ----------
const login = async (username, password) => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return (await res.json()).data;
};
const admin = await login('admin', 'admin123');
ok('P0.1 admin login (token issued)', !!admin?.token);
const viewer = await login('viewer', 'viewer123');
ok('P0.2 viewer login (token issued)', !!viewer?.token);

const call = async (token, method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const api = (method, path, body) => call(admin.token, method, path, body);

// =====================================================================
section('闭环 1: 资产全生命周期（M1）');
const STAMP = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const QA_NAME = `ODS_Violation_Probe_${STAMP}`;
const QI_CODE = `QI-NAM-001-${javaHashHex(QA_NAME)}`;

const created = await api('POST', '/assets', {
  name: QA_NAME, displayTitle: '闭环验证探针资产', type: 'TABLE', layer: 'ODS',
  space: 'ODS', status: 'ACTIVE', owner: 'qa-bot', department: '数据治理',
  description: 'closed-loop verification probe (auto-cleanup)',
});
const qaAssetId = created.json?.data?.id;
ok('1.1 POST /assets creates probe asset', created.status === 200 && !!qaAssetId && qaAssetId.startsWith('asset:'));

const det = await api('GET', `/assets/${enc(qaAssetId)}`);
ok('1.2 GET /assets/{id} detail matches name', det.json?.data?.name === QA_NAME);

const upd = await api('PUT', `/assets/${enc(qaAssetId)}`, { owner: 'qa-bot-2', description: 'updated by closed-loop' });
ok('1.3 PUT /assets/{id} updates owner+description',
  upd.json?.data?.owner === 'qa-bot-2' && upd.json?.data?.description === 'updated by closed-loop');

const search = await api('GET', `/assets/search?q=${enc('ODS_Violation_Probe_')}`);
ok('1.4 GET /assets/search finds probe asset', (search.json?.data || []).some((a) => a.id === qaAssetId));

const byLayer = await api('GET', '/assets?layer=ODS');
ok('1.5 GET /assets?layer=ODS includes probe asset', (byLayer.json?.data || []).some((a) => a.id === qaAssetId));

// =====================================================================
section('闭环 2: 命名落标（M12 标准 -> M7 质量问题）');
const stdList = await api('GET', '/standards?type=NAMING');
const namStd = (stdList.json?.data || []).find((s) => s.code === 'STD-NAM-001');
ok('2.1 STD-NAM-001 seed standard present (PUBLISHED, layer=ODS)', !!namStd && namStd.status === 'PUBLISHED');
const H0 = namStd?.hitCount ?? null;
log(`       baseline hitCount=${H0}`);

const issuesBefore = await api('GET', '/validation/issues');
const codeCountBefore = (issuesBefore.json?.data || []).filter((i) => i.code === QI_CODE).length;
ok('2.2 probe issue code not present before check', codeCountBefore === 0);

const check1 = await api('POST', '/standards/naming-check');
const rep1 = check1.json?.data;
ok('2.3 POST /standards/naming-check 200 + assets scanned', check1.status === 200 && rep1?.checked >= 1);
ok('2.4 violationAssets >= 1', (rep1?.violationAssets || 0) >= 1);
const hit = (rep1?.details || []).find((d) => d.assetName === QA_NAME);
ok('2.5 report details include probe asset + STD-NAM-001', !!hit && (hit.violations || []).includes('STD-NAM-001'));

const issuesAfter = await api('GET', '/validation/issues?status=OPEN');
const issue = (issuesAfter.json?.data || []).find((i) => i.code === QI_CODE);
ok('2.6 quality issue auto-created in M7 (OPEN, linked to asset)',
  !!issue && issue.status === 'OPEN' && issue.affectedAssetId === qaAssetId && String(issue.title).includes(QA_NAME));

const stdAfter = await api('GET', '/standards?type=NAMING');
const hitAfter = (stdAfter.json?.data || []).find((s) => s.code === 'STD-NAM-001')?.hitCount;
ok(`2.7 hitCount incremented ${H0} -> ${hitAfter}`, hitAfter === (H0 ?? 0) + 1);

const check2 = await api('POST', '/standards/naming-check');
const issuesAfter2 = await api('GET', '/validation/issues?status=OPEN');
const codeCountAfter = (issuesAfter2.json?.data || []).filter((i) => i.code === QI_CODE).length;
const hitAfter2 = (await api('GET', '/standards?type=NAMING')).json?.data?.find((s) => s.code === 'STD-NAM-001')?.hitCount;
ok('2.8 re-run is idempotent (1 issue, hitCount unchanged)',
  codeCountAfter === 1 && hitAfter2 === hitAfter && check2.status === 200);

const audit = await api('GET', '/audit-logs?action=NAMING_CHECK&page=1&size=5');
ok('2.9 audit trail records NAMING_CHECK', (audit.json?.data?.total || 0) >= 1);

// =====================================================================
section('闭环 3A: 变更 -> 自动发布门禁（HIGH/BLOCKER）-> 驳回');
const U0 = (await api('GET', '/notifications/unread/count')).json?.data?.count ?? 0;
log(`       unread baseline U0=${U0}`);

const graph0 = await api('GET', '/lineage/graph');
const nodeName = new Map((graph0.json?.data?.nodes || []).map((n) => [n.id, n.name]));
const candidates = [...new Set((graph0.json?.data?.edges || []).map((e) => e.fromAssetId))].slice(0, 30);
let risk = null;
for (const aid of candidates) {
  const imp = await api('GET', `/assets/${enc(aid)}/impact`);
  const v = imp.json?.data?.verdict;
  if (v === 'BLOCKER' || v === 'HIGH') { risk = { id: aid, verdict: v }; break; }
}
ok(`3A.1 high-risk asset detected among ${candidates.length} lineage roots`, !!risk);

let chAId = null;
if (risk) {
  const c = await api('POST', '/changes', {
    assetId: risk.id, assetName: nodeName.get(risk.id), changeType: 'DROP_COLUMN',
    detectedBy: 'PROBE', isBreaking: false, isManaged: true,
    details: { column: 'probe_col', oldValue: 'v1', newValue: null },
  });
  chAId = c.json?.data?.id;
  ok('3A.2 POST /changes recorded', c.status === 200 && !!chAId);

  const chA = await api('GET', `/changes/${enc(chAId)}`);
  ok(`3A.3 auto-routed to APPROVAL_PENDING (verdict=${chA.json?.data?.impactVerdict})`,
    chA.json?.data?.status === 'APPROVAL_PENDING' && ['BLOCKER', 'HIGH'].includes(chA.json?.data?.impactVerdict));

  const recA1 = await api('GET', `/approvals/records/${enc(chAId)}`);
  ok('3A.4 approval record SUBMIT by 自动门禁', (recA1.json?.data || []).some((r) => r.action === 'SUBMIT' && r.actor === '自动门禁'));

  const un1 = await api('GET', '/notifications?read=false');
  const pend = (un1.json?.data || []).find((n) => n.refId === chAId && String(n.title).includes('变更待审批：'));
  ok('3A.5 pending-approval notification raised (refId linked)', !!pend);

  const rej = await api('POST', `/approvals/${enc(chAId)}/reject`, { actor: 'qa-approver', comment: 'QA 闭环：驳回不发布' });
  ok('3A.6 reject -> status REJECTED', rej.json?.data?.status === 'REJECTED');

  const recA2 = await api('GET', `/approvals/records/${enc(chAId)}`);
  ok('3A.7 approval records [SUBMIT, REJECT] with actor', 
    (recA2.json?.data || []).length === 2
    && (recA2.json?.data || []).some((r) => r.action === 'REJECT' && r.actor === 'qa-approver'));

  const un2 = await api('GET', '/notifications?read=false');
  ok('3A.8 reject notification raised', (un2.json?.data || []).some((n) => n.refId === chAId && String(n.title).includes('变更已驳回：')));
}

// =====================================================================
section('闭环 3B: 变更 -> 手动提交 -> 批准发布（孤立资产 SAFE 路径）');
const c2 = await api('POST', '/changes', {
  assetId: qaAssetId, assetName: QA_NAME, changeType: 'ADD_NULLABLE_COLUMN',
  detectedBy: 'PROBE', isBreaking: false, isManaged: true,
});
const chB = c2.json?.data;
const chBId = chB?.id;
ok('3B.1 POST /changes recorded', c2.status === 200 && !!chBId);
ok(`3B.2 isolated asset stays ANALYZED (verdict=${chB?.impactVerdict}, no auto gate)`,
  chB?.status === 'ANALYZED' && chB?.impactVerdict === 'SAFE');

const sub = await api('POST', `/approvals/${enc(chBId)}/submit`, { actor: 'qa-owner', comment: '申请发布' });
ok('3B.3 manual submit -> APPROVAL_PENDING', sub.json?.data?.status === 'APPROVAL_PENDING');

const appr = await api('POST', `/approvals/${enc(chBId)}/approve`, { actor: 'qa-approver', comment: 'QA 闭环：批准发布' });
ok('3B.4 approve -> status APPROVED', appr.json?.data?.status === 'APPROVED');

const recB = await api('GET', `/approvals/records/${enc(chBId)}`);
const acts = (recB.json?.data || []).map((r) => r.action).join(',');
ok(`3B.5 approval records [SUBMIT, APPROVE] (got ${acts})`, acts === 'SUBMIT,APPROVE');

const unB = await api('GET', '/notifications?read=false');
const apprNote = (unB.json?.data || []).find((n) => n.refId === chBId && String(n.title).includes('变更已批准发布：'));
ok('3B.6 approved notification with asset name', !!apprNote && String(apprNote.title).includes(QA_NAME));

const dec = await api('GET', '/approvals/decisions?limit=50');
ok('3B.7 decision trail lists the approval', (dec.json?.data || []).some((d) => d.changeId === chBId && d.action === 'APPROVE'));

// =====================================================================
section('闭环 4: 通知已读闭环（M8）');
const unAll = await api('GET', '/notifications?read=false');
const mine = (unAll.json?.data || []).filter((n) => n.refId === chAId || n.refId === chBId);
ok(`4.1 all 3 loop notifications unread (got ${mine.length})`, mine.length === 3);

for (const n of mine) await api('PUT', `/notifications/${enc(n.id)}/read`);
const unAfter = await api('GET', '/notifications?read=false');
ok('4.2 read round-trip removes them from unread', (unAfter.json?.data || []).every((n) => !mine.some((m) => m.id === n.id)));
const U1 = (await api('GET', '/notifications/unread/count')).json?.data?.count;
ok(`4.3 unread count returns to baseline ${U0} (got ${U1})`, U1 === U0);

for (const n of mine) await api('DELETE', `/notifications/${enc(n.id)}`);
const allNotes = await api('GET', '/notifications');
ok('4.4 delete round-trip removes rows', (allNotes.json?.data || []).every((n) => !mine.some((m) => m.id === n.id)));

// =====================================================================
section('闭环 5: 契约 vs 资产 Schema 一致性（M6）');
const contracts = await api('GET', '/contracts');
const ctList = contracts.json?.data || [];
ok('5.1 contracts registered', ctList.length >= 1);

const resolved = [];
for (const ct of ctList.slice(0, 5)) {
  const v = await api('POST', `/contracts/${enc(ct.id)}/validate-schema`);
  const d = v.json?.data;
  if (d?.assetId) {
    resolved.push({ ct, d });
  } else {
    ok(`5.2 ${ct.path} unbound contract returns explicit reason`, !!d && d.valid === false && !!d.reason);
  }
}
ok('5.3 at least one contract binds to a collected asset', resolved.length >= 1);

if (resolved.length) {
  const { ct, d } = resolved[0];
  log(`       checking ${ct.path} -> asset ${d.assetName}`);
  const expected = (d.missingInAsset || []).length === 0 && (d.typeMismatch || []).length === 0;
  ok('5.4 valid formula == (missingInAsset empty && typeMismatch empty)', d.valid === expected);
  ok('5.5 matched + typeMismatch <= contractColumnCount',
    (d.matchedColumns || 0) + (d.typeMismatch || []).length <= d.contractColumnCount);
  const boundAsset = await api('GET', `/assets/${enc(d.assetId)}`);
  ok('5.6 bound asset resolves back', boundAsset.json?.data?.name === d.assetName);
}

// =====================================================================
section('闭环 6: 血缘图/资产血缘/最短路径/子图 一致性（M2）');
const g = await api('GET', '/lineage/graph');
const gd = g.json?.data;
ok(`6.1 graph non-empty (nodes=${gd?.nodeCount} edges=${gd?.edgeCount})`, (gd?.nodeCount || 0) > 0 && (gd?.edgeCount || 0) > 0);

const e0 = (gd?.edges || [])[0];
ok('6.2 first edge has from/to anchors', !!e0?.fromAssetId && !!e0?.toAssetId);

const assetLineage = await api('GET', `/lineage/assets/${enc(e0?.fromAssetId)}`);
ok('6.3 asset lineage includes the edge', (assetLineage.json?.data || []).some((x) => x.id === e0?.id));

const path = await api('GET', `/lineage/path?from=${enc(e0?.fromAssetId)}&to=${enc(e0?.toAssetId)}`);
ok('6.4 shortest path from/to returns the direct edge', (path.json?.data || []).some((x) => x.id === e0?.id));

const dl = await api('GET', `/assets/${enc(e0?.fromAssetId)}/lineage`);
ok('6.5 asset downstream view lists the edge target',
  (dl.json?.data?.downstream || []).some((x) => x.toAssetId === e0?.toAssetId));

const sub6 = await api('GET', `/lineage/subgraph?rootId=${enc(e0?.fromAssetId)}&depth=1&direction=DOWNSTREAM`);
ok('6.6 downstream subgraph rooted correctly',
  sub6.json?.data?.rootId === e0?.fromAssetId && (sub6.json?.data?.edgeCount || 0) >= 1);

// =====================================================================
section('闭环 7: RBAC 边界（viewer 只读）');
const vr = await call(viewer.token, 'GET', '/assets');
ok('7.1 viewer GET /assets -> 200', vr.status === 200);
const vw = await call(viewer.token, 'POST', '/assets', { name: 'RBAC_Probe_Never_Created', layer: 'ODS' });
ok('7.2 viewer POST /assets -> 403', vw.status === 403);
const vd = await call(viewer.token, 'DELETE', `/assets/${enc(qaAssetId)}`);
ok('7.3 viewer DELETE probe asset -> 403', vd.status === 403);
const survive = await api('GET', `/assets/${enc(qaAssetId)}`);
ok('7.4 probe asset survives the blocked delete', survive.json?.data?.name === QA_NAME);

// =====================================================================
section('清理：恢复全部被触达的数据行');
const delA = chAId ? await api('DELETE', `/changes/${enc(chAId)}`) : { status: 0 };
const delB = await api('DELETE', `/changes/${enc(chBId)}`);
ok('CLN.1 change events deleted', delB.status === 200 && (!chAId || delA.status === 200));

const delAsset = await api('DELETE', `/assets/${enc(qaAssetId)}`);
ok('CLN.2 probe asset deleted', delAsset.status === 200);

if (issue?.id) {
  const delIssue = await api('DELETE', `/validation/issues/${enc(issue.id)}`);
  const after = await api('GET', '/validation/issues');
  ok('CLN.3 probe quality issue deleted', delIssue.status === 200 && (after.json?.data || []).every((i) => i.code !== QI_CODE));
}

// Belt-and-braces purge: approval_records are FK-cascaded by DELETE /changes;
// restore the standard hit counter to its pre-run value.
const ids = [chAId, chBId].filter(Boolean).map((x) => `'${x}'`).join(',');
const sql = [
  ids ? `DELETE FROM approval_records WHERE change_id IN (${ids});` : '',
  `UPDATE data_standards SET hit_count = ${H0 ?? 0} WHERE code = 'STD-NAM-001';`,
].filter(Boolean).join(' ');
try {
  execFileSync('docker', ['exec', 'dl-mysql-test', 'mysql', '-uroot', '-proot123', 'datalineage', '-e', sql], { stdio: 'pipe' });
  ok('CLN.4 hit_count restored via SQL (approval records FK-cascaded)', true);
} catch (e) {
  ok('CLN.4 hit_count restored via SQL (approval records FK-cascaded)', false);
  log('   ERR: ' + String(e.message).slice(0, 200));
}
const recGone = await api('GET', `/approvals/records/${enc(chBId)}`);
ok('CLN.5 approval records cascade-removed with the change', (recGone.json?.data || []).length === 0);

const gone = await api('GET', `/assets/${enc(qaAssetId)}`);
ok('CLN.6 probe asset no longer resolvable', !gone.json?.data);
const hitFinal = (await api('GET', '/standards?type=NAMING')).json?.data?.find((s) => s.code === 'STD-NAM-001')?.hitCount;
ok(`CLN.7 hitCount back to baseline ${H0} (got ${hitFinal})`, hitFinal === H0);
const chGone = await api('GET', `/changes/${enc(chBId)}`);
ok('CLN.8 change event no longer resolvable', !chGone.json?.data);

// ---------- summary ----------
fs.writeFileSync(OUT + '/closed-loop-report.txt', report.join('\n') + '\n');
const total = report.filter((l) => l.startsWith('PASS') || l.startsWith('FAIL')).length;
console.log(`\n${report.filter((l) => l.startsWith('PASS')).length}/${total} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
