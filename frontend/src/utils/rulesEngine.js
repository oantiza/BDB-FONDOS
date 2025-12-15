// rulesEngine.js - Portado de public_legacy/portfolio.js
// Lógica de cliente para selección de fondos y generación de carteras manuales

// ============================================================================
// MATRIZ DE RIESGO
// ============================================================================
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

// ============================================================================
// ESTRATEGIA GEOGRÁFICA
// ============================================================================
const GEO_STRATEGY = {
    euro_focus: { core: { region: 'Europe', weight: 100 }, satellite: null },
    balanced: { core: { region: 'Global', weight: 60, alt: 'USA' }, satellite: { region: 'Europe', weight: 40 } },
    dynamic: { core: { region: 'USA', weight: 70, alt: 'Global' }, satellite: { region: 'Europe', weight: 30 } },
    aggressive: { core: { region: 'USA', weight: 50 }, satellite: { region: 'Emerging', weight: 30 }, extra: { region: 'Europe', weight: 20 } },
    high_conviction: { core: { region: 'USA', style: 'Growth', weight: 50 }, satellite: { region: 'Any', style: 'Sector', weight: 50 } }
};

// ============================================================================
// SCORING
// ============================================================================
// ============================================================================
// SCORING
// ============================================================================
function calculateScore(fund) {
    const sharpe = fund.std_perf?.sharpe || 0;
    const alpha = fund.std_perf?.alpha || 0;
    const vol = fund.std_perf?.volatility || 0.15;

    // New Fields
    const history = fund.std_extra?.yearsHistory || 0; // Consistency
    const mgmtFee = fund.std_extra?.mgmtFee || 1.0;    // Efficiency (Cost)

    // 1. Safety Score (Max 40)
    // Penalización por volatilidad alta (clave para perfiles bajos)
    const safetyScore = Math.max(0, (0.20 - vol) * 200);

    // 2. Consistency Bonus (REMOVED to match Master Spec)
    // const consistencyScore = Math.min(history, 10) * 2; 

    // 3. Efficiency Penalty (Cost) - REMOVED AS PER USER REQUEST
    // const costPenalty = mgmtFee * 20;

    return (sharpe * 40) + (alpha * 20) + Math.min(safetyScore, 40);
}

// Helper to get fee (Retrocession > Mgmt Fee > OCF)
function getFee(f) {
    return (f.costs?.retrocession || f.costs?.management_fee || f.profile?.ongoing_charge || 0);
}

// ============================================================================
// SELECCIÓN DE CANDIDATOS
// ============================================================================
function getPoolOfCandidates(riskLevel, profile, fundDatabase, minCount = 5) {
    // INTENTO 1: Filtro Estricto (Solo Tipo + Volatilidad, sin restricción de historia)
    let candidates = fundDatabase.filter(f => {
        return profile.allowed.includes(f.std_type) && f.std_perf?.volatility <= profile.maxVol;
    });

    // INTENTO 2: Expansión de Volatilidad (si no llegamos al mínimo)
    if (candidates.length < minCount) {
        console.log(`⚠️ Pool estricto pequeño (${candidates.length}). Relajando volatilidad...`);
        const needed = minCount - candidates.length;
        const relaxed = fundDatabase.filter(f => {
            const relaxedVol = Math.max(profile.maxVol * 1.5, 0.04);
            // Relax history check here too? Allow > 1 year or missing?
            // Let's keep filters simple: Just vol and allowed types
            return profile.allowed.includes(f.std_type) && f.std_perf?.volatility <= relaxedVol;
        });
        // Merge unique? Or just replace?
        // Let's just use the relaxed pool if strict failed to provide enough.
        candidates = relaxed;
    }

    // INTENTO 3: Expansión de Categoría (Perfiles bajos)
    if (candidates.length < minCount && riskLevel <= 4) {
        console.log(`⚠️ Pool sigue pequeño. Incluyendo Mixtos/RF Globales seguros.`);
        candidates = fundDatabase.filter(f => {
            const safeVol = 0.06;
            const isSafe = f.std_perf?.volatility <= safeVol;
            const isNotRiskyEquity = f.std_type !== 'RV' || f.std_perf?.volatility < 0.04;
            return isSafe && isNotRiskyEquity;
        });
    }

    // --- DEDUPLICACIÓN POR MAYOR COMISIÓN ---
    // Agrupar por "Nombre Base", elegir el de mayor comisión
    const groups = {};
    candidates.forEach(f => {
        const base = getBaseName(f.name);
        if (!groups[base]) groups[base] = [];
        groups[base].push(f);
    });

    const uniqueCandidates = Object.values(groups).map(group => {
        if (group.length === 1) return group[0];
        // Sort by Fee Descending
        group.sort((a, b) => getFee(b) - getFee(a));
        return group[0]; // Pick highest fee
    });

    // Puntuar y ordenar
    const scored = uniqueCandidates.map(f => ({ ...f, finalScore: calculateScore(f) }));
    return scored.sort((a, b) => b.finalScore - a.finalScore);
}

// Helper to extract "Base Name" to avoid selecting multiple classes of same fund
function getBaseName(name) {
    if (!name) return '';
    let base = name.toUpperCase();

    // Remove common suffixes/prefixes
    const markers = [
        ' CLASS', ' CL ', ' ACC', ' INC', ' DIST', ' EUR', ' USD', ' HEDGED',
        ' (EUR)', ' (USD)', ' A ', ' B ', ' C ', ' I ', ' Y ', ' R ',
        ' AE-KJ', ' A-ACC', ' A-DIST', ' I-ACC', ' I-DIST'
    ];

    // Truncate at first occurrence of specific technical markers if usually name is prefix
    // Or just identifying uniqueness. Simple approach: First 15 chars often unique enough? No.
    // Better: Remove "Share Class" noise.

    markers.forEach(m => {
        base = base.replace(m, '');
    });

    // Remove text inside parenthesis
    base = base.replace(/\(.*\)/g, '').trim();

    return base.substring(0, 25).trim(); // Limit length to avoid over-specificity
}

// ============================================================================
// MOTOR PRINCIPAL
// ============================================================================
export function generateSmartPortfolio(riskLevel, fundDatabase, targetCount = 5) {
    console.log(`⚡ Generando cartera laxa para Nivel ${riskLevel} con ${targetCount} activos.`);
    const profile = RISK_MATRIX[riskLevel];
    if (!profile) return [];

    const eligibleFunds = getPoolOfCandidates(riskLevel, profile, fundDatabase, targetCount);

    // Selección de Estrategia
    let strategy;
    if (riskLevel <= 3) strategy = GEO_STRATEGY.euro_focus;
    else if (riskLevel <= 5) strategy = GEO_STRATEGY.balanced;
    else if (riskLevel <= 7) strategy = GEO_STRATEGY.dynamic;
    else if (riskLevel <= 9) strategy = GEO_STRATEGY.aggressive;
    else strategy = GEO_STRATEGY.high_conviction;

    let finalPortfolio = [];
    const usedISINs = new Set();
    const usedCompanies = {}; // Track manager concentration
    // const usedBaseNames = new Set(); // Removed: deduplication is handled in pool selection

    // Calcular cupos por bucket
    const coreWeight = strategy.core?.weight || 0;
    const satWeight = strategy.satellite?.weight || 0;
    const extraWeight = strategy.extra?.weight || 0;

    // Asignación proporcional de slots (mínimo 1 si hay peso)
    let coreSlots = coreWeight > 0 ? Math.max(1, Math.round(targetCount * (coreWeight / 100))) : 0;
    let satSlots = satWeight > 0 ? Math.max(1, Math.round(targetCount * (satWeight / 100))) : 0;
    let extraSlots = extraWeight > 0 ? Math.max(1, Math.round(targetCount * (extraWeight / 100))) : 0;

    // Ajuste fino para coincidir con targetCount
    let currentSlots = coreSlots + satSlots + extraSlots;
    while (currentSlots > targetCount && coreSlots > 1) { coreSlots--; currentSlots--; }
    while (currentSlots < targetCount) { coreSlots++; currentSlots++; }

    // Función auxiliar de filtrado
    const isCandidateValid = (f) => {
        if (usedISINs.has(f.isin)) return false;

        // Diversity Rule: Max 2 funds from same company
        const company = f.std_extra?.company || 'Unknown';
        // If company is 'Unknown', allow up to 4 to avoid blocking due to bad data
        const limit = company === 'Unknown' ? 5 : 2;

        if ((usedCompanies[company] || 0) >= limit) return false;

        return true;
    };

    const fillBucket = (rule, allocation, slots) => {
        if (!rule || allocation <= 0 || slots <= 0) return;

        // Try strict region match
        let picks = eligibleFunds.filter(f => isCandidateValid(f) && f.std_region === rule.region);

        if (picks.length < slots) {
            // Fallback 1: Broad Regions (USA/Europe/Global mixed)
            picks = eligibleFunds.filter(f => isCandidateValid(f) && (f.std_region === 'Global' || f.std_region === 'USA' || f.std_region === 'Europe'));
        }

        if (picks.length < slots) {
            // Fallback 2: Any region (ignore region)
            picks = eligibleFunds.filter(f => isCandidateValid(f));
        }

        picks.slice(0, slots).forEach(f => {
            finalPortfolio.push({ ...f, weight: allocation / slots });
            usedISINs.add(f.isin);

            // Track Company
            const comp = f.std_extra?.company || 'Unknown';
            usedCompanies[comp] = (usedCompanies[comp] || 0) + 1;
        });
    };

    fillBucket(strategy.core, strategy.core?.weight || 0, coreSlots);
    if (strategy.satellite) fillBucket(strategy.satellite, strategy.satellite.weight, satSlots);
    if (strategy.extra) fillBucket(strategy.extra, strategy.extra.weight, extraSlots);

    // Garantía de mínimos (rellenar si no se encontraron suficientes)
    if (finalPortfolio.length < targetCount) {
        console.log("⚠️ Cartera incompleta. Rellenando...");
        const needed = targetCount - finalPortfolio.length;
        const filler = eligibleFunds.filter(f => isCandidateValid(f)).slice(0, needed);
        filler.forEach(f => {
            finalPortfolio.push({ ...f, weight: 0 }); // se normalizará después
            usedISINs.add(f.isin);
        });
    }

    // Normalizar pesos
    if (finalPortfolio.length > 0) {
        const currentSum = finalPortfolio.reduce((s, f) => s + (f.weight || 0), 0);

        // Si hay pesos 0 (relleno) o suma 0
        if (currentSum === 0 || finalPortfolio.some(f => f.weight === 0)) {
            finalPortfolio.forEach(f => {
                if (f.weight === 0) f.weight = 100 / finalPortfolio.length;
            });
        }

        const totalW = finalPortfolio.reduce((s, f) => s + f.weight, 0);
        finalPortfolio.forEach(f => f.weight = (f.weight / totalW) * 100);
    }

    return finalPortfolio;
}
