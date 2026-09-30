/**
 * DataLineage Studio API Service Layer
 * Replaces mock data with real backend API calls
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

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
};

// Change Event API
export const changeApi = {
  list: (params?: { status?: string; isManaged?: boolean }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<any[]>(`/changes${query ? `?${query}` : ''}`);
  },
  
  get: (id: string) => apiFetch<any>(`/changes/${id}`),
  
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

export default {
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
};
