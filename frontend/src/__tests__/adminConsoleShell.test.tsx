import { describe, it, expect } from 'vitest';
import { ADMIN_MODULES } from '../components/admin/AdminLayout';
import { ADMIN_DASHBOARD_CARDS } from '../components/admin/AdminDashboard';

// ---------------------------------------------------------------------------
// AdminLayout module definitions
// ---------------------------------------------------------------------------

describe('Admin Console Shell — module definitions', () => {
  it('defines at least 8 admin modules', () => {
    expect(ADMIN_MODULES.length).toBeGreaterThanOrEqual(8);
  });

  it('first module is Dashboard and is implemented', () => {
    expect(ADMIN_MODULES[0].id).toBe('dashboard');
    expect(ADMIN_MODULES[0].implemented).toBe(true);
  });

  it('contains expected module IDs', () => {
    const ids = ADMIN_MODULES.map((m) => m.id);
    expect(ids).toContain('dashboard');
    expect(ids).toContain('retrocessions');
    expect(ids).toContain('parser');
    expect(ids).toContain('review');
    expect(ids).toContain('funds');
    expect(ids).toContain('optimizer');
    expect(ids).toContain('logs');
    expect(ids).toContain('settings');
  });

  it('dashboard and funds are implemented', () => {
    const implemented = ADMIN_MODULES.filter((m) => m.implemented);
    expect(implemented.length).toBe(2);
    const ids = implemented.map((m) => m.id);
    expect(ids).toContain('dashboard');
    expect(ids).toContain('funds');
  });

  it('all modules have non-empty label and icon', () => {
    for (const mod of ADMIN_MODULES) {
      expect(mod.label.length).toBeGreaterThan(0);
      expect(mod.icon.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AdminDashboard cards
// ---------------------------------------------------------------------------

describe('Admin Console Shell — dashboard cards', () => {
  it('defines at least 6 status cards', () => {
    expect(ADMIN_DASHBOARD_CARDS.length).toBeGreaterThanOrEqual(6);
  });

  it('contains retrocession card with "44 actualizadas, 3 excluidas"', () => {
    const retro = ADMIN_DASHBOARD_CARDS.find((c) => c.id === 'retrocessions');
    expect(retro).toBeDefined();
    expect(retro!.detail).toContain('44 actualizadas');
    expect(retro!.detail).toContain('3 excluidas');
  });

  it('contains security card with UX-only warning', () => {
    const sec = ADMIN_DASHBOARD_CARDS.find((c) => c.id === 'security');
    expect(sec).toBeDefined();
    expect(sec!.status).toContain('UX-only');
    expect(sec!.status).toContain('backend/rules obligatorios');
  });

  it('contains frontend tests card with 130/130', () => {
    const tests = ADMIN_DASHBOARD_CARDS.find((c) => c.id === 'frontend-tests');
    expect(tests).toBeDefined();
    expect(tests!.status).toContain('130/130');
  });

  it('all cards have non-empty id, title, status, detail', () => {
    for (const card of ADMIN_DASHBOARD_CARDS) {
      expect(card.id.length).toBeGreaterThan(0);
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.status.length).toBeGreaterThan(0);
      expect(card.detail.length).toBeGreaterThan(0);
    }
  });

  it('no cards contain write-action keywords', () => {
    const writeKeywords = ['executeWrite', 'applyWrite', 'confirmWrite', 'deleteDoc', 'setDoc', 'updateDoc'];
    for (const card of ADMIN_DASHBOARD_CARDS) {
      const allText = `${card.title} ${card.status} ${card.detail}`;
      for (const keyword of writeKeywords) {
        expect(allText).not.toContain(keyword);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Static source analysis — no write handlers in shell components
// ---------------------------------------------------------------------------

describe('Admin Console Shell — no write patterns in module config', () => {
  it('ADMIN_MODULES does not reference any endpoint or write handler', () => {
    const serialized = JSON.stringify(ADMIN_MODULES);
    expect(serialized).not.toContain('executeWrite');
    expect(serialized).not.toContain('applyWrite');
    expect(serialized).not.toContain('confirmWrite');
    expect(serialized).not.toContain('httpsCallable');
    expect(serialized).not.toContain('setDoc');
    expect(serialized).not.toContain('updateDoc');
    expect(serialized).not.toContain('deleteDoc');
  });
});
