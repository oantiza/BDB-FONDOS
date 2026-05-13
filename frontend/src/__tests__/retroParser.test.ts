/**
 * retroParser.test.ts
 *
 * Tests for the canonical retrocession parser.
 * Covers: normalizeRetrocession, CSV parsing, XLSX format rules, column detection.
 *
 * Per BDB_ADMIN_RETROCESSIONS_DESIGN_0.md section Q (tests obligatorios).
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRetrocession,
  detectColumns,
  parseCSVText,
  isValidISIN,
} from '../utils/retroParser';

// ===========================================================================
// normalizeRetrocession — CSV/string mode (no cellFormat)
// ===========================================================================

describe('normalizeRetrocession — CSV/string mode', () => {
  it('"1,38%" → 1.38 (OK)', () => {
    const r = normalizeRetrocession('1,38%');
    expect(r.value).toBeCloseTo(1.38, 4);
    expect(r.status).toBe('OK');
  });

  it('"0,80%" → 0.80 (OK)', () => {
    const r = normalizeRetrocession('0,80%');
    expect(r.value).toBeCloseTo(0.80, 4);
    expect(r.status).toBe('OK');
  });

  it('"0,0155%" → 0.0155 (OK)', () => {
    const r = normalizeRetrocession('0,0155%');
    expect(r.value).toBeCloseTo(0.0155, 4);
    expect(r.status).toBe('OK');
  });

  it('"1.41" → 1.41 (OK) — decimal estándar sin %', () => {
    const r = normalizeRetrocession('1.41');
    expect(r.value).toBeCloseTo(1.41, 4);
    expect(r.status).toBe('OK');
  });

  it('"0.80" → 0.80 (OK)', () => {
    const r = normalizeRetrocession('0.80');
    expect(r.value).toBeCloseTo(0.80, 4);
    expect(r.status).toBe('OK');
  });

  // Zero is valid (section D)
  it('"0" → 0 (OK) — retro = 0 es VÁLIDA', () => {
    const r = normalizeRetrocession('0');
    expect(r.value).toBe(0);
    expect(r.status).toBe('OK');
  });

  it('"0%" → 0 (OK)', () => {
    const r = normalizeRetrocession('0%');
    expect(r.value).toBe(0);
    expect(r.status).toBe('OK');
  });

  it('"0,00%" → 0 (OK)', () => {
    const r = normalizeRetrocession('0,00%');
    expect(r.value).toBe(0);
    expect(r.status).toBe('OK');
  });

  it('"0.00%" → 0 (OK)', () => {
    const r = normalizeRetrocession('0.00%');
    expect(r.value).toBe(0);
    expect(r.status).toBe('OK');
  });

  // MISSING cases
  it('"" → MISSING', () => {
    const r = normalizeRetrocession('');
    expect(r.value).toBeNull();
    expect(r.status).toBe('MISSING');
  });

  it('null → MISSING', () => {
    const r = normalizeRetrocession(null);
    expect(r.value).toBeNull();
    expect(r.status).toBe('MISSING');
  });

  it('undefined → MISSING', () => {
    const r = normalizeRetrocession(undefined);
    expect(r.value).toBeNull();
    expect(r.status).toBe('MISSING');
  });

  // INVALID cases
  it('"abc" → INVALID', () => {
    const r = normalizeRetrocession('abc');
    expect(r.value).toBeNull();
    expect(r.status).toBe('INVALID');
  });

  it('"-0.5" → INVALID (negative)', () => {
    const r = normalizeRetrocession('-0.5');
    expect(r.value).toBeNull();
    expect(r.status).toBe('INVALID');
  });

  // WARNING — high value
  it('"7.5" → 7.5 + WARNING', () => {
    const r = normalizeRetrocession('7.5');
    expect(r.value).toBeCloseTo(7.5, 4);
    expect(r.status).toBe('WARNING');
    expect(r.reason).toContain('alto');
  });
});

// ===========================================================================
// normalizeRetrocession — Excel mode with cellFormat (C.1)
// ===========================================================================

describe('normalizeRetrocession — Excel cellFormat mode (C.1)', () => {
  it('(0.008, "0.00%") → 0.80 — fraction × 100', () => {
    const r = normalizeRetrocession(0.008, '0.00%');
    expect(r.value).toBeCloseTo(0.80, 4);
    expect(r.status).toBe('OK');
  });

  it('(0, "0.00%") → 0 — zero percentage valid', () => {
    const r = normalizeRetrocession(0, '0.00%');
    expect(r.value).toBe(0);
    expect(r.status).toBe('OK');
  });

  it('(0.50, "0.00%") → 50 — NO size heuristic, format decides', () => {
    // This is the key C.1 test: 0.50 with % format → 50, not 0.50
    // The old code would have used a size heuristic and kept it at 0.50
    const r = normalizeRetrocession(0.50, '0.00%');
    expect(r.value).toBe(50);
    // 50% is > 5 → WARNING
    expect(r.status).toBe('WARNING');
  });

  it('(0.80, "General") → 0.80 — no % format, literal value', () => {
    const r = normalizeRetrocession(0.80, 'General');
    expect(r.value).toBeCloseTo(0.80, 4);
    expect(r.status).toBe('OK');
  });

  it('(0.80, "") → 0.80 — empty format, literal value', () => {
    const r = normalizeRetrocession(0.80, '');
    expect(r.value).toBeCloseTo(0.80, 4);
    expect(r.status).toBe('OK');
  });

  it('(0.80, null) → 0.80 — null format, literal value', () => {
    const r = normalizeRetrocession(0.80, null);
    expect(r.value).toBeCloseTo(0.80, 4);
    expect(r.status).toBe('OK');
  });

  it('(1.38, "0.00") → 1.38 — no % in format', () => {
    const r = normalizeRetrocession(1.38, '0.00');
    expect(r.value).toBeCloseTo(1.38, 4);
    expect(r.status).toBe('OK');
  });

  it('(5, "0.00%") → 500 — coherent with Excel display', () => {
    const r = normalizeRetrocession(5, '0.00%');
    expect(r.value).toBe(500);
    expect(r.status).toBe('WARNING');
  });

  it('(0, "0%") → 0 — zero with short percent format', () => {
    const r = normalizeRetrocession(0, '0%');
    expect(r.value).toBe(0);
    expect(r.status).toBe('OK');
  });

  it('no size heuristic: decision ONLY by format', () => {
    // Same internal value (0.008), different formats
    const withPercent = normalizeRetrocession(0.008, '0.00%');
    const withGeneral = normalizeRetrocession(0.008, 'General');

    expect(withPercent.value).toBeCloseTo(0.80, 4);  // × 100
    expect(withGeneral.value).toBeCloseTo(0.008, 4);  // literal
  });
});

// ===========================================================================
// detectColumns
// ===========================================================================

describe('detectColumns', () => {
  it('detects nombre/isin/retro', () => {
    const m = detectColumns(['nombre', 'isin', 'retro']);
    expect(m).toEqual({ nombre: 0, isin: 1, retro: 2 });
  });

  it('detects English variants', () => {
    const m = detectColumns(['name', 'ISIN', 'retrocession']);
    expect(m).toEqual({ nombre: 0, isin: 1, retro: 2 });
  });

  it('detects fund_name and retrocession_percent', () => {
    const m = detectColumns(['fund_name', 'isin', 'retrocession_percent']);
    expect(m).toEqual({ nombre: 0, isin: 1, retro: 2 });
  });

  it('detects with accents stripped', () => {
    const m = detectColumns(['Retrocesión', 'ISIN', 'Nombre']);
    expect(m).toEqual({ nombre: 2, isin: 1, retro: 0 });
  });

  it('returns null for missing columns', () => {
    const m = detectColumns(['col1', 'col2']);
    expect(m).toEqual({ nombre: null, isin: null, retro: null });
  });
});

// ===========================================================================
// CSV parsing — C.8
// ===========================================================================

describe('parseCSVText — C.8 rules', () => {
  it('parses valid semicolon-separated CSV', () => {
    const csv = 'nombre;isin;retro\nAB FUND;LU0232524495;0,80%\n';
    const r = parseCSVText(csv, 'test.csv');
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].isin).toBe('LU0232524495');
    expect(r.rows[0].retro_raw).toBe('0,80%');
    expect(r.rows[0].retro_parsed_client).toBeCloseTo(0.80, 4);
    expect(r.rows[0].source).toBe('csv');
  });

  it('rejects comma-only separator with ERR_CSV_SEPARATOR', () => {
    const csv = 'nombre,isin,retro\nAB FUND,LU0232524495,0.80\n';
    const r = parseCSVText(csv, 'test.csv');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].code).toBe('ERR_CSV_SEPARATOR');
    expect(r.rows).toHaveLength(0);
  });

  it('ignores empty lines', () => {
    const csv = 'nombre;isin;retro\n\nAB FUND;LU0232524495;0,80%\n\n\n';
    const r = parseCSVText(csv, 'test.csv');
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(1);
  });

  it('handles UTF-8 BOM', () => {
    const csv = '\uFEFFnombre;isin;retro\nFONDO;ES0137381036;0,00%\n';
    const r = parseCSVText(csv, 'test.csv');
    expect(r.errors).toHaveLength(0);
    expect(r.source_encoding).toBe('utf-8-bom');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].retro_parsed_client).toBe(0);
  });

  it('retro = 0 is valid in CSV', () => {
    const csv = 'nombre;isin;retro\nFONDO SIN RETRO;ES0137381036;0\n';
    const r = parseCSVText(csv, 'test.csv');
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].retro_parsed_client).toBe(0);
  });

  it('multiple rows parsed correctly', () => {
    const csv = [
      'nombre;isin;retro',
      'FUND A;LU0232524495;1,38%',
      'FUND B;ES0137381036;0,80%',
      'FUND C;IE00BYR8H148;0',
    ].join('\n');
    const r = parseCSVText(csv, 'multi.csv');
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0].retro_parsed_client).toBeCloseTo(1.38, 4);
    expect(r.rows[1].retro_parsed_client).toBeCloseTo(0.80, 4);
    expect(r.rows[2].retro_parsed_client).toBe(0);
  });

  it('error on missing ISIN column', () => {
    const csv = 'nombre;retro\nFUND;0.80\n';
    const r = parseCSVText(csv, 'test.csv');
    expect(r.errors.some(e => e.code === 'ERR_CSV_NO_ISIN_COLUMN')).toBe(true);
  });

  it('error on missing retro column', () => {
    const csv = 'nombre;isin\nFUND;LU0232524495\n';
    const r = parseCSVText(csv, 'test.csv');
    expect(r.errors.some(e => e.code === 'ERR_CSV_NO_RETRO_COLUMN')).toBe(true);
  });
});

// ===========================================================================
// ISIN validation
// ===========================================================================

describe('isValidISIN', () => {
  it('valid ISIN', () => {
    expect(isValidISIN('LU0232524495')).toBe(true);
    expect(isValidISIN('ES0137381036')).toBe(true);
    expect(isValidISIN('IE00BYR8H148')).toBe(true);
  });

  it('invalid ISIN — too short', () => {
    expect(isValidISIN('LU023252')).toBe(false);
  });

  it('invalid ISIN — wrong format', () => {
    expect(isValidISIN('1234567890AB')).toBe(false);
  });

  it('invalid ISIN — empty', () => {
    expect(isValidISIN('')).toBe(false);
  });
});

// ===========================================================================
// Source security verification — basic export check
// ===========================================================================

describe('retroParser source security — exports', () => {
  it('no Firestore write methods in retroParser module', async () => {
    const FORBIDDEN_IMPORTS = [
      'setDoc',
      'updateDoc',
      'deleteDoc',
      'writeBatch',
      'addDoc',
      'runTransaction',
    ];

    const moduleExports = await import('../utils/retroParser');
    const exportNames = Object.keys(moduleExports);

    for (const forbidden of FORBIDDEN_IMPORTS) {
      expect(exportNames).not.toContain(forbidden);
    }
  });
});

// ===========================================================================
// FIX-3: parseXLSXBuffer — real XLSX buffer tests (C.1, C.15)
// ===========================================================================

import * as XLSX from 'xlsx';
import { parseXLSXBuffer } from '../utils/retroParser';

/**
 * Helper: build a real XLSX buffer with SheetJS for testing parseXLSXBuffer.
 * Sets cell.z (number format) explicitly on retro column cells.
 */
function buildTestXLSXBuffer(
  rows: Array<{ nombre: string; isin: string; retroValue: number; retroFormat: string }>,
  options?: { emptyFirstSheet?: boolean }
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  if (options?.emptyFirstSheet) {
    // Add an empty first sheet, then a second sheet with data
    const emptyWs = XLSX.utils.aoa_to_sheet([['nombre', 'isin', 'retro']]);
    XLSX.utils.book_append_sheet(wb, emptyWs, 'Vacía');

    // Second sheet with actual data
    const dataRows: (string | number)[][] = [['nombre', 'isin', 'retro']];
    rows.forEach((r) => dataRows.push([r.nombre, r.isin, r.retroValue]));
    const dataWs = XLSX.utils.aoa_to_sheet(dataRows);
    // Apply number formats to retro cells (column C, starting row 2)
    rows.forEach((r, idx) => {
      const cellRef = XLSX.utils.encode_cell({ r: idx + 1, c: 2 });
      if (dataWs[cellRef]) {
        dataWs[cellRef].z = r.retroFormat;
      }
    });
    XLSX.utils.book_append_sheet(wb, dataWs, 'Datos');
  } else {
    // Single sheet with data
    const dataRows: (string | number)[][] = [['nombre', 'isin', 'retro']];
    rows.forEach((r) => dataRows.push([r.nombre, r.isin, r.retroValue]));
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    // Apply number formats
    rows.forEach((r, idx) => {
      const cellRef = XLSX.utils.encode_cell({ r: idx + 1, c: 2 });
      if (ws[cellRef]) {
        ws[cellRef].z = r.retroFormat;
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  }

  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return wbout as ArrayBuffer;
}

describe('parseXLSXBuffer — real XLSX buffer tests (C.1)', () => {
  it('xlsx numeric percent: 0.008 with "0.00%" → retro_parsed_client=0.80', () => {
    const buffer = buildTestXLSXBuffer([
      { nombre: 'AB FUND', isin: 'LU0232524495', retroValue: 0.008, retroFormat: '0.00%' },
    ]);

    const result = parseXLSXBuffer(buffer, 'test.xlsx');

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.isin).toBe('LU0232524495');
    expect(row.source).toBe('xlsx');
    expect(row.cell_internal_value).toBeCloseTo(0.008, 6);
    expect(row.cell_number_format).toContain('%');
    expect(row.retro_parsed_client).toBeCloseTo(0.80, 4);
  });

  it('xlsx 0.50 with "0.00%" → retro_parsed_client=50 (NO size heuristic)', () => {
    const buffer = buildTestXLSXBuffer([
      { nombre: 'BIG FUND', isin: 'ES0137381036', retroValue: 0.50, retroFormat: '0.00%' },
    ]);

    const result = parseXLSXBuffer(buffer, 'test.xlsx');

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].retro_parsed_client).toBe(50);
    // Must NOT be 0.50
    expect(result.rows[0].retro_parsed_client).not.toBeCloseTo(0.50, 1);
  });

  it('xlsx zero with "0.00%" → retro_parsed_client=0, not MISSING', () => {
    const buffer = buildTestXLSXBuffer([
      { nombre: 'ZERO FUND', isin: 'IE00BYR8H148', retroValue: 0, retroFormat: '0.00%' },
    ]);

    const result = parseXLSXBuffer(buffer, 'test.xlsx');

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].retro_parsed_client).toBe(0);
    // Explicitly: not null (which would mean MISSING)
    expect(result.rows[0].retro_parsed_client).not.toBeNull();
  });

  it('xlsx multi-sheet: empty sheet 1 + data sheet 2 → WARN_SHEET_SELECTION', () => {
    const buffer = buildTestXLSXBuffer(
      [
        { nombre: 'FUND A', isin: 'LU0232524495', retroValue: 0.008, retroFormat: '0.00%' },
      ],
      { emptyFirstSheet: true }
    );

    const result = parseXLSXBuffer(buffer, 'multi_sheet.xlsx');

    // Must NOT silently process empty sheet 1
    // Should return error/warning about sheet selection
    expect(result.rows).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    const sheetError = result.errors.find(
      (e) => e.code === 'WARN_SHEET_SELECTION'
    );
    expect(sheetError).toBeDefined();
    expect(sheetError!.message).toContain('Datos');
  });

  it('xlsx with General format: value is literal (no multiply)', () => {
    const buffer = buildTestXLSXBuffer([
      { nombre: 'LITERAL FUND', isin: 'LU0232524495', retroValue: 1.38, retroFormat: 'General' },
    ]);

    const result = parseXLSXBuffer(buffer, 'test.xlsx');

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].retro_parsed_client).toBeCloseTo(1.38, 4);
    expect(result.rows[0].cell_number_format).toBe('General');
  });
});

// ===========================================================================
// FIX-4: Source security — full file scan for write methods
// ===========================================================================

import * as fs from 'fs';
import * as path from 'path';

describe('source security — no Firestore write methods in retro modules', () => {
  const FORBIDDEN_PATTERNS = [
    'setDoc(',
    'updateDoc(',
    'deleteDoc(',
    'writeBatch(',
    'addDoc(',
    'runTransaction(',
  ];

  const RETRO_MODULE_FILES = [
    'src/utils/retroParser.ts',
    'src/services/adminRetroService.ts',
    'src/components/admin/RetrocessionManager.tsx',
    'src/components/admin/RetroPreviewTable.tsx',
    'src/components/admin/RetroSummaryCards.tsx',
  ];

  // Resolve relative to project root (frontend/)
  const frontendRoot = path.resolve(__dirname, '..', '..');

  RETRO_MODULE_FILES.forEach((filePath) => {
    it(`${filePath} contains no Firestore write calls`, () => {
      const fullPath = path.join(frontendRoot, filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(content).not.toContain(pattern);
      }
    });
  });
});
