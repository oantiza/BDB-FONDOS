/**
 * adminArtifactsReadOnly.test.tsx
 *
 * Tests for the read-only artifacts catalog panel:
 * - Category constants
 * - Artifact catalog integrity
 * - Security invariants (no writes, no filesystem, no downloads)
 * - AdminLayout integration
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ADMIN_ARTIFACT_CATEGORIES,
  ADMIN_ARTIFACTS,
  ARTIFACT_STATUS_LABELS,
} from '../components/admin/ArtifactsPanel';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Categories
// ---------------------------------------------------------------------------

describe('ADMIN_ARTIFACT_CATEGORIES', () => {
  it('contains Retrocesiones', () => {
    expect(ADMIN_ARTIFACT_CATEGORIES).toContain('Retrocesiones');
  });

  it('contains Admin', () => {
    expect(ADMIN_ARTIFACT_CATEGORIES).toContain('Admin');
  });

  it('contains Optimizer', () => {
    expect(ADMIN_ARTIFACT_CATEGORIES).toContain('Optimizer');
  });

  it('contains Parser', () => {
    expect(ADMIN_ARTIFACT_CATEGORIES).toContain('Parser');
  });

  it('contains Global', () => {
    expect(ADMIN_ARTIFACT_CATEGORIES).toContain('Global');
  });
});

// ---------------------------------------------------------------------------
// 2. Artifact catalog
// ---------------------------------------------------------------------------

describe('ADMIN_ARTIFACTS', () => {
  it('contains at least 12 entries', () => {
    expect(ADMIN_ARTIFACTS.length).toBeGreaterThanOrEqual(12);
  });

  const paths = ADMIN_ARTIFACTS.map((a) => a.path);

  it('contains BDB_RETROCESSION_WRITE_GATE_2.md', () => {
    expect(paths.some((p) => p.includes('BDB_RETROCESSION_WRITE_GATE_2.md'))).toBe(true);
  });

  it('contains BDB_RETROCESSION_POST_WRITE_STATE_CHECK_0.md', () => {
    expect(paths.some((p) => p.includes('BDB_RETROCESSION_POST_WRITE_STATE_CHECK_0.md'))).toBe(true);
  });

  it('contains BDB_ADMIN_CONSOLE_DESIGN_0.md', () => {
    expect(paths.some((p) => p.includes('BDB_ADMIN_CONSOLE_DESIGN_0.md'))).toBe(true);
  });

  it('contains BDB_ADMIN_BACKEND_REQUIRE_ADMIN_DEPLOY_CHECK_0.md', () => {
    expect(paths.some((p) => p.includes('BDB_ADMIN_BACKEND_REQUIRE_ADMIN_DEPLOY_CHECK_0.md'))).toBe(true);
  });

  it('contains BDB_OPTIMIZER_MIXED_UX_CLOSEOUT.md', () => {
    expect(paths.some((p) => p.includes('BDB_OPTIMIZER_MIXED_UX_CLOSEOUT.md'))).toBe(true);
  });

  it('contains pre_write_snapshot.json', () => {
    expect(paths.some((p) => p.includes('pre_write_snapshot.json'))).toBe(true);
  });

  it('contains write_plan.json', () => {
    expect(paths.some((p) => p.includes('write_plan.json'))).toBe(true);
  });

  it('contains rollback_manifest.json', () => {
    expect(paths.some((p) => p.includes('rollback_manifest.json'))).toBe(true);
  });

  it('contains post_write_verification.json', () => {
    expect(paths.some((p) => p.includes('post_write_verification.json'))).toBe(true);
  });

  it('all entries have non-empty title', () => {
    for (const a of ADMIN_ARTIFACTS) {
      expect(a.title.length).toBeGreaterThan(0);
    }
  });

  it('all entries have non-empty description', () => {
    for (const a of ADMIN_ARTIFACTS) {
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it('all entries have valid category', () => {
    for (const a of ADMIN_ARTIFACTS) {
      expect(ADMIN_ARTIFACT_CATEGORIES).toContain(a.category);
    }
  });

  it('all entries have valid status', () => {
    const validStatuses = Object.keys(ARTIFACT_STATUS_LABELS);
    for (const a of ADMIN_ARTIFACTS) {
      expect(validStatuses).toContain(a.status);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Source security
// ---------------------------------------------------------------------------

describe('ArtifactsPanel source security', () => {
  const source = readSource('components/admin/ArtifactsPanel.tsx');

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
    'FileReader',
    'window.open',
  ];

  FORBIDDEN_PATTERNS.forEach((pattern) => {
    it(`does NOT contain: ${pattern}`, () => {
      expect(source).not.toContain(pattern);
    });
  });

  it('does NOT contain download functionality', () => {
    expect(source).not.toMatch(/download\s*=/i);
    expect(source).not.toMatch(/<a[^>]+download/i);
  });

  it('does NOT contain functional href links', () => {
    expect(source).not.toMatch(/href\s*=\s*["'](?!#)/);
  });

  it('does NOT contain fetch calls', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('does NOT contain collection/doc Firestore access', () => {
    expect(source).not.toMatch(/collection\s*\(/);
    expect(source).not.toMatch(/doc\s*\(\s*db/);
  });

  it('does NOT contain secret references', () => {
    expect(source).not.toContain('private_key');
    expect(source).not.toContain('serviceAccount');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('import.meta.env');
  });

  it('does NOT contain parser/Gemini references', () => {
    expect(source).not.toMatch(/import.*[Gg]emini/);
    expect(source).not.toMatch(/import.*cargador_lotes/);
  });
});

// ---------------------------------------------------------------------------
// 4. AdminLayout integration
// ---------------------------------------------------------------------------

describe('AdminLayout artifacts integration', () => {
  const source = readSource('components/admin/AdminLayout.tsx');

  it('imports ArtifactsPanel', () => {
    expect(source).toContain("import ArtifactsPanel from './ArtifactsPanel'");
  });

  it('marks logs module as implemented', () => {
    expect(source).toMatch(/id:\s*'logs'.*implemented:\s*true/);
  });

  it('renders ArtifactsPanel for logs module', () => {
    expect(source).toContain('<ArtifactsPanel');
  });
});
