from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pandas as pd
import pytest


REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO_ROOT / "functions_python"))

from api import endpoints_xray_comparador as xray  # noqa: E402


EXPECTED_RESPONSE_KEYS = [
    "titular",
    "periodo_inicio",
    "periodo_fin",
    "inversion_neta_nominal",
    "inversion_neta_real",
    "valor_final_cartera",
    "valor_letras_nominal",
    "valor_real_cartera",
    "valor_real_letras",
    "tir_nominal_cartera",
    "portfolio_xirr_client",
    "tir_nominal_letras",
    "tir_nominal_letras_bruto",
    "tir_real_cartera",
    "tir_real_letras",
    "cartera_xirr",
    "letras_xirr_real_fiscal",
    "letras_xirr_institucional_sin_fiscalidad",
    "diferencia_anualizada",
    "diferencia_euros",
    "impuesto_bizkaia",
    "deflactor_total",
    "letras_source",
    "letras_last_update",
    "letras_observations_count",
    "letras_series_name",
    "letras_warning",
    "depositos_final_value",
    "depositos_xirr_nominal",
    "chart_data",
    "letras_rates_used",
]


class _Upload:
    filename = "fixture.xlsx"

    def __init__(self, content: bytes):
        self.stream = io.BytesIO(content)


class _Request:
    method = "POST"

    def __init__(self, content: bytes, form: dict[str, str]):
        self.files = {"file": _Upload(content)}
        self.form = form


def _make_workbook() -> bytes:
    return _make_workbook_from_rows(
        [
            _row("2010-01-01", "ABONO TRANSFERENCIA", 10000.0),
            _row("2010-01-01", "SUSCRIPCION IIC", -10000.0),
            _row("2012-01-01", "TRANSFERENCIA SEPA", -2000.0),
            _row("01/01/2012\xa0", "REEMBOLSO IIC", 2000.0),
            _row("2016-01-01", "ABONO TRANSFERENCIA", 5000.0),
            _row("01/01/2016\xa0", "SUSCRIPCION IIC", -5000.0),
            _row("2020-01-01", "CARGO DE CHEQUE", -3000.0),
            _row("01/01/2020\xa0", "REEMBOLSO IIC", 3000.0),
            _row("2026-05-01", None, None),
        ]
    )


def _row(date: object, tipo: object, amount: object) -> dict[str, object]:
    return {
        "Fecha operacion": date,
        "Tipo de operacion": tipo,
        "Importe": amount,
        "Saldo": 0.0,
    }


def _make_workbook_from_rows(rows: list[dict[str, object]]) -> bytes:
    df = pd.DataFrame(rows)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    return output.getvalue()


def _tbills_series() -> pd.Series:
    rates = {
        2005: 2.28,
        2006: 3.26,
        2007: 4.13,
        2008: 3.72,
        2009: 1.02,
        2010: 1.67,
        2011: 3.31,
        2012: 2.62,
        2013: 1.25,
        2014: 0.41,
        2015: 0.05,
        2016: -0.19,
        2017: -0.35,
        2018: -0.32,
        2019: -0.39,
        2020: -0.46,
        2021: -0.50,
        2022: 0.70,
        2023: 3.38,
        2024: 3.41,
        2025: 2.50,
        2026: 2.50,
    }
    return pd.Series({pd.Timestamp(f"{year}-01-01"): rate for year, rate in rates.items()}).sort_index()


def _official_letras() -> dict[str, object]:
    series = _tbills_series()
    return {
        "series": series,
        "metadata": {
            "letras_source": "BDE_API",
            "letras_last_update": "2026-01-01",
            "letras_observations_count": len(series),
            "letras_series_name": "Rentabilidad letras a 12 meses",
        },
    }


def _inflation_map() -> dict[tuple[int, int], float]:
    return {
        (year, month): 100.0 + (year - 2010) * 2.0 + month * 0.1
        for year in range(2010, 2027)
        for month in range(1, 13)
    }


@pytest.fixture(autouse=True)
def _macro_data(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(xray, "get_ine_inflation_map", _inflation_map)
    monkeypatch.setattr(xray, "get_bde_tbills_series", _tbills_series)
    monkeypatch.setattr(xray, "get_official_letras_12m_series", _official_letras)


def _call_compare_risk_free(
    form: dict[str, str] | None = None,
    payload: bytes | None = None,
) -> dict[str, object]:
    payload = payload or _make_workbook()
    request_form = {
        "titular": "Test Client",
        "valor_final_cartera": "25000",
    }
    if form:
        request_form.update(form)

    response = xray.compare_risk_free.__wrapped__(_Request(payload, request_form))
    assert response.status_code == 200
    return json.loads(response.get_data(as_text=True))


def test_no_start_date() -> None:
    data = _call_compare_risk_free()

    assert list(data.keys()) == EXPECTED_RESPONSE_KEYS
    assert data["periodo_inicio"] == "January 2010"
    assert data["periodo_fin"] == "May 2026"
    assert data["inversion_neta_nominal"] == 10000.0
    assert "portfolio_xirr_client" in data
    assert data["letras_source"] == "BDE_API"


def test_with_start_date() -> None:
    data = _call_compare_risk_free({"fecha_inicio": "2015-01-01"})

    assert list(data.keys()) == EXPECTED_RESPONSE_KEYS
    assert data["periodo_inicio"] == "January 2015"
    assert data["periodo_fin"] == "May 2026"
    assert data["inversion_neta_nominal"] == 10000.0


def test_deterministic_output() -> None:
    first = _call_compare_risk_free()
    second = _call_compare_risk_free()

    assert first == second


def test_portfolio_xirr_client_reasonable_range() -> None:
    data = _call_compare_risk_free()

    assert 0 <= data["portfolio_xirr_client"] <= 10


def test_portfolio_xirr_client_differs_from_fund_xirr_when_flows_differ() -> None:
    rows = [
        _row("2020-01-01", "ABONO TRANSFERENCIA", 10000.0),
        _row("2023-01-01", "SUSCRIPCION IIC", -10000.0),
        _row("2026-05-01", None, None),
    ]

    data = _call_compare_risk_free(
        form={"valor_final_cartera": "12000"},
        payload=_make_workbook_from_rows(rows),
    )

    assert data["portfolio_xirr_client"] != data["tir_nominal_cartera"]


def test_letras_metadata_returned() -> None:
    data = _call_compare_risk_free()

    assert data["letras_source"] in {"BDE_API", "TESORO_OFFICIAL_FALLBACK", "CACHE_OFFICIAL"}
    assert data["letras_source"] != "HARDCODED"
    assert data["letras_last_update"] == "2026-01-01"
    assert data["letras_observations_count"] > 0
    assert data["letras_series_name"] == "Rentabilidad letras a 12 meses"


def test_no_fixed_rate_table_as_primary_source() -> None:
    source = Path(xray.__file__).read_text(encoding="utf-8")

    assert "historical_rates" not in source
    assert "return 0.025" not in source
    assert "BDE_API" in source


def test_letras_uses_same_external_cashflows_as_client(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, list[tuple[pd.Timestamp, float]]] = {}
    original = xray.simulate_letras

    def wrapped_simulate(dates, flows, *args, **kwargs):
        captured["pairs"] = xray._cash_flow_pairs(dates, flows)
        return original(dates, flows, *args, **kwargs)

    monkeypatch.setattr(xray, "simulate_letras", wrapped_simulate)

    rows = [
        _row("2020-01-01", "ABONO TRANSFERENCIA", 10000.0),
        _row("2020-01-02", "SUSCRIPCION IIC", -10000.0),
        _row("2022-01-01", "REEMBOLSO IIC", 12000.0),
        _row("2022-01-02", "SUSCRIPCION IIC", -12000.0),
        _row("2024-01-01", "TRANSFERENCIA SEPA", -3000.0),
        _row("2026-05-01", None, None),
    ]

    _call_compare_risk_free(payload=_make_workbook_from_rows(rows))

    df = pd.DataFrame(rows)
    expected = xray._extract_external_cashflow_pairs(
        df,
        "Fecha operacion",
        "Importe",
        "Tipo de operacion",
    )
    assert captured["pairs"] == expected


def test_internal_fund_switches_do_not_affect_letras_benchmark_cashflows() -> None:
    base_rows = [
        _row("2020-01-01", "ABONO TRANSFERENCIA", 10000.0),
        _row("2020-01-02", "SUSCRIPCION IIC", -10000.0),
        _row("2026-05-01", None, None),
    ]
    switch_rows = base_rows[:2] + [
        _row("2022-01-01", "REEMBOLSO IIC", 12000.0),
        _row("2022-01-02", "SUSCRIPCION IIC", -12000.0),
        _row("2026-05-01", None, None),
    ]

    base = _call_compare_risk_free(payload=_make_workbook_from_rows(base_rows))
    switched = _call_compare_risk_free(payload=_make_workbook_from_rows(switch_rows))

    assert switched["valor_letras_nominal"] == base["valor_letras_nominal"]
    assert switched["tir_nominal_letras"] == base["tir_nominal_letras"]
    assert switched["tir_nominal_letras_bruto"] == base["tir_nominal_letras_bruto"]


def test_external_contribution_increases_letras_capital() -> None:
    df = pd.DataFrame([_row("2023-01-01", "ABONO TRANSFERENCIA", 10000.0)])
    pairs = xray._extract_external_cashflow_pairs(
        df,
        "Fecha operacion",
        "Importe",
        "Tipo de operacion",
    )

    result = xray.simulate_letras(
        [dt for dt, _ in pairs],
        [flow for _, flow in pairs],
        pd.Timestamp("2026-05-01"),
        _tbills_series(),
    )

    assert pairs == [(pd.Timestamp("2023-01-01"), -10000.0)]
    assert result["valor_letras_nominal"] > 10000.0


def test_external_withdrawal_reduces_letras_capital() -> None:
    contribution = [(pd.Timestamp("2023-01-01"), -10000.0)]
    with_withdrawal = contribution + [(pd.Timestamp("2024-01-01"), 4000.0)]

    without_result = xray.simulate_letras(
        [dt for dt, _ in contribution],
        [flow for _, flow in contribution],
        pd.Timestamp("2026-05-01"),
        _tbills_series(),
    )
    withdrawal_result = xray.simulate_letras(
        [dt for dt, _ in with_withdrawal],
        [flow for _, flow in with_withdrawal],
        pd.Timestamp("2026-05-01"),
        _tbills_series(),
    )

    assert withdrawal_result["valor_letras_nominal"] < without_result["valor_letras_nominal"]


def test_letras_not_negative_long_term() -> None:
    dates = [pd.Timestamp("2005-01-01")]
    flows = [-10000.0]
    final_date = pd.Timestamp("2026-05-01")

    result = xray.simulate_letras(dates, flows, final_date, _tbills_series())
    letras_xirr = xray.compute_xirr(dates + [final_date], flows + [result["valor_letras_nominal"]])

    assert result["valor_letras_nominal"] > 0
    assert letras_xirr >= 0


def test_xirr_consistency() -> None:
    dates = [
        pd.Timestamp("2021-01-01"),
        pd.Timestamp("2021-01-01"),
        pd.Timestamp("2022-01-01"),
    ]
    flows = [-600.0, -400.0, 1100.0]

    assert xray.compute_xirr(dates, flows) == pytest.approx(0.10, abs=1e-8)
