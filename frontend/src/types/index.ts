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
        regions?: any;
        equity_style?: any;
        fixed_income?: any;
        holdings_top10?: any[];
        holdings_stats?: any;
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
    holdings?: any[];
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
    metrics: any;
    assets?: Record<string, Fund & { volatility?: number }>;
    warnings: string[];
    debug: any;
    status?: string;
    weights?: any;
    error?: string;
    used_assets?: string[];
    feasibility?: {
        equity_floor_requested: number;
        equity_max_achievable: number;
        min_100pct_equity_funds_needed: number;
        note: string;
    };
    suggestion?: string;
}

export interface AllocationItem {
    label: string;
    value: number;
}
