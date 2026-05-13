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
import {
  executeDryRun,
  executeWrite,
  searchFundByISIN,
} from '../../services/adminRetroService';
import type {
  RetroWriteResponse,
  RetroWriteSource,
} from '../../services/adminRetroService';
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
  const [dryRunRows, setDryRunRows] = useState<RetroRow[]>([]);
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
      setDryRunRows([row]);
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
          <WritePanel
            dryRunResult={dryRunResult}
            rows={dryRunRows}
            source="manual"
            sourceFilename="manual_entry"
          />
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
          {dryRunResult && parseResult && (
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
              <WritePanel
                dryRunResult={dryRunResult}
                rows={parseResult.rows}
                source={inferBulkSource(fileName)}
                sourceFilename={fileName}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function inferBulkSource(fileName: string): RetroWriteSource {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel';
  return 'csv';
}

// ---------------------------------------------------------------------------
// WritePanel — Apply retrocesiones (WRITE-MVP-0)
// ---------------------------------------------------------------------------
//
// Renders after a successful dry-run. Shows an "Aplicar retrocesiones" button
// gated by:
//   - dryRunResult exists
//   - no BLOCKED results
//   - at least one OK or WARNING result that would produce a write
//   - no prior successful write for this dry-run (audit_id present locks it)
//
// Opens a confirmation modal with motivo (required), summary, retro=0 callouts,
// big-change list, per-warning ack checkboxes, and a final confirmation checkbox.
// After success: shows the audit_id banner and disables further writes.

export interface WritePanelProps {
  dryRunResult: RetroDryRunResponse;
  rows: RetroRow[];
  source: RetroWriteSource;
  sourceFilename: string;
}

export function WritePanel({
  dryRunResult,
  rows,
  source,
  sourceFilename,
}: WritePanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [ackAllWarnings, setAckAllWarnings] = useState(false);
  const [perIsinAck, setPerIsinAck] = useState<Set<string>>(new Set());
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [writeResult, setWriteResult] = useState<RetroWriteResponse | null>(null);

  const okResults = dryRunResult.results.filter((r) => r.status === 'OK');
  const warningResults = dryRunResult.results.filter((r) => r.status === 'WARNING');
  const blockedResults = dryRunResult.results.filter((r) => r.status === 'BLOCKED');
  const unchangedResults = dryRunResult.results.filter((r) => r.status === 'UNCHANGED');
  const writesPlanned = okResults.length + warningResults.length;

  const zeroRetroIsins = [...okResults, ...warningResults].filter(
    (r) => r.new_retro !== null && Math.abs(r.new_retro) < 1e-6
  );
  const bigChangeIsins = [...okResults, ...warningResults].filter(
    (r) =>
      r.delta !== null &&
      Math.abs(r.delta) >= 0.5
  );

  const allWarningsAcked =
    warningResults.length === 0 ||
    ackAllWarnings ||
    warningResults.every((r) => perIsinAck.has(r.isin));

  const applyDisabled =
    writing ||
    writeResult !== null ||
    blockedResults.length > 0 ||
    writesPlanned === 0;

  const submitDisabled =
    writing ||
    reason.trim().length < 3 ||
    !confirmCheck ||
    !allWarningsAcked;

  const openModal = useCallback(() => {
    setShowModal(true);
    setWriteError('');
  }, []);

  const closeModal = useCallback(() => {
    if (writing) return;
    setShowModal(false);
  }, [writing]);

  const togglePerIsinAck = useCallback((isin: string) => {
    setPerIsinAck((prev) => {
      const next = new Set(prev);
      if (next.has(isin)) next.delete(isin);
      else next.add(isin);
      return next;
    });
  }, []);

  const handleApply = useCallback(async () => {
    if (submitDisabled) return;

    const warningAcks = ackAllWarnings
      ? warningResults.map((r) => r.isin)
      : Array.from(perIsinAck);

    setWriting(true);
    setWriteError('');
    try {
      const response = await executeWrite({
        rows,
        source,
        sourceFilename,
        dryRunManifestId: dryRunResult.manifest_id,
        reason: reason.trim(),
        warningAcks,
      });
      setWriteResult(response);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWriteError(`Error al aplicar: ${msg}`);
    } finally {
      setWriting(false);
    }
  }, [
    submitDisabled,
    rows,
    source,
    sourceFilename,
    dryRunResult.manifest_id,
    reason,
    ackAllWarnings,
    perIsinAck,
    warningResults,
  ]);

  return (
    <div className="space-y-4">
      {/* Apply button row */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          aria-label="Aplicar retrocesiones"
          onClick={openModal}
          disabled={applyDisabled}
          className="px-6 py-3 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
        >
          {writeResult ? '✅ Escritura aplicada' : `💾 Aplicar retrocesiones (${writesPlanned})`}
        </button>
        {blockedResults.length > 0 && (
          <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
            🚫 {blockedResults.length} filas BLOCKED — corrige antes de aplicar
          </span>
        )}
        {blockedResults.length === 0 && writesPlanned === 0 && !writeResult && (
          <span className="text-xs text-slate-500">
            No hay cambios aplicables ({unchangedResults.length} sin cambio)
          </span>
        )}
      </div>

      {/* Success banner */}
      {writeResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm">
            <span className="text-lg">✅</span>
            Escritura completada — modo: {writeResult.mode}
          </div>
          <div className="text-xs text-emerald-700 space-y-1 font-mono">
            <div>
              audit_id: <span className="font-bold">{writeResult.audit_id}</span>
            </div>
            <div>
              Ejecutados: {writeResult.writes_executed} / {writeResult.writes_planned}
              {writeResult.writes_failed > 0 && (
                <> · Fallos: {writeResult.writes_failed}</>
              )}
              {writeResult.unchanged_count > 0 && (
                <> · Sin cambio: {writeResult.unchanged_count}</>
              )}
            </div>
            {writeResult.audit_error && (
              <div className="text-amber-700">
                ⚠️ Audit log error: {writeResult.audit_error}
              </div>
            )}
          </div>
          {writeResult.isins_updated.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-emerald-700 font-medium">
                ISINs actualizados ({writeResult.isins_updated.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto bg-white border border-emerald-200 rounded p-2 font-mono text-[11px] leading-relaxed">
                {writeResult.isins_updated.join(', ')}
              </div>
            </details>
          )}
          {writeResult.write_failures.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-amber-700 font-medium">
                Fallos por ISIN ({writeResult.write_failures.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto bg-white border border-amber-200 rounded p-2 font-mono text-[11px] leading-relaxed">
                {writeResult.write_failures.map((f, i) => (
                  <div key={i}>
                    {f.isin} — {f.reason}
                    {f.error && <> ({f.error})</>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar aplicación de retrocesiones"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-800">
                Confirmar aplicación de retrocesiones
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={closeModal}
                disabled={writing}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-1">
                <div className="font-medium text-slate-700">
                  Resumen del lote
                </div>
                <div className="text-xs text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
                  <div>Origen: {source}</div>
                  <div>Archivo: {sourceFilename || '—'}</div>
                  <div>OK: {okResults.length}</div>
                  <div>WARNING: {warningResults.length}</div>
                  <div>Sin cambio: {unchangedResults.length}</div>
                  <div>BLOCKED: {blockedResults.length}</div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 mt-1">
                    A escribir: <span className="font-bold text-slate-800">{writesPlanned}</span> filas
                  </div>
                </div>
              </div>

              {/* Zero retro callout */}
              {zeroRetroIsins.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                  <div className="font-medium text-blue-800 mb-1">
                    🟦 Retrocesiones a 0 ({zeroRetroIsins.length})
                  </div>
                  <div className="font-mono text-[11px] text-blue-700 max-h-20 overflow-y-auto">
                    {zeroRetroIsins.map((r) => r.isin).join(', ')}
                  </div>
                </div>
              )}

              {/* Big changes */}
              {bigChangeIsins.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                  <div className="font-medium text-amber-800 mb-1">
                    ⚠️ Cambios grandes (|Δ| ≥ 0.50 pp): {bigChangeIsins.length}
                  </div>
                  <div className="font-mono text-[11px] text-amber-700 max-h-24 overflow-y-auto leading-relaxed">
                    {bigChangeIsins.map((r) => (
                      <div key={r.isin}>
                        {r.isin}: {r.current_retro?.toFixed(4) ?? '—'} →{' '}
                        {r.new_retro?.toFixed(4) ?? '—'} (Δ {r.delta?.toFixed(4)})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning acks */}
              {warningResults.length > 0 && (
                <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-3 text-xs space-y-2">
                  <div className="font-medium text-amber-900">
                    ⚠️ Filas con WARNING ({warningResults.length}) — acuse explícito requerido
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ackAllWarnings}
                      onChange={(e) => setAckAllWarnings(e.target.checked)}
                      aria-label="Acepto todos los warnings"
                    />
                    <span className="text-amber-900 font-medium">
                      Acepto todos los warnings
                    </span>
                  </label>
                  {!ackAllWarnings && (
                    <div className="space-y-1 max-h-40 overflow-y-auto pt-1">
                      {warningResults.map((r) => (
                        <label
                          key={r.isin}
                          className="flex items-start gap-2 cursor-pointer hover:bg-white/60 px-2 py-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={perIsinAck.has(r.isin)}
                            onChange={() => togglePerIsinAck(r.isin)}
                            aria-label={`Acuse warning ${r.isin}`}
                          />
                          <span className="font-mono text-[11px]">
                            <span className="font-bold">{r.isin}</span>
                            {' — '}
                            {r.reason}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reason input */}
              <div>
                <label
                  htmlFor="retro-write-reason"
                  className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block"
                >
                  Motivo de la carga <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="retro-write-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Actualización mensual mayo 2026 — fuente Morningstar"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  maxLength={2000}
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Mínimo 3 caracteres. Se guarda en el audit log junto a tu email y timestamp.
                </div>
              </div>

              {/* Final confirmation */}
              <label className="flex items-start gap-2 cursor-pointer bg-red-50/60 border border-red-200 rounded-lg p-3">
                <input
                  type="checkbox"
                  checked={confirmCheck}
                  onChange={(e) => setConfirmCheck(e.target.checked)}
                  aria-label="Confirmo aplicar retrocesiones"
                  className="mt-1"
                />
                <span className="text-sm text-red-900">
                  <span className="font-bold">Confirmo aplicar retrocesiones</span>
                  <span className="block text-xs text-red-700 mt-0.5">
                    Esta acción escribe en <code className="font-mono bg-white px-1 rounded">funds_v3</code>{' '}
                    el campo <code className="font-mono bg-white px-1 rounded">manual.costs.retrocession</code>{' '}
                    para los ISINs indicados. No se tocan otros campos. Se registra audit log.
                  </span>
                </span>
              </label>

              {writeError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {writeError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 sticky bottom-0">
              <button
                type="button"
                onClick={closeModal}
                disabled={writing}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={submitDisabled}
                aria-label="Confirmar y aplicar"
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {writing ? '⏳ Aplicando...' : `Aplicar (${writesPlanned})`}
              </button>
            </div>
          </div>
        </div>
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
      {/* Module banner */}
      <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-blue-500 text-2xl mt-0.5">🔬</div>
        <div>
          <h2 className="text-sm font-bold text-blue-900 tracking-wide uppercase mb-1">
            Módulo Retrocesiones (Dry-Run + Aplicar)
          </h2>
          <p className="text-sm text-blue-800/80 leading-relaxed max-w-3xl">
            Flujo en dos fases: primero ejecuta un <strong>dry-run</strong> read-only
            (backend normaliza y clasifica contra funds_v3). Después, si no hay filas
            BLOCKED, puedes pulsar <strong>Aplicar retrocesiones</strong> con motivo,
            acuse de warnings y confirmación explícita; el backend escribe únicamente
            <code className="font-mono bg-white/60 px-1 rounded">manual.costs.retrocession</code>
            {' '}y registra audit log con before/after.
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
        <SecurityBadge icon="🔬" label="Backend autoritativo (C.2)" />
        <SecurityBadge icon="📊" label="Canon: % directo, 0 válido" />
        <SecurityBadge icon="🚫" label="FE no escribe Firestore directo" />
        <SecurityBadge icon="📋" label="Audit log por escritura" />
        <SecurityBadge icon="🛡️" label="Solo campo manual.costs.retrocession" />
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
