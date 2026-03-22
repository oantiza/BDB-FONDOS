import { Fund, PortfolioItem } from "../types";

// ============================================================================
// CONFIGURACIÓN Y TIPOS
// [PRECEDENCIA CANÓNICA]: Esta capa actúa únicamente como RÉPLICA DE PRESENTACIÓN.
// Esta es una pieza temporal en transición. Útil para UX local, pero NO es la autoridad final de negocio.
// La única fuente de verdad matemática (Límites, Fallbacks, Suitability Excluyente)
// reside en el motor Cuantitativo (optimizer_core.py) y Firestore (system_settings/risk_profiles).
// TODO: Migrar lógica de negocio al backend y dejar este archivo solo para mapeos UI.
// ============================================================================

export type AssetClass = "RV" | "RF" | "Monetario" | "Mixto" | "Alternativos" | "Otros";
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

// DEFINICIÓN DE ESTRUCTURAS POR RIESGO (HARD TARGETS - PRESENTATION SEED)
// NOTE: Esto es un estado inicial (seed) local para inicializar la UI rápidamente.
// Los perfiles canónicos oficiales residen en Firestore y machacan estos valores usando syncRiskProfilesFromDB().
export let RISK_PROFILES: Record<number, RiskProfileConfig> = {
  1: {
    name: "Preservación",
    buckets: {
      "Monetario": { min: 40, max: 80 },
      "RF": { min: 20, max: 60 },
      "Mixto": { min: 0, max: 20 },
      "RV": { min: 0, max: 10 },
      "Alternativos": { min: 0, max: 10 },
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
      "Alternativos": { min: 0, max: 10 },
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
      "Alternativos": { min: 0, max: 15 },
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
      "Alternativos": { min: 0, max: 20 },
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
      "Alternativos": { min: 0, max: 15 },
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
      "Alternativos": { min: 0, max: 10 },
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
      "Alternativos": { min: 0, max: 10 },
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
      "Alternativos": { min: 0, max: 5 },
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
      "Alternativos": { min: 0, max: 0 },
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
      "Alternativos": { min: 0, max: 0 },
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

  // As a final fallback ONLY if derived.asset_class is wildly incorrect.
  // The primary source should be derived.asset_class which is now numerically computed.
  if (s === "MONETARIO") return "Monetario";
  if (s === "RF") return "RF";
  if (s === "RV") return "RV";
  if (s === "MIXTO") return "Mixto";
  if (s === "RETORNO ABSOLUTO" || s === "ALTERNATIVOS") return "Alternativos";
  
  // Explicitly map these to 'Otros' to match backend bounds and avoid uncertainty
  if (s === "MATERIAS PRIMAS" || s === "COMMODITIES" || s === "INMOBILIARIO" || s === "REAL ESTATE" || s === "REAL_ESTATE") return "Otros";

  return "Otros";
}

function getAssetClass(f: Fund): AssetClass {
  // 1. Try to use classification_v2
  if (f.classification_v2?.asset_type) {
    const rawV2 = f.classification_v2.asset_type;
    if (rawV2 === "EQUITY") return "RV";
    if (rawV2 === "FIXED_INCOME") return "RF";
    if (rawV2 === "MONETARY") return "Monetario";
    if (rawV2 === "MIXED") return "Mixto";
    if (rawV2 === "ALTERNATIVE") return "Alternativos";
    return "Otros";
  }

  // 2. Fallback to derived.asset_class
  const raw = (f as any)?.derived?.asset_class ?? "Otros";
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
// 2) SCORING CON BIAS (PRESENTATION ONLY)
// ============================================================================

// NOTE: Este cálculo de score numérico es meramente ilustrativo para pintar un ranking estático visual.
// NO interviene en la función objetivo (Sharpe/Volatilidad) del optimizador cuantitativo real en backend.
// TODO: En el futuro el frontend debería limitarse a mostrar rankings calculados o validados por backend.
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
// SUITABILITY ENGINE (FRONTEND REPLICA - PRESENTATION ONLY)
// ============================================================================

// NOTE: Esta función duplica ciertas reglas de negocio a nivel visual (para pre-filtrar o pintar alertas en UI).
// La validación regulatoria y canónica, la que da denegación real en operativa, ocurre en optimizer_core.py.
// TODO: Debe sustituirse consumiendo las flags canónicas de exclusión que envíe el backend por fondo.
export function isFundSuitableForProfile(fund: Fund, riskProfile: number): boolean {
  const classV2 = fund.classification_v2;
  const expV2 = fund.portfolio_exposure_v2;

  if (!classV2) {
    // Fallback legacy logic
    const eqMet = Number((fund as any)?.metrics?.equity || 0);
    if (riskProfile <= 2 && eqMet > 20) return false;
    if (riskProfile <= 4 && eqMet > 50) return false;
    return true;
  }

  const assetType = classV2.asset_type;
  const assetSubtype = classV2.asset_subtype;
  const riskBucket = classV2.risk_bucket;
  const isSectorFund = classV2.is_sector_fund;
  const sectorFocus = classV2.sector_focus;
  const realEq = Number(expV2?.economic_exposure?.equity || 0);

  // 1. Very Conservative Profiles (1-2)
  if (riskProfile <= 2) {
    if (!classV2.is_suitable_low_risk) return false;
    if (riskBucket === "HIGH") return false;
    if (realEq > 30) return false;
  }

  // 2. Conservative / Moderate-Low Profiles (3-4)
  if (riskProfile <= 4) {
    if (riskBucket === "HIGH" && assetType !== "EQUITY") return false;
    if (riskProfile === 3 && realEq > 45) return false;
    if (riskProfile === 4 && realEq > 60) return false;
    if (isSectorFund) return false;
    if (
      assetSubtype === "EMERGING_MARKETS_EQUITY" ||
      assetSubtype === "HIGH_YIELD_BOND" ||
      assetType === "COMMODITIES"
    ) {
      return false;
    }
  }

  // 3. Moderate Profiles (5-7)
  if (riskProfile <= 7) {
    if (isSectorFund && sectorFocus === "HEALTHCARE" && riskProfile < 6) return false;
  }

  return true;
}

// ============================================================================
// MOTOR PRINCIPAL (LOCAL PREVIEW ONLY)
// ============================================================================

// NOTE: Este generador "SmartPortfolioLocal" NO es el Portfolio Management System (PMS) real.
// Es un mock determinista básico basado en reglas de ranking estático y equidad prefabricada para demostración UX.
// Toda la optimización probabilística (Markowitz real, Black-Litterman, restricciones topológicas) corre en backend.
export function generateSmartPortfolioLocal(
  riskLevel: number,
  allFunds: Fund[],
  targetNumFunds: number = 8
): PortfolioItem[] {


  const profile = RISK_PROFILES[riskLevel] || RISK_PROFILES[5];

  // 1. Clasificar universo en buckets
  const universe: Record<AssetClass, Fund[]> = {
    "RV": [], "RF": [], "Monetario": [], "Mixto": [], "Alternativos": [], "Otros": []
  };

  let validCandidates = 0;

  allFunds.forEach(f => {
    // FILTRO PERMISIVO CALIDAD DE DATOS
    const dq = (f as any)?.data_quality ?? {};
    const isExplicitlyBad =
      dq.has_history === false ||
      (f as any)?.metrics_invalid === true ||
      dq.history_ok === false;

    if (isExplicitlyBad) return;

    // RESTRICCIÓN DE SUITABILITY (Backend Replica)
    if (!isFundSuitableForProfile(f, riskLevel)) {
      return;
    }

    validCandidates++;
    const type = getAssetClass(f);
    universe[type].push(f);
  });



  // 2. Definir Targets (% del portfolio)
  let targetPcts: Record<AssetClass, number> = {
    "RV": 0, "RF": 0, "Monetario": 0, "Mixto": 0, "Alternativos": 0, "Otros": 0
  };

  let totalScore = 0;
  (Object.keys(targetPcts) as AssetClass[]).forEach(cls => {
    // Definimos profile y obtenemos limits asegurando que no explote
    const limits = profile?.buckets?.[cls] || { min: 0, max: 0 };
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
    "RV": 0, "RF": 0, "Monetario": 0, "Mixto": 0, "Alternativos": 0, "Otros": 0
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

  // FALLBACK CRÍTICO "Graceful Degradation":
  // Si la cartera está vacía o incompleta tras llenar buckets,
  // rellenamos con los mejores fondos del universo VALIDADO.
  // NUNCA ignorar los controles de calidad (data_quality.history_ok).
  if (portfolio.length < targetNumFunds) {
    console.warn(`[SmartEngine] Only got ${portfolio.length} funds from buckets. Filling gaps using best score from Valid Universe.`);

    // ONLY use the validated `universe`, sorted by score
    const validGlobalCandidates = Object.values(universe).flat()
      .map(f => ({ f, score: calculateScore(f, profile.bias) }))
      .sort((a, b) => b.score - a.score);

    for (const item of validGlobalCandidates) {
      if (portfolio.length >= targetNumFunds) break;
      const baseName = getBaseName(item.f.name);
      if (!usedISINs.has(item.f.isin) && !usedNames.has(baseName)) {
        portfolio.push({ ...item.f, weight: 0 });
        usedISINs.add(item.f.isin);
        usedNames.add(baseName);
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
        if (fundsInClass > 0 && targetPcts[cls] > 0) {
          item.weight = targetPcts[cls] / fundsInClass;
        } else {
          // Fondo inyectado por el fallback Graceful Degradation:
          // Su clase original (ej: Renta Fija) pedía 0% para este perfil de riesgo,
          // pero lo hemos añadido porque faltaban fondos de la requerida (ej: RV).
          // Le asignamos un peso básico de la tarta para no devolvérselo con 0% al usuario.
          item.weight = 100 / Math.max(1, targetNumFunds);
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
  // ADVERTENCIA DE PORTFOLIO REDUCIDO
  // =======================
  if (portfolio.length < targetNumFunds) {
    console.warn(`[SmartEngine] ALERT: Could not reach target of ${targetNumFunds} funds. Universe of valid funds is too small. Returning ${portfolio.length} high-quality funds instead.`);
    // We intentionally DO NOT force add bad quality funds from `allFunds`.
    // Returning a slightly smaller portfolio is mathematically and financially safer.
  }

  return portfolio;
}

// NOTE: Esta es la función crítica que subordina el estado local (seed) sustituyéndolo por
// los perfiles descargados desde la fuente de verdad (Firestore).
export function syncRiskProfilesFromDB(dbProfiles: any) {
  if (dbProfiles && Object.keys(dbProfiles).length > 0) {
    Object.keys(dbProfiles).forEach(riskStr => {
      const riskLevel = Number(riskStr);
      if (RISK_PROFILES[riskLevel]) {
        const backendProfile = dbProfiles[riskLevel];
        const newBuckets: Record<string, BucketConfig> = {};
        for (const cls in backendProfile) {
          const arr = backendProfile[cls];
          // Canonical mapping: Other -> Otros, and handle both Spanish and English versions for alternatives
          let mappedCls = cls;
          if (cls === 'Other' || cls === 'Otros') mappedCls = 'Otros';
          else if (cls === 'Retorno Absoluto' || cls === 'Alternativos' || cls === 'Alternative') mappedCls = 'Alternativos';
          
          if (Array.isArray(arr) && arr.length >= 2) {
            newBuckets[mappedCls] = { min: arr[0] * 100, max: arr[1] * 100 };
          }
        }
        RISK_PROFILES[riskLevel].buckets = newBuckets as any;
      }
    });
    console.log("🛡️ [RulesEngine] Perfiles de riesgo sincronizados y adaptados desde BD.");
  }
}
