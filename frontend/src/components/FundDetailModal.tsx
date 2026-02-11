import React from 'react';
import ModalHeader from './common/ModalHeader';
import MetricCard from './common/MetricCard';
import { DataQualityBadge, gradeFundQuality } from './dashboard/DataQualityBadge';
import { REGION_DISPLAY_LABELS } from '../utils/normalizer';

// Lazy load to save bundle size
const HistoricalChartModal = React.lazy(() => import('./modals/HistoricalChartModal'));
const UpdateHistoryModal = React.lazy(() => import('./modals/UpdateHistoryModal'));

interface FundDetailModalProps {
  fund: any;
  onClose: () => void;
}

export default function FundDetailModal({ fund, onClose }: FundDetailModalProps) {
  const [showHistoryChart, setShowHistoryChart] = React.useState(false);
  const [showUpdateModal, setShowUpdateModal] = React.useState(false);

  if (!fund) return null;

  const perf = fund.std_perf || fund.perf || {};
  const extra = fund.std_extra || {};
  const costs = fund.costs || {};
  const holdings = fund.holdings || [];
  const sectors = fund.sectors || [];
  const regions = fund.regions || {};

  // -------------------------
  // Format helpers (0-safe)
  // -------------------------
  const isValidNum = (v: any) => v !== null && v !== undefined && Number.isFinite(Number(v));

  /**
   * Normaliza porcentajes de forma robusta:
   * - 0.012  => 1.2%   (decimal)
   * - 0.75   => 0.75%  (muchas fuentes lo dan así)
   * - 1.2    => 1.2%
   * - 15     => 15%
   *
   * Devuelve el valor en "decimal" (0.012 para 1.2%).
   */
  const normalizePct = (v: any) => {
    if (!isValidNum(v)) return null;
    const n = Number(v);

    // Muy pequeño: normalmente ya viene en decimal (0.012 = 1.2%)
    if (n > 0 && n < 0.1) return n;

    // Rango típico de porcentajes (0.1..100): asumimos que viene en % y lo pasamos a decimal
    if (n >= 0.1 && n <= 100) return n / 100;

    // Si es 0, negativo o valores raros (>100), lo devolvemos tal cual
    return n;
  };

  const pct = (v: any) => {
    const n = normalizePct(v);
    if (!isValidNum(n)) return 'N/A';
    return `${(Number(n) * 100).toFixed(2)}%`;
  };

  const num = (v: any, decimals = 2) => {
    if (!isValidNum(v)) return 'N/A';
    return Number(v).toFixed(decimals);
  };

  // -------------------------
  // Rating Helper
  // -------------------------
  const ratingRaw = Number(
    fund.rating_stars ??
    fund.std_extra?.rating_stars ??
    fund.ms?.rating_stars ??
    fund.rating_overall ??
    0
  );
  const rating = Math.round(Math.max(0, Math.min(5, isValidNum(ratingRaw) ? ratingRaw : 0)));

  const renderStars = (n: number) =>
    Array(5)
      .fill(0)
      .map((_, i) => (
        <span key={i} className={i < n ? 'text-[#D4AF37]' : 'text-slate-200'}>
          ★
        </span>
      ));

  // -------------------------
  // SRRI Helper
  // -------------------------
  const srri = Number(fund.risk_srri) || 0;

  const renderSrri = (val: number) => {
    if (!val || val === 0) return <span className="text-slate-400 font-medium">N/A</span>;

    return (
      <div className="flex items-center gap-1">
        <span
          className={`text-lg font-bold ${val >= 6 ? 'text-[#C0392B]' : val >= 4 ? 'text-[#D35400]' : 'text-[#27AE60]'
            }`}
        >
          {val}
        </span>
        <span className="text-xs text-slate-400">/ 7</span>
      </div>
    );
  };

  // -------------------------
  // Data Quality Helper
  // -------------------------
  const { grade, reason } = gradeFundQuality(fund);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <ModalHeader title={fund.name} icon="📝" onClose={onClose} />

          <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar bg-white">
            {/* Key Metrics */}
            <section>
              <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                Métricas Clave
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Ratio Sharpe" value={num(perf.sharpe)} />
                <MetricCard label="Volatilidad" value={pct(perf.volatility)} />
                <MetricCard label="CAGR 3Y" value={pct(perf.cagr3y)} />
                <MetricCard label="Max Drawdown" value={pct(perf.max_drawdown)} color="text-[#C0392B]" />
              </div>
            </section>

            {/* Fund Info */}
            <section className="grid grid-cols-2 gap-8 border-t border-[#eeeeee] pt-8">
              <InfoRow label="ISIN" value={fund.isin || 'N/A'} />
              <InfoRow label="ISIN" value={fund.isin || 'N/A'} />
              <InfoRow label="Categoría" value={fund.std_type || fund.asset_class || 'N/A'} />
              <InfoRow label="Subcategoría" value={extra.category || fund.category_morningstar || 'N/A'} />
              <InfoRow label="Región Principal" value={extra.regionDetail || fund.primary_region || 'Global'} />
              <InfoRow label="Moneda" value={extra.currency || 'EUR'} />

              {/* Morningstar Rating */}
              <div>
                <div className="text-[10px] text-[#A07147] uppercase font-bold tracking-[0.2em] mb-1">
                  Morningstar Rating
                </div>
                <div className="text-lg flex items-center gap-1">{renderStars(rating)}</div>
              </div>

              {/* Data Quality Badge */}
              <div>
                <div className="text-[10px] text-[#A07147] uppercase font-bold tracking-[0.2em] mb-1">
                  Calidad Datos
                </div>
                <DataQualityBadge grade={grade} reason={reason} />
              </div>
            </section>

            {/* Costs */}
            <section className="border-t border-[#eeeeee] pt-8">
              <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                Estructura de Costes
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <InfoRow label="TER" value={pct(extra.ter ?? costs.ter)} />
                <InfoRow label="Gestión" value={pct(extra.mgmtFee ?? costs.management_fee)} />
              </div>
            </section>

            {/* Geographic Distribution */}
            {regions && Object.keys(regions).length > 0 && (
              <section className="border-t border-[#eeeeee] pt-8">
                <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                  Distribución Geográfica
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(regions)
                    .filter(([_, weight]) => isValidNum(weight) && Number(weight) > 0)
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .map(([region, weight]) => (
                      <div
                        key={region}
                        className="px-3 py-1 bg-white border border-[#eeeeee] flex items-center gap-2"
                      >
                        <span className="text-xs font-bold text-[#2C3E50] uppercase tracking-wider">
                          {REGION_DISPLAY_LABELS[region] || region.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-light text-[#7f8c8d]">|</span>
                        <span className="text-xs font-bold text-[#A07147]">
                          {Number(weight).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Sectors Distribution */}
            {Array.isArray(sectors) && sectors.length > 0 && (
              <section className="border-t border-[#eeeeee] pt-8">
                <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                  Distribución Sectorial
                </h3>
                <div className="flex flex-wrap gap-2">
                  {sectors.slice(0, 10).map((sector: any, i: number) => (
                    <div
                      key={i}
                      className="px-3 py-1 bg-white border border-[#eeeeee] flex items-center gap-2"
                    >
                      <span className="text-xs font-bold text-[#2C3E50] uppercase tracking-wider">
                        {sector.name || sector.sector || '—'}
                      </span>
                      <span className="text-xs font-light text-[#7f8c8d]">|</span>
                      <span className="text-xs font-bold text-[#A07147]">
                        {isValidNum(sector.weight) ? Number(sector.weight).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top Holdings */}
            {Array.isArray(holdings) && holdings.length > 0 && (
              <section className="border-t border-[#eeeeee] pt-8">
                <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                  Principales Posiciones
                </h3>
                <div className="space-y-0 divide-y divide-[#f5f5f5]">
                  {holdings.slice(0, 10).map((h: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-2 hover:bg-[#fcfcfc] transition-colors"
                    >
                      <span className="text-sm font-medium text-[#2C3E50] truncate max-w-[80%]">
                        {h.name || '—'}
                      </span>
                      <span className="font-light text-sm text-[#2C3E50] tabular-nums">
                        {isValidNum(h.weight) ? Number(h.weight).toFixed(2) : '0.00'}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Description */}
            {fund.description && (
              <section className="border-t border-[#eeeeee] pt-8">
                <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                  Objetivo de Inversión
                </h3>
                <p className="text-sm text-[#2C3E50] leading-relaxed font-light italic border-l-2 border-[#A07147] pl-4">
                  "{fund.description}"
                </p>
              </section>
            )}

            {/* Historical Returns (with new Chart Button) */}
            {(fund.returns_history || fund.yearly_returns) && (
              <section className="border-t border-[#eeeeee] pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-light text-[#2C3E50] tracking-tight flex items-center gap-2">
                    Rendimiento Histórico
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowUpdateModal(true)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full hover:bg-slate-200 transition-colors"
                      title="Actualizar datos desde EODHD"
                    >
                      🔄 Actualizar
                    </button>
                    <button
                      onClick={() => setShowHistoryChart(true)}
                      className="text-xs font-bold text-[#003399] hover:text-[#002266] uppercase tracking-wider flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      📈 Ver Gráfico
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {(() => {
                    let history: { year: number; value: number }[] = [];

                    if (fund.returns_history && typeof fund.returns_history === 'object') {
                      history = Object.entries(fund.returns_history)
                        .map(([y, v]) => ({ year: parseInt(y, 10), value: Number(v) }))
                        .filter((x) => !Number.isNaN(x.year) && isValidNum(x.value))
                        .sort((a, b) => b.year - a.year);
                    } else if (Array.isArray(fund.yearly_returns)) {
                      history = fund.yearly_returns
                        .map((x: any) => ({ year: Number(x.year), value: Number(x.return) }))
                        .filter((x: any) => isValidNum(x.year) && isValidNum(x.value))
                        .sort((a: any, b: any) => b.year - a.year);
                    }

                    return history.slice(0, 5).map((h) => (
                      <div key={h.year} className="text-center p-2 border border-[#eeeeee] bg-[#fcfcfc]">
                        <div className="text-[10px] font-bold text-[#A07147] mb-1">{h.year}</div>
                        <div
                          className={`text-sm font-bold ${h.value >= 0 ? 'text-[#2C3E50]' : 'text-[#C0392B]'
                            }`}
                        >
                          {h.value > 0 ? '+' : ''}
                          {h.value.toFixed(2)}%
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </section>
            )}

            {/* Fallback Button for Funds without History Table */}
            {!(fund.returns_history || fund.yearly_returns) && (
              <section className="border-t border-[#eeeeee] pt-8 flex justify-center gap-4">
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-6 py-3 rounded shadow-sm transition-all transform hover:scale-105 flex items-center gap-2"
                >
                  🔄 Actualizar Datos
                </button>
                <button
                  onClick={() => setShowHistoryChart(true)}
                  className="text-sm font-bold text-white bg-[#003399] hover:bg-[#002266] px-6 py-3 rounded shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                >
                  📈 Ver Gráfico Histórico
                </button>
              </section>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-[#eeeeee] flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#f5f5f5] hover:bg-[#e0e0e0] text-[#2C3E50] font-bold text-xs uppercase tracking-[0.1em] transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Historical Chart Modal */}
      {showHistoryChart && (
        <React.Suspense fallback={null}>
          <HistoricalChartModal fund={fund} onClose={() => setShowHistoryChart(false)} />
        </React.Suspense>
      )}
      {showUpdateModal && (
        <React.Suspense fallback={null}>
          <UpdateHistoryModal fund={fund} onClose={() => setShowUpdateModal(false)} />
        </React.Suspense>
      )}
    </>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] text-[#A07147] uppercase font-bold tracking-[0.2em] mb-1">{label}</div>
    <div className="text-base font-medium text-[#2C3E50] truncate leading-tight" title={value}>
      {value}
    </div>
  </div>
);
