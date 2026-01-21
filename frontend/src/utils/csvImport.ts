export const parsePortfolioCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter((line: string) => line.trim() !== '')
    if (lines.length < 2) return { error: "El archivo está vacío o no tiene formato válido." }

    // Detect separator (semicolon or comma)
    const header = lines[0]
    const separator = header.includes(';') ? ';' : ','

    const portfolio: any[] = []
    let totalValue = 0

    // Headers mapping based on user image
    // Expected: Producto;ISIN;...;Valor de mercado;...
    const headers = header.split(separator).map((h: string) => h.trim().toLowerCase())

    const idxISIN = headers.findIndex((h: string) => h.includes('isin'))
    const idxName = headers.findIndex((h: string) => h.includes('producto') || h.includes('nombre') || h.includes('fondo') || h.includes('activo') || h.includes('descr') || h.includes('name') || h.includes('alias'))
    const idxVal = headers.findIndex((h: string) => h.includes('valor de mercado') || h.includes('valor mercado') || h.includes('capital'))

    if (idxISIN === -1 || idxVal === -1) {
        return { error: "No se encontraron las columnas 'ISIN' o 'Valor de mercado'/'Capital'." }
    }

    // Determine format based on header matches
    // Export uses "Capital (€)", Legacy uses "Valor de mercado"
    const isExportFormat = headers[idxVal].includes('capital');

    // Process data lines
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        // Handle quotes if necessary, but simple split for now assumes no separator in fields
        const cols = line.split(separator).map((c: string) => c.trim())

        if (cols.length < headers.length) continue // Skip incomplete lines or footer summaries

        let isin = cols[idxISIN]
        const name = cols[idxName] || 'Unknown Fund'
        let valStr = cols[idxVal]

        // Clean ISIN (remove quotes if import brings them)
        isin = isin.replace(/['"]/g, '').trim();

        let value = 0;
        if (isExportFormat) {
            // Standard Float (Exported: 1234.56)
            // Just in case, remove us-style thousands separator if present (though toFixed won't produce them)
            value = parseFloat(valStr.replace(/,/g, ''));
        } else {
            // Parse European Number Format: 29.784,14 -> 29784.14
            // Remove dots (thousands), replace comma with dot (decimal)
            valStr = valStr.replace(/\./g, '').replace(',', '.')
            value = parseFloat(valStr)
        }

        // Filter valid rows (must have ISIN and +ve Value)
        // Skip aggregate rows like "TOTAL FONDOS..."
        if (isin && isin.length === 12 && value > 0) {
            portfolio.push({
                isin: isin,
                name: name,
                value: value,
                // We don't have weight yet, calculated later
            })
            totalValue += value
        }
    }

    if (portfolio.length === 0) {
        return { error: "No se encontraron activos válidos." }
    }

    // Calculate weights
    const finalPortfolio = portfolio.map((p: any) => ({
        isin: p.isin,
        name: p.name,
        value: p.value,
        weight: (p.value / totalValue) * 100,
        currency: 'EUR' // Assumed based on image "Contravalor en EUR"
    }))

    return {
        portfolio: finalPortfolio,
        totalValue: totalValue
    }
}
