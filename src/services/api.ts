/**
 * DataLineage Studio API Service Layer
 * Replaces mock data with real backend API calls
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// --- Auth token storage (shared with AuthGuard via localStorage) ---
export const AUTH_STORAGE_KEY = 'dl_auth';

export interface AuthUser {
  username: string;
  displayName: string;
  role: 'ADMIN' | 'GOVERNOR' | 'VIEWER';
}

export function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw).token : null;
  } catch {
    return null;
  }
}

// Generic fetch wrapper with auth header, 401 broadcast and error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 401 && !endpoint.startsWith('/auth/login')) {
    // Session expired or missing: drop the stale token and let AuthGuard react
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ token: string; expiresInMs: number; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => apiFetch<AuthUser>('/auth/me'),
};

// Asset API
export const assetApi = {
  list: (params?: { space?: string; layer?: string; type?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/assets${query ? `?${query}` : ''}`);
  },
  
  get: (id: string) => apiFetch<any>(`/assets/${id}`),
  
  create: (asset: any) => apiFetch<any>('/assets', {
    method: 'POST',
    body: JSON.stringify(asset),
  }),
  
  update: (id: string, asset: any) => apiFetch<any>(`/assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(asset),
  }),
  
  delete: (id: string) => apiFetch<void>(`/assets/${id}`, {
    method: 'DELETE',
  }),
  
  search: (keyword: string) => apiFetch<any[]>(`/assets/search?q=${encodeURIComponent(keyword)}`),
  
  getColumns: (id: string) => apiFetch<any[]>(`/assets/${id}/columns`),
  
  getLineage: (id: string) => apiFetch<any[]>(`/lineage/assets/${id}`),
};

// Lineage API
export const lineageApi = {
  listEdges: (params?: { assetId?: string; kind?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/lineage/edges${query ? `?${query}` : ''}`);
  },
  
  getGraph: (params?: { space?: string; layer?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<{ nodes: any[]; edges: any[] }>(`/lineage/graph${query ? `?${query}` : ''}`);
  },
  
  findPath: (from: string, to: string) => 
    apiFetch<any[]>(`/lineage/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  // Bi-temporal replay: edges valid at the given timestamp (yyyy-MM-dd or ISO date-time)
  edgesAtTime: (time: string) =>
    apiFetch<{ time: string; edges: any[]; edgeCount: number }>(`/lineage/edges/at-time?time=${encodeURIComponent(time)}`),
  
  getSubgraph: (params: { rootId: string; depth?: number; direction?: 'UPSTREAM' | 'DOWNSTREAM' | 'BOTH' }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<{ nodes: any[]; edges: any[]; nodeCount: number; edgeCount: number }>(`/lineage/subgraph?${query}`);
  },
  
  createEdge: (edge: any) => apiFetch<any>('/lineage/edges', {
    method: 'POST',
    body: JSON.stringify(edge),
  }),
};

// Data Source API
export const datasourceApi = {
  list: () => apiFetch<any[]>('/datasources'),
  
  get: (id: string) => apiFetch<any>(`/datasources/${id}`),
  
  create: (ds: any) => apiFetch<any>('/datasources', {
    method: 'POST',
    body: JSON.stringify(ds),
  }),
  
  update: (id: string, ds: any) => apiFetch<any>(`/datasources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(ds),
  }),
  
  delete: (id: string) => apiFetch<void>(`/datasources/${id}`, {
    method: 'DELETE',
  }),
  
  disable: (id: string) => apiFetch<any>(`/datasources/${id}/disable`, {
    method: 'POST',
  }),
  
  enable: (id: string) => apiFetch<any>(`/datasources/${id}/enable`, {
    method: 'POST',
  }),
  
  test: (id: string) => apiFetch<any>(`/datasources/${id}/test`, {
    method: 'POST',
  }),
  
  getSchemas: (id: string) => apiFetch<string[]>(`/datasources/${id}/schemas`),
  
  getTables: (id: string, schema?: string) => {
    const query = schema ? `?schema=${encodeURIComponent(schema)}` : '';
    return apiFetch<any[]>(`/datasources/${id}/tables${query}`);
  },
};

// Layer import relations API (multi-source warehouse layer import)
export const layerImportApi = {
  stats: () => apiFetch<{
    layers: { layer: string; dataSourceId: string; dataSourceName: string; assetCount: number }[];
    relations: any[];
    crossSourceEdges: number;
  }>('/layer-imports/stats'),

  list: (params?: { fromLayer?: string; toLayer?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/layer-imports${query ? `?${query}` : ''}`);
  },

  get: (id: string) => apiFetch<any>(`/layer-imports/${id}`),

  create: (rel: any) => apiFetch<any>('/layer-imports', {
    method: 'POST',
    body: JSON.stringify(rel),
  }),

  update: (id: string, rel: any) => apiFetch<any>(`/layer-imports/${id}`, {
    method: 'PUT',
    body: JSON.stringify(rel),
  }),

  remove: (id: string) => apiFetch<any>(`/layer-imports/${id}`, {
    method: 'DELETE',
  }),

  preview: (id: string) => apiFetch<any>(`/layer-imports/${id}/preview`, {
    method: 'POST',
    body: '{}',
  }),

  build: (id: string) => apiFetch<any>(`/layer-imports/${id}/build`, {
    method: 'POST',
    body: '{}',
  }),
};

// Metric API
export const metricApi = {
  list: () => apiFetch<any[]>('/metrics'),
  
  get: (code: string) => apiFetch<any>(`/metrics/${code}`),
  
  create: (metric: any) => apiFetch<any>('/metrics', {
    method: 'POST',
    body: JSON.stringify(metric),
  }),
  
  update: (code: string, metric: any) => apiFetch<any>(`/metrics/${code}`, {
    method: 'PUT',
    body: JSON.stringify(metric),
  }),

  history: (code: string) => apiFetch<any[]>(`/metrics/${code}/history`),
};

// Change Event API
export const changeApi = {
  list: (params?: { status?: string; isManaged?: boolean }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/changes${query ? `?${query}` : ''}`);
  },
  
  get: (id: string) => apiFetch<any>(`/changes/${id}`),

  byAsset: (assetId: string) => apiFetch<any[]>(`/changes/by-asset/${encodeURIComponent(assetId)}`),

  create: (change: any) => apiFetch<any>('/changes', {
    method: 'POST',
    body: JSON.stringify(change),
  }),

  listAcks: (changeId: string) => apiFetch<any[]>(`/changes/${changeId}/acks`),
  
  simulate: (params: { assetId: string; changeType: string; column?: string }) =>
    apiFetch<any>('/impact/simulate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

// Validation Rule API
export const ruleApi = {
  list: (params?: { category?: string; enabled?: boolean }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/validation/rules${query ? `?${query}` : ''}`);
  },
  
  get: (id: string) => apiFetch<any>(`/validation/rules/${id}`),
  
  create: (rule: any) => apiFetch<any>('/validation/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  }),
  
  update: (id: string, rule: any) => apiFetch<any>(`/validation/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(rule),
  }),
  
  toggle: (id: string) => apiFetch<any>(`/validation/rules/${id}/toggle`, {
    method: 'POST',
  }),
  
  execute: (assetId: string) => apiFetch<any>(`/validation/execute/${assetId}`, {
    method: 'POST',
  }),
  
  listIssues: (params?: { status?: string; priority?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/validation/issues${query ? `?${query}` : ''}`);
  },
  
  createIssue: (issue: any) => apiFetch<any>('/validation/issues', {
    method: 'POST',
    body: JSON.stringify(issue),
  }),
};

// Contract API
export const contractApi = {
  list: (params?: { domain?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/contracts${query ? `?${query}` : ''}`);
  },
  
  get: (id: string) => apiFetch<any>(`/contracts/${id}`),
  
  create: (contract: any) => apiFetch<any>('/contracts', {
    method: 'POST',
    body: JSON.stringify(contract),
  }),
  
  update: (id: string, contract: any) => apiFetch<any>(`/contracts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(contract),
  }),
  
  remove: (id: string) => apiFetch<void>(`/contracts/${id}`, {
    method: 'DELETE',
  }),
  
  validate: (yamlContent: string) => apiFetch<any>('/contracts/validate', {
    method: 'POST',
    body: JSON.stringify({ yamlContent }),
  }),

  // Contract declared columns vs actual asset schema (contract-vs-schema consistency)
  validateSchema: (id: string) => apiFetch<any>(`/contracts/${encodeURIComponent(id)}/validate-schema`, {
    method: 'POST',
  }),
};

// Notification API
export const notificationApi = {
  list: (params?: { read?: boolean }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/notifications${query ? `?${query}` : ''}`);
  },
  
  unreadCount: () => apiFetch<{ count: number }>('/notifications/unread/count'),
  
  markRead: (id: string) => apiFetch<void>(`/notifications/${id}/read`, {
    method: 'PUT',
  }),
  
  markAllRead: () => apiFetch<void>('/notifications/read-all', {
    method: 'PUT',
  }),
};

// Collector API
export const collectorApi = {
  list: (params?: { type?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/collectors${query ? `?${query}` : ''}`);
  },
  
  getTasks: (params?: { dataSourceId?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/collect-tasks${query ? `?${query}` : ''}`);
  },
  
  getTask: (id: string) => apiFetch<any>(`/collect-tasks/${id}`),
  
  createTask: (task: any) => apiFetch<any>('/collect-tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  }),
  
  updateTask: (id: string, task: any) => apiFetch<any>(`/collect-tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(task),
  }),
  
  deleteTask: (id: string) => apiFetch<void>(`/collect-tasks/${id}`, {
    method: 'DELETE',
  }),
  
  runTask: (id: string) => apiFetch<any>(`/collect-tasks/${id}/run`, {
    method: 'POST',
  }),
  
  getRunStatus: (id: string) => apiFetch<any>(`/collect-tasks/${id}/run-status`),
  
  pauseTask: (id: string) => apiFetch<any>(`/collect-tasks/${id}/pause`, {
    method: 'POST',
  }),
  
  resumeTask: (id: string) => apiFetch<any>(`/collect-tasks/${id}/resume`, {
    method: 'POST',
  }),
  
  getTaskLogs: (id: string, limit = 20) => apiFetch<any[]>(`/collect-tasks/${id}/logs?limit=${limit}`),
};

// Impact Analysis API
export const impactApi = {
  analyze: (assetId: string) => apiFetch<any>(`/impact/analyze/${assetId}`),
  
  simulate: (params: { assetId: string; changeType: string; columnName?: string }) =>
    apiFetch<any>('/impact/simulate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  
  listReports: (params?: { verdict?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/impact/reports${query ? `?${query}` : ''}`);
  },
  
  getReport: (id: string) => apiFetch<any>(`/impact/reports/${id}`),
  
  acknowledge: (ack: any) => apiFetch<any>('/impact/acks', {
    method: 'POST',
    body: JSON.stringify(ack),
  }),
  
  applyExemption: (params: { ackId: string; reason: string; exemptUntil?: string }) =>
    apiFetch<any>('/impact/exemptions', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

// Governance Dashboard API
export const dashboardApi = {
  overview: () => apiFetch<any>('/dashboard/overview'),

  assetHealth: () => apiFetch<any[]>('/dashboard/asset-health'),

  getAssetHealth: (assetId: string) => apiFetch<any>(`/dashboard/asset-health/${assetId}`),
};

// Data Standards API
export const standardApi = {
  list: (params?: { type?: string; status?: string; domain?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/standards${query ? `?${query}` : ''}`);
  },

  get: (id: string) => apiFetch<any>(`/standards/${id}`),

  create: (std: any) => apiFetch<any>('/standards', {
    method: 'POST',
    body: JSON.stringify(std),
  }),

  update: (id: string, std: any) => apiFetch<any>(`/standards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(std),
  }),

  publish: (id: string) => apiFetch<any>(`/standards/${id}/publish`, {
    method: 'POST',
  }),

  remove: (id: string) => apiFetch<void>(`/standards/${id}`, {
    method: 'DELETE',
  }),

  listGlossary: (params?: { domain?: string; category?: string; keyword?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/standards/glossary${query ? `?${query}` : ''}`);
  },

  createGlossary: (term: any) => apiFetch<any>('/standards/glossary', {
    method: 'POST',
    body: JSON.stringify(term),
  }),

  updateGlossary: (id: string, term: any) => apiFetch<any>(`/standards/glossary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(term),
  }),

  removeGlossary: (id: string) => apiFetch<void>(`/standards/glossary/${id}`, {
    method: 'DELETE',
  }),

  listCodes: (codeSet?: string) => {
    const query = codeSet ? `?codeSet=${encodeURIComponent(codeSet)}` : '';
    return apiFetch<any[]>(`/standards/codes${query}`);
  },

  listCodeSets: () => apiFetch<any[]>('/standards/codes/sets'),

  createCode: (code: any) => apiFetch<any>('/standards/codes', {
    method: 'POST',
    body: JSON.stringify(code),
  }),

  removeCode: (id: string) => apiFetch<void>(`/standards/codes/${id}`, {
    method: 'DELETE',
  }),

  namingCheck: () => apiFetch<any>('/standards/naming-check', {
    method: 'POST',
  }),
};

// Approval API
export const approvalApi = {
  listPending: () => apiFetch<any[]>('/approvals/pending'),

  getRecords: (changeId: string) => apiFetch<any[]>(`/approvals/records/${changeId}`),

  listDecisions: (limit = 20) => apiFetch<any[]>(`/approvals/decisions?limit=${limit}`),

  submit: (changeId: string, body?: { actor?: string; comment?: string }) =>
    apiFetch<any>(`/approvals/${changeId}/submit`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),

  approve: (changeId: string, body?: { actor?: string; comment?: string }) =>
    apiFetch<any>(`/approvals/${changeId}/approve`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),

  reject: (changeId: string, body?: { actor?: string; comment?: string }) =>
    apiFetch<any>(`/approvals/${changeId}/reject`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
};

// Data Model Baseline API (M13)
export const modelApi = {
  import: (formData: FormData) => {
    const url = `${API_BASE}/models/import`;
    const token = getAuthToken();
    return fetch(url, {
      method: 'POST',
      body: formData,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).then(async res => {
      if (res.status === 401) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        window.dispatchEvent(new Event('auth:unauthorized'));
        throw new Error('登录已过期，请重新登录');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.code !== 200) throw new Error(json.message || 'Import failed');
      return json.data;
    });
  },

  list: () => apiFetch<any[]>('/models'),

  get: (id: string) => apiFetch<any>(`/models/${id}`),

  listTables: (id: string) => apiFetch<any[]>(`/models/${id}/tables`),

  // Maintenance: rename / re-target layer or datasource / status; blank datasource clears the binding
  update: (id: string, data: { name?: string; targetLayer?: string; status?: string; targetDataSourceId?: string | null }) =>
    apiFetch<any>(`/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete the model together with its table snapshots and version history
  remove: (id: string) => apiFetch<void>(`/models/${id}`, {
    method: 'DELETE',
  }),

  diff: (id: string) => apiFetch<any>(`/models/${id}/diff`),

  // --- Version management (every import is archived, re-import bumps version) ---
  versions: (id: string) => apiFetch<any[]>(`/models/${id}/versions`),

  versionTables: (vid: string) => apiFetch<any[]>(`/model-versions/${vid}/tables`),

  versionDiff: (id: string, from?: number, to?: number) => {
    const params = new URLSearchParams();
    if (from !== undefined) params.set('from', String(from));
    if (to !== undefined) params.set('to', String(to));
    const query = params.toString();
    return apiFetch<any>(`/models/${id}/versions/diff${query ? `?${query}` : ''}`);
  },

  // Download the version-diff report (markdown / csv) via authenticated fetch
  exportCompare: async (id: string, format: 'markdown' | 'csv', from?: number, to?: number) => {
    const params = new URLSearchParams({ format });
    if (from !== undefined) params.set('from', String(from));
    if (to !== undefined) params.set('to', String(to));
    const url = `${API_BASE}/models/${encodeURIComponent(id)}/compare/export?${params.toString()}`;
    const token = getAuthToken();
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (res.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('登录已过期，请重新登录');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    const fileName = match ? match[1] : `model-diff.${format === 'csv' ? 'csv' : 'md'}`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    return { fileName, size: blob.size };
  },
};

// Audit trail API (full-chain write-operation audit)
export const auditApi = {
  query: (params?: { username?: string; action?: string; resourceType?: string; result?: string; from?: string; to?: string; page?: number; size?: number }) => {
    const query = new URLSearchParams(
      Object.entries(params || {}).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null && v !== '') (acc as any)[k] = String(v);
        return acc;
      }, {} as Record<string, string>)
    ).toString();
    return apiFetch<{ total: number; page: number; size: number; records: any[] }>(`/audit-logs${query ? `?${query}` : ''}`);
  },
};

// Webhook subscription API (CI/CD change notifications)
export const webhookApi = {
  list: () => apiFetch<any[]>('/webhooks'),

  create: (config: any) => apiFetch<any>('/webhooks', {
    method: 'POST',
    body: JSON.stringify(config),
  }),

  update: (id: string, config: any) => apiFetch<any>(`/webhooks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  }),

  remove: (id: string) => apiFetch<void>(`/webhooks/${id}`, {
    method: 'DELETE',
  }),

  test: (id: string) => apiFetch<any>(`/webhooks/${id}/test`, {
    method: 'POST',
  }),
};

export default {
  auth: authApi,
  asset: assetApi,
  lineage: lineageApi,
  datasource: datasourceApi,
  metric: metricApi,
  change: changeApi,
  rule: ruleApi,
  contract: contractApi,
  notification: notificationApi,
  collector: collectorApi,
  impact: impactApi,
  dashboard: dashboardApi,
  standard: standardApi,
  approval: approvalApi,
  model: modelApi,
  audit: auditApi,
  webhook: webhookApi,
};
