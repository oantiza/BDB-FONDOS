/**
 * RetroSummaryCards.tsx
 *
 * Summary cards for dry-run results: Total, OK, WARNING, BLOCKED, Sin cambios, Mismatches.
 *
 * SECURITY: Pure presentation component. No Firestore access. No writes.
 */
import React from 'react';
import type { RetroDryRunSummary } from '../../utils/retroParser';

interface Props {
  summary: RetroDryRunSummary;
}

function Card({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'amber' | 'red' | 'slate' | 'blue';
  icon: string;
}) {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className={`border rounded-xl p-4 text-center transition-all hover:shadow-md ${styles[color]}`}>
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

export default function RetroSummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card label="Total filas" value={summary.total} color="blue" icon="📊" />
      <Card label="OK" value={summary.ok} color="emerald" icon="✅" />
      <Card label="Warning" value={summary.warning} color="amber" icon="⚠️" />
      <Card label="Blocked" value={summary.blocked} color="red" icon="🚫" />
      <Card label="Sin cambios" value={summary.unchanged} color="slate" icon="➖" />
      <Card
        label="FE/BE Mismatch"
        value={summary.client_server_normalization_mismatches}
        color={summary.client_server_normalization_mismatches > 0 ? 'red' : 'slate'}
        icon="🔄"
      />
    </div>
  );
}
