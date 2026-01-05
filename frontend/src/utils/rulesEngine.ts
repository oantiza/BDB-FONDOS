// rulesEngine.ts - Lógica de cliente para selección de fondos y generación de carteras
import { Fund, PortfolioItem } from '../types';

export interface RiskProfile {
    name: string;
    maxVol: number;
    maxEquity: number;
    allowed: string[];
    style: string;
}

// ============================================================================
// MATRIZ DE RIESGO (ESTRICTA)
// ============================================================================
export const RISK_MATRIX: Record<number, RiskProfile> = {
    1: {
        name: "Preservación",
        maxVol: 0.035,
        maxEquity: 5, // Límite DURO: Máx 5% Bolsa
        allowed: ['Monetario', 'RF'],
        style: 'Defensive_Yield'
    },
    2: {
        name: "Muy Conservador",
        maxVol: 0.06,
        maxEquity: 15, // Límite DURO: Máx 15% Bolsa
        allowed: ['RF', 'Monetario', 'Mixto'],
        style: 'Conservative_Income'
    },
    3: {
        name: "Conservador",
        maxVol: 0.08,
        maxEquity: 25,
        allowed: ['RF', 'Mixto'],
        style: 'Balanced_Defensive'
    },
    4: {
        name: "Mod. Defensivo",
        maxVol: 0.10,
        maxEquity: 40,
        allowed: ['RF', 'Mixto', 'Retorno Absoluto'],
        style: 'Balanced'
    },
    5: {
        name: "Equilibrado",
        maxVol: 0.12,
        maxEquity: 60,
        allowed: ['Mixto', 'RV', 'RF'],
        style: 'Balanced_Growth'
    },
    6: {
        name: "Crecimiento Mod.",
        maxVol: 0.15,
        maxEquity: 75,
        allowed: ['RV', 'Mixto'],
        style: 'Growth_Conservative'
    },
    7: {
        name: "Dinámico",
        maxVol: 0.18,
        maxEquity: 90,
        allowed: ['RV'],
        style: 'Growth'
    },
    8: {
        name: "Crecimiento",
        maxVol: 0.22,
        maxEquity: 100,
        allowed: ['RV'],
        style: 'Growth_Aggressive'
    },
    9: {
        name: "Agresivo",
        maxVol: 0.28,
        maxEquity: 100,
        allowed: ['RV'],
        style: 'High_Beta'
    },
    10: {
        name: "High Conviction",
        maxVol: 1.00,
        maxEquity: 100,
        allowed: ['RV', 'Mixto'],
        style: 'Pure_Alpha'
    }
};

interface GeoAllocation {
    region: string;
    weight: number;
    style?: string;
    alt?: string;
}

interface Strategy {
    core: GeoAllocation;
    satellite: GeoAllocation | null;
    extra?: GeoAllocation;
}

// ============================================================================
// ESTRATEGIA GEOGRÁFICA
// ============================================================================
const GEO_STRATEGY: Record<string, Strategy> = {
    euro_focus: { core: { region: 'Europe', weight: 100 }, satellite: null },
    balanced: { core: { region: 'Global', weight: 60, alt: 'USA' }, satellite: { region: 'Europe', weight: 40 } },
    dynamic: { core: { region: 'USA', weight: 70, alt: 'Global' }, satellite: { region: 'Europe', weight: 30 } },
    aggressive: { core: { region: 'USA', weight: 50 }, satellite: { region: 'Emerging', weight: 30 }, extra: { region: 'Europe', weight: 20 } },
    high_conviction: { core: { region: 'USA', style: 'Growth', weight: 50 }, satellite: { region: 'Any', style: 'Sector', weight: 50 } }
};

// ============================================================================
// UNIFIED SCORING
// ============================================================================
export function calculateScore(fund: Fund, targetVol: number = 0.12): number {
    const sharpe = fund.std_perf?.sharpe || 0;
    const alpha = fund.std_perf?.alpha || 0;
    const vol = fund.std_perf?.volatility || 0.15;
    const history = fund.std_extra?.yearsHistory || 0;
    const cagr3y = fund.std_perf?.cagr3y || 0;
    const cagr6m = fund.std_perf?.cagr6m || cagr3y;

    const sharpeNorm = Math.max(-1, Math.min(3, sharpe));
    const sharpeScore = (sharpeNorm / 3) * 35;

    const alphaNorm = Math.max(-5, Math.min(5, alpha));
    const alphaScore = ((alphaNorm + 5) / 10) * 25;

    const safetyScore = Math.max(0, ((targetVol - vol) / targetVol) * 100) * 0.20;

    let momentumScore = 0;
    if (cagr3y !== 0) {
        const momentumRatio = cagr6m / cagr3y;
        momentumScore = Math.max(0, Math.min(1, momentumRatio)) * 10;
    }

    const qualityScore = Math.min(history / 10, 1) * 10;

    const maxDrawdown = fund.std_perf?.max_drawdown || (fund as any).perf?.max_drawdown || 0;
    let drawdownPenalty = 0;
    if (maxDrawdown > 0) {
        drawdownPenalty = Math.min(Math.abs(maxDrawdown) * 500, 50);
    }

    const sortino = fund.std_perf?.sortino_ratio || (fund as any).perf?.sortino_ratio || 0;
    let sortinoBonus = 0;
    if (sortino > 0) {
        const sortinoNorm = Math.max(0, Math.min(4, sortino));
        sortinoBonus = (sortinoNorm / 4) * 5;
    }

    return sharpeScore + alphaScore + safetyScore + momentumScore + qualityScore - drawdownPenalty + sortinoBonus;
}

function getFee(f: Fund): number {
    return (f.costs?.retrocession || f.costs?.management_fee || (f as any).profile?.ongoing_charge || 0);
}

// ============================================================================
// VALIDACIÓN DE SEGURIDAD (HARD CAPS - VERSIÓN ESTRICTA)
// ============================================================================
export function isFundSafeForProfile(fund: Fund, riskLevel: number): boolean {
    const profile = RISK_MATRIX[riskLevel];
    if (!profile) return true;

    // 1. FILTRO DE TIPO: Prohibir RV en perfiles de preservación
    if (riskLevel <= 2 && fund.std_type === 'RV') return false;

    // 2. FILTRO DE EQUITY REAL:
    const equityVal = parseFloat((fund as any).metrics?.equity || '0');

    // Tolerancia mínima para perfiles bajos
    const tolerance = riskLevel <= 3 ? 1.0 : 5.0;

    if (equityVal > (profile.maxEquity + tolerance)) {
        return false;
    }

    return true;
}

// ============================================================================
// SELECCIÓN DE CANDIDATOS
// ============================================================================
function getPoolOfCandidates(riskLevel: number, profile: RiskProfile, fundDatabase: Fund[], minCount: number = 5): (Fund & { finalScore: number })[] {
    // 1. FILTRO ESTRICTO
    let candidates = fundDatabase.filter(f => {
        const typeAllowed = profile.allowed.includes(f.std_type || '');
        // Volatilidad con ligero margen, pero equity innegociable
        const volAllowed = (f.std_perf?.volatility || 1) <= (profile.maxVol * 1.2);
        const equitySafe = isFundSafeForProfile(f, riskLevel);

        return typeAllowed && volAllowed && equitySafe;
    });

    // 2. INTENTO DE EXPANSIÓN (SOLO SI NO ES PERFIL BAJO)
    // Para perfiles 1 y 2, preferimos devolver pocos fondos seguros que rellenar con riesgo
    if (candidates.length < minCount && riskLevel > 2) {
        candidates = fundDatabase.filter(f => {
            const relaxedVol = Math.max(profile.maxVol * 1.5, 0.05);
            const typeAllowed = profile.allowed.includes(f.std_type || '');
            const equitySafe = isFundSafeForProfile(f, riskLevel); // Equity SIEMPRE estricto

            return typeAllowed && equitySafe && (f.std_perf?.volatility || 1) <= relaxedVol;
        });
    }

    // --- DEDUPLICACIÓN ---
    const groups: Record<string, Fund[]> = {};
    candidates.forEach(f => {
        const base = getBaseName(f.name);
        if (!groups[base]) groups[base] = [];
        groups[base].push(f);
    });

    const uniqueCandidates = Object.values(groups).map((group) => {
        if (group.length === 1) return group[0];
        group.sort((a, b) => getFee(b) - getFee(a));
        return group[0];
    });

    const scored = uniqueCandidates.map(f => ({ ...f, finalScore: calculateScore(f, profile.maxVol) }));
    return scored.sort((a, b) => b.finalScore - a.finalScore);
}

function getBaseName(name: string): string {
    if (!name) return '';
    let base = name.toUpperCase();
    const markers = [
        ' CLASS', ' CL ', ' ACC', ' INC', ' DIST', ' EUR', ' USD', ' HEDGED',
        ' (EUR)', ' (USD)', ' A ', ' B ', ' C ', ' I ', ' Y ', ' R ',
        ' AE-KJ', ' A-ACC', ' A-DIST', ' I-ACC', ' I-DIST'
    ];
    markers.forEach(m => { base = base.replace(m, ''); });
    base = base.replace(/\(.*\)/g, '').trim();
    return base.substring(0, 25).trim();
}

// ============================================================================
// MOTOR PRINCIPAL
// ============================================================================
export function generateSmartPortfolio(riskLevel: number, fundDatabase: Fund[], targetCount: number = 5): PortfolioItem[] {
    const profile = RISK_MATRIX[riskLevel];
    if (!profile) return [];

    const eligibleFunds = getPoolOfCandidates(riskLevel, profile, fundDatabase, targetCount);

    let strategy: Strategy;
    if (riskLevel <= 3) strategy = GEO_STRATEGY.euro_focus;
    else if (riskLevel <= 5) strategy = GEO_STRATEGY.balanced;
    else if (riskLevel <= 7) strategy = GEO_STRATEGY.dynamic;
    else if (riskLevel <= 9) strategy = GEO_STRATEGY.aggressive;
    else strategy = GEO_STRATEGY.high_conviction;

    const finalPortfolio: PortfolioItem[] = [];
    const usedISINs = new Set<string>();
    const usedCompanies: Record<string, number> = {};

    const coreWeight = strategy.core?.weight || 0;
    const satWeight = strategy.satellite?.weight || 0;
    const extraWeight = strategy.extra?.weight || 0;

    let coreSlots = coreWeight > 0 ? Math.max(1, Math.round(targetCount * (coreWeight / 100))) : 0;
    const satSlots = satWeight > 0 ? Math.max(1, Math.round(targetCount * (satWeight / 100))) : 0;
    const extraSlots = extraWeight > 0 ? Math.max(1, Math.round(targetCount * (extraWeight / 100))) : 0;

    let currentSlots = coreSlots + satSlots + extraSlots;
    while (currentSlots > targetCount && coreSlots > 1) { coreSlots--; currentSlots--; }
    while (currentSlots < targetCount) { coreSlots++; currentSlots++; }

    const isCandidateValid = (f: Fund) => {
        if (usedISINs.has(f.isin)) return false;
        const company = f.std_extra?.company || 'Unknown';
        const limit = company === 'Unknown' ? 5 : 2;
        if ((usedCompanies[company] || 0) >= limit) return false;
        return true;
    };

    const fillBucket = (rule: GeoAllocation, allocation: number, slots: number) => {
        if (!rule || allocation <= 0 || slots <= 0) return;
        let picks = eligibleFunds.filter(f => isCandidateValid(f) && f.std_region === rule.region);
        if (picks.length < slots) picks = eligibleFunds.filter(f => isCandidateValid(f) && (f.std_region === 'Global' || f.std_region === 'USA' || f.std_region === 'Europe'));
        if (picks.length < slots) picks = eligibleFunds.filter(f => isCandidateValid(f));

        picks.slice(0, slots).forEach(f => {
            finalPortfolio.push({ ...f, weight: allocation / slots });
            usedISINs.add(f.isin);
            const comp = f.std_extra?.company || 'Unknown';
            usedCompanies[comp] = (usedCompanies[comp] || 0) + 1;
        });
    };

    fillBucket(strategy.core, strategy.core?.weight || 0, coreSlots);
    if (strategy.satellite) fillBucket(strategy.satellite, strategy.satellite.weight, satSlots);
    if (strategy.extra) fillBucket(strategy.extra, strategy.extra.weight, extraSlots);

    if (finalPortfolio.length < targetCount) {
        const needed = targetCount - finalPortfolio.length;
        const filler = eligibleFunds.filter(f => isCandidateValid(f)).slice(0, needed);
        filler.forEach(f => {
            finalPortfolio.push({ ...f, weight: 0 }); // Temporary 0 weight
            usedISINs.add(f.isin);
        });
    }

    if (finalPortfolio.length > 0) {
        const totalW = finalPortfolio.reduce((s, f) => s + f.weight, 0);
        if (totalW > 0) finalPortfolio.forEach(f => f.weight = (f.weight / totalW) * 100);
        else finalPortfolio.forEach(f => f.weight = 100 / finalPortfolio.length);
    }

    return finalPortfolio;
}