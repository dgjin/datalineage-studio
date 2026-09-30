import React, { useMemo } from 'react';
import type { Asset, LineageEdge } from '../types/lineage';

/**
 * Column-level lineage board (M2 "字段级" granularity view).
 * Renders one mapping card per (source table -> target table) pair; each card draws
 * explicit field-to-field connections so the concrete column relationships are visible
 * on the canvas instead of being folded into aggregated table-level edges.
 *
 * Line style follows the graph legend: solid indigo for confidence >= 90,
 * dashed amber for inferred/expression mappings (< 90).
 */

const ROW_H = 26;
const HEAD_H = 48;
const CARD_W = 560;
const LEFT_TEXT_W = 128;
const PORT_L_X = 140;
const PORT_R_X = 420;
const RIGHT_TEXT_X = PORT_R_X + 10;

interface MappingPair {
  fromCol: string;
  toCol: string;
  confidence: number;
  transformExpr?: string;
}

interface MappingGroup {
  fromId: string;
  toId: string;
  fromName: string;
  fromLayer: string;
  toName: string;
  toLayer: string;
  source: string;
  pairs: MappingPair[];
}

const strokeFor = (confidence: number) => (confidence >= 90 ? '#818cf8' : '#f59e0b');

const MappingCard: React.FC<{ group: MappingGroup; index: number }> = ({ group, index }) => {
  const fromRows = useMemo(() => {
    const map = new Map<string, number>();
    group.pairs.forEach(p => { if (!map.has(p.fromCol)) map.set(p.fromCol, map.size); });
    return map;
  }, [group]);
  const toRows = useMemo(() => {
    const map = new Map<string, number>();
    group.pairs.forEach(p => { if (!map.has(p.toCol)) map.set(p.toCol, map.size); });
    return map;
  }, [group]);

  const rows = Math.max(fromRows.size, toRows.size);
  const svgH = HEAD_H + rows * ROW_H + 16;
  const yOf = (i: number) => HEAD_H + i * ROW_H + ROW_H / 2;
  const arrowId = `col-arrow-${index}`;
  const inferredCount = group.pairs.filter(p => p.confidence < 90).length;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 mb-1 min-w-[560px]">
        <div className="flex items-center gap-1.5 font-mono text-xs min-w-0">
          <span className="text-slate-200 font-bold truncate max-w-[150px]" title={group.fromName}>{group.fromName}</span>
          <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">{group.fromLayer}</span>
          <span className="text-indigo-400 shrink-0">→</span>
          <span className="text-slate-200 font-bold truncate max-w-[150px]" title={group.toName}>{group.toName}</span>
          <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">{group.toLayer}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">{group.source}</span>
          <span className="text-[10px] text-slate-400 font-mono">{group.pairs.length} 条字段映射</span>
        </div>
      </div>
      <div className="text-[9px] text-slate-500 mb-2 min-w-[560px]">
        实线 ≥90% · 虚线 &lt;90%（表达式推断{inferredCount > 0 ? ` · ${inferredCount} 条` : ''}）
      </div>

      {/* Field-to-field mapping canvas */}
      <div className="relative min-w-[560px]" style={{ width: CARD_W, height: svgH }}>
        {/* Column captions */}
        <div className="absolute text-[9px] text-slate-500 font-semibold uppercase tracking-wider" style={{ top: HEAD_H - 16, left: 0, width: LEFT_TEXT_W, textAlign: 'right' }}>源字段</div>
        <div className="absolute text-[9px] text-slate-500 font-semibold uppercase tracking-wider" style={{ top: HEAD_H - 16, left: RIGHT_TEXT_X, width: CARD_W - RIGHT_TEXT_X - 8 }}>目标字段</div>

        {/* Source column labels */}
        {Array.from(fromRows.entries()).map(([col, i]) => (
          <div
            key={`f-${col}`}
            className="absolute text-[10px] font-mono text-slate-300 truncate"
            style={{ top: HEAD_H + i * ROW_H, height: ROW_H, lineHeight: `${ROW_H}px`, left: 0, width: LEFT_TEXT_W, textAlign: 'right' }}
            title={col}
          >
            {col}
          </div>
        ))}
        {/* Target column labels */}
        {Array.from(toRows.entries()).map(([col, i]) => (
          <div
            key={`t-${col}`}
            className="absolute text-[10px] font-mono text-slate-300 truncate"
            style={{ top: HEAD_H + i * ROW_H, height: ROW_H, lineHeight: `${ROW_H}px`, left: RIGHT_TEXT_X, width: CARD_W - RIGHT_TEXT_X - 8 }}
            title={col}
          >
            {col}
          </div>
        ))}

        {/* SVG connections + ports */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={CARD_W}
          height={svgH}
        >
          <defs>
            <marker id={arrowId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <polygon points="0 1, 7 3.5, 0 6" fill="#818cf8" />
            </marker>
          </defs>

          {/* Port dots */}
          {Array.from(fromRows.values()).map(i => (
            <circle key={`pl-${i}`} cx={PORT_L_X} cy={yOf(i)} r={3} fill="#64748b" />
          ))}
          {Array.from(toRows.values()).map(i => (
            <circle key={`pr-${i}`} cx={PORT_R_X} cy={yOf(i)} r={3} fill="#64748b" />
          ))}

          {/* Field-to-field curves */}
          {group.pairs.map((p, pi) => {
            const y1 = yOf(fromRows.get(p.fromCol) ?? 0);
            const y2 = yOf(toRows.get(p.toCol) ?? 0);
            const d = `M ${PORT_L_X + 3} ${y1} C ${PORT_L_X + 90} ${y1}, ${PORT_R_X - 90} ${y2}, ${PORT_R_X - 3} ${y2}`;
            const color = strokeFor(p.confidence);
            return (
              <g key={`c-${pi}`} className="pointer-events-auto">
                <title>
                  {`${p.fromCol} → ${p.toCol} · 置信度 ${p.confidence}%${p.transformExpr ? ` · expr: ${p.transformExpr}` : ''}`}
                </title>
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.6}
                  strokeDasharray={p.confidence < 90 ? '4 4' : undefined}
                  strokeOpacity={0.85}
                  markerEnd={p.confidence >= 90 ? `url(#${arrowId})` : undefined}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const ColumnLineageBoard: React.FC<{ assets: Asset[]; edges: LineageEdge[] }> = ({ assets, edges }) => {
  const groups = useMemo(() => {
    const assetById = new Map(assets.map(a => [a.id, a]));
    const map = new Map<string, MappingGroup>();
    edges.forEach(e => {
      if (e.kind !== 'COLUMN' || !e.fromCol || !e.toCol) return;
      const key = e.from + '|' + e.to;
      let g = map.get(key);
      if (!g) {
        const from = assetById.get(e.from);
        const to = assetById.get(e.to);
        g = {
          fromId: e.from,
          toId: e.to,
          fromName: from?.name ?? e.from,
          fromLayer: from?.layer ?? '-',
          toName: to?.name ?? e.to,
          toLayer: to?.layer ?? '-',
          source: e.source,
          pairs: [],
        };
        map.set(key, g);
      }
      g.pairs.push({ fromCol: e.fromCol, toCol: e.toCol, confidence: e.confidence, transformExpr: e.transformExpr });
    });
    return Array.from(map.values());
  }, [assets, edges]);

  if (groups.length === 0) {
    return (
      <div className="border border-dashed border-slate-700 rounded-xl p-10 text-center text-slate-400 text-xs min-w-[1200px]">
        当前过滤条件下没有列级血缘映射（请确认采集任务已开启血缘发现，或切换到表级视图）
      </div>
    );
  }

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))' }}>
      {groups.map((g, i) => (
        <MappingCard key={g.fromId + '|' + g.toId} group={g} index={i} />
      ))}
    </div>
  );
};
