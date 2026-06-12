import logging
logger = logging.getLogger(__name__)
import numpy as np


def _normalize_token(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text.replace("-", "_").replace(" ", "_").upper()


def _to_float(x, default=0.0):
    try:
        if x is None:
            return float(default) if default is not None else None
        if isinstance(x, str):
            s = x.strip().replace("%", "").replace(",", ".")
            return float(s)
        return float(x)
    except Exception:
        return float(default) if default is not None else None


def _normalize(weights: dict) -> dict:
    cleaned = {}
    for k, v in (weights or {}).items():
        try:
            value = float(v)
        except Exception:
            value = 0.0
        if not np.isfinite(value) or value < 0.0:
            value = 0.0
        cleaned[k] = value

    s = sum(cleaned.values())
    if s <= 0:
        return cleaned
    return {k: v / s for k, v in cleaned.items()}


def _cap(weights: dict, max_w: float) -> dict:
    return {k: min(float(v), max_w) for k, v in weights.items()}


def normalize_v2_asset_type(value):
    token = _normalize_token(value)
    if not token:
        return None
    mapping = {
        "EQUITY": "equity",
        "FIXED_INCOME": "fixed_income",
        "MIXED": "allocation",
        "ALLOCATION": "allocation",
        "MONETARY": "money_market",
        "MONEY_MARKET": "money_market",
        "ALTERNATIVE": "alternative",
        "REAL_ESTATE": "real_asset",
        "REAL_ASSET": "real_asset",
        "COMMODITIES": "commodities",
        "OTHER": "other",
        "UNKNOWN": "unknown",
    }
    return mapping.get(token, token.lower())


def asset_type_to_bucket_label(value) -> str:
    asset_type = normalize_v2_asset_type(value)
    if asset_type == "equity":
        return "RV"
    if asset_type == "fixed_income":
        return "RF"
    if asset_type == "allocation":
        return "Mixto"
    if asset_type == "money_market":
        return "Monetario"
    if asset_type == "alternative":
        return "Alternativos"
    return "Otros"


def normalize_v2_subtype(value):
    return _normalize_token(value)


def normalize_v2_region(value):
    token = _normalize_token(value)
    if not token:
        return None
    mapping = {
        "GLOBAL": "global",
        "EUROPE": "europe",
        "EUROPA": "europe",
        "EUROZONE": "eurozone",
        "ZONA_EURO": "eurozone",
        "US": "us",
        "USA": "us",
        "EE.UU.": "us",
        "EEUU": "us",
        "EMERGING": "emerging",
        "EMERGENTES": "emerging",
        "JAPAN": "japan",
        "JAPON": "japan",
        "ASIA_DEV": "asia_dev",
        "ASIA_DESARROLLADA": "asia_dev",
        "UNKNOWN": "unknown",
    }
    return mapping.get(token, token.lower())


def normalize_v2_credit_bucket(value):
    token = _normalize_token(value)
    if not token:
        return None
    mapping = {
        "HIGH_QUALITY": "high_quality",
        "INVESTMENT_GRADE": "high_quality",
        "MEDIUM_QUALITY": "medium_quality",
        "LOW_QUALITY": "low_quality",
        "HIGH_YIELD": "low_quality",
        "UNKNOWN": "unknown",
    }
    return mapping.get(token, token.lower())


def normalize_v2_duration_bucket(value):
    token = _normalize_token(value)
    if not token:
        return None
    mapping = {
        "ULTRASHORT": "short",
        "SHORT": "short",
        "INTERMEDIATE": "medium",
        "MEDIUM": "medium",
        "LONG": "long",
        "FLEXIBLE": "flexible",
        "UNKNOWN": "unknown",
    }
    return mapping.get(token, token.lower())


def _as_fraction(value, default=0.0):
    # FIX H5 parcial (auditoria 2026-06-09): umbral alineado con el resto del
    # backend (_sanitize_fraction y bounds_resolver._coerce_bound usan > 1.0).
    # Con el umbral anterior (1.5), un valor porcentual en (1.0, 1.5] —p.ej.
    # 1.2 = 1.2%— se leia como 120% y se clampaba a 100%. Datos canonicos
    # verificados en fraccion 0..1: sin impacto; corrige porcentajes legacy.
    val = _to_float(value, default)
    if abs(val) > 1.0:
        val = val / 100.0
    return max(0.0, min(1.0, val))


def _normalize_region_exposure_key(value):
    token = _normalize_token(value)
    if not token:
        return None
    mapping = {
        "UNITED_STATES": ("us", "americas"),
        "US": ("us", "americas"),
        "USA": ("us", "americas"),
        "CANADA": ("americas",),
        "LATIN_AMERICA": ("latin_america", "americas", "emerging"),
        "IBEROAMERICA": ("latin_america", "americas", "emerging"),
        "EUROPE": ("europe",),
        "EUROPA": ("europe",),
        "EUROZONE": ("eurozone", "europe"),
        "EUROPE_EX_EURO": ("europe",),
        "UNITED_KINGDOM": ("europe",),
        "EUROPE_EMERGING": ("europe", "emerging"),
        "JAPAN": ("japan", "asia_dev"),
        "DEVELOPED_ASIA": ("asia_dev",),
        "ASIA_DEV": ("asia_dev",),
        "AUSTRALASIA": ("asia_dev",),
        "ASIA_EMERGING": ("emerging",),
        "CHINA": ("emerging",),
        "MIDDLE_EAST": ("emerging",),
        "AFRICA": ("emerging",),
        "AMERICAS": ("americas",),
        "ASIA": ("asia_dev", "emerging"),
        "GLOBAL": ("global",),
        "OTHER": ("other",),
    }
    return mapping.get(token, (token.lower(),))


def _normalize_group_key(group_type, key):
    token = _normalize_token(key)
    if not token:
        return []

    if group_type == "regions":
        return list(_normalize_region_exposure_key(key))

    if group_type == "styles":
        return [token.lower()]

    if group_type == "sectors":
        sector_token = token.lower()
        if sector_token == "financial_services":
            sector_token = "financials"
        return [sector_token]

    if group_type == "credit":
        return [normalize_v2_credit_bucket(key) or token.lower()]

    if group_type == "duration":
        return [normalize_v2_duration_bucket(key) or token.lower()]

    if group_type == "bond_types":
        return [token.lower()]

    if group_type == "market_caps":
        return [token.lower()]

    if group_type == "alternatives":
        return [token.lower()]

    return [token.lower()]


def _normalize_group_map(values, group_type, as_percent=False):
    if not isinstance(values, dict):
        return {}

    normalized = {}
    for raw_key, raw_value in values.items():
        weight = _as_fraction(raw_value, 0.0)
        if weight <= 0:
            continue
        for key in _normalize_group_key(group_type, raw_key):
            normalized[key] = normalized.get(key, 0.0) + weight

    if as_percent:
        return {k: round(v * 100.0, 6) for k, v in normalized.items()}
    return normalized


def extract_v2_identity(meta):
    class_v2 = (meta or {}).get("classification_v2", {}) or (meta or {}).get("v2_identity", {}) or {}
    return {
        "asset_type": normalize_v2_asset_type(class_v2.get("asset_type")),
        "asset_subtype": normalize_v2_subtype(class_v2.get("asset_subtype")),
        "region_primary": normalize_v2_region(class_v2.get("region_primary")),
        "fixed_income_type": _normalize_token(class_v2.get("fixed_income_type")),
        "credit_bucket": normalize_v2_credit_bucket(class_v2.get("credit_bucket") or class_v2.get("fi_credit_bucket")),
        "duration_bucket": normalize_v2_duration_bucket(class_v2.get("duration_bucket") or class_v2.get("fi_duration_bucket")),
        "risk_bucket": _normalize_token(class_v2.get("risk_bucket")),
        "warnings": class_v2.get("warnings", []) or [],
        "classification_confidence": _to_float(class_v2.get("classification_confidence"), 0.0),
    }


def has_usable_v2_identity(meta) -> bool:
    return extract_v2_identity(meta).get("asset_type") not in {None, "unknown"}


def get_v2_asset_mix(meta, as_percent=False):
    exp_v2 = (meta or {}).get("portfolio_exposure_v2", {}) or {}
    fallback_mix = (meta or {}).get("v2_exposure", {}) or {}
    mix = exp_v2.get("asset_mix") or fallback_mix or {}
    econ = exp_v2.get("economic_exposure") or fallback_mix or {}
    asset_type = extract_v2_identity(meta).get("asset_type")

    equity = _as_fraction(mix.get("equity", econ.get("equity", 0.0)))
    bond = _as_fraction(mix.get("bond", econ.get("bond", econ.get("fixed_income", 0.0))))
    cash = _as_fraction(mix.get("cash", econ.get("cash", 0.0)))
    alternative = _as_fraction(mix.get("alternative", mix.get("alternatives", econ.get("alternative", 0.0))))
    real_asset = _as_fraction(mix.get("real_asset", mix.get("real_estate", econ.get("real_asset", econ.get("real_estate", 0.0)))))
    other = _as_fraction(mix.get("other", econ.get("other", 0.0)))

    alt_map = _normalize_group_map(exp_v2.get("alternatives"), "alternatives")
    if alt_map and alternative <= 0:
        alternative = min(1.0, sum(alt_map.values()))

    if asset_type == "alternative" and alternative <= 0 and other > 0:
        alternative = other
        other = 0.0
    elif asset_type in {"real_asset", "commodities"} and real_asset <= 0 and other > 0:
        real_asset = other
        other = 0.0

    total = equity + bond + cash + alternative + real_asset + other
    if total <= 1e-12:
        return {}

    normalized = {
        "equity": equity / total,
        "bond": bond / total,
        "cash": cash / total,
        "alternative": alternative / total,
        "real_asset": real_asset / total,
        "other": other / total,
    }
    if as_percent:
        return {k: round(v * 100.0, 6) for k, v in normalized.items()}
    return normalized


def get_effective_asset_mix(meta, as_percent=False):
    mix = get_v2_asset_mix(meta, as_percent=False)
    if mix:
        if as_percent:
            return {k: round(v * 100.0, 6) for k, v in mix.items()}
        return mix

    metrics = (meta or {}).get("metrics", {}) or {}
    metric_mix = {
        "equity": _as_fraction(metrics.get("equity", 0.0)),
        "bond": _as_fraction(metrics.get("bond", 0.0)),
        "cash": _as_fraction(metrics.get("cash", 0.0)),
        "alternative": _as_fraction(metrics.get("alternative", 0.0)),
        "real_asset": _as_fraction(metrics.get("real_asset", metrics.get("real_estate", 0.0))),
        "other": _as_fraction(metrics.get("other", 0.0)),
    }
    metric_total = sum(metric_mix.values())
    if metric_total > 1e-12:
        normalized = {k: v / metric_total for k, v in metric_mix.items()}
        if as_percent:
            return {k: round(v * 100.0, 6) for k, v in normalized.items()}
        return normalized

    asset_type = extract_v2_identity(meta).get("asset_type")
    if asset_type == "equity":
        base = {"equity": 1.0, "bond": 0.0, "cash": 0.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
    elif asset_type == "fixed_income":
        base = {"equity": 0.0, "bond": 1.0, "cash": 0.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
    elif asset_type == "money_market":
        base = {"equity": 0.0, "bond": 0.0, "cash": 1.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
    elif asset_type == "alternative":
        base = {"equity": 0.0, "bond": 0.0, "cash": 0.0, "alternative": 1.0, "real_asset": 0.0, "other": 0.0}
    elif asset_type in {"real_asset", "commodities"}:
        base = {"equity": 0.0, "bond": 0.0, "cash": 0.0, "alternative": 0.0, "real_asset": 1.0, "other": 0.0}
    else:
        label_override = (meta or {}).get("label") or (meta or {}).get("asset_class")
        if label_override:
            logger.warning(f"⚠️ [Utils] get_effective_asset_mix: V2 unavailable, falling back to legacy label '{label_override}'")
        if label_override == "RV":
            base = {"equity": 1.0, "bond": 0.0, "cash": 0.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
        elif label_override == "RF":
            base = {"equity": 0.0, "bond": 1.0, "cash": 0.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
        elif label_override == "Monetario":
            base = {"equity": 0.0, "bond": 0.0, "cash": 1.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
        elif label_override in {"Alternativos", "Retorno Absoluto"}:
            base = {"equity": 0.0, "bond": 0.0, "cash": 0.0, "alternative": 1.0, "real_asset": 0.0, "other": 0.0}
        elif label_override == "Mixto":
            isin = (meta or {}).get("isin") or (meta or {}).get("id") or "UNKNOWN"
            logger.warning(
                "[Utils] mixed_missing_asset_mix: isin=%s; "
                "mixed_legacy_50_50_fallback active; requires_exposure_review.",
                isin,
            )
            base = {"equity": 0.5, "bond": 0.5, "cash": 0.0, "alternative": 0.0, "real_asset": 0.0, "other": 0.0}
        else:
            base = {}

    if not base:
        return {}
    if as_percent:
        return {k: round(v * 100.0, 6) for k, v in base.items()}
    return base


def get_profile_bucket_exposure(meta, as_percent=False):
    mix = get_effective_asset_mix(meta, as_percent=False)
    if not mix:
        return {}

    profile_mix = {
        "RV": mix.get("equity", 0.0),
        "RF": mix.get("bond", 0.0),
        "Monetario": mix.get("cash", 0.0),
        "Alternativos": mix.get("alternative", 0.0) + mix.get("real_asset", 0.0),
        "Otros": mix.get("other", 0.0),
    }
    total = sum(profile_mix.values())
    if total > 1e-12:
        profile_mix = {k: v / total for k, v in profile_mix.items()}
    if as_percent:
        return {k: round(v * 100.0, 6) for k, v in profile_mix.items()}
    return profile_mix


def has_usable_v2_exposure(meta) -> bool:
    return bool(get_v2_asset_mix(meta))


def get_v2_group_map(meta, group_type, as_percent=False):
    exp_v2 = (meta or {}).get("portfolio_exposure_v2", {}) or {}
    source_map = {
        "regions": exp_v2.get("equity_regions"),
        "equity_regions": exp_v2.get("equity_regions"),
        "styles": exp_v2.get("equity_styles"),
        "equity_styles": exp_v2.get("equity_styles"),
        "sectors": exp_v2.get("sectors"),
        "credit": exp_v2.get("credit") or exp_v2.get("fi_credit"),
        "duration": exp_v2.get("duration") or exp_v2.get("fi_duration"),
        "bond_types": exp_v2.get("bond_types") or exp_v2.get("fi_types"),
        "market_caps": exp_v2.get("market_caps"),
        "alternatives": exp_v2.get("alternatives"),
    }
    normalized = _normalize_group_map(source_map.get(group_type), group_type if group_type not in {"equity_regions", "equity_styles"} else group_type.replace("equity_", ""), as_percent=as_percent)
    if normalized:
        return normalized

    if group_type in {"regions", "equity_regions"}:
        derived_exposure = ((meta or {}).get("derived", {}) or {}).get("portfolio_exposure", {}) or {}
        regions = (
            derived_exposure.get("equity_regions_total")
            or ((meta or {}).get("ms", {}) or {}).get("regions", {}).get("detail")
            or ((meta or {}).get("ms", {}) or {}).get("regions", {}).get("macro")
            or (meta or {}).get("regions")
        )
        return _normalize_group_map(regions, "regions", as_percent=as_percent)

    return {}


def get_effective_group_map(meta, group_type, as_percent=False):
    normalized = get_v2_group_map(meta, group_type, as_percent=as_percent)
    if normalized:
        return normalized

    canonical_group_type = group_type
    if canonical_group_type == "equity_regions":
        canonical_group_type = "regions"
    elif canonical_group_type == "equity_styles":
        canonical_group_type = "styles"

    identity = extract_v2_identity(meta)
    identity_sources = {
        "regions": [{identity.get("region_primary"): 1.0}] if identity.get("region_primary") not in {None, "unknown"} else [],
        "credit": [{identity.get("credit_bucket"): 1.0}] if identity.get("credit_bucket") not in {None, "unknown"} else [],
        "duration": [{identity.get("duration_bucket"): 1.0}] if identity.get("duration_bucket") not in {None, "unknown"} else [],
        "bond_types": [{identity.get("fixed_income_type"): 1.0}] if identity.get("fixed_income_type") else [],
    }
    for candidate in identity_sources.get(canonical_group_type, []):
        normalized_candidate = _normalize_group_map(candidate, canonical_group_type, as_percent=as_percent)
        if normalized_candidate:
            return normalized_candidate

    derived_exposure = ((meta or {}).get("derived", {}) or {}).get("portfolio_exposure", {}) or {}
    ms = (meta or {}).get("ms", {}) or {}
    legacy_sources = {
        "regions": [
            derived_exposure.get("equity_regions_total"),
            (ms.get("regions", {}) or {}).get("detail"),
            (ms.get("regions", {}) or {}).get("macro"),
            (meta or {}).get("regions"),
        ],
        "styles": [
            derived_exposure.get("equity_styles_total"),
            (meta or {}).get("equity_styles"),
            (meta or {}).get("styles"),
            (ms.get("equity_style", {}) or {}),
        ],
        "sectors": [
            derived_exposure.get("sectors_total"),
            (meta or {}).get("sectors"),
            (ms.get("sectors", {}) or {}).get("detail"),
        ],
        "credit": [
            derived_exposure.get("credit_total"),
            (meta or {}).get("credit"),
            (meta or {}).get("fi_credit"),
        ],
        "duration": [
            derived_exposure.get("duration_total"),
            (meta or {}).get("duration"),
            (meta or {}).get("fi_duration"),
        ],
        "bond_types": [
            derived_exposure.get("bond_types_total"),
            (meta or {}).get("bond_types"),
            (meta or {}).get("fi_types"),
        ],
        "market_caps": [
            derived_exposure.get("market_caps_total"),
            (meta or {}).get("market_caps"),
        ],
        "alternatives": [
            derived_exposure.get("alternatives_total"),
            (meta or {}).get("alternatives"),
        ],
    }

    for candidate in legacy_sources.get(canonical_group_type, []):
        normalized_candidate = _normalize_group_map(candidate, canonical_group_type, as_percent=as_percent)
        if normalized_candidate:
            return normalized_candidate

    return {}


def summarize_v2_quality(meta):
    class_v2 = (meta or {}).get("classification_v2", {}) or (meta or {}).get("v2_identity", {}) or {}
    exp_v2 = (meta or {}).get("portfolio_exposure_v2", {}) or (meta or {}).get("v2_quality", {}) or {}
    return {
        "identity_ready": has_usable_v2_identity(meta),
        "exposure_ready": has_usable_v2_exposure(meta),
        "classification_confidence": _to_float(class_v2.get("classification_confidence"), 0.0),
        "exposure_confidence": _to_float(exp_v2.get("exposure_confidence"), 0.0),
        "warnings": (class_v2.get("warnings", []) or []) + (exp_v2.get("warnings", []) or []),
    }


def _classify_asset(ticker: str, asset_metadata=None) -> str:
    """Determines bucket label (RV, RF, Mixto, Monetario, Alternativos, Otros) strictly from DB"""
    meta = (asset_metadata or {}).get(ticker, {}) or {}

    # 0. Canonical V2 (BEST SOURCE OF TRUTH)
    identity = extract_v2_identity(meta)
    if identity.get("asset_type") not in {None, "unknown"}:
        return asset_type_to_bucket_label(identity.get("asset_type"))


    # 1. Expect Explicit Tag (e.g. injected during fallback or testing overrides)
    label_override = meta.get("label") or meta.get("asset_class")
    if label_override in [
        "RV",
        "RF",
        "Mixto",
        "Monetario",
        "Alternativos",
        "Otros",
    ]:
        return label_override
    
    # Map Retorno Absoluto to Alternativos if it comes from legacy label
    if label_override == "Retorno Absoluto":
        return "Alternativos"

    return "Otros"


def _allocation_vectors(tickers: list, asset_metadata=None):
    """Standard allocation vectors (Equity/Bond/Cash/Alternative/RealAsset/Other) for reporting metrics.
    Returns 6 vectors consistent with optimizer_core._build_exposure_vectors."""
    eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec = [], [], [], [], [], []

    for t in tickers:
        meta = (asset_metadata or {}).get(t, {}) or {}
        mix = get_effective_asset_mix(meta)
        if mix:
            eqp = mix.get("equity", 0.0)
            bdp = mix.get("bond", 0.0)
            csp = mix.get("cash", 0.0)
            alp = mix.get("alternative", 0.0)
            rap = mix.get("real_asset", 0.0)
            otp = mix.get("other", 0.0)
        else:
            eqp, bdp, csp, alp, rap, otp = 0.0, 0.0, 0.0, 0.0, 0.0, 1.0

        eq_vec.append(eqp)
        bd_vec.append(bdp)
        cs_vec.append(csp)
        al_vec.append(alp)
        ra_vec.append(rap)
        ot_vec.append(otp)

    return np.array(eq_vec), np.array(bd_vec), np.array(cs_vec), np.array(al_vec), np.array(ra_vec), np.array(ot_vec)


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
            a_class = _classify_asset(col, asset_metadata)
            proxy = PROXY_MAP.get(a_class, "ACWI.US")
            needed_proxies.add(proxy)

    proxy_data = pd.DataFrame(index=df_prices.index)
    # Start fetch 7 days earlier to provide a buffer for ffill on day 0
    start_dt = df_prices.index[0] - pd.Timedelta(days=7)
    start_str = start_dt.strftime("%Y-%m-%d")
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
                        aligned = proxy_series.reindex(df_prices.index).ffill()
                        proxy_data[proxy_ticker] = aligned
            except Exception as e:
                logger.info(f"⚠️ [Utils] Failed to fetch {proxy_ticker} from EODHD: {str(e)}")
    else:
        logger.info("⚠️ [Utils] EODHD_API_KEY missing. Falling back to internal average.")

    for col, first_idx in young_cols:
        missing_mask = df_prices.index < first_idx
        inception_price = df_prices.loc[first_idx, col]

        a_class = _classify_asset(col, asset_metadata)
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
