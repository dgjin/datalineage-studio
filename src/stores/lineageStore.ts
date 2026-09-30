/**
 * Lineage Store (Zustand)
 * Central state management for assets, lineage edges and backend connectivity.
 * Gracefully degrades when the Spring Boot backend is offline.
 */
import { create } from 'zustand';
import { assetApi, lineageApi, changeApi } from '../services/api';

export interface LineageState {
  assets: any[];
  edges: any[];
  changes: any[];
  loading: boolean;
  error: string | null;
  backendOnline: boolean;
  lastSyncedAt: number | null;

  fetchAssets: (params?: { space?: string; layer?: string; type?: string; status?: string }) => Promise<void>;
  fetchEdges: (params?: { assetId?: string; kind?: string }) => Promise<void>;
  fetchChanges: (params?: { status?: string; isManaged?: boolean }) => Promise<void>;
  fetchGraph: (params?: { space?: string; layer?: string }) => Promise<void>;
  reset: () => void;
}

export const useLineageStore = create<LineageState>((set) => ({
  assets: [],
  edges: [],
  changes: [],
  loading: false,
  error: null,
  backendOnline: false,
  lastSyncedAt: null,

  fetchAssets: async (params) => {
    set({ loading: true, error: null });
    try {
      const assets = await assetApi.list(params);
      set({ assets, backendOnline: true, loading: false, lastSyncedAt: Date.now() });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load assets', backendOnline: false, loading: false });
    }
  },

  fetchEdges: async (params) => {
    set({ loading: true, error: null });
    try {
      const edges = await lineageApi.listEdges(params);
      set({ edges, backendOnline: true, loading: false, lastSyncedAt: Date.now() });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load lineage edges', backendOnline: false, loading: false });
    }
  },

  fetchChanges: async (params) => {
    set({ loading: true, error: null });
    try {
      const changes = await changeApi.list(params);
      set({ changes, backendOnline: true, loading: false, lastSyncedAt: Date.now() });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load change events', backendOnline: false, loading: false });
    }
  },

  fetchGraph: async (params) => {
    set({ loading: true, error: null });
    try {
      const graph = await lineageApi.getGraph(params);
      set({
        assets: graph?.nodes ?? [],
        edges: graph?.edges ?? [],
        backendOnline: true,
        loading: false,
        lastSyncedAt: Date.now(),
      });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load lineage graph', backendOnline: false, loading: false });
    }
  },

  reset: () =>
    set({
      assets: [],
      edges: [],
      changes: [],
      loading: false,
      error: null,
      backendOnline: false,
      lastSyncedAt: null,
    }),
}));
