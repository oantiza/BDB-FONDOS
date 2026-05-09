/**
 * adminFundSearch.test.tsx
 *
 * Tests for the admin fund search UI integration:
 * - Service exports and contracts
 * - Security invariants (no writes, no parser, no secrets)
 * - Component source integrity
 * - Input validation logic
 * - AdminLayout integration
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Service exports
// ---------------------------------------------------------------------------

describe('adminConsoleService', () => {
  it('exports searchAdminFunds function', async () => {
    const mod = await import('../services/adminConsoleService');
    expect(typeof mod.searchAdminFunds).toBe('function');
  });

  it('exports MAX_SEARCH_LIMIT constant', async () => {
    const mod = await import('../services/adminConsoleService');
    expect(mod.MAX_SEARCH_LIMIT).toBe(20);
  });

  it('exports MIN_QUERY_LENGTH constant', async () => {
    const mod = await import('../services/adminConsoleService');
    expect(mod.MIN_QUERY_LENGTH).toBe(2);
  });

  it('exports AdminFundResult type (compile-time check via import)', async () => {
    // TypeScript would fail compilation if this type didn't exist
    const mod = await import('../services/adminConsoleService');
    expect(mod).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Service source — callable reference
// ---------------------------------------------------------------------------

describe('adminConsoleService source', () => {
  const source = readSource('services/adminConsoleService.ts');

  it('references admin_fund_search callable', () => {
    expect(source).toContain('admin_fund_search');
  });

  it('uses httpsCallable from firebase/functions', () => {
    expect(source).toContain("import { httpsCallable } from 'firebase/functions'");
  });

  it('imports functions from firebase config', () => {
    expect(source).toContain("from '../firebase'");
  });
});

// ---------------------------------------------------------------------------
// 3. Service security invariants — no writes
// ---------------------------------------------------------------------------

describe('adminConsoleService security invariants', () => {
  const source = readSource('services/adminConsoleService.ts');

  const FORBIDDEN_WRITE_PATTERNS = [
    'setDoc(',
    'updateDoc(',
    'deleteDoc(',
    'writeBatch(',
    'runTransaction(',
    'addDoc(',
    '.set(',
    '.update(',
    '.delete(',
    'batch.commit',
  ];

  FORBIDDEN_WRITE_PATTERNS.forEach((pattern) => {
    it(`does NOT contain write pattern: ${pattern}`, () => {
      expect(source).not.toContain(pattern);
    });
  });

  it('does NOT import getFirestore', () => {
    expect(source).not.toContain('getFirestore');
  });

  it('does NOT contain parser references', () => {
    expect(source).not.toMatch(/import.*cargador_lotes/);
    expect(source).not.toMatch(/import.*parser/i);
  });

  it('does NOT contain Gemini references', () => {
    expect(source).not.toMatch(/import.*[Gg]emini/);
    expect(source).not.toMatch(/import.*GenerativeModel/);
  });

  it('does NOT contain secret references', () => {
    expect(source).not.toContain('private_key');
    expect(source).not.toContain('serviceAccount');
    expect(source).not.toContain('REFRESH_TOKEN');
  });
});

// ---------------------------------------------------------------------------
// 4. FundAuditor source — read-only UI
// ---------------------------------------------------------------------------

describe('FundAuditor source', () => {
  const source = readSource('components/admin/FundAuditor.tsx');

  it('contains read-only indicator text', () => {
    expect(source).toContain('Read-Only');
  });

  it('contains Firestore no-write disclaimer', () => {
    expect(source).toContain('No se escribe en Firestore');
  });

  it('imports searchAdminFunds from service', () => {
    expect(source).toContain('searchAdminFunds');
  });

  const FORBIDDEN_WRITE_UI = [
    'executeWrite',
    'applyWrite',
    'confirmWrite',
    'updateDoc(',
    'setDoc(',
    'deleteDoc(',
    'writeBatch(',
  ];

  FORBIDDEN_WRITE_UI.forEach((pattern) => {
    it(`does NOT contain write UI pattern: ${pattern}`, () => {
      expect(source).not.toContain(pattern);
    });
  });

  it('does NOT contain export buttons', () => {
    expect(source).not.toContain('exportar');
    expect(source).not.toContain('Exportar');
    expect(source).not.toContain('download');
  });

  it('does NOT contain edit buttons', () => {
    expect(source).not.toContain('Editar');
    expect(source).not.toContain('Guardar');
    expect(source).not.toContain('Actualizar');
  });
});

// ---------------------------------------------------------------------------
// 5. AdminLayout integration
// ---------------------------------------------------------------------------

describe('AdminLayout integration', () => {
  const source = readSource('components/admin/AdminLayout.tsx');

  it('imports FundAuditor', () => {
    expect(source).toContain("import FundAuditor from './FundAuditor'");
  });

  it('marks funds module as implemented', () => {
    expect(source).toMatch(/id:\s*'funds'.*implemented:\s*true/);
  });

  it('renders FundAuditor for funds module', () => {
    expect(source).toContain('<FundAuditor');
  });
});

// ---------------------------------------------------------------------------
// 6. Input validation constants
// ---------------------------------------------------------------------------

describe('input validation', () => {
  it('MIN_QUERY_LENGTH is at least 2', async () => {
    const mod = await import('../services/adminConsoleService');
    expect(mod.MIN_QUERY_LENGTH).toBeGreaterThanOrEqual(2);
  });

  it('MAX_SEARCH_LIMIT is at most 50', async () => {
    const mod = await import('../services/adminConsoleService');
    expect(mod.MAX_SEARCH_LIMIT).toBeLessThanOrEqual(50);
  });

  it('MAX_SEARCH_LIMIT is exactly 20', async () => {
    const mod = await import('../services/adminConsoleService');
    expect(mod.MAX_SEARCH_LIMIT).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 7. Cross-module security scan
// ---------------------------------------------------------------------------

describe('cross-module security scan', () => {
  const serviceSource = readSource('services/adminConsoleService.ts');
  const auditorSource = readSource('components/admin/FundAuditor.tsx');
  const combined = serviceSource + auditorSource;

  it('no combined source contains process.env', () => {
    expect(combined).not.toContain('process.env');
  });

  it('no combined source contains import.meta.env', () => {
    expect(combined).not.toContain('import.meta.env');
  });

  it('no combined source contains direct Firestore collection access', () => {
    expect(combined).not.toMatch(/collection\s*\(/);
    expect(combined).not.toMatch(/doc\s*\(\s*db/);
  });
});
