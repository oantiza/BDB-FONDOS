import { Fund, PortfolioItem } from "../types";

// ============================================================================
// KONFIGURACIÓN Y TIPOS
// ============================================================================

export type AssetClass = "RV" | "RF" | "Monetario" | "Mixto" | "Retorno Absoluto" | "Otros";
export type Region = "Europe" | "USA" | "Emerging" | "Global";

interface BucketConfig {
  min: number; // % minimo (0-100)
  max: number; // % maximo (0-100)
}

interface RiskProfileConfig {
  name: string;
  buckets: Record<AssetClass, BucketConfig>;
  // Preferencia de estilo para el ranking dentro del bucket
  bias: "Safety" | "Balanced" | "Growth" | "Aggressive";
}

// DEFINICIÓN DE ESTRUCTURAS POR RIESGO (HARD TARGETS)
export const RISK_PROFILES: Record<number, RiskProfileConfig> = {
  1: {
    name: "Preservación",
    buckets: {
      "Monetario": { min: 40, max: 80 },
      "RF": { min: 20, max: 60 },
      "Mixto": { min: 0, max: 20 },
      "RV": { min: 0, max: 10 },
      "Retorno Absoluto": { min: 0, max: 10 },
      "Otros": { min: 0, max: 0 }
    },
    bias: "Safety"
  },
  2: {
    name: "Muy Conservador",
    buckets: {
      "Monetario": { min: 20, max: 50 },
      "RF": { min: 40, max: 70 },
      "Mixto": { min: 0, max: 20 },
      "RV": { min: 0, max: 15 },
      "Retorno Absoluto": { min: 0, max: 10 },
      "Otros": { min: 0, max: 0 }
    },
    bias: "Safety"
  },
  3: {
    name: "Conservador",
    buckets: {
      "Monetario": { min: 10, max: 30 },
      "RF": { min: 40, max: 70 },
      "Mixto": { min: 10, max: 30 },
      "RV": { min: 10, max: 25 },
      "Retorno Absoluto": { min: 0, max: 15 },
      "Otros": { min: 0, max: 5 }
    },
    bias: "Balanced"
  },
  4: {
    name: "Moderado Defensivo",
    buckets: {
      "Monetario": { min: 0, max: 20 },
      "RF": { min: 30, max: 60 },
      "Mixto": { min: 20, max: 40 },
      "RV": { min: 20, max: 40 },
      "Retorno Absoluto": { min: 0, max: 20 },
      "Otros": { min: 0, max: 10 }
    },
    bias: "Balanced"
  },
  5: {
    name: "Equilibrado",
    buckets: {
      "Monetario": { min: 0, max: 10 },
      "RF": { min: 20, max: 40 },
      "Mixto": { min: 20, max: 50 },
      "RV": { min: 40, max: 60 },
      "Retorno Absoluto": { min: 0, max: 15 },
      "Otros": { min: 0, max: 10 }
    },
    bias: "Balanced"
  },
  6: {
    name: "Crecimiento Moderado",
    buckets: {
      "Monetario": { min: 0, max: 10 },
      "RF": { min: 10, max: 30 },
      "Mixto": { min: 10, max: 40 },
      "RV": { min: 50, max: 75 },
      "Retorno Absoluto": { min: 0, max: 10 },
      "Otros": { min: 0, max: 10 }
    },
    bias: "Growth"
  },
  7: {
    name: "Dinámico",
    buckets: {
      "Monetario": { min: 0, max: 5 },
      "RF": { min: 0, max: 20 },
      "Mixto": { min: 0, max: 20 },
      "RV": { min: 70, max: 90 },
      "Retorno Absoluto": { min: 0, max: 10 },
      "Otros": { min: 0, max: 10 }
    },
    bias: "Growth"
  },
  8: {
    name: "Crecimiento",
    buckets: {
      "Monetario": { min: 0, max: 0 },
      "RF": { min: 0, max: 10 },
      "Mixto": { min: 0, max: 10 },
      "RV": { min: 85, max: 100 },
      "Retorno Absoluto": { min: 0, max: 5 },
      "Otros": { min: 0, max: 10 }
    },
    bias: "Aggressive"
  },
  9: {
    name: "Agresivo",
    buckets: {
      "Monetario": { min: 0, max: 0 },
      "RF": { min: 0, max: 5 },
      "Mixto": { min: 0, max: 5 },
      "RV": { min: 95, max: 100 },
      "Retorno Absoluto": { min: 0, max: 0 },
      "Otros": { min: 0, max: 5 }
    },
    bias: "Aggressive"
  },
  10: {
    name: "High Conviction",
    buckets: {
      "Monetario": { min: 0, max: 0 },
      "RF": { min: 0, max: 0 },
      "Mixto": { min: 0, max: 0 },
      "RV": { min: 100, max: 100 },
      "Retorno Absoluto": { min: 0, max: 0 },
      "Otros": { min: 0, max: 0 }
    },
    bias: "Aggressive"
  }
};

// ============================================================================
// 1) NORMALIZACIÓN ROBUSTA
// ============================================================================

function normalizeAssetClass(raw: any): AssetClass {
  if (!raw || typeof raw !== "string") return "Otros";
  const s = raw.trim().toUpperCase();

  if (s.includes("MONETARIO") || s.includes("CASH") || s.includes("LIQUIDEZ") || s.includes("MONEY MARKET")) return "Monetario";
  if (s.includes("FIJA") || s.includes("FIXED") || s.includes("BOND") || s.includes("CREDIT") || s.includes("DEBT")) return "RF";
  if (s.includes("VARIABLE") || s.includes("EQUITY") || s.includes("STOCK") || s.includes("ACCION") || s.includes("RV")) return "RV";
  if (s.includes("MIXTO") || s.includes("MIXED") || s.includes("MULTI") || s.includes("BALANCED") || s.includes("ALLOCATION")) return "Mixto";
  if (s.includes("ABSOLUTO") || s.includes("HEDGE") || s.includes("ALTERNATIVE") || s.includes("LONG/SHORT")) return "Retorno Absoluto";

  return "Otros";
}

function getAssetClass(f: Fund): AssetClass {
  const raw = (f as any)?.derived?.asset_class ??
    (f as any)?.asset_class ??
    (f as any)?.assetClass ??
    (f as any)?.std_type ??
    (f as any)?.type ?? "";
  return normalizeAssetClass(raw);
}

function getBaseName(name: string): string {
  if (!name) return "";
  let base = name.toUpperCase();
  base = base.replace(/\(.*\)/g, "").trim();
  base = base.replace(/\s+(CLASS|CL)\s+[A-Z0-9]+$/i, "");
  base = base.replace(/\s+(ACC|INC|DIST)\b/i, "");
  base = base.replace(/\s+(EUR|USD)\b/i, "");
  base = base.replace(/\s+HEDGED\b/i, "");
  return base.trim().substring(0, 30);
}

// ============================================================================
// 2) SCORING CON BIAS
// ============================================================================

export function calculateScore(fund: Fund, riskOrBias: number | string): number {
  let bias = "Balanced";
  if (typeof riskOrBias === 'number') {
    const profile = RISK_PROFILES[riskOrBias] || RISK_PROFILES[5];
    bias = profile.bias;
  } else {
    bias = riskOrBias as string;
  }

  const perf = (fund as any)?.std_perf || {};
  const sharpe = Number(perf.sharpe ?? 0);
  const vol = Number(perf.volatility ?? 0.10);
  const cagr = Number(perf.cagr3y ?? perf.return ?? 0);
  // Coste implicito
  const cost = Number((fund as any)?.costs?.ter ?? 1.5);

  let score = 0;

  // Base score: Sharpe + Momentum (Coste penalization removed)
  score += (Math.max(0, Math.min(3, sharpe)) * 10);
  score += (Math.max(-0.2, Math.min(0.4, cagr)) * 100);
  // score -= (cost * 10); // Removed per user request

  // Ajustes por BIAS
  if (bias === "Safety") {
    // Penaliza volatilidad fuertemente
    if (vol > 0.05) score -= (vol - 0.05) * 200;
    // Premia consistencia (drawdown bajo si hay dato)
  } else if (bias === "Growth" || bias === "Aggressive") {
    // Premia retorno puro y momentum, tolera volatilidad
    score += (cagr * 50);
    // Si es agresivo, ignoramos penalización de vol baja, pero penalizamos vol EXTREMA (>40%)
    if (vol > 0.40) score -= 50;
  }

  return score;
}

// ============================================================================
// MOTOR PRINCIPAL
// ============================================================================

export function generateSmartPortfolioLocal(
  riskLevel: number,
  allFunds: Fund[],
  targetNumFunds: number = 8
): PortfolioItem[] {


  const profile = RISK_PROFILES[riskLevel] || RISK_PROFILES[5];

  // 1. Clasificar universo en buckets
  const universe: Record<AssetClass, Fund[]> = {
    "RV": [], "RF": [], "Monetario": [], "Mixto": [], "Retorno Absoluto": [], "Otros": []
  };

  let validCandidates = 0;

  allFunds.forEach(f => {
    // FILTRO PERMISIVO
    // Solo excluimos si los flags son EXPLÍCITAMENTE negativos.
    // Si son undefined/null, el fondo PASA.
    const dq = (f as any)?.data_quality ?? {};

    // checks explicit failing conditions
    const isExplicitlyBad =
      dq.has_history === false ||
      (f as any)?.metrics_invalid === true ||
      dq.history_ok === false;

    if (isExplicitlyBad) return;

    validCandidates++;
    const type = getAssetClass(f);
    universe[type].push(f);
  });



  // 2. Definir Targets (% del portfolio)
  let targetPcts: Record<AssetClass, number> = {
    "RV": 0, "RF": 0, "Monetario": 0, "Mixto": 0, "Retorno Absoluto": 0, "Otros": 0
  };

  let totalScore = 0;
  (Object.keys(targetPcts) as AssetClass[]).forEach(cls => {
    const limits = profile.buckets[cls];
    let target = (limits.min + limits.max) / 2;
    targetPcts[cls] = target;
    totalScore += target;
  });

  if (totalScore === 0) targetPcts["RF"] = 100;
  else {
    (Object.keys(targetPcts) as AssetClass[]).forEach(cls => {
      targetPcts[cls] = (targetPcts[cls] / totalScore) * 100;
    });
  }

  // 3. Asignar Slots
  let slots: Record<AssetClass, number> = {
    "RV": 0, "RF": 0, "Monetario": 0, "Mixto": 0, "Retorno Absoluto": 0, "Otros": 0
  };
  let assignedSlots = 0;
  (Object.keys(slots) as AssetClass[]).forEach(cls => {
    const w = targetPcts[cls];
    let n = Math.round((w / 100) * targetNumFunds);
    if (w > 10 && n === 0) n = 1;
    slots[cls] = n;
    assignedSlots += n;
  });

  if (assignedSlots !== targetNumFunds) {
    let diff = targetNumFunds - assignedSlots;
    const dominant = (Object.keys(targetPcts) as AssetClass[]).reduce((a, b) => targetPcts[a] > targetPcts[b] ? a : b);
    slots[dominant] += diff;
    if (slots[dominant] < 0) slots[dominant] = 0;
  }

  // 4. Selección de Fondos
  const portfolio: PortfolioItem[] = [];
  const usedISINs = new Set<string>();
  const usedNames = new Set<string>();

  (Object.keys(slots) as AssetClass[]).forEach(cls => {
    const numSlots = slots[cls];
    if (numSlots <= 0) return;

    let candidates = universe[cls];
    candidates = candidates.map(f => ({ f, score: calculateScore(f, profile.bias) }))
      .sort((a, b) => b.score - a.score)
      .map(wrapper => wrapper.f);

    let selectedCount = 0;
    for (const fund of candidates) {
      if (selectedCount >= numSlots) break;
      const baseName = getBaseName(fund.name);
      if (!usedISINs.has(fund.isin) && !usedNames.has(baseName)) {
        portfolio.push({ ...fund, weight: 0 });
        usedISINs.add(fund.isin);
        usedNames.add(baseName);
        selectedCount++;
      }
    }
  });

  // FALLBACK CRÍTICO: Si la cartera está vacía pero había candidatos válidos
  // Rellenamos con los mejores fondos globales (sin mirar buckets)
  if (portfolio.length === 0) {
    console.warn("[SmartEngine] Empty portfolio after bucket fill. Triggering FALLBACK to top scored funds.");

    // First try: Valid candidates only (ignoring buckets)
    let allCandidates = Object.values(universe).flat()
      .map(f => ({ f, score: calculateScore(f, profile.bias) }))
      .sort((a, b) => b.score - a.score);

    // Second try: Panic Universe (Everything! Ignoring data quality)
    if (allCandidates.length === 0) {
      console.error("[SmartEngine] PANIC: No valid candidates found. Using raw universe (ignoring quality flags).");
      allCandidates = allFunds
        .map(f => ({ f, score: calculateScore(f, profile.bias) }))
        .sort((a, b) => b.score - a.score);
    }

    for (const item of allCandidates) {
      if (portfolio.length >= targetNumFunds) break;
      if (!usedISINs.has(item.f.isin)) {
        portfolio.push({ ...item.f, weight: 0 });
        usedISINs.add(item.f.isin);
      }
    }
  }

  // 5. Pesos Finales Equal-Weight per bucket (o simple si es fallback)
  if (portfolio.length > 0) {
    // Si se generó por buckets
    let bucketBased = false;
    portfolio.forEach(item => {
      const cls = getAssetClass(item);
      if (targetPcts[cls] > 0) bucketBased = true;
    });

    if (bucketBased) {
      portfolio.forEach(item => {
        const cls = getAssetClass(item);
        const fundsInClass = portfolio.filter(p => getAssetClass(p) === cls).length;
        if (fundsInClass > 0) {
          item.weight = targetPcts[cls] / fundsInClass;
        }
      });
    } else {
      // Fallback simple allocation
      const w = 100 / portfolio.length;
      portfolio.forEach(p => p.weight = w);
    }
  }

  // 6. Normalización Final
  const finalTotal = portfolio.reduce((sum, p) => sum + p.weight, 0);
  if (finalTotal > 0) {
    portfolio.forEach(p => p.weight = (p.weight / finalTotal) * 100);
  }
  portfolio.forEach(p => p.weight = Math.round(p.weight * 100) / 100);

  // Verificación Integrity
  if (riskLevel >= 9) {
    const rvWeight = portfolio.filter(p => getAssetClass(p) === "RV").reduce((s, p) => s + p.weight, 0);
    if (rvWeight < 90) {
      console.warn(`[SmartEngine] Risk ${riskLevel} got low equity (${rvWeight}%). Universe might be short on RV.`);
    }
  }

  // =======================
  // HARD GUARANTEE: Always return exactly targetNumFunds if universe is sufficient
  // =======================
  if (portfolio.length < targetNumFunds) {
    const globalCandidates = Object.values(universe)
      .flat()
      .map(f => ({ f, score: calculateScore(f, profile.bias) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.f);

    for (const f of globalCandidates) {
      if (portfolio.length >= targetNumFunds) break;
      if (!usedISINs.has(f.isin)) {
        portfolio.push({ ...f, weight: 0 });
        usedISINs.add(f.isin);
        usedNames.add(getBaseName(f.name));
      }
    }
  }

  return portfolio;
}
