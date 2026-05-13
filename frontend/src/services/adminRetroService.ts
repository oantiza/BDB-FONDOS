/**
 * adminRetroService.ts
 *
 * Service layer for the Admin Retrocessions module.
 * Calls backend callable endpoints via Firebase Functions:
 *   - admin_retro_dry_run (read-only preview)
 *   - admin_retro_write   (controlled write to funds_v3, WRITE-MVP-0)
 *
 * Security contract:
 * - NO Firestore direct reads or writes from this module.
 * - NO write operations (setDoc, updateDoc, deleteDoc, writeBatch).
 * - Backend enforces admin auth; this is the frontend convenience layer.
 * - All data is normalized AUTHORITATIVELY by the backend (C.2). Frontend
 *   parsing is informational only.
 * - For writes, the backend re-runs the dry-run pipeline; the client's prior
 *   dry-run result is never the basis for the write decision.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { RetroRow, RetroDryRunResponse } from '../utils/retroParser';

// ---------------------------------------------------------------------------
// Dry-run callable
// ---------------------------------------------------------------------------

interface DryRunPayload {
  rows: Array<{
    isin: string;
    nombre: string;
    retro_raw: string;
    retro_parsed_client: number | null;
    source: 'csv' | 'xlsx';
    cell_internal_value: number | null;
    cell_number_format: string | null;
    row_number: number;
  }>;
  source_filename: string;
  source_encoding?: string;
}

/**
 * Execute a dry-run of retrocession updates via the backend.
 *
 * The backend re-normalizes from retro_raw (C.2), crosses against funds_v3,
 * and returns classified results. This is strictly read-only — no writes.
 *
 * @param rows - Parsed retro rows from the frontend parser
 * @param sourceFilename - Name of the uploaded file
 * @param sourceEncoding - Resolved encoding (for CSV files)
 * @returns Dry-run response with classified results and summary
 */
export async function executeDryRun(
  rows: RetroRow[],
  sourceFilename: string,
  sourceEncoding?: string
): Promise<RetroDryRunResponse> {
  const adminRetroDryRun = httpsCallable<DryRunPayload, RetroDryRunResponse>(
    functions,
    'admin_retro_dry_run'
  );

  const payload: DryRunPayload = {
    rows: rows.map((r) => ({
      isin: r.isin,
      nombre: r.nombre,
      retro_raw: r.retro_raw,
      retro_parsed_client: r.retro_parsed_client,
      source: r.source,
      cell_internal_value: r.cell_internal_value,
      cell_number_format: r.cell_number_format,
      row_number: r.row_number,
    })),
    source_filename: sourceFilename,
    source_encoding: sourceEncoding,
  };

  const result = await adminRetroDryRun(payload);
  return result.data;
}

/**
 * Search for a single fund by ISIN (reuses existing admin_fund_search).
 */
export async function searchFundByISIN(isin: string) {
  const adminFundSearch = httpsCallable<
    { isin: string; limit: number },
    { results: Array<Record<string, unknown>>; count: number }
  >(functions, 'admin_fund_search');

  const result = await adminFundSearch({ isin: isin.toUpperCase(), limit: 1 });
  return result.data.results[0] || null;
}

// ---------------------------------------------------------------------------
// Write callable (WRITE-MVP-0)
// ---------------------------------------------------------------------------

export type RetroWriteSource = 'manual' | 'csv' | 'excel' | 'xlsx';

interface WritePayload {
  rows: Array<{
    isin: string;
    nombre: string;
    retro_raw: string;
    retro_parsed_client: number | null;
    source: 'csv' | 'xlsx';
    cell_internal_value: number | null;
    cell_number_format: string | null;
    row_number: number;
  }>;
  source: RetroWriteSource;
  source_filename: string;
  dry_run_manifest_id: string;
  reason: string;
  confirm: true;
  warning_acks: string[];
}

export interface RetroWriteResponse {
  mode: 'WRITE_EXECUTED' | 'WRITE_EXECUTED_AUDIT_FAILED';
  audit_id: string;
  writes_executed: number;
  writes_failed: number;
  writes_planned: number;
  unchanged_count: number;
  warning_count?: number;
  isins_updated: string[];
  write_failures: Array<{
    isin: string;
    reason: string;
    error?: string;
    manifest_current?: number | null;
    firestore_current?: number | null;
  }>;
  audit_error?: string;
}

/**
 * Apply retrocession updates to funds_v3.
 *
 * The backend re-runs the dry-run pipeline server-side and writes ONLY
 * manual.costs.retrocession. BLOCKED rows abort the batch. WARNING rows
 * must be acknowledged in `warningAcks`. A `reason` (≥3 chars) is required.
 *
 * @returns Write response with audit_id and counters.
 * @throws if the backend rejects (BLOCKED present, missing acks, auth, etc.).
 */
export async function executeWrite(params: {
  rows: RetroRow[];
  source: RetroWriteSource;
  sourceFilename: string;
  dryRunManifestId: string;
  reason: string;
  warningAcks: string[];
}): Promise<RetroWriteResponse> {
  const adminRetroWrite = httpsCallable<WritePayload, RetroWriteResponse>(
    functions,
    'admin_retro_write'
  );

  const payload: WritePayload = {
    rows: params.rows.map((r) => ({
      isin: r.isin,
      nombre: r.nombre,
      retro_raw: r.retro_raw,
      retro_parsed_client: r.retro_parsed_client,
      source: r.source,
      cell_internal_value: r.cell_internal_value,
      cell_number_format: r.cell_number_format,
      row_number: r.row_number,
    })),
    source: params.source,
    source_filename: params.sourceFilename,
    dry_run_manifest_id: params.dryRunManifestId,
    reason: params.reason,
    confirm: true,
    warning_acks: params.warningAcks,
  };

  const result = await adminRetroWrite(payload);
  return result.data;
}
