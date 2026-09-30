import React, { useMemo, useState } from 'react';
import { 
  Asset, 
  LineageEdge, 
  AssetStatus 
} from '../types/lineage';
import { PathResult } from '../utils/pathFinding';
import { 
  calculateForceDirectedLayout, 
  calculateRadialLayout, 
  LayoutAlgorithm 
} from '../utils/graphLayouts';
import { 
  Compass, 
  Crosshair, 
  Network, 
  RotateCcw, 
  Sparkles, 
  AlertTriangle, 
  ExternalLink, 
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Database,
  Eye,
  Globe,
  Binary,
  Layers,
  Cpu
} from 'lucide-react';

interface FreeGraphCanvasProps {
  layoutMode: 'FORCE_DIRECTED' | 'RADIAL';
  assets: Asset[];
  edges: LineageEdge[];
  focusId: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string, e?: React.MouseEvent) => void;
  onSetFocusNode: (id: string) => void;
  onSimulateChange: (id: string) => void;
  zoomLevel: number;
  isPathHighlighted?: boolean;
  activePath?: PathResult | null;
  legendTypeFilter?: string | null;
  focusPulseNodeId?: string | null;
  searchQuery?: string;
  searchMatchedIdSet?: Set<string>;
  selectedNodeIds?: Set<string>;
  highlightDependenciesActive?: boolean;
}

export const FreeGraphCanvas: React.FC<FreeGraphCanvasProps> = ({
  layoutMode,
  assets,
  edges,
  focusId,
  selectedNodeId,
  onSelectNode,
  onSetFocusNode,
  onSimulateChange,
  zoomLevel,
  isPathHighlighted = false,
  activePath = null,
  legendTypeFilter = null,
  focusPulseNodeId = null,
  searchQuery = '',
  searchMatchedIdSet,
  selectedNodeIds,
  highlightDependenciesActive = false
}) => {
  const [simulationSeed, setSimulationSeed] = useState(0);

  // Status visual styles
  const statusStyles: Record<AssetStatus, { border: string; bg: string; dot: string }> = {
    ACTIVE: { border: 'border-slate-800 hover:border-slate-700', bg: 'bg-slate-900/90', dot: 'bg-emerald-400' },
    STALE: { border: 'border-amber-500/50', bg: 'bg-amber-950/25', dot: 'bg-amber-400' },
    PENDING_CHANGE: { border: 'border-yellow-500/50', bg: 'bg-yellow-950/20', dot: 'bg-yellow-400' },
    UNMANAGED: { border: 'border-rose-500/60', bg: 'bg-rose-950/30', dot: 'bg-rose-400' },
    DEPRECATED: { border: 'border-slate-700 opacity-60', bg: 'bg-slate-950', dot: 'bg-slate-500' },
    DRAFT: { border: 'border-blue-500/40 border-dashed', bg: 'bg-blue-950/20', dot: 'bg-blue-400' }
  };

  // Node type icon
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'TABLE': return Database;
      case 'VIEW': return Eye;
      case 'API': return Globe;
      case 'JOB': return Cpu;
      case 'METRIC': return Binary;
      default: return Layers;
    }
  };

  // Canvas bounds based on layout mode
  const canvasWidth = layoutMode === 'RADIAL' ? 1800 : 1600;
  const canvasHeight = layoutMode === 'RADIAL' ? 1500 : 1000;

  // Calculate layout coordinates
  const layoutData = useMemo(() => {
    if (layoutMode === 'RADIAL') {
      return calculateRadialLayout(focusId, assets, edges, canvasWidth, canvasHeight);
    } else {
      // Force-directed layout
      return calculateForceDirectedLayout(assets, edges, canvasWidth, canvasHeight);
    }
  }, [layoutMode, focusId, assets, edges, simulationSeed, canvasWidth, canvasHeight]);

  // Map of node coordinates
  const nodeCoords = layoutData.nodes;

  // Render SVG connecting lines between nodes
  const edgeElements = useMemo(() => {
    return edges.map(edge => {
      const u = nodeCoords.get(edge.from);
      const v = nodeCoords.get(edge.to);
      if (!u || !v) return null;

      // Card center offsets
      const cardHalfW = 100;
      const cardHalfH = 36;

      const fromX = u.x;
      const fromY = u.y;
      const toX = v.x;
      const toY = v.y;

      const isShortestPathEdge = isPathHighlighted && activePath?.found && activePath.direction === 'FORWARD'
        ? activePath.steps.some((st, i) => i < activePath.steps.length - 1 && st.asset.id === edge.from && activePath.steps[i + 1].asset.id === edge.to)
        : false;

      const isCritical = edge.isCriticalPath;
      const isInferred = edge.confidence < 90;
      // Cross-source relations (multi-source layer import) are highlighted in teal
      const isCrossSource = edge.source === 'CROSS_SOURCE' || edge.source === 'ETL_PARSER';

      const isInternalSubsetEdge = Boolean(
        highlightDependenciesActive && selectedNodeIds && selectedNodeIds.has(edge.from) && selectedNodeIds.has(edge.to)
      );
      const isBoundarySubsetEdge = Boolean(
        highlightDependenciesActive && selectedNodeIds && (selectedNodeIds.has(edge.from) || selectedNodeIds.has(edge.to))
      );

      // Quadratic/Cubic Bezier curve control points
      const dx = toX - fromX;
      const dy = toY - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const curvature = Math.min(60, dist * 0.15);

      // Offset normal perpendicular to line
      const nx = -dy / (dist || 1);
      const ny = dx / (dist || 1);
      const ctrlX = (fromX + toX) / 2 + nx * curvature * 0.4;
      const ctrlY = (fromY + toY) / 2 + ny * curvature * 0.4;

      const strokeColor = isShortestPathEdge
        ? '#06b6d4'
        : isInternalSubsetEdge
        ? '#c084fc'
        : isBoundarySubsetEdge
        ? '#a855f7'
        : isCritical
        ? '#f43f5e'
        : isCrossSource
        ? '#14b8a6'
        : isInferred
        ? '#f59e0b'
        : '#6366f1';

      const strokeWidth = isShortestPathEdge ? 3.5 : isInternalSubsetEdge ? 3.5 : isBoundarySubsetEdge ? 2.5 : isCritical ? 2.5 : 1.5;
      const strokeDasharray = isInferred && !isInternalSubsetEdge ? '4 4' : undefined;

      return (
        <g key={edge.id} className="transition-all duration-300">
          {/* Glowing shadow line for shortest path or subset highlight */}
          {(isShortestPathEdge || isInternalSubsetEdge) && (
            <path
              d={`M ${fromX} ${fromY} Q ${ctrlX} ${ctrlY} ${toX} ${toY}`}
              fill="none"
              stroke={isShortestPathEdge ? '#06b6d4' : '#c084fc'}
              strokeWidth={8}
              strokeOpacity={0.35}
              strokeLinecap="round"
            />
          )}

          {/* Main Curve Line */}
          <path
            d={`M ${fromX} ${fromY} Q ${ctrlX} ${ctrlY} ${toX} ${toY}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeOpacity={isShortestPathEdge || isInternalSubsetEdge ? 1 : isCritical || isBoundarySubsetEdge ? 0.9 : 0.6}
            markerEnd={isShortestPathEdge ? 'url(#arrow-shortest)' : isInternalSubsetEdge ? 'url(#arrow-subset)' : isCritical ? 'url(#arrow-critical)' : isCrossSource ? 'url(#arrow-crosssource)' : isInferred ? 'url(#arrow-inferred)' : 'url(#arrow-standard)'}
          />
        </g>
      );
    });
  }, [edges, nodeCoords, isPathHighlighted, activePath]);

  return (
    <div 
      style={{ 
        width: `${canvasWidth}px`, 
        height: `${canvasHeight}px`, 
        transform: `scale(${zoomLevel})`, 
        transformOrigin: 'top left' 
      }} 
      className="relative transition-transform duration-300 ease-out select-none bg-radial from-slate-900/60 via-slate-950 to-slate-950"
    >
      {/* Background SVG Grid & Orbits */}
      <svg 
        width={canvasWidth} 
        height={canvasHeight} 
        className="absolute inset-0 pointer-events-none z-0"
      >
        <defs>
          {/* Arrow markers */}
          <marker id="arrow-standard" markerWidth="8" markerHeight="8" refX="28" refY="4" orient="auto">
            <polygon points="0 1, 8 4, 0 7" fill="#6366f1" />
          </marker>
          <marker id="arrow-critical" markerWidth="8" markerHeight="8" refX="28" refY="4" orient="auto">
            <polygon points="0 1, 8 4, 0 7" fill="#f43f5e" />
          </marker>
          <marker id="arrow-inferred" markerWidth="8" markerHeight="8" refX="28" refY="4" orient="auto">
            <polygon points="0 1, 8 4, 0 7" fill="#f59e0b" />
          </marker>
          <marker id="arrow-crosssource" markerWidth="8" markerHeight="8" refX="28" refY="4" orient="auto">
            <polygon points="0 1, 8 4, 0 7" fill="#14b8a6" />
          </marker>
          <marker id="arrow-shortest" markerWidth="10" markerHeight="10" refX="30" refY="5" orient="auto">
            <polygon points="0 2, 10 5, 0 8" fill="#06b6d4" />
          </marker>
          <marker id="arrow-subset" markerWidth="10" markerHeight="10" refX="28" refY="5" orient="auto">
            <polygon points="0 2, 10 5, 0 8" fill="#c084fc" />
          </marker>

          {/* Background dot pattern */}
          <pattern id="dot-pattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#334155" opacity="0.3" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#dot-pattern)" />

        {/* Radial Orbit Rings & Guides */}
        {layoutData.type === 'RADIAL' && (
          <g>
            {/* Axis crosshair guidelines */}
            <line 
              x1={layoutData.centerX - 750} 
              y1={layoutData.centerY} 
              x2={layoutData.centerX + 750} 
              y2={layoutData.centerY} 
              stroke="#334155" 
              strokeDasharray="4 6" 
              strokeOpacity={0.4} 
            />
            <line 
              x1={layoutData.centerX} 
              y1={layoutData.centerY - 700} 
              x2={layoutData.centerX} 
              y2={layoutData.centerY + 700} 
              stroke="#334155" 
              strokeDasharray="4 6" 
              strokeOpacity={0.4} 
            />

            {/* Concentric Orbit Circles */}
            {layoutData.rings.filter(r => r.radius > 0).map((ring, idx) => (
              <g key={ring.hop}>
                <circle
                  cx={layoutData.centerX}
                  cy={layoutData.centerY}
                  r={ring.radius}
                  fill="none"
                  stroke={idx === 0 ? '#6366f1' : '#334155'}
                  strokeWidth={idx === 0 ? 1.5 : 1}
                  strokeDasharray="6 8"
                  strokeOpacity={0.5}
                />
                {/* Orbit Label */}
                <text
                  x={layoutData.centerX + 15}
                  y={layoutData.centerY - ring.radius + 16}
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="monospace"
                  opacity={0.7}
                >
                  {ring.label} (R={ring.radius}px)
                </text>
              </g>
            ))}

            {/* Direction labels on canvas */}
            <text
              x={layoutData.centerX - 520}
              y={layoutData.centerY - 20}
              fill="#38bdf8"
              fontSize="12"
              fontWeight="bold"
              fontFamily="monospace"
              opacity={0.8}
            >
              ← 上游数据来源 (Upstream Sources)
            </text>
            <text
              x={layoutData.centerX + 260}
              y={layoutData.centerY - 20}
              fill="#818cf8"
              fontSize="12"
              fontWeight="bold"
              fontFamily="monospace"
              opacity={0.8}
            >
              下游应用消费 (Downstream Consumers) →
            </text>
          </g>
        )}

        {/* Connecting Edges */}
        {edgeElements}
      </svg>

      {/* Floating Canvas Mode Header Badge */}
      <div className="absolute top-4 left-6 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3.5 py-1.5 rounded-xl shadow-lg text-xs">
        <div className="flex items-center gap-2">
          {layoutMode === 'RADIAL' ? (
            <Crosshair className="w-4 h-4 text-cyan-400 animate-pulse" />
          ) : (
            <Network className="w-4 h-4 text-indigo-400" />
          )}
          <span className="font-semibold text-white">
            {layoutMode === 'RADIAL' ? '放射同心圆极坐标布局 (Radial Concentric)' : '力导向物理聚类拓扑 (Force-Directed)'}
          </span>
        </div>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400 text-[11px]">
          {layoutMode === 'RADIAL'
            ? '以核心资产为靶心，向外多圈辐射展示 1跳/2跳/3跳 上下游关系'
            : '通过库仑斥力与弹簧引力自动聚类，连线越紧密物理距离越近'}
        </span>

        {layoutMode === 'FORCE_DIRECTED' && (
          <button
            onClick={() => setSimulationSeed(prev => prev + 1)}
            className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 transition text-[11px]"
            title="重新进行弹簧-电荷物理场平衡模拟"
          >
            <RotateCcw className="w-3 h-3" />
            <span>重新平衡物理场</span>
          </button>
        )}
      </div>

      {/* Render Node Cards positioned absolutely in 2D space */}
      {assets.map(asset => {
        const pos = nodeCoords.get(asset.id);
        if (!pos) return null;

        const isCenter = pos.isCenter;
        const isSelected = selectedNodeId === asset.id;
        const isFocused = focusId === asset.id;
        const style = statusStyles[asset.status] || statusStyles.ACTIVE;
        const Icon = getNodeIcon(asset.type);

        // Shortest path step
        const stepOnPath = isPathHighlighted && activePath?.found && activePath.direction === 'FORWARD'
          ? activePath.steps.find(s => s.asset.id === asset.id)
          : null;
        const isOnPath = Boolean(stepOnPath);

        // Type filter logic
        const isTypeFiltered = legendTypeFilter !== null;
        const isTypeMatched = !isTypeFiltered || asset.type === legendTypeFilter;
        const isLegendHighlighted = isTypeFiltered && isTypeMatched;

        // Search match logic
        const isSearchQueryActive = Boolean(searchQuery && searchQuery.trim());
        const isSearchMatched = isSearchQueryActive && (searchMatchedIdSet ? searchMatchedIdSet.has(asset.id) : false);
        const isSearchDimmed = isSearchQueryActive && !isSearchMatched;

        const isDimmed = (isPathHighlighted && activePath?.found && activePath.direction === 'FORWARD' && !isOnPath) 
          || (isTypeFiltered && !isTypeMatched)
          || isSearchDimmed;

        const isMultiSelected = Boolean(selectedNodeIds && selectedNodeIds.has(asset.id));

        // Card width ~ 200px, height ~ 84px
        const cardWidth = isCenter ? 230 : 204;
        const cardLeft = pos.x - cardWidth / 2;
        const cardTop = pos.y - 42;

        return (
          <div
            key={asset.id}
            onClick={(e) => onSelectNode(asset.id, e)}
            style={{
              position: 'absolute',
              left: `${cardLeft}px`,
              top: `${cardTop}px`,
              width: `${cardWidth}px`,
              zIndex: isCenter ? 30 : isOnPath ? 25 : isMultiSelected ? 24 : isSearchMatched ? 22 : isSelected ? 20 : 10
            }}
            className={`group rounded-xl border p-2.5 transition-all duration-200 cursor-pointer shadow-md backdrop-blur-md ${style.border} ${style.bg} ${
              focusPulseNodeId === asset.id
                ? 'ring-4 ring-cyan-400 border-cyan-400 shadow-2xl shadow-cyan-500/50 scale-[1.06] bg-slate-900'
                : isMultiSelected
                ? 'ring-4 ring-purple-500 border-purple-400 shadow-2xl shadow-purple-500/40 scale-[1.05] z-30 bg-purple-950/40'
                : isSearchMatched
                ? 'ring-4 ring-amber-400 border-amber-400 shadow-2xl shadow-amber-500/40 scale-[1.04] z-25 bg-slate-900'
                : isCenter
                ? 'ring-4 ring-indigo-500/80 border-indigo-400 shadow-2xl shadow-indigo-500/30 scale-[1.05] bg-slate-900'
                : isOnPath
                ? 'ring-2 ring-cyan-400 border-cyan-400 shadow-xl shadow-cyan-500/25 scale-[1.03] bg-slate-900'
                : isLegendHighlighted
                ? 'ring-2 ring-indigo-400 border-indigo-400 shadow-xl shadow-indigo-500/30 scale-[1.03] bg-slate-900'
                : isSelected
                ? 'ring-2 ring-indigo-500 shadow-indigo-500/20 shadow-lg scale-[1.02]'
                : isDimmed
                ? 'opacity-25 grayscale hover:opacity-80'
                : 'hover:border-slate-600 hover:scale-[1.02]'
            }`}
          >
            {/* Auto-Center Radar Beacon Animation */}
            {focusPulseNodeId === asset.id && (
              <>
                <span className="absolute -inset-2.5 rounded-2xl border-2 border-cyan-400 animate-ping pointer-events-none opacity-80 z-30" />
                <span className="absolute -inset-1 rounded-xl ring-4 ring-cyan-500/50 animate-pulse pointer-events-none z-30" />
              </>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-1 mb-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                  <span className="font-mono font-bold text-xs text-white truncate max-w-[110px]" title={asset.name}>
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
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {asset.displayTitle}
                </div>
              </div>

              {/* Hop badge or Center Core tag */}
              {isCenter ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500 text-white font-bold font-mono shrink-0 shadow-sm">
                  靶心
                </span>
              ) : pos.hop !== undefined ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono shrink-0">
                  {pos.hop}跳
                </span>
              ) : null}
            </div>

            {/* Meta Row */}
            <div className="flex items-center justify-between text-[10px] bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800/80 mb-1">
              <span className="text-slate-400">{asset.layer}</span>
              <span className="font-mono text-emerald-400">{asset.confidence}%</span>
              <span className="text-slate-400">{asset.downstreamCount}依赖</span>
            </div>

            {/* Quick Actions hover strip */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
              <span className="text-slate-500 truncate max-w-[90px]">{asset.owner.split(' ')[0]}</span>

              {layoutMode === 'RADIAL' && !isCenter && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetFocusNode(asset.id);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium hover:underline flex items-center gap-0.5"
                  title="以此资产为中心重新绘制放射同心圆"
                >
                  <Crosshair className="w-2.5 h-2.5" />
                  <span>设为圆心</span>
                </button>
              )}

              {layoutMode === 'FORCE_DIRECTED' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSimulateChange(asset.id);
                  }}
                  className="text-amber-400 hover:text-amber-300 font-medium hover:underline flex items-center gap-0.5"
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span>分析影响</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
