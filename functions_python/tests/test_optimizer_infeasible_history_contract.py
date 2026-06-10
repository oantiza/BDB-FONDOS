"""FIX H3 (auditoria logica 2026-06-09) — contrato de historico insuficiente.

Antes del fix, _build_candidate_universe lanzaba ValueError("INFEASIBLE_HISTORY:...")
que el catch-all de run_optimization convertia en {"status": "error", "message":
"INFEASIBLE_HISTORY:..."}: el branch de recuperacion del endpoint era inalcanzable y el
frontend mostraba el mensaje crudo.

Contrato vigente:
- run_optimization devuelve status "infeasible" + recovery_candidates +
  solver_path "blocked_insufficient_history" (el frontend ya gestiona ese status con el
  dialogo de recuperacion y reintento con auto_expand_universe).
- El mensaje es apto para usuario (sin prefijo tecnico).
- Otras ValueError siguen cayendo al catch-all como status "error" (sin regresion).
- El endpoint ya no contiene el parser muerto de "INFEASIBLE_HISTORY:".
"""
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pandas as pd

import services.portfolio.optimizer_core as optimizer_core
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.optimizer_core import (
    FALLBACK_CANDIDATES_DEFAULT,
    run_optimization,
)


def _readonly_dummy_db() -> MagicMock:
    db = MagicMock()
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {str(k): v for k, v in RISK_BUCKETS_LABELS.items()}
    document = MagicMock()
    document.get.return_value = doc
    collection = MagicMock()
    collection.document.return_value = document
    db.collection.return_value = collection
    return db


def _short_prices_for(isins, periods: int = 30):
    dates = pd.date_range("2026-04-01", periods=periods, freq="B")
    return {
        isin: pd.Series(
            100.0 * np.cumprod(np.full(periods, 1.0002 + idx * 0.00001)),
            index=dates,
        )
        for idx, isin in enumerate(isins)
    }


class _ShortHistoryFetcher:
    """Devuelve series demasiado cortas (< min_obs_auto) para cualquier activo."""

    def __init__(self, db):
        self.db = db

    def get_price_data(self, assets, **kwargs):
        return (_short_prices_for(assets), [])

    def get_dynamic_risk_free_rate(self):
        return 0.02


def _valid_meta():
    return {
        "classification_v2": {"asset_type": "EQUITY"},
        "portfolio_exposure_v2": {"asset_mix": {"equity": 1.0}},
    }


def _run_short_history(monkeypatch, candidate_funds=None, constraints=None):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _ShortHistoryFetcher)
    return run_optimization(
        assets_list=["A", "B"],
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints=constraints or {},
        asset_metadata={"A": _valid_meta(), "B": _valid_meta()},
        candidate_funds=candidate_funds,
    )


def test_short_history_returns_structured_infeasible(monkeypatch):
    result = _run_short_history(monkeypatch)

    assert result["status"] == "infeasible"
    assert result["solver_path"] == "blocked_insufficient_history"
    assert result["applicable"] is False
    assert result["usable"] is False
    assert result["weights"] == {}
    assert "insufficient_history" in result["warnings"]


def test_short_history_default_candidates_filtered_for_profile(monkeypatch):
    """FIX H2: con reglas de perfil activas, los candidatos hardcoded sin metadata
    verificable NO se ofrecen como recovery; la exclusion se divulga."""
    result = _run_short_history(monkeypatch)

    assert result["recovery_candidates"] == []
    assert result["explainability"]["history_blocked"] is True
    excluded = result["explainability"]["auto_expand_suitability_excluded"]
    assert [e["isin"] for e in excluded] == FALLBACK_CANDIDATES_DEFAULT


def test_short_history_without_profile_rules_exposes_default_candidates(monkeypatch):
    """Sin reglas de perfil (apply_profile=False) no se filtra: contrato previo."""
    result = _run_short_history(monkeypatch, constraints={"apply_profile": False})

    assert result["recovery_candidates"] == FALLBACK_CANDIDATES_DEFAULT
    assert result["explainability"]["history_blocked"] is True
    assert (
        result["explainability"]["recovery_candidates"]
        == FALLBACK_CANDIDATES_DEFAULT
    )


def test_short_history_message_is_user_facing_without_raw_prefix(monkeypatch):
    result = _run_short_history(monkeypatch)

    assert "INFEASIBLE_HISTORY" not in (result.get("message") or "")
    assert "Faltan datos hist" in result["message"]


def test_short_history_uses_provided_candidate_funds(monkeypatch):
    candidate_funds = {"X1": _valid_meta(), "X2": _valid_meta()}
    result = _run_short_history(monkeypatch, candidate_funds=candidate_funds)

    assert result["status"] == "infeasible"
    assert result["recovery_candidates"] == ["X1", "X2"]


def test_other_value_errors_still_fall_to_error_status(monkeypatch):
    def _boom(*args, **kwargs):
        raise ValueError("otro fallo no relacionado")

    monkeypatch.setattr(optimizer_core, "_build_candidate_universe", _boom)
    result = run_optimization(
        assets_list=["A"],
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints={},
        asset_metadata={"A": _valid_meta()},
    )

    assert result["status"] == "error"
    assert "otro fallo no relacionado" in result["message"]


def test_endpoint_dead_branch_removed_static():
    source = (
        Path(__file__).resolve().parents[1] / "api" / "endpoints_portfolio.py"
    ).read_text(encoding="utf-8")
    assert 'error_msg.startswith("INFEASIBLE_HISTORY:")' not in source
