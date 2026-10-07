import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Send,
  X,
  Hash,
  Search,
  Layers3,
} from 'lucide-react';
import { standardApi } from '../../services/api';

type TabKey = 'STANDARDS' | 'GLOSSARY' | 'CODES';

/**
 * M12 数据标准中枢 - the central "标准设计/管理/维护" loop:
 * naming/coding/metric/domain standards, the glossary of naming roots and
 * business terms, and reference code dictionaries, plus the 一键命名校验
 * that feeds violations into quality issues.
 */
export const M12StandardsHub: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('STANDARDS');
  const [standards, setStandards] = useState<any[]>([]);
  const [glossary, setGlossary] = useState<any[]>([]);
  const [codeSets, setCodeSets] = useState<any[]>([]);
  const [activeCodeSet, setActiveCodeSet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [modal, setModal] = useState<TabKey | null>(null);
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [std, glo, sets] = await Promise.all([
        standardApi.list(),
        standardApi.listGlossary(),
        standardApi.listCodeSets(),
      ]);
      setStandards(std);
      setGlossary(glo);
      setCodeSets(sets);
      if (!activeCodeSet && sets.length > 0) {
        setActiveCodeSet(sets[0].codeSet);
      }
    } finally {
      setLoading(false);
    }
  }, [activeCodeSet]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runNamingCheck = async () => {
    setCheckResult(null);
    try {
      const report = await standardApi.namingCheck();
      setCheckResult(
        `已校验 ${report.checked} 项资产，命名违规资产 ${report.violationAssets} 项` +
          (report.violationAssets > 0 ? '（已自动生成质量问题，可在 M7 校验中心查看）' : '（全部符合已发布命名标准）')
      );
      load();
    } catch (e: any) {
      setCheckResult(`校验失败: ${e.message}`);
    }
  };

  const publishStandard = async (id: string) => {
    try {
      await standardApi.publish(id);
      load();
    } catch (e: any) {
      alert(`发布失败: ${e.message}`);
    }
  };

  const removeStandard = async (id: string) => {
    await standardApi.remove(id);
    load();
  };

  const activeSet = codeSets.find((s) => s.codeSet === activeCodeSet);
  const filteredGlossary = keyword.trim()
    ? glossary.filter(
        (g) =>
          g.term?.includes(keyword) ||
          g.abbr?.toLowerCase().includes(keyword.toLowerCase()) ||
          g.definition?.includes(keyword)
      )
    : glossary;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>M12 数据标准中枢</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            标准设计 / 管理 / 维护中枢：命名与编码标准、业务词根、参考数据字典；校验结果自动回写质量问题形成闭环
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runNamingCheck}
            className="px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-2"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>执行命名校验</span>
          </button>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {checkResult && (
        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{checkResult}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 text-xs font-medium">
        {[
          { id: 'STANDARDS' as TabKey, label: `数据标准 (${standards.length})`, icon: ShieldCheck },
          { id: 'GLOSSARY' as TabKey, label: `术语词根 (${glossary.length})`, icon: BookOpen },
          { id: 'CODES' as TabKey, label: `编码字典 (${codeSets.length} 个编码集)`, icon: Hash },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2 px-3.5 border-b-2 flex items-center gap-1.5 transition ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Standards */}
      {tab === 'STANDARDS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              已发布标准在采集/校验流程中自动生效；命名类标准命中会生成质量问题
            </span>
            <button
              onClick={() => setModal('STANDARDS')}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> 新建标准
            </button>
          </div>
          {standards.length === 0 ? (
            <EmptyHint text="暂无数据标准，点击「新建标准」创建第一条命名/编码/指标口径/业务域标准" />
          ) : (
            standards.map((std) => (
              <div key={std.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-indigo-400 shrink-0">{std.code}</span>
                    <span className="font-semibold text-slate-100 truncate">{std.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">{std.type}</span>
                    <StatusBadge status={std.status} />
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        std.severity === 'P0'
                          ? 'bg-rose-500/20 text-rose-300'
                          : std.severity === 'P1'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {std.severity}
                    </span>
                  </div>
                </div>
                {std.ruleExpr && (
                  <pre className="px-2.5 py-1.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono text-cyan-300 overflow-x-auto">
                    {std.ruleExpr}
                  </pre>
                )}
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    责任: {std.owner || '-'} ｜ 命中违规: <strong className="text-amber-400">{std.hitCount || 0}</strong> 次
                    {std.example && <span className="pl-2">示例: <span className="font-mono text-slate-300">{std.example}</span></span>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {std.status !== 'PUBLISHED' && (
                      <button
                        onClick={() => publishStandard(std.id)}
                        className="px-2 py-0.5 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> 发布
                      </button>
                    )}
                    <button
                      onClick={() => removeStandard(std.id)}
                      className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: Glossary */}
      {tab === 'GLOSSARY' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索术语 / 词根 / 定义..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
              />
            </div>
            <button
              onClick={() => setModal('GLOSSARY')}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> 新建词根
            </button>
          </div>
          {filteredGlossary.length === 0 ? (
            <EmptyHint text="暂无术语词根。词根用于统一字段命名（如 amt=金额、cnt=数量、dt=日期）" />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="px-3 py-2 font-semibold">词根</th>
                    <th className="px-3 py-2 font-semibold">业务术语</th>
                    <th className="px-3 py-2 font-semibold">类别</th>
                    <th className="px-3 py-2 font-semibold">业务域</th>
                    <th className="px-3 py-2 font-semibold">定义与用法</th>
                    <th className="px-3 py-2 font-semibold">同义词</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGlossary.map((g) => (
                    <tr key={g.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-950/50">
                      <td className="px-3 py-2">
                        <span className="font-mono font-bold text-cyan-300">{g.abbr}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-200">{g.term}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{g.category}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{g.domain || '-'}</td>
                      <td className="px-3 py-2 text-slate-400 max-w-[260px]">{g.definition}</td>
                      <td className="px-3 py-2 text-slate-500 text-[10px]">{(g.synonyms || []).join('、') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: Reference codes */}
      {tab === 'CODES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">编码集</span>
              <button
                onClick={() => setModal('CODES')}
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> 新增编码
              </button>
            </div>
            {codeSets.length === 0 ? (
              <EmptyHint text="暂无编码集。参考数据字典用于统一下游枚举值语义（如订单状态 PAID/REFUNDED）" />
            ) : (
              codeSets.map((s) => (
                <button
                  key={s.codeSet}
                  onClick={() => setActiveCodeSet(s.codeSet)}
                  className={`w-full text-left p-2.5 rounded-lg border transition ${
                    activeCodeSet === s.codeSet
                      ? 'bg-indigo-500/10 border-indigo-500/40'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-200">{s.codeSet}</span>
                    <span className="text-[10px] text-slate-400">{s.count} 项</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block pt-0.5">{s.setName}</span>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-2">
            {activeSet ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    {activeSet.setName} <span className="font-mono text-[10px] text-slate-500">({activeSet.codeSet})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{activeSet.count} 个编码值</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-left">
                      <th className="px-3 py-2 font-semibold">编码值</th>
                      <th className="px-3 py-2 font-semibold">业务含义</th>
                      <th className="px-3 py-2 font-semibold">排序</th>
                      <th className="px-3 py-2 font-semibold">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeSet.values || []).map((v: any) => (
                      <tr key={v.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-950/50">
                        <td className="px-3 py-2 font-mono text-cyan-300">{v.codeValue}</td>
                        <td className="px-3 py-2 text-slate-200">{v.meaning}</td>
                        <td className="px-3 py-2 text-slate-400 font-mono">{v.sortOrder}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            v.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl p-8">
                选择左侧编码集查看明细
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {modal === 'STANDARDS' && (
        <StandardModal
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            await standardApi.create(payload);
            setModal(null);
            load();
          }}
        />
      )}
      {modal === 'GLOSSARY' && (
        <GlossaryModal
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            await standardApi.createGlossary(payload);
            setModal(null);
            load();
          }}
        />
      )}
      {modal === 'CODES' && (
        <CodeModal
          defaultSet={activeCodeSet || ''}
          setName={activeSet?.setName || ''}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            await standardApi.createCode(payload);
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
};

// ---- Small building blocks ----

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls =
    status === 'PUBLISHED'
      ? 'bg-emerald-500/20 text-emerald-300'
      : status === 'IN_REVIEW'
        ? 'bg-amber-500/20 text-amber-300'
        : status === 'DEPRECATED'
          ? 'bg-slate-700 text-slate-400'
          : 'bg-slate-800 text-slate-400';
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cls}`}>{status}</span>;
};

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div className="p-6 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">{text}</div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">{label}</label>
    {children}
  </div>
);

const inputCls =
  'w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60';

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title, onClose, children,
}) => (
  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
          <Layers3 className="w-4 h-4 text-indigo-400" />
          {title}
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const StandardModal: React.FC<{ onClose: () => void; onSubmit: (p: any) => Promise<void> }> = ({
  onClose, onSubmit,
}) => {
  const [form, setForm] = useState({
    code: 'STD-NAMING-',
    name: '',
    type: 'NAMING',
    domain: '数仓',
    ruleExpr: '^(ods|dwd|dws|ads|app)_[a-z][a-z0-9]*(_[a-z0-9]+)*$',
    severity: 'P1',
    owner: '',
    example: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.code || !form.name) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell title="新建数据标准" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="标准编码">
          <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field label="类型">
          <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="NAMING">命名标准</option>
            <option value="CODING">编码标准</option>
            <option value="METRIC">指标口径</option>
            <option value="DOMAIN">业务域</option>
          </select>
        </Field>
      </div>
      <Field label="标准名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：ODS 层表命名规范" />
      </Field>
      <Field label="规则表达式（正则，命名/编码标准用于自动校验）">
        <textarea rows={2} className={`${inputCls} font-mono`} value={form.ruleExpr} onChange={(e) => setForm({ ...form, ruleExpr: e.target.value })} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="严重级">
          <select className={inputCls} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
          </select>
        </Field>
        <Field label="业务域">
          <input className={inputCls} value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
        </Field>
        <Field label="责任人">
          <input className={inputCls} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        </Field>
      </div>
      <Field label="示例">
        <input className={inputCls} value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} placeholder="ods_orders / dwd_order_detail" />
      </Field>
      <Field label="说明">
        <textarea rows={2} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">取消</button>
        <button
          onClick={submit}
          disabled={saving || !form.name}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold"
        >
          {saving ? '保存中...' : '创建标准（DRAFT）'}
        </button>
      </div>
    </ModalShell>
  );
};

const GlossaryModal: React.FC<{ onClose: () => void; onSubmit: (p: any) => Promise<void> }> = ({
  onClose, onSubmit,
}) => {
  const [form, setForm] = useState({
    abbr: '',
    term: '',
    category: 'ROOT',
    domain: '数仓',
    definition: '',
    synonyms: '',
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.abbr || !form.term) return;
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        synonyms: form.synonyms ? form.synonyms.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
        status: 'PUBLISHED',
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell title="新建词根 / 业务术语" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="命名词根（英文缩写）">
          <input className={`${inputCls} font-mono`} value={form.abbr} onChange={(e) => setForm({ ...form, abbr: e.target.value })} placeholder="amt" />
        </Field>
        <Field label="业务术语">
          <input className={inputCls} value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="金额" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="类别">
          <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="ROOT">命名词根</option>
            <option value="BUSINESS">业务术语</option>
            <option value="TECHNICAL">技术术语</option>
          </select>
        </Field>
        <Field label="业务域">
          <input className={inputCls} value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
        </Field>
      </div>
      <Field label="定义与用法">
        <textarea rows={2} className={inputCls} value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} placeholder="用于金额类字段，如 order_amt / total_amt" />
      </Field>
      <Field label="同义词（逗号分隔）">
        <input className={inputCls} value={form.synonyms} onChange={(e) => setForm({ ...form, synonyms: e.target.value })} placeholder="amount, 交易金额" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">取消</button>
        <button
          onClick={submit}
          disabled={saving || !form.abbr || !form.term}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold"
        >
          {saving ? '保存中...' : '创建词根'}
        </button>
      </div>
    </ModalShell>
  );
};

const CodeModal: React.FC<{
  defaultSet: string;
  setName: string;
  onClose: () => void;
  onSubmit: (p: any) => Promise<void>;
}> = ({ defaultSet, setName, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    codeSet: defaultSet,
    setName,
    codeValue: '',
    meaning: '',
    sortOrder: 10,
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.codeSet || !form.codeValue) return;
    setSaving(true);
    try {
      await onSubmit({ ...form, sortOrder: Number(form.sortOrder) || 0 });
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell title="新增参考编码" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="编码集">
          <input className={`${inputCls} font-mono`} value={form.codeSet} onChange={(e) => setForm({ ...form, codeSet: e.target.value })} placeholder="ORDER_STATUS" />
        </Field>
        <Field label="编码集名称">
          <input className={inputCls} value={form.setName} onChange={(e) => setForm({ ...form, setName: e.target.value })} placeholder="订单状态" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="编码值">
          <input className={`${inputCls} font-mono`} value={form.codeValue} onChange={(e) => setForm({ ...form, codeValue: e.target.value })} placeholder="PAID" />
        </Field>
        <Field label="业务含义">
          <input className={inputCls} value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} placeholder="已支付" />
        </Field>
      </div>
      <Field label="排序">
        <input type="number" className={inputCls} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">取消</button>
        <button
          onClick={submit}
          disabled={saving || !form.codeSet || !form.codeValue}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold"
        >
          {saving ? '保存中...' : '新增编码'}
        </button>
      </div>
    </ModalShell>
  );
};

export default M12StandardsHub;
