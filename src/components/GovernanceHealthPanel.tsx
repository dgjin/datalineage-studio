import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw } from 'lucide-react';
import { dashboardApi } from '../services/api';

/**
 * Governance health badge for an asset (100-point score):
 * owner, contract binding, open quality issues, unresolved changes and
 * zombie-output checks are aggregated by /dashboard/asset-health/{id}.
 */
export const GovernanceHealthPanel: React.FC<{ assetId: string }> = ({ assetId }) => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dashboardApi
      .getAssetHealth(assetId)
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (loading) {
    return (
      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2 text-slate-500">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span className="text-[11px]">正在计算治理健康分...</span>
      </div>
    );
  }
  if (!health) {
    return null;
  }

  const tone =
    health.grade === 'HEALTHY'
      ? { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', bar: 'bg-emerald-500' }
      : health.grade === 'ATTENTION'
        ? { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', bar: 'bg-amber-500' }
        : { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', bar: 'bg-rose-500' };
  const Icon = health.grade === 'HEALTHY' ? ShieldCheck : health.grade === 'ATTENTION' ? ShieldAlert : ShieldX;
  const gradeLabel = health.grade === 'HEALTHY' ? '健康' : health.grade === 'ATTENTION' ? '需关注' : '高风险';

  return (
    <div className={`p-2.5 rounded-lg border ${tone.border} ${tone.bg} space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${tone.text}`} />
          治理体检 (Governance Health)
        </span>
        <span className={`font-mono font-bold text-sm ${tone.text}`}>
          {health.score} 分 · {gradeLabel}
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${tone.bar} rounded-full transition-all`} style={{ width: `${health.score}%` }} />
      </div>
      {health.findings?.length ? (
        <ul className="space-y-1">
          {health.findings.map((f: string, i: number) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-300">
              <span className={`mt-1 w-1 h-1 rounded-full ${tone.bar} shrink-0`} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[10px] text-emerald-300 block">全部治理检查项通过，无风险发现</span>
      )}
    </div>
  );
};

export default GovernanceHealthPanel;
