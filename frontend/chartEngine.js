const Chart = window.Chart;
const Plotly = window.Plotly;

if (Chart) {
    Chart.defaults.color = '#334155';
    Chart.defaults.borderColor = '#e2e8f0';
    Chart.defaults.font.family = "'Roboto', sans-serif";
    Chart.defaults.maintainAspectRatio = false;
}

const ChartInstances = { main: null, xray: null, allocation: null, comparison: null, riskMap: null };
const THEME = { navy: '#0B2545', gold: '#D4AF37', slate: '#64748b', grid: '#f1f5f9' };

export function renderDashboardChart(dataInput, canvasId = 'main-history-chart') {
    const ctx = document.getElementById(canvasId); 
    if (!ctx) return;
    if (ChartInstances.main) { ChartInstances.main.destroy(); ChartInstances.main = null; }
    
    // Detectar si recibimos múltiples simulaciones (Array de Arrays) o una sola (Array de Puntos)
    const isMultiPath = Array.isArray(dataInput) && Array.isArray(dataInput[0]);
    
    // Configuración de Datasets
    let datasets = [];
    
    if (isMultiPath) {
        // MODO CONO: Generamos múltiples líneas con baja opacidad
        datasets = dataInput.map((simulationPoints) => ({
            data: simulationPoints,
            borderColor: 'rgba(11, 37, 69, 0.15)', // Color Navy con 15% de opacidad
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false, // Sin relleno para evitar manchas oscuras
            tension: 0.4 // Curvas suaves
        }));
        
        // Opcional: Añadir una línea promedio en negrita para guiar el ojo
        // (Podrías calcular el promedio aquí, pero para mantenerlo simple, dejamos el cono puro)
        
    } else {
        // MODO SIMPLE (Fallback): Una sola línea con gradiente (Como estaba antes)
        const safeData = (dataInput && dataInput.length > 1) ? dataInput : [
            {x:0, y:100}, {x:30, y:102}, {x:60, y:101}, {x:90, y:104}, {x:120, y:103}, {x:150, y:106}
        ];
        
        const ctx2d = ctx.getContext('2d');
        let gradient = 'rgba(11, 37, 69, 0.1)';
        if (ctx2d) {
            try {
                gradient = ctx2d.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, 'rgba(11, 37, 69, 0.2)'); gradient.addColorStop(1, 'rgba(11, 37, 69, 0.0)');
            } catch(e) {}
        }

        datasets = [{ 
            data: safeData, 
            borderColor: THEME.navy, 
            backgroundColor: gradient, 
            borderWidth: 2, 
            pointRadius: 0, 
            fill: true, 
            tension: 0.4 
        }];
    }

    // Calcular min/max para escalar el gráfico correctamente
    let allY = [];
    if(isMultiPath) {
        dataInput.forEach(arr => arr.forEach(p => allY.push(p.y)));
    } else {
        datasets[0].data.forEach(p => allY.push(p.y));
    }
    const minY = Math.min(...allY) * 0.98;
    const maxY = Math.max(...allY) * 1.02;

    ChartInstances.main = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            parsing: { xAxisKey: 'x', yAxisKey: 'y' }, 
            plugins: { 
                legend: { display: false },
                tooltip: { enabled: false } // Desactivar tooltip porque con 20 líneas es molesto
            }, 
            scales: { 
                x: { type: 'linear', display: false }, 
                y: { display: false, min: minY, max: maxY } 
            }, 
            elements: { point: { radius: 0 } },
            animation: { duration: 0 } // Desactivar animación para rendimiento instantáneo
        }
    });
}
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
            scales: { x: { type: 'time', grid: { display: false }, time: { unit: 'month' } }, y: { grid: { color: THEME.grid } } } 
        }
    });
}

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
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, usePointStyle: true, padding: 10 } }, tooltip: { enabled: total > 0.1 } }, cutout: '70%' }
    });
}

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

export function renderXRayChart(portfolioData, benchmarkData = [], benchmarkLabel = 'Benchmark', canvasId = 'backtest-chart') {
    const ctx = document.getElementById(canvasId); 
    if (!ctx) return;
    if (ChartInstances.xray) ChartInstances.xray.destroy();
    
    const datasets = [{ label: 'Mi Cartera', data: portfolioData, borderColor: THEME.navy, borderWidth: 2, pointRadius: 0, tension: 0.1 }];
    if (benchmarkData && benchmarkData.length > 0 && benchmarkLabel !== 'Seleccione Benchmark') {
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
        marker: { size: 22, color: THEME.navy, line: {color: THEME.gold, width:3} }, 
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
        marker: { size: 14, color: synthetics.map(s => colors[s.name] || THEME.gold), symbol: 'diamond', line: {color:'white', width:1} }, 
        type: 'scatter' 
    };
    
    const layout = { 
        font: { family: 'Roboto' }, 
        margin: { t: 20, b: 40, l: 50, r: 20 }, 
        xaxis: { title: 'Riesgo (Volatilidad) %', showgrid: true, gridcolor: '#f1f5f9' }, 
        yaxis: { title: 'Retorno Anual %', showgrid: true, gridcolor: '#f1f5f9' }, 
        showlegend: false, 
        paper_bgcolor: 'rgba(0,0,0,0)', 
        plot_bgcolor: 'rgba(0,0,0,0)' 
    };
    const config = { responsive: true, displayModeBar: false };
    
    Plotly.newPlot('riskPlot', [traceBench, tracePort], layout, config);
}

export function renderCorrelationHeatmap(matrix, assetNames) {
    const container = document.getElementById('correlation-matrix-container');
    if(!container) return;
    const mat = matrix || [[1]];
    const names = assetNames || ['Port'];
    
    let html = `
    <div class="w-full max-w-3xl border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <table class="w-full text-[13px] border-collapse">
            <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th class="p-3 bg-slate-50"></th>`;
                    
    names.forEach(n => {
        html += `<th class="p-3 font-bold text-slate-500 w-20 text-center text-[11px] uppercase tracking-wider truncate" title="${n}">${n.substring(0,6)}</th>`;
    });
    
    html += `   </tr>
            </thead>
            <tbody>`;
            
    for(let i=0; i<mat.length; i++) {
        html += `<tr>
                    <td class="p-3 font-bold text-slate-700 text-right bg-slate-50 border-r border-slate-200 text-[11px] uppercase tracking-wider whitespace-nowrap" title="${names[i]}">
                        ${names[i].substring(0,8)}
                    </td>`;
                    
        for(let j=0; j<mat[i].length; j++) {
            const val = mat[i][j];
            let bg = 'bg-white'; let txt = 'text-slate-800';
            
            if(val >= 0.99) { bg = 'bg-[#0B2545]'; txt = 'text-white font-bold'; } 
            else if(val > 0.8) { bg = 'bg-[#1e3a8a]'; txt = 'text-white'; }
            else if(val > 0.6) { bg = 'bg-blue-100'; txt = 'text-blue-800'; }
            else if(val > 0.3) { bg = 'bg-slate-50'; txt = 'text-slate-600'; }
            else if(val > 0) { bg = 'bg-white'; txt = 'text-slate-400'; }
            else { bg = 'bg-emerald-50'; txt = 'text-emerald-700'; }
            
            html += `<td class="p-3 text-center font-mono ${bg} ${txt} border border-slate-100">${val.toFixed(2)}</td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    
    container.className = "flex justify-center items-center w-full h-full p-6 bg-slate-50/50";
    container.innerHTML = html;
}