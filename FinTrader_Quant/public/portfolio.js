import { fundDatabase, currentPortfolio, vipFunds } from './store.js';

// ============================================================================
// 1. PERFILADO Y CLASIFICACIÓN
// ============================================================================

/**
 * Deduce el tipo de activo de un fondo basándose en su nombre o datos.
 */
export function inferAssetProfile(fund) {
    if (fund.manual_type) return fund.manual_type;
    
    // Detección por métricas explícitas
    if (fund.metrics) {
        if (parseFloat(fund.metrics.equity) > 60) return 'RV';
        if (parseFloat(fund.metrics.bond) > 60) return 'RF';
        if (parseFloat(fund.metrics.cash) > 60) return 'Monetario';
    }

    // Detección por nombre/clase
    const text = (fund.name + " " + (fund.class || "") + " " + (fund.category || "")).toUpperCase();
    
    if (text.includes('EQUITY') || text.includes('ACCIONES') || text.includes('RV') || text.includes('STOCK')) return 'RV';
    if (text.includes('BOND') || text.includes('RENTA FIJA') || text.includes('RF') || text.includes('DEUDA')) return 'RF';
    if (text.includes('MONEY') || text.includes('MONETARIO') || text.includes('LIQUIDEZ')) return 'Monetario';
    
    return 'Mixto'; // Fallback
}

/**
 * Calcula la exposición efectiva a Renta Variable de la cartera actual.
 */
export function getEffectiveExposureRV(portfolio) {
    let rvExposure = 0;
    portfolio.forEach(f => {
        const type = inferAssetProfile(f);
        if (type === 'RV') rvExposure += f.weight;
        else if (type === 'Mixto') rvExposure += (f.weight * 0.5);
    });
    return rvExposure;
}

/**
 * Determina la asignación de activos objetivo (Target Allocation) basada en el riesgo (1-10).
 */
export function getProfileAndAllocation(riskLevel) {
    const risk = parseInt(riskLevel);
    
    // Regla simple: (Risk * 10) = % Renta Variable aprox.
    let targetRV = risk * 10; 
    
    // Ajustes finos
    if (risk === 1) targetRV = 10;
    if (risk === 2) targetRV = 20;
    if (risk === 5) targetRV = 50;
    if (risk === 10) targetRV = 100;

    let targetRF = 100 - targetRV;
    
    return {
        profileName: risk >= 8 ? 'Agresivo' : (risk >= 4 ? 'Moderado' : 'Conservador'),
        targetRV,
        targetRF
    };
}

// ============================================================================
// 2. SELECCIÓN DE ACTIVOS (MOTOR DE RECOMENDACIÓN)
// ============================================================================

/**
 * Selecciona los mejores fondos disponibles para cumplir con el target de RV/RF.
 * Prioriza los fondos VIP (Ancla) definidos por el usuario.
 */
export function selectFunds(targetRV, targetRF, numberOfFunds = 5) {
    if (!fundDatabase || fundDatabase.length === 0) {
        console.warn("Base de datos de fondos vacía.");
        return [];
    }

    let selected = [];
    const slots = numberOfFunds;
    
    // 1. Forzar inclusión de VIPs
    const vipsInDb = fundDatabase.filter(f => vipFunds.includes(f.isin));
    vipsInDb.forEach(f => {
        selected.push({ ...f, locked: true }); // Marcamos como 'locked' para no eliminarlos
    });

    const slotsRemaining = Math.max(0, slots - selected.length);
    if (slotsRemaining === 0) return selected.slice(0, slots);

    // 2. Calcular huecos por tipo (RV vs RF)
    // Estimamos cuántos fondos de RV y RF necesitamos para llenar los huecos
    const rvCountCurrent = selected.filter(f => inferAssetProfile(f) === 'RV').length;
    const rfCountCurrent = selected.filter(f => inferAssetProfile(f) !== 'RV').length;
    
    // Proporción ideal de slots
    const idealRvSlots = Math.round(slots * (targetRV / 100));
    let neededRV = Math.max(0, idealRvSlots - rvCountCurrent);
    let neededRF = Math.max(0, (slots - idealRvSlots) - rfCountCurrent);

    // Ajuste si sobran slots y falta asignación
    while (neededRV + neededRF < slotsRemaining) {
        if (targetRV > targetRF) neededRV++; else neededRF++;
    }

    // 3. Filtrar candidatos (Excluyendo los ya seleccionados)
    const candidates = fundDatabase.filter(f => !selected.find(s => s.isin === f.isin));
    
    const candidatesRV = candidates.filter(f => inferAssetProfile(f) === 'RV')
                                   .sort((a, b) => (b.score || 0) - (a.score || 0)); // Ordenar por Score/Calidad
    
    const candidatesRF = candidates.filter(f => inferAssetProfile(f) !== 'RV')
                                   .sort((a, b) => (b.score || 0) - (a.score || 0));

    // 4. Rellenar
    selected = [
        ...selected,
        ...candidatesRV.slice(0, neededRV),
        ...candidatesRF.slice(0, neededRF)
    ];

    // Si aún faltan (por falta de candidatos específicos), rellenar con lo mejor disponible globalmente
    if (selected.length < slots) {
        const remaining = slots - selected.length;
        const extras = candidates.filter(f => !selected.find(s => s.isin === f.isin))
                                 .sort((a, b) => (b.score || 0) - (a.score || 0))
                                 .slice(0, remaining);
        selected = [...selected, ...extras];
    }

    return selected;
}

// ============================================================================
// 3. MOTOR DE PONDERACIÓN (ASIGNACIÓN DE PESOS)
// ============================================================================

/**
 * Asigna pesos porcentuales a la lista de fondos seleccionada para cumplir el Target.
 */
export function assignWeights(selectedFunds, targetRV, targetRF) {
    if (selectedFunds.length === 0) return [];

    // Separar en cubos
    const bucketRV = selectedFunds.filter(f => inferAssetProfile(f) === 'RV');
    const bucketRF = selectedFunds.filter(f => inferAssetProfile(f) !== 'RV');

    // Asignar peso equitativo dentro de cada cubo
    // (En una versión avanzada, aquí usaríamos Markowitz/Optimización)
    
    // Caso borde: Si no hay fondos de un tipo pero el target lo pide, 
    // todo el peso se va al otro grupo disponible.
    let effectiveTargetRV = targetRV;
    let effectiveTargetRF = targetRF;

    if (bucketRV.length === 0) { effectiveTargetRF = 100; effectiveTargetRV = 0; }
    if (bucketRF.length === 0) { effectiveTargetRV = 100; effectiveTargetRF = 0; }

    const weightPerRV = bucketRV.length > 0 ? (effectiveTargetRV / bucketRV.length) : 0;
    const weightPerRF = bucketRF.length > 0 ? (effectiveTargetRF / bucketRF.length) : 0;

    return selectedFunds.map(f => {
        const type = inferAssetProfile(f);
        let w = (type === 'RV') ? weightPerRV : weightPerRF;
        return { ...f, weight: w };
    });
}

/**
 * Normaliza los pesos para asegurar que sumen exactamente 100%.
 */
export function roundAndNormalizeWeights(portfolio) {
    if (!portfolio.length) return [];
    
    let sum = 0;
    // Redondear a 1 decimal
    const temp = portfolio.map(f => {
        const w = Math.round(f.weight * 10) / 10;
        sum += w;
        return { ...f, weight: w };
    });

    const diff = 100 - sum;
    
    // Ajustar la diferencia al fondo con mayor peso (para minimizar impacto visual)
    if (Math.abs(diff) > 0.01) {
        // Buscar el fondo con mayor peso
        const maxFund = temp.reduce((prev, current) => (prev.weight > current.weight) ? prev : current);
        maxFund.weight += diff;
        // Corregir precisión flotante
        maxFund.weight = Math.round(maxFund.weight * 10) / 10;
    }

    return temp;
}

// ============================================================================
// 4. CÁLCULO DE MÉTRICAS (Lógica Centralizada Refactorizada)
// ============================================================================

export function calculatePortfolioStats(portfolio) {
    let ret = 0, vol = 0, totalW = 0;
    
    portfolio.forEach(f => {
        const w = f.weight / 100;
        if (w <= 0) return;

        // Normalización de datos: Prioridad a datos pre-calculados, fallback a heurística
        const r = f.returns?.['3y_annualized'] 
                  ? (f.returns['3y_annualized'] / 100) 
                  : (f.perf?.cagr3y || 0.05); // Fallback 5%
        
        const v = f.perf?.volatility 
                  ? (f.perf.volatility > 1 ? f.perf.volatility / 100 : f.perf.volatility) 
                  : 0.12; // Fallback 12%

        ret += r * w;
        vol += v * w;
        totalW += w;
    });

    // Corrección heurística por diversificación (Solo para estimación rápida en Frontend)
    // Reduce la volatilidad si hay suficientes activos (Efecto Diversificación)
    if (totalW > 0.8 && portfolio.filter(f => f.weight > 5).length >= 4) {
        vol *= 0.85; 
    }

    const RISK_FREE_RATE = 0.025; // 2.5% Base
    const sharpe = vol > 0.01 ? (ret - RISK_FREE_RATE) / vol : 0;
    
    return { ret, vol, sharpe };
}