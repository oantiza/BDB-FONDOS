"""
BDB_OPT_PAYLOAD_CONTRACT_TESTS_0

Static/contractual tests for the optimizer payload contract between
frontend and backend. These tests protect the documented contract
BEFORE any cleanup or refactoring changes are made.

Rules:
- No optimizer execution
- No Cloud / Firestore / Gemini / parser
- Pure source-text analysis + lightweight pure function calls
- Reference: docs/BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0.md
"""

from __future__ import annotations

import inspect
import os
import re
import sys
import textwrap

import pytest

# Ensure functions_python is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ─── HELPERS ──────────────────────────────────────────────────────────────

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _read_file(relative_to_root: str) -> str:
    path = os.path.join(PROJECT_ROOT, relative_to_root)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _endpoint_source() -> str:
    return _read_file("functions_python/api/endpoints_portfolio.py")


def _optimizer_core_source() -> str:
    return _read_file("functions_python/services/portfolio/optimizer_core.py")


def _constraints_builder_source() -> str:
    return _read_file("functions_python/services/portfolio/constraints_builder_v1.py")


def _contract_doc() -> str:
    return _read_file("docs/BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0.md")


def _frontend_hook_source() -> str:
    return _read_file("frontend/src/hooks/usePortfolioActions.ts")


# ═════════════════════════════════════════════════════════════════════════
# 1. ENDPOINT FIELD RECOGNITION
# ═════════════════════════════════════════════════════════════════════════


class TestEndpointFieldRecognition:
    """Verify endpoints_portfolio.py recognizes all documented payload fields."""

    @pytest.fixture(autouse=True)
    def _load_source(self):
        self.source = _endpoint_source()

    def test_recognizes_risk_level(self):
        assert "risk_level" in self.source

    def test_recognizes_profile_id(self):
        assert "profile_id" in self.source

    def test_recognizes_optimization_mode(self):
        assert "optimization_mode" in self.source

    def test_recognizes_constraints(self):
        assert 'req_data.get("constraints"' in self.source or "constraints" in self.source

    def test_recognizes_locked_positions(self):
        assert "locked_positions" in self.source

    def test_recognizes_fixed_weights(self):
        assert "fixed_weights" in self.source

    def test_recognizes_lock_mode(self):
        assert "lock_mode" in self.source

    def test_recognizes_locked_assets(self):
        assert "locked_assets" in self.source

    def test_recognizes_asset_metadata(self):
        assert "asset_metadata" in self.source

    def test_recognizes_tactical_views(self):
        assert "tactical_views" in self.source


# ═════════════════════════════════════════════════════════════════════════
# 2. OPTIMIZER CORE / CONSTRAINTS BUILDER V2 FIELD USAGE
# ═════════════════════════════════════════════════════════════════════════


class TestOptimizerCoreFieldUsage:
    """Verify optimizer_core.py and constraints_builder_v1.py consume
    the documented V2 fields."""

    @pytest.fixture(autouse=True)
    def _load_sources(self):
        self.core = _optimizer_core_source()
        self.builder = _constraints_builder_source()

    def test_core_uses_portfolio_exposure_v2(self):
        assert "portfolio_exposure_v2" in self.core

    def test_core_uses_classification_v2(self):
        assert "classification_v2" in self.core

    def test_core_uses_asset_mix(self):
        assert "asset_mix" in self.core

    def test_core_uses_bucket_bounds_v1(self):
        assert "bucket_bounds_v1" in self.core or "bucket_bounds" in self.core

    def test_core_uses_current_risk_buckets(self):
        assert "current_risk_buckets" in self.core

    def test_builder_recognizes_locked_positions(self):
        assert "locked_positions" in self.builder

    def test_builder_recognizes_optimization_mode(self):
        assert "optimization_mode" in self.builder

    def test_builder_produces_bucket_bounds(self):
        assert "bucket_bounds" in self.builder


# ═════════════════════════════════════════════════════════════════════════
# 3. ENDPOINT FIELD CASCADING / PRIORITY
# ═════════════════════════════════════════════════════════════════════════


class TestEndpointFieldCascading:
    """Verify endpoints_portfolio.py implements documented field priority."""

    @pytest.fixture(autouse=True)
    def _load_source(self):
        self.source = _endpoint_source()

    def test_profile_id_defaults_to_risk_level(self):
        """D1: profile_id falls back to str(risk_level) when absent."""
        assert re.search(r'profile_id.*=.*str\(.*risk_level\)', self.source)

    def test_optimization_mode_cascades_root_then_constraints_then_default(self):
        """D2: optimization_mode has documented cascading priority."""
        # The source should show: root > constraints > default
        assert re.search(
            r'optimization_mode\s*=\s*\(\s*req_data\.get\("optimization_mode"\)',
            self.source,
        )
        assert "rebalance_to_profile" in self.source  # default value

    def test_locked_positions_canonical_with_fallback_from_constraints(self):
        """D3: locked_positions is canonical; constraints.fixed_weights is fallback."""
        assert re.search(
            r'locked_positions\s*=\s*req_data\.get\("locked_positions"\)',
            self.source,
        )
        # Fallback reconstruction from constraints
        assert re.search(r'lock_mode.*keep_weight', self.source)
        assert re.search(r'fixed_weights', self.source)


# ═════════════════════════════════════════════════════════════════════════
# 4. NO SILENT FALLBACK GUARD (classification_v2 → exposure)
# ═════════════════════════════════════════════════════════════════════════


class TestNoSilentFallbackGuard:
    """D5: classification_v2 must NOT silently substitute
    portfolio_exposure_v2.asset_mix in the solver path."""

    @pytest.fixture(autouse=True)
    def _load_sources(self):
        self.core = _optimizer_core_source()

    def test_build_exposure_vectors_uses_asset_mix_not_classification(self):
        """_build_exposure_vectors delegates to _extract_bucket_exposure_from_meta_v2,
        which calls get_effective_asset_mix (reads portfolio_exposure_v2.asset_mix).
        The chain must NOT use classification_v2 as numeric exposure source."""
        # _build_exposure_vectors delegates to _extract_bucket_exposure_from_meta_v2
        build_source = inspect.getsource(
            __import__(
                "services.portfolio.optimizer_core",
                fromlist=["_build_exposure_vectors"],
            )._build_exposure_vectors
        )
        assert "_extract_bucket_exposure_from_meta_v2" in build_source

        # The delegated function must use get_effective_asset_mix (reads asset_mix)
        extract_source = inspect.getsource(
            __import__(
                "services.portfolio.optimizer_core",
                fromlist=["_extract_bucket_exposure_from_meta_v2"],
            )._extract_bucket_exposure_from_meta_v2
        )
        assert "get_effective_asset_mix" in extract_source
        # Should NOT directly assign classification_v2 to exposure vectors
        assert not re.search(
            r'classification_v2.*=.*eq_v|eq_v.*=.*classification_v2',
            extract_source,
        )

    def test_portfolio_exposure_v2_is_primary_exposure_source_in_endpoint(self):
        """Endpoint metadata builder should populate portfolio_exposure_v2."""
        source = _endpoint_source()
        assert re.search(
            r'"portfolio_exposure_v2".*data\.get\("portfolio_exposure_v2"',
            source,
        )

    def test_classification_v2_is_identity_metadata_in_endpoint(self):
        """Endpoint metadata builder should populate classification_v2
        for identity purposes."""
        source = _endpoint_source()
        assert re.search(
            r'"classification_v2".*data\.get\("classification_v2"',
            source,
        )


# ═════════════════════════════════════════════════════════════════════════
# 5. MIXTO IS REPORTING/METADATA, NOT HARD SOLVER CONSTRAINT
# ═════════════════════════════════════════════════════════════════════════


class TestMixtoReportingOnly:
    """D6: Mixto must remain reporting/metadata — not a hard solver constraint."""

    def test_profile_bucket_vectors_do_not_include_mixto(self):
        """_build_profile_bucket_vectors should NOT produce a 'Mixto' vector
        that the solver uses as a hard constraint."""
        from services.portfolio.optimizer_core import _build_profile_bucket_vectors
        import numpy as np

        eq_v = np.array([0.5])
        bd_v = np.array([0.3])
        cs_v = np.array([0.1])
        al_v = np.array([0.05])
        ra_v = np.array([0.0])
        ot_v = np.array([0.05])

        vectors = _build_profile_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v)

        # Mixto should NOT be a key — look-through decomposes into RV/RF
        assert "Mixto" not in vectors
        assert "RV" in vectors
        assert "RF" in vectors

    def test_contract_doc_confirms_mixto_not_constraint(self):
        doc = _contract_doc()
        assert "Mixto" in doc
        assert re.search(r"No es hard constraint", doc, re.IGNORECASE)


# ═════════════════════════════════════════════════════════════════════════
# 6. CONTRACT DOCUMENT FIELD COVERAGE
# ═════════════════════════════════════════════════════════════════════════


class TestContractDocCoverage:
    """Verify the contract doc covers all required fields and risks."""

    @pytest.fixture(autouse=True)
    def _load_doc(self):
        self.doc = _contract_doc()

    def test_doc_covers_risk_level_vs_profile_id(self):
        assert "risk_level" in self.doc
        assert "profile_id" in self.doc
        assert re.search(r"D1.*risk_level.*profile_id", self.doc)

    def test_doc_covers_optimization_mode(self):
        assert re.search(r"D2.*optimization_mode", self.doc)

    def test_doc_covers_locked_positions(self):
        assert "locked_positions" in self.doc

    def test_doc_covers_fixed_weights(self):
        assert "fixed_weights" in self.doc

    def test_doc_covers_lock_mode(self):
        assert "lock_mode" in self.doc

    def test_doc_covers_bucket_bounds_v1(self):
        assert "bucket_bounds_v1" in self.doc

    def test_doc_covers_current_risk_buckets(self):
        assert "current_risk_buckets" in self.doc

    def test_doc_covers_portfolio_exposure_v2(self):
        assert "portfolio_exposure_v2" in self.doc

    def test_doc_covers_classification_v2(self):
        assert "classification_v2" in self.doc

    def test_doc_covers_retry_path(self):
        assert re.search(r"retry.*payload|Retry payload", self.doc, re.IGNORECASE)

    def test_doc_covers_mixto(self):
        assert "Mixto" in self.doc
        assert re.search(r"D6.*Mixto", self.doc)


# ═════════════════════════════════════════════════════════════════════════
# 7. RETRY PATH DOCUMENTATION IN FRONTEND SOURCE
# ═════════════════════════════════════════════════════════════════════════


class TestRetryPathDocumentation:
    """Verify the retry path in usePortfolioActions.ts is documented
    as a known contract gap."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.source = _frontend_hook_source()
        self.doc = _contract_doc()

    def test_retry_path_exists_in_source(self):
        assert "retryPayload" in self.source

    def test_retry_path_has_assets(self):
        # retryPayload includes assets
        assert re.search(r"retryPayload.*assets", self.source, re.DOTALL)

    def test_retry_path_has_risk_level(self):
        assert re.search(r"retryPayload.*risk_level", self.source, re.DOTALL)

    def test_retry_path_missing_fields_documented_in_contract(self):
        """Contract doc should mention the retry path sends minimal payload."""
        assert re.search(
            r"retry.*mínimo|retry.*minimal",
            self.doc,
            re.IGNORECASE | re.DOTALL,
        )
        assert re.search(
            r"locked_positions.*constraints.*optimization_mode.*profile_id"
            r"|sin.*locked_positions",
            self.doc,
            re.IGNORECASE | re.DOTALL,
        )


# ═════════════════════════════════════════════════════════════════════════
# 8. BUCKET_BOUNDS_V1 vs CURRENT_RISK_BUCKETS SEPARATION
# ═════════════════════════════════════════════════════════════════════════


class TestBucketBoundsV1VsCurrentRiskBuckets:
    """D4: bucket_bounds_v1 is the override canónico over Firestore-based
    current_risk_buckets."""

    def test_optimizer_core_has_both_fields(self):
        source = _optimizer_core_source()
        assert "bucket_bounds_v1" in source or "bucket_bounds" in source
        assert "current_risk_buckets" in source

    def test_contract_doc_documents_relationship(self):
        doc = _contract_doc()
        assert re.search(r"D4.*bucket_bounds_v1", doc)
        assert re.search(r"current_risk_buckets.*Firestore", doc, re.IGNORECASE)
