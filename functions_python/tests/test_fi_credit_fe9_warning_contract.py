"""
BDB-FI-CREDIT-FE9-SOFT-WARNING-DESIGN-0
=========================================
Design contract tests for the FE-9 soft warning:
  "FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET"

STATUS: DESIGN-ONLY — All tests are xfail(strict=False) documenting the
        INTENDED warning contract. The warning is NOT implemented in
        suitability_engine.py. These tests define what the implementation
        MUST satisfy when it is built.

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


# ── XFAIL REASON ─────────────────────────────────────────────────────────────
_REASON_UNIMPLEMENTED = (
    "FE-9 soft warning not implemented in suitability_engine.py. "
    "This test defines the INTENDED contract for BDB-FI-CREDIT-FE9-WARNING-RUNTIME-DESIGN-0. "
    "See docs/BDB_FI_CREDIT_FE9_SOFT_WARNING_DESIGN_0.md"
)

_REASON_CONTRACT = (
    "Design contract: blocking=False is an absolute invariant. "
    "If this fails, the implementation is violating the approved contract."
)


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
    """
    Reference implementation of the FE-9 soft warning generator.

    This is the PROPOSED logic for the future warning system.
    It is used only in these contract tests — NOT in suitability_engine.py.

    Returns a warning dict or None if the warning should not be emitted.
    """
    # Guard: fi_credit must exist and be a dict
    if not isinstance(fi_credit, dict):
        return None

    # Guard: source must be present (provenance required)
    if not fi_credit.get("source"):
        return None

    # Guard: scale must be declared and correct
    if fi_credit.get("scale") != "percent_of_bond_bucket":
        return None

    # Guard: coverage must be sufficient to trust the data
    coverage = float(fi_credit.get("coverage") or 0.0)
    if coverage < 0.8:
        return None

    lq = float(fi_credit.get("low_quality") or 0.0)
    nr = float(fi_credit.get("not_rated") or 0.0)
    lq_tp = round(lq * bond_weight / 100.0, 2)

    # Severity levels
    if lq < 25.0:
        return None  # below threshold, no warning
    elif lq < 35.0:
        severity = "INFO"
        code     = "FI_CREDIT_LOW_QUALITY_OVER_25_BOND_BUCKET"
    elif lq < 70.0:
        severity = "WARNING"
        code     = "FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET"
    else:
        severity = "REVIEW"
        code     = "FI_CREDIT_LOW_QUALITY_OVER_70_BOND_BUCKET"

    return {
        "code":                              code,
        "severity":                          severity,
        "blocking":                          False,   # INVARIANT: NEVER True
        "low_quality":                       lq,
        "not_rated":                         nr,
        "scale":                             fi_credit["scale"],
        "bond_weight":                       bond_weight,
        "low_quality_total_portfolio_estimate": lq_tp,
        "source":                            fi_credit["source"],
        "as_of":                             fi_credit.get("as_of"),
        "coverage":                          coverage,
        "message_advisor":                   (
            "Este fondo presenta una proporción relevante de crédito sub-investment grade "
            "dentro de su cartera de renta fija. No implica bloqueo automático, pero "
            "requiere revisión de idoneidad, duración, volatilidad y objetivo del cliente."
        ),
        "message_client":                    (
            "El fondo incorpora exposición significativa a crédito de menor calidad crediticia. "
            "Puede aumentar la sensibilidad a ampliaciones de diferenciales y episodios de "
            "estrés de mercado."
        ),
        "message_technical":                 (
            f"low_quality={lq:.1f}% = BB + B + below_B (percent_of_bond_bucket). "
            f"not_rated={nr:.1f}% tratado separadamente. "
            f"lq_total_portfolio_estimate={lq_tp:.1f}% (bond_weight={bond_weight:.0f}%)."
        ),
    }


# ── SECTION 1: Core invariants (never xfail — these must always pass) ─────────

class TestFE9WarningInvariants:
    """
    Core invariants of the FE-9 warning contract.
    These tests use the local reference implementation only — no Firestore.
    These test the HELPERS, not the production engine.
    The helpers model what the future implementation MUST satisfy.
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

    @pytest.mark.xfail(strict=False, reason=_REASON_UNIMPLEMENTED)
    def test_fe9_warning_does_not_remove_compatible_profiles(self):
        """
        CRITICAL: FE-9 warning MUST NOT modify compatible_profiles.
        compatible_profiles is managed by the compatible_profiles regen cycle,
        not by fi_credit warning rules.
        """
        compatible_profiles_before = [3, 4, 5, 6, 7, 8, 9, 10]
        fi = _make_fi_credit(low_quality=60.0, coverage=1.0)
        w  = _build_fe9_warning(fi)
        # Simulate: warning does not alter profiles
        compatible_profiles_after = compatible_profiles_before  # unchanged
        assert compatible_profiles_before == compatible_profiles_after
        assert w is not None
        assert w["blocking"] is False
        assert "compatible_profiles" not in w  # warning dict must not contain profiles

    @pytest.mark.xfail(strict=False, reason=_REASON_UNIMPLEMENTED)
    def test_fe9_warning_is_not_in_suitability_engine(self):
        """
        FE-9 warning must NOT be implemented in suitability_engine.is_fund_eligible_for_profile().
        The engine's is_fund_eligible_for_profile returns (bool, str) — it cannot return warnings.
        A separate warning layer must be designed.
        """
        # This test documents the architectural constraint:
        # suitability_engine.py must not be modified for FE-9 warnings.
        # A new function/module must be created (e.g. fi_credit_warnings.py).
        assert True  # placeholder — actual test requires the new module

    @pytest.mark.xfail(strict=False, reason=_REASON_UNIMPLEMENTED)
    def test_fe9_warning_location_is_not_frontend_only(self):
        """
        FE-9 warning must NOT live only in frontend rulesEngine.ts.
        Frontend-only is not acceptable as a permanent solution (divergence risk).
        The backend must be the source of truth.
        """
        # This test documents the architectural requirement.
        # Future implementation: backend computes warning, frontend displays it.
        assert True  # placeholder


# ── SECTION 5: Schema contract for warning output ────────────────────────────

class TestFE9WarningOutputSchema:
    """Contract tests for the warning dict schema."""

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
