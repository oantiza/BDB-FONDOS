
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper types
interface PortfolioMetrics {
    metrics1y?: { cagr: number };
    metrics3y?: { cagr: number, sharpe: number, volatility: number, maxDrawdown: number };
    metrics5y?: { cagr: number };
}

export const generateComparatorPDF = async (
    nameA: string,
    nameB: string,
    metricsA: PortfolioMetrics,
    metricsB: PortfolioMetrics,
    idsToCapture: { chart: string, riskMap: string }
) => {
    console.log("Generating PDF with updated Strategic Summary styles v2");
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 25; // Side margins
    const marginTop = 15; // Top margin (Reduced by 1cm to give space at bottom)
    const contentWidth = pageWidth - (margin * 2);
    let currentY = marginTop;

    // --- COLORS ---
    const COLOR_TEXT_MAIN = [33, 37, 41]; // Dark Slate
    const COLOR_TEXT_MUTED = [108, 117, 125]; // Gray
    const COLOR_ACCENT = [13, 110, 253]; // Bootstrap Blue-ish
    const COLOR_TABLE_HEADER = [248, 249, 250]; // Light Gray
    const COLOR_BORDER = [222, 226, 230];

    // --- HELPERS ---
    const addSectionTitle = (title: string, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(COLOR_TEXT_MAIN[0], COLOR_TEXT_MAIN[1], COLOR_TEXT_MAIN[2]);
        doc.text(title.toUpperCase(), margin, y);
        // Underline
        doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);
        return y + 10;
    };

    //Helper
    const formatPct = (val?: number) => (val != null ? (val * 100).toFixed(2) + '%' : '-');
    const formatNum = (val?: number) => (val != null ? val.toFixed(2) : '-');

    // --- 1. HEADER (Styled v3 - Indented & Modern) ---
    const headerHeight = 18;

    // Background (Soft Blue #eff6ff) - Respected Margins
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, marginTop, contentWidth, headerHeight, 'F');

    // Bottom Border (Blue-100 #dbeafe)
    doc.setDrawColor(219, 234, 254);
    doc.setLineWidth(0.3);
    doc.line(margin, marginTop + headerHeight, pageWidth - margin, marginTop + headerHeight);

    // Title ("Comparador de" + "Carteras")
    const titleY = marginTop + 11;
    const textMargin = margin + 5;

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // text-slate-800

    doc.setFont('helvetica', 'normal');
    doc.text("Comparador de ", textMargin, titleY);
    const titleOffset = doc.getTextWidth("Comparador de ");

    doc.setFont('helvetica', 'bold');
    doc.text("Carteras", textMargin + titleOffset, titleY);

    // Date (Right aligned - Muted Blue/Gray)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // text-slate-500

    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Informe generado el ${today}`, pageWidth - margin - 5, titleY, { align: 'right' });

    currentY = marginTop + headerHeight + 15;

    // --- 2. KPI TABLE ---
    currentY = addSectionTitle("1. COMPARATIVA DE MÉTRICAS CLAVE", currentY);
    currentY += 5;

    // Table Setup
    const colWidth = contentWidth / 3;
    const rowHeight = 10;
    const tableY = currentY;

    // Headers
    doc.setFillColor(COLOR_TABLE_HEADER[0], COLOR_TABLE_HEADER[1], COLOR_TABLE_HEADER[2]);
    doc.rect(margin, tableY, contentWidth, rowHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(COLOR_TEXT_MAIN[0], COLOR_TEXT_MAIN[1], COLOR_TEXT_MAIN[2]);
    doc.text("Métricas", margin + 5, tableY + 6);
    doc.text(nameA.substring(0, 25), margin + colWidth + 5, tableY + 6);
    doc.text(nameB.substring(0, 25), margin + (colWidth * 2) + 5, tableY + 6);

    // Rows
    const cagr5yA = metricsA?.metrics5y?.cagr;
    const cagr5yB = metricsB?.metrics5y?.cagr;
    const sharpeA = metricsA?.metrics3y?.sharpe;
    const sharpeB = metricsB?.metrics3y?.sharpe;
    const volA = metricsA?.metrics3y?.volatility;
    const volB = metricsB?.metrics3y?.volatility;

    const rows = [
        { label: "Rentabilidad (5 años)", valA: cagr5yA, valB: cagr5yB, fmt: formatPct, better: "high" },
        { label: "Ratio de Sharpe", valA: sharpeA, valB: sharpeB, fmt: formatNum, better: "high" },
        { label: "Volatilidad", valA: volA, valB: volB, fmt: formatPct, better: "low" }
    ];

    let rowY = tableY + rowHeight;
    rows.forEach((row, i) => {
        // Line
        doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
        doc.setLineWidth(0.1);
        doc.line(margin, rowY, pageWidth - margin, rowY);

        // Content
        const textY = rowY + 6;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLOR_TEXT_MAIN[0], COLOR_TEXT_MAIN[1], COLOR_TEXT_MAIN[2]);
        doc.text(row.label, margin + 5, textY);

        // Values logic
        const txtA = row.fmt(row.valA);
        const txtB = row.fmt(row.valB);

        // Determine winner
        let winA = false;
        let winB = false;
        if (row.valA != null && row.valB != null) {
            if (row.better === 'high') {
                if (row.valA > row.valB) winA = true; else if (row.valB > row.valA) winB = true;
            } else {
                if (row.valA < row.valB) winA = true; else if (row.valB < row.valA) winB = true;
            }
        }

        // Render A (Bold Blue if Winner)
        if (winA) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]);
            doc.text(txtA, margin + colWidth + 5, textY);
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLOR_TEXT_MAIN[0], COLOR_TEXT_MAIN[1], COLOR_TEXT_MAIN[2]);
            doc.text(txtA, margin + colWidth + 5, textY);
        }

        // Render B
        if (winB) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]);
            doc.text(txtB, margin + (colWidth * 2) + 5, textY);
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLOR_TEXT_MAIN[0], COLOR_TEXT_MAIN[1], COLOR_TEXT_MAIN[2]);
            doc.text(txtB, margin + (colWidth * 2) + 5, textY);
        }

        rowY += rowHeight;
    });

    currentY = rowY + 10;

    // --- 3. CHARTS ---
    currentY = addSectionTitle("2. ANÁLISIS VISUAL DE GRÁFICOS", currentY);
    currentY += 5;

    // Capture Images
    // Adjusted gap to 6mm to increase width by 2mm per chart (prev gap 10)
    const gap = 6;
    const captureW = (contentWidth - gap) / 2;
    const captureH = captureW * 0.7; // Aspect 3:4ish
    const ids = [idsToCapture.chart, idsToCapture.riskMap];

    for (let i = 0; i < ids.length; i++) {
        const el = document.getElementById(ids[i]);
        if (el) {
            try {
                const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                const x = margin + (i * (captureW + gap));
                doc.addImage(imgData, 'PNG', x, currentY, captureW, captureH);
            } catch (e) { console.error(e); }
        }
    }
    currentY += captureH + 8;

    // --- 4. TEXTOS (Resumen y Composición) ---
    // Text Analysis (Simulated)
    doc.setFontSize(9);
    doc.setTextColor(COLOR_TEXT_MAIN[0], COLOR_TEXT_MAIN[1], COLOR_TEXT_MAIN[2]);

    // Constants for alignment
    const labelX = margin + 2;
    const textX = margin + 55; // Consistent offset for description column
    const maxTextWidth = contentWidth - 55; // Ensure text stays within right margin

    // Historical Analysis Logic
    const retDiff = (metricsA?.metrics5y?.cagr || 0) - (metricsB?.metrics5y?.cagr || 0);
    const histAnalysis = retDiff > 0
        ? `La cartera ${nameA} muestra una tendencia acumulada superior a largo plazo, superando a ${nameB} en los últimos periodos.`
        : `La cartera ${nameB} presenta un desempeño histórico más robusto, manteniendo una ventaja consistente sobre ${nameA}.`;

    // Risk Analysis Logic
    const sharpeDiff = (metricsA?.metrics3y?.sharpe || 0) - (metricsB?.metrics3y?.sharpe || 0);
    const riskAnalysis = sharpeDiff > 0
        ? `${nameA} se ubica en un cuadrante más eficiente, ofreciendo mayor retorno por unidad de riesgo asumido.`
        : `${nameB} demuestra una mayor eficiencia en la gestión del riesgo, optimizando la relación volatilidad-retorno.`;

    // Render Section 2 Text
    doc.setFont('helvetica', 'bold');
    doc.text("• Gráfico Histórico:", labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(histAnalysis, textX, currentY, { maxWidth: maxTextWidth });

    // Calculate height of first text block to position next one
    const splitHist = doc.splitTextToSize(histAnalysis, maxTextWidth);
    currentY += (splitHist.length * 5) + 6; // Dynamic spacing

    doc.setFont('helvetica', 'bold');
    doc.text("• Mapa Riesgo-Retorno:", labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(riskAnalysis, textX, currentY, { maxWidth: maxTextWidth });

    const splitRisk = doc.splitTextToSize(riskAnalysis, maxTextWidth);
    currentY += (splitRisk.length * 5) + 15; // Extra space before next section

    // --- 4. RESUMEN ESTRATÉGICO ---
    currentY = addSectionTitle("3. RESUMEN ESTRATÉGICO", currentY);
    currentY += 8;

    // Reset font size for content matches lines 181-182
    doc.setFontSize(9);
    doc.setTextColor(COLOR_TEXT_MAIN[0], COLOR_TEXT_MAIN[1], COLOR_TEXT_MAIN[2]);

    // Metrics Summary
    const winnerName = (metricsA?.metrics3y?.sharpe || 0) > (metricsB?.metrics3y?.sharpe || 0) ? nameA : nameB;
    const summaryText = `Tras evaluar el desempeño ajustado al riesgo (Sharpe) y la consistencia histórica, ${winnerName} se perfila como la opción con mejor equilibrio para un perfil inversor que busca eficiencia a largo plazo.`;

    doc.setFont('helvetica', 'bold');
    doc.text("• Análisis de métricas:", labelX, currentY);

    doc.setFont('helvetica', 'normal');
    doc.text(summaryText, textX, currentY, { maxWidth: maxTextWidth });

    const splitSummary = doc.splitTextToSize(summaryText, maxTextWidth);
    currentY += (splitSummary.length * 5) + 6;

    doc.setFont('helvetica', 'bold');
    doc.text("• Composición:", labelX, currentY);
    doc.setFont('helvetica', 'normal');
    const compText = "Ambas carteras mantienen una diversificación global, con exposición balanceada entre renta variable y renta fija según la estrategia seleccionada.";
    doc.text(compText, textX, currentY, { maxWidth: maxTextWidth });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text("Banca Privada", margin, pageHeight - 10);
    doc.text("Página 1 de 1", pageWidth - margin, pageHeight - 10, { align: 'right' });

    doc.save(`Analisis_Estrategico_${nameA}_vs_${nameB}.pdf`);
};
