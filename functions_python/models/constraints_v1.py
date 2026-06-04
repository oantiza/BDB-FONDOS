from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class BoundRange(BaseModel):
    min: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    max: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _validate_min_max(self):
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("BoundRange requires min <= max")
        return self


class VolBand(BaseModel):
    min: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    max: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _validate_min_max(self):
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("VolBand requires min <= max")
        return self


class RiskBudgetV1(BaseModel):
    target_vol: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    vol_band: VolBand = Field(default_factory=VolBand)
    target_return: Optional[float] = Field(default=None)


class BucketBoundsV1(BaseModel):
    equity: BoundRange = Field(default_factory=BoundRange)
    bond: BoundRange = Field(default_factory=BoundRange)
    cash: BoundRange = Field(default_factory=BoundRange)
    alternative: BoundRange = Field(default_factory=BoundRange)
    real_asset: BoundRange = Field(default_factory=BoundRange)
    other: BoundRange = Field(default_factory=BoundRange)


class ConstructionRulesV1(BaseModel):
    min_weight: float = Field(default=0.0, ge=0.0, le=1.0)
    max_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    cutoff: float = Field(default=0.02, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _validate_weight_bounds(self):
        if self.min_weight > self.max_weight:
            raise ValueError("ConstructionRulesV1 requires min_weight <= max_weight")
        return self


class LockRulesV1(BaseModel):
    mode: Literal["keep_weight", "keep_money", "min_keep", "free"] = "keep_weight"
    positions: Dict[str, float] = Field(default_factory=dict)


class TacticalViewsV1(BaseModel):
    by_isin: Dict[str, float] = Field(default_factory=dict)


class ConstraintFlagsV1(BaseModel):
    apply_profile: bool = True
    strict_feasibility: bool = False


class PortfolioConstraintsV1(BaseModel):
    version: Literal["1.0"] = "1.0"
    profile_id: str = "5"
    optimization_mode: str = "rebalance_to_profile"
    objective: Literal["efficient_risk", "max_sharpe", "min_vol", "target_return"] = "efficient_risk"
    risk_budget: RiskBudgetV1 = Field(default_factory=RiskBudgetV1)
    bucket_bounds: BucketBoundsV1 = Field(default_factory=BucketBoundsV1)
    construction: ConstructionRulesV1 = Field(default_factory=ConstructionRulesV1)
    locks: LockRulesV1 = Field(default_factory=LockRulesV1)
    views: TacticalViewsV1 = Field(default_factory=TacticalViewsV1)
    flags: ConstraintFlagsV1 = Field(default_factory=ConstraintFlagsV1)
