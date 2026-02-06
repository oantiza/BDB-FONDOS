
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateComparatorPDF = async (
    nameA: string,
    nameB: string,
    idsToCapture: { chart: string, metrics: string, allocation: string }
) => {
    // 1. Create PDF
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let currentY = margin;

    // --- BRANDING COLORS ---
    const BRAND_NAVY = [11, 37, 69]; // #0B2545
    const BRAND_GOLD = [212, 175, 55]; // D4AF37
    const TEXT_PRIMARY = [30, 41, 59]; // slate-800
    const TEXT_SECONDARY = [100, 116, 139]; // slate-500

    // Helper to add image from DOM
    const captureAndAdd = async (elementId: string, title?: string) => {
        const el = document.getElementById(elementId);
        if (!el) {
            console.warn(`Element ${elementId} not found`);
            return;
        }

        try {
            // Capture with ultra-high scale for print quality
            const canvas = await html2canvas(el, {
                scale: 3,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = pageWidth - (margin * 2);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Check page break
            if (currentY + pdfHeight + 20 > pageHeight - 20) { // accounting for footer
                doc.addPage();

                // Re-add header accent on new pages? Or just plain?
                // Minimal header on subsequent pages
                doc.setDrawColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
                doc.setLineWidth(0.5);
                doc.line(margin, 15, pageWidth - margin, 15);
                currentY = 25;
            }

            if (title) {
                // Section Title with Gold accent
                doc.setFontSize(14);
                doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
                doc.setFont('helvetica', 'bold');
                doc.text(title.toUpperCase(), margin, currentY);

                // Small Gold Line under title
                doc.setDrawColor(BRAND_GOLD[0], BRAND_GOLD[1], BRAND_GOLD[2]);
                doc.setLineWidth(1);
                doc.line(margin, currentY + 2, margin + 15, currentY + 2);

                currentY += 12;
            }

            doc.addImage(imgData, 'PNG', margin, currentY, pdfWidth, pdfHeight);
            currentY += pdfHeight + 15;
        } catch (err) {
            console.error(`Error capturing ${elementId}`, err);
        }
    };

    // --- HEADER DESIGN ---
    // Top Bar
    doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo / Brand Name
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold'); // Serif for "Bank" feel
    doc.text("BDB FONDOS", margin, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text("PRIVATE WEALTH MANAGEMENT", margin, 26);

    // Report Title
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("INFORME COMPARATIVO DE ESTRATEGIAS", margin, 38);

    // Date (Right aligned)
    const dateStr = new Date().toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric'
    }).toUpperCase();
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(dateStr, pageWidth - margin, 20, { align: 'right' });

    // Gold Accent Line
    doc.setDrawColor(BRAND_GOLD[0], BRAND_GOLD[1], BRAND_GOLD[2]);
    doc.setLineWidth(1.5);
    doc.line(0, 45, pageWidth, 45);

    currentY = 60;

    // --- PORTFOLIO SUMMARY BLOCK ---
    // A clean summary box for the two portfolios
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 25, 2, 2, 'FD');

    const boxCenter = currentY + 12.5;

    // Portfolio A
    doc.setFontSize(11);
    doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(nameA, margin + 12, boxCenter); // Left side
    // Blue Dot
    doc.setFillColor(37, 99, 235); // Blue
    doc.circle(margin + 6, boxCenter - 1, 1.5, 'F');

    // VS
    doc.setFontSize(10);
    doc.setTextColor(BRAND_GOLD[0], BRAND_GOLD[1], BRAND_GOLD[2]); // Gold VS
    doc.text("VS", pageWidth / 2, boxCenter, { align: 'center' });

    // Portfolio B
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
    const nameBWidth = doc.getTextWidth(nameB);
    doc.text(nameB, pageWidth - margin - 12 - nameBWidth, boxCenter); // Right side
    // Amber Dot
    doc.setFillColor(245, 158, 11); // Amber
    doc.circle(pageWidth - margin - 6, boxCenter - 1, 1.5, 'F');

    currentY += 40;

    // --- SECTIONS ---
    await captureAndAdd(idsToCapture.chart, 'Evolución Histórica');
    await captureAndAdd(idsToCapture.metrics, 'Métricas de Riesgo y Retorno');

    // Smart Page Break for Allocation
    if (currentY > 180) { // If past middle, force new page for tall allocation
        doc.addPage();
        doc.setDrawColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, 15, pageWidth - margin, 15);
        currentY = 25;
    }
    await captureAndAdd(idsToCapture.allocation, 'Asignación de Activos');

    // --- FOOTER ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Footer Line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

        // Page Number
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Página ${i} de ${pageCount}`,
            pageWidth - margin,
            pageHeight - 8,
            { align: 'right' }
        );

        // Confidentiality / Disclaimer
        doc.text(
            "BDB FONDOS | Documento de Uso Interno | Confidencial",
            margin,
            pageHeight - 8
        );

        // Fine Print Disclaimer
        doc.setFontSize(6);
        doc.setTextColor(180, 180, 180);
        const disclaimer = "La rentabilidad pasada no garantiza la rentabilidad futura. Los datos mostrados son simulaciones basadas en el rendimiento histórico de los fondos subyacentes.";
        doc.text(disclaimer, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    // Save
    doc.save(`BDB_Comparativa_${nameA.replace(/\s+/g, '_')}_vs_${nameB.replace(/\s+/g, '_')}.pdf`);
};
