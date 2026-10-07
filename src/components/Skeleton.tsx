import React from 'react';

/** Pulsing placeholder block shared by all loading skeletons. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-slate-800/60 ${className}`} />
);

/** Row-shaped skeleton mirroring the M1 asset catalog table during the first sync. */
export const AssetListSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div className="p-4 space-y-3" aria-label="资产列表加载中" data-testid="asset-list-skeleton">
    <div className="flex items-center gap-3 px-1 pb-1">
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-3 w-14 ml-auto" />
      <Skeleton className="h-3 w-14" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 border border-slate-800/60 rounded-lg px-4 py-3">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-3.5 w-56 max-w-full" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <Skeleton className="h-5 w-12 shrink-0" />
        <Skeleton className="h-5 w-20 shrink-0" />
        <Skeleton className="h-3 w-16 shrink-0" />
        <Skeleton className="h-1.5 w-12 rounded-full shrink-0" />
      </div>
    ))}
  </div>
);

/** Swimlane card-and-wire skeleton for the M2 lineage canvas during the first sync. */
export const GraphSkeleton: React.FC = () => (
  <div aria-label="血缘图谱加载中" data-testid="graph-skeleton">
    <div className="grid grid-cols-5 gap-6 min-w-[1200px] mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-b-2 border-slate-800 pb-2 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-5 gap-6 min-w-[1200px]">
      {Array.from({ length: 5 }).map((_, col) => (
        <div key={col} className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-3 space-y-4 min-h-[420px]">
          {Array.from({ length: col % 2 === 0 ? 3 : 2 }).map((_, row) => (
            <div key={row} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-6 w-full rounded-md" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
    <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
      <span className="inline-block w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
      正在从后端加载血缘数据…
    </div>
  </div>
);
