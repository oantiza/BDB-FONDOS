export interface Fund {
    isin: string;
    name: string;
    std_type?: string;
    std_region?: string;
    std_perf?: {
        volatility?: number;
        sharpe?: number;
        returns?: number;
        max_drawdown?: number;
    };
    std_extra?: {
        category?: string;
        ter?: number;
        company?: string;
        [key: string]: any;
    };
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
