import { ClassificationV2, PortfolioExposureV2 } from './canonical';

// --- Helper Interfaces ---

export interface RegionBreakdown {
    americas?: number;
    europe?: number;
    asia_developed?: number;
    asia_emerging?: number;
    japan?: number;
    australasia?: number;
    uk?: number;
    latin_america?: number;
    [key: string]: number | undefined;
}

export interface EquityStyle {
    large_growth?: number;
    large_value?: number;
    large_core?: number;
    mid_growth?: number;
    mid_value?: number;
    mid_core?: number;
    small_growth?: number;
    small_value?: number;
    small_core?: number;
    [key: string]: number | undefined;
}

export interface FixedIncomeStyle {
    effective_duration?: number;
    credit_quality?: string; // e.g. "BBB"
    yield_to_maturity?: number;
    [key: string]: any;
}

export interface HoldingItem {
    isin?: string;
    name: string;
    weight: number;
    sector?: string;
    country?: string;
}

export interface PortfolioMetrics {
    cagr: number;
    volatility: number;
    sharpe: number;
    maxDrawdown: number;
    rf_rate?: number;
    alpha?: number;
    beta?: number;
    sortino?: number;
}

// --- Main Interfaces ---

// --- Canonical V2 Base Models ---

/**
 * Representa la estructura estricta y limpia del nuevo modelo canónico V2.
 * Esta es la forma hacia la que debe migrar todo el sistema.
 */
export interface FundCanonicalV2 {
    isin: string;
    name: string;
    classification_v2?: ClassificationV2;
    portfolio_exposure_v2?: PortfolioExposureV2;
}

/**
 * Agrupa todos los campos "legacy" o derivados (ej. Morningstar, extracciones antiguas)
 * que se mantienen por retrocompatibilidad pero que perderán autoridad frente a V2.
 */
export interface FundLegacyCompat {
    // V3 Canonical Fields (Legacy derived, being deprecated)
    ms?: {
        category_morningstar?: string;
        rating_stars?: number;
        sectors?: Record<string, number>;
        regions?: RegionBreakdown;
        equity_style?: EquityStyle;
        fixed_income?: FixedIncomeStyle;
        holdings_top10?: HoldingItem[];
        holdings_stats?: any; // To allow flexibility for now
        costs?: any;
        objective?: string;
        [key: string]: any;
    };

    std_perf?: {
        volatility?: number;
        sharpe?: number;
        returns?: number;
        max_drawdown?: number;
        cagr3y?: number;
        cagr6m?: number;
        alpha?: number;
        beta?: number;
        sortino_ratio?: number;
    };
    std_extra?: {
        category?: string;
        ter?: number;
        company?: string;
        yearsHistory?: number;
        mgmtFee?: number;
        duration?: number;
        [key: string]: any;
    };
    costs?: {
        retrocession?: number;
        management_fee?: number;
    };
    rating_overall?: number;
    sectors?: Record<string, number>;
    metrics?: {
        equity: number;
        bond: number;
        cash: number;
        other?: number;
        [key: string]: number | undefined;
    };
    returns_history?: Record<string, number>;
    risk_srri?: number;
    holdings?: HoldingItem[];
    data_quality?: {
        history_ok?: boolean;
        points_count?: number;
    };
    manual?: {
        costs?: {
            retrocession?: number;
            ter?: number;
            [key: string]: any;
        };
        [key: string]: any;
    };
}

/**
 * Representación "God Object" actual que mezcla V2 y Legacy.
 * La UI actual asume esta forma generosa, por lo que la mantenemos como unión.
 */
export interface Fund extends FundCanonicalV2, FundLegacyCompat {}

// --- Portfolio & Action Interfaces ---

/**
 * Representa una posición específica dentro de la cartera.
 * Extiende Fund por compatibilidad temporal, pero añade el estado en cartera.
 */
export interface PortfolioHolding extends Fund {
    weight: number;
    score?: number;
    role?: string;
    manualSwap?: boolean;
    isLocked?: boolean; // Fija el capital / % durante la optimizacion
    // Fallback data for robust charts
    regions?: Record<string, number>;
    ms?: any;
    // For Synthetic Benchmarks
    isBenchmark?: boolean;
    benchmarkData?: any;
}

/**
 * Alias de retrocompatibilidad.
 * @deprecated Usa PortfolioHolding en nuevo desarrollo.
 */
export interface PortfolioItem extends PortfolioHolding {}

// --- Optimization Boundary ---

/**
 * Metadatos mínimos que necesita el backend para un activo durante la optimización.
 */
export interface OptimizationAsset {
    asset_class?: string;
    name: string;
}

/**
 * Payload estricto que se envía al endpoint optimize_portfolio_quant.
 * Define claramente el borde entre JS y Python.
 */
export interface OptimizationRequest {
    assets: string[];
    risk_level: number;
    locked_assets: string[];
    asset_metadata: Record<string, OptimizationAsset>;
    constraints: {
        apply_profile: boolean;
        optimization_mode: string;
        lock_mode: string;
        fixed_weights: Record<string, number>;
    };
    tactical_views?: Record<string, number>;
    save_snapshot?: boolean;
    snapshot_label?: string;
}

export interface MarketIndexResponse {
    series: { x: string; y: number }[];
    symbol: string;
    error?: string;
}

export interface YieldCurveResponse {
    curve: { maturity: string; yield: number }[];
    region: string;
    error?: string;
}

export interface SmartPortfolioResponse {
    portfolio: PortfolioItem[];
    metrics: PortfolioMetrics;
    assets?: Record<string, Fund & { volatility?: number }>;
    warnings: string[];
    debug: any;
    status?: string;
    message?: string;
    recovery_candidates?: string[];
    weights?: Record<string, number>;
    error?: string;
    observations?: number;
    used_assets?: string[];
    feasibility?: {
        requested?: number;
        achievable?: number;
        min_100pct_equity_funds_needed?: number;
        note?: string;
    };
    suggestion?: string;
    portfolioSeries?: { x: string; y: number }[];
    benchmarkSeries?: Record<string, { x: string; y: number }[]>;
    synthetics?: any[];
    explainability?: {
        primary_objective: string;
        solver_fallback_used: boolean;
        binding_constraints: string[];
    };
}

export interface AllocationItem {
    label: string;
    value: number;
}
