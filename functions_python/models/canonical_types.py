from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field

class AssetClassV2(str, Enum):
    EQUITY = "EQUITY"
    FIXED_INCOME = "FIXED_INCOME"
    MIXED = "MIXED"
    MONETARY = "MONETARY"
    ALTERNATIVE = "ALTERNATIVE"
    REAL_ESTATE = "REAL_ESTATE"
    COMMODITIES = "COMMODITIES"
    OTHER = "OTHER"
    UNKNOWN = "UNKNOWN"

class AssetSubtypeV2(str, Enum):
    GLOBAL_EQUITY = "GLOBAL_EQUITY"
    US_EQUITY = "US_EQUITY"
    EUROPE_EQUITY = "EUROPE_EQUITY"
    EUROZONE_EQUITY = "EUROZONE_EQUITY"
    JAPAN_EQUITY = "JAPAN_EQUITY"
    ASIA_PACIFIC_EQUITY = "ASIA_PACIFIC_EQUITY"
    EMERGING_MARKETS_EQUITY = "EMERGING_MARKETS_EQUITY"
    GLOBAL_SMALL_CAP_EQUITY = "GLOBAL_SMALL_CAP_EQUITY"
    GLOBAL_INCOME_EQUITY = "GLOBAL_INCOME_EQUITY"
    SECTOR_EQUITY_TECH = "SECTOR_EQUITY_TECH"
    SECTOR_EQUITY_HEALTHCARE = "SECTOR_EQUITY_HEALTHCARE"
    SECTOR_EQUITY_FINANCIALS = "SECTOR_EQUITY_FINANCIALS"
    SECTOR_EQUITY_INDUSTRIALS = "SECTOR_EQUITY_INDUSTRIALS"
    SECTOR_EQUITY_CONSUMER_CYCLICAL = "SECTOR_EQUITY_CONSUMER_CYCLICAL"
    SECTOR_EQUITY_CONSUMER_DEFENSIVE = "SECTOR_EQUITY_CONSUMER_DEFENSIVE"
    SECTOR_EQUITY_REAL_ESTATE = "SECTOR_EQUITY_REAL_ESTATE"
    SECTOR_EQUITY_UTILITIES = "SECTOR_EQUITY_UTILITIES"
    SECTOR_EQUITY_ENERGY = "SECTOR_EQUITY_ENERGY"
    SECTOR_EQUITY_BASIC_MATERIALS = "SECTOR_EQUITY_BASIC_MATERIALS"
    SECTOR_EQUITY_COMMUNICATION = "SECTOR_EQUITY_COMMUNICATION"
    THEMATIC_EQUITY = "THEMATIC_EQUITY"
    GOVERNMENT_BOND = "GOVERNMENT_BOND"
    CORPORATE_BOND = "CORPORATE_BOND"
    HIGH_YIELD_BOND = "HIGH_YIELD_BOND"
    INFLATION_LINKED_BOND = "INFLATION_LINKED_BOND"
    EMERGING_MARKETS_BOND = "EMERGING_MARKETS_BOND"
    CONVERTIBLE_BOND = "CONVERTIBLE_BOND"
    CONSERVATIVE_ALLOCATION = "CONSERVATIVE_ALLOCATION"
    MODERATE_ALLOCATION = "MODERATE_ALLOCATION"
    AGGRESSIVE_ALLOCATION = "AGGRESSIVE_ALLOCATION"
    FLEXIBLE_ALLOCATION = "FLEXIBLE_ALLOCATION"
    MULTI_ASSET_INCOME = "MULTI_ASSET_INCOME"
    TARGET_DATE = "TARGET_DATE"
    MONEY_MARKET = "MONEY_MARKET"
    UNKNOWN = "UNKNOWN"

class StrategyTypeV2(str, Enum):
    ACTIVE = "ACTIVE"
    PASSIVE = "PASSIVE"
    SMART_BETA = "SMART_BETA"
    UNKNOWN = "UNKNOWN"

class RiskBucketV2(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    UNKNOWN = "UNKNOWN"

class RegionV2(str, Enum):
    GLOBAL = "GLOBAL"
    US = "US"
    EUROPE = "EUROPE"
    EUROZONE = "EUROZONE"
    ASIA_DEV = "ASIA_DEV"
    EMERGING = "EMERGING"
    JAPAN = "JAPAN"
    UNKNOWN = "UNKNOWN"

class EquityStyleBoxV2(str, Enum):
    LARGE_VALUE = "LARGE_VALUE"
    LARGE_CORE = "LARGE_CORE"
    LARGE_GROWTH = "LARGE_GROWTH"
    MID_VALUE = "MID_VALUE"
    MID_CORE = "MID_CORE"
    MID_GROWTH = "MID_GROWTH"
    SMALL_VALUE = "SMALL_VALUE"
    SMALL_CORE = "SMALL_CORE"
    SMALL_GROWTH = "SMALL_GROWTH"
    UNKNOWN = "UNKNOWN"

class MarketCapBiasV2(str, Enum):
    LARGE = "LARGE"
    MID = "MID"
    SMALL = "SMALL"
    MULTI = "MULTI"
    UNKNOWN = "UNKNOWN"

class SectorFocusV2(str, Enum):
    TECHNOLOGY = "TECHNOLOGY"
    HEALTHCARE = "HEALTHCARE"
    FINANCIALS = "FINANCIALS"
    REAL_ESTATE = "REAL_ESTATE"
    UTILITIES = "UTILITIES"
    ENERGY = "ENERGY"
    INDUSTRIALS = "INDUSTRIALS"
    CONSUMER_CYCLICAL = "CONSUMER_CYCLICAL"
    CONSUMER_DEFENSIVE = "CONSUMER_DEFENSIVE"
    COMMUNICATION = "COMMUNICATION"
    BASIC_MATERIALS = "BASIC_MATERIALS"
    DIVERSIFIED = "DIVERSIFIED"
    UNKNOWN = "UNKNOWN"

class FIDurationBucketV2(str, Enum):
    SHORT = "SHORT"
    MEDIUM = "MEDIUM"
    LONG = "LONG"
    FLEXIBLE = "FLEXIBLE"
    UNKNOWN = "UNKNOWN"

class FICreditBucketV2(str, Enum):
    HIGH_QUALITY = "HIGH_QUALITY"
    MEDIUM_QUALITY = "MEDIUM_QUALITY"
    LOW_QUALITY = "LOW_QUALITY"
    UNKNOWN = "UNKNOWN"

class AlternativeBucketV2(str, Enum):
    LONG_SHORT_EQUITY = "LONG_SHORT_EQUITY"
    MARKET_NEUTRAL = "MARKET_NEUTRAL"
    GLOBAL_MACRO = "GLOBAL_MACRO"
    MANAGED_FUTURES = "MANAGED_FUTURES"
    MULTI_STRATEGY = "MULTI_STRATEGY"
    COMMODITIES = "COMMODITIES"
    CURRENCY = "CURRENCY"
    NONE = "NONE"
    UNKNOWN = "UNKNOWN"

class ComplexityFlagV2(str, Enum):
    STANDARD = "STANDARD"
    COMPLEX = "COMPLEX"
    HIGHLY_COMPLEX = "HIGHLY_COMPLEX"

class LiquidityProfileV2(str, Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ILLIQUID = "ILLIQUID"

class FITypeV2(str, Enum):
    CORPORATE = "CORPORATE"
    GOVERNMENT = "GOVERNMENT"
    MUNICIPAL = "MUNICIPAL"
    MORTGAGE = "MORTGAGE"
    MIXED = "MIXED"
    UNKNOWN = "UNKNOWN"

class ConvertiblesProfileV2(str, Enum):
    BOND_LIKE = "BOND_LIKE"
    EQUITY_LIKE = "EQUITY_LIKE"
    BALANCED = "BALANCED"
    NONE = "NONE"
    UNKNOWN = "UNKNOWN"

class ConcentrationLevelV2(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    UNKNOWN = "UNKNOWN"

class ClassificationV2(BaseModel):
    version: str = "2.0"
    asset_type: AssetClassV2 | str = AssetClassV2.UNKNOWN
    asset_subtype: AssetSubtypeV2 | str = AssetSubtypeV2.UNKNOWN
    commercial_type: Optional[str] = None
    region_primary: RegionV2 | str = RegionV2.UNKNOWN
    region_secondary: Optional[str] = None
    fixed_income_type: Optional[str] = None
    credit_bucket: Optional[str] = None
    duration_bucket: Optional[str] = None
    strategy_tags: List[str] = Field(default_factory=list)
    vehicle_complexity: Optional[str] = None

    strategy_type: Optional[StrategyTypeV2 | str] = None
    risk_bucket: Optional[RiskBucketV2 | str] = None
    geographic_scope: Optional[str] = None
    equity_style_box: Optional[EquityStyleBoxV2 | str] = None
    market_cap_bias: Optional[MarketCapBiasV2 | str] = None
    sector_focus: Optional[SectorFocusV2 | str] = None
    sector_concentration: Optional[ConcentrationLevelV2 | str] = None
    fi_duration_bucket: Optional[FIDurationBucketV2 | str] = None
    fi_credit_bucket: Optional[FICreditBucketV2 | str] = None
    fi_type: Optional[FITypeV2 | str] = None
    alternative_bucket: Optional[AlternativeBucketV2 | str] = None
    convertibles_profile: Optional[ConvertiblesProfileV2 | str] = None
    liquidity_profile: Optional[LiquidityProfileV2 | str] = None
    complexity_flag: Optional[ComplexityFlagV2 | str] = None
    is_thematic: bool = False
    is_sector_fund: bool = False
    is_index_like: bool = False
    is_suitable_low_risk: bool = False
    compatible_profiles: List[int] = Field(default_factory=list)
    classification_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    sources_used: List[str] = Field(default_factory=list)
    source_priority_used: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    computed_at: str = ""
    raw_name: str = ""

class EconomicExposureV2(BaseModel):
    equity: float = Field(default=0.0, ge=0.0, le=100.0)
    bond: float = Field(default=0.0, ge=0.0, le=100.0)
    cash: float = Field(default=0.0, ge=0.0, le=100.0)
    other: float = Field(default=0.0, ge=0.0, le=100.0)

class ExposureConcentrationMetrics(BaseModel):
    top_10_holdings_weight: float = Field(default=0.0, ge=0.0, le=100.0)
    hhi_index: Optional[float] = None

class PortfolioExposureV2(BaseModel):
    version: str = "2.0"
    asset_mix: Optional[EconomicExposureV2] = None
    economic_exposure: Optional[EconomicExposureV2] = None
    equity_regions: Optional[Dict[str, float]] = None
    equity_styles: Optional[Dict[str, float]] = None
    sectors: Optional[Dict[str, float]] = None
    market_caps: Optional[Dict[str, float]] = None
    bond_types: Optional[Dict[str, float]] = None
    credit: Optional[Dict[str, float]] = None
    duration: Optional[Dict[str, float]] = None
    fi_credit: Optional[Dict[str, float]] = None
    fi_duration: Optional[Dict[str, float]] = None
    fi_types: Optional[Dict[str, float]] = None
    alternatives: Optional[Dict[str, float]] = None
    concentration_metrics: Optional[ExposureConcentrationMetrics] = None
    risk_flags: List[str] = Field(default_factory=list)
    exposure_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    warnings: List[str] = Field(default_factory=list)
    computed_at: str = ""
