/**
 * adminRetrocessionsReadOnly.test.tsx
 *
 * Tests for the read-only retrocession panel:
 * - Data constants integrity
 * - Security invariants (no writes, no endpoints, no upload)
 * - AdminLayout integration
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  RETROCESSION_SUMMARY,
  RETROCESSION_EXCLUDED_FUNDS,
  RETROCESSION_ARTIFACTS,
} from '../components/admin/RetrocessionPanel';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Summary constants
// ---------------------------------------------------------------------------

describe('RETROCESSION_SUMMARY', () => {
  it('updated_count is 44', () => {
    expect(RETROCESSION_SUMMARY.updated_count).toBe(44);
  });

  it('excluded_count is 3', () => {
    expect(RETROCESSION_SUMMARY.excluded_count).toBe(3);
  });

  it('failures is 0', () => {
    expect(RETROCESSION_SUMMARY.failures).toBe(0);
  });

  it('created_docs is 0', () => {
    expect(RETROCESSION_SUMMARY.created_docs).toBe(0);
  });

  it('write_gate is COMPLETADO', () => {
    expect(RETROCESSION_SUMMARY.write_gate).toBe('COMPLETADO');
  });

  it('post_write_verification is 44/44 PASS', () => {
    expect(RETROCESSION_SUMMARY.post_write_verification).toBe('44/44 PASS');
  });
});

// ---------------------------------------------------------------------------
// 2. Excluded funds
// ---------------------------------------------------------------------------

describe('RETROCESSION_EXCLUDED_FUNDS', () => {
  it('has exactly 3 entries', () => {
    expect(RETROCESSION_EXCLUDED_FUNDS.length).toBe(3);
  });

  it('contains IE00BYR8H148', () => {
    const isins = RETROCESSION_EXCLUDED_FUNDS.map((f) => f.isin);
    expect(isins).toContain('IE00BYR8H148');
  });

  it('contains LU0235308482', () => {
    const isins = RETROCESSION_EXCLUDED_FUNDS.map((f) => f.isin);
    expect(isins).toContain('LU0235308482');
  });

  it('contains LU1762221155', () => {
    const isins = RETROCESSION_EXCLUDED_FUNDS.map((f) => f.isin);
    expect(isins).toContain('LU1762221155');
  });

  it('all entries have retrocession > 0', () => {
    for (const fund of RETROCESSION_EXCLUDED_FUNDS) {
      expect(fund.retrocession).toBeGreaterThan(0);
    }
  });

  it('all entries have a non-empty reason', () => {
    for (const fund of RETROCESSION_EXCLUDED_FUNDS) {
      expect(fund.reason.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Artifacts
// ---------------------------------------------------------------------------

describe('RETROCESSION_ARTIFACTS', () => {
  const filenames = RETROCESSION_ARTIFACTS.map((a) => a.filename);

  it('contains pre_write_snapshot.json', () => {
    expect(filenames).toContain('pre_write_snapshot.json');
  });

  it('contains write_plan.json', () => {
    expect(filenames).toContain('write_plan.json');
  });

  it('contains rollback_manifest.json', () => {
    expect(filenames).toContain('rollback_manifest.json');
  });

  it('contains post_write_verification.json', () => {
    expect(filenames).toContain('post_write_verification.json');
  });

  it('all artifacts have descriptions', () => {
    for (const art of RETROCESSION_ARTIFACTS) {
      expect(art.description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. RetrocessionPanel source — read-only
// ---------------------------------------------------------------------------

describe('RetrocessionPanel source security', () => {
  const source = readSource('components/admin/RetrocessionPanel.tsx');

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
    'fetch(',
    'executeWrite',
    'applyWrite',
    'confirmWrite',
    'getFirestore',
  ];

  FORBIDDEN_PATTERNS.forEach((pattern) => {
    it(`does NOT contain: ${pattern}`, () => {
      expect(source).not.toContain(pattern);
    });
  });

  it('does NOT contain CSV upload functionality', () => {
    expect(source).not.toContain('FileReader');
    expect(source).not.toContain('input type="file"');
    expect(source).not.toContain('onChange={');
  });

  it('does NOT contain parser/Gemini references', () => {
    expect(source).not.toMatch(/import.*[Gg]emini/);
    expect(source).not.toMatch(/import.*GenerativeModel/);
    expect(source).not.toMatch(/import.*cargador_lotes/);
  });

  it('does NOT contain secret references', () => {
    expect(source).not.toContain('private_key');
    expect(source).not.toContain('serviceAccount');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('import.meta.env');
  });

  it('does NOT contain direct Firestore collection access', () => {
    expect(source).not.toMatch(/collection\s*\(/);
    expect(source).not.toMatch(/doc\s*\(\s*db/);
  });
});

// ---------------------------------------------------------------------------
// 5. AdminLayout integration
// ---------------------------------------------------------------------------

describe('AdminLayout retrocessions integration', () => {
  const source = readSource('components/admin/AdminLayout.tsx');

  it('imports RetrocessionPanel', () => {
    expect(source).toContain("import RetrocessionPanel from './RetrocessionPanel'");
  });

  it('marks retrocessions module as implemented', () => {
    expect(source).toMatch(/id:\s*'retrocessions'.*implemented:\s*true/);
  });

  it('renders RetrocessionPanel for retrocessions module', () => {
    expect(source).toContain('<RetrocessionPanel');
  });
});
