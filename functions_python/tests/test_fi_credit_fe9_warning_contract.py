"""
BDB-FI-CREDIT-FE9-SOFT-WARNING-DESIGN-0
=========================================
Design contract tests for the FE-9 soft warning:
  "FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET"

STATUS: BACKEND SOURCE IMPLEMENTED — Tests exercise the pure backend warning
        engine. It is intentionally not integrated with endpoints or frontend,
        so activating presentation remains a separate compliance decision.

Key contracts:
  1. Warning is informational only — blocking=False always.
  2. Warning triggers on fi_credit.low_quality >= 35% (percent_of_bond_bucket).
  3. Warning requires coverage >= 0.8 and source present.
  4. not_rated is NOT included in low_quality for warning purposes.
  5. Warning does NOT modify compatible_profiles.
  6. Warning is per-fund, not per-profile.
  7. Severity levels: INFO (25-35%), WARNING (35-70%), REVIEW (>= 70%).
  8. scale must be explicitly "percent_of_bond_bucket".
  9. If scale or coverage is insufficient, no warning is emitted.
 10. Hard block is FORBIDDEN by this contract.

Reference:
  docs/BDB_FI_CREDIT_FE9_SOFT_WARNING_DESIGN_0.md
  docs/BDB_FI_CREDIT_FE9_IMPACT_AUDIT_0.md
  artifacts/suitability/fi_credit_fe9_impact_audit_0.json
"""
import pytest

from services.portfolio.fi_credit_warnings import compute_fi_credit_warnings


# ── HELPERS: Warning reference implementations ────────────────────────────────

def _make_fi_credit(
    low_quality: float = 0.0,
    investment_grade: float = 100.0,
    not_rated: float = 0.0,
    coverage: float = 1.0,
    scale: str = "percent_of_bond_bucket",
    source: str = "morningstar_pdf",
    as_of: str | None = "2026-01-31",
) -> dict:
    """Minimal fi_credit dict for warning contract tests."""
    return {
        "source":           source,
        "as_of":            as_of,
        "scale":            scale,
        "coverage":         coverage,
        "investment_grade": investment_grade,
        "low_quality":      low_quality,
        "high_yield":       low_quality,  # alias
        "not_rated":        not_rated,
    }


def _build_fe9_warning(fi_credit: dict, bond_weight: float = 100.0) -> dict | None:
    """Adapt the historical single-warning contract to the production API."""
    warnings = compute_fi_credit_warnings(
        {"portfolio_exposure_v2": {"fi_credit": fi_credit}},
        bond_weight=bond_weight,
    )
    return warnings[0] if warnings else None


# ── SECTION 1: Core invariants (never xfail — these must always pass) ─────────

class TestFE9WarningInvariants:
    """
    Core invariants of the FE-9 warning contract.
    These tests use the pure backend implementation only — no Firestore.
    They verify the warning source of truth without activating presentation.
    """

    def test_blocking_is_always_false_warning_case(self):
        """blocking=False is an absolute invariant for WARNING severity."""
        fi = _make_fi_credit(low_quality=39.1, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None, "Warning should be emitted for lq=39.1%"
        assert w["blocking"] is False, "FE-9 warning MUST never be blocking"

    def test_blocking_is_always_false_review_case(self):
        """blocking=False even for REVIEW severity (very high lq)."""
        fi = _make_fi_credit(low_quality=86.9, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None
        assert w["blocking"] is False, "REVIEW warning must also be non-blocking"

    def test_no_warning_below_25_percent(self):
        """No warning emitted when low_quality < 25%."""
        fi = _make_fi_credit(low_quality=20.0, coverage=1.0)
        w  = _build_fe9_warning(fi)
        assert w is None, "No warning for lq=20%"

    def test_no_warning_without_source(self):
        """Warning must not be emitted without a provenance source."""
        fi = _make_fi_credit(low_quality=60.0, coverage=1.0, source="")
        w  = _build_fe9_warning(fi)
        assert w is None, "No warning without source — provenance required"

    def test_no_warning_insufficient_coverage(self):
        """Warning must not be emitted when coverage < 0.8 (data unreliable)."""
        fi = _make_fi_credit(low_quality=60.0, coverage=0.5)
        w  = _build_fe9_warning(fi)
        assert w is None, "No warning when coverage < 0.8"

    def test_no_warning_wrong_scale(self):
        """Warning must not be emitted for unknown or total_portfolio scale."""
        fi = _make_fi_credit(low_quality=60.0, coverage=1.0, scale="percent_of_total_portfolio")
        w  = _build_fe9_warning(fi)
        assert w is None, "Warning requires explicit percent_of_bond_bucket scale"

    def test_not_rated_excluded_from_low_quality_in_warning(self):
        """not_rated is NOT included in low_quality — it is reported separately."""
        fi = _make_fi_credit(low_quality=30.0, not_rated=25.0, coverage=1.0)
        w  = _build_fe9_warning(fi)
        # lq=30% < 35% so INFO range
        if w is not None:
            assert w["not_rated"] == 25.0
            assert w["low_quality"] == 30.0
            # low_quality must never include not_rated
            assert w["low_quality"] != w["low_quality"] + w["not_rated"]

    def test_lq_total_portfolio_computed_from_bond_weight(self):
        """lq_total_portfolio_estimate = low_quality * bond_weight / 100."""
        fi = _make_fi_credit(low_quality=60.0, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=50.0)
        assert w is not None
        assert abs(w["low_quality_total_portfolio_estimate"] - 30.0) < 0.1

    def test_lq_total_portfolio_equals_lq_when_100pct_bond(self):
        """When bond_weight=100%, total portfolio estimate equals bond bucket lq."""
        fi = _make_fi_credit(low_quality=58.0, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None
        assert abs(w["low_quality_total_portfolio_estimate"] - 58.0) < 0.1


# ── SECTION 2: Severity thresholds ───────────────────────────────────────────

class TestFE9WarningSeverityLevels:
    """Contract tests for severity classification thresholds."""

    def test_severity_info_at_30pct(self):
        fi = _make_fi_credit(low_quality=30.0, coverage=1.0)
        w  = _build_fe9_warning(fi)
        assert w is not None
        assert w["severity"] == "INFO"

    def test_severity_warning_at_39pct(self):
        """Carmignac Pf Credit: lq=39.1% -> WARNING."""
        fi = _make_fi_credit(low_quality=39.1, coverage=1.0)
        w  = _build_fe9_warning(fi)
        assert w is not None
        assert w["severity"] == "WARNING"
        assert w["blocking"] is False

    def test_severity_warning_at_60pct(self):
        """Sycomore / Nordea crossover range: lq~60% -> WARNING."""
        fi = _make_fi_credit(low_quality=60.0, coverage=1.0)
        w  = _build_fe9_warning(fi)
        assert w is not None
        assert w["severity"] == "WARNING"

    def test_severity_review_at_87pct(self):
        """abrdn Frontier Markets: lq=86.9% -> REVIEW."""
        fi = _make_fi_credit(low_quality=86.9, coverage=1.0)
        w  = _build_fe9_warning(fi)
        assert w is not None
        assert w["severity"] == "REVIEW"
        assert w["blocking"] is False  # even REVIEW cannot block

    def test_severity_review_at_84pct(self):
        """Allianz Credit Opportunities Plus: lq=83.9% -> REVIEW."""
        fi = _make_fi_credit(low_quality=83.9, coverage=1.0)
        w  = _build_fe9_warning(fi)
        assert w is not None
        assert w["severity"] == "REVIEW"


# ── SECTION 3: The 7 FE9_POTENTIAL_NEW_GAP funds (contract) ──────────────────

class TestFE9WarningFor7GapFunds:
    """
    Contract tests using real fi_credit data from the 7 FE9_POTENTIAL_NEW_GAP funds.
    Data from: artifacts/suitability/fi_credit_fe9_impact_audit_0.json
    These tests use local synthetic data matching the live values.
    """

    def test_sycomore_selection_credit_gets_warning(self):
        """FR0011288513 — Sycomore Sélection Crédit — lq=60% -> WARNING."""
        fi = _make_fi_credit(low_quality=59.96, investment_grade=38.16, not_rated=1.87, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None and w["severity"] == "WARNING" and w["blocking"] is False

    def test_candriam_credit_opport_warning_assessment(self):
        """LU0151324935 — Candriam Bonds Credit Opportunities — lq=79.4%.
        Classified NO_ACTION in audit (subtype review candidate). Warning still emitted by rule."""
        fi = _make_fi_credit(low_quality=79.43, investment_grade=12.35, not_rated=8.22, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        # Warning emitted but final decision is NO_ACTION at audit level
        assert w is not None and w["blocking"] is False

    def test_nordea_cross_credit_gets_warning(self):
        """LU0733673288 — Nordea 1 European Cross Credit — lq=62.1% -> WARNING."""
        fi = _make_fi_credit(low_quality=62.05, investment_grade=37.95, not_rated=0.0, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None and w["severity"] == "WARNING" and w["blocking"] is False

    def test_carmignac_credit_borderline_warning(self):
        """LU1623762843 — Carmignac Pf Credit — lq=39.1% -> WARNING (borderline, ig=61%)."""
        fi = _make_fi_credit(low_quality=39.08, investment_grade=60.91, not_rated=0.0, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None and w["severity"] == "WARNING" and w["blocking"] is False

    def test_abrdn_frontier_markets_gets_review(self):
        """LU1919971074 — abrdn Frontier Markets Bond — lq=86.9% -> REVIEW (NEEDS_MANUAL_FACTSHEET)."""
        fi = _make_fi_credit(low_quality=86.91, investment_grade=6.81, not_rated=6.28, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None and w["severity"] == "REVIEW" and w["blocking"] is False

    def test_allianz_credit_opport_gets_warning(self):
        """LU1951921383 — Allianz Credit Opportunities — lq=58% -> WARNING."""
        fi = _make_fi_credit(low_quality=58.03, investment_grade=41.37, not_rated=0.59, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None and w["severity"] == "WARNING" and w["blocking"] is False

    def test_allianz_credit_opport_plus_gets_review(self):
        """LU2002383896 — Allianz Credit Opportunities Plus — lq=83.9% -> REVIEW."""
        fi = _make_fi_credit(low_quality=83.93, investment_grade=15.30, not_rated=0.77, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None and w["severity"] == "REVIEW" and w["blocking"] is False


# ── SECTION 4: Hard-block prohibition contracts ───────────────────────────────

class TestFE9HardBlockProhibited:
    """
    The FE-9 warning contract EXPLICITLY FORBIDS hard-blocking.
    These tests document what must NOT happen in any implementation.
    """

    def test_fe9_warning_does_not_remove_compatible_profiles(self):
        """
        CRITICAL: FE-9 warning MUST NOT modify compatible_profiles.
        compatible_profiles is managed by the compatible_profiles regen cycle,
        not by fi_credit warning rules.
        """
        fund = {
            "classification_v2": {
                "asset_type": "FIXED_INCOME",
                "compatible_profiles": [3, 4, 5, 6, 7, 8, 9, 10],
            },
            "portfolio_exposure_v2": {
                "fi_credit": _make_fi_credit(low_quality=60.0, coverage=1.0),
                "economic_exposure": {"bond": 100.0},
            },
        }
        profiles_before = list(fund["classification_v2"]["compatible_profiles"])
        warnings = compute_fi_credit_warnings(fund)

        assert fund["classification_v2"]["compatible_profiles"] == profiles_before
        assert warnings and warnings[0]["blocking"] is False
        assert "compatible_profiles" not in warnings[0]

    def test_fe9_warning_is_not_in_suitability_engine(self):
        """
        FE-9 warning must NOT be implemented in suitability_engine.is_fund_eligible_for_profile().
        The engine's is_fund_eligible_for_profile returns (bool, str) — it cannot return warnings.
        A separate warning layer must be designed.
        """
        assert compute_fi_credit_warnings.__module__.endswith("fi_credit_warnings")

    def test_fe9_warning_location_is_not_frontend_only(self):
        """
        FE-9 warning must NOT live only in frontend rulesEngine.ts.
        Frontend-only is not acceptable as a permanent solution (divergence risk).
        The backend must be the source of truth.
        """
        fi = _make_fi_credit(low_quality=60.0, coverage=1.0)
        warnings = compute_fi_credit_warnings(
            {"portfolio_exposure_v2": {"fi_credit": fi}},
            bond_weight=100.0,
        )
        assert warnings and warnings[0]["blocking"] is False


# ── SECTION 5: Schema contract for warning output ────────────────────────────

class TestFE9WarningOutputSchema:
    """Contract tests for the warning dict schema."""

    def test_bond_weight_is_derived_from_canonical_exposure(self):
        fund = {
            "classification_v2": {"asset_type": "ALLOCATION"},
            "portfolio_exposure_v2": {
                "fi_credit": _make_fi_credit(low_quality=50.0, coverage=1.0),
                "economic_exposure": {"equity": 20.0, "bond": 80.0},
            },
        }
        warnings = compute_fi_credit_warnings(fund)

        assert warnings[0]["bond_weight"] == 80.0
        assert warnings[0]["low_quality_total_portfolio_estimate"] == 40.0

    def test_warning_has_required_fields(self):
        """All required fields must be present in a warning dict."""
        fi = _make_fi_credit(low_quality=45.0, coverage=1.0)
        w  = _build_fe9_warning(fi, bond_weight=100.0)
        assert w is not None
        required = ["code", "severity", "blocking", "low_quality", "not_rated",
                    "scale", "bond_weight", "low_quality_total_portfolio_estimate",
                    "source", "coverage", "message_advisor", "message_client",
                    "message_technical"]
        for field in required:
            assert field in w, f"Warning missing required field: {field}"

    def test_warning_code_matches_severity(self):
        """Warning code must match the severity band."""
        fi35 = _make_fi_credit(low_quality=35.0, coverage=1.0)
        fi70 = _make_fi_credit(low_quality=70.0, coverage=1.0)
        w35  = _build_fe9_warning(fi35)
        w70  = _build_fe9_warning(fi70)
        assert w35 is not None and "OVER_35" in w35["code"]
        assert w70 is not None and "OVER_70" in w70["code"]

    def test_warning_scale_field_matches_fi_credit_scale(self):
        """Warning scale must mirror fi_credit.scale."""
        fi = _make_fi_credit(low_quality=40.0, coverage=1.0)
        w  = _build_fe9_warning(fi)
        assert w is not None
        assert w["scale"] == "percent_of_bond_bucket"

    def test_message_fields_are_non_empty_strings(self):
        """All three message fields must be non-empty strings."""
        fi = _make_fi_credit(low_quality=40.0, coverage=1.0)
        w  = _build_fe9_warning(fi)
        assert w is not None
        assert isinstance(w["message_advisor"], str) and len(w["message_advisor"]) > 20
        assert isinstance(w["message_client"], str) and len(w["message_client"]) > 20
        assert isinstance(w["message_technical"], str) and len(w["message_technical"]) > 20
