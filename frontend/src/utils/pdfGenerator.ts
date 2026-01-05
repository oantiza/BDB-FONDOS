import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RISK_MATRIX } from './rulesEngine';

// --- CONSTANTS & STYLES ---
const COL_TEXT_DARK: [number, number, number] = [27, 38, 49];    // #1B2631
const COL_ACCENT: [number, number, number] = [185, 147, 91];     // #B9935B
const COL_GREY: [number, number, number] = [148, 163, 184];      // Slate 400

// GLOBAL SCALE SECTIONS
const S_GENERAL = 0.9;
const S_STATS = 0.8;

// LAYOUT CONSTANTS (V14.11)
const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN_X = 30; // 3cm
const MARGIN_Y = 25; // 2.5cm
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;
const CENTER_X = PAGE_WIDTH / 2; // Re-centered to page


// --- HELPER: VECTOR GRAPHICS ---
const drawPieSlice = (doc: jsPDF, cx: number, cy: number, r: number, startAngle: number, endAngle: number, color: [number, number, number]) => {
    if (Math.abs(endAngle - startAngle) < 0.1) return;
    const rad1 = (startAngle * Math.PI) / 180;
    const rad2 = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad1);
    const y1 = cy + r * Math.sin(rad1);
    const x2 = cx + r * Math.cos(rad2);
    const y2 = cy + r * Math.sin(rad2);

    const points: any[] = [];
    points.push([cx, cy]);
    points.push([x1, y1]);

    const step = 2;
    for (let a = startAngle + step; a < endAngle; a += step) {
        const rad = (a * Math.PI) / 180;
        points.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
    }
    points.push([x2, y2]);

    doc.setFillColor(color[0], color[1], color[2]);
    for (let i = 1; i < points.length - 1; i++) {
        doc.triangle(points[0][0], points[0][1], points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], 'F');
    }
};

const drawLuxuryAreaChart = (doc: jsPDF, x: number, y: number, w: number, h: number, stats: any, s: number) => {
    // V13: Evolution Chart Style (Rebase to 100, Line Only, Rotated Date Labels)

    // Fallback
    const rawData = (stats && stats.history && stats.history.length > 0) ? stats.history : [];
    if (rawData.length === 0) {
        doc.setFontSize(8 * s); doc.setTextColor(150);
        doc.text("Datos insuficientes", x + w / 2, y + h / 2, { align: 'center' });
        doc.setDrawColor(220); doc.setLineWidth(0.5);
        doc.line(x, y + h / 2, x + w, y + h / 2);
        return;
    }

    // 1. Rebase Data to 100
    // formula: (val / startVal) * 100
    // We assume data is raw price/value. If returns, this logic needs adjustment but based on file viewing it seems to be prices.
    const startVal = rawData[0].y || 1;

    // We strictly use the provided data order.
    const data = rawData.map((d: any) => ({
        ...d,
        y: (d.y / startVal) * 100
    }));

    const minVal = Math.min(...data.map((d: any) => d.y));
    const maxVal = Math.max(...data.map((d: any) => d.y));
    // Add some padding to Y range so lines don't touch edges
    const range = (maxVal - minVal) || 1;
    const yPad = range * 0.1;
    const chartMin = Math.floor(minVal - yPad);
    const chartMax = Math.ceil(maxVal + yPad);
    const chartRange = chartMax - chartMin;

    // 2. Draw Horizontal Grid Only
    doc.setDrawColor(241, 245, 249); // Light Gray
    doc.setLineWidth(0.1);

    const steps = 5;
    doc.setFontSize(6 * s); doc.setTextColor(150);

    for (let i = 0; i <= steps; i++) {
        // Horizontal line
        const ly = y + h - (h / steps) * i;
        doc.line(x, ly, x + w, ly);

        // Y-Axis Label (Left) e.g. 100, 110...
        const val = chartMin + (chartRange / steps) * i;
        doc.text(val.toFixed(0), x - 2 * s, ly + 2 * s, { align: 'right' });
    }

    // 3. Draw The Line
    doc.setDrawColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]); // Dark Blue
    doc.setLineWidth(0.4);

    const points = data.map((d: any, i: number) => ({
        x: x + (i / (data.length - 1)) * w,
        y: y + h - ((d.y - chartMin) / chartRange) * h
    }));

    for (let i = 0; i < points.length - 1; i++) {
        doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    // 4. X-Axis Rotated Labels (Months)
    // We want ~12 - 15 labels max to look like the chart
    const labelCount = 12;
    const stepX = Math.ceil(data.length / labelCount);

    doc.setFontSize(6 * s);
    doc.setTextColor(100);

    data.forEach((d: any, i: number) => {
        if (i % stepX === 0) {
            const dateStr = new Date(d.x).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            // Capitalize first letter? "dec 2020" -> "Dec 2020"
            const label = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

            const px = x + (i / (data.length - 1)) * w;
            doc.text(label, px, y + h + 12 * s, { angle: 45, align: 'left' });
        }
    });


};

const drawRiskScatter = (doc: jsPDF, x: number, y: number, w: number, h: number, stats: any, ret1y: number, S: number) => {
    // V14: Exact Risk Map Match (5 Profiles, Integer Axes, Dynamic Footer)

    const pVol = (stats?.volatility || 0.05) * 100;
    const pRet = ret1y * 100;

    // 5 Benchmarks from reference
    const benchmarks = [
        { l: "Conservador", x: 2.5, y: 2.5, c: [148, 163, 184] },
        { l: "Moderado", x: 5.0, y: 5.7, c: [148, 163, 184] },
        { l: "Equilibrado", x: 9.0, y: 9.2, c: [148, 163, 184] },
        { l: "Dinámico", x: 14.0, y: 12.5, c: [148, 163, 184] },
        { l: "Agresivo", x: 19.0, y: 15.5, c: [148, 163, 184] }
    ];

    // Fixed Axes: X (0-25), Y (0-20)
    const minX = 0; const maxX = 25;
    const minY = 0; const maxY = 20;

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    // Background Grid
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.1);
    doc.rect(x, y, w, h);

    // Grid Lines & Labels
    doc.setFontSize(6 * S); doc.setTextColor(150);

    // Grid Lines & Labels
    const stepVal = 5;
    const stepsX = rangeX / stepVal;
    const stepsY = rangeY / stepVal;

    doc.setFontSize(6 * S); doc.setTextColor(150);

    // X-Axis Grid & Labels
    for (let i = 0; i <= stepsX; i++) {
        const val = minX + i * stepVal;
        const lx = x + (val / rangeX) * w;

        if (i > 0 && i < stepsX) doc.line(lx, y, lx, y + h);
        doc.text(val.toFixed(0), lx, y + h + 6 * S, { align: 'center' });
    }

    // Y-Axis Grid & Labels
    for (let i = 0; i <= stepsY; i++) {
        const val = minY + i * stepVal;
        const ly = y + h - (val / rangeY) * h;

        if (i > 0 && i < stepsY) doc.line(x, ly, x + w, ly);
        doc.text(val.toFixed(0), x - 2 * S, ly + 2 * S, { align: 'right' });
    }

    const plot = (valX: number, valY: number, size: number, type: 'diamond' | 'circle', color: number[], label: string, isPort: boolean) => {
        const px = x + ((valX - minX) / rangeX) * w;
        const py = y + h - ((valY - minY) / rangeY) * h;


        doc.setFillColor(color[0], color[1], color[2]);

        if (type === 'circle') {
            doc.circle(px, py, size, 'F');
            if (isPort) {
                doc.setDrawColor(COL_ACCENT[0], COL_ACCENT[1], COL_ACCENT[2]);
                doc.setLineWidth(0.5);
                doc.circle(px, py, size, 'S');
            } else {
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.2);
                doc.circle(px, py, size, 'S');
            }
        } else {
            doc.triangle(px, py - size, px + size, py, px - size, py, 'F');
            doc.triangle(px, py + size, px + size, py, px - size, py, 'F');
        }

        doc.setFontSize(7 * S);
        doc.setTextColor(isPort ? COL_TEXT_DARK[0] : 100);
        doc.setFont('helvetica', isPort ? 'bold' : 'normal');

        const ly = isPort ? py - size - 3 * S : py + size + 4 * S;
        doc.text(label, px, ly, { align: 'center' });
    };

    benchmarks.forEach(b => plot(b.x, b.y, 2.5 * S, 'diamond', b.c, b.l, false));
    plot(pVol, pRet, 4 * S, 'circle', COL_TEXT_DARK, "TU CARTERA", true);

    doc.setFontSize(8 * S); doc.setTextColor(100);
    doc.text("Riesgo (Volatilidad) %", x + w / 2, y + h + 12 * S, { align: 'center' });
    doc.text("Retorno 1 Año %", x + 3 * S, y + h / 2, { angle: 90, align: 'center' });

    // Dynamic Footer Text
    let nearest = benchmarks[0];
    let minDist = Infinity;
    benchmarks.forEach(b => {
        const dist = Math.sqrt(Math.pow(b.x - pVol, 2) + Math.pow(b.y - pRet, 2));
        if (dist < minDist) {
            minDist = dist;
            nearest = b;
        }
    });

    const footerText = `Su cartera (${pVol.toFixed(1)}% Vol) se comporta similar al perfil ${nearest.l}. Está alineada con la eficiencia esperada.`;

    doc.setFontSize(7 * S);
    doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);
    doc.setFont("helvetica", "normal");
    doc.text(footerText, x, y + h + 20 * S);
};

const drawCorrelationMatrix = (doc: jsPDF, x: number, y: number, w: number, h: number, matrix: number[][], assets: string[], s: number) => {
    if (!matrix || !assets || matrix.length === 0) return;

    const n = Math.min(matrix.length, 12); // Limit to 12x12
    const cellSize = Math.min(w / n, h / n);

    doc.setFontSize(6 * s);

    for (let row = 0; row < n; row++) {
        // Row Label
        doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);
        doc.text(assets[row].substring(0, 15), x - 2 * s, y + row * cellSize + cellSize / 2 + 2, { align: 'right' });

        for (let col = 0; col < n; col++) {
            const val = matrix[row][col];
            const px = x + col * cellSize;
            const py = y + row * cellSize;

            // Simple Color Scale
            let color = [255, 255, 255];
            if (val >= 0.8) color = [30, 58, 138];
            else if (val >= 0.5) color = [217, 119, 6];
            else if (val > 0) color = [253, 230, 138];
            else if (val < 0) color = [254, 202, 202]; // Red tint

            // Diagonal (Self)
            if (row === col) color = [11, 37, 69];

            doc.setFillColor(color[0], color[1], color[2]);
            doc.rect(px, py, cellSize, cellSize, 'F');

            const textColor = (val > 0.5 || row === col) ? 255 : 50;
            doc.setTextColor(textColor);
            doc.setFont('helvetica', 'bold');
            doc.text(val.toFixed(2), px + cellSize / 2, py + cellSize / 2 + 1.5, { align: 'center' });
        }
        // Col Label
        doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);
        doc.text(assets[row].substring(0, 10), x + row * cellSize + cellSize / 2, y - 2 * s, { angle: 90, align: 'left' });
    }
};

// --- HELPER: HEADER ---
const drawPageHeader = (doc: jsPDF, title: string, subtitle: string, s: number) => {
    // V14.11 Header uses Global Margins
    const y = MARGIN_Y;

    doc.setFontSize(18 * s);
    doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);
    doc.setFont("helvetica", "normal");
    doc.text(title, MARGIN_X, y);

    if (subtitle) {
        doc.setFontSize(9 * s);
        doc.setTextColor(COL_ACCENT[0], COL_ACCENT[1], COL_ACCENT[2]);
        doc.setFont("helvetica", "bold");
        doc.text(subtitle.toUpperCase(), MARGIN_X + CONTENT_WIDTH, y, { align: 'right' });
    }

    doc.setDrawColor(COL_ACCENT[0], COL_ACCENT[1], COL_ACCENT[2]);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, y + 4 * s, MARGIN_X + CONTENT_WIDTH, y + 4 * s);
};


const drawBarChart = (doc: jsPDF, x: number, y: number, w: number, h: number, data: { label: string, value: number, color?: [number, number, number] }[], title: string, s: number) => {
    doc.setFontSize(9 * s); doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);
    doc.text(title, x, y - 5 * s);

    doc.setDrawColor(200); doc.setLineWidth(0.1);
    doc.line(x, y + h, x + w, y + h);
    doc.line(x, y, x, y + h);

    if (data.length === 0) {
        doc.setFontSize(7 * s); doc.setTextColor(150);
        doc.text("Sin datos", x + w / 2, y + h / 2, { align: 'center' });
        return;
    }

    const minVal = Math.min(0, ...data.map(d => d.value));
    const maxVal = Math.max(0, ...data.map(d => d.value));
    const range = (maxVal - minVal) * 1.2 || 1;
    const zeroY = y + h - ((0 - minVal) / range) * h;
    doc.line(x, zeroY, x + w, zeroY);

    const barW = (w / data.length) * 0.5;
    const spacing = (w / data.length) * 0.5;

    data.forEach((d, i) => {
        const hBar = (Math.abs(d.value) / range) * h;
        const bx = x + spacing / 2 + i * (barW + spacing) + (spacing / 2);
        const by = d.value >= 0 ? zeroY - hBar : zeroY;
        const col = d.color || COL_ACCENT;
        doc.setFillColor(col[0], col[1], col[2]);
        doc.rect(bx, by, barW, hBar, 'F');
        doc.setFontSize(7 * s); doc.setTextColor(100);
        doc.text(d.label ? d.label.substring(0, 4) : '', bx + barW / 2, y + h + 4 * s, { align: 'center' });
    });

    doc.setFontSize(6 * s); doc.setTextColor(150);
    doc.text(`${(maxVal * 100).toFixed(0)}%`, x - 2 * s, y + 2 * s, { align: 'right' });
    doc.text(`${(minVal * 100).toFixed(0)}%`, x - 2 * s, y + h, { align: 'right' });
};


const calculateAnnualReturns = (history: any[]) => {
    if (!history || history.length === 0) return [];
    const years: Record<string, { start: number, end: number }> = {};
    history.forEach((h, i) => {
        const y = h.x ? h.x.substring(0, 4) : '';
        if (y && !years[y]) years[y] = { start: h.y, end: h.y };
        if (y) years[y].end = h.y;
        if (i === 0 && y) years[y].start = h.y;
    });

    return Object.keys(years).sort().map(y => {
        const start = years[y].start;
        const end = years[y].end;
        const ret = start !== 0 ? (end - start) / start : 0;
        return { label: y, value: ret };
    }).slice(-5);
};

const calculateCumulativeReturn = (history: any[], yearCount: number) => {
    if (!history || history.length === 0) return 0;
    const end = history[history.length - 1];
    if (!end) return 0;
    const endDate = new Date(end.x);
    const targetDate = new Date(endDate);
    targetDate.setFullYear(endDate.getFullYear() - yearCount);
    let bestDist = Infinity;
    let startVal = history[0].y;
    for (const h of history) {
        if (!h.x) continue;
        const d = new Date(h.x);
        const dist = Math.abs(d.getTime() - targetDate.getTime());
        if (dist < bestDist) {
            bestDist = dist;
            startVal = h.y;
        }
    }
    const ret = startVal !== 0 ? (end.y - startVal) / startVal : 0;
    return ret;
};

const drawFooter = (doc: jsPDF, s: number) => {
    const y = PAGE_HEIGHT - 12; // Adjusted to be closer to bottom edge (centered in margin)

    doc.setFontSize(8 * s);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");

    const pageNum = doc.getNumberOfPages();
    const text = `BDB FONDOS | Confidencial   |   ${pageNum}`;

    doc.text(text, PAGE_WIDTH / 2, y, { align: 'center' });
};


// --- MAIN EXPORT ---
export const generateClientReport = (portfolio: any[], totalCapital: number, riskLevel: number, stats?: { volatility: number, return: number }, historyData?: { x: string, y: number }[], allocData?: any[], geoData?: any[], strategyReport?: any | null, correlationMatrix?: number[][]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const profile = RISK_MATRIX[riskLevel] || { name: 'Desconocido', maxVol: 0 };

    // --- PAGE 1: COVER (PREMIUM REDESIGN) ---
    // 1. Sidebar (Navy Blue)
    const sidebarWidth = 85;
    doc.setFillColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);
    doc.rect(0, 0, sidebarWidth, PAGE_HEIGHT, 'F');

    // 2. Branding (In Sidebar)
    doc.setFontSize(28); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
    doc.text("BDB FONDOS", 15, 50); // Left aligned in sidebar

    doc.setFontSize(10); doc.setTextColor(COL_ACCENT[0], COL_ACCENT[1], COL_ACCENT[2]); doc.setFont("helvetica", "normal");
    doc.text("PRIVATE BANKING", 15, 60);
    // doc.setLetterSpacing(0.2); // Not supported in std jsPDF but good to keep intent clear

    // Decorative line in sidebar
    doc.setDrawColor(COL_ACCENT[0], COL_ACCENT[1], COL_ACCENT[2]); doc.setLineWidth(0.5);
    doc.line(15, 70, 70, 70);

    // 3. Main Title (White Area)
    const mainX = sidebarWidth + 20;
    const titleY = 60;

    doc.setFontSize(42); doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);
    doc.setFont("helvetica", "bold"); // Bold for impact
    doc.text("INFORME DE", mainX, titleY);
    doc.text("ESTRATEGIA", mainX, titleY + 18);
    doc.text("PATRIMONIAL", mainX, titleY + 36);

    // Gold Accent Line
    doc.setDrawColor(COL_ACCENT[0], COL_ACCENT[1], COL_ACCENT[2]); doc.setLineWidth(1.5);
    doc.line(mainX, titleY + 50, mainX + 150, titleY + 50);

    // 4. Client Metadata
    const infoY = 140;

    doc.setFontSize(10); doc.setTextColor(150); doc.setFont("helvetica", "bold");
    doc.text("PREPARADO PARA:", mainX, infoY);

    doc.setFontSize(22); doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]); doc.setFont("helvetica", "normal");
    doc.text("CLIENTE VIP", mainX, infoY + 12);

    // Details Grid
    const detY = infoY + 35;
    const col2X = mainX + 60;

    // Row 1
    doc.setFontSize(9); doc.setTextColor(100); doc.setFont("helvetica", "normal");
    doc.text("PERFIL DE RIESGO", mainX, detY);
    doc.text("FECHA DE EMISIÓN", col2X, detY);

    doc.setFontSize(11); doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]); doc.setFont("helvetica", "bold");
    doc.text(profile.name.toUpperCase(), mainX, detY + 6);
    doc.text(today.toUpperCase(), col2X, detY + 6);

    // Row 2
    doc.setFontSize(9); doc.setTextColor(100); doc.setFont("helvetica", "normal");
    doc.text("VALOR TOTAL", mainX, detY + 20);
    doc.text("GESTOR", col2X, detY + 20);

    doc.setFontSize(11); doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]); doc.setFont("helvetica", "bold");
    doc.text(`${totalCapital.toLocaleString('es-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} EUR`, mainX, detY + 26);
    doc.text("EQUIPO GESTOR GCO", col2X, detY + 26);

    // --- PAGE 2: COMPOSICIÓN (Refined V5) ---
    doc.addPage();
    // V7 Title: "Composición de la Cartera"
    drawPageHeader(doc, "Composición de la Cartera", "", 0.9);

    const groups: Record<string, any[]> = {};
    portfolio.forEach(p => {
        let cat = p.std_extra?.category || '';
        if (!cat) {
            if (p.std_type === 'RV') cat = 'Renta Variable Global';
            else if (p.std_type === 'RF') cat = 'Renta Fija Global';
            else cat = 'Otros Activos';
        }
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
    });

    const sortedCats = Object.keys(groups).sort();
    const tableBody: any[] = [];

    sortedCats.forEach(cat => {
        // Category Header
        tableBody.push([{ content: cat, colSpan: 5, styles: { fillColor: [248, 250, 252], textColor: COL_ACCENT, fontStyle: 'bold', fontSize: 8 * 0.9 } }]);
        groups[cat].forEach(p => {
            const val = (totalCapital * (p.weight / 100));
            tableBody.push([
                (p.name || '').substring(0, 60),
                p.isin,
                p.currency || 'EUR',
                { content: `${p.weight.toFixed(2,)}%`, styles: { halign: 'right' } },
                { content: val.toLocaleString('es-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right' } }
            ]);
        });
    });

    const totalWeight = portfolio.reduce((acc, p) => acc + p.weight, 0);

    // Explicit Header styles for Peso and Valor
    const headRow = [
        { content: 'FONDO', styles: { halign: 'left' } },
        { content: 'ISIN', styles: { halign: 'left' } },
        { content: 'DIV', styles: { halign: 'left' } },
        { content: 'PESO', styles: { halign: 'right' } },
        { content: 'VALOR', styles: { halign: 'right' } }
    ];


    autoTable(doc, {
        startY: MARGIN_Y + 15 * 0.9,
        head: [headRow],
        body: tableBody,
        theme: 'plain',
        headStyles: { textColor: COL_TEXT_DARK, fontSize: 8 * 0.9, fontStyle: 'bold' },
        styles: { fontSize: 8 * 0.9, cellPadding: 2, textColor: [80, 80, 80] },
        margin: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X },
        columnStyles: {
            0: { cellWidth: 120 * 0.9 }, // Restored usage of space
            3: { halign: 'right' },
            4: { halign: 'right' }
        },
        foot: [[
            { content: 'TOTAL CARTERA', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', textColor: COL_TEXT_DARK } },
            { content: `${totalWeight.toFixed(2)}%`, styles: { halign: 'right', fontStyle: 'bold', textColor: COL_TEXT_DARK } },
            { content: totalCapital.toLocaleString('es-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', textColor: COL_TEXT_DARK } }
        ]],
        footStyles: { fillColor: [255, 255, 255], cellPadding: 4, lineColor: [0, 0, 0], lineWidth: { top: 0.1 } }
    });

    // Draw Total with FULL WIDTH lines (V8: extend to endX)
    // const finalY = (doc as any).lastAutoTable.finalY + 2;
    // Manual text removed in favor of autoTable foot



    drawFooter(doc, 0.9);

    // --- PAGE 3: PERFORMANCE ---
    doc.addPage();
    drawPageHeader(doc, "Análisis de Rentabilidad", "Retorno y Evolución", S_STATS);

    // Layout Constants
    // const chartY = 80 * S_STATS;
    const page3Y = 40 * S_STATS;

    const annRet = calculateAnnualReturns(historyData || []);
    const ret1y = calculateCumulativeReturn(historyData || [], 1);
    const ret3y = calculateCumulativeReturn(historyData || [], 3);
    const ret5y = calculateCumulativeReturn(historyData || [], 5);
    const retYTD = stats?.return || 0;

    const metricsString = [
        { l: "YTD", v: `${(retYTD * 100).toFixed(2)}%` },
        { l: "1 Año (Acum)", v: `${(ret1y * 100).toFixed(2)}%` },
        { l: "3 Años (Acum)", v: `${(ret3y * 100).toFixed(2)}%` },
        { l: "5 Años (Acum)", v: `${(ret5y * 100).toFixed(2)}%` },
        { l: "Volatilidad", v: `${((stats?.volatility || 0.05) * 100).toFixed(2)}%` }
    ];
    let mx = MARGIN_X; // Start at global margin
    metricsString.forEach(m => {
        doc.setDrawColor(230); doc.rect(mx, page3Y, 45 * S_STATS, 20 * S_STATS);
        doc.setFontSize(8 * S_STATS); doc.setTextColor(150); doc.text(m.l, mx + 22.5 * S_STATS, page3Y + 6 * S_STATS, { align: 'center' });
        doc.setFontSize(12 * S_STATS); doc.setTextColor(COL_ACCENT[0], COL_ACCENT[1], COL_ACCENT[2]); doc.setFont('helvetica', 'bold');
        doc.text(m.v, mx + 22.5 * S_STATS, page3Y + 15 * S_STATS, { align: 'center' });
        mx += 50 * S_STATS; // Spacing
    });

    doc.setFontSize(10 * S_STATS); doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);


    // V14.12: Move Historical Chart to Bottom Right
    const histChartH = 72 * S_STATS;
    // Align bottom of chart to PAGE_HEIGHT - MARGIN_Y - 10 (footer padding)
    const histChartY = PAGE_HEIGHT - MARGIN_Y - 10 - histChartH;

    const histChartW = 117 * S_STATS;
    const chart2X = PAGE_WIDTH - MARGIN_X - histChartW;
    doc.text("Rentabilidad Histórica (5 Años)", chart2X, histChartY - 5 * S_STATS);
    const cStats = { ...(stats || { volatility: 0.04, return: 0.08 }), history: historyData };
    drawLuxuryAreaChart(doc, chart2X, histChartY, histChartW, histChartH, cStats, S_STATS); // Reduced 10% from 130x80

    // V8 fallback for missing annual data - MOVED to bottom left
    drawBarChart(doc, MARGIN_X, histChartY, 110 * S_STATS, histChartH, annRet, "Rentabilidad Anual", S_STATS);

    drawFooter(doc, S_STATS);

    // --- PAGE 4: RISK & DISTRIBUTION (Framed V8) ---
    doc.addPage();
    drawPageHeader(doc, "Mapa de Riesgo/Retorno", "", S_STATS);

    const rmY = 40 * S_STATS;
    const rmW = 120 * S_STATS, rmH = 70 * S_STATS;
    drawRiskScatter(doc, MARGIN_X, rmY, rmW, rmH, stats, ret1y, S_STATS);

    const riskBody = [
        ['Métrica', 'Valor'],
        ['Retorno 1 Año', `${(ret1y * 100).toFixed(2)}%`],
        ['Volatilidad Anual', `${((stats?.volatility || 0) * 100).toFixed(2)}%`],
        ['Sharpe Est.', `${(stats?.volatility ? (ret1y / stats.volatility).toFixed(2) : 'N/A')}`],
        ['VaR 95%', `${((stats?.volatility || 0) * -1.65 * 100).toFixed(2)}%`]
    ];

    autoTable(doc, {
        startY: rmY,
        margin: { left: MARGIN_X + 160 * S_STATS },
        head: [],
        body: riskBody,
        theme: 'plain',
        tableWidth: 90 * S_STATS,
        styles: { fontSize: 9 * S_STATS, cellPadding: 3, textColor: COL_TEXT_DARK },
        columnStyles: { 0: { fontStyle: 'bold', textColor: [100, 100, 100] } },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.row.index === 0) {
                const { doc, cell } = data;
                doc.setDrawColor(0); doc.setLineWidth(0.1);
                doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
            }
        }
    });

    const botY = 150 * S_STATS;
    doc.setFontSize(10 * S_STATS); doc.setTextColor(COL_TEXT_DARK[0], COL_TEXT_DARK[1], COL_TEXT_DARK[2]);
    // V6 Renamed Title
    doc.text("Distribución Sectorial", MARGIN_X + 10 * S_STATS, botY);
    doc.text("Distribución Geográfica", MARGIN_X + 150 * S_STATS, botY);

    // 1. Subcategory / Sectorial
    const subGroups: Record<string, number> = {};
    let totalWSub = 0;
    portfolio.forEach(p => {
        const sc = p.std_extra?.subcategory || p.std_extra?.category || 'Otros';
        subGroups[sc] = (subGroups[sc] || 0) + p.weight;
        totalWSub += p.weight;
    });
    const subData = Object.entries(subGroups).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const dcX1 = MARGIN_X + 20 * S_STATS, dcY1 = botY + 35 * S_STATS, dcR = 25 * S_STATS;
    let stA = 0;
    const cols = [[27, 38, 49], [185, 147, 91], [100, 116, 139], [148, 163, 184]];

    subData.forEach(([sub, w], i) => {

        const slice = (w / totalWSub) * 360;
        const c = cols[i % cols.length] as [number, number, number];
        drawPieSlice(doc, dcX1, dcY1, dcR, stA, stA + slice, c);
        stA += slice;
        doc.setFillColor(c[0], c[1], c[2]); doc.rect(MARGIN_X + 60 * S_STATS, botY + 10 * S_STATS + (i * 8 * S_STATS), 3 * S_STATS, 3 * S_STATS, 'F');
        doc.setFontSize(7 * S_STATS); doc.setTextColor(80);
        doc.text(`${w.toFixed(2)}% ${(sub || '').substring(0, 20)}`, MARGIN_X + 65 * S_STATS, botY + 12 * S_STATS + (i * 8 * S_STATS));
    });
    doc.setFillColor(255, 255, 255); doc.circle(dcX1, dcY1, dcR * 0.75, 'F');


    // 2. Geo V3
    const dcX2 = MARGIN_X + 160 * S_STATS, dcY2 = botY + 35 * S_STATS;

    const regionMap: Record<string, number> = {};
    let totalRegionW = 0;
    portfolio.forEach(p => {
        const reg = p.std_extra?.region || p.std_extra?.country || 'Global/Otros';
        const rKey = reg === 'United States' || reg === 'US' ? 'EE.UU' :
            reg === 'Europe' || reg === 'Eurozone' ? 'Europa' :
                reg === 'Emerging Markets' ? 'Emergentes' : reg;
        regionMap[rKey] = (regionMap[rKey] || 0) + p.weight;
        totalRegionW += p.weight;
    });
    const geoDataV3 = Object.entries(regionMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

    let st = 0;
    geoDataV3.forEach(([reg, w], i) => {
        const val = (w / totalRegionW) * 360;
        const c = cols[i % cols.length] as [number, number, number];

        drawPieSlice(doc, dcX2, dcY2, dcR, st, st + val, c);
        st += val;
        doc.setFillColor(c[0], c[1], c[2]); doc.rect(MARGIN_X + 200 * S_STATS, botY + 10 * S_STATS + (i * 8 * S_STATS), 3 * S_STATS, 3 * S_STATS, 'F');
        doc.setFontSize(7 * S_STATS); doc.setTextColor(80);
        doc.text(`${w.toFixed(2)}% ${reg}`, MARGIN_X + 205 * S_STATS, botY + 12 * S_STATS + (i * 8 * S_STATS));
    });
    doc.setFillColor(255, 255, 255); doc.circle(dcX2, dcY2, dcR * 0.75, 'F');

    drawFooter(doc, S_STATS);
    // --- PAGE 5: CORRELATION MATRIX (Separated as requested) ---
    if (correlationMatrix && correlationMatrix.length > 0) {
        doc.addPage();
        drawPageHeader(doc, "Matriz de Correlación", "Diversificación y Eficiencia", S_STATS);

        const corrY = 60 * S_STATS;
        // Asset Names from Portfolio
        const assets = portfolio.map(p => p.name || p.isin);

        // Draw centered and large enough
        const matrixSize = 130 * S_STATS; // Maximize width
        const matrixX = (PAGE_WIDTH - matrixSize) / 2 + 10;

        drawCorrelationMatrix(doc, matrixX, corrY, matrixSize, matrixSize, correlationMatrix, assets, S_STATS);

        drawFooter(doc, S_STATS);
    }

    doc.save(`BDB_Informe_Premium_v10_${new Date().getTime()}.pdf`);
};
