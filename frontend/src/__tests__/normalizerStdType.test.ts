/**
 * L-3 (auditoría 2026-06-21) — std_type vocabulary unification.
 *
 * Antes, normalizeFundData() asignaba:
 *     std_type = classification_v2?.asset_type ?? asset_class
 * donde classification_v2.asset_type es vocabulario V2 ("EQUITY", "FIXED_INCOME", ...)
 * y el fallback asset_class es legacy ("RV", "RF", ...). Resultado: std_type (y
 * std_extra.assetClass, que lo copia) quedaba con vocabulario MEZCLADO según la rama.
 *
 * Estos tests fijan el contrato: ambos caminos (con classification_v2 y solo legacy)
 * producen el MISMO vocabulario legacy.
 */
import { describe, it, expect } from 'vitest';
import { normalizeFundData } from '../utils/normalizer';

describe('normalizeFundData · std_type vocabulary (L-3)', () => {
  it('V2 EQUITY y legacy "RV" producen el mismo std_type ("RV")', () => {
    const fromV2 = normalizeFundData({ isin: 'A', classification_v2: { asset_type: 'EQUITY' } });
    const fromLegacy = normalizeFundData({ isin: 'B', asset_class: 'RV' });
    expect(fromV2.std_type).toBe('RV');
    expect(fromLegacy.std_type).toBe('RV');
    expect(fromV2.std_type).toBe(fromLegacy.std_type);
  });

  it('std_extra.assetClass es coherente con std_type (mismo vocabulario)', () => {
    const fromV2 = normalizeFundData({ isin: 'A', classification_v2: { asset_type: 'EQUITY' } });
    expect(fromV2.std_extra.assetClass).toBe('RV');
    expect(fromV2.std_extra.assetClass).toBe(fromV2.std_type);
  });

  it('V2 FIXED_INCOME y legacy "RF" producen "RF"', () => {
    expect(normalizeFundData({ isin: 'A', classification_v2: { asset_type: 'FIXED_INCOME' } }).std_type).toBe('RF');
    expect(normalizeFundData({ isin: 'B', asset_class: 'RF' }).std_type).toBe('RF');
  });

  it('V2 MIXED produce "Mixto" y V2 MONETARY produce "Monetario"', () => {
    expect(normalizeFundData({ isin: 'A', classification_v2: { asset_type: 'MIXED' } }).std_type).toBe('Mixto');
    expect(normalizeFundData({ isin: 'B', classification_v2: { asset_type: 'MONETARY' } }).std_type).toBe('Monetario');
  });

  it('sin V2 ni asset_class, std_type es null (sin invenciones)', () => {
    expect(normalizeFundData({ isin: 'A' }).std_type).toBeNull();
  });

  it('no deja vocabulario V2 crudo ("EQUITY") en std_type cuando hay classification_v2', () => {
    const r = normalizeFundData({ isin: 'A', classification_v2: { asset_type: 'EQUITY' } });
    expect(r.std_type).not.toBe('EQUITY');
  });
});
