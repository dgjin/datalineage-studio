import React, { useState, useMemo } from 'react';
import { 
  X, 
  Camera, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  CheckCircle2, 
  Layers, 
  GitFork, 
  ShieldAlert, 
  Sparkles, 
  Clock, 
  ArrowRight,
  Database,
  ExternalLink
} from 'lucide-react';
import { Asset, LineageEdge } from '../types/lineage';
import { exportAsPng, exportAsSvg, generateLineageSvg } from '../utils/lineageExport';

interface SubsetSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: Asset[];
  subsetEdges: LineageEdge[];
  currentSpace?: string;
  onOpenFullExport?: () => void;
}

export const SubsetSnapshotModal: React.FC<SubsetSnapshotModalProps> = ({
  isOpen,
  onClose,
  selectedAssets,
  subsetEdges,
  currentSpace = 'crm',
  onOpenFullExport
}) => {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const snapshotTimestamp = useMemo(() => {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }, []);

  const snapshotId = useMemo(() => {
    return `SNAP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }, []);

  // Layer breakdown
  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedAssets.forEach(a => {
      counts[a.layer] = (counts[a.layer] || 0) + 1;
    });
    return counts;
  }, [selectedAssets]);

  // Generate Markdown snapshot report
  const markdownReport = useMemo(() => {
    let md = `# 数据血缘子集架构快照 (Data Lineage Subset Snapshot)\n\n`;
    md += `- **快照编号**: \`${snapshotId}\`\n`;
    md += `- **生成时间**: \`${snapshotTimestamp}\`\n`;
    md += `- **业务空间**: \`${currentSpace.toUpperCase()}\`\n`;
    md += `- **节点数量**: ${selectedAssets.length} 个资产\n`;
    md += `- **内部链路**: ${subsetEdges.length} 条拓扑连线\n\n`;

    md += `## 1. 包含资产列表\n\n`;
    md += `| 资产名称 | 类型 | 分层 | 负责人 | 置信度 | 状态 |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    selectedAssets.forEach(a => {
      md += `| \`${a.name}\` | ${a.type} | ${a.layer} | ${a.owner} | ${a.confidence}% | ${a.status} |\n`;
    });

    md += `\n## 2. 内部血缘关联关系\n\n`;
    if (subsetEdges.length === 0) {
      md += `*选中子集节点之间无直接单跳依赖，属于并行或跨域资产。*\n`;
    } else {
      md += `| 起点 (Upstream) | 终点 (Downstream) | 连线类型 | 置信度 | 关键路径 |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      subsetEdges.forEach(e => {
        const fromAsset = selectedAssets.find(a => a.id === e.from);
        const toAsset = selectedAssets.find(a => a.id === e.to);
        md += `| \`${fromAsset?.name || e.from}\` | \`${toAsset?.name || e.to}\` | ${e.kind} | ${e.confidence}% | ${e.isCriticalPath ? '是 (关键路径)' : '否'} |\n`;
      });
    }

    md += `\n---\n*由 DataLineage Studio 自动生成并导出归档。*`;
    return md;
  }, [selectedAssets, subsetEdges, snapshotId, snapshotTimestamp, currentSpace]);

  // Quick download image of the subset
  const handleDownloadImage = async (format: 'png' | 'svg') => {
    setIsExporting(true);
    try {
      const filename = `lineage_subset_${snapshotId}_${format}`;
      const svgContent = generateLineageSvg(selectedAssets, subsetEdges, {
        theme: 'dark',
        includeLegend: true,
        includeTitle: true,
        spaceName: currentSpace === 'all' ? '全域视图' : currentSpace,
      });
      if (format === 'png') {
        await exportAsPng(svgContent, filename, 2);
      } else {
        exportAsSvg(svgContent, filename);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard?.writeText(markdownReport);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopyJson = () => {
    const payload = {
      snapshotId,
      timestamp: snapshotTimestamp,
      space: currentSpace,
      totalAssets: selectedAssets.length,
      totalEdges: subsetEdges.length,
      assets: selectedAssets.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        layer: a.layer,
        owner: a.owner,
        confidence: a.confidence
      })),
      edges: subsetEdges.map(e => ({
        id: e.id,
        from: e.from,
        to: e.to,
        kind: e.kind,
        confidence: e.confidence,
        isCriticalPath: e.isCriticalPath
      }))
    };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        style={{ boxShadow: '0 25px 50px -12px rgba(168, 85, 247, 0.25)' }}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-b border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300">
              <Camera className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">选中资产子图快照 (Lineage Subset Snapshot)</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  {snapshotId}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>生成时间: {snapshotTimestamp}</span>
                <span>｜</span>
                <span className="text-purple-300 font-semibold">{selectedAssets.length} 个节点</span>
                <span>·</span>
                <span className="text-cyan-300 font-semibold">{subsetEdges.length} 条关联边</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400">已选资产节点</span>
              <div className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <span>{selectedAssets.length}</span>
                <span className="text-[10px] font-normal text-slate-500 font-sans">个实体</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400">内部连通链路</span>
              <div className="text-lg font-bold text-purple-400 font-mono flex items-center gap-2">
                <span>{subsetEdges.length}</span>
                <span className="text-[10px] font-normal text-slate-500 font-sans">条拓扑边</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400">跨越数仓分层</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(layerCounts).map(([layer, count]) => (
                  <span key={layer} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {layer}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Assets List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>包含的资产明细 ({selectedAssets.length})</span>
              </span>
              <span className="font-mono text-slate-500">已按层级归类</span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/60">
              {selectedAssets.map(a => (
                <div key={a.id} className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-900/60 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {a.layer}
                    </span>
                    <span className="font-mono font-bold text-white text-xs truncate max-w-[200px]" title={a.name}>
                      {a.name}
                    </span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {a.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0 font-mono">
                    <span>{a.owner}</span>
                    <span className="text-emerald-400">{a.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Markdown Preview Strip */}
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>自动生成的工程文档快照预览 (Markdown Preview)</span>
            </span>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {markdownReport}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium cursor-pointer"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedMd ? '已复制 Markdown' : '复制 Markdown 报告'}</span>
            </button>

            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium cursor-pointer"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedJson ? '已复制 JSON' : '复制 JSON 快照'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadImage('svg')}
              disabled={isExporting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>导出 SVG 矢量图</span>
            </button>

            <button
              onClick={() => handleDownloadImage('png')}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition shadow-md shadow-purple-500/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>{isExporting ? '正在生成...' : '下载 2x 高清 PNG 图片'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
