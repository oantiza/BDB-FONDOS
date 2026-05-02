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
    MONEY_MARKET = "MONEY_MARKET",
    SECTOR_EQUITY_FINANCIALS = "SECTOR_EQUITY_FINANCIALS",
    SECTOR_EQUITY_INDUSTRIALS = "SECTOR_EQUITY_INDUSTRIALS",
    SECTOR_EQUITY_CONSUMER_CYCLICAL = "SECTOR_EQUITY_CONSUMER_CYCLICAL",
    SECTOR_EQUITY_CONSUMER_DEFENSIVE = "SECTOR_EQUITY_CONSUMER_DEFENSIVE",
    SECTOR_EQUITY_REAL_ESTATE = "SECTOR_EQUITY_REAL_ESTATE",
    SECTOR_EQUITY_UTILITIES = "SECTOR_EQUITY_UTILITIES",
    SECTOR_EQUITY_ENERGY = "SECTOR_EQUITY_ENERGY",
    SECTOR_EQUITY_BASIC_MATERIALS = "SECTOR_EQUITY_BASIC_MATERIALS",
    SECTOR_EQUITY_COMMUNICATION = "SECTOR_EQUITY_COMMUNICATION",

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

export type AssetTypeV2Input =
    | AssetClassV2
    | "equity"
    | "fixed_income"
    | "allocation"
    | "money_market"
    | "alternative"
    | "real_asset"
    | "commodities"
    | "other"
    | "unknown";

export type RegionV2Input =
    | RegionV2
    | "Global"
    | "Europa"
    | "Zona Euro"
    | "EE.UU."
    | "USA"
    | "Emergentes"
    | "Japón"
    | "Asia Desarrollada"
    | "Iberoamérica"
    | "UNKNOWN";

export type CreditBucketV2Input =
    | FICreditBucketV2
    | "investment_grade"
    | "medium_quality"
    | "high_yield"
    | "low_quality"
    | "unknown";

export type DurationBucketV2Input =
    | FIDurationBucketV2
    | "ultrashort"
    | "short"
    | "intermediate"
    | "medium"
    | "long"
    | "flexible"
    | "unknown";

export interface AssetMixV2 {
    equity?: number;
    bond?: number;
    cash?: number;
    other?: number;
    alternative?: number;
    real_asset?: number;
}

export interface ClassificationV2 {
    version?: string | null;
    asset_type?: AssetTypeV2Input | null;
    asset_subtype?: AssetSubtypeV2 | string | null;
    commercial_type?: string | null;
    region_primary?: RegionV2Input | null;
    region_secondary?: string | null;
    fixed_income_type?: string | null;
    credit_bucket?: CreditBucketV2Input | null;
    duration_bucket?: DurationBucketV2Input | null;
    strategy_tags?: string[];
    vehicle_complexity?: string | null;
    classification_confidence?: number | null;
    sources_used?: string[];
    warnings?: string[];

    // Compatibility / downstream suitability fields
    strategy_type?: StrategyTypeV2 | string | null;
    risk_bucket?: RiskBucketV2 | string | null;
    geographic_scope?: string | null;
    equity_style_box?: EquityStyleBoxV2 | string | null;
    market_cap_bias?: MarketCapBiasV2 | string | null;
    sector_focus?: SectorFocusV2 | string | null;
    sector_concentration?: ConcentrationLevelV2 | string | null;
    fi_duration_bucket?: FIDurationBucketV2 | string | null;
    fi_credit_bucket?: FICreditBucketV2 | string | null;
    fi_type?: FITypeV2 | string | null;
    alternative_bucket?: AlternativeBucketV2 | string | null;
    convertibles_profile?: ConvertiblesProfileV2 | string | null;
    liquidity_profile?: LiquidityProfileV2 | string | null;
    complexity_flag?: ComplexityFlagV2 | string | null;
    is_thematic?: boolean | null;
    is_sector_fund?: boolean | null;
    is_index_like?: boolean | null;
    is_suitable_low_risk?: boolean | null;
    compatible_profiles?: number[];
    suitability_version?: string;
    source_priority_used?: string[];
    computed_at?: string;
    raw_name?: string;
}

export interface EconomicExposureV2 {
    equity?: number;
    bond?: number;
    cash?: number;
    other?: number;
    alternative?: number;
    real_asset?: number;
}

export interface ExposureConcentrationMetrics {
    top_10_holdings_weight: number;
    hhi_index?: number;
}

export interface PortfolioExposureV2 {
    version?: string | null;
    asset_mix?: AssetMixV2 | null;
    economic_exposure?: EconomicExposureV2 | null;
    equity_regions?: Record<string, number> | null;
    equity_styles?: Record<string, number> | null;
    sectors?: Record<string, number> | null;
    market_caps?: Record<string, number> | null;
    bond_types?: Record<string, number> | null;
    credit?: Record<string, number> | null;
    duration?: Record<string, number> | null;
    fi_credit?: Record<string, number> | null;
    fi_duration?: Record<string, number> | null;
    fi_types?: Record<string, number> | null;
    alternatives?: Record<string, number> | null;
    concentration_metrics?: ExposureConcentrationMetrics | null;
    risk_flags?: string[];
    exposure_confidence?: number | null;
    warnings?: string[];
    computed_at?: string;
}
