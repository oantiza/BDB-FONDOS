/**
 * adminReviewQueueReadOnly.test.tsx
 *
 * Tests for the read-only review queue panel:
 * - Queue items integrity
 * - ISIN coverage
 * - Category/severity coverage
 * - Summary accuracy
 * - Security invariants (no writes, no resolve, no approve)
 * - AdminLayout integration
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  REVIEW_QUEUE_ITEMS,
  REVIEW_QUEUE_CATEGORIES,
  REVIEW_QUEUE_SEVERITIES,
  REVIEW_QUEUE_SUMMARY,
} from '../components/admin/ReviewQueuePanel';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Queue items
// ---------------------------------------------------------------------------

describe('REVIEW_QUEUE_ITEMS', () => {
  it('contains at least 8 items', () => {
    expect(REVIEW_QUEUE_ITEMS.length).toBeGreaterThanOrEqual(8);
  });

  it('contains IE00BYR8H148', () => {
    expect(REVIEW_QUEUE_ITEMS.some((i) => i.id.includes('ie00byr8h148'))).toBe(true);
  });

  it('contains LU0235308482', () => {
    expect(REVIEW_QUEUE_ITEMS.some((i) => i.id.includes('lu0235308482'))).toBe(true);
  });

  it('contains LU1762221155', () => {
    expect(REVIEW_QUEUE_ITEMS.some((i) => i.id.includes('lu1762221155'))).toBe(true);
  });

  it('contains 44 ISIN_NOT_FOUND item', () => {
    expect(REVIEW_QUEUE_ITEMS.some((i) => i.id.includes('not-found-44'))).toBe(true);
  });

  it('contains Parser category item', () => {
    expect(REVIEW_QUEUE_ITEMS.some((i) => i.category === 'Parser')).toBe(true);
  });

  it('contains Optimizer category item', () => {
    expect(REVIEW_QUEUE_ITEMS.some((i) => i.category === 'Optimizer')).toBe(true);
  });

  it('contains Mixtos category item', () => {
    expect(REVIEW_QUEUE_ITEMS.some((i) => i.category === 'Mixtos')).toBe(true);
  });

  it('has at least 2 items with alta severity', () => {
    const alta = REVIEW_QUEUE_ITEMS.filter((i) => i.severity === 'alta');
    expect(alta.length).toBeGreaterThanOrEqual(2);
  });

  it('all items have non-empty title', () => {
    for (const item of REVIEW_QUEUE_ITEMS) {
      expect(item.title.length).toBeGreaterThan(0);
    }
  });

  it('all items have non-empty description', () => {
    for (const item of REVIEW_QUEUE_ITEMS) {
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it('all items have valid category', () => {
    for (const item of REVIEW_QUEUE_ITEMS) {
      expect(REVIEW_QUEUE_CATEGORIES).toContain(item.category);
    }
  });

  it('all items have valid severity', () => {
    for (const item of REVIEW_QUEUE_ITEMS) {
      expect(REVIEW_QUEUE_SEVERITIES).toContain(item.severity);
    }
  });

  it('all items have nextAction', () => {
    for (const item of REVIEW_QUEUE_ITEMS) {
      expect(item.nextAction.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Summary
// ---------------------------------------------------------------------------

describe('REVIEW_QUEUE_SUMMARY', () => {
  it('total equals items length', () => {
    expect(REVIEW_QUEUE_SUMMARY.total).toBe(REVIEW_QUEUE_ITEMS.length);
  });

  it('alta + media + baja = total', () => {
    expect(REVIEW_QUEUE_SUMMARY.alta + REVIEW_QUEUE_SUMMARY.media + REVIEW_QUEUE_SUMMARY.baja)
      .toBe(REVIEW_QUEUE_SUMMARY.total);
  });

  it('categories > 0', () => {
    expect(REVIEW_QUEUE_SUMMARY.categories).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Source security
// ---------------------------------------------------------------------------

describe('ReviewQueuePanel source security', () => {
  const source = readSource('components/admin/ReviewQueuePanel.tsx');

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
  ];

  FORBIDDEN_PATTERNS.forEach((pattern) => {
    it(`does NOT contain: ${pattern}`, () => {
      expect(source).not.toContain(pattern);
    });
  });

  it('does NOT contain fetch calls', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('does NOT contain approve action handlers', () => {
    expect(source).not.toMatch(/onApprove/);
    expect(source).not.toMatch(/handleApprove/);
    expect(source).not.toMatch(/approve\s*\(/);
  });

  it('does NOT contain resolve action', () => {
    expect(source).not.toMatch(/\bresolve\s*\(/);
  });

  it('does NOT contain onChange handlers', () => {
    expect(source).not.toMatch(/onChange\s*=/);
  });

  it('does NOT contain secret references', () => {
    expect(source).not.toContain('private_key');
    expect(source).not.toContain('serviceAccount');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('import.meta.env');
  });
});

// ---------------------------------------------------------------------------
// 4. AdminLayout integration
// ---------------------------------------------------------------------------

describe('AdminLayout review queue integration', () => {
  const source = readSource('components/admin/AdminLayout.tsx');

  it('imports ReviewQueuePanel', () => {
    expect(source).toContain("import ReviewQueuePanel from './ReviewQueuePanel'");
  });

  it('marks review module as implemented', () => {
    expect(source).toMatch(/id:\s*'review'.*implemented:\s*true/);
  });

  it('renders ReviewQueuePanel for review module', () => {
    expect(source).toContain('<ReviewQueuePanel');
  });
});
