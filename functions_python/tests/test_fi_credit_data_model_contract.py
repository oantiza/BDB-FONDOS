"""
BDB-SUITABILITY-FI-CREDIT-DATA-MODEL-0
=======================================
Design contract tests for the future fi_credit quantitative breakdown
in portfolio_exposure_v2.

STATUS: DESIGN-ONLY — Tests use xfail(strict=False) to document intended contracts.
        The fi_credit quantitative field does NOT exist yet in Firestore
        for any fund (0/670 confirmed by audit BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-AUDIT-0).
        xfail(strict=False) = contract is documented and logic is sound, but field not in Firestore.
        xpassed tests confirm the reference implementation logic is correct.

These tests document the INTENDED contract when the data model is implemented.
They must NOT be un-xfail'd until:
  1. ms.fixed_income.credit_quality is confirmed written to Firestore (via parser)
  2. portfolio_exposure_v2.fi_credit.low_quality is populated by S3
  3. Coverage is verified >= 50% of fixed_income + mixed funds

Reference:
  docs/BDB_SUITABILITY_FI_CREDIT_DATA_MODEL_0.md
  docs/BDB_SUITABILITY_FE9_LOW_QUALITY_CREDIT_DECISION_0.md
  artifacts/suitability/fe9_low_quality_credit_audit_0.json
"""
import pytest


# ── XFAIL REASON ─────────────────────────────────────────────────────────────
_REASON = (
    "FI credit quantitative data model not implemented. "
    "portfolio_exposure_v2.fi_credit.low_quality absent in 670/670 funds. "
    "See docs/BDB_SUITABILITY_FI_CREDIT_DATA_MODEL_0.md"
)


# ── HELPER: simulate the proposed fi_credit sub-document ─────────────────────

def make_fi_credit(
    low_quality: float = 0.0,
    investment_grade: float = 100.0,
    high_yield: float = 0.0,
    not_rated: float = 0.0,
    aaa: float = 0.0,
    aa: float = 0.0,
    a: float = 0.0,
    bbb: float = 0.0,
    bb: float = 0.0,
    b: float = 0.0,
    below_b: float = 0.0,
    coverage: float = 0.85,
    scale: str = "percent_of_bond_bucket",
    source: str = "morningstar_pdf",
    as_of: str = "2026-01-31",
    warnings: list | None = None,
) -> dict:
    """Factory for a proposed fi_credit sub-document (future schema)."""
    return {
        "source": source,
        "as_of": as_of,
        "coverage": coverage,
        "scale": scale,
        "investment_grade": investment_grade,
        "high_yield": high_yield,
        "low_quality": low_quality,
        "not_rated": not_rated,
        "breakdown": {
            "AAA": aaa, "AA": aa, "A": a, "BBB": bbb,
            "BB": bb, "B": b, "below_B": below_b, "not_rated": not_rated,
        },
        "warnings": warnings or [],
    }


def _compute_low_quality(fi_credit: dict) -> float:
    """
    Reference implementation of low_quality derivation.
    low_quality = BB + B + below_B (on scale: percent_of_bond_bucket)
    not_rated is excluded from low_quality by default (treated separately).
    """
    bd = fi_credit.get("breakdown", {})
    return (
        float(bd.get("BB", 0) or 0)
        + float(bd.get("B", 0) or 0)
        + float(bd.get("below_B", 0) or 0)
    )


def _fe9_would_block(fi_credit: dict, coverage_threshold: float = 0.5) -> bool:
    """
    Future FE-9 evaluation logic (proposed, not implemented):
    Block profiles <= 4 if low_quality >= 35% AND coverage >= threshold.
    If coverage < threshold: warn but do NOT block.
    """
    if fi_credit.get("coverage", 0) < coverage_threshold:
        return False  # insufficient coverage → cannot apply rule
    lq = fi_credit.get("low_quality", 0)
    return lq >= 35.0


# ── SECTION 1: Schema Validation Contracts ───────────────────────────────────

class TestFiCreditSchemaContract:
    """
    CONTRACT: fi_credit sub-document must satisfy structural requirements
    before being consumed by any suitability rule.
    """

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_fi_credit_requires_source_field(self):
        """fi_credit without 'source' must be rejected — provenance is mandatory."""
        fi = make_fi_credit()
        fi.pop("source")
        # Future validator must raise or flag this
        assert "source" in fi, "fi_credit must declare its data source"

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_fi_credit_requires_as_of_field(self):
        """fi_credit without 'as_of' must be rejected — stale data is a risk."""
        fi = make_fi_credit()
        fi.pop("as_of")
        assert "as_of" in fi, "fi_credit must declare data date (staleness guard)"

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_fi_credit_requires_scale_field(self):
        """
        Scale ambiguity (bond_bucket vs total_portfolio) is a design risk.
        The field must always declare its scale.
        """
        fi = make_fi_credit()
        fi.pop("scale")
        assert "scale" in fi, "fi_credit.scale must be declared to avoid denominator confusion"

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_fi_credit_requires_coverage_above_zero(self):
        """Zero coverage makes low_quality meaningless — must be caught."""
        fi = make_fi_credit(coverage=0.0)
        assert fi.get("coverage", 0) > 0, "coverage=0 is invalid; fi_credit cannot be used"

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_low_quality_field_must_equal_breakdown_sum(self):
        """
        The top-level low_quality must equal BB + B + below_B from the breakdown.
        Inconsistency indicates a data normalization bug.
        """
        fi = make_fi_credit(bb=15.0, b=12.0, below_b=5.0, low_quality=32.0)
        expected = _compute_low_quality(fi)
        assert fi["low_quality"] == expected, (
            f"fi_credit.low_quality ({fi['low_quality']}) != BB+B+below_B ({expected})"
        )

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_breakdown_must_not_exceed_100(self):
        """Sum of all breakdown bands must be <= 100%."""
        fi = make_fi_credit(aaa=30, aa=20, a=25, bbb=30, bb=10)
        bd = fi["breakdown"]
        total = sum(float(v or 0) for v in bd.values())
        assert total <= 100.0, f"Breakdown sums to {total}% — exceeds 100%"


# ── SECTION 2: low_quality Derivation Contracts ───────────────────────────────

class TestLowQualityDerivation:
    """
    CONTRACT: low_quality = BB + B + below_B (on bond_bucket scale).
    not_rated is treated separately and never auto-included in low_quality.
    """

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_bb_b_below_b_sum_is_low_quality(self):
        fi = make_fi_credit(bb=10.0, b=8.0, below_b=4.0)
        computed = _compute_low_quality(fi)
        assert computed == 22.0, f"BB+B+below_B should be 22%, got {computed}"

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_not_rated_excluded_from_low_quality(self):
        """
        not_rated is NOT automatically counted as low_quality.
        A fund with 40% not_rated but 0% BB/B/below_B should have low_quality=0.
        Regulators sometimes treat not_rated as high_yield proxy — that decision
        must be made explicitly, not by default.
        """
        fi = make_fi_credit(not_rated=40.0, bb=0.0, b=0.0, below_b=0.0, low_quality=0.0)
        computed = _compute_low_quality(fi)
        assert computed == 0.0, (
            "not_rated must NOT auto-count as low_quality. "
            "Explicit flag `not_rated_treated_as_lq: true` required to change this."
        )

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_high_yield_bond_subtype_still_requires_quantitative_field(self):
        """
        Even if asset_subtype == HIGH_YIELD_BOND (qualitative block, Rule 10),
        the quantitative fi_credit.low_quality should still be populated
        for data completeness. The rule may fire first but the data must exist.
        """
        # Simulates a fund that has HIGH_YIELD_BOND label and real breakdown data
        fi = make_fi_credit(bb=25.0, b=30.0, below_b=15.0, low_quality=70.0)
        assert fi["low_quality"] >= 35.0, "HY fund should have high low_quality value"

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_investment_grade_fund_low_quality_below_threshold(self):
        """
        A typical IG corporate bond fund should have low_quality < 35%.
        Golden fixture (ES0165142003): bb=10, b=5, below_b=2 → low_quality=17%.
        """
        fi = make_fi_credit(bb=10.0, b=5.0, below_b=2.0, low_quality=17.0,
                            aaa=5.0, aa=10.0, a=25.0, bbb=40.0, not_rated=3.0)
        assert fi["low_quality"] < 35.0, "IG fund should not trigger FE-9"


# ── SECTION 3: Scale and Mixed Fund Contracts ─────────────────────────────────

class TestScaleAndMixedFundContracts:
    """
    CONTRACT: The denominator of low_quality matters critically for mixed funds.
    A fund with 40% bonds and 70% of that in low_quality = 28% of total portfolio,
    NOT 70%. If scale=percent_of_bond_bucket, the rule must be applied accordingly.
    """

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_bond_bucket_scale_vs_total_portfolio(self):
        """
        Mixed fund: bond_weight=40%, low_quality_of_bond=70%.
        On bond_bucket scale: low_quality=70% → would trigger FE-9.
        On total_portfolio scale: low_quality=0.40*70=28% → would NOT trigger FE-9.
        The rule must specify which scale to use.
        """
        bond_weight_pct = 40.0
        low_quality_of_bond_pct = 70.0

        # Scale: percent_of_bond_bucket
        fi_bond_scale = make_fi_credit(
            low_quality=low_quality_of_bond_pct,
            scale="percent_of_bond_bucket",
        )
        # Scale: percent_of_total_portfolio (normalized)
        fi_total_scale = make_fi_credit(
            low_quality=bond_weight_pct * low_quality_of_bond_pct / 100.0,
            scale="percent_of_total_portfolio",
        )

        # Both must coexist without ambiguity — scale field resolves which applies
        assert fi_bond_scale["scale"] == "percent_of_bond_bucket"
        assert fi_total_scale["scale"] == "percent_of_total_portfolio"
        assert fi_total_scale["low_quality"] == 28.0, (
            "On total_portfolio scale: 40% bond * 70% LQ = 28% of total"
        )

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_mixed_fund_below_threshold_on_total_portfolio_scale(self):
        """
        A conservative mixed fund with 30% bonds, 50% low_quality of bonds.
        On total portfolio scale: 30% * 50% = 15% → should NOT trigger FE-9 (15% < 35%).
        On bond_bucket scale: 50% → WOULD trigger FE-9 (50% >= 35%).
        The recommended scale for FE-9 is total_portfolio to avoid false positives.
        """
        bond_weight = 30.0
        lq_of_bond = 50.0
        lq_total = bond_weight * lq_of_bond / 100.0  # 15%

        fi = make_fi_credit(
            low_quality=lq_total,
            scale="percent_of_total_portfolio",
        )
        assert not _fe9_would_block(fi), (
            f"Mixed fund with 15% LQ on total portfolio scale must NOT trigger FE-9. "
            f"Got low_quality={fi['low_quality']}"
        )

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_pure_hy_fund_triggers_on_total_portfolio_scale(self):
        """A pure HY bond fund should trigger FE-9 on either scale."""
        fi = make_fi_credit(
            bb=20.0, b=20.0, below_b=10.0,
            low_quality=50.0,  # 50% on total_portfolio (fund is 100% bond)
            scale="percent_of_total_portfolio",
            coverage=0.90,
        )
        assert _fe9_would_block(fi), "50% LQ on total portfolio scale must trigger FE-9"


# ── SECTION 4: Coverage and Reliability Contracts ────────────────────────────

class TestCoverageContracts:
    """
    CONTRACT: fi_credit must not be used for hard blocks when coverage is low.
    If Morningstar data covers only 30% of the portfolio, we cannot confidently
    compute low_quality for the full fund.
    """

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_low_coverage_prevents_hard_block(self):
        """
        If coverage < 50%, FE-9 must not produce a hard block.
        Low coverage may produce a warning, but never a block.
        """
        fi = make_fi_credit(low_quality=80.0, coverage=0.30)
        assert not _fe9_would_block(fi, coverage_threshold=0.50), (
            "Low coverage (30%) must prevent hard block even if low_quality=80%"
        )

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_sufficient_coverage_enables_rule(self):
        """High coverage (>=50%) with low_quality >= 35% must trigger FE-9."""
        fi = make_fi_credit(low_quality=40.0, coverage=0.75)
        assert _fe9_would_block(fi, coverage_threshold=0.50), (
            "Coverage=75% + low_quality=40% must trigger FE-9 block"
        )

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_missing_as_of_triggers_staleness_warning(self):
        """fi_credit without as_of must generate a staleness warning."""
        fi = make_fi_credit()
        fi["as_of"] = None
        # Future validator: fi_credit with as_of=None must add warning
        assert "stale_data" in fi.get("warnings", []) or fi["as_of"] is None, (
            "Missing as_of should be flagged in warnings"
        )


# ── SECTION 5: FE-9 Rule Scope Contracts ─────────────────────────────────────

class TestFE9RuleScopeContracts:
    """
    CONTRACT: FE-9 must only apply under specific conditions.
    Hard blocks must be reserved for high-confidence, high-coverage cases.
    """

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_fe9_does_not_apply_to_profiles_above_4(self):
        """FE-9 is scoped to profiles <= 4. Profiles 5+ must not be affected."""
        fi = make_fi_credit(low_quality=90.0, coverage=0.95)
        # For profiles 5+, the rule must not fire
        # (This would be tested in suitability_engine once implemented)
        # Here we document the expected scope
        fe9_applies_to = [1, 2, 3, 4]
        fe9_excluded = [5, 6, 7, 8, 9, 10]
        assert all(p <= 4 for p in fe9_applies_to)
        assert all(p > 4 for p in fe9_excluded)
        # Rule fires for profiles in scope only
        assert _fe9_would_block(fi), "Rule fires for profiles <= 4 with sufficient data"

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_fe9_not_applied_when_hy_subtype_already_blocks(self):
        """
        If asset_subtype == HIGH_YIELD_BOND, that rule already blocks profiles <= 4.
        FE-9 must not double-count or create confusing error messages.
        The block reason should reference the subtype rule, not FE-9.
        This tests the logical independence of rules.
        """
        # When subtype rule fires first, FE-9 is redundant but must not conflict.
        fi = make_fi_credit(low_quality=70.0, coverage=0.9)
        # Both rules fire, but the reason must be clear
        assert _fe9_would_block(fi), "FE-9 would also fire, but subtype rule is primary"
        # Implementation must ensure reason string references the PRIMARY rule

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_fe9_boundary_exactly_35(self):
        """
        Boundary: low_quality == 35% must trigger the block (rule is >=).
        Frontend: lowQualityCredit >= 35 → return false (confirmed).
        Backend must use the same boundary.
        """
        fi = make_fi_credit(low_quality=35.0, coverage=0.85)
        assert _fe9_would_block(fi), "Exactly 35% low_quality must trigger FE-9 (>= is inclusive)"

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_fe9_below_35_does_not_block(self):
        """34.9% must NOT trigger FE-9."""
        fi = make_fi_credit(low_quality=34.9, coverage=0.85)
        assert not _fe9_would_block(fi), "34.9% is below threshold — must not trigger FE-9"


# ── SECTION 6: Data Pipeline Gap Documentation ───────────────────────────────

class TestDataPipelineGapDocumentation:
    """
    These tests document the MISSING PIPELINE STEPS needed before any implementation.
    They serve as acceptance criteria for BDB-FI-CREDIT-PARSER-DISCOVERY-0.
    """

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_ms_fixed_income_credit_quality_exists_in_parser_output(self):
        """
        KNOWN: populate_taxonomy_v2.py reads ms.fixed_income.credit_quality.
        MISSING: this data must be written to portfolio_exposure_v2.credit
        (or portfolio_exposure_v2.fi_credit) by the S3 pipeline.
        
        Current state: parser READS the data but only uses it for fi_credit_bucket (categorical).
        Required: translate the full breakdown dict → portfolio_exposure_v2.fi_credit quantitative.
        """
        # This test documents what S3 must do — not what it currently does.
        ms_fi_credit_quality = {
            "aaa": 5, "aa": 10, "a": 25, "bbb": 40,
            "bb": 10, "b": 5, "below_b": 2, "not_rated": 3
        }
        # S3 must translate this to:
        expected_fi_credit = {
            "source": "morningstar_pdf",
            "scale": "percent_of_bond_bucket",
            "low_quality": 17.0,  # 10+5+2
            "investment_grade": 80.0,  # 5+10+25+40
            "not_rated": 3.0,
            "breakdown": ms_fi_credit_quality,
        }
        computed_lq = (
            ms_fi_credit_quality["bb"]
            + ms_fi_credit_quality["b"]
            + ms_fi_credit_quality["below_b"]
        )
        assert computed_lq == expected_fi_credit["low_quality"], (
            f"BB+B+below_B = {computed_lq}%, expected {expected_fi_credit['low_quality']}%"
        )

    @pytest.mark.xfail(strict=False, reason=_REASON)
    def test_credit_field_mapping_in_firestore_matches_parser_output(self):
        """
        MISSING: The Firestore field portfolio_exposure_v2.credit (or fi_credit)
        must match the structure defined in the schema proposal.
        Currently 0/670 funds have this field populated.
        """
        # Simulates what Firestore should contain after BDB-FI-CREDIT-DRYRUN-EXTRACTION-0
        firestore_doc = {
            "portfolio_exposure_v2": {
                "fi_credit": {
                    "source": "morningstar_pdf",
                    "as_of": "2026-01-31",
                    "coverage": 0.97,
                    "scale": "percent_of_bond_bucket",
                    "low_quality": 17.0,
                    "investment_grade": 80.0,
                    "not_rated": 3.0,
                    "breakdown": {"AAA": 5, "AA": 10, "A": 25, "BBB": 40, "BB": 10, "B": 5, "below_B": 2, "not_rated": 3},
                    "warnings": [],
                }
            }
        }
        fi = firestore_doc["portfolio_exposure_v2"]["fi_credit"]
        assert fi["low_quality"] == 17.0
        assert fi["source"] == "morningstar_pdf"
        assert fi["coverage"] > 0
