// frontend/src/utils/pdfGenerator.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RISK_MATRIX } from './rulesEngine';

export const generateClientReport = (portfolio: any[], totalCapital: number, riskLevel: number) => {
    // 1. Configuración Inicial del Documento
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    // --- DISEÑO: BARRA LATERAL DE MARCA ---
    doc.setFillColor(63, 81, 181); // Azul Indigo (Coincide con tu tema)
    doc.rect(0, 0, 10, 297, 'F');

    // --- ENCABEZADO ---
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text("Informe de Estrategia Quant", 20, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${today}`, 20, 32);

    // --- RESUMEN DEL PERFIL ---
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Perfil del Inversor", 20, 50);

    const profile = RISK_MATRIX[riskLevel] || { name: 'Desconocido', maxVol: 0 };
    
    // Caja de resumen con fondo gris suave
    doc.setDrawColor(220);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(20, 55, 170, 25, 3, 3, 'FD');

    // Datos del perfil
    doc.setFontSize(10);
    
    doc.text(`Perfil de Riesgo:`, 30, 65);
    doc.setFont("helvetica", "bold");
    doc.text(`${riskLevel}/10 - ${profile.name}`, 30, 72);

    doc.setFont("helvetica", "normal");
    doc.text(`Objetivo Volatilidad:`, 90, 65);
    doc.setFont("helvetica", "bold");
    doc.text(`${(profile.maxVol * 100).toFixed(1)}% Anual`, 90, 72);

    doc.setFont("helvetica", "normal");
    doc.text(`Capital Gestionado:`, 150, 65);
    doc.setFont("helvetica", "bold");
    doc.text(`${totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`, 150, 72);

    // --- TABLA DE CARTERA ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Composición de la Cartera", 20, 95);

    // Preparar datos para la tabla
    const tableRows = portfolio.map(p => {
        const value = (totalCapital * (p.weight / 100));
        // Distinción visual en el PDF entre IA y Manual
        const origin = p.manualSwap ? "MANUAL" : "AUTO";
        
        return [
            p.name.substring(0, 40) + (p.name.length > 40 ? '...' : ''), // Acortar nombre si es muy largo
            p.isin,
            p.std_type || 'Mixto',
            `${p.weight.toFixed(2)}%`,
            value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
            origin
        ];
    });

    // Fila de TOTALES
    const totalWeight = portfolio.reduce((sum, p) => sum + p.weight, 0);
    tableRows.push(['', '', 'TOTAL', `${totalWeight.toFixed(2)}%`, totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), '']);

    // Generar la tabla usando autoTable
    // @ts-ignore
    autoTable(doc, {
        startY: 100,
        head: [['Fondo', 'ISIN', 'Tipo', 'Peso', 'Valor', 'Origen']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [63, 81, 181], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 70 }, // Columna nombre más ancha
            5: { fontStyle: 'bold', halign: 'center' } // Columna origen centrada
        },
        didParseCell: function (data) {
            // Pintar de azul claro las filas seleccionadas manualmente
            if (data.section === 'body' && data.row.raw[5] === "MANUAL") {
                data.cell.styles.fillColor = [225, 245, 254]; 
                data.cell.styles.textColor = [0, 100, 200];
            }
            // Negrita para la fila de totales
            if (data.row.index === tableRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 240, 240];
            }
        }
    });

    // --- MÉTRICAS ESTIMADAS (PIE DE PÁGINA) ---
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY + 15;
    
    if (finalY < 250) {
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Métricas Técnicas Estimadas", 20, finalY);

        let wSharpe = 0;
        let wVol = 0;
        let wFee = 0;

        portfolio.forEach(p => {
            const w = p.weight / 100;
            wSharpe += (p.std_perf?.sharpe || 0) * w;
            wVol += (p.std_perf?.volatility || 0) * w;
            wFee += (parseFloat(p.std_extra?.ter) || 1.5) * w;
        });

        const metricsData = [
            ['Volatilidad Esperada (ex-ante)', `${(wVol * 100).toFixed(2)}%`],
            ['Ratio de Sharpe Ponderado', wSharpe.toFixed(2)],
            ['Coste Medio (TER)', `${wFee.toFixed(2)}%`]
        ];

        // @ts-ignore
        autoTable(doc, {
            startY: finalY + 5,
            body: metricsData,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
        });
    }

    // --- DISCLAIMER LEGAL ---
    doc.setFontSize(8);
    doc.setTextColor(150);
    const disclaimer = "AVISO LEGAL: Este documento es meramente informativo generado por Fintrader Quant. Las rentabilidades pasadas no garantizan las futuras. La etiqueta 'MANUAL' indica que el activo fue seleccionado directamente por el usuario, prevaleciendo sobre la recomendación algorítmica.";
    doc.text(disclaimer, 20, 285, { maxWidth: 170 });

    // --- GUARDAR ---
    doc.save(`Fintrader_Report_${new Date().getTime()}.pdf`);
};