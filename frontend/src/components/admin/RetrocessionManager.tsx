/**
 * RetrocessionManager.tsx
 *
 * Main retrocession management component for the Admin Console.
 * Replaces the static RetrocessionPanel with an interactive module.
 *
 * Tabs:
 * - Manual: Search fund by ISIN, input new retro, view diff inline
 * - Masiva: Upload CSV/XLSX, parse locally, preview table, dry-run via backend
 *
 * SECURITY:
 * - NO Firestore writes (no setDoc, updateDoc, deleteDoc, writeBatch)
 * - NO direct Firestore access — all data via callable endpoints
 * - Backend is authoritative for normalization (C.2)
 * - Frontend parser is informational only
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  parseFile,
  normalizeRetrocession,
  isValidISIN,
} from '../../utils/retroParser';
import type {
  RetroRow,
  ParseResult,
  RetroDryRunResponse,
  RetroDryRunResult,
} from '../../utils/retroParser';
import { executeDryRun, searchFundByISIN } from '../../services/adminRetroService';
import RetroSummaryCards from './RetroSummaryCards';
import RetroPreviewTable from './RetroPreviewTable';

type TabId = 'manual' | 'bulk';

// ---------------------------------------------------------------------------
// Manual Tab
// ---------------------------------------------------------------------------

function ManualTab() {
  const [isinInput, setIsinInput] = useState('');
  const [fundData, setFundData] = useState<Record<string, unknown> | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [newRetroInput, setNewRetroInput] = useState('');
  const [dryRunResult, setDryRunResult] = useState<RetroDryRunResponse | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunError, setDryRunError] = useState('');

  const handleSearch = useCallback(async () => {
    const trimmed = isinInput.trim().toUpperCase();
    setSearchError('');
    setFundData(null);
    setDryRunResult(null);
    setNewRetroInput('');

    if (!isValidISIN(trimmed)) {
      setSearchError('ISIN inválido. Formato esperado: 2 letras + 9 alfanuméricos + 1 dígito');
      return;
    }

    setSearching(true);
    try {
      const result = await searchFundByISIN(trimmed);
      if (!result) {
        setSearchError(`Fondo no encontrado en funds_v3: ${trimmed}`);
      } else {
        setFundData(result);
      }
    } catch (e) {
      setSearchError(`Error buscando fondo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSearching(false);
    }
  }, [isinInput]);

  const currentRetro = fundData
    ? (fundData as { manual?: { costs?: { retrocession?: number } } })?.manual?.costs?.retrocession ?? null
    : null;

  const newRetroNorm = normalizeRetrocession(newRetroInput || null);

  const handleManualDryRun = useCallback(async () => {
    if (!fundData || newRetroNorm.value === null) return;

    const isin = isinInput.trim().toUpperCase();
    const row: RetroRow = {
      isin,
      nombre: (fundData as { name?: string })?.name || '',
      retro_raw: newRetroInput,
      retro_parsed_client: newRetroNorm.value,
      source: 'csv', // manual entry treated as CSV-like
      cell_internal_value: null,
      cell_number_format: null,
      row_number: 1,
      source_filename: 'manual_entry',
    };

    setDryRunning(true);
    setDryRunError('');
    try {
      const response = await executeDryRun([row], 'manual_entry');
      setDryRunResult(response);
    } catch (e) {
      setDryRunError(`Error en dry-run: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDryRunning(false);
    }
  }, [fundData, newRetroInput, newRetroNorm, isinInput]);

  return (
    <div className="space-y-6">
      {/* ISIN Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Buscar fondo por ISIN
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={isinInput}
            onChange={(e) => setIsinInput(e.target.value.toUpperCase())}
            placeholder="Ej: LU0232524495"
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            maxLength={12}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {searching ? '🔍 Buscando...' : '🔍 Buscar'}
          </button>
        </div>
        {searchError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {searchError}
          </div>
        )}
      </div>

      {/* Fund details + new retro input */}
      {fundData && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
            Fondo encontrado
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">ISIN</span>
              <p className="text-sm font-mono font-medium text-slate-700">
                {(fundData as { isin?: string })?.isin}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Nombre</span>
              <p className="text-sm text-slate-700">
                {(fundData as { name?: string })?.name || '—'}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Retrocesión actual
              </span>
              <p className="text-sm font-mono font-medium text-blue-700">
                {currentRetro !== null ? `${currentRetro.toFixed(4)}%` : 'No definida'}
              </p>
            </div>
          </div>

          {/* New retro input */}
          <div className="border-t border-slate-100 pt-5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
              Nueva retrocesión (dry-run)
            </h4>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 block">
                  Valor (puntos porcentuales)
                </label>
                <input
                  type="text"
                  value={newRetroInput}
                  onChange={(e) => setNewRetroInput(e.target.value)}
                  placeholder="Ej: 0.80 o 0,80%"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleManualDryRun}
                disabled={dryRunning || newRetroNorm.value === null}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {dryRunning ? '⏳ Procesando...' : '🔬 Dry-Run'}
              </button>
            </div>

            {/* Inline validation */}
            {newRetroInput && (
              <div className="mt-2">
                {newRetroNorm.status === 'OK' && (
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 text-xs">✅</span>
                    <span className="text-xs text-emerald-600">
                      Valor: {newRetroNorm.value?.toFixed(4)}%
                      {currentRetro !== null && newRetroNorm.value !== null && (
                        <> — Δ: {((newRetroNorm.value - currentRetro) >= 0 ? '+' : '')}
                        {(newRetroNorm.value - currentRetro).toFixed(4)} pp</>
                      )}
                    </span>
                  </div>
                )}
                {newRetroNorm.status === 'WARNING' && (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                    ⚠️ {newRetroNorm.reason}
                  </div>
                )}
                {newRetroNorm.status === 'INVALID' && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">
                    🚫 {newRetroNorm.reason}
                  </div>
                )}
                {newRetroNorm.status === 'MISSING' && (
                  <div className="text-xs text-slate-400">Introduce un valor</div>
                )}
              </div>
            )}
          </div>

          {dryRunError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {dryRunError}
            </div>
          )}
        </div>
      )}

      {/* Manual dry-run results */}
      {dryRunResult && (
        <div className="space-y-4">
          <RetroSummaryCards summary={dryRunResult.summary} />
          <RetroPreviewTable results={dryRunResult.results} />
          <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
            Manifest ID: <span className="font-mono">{dryRunResult.manifest_id}</span>
            {' · '}Mode: {dryRunResult.mode}
            {' · '}Expira: {dryRunResult.manifest_expires_at}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Tab
// ---------------------------------------------------------------------------

function BulkTab() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [dryRunResult, setDryRunResult] = useState<RetroDryRunResponse | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunError, setDryRunError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setFileName(file.name);
    setParsing(true);
    setParseResult(null);
    setDryRunResult(null);
    setDryRunError('');

    try {
      const result = await parseFile(file);
      setParseResult(result);
    } catch (e) {
      setParseResult({
        rows: [],
        errors: [
          {
            code: 'ERR_PARSE_EXCEPTION',
            message: `Error inesperado: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        warnings: [],
      });
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleBulkDryRun = useCallback(async () => {
    if (!parseResult || parseResult.rows.length === 0) return;

    setDryRunning(true);
    setDryRunError('');
    try {
      const response = await executeDryRun(
        parseResult.rows,
        fileName,
        parseResult.source_encoding
      );
      setDryRunResult(response);
    } catch (e) {
      setDryRunError(`Error en dry-run: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDryRunning(false);
    }
  }, [parseResult, fileName]);

  const handleReset = useCallback(() => {
    setParseResult(null);
    setDryRunResult(null);
    setFileName('');
    setDryRunError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="space-y-6">
      {/* File upload zone */}
      {!parseResult && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileInputChange}
          />
          {parsing ? (
            <div className="text-slate-500">
              <div className="text-4xl mb-3 animate-pulse">⏳</div>
              <p className="text-sm font-medium">Procesando archivo...</p>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3 opacity-60">📁</div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                Arrastrar CSV o XLSX aquí
              </p>
              <p className="text-xs text-slate-400">
                CSV con separador <code className="bg-slate-100 px-1 rounded">;</code> · XLSX primera hoja
              </p>
            </>
          )}
        </div>
      )}

      {/* Parse results */}
      {parseResult && (
        <>
          {/* File info bar */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-lg">📄</span>
              <div>
                <p className="text-sm font-medium text-slate-700">{fileName}</p>
                <p className="text-xs text-slate-400">
                  {parseResult.rows.length} filas parseadas
                  {parseResult.source_encoding && ` · Encoding: ${parseResult.source_encoding}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              ✕ Limpiar
            </button>
          </div>

          {/* Parse errors */}
          {parseResult.errors.length > 0 && (
            <div className="space-y-2">
              {parseResult.errors.map((err, idx) => (
                <div
                  key={idx}
                  className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3"
                >
                  <span className="text-red-500 text-sm mt-0.5">🚫</span>
                  <div>
                    <span className="text-xs font-bold font-mono text-red-700">{err.code}</span>
                    <p className="text-sm text-red-600">{err.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Parse warnings */}
          {parseResult.warnings.length > 0 &&
            parseResult.warnings.map((w, idx) => (
              <div
                key={idx}
                className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700"
              >
                ⚠️ {w}
              </div>
            ))}

          {/* Parsed rows preview */}
          {parseResult.rows.length > 0 && parseResult.errors.length === 0 && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Preview local ({parseResult.rows.length} filas)
                  </h3>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Parsing frontend — pendiente dry-run backend
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-12">#</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">ISIN</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Nombre</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Retro Raw</th>
                        <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Retro Parsed (FE)</th>
                        <th className="text-center px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Origen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {parseResult.rows.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-xs text-slate-400 font-mono">{row.row_number}</td>
                          <td className="px-3 py-2 text-xs font-mono font-medium text-slate-700">{row.isin}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 max-w-[180px] truncate">{row.nombre || '—'}</td>
                          <td className="px-3 py-2 text-xs font-mono text-slate-500">{row.retro_raw || '—'}</td>
                          <td className="px-3 py-2 text-xs text-right font-mono">
                            {row.retro_parsed_client !== null
                              ? <span className="text-blue-600">{row.retro_parsed_client.toFixed(4)}%</span>
                              : <span className="text-red-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-center">
                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                              {row.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parseResult.rows.length > 50 && (
                  <div className="px-5 py-2 bg-slate-50 text-xs text-slate-400 text-center border-t border-slate-200">
                    Mostrando 50 de {parseResult.rows.length} filas
                  </div>
                )}
              </div>

              {/* Dry-run button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBulkDryRun}
                  disabled={dryRunning}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                >
                  {dryRunning ? (
                    <>
                      <span className="animate-pulse">⏳</span>
                      Ejecutando dry-run...
                    </>
                  ) : (
                    <>
                      🔬 Ejecutar Dry-Run ({parseResult.rows.length} filas)
                    </>
                  )}
                </button>
                <span className="text-xs text-slate-400">
                  Read-only — no modifica funds_v3
                </span>
              </div>
            </>
          )}

          {dryRunError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {dryRunError}
            </div>
          )}

          {/* Dry-run results */}
          {dryRunResult && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-2">
                Resultados Dry-Run (backend autoritativo)
              </h3>
              <RetroSummaryCards summary={dryRunResult.summary} />
              <RetroPreviewTable results={dryRunResult.results} />
              <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
                <span>Manifest: <span className="font-mono">{dryRunResult.manifest_id}</span></span>
                <span>Mode: {dryRunResult.mode}</span>
                <span>Expira: {dryRunResult.manifest_expires_at}</span>
                <span>Frase: <span className="font-mono text-[10px]">{dryRunResult.confirmation_phrase_expected}</span></span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'manual', label: 'Carga Manual', icon: '✏️' },
  { id: 'bulk', label: 'Carga Masiva', icon: '📦' },
];

export default function RetrocessionManager() {
  const [activeTab, setActiveTab] = useState<TabId>('manual');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Dry-run banner */}
      <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-blue-500 text-2xl mt-0.5">🔬</div>
        <div>
          <h2 className="text-sm font-bold text-blue-900 tracking-wide uppercase mb-1">
            Módulo Dry-Run
          </h2>
          <p className="text-sm text-blue-800/80 leading-relaxed max-w-3xl">
            Este módulo permite previsualizar cambios de retrocesión antes de escribir.
            Todas las operaciones son <strong>read-only</strong> — el backend normaliza
            autoritativamente y cruza contra funds_v3 sin modificar datos.
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'manual' ? <ManualTab /> : <BulkTab />}

      {/* Security footer */}
      <div className="flex flex-wrap gap-3">
        <SecurityBadge icon="🔒" label="Read-only — 0 writes" />
        <SecurityBadge icon="🔬" label="Backend autoritativo (C.2)" />
        <SecurityBadge icon="📊" label="Canon: % directo, 0 válido" />
        <SecurityBadge icon="🚫" label="No setDoc / updateDoc" />
      </div>
    </div>
  );
}

function SecurityBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {icon} {label}
    </span>
  );
}
