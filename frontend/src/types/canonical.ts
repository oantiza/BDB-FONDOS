export enum AssetClassV2 {
    EQUITY = "EQUITY",
    FIXED_INCOME = "FIXED_INCOME",
    MIXED = "MIXED",
    MONETARY = "MONETARY",
    ALTERNATIVE = "ALTERNATIVE", 
    REAL_ESTATE = "REAL_ESTATE",
    COMMODITIES = "COMMODITIES",
    OTHER = "OTHER",
    UNKNOWN = "UNKNOWN"
}

export enum AssetSubtypeV2 {
    GLOBAL_EQUITY = "GLOBAL_EQUITY",
    US_EQUITY = "US_EQUITY",
    EUROPE_EQUITY = "EUROPE_EQUITY",
    EUROZONE_EQUITY = "EUROZONE_EQUITY",
    JAPAN_EQUITY = "JAPAN_EQUITY",
    ASIA_PACIFIC_EQUITY = "ASIA_PACIFIC_EQUITY",
    EMERGING_MARKETS_EQUITY = "EMERGING_MARKETS_EQUITY",
    GLOBAL_SMALL_CAP_EQUITY = "GLOBAL_SMALL_CAP_EQUITY",
    GLOBAL_INCOME_EQUITY = "GLOBAL_INCOME_EQUITY",
    SECTOR_EQUITY_TECH = "SECTOR_EQUITY_TECH",
    SECTOR_EQUITY_HEALTHCARE = "SECTOR_EQUITY_HEALTHCARE",
    THEMATIC_EQUITY = "THEMATIC_EQUITY",
    
    GOVERNMENT_BOND = "GOVERNMENT_BOND",
    CORPORATE_BOND = "CORPORATE_BOND",
    HIGH_YIELD_BOND = "HIGH_YIELD_BOND",
    INFLATION_LINKED_BOND = "INFLATION_LINKED_BOND",
    EMERGING_MARKETS_BOND = "EMERGING_MARKETS_BOND",
    CONVERTIBLE_BOND = "CONVERTIBLE_BOND",
    
    CONSERVATIVE_ALLOCATION = "CONSERVATIVE_ALLOCATION",
    MODERATE_ALLOCATION = "MODERATE_ALLOCATION",
    AGGRESSIVE_ALLOCATION = "AGGRESSIVE_ALLOCATION",
    FLEXIBLE_ALLOCATION = "FLEXIBLE_ALLOCATION",
    MULTI_ASSET_INCOME = "MULTI_ASSET_INCOME",
    TARGET_DATE = "TARGET_DATE",

    UNKNOWN = "UNKNOWN"
}

export enum StrategyTypeV2 {
    ACTIVE = "ACTIVE",
    PASSIVE = "PASSIVE",
    SMART_BETA = "SMART_BETA",
    UNKNOWN = "UNKNOWN"
}

export enum RiskBucketV2 {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    UNKNOWN = "UNKNOWN"
}

export enum RegionV2 {
    GLOBAL = "GLOBAL",
    US = "US",
    EUROPE = "EUROPE",
    EUROZONE = "EUROZONE",
    ASIA_DEV = "ASIA_DEV",
    EMERGING = "EMERGING",
    JAPAN = "JAPAN",
    UNKNOWN = "UNKNOWN"
}

export enum EquityStyleBoxV2 {
    LARGE_VALUE = "LARGE_VALUE",
    LARGE_CORE = "LARGE_CORE",
    LARGE_GROWTH = "LARGE_GROWTH",
    MID_VALUE = "MID_VALUE",
    MID_CORE = "MID_CORE",
    MID_GROWTH = "MID_GROWTH",
    SMALL_VALUE = "SMALL_VALUE",
    SMALL_CORE = "SMALL_CORE",
    SMALL_GROWTH = "SMALL_GROWTH",
    UNKNOWN = "UNKNOWN"
}

export enum MarketCapBiasV2 {
    LARGE = "LARGE",
    MID = "MID",
    SMALL = "SMALL",
    MULTI = "MULTI",
    UNKNOWN = "UNKNOWN"
}

export enum SectorFocusV2 {
    TECHNOLOGY = "TECHNOLOGY",
    HEALTHCARE = "HEALTHCARE",
    FINANCIALS = "FINANCIALS",
    REAL_ESTATE = "REAL_ESTATE",
    UTILITIES = "UTILITIES",
    ENERGY = "ENERGY",
    INDUSTRIALS = "INDUSTRIALS",
    CONSUMER_CYCLICAL = "CONSUMER_CYCLICAL",
    CONSUMER_DEFENSIVE = "CONSUMER_DEFENSIVE",
    COMMUNICATION = "COMMUNICATION",
    BASIC_MATERIALS = "BASIC_MATERIALS",
    DIVERSIFIED = "DIVERSIFIED",
    UNKNOWN = "UNKNOWN"
}

export enum FIDurationBucketV2 {
    SHORT = "SHORT",
    MEDIUM = "MEDIUM",
    LONG = "LONG",
    FLEXIBLE = "FLEXIBLE",
    UNKNOWN = "UNKNOWN"
}

export enum FICreditBucketV2 {
    HIGH_QUALITY = "HIGH_QUALITY",
    MEDIUM_QUALITY = "MEDIUM_QUALITY",
    LOW_QUALITY = "LOW_QUALITY",
    UNKNOWN = "UNKNOWN"
}

export enum AlternativeBucketV2 {
    LONG_SHORT_EQUITY = "LONG_SHORT_EQUITY",
    MARKET_NEUTRAL = "MARKET_NEUTRAL",
    GLOBAL_MACRO = "GLOBAL_MACRO",
    MANAGED_FUTURES = "MANAGED_FUTURES",
    MULTI_STRATEGY = "MULTI_STRATEGY",
    COMMODITIES = "COMMODITIES",
    CURRENCY = "CURRENCY",
    NONE = "NONE",
    UNKNOWN = "UNKNOWN"
}

export enum ComplexityFlagV2 {
    STANDARD = "STANDARD",
    COMPLEX = "COMPLEX",
    HIGHLY_COMPLEX = "HIGHLY_COMPLEX"
}

export enum LiquidityProfileV2 {
    DAILY = "DAILY",
    WEEKLY = "WEEKLY",
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    ILLIQUID = "ILLIQUID"
}

export enum FITypeV2 {
    CORPORATE = "CORPORATE",
    GOVERNMENT = "GOVERNMENT",
    MUNICIPAL = "MUNICIPAL",
    MORTGAGE = "MORTGAGE",
    MIXED = "MIXED",
    UNKNOWN = "UNKNOWN"
}

export enum ConvertiblesProfileV2 {
    BOND_LIKE = "BOND_LIKE",
    EQUITY_LIKE = "EQUITY_LIKE",
    BALANCED = "BALANCED",
    NONE = "NONE",
    UNKNOWN = "UNKNOWN"
}

export enum ConcentrationLevelV2 {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    UNKNOWN = "UNKNOWN"
}

export interface ClassificationV2 {
    version: string;
    asset_type: AssetClassV2;
    asset_subtype: AssetSubtypeV2;
    strategy_type: StrategyTypeV2;
    risk_bucket: RiskBucketV2;
    region_primary: RegionV2;
    region_secondary: string;
    geographic_scope: string;
    
    // Equity Specifics
    equity_style_box: EquityStyleBoxV2;
    market_cap_bias: MarketCapBiasV2;
    sector_focus: SectorFocusV2;
    sector_concentration: ConcentrationLevelV2;
    
    // FI Specifics
    fi_duration_bucket: FIDurationBucketV2;
    fi_credit_bucket: FICreditBucketV2;
    fi_type: FITypeV2;
    
    // Alternatives
    alternative_bucket: AlternativeBucketV2;
    convertibles_profile: ConvertiblesProfileV2;
    
    // Systemic
    liquidity_profile: LiquidityProfileV2;
    complexity_flag: ComplexityFlagV2;
    is_thematic: boolean;
    is_sector_fund: boolean;
    is_index_like: boolean;
    
    is_suitable_low_risk: boolean;
    
    // Metadatos
    classification_confidence: number;
    source_priority_used: string[];
    warnings: string[];
    computed_at: string;
    raw_name: string;
}

export interface EconomicExposureV2 {
    equity: number;
    bond: number;
    cash: number;
    other: number;
}

export interface ExposureConcentrationMetrics {
    top_10_holdings_weight: number;
    hhi_index?: number;
}

export interface PortfolioExposureV2 {
    version: string;
    economic_exposure: EconomicExposureV2;
    
    equity_regions: Record<string, number>;
    equity_styles: Record<string, number>;
    sectors: Record<string, number>;
    
    fi_credit: Record<string, number>;
    fi_duration: Record<string, number>;
    fi_types: Record<string, number>;
    
    alternatives: Record<string, number>;
    
    concentration_metrics: ExposureConcentrationMetrics;
    risk_flags: string[];
    
    exposure_confidence: number;
    warnings: string[];
    computed_at: string;
}
