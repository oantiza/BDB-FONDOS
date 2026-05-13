/**
 * retroWritePanel.test.tsx
 *
 * Tests for the WritePanel — the Apply retrocesiones flow (WRITE-MVP-0).
 *
 * Covers:
 *  - Apply button disabled when BLOCKED rows present
 *  - Apply button disabled when writes_planned == 0
 *  - Modal opens on click and shows summary, zero-retro callout, big-change list
 *  - Submit disabled until: reason ≥3 chars, confirm checkbox, all warnings acked
 *  - retro=0 shown as applicable
 *  - Success path: executeWrite returns response, audit_id shown, button locks
 *  - Error path: dry-run results remain visible, error message shown
 *
 * Per-file environment: jsdom (the project default is node for non-UI tests).
 * Matchers (toBeInTheDocument, toBeEnabled, etc.) registered via jest-dom/vitest.
 */
// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the service before importing WritePanel
const mockExecuteWrite = vi.fn();
vi.mock('../services/adminRetroService', () => ({
  executeWrite: (...args: any[]) => mockExecuteWrite(...args),
  // Other exports re-stubbed minimally (not used by WritePanel directly)
  executeDryRun: vi.fn(),
  searchFundByISIN: vi.fn(),
}));

import { WritePanel } from '../components/admin/RetrocessionManager';
import type {
  RetroDryRunResponse,
  RetroDryRunResult,
  RetroRow,
} from '../utils/retroParser';

function makeResult(overrides: Partial<RetroDryRunResult>): RetroDryRunResult {
  return {
    isin: 'ES0137381036',
    firestore_name: 'Fondo X',
    current_retro: 0.5,
    new_retro: 0.8,
    new_retro_client_reported: 0.8,
    delta: 0.3,
    status: 'OK',
    reason: '',
    action: 'UPDATE_DRY_RUN',
    row_number: 1,
    source_filename: 'test.csv',
    ...overrides,
  };
}

function makeDryRun(results: RetroDryRunResult[]): RetroDryRunResponse {
  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === 'OK').length,
    warning: results.filter((r) => r.status === 'WARNING').length,
    blocked: results.filter((r) => r.status === 'BLOCKED').length,
    unchanged: results.filter((r) => r.status === 'UNCHANGED').length,
    client_server_normalization_mismatches: 0,
  };
  return {
    mode: 'DRY_RUN_READ_ONLY',
    results,
    summary,
    manifest_id: 'manifest_test_abc',
    manifest_created_at: '2026-05-13T10:00:00Z',
    manifest_ttl_seconds: 86400,
    manifest_expires_at: '2026-05-14T10:00:00Z',
    confirmation_phrase_expected: 'BDB-RETRO-WRITE-abc-1',
  };
}

function makeRow(overrides: Partial<RetroRow> = {}): RetroRow {
  return {
    isin: 'ES0137381036',
    nombre: 'Fondo X',
    retro_raw: '0,80%',
    retro_parsed_client: 0.8,
    source: 'csv',
    cell_internal_value: null,
    cell_number_format: null,
    row_number: 1,
    source_filename: 'test.csv',
    ...overrides,
  };
}

beforeEach(() => {
  mockExecuteWrite.mockReset();
});

describe('WritePanel — button state', () => {
  it('renders Apply button enabled when OK rows present', () => {
    const dryRun = makeDryRun([makeResult({})]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow()]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    const btn = screen.getByLabelText('Aplicar retrocesiones');
    expect(btn).toBeEnabled();
    expect(btn.textContent).toContain('Aplicar');
  });

  it('disables Apply button when BLOCKED row present', () => {
    const dryRun = makeDryRun([
      makeResult({}),
      makeResult({ isin: 'ES0000000000', status: 'BLOCKED', reason: 'FUND_NOT_FOUND' }),
    ]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow(), makeRow({ isin: 'ES0000000000' })]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    const btn = screen.getByLabelText('Aplicar retrocesiones');
    expect(btn).toBeDisabled();
    expect(screen.getByText(/filas BLOCKED/i)).toBeInTheDocument();
  });

  it('disables Apply button when no applicable changes (only UNCHANGED)', () => {
    const dryRun = makeDryRun([
      makeResult({
        status: 'UNCHANGED',
        new_retro: 0.5,
        delta: 0,
        action: 'NO_CHANGE',
      }),
    ]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow()]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    const btn = screen.getByLabelText('Aplicar retrocesiones');
    expect(btn).toBeDisabled();
    expect(screen.getByText(/No hay cambios aplicables/i)).toBeInTheDocument();
  });

  it('retro=0 OK row is counted as applicable', () => {
    const dryRun = makeDryRun([
      makeResult({ current_retro: 0.5, new_retro: 0, delta: -0.5 }),
    ]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow({ retro_raw: '0', retro_parsed_client: 0 })]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    const btn = screen.getByLabelText('Aplicar retrocesiones');
    expect(btn).toBeEnabled();
    // Button label includes count of 1
    expect(btn.textContent).toContain('(1)');
  });
});

describe('WritePanel — confirmation modal', () => {
  it('opens modal on click and shows summary', () => {
    const dryRun = makeDryRun([
      makeResult({ current_retro: 0.5, new_retro: 0, delta: -0.5 }),
    ]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow({ retro_raw: '0', retro_parsed_client: 0 })]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    fireEvent.click(screen.getByLabelText('Aplicar retrocesiones'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Resumen del lote/i)).toBeInTheDocument();
    // retro=0 callout
    expect(screen.getByText(/Retrocesiones a 0/i)).toBeInTheDocument();
  });

  it('submit button is disabled until motivo + confirm checkbox', async () => {
    const dryRun = makeDryRun([makeResult({})]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow()]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    fireEvent.click(screen.getByLabelText('Aplicar retrocesiones'));

    const submitBtn = screen.getByLabelText('Confirmar y aplicar');
    expect(submitBtn).toBeDisabled();

    // Type reason ≥3 chars
    fireEvent.change(screen.getByLabelText(/Motivo de la carga/i), {
      target: { value: 'mayo 2026' },
    });
    expect(submitBtn).toBeDisabled(); // still disabled without confirm

    // Click final confirm checkbox
    fireEvent.click(screen.getByLabelText('Confirmo aplicar retrocesiones'));
    expect(submitBtn).toBeEnabled();
  });

  it('submit disabled with too-short reason (<3 chars)', () => {
    const dryRun = makeDryRun([makeResult({})]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow()]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    fireEvent.click(screen.getByLabelText('Aplicar retrocesiones'));

    fireEvent.change(screen.getByLabelText(/Motivo de la carga/i), {
      target: { value: 'ok' },
    });
    fireEvent.click(screen.getByLabelText('Confirmo aplicar retrocesiones'));

    expect(screen.getByLabelText('Confirmar y aplicar')).toBeDisabled();
  });

  it('WARNING rows require per-isin ack or ack-all', () => {
    const dryRun = makeDryRun([
      makeResult({
        status: 'WARNING',
        reason: 'Valor alto',
        new_retro: 7.5,
        delta: 7,
      }),
    ]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow({ retro_raw: '7,50%', retro_parsed_client: 7.5 })]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    fireEvent.click(screen.getByLabelText('Aplicar retrocesiones'));
    fireEvent.change(screen.getByLabelText(/Motivo de la carga/i), {
      target: { value: 'aceptar valor alto' },
    });
    fireEvent.click(screen.getByLabelText('Confirmo aplicar retrocesiones'));

    const submit = screen.getByLabelText('Confirmar y aplicar');
    expect(submit).toBeDisabled();
    // Ack-all enables it
    fireEvent.click(screen.getByLabelText('Acepto todos los warnings'));
    expect(submit).toBeEnabled();
  });

  it('WARNING per-isin ack also enables submit', () => {
    const dryRun = makeDryRun([
      makeResult({
        isin: 'ES0137381036',
        status: 'WARNING',
        reason: 'Cambio grande',
        new_retro: 1.5,
        delta: 1.0,
      }),
    ]);
    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow()]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    fireEvent.click(screen.getByLabelText('Aplicar retrocesiones'));
    fireEvent.change(screen.getByLabelText(/Motivo de la carga/i), {
      target: { value: 'aceptar cambio grande' },
    });
    fireEvent.click(screen.getByLabelText('Confirmo aplicar retrocesiones'));
    fireEvent.click(screen.getByLabelText('Acuse warning ES0137381036'));
    expect(screen.getByLabelText('Confirmar y aplicar')).toBeEnabled();
  });
});

describe('WritePanel — submit flow', () => {
  it('success path shows audit_id and locks the button', async () => {
    const dryRun = makeDryRun([makeResult({})]);
    mockExecuteWrite.mockResolvedValueOnce({
      mode: 'WRITE_EXECUTED',
      audit_id: 'audit_xyz_123',
      writes_executed: 1,
      writes_failed: 0,
      writes_planned: 1,
      unchanged_count: 0,
      isins_updated: ['ES0137381036'],
      write_failures: [],
    });

    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow()]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    fireEvent.click(screen.getByLabelText('Aplicar retrocesiones'));
    fireEvent.change(screen.getByLabelText(/Motivo de la carga/i), {
      target: { value: 'mayo 2026' },
    });
    fireEvent.click(screen.getByLabelText('Confirmo aplicar retrocesiones'));
    fireEvent.click(screen.getByLabelText('Confirmar y aplicar'));

    await waitFor(() => {
      expect(screen.getByText(/audit_xyz_123/)).toBeInTheDocument();
    });
    // Apply button is locked
    expect(screen.getByLabelText('Aplicar retrocesiones')).toBeDisabled();
  });

  it('error path keeps dry-run visible, shows error, does not lock button', async () => {
    const dryRun = makeDryRun([makeResult({})]);
    mockExecuteWrite.mockRejectedValueOnce(new Error('Network down'));

    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow()]}
        source="csv"
        sourceFilename="test.csv"
      />
    );
    fireEvent.click(screen.getByLabelText('Aplicar retrocesiones'));
    fireEvent.change(screen.getByLabelText(/Motivo de la carga/i), {
      target: { value: 'mayo 2026' },
    });
    fireEvent.click(screen.getByLabelText('Confirmo aplicar retrocesiones'));
    fireEvent.click(screen.getByLabelText('Confirmar y aplicar'));

    await waitFor(() => {
      expect(screen.getByText(/Network down/)).toBeInTheDocument();
    });
    // Modal still open; no success banner
    expect(screen.queryByText(/Escritura completada/)).not.toBeInTheDocument();
    // Apply button still actionable
    expect(screen.getByLabelText('Confirmar y aplicar')).toBeEnabled();
  });

  it('payload sent to executeWrite carries reason and warning_acks', async () => {
    const dryRun = makeDryRun([
      makeResult({
        status: 'WARNING',
        reason: 'high value',
        new_retro: 7.5,
        delta: 7,
      }),
    ]);
    mockExecuteWrite.mockResolvedValueOnce({
      mode: 'WRITE_EXECUTED',
      audit_id: 'audit_abc',
      writes_executed: 1,
      writes_failed: 0,
      writes_planned: 1,
      unchanged_count: 0,
      isins_updated: ['ES0137381036'],
      write_failures: [],
    });

    render(
      <WritePanel
        dryRunResult={dryRun}
        rows={[makeRow({ retro_raw: '7,50%', retro_parsed_client: 7.5 })]}
        source="csv"
        sourceFilename="lote_mayo.csv"
      />
    );
    fireEvent.click(screen.getByLabelText('Aplicar retrocesiones'));
    fireEvent.change(screen.getByLabelText(/Motivo de la carga/i), {
      target: { value: 'carga manual mayo' },
    });
    fireEvent.click(screen.getByLabelText('Confirmo aplicar retrocesiones'));
    fireEvent.click(screen.getByLabelText('Acepto todos los warnings'));
    fireEvent.click(screen.getByLabelText('Confirmar y aplicar'));

    await waitFor(() => {
      expect(mockExecuteWrite).toHaveBeenCalled();
    });
    const payload = mockExecuteWrite.mock.calls[0][0];
    expect(payload.source).toBe('csv');
    expect(payload.sourceFilename).toBe('lote_mayo.csv');
    expect(payload.dryRunManifestId).toBe('manifest_test_abc');
    expect(payload.reason).toBe('carga manual mayo');
    expect(payload.warningAcks).toContain('ES0137381036');
  });
});
