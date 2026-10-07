import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { DesignOptimizationModal } from './components/DesignOptimizationModal';
import { ErrorBoundary } from './components/ErrorBoundary';

// Modules
import { Workbench } from './components/modules/Workbench';
import { M1AssetCatalog } from './components/modules/M1AssetCatalog';
import { M2LineageExplorer } from './components/modules/M2LineageExplorer';
import { M3ImpactAnalysis } from './components/modules/M3ImpactAnalysis';
import { M4ChangeCenter } from './components/modules/M4ChangeCenter';
import { M5MetricCenter } from './components/modules/M5MetricCenter';
import { M6ContractBrowser } from './components/modules/M6ContractBrowser';
import { M7ValidationCenter } from './components/modules/M7ValidationCenter';
import { M8NotificationCenter } from './components/modules/M8NotificationCenter';
import { M9GovernanceDashboard } from './components/modules/M9GovernanceDashboard';
import { M10CollectorAdmin } from './components/modules/M10CollectorAdmin';
import { M11DataSourceManager } from './components/modules/M11DataSourceManager';
import { M12StandardsHub } from './components/modules/M12StandardsHub';
import { M13DataModelHub } from './components/modules/M13DataModelHub';
import { HelpCenter } from './components/modules/HelpCenter';

// Mock initial data
import {
  INITIAL_ASSETS,
  INITIAL_EDGES,
  INITIAL_METRICS,
  INITIAL_CHANGES,
  INITIAL_RULES,
  INITIAL_ISSUES,
  INITIAL_COLLECTORS,
  INITIAL_NOTIFICATIONS
} from './mock/mockData';
import { useLineageStore } from './stores/lineageStore';
import { adaptAsset, adaptEdge, adaptChange, adaptMetric } from './services/adapters';
import { ruleApi, notificationApi, metricApi, contractApi, lineageApi } from './services/api';
import { AuthGuard, useAuth, logout } from './components/AuthGuard';
import { UserRole, ValidationRule, QualityIssue, NotificationItem, MetricDefinition, ContractFile, LineageEdge } from './types/lineage';

function AppShell() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('workbench');
  const [currentSpace, setCurrentSpace] = useState<string>('all');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('ARCHITECT');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>('asset:ods_crm_customer');
  const [simulateAssetId, setSimulateAssetId] = useState<string>('asset:ods_crm_customer');
  const [contractRef, setContractRef] = useState<string>('contracts/crm/customer.yaml');

  // Time travel historical replay state: the date defaults to today ("now" snapshot),
  // and while active the edge set is fetched from the bitemporal replay API.
  const [isTimeTravelActive, setIsTimeTravelActive] = useState<boolean>(false);
  const [timeTravelDate, setTimeTravelDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [replayEdges, setReplayEdges] = useState<LineageEdge[] | null>(null);

  // First-sync tracking: skeletons cover the very first backend load only.
  const [firstSyncDone, setFirstSyncDone] = useState<boolean>(false);

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isDesignDocOpen, setIsDesignDocOpen] = useState<boolean>(false);

  // Backend data (assets / edges / changes) with graceful mock fallback
  const {
    assets: remoteAssets,
    edges: remoteEdges,
    changes: remoteChanges,
    fetchAssets,
    fetchEdges,
    fetchChanges,
  } = useLineageStore();

  const refreshFromBackend = useCallback((force = false) => {
    const { lastSyncedAt } = useLineageStore.getState();
    if (!force && lastSyncedAt && Date.now() - lastSyncedAt < 15000) return;
    void fetchAssets();
    void fetchEdges();
    void fetchChanges();
  }, [fetchAssets, fetchEdges, fetchChanges]);

  // Load on mount (tracked so skeletons cover the very first sync), throttled
  // refresh on tab switches, forced refresh after a collector run
  useEffect(() => {
    let cancelled = false;
    const s = useLineageStore.getState();
    void Promise.allSettled([s.fetchAssets(), s.fetchEdges(), s.fetchChanges()]).then(() => {
      if (!cancelled) setFirstSyncDone(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { refreshFromBackend(); }, [activeTab, refreshFromBackend]);
  useEffect(() => {
    const handler = () => refreshFromBackend(true);
    window.addEventListener('lineage:refresh', handler);
    return () => window.removeEventListener('lineage:refresh', handler);
  }, [refreshFromBackend]);

  const mappedRemoteAssets = useMemo(() => remoteAssets.map(adaptAsset), [remoteAssets]);
  const remoteAssetIds = useMemo(() => new Set(mappedRemoteAssets.map(a => a.id)), [mappedRemoteAssets]);
  // Drop edges with dangling endpoints so the graph never renders orphan edges
  const mappedRemoteEdges = useMemo(
    () => remoteEdges.map(adaptEdge).filter(e => remoteAssetIds.has(e.from) && remoteAssetIds.has(e.to)),
    [remoteEdges, remoteAssetIds],
  );
  const mappedRemoteChanges = useMemo(() => remoteChanges.map(adaptChange), [remoteChanges]);

  // Fetch the historical edge snapshot whenever replay mode is on or the date changes
  useEffect(() => {
    if (!isTimeTravelActive) {
      setReplayEdges(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const resp = await lineageApi.edgesAtTime(`${timeTravelDate}T23:59:59`);
        if (cancelled) return;
        const mapped = ((resp as any)?.edges ?? [])
          .map(adaptEdge)
          .filter((e: LineageEdge) => remoteAssetIds.has(e.from) && remoteAssetIds.has(e.to));
        setReplayEdges(mapped);
      } catch {
        if (!cancelled) setReplayEdges(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isTimeTravelActive, timeTravelDate, remoteAssetIds]);

  // Real data wins once the backend has collected assets; mock keeps demos alive otherwise.
  // NOTE: an empty change list is a legitimate real state (all events resolved/deleted) —
  // it must render as an empty M4, never as mock events referencing non-existent assets.
  const hasRealData = mappedRemoteAssets.length > 0;
  const assets = hasRealData ? mappedRemoteAssets : INITIAL_ASSETS;
  const edges = hasRealData ? mappedRemoteEdges : INITIAL_EDGES;
  const changes = hasRealData ? mappedRemoteChanges : INITIAL_CHANGES;

  // Skeletons only cover the very first backend sync, before any real data lands
  const initialLoading = !firstSyncDone && !hasRealData;

  // Metric center (M5): real API wins, mock fallback keeps the demo alive offline
  const [metrics, setMetrics] = useState<MetricDefinition[]>(INITIAL_METRICS);
  const [collectors, setCollectors] = useState(INITIAL_COLLECTORS);

  const refreshMetrics = useCallback(() => {
    metricApi.list()
      .then((list: any[]) => {
        if (Array.isArray(list) && list.length > 0) setMetrics(list.map(adaptMetric));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshMetrics(); }, [refreshMetrics]);

  // Validation center (M7): real API wins, mock fallback keeps the demo alive offline
  const [rules, setRules] = useState<ValidationRule[]>(INITIAL_RULES);
  const [issues, setIssues] = useState<QualityIssue[]>(INITIAL_ISSUES);

  const refreshValidationData = useCallback(() => {
    ruleApi.list()
      .then((list: any[]) => {
        if (Array.isArray(list) && list.length > 0) setRules(list as ValidationRule[]);
      })
      .catch(() => {});
    ruleApi.listIssues()
      .then((list: any[]) => {
        if (Array.isArray(list) && list.length > 0) setIssues(list as QualityIssue[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshValidationData(); }, [refreshValidationData]);

  // Notification center (M8): real API wins, mock fallback keeps the demo alive offline
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const refreshNotifications = useCallback(() => {
    notificationApi.list()
      .then((list: any[]) => {
        if (Array.isArray(list) && list.length > 0) setNotifications(list as NotificationItem[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshNotifications(); }, [refreshNotifications]);

  // Contract browser (M6): real API wins, component keeps an offline fallback
  const [contracts, setContracts] = useState<ContractFile[]>([]);

  const refreshContracts = useCallback(() => {
    contractApi.list()
      .then((list: any[]) => {
        if (Array.isArray(list) && list.length > 0) setContracts(list as ContractFile[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshContracts(); }, [refreshContracts]);

  // Counts for sidebar badges
  const unmanagedCount = changes.filter(c => !c.isManaged).length;
  const pendingAckCount = changes.filter(c => c.status === 'ACK_PENDING').length;
  const ruleFailureCount = rules.filter(r => r.hitCount > 0).length;

  // Keep focus selectors valid when the dataset switches between mock and real
  useEffect(() => {
    if (assets.length === 0) return;
    if (!assets.some(a => a.id === selectedAssetId)) setSelectedAssetId(assets[0].id);
    if (!assets.some(a => a.id === simulateAssetId)) setSimulateAssetId(assets[0].id);
  }, [assets, selectedAssetId, simulateAssetId]);

  // Actions
  const handleSimulateChange = (assetId: string) => {
    setSimulateAssetId(assetId);
    setActiveTab('impact');
  };

  const handleExploreLineage = (assetId: string) => {
    setSelectedAssetId(assetId);
    setActiveTab('lineage');
  };

  const handleNavigateContract = (ref?: string) => {
    if (ref) setContractRef(ref);
    setActiveTab('contracts');
  };

  const handleNotificationAction = (notif: any, action: string) => {
    if (action === 'ack') {
      // Persist the acknowledgement, then flip local state for instant feedback
      void notificationApi.markRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    } else if (action === 'view_report') {
      setActiveTab('impact');
    } else if (action === 'open_validation') {
      setActiveTab('validation');
    } else if (action === 'exempt') {
      setActiveTab('impact');
    } else if (action === 'generate_patch') {
      setActiveTab('changes');
    } else if (action === 'view_diff') {
      setActiveTab('changes');
    }
  };

  const handleMarkAllRead = () => {
    void notificationApi.markAllRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Global Header */}
      <Header
        currentSpace={currentSpace}
        onSpaceChange={setCurrentSpace}
        currentUserRole={currentUserRole}
        onRoleChange={setCurrentUserRole}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isTimeTravelActive={isTimeTravelActive}
        onToggleTimeTravel={() => setIsTimeTravelActive(!isTimeTravelActive)}
        timeTravelDate={timeTravelDate}
        notifications={notifications}
        onOpenNotifications={() => setActiveTab('inbox')}
        onOpenDesignDoc={() => setIsDesignDocOpen(true)}
        authUser={auth?.user}
        onLogout={logout}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unmanagedCount={unmanagedCount}
          pendingAckCount={pendingAckCount}
          ruleFailureCount={ruleFailureCount}
          metricsCount={metrics.length}
        />

        {/* Content Area Rendering the Selected Module; key resets the boundary on tab switch */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <ErrorBoundary key={activeTab} label={activeTab}>
          {activeTab === 'workbench' && (
            <Workbench
              assets={assets}
              changes={changes}
              issues={issues}
              metrics={metrics}
              onNavigateTab={setActiveTab}
              onSelectAsset={(id) => {
                setSelectedAssetId(id);
                setActiveTab('catalog');
              }}
              onSimulateChange={handleSimulateChange}
            />
          )}

          {activeTab === 'catalog' && (
            <M1AssetCatalog
              assets={assets}
              edges={edges}
              changes={changes}
              issues={issues}
              isLoading={initialLoading}
              selectedAssetId={selectedAssetId}
              onSelectAsset={setSelectedAssetId}
              onExploreLineage={handleExploreLineage}
              onSimulateChange={handleSimulateChange}
              onNavigateContract={handleNavigateContract}
            />
          )}

          {activeTab === 'lineage' && (
            <M2LineageExplorer
              assets={assets}
              edges={isTimeTravelActive && replayEdges ? replayEdges : edges}
              isLoading={initialLoading}
              initialFocusId={selectedAssetId || 'asset:ods_crm_customer'}
              isTimeTravelActive={isTimeTravelActive}
              timeTravelDate={timeTravelDate}
              currentSpace={currentSpace}
              onSimulateChange={handleSimulateChange}
              onNavigateContract={handleNavigateContract}
            />
          )}

          {activeTab === 'impact' && (
            <M3ImpactAnalysis
              assets={assets}
              defaultAssetId={simulateAssetId}
              onExploreLineage={handleExploreLineage}
            />
          )}

          {activeTab === 'changes' && (
            <M4ChangeCenter
              changes={changes}
              onSimulateChange={handleSimulateChange}
              onNavigateContract={handleNavigateContract}
            />
          )}

          {activeTab === 'metrics' && (
            <M5MetricCenter
              metrics={metrics}
              onExploreLineage={handleExploreLineage}
            />
          )}

          {activeTab === 'contracts' && (
            <M6ContractBrowser
              contracts={contracts}
              initialContractRef={contractRef}
              onSimulateChange={handleSimulateChange}
            />
          )}

          {activeTab === 'validation' && (
            <M7ValidationCenter
              rules={rules}
              issues={issues}
              assets={assets}
              onSelectAsset={(id) => {
                setSelectedAssetId(id);
                setActiveTab('catalog');
              }}
              onRefreshRules={refreshValidationData}
            />
          )}

          {activeTab === 'inbox' && (
            <M8NotificationCenter
              notifications={notifications}
              onActionClick={handleNotificationAction}
              onMarkAllRead={handleMarkAllRead}
            />
          )}

          {activeTab === 'dashboard' && (
            <M9GovernanceDashboard />
          )}

          {activeTab === 'collectors' && (
            <M10CollectorAdmin collectors={collectors} />
          )}

          {activeTab === 'datasources' && (
            <M11DataSourceManager />
          )}

          {activeTab === 'standards' && (
            <M12StandardsHub />
          )}

          {activeTab === 'models' && (
            <M13DataModelHub />
          )}

          {activeTab === 'help' && (
            <HelpCenter onNavigateTab={setActiveTab} />
          )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global ⌘K Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        assets={assets}
        metrics={metrics}
        rules={rules}
        onSelectAsset={(id) => {
          setSelectedAssetId(id);
          setActiveTab('catalog');
        }}
        onSelectMetric={(code) => {
          setActiveTab('metrics');
        }}
        onNavigateTab={setActiveTab}
        onSimulateChange={handleSimulateChange}
      />

      {/* Architectural Optimization Report Modal */}
      <DesignOptimizationModal
        isOpen={isDesignDocOpen}
        onClose={() => setIsDesignDocOpen(false)}
      />
    </div>
  );
}

/** Entry: hard-gates the shell behind a valid JWT session (login screen otherwise). */
export default function App() {
  return (
    <ErrorBoundary className="h-screen w-screen">
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    </ErrorBoundary>
  );
}
