import React from 'react';

/**
 * System initialization wizard - hosts the archify-rendered, three-phase
 * onboarding flow (environment boot -> data onboarding & lineage ->
 * governance verification) as a self-contained static HTML served from
 * /public. The iframe keeps the artifact's native interactions (staged
 * guide views, theme switch, export) instead of re-implementing them.
 */
export const InitWizard: React.FC = () => (
  <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
    <iframe
      title="系统初始化向导"
      src="/system-init-wizard.html"
      className="w-full flex-1 border-0"
    />
  </div>
);
