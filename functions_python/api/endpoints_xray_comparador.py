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
# CACHED FETCHERS (INE e Inflación) WITH FIRESTORE FALLBACK
# =========================================================

@lru_cache(maxsize=2)
def _fetch_ine_inflation_cached(date_key: str):
    """
    Descarga la serie del Índice IPC General Nacional (base 2021=100) desde el INE.
    Serie IPC251852 = Índice, NO la tasa de variación.
    Si falla, usa Firestore como fallback.
    """
    db = firestore.client()
    # IPC251852 = Índice General Nacional (base 2021=100)
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
    Fuente: Tesoro Público / Banco de España - datos públicos históricos.
    La URL CSV del BdE ya no está disponible, así que usamos datos hardcoded
    de medias anuales de subastas de Letras a 12 meses.
    """
    # Tasas medias anuales de Letras del Tesoro a 12 meses (fuente: Tesoro Público)
    # Estos son datos públicos bien establecidos
    historical_rates = {
        "2000-01-01": 4.32, "2001-01-01": 3.71, "2002-01-01": 3.13, "2003-01-01": 2.19,
        "2004-01-01": 2.17, "2005-01-01": 2.28, "2006-01-01": 3.26, "2007-01-01": 4.13,
        "2008-01-01": 3.72, "2009-01-01": 1.02, "2010-01-01": 1.67, "2011-01-01": 3.31,
        "2012-01-01": 2.62, "2013-01-01": 1.25, "2014-01-01": 0.41, "2015-01-01": 0.05,
        "2016-01-01": -0.19, "2017-01-01": -0.35, "2018-01-01": -0.32, "2019-01-01": -0.39,
        "2020-01-01": -0.46, "2021-01-01": -0.50, "2022-01-01": 0.70, "2023-01-01": 3.38,
        "2024-01-01": 3.41, "2025-01-01": 2.50,
    }

    dates = [pd.to_datetime(k) for k in historical_rates.keys()]
    rates = list(historical_rates.values())
    series = pd.Series(rates, index=dates).sort_index()

    # Intentar enriquecer con datos de Firestore (si están disponibles de un backup previo)
    try:
        db = firestore.client()
        doc = db.collection("system_settings").document("macro_data_bde").get()
        if doc.exists:
            bde_dict_str = doc.to_dict().get("data", {})
            if len(bde_dict_str) > len(historical_rates):
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

        # Normalizar nombres de columnas eliminando espacios para buscar mejor
        col_names_lower = [str(col).lower().strip() for col in df.columns]
        
        try:
            date_col_idx = next(i for i, col in enumerate(col_names_lower) if 'fecha' in col)
        except StopIteration:
            date_col_idx = 0
            
        date_col = df.columns[date_col_idx]

        # Limpieza robusta de números europeos
        def clean_amount(val):
            if pd.isna(val): return 0.0
            if isinstance(val, (int, float)): return float(val)
            val_str = str(val).strip()
            val_str = re.sub(r'[^\d,\.-]', '', val_str) # Quitar letras, €, espacios
            if ',' in val_str and '.' in val_str:
                if val_str.rfind(',') > val_str.rfind('.'): # Ej: 1.234,56
                    val_str = val_str.replace('.', '').replace(',', '.')
                else: # Ej: 1,234.56
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

        # Detectar columna "Tipo de operación" para filtrar flujos de fondos
        tipo_col_idx = None
        for i, col in enumerate(col_names_lower):
            if 'tipo' in col and 'oper' in col:
                tipo_col_idx = i
                break
        tipo_col = df.columns[tipo_col_idx] if tipo_col_idx is not None else None

        # --- CLEAN DATA ---
        df_clean = df.copy()
        # Parse dates element-by-element to handle mixed types (datetime objects + strings with NBSP)
        df_clean[date_col] = df_clean[date_col].apply(
            lambda v: pd.to_datetime(str(v).replace('\xa0', ' ').strip(), errors='coerce', dayfirst=True)
        )
        df_clean = df_clean.dropna(subset=[date_col])
        df_clean[amount_col] = df_clean[amount_col].apply(clean_amount)

        if df_clean.empty:
            return https_fn.Response(json.dumps({"error": "No valid dates found in file"}), status=400, content_type="application/json")

        # --- SEPARATE FUND FLOWS (SUSCRIPCION/REEMBOLSO) from ALL FLOWS ---
        # Fund flows = only subscriptions/redemptions (the real portfolio investments)
        # All flows = everything in the account (used for letras simulation)
        fund_keywords = ['suscripcion', 'reembolso']
        df_fund = pd.DataFrame()
        if tipo_col is not None:
            df_clean['_tipo_lower'] = df_clean[tipo_col].astype(str).str.lower().str.strip()
            df_fund = df_clean[df_clean['_tipo_lower'].str.contains('|'.join(fund_keywords), na=False)]

        if df_fund.empty:
            # Fallback: use all non-zero flows grouped by date
            df_all_flows = df_clean[df_clean[amount_col].abs() > 0.01].copy()
            df_fund = df_all_flows

        # Fund flows for XIRR (suscripciones = negativo = outflow, reembolsos = positivo = inflow)
        fund_dates = df_fund[date_col].tolist()
        fund_flows = df_fund[amount_col].tolist()

        # Inversión Neta = total suscripciones - total reembolsos
        total_suscripciones = sum(abs(f) for f in fund_flows if f < -0.01)
        total_reembolsos = sum(f for f in fund_flows if f > 0.01)
        inversion_neta_nominal = total_suscripciones - total_reembolsos

        if not fund_dates:
            return https_fn.Response(json.dumps({"error": "No valid flows found in file"}), status=400, content_type="application/json")

        # --- 1. DATOS MACRO ---
        ipc_map = get_ine_inflation_map()
        tasa_letras_series = get_bde_tbills_series()
        latest_ipc = max(ipc_map.values()) if ipc_map else 1.0

        # --- 2. XIRR NOMINAL CARTERA ---
        # Fund flows already have correct signs: suscripcion=negative (outflow), reembolso=positive (inflow)
        # Add final portfolio value as positive (inflow = money returned to investor)
        xirr_dates = fund_dates + [pd.Timestamp.now()]
        xirr_flows = fund_flows + [valor_final_cartera]

        try:
            tir_nominal_cartera = xirr(xirr_dates, xirr_flows) or 0.0
        except Exception:
            tir_nominal_cartera = 0.0

        # --- 3. LETRAS DEL TESORO SIMULACIÓN ---
        # Use FUND flows for letras simulation (same capital that went to funds goes to T-bills)
        # Suscripcion (negative) = money invested = ADD to letras (negate sign)
        # Reembolso (positive) = money withdrawn = SUBTRACT from letras (negate sign)
        impuesto_bizkaia = 0.20
        valor_letras_nominal = 0.0
        valor_letras_bruto = 0.0
        valor_simulado_cartera = 0.0
        beneficio_acumulado_ano = 0.0

        hist_letras_nom = {}
        hist_letras_bruto = {}
        hist_cartera_nom = {}

        fund_dates_sim = fund_dates + [pd.Timestamp.now()]

        for i in range(len(fund_dates_sim) - 1):
            fecha_actual = fund_dates_sim[i]
            fecha_siguiente = fund_dates_sim[i + 1]
            flujo_actual = fund_flows[i] if i < len(fund_flows) else 0.0

            # Negate: suscripcion(-) becomes positive capital for letras
            aportacion = -flujo_actual
            valor_letras_nominal += aportacion
            valor_letras_bruto += aportacion
            valor_simulado_cartera += aportacion

            current_date = fecha_actual
            while current_date < fecha_siguiente:
                next_year_boundary = pd.Timestamp(year=current_date.year + 1, month=1, day=1)
                step_end = min(fecha_siguiente, next_year_boundary)
                dias = (step_end - current_date).days

                # --- Letras interest ---
                tasa_vigente = 0.025
                if not tasa_letras_series.empty:
                    tasas_anteriores = tasa_letras_series[tasa_letras_series.index <= current_date]
                    if not tasas_anteriores.empty:
                        tasa_vigente = tasas_anteriores.iloc[-1] / 100.0

                interes_bruto = max(0, valor_letras_nominal) * (tasa_vigente * (dias / 360.0))
                interes_bruto_sin_impuestos = max(0, valor_letras_bruto) * (tasa_vigente * (dias / 360.0))
                
                if interes_bruto > 0:
                    beneficio_acumulado_ano += interes_bruto
                
                valor_letras_nominal += interes_bruto
                valor_letras_bruto += interes_bruto_sin_impuestos

                # --- Simulated portfolio growth using TIR ---
                if valor_simulado_cartera > 0 and tir_nominal_cartera > -0.99:
                    crecimiento = valor_simulado_cartera * ((1 + tir_nominal_cartera) ** (dias / 365.25) - 1)
                    valor_simulado_cartera += crecimiento

                # Year-end tax on T-bill profits
                if step_end == next_year_boundary:
                    impuesto = beneficio_acumulado_ano * impuesto_bizkaia
                    valor_letras_nominal -= impuesto
                    beneficio_acumulado_ano = 0.0

                    hist_letras_nom[current_date.year] = valor_letras_nominal
                    hist_letras_bruto[current_date.year] = valor_letras_bruto
                    hist_cartera_nom[current_date.year] = valor_simulado_cartera

                current_date = step_end

        # Final partial-year tax
        if beneficio_acumulado_ano > 0:
            impuesto = beneficio_acumulado_ano * impuesto_bizkaia
            valor_letras_nominal -= impuesto

        hist_letras_nom[fund_dates_sim[-1].year] = valor_letras_nominal
        hist_letras_bruto[fund_dates_sim[-1].year] = valor_letras_bruto
        hist_cartera_nom[fund_dates_sim[-1].year] = valor_final_cartera

        # --- 3B. TIR NOMINAL LETRAS ---
        xirr_flows_letras = fund_flows + [valor_letras_nominal]
        try:
            tir_nominal_letras = xirr(xirr_dates, xirr_flows_letras) or 0.0
        except Exception:
            tir_nominal_letras = 0.0

        # --- 3C. TIR NOMINAL LETRAS BRUTA (SIN IMPUESTOS) ---
        xirr_flows_letras_bruto = fund_flows + [valor_letras_bruto]
        try:
            tir_nominal_letras_bruto = xirr(xirr_dates, xirr_flows_letras_bruto) or 0.0
        except Exception:
            tir_nominal_letras_bruto = 0.0

        # --- 3D. SIMULACIÓN DEPÓSITOS BANCARIOS ---
        dep_result = simulate_depositos(fund_dates, fund_flows, pd.Timestamp.now(), impuesto_bizkaia)
        depositos_final_value = dep_result["depositos_final_value"]

        xirr_flows_depositos = fund_flows + [depositos_final_value]
        try:
            depositos_xirr_nominal = xirr(xirr_dates, xirr_flows_depositos) or 0.0
        except Exception:
            depositos_xirr_nominal = 0.0

        # --- 4. TIR REAL Y DEFLACTOR ---
        # Deflate each fund flow to today's euros using IPC index
        flujos_reales_cartera = []
        inversion_neta_real = 0.0

        for f_date, amt in zip(fund_dates, fund_flows):
            ipc_t = ipc_map.get((f_date.year, f_date.month), latest_ipc)
            factor = latest_ipc / ipc_t if ipc_t > 0 else 1.0
            amt_real = amt * factor
            flujos_reales_cartera.append(amt_real)
            # Count real-value investments (suscripciones deflated)
            if amt < -0.01:
                inversion_neta_real += abs(amt_real)
            elif amt > 0.01:
                inversion_neta_real -= amt_real

        # Final values are already in today's euros (no deflation needed)
        flujos_reales_cartera.append(valor_final_cartera)

        # Real letras flows (same fund flows deflated + letras final value)
        flujos_reales_letras = list(flujos_reales_cartera[:-1])  # Same real flows
        flujos_reales_letras.append(valor_letras_nominal)  # Letras final = already nominal

        try:
            tir_real_cartera = xirr(xirr_dates, flujos_reales_cartera) or 0.0
            tir_real_letras = xirr(xirr_dates, flujos_reales_letras) or 0.0
        except Exception:
            tir_real_cartera = 0.0
            tir_real_letras = 0.0

        # Overall deflactor for final values
        first_fund_date = fund_dates[0]
        base_ipc = ipc_map.get((first_fund_date.year, first_fund_date.month), latest_ipc) if ipc_map else 1.0
        deflactor_total = latest_ipc / base_ipc if base_ipc > 0 else 1.0
        valor_real_cartera = valor_final_cartera / deflactor_total
        valor_real_letras = valor_letras_nominal / deflactor_total

        # --- 5. PREPARAR RESPUESTA JSON ---
        anios = sorted(list(hist_letras_nom.keys()))
        chart_data = []
        
        for anio in anios:
            # Buscar el IPC de diciembre de ese año o el más cercano
            ipc_anio = ipc_map.get((anio, 12), ipc_map.get((anio, 11), latest_ipc))
            deflactor_anio = ipc_anio / base_ipc if base_ipc > 0 else 1.0
            
            cNom = hist_cartera_nom[anio]
            lNom = hist_letras_nom[anio]
            
            cReal = cNom / deflactor_anio
            lReal = lNom / deflactor_anio
            
            chart_data.append({
                "year": str(anio),
                "cartera_nominal": round(max(0, cNom), 2),
                "cartera_real": round(max(0, cReal), 2),
                "letras_nominal": round(max(0, lNom), 2),
                "letras_real": round(max(0, lReal), 2),
            })

        response_data = {
            "titular": titular,
            "periodo_inicio": fund_dates[0].strftime('%B %Y'),
            "periodo_fin": pd.Timestamp.now().strftime('%B %Y'),
            "inversion_neta_nominal": round(inversion_neta_nominal, 2),
            "inversion_neta_real": round(inversion_neta_real, 2),
            "valor_final_cartera": round(valor_final_cartera, 2),
            "valor_letras_nominal": round(valor_letras_nominal, 2),
            "valor_real_cartera": round(valor_real_cartera, 2),
            "valor_real_letras": round(valor_real_letras, 2),
            "tir_nominal_cartera": round(tir_nominal_cartera * 100, 2),
            "tir_nominal_letras": round(tir_nominal_letras * 100, 2),
            "tir_nominal_letras_bruto": round(tir_nominal_letras_bruto * 100, 2),
            "tir_real_cartera": round(tir_real_cartera * 100, 2),
            "tir_real_letras": round(tir_real_letras * 100, 2),
            "impuesto_bizkaia": round(impuesto_bizkaia * 100, 2),
            "deflactor_total": round(deflactor_total, 4),
            "depositos_final_value": round(depositos_final_value, 2),
            "depositos_xirr_nominal": round(depositos_xirr_nominal * 100, 2),
            "chart_data": chart_data
        }

        return https_fn.Response(
            json.dumps(response_data),
            status=200,
            content_type="application/json"
        )

    except Exception as e:
        logger.exception(f"Error in compare_risk_free: {e}")
        return https_fn.Response(json.dumps({"error": str(e)}), status=500, content_type="application/json")
