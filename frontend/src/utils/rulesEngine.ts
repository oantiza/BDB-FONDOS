import { Fund, PortfolioItem } from "../types";
import {
  normalizeClassificationV2ForUI,
  normalizePortfolioExposureV2ForUI,
} from "./normalizer";

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

type RiskProfilesSource = "seed_local" | "firestore" | "backend";

const ASSET_CLASS_ORDER: AssetClass[] = ["RV", "RF", "Monetario", "Mixto", "Alternativos", "Otros"];
const PROFILE_BIAS_VALUES = new Set<RiskProfileConfig["bias"]>(["Safety", "Balanced", "Growth", "Aggressive"]);

// DEFINICIÓN DE ESTRUCTURAS POR RIESGO (PRESENTATION SEED)
// NOTE: Esto es un fallback UX local alineado con la seed del backend.
// Los perfiles canónicos oficiales residen en Firestore / backend y tienen prioridad sobre estos valores.
export let RISK_PROFILES: Record<number, RiskProfileConfig> = {
  1: {
    name: "Preservación",
    buckets: {
      "Monetario": { min: 40, max: 80 },
      "RF": { min: 20, max: 60 },
      "Mixto": { min: 0, max: 20 },
      "RV": { min: 0, max: 10 },
      "Alternativos": { min: 0, max: 10 },
      "Otros": { min: 0, max: 10 }
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
      "Otros": { min: 0, max: 10 }
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
      "Otros": { min: 0, max: 20 }
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
      "Otros": { min: 0, max: 30 }
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
      "Alternativos": { min: 0, max: 20 },
      "Otros": { min: 0, max: 25 }
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
      "Alternativos": { min: 0, max: 20 },
      "Otros": { min: 0, max: 20 }
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
      "Alternativos": { min: 0, max: 15 },
      "Otros": { min: 0, max: 20 }
    },
    bias: "Growth"
  },
  8: {
    name: "Crecimiento",
    buckets: {
      "Monetario": { min: 0, max: 5 },
      "RF": { min: 0, max: 5 },
      "Mixto": { min: 0, max: 10 },
      "RV": { min: 85, max: 100 },
      "Alternativos": { min: 0, max: 10 },
      "Otros": { min: 0, max: 15 }
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
      "Alternativos": { min: 0, max: 5 },
      "Otros": { min: 0, max: 5 }
    },
    bias: "Aggressive"
  },
  10: {
    name: "High Conviction",
    buckets: {
      "Monetario": { min: 0, max: 5 },
      "RF": { min: 0, max: 5 },
      "Mixto": { min: 0, max: 5 },
      "RV": { min: 95, max: 100 },
      "Alternativos": { min: 0, max: 5 },
      "Otros": { min: 0, max: 0 }
    },
    bias: "Aggressive"
  }
};

// ============================================================================
// 1) NORMALIZACIÓN ROBUSTA
// ============================================================================

function cloneRiskProfiles(input: Record<number, RiskProfileConfig>): Record<number, RiskProfileConfig> {
  return Object.fromEntries(
    Object.entries(input).map(([key, profile]) => [
      Number(key),
      {
        ...profile,
        buckets: Object.fromEntries(
          ASSET_CLASS_ORDER.map((assetClass) => [assetClass, { ...profile.buckets[assetClass] }])
        ) as Record<AssetClass, BucketConfig>,
      },
    ])
  ) as Record<number, RiskProfileConfig>;
}

function normalizeBucketBound(value: any): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const pct = Math.abs(n) <= 1.5 ? n * 100 : n;
  return Math.max(0, Math.min(100, pct));
}

function normalizeBucketConfig(raw: any, fallback: BucketConfig): BucketConfig {
  let min = fallback.min;
  let max = fallback.max;

  if (Array.isArray(raw) && raw.length >= 2) {
    min = normalizeBucketBound(raw[0]) ?? min;
    max = normalizeBucketBound(raw[1]) ?? max;
  } else if (raw && typeof raw === "object") {
    min = normalizeBucketBound(raw.min) ?? min;
    max = normalizeBucketBound(raw.max) ?? max;
  }

  if (min > max) [min, max] = [max, min];
  return { min, max };
}

function normalizeRiskProfilePayload(raw: any, fallback: RiskProfileConfig): RiskProfileConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const bucketSource = raw.buckets && typeof raw.buckets === "object" ? raw.buckets : raw;
  if (!bucketSource || typeof bucketSource !== "object") return null;

  const hasKnownBucket = ASSET_CLASS_ORDER.some((assetClass) => bucketSource[assetClass] !== undefined);
  if (!hasKnownBucket) return null;

  const biasCandidate = typeof raw.bias === "string" && PROFILE_BIAS_VALUES.has(raw.bias as RiskProfileConfig["bias"])
    ? raw.bias as RiskProfileConfig["bias"]
    : fallback.bias;

  return {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : fallback.name,
    bias: biasCandidate,
    buckets: Object.fromEntries(
      ASSET_CLASS_ORDER.map((assetClass) => [
        assetClass,
        normalizeBucketConfig(bucketSource[assetClass], fallback.buckets[assetClass]),
      ])
    ) as Record<AssetClass, BucketConfig>,
  };
}

// Accepts both canonical payload shapes:
// - Firestore raw doc: { "5": { RV: [0.4, 0.6], ... } }
// - Backend callable: { "5": { buckets: { RV: { min, max }, ... } } }
function applyCanonicalRiskProfiles(
  profilesPayload: Record<number | string, any>,
  source: RiskProfilesSource,
  sourceLabel: string
): number {
  if (!profilesPayload || typeof profilesPayload !== "object") return 0;

  const nextProfiles = cloneRiskProfiles(RISK_PROFILES);
  let applied = 0;

  Object.keys(profilesPayload).forEach((key) => {
    const riskLevel = Number(key);
    const fallback = nextProfiles[riskLevel] || LOCAL_RISK_PROFILE_SEED[riskLevel];
    if (!fallback) return;

    const normalized = normalizeRiskProfilePayload(profilesPayload[key], fallback);
    if (!normalized) return;

    nextProfiles[riskLevel] = normalized;
    applied++;
  });

  if (applied > 0) {
    RISK_PROFILES = nextProfiles;
    riskProfilesSource = source;
    console.log(`🛡️ [RulesEngine] Risk profile presentation seed replaced by canonical payload from ${sourceLabel}.`);
  }

  return applied;
}

function getRiskProfileConfig(riskLevel: number): RiskProfileConfig {
  return RISK_PROFILES[riskLevel] || LOCAL_RISK_PROFILE_SEED[riskLevel] || LOCAL_RISK_PROFILE_SEED[5];
}

const LOCAL_RISK_PROFILE_SEED = cloneRiskProfiles(RISK_PROFILES);
let riskProfilesSource: RiskProfilesSource = "seed_local";

export function getRiskProfilesSource(): RiskProfilesSource {
  return riskProfilesSource;
}

function mapCanonicalAssetTypeToBucket(assetType: string | null | undefined): AssetClass | null {
  if (!assetType) return null;
  if (assetType === "EQUITY") return "RV";
  if (assetType === "FIXED_INCOME") return "RF";
  if (assetType === "MONETARY") return "Monetario";
  if (assetType === "MIXED") return "Mixto";
  if (assetType === "ALTERNATIVE" || assetType === "REAL_ESTATE" || assetType === "COMMODITIES") return "Alternativos";
  if (assetType === "OTHER" || assetType === "UNKNOWN") return "Otros";
  return null;
}

function getAssetClassFromEconomicExposure(expV2: any): AssetClass | null {
  const mix = expV2?.economic_exposure;
  if (!mix) return null;

  const equity = Number(mix.equity || 0);
  const bond = Number(mix.bond || 0);
  const cash = Number(mix.cash || 0);
  const alternatives = Number(mix.alternative || 0) + Number(mix.real_asset || 0) + Number(mix.other || 0);

  if (cash >= 75 && equity <= 20 && bond <= 25) return "Monetario";
  if (equity >= 80 && bond <= 20) return "RV";
  if (bond >= 70 && equity <= 25) return "RF";
  if (equity >= 25 && bond >= 25) return "Mixto";
  if (alternatives >= 30 && equity < 40 && bond < 40) return "Alternativos";
  return null;
}

function getAssetClass(f: Fund): AssetClass {
  const classV2 = normalizeClassificationV2ForUI(f.classification_v2);
  const expV2 = normalizePortfolioExposureV2ForUI(f.portfolio_exposure_v2);

  const bucketFromType = mapCanonicalAssetTypeToBucket(classV2?.asset_type || null);
  if (bucketFromType) {
    return bucketFromType;
  }

  const bucketFromExposure = getAssetClassFromEconomicExposure(expV2);
  if (bucketFromExposure) {
    return bucketFromExposure;
  }

  const subtype = String(classV2?.asset_subtype || "");
  if (subtype.startsWith("SECTOR_EQUITY_") || subtype.endsWith("_EQUITY")) {
    return "RV";
  }

  const strategyTags = Array.isArray(classV2?.strategy_tags) ? classV2.strategy_tags : [];
  if (strategyTags.some((tag: string) => String(tag).startsWith("sector:") || String(tag).startsWith("sector_concentrated:"))) {
    return "RV";
  }

  console.warn(`[RulesEngine] Fondo ${f.isin || 'Desconocido'} carece de classification_v2.asset_type. Se degrada a 'Otros' de forma defensiva.`);
  return "Otros";
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
    const profile = getRiskProfileConfig(riskOrBias);
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
// TODO: Fase 3: Eliminar por completo este fallback cuando todo BDB-FONDOS opere 100% sobre classification_v2
export function isFundSuitableForProfile(fund: Fund, riskProfile: number): boolean {
  const classV2 = normalizeClassificationV2ForUI(fund.classification_v2);
  const expV2 = normalizePortfolioExposureV2ForUI(fund.portfolio_exposure_v2);

  // NUEVA LÓGICA CANÓNICA V1 (Backend-as-authority)
  if (Array.isArray(classV2?.compatible_profiles) && classV2.compatible_profiles.length > 0) {
    return classV2.compatible_profiles.includes(riskProfile);
  }

  // FALLBACK DEFENSIVO TEMPORAL
  if (!classV2) {
    const eqMet = Number(expV2?.economic_exposure?.equity || (fund as any)?.metrics?.equity || 0);
    if (riskProfile <= 2 && eqMet > 20) return false;
    if (riskProfile <= 4 && eqMet > 50) return false;
    return true;
  }

  const assetType = classV2.asset_type;
  const assetSubtype = classV2.asset_subtype;
  const riskBucket = classV2.risk_bucket ? String(classV2.risk_bucket).toUpperCase() : null;
  const isSectorFund = classV2.is_sector_fund;
  const sectorFocus = classV2.sector_focus ? String(classV2.sector_focus).toUpperCase() : null;
  const realEq = Number(expV2?.economic_exposure?.equity || 0);
  const lowQualityCredit = Number(expV2?.fi_credit?.low_quality || expV2?.credit?.low_quality || 0);

  // 1. Very Conservative Profiles (1-2)
  if (riskProfile <= 2) {
    if (classV2.is_suitable_low_risk === false) return false;
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
      lowQualityCredit >= 35 ||
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
  const profile = getRiskProfileConfig(riskLevel);

  // 1. Clasificar universo en buckets
  const universe: Record<AssetClass, Fund[]> = {
    "RV": [], "RF": [], "Monetario": [], "Mixto": [], "Alternativos": [], "Otros": []
  };

  let validCandidates = 0;

  allFunds.forEach(f => {
    // FILTRO DE CALIDAD DE DATOS BASE
    const dq = (f as any)?.data_quality ?? {};
    const isExplicitlyBad =
      dq.has_history === false ||
      (f as any)?.metrics_invalid === true ||
      dq.history_ok === false;

    if (isExplicitlyBad) return;

    // FILTRO DE HISTORIAL MÍNIMO (Políticas de Selección Automática)
    // Exigimos >= 3 años de vida (~756 puntos) para entrar en carteras automáticas
    const pts = dq.points_count ?? 0;
    const yrs = (f as any)?.std_extra?.yearsHistory ?? 0;
    
    if (pts > 0 && pts < 756) return;
    if (pts === 0 && yrs > 0 && yrs < 3.0) return;

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
    candidates = candidates.map(f => {
      let score = calculateScore(f, profile.bias);
      // Soft preference for 5+ years of history
      const pts = (f as any)?.data_quality?.points_count ?? 0;
      const yrs = (f as any)?.std_extra?.yearsHistory ?? 0;
      if (pts >= 1260 || yrs >= 5.0) {
        score += 50; 
      }
      return { f, score };
    })
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

  // FALLBACK CRÍTICO "Graceful Degradation" [ELIMINADO FASE 3 P3]
  // Ya no inyectamos fondos que rompen las restricciones de asset class solo para rellenar
  if (portfolio.length < targetNumFunds) {
    console.warn(`[SmartEngine] Only got ${portfolio.length} funds from buckets. Not filling gaps to preserve risk profile constraints.`);
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

export function syncRiskProfilesFromDB(profilesDB: Record<number, any>) {
  const applied = applyCanonicalRiskProfiles(profilesDB, "firestore", "Firestore risk_profiles");
  if (applied === 0) {
    console.warn("⚠️ [RulesEngine] Firestore risk_profiles payload invalid or empty. Keeping local presentation seed.");
  }
}

// NOTE: Endpoint oficial para hidratar configuración desde Backend (FASE 1)
export async function syncBusinessRulesFromBackend(functionsInstance: any) {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const getRules = httpsCallable(functionsInstance, 'get_business_rules');
    const response = await getRules();
    const data = response.data as any;
    const applied = applyCanonicalRiskProfiles(
      data?.risk_profiles,
      "backend",
      `backend business rules (${data?.config_source || "unknown"})`
    );

    if (!data || data.api_version !== "business_rules_v1" || !data.risk_profiles) {
      console.warn("⚠️ [RulesEngine] Payload de reglas de negocio inválido, usando RISK_PROFILES local");
      return;
    }

    if (applied === 0) {
      console.warn("⚠️ [RulesEngine] Payload de backend sin perfiles utilizables. Se mantiene la seed local.");
    }
  } catch (error) {
    console.error("⚠️ [RulesEngine] Error consultando business rules al backend:", error);
    // Fallback silencioso para no romper la UX
  }
}
