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

export interface Fund {
    isin: string;
    name: string;
    std_type?: string;
    asset_class?: string;
    category_morningstar?: string;
    std_region?: string;
    primary_region?: string;

    // V3 Canonical Fields
    derived?: {
        asset_class?: string;
        primary_region?: string;
        subcategories?: string[];
        top_sector?: string;
        top_sector_weight?: number;
        confidence?: number;
    };
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

export interface PortfolioItem extends Fund {
    weight: number;
    score?: number;
    role?: string;
    manualSwap?: boolean;
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
    weights?: Record<string, number>;
    error?: string;
    used_assets?: string[];
    feasibility?: {
        equity_floor_requested: number;
        equity_max_achievable: number;
        min_100pct_equity_funds_needed: number;
        note: string;
    };
    suggestion?: string;
    portfolioSeries?: { x: string; y: number }[];
    benchmarkSeries?: Record<string, { x: string; y: number }[]>;
    synthetics?: any[];
}

export interface AllocationItem {
    label: string;
    value: number;
}
