import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { renderDashboardChart, renderXRayChart, renderAllocationDonut, renderRiskMap, renderCorrelationHeatmap, renderStyleBox, renderComparisonChart } from './chartEngine.js';
import { showToast, formatCurrency } from './ui.js';
import { openModal, closeModal } from './modals.js';
import { initNewsModule } from './news.js';
import { generateSmartPortfolio } from './portfolio.js';
import { setFundData } from './store.js';

const EXCLUDED_BENCHMARK_ISINS = ['IE00B18GC888', 'IE00B03HCZ61'];

// --- ESTADO GLOBAL ---
let fundDatabase = [];
let currentPortfolio = [];
let proposedPortfolio = [];
let db, functions, auth;
let xrayFullData = { port: [], benchmarks: {}, synthetics: [] }; 
let currentBenchmarkKey = null; 

// --- NORMALIZACIÓN MAESTRA DE DATOS ---
function normalizeFundData(docData) {
    let tipoCalc = 'Mixto';
    const eq = parseFloat(docData.metrics?.equity || 0);
    const bd = parseFloat(docData.metrics?.bond || 0);
    const cash = parseFloat(docData.metrics?.cash || 0);
    
    if (eq >= 60) tipoCalc = 'RV'; 
    else if (bd >= 60) tipoCalc = 'RF'; 
    else if (cash >= 60) tipoCalc = 'Monetario';
    
    if (tipoCalc === 'Mixto' && docData.manual_type) {
        const mt = docData.manual_type.toUpperCase();
        if (mt.includes('RENTA VARIABLE') || mt.includes('EQUITY')) tipoCalc = 'RV';
        else if (mt.includes('RENTA FIJA') || mt.includes('DEUDA')) tipoCalc = 'RF';
        else if (mt.includes('MONETARIO')) tipoCalc = 'Monetario';
    }

    let regionCalc = 'Global';
    if (docData.primary_region) {
        const pr = docData.primary_region.toUpperCase();
        if (pr === 'USA' || pr === 'ESTADOS UNIDOS' || pr === 'EEUU') regionCalc = 'USA';
        else if (pr === 'EUROPE' || pr === 'EUROZONA' || pr === 'EURO') regionCalc = 'Europe';
        else if (pr === 'ASIA' || pr === 'EMERGING' || pr === 'LATAM') regionCalc = 'Emerging';
    } else if (docData.regions) {
        if ((docData.regions.americas || 0) > 60) regionCalc = 'USA';
        else if ((docData.regions.europe || 0) > 60) regionCalc = 'Europe';
    }

    let styleCalc = 'Blend';
    const invStyle = (docData.style?.investment_style || "").toUpperCase();
    if (invStyle.includes('CRECIMIENTO') || invStyle.includes('GROWTH')) styleCalc = 'Growth';
    else if (invStyle.includes('VALOR') || invStyle.includes('VALUE')) styleCalc = 'Value';

    const vol = (docData.perf?.volatility || 15) / 100; 
    const ret3y = (docData.returns?.['3y_annualized'] || 0) / 100;
    const sharpe = docData.perf?.sharpe || 0;
    const alpha = docData.perf?.alpha || 0;
    
    return {
        ...docData, 
        std_type: tipoCalc,
        std_region: regionCalc,
        std_style: styleCalc,
        std_perf: { 
            volatility: vol, 
            cagr3y: ret3y,
            sharpe: sharpe,
            alpha: alpha 
        },
        holdings: docData.holdings || [] 
    };
}

// --- INICIO APP ---
export async function startApp(user, firebaseApp) {
    console.log("Iniciando Nexus Terminal...");
    db = getFirestore(firebaseApp);
    functions = getFunctions(firebaseApp, "europe-west1");
    auth = getAuth(firebaseApp);
    
    const userEl = document.getElementById('user-display');
    if (userEl) userEl.textContent = user.email;
    
    initNewsModule(functions);
    setupListeners();
    await loadData();
    setTimeout(() => { updatePortfolioUI(); }, 500);
    
    // CARGAR DASHBOARD REAL
    loadMarketIndex('GSPC.INDX');
    loadYieldCurve('US');
    
    warmUpBackend();
}

function warmUpBackend() {
    console.log("🔥 Ejecutando Warm-up del motor Python...");
    const fn = httpsCallable(functions, 'optimize_portfolio_quant');
    fn({ assets: [], warmup: true }).catch(() => {}); 
}

function setupListeners() {
    const safeListener = (id, event, handler) => { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); };

    safeListener('fund-search', 'input', (e) => filterGrid(e.target.value));
    safeListener('portfolio-form', 'submit', generateManualProposal);
    safeListener('risk_level', 'input', (e) => {
        const val = e.target.value;
        const display = document.getElementById('risk-display');
        if(display) display.textContent = val;
    });

    safeListener('run-backtest-btn', 'click', runXRay);
    safeListener('csv-upload', 'change', handleCSVUpload);
    safeListener('btn-optimize', 'click', runOptimizationWithComparison);
    
    safeListener('btn-accept-optimization', 'click', () => { 
        closeModal('comparison-modal'); 
        openAdvancedEditor(); 
    });
    
    safeListener('btn-save-final-portfolio', 'click', saveFinalPortfolio);
    safeListener('editor-add-fund-input', 'input', handleEditorSearch);
    
    safeListener('btn-open-costs-tool', 'click', () => { renderCosts(); openModal(document.getElementById('costs-detail-modal')); });
    safeListener('btn-open-tactical', 'click', () => { openModal('tactical-modal'); });
    safeListener('btn-open-vip-tool', 'click', () => window.openVipModal());

    // Listeners nuevos Dashboard
    safeListener('market-index-selector', 'change', (e) => loadMarketIndex(e.target.value));
    safeListener('yield-curve-selector', 'change', (e) => loadYieldCurve(e.target.value));

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

// --- DASHBOARD REAL ---
async function loadMarketIndex(symbol) {
    const loader = document.getElementById('loader-market');
    if(loader) loader.classList.remove('hidden');
    try {
        const fn = httpsCallable(functions, 'getMarketIndex');
        const res = await fn({ symbol });
        if(res.data.series) renderMarketChart(res.data.series, symbol);
    } catch(e) { console.error(e); }
    finally { if(loader) loader.classList.add('hidden'); }
}

async function loadYieldCurve(region) {
    const loader = document.getElementById('loader-yield');
    if(loader) loader.classList.remove('hidden');
    try {
        const fn = httpsCallable(functions, 'getYieldCurve');
        const res = await fn({ region });
        if(res.data.curve) renderYieldChart(res.data.curve, region);
    } catch(e) { console.error(e); }
    finally { if(loader) loader.classList.add('hidden'); }
}

let chartInstanceMarket = null;
let chartInstanceYield = null;

function renderMarketChart(data, symbol) {
    const ctx = document.getElementById('chart-market-index');
    if(!ctx) return;
    if(chartInstanceMarket) chartInstanceMarket.destroy();

    const points = data.map(d => ({x: new Date(d.x).getTime(), y: d.y}));
    
    chartInstanceMarket = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: symbol,
                data: points,
                borderColor: '#0B2545',
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
            scales: {
                x: { type: 'time', time: { unit: 'month' }, grid: { display: false } },
                y: { grid: { color: '#f1f5f9' } }
            }
        }
    });
}

function renderYieldChart(data, region) {
    const ctx = document.getElementById('chart-yield-curve');
    if(!ctx) return;
    if(chartInstanceYield) chartInstanceYield.destroy();

    const labels = data.map(d => d.maturity);
    const values = data.map(d => d.yield);

    chartInstanceYield = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Curva ${region}`,
                data: values,
                borderColor: '#D4AF37',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0B2545',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.raw + '%' } } },
            scales: {
                y: { grid: { color: '#f1f5f9' }, title: { display: true, text: 'Yield %' } }
            }
        }
    });
}

// ... (Resto de funciones: loadData, renderGrid, etc. igual que antes) ...

async function loadData() {
    try {
        const snap = await getDocs(collection(db, "funds_v2"));
        let allFunds = [];
        snap.forEach(d => { allFunds.push(normalizeFundData({isin: d.id, ...d.data()})); });
        
        fundDatabase = allFunds.filter(f => !EXCLUDED_BENCHMARK_ISINS.includes(f.isin));
        setFundData(fundDatabase);
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

    const stats = calcSimpleStats(currentPortfolio);
    const mv = document.getElementById('mini-volatility');
    const mr = document.getElementById('mini-return');
    const ms = document.getElementById('mini-sharpe');
    
    if(totalW > 0.1) {
        if(mv) mv.textContent = (stats.vol*100).toFixed(2) + '%';
        if(mr) mr.textContent = (stats.ret*100).toFixed(2) + '%';
        if(ms) ms.textContent = stats.vol > 0 ? ((stats.ret - 0.025) / stats.vol).toFixed(2) : "0.00";
    } else {
        if(mv) mv.textContent = "-"; if(mr) mr.textContent = "-"; if(ms) ms.textContent = "-";
    }
}

function generateManualProposal(e) { 
    e.preventDefault(); 
    const riskInput = document.getElementById('risk_level');
    const risk = riskInput ? parseInt(riskInput.value) : 5;
    if(!fundDatabase.length) return showToast("Cargando datos...", "info");
    const smartPortfolio = generateSmartPortfolio(risk);
    if (smartPortfolio.length > 0) {
        currentPortfolio = smartPortfolio;
        updatePortfolioUI();
        showToast(`Cartera Maestra (Nivel ${risk}) Generada`, "success");
    } else {
        showToast("Error: No hay fondos válidos para este perfil", "error");
    }
}

function calcSimpleStats(portfolio) {
    if(!portfolio || !portfolio.length) return { vol: 0, ret: 0 };
    let wVol = 0, wRet = 0, totalW = 0;
    portfolio.forEach(f => {
        const w = f.weight / 100;
        const fVol = f.std_perf ? f.std_perf.volatility : 0.12;
        const fRet = f.std_perf ? f.std_perf.cagr3y : 0.06;
        wVol += fVol * w; 
        wRet += fRet * w;
        totalW += w;
    });
    const diversificationFactor = portfolio.length > 3 ? 0.85 : 1.0;
    const finalVol = Math.max(0.02, wVol * diversificationFactor);
    return { vol: finalVol, ret: wRet };
}

function generateProjectionPoints(ret, vol, days = 150) {
    const points = []; let v = 100; 
    const dailyVol = vol / Math.sqrt(252); const dailyRet = ret / 252;
    points.push({x: 0, y: 100});
    for(let i=1; i<=days; i++){ 
        const change = (dailyRet + (Math.random() - 0.5) * 2 * dailyVol); 
        v *= (1 + change); 
        points.push({x: i, y: v}); 
    }
    return points;
}

async function handleCSVUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    const text = await file.text();
    const rows = text.split('\n').map(r => r.split(';'));
    let imported = [], notFound = [], totalVal = 0;
    for(let i=1; i<rows.length; i++) {
        const row = rows[i]; if(row.length < 5) continue; 
        const isin = row[1]?.trim();
        let valStr = row[row.length-1]?.trim() || "0";
        valStr = valStr.replace(/\./g, '').replace(',', '.'); 
        const value = parseFloat(valStr) || 0;
        if(!isin) continue;
        const fund = fundDatabase.find(f => f.isin === isin);
        if(fund) { imported.push({ ...fund, rawValue: value }); totalVal += value; } else { notFound.push(isin); }
    }
    if(imported.length > 0) {
        currentPortfolio = imported.map(f => ({ ...f, weight: (f.rawValue / totalVal) * 100 }));
        const invInput = document.getElementById('investment_amount');
        if(invInput) invInput.value = Math.round(totalVal);
        updatePortfolioUI();
        showToast("Cartera importada", "success");
    }
}

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

async function runOptimizationWithComparison() {
    if(!currentPortfolio.length) return showToast("Añade fondos", "error");
    
    const btn = document.getElementById('btn-optimize'); 
    const prev = btn.innerHTML; 
    
    btn.innerHTML = `<span class="animate-spin">⚙️</span> Inicializando Motor Quant...`; 
    btn.disabled = true;
    showToast("Conectando con servidor de cálculo (puede tardar unos segundos)...", "info");

    try {
        const riskInput = document.getElementById('risk_level');
        const fnOpt = httpsCallable(functions, 'optimize_portfolio_quant', { timeout: 120000 });
        
        const resOpt = await fnOpt({ assets: currentPortfolio.map(f=>f.isin), risk_level: riskInput ? parseInt(riskInput.value) : 5 });
        if(resOpt.data.status === 'error') throw new Error(resOpt.data.warnings[0]);
        const w = resOpt.data.weights || {};
        proposedPortfolio = currentPortfolio.map(f => ({ ...f, weight: (w[f.isin] || 0) * 100 })).filter(f => f.weight > 0.01);
        
        const fnBacktest = httpsCallable(functions, 'backtest_portfolio', { timeout: 120000 });
        const [resOld, resNew] = await Promise.all([ 
            fnBacktest({ portfolio: currentPortfolio, years: 5 }), 
            fnBacktest({ portfolio: proposedPortfolio, years: 5 }) 
        ]);
        
        openModal('comparison-modal');

        const mOld = resOld.data.metrics || {};
        const mNew = resNew.data.metrics || {};

        // Helper de actualización con lógica de color financiera
        const updateRow = (id, oldV, newV, fmt) => {
            const elOld = document.getElementById(`comp-${id}-old`);
            const elNew = document.getElementById(`comp-${id}-new`);
            const elDiff = document.getElementById(`comp-${id}-diff`);
            
            if(elOld) elOld.textContent = fmt(oldV || 0);
            if(elNew) elNew.textContent = fmt(newV || 0);
            
            if(elDiff) {
                const diff = (newV || 0) - (oldV || 0);
                const sign = diff > 0 ? '+' : '';
                elDiff.textContent = `${sign}${fmt(diff)}`;
                
                let isGood = diff > 0;
                if(id === 'vol') isGood = diff < 0;
                
                if (Math.abs(diff) < 0.001) {
                    elDiff.className = "py-4 px-6 text-right font-mono text-xs font-bold text-slate-300"; 
                } else {
                    elDiff.className = `py-4 px-6 text-right font-mono text-xs font-bold ${isGood ? 'text-emerald-600 bg-emerald-50 rounded' : 'text-rose-500 bg-rose-50 rounded'}`;
                }
            }
        };

        const pct = v => (v*100).toFixed(2)+'%';
        const num = v => v.toFixed(2); 

        updateRow('cagr', mOld.cagr, mNew.cagr, pct);
        updateRow('vol', mOld.volatility, mNew.volatility, pct);
        updateRow('sharpe', mOld.sharpe, mNew.sharpe, num); // Fix ID Sharpe
        updateRow('mdd', mOld.max_drawdown, mNew.max_drawdown, pct);

        const renderBar = (id, p) => {
            let rv=0, rf=0, liq=0;
            p.forEach(f=>{ 
                if(f.std_type==='RV') rv+=f.weight; 
                else if(f.std_type==='RF') rf+=f.weight; 
                else liq+=f.weight; 
            });
            const t = rv+rf+liq || 1;
            const el = document.getElementById(id);
            if(el) el.innerHTML = `<div style="width:${(rv/t)*100}%;" class="h-full bg-emerald-500" title="Renta Variable"></div><div style="width:${(rf/t)*100}%;" class="h-full bg-[#0B2545]" title="Renta Fija"></div><div style="width:${(liq/t)*100}%;" class="h-full bg-[#D4AF37]" title="Liquidez"></div>`;
        };
        renderBar('comp-bar-old', currentPortfolio);
        renderBar('comp-bar-new', proposedPortfolio);

    } catch(e) { 
        console.error(e); 
        if (e.code === 'deadline-exceeded') {
            showToast("El servidor tardó demasiado. Inténtalo de nuevo.", "error");
        } else {
            showToast("Error: " + e.message, "error"); 
        }
    } 
    finally { btn.innerHTML = prev; btn.disabled = false; }
}

async function runXRay() {
    if(!currentPortfolio.length) return showToast("Cartera vacía", "error");
    const btn = document.getElementById('run-backtest-btn'); const prev = btn.innerText; btn.innerText = "Calculando..."; btn.disabled = true;
    try {
        const fn = httpsCallable(functions, 'backtest_portfolio', { timeout: 120000 });
        const res = await fn({ portfolio: currentPortfolio, years: 5 });
        const d = res.data;
        xrayFullData = { port: d.portfolioSeries || [], benchmarks: d.benchmarkSeries || {}, synthetics: d.synthetics || [] };
        if(d.metrics){
            const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
            setTxt('metric-cagr', ((d.metrics.cagr||0)*100).toFixed(2)+'%'); setTxt('metric-volatility', ((d.metrics.volatility||0)*100).toFixed(2)+'%'); setTxt('metric-sharpe', (d.metrics.sharpe||0).toFixed(2)); setTxt('metric-maxdd', ((d.metrics.maxDrawdown||0)*100).toFixed(2)+'%');
        }
        openModal('analysis-modal'); renderTopHoldings(currentPortfolio); 
        if(window.updateXRayTimeframe) window.updateXRayTimeframe('3Y'); 
        
        setTimeout(() => { 
            if(d.metrics && xrayFullData.synthetics) {
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
    let fb = []; let benchmarkLabel = "Seleccione Benchmark";
    if (k && xrayFullData.benchmarks[k]) { fb = xrayFullData.benchmarks[k].filter(x => new Date(x.x) >= cutoff); benchmarkLabel = k.charAt(0).toUpperCase() + k.slice(1); }
    const norm = (arr) => { if(!arr.length) return []; const start = arr[0].y; return arr.map(z=>({x:new Date(z.x).getTime(), y:(z.y/start)*100})); };
    renderXRayChart(norm(fp), norm(fb), benchmarkLabel);
    updateRiskMapWithPeriod(period, fp);
    updateRiskMapExplanation(period);
}

function updateRiskMapWithPeriod(period, filteredSeries = null) {
    let seriesToCalc = filteredSeries;
    if(!seriesToCalc && xrayFullData.port) {
        const cutoff = new Date();
        if(period === '1Y') cutoff.setFullYear(cutoff.getFullYear() - 1); else if(period === '3Y') cutoff.setFullYear(cutoff.getFullYear() - 3); else cutoff.setFullYear(cutoff.getFullYear() - 10);
        seriesToCalc = xrayFullData.port.filter(x => new Date(x.x) >= cutoff);
    }
    if(seriesToCalc && seriesToCalc.length > 0) {
        const stats = calculateStats(seriesToCalc);
        renderRiskMap({volatility: stats.vol, cagr: stats.ret}, currentPortfolio, xrayFullData.synthetics);
    }
}

function calculateStats(series) {
    if(!series || series.length < 2) return {vol:0, ret:0};
    const start = series[0].y; const end = series[series.length-1].y;
    const years = series.length / 252; // aprox trading days
    const cagr = Math.pow(end/start, 1/years) - 1;
    let sumSq = 0;
    for(let i=1; i<series.length; i++) {
        const r = (series[i].y / series[i-1].y) - 1;
        sumSq += r*r;
    }
    const stdDev = Math.sqrt(sumSq / (series.length-1));
    const vol = stdDev * Math.sqrt(252);
    return { vol, ret: cagr };
}

// --- RENDERERS WORKSPACE (TOP-DOWN) ---

function updateEditorAnalytics() {
    const statsOld = calcSimpleStats(currentPortfolio);
    const statsNew = calcSimpleStats(proposedPortfolio);
    const rf = 0.025;
    const sharpeOld = statsOld.vol > 0 ? (statsOld.ret - rf) / statsOld.vol : 0;
    const sharpeNew = statsNew.vol > 0 ? (statsNew.ret - rf) / statsNew.vol : 0;

    const updateMetricPanel = (idVal, idDiff, oldVal, newVal, isPct) => {
        const elVal = document.getElementById(idVal);
        const elDiff = document.getElementById(idDiff);
        
        if (elVal) {
            elVal.textContent = isPct ? (newVal * 100).toFixed(2) + '%' : newVal.toFixed(2);
            elVal.className = "text-3xl font-mono font-bold text-[#0B2545]"; 
        }

        if (elDiff) {
            const diff = newVal - oldVal;
            const diffStr = isPct ? (Math.abs(diff) * 100).toFixed(2) + '%' : Math.abs(diff).toFixed(2);
            const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
            
            elDiff.textContent = `${sign}${diffStr}`;
            
            let isGood = diff > 0;
            if (idVal.includes('vol')) isGood = diff < 0; 
            
            const bgClass = isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
            const neutralClass = 'bg-slate-100 text-slate-500';
            
            elDiff.className = `text-xs font-bold px-2 py-0.5 rounded ml-2 ${Math.abs(diff) < 0.001 ? neutralClass : bgClass}`;
        }
    };

    updateMetricPanel('delta-ret-val', 'delta-ret-diff', statsOld.ret, statsNew.ret, true);
    updateMetricPanel('delta-vol-val', 'delta-vol-diff', statsOld.vol, statsNew.vol, true);
    updateMetricPanel('delta-sharpe-val', 'delta-sharpe-diff', sharpeOld, sharpeNew, false);

    const pointsOld = generateProjectionPoints(statsOld.ret, statsOld.vol, 252*5);
    const pointsNew = generateProjectionPoints(statsNew.ret, statsNew.vol, 252*5);
    renderComparisonChart(pointsOld, pointsNew, 'editor-live-chart');
}

function renderProposedTable() { 
    const tbody = document.getElementById('editor-proposed-tbody'); 
    const ordersDiv = document.getElementById('rebalancing-orders-container'); 
    const turnoverDisplay = document.getElementById('turnover-display');
    const invInput = document.getElementById('investment_amount'); 
    const cap = invInput ? (parseFloat(invInput.value)||100000) : 100000; 
    let totalW = 0, ordersHTML = '', turnover = 0; 
    
    if(!tbody) return; 
    
    tbody.innerHTML = proposedPortfolio.map(f => { 
        totalW += f.weight; 
        const orig = currentPortfolio.find(of => of.isin === f.isin); 
        const origW = orig ? orig.weight : 0;
        const diffW = f.weight - origW; 
        const diffEUR = cap * (diffW / 100); 
        
        if(Math.abs(diffEUR) > 10) { 
            const isBuy = diffEUR > 0;
            const type = isBuy ? 'COMPRA' : 'VENTA'; 
            const colorClass = isBuy ? 'text-emerald-600 border-l-4 border-emerald-500' : 'text-rose-600 border-l-4 border-rose-500'; 
            
            ordersHTML += `
            <div class="flex justify-between items-center text-[10px] p-2 border-b border-slate-100 hover:bg-slate-50 transition-colors ${colorClass} pl-3 bg-white">
                <div class="flex items-center gap-3">
                    <span class="font-bold w-12">${type}</span>
                    <span class="truncate max-w-[150px] font-medium text-slate-700" title="${f.name}">${f.name}</span>
                </div>
                <div class="flex items-center gap-4">
                    <span class="text-slate-400 font-mono">${(Math.abs(diffW)).toFixed(2)}%</span>
                    <span class="font-mono font-bold text-slate-800 w-20 text-right">${formatCurrency(Math.abs(diffEUR))}</span>
                </div>
            </div>`; 
            turnover += Math.abs(diffEUR); 
        } 
        
        const diffIndicator = diffW > 0.1 ? `<span class="text-emerald-500 font-bold text-[10px]">▲</span>` : (diffW < -0.1 ? `<span class="text-rose-500 font-bold text-[10px]">▼</span>` : ``);

        return `
        <tr class="group hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
            <td class="py-3 px-4">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-bold text-[#0B2545] text-[11px] leading-tight group-hover:text-blue-700 transition-colors truncate max-w-[220px]" title="${f.name}">${f.name}</div>
                        <div class="text-[9px] text-slate-400 font-mono mt-0.5">${f.isin}</div>
                    </div>
                    <div class="ml-2">${diffIndicator}</div>
                </div>
            </td>
            <td class="py-2 px-4 text-right">
                <div class="relative flex items-center justify-end">
                    <input type="number" step="0.5" 
                        class="w-16 text-right font-mono font-bold text-xs text-[#0B2545] bg-slate-50 border border-transparent hover:border-slate-300 focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all py-1 px-1 rounded" 
                        value="${f.weight.toFixed(2)}" 
                        onchange="window.updateProposedWeight('${f.isin}', this.value)"
                        onclick="this.select()">
                    <span class="text-[10px] text-slate-400 ml-1">%</span>
                </div>
            </td>
            <td class="py-2 text-center">
                <button onclick="window.removeProposedFund('${f.isin}')" class="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-full transition-all" title="Eliminar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>`; 
    }).join(''); 
    
    if(!ordersHTML) ordersHTML = '<div class="h-full flex flex-col items-center justify-center text-slate-300 text-xs italic"><svg class="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Cartera alineada. Sin cambios.</div>'; 
    if(ordersDiv) ordersDiv.innerHTML = ordersHTML; 
    
    if(turnoverDisplay) turnoverDisplay.textContent = formatCurrency(turnover) + " Vol.";

    const totFooter = document.getElementById('editor-total-weight-display');
    if(totFooter) {
        totFooter.textContent = `Total: ${totalW.toFixed(2)}%`; 
        if (Math.abs(totalW - 100) < 0.1) {
            totFooter.className = "text-[10px] font-mono font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded border border-emerald-200";
        } else {
            totFooter.className = "text-[10px] font-mono font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded border border-rose-200 animate-pulse";
        }
    }
    
    updateEditorAnalytics();
}

function renderOriginalTable() {
    const tbody = document.getElementById('editor-original-tbody');
    if (!tbody) return;
    tbody.innerHTML = currentPortfolio.map(f => `
        <tr class="group hover:bg-slate-200/50 transition-colors border-b border-slate-200 last:border-0">
            <td class="py-3 px-4">
                <div class="font-bold text-slate-600 text-[11px] leading-tight truncate max-w-[200px]" title="${f.name}">${f.name}</div>
                <div class="text-[9px] text-slate-400 font-mono mt-0.5">${f.isin}</div>
            </td>
            <td class="py-3 px-4 text-right">
                <span class="font-mono text-slate-500 font-bold text-xs bg-slate-200/50 px-2 py-1 rounded border border-slate-300/50">${f.weight.toFixed(2)}%</span>
            </td>
        </tr>
    `).join('');
}

function openAdvancedEditor() { 
    openModal('advanced-editor-modal'); 
    if(!proposedPortfolio.length) proposedPortfolio = JSON.parse(JSON.stringify(currentPortfolio));
    renderOriginalTable();
    renderProposedTable(); 
    setTimeout(() => updateEditorAnalytics(), 100); 
}

window.autoRebalance100 = () => { let t = proposedPortfolio.reduce((s,f)=>s+f.weight,0); if(t>0) proposedPortfolio.forEach(f => f.weight = (f.weight/t)*100); renderProposedTable(); showToast("Ajustado al 100%"); };
window.updateProposedWeight = (i,v) => { const f = proposedPortfolio.find(x=>x.isin===i); if(f) f.weight = parseFloat(v)||0; renderProposedTable(); };
window.removeProposedFund = (i) => { proposedPortfolio = proposedPortfolio.filter(x=>x.isin!==i); renderProposedTable(); };

function handleEditorSearch(e) { 
    const t = e.target.value.toLowerCase(); const r = document.getElementById('editor-search-results'); 
    if(!r) return; if(t.length < 3) { r.classList.add('hidden'); return; } 
    const m = fundDatabase.filter(f => f.name.toLowerCase().includes(t) || f.isin.toLowerCase().includes(t)).slice(0, 5); 
    r.innerHTML = m.map(f => `<div class="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs border-b last:border-0 group" onclick="window.addFundToProposed('${f.isin}')"><span class="truncate max-w-[200px] font-bold text-[#0B2545] group-hover:text-blue-600">${f.name}</span><span class="text-white bg-blue-600 px-2 py-0.5 rounded font-bold text-[10px] shadow-sm group-hover:bg-blue-700">+ Añadir</span></div>`).join(''); 
    r.classList.remove('hidden'); 
}

window.addFundToProposed = (i) => { const f = fundDatabase.find(x => x.isin === i); if(f && !proposedPortfolio.some(x => x.isin === i)){ proposedPortfolio.push({...f, weight: 0}); renderProposedTable(); document.getElementById('editor-search-results').classList.add('hidden'); document.getElementById('editor-add-fund-input').value = ''; } };
function saveFinalPortfolio() { currentPortfolio = [...proposedPortfolio]; updatePortfolioUI(); closeModal('advanced-editor-modal'); showToast("Cartera guardada", "success"); }
async function openNews() { openModal('news-modal'); const c=document.getElementById('news-general-container'); if(!c)return; c.innerHTML='<div class="text-center py-10 text-slate-400 italic animate-pulse">Cargando...</div>'; try{const fn=httpsCallable(functions,'getFinancialNews');const res=await fn();const a=res.data.articles||[];if(!a.length)c.innerHTML='Sin noticias.';else c.innerHTML=a.map(x=>`<div class="mb-4 p-4 border border-slate-100 rounded bg-slate-50 hover:bg-white transition-all"><h4 class="text-sm font-bold text-[#0B2545]">${x.title}</h4><p class="text-xs text-slate-600">${x.summary}</p></div>`).join('');}catch(e){console.error(e);} }