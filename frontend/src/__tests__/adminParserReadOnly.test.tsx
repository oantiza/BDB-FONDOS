/**
 * adminParserReadOnly.test.tsx
 *
 * Tests for the read-only parser panel:
 * - Pipeline steps integrity
 * - Parser statuses
 * - Security invariants
 * - Next steps
 * - Status cards
 * - Source security scan
 * - AdminLayout integration
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  PARSER_PIPELINE_STEPS,
  PARSER_STATUSES,
  PARSER_SECURITY_INVARIANTS,
  PARSER_NEXT_STEPS,
  PARSER_STATUS_CARDS,
} from '../components/admin/ParserPanel';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Pipeline steps
// ---------------------------------------------------------------------------

describe('PARSER_PIPELINE_STEPS', () => {
  const labels = PARSER_PIPELINE_STEPS.map((s) => s.label);

  it('contains PDF source', () => {
    expect(labels).toContain('PDF source');
  });

  it('contains Parser execution', () => {
    expect(labels).toContain('Parser execution');
  });

  it('contains Artifact JSON', () => {
    expect(labels).toContain('Artifact JSON');
  });

  it('contains Review', () => {
    expect(labels).toContain('Review');
  });

  it('contains Write gate', () => {
    expect(labels).toContain('Write gate');
  });

  it('contains Post-write verification', () => {
    expect(labels).toContain('Post-write verification');
  });

  it('has 6 steps in order', () => {
    expect(PARSER_PIPELINE_STEPS.length).toBe(6);
    PARSER_PIPELINE_STEPS.forEach((s, i) => {
      expect(s.order).toBe(i + 1);
    });
  });

  it('all steps marked as non-executable', () => {
    for (const s of PARSER_PIPELINE_STEPS) {
      expect(s.executable).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Parser statuses
// ---------------------------------------------------------------------------

describe('PARSER_STATUSES', () => {
  const codes = PARSER_STATUSES.map((s) => s.code);

  it('contains PASS', () => {
    expect(codes).toContain('PASS');
  });

  it('contains REVIEW', () => {
    expect(codes).toContain('REVIEW');
  });

  it('contains BLOCKED', () => {
    expect(codes).toContain('BLOCKED');
  });

  it('contains ERROR', () => {
    expect(codes).toContain('ERROR');
  });

  it('contains NOT_RUN', () => {
    expect(codes).toContain('NOT_RUN');
  });

  it('all statuses have description', () => {
    for (const s of PARSER_STATUSES) {
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Security invariants
// ---------------------------------------------------------------------------

describe('PARSER_SECURITY_INVARIANTS', () => {
  const labels = PARSER_SECURITY_INVARIANTS.map((i) => i.label.toLowerCase());

  it('contains no Gemini API', () => {
    expect(labels.some((l) => l.includes('gemini'))).toBe(true);
  });

  it('contains no parser execution', () => {
    expect(labels.some((l) => l.includes('parser execution'))).toBe(true);
  });

  it('contains no PDF upload', () => {
    expect(labels.some((l) => l.includes('pdf'))).toBe(true);
  });

  it('contains no Firestore writes', () => {
    expect(labels.some((l) => l.includes('firestore writes'))).toBe(true);
  });

  it('contains no file access', () => {
    expect(labels.some((l) => l.includes('file access'))).toBe(true);
  });

  it('all invariants have icon', () => {
    for (const inv of PARSER_SECURITY_INVARIANTS) {
      expect(inv.icon.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Next steps
// ---------------------------------------------------------------------------

describe('PARSER_NEXT_STEPS', () => {
  const labels = PARSER_NEXT_STEPS.map((n) => n.label.toLowerCase());

  it('contains dynamic readonly status', () => {
    expect(labels.some((l) => l.includes('dynamic readonly status'))).toBe(true);
  });

  it('contains artifact safe index', () => {
    expect(labels.some((l) => l.includes('artifact safe index'))).toBe(true);
  });

  it('contains batch execution outside UI', () => {
    expect(labels.some((l) => l.includes('fuera de la ui'))).toBe(true);
  });

  it('all next steps have code', () => {
    for (const n of PARSER_NEXT_STEPS) {
      expect(n.code.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Status cards
// ---------------------------------------------------------------------------

describe('PARSER_STATUS_CARDS', () => {
  it('contains Parser mode', () => {
    expect(PARSER_STATUS_CARDS.some((c) => c.label === 'Parser mode')).toBe(true);
  });

  it('contains Gemini', () => {
    expect(PARSER_STATUS_CARDS.some((c) => c.label === 'Gemini')).toBe(true);
  });

  it('contains PDF processing', () => {
    expect(PARSER_STATUS_CARDS.some((c) => c.label === 'PDF processing')).toBe(true);
  });

  it('contains Write gate', () => {
    expect(PARSER_STATUS_CARDS.some((c) => c.label === 'Write gate')).toBe(true);
  });

  it('all cards have label and value', () => {
    for (const c of PARSER_STATUS_CARDS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.value.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Source security
// ---------------------------------------------------------------------------

describe('ParserPanel source security', () => {
  const source = readSource('components/admin/ParserPanel.tsx');

  it('contains read-only indicator text', () => {
    expect(source).toContain('solo lectura');
  });

  it('contains Gemini safety text', () => {
    expect(source).toContain('no invoca Gemini');
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
    'runParser',
    'executeParser',
    'parsePdf',
    'uploadPdf',
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

  it('does NOT contain file input', () => {
    expect(source).not.toContain('input type="file"');
    expect(source).not.toContain("input type='file'");
  });

  it('does NOT contain onChange handlers', () => {
    expect(source).not.toContain('onChange=');
  });

  it('does NOT contain window.open', () => {
    expect(source).not.toContain('window.open');
  });

  it('does NOT contain secret references', () => {
    expect(source).not.toContain('private_key');
    expect(source).not.toContain('serviceAccount');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('import.meta.env');
  });
});

// ---------------------------------------------------------------------------
// 7. AdminLayout integration
// ---------------------------------------------------------------------------

describe('AdminLayout parser integration', () => {
  const source = readSource('components/admin/AdminLayout.tsx');

  it('imports ParserPanel', () => {
    expect(source).toContain("import ParserPanel from './ParserPanel'");
  });

  it('marks parser module as implemented', () => {
    expect(source).toMatch(/id:\s*'parser'.*implemented:\s*true/);
  });

  it('renders ParserPanel for parser module', () => {
    expect(source).toContain('<ParserPanel');
  });
});
