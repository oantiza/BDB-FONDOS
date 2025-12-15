const Chart = window.Chart;
const Plotly = window.Plotly;

if (Chart) {
    Chart.defaults.color = '#334155';
    Chart.defaults.borderColor = '#e2e8f0';
    Chart.defaults.font.family = "'Roboto', sans-serif";
    Chart.defaults.maintainAspectRatio = false;
}

// Registro de instancias para limpieza de memoria
const ChartInstances = { 
    main: null, 
    xray: null, 
    allocation: null, 
    geo: null, 
    comparison: null, 
    riskMap: null,
    market: null, // Añadido
    yield: null   // Añadido
};

const THEME = { navy: '#0B2545', gold: '#D4AF37', slate: '#64748b', grid: '#f1f5f9' };

// --- 1. GRÁFICO PRINCIPAL (DASHBOARD) ---
export function renderDashboardChart(dataInput, canvasId = 'main-history-chart', isSimpleLine = false) {
    const ctx = document.getElementById(canvasId); 
    if (!ctx) return;
    
    // Destruir instancia previa si existe para evitar superposiciones
    if (ChartInstances.main) { ChartInstances.main.destroy(); ChartInstances.main = null; }
    
    // Si es línea simple (Mercado Real)
    if (isSimpleLine) {
        const points = dataInput.map(d => ({x: new Date(d.x).getTime(), y: d.y}));
        ChartInstances.main = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    data: points,
                    borderColor: THEME.navy,
                    borderWidth: 2,
                    backgroundColor: 'rgba(11, 37, 69, 0.05)',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { x: { type: 'time', display: false }, y: { display: false } } 
            }
        });
        return;
    }

    // Si es Monte Carlo (Array de arrays)
    const isMultiPath = Array.isArray(dataInput) && Array.isArray(dataInput[0]);
    let datasets = [];
    
    if (isMultiPath) {
        datasets = dataInput.map((simulationPoints) => ({
            data: simulationPoints,
            borderColor: 'rgba(11, 37, 69, 0.15)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0.4
        }));
    } else {
        // Fallback simple
        datasets = [{ 
            data: dataInput, 
            borderColor: THEME.navy, 
            borderWidth: 2, 
            pointRadius: 0, 
            fill: true, 
            tension: 0.4 
        }];
    }

    ChartInstances.main = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            parsing: { xAxisKey: 'x', yAxisKey: 'y' }, 
            plugins: { legend: { display: false }, tooltip: { enabled: false } }, 
            scales: { x: { type: 'linear', display: false }, y: { display: false } }, 
            elements: { point: { radius: 0 } },
            animation: { duration: 0 }
        }
    });
}

// --- 2. COMPARATIVA DE REBALANCEO ---
export function renderComparisonChart(oldSeries, newSeries, canvasId = 'comparison-chart') {
    const ctx = document.getElementById(canvasId); 
    if (!ctx) return;
    if (ChartInstances.comparison) ChartInstances.comparison.destroy();
    
    ChartInstances.comparison = new Chart(ctx, {
        type: 'line',
        data: { 
            datasets: [
                { label: 'Cartera Actual', data: oldSeries, borderColor: '#94a3b8', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.1 }, 
                { label: 'Propuesta Óptima', data: newSeries, borderColor: THEME.navy, borderWidth: 3, pointRadius: 0, fill: true, backgroundColor: 'rgba(11, 37, 69, 0.05)', tension: 0.1 }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, parsing: { xAxisKey: 'x', yAxisKey: 'y' }, 
            plugins: { legend: { position: 'top', align: 'end' }, tooltip: { mode: 'index', intersect: false } }, 
            scales: { x: { type: 'linear', display: false }, y: { display: false } } 
        }
    });
}

// --- 3. DONUT DE ASIGNACIÓN (RV/RF/CASH) ---
export function renderAllocationDonut(allocData, canvasId = 'asset-allocation-chart') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (ChartInstances.allocation) ChartInstances.allocation.destroy();

    const total = allocData.rv + allocData.rf + allocData.other;
    const data = total < 0.1 ? [1, 0, 0] : [allocData.rv, allocData.rf, allocData.other];
    const colors = total < 0.1 ? ['#e2e8f0', '#e2e8f0', '#e2e8f0'] : ['#10B981', '#0B2545', '#D4AF37'];

    ChartInstances.allocation = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Renta Var.', 'Renta Fija', 'Liquidez'], datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false }, // Ocultar leyenda para ahorrar espacio
                tooltip: { enabled: total > 0.1 } 
            }, 
            cutout: '75%' 
        }
    });
}

// --- 4. DONUT GEOGRÁFICO (NUEVO - IMPRESCINDIBLE PARA EL DASHBOARD) ---
export function renderGeoDistribution(geoData, canvasId = 'geo-distribution-chart') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (ChartInstances.geo) ChartInstances.geo.destroy(); 

    const labels = Object.keys(geoData);
    const data = Object.values(geoData);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#64748B'];

    ChartInstances.geo = new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels: labels, 
            datasets: [{ 
                data: data, 
                backgroundColor: colors, 
                borderWidth: 0, 
                hoverOffset: 4 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw.toFixed(1)}%` } } 
            }, 
            cutout: '75%' 
        }
    });
}

// --- 5. STYLE BOX ---
export function renderStyleBox(portfolio) {
    const grid = document.getElementById('style-box-grid');
    const label = document.getElementById('style-box-label');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = "bg-slate-100 border border-slate-200 rounded-sm flex items-center justify-center text-[11px] text-slate-300 font-mono transition-all duration-300";
        grid.appendChild(cell);
    }
    const rvFunds = portfolio.filter(f => f.std_type === 'RV' && f.weight > 0);
    if (rvFunds.length === 0) { if (label) label.textContent = "N/A"; return; }
    
    let scoreX = 0, scoreY = 0, totalW = 0;
    rvFunds.forEach(f => {
        let x = 1, y = 1; 
        const size = (f.std_style?.size || 'Large').toLowerCase();
        const style = (f.std_style?.investment || 'Blend').toLowerCase();
        
        if(size.includes('small')) y = 2; else if(size.includes('mid')) y = 1; else y = 0;
        if(style.includes('value')) x = 0; else if(style.includes('growth')) x = 2; else x = 1;
        
        scoreX += x * f.weight; scoreY += y * f.weight; totalW += f.weight;
    });
    
    if (totalW === 0) return;
    const safeX = Math.max(0, Math.min(2, Math.round(scoreX / totalW)));
    const safeY = Math.max(0, Math.min(2, Math.round(scoreY / totalW)));
    const finalIndex = (safeY * 3) + safeX;
    
    if (grid.children[finalIndex]) {
        grid.children[finalIndex].className = "bg-[#0B2545] text-white shadow-md scale-110 border border-[#D4AF37] z-10 flex items-center justify-center rounded-sm font-bold text-[13px]";
        grid.children[finalIndex].textContent = "●";
    }
    const sizes = ["Large", "Mid", "Small"]; const styles = ["Value", "Blend", "Growth"];
    if (label) label.textContent = `${sizes[safeY]} ${styles[safeX]}`;
}

// --- 6. GRÁFICO X-RAY ---
export function renderXRayChart(portfolioData, benchmarkData = [], benchmarkLabel = 'Benchmark', canvasId = 'backtest-chart') {
    const ctx = document.getElementById(canvasId); 
    if (!ctx) return;
    if (ChartInstances.xray) ChartInstances.xray.destroy();
    
    const datasets = [{ label: 'Mi Cartera', data: portfolioData, borderColor: THEME.navy, borderWidth: 2, pointRadius: 0, tension: 0.1 }];
    if (benchmarkData && benchmarkData.length > 0) {
         datasets.push({ label: benchmarkLabel, data: benchmarkData, borderColor: '#94a3b8', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, tension: 0.1 });
    }

    ChartInstances.xray = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: { 
            responsive: true, maintainAspectRatio: false, parsing: { xAxisKey: 'x', yAxisKey: 'y' }, 
            scales: { x: { type: 'time', grid: { display: false }, time: { unit: 'month' } }, y: { grid: { color: THEME.grid } } }, 
            plugins: { legend: { position: 'top', align: 'end' } } 
        }
    });
}

// --- 7. MAPA DE RIESGO ---
export function renderRiskMap(portfolioMetrics, assets, synthetics = []) {
    const container = document.getElementById('riskPlot');
    if(!container) return;
    if (container.data) Plotly.purge(container);

    const pVol = (portfolioMetrics.volatility || 0.12) * 100;
    const pRet = (portfolioMetrics.cagr || 0.05) * 100;
    
    const tracePort = { 
        x: [pVol], y: [pRet], 
        text: ['<b>TU CARTERA</b>'], 
        mode: 'markers+text', 
        textposition: 'top center', 
        name: 'Cartera', 
        marker: { size: 18, color: THEME.navy, line: {color: THEME.gold, width:3} }, 
        type: 'scatter' 
    };
    
    const colors = {'Conservador': '#10B981', 'Moderado': '#3B82F6', 'Dinámico': '#F59E0B', 'Agresivo': '#EF4444'};
    const traceBench = { 
        x: synthetics.map(s => (s.vol || 0) * 100), 
        y: synthetics.map(s => (s.ret || 0) * 100), 
        text: synthetics.map(s => `<b>${s.name}</b>`), 
        mode: 'markers+text', 
        textposition: 'bottom center', 
        name: 'Benchmarks', 
        marker: { size: 12, color: synthetics.map(s => colors[s.name] || THEME.gold), symbol: 'diamond', line: {color:'white', width:1} }, 
        type: 'scatter' 
    };
    
    const layout = { 
        font: { family: 'Roboto', size: 10 }, 
        margin: { t: 10, b: 30, l: 40, r: 10 }, 
        xaxis: { title: 'Riesgo (Vol) %', showgrid: true, gridcolor: '#f1f5f9' }, 
        yaxis: { title: 'Retorno %', showgrid: true, gridcolor: '#f1f5f9' }, 
        showlegend: false, 
        paper_bgcolor: 'rgba(0,0,0,0)', 
        plot_bgcolor: 'rgba(0,0,0,0)' 
    };
    const config = { responsive: true, displayModeBar: false };
    
    Plotly.newPlot('riskPlot', [traceBench, tracePort], layout, config);
}

// --- 8. MATRIZ DE CORRELACIÓN ---
export function renderCorrelationHeatmap(matrix, assetNames) {
    const container = document.getElementById('correlation-matrix-container');
    if(!container) return;
    const mat = matrix || [[1]];
    const names = assetNames || ['Port'];
    
    let html = `
    <div class="w-full max-w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
        <table class="w-full text-[10px] border-collapse">
            <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th class="p-2 bg-slate-50 sticky left-0 z-10"></th>`;
                    
    names.forEach(n => {
        html += `<th class="p-2 font-bold text-slate-500 w-16 text-center uppercase tracking-wider truncate" title="${n}">${n.substring(0,6)}</th>`;
    });
    
    html += `   </tr>
            </thead>
            <tbody>`;
            
    for(let i=0; i<mat.length; i++) {
        html += `<tr>
                    <td class="p-2 font-bold text-slate-700 text-right bg-slate-50 border-r border-slate-200 uppercase tracking-wider whitespace-nowrap sticky left-0 z-10" title="${names[i]}">
                        ${names[i].substring(0,8)}
                    </td>`;
                    
        for(let j=0; j<mat[i].length; j++) {
            const val = mat[i][j];
            let bg = 'bg-white'; let txt = 'text-slate-800';
            
            if(val >= 0.99) { bg = 'bg-[#0B2545]'; txt = 'text-white font-bold'; } 
            else if(val > 0.8) { bg = 'bg-[#1e3a8a]'; txt = 'text-white'; }
            else if(val > 0.5) { bg = 'bg-blue-100'; txt = 'text-blue-800'; }
            else if(val > 0.2) { bg = 'bg-slate-50'; txt = 'text-slate-600'; }
            else if(val > -0.2) { bg = 'bg-white'; txt = 'text-slate-300'; }
            else { bg = 'bg-emerald-50'; txt = 'text-emerald-700'; }
            
            html += `<td class="p-2 text-center font-mono ${bg} ${txt} border border-slate-100">${val.toFixed(2)}</td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    
    container.innerHTML = html;
}