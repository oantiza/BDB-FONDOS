export const exportToCSV = (portfolio, totalCapital) => {
    if (!portfolio || portfolio.length === 0) {
        alert("No hay datos para exportar")
        return
    }

    // Header
    const headers = ["ISIN", "Nombre", "Tipo", "Region", "Peso (%)", "Valor (€)", "Volatilidad", "Rentabilidad 3A"]

    // Rows
    const rows = portfolio.map(p => {
        const weight = parseFloat(p.weight) || 0
        const value = (weight / 100) * totalCapital

        return [
            p.isin,
            `"${p.name}"`, // Quote name to handle commas
            p.std_type || "N/A",
            p.std_region || "N/A",
            weight.toFixed(2),
            value.toFixed(2),
            ((p.std_perf?.volatility || 0) * 100).toFixed(2) + "%",
            ((p.std_perf?.cagr3y || 0) * 100).toFixed(2) + "%"
        ].join(",")
    })

    const csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "cartera_optimizada.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
