/**
 * adminSettingsReadOnly.test.tsx
 *
 * Tests for the read-only settings panel:
 * - Admin status
 * - Module registry
 * - Backend functions
 * - Security invariants
 * - Future disabled features
 * - Source security scan
 * - AdminLayout integration
 * - All modules implemented (8/8)
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ADMIN_SETTINGS_STATUS,
  ADMIN_SETTINGS_MODULES,
  ADMIN_SETTINGS_BACKEND_FUNCTIONS,
  ADMIN_SETTINGS_SECURITY_INVARIANTS,
  ADMIN_SETTINGS_FUTURE_DISABLED,
} from '../components/admin/SettingsPanel';
import { ADMIN_MODULES } from '../components/admin/AdminLayout';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Admin status
// ---------------------------------------------------------------------------

describe('ADMIN_SETTINGS_STATUS', () => {
  it('mode is READ_ONLY', () => {
    expect(ADMIN_SETTINGS_STATUS.mode).toBe('READ_ONLY');
  });

  it('modules_implemented is 8', () => {
    expect(ADMIN_SETTINGS_STATUS.modules_implemented).toBe(8);
  });

  it('modules_total is 8', () => {
    expect(ADMIN_SETTINGS_STATUS.modules_total).toBe(8);
  });

  it('backend_admin is deployed/read-only', () => {
    expect(ADMIN_SETTINGS_STATUS.backend_admin).toBe('deployed/read-only');
  });

  it('firestore_writes is disabled from UI', () => {
    expect(ADMIN_SETTINGS_STATUS.firestore_writes).toBe('disabled from UI');
  });

  it('parser_gemini is disabled from Admin', () => {
    expect(ADMIN_SETTINGS_STATUS.parser_gemini).toBe('disabled from Admin');
  });

  it('write_gates is disabled from UI', () => {
    expect(ADMIN_SETTINGS_STATUS.write_gates).toBe('disabled from UI');
  });
});

// ---------------------------------------------------------------------------
// 2. Module registry
// ---------------------------------------------------------------------------

describe('ADMIN_SETTINGS_MODULES', () => {
  it('contains 8 modules', () => {
    expect(ADMIN_SETTINGS_MODULES.length).toBe(8);
  });

  const expectedIds = ['dashboard', 'retrocessions', 'funds', 'logs', 'review', 'optimizer', 'parser', 'settings'];
  expectedIds.forEach((id) => {
    it(`contains module: ${id}`, () => {
      expect(ADMIN_SETTINGS_MODULES.some((m) => m.id === id)).toBe(true);
    });
  });

  it('all modules have status containing implemented', () => {
    for (const m of ADMIN_SETTINGS_MODULES) {
      expect(m.status).toContain('implemented');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Backend functions
// ---------------------------------------------------------------------------

describe('ADMIN_SETTINGS_BACKEND_FUNCTIONS', () => {
  it('contains admin_health', () => {
    expect(ADMIN_SETTINGS_BACKEND_FUNCTIONS.some((f) => f.name === 'admin_health')).toBe(true);
  });

  it('contains admin_fund_search', () => {
    expect(ADMIN_SETTINGS_BACKEND_FUNCTIONS.some((f) => f.name === 'admin_fund_search')).toBe(true);
  });

  it('all functions are read-only', () => {
    for (const f of ADMIN_SETTINGS_BACKEND_FUNCTIONS) {
      expect(f.type).toBe('read-only');
    }
  });

  it('all functions are deployed', () => {
    for (const f of ADMIN_SETTINGS_BACKEND_FUNCTIONS) {
      expect(f.status).toBe('deployed');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Security invariants
// ---------------------------------------------------------------------------

describe('ADMIN_SETTINGS_SECURITY_INVARIANTS', () => {
  const labels = ADMIN_SETTINGS_SECURITY_INVARIANTS.map((i) => i.label.toLowerCase());

  it('contains no Firestore writes', () => {
    expect(labels.some((l) => l.includes('firestore writes'))).toBe(true);
  });

  it('contains no functions deploy from UI', () => {
    expect(labels.some((l) => l.includes('functions deploy'))).toBe(true);
  });

  it('contains no parser execution', () => {
    expect(labels.some((l) => l.includes('parser execution'))).toBe(true);
  });

  it('contains no Gemini calls', () => {
    expect(labels.some((l) => l.includes('gemini calls'))).toBe(true);
  });

  it('contains no write gates from UI', () => {
    expect(labels.some((l) => l.includes('write gates'))).toBe(true);
  });

  it('all invariants have icon', () => {
    for (const inv of ADMIN_SETTINGS_SECURITY_INVARIANTS) {
      expect(inv.icon.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Future disabled features
// ---------------------------------------------------------------------------

describe('ADMIN_SETTINGS_FUTURE_DISABLED', () => {
  const features = ADMIN_SETTINGS_FUTURE_DISABLED.map((f) => f.feature.toLowerCase());

  it('contains role management', () => {
    expect(features.some((f) => f.includes('role management'))).toBe(true);
  });

  it('contains write gate approvals', () => {
    expect(features.some((f) => f.includes('write gate approvals'))).toBe(true);
  });

  it('contains audit logs UI', () => {
    expect(features.some((f) => f.includes('audit logs'))).toBe(true);
  });

  it('all future features marked disabled', () => {
    for (const f of ADMIN_SETTINGS_FUTURE_DISABLED) {
      expect(f.status).toContain('disabled');
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Source security
// ---------------------------------------------------------------------------

describe('SettingsPanel source security', () => {
  const source = readSource('components/admin/SettingsPanel.tsx');

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
    'saveSettings',
    'updateSettings',
    'localStorage.setItem',
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

  it('does NOT contain onChange handlers', () => {
    expect(source).not.toContain('onChange=');
  });

  it('does NOT contain input elements', () => {
    expect(source).not.toMatch(/input\s+type=/);
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

describe('AdminLayout settings integration', () => {
  const source = readSource('components/admin/AdminLayout.tsx');

  it('imports SettingsPanel', () => {
    expect(source).toContain("import SettingsPanel from './SettingsPanel'");
  });

  it('marks settings module as implemented', () => {
    expect(source).toMatch(/id:\s*'settings'.*implemented:\s*true/);
  });

  it('renders SettingsPanel for settings module', () => {
    expect(source).toContain('<SettingsPanel');
  });
});

// ---------------------------------------------------------------------------
// 8. All modules implemented (8/8)
// ---------------------------------------------------------------------------

describe('All admin modules implemented', () => {
  it('all 8 ADMIN_MODULES are implemented', () => {
    const notImplemented = ADMIN_MODULES.filter((m) => !m.implemented);
    expect(notImplemented.length).toBe(0);
  });

  it('ADMIN_MODULES has exactly 8 entries', () => {
    expect(ADMIN_MODULES.length).toBe(8);
  });

  it('no module has implemented=false', () => {
    for (const m of ADMIN_MODULES) {
      expect(m.implemented).toBe(true);
    }
  });
});
