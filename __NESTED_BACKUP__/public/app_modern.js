import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { renderDashboardChart, renderXRayChart, renderAllocationDonut, renderRiskMap, renderCorrelationHeatmap, renderStyleBox, renderComparisonChart, renderGeoDistribution } from './chartEngine.js';
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

// Variables para gráficos del Dashboard
let chartInstanceMarket = null;
let chartInstanceYield = null;

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
        holdings: docData.holdings || [],
        costs: docData.costs || { ter: 1.5 }
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
    
    // CARGAR DASHBOARD REAL (Mercado + Tipos)
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
    
    safeListener('btn-open-costs-tool', 'click', () => { 
        renderCosts(); 
        openModal('costs-detail-modal'); 
    });
    
    safeListener('btn-open-tactical', 'click', () => { openModal('tactical-modal'); });
    safeListener('btn-open-vip-tool', 'click', () => window.openVipModal());

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

// --- DASHBOARD REAL ---

async function loadMarketIndex(symbol) {
    const loader = document.getElementById('loader-market');
    if(loader) loader.classList.remove('hidden', 'opacity-0');
    try {
        const fn = httpsCallable(functions, 'getMarketIndex');
        const res = await fn({ symbol });
        if(res.data.series) renderMarketChart(res.data.series, symbol);
    } catch(e) { console.error(e); }
    finally { if(loader) { loader.classList.add('opacity-0'); setTimeout(() => loader?.classList.add('hidden'), 300); } }
}

async function loadYieldCurve(region) {
    const loader = document.getElementById('loader-yield');
    if(loader) loader.classList.remove('hidden', 'opacity-0');
    try {
        const fn = httpsCallable(functions, 'getYieldCurve');
        const res = await fn({ region });
        if(res.data.curve) renderYieldChart(res.data.curve, region);
    } catch(e) { console.error(e); }
    finally { if(loader) { loader.classList.add('opacity-0'); setTimeout(() => loader?.classList.add('hidden'), 300); } }
}

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

// --- GESTIÓN DE CARTERA ---

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
    
    // Cálculo Geográfico
    let geo = { 'USA': 0, 'Europe': 0, 'Emerging': 0, 'Global': 0, 'Other': 0 };

    tbody.innerHTML = currentPortfolio.map(f => {
        totalW += f.weight;
        const val = totalCap * (f.weight / 100);
        if(f.std_type === 'RV') rv += f.weight; else if(f.std_type === 'RF') rf += f.weight; else cash += f.weight;
        
        let reg = f.std_region || 'Other';
        if (!geo[reg]) geo[reg] = 0;
        geo[reg] += f.weight;

        return `<tr class="border-b border-slate-50 hover:bg-slate-50 group"><td class="p-3 truncate max-w-[180px] font-medium text-[#0B2545] text-xs">${f.name}</td><td class="p-3 text-right"><input type="number" class="w-12 text-right bg-transparent outline-none font-bold text-[#0B2545] text-xs" value="${f.weight.toFixed(2)}" onchange="window.updateWeight('${f.isin}', this.value)">%</td><td class="p-3 text-right font-mono text-slate-500 font-bold text-xs">${formatCurrency(val)}</td><td class="p-3 text-right"><button onclick="removeFund('${f.isin}')" class="text-slate-300 hover:text-red-500">&times;</button></td></tr>`;
    }).join('');

    const fW = document.getElementById('footer-total-weight');
    const fA = document.getElementById('footer-total-amount');
    if(fW) fW.textContent = totalW.toFixed(1) + '%';
    if(fA) fA.textContent = formatCurrency(totalCap * (totalW/100));
    
    renderAllocationDonut({rv, rf, other: cash});
    renderGeoDistribution(geo);
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

function renderCosts() {
    const tbody = document.getElementById('costs-table-body');
    const capInput = document.getElementById('investment_amount');
    const totalCap = capInput ? (parseFloat(capInput.value) || 100000) : 100000;
    let totalCostEUR = 0;

    if (!tbody) return;

    tbody.innerHTML = currentPortfolio.map(f => {
        const ter = f.costs?.ter || 1.50; 
        const costEUR = totalCap * (f.weight / 100) * (ter / 100);
        totalCostEUR += costEUR;

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="p-3 text-slate-600 text-xs font-medium truncate max-w-[220px]" title="${f.name}">${f.name}</td>
                <td class="p-3 text-right font-mono text-xs text-slate-500">${ter.toFixed(2)}%</td>
                <td class="p-3 text-right font-mono text-xs font-bold text-[#0B2545]">${formatCurrency(costEUR)}</td>
            </tr>
        `;
    }).join('');

    const finalEl = document.getElementById('final-cost-result');
    if(finalEl) finalEl.textContent = formatCurrency(totalCostEUR);
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
        updateRow('sharpe', mOld.sharpe, mNew.sharpe, num);
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
    renderXRayChart(norm(fp), norm(fb), benchmarkLabel, 'backtest-chart');
    updateRiskMapWithPeriod(period, fp);
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

// ... (Resto de funciones idénticas al bloque anterior) ...