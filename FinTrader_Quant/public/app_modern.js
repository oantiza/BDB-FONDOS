import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { renderDashboardChart, renderXRayChart, renderAllocationDonut, renderRiskMap, renderCorrelationHeatmap, renderStyleBox, renderComparisonChart } from './chartEngine.js';
import { showToast, formatCurrency } from './ui.js';

// --- CONSTANTES ---
const EXCLUDED_BENCHMARK_ISINS = ['IE00B18GC888', 'IE00B03HCZ61'];

// --- ESTADO GLOBAL ---
let fundDatabase = [];
let currentPortfolio = [];
let proposedPortfolio = [];
let db, functions, auth;
let xrayFullData = { port: [], benchmarks: {}, synthetics: [] }; 
let currentBenchmarkKey = null; 

// --- UTILS DE UI ---
const openModal = (id) => { 
    const m = document.getElementById(id); 
    if(m) { 
        m.classList.remove('hidden');
        m.classList.add('flex');
        setTimeout(() => { m.classList.remove('opacity-0'); const child = m.querySelector('div'); if(child) child.classList.remove('scale-95'); }, 10);
    }
};

window.closeModal = (id) => { 
    const m = document.getElementById(id); 
    if(m) { 
        m.classList.add('opacity-0'); const child = m.querySelector('div'); if(child) child.classList.add('scale-95');
        setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300); 
    }
};

window.openVipModal = () => { openModal('vip-modal'); };

// --- NORMALIZACIÓN DE DATOS ---
function normalizeFundData(docData) {
    let tipoCalc = 'Mixto';
    const eq = docData.metrics?.equity || 0;
    const bd = docData.metrics?.bond || 0;
    const cash = docData.metrics?.cash || 0;
    
    if (eq >= 60) tipoCalc = 'RV'; else if (bd >= 60) tipoCalc = 'RF'; else if (cash >= 60) tipoCalc = 'Monetario';

    let sizeCalc = 'Large'; let styleCalc = 'Blend';
    if (docData.style) {
        const s = (docData.style.investment_style || "").toLowerCase();
        if (s.includes('valor')) styleCalc = 'Value'; else if (s.includes('crecimiento')) styleCalc = 'Growth';
        const caps = docData.style.market_cap || {};
        const giant = caps.gigante || 0; const large = caps.grande || 0; const mid = caps.mediano || 0; const small = (caps.pequeño || 0) + (caps.micro || 0);
        if (small > mid && small > (giant + large)) sizeCalc = 'Small'; else if (mid > (giant + large) && mid > small) sizeCalc = 'Mid';
    }

    let ret3y = 0.05; if (docData.returns && docData.returns['3y_annualized'] != null) ret3y = docData.returns['3y_annualized'] / 100;
    let vol = 0.10; if (docData.perf && docData.perf.volatility != null) vol = docData.perf.volatility / 100;

    return {
        ...docData,
        std_type: tipoCalc, 
        std_style: { size: sizeCalc, investment: styleCalc },
        std_perf: { volatility: vol, cagr3y: ret3y },
        holdings: docData.holdings || [] 
    };
}

// --- INICIO APP ---
export async function startApp(user, firebaseApp) {
    console.log("Iniciando App en region europe-west1...");
    db = getFirestore(firebaseApp);
    functions = getFunctions(firebaseApp, "europe-west1");
    auth = getAuth(firebaseApp);
    
    const userEl = document.getElementById('user-display');
    if (userEl) userEl.textContent = user.email;
    
    setupListeners();
    await loadData();
    setTimeout(() => { updatePortfolioUI(); }, 500);
}

function setupListeners() {
    const safeListener = (id, event, handler) => { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); };

    safeListener('fund-search', 'input', (e) => filterGrid(e.target.value));
    safeListener('portfolio-form', 'submit', generateManualProposal);
    safeListener('run-backtest-btn', 'click', runXRay);
    safeListener('csv-upload', 'change', handleCSVUpload);
    safeListener('btn-optimize', 'click', runOptimizationWithComparison);
    safeListener('btn-accept-optimization', 'click', () => { closeModal('comparison-modal'); openAdvancedEditor(); });
    safeListener('btn-save-final-portfolio', 'click', saveFinalPortfolio);
    safeListener('editor-add-fund-input', 'input', handleEditorSearch);
    safeListener('btn-news-bell', 'click', openNews);
    safeListener('btn-open-costs-tool', 'click', () => { renderCosts(); openModal('costs-detail-modal'); });
    safeListener('btn-open-tactical', 'click', () => openModal('tactical-modal'));
    safeListener('btn-open-vip-tool', 'click', window.openVipModal);

    window.updateXRayTimeframe = (period) => {
        ['1Y','3Y','5Y'].forEach(p => {
             const btn = document.getElementById(`btn-${p.toLowerCase()}`);
             if(btn) {
                 if(p === period) { btn.classList.add('bg-[#0B2545]', 'text-white', 'shadow'); btn.classList.remove('bg-white', 'text-slate-500'); }
                 else { btn.classList.remove('bg-[#0B2545]', 'text-white', 'shadow'); btn.classList.add('bg-white', 'text-slate-500'); }
             }
        });
        const input = document.getElementById('xray-period-input');
        if(input) input.value = period; 
        filterAndRenderXRay();
    };

    window.updateBenchmarkSelection = (key) => { currentBenchmarkKey = key; filterAndRenderXRay(); };
}

// --- GESTIÓN DE DATOS ---
async function loadData() {
    try {
        const snap = await getDocs(collection(db, "funds_v2"));
        let allFunds = [];
        snap.forEach(d => { allFunds.push(normalizeFundData({isin: d.id, ...d.data()})); });
        fundDatabase = allFunds.filter(f => !EXCLUDED_BENCHMARK_ISINS.includes(f.isin));
        renderGrid(fundDatabase);
    } catch(e) { console.error("Error cargando fondos:", e); }
}

function renderGrid(list) {
    const c = document.getElementById('main-grid-container');
    if(!c) return;
    c.innerHTML = list.slice(0, 50).map(f => `
        <div class="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center group transition-colors" onclick="addFund('${f.isin}')">
            <div><div class="text-xs font-bold text-[#0B2545] truncate w-40">${f.name}</div><div class="text-[9px] text-slate-400 font-mono">${f.isin}</div></div>
            <span class="text-[#D4AF37] font-bold opacity-0 group-hover:opacity-100 text-lg">+</span>
        </div>
    `).join('');
}
function filterGrid(term) { renderGrid(fundDatabase.filter(f => f.name.toLowerCase().includes(term.toLowerCase()) || f.isin.toLowerCase().includes(term.toLowerCase()))); }

// --- FUNCIONES DE CARTERA ---
window.addFund = (isin) => {
    const f = fundDatabase.find(x => x.isin === isin);
    if(f && !currentPortfolio.some(x=>x.isin===isin)) { currentPortfolio.push({ ...f, weight: 0 }); updatePortfolioUI(); showToast("Fondo añadido"); }
};
window.removeFund = (isin) => { currentPortfolio = currentPortfolio.filter(x=>x.isin!==isin); updatePortfolioUI(); };
window.updateWeight = (isin, val) => { const f = currentPortfolio.find(x=>x.isin===isin); if(f) f.weight = parseFloat(val)||0; updatePortfolioUI(); };

function updatePortfolioUI() {
    const tbody = document.getElementById('portfolio-table-body');
    if(!tbody) return;
    const invInput = document.getElementById('investment_amount');
    const totalCap = invInput ? (parseFloat(invInput.value) || 100000) : 100000;
    let totalW = 0, rv=0, rf=0, cash=0;
    
    tbody.innerHTML = currentPortfolio.map(f => {
        totalW += f.weight;
        const val = totalCap * (f.weight / 100);
        if(f.std_type === 'RV') rv += f.weight; else if(f.std_type === 'RF') rf += f.weight; else cash += f.weight;
        return `<tr class="border-b border-slate-50 hover:bg-slate-50 group"><td class="p-3 truncate max-w-[180px] font-medium text-[#0B2545] text-xs">${f.name}</td><td class="p-3 text-right"><input type="number" class="w-12 text-right bg-transparent outline-none font-bold text-[#0B2545] text-xs" value="${f.weight.toFixed(2)}" onchange="window.updateWeight('${f.isin}', this.value)">%</td><td class="p-3 text-right font-mono text-slate-500 font-bold text-xs">${formatCurrency(val)}</td><td class="p-3 text-right"><button onclick="removeFund('${f.isin}')" class="text-slate-300 hover:text-red-500">&times;</button></td></tr>`;
    }).join('');

    const fW = document.getElementById('footer-total-weight');
    const fA = document.getElementById('footer-total-amount');
    if(fW) fW.textContent = totalW.toFixed(1) + '%';
    if(fA) fA.textContent = formatCurrency(totalCap * (totalW/100));
    
    renderAllocationDonut({rv, rf, other: cash});
    renderStyleBox(currentPortfolio);

    // Proyección Dashboard
    const mv = document.getElementById('mini-volatility');
    const mr = document.getElementById('mini-return');
    const ms = document.getElementById('mini-sharpe');
    
    let pVol = 0.08, pRet = 0.05;
    if(totalW > 0.1 && currentPortfolio.length > 0) {
        let wVol = 0, wRet = 0;
        currentPortfolio.forEach(f => {
            const w = f.weight / 100;
            const fVol = f.std_perf ? f.std_perf.volatility : 0.12;
            const fRet = f.std_perf ? f.std_perf.cagr3y : 0.06;
            wVol += fVol * w; wRet += fRet * w;
        });
        const diversificationFactor = currentPortfolio.length > 3 ? 0.85 : 1.0;
        pVol = Math.max(0.02, wVol * diversificationFactor); pRet = wRet;
        if(mv) mv.textContent = (pVol*100).toFixed(2) + '%';
        if(mr) mr.textContent = (pRet*100).toFixed(2) + '%';
        if(ms) ms.textContent = pVol > 0 ? ((pRet - 0.025) / pVol).toFixed(2) : "0.00";
    } else { if(mv) mv.textContent = "-"; if(mr) mr.textContent = "-"; if(ms) ms.textContent = "-"; }

    const points = []; let v = 100; 
    const dailyVol = pVol / Math.sqrt(252); const dailyRet = pRet / 252;
    points.push({x: 0, y: 100});
    for(let i=1; i<=150; i++){ const change = (dailyRet + (Math.random() - 0.5) * 2 * dailyVol); v *= (1 + change); points.push({x: i, y: v}); }
    renderDashboardChart(points);
}

function generateManualProposal(e) { 
    e.preventDefault(); 
    const numInput = document.getElementById('number_of_funds');
    const num = numInput ? (parseInt(numInput.value)||5) : 5;
    if(!fundDatabase.length) return showToast("Cargando...", "info");
    const selected = fundDatabase.slice(0, num); 
    const w = 100/selected.length; 
    currentPortfolio = selected.map(f => ({ ...f, weight: w })); 
    updatePortfolioUI(); 
    showToast("Propuesta generada", "success"); 
}

async function handleCSVUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    const text = await file.text();
    const rows = text.split('\n').map(r => r.split(';'));
    let imported = [], notFound = [], totalVal = 0;
    for(let i=1; i<rows.length; i++) {
        const row = rows[i];
        if(row.length < 5) continue; 
        const isin = row[1]?.trim();
        let valStr = row[row.length-1]?.trim() || "0";
        valStr = valStr.replace(/\./g, '').replace(',', '.'); 
        const value = parseFloat(valStr) || 0;
        if(!isin) continue;
        const fund = fundDatabase.find(f => f.isin === isin);
        if(fund) { imported.push({ ...fund, rawValue: value }); totalVal += value; } else { notFound.push(isin); }
    }
    if(notFound.length > 0) showToast(`Alerta: ${notFound.length} fondos no encontrados.`, 'error');
    if(imported.length > 0) {
        currentPortfolio = imported.map(f => ({ ...f, weight: (f.rawValue / totalVal) * 100 }));
        const invInput = document.getElementById('investment_amount');
        if(invInput) invInput.value = Math.round(totalVal);
        updatePortfolioUI();
        showToast("Cartera importada", "success");
    }
}

// --- RENDERIZADOR DE TOP HOLDINGS ---
function renderTopHoldings(portfolio, containerId = 'top-holdings-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const aggregatedHoldings = {};
    
    portfolio.forEach(f => {
        if (f.weight <= 0) return;
        const holdings = f.holdings || [];
        holdings.forEach(h => {
            const effectiveWeight = (h.weight / 100) * (f.weight / 100); 
            const key = (h.name || "Desconocido").toUpperCase();
            if (aggregatedHoldings[key]) { aggregatedHoldings[key].weight += effectiveWeight; } 
            else { aggregatedHoldings[key] = { name: h.name, weight: effectiveWeight, sector: h.sector || 'N/A' }; }
        });
    });

    const topHoldings = Object.values(aggregatedHoldings).sort((a, b) => b.weight - a.weight).slice(0, 10);
    if (topHoldings.length === 0) { container.innerHTML = '<div class="col-span-5 text-center text-slate-400 italic">No hay datos de posiciones.</div>'; return; }

    container.innerHTML = topHoldings.map(h => {
        const percent = (h.weight * 100).toFixed(2);
        return `<div class="bg-slate-50 p-2 rounded border border-slate-100 hover:bg-white transition-colors"><div class="flex justify-between items-start mb-1"><div class="text-[10px] font-bold text-[#0B2545] truncate w-28" title="${h.name}">${h.name}</div></div><div class="flex justify-between items-end border-t border-slate-100 pt-1"><span class="text-[9px] text-slate-400 truncate max-w-[60px]" title="${h.sector}">${h.sector}</span><span class="text-xs font-mono font-black text-slate-700">${percent}%</span></div></div>`;
    }).join('');
}

// --- FUNCIONES BACKEND ---
async function runOptimizationWithComparison() {
    if(!currentPortfolio.length) return showToast("Añade fondos", "error");
    const btn = document.getElementById('btn-optimize'); 
    const prev = btn.innerHTML; btn.innerHTML = `<span class="animate-spin">⚙️</span> Calculando...`; btn.disabled = true;
    try {
        const riskInput = document.getElementById('risk_level');
        const fnOpt = httpsCallable(functions, 'optimize_portfolio_quant');
        const resOpt = await fnOpt({ assets: currentPortfolio.map(f=>f.isin), risk_level: riskInput ? parseInt(riskInput.value) : 5 });
        if(resOpt.data.status === 'error') throw new Error(resOpt.data.warnings[0]);
        const w = resOpt.data.weights || {};
        proposedPortfolio = currentPortfolio.map(f => ({ ...f, weight: (w[f.isin] || 0) * 100 })).filter(f => f.weight > 0.01);
        
        const fnBacktest = httpsCallable(functions, 'backtest_portfolio');
        const [resOld, resNew] = await Promise.all([ fnBacktest({ portfolio: currentPortfolio, years: 5 }), fnBacktest({ portfolio: proposedPortfolio, years: 5 }) ]);
        
        // FIX: Abrir modal primero para que el canvas tenga dimensiones
        openModal('comparison-modal');

        setTimeout(() => {
            if(resOld.data.portfolioSeries && resNew.data.portfolioSeries) { 
                renderComparisonChart(
                    resOld.data.portfolioSeries.map(p=>({x:p.x,y:p.y})), 
                    resNew.data.portfolioSeries.map(p=>({x:p.x,y:p.y}))
                ); 
            }
        }, 300); // 300ms de espera para la animación del modal

        // Asignar Métricas
        const mOld = resOld.data.metrics || {};
        const mNew = resNew.data.metrics || {};
        const updateRow = (id, oldV, newV, fmt) => {
            const elOld = document.getElementById(`comp-${id}-old`);
            const elNew = document.getElementById(`comp-${id}-new`);
            const elDiff = document.getElementById(`comp-${id}-diff`);
            if(elOld) elOld.textContent = fmt(oldV || 0);
            if(elNew) elNew.textContent = fmt(newV || 0);
            if(elDiff) {
                const diff = (newV || 0) - (oldV || 0);
                elDiff.textContent = (diff>0?'+':'') + fmt(diff);
                let good = diff > 0;
                if(id==='vol' || id==='mdd') good = diff < 0; 
                if(id==='mdd') good = diff > 0;
                elDiff.className = `text-right font-bold ${good?'text-emerald-600':'text-red-500'}`;
            }
        };
        const pct = v => (v*100).toFixed(2)+'%';
        const num = v => v.toFixed(2);
        updateRow('cagr', mOld.cagr, mNew.cagr, pct);
        updateRow('vol', mOld.volatility, mNew.volatility, pct);
        updateRow('sharpe', mOld.sharpe, mNew.sharpe, num);
        updateRow('mdd', mOld.max_drawdown, mNew.max_drawdown, pct);

        const renderBar = (id, p) => {
            let rv=0, rf=0, liq=0;
            p.forEach(f=>{ if(f.std_type==='RV') rv+=f.weight; else if(f.std_type==='RF') rf+=f.weight; else liq+=f.weight; });
            const t = rv+rf+liq || 1;
            const el = document.getElementById(id);
            if(el) el.innerHTML = `<div style="width:${(rv/t)*100}%;" class="h-full bg-emerald-500"></div><div style="width:${(rf/t)*100}%;" class="h-full bg-[#0B2545]"></div><div style="width:${(liq/t)*100}%;" class="h-full bg-[#D4AF37]"></div>`;
        };
        renderBar('comp-bar-old', currentPortfolio);
        renderBar('comp-bar-new', proposedPortfolio);

    } catch(e) { console.error(e); showToast("Error: " + e.message, "error"); } 
    finally { btn.innerHTML = prev; btn.disabled = false; }
}

async function runXRay() {
    if(!currentPortfolio.length) return showToast("Cartera vacía", "error");
    const btn = document.getElementById('run-backtest-btn'); const prev = btn.innerText; btn.innerText = "Calculando..."; btn.disabled = true;
    try {
        const fn = httpsCallable(functions, 'backtest_portfolio');
        const res = await fn({ portfolio: currentPortfolio, years: 5 });
        const d = res.data;
        xrayFullData = { port: d.portfolioSeries || [], benchmarks: d.benchmarkSeries || {}, synthetics: d.synthetics || [] };
        if(d.metrics){
            const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
            setTxt('metric-cagr', ((d.metrics.cagr||0)*100).toFixed(2)+'%'); setTxt('metric-volatility', ((d.metrics.volatility||0)*100).toFixed(2)+'%'); setTxt('metric-sharpe', (d.metrics.sharpe||0).toFixed(2)); setTxt('metric-maxdd', ((d.metrics.maxDrawdown||0)*100).toFixed(2)+'%');
        }
        openModal('analysis-modal'); renderTopHoldings(currentPortfolio); 
        if(window.updateXRayTimeframe) window.updateXRayTimeframe('3Y'); 
        
        // Esperamos renderizar
        setTimeout(() => { 
            // Si hay datos, render inicial (por defecto 3Y)
            if(d.metrics && xrayFullData.synthetics) {
                // Forzar calculo inicial con 3Y para Risk Map
                updateRiskMapWithPeriod('3Y');
            }
            if(d.correlationMatrix) renderCorrelationHeatmap(d.correlationMatrix, currentPortfolio.map(f => f.name)); 
        }, 300);
    } catch(e) { console.error(e); showToast("Error X-Ray", "error"); } finally { btn.innerText = prev; btn.disabled = false; }
}

function filterAndRenderXRay() {
    if(!xrayFullData.port || !xrayFullData.port.length) return;
    const pEl = document.getElementById('xray-period-input'); const period = pEl ? pEl.value : '3Y'; const k = currentBenchmarkKey; 
    
    const today = new Date(); const cutoff = new Date();
    if(period === '1Y') cutoff.setFullYear(today.getFullYear() - 1); else if(period === '3Y') cutoff.setFullYear(today.getFullYear() - 3); else cutoff.setFullYear(today.getFullYear() - 10);
    
    const fp = xrayFullData.port.filter(x => new Date(x.x) >= cutoff);
    
    // 1. Gráfico Histórico
    let fb = []; let benchmarkLabel = "Seleccione Benchmark";
    if (k && xrayFullData.benchmarks[k]) { fb = xrayFullData.benchmarks[k].filter(x => new Date(x.x) >= cutoff); benchmarkLabel = k.charAt(0).toUpperCase() + k.slice(1); }
    const norm = (arr) => { if(!arr.length) return []; const start = arr[0].y; return arr.map(z=>({x:new Date(z.x).getTime(), y:(z.y/start)*100})); };
    renderXRayChart(norm(fp), norm(fb), benchmarkLabel);
    
    // 2. Mapa Riesgo (Recálculo Dinámico)
    updateRiskMapWithPeriod(period, fp);
    updateRiskMapExplanation(period);
}

// Nueva función: Calcula stats al vuelo para el mapa de riesgo
function calculateStats(series) {
    if(!series || series.length < 2) return { vol: 0, ret: 0 };
    
    // Convertir a retornos diarios
    const rets = [];
    for(let i=1; i<series.length; i++) {
        const r = (series[i].y / series[i-1].y) - 1;
        rets.push(r);
    }
    
    const n = rets.length;
    const mean = rets.reduce((a,b)=>a+b, 0) / n;
    const variance = rets.reduce((a,b)=>a + Math.pow(b-mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    // Anualizar
    const annVol = stdDev * Math.sqrt(252);
    const totalRet = (series[series.length-1].y / series[0].y) - 1;
    const annRet = Math.pow(1 + totalRet, 252/n) - 1;
    
    return { vol: annVol, ret: annRet };
}

function updateRiskMapWithPeriod(period, filteredSeries = null) {
    // Si no pasamos serie filtrada, la buscamos
    let seriesToCalc = filteredSeries;
    if(!seriesToCalc && xrayFullData.port) {
        const cutoff = new Date();
        if(period === '1Y') cutoff.setFullYear(cutoff.getFullYear() - 1); else if(period === '3Y') cutoff.setFullYear(cutoff.getFullYear() - 3); else cutoff.setFullYear(cutoff.getFullYear() - 10);
        seriesToCalc = xrayFullData.port.filter(x => new Date(x.x) >= cutoff);
    }
    
    if(seriesToCalc && seriesToCalc.length > 0) {
        const stats = calculateStats(seriesToCalc);
        // Llamamos al renderizador con las nuevas métricas calculadas
        renderRiskMap({volatility: stats.vol, cagr: stats.ret}, currentPortfolio, xrayFullData.synthetics);
    }
}

function updateRiskMapExplanation(period) {
    const container = document.getElementById('risk-map-explanation');
    if (!container) return;
    let explanation = '';
    if (period === '1Y') explanation = `<p class="font-bold text-slate-800">Foco Anual (1 Año):</p><p class="text-xs mt-1 text-justify">Este periodo corto refleja la sensibilidad inmediata a eventos de mercado recientes. La volatilidad tiende a ser mayor.</p><ul class="list-disc ml-4 mt-2 text-[10px] text-slate-500"><li>Ideal para ver reacción a shocks.</li><li>Poco representativo para largo plazo.</li></ul>`;
    else if (period === '3Y') explanation = `<p class="font-bold text-slate-800">Foco Medio Plazo (3 Años):</p><p class="text-xs mt-1 text-justify">El estándar de la industria. Captura un ciclo de mercado medio, equilibrando tendencia y ruido.</p><ul class="list-disc ml-4 mt-2 text-[10px] text-slate-500"><li>Base para evaluar consistencia.</li><li>Suaviza picos extremos de volatilidad.</li></ul>`;
    else if (period === '5Y') explanation = `<p class="font-bold text-slate-800">Foco Largo Plazo (5 Años):</p><p class="text-xs mt-1 text-justify">Muestra la resiliencia estructural de la cartera a través de ciclos completos (expansión/contracción).</p><ul class="list-disc ml-4 mt-2 text-[10px] text-slate-500"><li>Mejor medida de riesgo/retorno real.</li><li>Filtra ruido de corto plazo.</li></ul>`;
    else explanation = '<p class="text-slate-400 italic mt-10 text-center">Seleccione periodo.</p>';
    container.innerHTML = explanation;
}

// ... Resto de funciones (renderCosts, editors, etc) igual ...
function renderCosts() { 
    const tbody = document.getElementById('costs-table-body');
    const invInput = document.getElementById('investment_amount');
    const cap = invInput ? (parseFloat(invInput.value) || 0) : 0;
    if(!tbody) return;
    let total = 0;
    tbody.innerHTML = currentPortfolio.map(f => {
        const ter = (f.costs?.ter || 1.5) / 100; const costVal = cap * (f.weight/100) * ter; total += costVal;
        return `<tr class="border-b border-slate-100"><td class="p-2 text-slate-600">${f.name}</td><td class="p-2 text-right font-mono">${(ter*100).toFixed(2)}%</td><td class="p-2 text-right font-mono font-bold text-slate-800">${formatCurrency(costVal)}</td></tr>`;
    }).join('');
    const fc = document.getElementById('final-cost-result');
    if(fc) fc.textContent = formatCurrency(total);
}
function openAdvancedEditor() { openModal('advanced-editor-modal'); renderEditorTables(); }
function renderEditorTables() { const t=document.getElementById('editor-original-tbody'); if(t) t.innerHTML=currentPortfolio.map(f=>`<tr class="border-b border-slate-100 text-xs"><td class="py-2 truncate max-w-[120px]">${f.name}</td><td class="text-right font-mono">${f.weight.toFixed(1)}%</td></tr>`).join(''); renderProposedTable(); }
function renderProposedTable() { const tbody=document.getElementById('editor-proposed-tbody'); const ordersDiv=document.getElementById('rebalancing-orders-container'); const invInput=document.getElementById('investment_amount'); const cap=invInput?(parseFloat(invInput.value)||100000):100000; let totalW=0, ordersHTML='', turnover=0; if(!tbody)return; tbody.innerHTML=proposedPortfolio.map(f=>{ totalW+=f.weight; const orig=currentPortfolio.find(of=>of.isin===f.isin); const diffW=f.weight-(orig?orig.weight:0); const diffEUR=cap*(diffW/100); if(Math.abs(diffEUR)>10){ const type=diffEUR>0?'COMPRA':'VENTA'; const col=diffEUR>0?'bg-emerald-100 text-emerald-800':'bg-red-100 text-red-800'; ordersHTML+=`<div class="flex justify-between items-center p-2 bg-white border border-slate-100 rounded text-xs"><span class="font-bold ${col} px-2 py-0.5 rounded text-[10px] w-14 text-center">${type}</span><span class="truncate w-24 text-slate-600" title="${f.name}">${f.name}</span><span class="font-mono font-bold">${formatCurrency(Math.abs(diffEUR))}</span></div>`; turnover+=Math.abs(diffEUR); } const color=Math.abs(diffW)<0.1?'text-slate-300':(diffW>0?'text-emerald-600':'text-red-500'); return `<tr class="border-b border-slate-50 hover:bg-slate-50 group"><td class="p-3 text-[#0B2545] font-medium text-xs truncate max-w-[150px]">${f.name}</td><td class="p-3 text-right"><input type="number" class="w-14 text-right border rounded p-1 text-xs font-bold text-[#0B2545]" value="${f.weight.toFixed(2)}" onchange="window.updateProposedWeight('${f.isin}', this.value)">%</td><td class="p-3 text-right text-xs text-slate-400 font-mono">${(orig?orig.weight:0).toFixed(2)}%</td><td class="p-3 text-right text-xs font-mono font-bold ${color}">${diffW>0?'+':''}${diffW.toFixed(2)}%</td><td class="p-3 text-right text-xs font-mono ${color}">${diffW>0?'+':''}${formatCurrency(diffEUR)}</td><td class="p-3 text-center"><button onclick="window.removeProposedFund('${f.isin}')" class="text-slate-300 hover:text-red-500">&times;</button></td></tr>`; }).join(''); if(!ordersHTML) ordersHTML='<div class="text-center text-slate-400 italic text-xs mt-10">Sin cambios.</div>'; if(ordersDiv) ordersDiv.innerHTML=ordersHTML; const turnEl=document.getElementById('total-turnover'); if(turnEl)turnEl.textContent=`Vol: ${formatCurrency(turnover)}`; const totEl=document.getElementById('editor-total-weight-display'); if(totEl){totEl.textContent=`Total: ${totalW.toFixed(2)}%`; totEl.className=Math.abs(totalW-100)<0.1?"text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded":"text-xs font-bold bg-red-100 text-red-800 px-3 py-1 rounded";} }
window.autoRebalance100 = () => { let t = proposedPortfolio.reduce((s,f)=>s+f.weight,0); if(t>0) proposedPortfolio.forEach(f => f.weight = (f.weight/t)*100); renderProposedTable(); showToast("Ajustado al 100%"); };
window.updateProposedWeight = (i,v) => { const f = proposedPortfolio.find(x=>x.isin===i); if(f) f.weight = parseFloat(v)||0; renderProposedTable(); };
window.removeProposedFund = (i) => { proposedPortfolio = proposedPortfolio.filter(x=>x.isin!==i); renderProposedTable(); };
function handleEditorSearch(e) { const t = e.target.value.toLowerCase(); const r = document.getElementById('editor-search-results'); if(!r) return; if(t.length<3) { r.classList.add('hidden'); return; } const m = fundDatabase.filter(f=>f.name.toLowerCase().includes(t)||f.isin.toLowerCase().includes(t)).slice(0,5); r.innerHTML = m.map(f=>`<div class="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs" onclick="window.addFundToProposed('${f.isin}')"><span class="truncate max-w-[200px] font-bold text-[#0B2545]">${f.name}</span><span class="text-blue-600 font-bold">+</span></div>`).join(''); r.classList.remove('hidden'); }
window.addFundToProposed = (i) => { const f = fundDatabase.find(x=>x.isin===i); if(f && !proposedPortfolio.some(x=>x.isin===i)){ proposedPortfolio.push({...f, weight:0}); renderProposedTable(); document.getElementById('editor-search-results').classList.add('hidden'); document.getElementById('editor-add-fund-input').value=''; } };
function saveFinalPortfolio() { currentPortfolio = [...proposedPortfolio]; updatePortfolioUI(); closeModal('advanced-editor-modal'); showToast("Cartera guardada","success"); }
async function openNews() { openModal('news-modal'); const c=document.getElementById('news-general-container'); if(!c)return; c.innerHTML='<div class="text-center py-10 text-slate-400 italic animate-pulse">Cargando...</div>'; try{const fn=httpsCallable(functions,'getFinancialNews');const res=await fn();const a=res.data.articles||[];if(!a.length)c.innerHTML='Sin noticias.';else c.innerHTML=a.map(x=>`<div class="mb-4 p-4 border border-slate-100 rounded bg-slate-50 hover:bg-white transition-all"><h4 class="text-sm font-bold text-[#0B2545]">${x.title}</h4><p class="text-xs text-slate-600">${x.summary}</p></div>`).join('');}catch(e){console.error(e);} }