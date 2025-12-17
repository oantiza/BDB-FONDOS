// ============================================================================
// STORE.JS - Gestión Centralizada del Estado
// ============================================================================

// --- Datos Maestros (Base de Datos de Fondos) ---
// Exportamos 'fundDatabase' como una variable que otros pueden leer.
// Exportamos 'setFundData' para que app_modern.js pueda escribir en ella.
export let fundDatabase = [];

export function setFundData(newData) {
    // Aseguramos que sea un array
    fundDatabase = Array.isArray(newData) ? newData : [];
    console.log(`💾 Store actualizado: ${fundDatabase.length} fondos disponibles globalmente.`);
}

// --- Estado de la Cartera Actual ---
export let currentPortfolio = [];
export let vipFunds = []; 

export function setPortfolio(newPortfolio) {
    currentPortfolio = [...newPortfolio];
}

export function setVipFunds(newVips) {
    vipFunds = [...newVips];
}

// --- Helpers para Mock Data (Opcional) ---
export function loadMockData() {
    console.warn("⚠️ Usando Mock Data (Modo Offline/Dev)");
    setFundData([
        { isin: 'ES0140072002', name: 'Caixabank Monetario', manual_type: 'Monetario', score: 80, metrics: { volatility_1y: 0.01 } },
        { isin: 'IE00B03HD191', name: 'Vanguard US 500', manual_type: 'RV USA', score: 90, metrics: { volatility_1y: 0.15 } }
    ]);
}