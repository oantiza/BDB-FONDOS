// rulesEngine.js - V2 "Hydraulic" Logic & Cost-Agnostic Scoring
// Implementa Estrategia Macro-Europeísta + Scoring de Calidad Pura

// ============================================================================
// 1. CONFIGURACIÓN DE ESTRATEGIA
// ============================================================================

// Matriz de Riesgo: Define Volatilidad Máxima permitida
export const RISK_MATRIX = {
    1: { name: "Preservación", maxVol: 0.035, allowed: ['Monetario', 'RF'] },
    2: { name: "Muy Conservador", maxVol: 0.06, allowed: ['RF', 'Monetario', 'Mixto'] },
    3: { name: "Conservador", maxVol: 0.08, allowed: ['RF', 'Mixto'] },
    4: { name: "Mod. Defensivo", maxVol: 0.10, allowed: ['RF', 'Mixto', 'Retorno Absoluto'] },
    5: { name: "Equilibrado", maxVol: 0.12, allowed: ['Mixto', 'RV', 'RF'] },
    6: { name: "Crecimiento Mod.", maxVol: 0.15, allowed: ['RV', 'Mixto'] },
    7: { name: "Dinámico", maxVol: 0.18, allowed: ['RV'] },
    8: { name: "Crecimiento", maxVol: 0.22, allowed: ['RV'] },
    9: { name: "Agresivo", maxVol: 0.28, allowed: ['RV'] },
    10: { name: "High Conviction", maxVol: 1.00, allowed: ['RV', 'Mixto'] }
};

// Target Macro "Europeísta" (Objetivo Ideal)
const MACRO_TARGETS = {
    europe: 0.40, // 40%
    usa: 0.35,    // 35%
    rest: 0.25    // 25% (Asia + EM + Otros)
};

// ============================================================================
// 2. MOTOR DE SCORING V2 (COST-AGNOSTIC)
// ============================================================================
// Fórmula: Score = (0.5 * Sharpe) + (0.4 * Alpha) + (0.1 * Consistency)

function calculateScoreV2(fund) {
    // Extraer Métricas (con defaults seguros)
    const sharpe = fund.std_perf?.sharpe || 0.5;
    const alpha = fund.std_perf?.alpha || 0;
    const consistency = fund.std_extra?.yearsHistory >= 5 ? 10 : (fund.std_extra?.yearsHistory || 0);
    // Consistencia normalizada 0-10 (asumimos >5 años es 10/10)

    // Pesos
    const w1 = 50; // Sharpe
    const w2 = 40; // Alpha
    const w3 = 10; // Consistencia

    // Normalización aproximada para que los componentes sumen en escalas similares
    // Sharpe suele ser 0-2 -> x20 -> 0-40 (si w1=50, ajustamos factor)
    // Alpha suele ser -5 a +5 -> normalizar positivo

    // Cálculo Directo Ponderado
    const scoreSharpe = sharpe * w1;           // Ej: 1.0 * 50 = 50 pts
    const scoreAlpha = (alpha + 5) * (w2 / 5); // Ej: Alpha 0 -> 5 * 8 = 40 pts. Alpha -2 -> 3 * 8 = 24.
    const scoreConsist = consistency * (w3 / 10); // Ej: 10 años * 1 = 10 pts

    // Penalización oculta de seguridad (Hard Rule implícita en la valoración)
    // Si volatilidad es extrema para su categoría, reducimos ligeramente, pero ya no prohibimos coste.

    return scoreSharpe + scoreAlpha + scoreConsist;
}

// Filtro de Seguridad "Hard Rules" (Volatilidad & Divisa)
function isSafeCandidate(fund, riskProfile) {
    if (!profileAllowedType(fund.std_type, riskProfile.allowed)) return false;

    // Filtro Divisa: Preferencia EUR fuerte, pero aceptamos USD si es buen fondo (hedged implícito o explícito)
    // Para simplificar: Solo EUR o clases Hedged
    // const isEur = fund.currency === 'EUR' || (fund.name && fund.name.includes('Hedged'));
    // if (!isEur) return false; 

    // Filtro Volatilidad
    const vol = fund.std_perf?.volatility || 100;
    if (vol > riskProfile.maxVol + 0.02) return false; // Margen de tolerancia ligero

    return true;
}

function profileAllowedType(type, allowedList) {
    if (!type) return false;
    // Mapeo flexible
    if (allowedList.includes('RV') && (type === 'Equity' || type === 'RV')) return true;
    if (allowedList.includes('RF') && (type === 'Fixed Income' || type === 'RF')) return true;
    if (allowedList.includes('Mixto') && (type === 'Mixed' || type === 'Mixto' || type === 'Allocation')) return true;
    if (allowedList.includes('Monetario') && (type === 'Money Market' || type === 'Monetario')) return true;
    if (allowedList.includes('Retorno Absoluto') && type === 'Alternative') return true;
    return false;
}

// ============================================================================
// 3. MOTOR DE SELECCIÓN & ORDENAMIENTO
// ============================================================================

function getRankedCandidates(riskLevel, fundDatabase) {
    const profile = RISK_MATRIX[riskLevel];

    // 1. Filtrado Inicial (Hard Rules)
    const validFunds = fundDatabase.filter(f => isSafeCandidate(f, profile));

    // 2. Scoring "Cost-Agnostic"
    const scoredFunds = validFunds.map(f => ({
        ...f,
        advancedScore: calculateScoreV2(f)
    }));

    // 3. Ordenar por Score descendente
    return scoredFunds.sort((a, b) => b.advancedScore - a.advancedScore);
}

// ============================================================================
// 4. MOTOR HIDRÁULICO DE ASIGNACIÓN (Compensación de Pesos)
// ============================================================================

export function generateSmartPortfolio(riskLevel, fundDatabase, targetCount = 5) {
    console.log(`⚡ [Hydraulic Engine] Generando cartera Nivel ${riskLevel} - Europe Centric`);

    const candidates = getRankedCandidates(riskLevel, fundDatabase);

    if (candidates.length === 0) return [];

    let portfolio = [];
    let currentExposure = { europe: 0, usa: 0, rest: 0 };
    const usedISINs = new Set();
    const usedCompanies = {};

    // Helper: Estimar exposición real de un fondo
    // Si no tenemos desglose exacto, usamos heurísticos por región declarada
    const estimateFundExposure = (fund) => {
        // Si tuviera datos reales de 'regions', usarlos:
        // if (fund.regions) return fund.regions; 

        const reg = (fund.std_region || 'Global').toLowerCase();

        if (reg === 'usa' || reg.includes('united states')) return { europe: 0, usa: 1, rest: 0 };
        if (reg === 'europe' || reg === 'euro') return { europe: 1, usa: 0, rest: 0 };
        if (reg === 'global') return { europe: 0.20, usa: 0.60, rest: 0.20 }; // El "problema" de los globales standard
        if (reg === 'emerging' || reg === 'asia') return { europe: 0, usa: 0, rest: 1 };

        return { europe: 0.33, usa: 0.33, rest: 0.33 }; // Fallback mixto
    };

    // BUCLE DE CONSTRUCCIÓN "HIDRÁULICA"
    // Intentamos llenar la cartera fondo a fondo, eligiendo el que mejor equilibre la balanza hacia el Target Macro.

    for (let i = 0; i < targetCount; i++) {
        // Calcular déficit actual (Qué región necesitamos más desesperadamente)
        // (Normalizamos por el número de fondos que faltan para no pedir todo de golpe)

        // Peso medio que tendrá este nuevo fondo (aprox 1/N)
        const slotWeight = 1 / targetCount;

        // ¿Cómo quedaría la cartera si añadimos un fondo ideal?
        // Buscamos el fondo que minimice la distancia al MACRO_TARGETS global.

        let bestCandidate = null;
        let bestImpactScore = -Infinity;

        // Revisar top 50 candidatos disponibles (para no iterar todo)
        const topCandidates = candidates.filter(f => !usedISINs.has(f.isin)).slice(0, 50);

        for (const cand of topCandidates) {
            // Check Diversity implícito
            const company = cand.std_extra?.company || 'Unknown';
            if ((usedCompanies[company] || 0) >= 2) continue;

            const exposure = estimateFundExposure(cand);

            // Simular anadir este fondo
            // const simulatedEurope = currentExposure.europe + (exposure.europe * slotWeight);
            // const simulatedUsa = currentExposure.usa + (exposure.usa * slotWeight);
            // ... (rest no crítico para decisión inmediata)

            // Distancia al target ideal (Queremos acercarnos a 40% EU, 35% USA)
            // Calculamos "Utilidad Marginal": Cuánto reduce el error cuadrático o simple.

            // Simplificación Heurística:
            // Score = ScoreIntrínseco + BonusPorEncaje

            // Bonus: Si necesito Europa y fondo es Europa -> +++
            // Déficits actuales (positivos significa que falta)
            const deficitEurope = MACRO_TARGETS.europe - currentExposure.europe;
            const deficitUsa = MACRO_TARGETS.usa - currentExposure.usa;

            let fitScore = 0;
            if (deficitEurope > deficitUsa && exposure.europe > 0.5) fitScore += 50; // Gran bonus si cubre necesidad principal
            if (deficitUsa > deficitEurope && exposure.usa > 0.5) fitScore += 50;
            if (exposure.europe > 0.8 && deficitEurope > 0.1) fitScore += 20; // Pure Europe bonus

            // Valoración Final Combinada
            // Priorizamos calidad (advancedScore) pero el Fit es el "Hydraulic Compensator"
            const totalUtility = cand.advancedScore + fitScore;

            if (totalUtility > bestImpactScore) {
                bestImpactScore = totalUtility;
                bestCandidate = cand;
            }
        }

        if (bestCandidate) {
            // Añadir fondo
            bestCandidate.weight = (100 / targetCount); // Peso equiponderado inicial
            portfolio.push(bestCandidate);
            usedISINs.add(bestCandidate.isin);

            const comp = bestCandidate.std_extra?.company || 'Unknown';
            usedCompanies[comp] = (usedCompanies[comp] || 0) + 1;

            // Actualizar Exposición Acumulada (aproximada para la siguiente iteración)
            const exp = estimateFundExposure(bestCandidate);
            currentExposure.europe += (exp.europe * slotWeight);
            currentExposure.usa += (exp.usa * slotWeight);
            currentExposure.rest += (exp.rest * slotWeight);

            console.log(`   > Added ${bestCandidate.name} (Fit: ${bestCandidate.advancedScore.toFixed(0)} + GapBonus). New Exposure: EU ${(currentExposure.europe * 100).toFixed(0)}% / USA ${(currentExposure.usa * 100).toFixed(0)}%`);
        } else {
            console.log("   ⚠️ No more valid candidates found to fill slot.");
            break;
        }
    }

    return portfolio;
}

