import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildRetrocessionDryRunCsv,
  csvEscape,
  getRetrocessionExportFilename,
  getRetrocessionIssueRows,
} from '../utils/retroExportCsv';
import type { RetrocessionDryRunExportRow } from '../utils/retroExportCsv';

const EXPECTED_HEADERS = [
  'row_number',
  'source_filename',
  'isin',
  'nombre_archivo',
  'nombre_firestore',
  'retro_actual',
  'retro_nueva',
  'delta',
  'status',
  'reason',
  'action',
  'source',
  'retro_raw',
  'retro_parsed_client',
  'cell_internal_value',
  'cell_number_format',
];

function makeRow(
  overrides: Partial<RetrocessionDryRunExportRow> = {}
): RetrocessionDryRunExportRow {
  return {
    row_number: 1,
    source_filename: 'retro.csv',
    isin: 'LU0000000001',
    nombre: 'Fondo archivo',
    firestore_name: 'Fondo Firestore',
    current_retro: 0.5,
    new_retro: 0.8,
    new_retro_client_reported: 0.8,
    delta: 0.3,
    status: 'OK',
    reason: '',
    action: 'UPDATE_DRY_RUN',
    source: 'csv',
    retro_raw: '0,80',
    retro_parsed_client: 0.8,
    cell_internal_value: null,
    cell_number_format: null,
    ...overrides,
  };
}

function stripBom(csv: string): string {
  return csv.replace(/^\uFEFF/, '');
}

describe('csvEscape', () => {
  it('keeps normal values as plain text', () => {
    expect(csvEscape('LU0000000001')).toBe('LU0000000001');
  });

  it('wraps values with semicolons', () => {
    expect(csvEscape('Fondo; Clase A')).toBe('"Fondo; Clase A"');
  });

  it('escapes double quotes', () => {
    expect(csvEscape('Fondo "A"')).toBe('"Fondo ""A"""');
  });

  it('wraps values with line breaks', () => {
    expect(csvEscape('Linea 1\nLinea 2')).toBe('"Linea 1\nLinea 2"');
  });

  it('renders null and undefined as empty strings', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
});

describe('buildRetrocessionDryRunCsv', () => {
  it('starts with UTF-8 BOM', () => {
    const csv = buildRetrocessionDryRunCsv([makeRow()], 'all');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('uses semicolon as separator', () => {
    const csv = stripBom(buildRetrocessionDryRunCsv([makeRow()], 'all'));
    expect(csv.split('\r\n')[0]).toContain('row_number;source_filename;isin');
  });

  it('includes the expected headers', () => {
    const csv = stripBom(buildRetrocessionDryRunCsv([makeRow()], 'all'));
    expect(csv.split('\r\n')[0]).toBe(EXPECTED_HEADERS.join(';'));
  });

  it('issue mode includes WARNING and BLOCKED and excludes OK and UNCHANGED', () => {
    const rows = [
      makeRow({ isin: 'LU0000000001', status: 'OK' }),
      makeRow({ isin: 'LU0000000002', status: 'WARNING', reason: 'warning' }),
      makeRow({ isin: 'LU0000000003', status: 'BLOCKED', reason: 'blocked', action: 'SKIP' }),
      makeRow({ isin: 'LU0000000004', status: 'UNCHANGED', action: 'NO_CHANGE' }),
    ];

    const issueRows = getRetrocessionIssueRows(rows);
    const issueCsv = buildRetrocessionDryRunCsv(rows, 'issues');

    expect(issueRows.map((row) => row.status)).toEqual(['WARNING', 'BLOCKED']);
    expect(issueCsv).toContain('LU0000000002');
    expect(issueCsv).toContain('LU0000000003');
    expect(issueCsv).not.toContain('LU0000000001');
    expect(issueCsv).not.toContain('LU0000000004');
  });

  it('all mode includes OK, WARNING, BLOCKED and UNCHANGED', () => {
    const csv = buildRetrocessionDryRunCsv(
      [
        makeRow({ isin: 'LU0000000001', status: 'OK' }),
        makeRow({ isin: 'LU0000000002', status: 'WARNING' }),
        makeRow({ isin: 'LU0000000003', status: 'BLOCKED', action: 'SKIP' }),
        makeRow({ isin: 'LU0000000004', status: 'UNCHANGED', action: 'NO_CHANGE' }),
      ],
      'all'
    );

    expect(csv).toContain('LU0000000001');
    expect(csv).toContain('LU0000000002');
    expect(csv).toContain('LU0000000003');
    expect(csv).toContain('LU0000000004');
  });
});

describe('getRetrocessionExportFilename', () => {
  it('contains the type and timestamp', () => {
    const date = new Date(2026, 4, 13, 9, 8, 7);

    expect(getRetrocessionExportFilename('issues', date)).toBe(
      'retrocesiones_incidencias_20260513_090807.csv'
    );
    expect(getRetrocessionExportFilename('all', date)).toBe(
      'retrocesiones_dryrun_completo_20260513_090807.csv'
    );
  });
});

describe('retro export security', () => {
  it('does not contain direct Firestore write calls in touched source files', () => {
    const sourcePaths = [
      path.resolve(__dirname, '../utils/retroExportCsv.ts'),
      path.resolve(__dirname, '../components/admin/RetrocessionManager.tsx'),
    ];
    const terms = [
      'set' + 'Doc',
      'update' + 'Doc',
      'delete' + 'Doc',
      'write' + 'Batch',
      'add' + 'Doc',
      'run' + 'Transaction',
    ];
    const forbidden = new RegExp(terms.join('|'));

    for (const sourcePath of sourcePaths) {
      expect(fs.readFileSync(sourcePath, 'utf-8')).not.toMatch(forbidden);
    }
  });
});
