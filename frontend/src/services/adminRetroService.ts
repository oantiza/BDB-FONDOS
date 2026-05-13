/**
 * adminRetroService.ts
 *
 * Service layer for the Admin Retrocessions dry-run module.
 * Calls backend callable endpoint (admin_retro_dry_run) via Firebase Functions.
 *
 * Security contract:
 * - NO Firestore direct reads or writes from this module.
 * - NO write operations (setDoc, updateDoc, deleteDoc, writeBatch).
 * - Backend enforces admin auth; this is the frontend convenience layer.
 * - All data is normalized authoritatively by the backend (C.2).
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
