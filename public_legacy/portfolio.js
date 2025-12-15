import { fundDatabase } from './store.js';

// ============================================================================
// FASE 2: MATRIZ MAESTRA (AJUSTADA)
// Nota: Hemos subido los techos de volatilidad para evitar cuellos de botella
// ============================================================================
const RISK_MATRIX = {
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
function calculateScore(fund) {
    const sharpe = fund.std_perf?.sharpe || 0;
    const alpha = fund.std_perf?.alpha || 0;
    const vol = fund.std_perf?.volatility || 0.15; 
    
    // Penalización por volatilidad alta en el score (clave para perfiles bajos)
    const safetyScore = Math.max(0, (0.20 - vol) * 200); 
    
    return (sharpe * 40) + (alpha * 20) + Math.min(safetyScore, 40);
}

// ============================================================================
//⚠️ LÓGICA DE SELECCIÓN INTELIGENTE (NUEVO)
// ============================================================================
function getPoolOfCandidates(riskLevel, profile) {
    // INTENTO 1: Filtro Estricto (Lo ideal)
    let candidates = fundDatabase.filter(f => {
        return profile.allowed.includes(f.std_type) && f.std_perf.volatility <= profile.maxVol;
    });

    // INTENTO 2: Expansión de Volatilidad (Si hay menos de 5 fondos)
    if (candidates.length < 5) {
        console.log(`⚠️ Pool estricto pequeño (${candidates.length}). Relajando volatilidad...`);
        candidates = fundDatabase.filter(f => {
            // Permitimos un 50% más de volatilidad o hasta 4% mínimo absoluto
            const relaxedVol = Math.max(profile.maxVol * 1.5, 0.04);
            return profile.allowed.includes(f.std_type) && f.std_perf.volatility <= relaxedVol;
        });
    }

    // INTENTO 3: Expansión de Categoría (Solo para perfiles bajos)
    if (candidates.length < 5 && riskLevel <= 4) {
        console.log(`⚠️ Pool sigue pequeño. Incluyendo Mixtos/RF Globales seguros.`);
        candidates = fundDatabase.filter(f => {
            // Aceptamos cualquier cosa que sea segura (vol < 6%), independientemente del tipo oficial
            const safeVol = 0.06; 
            const isSafe = f.std_perf.volatility <= safeVol;
            // Evitar meter RV pura en perfil 1 o 2 a menos que sea bajísima volatilidad
            const isNotRiskyEquity = f.std_type !== 'RV' || f.std_perf.volatility < 0.04;
            return isSafe && isNotRiskyEquity;
        });
    }

    // Puntuar y ordenar
    candidates.forEach(f => f.finalScore = calculateScore(f));
    return candidates.sort((a, b) => b.finalScore - a.finalScore);
}

// ============================================================================
// MOTOR PRINCIPAL
// ============================================================================
export function generateSmartPortfolio(riskLevel) {
    console.log(`⚡ Generando cartera laxa para Nivel ${riskLevel}`);
    const profile = RISK_MATRIX[riskLevel];
    if(!profile) return [];

    // 1. OBTENER POOL DE CANDIDATOS (Con la lógica de expansión)
    const eligibleFunds = getPoolOfCandidates(riskLevel, profile);
    
    // Selección de Estrategia
    let strategy;
    if (riskLevel <= 3) strategy = GEO_STRATEGY.euro_focus;
    else if (riskLevel <= 5) strategy = GEO_STRATEGY.balanced;
    else if (riskLevel <= 7) strategy = GEO_STRATEGY.dynamic;
    else if (riskLevel <= 9) strategy = GEO_STRATEGY.aggressive;
    else strategy = GEO_STRATEGY.high_conviction;

    let finalPortfolio = [];
    const usedISINs = new Set();

    // Helper de llenado
    const fillBucket = (rule, allocation) => {
        if (!rule || allocation <= 0) return;

        // Filtro cascada: 1. Región exacta -> 2. Global -> 3. Cualquiera
        let picks = eligibleFunds.filter(f => !usedISINs.has(f.isin) && f.std_region === rule.region);
        
        if (picks.length === 0) {
            // Fallback a Global si falta región específica
            picks = eligibleFunds.filter(f => !usedISINs.has(f.isin) && (f.std_region === 'Global' || f.std_region === 'USA' || f.std_region === 'Europe'));
        }
        
        if (picks.length === 0) {
             // Fallback total: Dame lo mejor que tengas disponible que encaje en riesgo
             picks = eligibleFunds.filter(f => !usedISINs.has(f.isin));
        }

        // Seleccionar Top 2 o 3
        const count = allocation > 40 ? 3 : 2;
        picks.slice(0, count).forEach(f => {
            finalPortfolio.push({ ...f, weight: allocation / count }); // Peso temporal
            usedISINs.add(f.isin);
        });
    };

    // Ejecutar
    fillBucket(strategy.core, strategy.core.weight);
    if (strategy.satellite) fillBucket(strategy.satellite, strategy.satellite.weight);
    if (strategy.extra) fillBucket(strategy.extra, strategy.extra.weight);

    // 2. GARANTÍA DE MÍNIMOS (Si salieron menos de 4 fondos)
    if (finalPortfolio.length < 4) {
        console.log("⚠️ Cartera muy concentrada. Rellenando hasta 4 activos para diversificar.");
        const needed = 4 - finalPortfolio.length;
        const filler = eligibleFunds.filter(f => !usedISINs.has(f.isin)).slice(0, needed);
        filler.forEach(f => {
            finalPortfolio.push({ ...f, weight: 0 }); // Peso 0 temporal, se recalcula abajo
            usedISINs.add(f.isin);
        });
    }

    // 3. RECALCULAR PESOS A 100%
    // Asignamos pesos iguales o mantenemos la proporción estratégica si es posible
    if (finalPortfolio.length > 0) {
        // Opción simple y robusta: Equi-ponderar si hubo mucho relleno, 
        // o normalizar lo existente. Aquí normalizamos lo existente.
        const currentSum = finalPortfolio.reduce((s,f) => s + (f.weight || 0), 0);
        
        if (currentSum === 0) {
            // Si todos tienen peso 0 (relleno puro)
            const w = 100 / finalPortfolio.length;
            finalPortfolio.forEach(f => f.weight = w);
        } else {
            // Si hay pesos definidos, rellenamos el hueco
            finalPortfolio.forEach(f => {
                if(f.weight === 0) f.weight = 10; // Dar peso base a los rellenos
            });
            // Renormalizar final
            const totalW = finalPortfolio.reduce((s, f) => s + f.weight, 0);
            finalPortfolio.forEach(f => f.weight = (f.weight / totalW) * 100);
        }
    }

    return finalPortfolio;
}