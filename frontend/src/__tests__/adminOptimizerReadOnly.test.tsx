/**
 * adminOptimizerReadOnly.test.tsx
 *
 * Tests for the read-only optimizer/constraints panel:
 * - Canonical decisions integrity
 * - Pending cleanups
 * - Contract tests coverage
 * - Status cards
 * - Security invariants (no writes, no optimizer calls)
 * - AdminLayout integration
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  OPTIMIZER_DECISIONS,
  OPTIMIZER_PENDING_CLEANUPS,
  OPTIMIZER_CONTRACT_TESTS,
  OPTIMIZER_STATUS_CARDS,
} from '../components/admin/OptimizerConstraintsPanel';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Canonical decisions
// ---------------------------------------------------------------------------

describe('OPTIMIZER_DECISIONS', () => {
  it('contains Mixto no es hard constraint', () => {
    expect(OPTIMIZER_DECISIONS.some((d) => d.summary.includes('Mixto no es hard constraint'))).toBe(true);
  });

  it('contains portfolio_exposure_v2.asset_mix', () => {
    expect(OPTIMIZER_DECISIONS.some((d) => d.detail.includes('portfolio_exposure_v2.asset_mix'))).toBe(true);
  });

  it('contains classification_v2', () => {
    expect(OPTIMIZER_DECISIONS.some((d) => d.detail.includes('classification_v2'))).toBe(true);
  });

  it('contains fallback 50/50', () => {
    expect(OPTIMIZER_DECISIONS.some((d) => d.summary.includes('Fallback') || d.summary.includes('fallback'))).toBe(true);
  });

  it('all decisions have non-empty summary', () => {
    for (const d of OPTIMIZER_DECISIONS) {
      expect(d.summary.length).toBeGreaterThan(0);
    }
  });

  it('all decisions have non-empty detail', () => {
    for (const d of OPTIMIZER_DECISIONS) {
      expect(d.detail.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Pending cleanups
// ---------------------------------------------------------------------------

describe('OPTIMIZER_PENDING_CLEANUPS', () => {
  it('contains risk_level vs profile_id', () => {
    expect(OPTIMIZER_PENDING_CLEANUPS.some((c) => c.id.includes('risk_level'))).toBe(true);
  });

  it('contains optimization_mode', () => {
    expect(OPTIMIZER_PENDING_CLEANUPS.some((c) => c.id.includes('optimization_mode'))).toBe(true);
  });

  it('contains locked_positions', () => {
    expect(OPTIMIZER_PENDING_CLEANUPS.some((c) => c.id.includes('locked_positions'))).toBe(true);
  });

  it('contains bucket_bounds_v1', () => {
    expect(OPTIMIZER_PENDING_CLEANUPS.some((c) => c.id.includes('bucket_bounds_v1'))).toBe(true);
  });

  it('all cleanups have severity', () => {
    for (const c of OPTIMIZER_PENDING_CLEANUPS) {
      expect(['alta', 'media', 'baja']).toContain(c.severity);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Contract tests
// ---------------------------------------------------------------------------

describe('OPTIMIZER_CONTRACT_TESTS', () => {
  it('contains canonical constraints', () => {
    expect(OPTIMIZER_CONTRACT_TESTS.some((t) => t.name.toLowerCase().includes('canonical constraints'))).toBe(true);
  });

  it('contains mixed look-through', () => {
    expect(OPTIMIZER_CONTRACT_TESTS.some((t) => t.name.toLowerCase().includes('mixed look-through'))).toBe(true);
  });

  it('contains fallback status', () => {
    expect(OPTIMIZER_CONTRACT_TESTS.some((t) => t.name.toLowerCase().includes('fallback'))).toBe(true);
  });

  it('contains frontend optimizer P0', () => {
    expect(OPTIMIZER_CONTRACT_TESTS.some((t) => t.name.toLowerCase().includes('frontend optimizer p0'))).toBe(true);
  });

  it('all tests have PASS status', () => {
    for (const t of OPTIMIZER_CONTRACT_TESTS) {
      expect(t.status).toBe('PASS');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Status cards
// ---------------------------------------------------------------------------

describe('OPTIMIZER_STATUS_CARDS', () => {
  it('contains Fallback UX', () => {
    expect(OPTIMIZER_STATUS_CARDS.some((c) => c.label === 'Fallback UX')).toBe(true);
  });

  it('contains Cleanup', () => {
    expect(OPTIMIZER_STATUS_CARDS.some((c) => c.label === 'Cleanup')).toBe(true);
  });

  it('contains Mixto', () => {
    expect(OPTIMIZER_STATUS_CARDS.some((c) => c.label === 'Mixto')).toBe(true);
  });

  it('contains Solver', () => {
    expect(OPTIMIZER_STATUS_CARDS.some((c) => c.label === 'Solver')).toBe(true);
  });

  it('all cards have label and value', () => {
    for (const c of OPTIMIZER_STATUS_CARDS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.value.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Source security
// ---------------------------------------------------------------------------

describe('OptimizerConstraintsPanel source security', () => {
  const source = readSource('components/admin/OptimizerConstraintsPanel.tsx');

  it('contains read-only indicator text', () => {
    expect(source).toContain('solo lectura');
  });

  const FORBIDDEN_PATTERNS = [
    'setDoc(',
    'updateDoc(',
    'deleteDoc(',
    'writeBatch(',
    'runTransaction(',
    'addDoc(',
    'httpsCallable',
    'getFirestore',
    'executeWrite',
    'applyWrite',
    'confirmWrite',
    'optimize_portfolio_quant',
    'getEfficientFrontier',
    'FileReader',
  ];

  FORBIDDEN_PATTERNS.forEach((pattern) => {
    it(`does NOT contain: ${pattern}`, () => {
      expect(source).not.toContain(pattern);
    });
  });

  it('does NOT contain fetch calls', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('does NOT contain secret references', () => {
    expect(source).not.toContain('private_key');
    expect(source).not.toContain('serviceAccount');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('import.meta.env');
  });
});

// ---------------------------------------------------------------------------
// 6. AdminLayout integration
// ---------------------------------------------------------------------------

describe('AdminLayout optimizer integration', () => {
  const source = readSource('components/admin/AdminLayout.tsx');

  it('imports OptimizerConstraintsPanel', () => {
    expect(source).toContain("import OptimizerConstraintsPanel from './OptimizerConstraintsPanel'");
  });

  it('marks optimizer module as implemented', () => {
    expect(source).toMatch(/id:\s*'optimizer'.*implemented:\s*true/);
  });

  it('renders OptimizerConstraintsPanel for optimizer module', () => {
    expect(source).toContain('<OptimizerConstraintsPanel');
  });
});
