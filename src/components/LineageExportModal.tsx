import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  FileImage, 
  FileCode, 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  Sun, 
  Moon, 
  CheckCircle2, 
  Clock, 
  FileText 
} from 'lucide-react';
import { Asset, LineageEdge } from '../types/lineage';
import { 
  generateLineageSvg, 
  exportAsSvg, 
  exportAsPng, 
  generateMermaidDsl, 
  ExportOptions 
} from '../utils/lineageExport';

interface LineageExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  edges: LineageEdge[];
  currentSpace: string;
}

export const LineageExportModal: React.FC<LineageExportModalProps> = ({
  isOpen,
  onClose,
  assets,
  edges,
  currentSpace
}) => {
  const [format, setFormat] = useState<'PNG' | 'SVG' | 'MERMAID'>('PNG');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const exportOptions: ExportOptions = useMemo(() => ({
    theme,
    includeLegend,
    includeTitle,
    spaceName: currentSpace === 'all' ? '全域视角 (All Spaces)' : currentSpace,
    watermark: 'DataLineage Studio'
  }), [theme, includeLegend, includeTitle, currentSpace]);

  // Generate SVG on the fly for preview
  const svgString = useMemo(() => {
    return generateLineageSvg(assets, edges, exportOptions);
  }, [assets, edges, exportOptions]);

  // Generate Mermaid DSL
  const mermaidCode = useMemo(() => {
    return generateMermaidDsl(assets, edges);
  }, [assets, edges]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsExporting(true);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `lineage-topology-${currentSpace}-${timestamp}`;

    try {
      if (format === 'SVG') {
        exportAsSvg(svgString, filename);
        setSuccessToast('✓ 矢量图 SVG 已成功导出！');
      } else if (format === 'PNG') {
        await exportAsPng(svgString, filename, 2);
        setSuccessToast('✓ 高清 PNG (2x Retina) 已成功导出！');
      } else if (format === 'MERMAID') {
        const blob = new Blob([mermaidCode], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.mmd`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccessToast('✓ Mermaid 拓扑代码已成功导出！');
      }
    } catch (err) {
      console.error(err);
      alert('导出过程中出现异常，请重试');
    } finally {
      setIsExporting(false);
      setTimeout(() => setSuccessToast(null), 3500);
    }
  };

  const handleCopyMermaid = () => {
    navigator.clipboard?.writeText(mermaidCode);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <FileImage className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                <span>导出数据血缘可视化图谱</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  高清文档交付级
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                支持 2x Retina 高清 PNG、无限缩放矢量 SVG 以及 Markdown 文档适用的 Mermaid DSL 代码
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Format selection */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFormat('PNG')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                format === 'PNG' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>高清 PNG (2x)</span>
            </button>
            <button
              onClick={() => setFormat('SVG')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                format === 'SVG' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>矢量 SVG (无损)</span>
            </button>
            <button
              onClick={() => setFormat('MERMAID')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                format === 'MERMAID' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Mermaid 代码</span>
            </button>
          </div>

          {/* Options for Image Export (SVG & PNG) */}
          {format !== 'MERMAID' && (
            <div className="flex items-center gap-4 text-slate-300">
              {/* Theme toggle */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-2 py-1 rounded-md flex items-center gap-1 transition ${
                    theme === 'dark' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                  title="暗黑主题 (平台默认高质感)"
                >
                  <Moon className="w-3 h-3" />
                  <span>深色</span>
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`px-2 py-1 rounded-md flex items-center gap-1 transition ${
                    theme === 'light' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                  title="亮白主题 (文档打印/白皮书场景)"
                >
                  <Sun className="w-3 h-3" />
                  <span>浅色</span>
                </button>
              </div>

              {/* Include title & legend */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTitle}
                  onChange={(e) => setIncludeTitle(e.target.checked)}
                  className="accent-indigo-600 rounded"
                />
                <span className="text-slate-300">包含标题头</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLegend}
                  onChange={(e) => setIncludeLegend(e.target.checked)}
                  className="accent-indigo-600 rounded"
                />
                <span className="text-slate-300">包含图例</span>
              </label>
            </div>
          )}
        </div>

        {/* Live Preview Area */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 flex flex-col items-center justify-center relative min-h-[360px]">
          {successToast && (
            <div className="absolute top-4 right-4 bg-emerald-950 border border-emerald-500 text-emerald-200 px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-2xl z-20 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successToast}</span>
            </div>
          )}

          {format === 'MERMAID' ? (
            <div className="w-full h-full max-h-[380px] flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Mermaid 架构拓扑定义 (可直接贴入 Markdown 文档或 GitHub PR 描述):</span>
                <button
                  onClick={handleCopyMermaid}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-xs font-semibold"
                >
                  {copiedMermaid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMermaid ? '已复制到剪贴板' : '复制代码'}</span>
                </button>
              </div>
              <pre className="flex-1 p-4 bg-slate-900 rounded-xl text-xs font-mono text-cyan-300 overflow-auto border border-slate-800 leading-relaxed shadow-inner">
                {mermaidCode}
              </pre>
            </div>
          ) : (
            <div className="w-full h-full max-h-[420px] overflow-auto flex items-center justify-center p-2 rounded-xl border border-slate-800/80 bg-slate-900/50">
              {/* Scaled SVG Preview */}
              <div 
                className="max-w-full max-h-full overflow-auto rounded-lg shadow-2xl ring-1 ring-slate-800"
                dangerouslySetInnerHTML={{ __html: svgString }} 
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <span>导出规格:</span>
            <span className="font-mono text-slate-100 font-medium">
              {format === 'PNG' ? 'PNG @ 2x (~3000x1600px 高分辨率)' : format === 'SVG' ? 'SVG Vector (独立矢量 XML 无依赖)' : 'Markdown .mmd'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              取消
            </button>
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>正在生成渲染文件...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>立即导出 {format} 图像</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
