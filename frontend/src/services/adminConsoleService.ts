/**
 * adminConsoleService.ts
 * 
 * Read-only service layer for the Admin Console.
 * Calls backend callable endpoints (admin_fund_search) via Firebase Functions.
 * 
 * Security contract:
 * - NO Firestore direct reads or writes from this module.
 * - NO write operations (setDoc, updateDoc, deleteDoc, writeBatch).
 * - Backend enforces admin auth; this is the frontend convenience layer.
 * - All data is sanitized by the backend before reaching this module.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// ---------------------------------------------------------------------------
// Types — mirror the backend sanitized response shape
// ---------------------------------------------------------------------------

export interface AdminFundResult {
  isin: string;
  name: string;
  asset_type?: string;
  classification_v2?: {
    asset_type?: string;
    asset_subtype?: string;
    risk_bucket?: string;
    classification_confidence?: number;
    commercial_type?: string;
    region_primary?: string;
    compatible_profiles?: number[];
    warnings?: string[];
  };
  manual?: {
    costs?: {
      retrocession?: number;
      ter?: number;
      ter_source?: string;
      ter_updated_at?: string;
    };
  };
  portfolio_exposure_v2?: {
    asset_mix?: {
      equity?: number;
      bond?: number;
      cash?: number;
      other?: number;
    };
    exposure_confidence?: number;
  };
}

export interface AdminFundSearchResponse {
  results: AdminFundResult[];
  count: number;
  query: string;
  mode: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SEARCH_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;

// ---------------------------------------------------------------------------
// Service functions — read-only callable
// ---------------------------------------------------------------------------

/**
 * Search funds via admin_fund_search callable (read-only, backend-sanitized).
 * 
 * @param query - ISIN or fund name substring (min 2 chars)
 * @param limit - Max results (capped at 20)
 * @returns Sanitized fund results from backend
 * @throws Error if query is too short or callable fails
 */
export async function searchAdminFunds(
  query: string,
  limit: number = 10
): Promise<AdminFundSearchResponse> {
  const trimmed = (query || '').trim();

  if (trimmed.length < MIN_QUERY_LENGTH) {
    throw new Error(`Query must be at least ${MIN_QUERY_LENGTH} characters`);
  }

  const cappedLimit = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT);

  // Detect if query looks like an ISIN (2 letters + 10 alphanumeric)
  const isIsin = /^[A-Z]{2}[A-Z0-9]{10}$/i.test(trimmed);

  const adminFundSearch = httpsCallable<
    { query?: string; isin?: string; limit?: number },
    AdminFundSearchResponse
  >(functions, 'admin_fund_search');

  const payload = isIsin
    ? { isin: trimmed.toUpperCase(), limit: cappedLimit }
    : { query: trimmed, limit: cappedLimit };

  const result = await adminFundSearch(payload);
  return result.data;
}

/**
 * Exported constants for testing
 */
export { MAX_SEARCH_LIMIT, MIN_QUERY_LENGTH };
