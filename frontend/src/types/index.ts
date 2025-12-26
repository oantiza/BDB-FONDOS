export interface Fund {
    isin: string;
    name: string;
    std_type?: string;
    std_region?: string;
    std_perf?: {
        volatility?: number;
        sharpe?: number;
        returns?: number; // unused?
        max_drawdown?: number;
        cagr3y?: number;
        cagr6m?: number;
        alpha?: number;
        beta?: number;
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
    returns_history?: Record<string, number>; // Schema V2 (Map)
    risk_srri?: number; // Schema V2 (Snake Case)
    [key: string]: any;
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
    warnings: string[];
    debug: any;
    status?: string;
    weights?: any;
    error?: string;
}

export interface AllocationItem {
    label: string;
    value: number;
}
