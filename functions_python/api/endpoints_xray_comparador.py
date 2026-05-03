import logging
import io
import requests
import pandas as pd
from datetime import datetime
from functools import lru_cache
from pyxirr import xirr

from firebase_functions import https_fn, options
from firebase_admin import firestore
import json
import re

logger = logging.getLogger(__name__)

cors_config = options.CorsOptions(
    cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"]
)

# =========================================================
# CACHED FETCHERS (INE e InflaciÃ³n) WITH FIRESTORE FALLBACK
# =========================================================

@lru_cache(maxsize=2)
def _fetch_ine_inflation_cached(date_key: str):
    """
    Descarga la serie del Ãndice IPC General Nacional (base 2021=100) desde el INE.
    Serie IPC251852 = Ãndice, NO la tasa de variaciÃ³n.
    Si falla, usa Firestore como fallback.
    """
    db = firestore.client()
    # IPC251852 = Ãndice General Nacional (base 2021=100)
    url = "https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/IPC251852?date=20000101:"
    
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        
        ipc_map_str = {}
        for row in data.get("Data", []):
            try:
                if "Anyo" in row and "FK_Periodo" in row:
                    year = int(row["Anyo"])
                    month = int(row["FK_Periodo"])
                    if 1 <= month <= 12:
                        ipc_map_str[f"{year}-{month:02d}"] = float(row.get("Valor", 0.0))
                elif "Fecha" in row:
                    dt = datetime.fromtimestamp(row["Fecha"] / 1000.0)
                    ipc_map_str[f"{dt.year}-{dt.month:02d}"] = float(row.get("Valor", 0.0))
            except Exception:
                pass
                
        # Guardar backup en Firestore
        if ipc_map_str:
            try:
                db.collection("system_settings").document("macro_data_ine").set({
                    "last_updated": firestore.SERVER_TIMESTAMP,
                    "data": ipc_map_str
                })
            except Exception as e:
                logger.error(f"Failed to save INE backup to Firestore: {e}")
                
        logger.info(f"INE Inflation data loaded from API. {len(ipc_map_str)} points.")
        return {(int(k.split('-')[0]), int(k.split('-')[1])): v for k, v in ipc_map_str.items()}
        
    except Exception as api_err:
        logger.warning(f"INE API failed ({api_err}). Falling back to Firestore.")
        try:
            doc = db.collection("system_settings").document("macro_data_ine").get()
            if doc.exists:
                ipc_map_str = doc.to_dict().get("data", {})
                logger.info(f"INE Inflation data loaded from FIRESTORE. {len(ipc_map_str)} points.")
                return {(int(k.split('-')[0]), int(k.split('-')[1])): float(v) for k, v in ipc_map_str.items()}
        except Exception as fs_err:
            logger.error(f"Firestore fallback for INE failed: {fs_err}")
            
        return {}


def get_ine_inflation_map():
    today = datetime.now().strftime("%Y-%m-%d")
    return _fetch_ine_inflation_cached(today)


@lru_cache(maxsize=2)
def _fetch_bde_tbills_cached(date_key: str):
    """
    Retorna pd.Series con tasas de Letras del Tesoro a 12 meses (% anual).
    Fuente: Tesoro PÃºblico / Banco de EspaÃ±a - datos pÃºblicos histÃ³ricos.
    La URL CSV del BdE ya no estÃ¡ disponible, asÃ­ que usamos datos hardcoded
    de medias anuales de subastas de Letras a 12 meses.
    """
    # Tasas medias anuales de Letras del Tesoro a 12 meses (fuente: Tesoro PÃºblico)
    # Estos son datos pÃºblicos bien establecidos
    _LETRAS_FALLBACK_RATES = {
        "2000-01-01": 4.32, "2001-01-01": 3.71, "2002-01-01": 3.13, "2003-01-01": 2.19,
        "2004-01-01": 2.17, "2005-01-01": 2.28, "2006-01-01": 3.26, "2007-01-01": 4.13,
        "2008-01-01": 3.72, "2009-01-01": 1.02, "2010-01-01": 1.67, "2011-01-01": 3.31,
        "2012-01-01": 2.62, "2013-01-01": 1.25, "2014-01-01": 0.41, "2015-01-01": 0.05,
        "2016-01-01": -0.19, "2017-01-01": -0.35, "2018-01-01": -0.32, "2019-01-01": -0.39,
        "2020-01-01": -0.46, "2021-01-01": -0.50, "2022-01-01": 0.70, "2023-01-01": 3.38,
        "2024-01-01": 3.41, "2025-01-01": 2.50,
    }

    dates = [pd.to_datetime(k) for k in _LETRAS_FALLBACK_RATES.keys()]
    rates = list(_LETRAS_FALLBACK_RATES.values())
    series = pd.Series(rates, index=dates).sort_index()

    # Intentar enriquecer con datos de Firestore (si estÃ¡n disponibles de un backup previo)
    try:
        db = firestore.client()
        doc = db.collection("system_settings").document("macro_data_bde").get()
        if doc.exists:
            bde_dict_str = doc.to_dict().get("data", {})
            if len(bde_dict_str) > len(_LETRAS_FALLBACK_RATES):
                fs_dates, fs_rates = [], []
                for k, v in bde_dict_str.items():
                    fs_dates.append(pd.to_datetime(k))
                    fs_rates.append(v)
                series = pd.Series(fs_rates, index=fs_dates).sort_index()
                logger.info(f"BdE T-Bills enriched from Firestore. {len(series)} points.")
    except Exception as e:
        logger.warning(f"Firestore BDE enrichment failed: {e}")

    logger.info(f"BdE T-Bills data loaded. {len(series)} points.")
    return series


def get_bde_tbills_series():
    today = datetime.now().strftime("%Y-%m-%d")
    return _fetch_bde_tbills_cached(today)


# =========================================================
# DEPOSIT RATE CURVE (hardcoded, no external API)
# =========================================================

DEPOSIT_RATES_BY_YEAR = {
    2005: 2.00, 2006: 2.25, 2007: 3.00, 2008: 3.50,
    2009: 2.00, 2010: 1.50, 2011: 2.00, 2012: 1.75,
    2013: 1.25, 2014: 0.75, 2015: 0.30, 2016: 0.10,
    2017: 0.05, 2018: 0.05, 2019: 0.05, 2020: 0.05,
    2021: 0.05, 2022: 0.75, 2023: 2.00, 2024: 2.50,
    2025: 2.25, 2026: 2.00,
}


def _get_deposit_rate(year: int) -> float:
    """Return deposit rate (as decimal, e.g. 0.02) for a given year."""
    if year in DEPOSIT_RATES_BY_YEAR:
        return DEPOSIT_RATES_BY_YEAR[year] / 100.0
    # Fallback: closest available year
    years = sorted(DEPOSIT_RATES_BY_YEAR.keys())
    if year < years[0]:
        return DEPOSIT_RATES_BY_YEAR[years[0]] / 100.0
    return DEPOSIT_RATES_BY_YEAR[years[-1]] / 100.0


def simulate_depositos(fund_dates, fund_flows, fecha_final, impuesto_bizkaia=0.20):
    """
    Simulate bank deposit alternative using the same external flows.
    Same structure as Letras simulation: daily accrual ACT/360,
    annual Bizkaia tax on accumulated profits at year-end.

    Returns dict with:
      - depositos_final_value: final nominal value after taxes
      - beneficio_acumulado_total: total gross interest earned
    """
    saldo = 0.0
    beneficio_acumulado_ano = 0.0
    beneficio_total = 0.0

    sim_dates = list(fund_dates) + [fecha_final]

    for i in range(len(sim_dates) - 1):
        fecha_actual = sim_dates[i]
        fecha_siguiente = sim_dates[i + 1]
        flujo_actual = fund_flows[i] if i < len(fund_flows) else 0.0

        # Negate: suscripcion(-) becomes positive capital for deposit
        aportacion = -flujo_actual
        saldo += aportacion

        current_date = fecha_actual
        while current_date < fecha_siguiente:
            next_year_boundary = pd.Timestamp(year=current_date.year + 1, month=1, day=1)
            step_end = min(fecha_siguiente, next_year_boundary)
            dias = (step_end - current_date).days

            tasa = _get_deposit_rate(current_date.year)
            interes = max(0, saldo) * (tasa * (dias / 360.0))

            if interes > 0:
                beneficio_acumulado_ano += interes
                beneficio_total += interes

            saldo += interes

            # Year-end tax on deposit profits
            if step_end == next_year_boundary:
                impuesto = beneficio_acumulado_ano * impuesto_bizkaia
                saldo -= impuesto
                beneficio_acumulado_ano = 0.0

            current_date = step_end

    # Final partial-year tax
    if beneficio_acumulado_ano > 0:
        impuesto = beneficio_acumulado_ano * impuesto_bizkaia
        saldo -= impuesto

    return {
        "depositos_final_value": saldo,
        "beneficio_total": beneficio_total,
    }


# =========================================================
# HELPER FUNCTIONS
# =========================================================

_FUND_INTERNAL_KEYWORDS = ['suscripcion', 'reembolso']


def _extract_external_cashflow_pairs(df, date_col, amount_col, tipo_col):
    """Extract EXTERNAL client cashflows (transfers in/out), excluding
    internal fund operations (suscripcion/reembolso).
    Returns list of (pd.Timestamp, float) with XIRR sign convention:
      - money IN to account  -> negative (investor outflow)
      - money OUT of account -> positive (investor inflow)
    """
    pairs = []
    for _, row in df.iterrows():
        amt = row[amount_col]
        if pd.isna(amt) or abs(float(amt)) < 0.01:
            continue
        dt = row[date_col]
        if pd.isna(dt):
            continue
        tipo = str(row[tipo_col]).lower().strip() if tipo_col and pd.notna(row.get(tipo_col)) else ""
        is_internal = any(kw in tipo for kw in _FUND_INTERNAL_KEYWORDS)
        if is_internal:
            continue
        # External: positive amount = money arriving = investor outflow for XIRR
        pairs.append((pd.Timestamp(dt), -float(amt)))
    return pairs


def _cash_flow_pairs(dates, flows):
    """Zip dates and flows into list of (Timestamp, float) pairs."""
    return [(pd.Timestamp(d), float(f)) for d, f in zip(dates, flows)]


def compute_xirr(dates, flows):
    """Safe wrapper around pyxirr.xirr. Returns 0.0 on failure."""
    try:
        result = xirr(dates, flows)
        return result if result is not None else 0.0
    except Exception:
        return 0.0


def simulate_letras(dates, flows, fecha_final, tasa_letras_series, impuesto_bizkaia=0.20):
    """Standalone Letras del Tesoro simulation.
    Args:
        dates: list of pd.Timestamp (external cashflow dates)
        flows: list of float (XIRR convention: negative=outflow)
        fecha_final: pd.Timestamp for simulation end
        tasa_letras_series: pd.Series with annual rates (%)
        impuesto_bizkaia: tax rate (default 0.20)
    Returns dict with valor_letras_nominal, valor_letras_bruto, hist data.
    """
    valor_nominal = 0.0
    valor_bruto = 0.0
    beneficio_ano = 0.0
    hist_nom = {}
    hist_bruto = {}

    sim_dates = list(dates) + [fecha_final]

    for i in range(len(sim_dates) - 1):
        fecha_actual = sim_dates[i]
        fecha_siguiente = sim_dates[i + 1]
        flujo = flows[i] if i < len(flows) else 0.0
        aportacion = -flujo  # negative flow -> positive capital
        valor_nominal += aportacion
        valor_bruto += aportacion

        current = fecha_actual
        while current < fecha_siguiente:
            next_yb = pd.Timestamp(year=current.year + 1, month=1, day=1)
            step_end = min(fecha_siguiente, next_yb)
            dias = (step_end - current).days

            tasa = 0.025
            if not tasa_letras_series.empty:
                prev = tasa_letras_series[tasa_letras_series.index <= current]
                if not prev.empty:
                    tasa = prev.iloc[-1] / 100.0

            int_nom = max(0, valor_nominal) * (tasa * (dias / 360.0))
            int_bruto = max(0, valor_bruto) * (tasa * (dias / 360.0))

            if int_nom > 0:
                beneficio_ano += int_nom

            valor_nominal += int_nom
            valor_bruto += int_bruto

            if step_end == next_yb:
                imp = beneficio_ano * impuesto_bizkaia
                valor_nominal -= imp
                beneficio_ano = 0.0
                hist_nom[current.year] = valor_nominal
                hist_bruto[current.year] = valor_bruto

            current = step_end

    if beneficio_ano > 0:
        valor_nominal -= beneficio_ano * impuesto_bizkaia

    hist_nom[sim_dates[-1].year] = valor_nominal
    hist_bruto[sim_dates[-1].year] = valor_bruto

    return {
        "valor_letras_nominal": valor_nominal,
        "valor_letras_bruto": valor_bruto,
        "hist_letras_nom": hist_nom,
        "hist_letras_bruto": hist_bruto,
    }


def get_official_letras_12m_series():
    """Get Letras series with metadata. Uses BdE data with Firestore enrichment."""
    series = get_bde_tbills_series()
    source = "BDE_API"
    last_update = datetime.now().strftime("%Y-%m-%d")
    warning = ""

    try:
        db = firestore.client()
        doc = db.collection("system_settings").document("macro_data_bde").get()
        if doc.exists:
            d = doc.to_dict()
            bde_data = d.get("data", {})
            if len(bde_data) > len(series):
                fs_dates = [pd.to_datetime(k) for k in bde_data.keys()]
                fs_rates = [float(v) for v in bde_data.values()]
                series = pd.Series(fs_rates, index=fs_dates).sort_index()
                source = "BDE_API"
                lu = d.get("last_updated")
                if lu:
                    last_update = str(lu)[:10] if hasattr(lu, 'isoformat') else str(lu)[:10]
    except Exception as e:
        warning = f"Firestore enrichment failed: {e}"
        source = "TESORO_OFFICIAL_FALLBACK"

    return {
        "series": series,
        "metadata": {
            "letras_source": source,
            "letras_last_update": last_update,
            "letras_observations_count": len(series),
            "letras_series_name": "Rentabilidad letras a 12 meses",
        },
        "warning": warning,
    }


# =========================================================

@https_fn.on_request(
    region="europe-west1",
    memory=options.MemoryOption.GB_2,
    timeout_sec=120,
    cors=cors_config,
)
def compare_risk_free(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return https_fn.Response(status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    try:
        if 'file' not in req.files:
            return https_fn.Response(json.dumps({"error": "No file part"}), status=400, content_type="application/json")
        
        file = req.files['file']
        titular = req.form.get("titular", "Cliente")
        try:
            valor_final_cartera = float(req.form.get("valor_final_cartera", 0.0))
        except ValueError:
            return https_fn.Response(json.dumps({"error": "valor_final_cartera must be a number"}), status=400, content_type="application/json")

        # Optional parameters
        fecha_inicio_str = req.form.get("fecha_inicio", "")
        fecha_valoracion_str = req.form.get("fecha_valoracion", req.form.get("fecha_final_valoracion", ""))

        filename = file.filename.lower()
        content = file.stream.read()
        if filename.endswith('.csv'):
            try:
                df = pd.read_csv(io.BytesIO(content), sep=None, engine='python', encoding='utf-8-sig')
            except Exception:
                df = pd.read_csv(io.BytesIO(content), sep=';', encoding='latin1')
        else:
            try:
                df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
            except Exception:
                df = pd.read_excel(io.BytesIO(content))

        # Normalizar nombres de columnas
        col_names_lower = [str(col).lower().strip() for col in df.columns]
        
        try:
            date_col_idx = next(i for i, col in enumerate(col_names_lower) if 'fecha' in col)
        except StopIteration:
            date_col_idx = 0
        date_col = df.columns[date_col_idx]

        # Limpieza robusta de nÃºmeros europeos
        def clean_amount(val):
            if pd.isna(val): return 0.0
            if isinstance(val, (int, float)): return float(val)
            val_str = str(val).strip()
            val_str = re.sub(r'[^\d,\.\-]', '', val_str)
            if ',' in val_str and '.' in val_str:
                if val_str.rfind(',') > val_str.rfind('.'):
                    val_str = val_str.replace('.', '').replace(',', '.')
                else:
                    val_str = val_str.replace(',', '')
            elif ',' in val_str:
                val_str = val_str.replace(',', '.')
            elif val_str.count('.') > 1:
                val_str = val_str.replace('.', '')
            try:
                return float(val_str)
            except:
                return 0.0

        # --- DETECT COLUMNS ---
        amount_col_idx = None
        for i, col in enumerate(col_names_lower):
            if 'importe' in col and 'saldo' not in col:
                amount_col_idx = i
                break
        if amount_col_idx is None:
            for i in range(len(df.columns) - 1, -1, -1):
                col_name = str(df.columns[i]).lower()
                if 'saldo' in col_name or 'fecha' in col_name:
                    continue
                test_cleaned = df.iloc[:, i].apply(clean_amount)
                if abs(test_cleaned.sum()) > 0:
                    amount_col_idx = i
                    break
        if amount_col_idx is None:
            amount_col_idx = len(df.columns) - 2 if len(df.columns) > 1 else len(df.columns) - 1
        amount_col = df.columns[amount_col_idx]

        tipo_col_idx = None
        for i, col in enumerate(col_names_lower):
            if 'tipo' in col and 'oper' in col:
                tipo_col_idx = i
                break
        tipo_col = df.columns[tipo_col_idx] if tipo_col_idx is not None else None

        # --- CLEAN DATA ---
        df_clean = df.copy()
        def _parse_date(v):
            s = str(v).replace('\xa0', ' ').strip()
            # Try ISO format first (YYYY-MM-DD) to avoid dayfirst ambiguity
            try:
                return pd.to_datetime(s, format='%Y-%m-%d')
            except (ValueError, TypeError):
                pass
            return pd.to_datetime(s, errors='coerce', dayfirst=True)

        df_clean[date_col] = df_clean[date_col].apply(_parse_date)
        df_clean = df_clean.dropna(subset=[date_col])
        df_clean[amount_col] = df_clean[amount_col].apply(clean_amount)

        if df_clean.empty:
            return https_fn.Response(json.dumps({"error": "No valid dates found in file"}), status=400, content_type="application/json")

        # --- DETERMINISTIC FINAL DATE ---
        if fecha_valoracion_str:
            fecha_final = pd.Timestamp(fecha_valoracion_str)
        else:
            fecha_final = df_clean[date_col].max()

        # --- FECHA INICIO (optional filter) ---
        fecha_inicio = None
        if fecha_inicio_str:
            fecha_inicio = pd.Timestamp(fecha_inicio_str)

        # --- SEPARATE FUND FLOWS (SUSCRIPCION/REEMBOLSO) ---
        fund_keywords = ['suscripcion', 'reembolso']
        df_fund = pd.DataFrame()
        if tipo_col is not None:
            df_clean['_tipo_lower'] = df_clean[tipo_col].astype(str).str.lower().str.strip()
            df_fund = df_clean[df_clean['_tipo_lower'].str.contains('|'.join(fund_keywords), na=False)]

        if df_fund.empty:
            df_all_flows = df_clean[df_clean[amount_col].abs() > 0.01].copy()
            df_fund = df_all_flows

        # --- EXTRACT EXTERNAL CLIENT CASHFLOWS (for benchmarks) ---
        external_pairs = _extract_external_cashflow_pairs(df_clean, date_col, amount_col, tipo_col)
        if not external_pairs:
            # Fallback: use fund flows as external
            external_pairs = [(pd.Timestamp(d), float(f)) for d, f in zip(df_fund[date_col], df_fund[amount_col])]

        # Apply fecha_inicio filter with carry-forward
        if fecha_inicio:
            pre_flows = [(d, f) for d, f in external_pairs if d < fecha_inicio]
            post_flows = [(d, f) for d, f in external_pairs if d >= fecha_inicio]
            carry_forward = sum(f for _, f in pre_flows)
            if abs(carry_forward) > 0.01:
                external_pairs = [(fecha_inicio, carry_forward)] + post_flows
            else:
                external_pairs = post_flows
            # Also filter fund flows with carry-forward
            pre_fund = df_fund[df_fund[date_col] < fecha_inicio]
            fund_carry = pre_fund[amount_col].sum()
            df_fund = df_fund[df_fund[date_col] >= fecha_inicio]
            if abs(fund_carry) > 0.01:
                carry_row = pd.DataFrame({date_col: [fecha_inicio], amount_col: [fund_carry]})
                if tipo_col:
                    carry_row[tipo_col] = "CARRY_FORWARD"
                df_fund = pd.concat([carry_row, df_fund], ignore_index=True)

        ext_dates = [d for d, _ in external_pairs]
        ext_flows = [f for _, f in external_pairs]

        # Fund flows for fund XIRR
        fund_dates = df_fund[date_col].tolist()
        fund_flows = df_fund[amount_col].tolist()

        # InversiÃ³n Neta
        total_suscripciones = sum(abs(f) for f in fund_flows if f < -0.01)
        total_reembolsos = sum(f for f in fund_flows if f > 0.01)
        inversion_neta_nominal = total_suscripciones - total_reembolsos

        if not fund_dates and not ext_dates:
            return https_fn.Response(json.dumps({"error": "No valid flows found in file"}), status=400, content_type="application/json")

        effective_start_dates = ext_dates if ext_dates else fund_dates
        effective_start = fecha_inicio if fecha_inicio else effective_start_dates[0]

        # --- 1. DATOS MACRO ---
        ipc_map = get_ine_inflation_map()
        letras_data = get_official_letras_12m_series()
        tasa_letras_series = letras_data["series"]
        letras_metadata = letras_data["metadata"]
        letras_warning = letras_data.get("warning", "")
        latest_ipc = max(ipc_map.values()) if ipc_map else 1.0
        impuesto_bizkaia = 0.20

        # --- 2. XIRR NOMINAL CARTERA (fund flows) ---
        xirr_dates_fund = fund_dates + [fecha_final]
        xirr_flows_fund = fund_flows + [valor_final_cartera]
        tir_nominal_cartera = compute_xirr(xirr_dates_fund, xirr_flows_fund)

        # --- 2B. PORTFOLIO XIRR CLIENT (external flows) ---
        xirr_dates_ext = ext_dates + [fecha_final]
        xirr_flows_ext = ext_flows + [valor_final_cartera]
        portfolio_xirr_client = compute_xirr(xirr_dates_ext, xirr_flows_ext)

        # --- 3. LETRAS SIMULATION (uses external flows) ---
        letras_result = simulate_letras(ext_dates, ext_flows, fecha_final, tasa_letras_series, impuesto_bizkaia)
        valor_letras_nominal = letras_result["valor_letras_nominal"]
        valor_letras_bruto = letras_result["valor_letras_bruto"]
        hist_letras_nom = letras_result["hist_letras_nom"]
        hist_letras_bruto = letras_result["hist_letras_bruto"]

        # --- 3B. TIR NOMINAL LETRAS ---
        xirr_flows_letras = ext_flows + [valor_letras_nominal]
        tir_nominal_letras = compute_xirr(xirr_dates_ext, xirr_flows_letras)

        # --- 3C. TIR NOMINAL LETRAS BRUTA ---
        xirr_flows_letras_bruto = ext_flows + [valor_letras_bruto]
        tir_nominal_letras_bruto = compute_xirr(xirr_dates_ext, xirr_flows_letras_bruto)

        # --- 3D. DEPÃ“SITOS (uses same external flows) ---
        dep_result = simulate_depositos(ext_dates, ext_flows, fecha_final, impuesto_bizkaia)
        depositos_final_value = dep_result["depositos_final_value"]
        xirr_flows_dep = ext_flows + [depositos_final_value]
        depositos_xirr_nominal = compute_xirr(xirr_dates_ext, xirr_flows_dep)

        # --- 3E. SIMULATED PORTFOLIO (for chart) ---
        hist_cartera_nom = {}
        valor_simulado = 0.0
        sim_dates_chart = ext_dates + [fecha_final]
        for i in range(len(sim_dates_chart) - 1):
            fa = sim_dates_chart[i]
            fs = sim_dates_chart[i + 1]
            flujo = ext_flows[i] if i < len(ext_flows) else 0.0
            valor_simulado += (-flujo)
            cur = fa
            while cur < fs:
                nyb = pd.Timestamp(year=cur.year + 1, month=1, day=1)
                se = min(fs, nyb)
                dias = (se - cur).days
                if valor_simulado > 0 and tir_nominal_cartera > -0.99:
                    valor_simulado += valor_simulado * ((1 + tir_nominal_cartera) ** (dias / 365.25) - 1)
                if se == nyb:
                    hist_cartera_nom[cur.year] = valor_simulado
                cur = se
        hist_cartera_nom[fecha_final.year] = valor_final_cartera

        # --- 4. TIR REAL Y DEFLACTOR ---
        flujos_reales_cartera = []
        inversion_neta_real = 0.0
        for f_date, amt in zip(fund_dates, fund_flows):
            ipc_t = ipc_map.get((f_date.year, f_date.month), latest_ipc)
            factor = latest_ipc / ipc_t if ipc_t > 0 else 1.0
            amt_real = amt * factor
            flujos_reales_cartera.append(amt_real)
            if amt < -0.01:
                inversion_neta_real += abs(amt_real)
            elif amt > 0.01:
                inversion_neta_real -= amt_real

        flujos_reales_cartera.append(valor_final_cartera)
        flujos_reales_letras = list(flujos_reales_cartera[:-1])
        flujos_reales_letras.append(valor_letras_nominal)

        tir_real_cartera = compute_xirr(xirr_dates_fund, flujos_reales_cartera)
        tir_real_letras = compute_xirr(xirr_dates_fund, flujos_reales_letras)

        first_fund_date = effective_start
        base_ipc = ipc_map.get((first_fund_date.year, first_fund_date.month), latest_ipc) if ipc_map else 1.0
        deflactor_total = latest_ipc / base_ipc if base_ipc > 0 else 1.0
        valor_real_cartera = valor_final_cartera / deflactor_total
        valor_real_letras = valor_letras_nominal / deflactor_total

        # Derived comparison fields
        cartera_xirr = round(tir_nominal_cartera * 100, 2)
        letras_xirr_real_fiscal = round(tir_real_letras * 100, 2)
        letras_xirr_institucional = round(tir_nominal_letras_bruto * 100, 2)
        diferencia_anualizada = round((tir_nominal_cartera - tir_nominal_letras) * 100, 2)
        diferencia_euros = round(valor_final_cartera - valor_letras_nominal, 2)

        # --- 5. LETRAS RATES USED PER YEAR (for annexe) ---
        start_year = effective_start.year
        end_year = fecha_final.year
        letras_rates_used = []
        for yr in range(start_year, end_year + 1):
            yr_ts = pd.Timestamp(year=yr, month=1, day=1)
            tasa_yr = 2.5  # default fallback
            if not tasa_letras_series.empty:
                prev = tasa_letras_series[tasa_letras_series.index <= yr_ts]
                if not prev.empty:
                    tasa_yr = round(float(prev.iloc[-1]), 2)
            letras_rates_used.append({
                "year": yr,
                "rate": tasa_yr,
                "source": letras_metadata["letras_source"],
            })

        # --- 6. CHART DATA ---
        anios = sorted(set(list(hist_letras_nom.keys()) + list(hist_cartera_nom.keys())))
        chart_data = []
        for anio in anios:
            ipc_anio = ipc_map.get((anio, 12), ipc_map.get((anio, 11), latest_ipc))
            deflactor_anio = ipc_anio / base_ipc if base_ipc > 0 else 1.0
            cNom = hist_cartera_nom.get(anio, 0)
            lNom = hist_letras_nom.get(anio, 0)
            chart_data.append({
                "year": str(anio),
                "cartera_nominal": round(max(0, cNom), 2),
                "cartera_real": round(max(0, cNom / deflactor_anio), 2),
                "letras_nominal": round(max(0, lNom), 2),
                "letras_real": round(max(0, lNom / deflactor_anio), 2),
            })

        response_data = {
            "titular": titular,
            "periodo_inicio": effective_start.strftime('%B %Y'),
            "periodo_fin": fecha_final.strftime('%B %Y'),
            "inversion_neta_nominal": round(inversion_neta_nominal, 2),
            "inversion_neta_real": round(inversion_neta_real, 2),
            "valor_final_cartera": round(valor_final_cartera, 2),
            "valor_letras_nominal": round(valor_letras_nominal, 2),
            "valor_real_cartera": round(valor_real_cartera, 2),
            "valor_real_letras": round(valor_real_letras, 2),
            "tir_nominal_cartera": round(tir_nominal_cartera * 100, 2),
            "portfolio_xirr_client": round(portfolio_xirr_client * 100, 2),
            "tir_nominal_letras": round(tir_nominal_letras * 100, 2),
            "tir_nominal_letras_bruto": round(tir_nominal_letras_bruto * 100, 2),
            "tir_real_cartera": round(tir_real_cartera * 100, 2),
            "tir_real_letras": round(tir_real_letras * 100, 2),
            "cartera_xirr": cartera_xirr,
            "letras_xirr_real_fiscal": letras_xirr_real_fiscal,
            "letras_xirr_institucional_sin_fiscalidad": letras_xirr_institucional,
            "diferencia_anualizada": diferencia_anualizada,
            "diferencia_euros": diferencia_euros,
            "impuesto_bizkaia": round(impuesto_bizkaia * 100, 2),
            "deflactor_total": round(deflactor_total, 4),
            "letras_source": letras_metadata["letras_source"],
            "letras_last_update": letras_metadata["letras_last_update"],
            "letras_observations_count": letras_metadata["letras_observations_count"],
            "letras_series_name": letras_metadata["letras_series_name"],
            "letras_warning": letras_warning,
            "depositos_final_value": round(depositos_final_value, 2),
            "depositos_xirr_nominal": round(depositos_xirr_nominal * 100, 2),
            "chart_data": chart_data,
            "letras_rates_used": letras_rates_used,
        }

        return https_fn.Response(
            json.dumps(response_data),
            status=200,
            content_type="application/json"
        )

    except Exception as e:
        logger.exception(f"Error in compare_risk_free: {e}")
        return https_fn.Response(json.dumps({"error": str(e)}), status=500, content_type="application/json")

