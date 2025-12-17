export const parsePortfolioCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '')
    if (lines.length < 2) return { error: "El archivo está vacío o no tiene formato válido." }

    // Detect separator (semicolon or comma)
    const header = lines[0]
    const separator = header.includes(';') ? ';' : ','

    const portfolio = []
    let totalValue = 0

    // Headers mapping based on user image
    // Expected: Producto;ISIN;...;Valor de mercado;...
    const headers = header.split(separator).map(h => h.trim().toLowerCase())

    const idxISIN = headers.findIndex(h => h.includes('isin'))
    const idxName = headers.findIndex(h => h.includes('producto') || h.includes('nombre'))
    const idxVal = headers.findIndex(h => h.includes('valor de mercado') || h.includes('valor mercado'))

    if (idxISIN === -1 || idxVal === -1) {
        return { error: "No se encontraron las columnas 'ISIN' o 'Valor de mercado'." }
    }

    // Process data lines
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        // Handle quotes if necessary, but simple split for now assumes no separator in fields
        const cols = line.split(separator).map(c => c.trim())

        if (cols.length < headers.length) continue // Skip incomplete lines or footer summaries

        const isin = cols[idxISIN]
        const name = cols[idxName] || 'Unknown Fund'
        let valStr = cols[idxVal]

        // Parse European Number Format: 29.784,14 -> 29784.14
        // Remove dots (thousands), replace comma with dot (decimal)
        valStr = valStr.replace(/\./g, '').replace(',', '.')
        const value = parseFloat(valStr)

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
    const finalPortfolio = portfolio.map(p => ({
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
