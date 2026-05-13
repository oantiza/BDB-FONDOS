/**
 * retroParser.ts
 *
 * Canonical retrocession parsing module for the Admin Console.
 *
 * Implements:
 * - normalizeRetrocession(raw, cellFormat?) — C.1, C.2
 * - parseCSVText(text, filename) — C.8
 * - parseXLSXBuffer(buffer, filename) — C.1, C.15
 * - detectColumns(headers) — header mapping
 *
 * CANON (BDB_ADMIN_RETROCESSIONS_DESIGN_0.md):
 *   manual.costs.retrocession = porcentaje directo en puntos porcentuales
 *   0 = retro válida (NOT error, NOT empty)
 *   NO multiply/divide by 100 (except C.1 Excel cell format rule)
 *   NO size-based heuristics
 *
 * SECURITY:
 *   - NO Firestore imports (setDoc, updateDoc, deleteDoc, writeBatch)
 *   - NO direct Firestore access
 *   - Pure parsing logic only
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NormalizationStatus = 'OK' | 'WARNING' | 'MISSING' | 'INVALID';

export interface NormalizationResult {
  value: number | null;
  status: NormalizationStatus;
  reason?: string;
}

export interface RetroRow {
  isin: string;
  nombre: string;
  retro_raw: string;
  retro_parsed_client: number | null;
  source: 'csv' | 'xlsx';
  cell_internal_value: number | null;
  cell_number_format: string | null;
  row_number: number;
  source_filename: string;
}

export interface ParseFileError {
  code: string;
  message: string;
}

export interface ParseResult {
  rows: RetroRow[];
  errors: ParseFileError[];
  source_encoding?: string;
  warnings: string[];
}

export interface RetroDryRunResult {
  isin: string;
  firestore_name: string;
  current_retro: number | null;
  new_retro: number | null;
  new_retro_client_reported: number | null;
  delta: number | null;
  status: 'OK' | 'WARNING' | 'BLOCKED' | 'UNCHANGED';
  reason: string;
  action: 'UPDATE_DRY_RUN' | 'NO_CHANGE' | 'SKIP';
  row_number: number;
  source_filename: string;
}

export interface RetroDryRunSummary {
  total: number;
  ok: number;
  warning: number;
  blocked: number;
  unchanged: number;
  client_server_normalization_mismatches: number;
}

export interface RetroDryRunResponse {
  mode: 'DRY_RUN_READ_ONLY';
  results: RetroDryRunResult[];
  summary: RetroDryRunSummary;
  manifest_id: string;
  manifest_created_at: string;
  manifest_ttl_seconds: number;
  manifest_expires_at: string;
  confirmation_phrase_expected: string;
}

// ---------------------------------------------------------------------------
// Column detection — header normalization and mapping
// ---------------------------------------------------------------------------

const COLUMN_MAP: Record<string, string> = {
  nombre: 'nombre',
  name: 'nombre',
  fund_name: 'nombre',
  fundname: 'nombre',
  isin: 'isin',
  retro: 'retro',
  retrocesion: 'retro',
  retrocession: 'retro',
  retrocession_percent: 'retro',
  retro_percent: 'retro',
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, '_');
}

export interface ColumnMapping {
  nombre: number | null;
  isin: number | null;
  retro: number | null;
}

/**
 * Detect column indices from an array of header strings.
 */
export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { nombre: null, isin: null, retro: null };

  headers.forEach((h, idx) => {
    const normalized = normalizeHeader(h);
    const mapped = COLUMN_MAP[normalized];
    if (mapped && mapping[mapped as keyof ColumnMapping] === null) {
      (mapping as unknown as Record<string, number | null>)[mapped] = idx;
    }
  });

  return mapping;
}

// ---------------------------------------------------------------------------
// normalizeRetrocession — C.1, C.2 canonical normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw retrocession value to percentage points.
 *
 * CANON:
 *   "1,38%" → 1.38
 *   "0,80%" → 0.80
 *   "0"     → 0 (VALID, not error)
 *   ""      → MISSING
 *   "abc"   → INVALID
 *   "-0.5"  → INVALID (negative)
 *
 * For XLSX with cellFormat containing "%":
 *   The cell internal value is a fraction (e.g. 0.008 for 0.80%).
 *   We multiply by 100 to get percentage points.
 *   Decision is EXCLUSIVELY based on cellFormat containing "%".
 *   NO size-based heuristic. NO threshold like < 0.20.
 *
 * @param raw - Original string value or number from the file
 * @param cellFormat - Optional: Excel cell number format (e.g. "0.00%", "General")
 */
export function normalizeRetrocession(
  raw: string | number | null | undefined,
  cellFormat?: string | null
): NormalizationResult {
  // Handle null/undefined/empty
  if (raw === null || raw === undefined) {
    return { value: null, status: 'MISSING', reason: 'Valor vacío (null/undefined)' };
  }

  // If it's a number (e.g. from XLSX cell.v)
  if (typeof raw === 'number') {
    if (isNaN(raw)) {
      return { value: null, status: 'INVALID', reason: 'Valor no numérico (NaN)' };
    }

    // C.1: Excel format rule — decision ONLY based on cellFormat
    let finalValue = raw;
    if (cellFormat && cellFormat.includes('%')) {
      finalValue = raw * 100;
    }

    // Round to 4 decimals (C.11)
    finalValue = Math.round(finalValue * 10000) / 10000;

    if (finalValue < 0) {
      return { value: null, status: 'INVALID', reason: `Retrocesión negativa: ${finalValue}` };
    }

    const result: NormalizationResult = { value: finalValue, status: 'OK' };
    if (finalValue > 5) {
      result.status = 'WARNING';
      result.reason = `Valor alto: ${finalValue}% — verificar`;
    }
    return result;
  }

  // String processing
  const trimmed = String(raw).trim();

  if (trimmed === '') {
    return { value: null, status: 'MISSING', reason: 'Valor vacío (string vacío)' };
  }

  // Remove percentage sign and whitespace
  let cleaned = trimmed.replace(/%\s*$/, '').trim();

  // Replace comma decimal separator with dot
  cleaned = cleaned.replace(',', '.');

  // Try to parse as number
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return { value: null, status: 'INVALID', reason: `Valor no numérico: "${trimmed}"` };
  }

  // Round to 4 decimals (C.11)
  const finalValue = Math.round(parsed * 10000) / 10000;

  if (finalValue < 0) {
    return { value: null, status: 'INVALID', reason: `Retrocesión negativa: ${finalValue}` };
  }

  const result: NormalizationResult = { value: finalValue, status: 'OK' };
  if (finalValue > 5) {
    result.status = 'WARNING';
    result.reason = `Valor alto: ${finalValue}% — verificar`;
  }
  return result;
}

// ---------------------------------------------------------------------------
// ISIN validation
// ---------------------------------------------------------------------------

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export function isValidISIN(isin: string): boolean {
  return ISIN_REGEX.test(isin.trim().toUpperCase());
}

// ---------------------------------------------------------------------------
// CSV parsing — C.8
// ---------------------------------------------------------------------------

/**
 * Check if a CSV text uses comma as the sole separator (not semicolon).
 * If so, it should be rejected with ERR_CSV_SEPARATOR.
 */
function detectSeparatorIssue(text: string): boolean {
  // Get first non-empty line (likely the header)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;

  const headerLine = lines[0];
  const hasSemicolon = headerLine.includes(';');
  const hasComma = headerLine.includes(',');

  // If no semicolons but has commas, it's using comma separator
  if (!hasSemicolon && hasComma) {
    return true; // ERR_CSV_SEPARATOR
  }

  return false;
}

/**
 * Parse CSV text with PapaParse. Separator: semicolon only (C.8).
 */
export function parseCSVText(text: string, filename: string): ParseResult {
  const result: ParseResult = { rows: [], errors: [], warnings: [] };

  // C.8: Reject comma-only separator
  if (detectSeparatorIssue(text)) {
    result.errors.push({
      code: 'ERR_CSV_SEPARATOR',
      message: 'Separador no soportado; usar ";" — el archivo usa "," como separador',
    });
    return result;
  }

  // Strip BOM if present
  let cleanText = text;
  let encoding = 'utf-8';
  if (text.charCodeAt(0) === 0xfeff) {
    cleanText = text.substring(1);
    encoding = 'utf-8-bom';
  }
  result.source_encoding = encoding;

  // Parse with PapaParse
  const parsed = Papa.parse(cleanText, {
    delimiter: ';',
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (!parsed.data || parsed.data.length === 0) {
    result.errors.push({
      code: 'ERR_CSV_EMPTY',
      message: 'El archivo CSV no contiene filas de datos',
    });
    return result;
  }

  // Detect columns from headers
  const headers = parsed.meta.fields || [];
  const columnMap = detectColumns(headers);

  if (columnMap.isin === null) {
    result.errors.push({
      code: 'ERR_CSV_NO_ISIN_COLUMN',
      message: 'No se detectó columna ISIN en las cabeceras',
    });
    return result;
  }

  if (columnMap.retro === null) {
    result.errors.push({
      code: 'ERR_CSV_NO_RETRO_COLUMN',
      message: 'No se detectó columna de retrocesión en las cabeceras',
    });
    return result;
  }

  // Process rows
  const rawHeaders = parsed.meta.fields || [];
  const isinHeader = rawHeaders[columnMap.isin];
  const retroHeader = columnMap.retro !== null ? rawHeaders[columnMap.retro] : null;
  const nombreHeader = columnMap.nombre !== null ? rawHeaders[columnMap.nombre] : null;

  (parsed.data as Record<string, string>[]).forEach((row, idx) => {
    const isinVal = (row[isinHeader] || '').trim().toUpperCase();
    const retroRaw = retroHeader ? (row[retroHeader] || '').trim() : '';
    const nombre = nombreHeader ? (row[nombreHeader] || '').trim() : '';

    // Skip rows where all mapped columns are empty
    if (!isinVal && !retroRaw && !nombre) {
      return;
    }

    const norm = normalizeRetrocession(retroRaw);

    const retroRow: RetroRow = {
      isin: isinVal,
      nombre,
      retro_raw: retroRaw,
      retro_parsed_client: norm.value,
      source: 'csv',
      cell_internal_value: null,
      cell_number_format: null,
      row_number: idx + 2, // +2: 1-indexed + header row
      source_filename: filename,
    };

    result.rows.push(retroRow);
  });

  return result;
}

// ---------------------------------------------------------------------------
// XLSX parsing — C.1, C.15
// ---------------------------------------------------------------------------

/**
 * Parse an XLSX ArrayBuffer using SheetJS.
 * Exposes cell.v (raw value) and cell.z (number format) for C.1 rule.
 */
export function parseXLSXBuffer(buffer: ArrayBuffer, filename: string): ParseResult {
  const result: ParseResult = { rows: [], errors: [], warnings: [] };

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellNF: true, cellText: true });
  } catch (e) {
    result.errors.push({
      code: 'ERR_XLSX_PARSE',
      message: `Error al leer el archivo XLSX: ${e instanceof Error ? e.message : String(e)}`,
    });
    return result;
  }

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    result.errors.push({
      code: 'ERR_XLSX_NO_SHEETS',
      message: 'El archivo XLSX no contiene hojas',
    });
    return result;
  }

  // Use first sheet
  const firstSheet = workbook.Sheets[sheetNames[0]];
  const firstSheetData = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  // C.15: Check if first sheet is empty and others have data
  const firstSheetDataRows = firstSheetData.filter(
    (row) => row.some((cell) => String(cell).trim() !== '')
  );

  if (firstSheetDataRows.length <= 1 && sheetNames.length > 1) {
    // Check other sheets for data
    const sheetsWithData: string[] = [];
    for (let i = 1; i < sheetNames.length; i++) {
      const sheet = workbook.Sheets[sheetNames[i]];
      const sheetData = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });
      const dataRows = sheetData.filter(
        (row) => row.some((cell) => String(cell).trim() !== '')
      );
      if (dataRows.length > 1) {
        sheetsWithData.push(sheetNames[i]);
      }
    }

    if (sheetsWithData.length > 0) {
      result.errors.push({
        code: 'WARN_SHEET_SELECTION',
        message: `La hoja 1 está vacía pero existen otras hojas con datos: [${sheetsWithData.join(', ')}]`,
      });
      return result;
    }
  }

  if (firstSheetDataRows.length === 0) {
    result.errors.push({
      code: 'ERR_XLSX_EMPTY',
      message: 'La hoja no contiene datos',
    });
    return result;
  }

  // Extract headers from first row
  const headers = firstSheetDataRows[0].map((h) => String(h).trim());
  const columnMap = detectColumns(headers);

  if (columnMap.isin === null) {
    result.errors.push({
      code: 'ERR_XLSX_NO_ISIN_COLUMN',
      message: 'No se detectó columna ISIN en las cabeceras',
    });
    return result;
  }

  if (columnMap.retro === null) {
    result.errors.push({
      code: 'ERR_XLSX_NO_RETRO_COLUMN',
      message: 'No se detectó columna de retrocesión en las cabeceras',
    });
    return result;
  }

  // Process data rows (skip header)
  const ref = firstSheet['!ref'];
  if (!ref) {
    result.errors.push({
      code: 'ERR_XLSX_NO_REF',
      message: 'La hoja no tiene rango definido',
    });
    return result;
  }

  const range = XLSX.utils.decode_range(ref);

  for (let rowIdx = range.s.r + 1; rowIdx <= range.e.r; rowIdx++) {
    const isinColIdx = columnMap.isin!;
    const retroColIdx = columnMap.retro!;
    const nombreColIdx = columnMap.nombre;

    // Get ISIN cell
    const isinCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: isinColIdx });
    const isinCell = firstSheet[isinCellRef];
    const isinVal = isinCell ? String(isinCell.v ?? '').trim().toUpperCase() : '';

    // Get retro cell — need raw value and format
    const retroCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: retroColIdx });
    const retroCell = firstSheet[retroCellRef];

    // Get nombre cell
    let nombre = '';
    if (nombreColIdx !== null) {
      const nombreCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: nombreColIdx });
      const nombreCell = firstSheet[nombreCellRef];
      nombre = nombreCell ? String(nombreCell.v ?? '').trim() : '';
    }

    // Skip entirely empty rows
    if (!isinVal && !retroCell && !nombre) {
      continue;
    }

    // Extract cell metadata for C.1
    let retroRaw = '';
    let cellInternalValue: number | null = null;
    let cellNumberFormat: string | null = null;

    if (retroCell) {
      // cell.z = number format, cell.v = raw value
      cellNumberFormat = retroCell.z || null;
      const rawValue = retroCell.v;

      if (typeof rawValue === 'number') {
        cellInternalValue = rawValue;
        // Use the formatted text for retro_raw
        retroRaw = retroCell.w ? String(retroCell.w) : String(rawValue);
      } else if (rawValue !== undefined && rawValue !== null) {
        retroRaw = String(rawValue).trim();
      }
    }

    // Normalize: if numeric cell, pass through with format for C.1 rule
    let norm: NormalizationResult;
    if (cellInternalValue !== null) {
      norm = normalizeRetrocession(cellInternalValue, cellNumberFormat);
    } else {
      norm = normalizeRetrocession(retroRaw);
    }

    const retroRow: RetroRow = {
      isin: isinVal,
      nombre,
      retro_raw: retroRaw,
      retro_parsed_client: norm.value,
      source: 'xlsx',
      cell_internal_value: cellInternalValue,
      cell_number_format: cellNumberFormat,
      row_number: rowIdx + 1, // 1-indexed
      source_filename: filename,
    };

    result.rows.push(retroRow);
  }

  return result;
}

// ---------------------------------------------------------------------------
// File reading helpers
// ---------------------------------------------------------------------------

/**
 * Read a File object and detect encoding (C.8).
 * Returns the text content for CSV files.
 */
export async function readFileAsText(file: File): Promise<{ text: string; encoding: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check for UTF-8 BOM
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const text = new TextDecoder('utf-8').decode(buffer);
    return { text, encoding: 'utf-8-bom' };
  }

  // Try UTF-8 first
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const text = decoder.decode(buffer);
    return { text, encoding: 'utf-8' };
  } catch {
    // Fallback to latin-1
    const text = new TextDecoder('iso-8859-1').decode(buffer);
    return { text, encoding: 'latin-1' };
  }
}

/**
 * Parse a file (CSV or XLSX) and return structured rows.
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase();

  if (ext === 'csv' || ext === 'txt') {
    const { text, encoding } = await readFileAsText(file);
    const result = parseCSVText(text, filename);
    result.source_encoding = encoding;
    return result;
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    return parseXLSXBuffer(buffer, filename);
  }

  return {
    rows: [],
    errors: [
      {
        code: 'ERR_UNSUPPORTED_FORMAT',
        message: `Formato no soportado: .${ext}. Use CSV (;) o XLSX.`,
      },
    ],
    warnings: [],
  };
}
