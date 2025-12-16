import { fundDatabase } from './store.js';

// ============================================================================
// FASE 2: MATRIZ MAESTRA (AJUSTADA QUANT 3.0)
// ============================================================================
const RISK_MATRIX = {
    1: { allowed: ['RF', 'Monetario'], maxVol: 0.03, name: "Ultraconservador" },
    2: { allowed: ['RF', 'Monetario', 'Mixto'], maxVol: 0.05, name: "Conservador" },
    3: { allowed: ['RF', 'Mixto', 'RV'], maxVol: 0.07, name: "Moderado-Bajo" }, // RV permitida pero poca
    4: { allowed: ['RF', 'Mixto', 'RV'], maxVol: 0.09, name: "Moderado" },
    5: { allowed: ['RF', 'Mixto', 'RV'], maxVol: 0.11, name: "Equilibrado" },
    6: { allowed: ['RF', 'Mixto', 'RV'], maxVol: 0.13, name: "Dinámico" },
    7: { allowed: ['RF', 'Mixto', 'RV'], maxVol: 0.15, name: "Crecimiento" },
    8: { allowed: ['RF', 'Mixto', 'RV'], maxVol: 0.18, name: "Agresivo" },
    9: { allowed: ['RF', 'RV'], maxVol: 0.22, name: "Muy Agresivo" },
    10: { allowed: ['RV', 'RF'], maxVol: 1.00, name: "Especulativo" }
};

const GEO_STRATEGY = {
    euro_focus: { usa: 0.20, eu: 0.50, em: 0.05, global: 0.25 },
    balanced: { usa: 0.40, eu: 0.30, em: 0.10, global: 0.20 },
    dynamic: { usa: 0.50, eu: 0.20, em: 0.15, global: 0.15 },
    aggressive: { usa: 0.55, eu: 0.15, em: 0.20, global: 0.10 }
};

// ============================================================================
// SCORING ENGINE V3.1 (QUANTUM)
// ============================================================================
function calculateScore(fund, riskLevel) {
    let score = 0;

    // --- 1. FACTOR CALIDAD (Max 50 pts) ---
    // Confianza Institucional
    const stars = fund.stats_extra?.stars || 0;
    score += (stars * 8); // 5 stars = 40 pts

    const medalist = fund.stats_extra?.medalist || 'Neutral';
    if (medalist === 'Gold') score += 10;
    else if (medalist === 'Silver') score += 7;
    else if (medalist === 'Bronze') score += 4;
    else if (medalist === 'Neutral') score += 2;
    // Negative = 0

    // --- 2. FACTOR MOMENTUM & RIESGO (Max 30 pts) ---
    const sharpe = fund.std_perf?.sharpe || 0;
    if (sharpe > 1.5) score += 15;
    else if (sharpe > 1.0) score += 10;
    else if (sharpe > 0.5) score += 5;

    const ret3y = fund.std_perf?.cagr3y || 0;
    if (ret3y > 0.05) score += 15;
    else if (ret3y > 0) score += 10;

    // --- 3. FACTOR EFICIENCIA (Max 20 pts) ---
    const infoRatio = fund.std_perf?.infoRatio || 0;
    if (infoRatio > 0.5) score += 10; // Bate al índice consistentemente

    const vol = fund.std_perf?.volatility || 0.15;
    score += 10; // Base por tener control (se penaliza abajo)

    // Penalización por Volatilidad en perfiles conservadores
    if (riskLevel <= 4 && vol > 0.12) {
        score -= 5;
    }

    return Math.min(100, Math.max(0, score));
}

// ============================================================================
// FILTROS DE SEGURIDAD ("DEEP MOAT")
// ============================================================================
function getPoolOfCandidates(riskLevel) {
    const profile = RISK_MATRIX[riskLevel];

    let candidates = fundDatabase.filter(f => {
        // 1. Filtro Anti-Zombies
        if (f.name.includes("ZOMBIE") || f.name.includes("EMPTY")) return false;

        // 2. Filtro de Calidad Mínima
        // Si tiene rating, exigimos mínimo 3 estrellas O un Sharpe excelente (>0.5)
        if (f.stats_extra.stars > 0 && f.stats_extra.stars < 3) {
            if (f.std_perf.sharpe < 0.5) return false;
        }
        // Exclusión Inmediata Medalist Negative
        if (f.stats_extra?.medalist === 'Negative') return false;

        // 3. Filtro Macro (Duración en RF)
        // Para perfiles defensivos, evitar RF largo plazo
        if (riskLevel <= 3 && f.std_type === 'RF') {
            if (f.stats_extra?.duration > 7) return false;
        }

        // 4. Perfil de Riesgo (Volatilidad Max)
        const vol = f.std_perf.volatility;
        if (vol > profile.maxVol) return false;

        // 5. Tipo de Activo Permitido
        if (!profile.allowed.includes(f.std_type)) return false;

        return true;
    });

    // Calcular Score Final V3.1
    candidates.forEach(f => f.finalScore = calculateScore(f, riskLevel));

    // Ordenar por Score
    return candidates.sort((a, b) => b.finalScore - a.finalScore);
}

// ============================================================================
// GENERADOR DE CARTERA (SMARTBUCKETS)
// ============================================================================
export function generateSmartPortfolio(riskLevel) {
    console.log(`⚡ Generando cartera Quant 3.0 para Nivel ${riskLevel}`);
    const validCandidates = getPoolOfCandidates(riskLevel);

    let strategy = GEO_STRATEGY.balanced;
    if (riskLevel <= 3) strategy = GEO_STRATEGY.euro_focus;
    else if (riskLevel >= 6 && riskLevel <= 8) strategy = GEO_STRATEGY.dynamic;
    else if (riskLevel >= 9) strategy = GEO_STRATEGY.aggressive;

    const finalPortfolio = [];
    const usedISINs = new Set();
    const TARGET_FUNDS = 5; // Objetivo estándar

    // Distribución de Buckets Geográficos
    const buckets = [
        { type: 'USA', weight: strategy.usa * 100, candidates: validCandidates.filter(f => f.region === 'USA') },
        { type: 'Europe', weight: strategy.eu * 100, candidates: validCandidates.filter(f => f.region === 'Europe') },
        { type: 'Emerging', weight: strategy.em * 100, candidates: validCandidates.filter(f => f.region === 'Emerging') },
        { type: 'Global', weight: strategy.global * 100, candidates: validCandidates.filter(f => f.region === 'Global') }
    ];

    // Llenado de Buckets
    buckets.forEach(bucket => {
        // Seleccionar el MEJOR candidato (Top Score)
        const best = bucket.candidates.find(f => !usedISINs.has(f.isin));
        if (best) {
            finalPortfolio.push({ ...best, weight: bucket.weight });
            usedISINs.add(best.isin);
        } else {
            // Si no hay específico, buscar Global o cualquiera compatible
            const rescue = validCandidates.find(f => !usedISINs.has(f.isin));
            if (rescue) {
                finalPortfolio.push({ ...rescue, weight: bucket.weight });
                usedISINs.add(rescue.isin);
            }
        }
    });

    // Rellenar hasta llegar a TARGET_FUNDS si faltan (para diversificar)
    while (finalPortfolio.length < TARGET_FUNDS) {
        const nextBest = validCandidates.find(f => !usedISINs.has(f.isin));
        if (nextBest) {
            // Dividir pesos existentes para hacer hueco? 
            // Simplificación: Añadir con peso 0 y luego normalizar, o dividir el mayor.
            // Estrategia: Añadir y luego rebalancear al 100%.
            finalPortfolio.push({ ...nextBest, weight: 0 });
            usedISINs.add(nextBest.isin);
        } else {
            break; // No hay más candidatos
        }
    }

    // Normalizar Pesos al 100%
    const totalW = finalPortfolio.reduce((sum, f) => sum + f.weight, 0);
    if (totalW > 0) {
        finalPortfolio.forEach(f => f.weight = (f.weight / totalW) * 100);
    } else {
        // Fallback equitativo
        finalPortfolio.forEach(f => f.weight = 100 / finalPortfolio.length);
    }

    console.log("Cartera Generada:", finalPortfolio);
    return finalPortfolio;
}

export function getTopPicks() {
    return getPoolOfCandidates(5).slice(0, 10); // Top picks balanced
}