import React from 'react';

export type Grade = 'A' | 'B' | 'C';

interface GradeResult {
  grade: Grade;
  reason: string;
}

interface PortfolioGradeResult {
  grade: Grade;
  reason: string;
  pA: number;
  pB: number;
  pC: number;
}

/**
 * Grades a single fund based on its data quality flags.
 * A: Perfect data
 * B: Missing history or standard performance issues
 * C: Invalid metrics
 */
export function gradeFundQuality(fund: any): GradeResult {
  // 1. Critical Errors -> C
  if (fund.metrics_invalid === true) {
    return { grade: 'C', reason: 'Métricas detectadas como inválidas o incoherentes.' };
  }

  // 2. Warnings / Missing Data -> B
  const stdPerfOk = fund.std_perf_ok ?? fund.data_quality?.std_perf_ok ?? true;
  // History OK: treat as "Validated". If missing, it's just unvalidated, not necessarily "broken".
  const historyOk = fund.history_ok ?? fund.data_quality?.history_ok ?? true;

  // Has History: ONLY complain if explicitly FALSE. If undefined/null, assume it might exist but we don't know (don't penalize yet or treat as unverified)
  const hasHistory = fund.has_history ?? fund.data_quality?.has_history;

  const isExplicitlyNoHistory = hasHistory === false;
  const isUnvalidated = !historyOk;

  if (!stdPerfOk || isExplicitlyNoHistory || isUnvalidated) {
    const reasons: string[] = [];
    if (!stdPerfOk) reasons.push('Std Perf issues');
    if (isExplicitlyNoHistory) reasons.push('No historical data');
    else if (isUnvalidated) reasons.push('History unvalidated'); // Softer message than "integrity issues"

    return { grade: 'B', reason: `Datos parciales: ${reasons.join(', ')}` };
  }

  // 3. Default -> A
  return { grade: 'A', reason: 'Datos completos y verificados.' };
}

/**
 * Grades a portfolio based on weight-weighted average of fund grades.
 * C > 20% weight -> C
 * B > 30% weight -> B
 * else -> A
 */
export function gradePortfolioQuality(portfolio: any[]): PortfolioGradeResult {
  if (!portfolio || portfolio.length === 0) {
    return { grade: 'A', reason: 'Cartera vacía', pA: 0, pB: 0, pC: 0 };
  }

  let totalWeight = 0;
  let wA = 0;
  let wB = 0;
  let wC = 0;

  portfolio.forEach((item) => {
    const wRaw = item.weight ?? item.peso ?? item.pct ?? 0;
    const wNum = Number(wRaw);
    const w = wNum > 1 ? wNum / 100 : wNum;

    if (!Number.isFinite(w) || w <= 0) return; // skip invalid/zero weights
    totalWeight += w;

    const { grade } = gradeFundQuality(item);
    if (grade === 'A') wA += w;
    else if (grade === 'B') wB += w;
    else wC += w;
  });

  const safeTotal = totalWeight || 1; // Avoid division by zero
  const pA = wA / safeTotal;
  const pB = wB / safeTotal;
  const pC = wC / safeTotal;

  if (pC > 0.2) {
    return {
      grade: 'C',
      reason: `>20% de la cartera tiene calidad de datos baja (${(pC * 100).toFixed(0)}%).`,
      pA,
      pB,
      pC,
    };
  }
  if (pB > 0.3) {
    return {
      grade: 'B',
      reason: `>30% de la cartera tiene datos parciales (${(pB * 100).toFixed(0)}%).`,
      pA,
      pB,
      pC,
    };
  }

  return { grade: 'A', reason: 'Cartera con alta calidad de datos.', pA, pB, pC };
}

interface DataQualityBadgeProps {
  grade: Grade;
  reason?: string;
  compact?: boolean;
  className?: string;
}

export const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({
  grade,
  reason,
  compact = false,
  className = '',
}) => {
  const styles = {
    A: 'bg-[#e6f4ea] text-[#1e8e3e] border-[#ceead6]',
    B: 'bg-[#fef7e0] text-[#f9ab00] border-[#feefc3]',
    C: 'bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]',
  };

  const label = { A: 'Alta', B: 'Media', C: 'Baja' }[grade];

  return (
    <div
      className={`inline-flex items-center justify-center border rounded px-2 py-0.5 text-xs font-medium cursor-help transition-colors ${styles[grade]} ${className}`}
      title={reason}
    >
      <span className="font-bold mr-1">{grade}</span>
      {!compact && <span className="opacity-90 not-italic">{label}</span>}
    </div>
  );
};
