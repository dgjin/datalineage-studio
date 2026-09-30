/**
 * Universal Data Lineage & Governance Platform Types
 */

export type AssetType = 
  | 'TABLE'
  | 'VIEW'
  | 'JOB'
  | 'METRIC'
  | 'REPORT'
  | 'DASHBOARD'
  | 'API'
  | 'DATASET'
  | 'FILE';

export type LayerType = 'ODS' | 'DWD' | 'DWS' | 'ADS' | 'APP';

export type AssetStatus = 
  | 'ACTIVE'
  | 'STALE'
  | 'PENDING_CHANGE'
  | 'UNMANAGED'
  | 'DEPRECATED'
  | 'DRAFT';

export type SensitivityLevel = '公开' | '内部' | '秘密' | '机密';

export interface ColumnDefinition {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  comment: string;
  isPrimary?: boolean;
  isPii?: boolean;
  sensitivity: SensitivityLevel;
  sourceExpr?: string;
  transformType?: 'DIRECT' | 'AGG' | 'FILTER' | 'UDF' | 'JOIN' | 'DERIVED';
  lastModified?: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  displayTitle: string;
  type: AssetType;
  layer: LayerType;
  space: string; // e.g. 'crm', 'trade', 'risk'
  owner: string;
  ownerEmail?: string;
  department: string;
  status: AssetStatus;
  description: string;
  confidence: number; // 0 - 100
  sourceType: 'CONTRACT' | 'OPENLINEAGE' | 'JDBC_SCHEMA' | 'SQL_PARSER' | 'CDC_PROBE';
  downstreamCount: number;
  upstreamCount: number;
  columns?: ColumnDefinition[];
  createdAt: string;
  updatedAt: string;
  isManaged: boolean;
  tags?: string[];
  contractRef?: string;
  storageFormat?: string;
}

export interface LineageEdge {
  id: string;
  from: string; // asset id or asset:column id
  to: string;   // asset id or asset:column id
  fromCol?: string;
  toCol?: string;
  kind: 'TABLE' | 'COLUMN' | 'METRIC_REF';
  source: 'CONTRACT' | 'OPENLINEAGE' | 'PARSER' | 'PROBE' | 'JDBC_FK' | 'VIEW_DEP';
  confidence: number;
  transformExpr?: string;
  isCriticalPath?: boolean;
  validFrom: string;
  validTo?: string; // for time travel
}

export interface MetricDefinition {
  code: string;
  name: string;
  type: 'ATOMIC' | 'COMPOSITE'; // 基础 / 复合
  caliberSummary: string;
  entity: string;
  measureExpr: string;
  filterConditions: string[];
  dimensions: string[];
  unit: string;
  calcType: 'PERIOD' | 'POINT_IN_TIME'; // 期间 / 时点
  frequency: 'DAILY' | 'MONTHLY' | 'REALTIME';
  caliberSystem: 'INTERNAL' | 'PBOC' | 'AMC_EAST';
  owner: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'DEPRECATED';
  version: string;
  upstreamMetrics?: string[]; // codes of parent metrics
  referencedColumns: {
    assetId: string;
    assetName: string;
    columnName: string;
    confidence: number;
  }[];
  downstreamReports: string[];
  lastModified: string;
  historyDiff?: {
    version: string;
    date: string;
    diff: string;
    breakingHistoryData: boolean;
  }[];
}

export type ChangeType = 
  | 'DROP_COLUMN'
  | 'RENAME_COLUMN'
  | 'CHANGE_DATA_TYPE'
  | 'CHANGE_METRIC_EXPR'
  | 'DROP_TABLE'
  | 'ADD_NON_NULL_COLUMN'
  | 'ADD_NULLABLE_COLUMN';

export type ImpactVerdict = 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';

export interface ChangeEvent {
  id: string;
  assetId: string;
  assetName: string;
  changeType: ChangeType;
  details: {
    column?: string;
    oldValue?: string;
    newValue?: string;
    rawDiff?: string;
  };
  detectedBy: 'CI_CONTRACT' | 'CDC' | 'PROBE' | 'OPENLINEAGE';
  isBreaking: boolean;
  isManaged: boolean; // if false, it's an unmanaged "暗改"
  status: 'DETECTED' | 'ANALYZED' | 'ACK_PENDING' | 'RESOLVED' | 'BLOCKED';
  actor: string;
  traceId: string;
  mrUrl?: string;
  timestamp: string;
  impactVerdict: ImpactVerdict;
  impactSummary: string;
  affectedCount: {
    metrics: number;
    reports: number;
    apis: number;
    tables: number;
  };
}

export interface ImpactItem {
  id: string;
  objectId: string;
  objectName: string;
  type: AssetType;
  distance: number;
  via: string;
  owner: string;
  department: string;
  ackStatus: 'PENDING' | 'ACKED' | 'REJECTED' | 'EXEMPTED';
  exemptReason?: string;
  exemptUntil?: string;
}

export interface ImpactReport {
  changeId?: string;
  assetId: string;
  assetName: string;
  changeType: ChangeType;
  targetField?: string;
  verdict: ImpactVerdict;
  score: number; // 0 - 100
  summary: string;
  criticalPaths: string[][];
  directImpacts: ImpactItem[];
  suggestions: string[];
  mitigationCodeSnippet?: string;
}

export interface ContractFile {
  id: string;
  path: string;
  domain: string;
  version: string;
  author: string;
  lastUpdated: string;
  status: 'MERGED' | 'IN_REVIEW' | 'DRAFT';
  yamlContent: string;
  generatedDdl: string;
}

export interface ValidationRule {
  id: string;
  code: string;
  name: string;
  category: 'FORMAT' | 'COMPLETENESS' | 'SEMANTIC' | 'DAG_INTEGRITY' | 'CROSS_SYSTEM';
  scope: string;
  expression: string;
  severity: 'P0' | 'P1' | 'P2';
  enabled: boolean;
  description: string;
  fixHint: string;
  hitCount: number;
  dryRunHits?: {
    assetId: string;
    assetName: string;
    sampleValue: string;
    reason: string;
  }[];
}

export interface QualityIssue {
  id: string;
  code: string;
  title: string;
  description: string;
  issueType: string;
  ownerDept: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'P0' | 'P1' | 'P2';
  affectedAssetId: string;
  affectedAssetName: string;
  createdBy: string;
  createdAt: string;
  dueDate: string;
}

export interface CollectorAdapter {
  id: string;
  name: string;
  type: 'JDBC_SCHEMA' | 'OPENLINEAGE' | 'SQL_FILE' | 'DBT_MANIFEST' | 'AIRFLOW' | 'CDC_DEBEZIUM' | 'BI_SUPERSET';
  mode: 'PULL' | 'PUSH' | 'SCAN';
  status: 'RUNNING' | 'DEGRADED' | 'STANDBY' | 'ERROR';
  capabilities: string[];
  lastRunTime: string;
  totalAssetsDiscovered: number;
  changesCaptured24h: number;
  avgLatency: string;
  healthScore: number;
}

export interface NotificationItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARN' | 'INFO';
  title: string;
  body: string;
  refType: 'CHANGE_EVENT' | 'IMPACT_ACK' | 'DARK_CHANGE' | 'VALIDATION_FAIL';
  refId: string;
  read: boolean;
  timestamp: string;
  actions: {
    label: string;
    action: string;
    variant: 'primary' | 'secondary' | 'danger';
  }[];
}

export type UserRole = 
  | 'ARCHITECT'
  | 'ENGINEER'
  | 'METRIC_OWNER'
  | 'ANALYST'
  | 'GOVERNANCE_ADMIN'
  | 'PLATFORM_ADMIN';
