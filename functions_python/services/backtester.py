import pandas as pd
import numpy as np
from datetime import timedelta
from .data_fetcher import DataFetcher
from .config import BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN
import yfinance as yf

# --- HELPER FUNCTIONS (Refactored) ---


def _fetch_and_process_data(assets_list, db, periods, fetcher=None):
    """
    Fetches, cleans, and aligns data ONCE for the longest requested period.
    """
    if not fetcher:
        fetcher = DataFetcher(db)

    all_assets = list(set(assets_list + [BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN]))

    # Professional standard: Daily Frequency
    price_data_df, synthetic_used = fetcher.get_price_data(
        all_assets, resample_freq="D", strict=False
    )

    if price_data_df.empty:
        raise Exception("No data available for the selected assets.")

    df = price_data_df.copy()

    # Validate columns (assets with very little data)
    missing_assets = []
    keep_assets = []
    for col in df.columns:
        if df[col].count() < (len(df) * 0.1):  # < 10% valid points
            missing_assets.append(col)
        else:
            keep_assets.append(col)

    if not keep_assets:
        raise Exception("No common history found for selected assets.")

    df = df[keep_assets].sort_index()
    first_valid = df.apply(lambda col: col.first_valid_index()).dropna()
    if not first_valid.empty:
        common_start = first_valid.max()
        df = df[df.index >= common_start]
        
    # Hardening: ffill limit 5 to avoid hiding major data gaps
    df = df.ffill(limit=5)
    
    # Hardening: Check for excessive internal gaps in common period
    if not df.empty:
        gap_threshold = len(df) * 0.05
        for col in df.columns:
            missing_count = df[col].isnull().sum()
            if missing_count > gap_threshold:
                print(f"⚠️ [Backtester] Serie {col} tiene {missing_count} huecos internos (>{gap_threshold:.0f}) tras suavizado.")
                
        df = df.dropna()

    if df.empty:
        raise Exception("Demasiados huecos internos invalidaron el dataset común (empty after dropping missing).")

    return df, synthetic_used


def _calculate_allocations(portfolio, db, weights_map):
    """
    Computes aggregated Holdings and Regions allocation.
    This is static regardless of backtest period.
    """
    aggregated_holdings = {}

    # Morningstar & V2 Regions Mapping
    region_stats = {
        "united_states": 0,
        "canada": 0,
        "latin_america": 0,
        "united_kingdom": 0,
        "eurozone": 0,
        "europe_ex_euro": 0,
        "europe_emerging": 0,
        "africa": 0,
        "middle_east": 0,
        "japan": 0,
        "australasia": 0,
        "asia_developed": 0,
        "asia_emerging": 0,
        # Canonical V2 Keys added to aggregation
        "us": 0,
        "europe": 0,
        "emerging": 0,
        "asia_dev": 0,
    }
    region_labels = {
        "united_states": "EE.UU.",
        "canada": "Canadá",
        "latin_america": "Latinoamérica",
        "united_kingdom": "Reino Unido",
        "eurozone": "Eurozona",
        "europe_ex_euro": "Europa (No Euro)",
        "europe_emerging": "Europa Emergente",
        "africa": "África",
        "middle_east": "Oriente Medio",
        "japan": "Japón",
        "australasia": "Australasia",
        "asia_developed": "Asia Desarrollada",
        "asia_emerging": "Asia Emergente",
        # Canonical V2 Labels
        "us": "EE.UU.",
        "europe": "Europa",
        "emerging": "Mercados Emergentes",
        "asia_dev": "Asia Desarrollada",
    }
    total_region_weight = 0

    def distribute_holdings_fallback(isin, total_weight):
        if "OTHERS" in aggregated_holdings:
            aggregated_holdings["OTHERS"]["weight"] += total_weight
        else:
            aggregated_holdings["OTHERS"] = {
                "name": "Otras/No Disponible",
                "weight": total_weight,
            }

    # Bulk fetch asset details to avoid N queries (Optimized)
    doc_refs = [db.collection("funds_v3").document(p["isin"]) for p in portfolio]
    docs = db.get_all(doc_refs)

    for doc, item in zip(docs, portfolio):
        isin = item["isin"]
        w = float(item["weight"]) / 100.0

        real_holdings_found = False

        if doc.exists:
            fd = doc.to_dict()

            # 1. HOLDINGS AGGREGATION
            holdings_list = (
                fd.get("holdings", [])
                or fd.get("holdings_top10", [])
                or fd.get("top_holdings", [])
            )

            if (
                holdings_list
                and isinstance(holdings_list, list)
                and len(holdings_list) > 0
            ):
                real_holdings_found = True
                for h in holdings_list:
                    h_name = h.get("name", "Unknown")
                    h_w = float(h.get("weight", 0)) / 100.0
                    h_isin = h.get("isin", h_name)

                    contrib = w * h_w

                    if h_isin in aggregated_holdings:
                        aggregated_holdings[h_isin]["weight"] += contrib
                    else:
                        aggregated_holdings[h_isin] = {
                            "name": h_name,
                            "weight": contrib,
                        }

                total_known = sum(float(h.get("weight", 0)) for h in holdings_list)
                if total_known < 100:
                    others_w = (100 - total_known) / 100.0
                    contrib_others = w * others_w
                    if "OTHERS" in aggregated_holdings:
                        aggregated_holdings["OTHERS"]["weight"] += contrib_others
                    else:
                        aggregated_holdings["OTHERS"] = {
                            "name": "Otras/No Disponible",
                            "weight": contrib_others,
                        }

            # 2. REGION AGGREGATION
            regions = None
            
            # [V2-FIRST INTENT]
            # Priority 1: Canonical V2 portfolio exposure (equity_regions)
            # Normalizing dict format since V2 uses decimals 0-1, but legacy used 0-100.
            # We scale them to 0-100 so the parsing loop behaves consistently.
            portfolio_v2 = fd.get("portfolio_exposure_v2", {})
            if "equity_regions" in portfolio_v2 and isinstance(portfolio_v2["equity_regions"], dict):
                regions = {k: v * 100 for k, v in portfolio_v2["equity_regions"].items()}

            # Priority 2: Canonical V2 primary region as 100% fallback
            if not regions:
                primary_v2 = fd.get("classification_v2", {}).get("region_primary")
                if primary_v2 and primary_v2 not in ["UNKNOWN", "NONE", None]:
                    regions = {primary_v2.lower(): 100.0}


            # Unwrap 'detail' if present (Morningstar structure: regions -> detail -> {country: %})
            if regions and isinstance(regions, dict) and "detail" in regions:
                regions = regions["detail"]

            if regions and isinstance(regions, dict):
                # Find Unknown explicitly if present in backend data
                unknown_in_data = regions.get("Unknown", 0)

                found_any_region = False
                for r_key, r_val in regions.items():
                    if r_key == "Unknown":
                        continue
                    if r_key == "detail":
                        continue  # Skip nested detail key if mixup

                    # Map common keys if needed, or rely on region_stats keys
                    target_key = r_key

                    if target_key in region_stats:
                        try:
                            val = float(r_val)
                            if val > 1.0:
                                val = val / 100.0

                            contribution = w * val
                            region_stats[target_key] += contribution
                            total_region_weight += contribution
                            found_any_region = True
                        except:
                            continue

                if not found_any_region:
                    # If we had regions but none matched our keys, it might be aggregated as "Global" or similar
                    pass

        if not real_holdings_found:
            distribute_holdings_fallback(isin, w)

    # Top Holdings List
    top_lookthrough = sorted(
        aggregated_holdings.items(), key=lambda x: x[1]["weight"], reverse=True
    )[:15]
    final_top_holdings = [
        {"isin": h[0], "name": h[1]["name"], "weight": h[1]["weight"] * 100}
        for h in top_lookthrough
    ][:10]

    # Region List
    region_list = []
    for k, v in region_stats.items():
        if v > 0.0001:
            label = region_labels.get(k, k.replace("_", " ").capitalize())
            real_val = v * 100.0
            region_list.append({"name": label, "value": round(real_val, 2)})

    # Unclassified / Unknown check
    total_classified = sum(r["value"] for r in region_list)
    if total_classified < 99.0:
        unknown_val = max(0.0, 100.0 - total_classified)
        region_list.append(
            {"name": "Desconocido / Otros", "value": round(unknown_val, 2)}
        )

    return {
        "topHoldings": final_top_holdings,
        "regionAllocation": sorted(region_list, key=lambda x: x["value"], reverse=True),
    }


def _compute_metrics(df_master, period, weights_map, synthetic_used, fetcher):
    """
    Slices master DataFrame and computes metrics for a specific period.
    """
    period_days_map = {"1y": 365, "3y": 1095, "5y": 1825, "10y": 3650, "max": 10000}
    lookback = period_days_map.get(period, 1095)

    # Slice Data
    if len(df_master) > 0:
        start_date = df_master.index[-1] - timedelta(days=lookback)
        df = df_master[df_master.index >= start_date].copy()
    else:
        df = df_master

    if df.empty:
        return {"error": "Period selected is outside available history range."}

    # Identify Assets present in this slice (some might start later, but we filled them)
    # Actually, df_master is already filled. So we are good.
    # But let's verify valid columns (should be all keep_assets).
    valid_assets = [c for c in df.columns if c in weights_map]
    if not valid_assets:
        return {"error": "No valid assets in period"}

    # Short History Warning
    history_days = len(df)
    warnings = []
    if history_days < 126:
        warnings.append(
            f"Short History Warning: Comparison limited to last {history_days} days."
        )

    # Portfolio Return Calculation
    df_port = df[valid_assets]
    returns = df_port.pct_change().dropna()

    # ====================================================================
    # DEFENSIVE RETURN CLIPPING: Cap daily returns at ±15%
    # Any daily return >15% on a mutual fund is a data anomaly (split, glitch).
    # This is the LAST line of defense after data_fetcher despiking.
    # ====================================================================
    DAILY_RETURN_CAP = 0.15
    clipped_count = (returns.abs() > DAILY_RETURN_CAP).sum().sum()
    if clipped_count > 0:
        print(
            f"⚠️ [Backtester] Clipping {clipped_count} extreme daily returns (>±{DAILY_RETURN_CAP * 100}%)"
        )
        returns = returns.clip(-DAILY_RETURN_CAP, DAILY_RETURN_CAP)

    w_vector = np.array([weights_map.get(c, 0) for c in df_port.columns])
    if w_vector.sum() > 0:
        w_vector = w_vector / w_vector.sum()

    port_ret = returns.dot(w_vector)
    
    # Calculate cumulative returns for metrics calculations
    cumulative = (1 + port_ret).cumprod() * 100
    
    days_count = len(cumulative)
    rf_rate_annual = fetcher.get_dynamic_risk_free_rate()
    
    from services.quant_core import calculate_historical_metrics
    m_port = calculate_historical_metrics(cumulative, risk_free_annual=rf_rate_annual, method="geometric")
    
    if m_port:
        cagr = m_port["return"]
        vol = m_port["volatility"]
        sharpe = m_port["sharpe"]
        max_dd = m_port["max_drawdown"]
    else:
        cagr = vol = sharpe = max_dd = 0.0

    # DIAGNOSTIC: Log the computed volatility for debugging
    print(
        f"📊 [Backtester] Period={period}, Vol={vol:.4f}, CAGR={cagr:.4f}, Days={days_count}"
    )
    if vol > 0.30:
        print(f"⚠️ [Backtester] HIGH VOLATILITY DETECTED: {vol:.4f} for period {period}")
        # Log top 5 most volatile daily returns to identify the culprit
        top_rets = port_ret.abs().nlargest(5)
        for dt, val in top_rets.items():
            print(f"   🔍 Top return {dt}: {val:.4f} ({val * 100:.2f}%)")

    # Helper for fallback YF
    def get_yf_series(ticker, start_date, default_index):
        try:
            # Just reusing df_master values if they exist would be better, but they might not be in master unless requested
            # But here we are inside _compute_metrics, logic should be robust.
            # We rely on previous logic: fetched via YF call or cached?
            # Let's simplify: call YF here if needed.
            if ticker in df.columns:
                return df[ticker]

            yf_data = yf.download(
                ticker, start=start_date - timedelta(days=10), progress=False
            )["Close"]
            if isinstance(yf_data, pd.DataFrame):
                yf_data = yf_data.iloc[:, 0]
            yf_data.index = pd.to_datetime(yf_data.index).normalize()
            if yf_data.index.tz is not None:
                yf_data.index = yf_data.index.tz_localize(None)
                
            # Hardening: Exact calendar match, limited ffill, tiny bfill for start boundary
            yf_aligned = yf_data.reindex(default_index)
            return yf_aligned.ffill(limit=5).bfill(limit=1)
        except Exception as e:
            print(f"⚠️ [Backtester] Fallo al pedir {ticker} a YF: {e}")
            return pd.Series(index=default_index, dtype=float).fillna(100.0)

    # Benchmarks (RF/RV)
    if BENCHMARK_RF_ISIN in df and BENCHMARK_RF_ISIN not in synthetic_used:
        rf_curve = df[BENCHMARK_RF_ISIN]
    else:
        rf_curve = get_yf_series("IEF", df.index[0], df.index)

    if BENCHMARK_RV_ISIN in df and BENCHMARK_RV_ISIN not in synthetic_used:
        rv_curve = df[BENCHMARK_RV_ISIN]
    else:
        rv_curve = get_yf_series("SPY", df.index[0], df.index)

    def norm(s):
        return (s / s.iloc[0] * 100) if len(s) > 0 else s

    rf_norm = norm(rf_curve)
    rv_norm = norm(rv_curve)

    profiles = {
        "conservative": rf_norm,
        "moderate": rf_norm * 0.75 + rv_norm * 0.25,
        "balanced": rf_norm * 0.50 + rv_norm * 0.50,
        "dynamic": rf_norm * 0.25 + rv_norm * 0.75,
        "aggressive": rv_norm,
    }

    # Synthetics Metrics
    synthetics_metrics = []
    label_map = {
        "conservative": "Conservador",
        "moderate": "Moderado",
        "balanced": "Equilibrado",
        "dynamic": "Dinámico",
        "aggressive": "Agresivo",
    }
    for name, series in profiles.items():
        if len(series) < 5:
            continue
            
        m_bmk = calculate_historical_metrics(series, risk_free_annual=rf_rate_annual, method="geometric")
        if m_bmk:
            synthetics_metrics.append(
                {
                    "name": label_map.get(name, name),
                    "vol": float(m_bmk["volatility"]),
                    "ret": float(m_bmk["return"]),
                    "type": "benchmark",
                }
            )

    def to_chart(ser):
        return [{"x": d.strftime("%Y-%m-%d"), "y": round(v, 2)} for d, v in ser.items()]

    return {
        "portfolioSeries": to_chart(cumulative),
        "benchmarkSeries": {k: to_chart(v) for k, v in profiles.items()},
        "metrics": {
            "cagr": cagr,
            "volatility": vol,
            "sharpe": sharpe,
            "maxDrawdown": max_dd,
            "rf_rate": rf_rate_annual,
        },
        "correlationMatrix": returns.corr().round(2).fillna(0).values.tolist(),
        "effectiveISINs": valid_assets,
        "synthetics": synthetics_metrics,
        "warnings": warnings,
    }


# --- MAIN ENTRYPOINTS ---


def run_multi_period_backtest(portfolio, periods, db):
    """
    Optimized backtest fetching data once.
    Returns dict: { '1y': {metrics...}, '3y': {...}, 'allocations': {...} }
    """
    try:
        if isinstance(periods, str):
            periods = [periods]

        assets = [p["isin"] for p in portfolio]
        weights_map = {p["isin"]: float(p["weight"]) / 100.0 for p in portfolio}

        # 1. Fetch Data (Max Period implied by taking all avail history, or explicit logic)
        # By default DataFetcher gets all history.
        fetcher = DataFetcher(db)
        df_master, synthetic_used = _fetch_and_process_data(
            assets, db, periods, fetcher
        )

        # 2. Compute Allocations (Static)
        allocations = _calculate_allocations(portfolio, db, weights_map)

        results = {"allocations": allocations}

        # 3. Compute Metrics for each period
        for period in periods:
            metrics = _compute_metrics(
                df_master, period, weights_map, synthetic_used, fetcher
            )
            results[period] = metrics

        return results

    except Exception as e:
        print(f"❌ Error Multi-Backtest: {e}")
        import traceback

        traceback.print_exc()
        return {"error": str(e)}


def run_backtest(portfolio, period, db):
    """
    Legacy Wrapper: Returns single result object (flattened) for compatibility.
    """
    try:
        if not portfolio:
            return {"error": "Cartera vacía"}

        # Re-use multi logic
        multi_res = run_multi_period_backtest(portfolio, [period], db)

        if "error" in multi_res:
            return multi_res

        # Flatten response to match old signature:
        # { metrics:..., portfolioSeries:..., topHoldings:..., regionAllocation:... }

        period_res = multi_res.get(period, {})
        allocations = multi_res.get("allocations", {})

        # Merge dicts
        final_res = {**period_res, **allocations}
        return final_res

    except Exception as e:
        return {"error": str(e)}
