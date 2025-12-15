// ============================================================================
// STORE.JS - Gestión Centralizada del Estado
// ============================================================================

// --- 1. Instancias de Firebase ---
export let app = null;
export let db = null;
export let functions = null;
export let auth = null;

export function setFirebaseInstances(appInstance, dbInstance, functionsInstance, authInstance) {
    app = appInstance;
    db = dbInstance;
    functions = functionsInstance;
    auth = authInstance;
}

// --- 2. Datos Maestros (Base de Datos de Fondos) ---
export let fundDatabase = [];

export function setFundData(data) {
    // Si viene como objeto { allFunds: [...] } o array directo
    fundDatabase = Array.isArray(data) ? data : (data.allFunds || []);
    console.log(`Store actualizado con ${fundDatabase.length} fondos.`);
}

// --- 3. Estado de la Cartera Actual ---
export let currentPortfolio = [];
export let currentAllocation = { 
    rv: 0, 
    rf: 0, 
    other: 0 
};
export let vipFunds = []; // Fondos "Ancla" obligatorios

export function setPortfolio(newPortfolio) {
    currentPortfolio = [...newPortfolio];
}

export function setAllocation(newAlloc) {
    currentAllocation = { ...newAlloc };
}

export function setVipFunds(newVips) {
    vipFunds = [...newVips];
}

// --- 4. Asignación Táctica (Configuración) ---
export const BASE_TACTICAL = {
    rv: { usa: 45, europe: 30, asia: 15, emg: 10 },
    rf: { gov: 45, corp: 45, emg_rf: 5, hy: 5 }
};

export let currentTactical = JSON.parse(JSON.stringify(BASE_TACTICAL));

export function setTacticalConfig(newConfig) {
    currentTactical = newConfig;
}

export function resetTacticalToBase() {
    currentTactical = JSON.parse(JSON.stringify(BASE_TACTICAL));
    return currentTactical;
}

// --- 5. Mock Data (Fallback para desarrollo) ---
export function loadMockData() {
    console.warn("⚠️ Usando Mock Data (Modo Offline/Dev)");
    fundDatabase = [
        { isin: 'ES0140072002', name: 'Caixabank Monetario Rendimiento', type: 'Monetario', score: 8, perf: { volatility: 0.5, cagr3y: 2.5 } },
        { isin: 'IE00B03HD191', name: 'Vanguard US 500 Stock Index', type: 'RV', score: 9, perf: { volatility: 15, cagr3y: 12 } },
        { isin: 'LU0996182563', name: 'Amundi Index MSCI World', type: 'RV', score: 8.5, perf: { volatility: 14, cagr3y: 10 } },
        { isin: 'IE00B18GC888', name: 'Vanguard Global Bond Index', type: 'RF', score: 7, perf: { volatility: 4, cagr3y: 1.5 } }
    ];
}