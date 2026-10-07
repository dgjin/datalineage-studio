import React, { useState, useMemo, useRef } from 'react';
import { 
  Asset, 
  LineageEdge, 
  LayerType, 
  AssetStatus 
} from '../../types/lineage';
import { 
  GitFork, 
  Search, 
  Sliders, 
  Eye, 
  Maximize2, 
  RotateCcw, 
  Share2, 
  Download, 
  Layers, 
  ArrowRight, 
  Plus, 
  Minus, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Copy, 
  Check, 
  ExternalLink, 
  ChevronRight, 
  Filter, 
  Sparkles, 
  ArrowLeftRight, 
  Route, 
  XCircle, 
  Crosshair, 
  Navigation, 
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  BookOpen,
  Network,
  ChevronDown,
  Camera,
  CheckSquare,
  Square
} from 'lucide-react';
import { LineageExportModal } from '../LineageExportModal';
import { GraphLegendPanel } from '../GraphLegendPanel';
import { FreeGraphCanvas } from '../FreeGraphCanvas';
import { ColumnLineageBoard } from '../ColumnLineageBoard';
import { SubsetSnapshotModal } from '../SubsetSnapshotModal';
import { GraphSkeleton } from '../Skeleton';
import { findShortestPath, PathResult } from '../../utils/pathFinding';
import { LayoutAlgorithm } from '../../utils/graphLayouts';

interface M2LineageExplorerProps {
  assets: Asset[];
  edges: LineageEdge[];
  /** True only during the very first backend sync (skeleton state). */
  isLoading?: boolean;
  initialFocusId?: string;
  isTimeTravelActive?: boolean;
  timeTravelDate?: string;
  currentSpace?: string;
  onSimulateChange: (assetId: string) => void;
  onNavigateContract: (contractRef?: string) => void;
}

export const M2LineageExplorer: React.FC<M2LineageExplorerProps> = ({
  assets,
  edges,
  isLoading = false,
  initialFocusId = 'asset:ods_crm_customer',
  isTimeTravelActive = false,
  timeTravelDate = '2026-08-01',
  currentSpace = 'crm',
  onSimulateChange,
  onNavigateContract
}) => {
  const [focusId, setFocusId] = useState<string>(initialFocusId);
  const [direction, setDirection] = useState<'UP' | 'DOWN' | 'BOTH'>('BOTH');
  const [depth, setDepth] = useState<number>(3);
  const [granularity, setGranularity] = useState<'TABLE' | 'COLUMN'>('TABLE');
  const [showCriticalOnly, setShowCriticalOnly] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialFocusId);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([initialFocusId]));
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pathFinderOpen, setPathFinderOpen] = useState(false);
  const [pathStart, setPathStart] = useState<string>('asset:ods_crm_customer');
  const [pathEnd, setPathEnd] = useState<string>('asset:api:vip_customer_query');
  const [activePath, setActivePath] = useState<PathResult | null>(null);
  const [isPathHighlighted, setIsPathHighlighted] = useState(false);
  const [filterToPathOnly, setFilterToPathOnly] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [legendTypeFilter, setLegendTypeFilter] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutAlgorithm>('HIERARCHICAL');
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);

  // Search & Node Filter/Highlight States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSearchOnly, setFilterSearchOnly] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSearchMatchIdx, setActiveSearchMatchIdx] = useState(0);

  // Multi-select & Bulk operations states
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set([initialFocusId]));
  const [highlightDependenciesActive, setHighlightDependenciesActive] = useState<boolean>(false);
  const [filterToSubsetOnly, setFilterToSubsetOnly] = useState<boolean>(false);
  const [isSubsetSnapshotOpen, setIsSubsetSnapshotOpen] = useState<boolean>(false);

  // Multi-select node handler (Shift/Cmd/Ctrl click adds/toggles, normal click single selects)
  const handleNodeSelect = (nodeId: string, e?: React.MouseEvent) => {
    if (e && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      setSelectedNodeIds(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          if (next.size > 1) next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
      setSelectedNodeId(nodeId);
      setFocusId(nodeId);
    } else {
      setSelectedNodeIds(new Set([nodeId]));
      setSelectedNodeId(nodeId);
      setFocusId(nodeId);
      centerAndZoomNode(nodeId);
    }
  };

  // Subset interconnecting edges (edges between selected nodes)
  const subsetEdges = useMemo(() => {
    if (selectedNodeIds.size < 2) return [];
    return edges.filter(e => selectedNodeIds.has(e.from) && selectedNodeIds.has(e.to));
  }, [edges, selectedNodeIds]);

  // Selected assets list
  const selectedAssetsList = useMemo(() => {
    return assets.filter(a => selectedNodeIds.has(a.id));
  }, [assets, selectedNodeIds]);

  // Search matching nodes (filter by name, displayTitle, code, asset.type, or layer)
  const searchMatchedNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return assets.filter(a => 
      a.name.toLowerCase().includes(q) ||
      a.displayTitle.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      a.layer.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.owner.toLowerCase().includes(q)
    );
  }, [assets, searchQuery]);

  const searchMatchedIdSet = useMemo(() => {
    return new Set(searchMatchedNodes.map(n => n.id));
  }, [searchMatchedNodes]);

  // Jump to next/prev matching node
  const handleNextSearchMatch = (dir: 'NEXT' | 'PREV' = 'NEXT') => {
    if (searchMatchedNodes.length === 0) return;
    let nextIdx = dir === 'NEXT' ? activeSearchMatchIdx + 1 : activeSearchMatchIdx - 1;
    if (nextIdx >= searchMatchedNodes.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = searchMatchedNodes.length - 1;
    setActiveSearchMatchIdx(nextIdx);
    const target = searchMatchedNodes[nextIdx];
    if (target) {
      setSelectedNodeId(target.id);
      centerAndZoomNode(target.id);
    }
  };

  // Auto-center viewport and smooth zoom states
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const nodeElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [focusPulseNodeId, setFocusPulseNodeId] = useState<string | null>(null);

  // Smooth Auto-Center & Zoom Animation to target node
  const centerAndZoomNode = (nodeId: string, customZoom?: number) => {
    if (customZoom !== undefined) {
      setZoomLevel(customZoom);
    }
    setFocusPulseNodeId(nodeId);

    // Coordinate calculation using container scroll
    requestAnimationFrame(() => {
      const nodeEl = nodeElementRefs.current.get(nodeId);
      const container = canvasViewportRef.current;
      if (nodeEl && container) {
        const containerRect = container.getBoundingClientRect();
        const nodeRect = nodeEl.getBoundingClientRect();

        const currentScrollLeft = container.scrollLeft;
        const currentScrollTop = container.scrollTop;

        const nodeCenterX = nodeRect.left + nodeRect.width / 2;
        const nodeCenterY = nodeRect.top + nodeRect.height / 2;
        const viewportCenterX = containerRect.left + containerRect.width / 2;
        const viewportCenterY = containerRect.top + containerRect.height / 2;

        const deltaX = nodeCenterX - viewportCenterX;
        const deltaY = nodeCenterY - viewportCenterY;

        container.scrollTo({
          left: Math.max(0, currentScrollLeft + deltaX),
          top: Math.max(0, currentScrollTop + deltaY),
          behavior: 'smooth'
        });
      }
    });

    // Reset pulse beacon after animation completes
    setTimeout(() => {
      setFocusPulseNodeId(null);
    }, 1800);
  };

  const handleSelectAndCenterNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setFocusId(nodeId);
    centerAndZoomNode(nodeId);
  };

  // Shortest Path calculation logic
  const handleCalculateShortestPath = () => {
    const result = findShortestPath(pathStart, pathEnd, assets, edges);
    setActivePath(result);
    setIsPathHighlighted(result.found);
    if (result.found && result.direction === 'FORWARD') {
      setSelectedNodeId(pathStart);
      setFocusId(pathStart);
      centerAndZoomNode(pathStart);
    }
  };

  const handleClearPathHighlight = () => {
    setActivePath(null);
    setIsPathHighlighted(false);
    setFilterToPathOnly(false);
  };

  const handleSwapStartEnd = () => {
    const newStart = pathEnd;
    const newEnd = pathStart;
    setPathStart(newStart);
    setPathEnd(newEnd);
    if (activePath) {
      const result = findShortestPath(newStart, newEnd, assets, edges);
      setActivePath(result);
      setIsPathHighlighted(result.found);
    }
  };

  const handleSetAsStart = (id: string) => {
    setPathStart(id);
    setPathFinderOpen(true);
    centerAndZoomNode(id);
    if (pathEnd && pathEnd !== id) {
      const result = findShortestPath(id, pathEnd, assets, edges);
      setActivePath(result);
      setIsPathHighlighted(result.found);
    }
  };

  const handleSetAsEnd = (id: string) => {
    setPathEnd(id);
    setPathFinderOpen(true);
    centerAndZoomNode(id);
    if (pathStart && pathStart !== id) {
      const result = findShortestPath(pathStart, id, assets, edges);
      setActivePath(result);
      setIsPathHighlighted(result.found);
    }
  };

  const layers: LayerType[] = ['ODS', 'DWD', 'DWS', 'ADS', 'APP'];

  // Status visual styles
  const statusStyles: Record<AssetStatus, { border: string; bg: string; dot: string }> = {
    ACTIVE: { border: 'border-emerald-500/40', bg: 'bg-emerald-950/20', dot: 'bg-emerald-400' },
    STALE: { border: 'border-amber-500/60 ring-1 ring-amber-500/40', bg: 'bg-amber-950/30', dot: 'bg-amber-400' },
    PENDING_CHANGE: { border: 'border-yellow-500/60', bg: 'bg-yellow-950/20', dot: 'bg-yellow-400' },
    UNMANAGED: { border: 'border-rose-500/80 ring-2 ring-rose-500/40', bg: 'bg-rose-950/30', dot: 'bg-rose-400' },
    DEPRECATED: { border: 'border-slate-600 line-through text-slate-500', bg: 'bg-slate-900', dot: 'bg-slate-500' },
    DRAFT: { border: 'border-blue-500/40 border-dashed', bg: 'bg-blue-950/20', dot: 'bg-blue-400' }
  };

  // Filter edges based on granularity, direction, critical path, and subset
  const visibleEdges = useMemo(() => {
    let result = edges;
    if (granularity === 'TABLE') {
      result = result.filter(e => e.kind === 'TABLE' || e.kind === 'METRIC_REF');
    }
    if (showCriticalOnly) {
      result = result.filter(e => e.isCriticalPath);
    }
    if (filterToSubsetOnly) {
      result = result.filter(e => selectedNodeIds.has(e.from) && selectedNodeIds.has(e.to));
    }
    return result;
  }, [edges, granularity, showCriticalOnly, filterToSubsetOnly, selectedNodeIds]);

  // Assets visible on the canvas after path / search / subset filters.
  // Shared by the free graph canvas (table level) and the column mapping board (column level).
  const canvasAssets = useMemo(() => assets.filter(a => {
    if (filterToPathOnly && activePath?.found && !activePath.nodeIds.includes(a.id)) return false;
    if (filterSearchOnly && searchQuery.trim() && !searchMatchedIdSet.has(a.id)) return false;
    if (filterToSubsetOnly && !selectedNodeIds.has(a.id)) return false;
    return true;
  }), [assets, filterToPathOnly, activePath, filterSearchOnly, searchQuery, searchMatchedIdSet, filterToSubsetOnly, selectedNodeIds]);

  // Group assets by layer for the swimlanes
  const assetsByLayer = useMemo(() => {
    const map: Record<LayerType, Asset[]> = {
      ODS: [],
      DWD: [],
      DWS: [],
      ADS: [],
      APP: []
    };
    assets.forEach(asset => {
      // If user toggles to only show path nodes
      if (filterToPathOnly && activePath?.found && !activePath.nodeIds.includes(asset.id)) {
        return;
      }
      // If user toggles to only show search filtered nodes
      if (filterSearchOnly && searchQuery.trim() && !searchMatchedIdSet.has(asset.id)) {
        return;
      }
      // If user toggles to only show multi-selected subset nodes
      if (filterToSubsetOnly && !selectedNodeIds.has(asset.id)) {
        return;
      }
      if (map[asset.layer]) {
        map[asset.layer].push(asset);
      }
    });
    return map;
  }, [assets, filterToPathOnly, activePath, filterSearchOnly, searchQuery, searchMatchedIdSet, filterToSubsetOnly, selectedNodeIds]);

  const selectedAsset = assets.find(a => a.id === selectedNodeId);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyShareLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 relative">
      {/* Historical Time Travel Mode Warning Banner */}
      {isTimeTravelActive && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="font-semibold">历史时点回放中 (Bi-temporal Time-Travel Replay) @ {timeTravelDate} · {edges.length} 条边</span>
            <span className="text-amber-400/80">此为快照视图，正在展示指定时点的数据血缘状态</span>
          </div>
          <span className="text-[11px] font-mono bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">只读不可修改</span>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-3 flex items-center justify-between gap-2 text-xs shrink-0 z-10">
        {/* Left: perspective / scope / view controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Direction toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setDirection('UP')}
              className={`px-2.5 py-1 rounded-md transition whitespace-nowrap ${direction === 'UP' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
              title="溯源视角：查看该数据从何而来（上游）"
            >
              上游
            </button>
            <button
              onClick={() => setDirection('DOWN')}
              className={`px-2.5 py-1 rounded-md transition whitespace-nowrap ${direction === 'DOWN' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
              title="影响视角：查看改动后会影响谁（下游）"
            >
              下游
            </button>
            <button
              onClick={() => setDirection('BOTH')}
              className={`px-2.5 py-1 rounded-md transition whitespace-nowrap ${direction === 'BOTH' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
              title="全域双向微图（上游 + 下游）"
            >
              双向
            </button>
          </div>

          {/* Granularity switch: Table vs Column */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setGranularity('TABLE')}
              className={`px-2.5 py-1 rounded-md transition whitespace-nowrap ${granularity === 'TABLE' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
              title="表级血缘视图"
            >
              表级
            </button>
            <button
              onClick={() => setGranularity('COLUMN')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 whitespace-nowrap ${granularity === 'COLUMN' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
              title="字段级血缘视图（含列级依赖）"
            >
              <Sparkles className="w-3 h-3 text-cyan-300" />
              <span>字段级</span>
            </button>
          </div>

          <div className="w-px h-5 bg-slate-800 shrink-0" />

          {/* Depth selector */}
          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 shrink-0">
            <span className="whitespace-nowrap">深度:</span>
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
            >
              <option value={1} className="bg-slate-900">1 跳</option>
              <option value={2} className="bg-slate-900">2 跳</option>
              <option value={3} className="bg-slate-900">3 跳</option>
              <option value={5} className="bg-slate-900">全链穿透</option>
            </select>
          </div>

          {/* Critical Path Filter */}
          <button
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            className={`px-2 min-[1440px]:px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 shrink-0 ${
              showCriticalOnly 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-medium'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="高亮破坏性关键路径（Critical Path）"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden min-[1440px]:inline whitespace-nowrap">关键路径</span>
          </button>

          {/* Layout Algorithm Switcher Dropdown (table level only; column level uses the mapping board) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setLayoutDropdownOpen(!layoutDropdownOpen)}
              disabled={granularity === 'COLUMN'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 transition font-medium whitespace-nowrap ${
                granularity === 'COLUMN' ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-700 cursor-pointer'
              }`}
              title={granularity === 'COLUMN'
                ? '字段级视图使用「字段映射板」专属布局；拓扑布局算法仅适用于表级视图'
                : '切换图谱拓扑布局算法 (Hierarchical / Force-Directed / Radial)'}
            >
              {layoutMode === 'HIERARCHICAL' && <Layers className="w-3.5 h-3.5 text-indigo-400" />}
              {layoutMode === 'FORCE_DIRECTED' && <Network className="w-3.5 h-3.5 text-amber-400" />}
              {layoutMode === 'RADIAL' && <Crosshair className="w-3.5 h-3.5 text-cyan-400" />}

              <span className="hidden min-[1728px]:inline font-semibold text-white whitespace-nowrap">
                {layoutMode === 'HIERARCHICAL' ? '数仓分层' : layoutMode === 'FORCE_DIRECTED' ? '力导向拓扑' : '放射同心圆'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${layoutDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {layoutDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setLayoutDropdownOpen(false)} 
                />
                <div className="absolute top-full left-0 mt-1.5 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                    图谱拓扑布局算法 (Layout Algorithms)
                  </div>

                  {/* 1. Hierarchical */}
                  <button
                    onClick={() => {
                      setLayoutMode('HIERARCHICAL');
                      setLayoutDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition cursor-pointer ${
                      layoutMode === 'HIERARCHICAL'
                        ? 'bg-indigo-600/20 text-white border border-indigo-500/40'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">数仓分层泳道 (Hierarchical)</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                          默认5层
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        基于 ODS-APP 5层数仓架构泳道，适合全流程管道审计与端到端链路追溯。
                      </p>
                    </div>
                  </button>

                  {/* 2. Force-Directed */}
                  <button
                    onClick={() => {
                      setLayoutMode('FORCE_DIRECTED');
                      setLayoutDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition cursor-pointer ${
                      layoutMode === 'FORCE_DIRECTED'
                        ? 'bg-indigo-600/20 text-white border border-indigo-500/40'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                      <Network className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">力导向有机拓扑 (Force-Directed)</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                          物理模拟
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        弹簧引力与斥力物理模型聚类，自动展现紧密数据子图与隐藏孤岛。
                      </p>
                    </div>
                  </button>

                  {/* 3. Radial */}
                  <button
                    onClick={() => {
                      setLayoutMode('RADIAL');
                      setLayoutDropdownOpen(false);
                      if (selectedNodeId) centerAndZoomNode(selectedNodeId);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition cursor-pointer ${
                      layoutMode === 'RADIAL'
                        ? 'bg-indigo-600/20 text-white border border-indigo-500/40'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
                      <Crosshair className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">放射同心圆布局 (Radial Orbit)</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                          焦点辐射
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        以选定资产为靶心，同心轨道向外辐射 1跳/2跳/3跳 上下游 360° 影响范围。
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: elastic search section */}
        <div className="flex-1 min-w-0 flex items-center justify-center px-1">
          <div className="relative flex items-center gap-1.5 z-20 w-full max-w-[300px]">
          <div className="relative flex items-center flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveSearchMatchIdx(0);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNextSearchMatch('NEXT');
                } else if (e.key === 'Escape') {
                  setIsSearchFocused(false);
                }
              }}
              placeholder="搜索资产 / 字段…"
              className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg pl-8 pr-16 py-1 text-xs text-white placeholder-slate-500 w-full min-w-0 transition-colors focus:outline-none"
            />
            {/* Clear or count pill */}
            <div className="absolute right-1.5 flex items-center gap-1">
              {searchQuery ? (
                <>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {searchMatchedNodes.length > 0 ? `${activeSearchMatchIdx + 1}/${searchMatchedNodes.length}` : '0 匹配'}
                  </span>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveSearchMatchIdx(0);
                    }}
                    className="text-slate-400 hover:text-white p-0.5"
                    title="清空搜索"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">⌘F</span>
              )}
            </div>
          </div>

          {/* Quick cycle button if matches > 1 */}
          {searchMatchedNodes.length > 1 && (
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => handleNextSearchMatch('PREV')}
                className="px-1 py-0.5 text-slate-400 hover:text-white rounded"
                title="上一个匹配项"
              >
                ▲
              </button>
              <button
                onClick={() => handleNextSearchMatch('NEXT')}
                className="px-1 py-0.5 text-slate-400 hover:text-white rounded"
                title="下一个匹配项"
              >
                ▼
              </button>
            </div>
          )}

          {/* Filter toggle checkbox pill */}
          {searchQuery.trim() && (
            <button
              onClick={() => setFilterSearchOnly(!filterSearchOnly)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                filterSearchOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="仅在画布中显示匹配到的节点"
            >
              <span>{filterSearchOnly ? '仅显匹配' : '高亮模式'}</span>
            </button>
          )}

          {/* Autocomplete Dropdown Popover */}
          {isSearchFocused && searchQuery.trim() && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsSearchFocused(false)} 
              />
              <div className="absolute top-full left-0 mt-1.5 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 max-h-72 overflow-y-auto space-y-1">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-400 border-b border-slate-800">
                  <span>匹配到 {searchMatchedNodes.length} 个资产</span>
                  <span className="font-mono text-slate-500">按 Enter 跳转</span>
                </div>
                {searchMatchedNodes.length === 0 ? (
                  <div className="p-3 text-center text-slate-500 text-[11px]">
                    未找到匹配资产（可尝试搜索 Table, View, API 或字段名）
                  </div>
                ) : (
                  searchMatchedNodes.map((a, idx) => {
                    const isCurrent = idx === activeSearchMatchIdx;
                    return (
                      <div
                        key={a.id}
                        onClick={() => {
                          setActiveSearchMatchIdx(idx);
                          setSelectedNodeId(a.id);
                          centerAndZoomNode(a.id);
                          setIsSearchFocused(false);
                        }}
                        className={`p-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition ${
                          isCurrent
                            ? 'bg-indigo-600/30 border border-indigo-500/50 text-white'
                            : 'hover:bg-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white text-xs truncate max-w-[150px]">
                              {a.name}
                            </span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {a.type}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {a.layer} · {a.displayTitle}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono shrink-0">
                          <span className="text-emerald-400">{a.confidence}%</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom & Canvas Auto-Center Controller */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs text-slate-300 shrink-0">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.65, Number((prev - 0.1).toFixed(1))))}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
              title="缩小画布 (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="px-1.5 py-0.5 hover:bg-slate-800 font-mono text-[11px] text-slate-300 rounded transition"
              title="重置缩放 100%"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.4, Number((prev + 0.1).toFixed(1))))}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
              title="放大画布 (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-slate-800 mx-0.5" />
            <button
              onClick={() => selectedNodeId && centerAndZoomNode(selectedNodeId)}
              className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-slate-800 text-cyan-400 rounded text-[11px] font-medium transition"
              title="平滑自动居中缩放到当前选中的节点"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden min-[1728px]:inline whitespace-nowrap">自动居中</span>
            </button>
          </div>

          <div className="w-px h-5 bg-slate-800 shrink-0" />

          {/* Path Finder trigger */}
          <button
            onClick={() => setPathFinderOpen(!pathFinderOpen)}
            className={`flex items-center gap-1.5 px-2 min-[1440px]:px-3 py-1 rounded-lg border transition font-medium shrink-0 ${
              isPathHighlighted
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
            title="选择两节点计算并高亮最短主数据流路径"
          >
            <Route className={`w-3.5 h-3.5 ${isPathHighlighted ? 'text-cyan-400 animate-pulse' : 'text-indigo-400'}`} />
            <span className="hidden min-[1440px]:inline whitespace-nowrap">路径查找</span>
            {isPathHighlighted && activePath?.found && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-200 font-mono font-bold">
                {activePath.totalHops} 跳
              </span>
            )}
          </button>

          {/* Share URL button */}
          <button
            onClick={handleCopyShareLink}
            className="flex items-center gap-1.5 px-2 min-[1728px]:px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 transition shrink-0"
            title="复制当前视图分享链接"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden min-[1728px]:inline whitespace-nowrap">{copiedUrl ? '已复制视图' : '分享链接'}</span>
          </button>

          {/* Legend Toggle button in Toolbar */}
          <button
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className={`flex items-center gap-1.5 px-2 min-[1728px]:px-3 py-1 rounded-lg border transition font-medium shrink-0 ${
              isLegendOpen
                ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
            title="查看或收起血缘图谱图例规范与要素说明"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden min-[1728px]:inline whitespace-nowrap">图例说明</span>
          </button>

          {/* Export Graph as High-Quality SVG / PNG / Mermaid */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-2 min-[1728px]:px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-600/30 to-cyan-600/30 hover:from-indigo-600/50 hover:to-cyan-600/50 border border-indigo-500/40 text-indigo-200 hover:text-white transition font-medium shadow-sm shrink-0"
            title="导出当前血缘图谱为高清 SVG 矢量图、PNG 或 Mermaid 架构代码"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden min-[1728px]:inline whitespace-nowrap">导出图谱</span>
          </button>
        </div>
      </div>

      {/* Shortest Path Calculation & Highlight Console */}
      {pathFinderOpen && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 space-y-3 z-20 text-xs shadow-xl animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400 font-medium">起点:</span>
                <select
                  value={pathStart}
                  onChange={(e) => setPathStart(e.target.value)}
                  className="bg-transparent text-white font-mono focus:outline-none cursor-pointer max-w-[200px] truncate"
                >
                  {assets.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.name} ({a.layer} - {a.displayTitle})</option>)}
                </select>
              </div>

              <button
                onClick={handleSwapStartEnd}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="反转起点与终点"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 font-medium">终点:</span>
                <select
                  value={pathEnd}
                  onChange={(e) => setPathEnd(e.target.value)}
                  className="bg-transparent text-white font-mono focus:outline-none cursor-pointer max-w-[200px] truncate"
                >
                  {assets.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.name} ({a.layer} - {a.displayTitle})</option>)}
                </select>
              </div>

              <button
                onClick={handleCalculateShortestPath}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold transition shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
              >
                <Route className="w-3.5 h-3.5" />
                <span>计算并高亮最短路径</span>
              </button>

              {isPathHighlighted && (
                <button
                  onClick={handleClearPathHighlight}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>清除高亮</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {activePath?.found && (
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={filterToPathOnly}
                    onChange={(e) => setFilterToPathOnly(e.target.checked)}
                    className="accent-indigo-600 rounded"
                  />
                  <span>仅显示路径节点</span>
                </label>
              )}

              <button
                onClick={() => setPathFinderOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Result Message Banner */}
          {activePath && (
            <div className={`p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs ${
              activePath.found
                ? activePath.direction === 'FORWARD'
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {activePath.found ? (
                  activePath.direction === 'FORWARD' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-semibold">
                        ✓ 成功计算出最短主数据流路径：共 {activePath.totalHops} 跳 ({activePath.steps.length} 个资产节点)
                      </span>
                      <span className="text-slate-400">｜ 瓶颈最低置信度: <strong className="text-emerald-400 font-mono">{activePath.lowestConfidence}%</strong></span>
                      {activePath.criticalPathCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                          途经 {activePath.criticalPathCount} 条破坏性影响高危边
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        未检测到正向流动，但发现反向数据流（{activePath.totalHops} 跳，终点其实是起点的上游来源）。
                      </span>
                      <button
                        onClick={handleSwapStartEnd}
                        className="underline font-semibold text-white ml-1 hover:text-amber-300"
                      >
                        点击反转起点与终点并高亮 →
                      </button>
                    </>
                  )
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      ✕ 两点间无连通的数据流路径：当前起点与终点分别属于相互隔离的数据管道分支。
                    </span>
                  </>
                )}
              </div>

              {activePath.found && activePath.direction === 'FORWARD' && (
                <span className="text-[11px] text-cyan-300/80 font-mono">
                  已在画布激活高亮模式，非关联节点已自动灰显
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Canvas with Swimlanes */}
      <div className="flex-1 flex overflow-hidden relative">
        <div 
          ref={canvasViewportRef}
          className="flex-1 overflow-auto p-6 flex flex-col justify-start scroll-smooth"
        >
          <div 
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }} 
            className="transition-transform duration-300 ease-out min-w-[1200px]"
          >
            {/* Active Shortest Path Breadcrumb Strip */}
            {isPathHighlighted && activePath?.found && activePath.direction === 'FORWARD' && (
              <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-3 mb-4 shadow-xl shadow-cyan-500/10 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                  <span className="font-bold text-white">主数据流路径:</span>
                  <span className="font-mono text-cyan-300 font-bold">{activePath.totalHops} 跳 ({activePath.steps.length} 站)</span>
                  <span className="text-slate-400 text-[11px]">｜ 瓶颈最低置信度: <strong className="text-emerald-400 font-mono">{activePath.lowestConfidence}%</strong></span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  {activePath.steps.map((st, i) => (
                    <React.Fragment key={st.asset.id}>
                      <button
                        onClick={() => handleSelectAndCenterNode(st.asset.id)}
                        className={`px-2 py-0.5 rounded border transition flex items-center gap-1 cursor-pointer ${
                          st.isStart
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                            : st.isEnd
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                            : 'bg-slate-950 text-slate-200 border-slate-700 hover:border-cyan-400'
                        }`}
                      >
                        <span className="text-[9px] opacity-70">#{st.stepIndex}</span>
                        <span>{st.asset.name}</span>
                        <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">{st.asset.layer}</span>
                      </button>
                      {i < activePath.steps.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Layout Mode Conditional View (skeleton during the first backend sync) */}
            {isLoading ? (
              <GraphSkeleton />
            ) : granularity === 'COLUMN' ? (
              /* Column level: dedicated field-to-field mapping board (columns wired by curves) */
              <ColumnLineageBoard assets={canvasAssets} edges={visibleEdges} />
            ) : layoutMode === 'HIERARCHICAL' ? (
              <>
                {/* Swimlane Headers */}
                <div className="grid grid-cols-5 gap-6 min-w-[1200px] mb-4">
                  {layers.map(layer => (
                    <div 
                      key={layer}
                      className="border-b-2 border-indigo-500/30 pb-2 px-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <span className="font-bold font-mono text-sm tracking-wide text-white">{layer} 层</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {assetsByLayer[layer].length} 资产
                      </span>
                    </div>
                  ))}
                </div>

                {/* Swimlane Columns & Node Cards */}
                <div className="grid grid-cols-5 gap-6 min-w-[1200px] flex-1 relative">
                  {layers.map((layer) => (
                    <div 
                      key={layer} 
                      className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-3 space-y-4 min-h-[500px] relative backdrop-blur-xs"
                    >
                      {assetsByLayer[layer].map((asset) => {
                        const isFocused = focusId === asset.id;
                        const isSelected = selectedNodeId === asset.id;
                        const isExpanded = expandedNodes.has(asset.id);
                        const style = statusStyles[asset.status] || statusStyles.ACTIVE;

                        // Shortest path highlighting logic
                        const stepOnPath = isPathHighlighted && activePath?.found && activePath.direction === 'FORWARD'
                          ? activePath.steps.find(s => s.asset.id === asset.id)
                          : null;
                        const isOnPath = Boolean(stepOnPath);

                        // Legend type highlight filter logic
                        const isTypeFiltered = legendTypeFilter !== null;
                        const isTypeMatched = !isTypeFiltered || asset.type === legendTypeFilter;
                        const isLegendHighlighted = isTypeFiltered && isTypeMatched;

                        // Search highlight logic
                        const isSearchActive = Boolean(searchQuery.trim());
                        const isSearchMatched = isSearchActive && searchMatchedIdSet.has(asset.id);
                        const isSearchActiveMatch = isSearchMatched && searchMatchedNodes[activeSearchMatchIdx]?.id === asset.id;
                        const isSearchDimmed = isSearchActive && !isSearchMatched;

                        // Multi-select status
                        const isMultiSelected = selectedNodeIds.has(asset.id);

                        const isDimmed = (isPathHighlighted && activePath?.found && activePath.direction === 'FORWARD' && !isOnPath) 
                          || (isTypeFiltered && !isTypeMatched)
                          || isSearchDimmed;

                        return (
                          <div
                            key={asset.id}
                            ref={(el) => {
                              if (el) nodeElementRefs.current.set(asset.id, el);
                              else nodeElementRefs.current.delete(asset.id);
                            }}
                            onClick={(e) => handleNodeSelect(asset.id, e)}
                            className={`group relative rounded-xl border p-3.5 transition-all duration-300 cursor-pointer shadow-md ${style.border} ${style.bg} ${
                              focusPulseNodeId === asset.id
                                ? 'ring-4 ring-cyan-400 border-cyan-400 shadow-2xl shadow-cyan-500/50 scale-[1.05] z-30 bg-slate-900'
                                : isMultiSelected
                                ? 'ring-4 ring-purple-500 border-purple-400 shadow-2xl shadow-purple-500/40 scale-[1.04] z-25 bg-purple-950/40'
                                : isSearchActiveMatch
                                ? 'ring-4 ring-amber-300 border-amber-300 shadow-2xl shadow-amber-400/50 scale-[1.05] z-30 bg-slate-900'
                                : isSearchMatched
                                ? 'ring-2 ring-amber-400 border-amber-400 shadow-xl shadow-amber-500/30 scale-[1.03] z-20 bg-slate-900'
                                : isOnPath
                                ? 'ring-2 ring-cyan-400 border-cyan-400 shadow-xl shadow-cyan-500/25 scale-[1.03] z-10 bg-slate-900'
                                : isLegendHighlighted
                                ? 'ring-2 ring-indigo-400 border-indigo-400 shadow-xl shadow-indigo-500/30 scale-[1.03] z-20 bg-slate-900'
                                : isSelected 
                                ? 'ring-2 ring-indigo-500 shadow-indigo-500/20 shadow-lg scale-[1.02]' 
                                : isDimmed
                                ? 'opacity-25 grayscale hover:opacity-80'
                                : 'hover:border-slate-600'
                            }`}
                          >
                            {/* Auto-Center Radar Beacon Animation */}
                            {focusPulseNodeId === asset.id && (
                              <>
                                <span className="absolute -inset-2.5 rounded-2xl border-2 border-cyan-400 animate-ping pointer-events-none opacity-80 z-30" />
                                <span className="absolute -inset-1 rounded-xl ring-4 ring-cyan-500/50 animate-pulse pointer-events-none z-30" />
                              </>
                            )}
                          {/* Node Header */}
                          <div className="flex items-start justify-between gap-1.5 mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                <span className="font-mono font-bold text-xs text-white truncate max-w-[130px]" title={asset.name}>
                                  {asset.name}
                                </span>
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                                  {asset.type}
                                </span>
                                {isMultiSelected && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-500/30 text-purple-200 border border-purple-500/50 font-bold shrink-0">
                                    ✓ 已选
                                  </span>
                                )}
                                {isSearchMatched && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-semibold shrink-0">
                                    匹配
                                  </span>
                                )}
                                {/* Shortest Path Step Badge */}
                                {stepOnPath && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                                    stepOnPath.isStart
                                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                      : stepOnPath.isEnd
                                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                  }`}>
                                    {stepOnPath.isStart ? '起点 (Hop 1)' : stepOnPath.isEnd ? `终点 (Hop ${stepOnPath.stepIndex})` : `第 ${stepOnPath.stepIndex} 站`}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                {asset.displayTitle}
                              </div>
                            </div>

                            {/* Expand/Collapse step icon */}
                            <button
                              onClick={(e) => toggleExpand(asset.id, e)}
                              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 transition"
                              title="展开下一跳血缘节点"
                            >
                              {isExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            </button>
                          </div>

                          {/* Node Middle Meta */}
                          <div className="flex items-center justify-between text-[10px] bg-slate-950/60 px-2 py-1 rounded border border-slate-800/80 mb-2">
                            <span className="text-slate-400">Owner: {asset.owner.split(' ')[0]}</span>
                            <span className="font-mono text-emerald-400">{asset.confidence}%</span>
                          </div>

                          {/* Node Status Badge */}
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/60">
                            <span className="text-[9px] font-mono text-slate-400 uppercase">
                              {asset.status}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-indigo-400">
                              <span>{asset.downstreamCount} 依赖</span>
                              <ChevronRight className="w-3 h-3" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <FreeGraphCanvas
              layoutMode={layoutMode}
              assets={canvasAssets}
              edges={visibleEdges}
              focusId={focusId}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id, e) => handleNodeSelect(id, e)}
              onSetFocusNode={(id) => {
                setFocusId(id);
                setSelectedNodeId(id);
                centerAndZoomNode(id);
              }}
              onSimulateChange={onSimulateChange}
              zoomLevel={1}
              isPathHighlighted={isPathHighlighted}
              activePath={activePath}
              legendTypeFilter={legendTypeFilter}
              focusPulseNodeId={focusPulseNodeId}
              searchQuery={searchQuery}
              searchMatchedIdSet={searchMatchedIdSet}
              selectedNodeIds={selectedNodeIds}
              highlightDependenciesActive={highlightDependenciesActive}
            />
          )}

          {/* Connected Edges Summary Drawer / Legend */}
          <div className="mt-6 p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-5 flex-wrap">
              <span className="font-semibold text-slate-300">图谱图例:</span>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-indigo-500 inline-block" />
                <span className="text-slate-400">实线: 声明/运行时血缘 (≥90%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-b border-dashed border-amber-400 inline-block" />
                <span className="text-slate-400">虚线: 静态解析推断 (&lt;90%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-rose-500 rounded inline-block" />
                <span className="text-slate-400">高亮红线: 破坏性变更波及路径</span>
              </div>
              <button
                onClick={() => setIsLegendOpen(true)}
                className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition cursor-pointer ml-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>展开完整图例与规范说明 (Table, View, API, Flow...) →</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-slate-400">
              {granularity === 'COLUMN' ? (
                <span>字段映射数: <strong className="text-white font-mono">{visibleEdges.filter(e => e.kind === 'COLUMN').length}</strong></span>
              ) : (
                <span>当前拓扑边数: <strong className="text-white font-mono">{visibleEdges.length}</strong></span>
              )}
              <span>聚焦资产: <strong className="text-indigo-400 font-mono">{focusId}</strong></span>
            </div>
          </div>
        </div>
      </div>

        {/* Right Inspector Drawer */}
        {selectedAsset && (
          <div className="w-80 border-l border-slate-800 bg-slate-900/95 flex flex-col shrink-0 p-4 space-y-4 text-xs overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedAsset.layer}
                </span>
                <h3 className="font-bold text-sm text-white mt-1">{selectedAsset.name}</h3>
                <p className="text-slate-400 text-[11px]">{selectedAsset.displayTitle}</p>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Quick Action */}
            <button
              onClick={() => onSimulateChange(selectedAsset.id)}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500/20 to-rose-500/20 hover:from-amber-500/30 hover:to-rose-500/30 text-amber-300 border border-amber-500/30 font-semibold transition flex items-center justify-center gap-2 shadow-sm"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>以此节点发起 What-If 影响分析</span>
            </button>

            {/* Shortest Path Setup Quick Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSetAsStart(selectedAsset.id)}
                className="py-1.5 px-2 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 flex items-center justify-center gap-1.5 font-medium transition text-[11px]"
                title="将此节点设为最短路径起点"
              >
                <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                <span>设为路径起点</span>
              </button>
              <button
                onClick={() => handleSetAsEnd(selectedAsset.id)}
                className="py-1.5 px-2 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 flex items-center justify-center gap-1.5 font-medium transition text-[11px]"
                title="将此节点设为最短路径终点"
              >
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                <span>设为路径终点</span>
              </button>
            </div>

            {/* Properties List */}
            <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">负责人:</span>
                <span className="text-slate-200 font-medium">{selectedAsset.owner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">置信度:</span>
                <span className="text-emerald-400 font-mono">{selectedAsset.confidence}% ({selectedAsset.sourceType})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">下游消费:</span>
                <span className="text-slate-200 font-mono">{selectedAsset.downstreamCount} 个应用</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">契约绑定:</span>
                {selectedAsset.contractRef ? (
                  <button 
                    onClick={() => onNavigateContract(selectedAsset.contractRef)}
                    className="text-indigo-400 font-mono hover:underline flex items-center gap-1"
                  >
                    <span>{selectedAsset.contractRef}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-rose-400">未纳管</span>
                )}
              </div>
            </div>

            {/* Direct Connected Edges */}
            <div>
              <h4 className="font-semibold text-slate-300 uppercase text-[10px] tracking-wider mb-2">
                直接关联的血缘链路
              </h4>
              <div className="space-y-1.5">
                {(() => {
                  const connected = visibleEdges.filter(e => e.from === selectedAsset.id || e.to === selectedAsset.id);
                  const folded: { edge: LineageEdge; cols: { from: string; to: string }[] }[] = [];
                  const pairIndex = new Map<string, number>();
                  connected.forEach(e => {
                    const key = e.from + '|' + e.to;
                    let i = pairIndex.get(key);
                    if (i === undefined) {
                      i = folded.length;
                      pairIndex.set(key, i);
                      folded.push({ edge: e, cols: [] });
                    }
                    if (e.fromCol && e.toCol) {
                      folded[i].cols.push({ from: e.fromCol, to: e.toCol });
                    }
                  });

                  return folded.map(({ edge: e, cols }) => {
                    const isUpstream = e.to === selectedAsset.id;
                    const otherId = isUpstream ? e.from : e.to;
                    const otherAsset = assets.find(a => a.id === otherId);

                    return (
                      <div 
                        key={e.id}
                        className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className={isUpstream ? 'text-cyan-400' : 'text-indigo-400'}>
                            {isUpstream ? '← 上游来源' : '→ 下游输出'}
                          </span>
                          <span className="font-mono text-slate-400 text-[10px]">{e.source}</span>
                        </div>
                        <div className="font-mono font-medium text-slate-200">
                          {otherAsset?.name || otherId}
                        </div>
                        {cols.length > 0 && (
                          <div className="text-[10px] font-mono text-cyan-300 bg-slate-900/80 border border-cyan-900/40 p-1 rounded space-y-0.5">
                            <div className="text-slate-400">字段映射 ({cols.length})</div>
                            {cols.slice(0, 4).map((c, ci) => (
                              <div key={ci}>{c.from} → {c.to}</div>
                            ))}
                            {cols.length > 4 && (
                              <div className="text-slate-500">+ 其余 {cols.length - 4} 条映射...</div>
                            )}
                          </div>
                        )}
                        {e.transformExpr && (
                          <div className="text-[10px] font-mono text-slate-400 bg-slate-900 p-1 rounded">
                            expr: {e.transformExpr}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Floating Bulk Action Bar for Multi-Selected Subset */}
        {selectedNodeIds.size > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-xl border border-purple-500/50 shadow-2xl rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs animate-in slide-in-from-bottom-5 duration-200">
            {/* Selection counter & badge */}
            <div className="flex items-center gap-2 pr-3 border-r border-slate-700/80">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="font-bold text-white">
                已选中 <span className="text-purple-300 font-mono text-sm">{selectedNodeIds.size}</span> 个节点
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({subsetEdges.length} 内部链路)
              </span>
            </div>

            {/* Operation 1: Highlight Dependencies */}
            <button
              onClick={() => setHighlightDependenciesActive(!highlightDependenciesActive)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition font-medium cursor-pointer ${
                highlightDependenciesActive
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30'
                  : 'bg-purple-950/40 text-purple-200 border-purple-500/40 hover:bg-purple-900/60'
              }`}
              title="高亮选中子集资产之间的直接依赖和跨层拓扑连线"
            >
              <GitFork className="w-3.5 h-3.5 text-purple-300" />
              <span>{highlightDependenciesActive ? '已高亮关联链路' : '高亮子集链路 (Highlight)'}</span>
            </button>

            {/* Operation 2: Generate Snapshot */}
            <button
              onClick={() => setIsSubsetSnapshotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/50 shadow-md shadow-purple-500/20 font-semibold transition cursor-pointer"
              title="生成选中子集的血缘架构快照报告或导出高清图片"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>生成快照 (Generate Snapshot)</span>
            </button>

            {/* Operation 3: Filter to Subset Only */}
            <button
              onClick={() => setFilterToSubsetOnly(!filterToSubsetOnly)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition font-medium cursor-pointer ${
                filterToSubsetOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
              title="仅在当前画布展示选中的子集节点"
            >
              <span>{filterToSubsetOnly ? '显示全图' : '仅看此子集'}</span>
            </button>

            {/* Operation 4: Clear Selection */}
            <button
              onClick={() => {
                const first = Array.from(selectedNodeIds)[0] || initialFocusId;
                setSelectedNodeIds(new Set([first]));
                setHighlightDependenciesActive(false);
                setFilterToSubsetOnly(false);
              }}
              className="px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-[11px] cursor-pointer"
              title="清空多选状态"
            >
              清空 ✕
            </button>
          </div>
        )}

        {/* Floating Graph Legend & Toggle Button */}
        <GraphLegendPanel
          isOpen={isLegendOpen}
          onToggle={() => setIsLegendOpen(!isLegendOpen)}
          onClose={() => setIsLegendOpen(false)}
          selectedTypeFilter={legendTypeFilter}
          onSelectTypeFilter={(t) => setLegendTypeFilter(t)}
        />
      </div>

      {/* High-Quality Graph Export Modal */}
      <LineageExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        assets={assets}
        edges={visibleEdges}
        currentSpace={currentSpace}
      />

      {/* Selected Subset Snapshot Modal */}
      <SubsetSnapshotModal
        isOpen={isSubsetSnapshotOpen}
        onClose={() => setIsSubsetSnapshotOpen(false)}
        selectedAssets={selectedAssetsList}
        subsetEdges={subsetEdges}
        currentSpace={currentSpace}
      />
    </div>
  );
};
