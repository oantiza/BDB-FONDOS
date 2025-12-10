import {
  getFirestore,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  renderDashboardChart,
  renderXRayChart,
  renderAllocationDonut,
  renderRiskMap,
  renderCorrelationHeatmap,
  renderStyleBox,
  renderComparisonChart,
} from "./chartEngine.js";

// ==========================================
// 1. ESTADO GLOBAL Y CONSTANTES
// ==========================================
const EXCLUDED_BENCHMARK_ISINS = ["IE00B18GC888", "IE00B03HCZ61"];
const STORAGE_BUCKET_URL = "https://firebasestorage.googleapis.com/v0/b/bdb-fondos.firebasestorage.app/o/funds_data.json?alt=media";

let fundDatabase = [];
let currentPortfolio = [];
let proposedPortfolio = [];
let vipList = [];
let lastOptimizationResult = {
  old: [],
  new: [],
  metricsOld: {},
  metricsNew: {},
};

let db, functions, auth;
let xrayFullData = { port: [], benchmarks: {}, synthetics: [] };
let currentBenchmarkKey = null;

// ==========================================
// 2. UTILIDADES BÁSICAS
// ==========================================
function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg text-white font-bold text-[15px] z-[100] transition-opacity duration-500 ${
    type === "error" ? "bg-red-500" : "bg-[#0B2545]"
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("opacity-0");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

const openModal = (id) => {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove("hidden");
    m.classList.add("flex");
    setTimeout(() => {
      m.classList.remove("opacity-0");
      const child = m.querySelector("div");
      if (child) child.classList.remove("scale-95");
    }, 10);
  }
};

window.closeModal = (id) => {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add("opacity-0");
    const child = m.querySelector("div");
    if (child) child.classList.add("scale-95");
    setTimeout(() => {
      m.classList.add("hidden");
      m.classList.remove("flex");
    }, 300);
  }
};

window.openVipModal = () => {
  openModal("vip-modal");
};

// ==========================================
// 3. PROCESAMIENTO DE DATOS (MODIFICADO PARA JSON)
// ==========================================

function normalizeFundData(docData) {
  // 1. Volatilidad: Prioridad al cálculo vivo del script Python (metrics.volatility_1y)
  let vol = 0.1; // Default 10%
  if (docData.metrics && docData.metrics.volatility_1y != null) {
      vol = docData.metrics.volatility_1y; // Ya viene en decimal (0.15)
  } else if (docData.perf && docData.perf.volatility != null) {
      vol = docData.perf.volatility / 100;
  }

  // 2. Retornos: Mantenemos el histórico si existe
  let ret3y = 0.05;
  if (docData.returns && docData.returns["3y_annualized"] != null)
    ret3y = docData.returns["3y_annualized"] / 100;

  // 3. Clasificación Tipo (RV/RF): Usamos manual_type del JSON
  let tipoCalc = "Mixto";
  const mType = (docData.manual_type || "").toUpperCase();
  
  if (mType.includes('RV') || mType.includes('RENTA VARIABLE') || mType.includes('EQUITY') || mType.includes('STOCK')) tipoCalc = "RV";
  else if (mType.includes('RF') || mType.includes('RENTA FIJA') || mType.includes('BOND')) tipoCalc = "RF";
  else if (mType.includes('MONETARIO') || mType.includes('CASH') || mType.includes('LIQUIDEZ')) tipoCalc = "Monetario";

  // 4. Estilo y Tamaño (Heurística simple si faltan datos detallados)
  let sizeCalc = "Large";
  let styleCalc = "Blend";
  if (docData.style) {
    // Si viene del objeto style original
    const s = (docData.style.investment_style || "").toLowerCase();
    if (s.includes("valor")) styleCalc = "Value";
    else if (s.includes("crecimiento")) styleCalc = "Growth";
  } else {
    // Inferencia por nombre si no hay style object
    const name = (docData.name || "").toUpperCase();
    if (name.includes("SMALL")) sizeCalc = "Small";
    if (name.includes("VALUE")) styleCalc = "Value";
    if (name.includes("GROWTH")) styleCalc = "Growth";
  }

  return {
    ...docData,
    std_type: tipoCalc,
    std_style: { size: sizeCalc, investment: styleCalc },
    std_perf: { volatility: vol, cagr3y: ret3y },
    costs: docData.costs || { ter: 1.5, retrocession: 0.75 },
    holdings: docData.holdings || [],
    // Aseguramos que el score esté presente para el ordenamiento
    score: docData.score || 0
  };
}

function renderGrid(list) {
  const c = document.getElementById("main-grid-container");
  if (!c) return;
  
  // Ordenar por Score descendente para mostrar los mejores primero
  const sortedList = [...list].sort((a, b) => (b.score || 0) - (a.score || 0));

  c.innerHTML = sortedList
    .slice(0, 50)
    .map(
      (f) => {
        // Color del score visual
        let scoreColor = "text-slate-400";
        if(f.score >= 80) scoreColor = "text-emerald-500";
        else if(f.score >= 50) scoreColor = "text-amber-500";

        return `
        <div class="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center group transition-colors" onclick="addFund('${f.isin}')">
            <div>
                <div class="text-[13px] font-bold text-[#0B2545] truncate w-40" title="${f.name}">${f.name}</div>
                <div class="flex items-center gap-2">
                    <div class="text-[10px] text-slate-400 font-mono">${f.isin}</div>
                    <div class="text-[9px] font-bold ${scoreColor}">Score: ${f.score}</div>
                </div>
            </div>
            <span class="text-[#D4AF37] font-bold opacity-0 group-hover:opacity-100 text-[17px]">+</span>
        </div>
    `})
    .join("");
}

// --- NUEVA CARGA DE DATOS DESDE STORAGE ---
async function loadData() {
  try {
    // Añadimos timestamp para evitar caché del navegador y cargar siempre lo último
    const t = new Date().getTime(); 
    const url = `${STORAGE_BUCKET_URL}&t=${t}`;
    
    console.log("Cargando datos maestros desde la nube...");
    const response = await fetch(url);
    
    if (!response.ok) throw new Error("No se pudo descargar funds_data.json");
    
    const jsonFunds = await response.json();
    
    let allFunds = [];
    jsonFunds.forEach((d) => {
      allFunds.push(normalizeFundData(d));
    });

    fundDatabase = allFunds.filter(
      (f) => !EXCLUDED_BENCHMARK_ISINS.includes(f.isin)
    );
    
    renderGrid(fundDatabase);
    console.log(`✅ ${fundDatabase.length} fondos cargados y normalizados.`);

  } catch (e) {
    console.error("Error crítico cargando datos:", e);
    showToast("Error de conexión con la base de datos", "error");
    // Opcional: Aquí podrías poner un fallback a Firestore si quisieras
  }
}

// ==========================================
// 4. RENDERIZADO UI
// ==========================================

function updatePortfolioUI() {
  const tbody = document.getElementById("portfolio-table-body");
  if (!tbody) return;
  const invInput = document.getElementById("investment_amount");
  const totalCap = invInput ? parseFloat(invInput.value) || 100000 : 100000;
  let totalW = 0,
    rv = 0,
    rf = 0,
    cash = 0;
  tbody.innerHTML = currentPortfolio
    .map((f) => {
      totalW += f.weight;
      const val = totalCap * (f.weight / 100);
      if (f.std_type === "RV") rv += f.weight;
      else if (f.std_type === "RF") rf += f.weight;
      else cash += f.weight;
      return `<tr class="border-b border-slate-50 hover:bg-slate-50 group"><td class="p-3 truncate max-w-[180px] font-medium text-[#0B2545] text-[13px]">${
        f.name
      }</td><td class="p-3 text-right"><input type="number" class="w-12 text-right bg-transparent outline-none font-bold text-[#0B2545] text-[13px]" value="${f.weight.toFixed(
        2
      )}" onchange="window.updateWeight('${
        f.isin
      }', this.value)">%</td><td class="p-3 text-right font-mono text-slate-500 font-bold text-[13px]">${formatCurrency(
        val
      )}</td><td class="p-3 text-right"><button onclick="removeFund('${
        f.isin
      }')" class="text-slate-300 hover:text-red-500">&times;</button></td></tr>`;
    })
    .join("");
  const fW = document.getElementById("footer-total-weight");
  const fA = document.getElementById("footer-total-amount");
  if (fW) fW.textContent = totalW.toFixed(1) + "%";
  if (fA) fA.textContent = formatCurrency(totalCap * (totalW / 100));
  renderAllocationDonut({ rv, rf, other: cash });
  renderStyleBox(currentPortfolio);
  
  // Cálculo de Métricas Rápidas (Mini-Stats)
  let pVol = 0.08,
    pRet = 0.05;
  if (totalW > 0.1 && currentPortfolio.length > 0) {
    let wVol = 0,
      wRet = 0;
    currentPortfolio.forEach((f) => {
      const w = f.weight / 100;
      // Usamos std_perf normalizado
      const fVol = f.std_perf ? f.std_perf.volatility : 0.12;
      const fRet = f.std_perf ? f.std_perf.cagr3y : 0.06;
      wVol += fVol * w;
      wRet += fRet * w;
    });
    // Ajuste por diversificación
    const diversificationFactor = currentPortfolio.length > 3 ? 0.85 : 1.0;
    pVol = Math.max(0.02, wVol * diversificationFactor);
    pRet = wRet;
    
    const mv = document.getElementById("mini-volatility"),
      mr = document.getElementById("mini-return"),
      ms = document.getElementById("mini-sharpe");
    if (mv) mv.textContent = (pVol * 100).toFixed(2) + "%";
    if (mr) mr.textContent = (pRet * 100).toFixed(2) + "%";
    if (ms)
      ms.textContent = pVol > 0 ? ((pRet - 0.025) / pVol).toFixed(2) : "0.00";
  }

  // --- NUEVO SIMULADOR MONTE CARLO (CONO DE INCERTIDUMBRE) ---
  const NUM_SIMULATIONS = 20;
  const DAYS = 150;
  const allSimulations = [];

  // Convertir métricas anuales a diarias
  const dailyVol = pVol / Math.sqrt(252);
  const dailyRet = pRet / 252;

  for (let s = 0; s < NUM_SIMULATIONS; s++) {
    let v = 100;
    const path = [{ x: 0, y: 100 }];

    for (let i = 1; i <= DAYS; i++) {
      const randomShock = (Math.random() - 0.5) * 2;
      const change = dailyRet + randomShock * dailyVol * 1.7;
      v *= 1 + change;
      path.push({ x: i, y: v });
    }
    allSimulations.push(path);
  }

  renderDashboardChart(allSimulations);
}

function renderCosts() {
  const tbody = document.getElementById("costs-table-body");
  const invInput = document.getElementById("investment_amount");
  const coefInput = document.getElementById("retro-coefficient");
  if (!tbody) return;
  const cap = invInput ? parseFloat(invInput.value) || 0 : 0;
  const coef = coefInput ? parseFloat(coefInput.value) || 100 : 100;
  let totalGross = 0;
  tbody.innerHTML = currentPortfolio
    .map((f) => {
      const retroPercent =
        f.costs?.retrocession || (f.costs?.ter ? f.costs.ter * 0.5 : 0.75);
      const impactVal = cap * (f.weight / 100) * (retroPercent / 100);
      totalGross += impactVal;
      return `<tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"><td class="p-3 text-slate-600 font-medium truncate max-w-[200px]" title="${
        f.name
      }">${
        f.name
      }</td><td class="p-3 text-right font-mono text-slate-500">${f.weight.toFixed(
        2
      )}%</td><td class="p-3 text-right font-mono text-slate-500">${retroPercent.toFixed(
        2
      )}%</td><td class="p-3 text-right font-mono font-bold text-slate-800">${formatCurrency(
        impactVal
      )}</td></tr>`;
    })
    .join("");
  const totalNet = totalGross * (coef / 100);
  const totalGrossPct = cap > 0 ? (totalGross / cap) * 100 : 0;
  const totalNetPct = cap > 0 ? (totalNet / cap) * 100 : 0;

  const elGross = document.getElementById("total-retro-gross");
  if (elGross) elGross.textContent = formatCurrency(totalGross);
  const elNet = document.getElementById("total-retro-net");
  if (elNet) elNet.textContent = formatCurrency(totalNet);
  const elGrossPct = document.getElementById("total-retro-gross-pct");
  if (elGrossPct) elGrossPct.textContent = `(${totalGrossPct.toFixed(2)}%)`;
  const elNetPct = document.getElementById("total-retro-net-pct");
  if (elNetPct) elNetPct.textContent = `(${totalNetPct.toFixed(2)}%)`;
}
window.renderCosts = renderCosts;

function renderTopHoldings(portfolio, containerId = "top-holdings-container") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const aggregatedHoldings = {};

  portfolio.forEach((f) => {
    if (f.weight <= 0) return;
    const holdings = f.holdings || [];
    holdings.forEach((h) => {
      const effectiveWeight = (h.weight / 100) * (f.weight / 100);
      const key = (h.name || "Desconocido").toUpperCase();
      if (aggregatedHoldings[key]) {
        aggregatedHoldings[key].weight += effectiveWeight;
      } else {
        aggregatedHoldings[key] = {
          name: h.name,
          weight: effectiveWeight,
          sector: h.sector || "N/A",
        };
      }
    });
  });

  const topHoldings = Object.values(aggregatedHoldings)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  if (topHoldings.length === 0) {
    container.innerHTML =
      '<div class="col-span-full text-center py-8 text-slate-400 italic bg-slate-50 rounded border border-dashed">No hay datos de posiciones disponibles para desglozar.</div>';
    return;
  }

  container.innerHTML = topHoldings
    .map((h) => {
      const percent = (h.weight * 100).toFixed(2);
      const sectorDisplay = h.sector === "N/A" ? "General" : h.sector;

      return `
        <div class="bg-white p-3 rounded shadow-sm border border-slate-200 border-l-4 border-l-[#D4AF37] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group h-full flex flex-col justify-between">
            <div class="mb-2">
                <div class="text-[13px] font-bold text-[#0B2545] leading-snug line-clamp-2 group-hover:text-blue-800 transition-colors" title="${h.name}">
                    ${h.name}
                </div>
            </div>
            <div class="flex justify-between items-end border-t border-slate-100 pt-2 mt-auto">
                <span class="text-[11px] font-medium text-slate-500 uppercase tracking-wide truncate max-w-[80px]" title="${sectorDisplay}">
                    ${sectorDisplay}
                </span>
                <span class="text-[15px] font-mono font-bold text-[#0B2545] bg-slate-50 px-1.5 rounded">
                    ${percent}%
                </span>
            </div>
        </div>`;
    })
    .join("");
}

// ==========================================
// 5. MANEJADORES DE EVENTOS
// ==========================================

// Importamos la nueva lógica de portfolio.js dinámicamente o la invocamos si estuviera importada
// Pero como la estructura es modular, usaremos las funciones globales que definimos en portfolio.js (si están expuestas)
// O mejor, replicamos la llamada simple aquí si portfolio.js exporta 'selectFunds'.
// NOTA: Necesitamos importar selectFunds desde portfolio.js al inicio del archivo.
// Voy a añadir el import arriba.

import { selectFunds, assignWeights } from './portfolio.js';

function generateManualProposal(e) {
  e.preventDefault();
  
  // LEEMOS EL NIVEL DE RIESGO
  const riskInput = document.getElementById("risk_level"); // Asegúrate de que este ID existe en tu HTML
  const riskLevel = riskInput ? parseInt(riskInput.value) : 5;

  if (!fundDatabase.length) return showToast("Cargando datos...", "info");

  // EJECUTAMOS LA ESTRATEGIA DE 3 PASOS (NUEVA LÓGICA)
  // Paso 1, 2 y 3 ocurren dentro de selectFunds
  const optimalPortfolio = selectFunds(riskLevel);

  if (optimalPortfolio.length === 0) {
      showToast("No se encontraron fondos adecuados para este perfil.", "error");
      return;
  }

  currentPortfolio = optimalPortfolio;
  updatePortfolioUI();
  showToast(`Cartera Nivel ${riskLevel} Generada`, "success");
}

async function handleCSVUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = text.split("\n").map((r) => r.split(";"));
  let imported = [],
    notFound = [],
    totalVal = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 5) continue;
    const isin = row[1]?.trim();
    let valStr = row[row.length - 1]?.trim() || "0";
    valStr = valStr.replace(/\./g, "").replace(",", ".");
    const value = parseFloat(valStr) || 0;
    if (!isin) continue;
    const fund = fundDatabase.find((f) => f.isin === isin);
    if (fund) {
      imported.push({ ...fund, rawValue: value });
      totalVal += value;
    } else {
      notFound.push(isin);
    }
  }
  if (notFound.length > 0)
    showToast(`Alerta: ${notFound.length} fondos no encontrados.`, "error");
  if (imported.length > 0) {
    currentPortfolio = imported.map((f) => ({
      ...f,
      weight: (f.rawValue / totalVal) * 100,
    }));
    const invInput = document.getElementById("investment_amount");
    if (invInput) invInput.value = Math.round(totalVal);
    updatePortfolioUI();
    showToast("Cartera importada", "success");
  }
}

function handleEditorSearch(e) {
  const t = e.target.value.toLowerCase();
  const r = document.getElementById("editor-search-results");
  if (!r) return;
  if (t.length < 3) {
    r.classList.add("hidden");
    return;
  }
  const m = fundDatabase
    .filter(
      (f) =>
        f.name.toLowerCase().includes(t) || f.isin.toLowerCase().includes(t)
    )
    .slice(0, 5);
  r.innerHTML = m
    .map(
      (f) =>
        `<div class="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-[13px] border-b last:border-0" onclick="window.addFundToProposed('${f.isin}')"><span class="truncate max-w-[200px] font-bold text-[#0B2545]">${f.name}</span><span class="text-white bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">+</span></div>`
    )
    .join("");
  r.classList.remove("hidden");
}
function saveFinalPortfolio() {
  currentPortfolio = [...proposedPortfolio];
  updatePortfolioUI();
  closeModal("advanced-editor-modal");
  showToast("Cartera guardada", "success");
}

function handleVipSearch(e) {
  const t = e.target.value.toLowerCase();
  const r = document.getElementById("vip-search-results");
  if (!r) return;
  if (t.length < 3) {
    r.classList.add("hidden");
    return;
  }
  const m = fundDatabase
    .filter(
      (f) =>
        f.name.toLowerCase().includes(t) || f.isin.toLowerCase().includes(t)
    )
    .slice(0, 5);
  r.innerHTML = m
    .map(
      (f) =>
        `<div class="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-[13px] border-b last:border-0" onclick="window.addVipFund('${f.isin}')"><span class="truncate max-w-[200px] font-bold text-[#0B2545]">${f.name}</span><span class="text-blue-600 font-bold">+</span></div>`
    )
    .join("");
  r.classList.remove("hidden");
}
function saveVips() {
  showToast(`Guardados ${vipList.length} fondos ancla.`, "success");
  closeModal("vip-modal");
}

function renderVipList() {
  const c = document.getElementById("vip-list-container");
  if (!c) return;
  if (vipList.length === 0) {
    c.innerHTML =
      '<div class="text-center text-slate-400 italic text-[13px] mt-10">Lista vacía.</div>';
    return;
  }
  c.innerHTML = vipList
    .map(
      (f) =>
        `<div class="flex justify-between items-center p-2 bg-white border border-slate-100 rounded text-[13px] mb-1 hover:shadow-sm transition-shadow"><span class="font-bold text-[#0B2545] truncate w-3/4" title="${f.name}">${f.name}</span><button onclick="window.removeVipFund('${f.isin}')" class="text-red-400 hover:text-red-600 font-bold text-lg">&times;</button></div>`
    )
    .join("");
}

// ==========================================
// 6. FUNCIONES ASYNC Y HELPERS
// ==========================================

async function runXRay() {
  if (!currentPortfolio.length) return showToast("Cartera vacía", "error");
  const btn = document.getElementById("run-backtest-btn");
  const prev = btn.innerText;
  btn.innerText = "Calculando...";
  btn.disabled = true;
  try {
    const fn = httpsCallable(functions, "backtest_portfolio");
    const res = await fn({ portfolio: currentPortfolio, years: 5 });
    const d = res.data;
    xrayFullData = {
      port: d.portfolioSeries || [],
      benchmarks: d.benchmarkSeries || {},
      synthetics: d.synthetics || [],
    };
    openModal("analysis-modal");
    if (d.metrics) {
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setTxt("metric-cagr", ((d.metrics.cagr || 0) * 100).toFixed(2) + "%");
      setTxt(
        "metric-volatility",
        ((d.metrics.volatility || 0) * 100).toFixed(2) + "%"
      );
      setTxt("metric-sharpe", (d.metrics.sharpe || 0).toFixed(2));
      setTxt(
        "metric-maxdd",
        ((d.metrics.maxDrawdown || 0) * 100).toFixed(2) + "%"
      );
    } else {
      [
        "metric-cagr",
        "metric-volatility",
        "metric-sharpe",
        "metric-maxdd",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = "-";
      });
    }
    renderTopHoldings(currentPortfolio, "top-holdings-container");
    if (window.updateXRayTimeframe) window.updateXRayTimeframe("3Y");
    setTimeout(() => {
      if (d.metrics && xrayFullData.synthetics) updateRiskMapWithPeriod("3Y");
      if (d.correlationMatrix)
        renderCorrelationHeatmap(
          d.correlationMatrix,
          currentPortfolio.map((f) => f.name)
        );
    }, 300);
  } catch (e) {
    console.error(e);
    showToast("Error X-Ray", "error");
  } finally {
    btn.innerText = prev;
    btn.disabled = false;
  }
}

async function runOptimizationWithComparison() {
  if (!currentPortfolio.length) return showToast("Añade fondos", "error");
  const btn = document.getElementById("btn-optimize");
  const prev = btn.innerHTML;
  btn.innerHTML = `<span class="animate-spin">⚙️</span> Calculando...`;
  btn.disabled = true;
  try {
    const riskInput = document.getElementById("risk_level");
    const fnOpt = httpsCallable(functions, "optimize_portfolio_quant");
    const resOpt = await fnOpt({
      assets: currentPortfolio.map((f) => f.isin),
      risk_level: riskInput ? parseInt(riskInput.value) : 5,
    });
    if (resOpt.data.status === "error")
      throw new Error(resOpt.data.warnings[0]);
    const w = resOpt.data.weights || {};
    proposedPortfolio = currentPortfolio
      .map((f) => ({ ...f, weight: (w[f.isin] || 0) * 100 }))
      .filter((f) => f.weight > 0.01);
    const fnBacktest = httpsCallable(functions, "backtest_portfolio");
    const [resOld, resNew] = await Promise.all([
      fnBacktest({ portfolio: currentPortfolio, years: 5 }),
      fnBacktest({ portfolio: proposedPortfolio, years: 5 }),
    ]);
    lastOptimizationResult = {
      old: resOld.data.portfolioSeries || [],
      new: resNew.data.portfolioSeries || [],
      metricsOld: resOld.data.metrics || {},
      metricsNew: resNew.data.metrics || {},
    };
    openModal("comparison-modal");
    const mOld = resOld.data.metrics || {};
    const mNew = resNew.data.metrics || {};
    const updateRow = (id, oldV, newV, fmt) => {
      const elOld = document.getElementById(`comp-${id}-old`);
      const elNew = document.getElementById(`comp-${id}-new`);
      const elDiff = document.getElementById(`comp-${id}-diff`);
      if (elOld) elOld.textContent = fmt(oldV || 0);
      if (elNew) elNew.textContent = fmt(newV || 0);
      if (elDiff) {
        const diff = (newV || 0) - (oldV || 0);
        elDiff.textContent = (diff > 0 ? "+" : "") + fmt(diff);
        let good = diff > 0;
        if (id === "vol" || id === "mdd") good = diff < 0;
        if (id === "mdd") good = diff > 0;
        elDiff.className = `text-right font-serif ${
          good ? "text-emerald-600" : "text-red-500"
        }`;
      }
    };
    const pct = (v) => (v * 100).toFixed(2) + "%";
    const num = (v) => v.toFixed(2);
    updateRow("cagr", mOld.cagr, mNew.cagr, pct);
    updateRow("vol", mOld.volatility, mNew.volatility, pct);
    updateRow("sharpe", mOld.sharpe, mNew.sharpe, num);
    updateRow("mdd", mOld.maxDrawdown, mNew.maxDrawdown, pct);

    const renderBar = (id, p) => {
      let rv = 0,
        rf = 0,
        liq = 0;
      p.forEach((f) => {
        if (f.std_type === "RV") rv += f.weight;
        else if (f.std_type === "RF") rf += f.weight;
        else liq += f.weight;
      });
      const t = rv + rf + liq || 1;
      const el = document.getElementById(id);
      if (el)
        el.innerHTML = `<div style="width:${
          (rv / t) * 100
        }%;" class="h-full bg-emerald-500"></div><div style="width:${
          (rf / t) * 100
        }%;" class="h-full bg-[#0B2545]"></div><div style="width:${
          (liq / t) * 100
        }%;" class="h-full bg-[#D4AF37]"></div>`;
    };
    renderBar("comp-bar-old", currentPortfolio);
    renderBar("comp-bar-new", proposedPortfolio);
  } catch (e) {
    console.error(e);
    showToast("Error: " + e.message, "error");
  } finally {
    btn.innerHTML = prev;
    btn.disabled = false;
  }
}

async function fetchNews(mode, query) {
  const container = document.getElementById("news-general-container");
  if (!container) return;
  container.innerHTML =
    '<div class="text-center py-10 text-slate-400 italic animate-pulse">Cargando noticias...</div>';
  try {
    const fn = httpsCallable(functions, "getFinancialNews");
    const res = await fn({ mode: mode, query: query });
    const articles = res.data.articles || [];
    if (articles.length === 0) {
      container.innerHTML =
        '<div class="text-center py-10 text-slate-400">No se encontraron noticias recientes.</div>';
      return;
    }
    container.innerHTML = articles
      .map(
        (article) =>
          `<div class="mb-3 p-3 border border-slate-100 rounded bg-white hover:shadow-md transition-shadow group"><a href="${
            article.link
          }" target="_blank" class="block"><div class="flex justify-between items-start mb-1"><h4 class="text-[15px] font-bold text-[#0B2545] group-hover:text-[#D4AF37] transition-colors line-clamp-2">${
            article.title
          }</h4><span class="text-[11px] text-slate-400 whitespace-nowrap ml-2">${
            article.date ? new Date(article.date).toLocaleDateString() : ""
          }</span></div><p class="text-[13px] text-slate-600 line-clamp-3">${
            article.summary
          }</p><div class="mt-2 flex items-center gap-2"><span class="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">${
            article.source || "EODHD"
          }</span></div></a></div>`
      )
      .join("");
  } catch (error) {
    console.error("Error fetching news:", error);
    container.innerHTML =
      '<div class="text-center py-10 text-red-400">Error al cargar el feed de noticias.</div>';
  }
}

window.searchNews = function () {
  const query = document.getElementById("news-ticker-search").value.trim();
  if (query) {
    fetchNews("ticker", query);
  } else {
    fetchNews("general", "general");
  }
};

async function openNews() {
  openModal("news-modal");
  fetchNews("general", "general");
}

function openAdvancedEditor() {
  openModal("advanced-editor-modal");
  renderEditorTables();

  const mOld = lastOptimizationResult.metricsOld || {};
  const mNew = lastOptimizationResult.metricsNew || {};

  const elOldRet = document.getElementById("ws-orig-ret");
  if (elOldRet)
    elOldRet.textContent = ((mOld.cagr || 0) * 100).toFixed(2) + "%";
  const elOldVol = document.getElementById("ws-orig-vol");
  if (elOldVol)
    elOldVol.textContent = ((mOld.volatility || 0) * 100).toFixed(2) + "%";
  const elOldSharpe = document.getElementById("ws-orig-sharpe");
  if (elOldSharpe) elOldSharpe.textContent = (mOld.sharpe || 0).toFixed(2);

  const elNewRet = document.getElementById("ws-prop-ret");
  if (elNewRet)
    elNewRet.textContent = ((mNew.cagr || 0) * 100).toFixed(2) + "%";
  const elNewVol = document.getElementById("ws-prop-vol");
  if (elNewVol)
    elNewVol.textContent = ((mNew.volatility || 0) * 100).toFixed(2) + "%";
  const elNewSharpe = document.getElementById("ws-prop-sharpe");
  if (elNewSharpe) elNewSharpe.textContent = (mNew.sharpe || 0).toFixed(2);

  setTimeout(() => {
    if (lastOptimizationResult.old && lastOptimizationResult.old.length > 0) {
      renderComparisonChart(
        lastOptimizationResult.old.map((p) => ({ x: p.x, y: p.y })),
        lastOptimizationResult.new.map((p) => ({ x: p.x, y: p.y })),
        "workspace-chart"
      );
    }
  }, 300);
}

function renderEditorTables() {
  const t = document.getElementById("editor-original-tbody");
  if (t)
    t.innerHTML = currentPortfolio
      .map(
        (f) =>
          `<tr class="border-b border-slate-100 text-xs"><td class="py-2 truncate max-w-[120px] font-bold text-slate-700">${
            f.name
          }</td><td class="text-right font-mono">${f.weight.toFixed(
            1
          )}%</td><td class="text-right font-mono text-slate-400">-</td></tr>`
      )
      .join("");
  renderProposedTable();
}
function renderProposedTable() {
  const tbody = document.getElementById("editor-proposed-tbody");
  const ordersDiv = document.getElementById("rebalancing-orders-container");
  const invInput = document.getElementById("investment_amount");
  const cap = invInput ? parseFloat(invInput.value) || 100000 : 100000;
  let totalW = 0,
    ordersHTML = "",
    turnover = 0;
  if (!tbody) return;
  tbody.innerHTML = proposedPortfolio
    .map((f) => {
      totalW += f.weight;
      const orig = currentPortfolio.find((of) => of.isin === f.isin);
      const diffW = f.weight - (orig ? orig.weight : 0);
      const diffEUR = cap * (diffW / 100);
      if (Math.abs(diffEUR) > 10) {
        const type = diffEUR > 0 ? "COMPRA" : "VENTA";
        const col =
          diffEUR > 0
            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : "bg-rose-100 text-rose-800 border-rose-200";
        ordersHTML += `<div class="flex flex-col p-2 bg-white border rounded shadow-sm text-xs"><div class="flex justify-between mb-1"><span class="font-bold ${col} px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider">${type}</span><span class="font-mono font-bold">${formatCurrency(
          Math.abs(diffEUR)
        )}</span></div><span class="truncate w-full text-slate-600" title="${
          f.name
        }">${f.name}</span></div>`;
        turnover += Math.abs(diffEUR);
      }
      const color =
        Math.abs(diffW) < 0.1
          ? "text-slate-300"
          : diffW > 0
          ? "text-emerald-600 font-bold"
          : "text-rose-500 font-bold";
      return `<tr class="border-b border-slate-50 hover:bg-slate-50 group"><td class="py-2 text-[#0B2545] font-medium text-xs truncate max-w-[140px]">${
        f.name
      }</td><td class="py-2 text-right"><input type="number" class="w-12 text-right border rounded p-1 text-xs font-bold text-[#0B2545] focus:border-[#D4AF37] outline-none" value="${f.weight.toFixed(
        2
      )}" onchange="window.updateProposedWeight('${
        f.isin
      }', this.value)">%</td><td class="py-2 text-right text-xs font-mono ${color}">${
        diffW > 0 ? "+" : ""
      }${diffW.toFixed(
        2
      )}%</td><td class="py-2 text-center"><button onclick="window.removeProposedFund('${
        f.isin
      }')" class="text-slate-300 hover:text-red-500 transition-colors">&times;</button></td></tr>`;
    })
    .join("");
  if (!ordersHTML)
    ordersHTML =
      '<div class="text-center text-slate-400 italic text-[13px] mt-10">No hay cambios pendientes.</div>';
  if (ordersDiv) ordersDiv.innerHTML = ordersHTML;
  const totEl = document.getElementById("editor-total-weight-display");
  if (totEl) {
    totEl.textContent = `Total: ${totalW.toFixed(2)}%`;
    totEl.className =
      Math.abs(totalW - 100) < 0.1
        ? "text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded border border-emerald-200"
        : "text-xs font-bold bg-rose-100 text-rose-800 px-3 py-1 rounded border border-rose-200 animate-pulse";
  }
}

function filterAndRenderXRay() {
  if (!xrayFullData.port || !xrayFullData.port.length) {
    const ctx = document.getElementById("backtest-chart");
    if (ctx && window.ChartInstances && window.ChartInstances.xray)
      window.ChartInstances.xray.destroy();
    return;
  }
  const pEl = document.getElementById("xray-period-input");
  const period = pEl ? pEl.value : "3Y";
  const k = currentBenchmarkKey;
  const today = new Date();
  const cutoff = new Date();
  if (period === "1Y") cutoff.setFullYear(today.getFullYear() - 1);
  else if (period === "3Y") cutoff.setFullYear(today.getFullYear() - 3);
  else cutoff.setFullYear(today.getFullYear() - 5);
  const fp = xrayFullData.port.filter((x) => new Date(x.x) >= cutoff);
  let fb = [];
  let benchmarkLabel = "Seleccione Benchmark";
  if (k && xrayFullData.benchmarks[k]) {
    fb = xrayFullData.benchmarks[k].filter((x) => new Date(x.x) >= cutoff);
    benchmarkLabel = k.charAt(0).toUpperCase() + k.slice(1);
  }
  const norm = (arr) => {
    if (!arr.length) return [];
    const start = arr[0].y;
    return arr.map((z) => ({
      x: new Date(z.x).getTime(),
      y: (z.y / start) * 100,
    }));
  };
  renderXRayChart(norm(fp), norm(fb), benchmarkLabel);

  let seriesToCalc = fp;
  if (seriesToCalc && seriesToCalc.length > 0) {
    const stats = calculateStats(seriesToCalc);
    const dynamicSynthetics = [];
    const benchMap = {
      conservative: "Conservador",
      moderate: "Moderado",
      dynamic: "Dinámico",
      aggressive: "Agresivo",
    };

    if (xrayFullData.benchmarks) {
      Object.keys(xrayFullData.benchmarks).forEach((key) => {
        const series = xrayFullData.benchmarks[key];
        const filteredBench = series.filter((x) => new Date(x.x) >= cutoff);
        if (filteredBench.length > 0) {
          const bStats = calculateStats(filteredBench);
          dynamicSynthetics.push({
            name: benchMap[key] || key,
            vol: bStats.vol,
            ret: bStats.ret,
          });
        }
      });
    }
    renderRiskMap(
      { volatility: stats.vol, cagr: stats.ret },
      currentPortfolio,
      dynamicSynthetics
    );
  }

  updateRiskMapExplanation(period);
}

function calculateStats(series) {
  if (!series || series.length < 2) return { vol: 0, ret: 0 };
  const rets = [];
  for (let i = 1; i < series.length; i++) {
    rets.push(series[i].y / series[i - 1].y - 1);
  }
  const n = rets.length;
  const mean = rets.reduce((a, b) => a + b, 0) / n;
  const variance = rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const vol = Math.sqrt(variance) * Math.sqrt(252);
  const totalReturn = series[series.length - 1].y / series[0].y - 1;
  const years = n / 252;
  const ret = Math.pow(1 + totalReturn, 1 / years) - 1;
  return { vol, ret };
}

function updateRiskMapWithPeriod(period, filteredSeries = null) {
  let seriesToCalc = filteredSeries;
  if (!seriesToCalc && xrayFullData.port) {
    const cutoff = new Date();
    if (period === "1Y") cutoff.setFullYear(cutoff.getFullYear() - 1);
    else if (period === "3Y") cutoff.setFullYear(cutoff.getFullYear() - 3);
    else cutoff.setFullYear(cutoff.getFullYear() - 10);
    seriesToCalc = xrayFullData.port.filter((x) => new Date(x.x) >= cutoff);
  }
  if (seriesToCalc && seriesToCalc.length > 0) {
    const stats = calculateStats(seriesToCalc);
    renderRiskMap(
      { volatility: stats.vol, cagr: stats.ret },
      currentPortfolio,
      xrayFullData.synthetics
    );
  }
}

function updateRiskMapExplanation(period) {
  const container = document.getElementById("risk-map-explanation");
  if (!container) return;
  let explanation = "";
  if (period === "1Y")
    explanation = `<div class="space-y-3"><div class="p-3 bg-blue-50 rounded border border-blue-100"><h5 class="text-[13px] font-bold text-[#0B2545] uppercase mb-1">Visión Táctica (1 Año)</h5><p class="text-[12px] text-slate-700 leading-tight text-justify">Este marco temporal captura la "temperatura" actual del mercado. La volatilidad aquí suele ser mayor y refleja reacciones a eventos recientes (política monetaria, geopolítica).</p></div><div><h5 class="text-[13px] font-bold text-[#0B2545] mb-2 flex items-center gap-2"><span class="text-[18px]">🎯</span> ¿Cómo interpretar el mapa?</h5><ul class="space-y-2"><li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span><div class="text-[12px] text-slate-600 text-justify"><strong>Zona Eficiente (Arriba-Izquierda):</strong> Si su cartera está aquí, ha obtenido retornos superiores asumiendo menos riesgo que el mercado. ¡Excelente gestión!</div></li><li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span><div class="text-[12px] text-slate-600 text-justify"><strong>Zona de Alerta (Abajo-Derecha):</strong> Indica que se ha asumido mucho riesgo sin recompensa. Revise los activos con mayor caída reciente.</div></li></ul></div></div>`;
  else if (period === "3Y")
    explanation = `<div class="space-y-3"><div class="p-3 bg-indigo-50 rounded border border-indigo-100"><h5 class="text-[13px] font-bold text-[#0B2545] uppercase mb-1">Visión Estratégica (3 Años)</h5><p class="text-[12px] text-slate-700 leading-tight text-justify">El estándar de la industria. Elimina el ruido de corto plazo y evalúa la consistencia. Un buen gestor debe batir a su benchmark en este periodo.</p></div><div><h5 class="text-[13px] font-bold text-[#0B2545] mb-2 flex items-center gap-2"><span class="text-[18px]">📊</span> Ejes del Gráfico</h5><div class="grid grid-cols-2 gap-2"><div class="bg-white p-2 rounded border text-center"><span class="block text-[10px] font-bold text-slate-400 uppercase">Eje Vertical (Y)</span><span class="text-[13px] font-bold text-emerald-600">Rentabilidad</span><span class="block text-[10px] text-slate-500">¿Cuánto ha ganado?</span></div><div class="bg-white p-2 rounded border text-center"><span class="block text-[10px] font-bold text-slate-400 uppercase">Eje Horizontal (X)</span><span class="text-[13px] font-bold text-rose-500">Volatilidad</span><span class="block text-[10px] text-slate-500">¿Cuánto se ha movido?</span></div></div><p class="text-[11px] text-slate-500 mt-2 text-justify italic">Busque siempre estar "por encima" (más retorno) y "a la izquierda" (menos riesgo) de los diamantes de colores (benchmarks).</p></div></div>`;
  else if (period === "5Y")
    explanation = `<div class="space-y-3"><div class="p-3 bg-amber-50 rounded border border-amber-100"><h5 class="text-[13px] font-bold text-[#0B2545] uppercase mb-1">Visión Estructural (5 Años)</h5><p class="text-[12px] text-slate-700 leading-tight text-justify">Prueba de fuego. Muestra cómo la cartera ha navegado ciclos completos (expansión y recesión). Aquí se valida la tesis de inversión a largo plazo.</p></div><div><h5 class="text-[13px] font-bold text-[#0B2545] mb-2 flex items-center gap-2"><span class="text-[18px]">💡</span> Concepto Clave: Frontera Eficiente</h5><p class="text-[12px] text-slate-600 text-justify mb-2">Imagine una línea curva que conecta los puntos de mejor rendimiento posible para cada nivel de riesgo.</p><ul class="space-y-2"><li class="flex items-start gap-2"><span class="text-emerald-500 font-bold text-[13px]">✓</span><div class="text-[12px] text-slate-600">Si su cartera está cerca de esa "frontera imaginaria" superior, su diversificación está funcionando perfectamente.</div></li><li class="flex items-start gap-2"><span class="text-rose-500 font-bold text-[13px]">✕</span><div class="text-[12px] text-slate-600">Si está muy abajo, está asumiendo riesgo no compensado (ineficiencia). Considere optimizar la cartera.</div></li></ul></div></div>`;
  container.innerHTML = explanation;
}

// ==========================================
// 8. STARTUP & LISTENERS (AL FINAL)
// ==========================================

export async function startApp(user, firebaseApp) {
  console.log("Iniciando App en region europe-west1...");
  db = getFirestore(firebaseApp);
  functions = getFunctions(firebaseApp, "europe-west1");
  auth = getAuth(firebaseApp);
  const userEl = document.getElementById("user-display");
  if (userEl) userEl.textContent = user.email;
  setupListeners();
  
  // AQUI CAMBIA: loadData ya no usa Firestore, usa JSON
  await loadData();
  
  setTimeout(() => {
    updatePortfolioUI();
  }, 500);
}

function setupListeners() {
  const safeListener = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  };

  // Búsqueda en Grid: Filtra sobre el JSON en memoria
  safeListener("fund-search", "input", (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = fundDatabase.filter(f => f.name.toLowerCase().includes(term) || f.isin.toLowerCase().includes(term));
      renderGrid(filtered);
  });

  safeListener("portfolio-form", "submit", generateManualProposal);
  safeListener("run-backtest-btn", "click", runXRay);
  safeListener("csv-upload", "change", handleCSVUpload);
  safeListener("btn-optimize", "click", runOptimizationWithComparison);

  safeListener("btn-accept-optimization", "click", () => {
    closeModal("comparison-modal");
    try {
      openAdvancedEditor();
    } catch (e) {
      console.error(e);
    }
  });

  safeListener("btn-save-final-portfolio", "click", saveFinalPortfolio);
  safeListener("editor-add-fund-input", "input", handleEditorSearch);

  // NOTICIAS
  safeListener("btn-news-bell", "click", () => {
    openModal("news-modal");
    fetchNews("general", "general");
  });
  const newsSelect = document.getElementById("news-category");
  if (newsSelect) {
    newsSelect.addEventListener("change", (e) => {
      document.getElementById("news-ticker-search").value = "";
      fetchNews("general", e.target.value);
    });
  }

  // COSTES
  safeListener("btn-open-costs-tool", "click", () => {
    renderCosts();
    openModal("costs-detail-modal");
  });

  safeListener("btn-open-tactical", "click", () => openModal("tactical-modal"));
  safeListener("btn-open-vip-tool", "click", window.openVipModal);

  // VIP
  safeListener("vip-search-input", "input", handleVipSearch);
  safeListener("save-vips-btn", "click", saveVips);

  const riskInput = document.getElementById("risk_level");
  const riskDisplay = document.getElementById("risk-display");
  if (riskInput && riskDisplay) {
    riskInput.addEventListener("input", (e) => {
      riskDisplay.textContent = e.target.value;
    });
  }

  window.updateXRayTimeframe = (period) => {
    ["1Y", "3Y", "5Y"].forEach((p) => {
      const btn = document.getElementById(`btn-${p.toLowerCase()}`);
      if (btn) {
        if (p === period) {
          btn.classList.add("bg-[#0B2545]", "text-white", "shadow");
          btn.classList.remove("bg-white", "text-slate-500");
        } else {
          btn.classList.remove("bg-[#0B2545]", "text-white", "shadow");
          btn.classList.add("bg-white", "text-slate-500");
        }
      }
    });
    const input = document.getElementById("xray-period-input");
    if (input) input.value = period;
    filterAndRenderXRay();
  };
  window.updateBenchmarkSelection = (key) => {
    currentBenchmarkKey = key;
    filterAndRenderXRay();
  };
}

// WINDOW EXPORTS (Para onclick)
window.addFund = (isin) => {
  const f = fundDatabase.find((x) => x.isin === isin);
  if (f && !currentPortfolio.some((x) => x.isin === isin)) {
    currentPortfolio.push({ ...f, weight: 0 });
    updatePortfolioUI();
    showToast("Fondo añadido");
  }
};
window.removeFund = (isin) => {
  currentPortfolio = currentPortfolio.filter((x) => x.isin !== isin);
  updatePortfolioUI();
};
window.updateWeight = (isin, val) => {
  const f = currentPortfolio.find((x) => x.isin === isin);
  if (f) f.weight = parseFloat(val) || 0;
  updatePortfolioUI();
};
window.addFundToProposed = (i) => {
  const f = fundDatabase.find((x) => x.isin === i);
  if (f && !proposedPortfolio.some((x) => x.isin === i)) {
    proposedPortfolio.push({ ...f, weight: 0 });
    renderProposedTable();
    document.getElementById("editor-search-results").classList.add("hidden");
    document.getElementById("editor-add-fund-input").value = "";
  }
};
window.removeProposedFund = (i) => {
  proposedPortfolio = proposedPortfolio.filter((x) => x.isin !== i);
  renderProposedTable();
};
window.updateProposedWeight = (i, v) => {
  const f = proposedPortfolio.find((x) => x.isin === i);
  if (f) f.weight = parseFloat(v) || 0;
  renderProposedTable();
};
window.autoRebalance100 = () => {
  let t = proposedPortfolio.reduce((s, f) => s + f.weight, 0);
  if (t > 0)
    proposedPortfolio.forEach((f) => (f.weight = (f.weight / t) * 100));
  renderProposedTable();
  showToast("Ajustado al 100%");
};
window.addVipFund = (isin) => {
  const f = fundDatabase.find((x) => x.isin === isin);
  if (f && !vipList.some((x) => x.isin === isin)) {
    vipList.push(f);
    renderVipList();
    document.getElementById("vip-search-results").classList.add("hidden");
    document.getElementById("vip-search-input").value = "";
  }
};
window.removeVipFund = (isin) => {
  vipList = vipList.filter((x) => x.isin !== isin);
  renderVipList();
};
window.searchNews = function () {
  const query = document.getElementById("news-ticker-search").value.trim();
  if (query) {
    fetchNews("ticker", query);
  } else {
    fetchNews("general", "general");
  }
};