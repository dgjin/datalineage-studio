import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional section label shown in the fallback (e.g. the active module key). */
  label?: string;
  /** Wrapper classes for the fallback panel; defaults to filling a flex parent. */
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that isolates a crashed subtree (single module or the
 * whole shell) and offers a retry without white-screening the app. Remount
 * with a changing key (e.g. key={activeTab}) to auto-reset on navigation.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] subtree crashed:', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { label, className = 'flex-1' } = this.props;
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              模块渲染异常{label ? ` · ${label}` : ''}
            </h3>
            <p className="text-xs text-slate-400 mt-1.5">
              该区域发生未知错误，已被错误边界隔离，其他模块不受影响。可点击重试，或切换到其他模块后返回。
            </p>
          </div>
          <pre className="text-[10px] text-left text-rose-300/80 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-auto max-h-28 whitespace-pre-wrap break-all">
            {this.state.error?.message || 'Unknown rendering error'}
          </pre>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重试渲染
          </button>
        </div>
      </div>
    );
  }
}
