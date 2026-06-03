/**
 * REM-1 — Paridad FE/BE de suitability contra el golden compartido.
 *
 * El golden lo genera el motor CANÓNICO de backend (compute_compatible_profiles).
 * Aquí validamos que la lógica de fallback del frontend (isFundSuitableForProfile)
 * produce los MISMOS compatible_profiles para los casos donde se espera paridad.
 * El golden excluye deliberadamente el caso FE-9 (lowQualityCredit >= 35), que es
 * una divergencia FE-only conocida y documentada.
 *
 * Si alguien cambia una regla en un solo lado (FE o BE), este test o su gemelo de
 * backend (test_suitability_parity_golden.py) falla -> deriva de lógica detectada en CI,
 * sin depender de Firestore.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isFundSuitableForProfile } from '../utils/rulesEngine';

const GOLDEN = resolve(__dirname, '../../../functions_python/tests/fixtures/suitability_golden.json');
const cases: Array<{ id: string; fund: any; expected_compatible_profiles: number[] }> =
  JSON.parse(readFileSync(GOLDEN, 'utf-8')).cases;

function feCompatibleProfiles(fund: any): number[] {
  const out: number[] = [];
  for (let n = 1; n <= 10; n++) {
    if (isFundSuitableForProfile(fund, n)) out.push(n);
  }
  return out;
}

describe('REM-1 — paridad suitability FE vs golden canónico', () => {
  for (const c of cases) {
    it(`${c.id}: FE coincide con el golden de backend`, () => {
      expect(feCompatibleProfiles(c.fund)).toEqual(c.expected_compatible_profiles);
    });
  }
});
