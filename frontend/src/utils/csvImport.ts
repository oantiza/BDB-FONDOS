/**
 * CSV Portfolio Importer
 * 
 * Supports:
 * - App's own exported CSV (comma-separated, quoted fields, "Capital (€)" column)
 * - External bank CSVs (semicolon-separated, European number format "29.784,14", various column names)
 * - RFC 4180 quoted fields (handles commas/semicolons inside quoted strings)
 * - BOM-safe (strips UTF-8 BOM \uFEFF)
 */

/** Parse a single CSV line respecting quoted fields (RFC 4180) */
function parseCSVLine(line: string, separator: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (inQuotes) {
            if (ch === '"') {
                // Check for escaped quote ""
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = false; // End of quoted field
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === separator) {
                fields.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current.trim()); // Last field
    return fields;
}

/** Try to find the column index for value/amount using common header names */
function findValueColumnIndex(headers: string[]): number {
    // Order matters: more specific first
    const patterns = [
        'valor de mercado',
        'valor mercado',
        'market value',
        'capital',
        'contravalor',
        'importe',
        'saldo',
        'balance',
        'amount',
        'valor',
        'value',
    ];
    for (const pattern of patterns) {
        const idx = headers.findIndex(h => h.includes(pattern));
        if (idx !== -1) return idx;
    }
    return -1;
}

/** Try to find a weight/percentage column */
function findWeightColumnIndex(headers: string[]): number {
    const patterns = ['peso', 'weight', '%', 'porcentaje', 'allocation'];
    for (const pattern of patterns) {
        const idx = headers.findIndex(h => h.includes(pattern));
        if (idx !== -1) return idx;
    }
    return -1;
}

export const parsePortfolioCSV = (csvText: string) => {
    // Strip BOM
    if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.slice(1);
    }

    const lines = csvText.split(/\r?\n/).filter((line: string) => line.trim() !== '')
    if (lines.length < 2) return { error: "El archivo está vacío o no tiene formato válido." }

    // Detect separator (semicolon or comma)
    const headerLine = lines[0]
    const separator = headerLine.includes(';') ? ';' : ','

    // Parse headers using the proper CSV parser (handles quoted headers too)
    const headers = parseCSVLine(headerLine, separator).map((h: string) => h.toLowerCase());

    const idxISIN = headers.findIndex((h: string) => h.includes('isin'))
    const idxName = headers.findIndex((h: string) =>
        h.includes('producto') || h.includes('nombre') || h.includes('fondo') ||
        h.includes('activo') || h.includes('descr') || h.includes('name') || h.includes('alias')
    )
    const idxVal = findValueColumnIndex(headers);
    const idxWeight = findWeightColumnIndex(headers);

    if (idxISIN === -1) {
        return { error: "No se encontró la columna 'ISIN' en el CSV." }
    }

    if (idxVal === -1 && idxWeight === -1) {
        return { error: `No se encontró columna de valor o peso. Columnas detectadas: ${headers.join(', ')}` }
    }

    // Determine format based on header match
    // Export uses "Capital (€)", Legacy uses "Valor de mercado"
    const isExportFormat = idxVal !== -1 && headers[idxVal].includes('capital');

    const portfolio: any[] = []
    let totalValue = 0
    let hasWeightOnly = idxVal === -1; // We only have weight column, no value

    // Process data lines
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        const cols = parseCSVLine(line, separator);

        // Skip lines that are clearly too short (less than ISIN column)
        if (cols.length <= idxISIN) {
            console.debug(`[CSV Import] Skipping line ${i + 1}: too few columns (${cols.length})`);
            continue;
        }

        let isin = (cols[idxISIN] || '').replace(/['"]/g, '').trim();
        const name = (idxName !== -1 && cols[idxName]) ? cols[idxName].replace(/['"]/g, '').trim() : 'Unknown Fund';

        // Filter valid ISIN (12 chars, alphanumeric)
        if (!isin || isin.length !== 12) {
            continue; // Skip aggregate/total/header rows
        }

        let value = 0;
        let weight = 0;

        if (!hasWeightOnly && idxVal !== -1 && cols[idxVal]) {
            let valStr = cols[idxVal].replace(/['"]/g, '').trim();

            if (isExportFormat) {
                // Standard Float (Exported: 1234.56)
                value = parseFloat(valStr.replace(/,/g, ''));
            } else {
                // Parse European Number Format: 29.784,14 -> 29784.14
                // Remove dots (thousands), replace comma with dot (decimal)
                valStr = valStr.replace(/\./g, '').replace(',', '.')
                value = parseFloat(valStr)
            }

            if (isNaN(value) || value <= 0) {
                console.debug(`[CSV Import] Skipping line ${i + 1}: invalid or zero value "${cols[idxVal]}" for ISIN ${isin}`);
                continue;
            }
        }

        // Also parse weight if available
        if (idxWeight !== -1 && cols[idxWeight]) {
            let weightStr = cols[idxWeight].replace(/['"]/g, '').trim();
            // Handle European decimals in weight too
            if (weightStr.includes(',') && !weightStr.includes('.')) {
                weightStr = weightStr.replace(',', '.');
            }
            weight = parseFloat(weightStr);
            if (isNaN(weight)) weight = 0;
        }

        if (hasWeightOnly && weight <= 0) {
            console.debug(`[CSV Import] Skipping line ${i + 1}: no valid weight for ISIN ${isin}`);
            continue;
        }

        portfolio.push({
            isin: isin,
            name: name,
            value: value,
            weight: weight, // Temporarily store — will recalculate
        })
        totalValue += value
    }

    if (portfolio.length === 0) {
        return { error: "No se encontraron activos válidos en el CSV. Verifica que contiene al menos una columna 'ISIN' y una columna de importe o peso." }
    }

    // Calculate weights
    let finalPortfolio;
    if (hasWeightOnly || totalValue === 0) {
        // Weight-only mode: use the parsed weights directly
        const totalWeight = portfolio.reduce((sum: number, p: any) => sum + (p.weight || 0), 0);
        finalPortfolio = portfolio.map((p: any) => ({
            isin: p.isin,
            name: p.name,
            value: p.value || 0,
            weight: totalWeight > 0 ? (p.weight / totalWeight) * 100 : 100 / portfolio.length,
            currency: 'EUR'
        }));
    } else {
        // Value-based: calculate weight from value
        finalPortfolio = portfolio.map((p: any) => ({
            isin: p.isin,
            name: p.name,
            value: p.value,
            weight: (p.value / totalValue) * 100,
            currency: 'EUR'
        }))
    }

    console.log(`[CSV Import] Successfully parsed ${finalPortfolio.length} funds, total value: ${totalValue.toFixed(2)} EUR`);

    return {
        portfolio: finalPortfolio,
        totalValue: totalValue
    }
}
