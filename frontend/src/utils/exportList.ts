export const exportToCSV = (portfolio: any[], totalCapital: number) => {
    if (!portfolio || portfolio.length === 0) {
        alert("No hay datos para exportar")
        return
    }

    // Header
    const headers = ["ISIN", "Nombre", "Tipo", "Region", "Peso (%)", "Capital (€)"]

    // Rows
    const rows = portfolio.map((p: any) => {
        const weight = parseFloat(p.weight) || 0
        const value = (weight / 100) * totalCapital

        // Escape quotes in name
        const cleanName = (p.name || "").replace(/"/g, '""');

        return [
            `"${p.isin}"`,
            `"${cleanName}"`,
            `"${p.std_type || "N/A"}"`,
            `"${p.std_region || "N/A"}"`,
            weight.toFixed(2),
            value.toFixed(2)
        ].join(",")
    })

    // Add BOM for Excel UTF-8 compatibility
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `cartera_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
