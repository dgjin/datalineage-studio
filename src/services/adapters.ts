/**
 * Backend → Frontend type adapters.
 * The Spring Boot API returns entity shapes (fromAssetId/toAssetId, flat affected* counters),
 * while UI components consume the richer frontend types. Keep the mapping in one place.
 */
import type { Asset, LineageEdge, ChangeEvent } from '../types/lineage';

export function adaptAsset(a: any): Asset {
  return {
    id: a.id,
    code: a.code ?? a.id,
    name: a.name ?? a.id,
    displayTitle: a.displayTitle ?? a.name ?? a.id,
    type: a.type ?? 'TABLE',
    layer: a.layer ?? 'ODS',
    space: a.space ?? 'default',
    owner: a.owner ?? '未指定',
    ownerEmail: a.ownerEmail ?? undefined,
    department: a.department ?? '数据平台',
    status: a.status ?? 'ACTIVE',
    description: a.description ?? '',
    confidence: a.confidence ?? 100,
    sourceType: a.sourceType ?? 'JDBC_SCHEMA',
    downstreamCount: a.downstreamCount ?? 0,
    upstreamCount: a.upstreamCount ?? 0,
    createdAt: a.createdAt ?? new Date().toISOString(),
    updatedAt: a.updatedAt ?? new Date().toISOString(),
    isManaged: a.isManaged ?? false,
    tags: a.tags ?? undefined,
    contractRef: a.contractRef ?? undefined,
    storageFormat: a.storageFormat ?? undefined,
  };
}

export function adaptEdge(e: any): LineageEdge {
  return {
    id: e.id,
    from: e.fromAssetId ?? e.from,
    to: e.toAssetId ?? e.to,
    fromCol: e.fromColumn ?? undefined,
    toCol: e.toColumn ?? undefined,
    kind: e.kind ?? 'TABLE',
    source: e.source ?? 'PROBE',
    confidence: e.confidence ?? 100,
    transformExpr: e.transformExpr ?? undefined,
    isCriticalPath: e.isCriticalPath ?? false,
    validFrom: e.validFrom ?? new Date().toISOString(),
    validTo: e.validTo ?? undefined,
  };
}

export function adaptChange(c: any): ChangeEvent {
  return {
    id: c.id,
    assetId: c.assetId,
    assetName: c.assetName ?? c.assetId,
    changeType: c.changeType,
    details: c.details ?? {},
    detectedBy: c.detectedBy ?? 'PROBE',
    isBreaking: c.isBreaking ?? false,
    isManaged: c.isManaged ?? false,
    status: c.status ?? 'DETECTED',
    actor: c.actor ?? 'Auto Collector',
    traceId: c.traceId ?? '',
    mrUrl: c.mrUrl ?? undefined,
    timestamp: (c.timestamp ?? c.createdAt ?? new Date().toISOString()).replace('T', ' '),
    impactVerdict: c.impactVerdict ?? 'MEDIUM',
    impactSummary: c.impactSummary ?? '',
    affectedCount: {
      metrics: c.affectedMetrics ?? 0,
      reports: c.affectedReports ?? 0,
      apis: c.affectedApis ?? 0,
      tables: c.affectedTables ?? 0,
    },
  };
}
