import logging
logger = logging.getLogger(__name__)
import numpy as np


def _to_float(x, default=0.0):
    try:
        if x is None:
            return float(default)
        if isinstance(x, str):
            s = x.strip().replace("%", "").replace(",", ".")
            return float(s)
        return float(x)
    except Exception:
        return float(default)


def _normalize(weights: dict) -> dict:
    s = sum(max(0.0, float(v)) for v in weights.values())
    if s <= 0:
        return weights
    return {k: float(v) / s for k, v in weights.items()}


def _cap(weights: dict, max_w: float) -> dict:
    return {k: min(float(v), max_w) for k, v in weights.items()}


def _classify_asset(ticker: str, asset_metadata=None) -> str:
    """Determines bucket label (RV, RF, Mixto, Monetario, Alternativos, Otros) strictly from DB"""
    meta = (asset_metadata or {}).get(ticker, {}) or {}

    # 0. Canonical V2 (BEST SOURCE OF TRUTH)
    class_v2 = meta.get("classification_v2", {})
    if class_v2:
        # Use asset_type as primary key per canonical_types.py
        ac_v2 = class_v2.get("asset_type") or class_v2.get("asset_class")
        if ac_v2 == "EQUITY": return "RV"
        if ac_v2 == "FIXED_INCOME": return "RF"
        if ac_v2 == "MIXED": return "Mixto"
        if ac_v2 == "MONETARY": return "Monetario"
        if ac_v2 == "ALTERNATIVE": return "Alternativos"

    # 1. Expect Explicit Tag (e.g. injected during fallback)
    if meta.get("label") in [
        "RV",
        "RF",
        "Mixto",
        "Monetario",
        "Alternativos",
        "Otros",
    ]:
        return meta["label"]
    
    # Map Retorno Absoluto to Alternativos if it comes from legacy label
    if meta.get("label") == "Retorno Absoluto":
        return "Alternativos"

    # 2. Use exact derived.asset_class math label
    raw = (meta.get("asset_class") or "Otros").strip()
    valid_classes = [
        "RV",
        "RF",
        "Mixto",
        "Monetario",
        "Alternativos",
        "Otros",
    ]

    if raw in valid_classes:
        return raw
    
    if raw == "Retorno Absoluto":
        return "Alternativos"

    # 3. Emergency fallback only if derived string somehow mutated
    up = raw.upper()
    if "MONETARIO" in up:
        return "Monetario"
    if "FIJA" in up or "RF" in up:
        return "RF"
    if "VARIABLE" in up or "RV" in up:
        return "RV"
    if "MIXTO" in up:
        return "Mixto"
    if "RETORNO ABSOLUTO" in up or "ALTERN" in up:
        return "Alternativos"
    return "Otros"


def _allocation_vectors(tickers: list, asset_metadata=None):
    """Standard allocation vectors (Equity/Bond/Cash/Alternative/Other) for reporting metrics."""
    eq_vec, bd_vec, cs_vec, al_vec, ot_vec = [], [], [], [], []

    for t in tickers:
        meta = (asset_metadata or {}).get(t, {}) or {}
        metrics = meta.get("metrics", {}) or {}
        label = _classify_asset(t, asset_metadata)

        # Priority 0: Canonical V2 Portfolio Exposure (Strict Mathematical Truth)
        exp_v2 = meta.get("portfolio_exposure_v2")
        if exp_v2:
            # V2 is 0-100 scale, we need decimals for pypfopt constraint vectors
            # Fixed income is 'bond' in the Pydantic model EconomicExposureV2
            econ = exp_v2.get("economic_exposure", {})
            eq_raw = _to_float(econ.get("equity", 0.0))
            bd_raw = _to_float(econ.get("bond", 0.0)) or _to_float(econ.get("fixed_income", 0.0))
            cs_raw = _to_float(econ.get("cash", 0.0))
            # Alternatives in V2 are a detailed dict, sum them for the bucket
            al_dict = exp_v2.get("alternatives", {})
            al_raw = sum(_to_float(v) for v in al_dict.values())
            # If alternatives are not explicitly in economic_exposure, we use the dict sum
            # and ensure 'other' doesn't double count if possible, but the sum normalization (s)
            # below will handle the 100% scale.
            ot_raw = _to_float(econ.get("other", 0.0))

            eqp = max(0.0, min(100.0, eq_raw)) / 100.0
            bdp = max(0.0, min(100.0, bd_raw)) / 100.0
            csp = max(0.0, min(100.0, cs_raw)) / 100.0
            alp = max(0.0, min(100.0, al_raw)) / 100.0
            otp = max(0.0, min(100.0, ot_raw)) / 100.0
            
            # Enforce sum = 1.0 (to avoid rounding gaps in constraints)
            s = eqp + bdp + csp + alp + otp
            if s > 0:
                eqp, bdp, csp, alp, otp = eqp / s, bdp / s, csp / s, alp / s, otp / s
        else:
            # Priority 1: Metrics (if present)
            eq = metrics.get("equity", None)
            bd = metrics.get("bond", None)
            cs = metrics.get("cash", None)
            al = metrics.get("alternative", None) # check if present
            ot = metrics.get("other", None)

            has_metrics = any(v is not None for v in [eq, bd, cs, al, ot])
            if has_metrics:
                eqp = max(0.0, min(100.0, _to_float(eq, 0.0))) / 100.0
                bdp = max(0.0, min(100.0, _to_float(bd, 0.0))) / 100.0
                csp = max(0.0, min(100.0, _to_float(cs, 0.0))) / 100.0
                alp = max(0.0, min(100.0, _to_float(al, 0.0))) / 100.0
                otp = max(0.0, min(100.0, _to_float(ot, 0.0))) / 100.0
                s = eqp + bdp + csp + alp + otp
                if 0.95 <= s <= 1.05 and s > 0:
                    eqp, bdp, csp, alp, otp = eqp / s, bdp / s, csp / s, alp / s, otp / s
            else:
                # Priority 2: Label-based Inference
                eqp, bdp, csp, alp, otp = 0.0, 0.0, 0.0, 0.0, 0.0
                if label == "RV":
                    eqp = 1.0
                elif label == "RF":
                    bdp = 1.0
                elif label == "Monetario":
                    csp = 1.0
                elif label == "Alternativos":
                    alp = 1.0
                elif label == "Mixto":
                    eqp, bdp = 0.5, 0.5
                else:
                    otp = 1.0

        eq_vec.append(eqp)
        bd_vec.append(bdp)
        cs_vec.append(csp)
        al_vec.append(alp)
        ot_vec.append(otp)

    return np.array(eq_vec), np.array(bd_vec), np.array(cs_vec), np.array(al_vec), np.array(ot_vec), {}


def apply_market_proxy_backfill(df_prices, asset_metadata=None):
    """
    Identifies young funds (columns with missing history at the start) and
    backfills them using actual daily market returns via EODHD.
    This preserves the variance and covariance of the fund instead of
    flattening it to zero via naive bfill() or failing with yfinance.
    """
    import pandas as pd
    import requests
    from services.config import EODHD_API_KEY

    if not df_prices.isna().any().any():
        return df_prices

    logger.info("🔧 [Utils] Young funds detected. Fetching EODHD proxies...")

    PROXY_MAP = {
        "RV": "ACWI.US",
        "RF": "AGG.US",
        "Mixto": "AOR.US",
        "Monetario": "SHV.US",
    }

    fallback_returns = df_prices.pct_change().mean(axis=1)
    fallback_returns.iloc[0] = 0.0

    needed_proxies = set()
    young_cols = []

    for col in df_prices.columns:
        first_idx = df_prices[col].first_valid_index()
        if first_idx and first_idx > df_prices.index[0]:
            young_cols.append((col, first_idx))
            a_class = (asset_metadata or {}).get(col, {}).get("asset_class", "RV")
            proxy = PROXY_MAP.get(a_class, "ACWI.US")
            needed_proxies.add(proxy)

    proxy_data = pd.DataFrame(index=df_prices.index)
    start_str = df_prices.index[0].strftime("%Y-%m-%d")
    end_str = (df_prices.index[-1] + pd.Timedelta(days=1)).strftime("%Y-%m-%d")

    if EODHD_API_KEY:
        for proxy_ticker in needed_proxies:
            try:
                url = f"https://eodhd.com/api/eod/{proxy_ticker}?api_token={EODHD_API_KEY}&fmt=json&from={start_str}&to={end_str}"
                resp = requests.get(url, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        proxy_df = pd.DataFrame(data)
                        proxy_df["date"] = pd.to_datetime(proxy_df["date"])
                        proxy_df.set_index("date", inplace=True)
                        proxy_series = proxy_df["adjusted_close"]
                        aligned = proxy_series.reindex(df_prices.index).ffill().bfill()
                        proxy_data[proxy_ticker] = aligned
            except Exception as e:
                logger.info(f"⚠️ [Utils] Failed to fetch {proxy_ticker} from EODHD: {str(e)}")
    else:
        logger.info("⚠️ [Utils] EODHD_API_KEY missing. Falling back to internal average.")

    for col, first_idx in young_cols:
        missing_mask = df_prices.index < first_idx
        inception_price = df_prices.loc[first_idx, col]

        a_class = (asset_metadata or {}).get(col, {}).get("asset_class", "RV")
        proxy_ticker = PROXY_MAP.get(a_class, "ACWI.US")

        if (
            proxy_ticker in proxy_data.columns
            and not proxy_data[proxy_ticker].isnull().all()
        ):
            rel_proxy = proxy_data.loc[
                missing_mask | (df_prices.index == first_idx), proxy_ticker
            ]
            base_proxy_price = rel_proxy.loc[first_idx]
            if pd.notna(base_proxy_price) and base_proxy_price > 0:
                synthetic_prices = (rel_proxy / base_proxy_price) * inception_price
                df_prices.loc[missing_mask, col] = synthetic_prices[missing_mask]
                continue

        # Fallback math using average cross-section returns reversed
        try:
            relevant_market_ret = fallback_returns[df_prices.index <= first_idx][
                ::-1
            ].fillna(0.0)
            relevant_market_ret.iloc[-1] = 0.0
            cum_discount = (1 + relevant_market_ret).cumprod()
            synthetic_prices = (inception_price / cum_discount)[::-1]
            df_prices.loc[missing_mask, col] = synthetic_prices[missing_mask]
        except Exception:
            df_prices.loc[missing_mask, col] = inception_price

    return df_prices
