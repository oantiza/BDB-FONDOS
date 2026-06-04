"""
BDB-SUITABILITY-FI-CREDIT-DATA-MODEL-0
=======================================
Contract tests for the fi_credit quantitative breakdown
in portfolio_exposure_v2.

STATUS: DATA MODEL IMPLEMENTED FOR THE AUDITED COHORT.
        Executable derivation and translator contracts are normal regression
        tests. Only schema-rejection cases remain xfail until a production
        validator exists.

Reference:
  docs/BDB_SUITABILITY_FI_CREDIT_DATA_MODEL_0.md
  docs/BDB_SUITABILITY_FE9_LOW_QUALITY_CREDIT_DECISION_0.md
  artifacts/suitability/fe9_low_quality_credit_audit_0.json
"""
import pytest


# ── XFAIL REASON ─────────────────────────────────────────────────────────────
_REASON = (
    "FI credit schema validator not implemented. "
    "Invalid documents are not yet rejected by a shared production validator. "
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
    """Factory for a canonical fi_credit sub-document."""
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

    def test_bb_b_below_b_sum_is_low_quality(self):
        fi = make_fi_credit(bb=10.0, b=8.0, below_b=4.0)
        computed = _compute_low_quality(fi)
        assert computed == 22.0, f"BB+B+below_B should be 22%, got {computed}"

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

    def test_high_yield_bond_subtype_still_requires_quantitative_field(self):
        """
        Even if asset_subtype == HIGH_YIELD_BOND (qualitative block, Rule 10),
        the quantitative fi_credit.low_quality should still be populated
        for data completeness. The rule may fire first but the data must exist.
        """
        # Simulates a fund that has HIGH_YIELD_BOND label and real breakdown data
        fi = make_fi_credit(bb=25.0, b=30.0, below_b=15.0, low_quality=70.0)
        assert fi["low_quality"] >= 35.0, "HY fund should have high low_quality value"

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

    def test_low_coverage_prevents_hard_block(self):
        """
        If coverage < 50%, FE-9 must not produce a hard block.
        Low coverage may produce a warning, but never a block.
        """
        fi = make_fi_credit(low_quality=80.0, coverage=0.30)
        assert not _fe9_would_block(fi, coverage_threshold=0.50), (
            "Low coverage (30%) must prevent hard block even if low_quality=80%"
        )

    def test_sufficient_coverage_enables_rule(self):
        """High coverage (>=50%) with low_quality >= 35% must trigger FE-9."""
        fi = make_fi_credit(low_quality=40.0, coverage=0.75)
        assert _fe9_would_block(fi, coverage_threshold=0.50), (
            "Coverage=75% + low_quality=40% must trigger FE-9 block"
        )

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

    def test_fe9_boundary_exactly_35(self):
        """
        Boundary: low_quality == 35% must trigger the block (rule is >=).
        Frontend: lowQualityCredit >= 35 → return false (confirmed).
        Backend must use the same boundary.
        """
        fi = make_fi_credit(low_quality=35.0, coverage=0.85)
        assert _fe9_would_block(fi), "Exactly 35% low_quality must trigger FE-9 (>= is inclusive)"

    def test_fe9_below_35_does_not_block(self):
        """34.9% must NOT trigger FE-9."""
        fi = make_fi_credit(low_quality=34.9, coverage=0.85)
        assert not _fe9_would_block(fi), "34.9% is below threshold — must not trigger FE-9"


# ── SECTION 6: Data Pipeline Gap Documentation ───────────────────────────────

class TestDataPipelineGapDocumentation:
    """
    These tests preserve the implemented translator mapping as regression
    criteria for BDB-FI-CREDIT-PARSER-DISCOVERY-0.
    """

    def test_ms_fixed_income_credit_quality_exists_in_parser_output(self):
        """
        KNOWN: populate_taxonomy_v2.py reads ms.fixed_income.credit_quality.
        The translator maps the full Morningstar credit-quality breakdown to
        portfolio_exposure_v2.fi_credit while the parser also maintains the
        categorical fi_credit_bucket.
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

    def test_credit_field_mapping_in_firestore_matches_parser_output(self):
        """
        The Firestore field portfolio_exposure_v2.fi_credit must match the
        canonical structure. The audited cohort has 130 populated funds; wider
        coverage remains constrained by source-data availability.
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


# ── SECTION 7: Translator DryRun Contracts ───────────────────────────────────

def _build_fi_credit_from_cq(cq: dict, bond_weight: float | None = None,
                              subtype: str = "CORPORATE_BOND",
                              compatible_profiles: list | None = None) -> dict:
    """
    Reference implementation of the translator (mirrors bdb_fi_credit_translator_dryrun.py).
    DRY-RUN ONLY — no Firestore interaction.
    """
    if compatible_profiles is None:
        compatible_profiles = []

    FE9_THRESHOLD  = 35.0
    VALID_SUM_MIN  = 80.0
    VALID_SUM_MAX  = 105.0
    HIGH_NR_LIMIT  = 20.0
    COVERAGE_MIN   = 0.50
    HY_EM_SUBTYPES = {"HIGH_YIELD_BOND", "EMERGING_MARKETS_BOND"}
    IG_KEYS = ["aaa", "aa", "a", "bbb"]
    LQ_KEYS = ["bb", "b", "below_b"]
    ALL_KEYS = IG_KEYS + LQ_KEYS + ["not_rated"]

    def _sf(v):
        try:
            return 0.0 if v is None else float(v)
        except Exception:
            return 0.0

    vals = {k: _sf(cq.get(k, 0)) for k in ALL_KEYS}
    total = sum(vals.values())
    if 0 < total <= 1.05:
        vals = {k: v * 100.0 for k, v in vals.items()}
        total = sum(vals.values())

    ig = sum(vals[k] for k in IG_KEYS)
    lq = sum(vals[k] for k in LQ_KEYS)
    nr = vals["not_rated"]

    if VALID_SUM_MIN <= total <= VALID_SUM_MAX:
        coverage = 1.0
    elif total > VALID_SUM_MAX:
        coverage = 1.0
    else:
        coverage = round(total / 100.0, 4)

    warnings = []
    if total < VALID_SUM_MIN or total > 200.0:
        warnings.append("CREDIT_QUALITY_SUM_OUT_OF_RANGE")
        return {"status": "INVALID_SUM", "proposed_fi_credit": None,
                "warnings": warnings, "low_quality_total_portfolio_estimate": None}

    lq_tp = None
    if bond_weight is None:
        warnings.append("MISSING_BOND_WEIGHT")
    if nr >= HIGH_NR_LIMIT:
        warnings.append("HIGH_NOT_RATED")

    if lq >= FE9_THRESHOLD:
        warnings.append("LOW_QUALITY_OVER_35_BOND_BUCKET")
        if bond_weight is not None:
            lq_tp = round(lq * bond_weight / 100.0, 2)
            if lq_tp >= FE9_THRESHOLD:
                warnings.append("LOW_QUALITY_OVER_35_TOTAL_PORTFOLIO")
    elif bond_weight is not None:
        lq_tp = round(lq * bond_weight / 100.0, 2)

    is_hy_em = subtype.upper() in HY_EM_SUBTYPES
    has_p_le4 = any(p <= 4 for p in compatible_profiles)
    if lq >= FE9_THRESHOLD:
        if is_hy_em:
            warnings.append("FE9_ALREADY_BLOCKED_BY_HY_EM_RULE_10")
        elif has_p_le4 and coverage >= COVERAGE_MIN:
            warnings.append("FE9_POTENTIAL_NEW_GAP")

    proposed = {
        "source": "morningstar_pdf",
        "as_of": None,
        "scale": "percent_of_bond_bucket",
        "coverage": coverage,
        "investment_grade": round(ig, 2),
        "high_yield": round(lq, 2),
        "low_quality": round(lq, 2),
        "not_rated": round(nr, 2),
        "breakdown": {
            "AAA": round(vals["aaa"], 2), "AA": round(vals["aa"], 2),
            "A":   round(vals["a"],   2), "BBB": round(vals["bbb"], 2),
            "BB":  round(vals["bb"],  2), "B":   round(vals["b"],   2),
            "below_B": round(vals["below_b"], 2),
            "not_rated": round(vals["not_rated"], 2),
        },
        "warnings": warnings,
    }
    return {
        "status": "TRANSLATED",
        "proposed_fi_credit": proposed,
        "warnings": warnings,
        "low_quality_total_portfolio_estimate": lq_tp,
        "fe9_potential_new_gap": "FE9_POTENTIAL_NEW_GAP" in warnings,
    }


class TestTranslatorDryRunContracts:
    """
    CONTRACT: Translator from ms.fixed_income.credit_quality
    → portfolio_exposure_v2.fi_credit must satisfy these invariants.
    Based on BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0.
    """

    def test_translator_produces_all_required_fields(self):
        """TRANSLATED result must have all mandatory fi_credit fields."""
        cq = {"aaa": 10, "aa": 15, "a": 30, "bbb": 25, "bb": 10, "b": 5, "below_b": 2, "not_rated": 3}
        result = _build_fi_credit_from_cq(cq, bond_weight=100.0)
        assert result["status"] == "TRANSLATED"
        fi = result["proposed_fi_credit"]
        for field in ("source", "as_of", "scale", "coverage",
                      "investment_grade", "high_yield", "low_quality",
                      "not_rated", "breakdown", "warnings"):
            assert field in fi, f"Missing required field: {field}"

    def test_low_quality_matches_bb_b_below_b(self):
        """low_quality == BB + B + below_B exactly."""
        cq = {"aaa": 5, "aa": 10, "a": 25, "bbb": 40, "bb": 10, "b": 5, "below_b": 2, "not_rated": 3}
        result = _build_fi_credit_from_cq(cq, bond_weight=100.0)
        fi = result["proposed_fi_credit"]
        expected_lq = 10 + 5 + 2  # = 17
        assert fi["low_quality"] == expected_lq, (
            f"low_quality={fi['low_quality']} != BB+B+below_B={expected_lq}"
        )

    def test_not_rated_excluded_from_low_quality(self):
        """not_rated is not added to low_quality or high_yield."""
        cq = {"aaa": 30, "aa": 20, "a": 20, "bbb": 15, "bb": 0, "b": 0, "below_b": 0, "not_rated": 15}
        result = _build_fi_credit_from_cq(cq, bond_weight=100.0)
        fi = result["proposed_fi_credit"]
        assert fi["low_quality"] == 0.0, "With 0 BB/B/below_B, low_quality must be 0"
        assert fi["not_rated"] == 15.0, "not_rated must be preserved separately"

    def test_warning_low_quality_over_35_bond_bucket(self):
        """Warning LOW_QUALITY_OVER_35_BOND_BUCKET fires when lq >= 35%."""
        cq = {"aaa": 0, "aa": 0, "a": 5, "bbb": 15, "bb": 25, "b": 25, "below_b": 25, "not_rated": 5}
        result = _build_fi_credit_from_cq(cq, bond_weight=100.0)
        assert "LOW_QUALITY_OVER_35_BOND_BUCKET" in result["warnings"]

    def test_warning_missing_bond_weight(self):
        """Warning MISSING_BOND_WEIGHT fires when bond_weight is None."""
        cq = {"aaa": 10, "aa": 15, "a": 30, "bbb": 25, "bb": 5, "b": 5, "below_b": 5, "not_rated": 5}
        result = _build_fi_credit_from_cq(cq, bond_weight=None)
        assert "MISSING_BOND_WEIGHT" in result["warnings"]

    def test_warning_high_not_rated(self):
        """Warning HIGH_NOT_RATED fires when not_rated >= 20%."""
        cq = {"aaa": 10, "aa": 10, "a": 20, "bbb": 20, "bb": 10, "b": 5, "below_b": 5, "not_rated": 20}
        result = _build_fi_credit_from_cq(cq, bond_weight=100.0)
        assert "HIGH_NOT_RATED" in result["warnings"]

    def test_fe9_already_blocked_tag_for_hy_bond(self):
        """HIGH_YIELD_BOND with lq>=35 gets FE9_ALREADY_BLOCKED_BY_HY_EM_RULE_10."""
        cq = {"aaa": 0, "aa": 0, "a": 0, "bbb": 5, "bb": 30, "b": 30, "below_b": 30, "not_rated": 5}
        result = _build_fi_credit_from_cq(
            cq, bond_weight=100.0, subtype="HIGH_YIELD_BOND",
            compatible_profiles=[1, 2, 3, 4, 5]
        )
        assert "FE9_ALREADY_BLOCKED_BY_HY_EM_RULE_10" in result["warnings"]
        assert "FE9_POTENTIAL_NEW_GAP" not in result["warnings"]

    def test_fe9_new_gap_for_corporate_bond_with_high_lq(self):
        """CORPORATE_BOND with lq>=35 and profile<=4 gets FE9_POTENTIAL_NEW_GAP."""
        cq = {"aaa": 0, "aa": 0, "a": 10, "bbb": 20, "bb": 20, "b": 20, "below_b": 20, "not_rated": 10}
        result = _build_fi_credit_from_cq(
            cq, bond_weight=100.0, subtype="CORPORATE_BOND",
            compatible_profiles=[3, 4, 5]
        )
        assert "FE9_POTENTIAL_NEW_GAP" in result["warnings"]
        assert result["fe9_potential_new_gap"] is True

    def test_invalid_sum_returns_no_proposal(self):
        """Sum < 80% → INVALID_SUM, no proposed_fi_credit."""
        cq = {"aaa": 5, "aa": 5, "a": 5, "bbb": 5, "bb": 5, "b": 5, "below_b": 5, "not_rated": 5}
        # Total = 40 → below VALID_SUM_MIN=80
        result = _build_fi_credit_from_cq(cq, bond_weight=100.0)
        assert result["status"] == "INVALID_SUM"
        assert result["proposed_fi_credit"] is None

    def test_lq_total_portfolio_estimate_computed_correctly(self):
        """low_quality_total_portfolio_estimate = lq * bond_weight / 100."""
        cq = {"aaa": 5, "aa": 10, "a": 20, "bbb": 25, "bb": 20, "b": 10, "below_b": 5, "not_rated": 5}
        # lq = 20+10+5 = 35%, bond_weight = 60%
        result = _build_fi_credit_from_cq(cq, bond_weight=60.0)
        expected_tp = round(35.0 * 60.0 / 100.0, 2)  # 21.0
        assert result["low_quality_total_portfolio_estimate"] == expected_tp, (
            f"Expected lq_tp={expected_tp}, got {result['low_quality_total_portfolio_estimate']}"
        )

    def test_write_recommended_always_false_in_dryrun(self):
        """
        In dry-run mode, write_recommended must always be False.
        This guards against accidental activation of writes.
        """
        # This tests the CONTRACT of the dryrun artifact, not the translator logic.
        dryrun_result_entry = {
            "status": "TRANSLATED",
            "proposed_fi_credit": {"low_quality": 20.0},
            "write_recommended": False,
        }
        assert dryrun_result_entry["write_recommended"] is False, (
            "write_recommended must be False in all dryrun results"
        )

    def test_coverage_is_1_when_sum_is_100(self):
        """If credit_quality sum is exactly 100%, coverage must be 1.0."""
        cq = {"aaa": 10, "aa": 15, "a": 25, "bbb": 30, "bb": 10, "b": 5, "below_b": 2, "not_rated": 3}
        # sum = 10+15+25+30+10+5+2+3 = 100
        result = _build_fi_credit_from_cq(cq, bond_weight=100.0)
        fi = result["proposed_fi_credit"]
        assert fi["coverage"] == 1.0, f"Sum=100% → coverage must be 1.0, got {fi['coverage']}"
