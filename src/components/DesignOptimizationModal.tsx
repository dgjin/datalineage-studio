import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  AlertTriangle, 
  Cpu, 
  Binary, 
  FileCode, 
  TrendingUp, 
  Copy, 
  Check 
} from 'lucide-react';

interface DesignOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesignOptimizationModal: React.FC<DesignOptimizationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const optimizationSections = [
    {
      title: '一、图谱内核与大规模渲染架构优化 (Graph Core & Large Graph Performance)',
      items: [
        {
          point: '语义缩放与分层折叠 (Semantic Zooming & Clustering)',
          current: '原设计在节点 > 2000 时强制切换为路径列表模式，用户容易失去全景拓扑感。',
          optimized: '引入双层拓扑渲染：宏观缩放比例（Zoom < 0.6）下自动将同域节点聚合为“数据域气泡节点”（如“CRM 域 128 表”），平滑放大后逐步渐显表级与字段端口级（Level-of-Detail 架构），避免直接截断全貌。'
        },
        {
          point: '字段端口锚点与变换语义可视化 (Port-level Pinning & Transform Badges)',
          current: '字段级血缘如果全量连线容易形成视觉蜘蛛网（Hairball）。',
          optimized: '为表节点两侧设计专用输入/输出引脚（Ports），并在连线上动态标注变换类型徽标：`[AGG]`、`[DIRECT]`、`[UDF]`、`[FILTER]`，悬停时仅高亮当前字段的传递微子图。'
        }
      ]
    },
    {
      title: '二、影响分析闭环与智能熔断优化 (Impact Engine & Blast Radius Optimization)',
      items: [
        {
          point: '波及深度指数三维量化模型 (Blast Radius 3D Scoring)',
          current: '原方案主要依据拓扑跳数与影响资产数量进行简单分级。',
          optimized: '升级为三维量化公式：`Score = w1 × 拓扑跳数衰减权重 + w2 × 下游北极星指标等级(P0/P1/P2) + w3 × 生产API/报表SLA访问热度`。综合计算 0~100 分，超过 80 分触发硬熔断。'
        },
        {
          point: '自动向前兼容缓解视图补丁 (Auto-Mitigation View Generation)',
          current: '原方案仅给出文本建议（如“建议通知下游修改”）。',
          optimized: '系统在检出破坏性改动（如 DROP COLUMN）时，自动生成包含平滑过渡桩的 `CREATE OR REPLACE VIEW ...` 向前兼容视图 DDL，并提供双写迁移模板，工程师一键复制即可部署，大幅降低协调阻力。'
        }
      ]
    },
    {
      title: '三、生产未纳管“暗改”闭环体验优化 (Unmanaged Drift to Git MR Loop)',
      items: [
        {
          point: '生产 DDL 逆向契约补丁与一键提 PR (Reverse Contract Patch to Git MR)',
          current: '发现生产暗改后，如果仅提示人工去改 Git，用户常因流程繁琐而拖延。',
          optimized: '本平台在捕获 CDC / 探针 DDL 差异后，利用 AST 逆向解析器将表差异直接转为规范的契约 YAML 差异，并提供【一键创建 Git MR】按钮（对接 GitLab/Gitea/GitHub API），自动指派架构师审查，将纠正成本降到趋近于零。'
        }
      ]
    },
    {
      title: '四、指标中心与物理字段三级穿透 (Metric 3-Level Deep Tracing & AST Parser)',
      items: [
        {
          point: '公式 Token 与血缘拓扑联动高亮 (Formula Token to Column Highlighting)',
          current: '口径卡与物理字段为两套独立区块。',
          optimized: '用户在指标卡点击公式中任意变量（如 `total_trade_amt_30d`），右侧物理字段与血缘图谱立即联动高亮其对应的存储表与物理列，实现真正的“看口径即见物理落点”。'
        },
        {
          point: '口径变更历史数据可比性硬断点标识 (Comparability Breakpoint)',
          current: '指标口径调整容易导致历史跨期分析失真。',
          optimized: '发布新指标版本时，若修改过滤条件或计算逻辑，强制标识“是否破坏历史可比性”，并在报表端展示告警标记，防止业务误用。'
        }
      ]
    },
    {
      title: '五、规则校验中心沙箱与试运行 (Validation Engine & Dry-Run Safety)',
      items: [
        {
          point: '规则全量元数据试运行沙箱 (Dry-Run Preview)',
          current: '新配置规则如果直接启用，可能造成“上线即全屏报错”的告警疲劳。',
          optimized: '在规则管理提供“试运行（Dry-Run）”按钮，对全域存量元数据先进行离线扫描并列出命中清单，确认影响面可控后再正式启用生效。'
        },
        {
          point: '问题台账双向强绑定 (Asset-Issue Bidirectional Binding)',
          current: '核对报告反映以往问题登记与具体指标表存在断链。',
          optimized: '台账录入强制选择资产 ID 结构化对象，修复报告 R10 所述断链，实现从问题直达血缘。'
        }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>针对《数据血缘管理应用详细设计》的系统级深度优化建议</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  架构师高阶演进方案
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                基于贵方设计文档，从图计算性能、自动化阻断闭环、暗改治理、指标穿透到规则沙箱的 5 大维度演进升级
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {optimizationSections.map((sec, idx) => (
            <div key={idx} className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
              <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>{sec.title}</span>
              </h3>

              <div className="space-y-3">
                {sec.items.map((item, iIdx) => (
                  <div key={iIdx} className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                    <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span>{item.point}</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-slate-950 border border-slate-800/80 text-slate-400">
                        <span className="font-bold text-amber-400/90 block mb-0.5">当前设计基础:</span>
                        {item.current}
                      </div>
                      <div className="p-2 rounded bg-indigo-950/30 border border-indigo-500/30 text-indigo-200">
                        <span className="font-bold text-cyan-300 block mb-0.5">进一步优化演进:</span>
                        {item.optimized}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            上述 5 大演进建议已在本平台界面中完全交互化落地演示。
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
          >
            在系统中体验运行效果
          </button>
        </div>
      </div>
    </div>
  );
};
