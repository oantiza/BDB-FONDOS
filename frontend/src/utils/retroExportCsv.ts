import type { RetroDryRunResult, RetroRow } from './retroParser';

export type RetrocessionExportMode = 'issues' | 'all';
export type RetrocessionExportFilenameType = 'issues' | 'all';

export type RetrocessionDryRunExportRow = RetroDryRunResult &
  Partial<Pick<
    RetroRow,
    | 'nombre'
    | 'retro_raw'
    | 'retro_parsed_client'
    | 'source'
    | 'cell_internal_value'
    | 'cell_number_format'
  >>;

const CSV_BOM = '\uFEFF';

const CSV_HEADERS = [
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
] as const;

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';

  const text = String(value);
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function hasClientServerMismatch(row: RetrocessionDryRunExportRow): boolean {
  if (!Object.prototype.hasOwnProperty.call(row, 'new_retro_client_reported')) {
    return false;
  }

  const clientValue = row.new_retro_client_reported;
  const backendValue = row.new_retro;

  if (clientValue === null && backendValue === null) return false;
  if (clientValue === null || backendValue === null) return true;

  return Math.abs(clientValue - backendValue) >= 1e-6;
}

export function getRetrocessionIssueRows(
  results: RetrocessionDryRunExportRow[]
): RetrocessionDryRunExportRow[] {
  return results.filter(
    (row) =>
      row.status === 'WARNING' ||
      row.status === 'BLOCKED' ||
      hasClientServerMismatch(row)
  );
}

function rowToCsvValues(row: RetrocessionDryRunExportRow): unknown[] {
  return [
    row.row_number,
    row.source_filename,
    row.isin,
    row.nombre,
    row.firestore_name,
    row.current_retro,
    row.new_retro,
    row.delta,
    row.status,
    row.reason,
    row.action,
    row.source,
    row.retro_raw,
    row.retro_parsed_client ?? row.new_retro_client_reported,
    row.cell_internal_value,
    row.cell_number_format,
  ];
}

export function buildRetrocessionDryRunCsv(
  results: RetrocessionDryRunExportRow[],
  mode: RetrocessionExportMode
): string {
  const rows = mode === 'issues' ? getRetrocessionIssueRows(results) : results;
  const lines = [
    CSV_HEADERS.join(';'),
    ...rows.map((row) => rowToCsvValues(row).map(csvEscape).join(';')),
  ];

  return `${CSV_BOM}${lines.join('\r\n')}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());
  const second = padDatePart(date.getSeconds());

  return `${year}${month}${day}_${hour}${minute}${second}`;
}

export function getRetrocessionExportFilename(
  type: RetrocessionExportFilenameType,
  date = new Date()
): string {
  const prefix =
    type === 'issues'
      ? 'retrocesiones_incidencias'
      : 'retrocesiones_dryrun_completo';

  return `${prefix}_${formatTimestamp(date)}.csv`;
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
