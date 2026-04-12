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
    asset_type: AssetClassV2 = AssetClassV2.UNKNOWN
    asset_subtype: AssetSubtypeV2 = AssetSubtypeV2.UNKNOWN
    strategy_type: StrategyTypeV2 = StrategyTypeV2.UNKNOWN
    risk_bucket: RiskBucketV2 = RiskBucketV2.UNKNOWN
    region_primary: RegionV2 = RegionV2.UNKNOWN
    region_secondary: str = ""
    geographic_scope: str = ""
    equity_style_box: EquityStyleBoxV2 = EquityStyleBoxV2.UNKNOWN
    market_cap_bias: MarketCapBiasV2 = MarketCapBiasV2.UNKNOWN
    sector_focus: SectorFocusV2 = SectorFocusV2.UNKNOWN
    sector_concentration: ConcentrationLevelV2 = ConcentrationLevelV2.LOW
    fi_duration_bucket: FIDurationBucketV2 = FIDurationBucketV2.UNKNOWN
    fi_credit_bucket: FICreditBucketV2 = FICreditBucketV2.UNKNOWN
    fi_type: FITypeV2 = FITypeV2.UNKNOWN
    alternative_bucket: AlternativeBucketV2 = AlternativeBucketV2.UNKNOWN
    convertibles_profile: ConvertiblesProfileV2 = ConvertiblesProfileV2.UNKNOWN
    liquidity_profile: LiquidityProfileV2 = LiquidityProfileV2.DAILY
    complexity_flag: ComplexityFlagV2 = ComplexityFlagV2.STANDARD
    is_thematic: bool = False
    is_sector_fund: bool = False
    is_index_like: bool = False
    is_suitable_low_risk: bool = False
    classification_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
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
    economic_exposure: EconomicExposureV2 = Field(default_factory=EconomicExposureV2)
    equity_regions: Dict[str, float] = Field(default_factory=dict)
    equity_styles: Dict[str, float] = Field(default_factory=dict)
    sectors: Dict[str, float] = Field(default_factory=dict)
    fi_credit: Dict[str, float] = Field(default_factory=dict)
    fi_duration: Dict[str, float] = Field(default_factory=dict)
    fi_types: Dict[str, float] = Field(default_factory=dict)
    alternatives: Dict[str, float] = Field(default_factory=dict)
    concentration_metrics: ExposureConcentrationMetrics = Field(
        default_factory=ExposureConcentrationMetrics
    )
    risk_flags: List[str] = Field(default_factory=list)
    exposure_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    warnings: List[str] = Field(default_factory=list)
    computed_at: str = ""
