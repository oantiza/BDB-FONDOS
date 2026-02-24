import numpy as np

def _to_float(x, default=0.0):
    try:
        if x is None: return float(default)
        if isinstance(x, str):
            s = x.strip().replace('%', '').replace(',', '.')
            return float(s)
        return float(x)
    except Exception:
        return float(default)

def _normalize(weights: dict) -> dict:
    s = sum(max(0.0, float(v)) for v in weights.values())
    if s <= 0: return weights
    return {k: float(v) / s for k, v in weights.items()}

def _cap(weights: dict, max_w: float) -> dict:
    return {k: min(float(v), max_w) for k, v in weights.items()}

def _classify_asset(ticker: str, asset_metadata=None) -> str:
    """Determines bucket label (RV, RF, Mixto, Monetario, Other)"""
    meta = (asset_metadata or {}).get(ticker, {}) or {}
    
    # 1. Expect Explicit Tag from Frontend/Main (BEST)
    if meta.get('label') in ["RV", "RF", "Mixto", "Monetario"]:
        return meta['label']

    # 2. Try raw asset_class (std_type)
    raw = (meta.get('asset_class') or '').strip().upper()
    
    if "MONETARIO" in raw or "CASH" in raw or "LIQUIDEZ" in raw or "MONEY" in raw: return "Monetario"
    if "FIJA" in raw or "FIXED" in raw or "BOND" in raw or "CREDIT" in raw: return "RF"
    if "VARIABLE" in raw or "EQUITY" in raw or "STOCK" in raw or "ACCION" in raw or "RV" in raw: return "RV"
    if "MIXTO" in raw or "MIXED" in raw or "MULTI" in raw or "BALANCED" in raw or "ALLOCATION" in raw: return "Mixto"
    return "Other" # Default/Fallback

def _allocation_vectors(tickers: list, asset_metadata=None):
    """Standard allocation vectors (Equity/Bond/Cash/Other) for reporting metrics."""
    eq_vec, bd_vec, cs_vec, ot_vec = [], [], [], []
    
    for t in tickers:
        meta = (asset_metadata or {}).get(t, {}) or {}
        metrics = meta.get('metrics', {}) or {}
        label = _classify_asset(t, asset_metadata)

        # Priority 1: Metrics (if present)
        eq = metrics.get('equity', None)
        bd = metrics.get('bond', None)
        cs = metrics.get('cash', None)
        ot = metrics.get('other', None)

        has_metrics = any(v is not None for v in [eq, bd, cs, ot])
        if has_metrics:
            eqp = max(0.0, min(100.0, _to_float(eq, 0.0))) / 100.0
            bdp = max(0.0, min(100.0, _to_float(bd, 0.0))) / 100.0
            csp = max(0.0, min(100.0, _to_float(cs, 0.0))) / 100.0
            otp = max(0.0, min(100.0, _to_float(ot, 0.0))) / 100.0
            s = eqp + bdp + csp + otp
            if 0.95 <= s <= 1.05 and s > 0:
                eqp, bdp, csp, otp = eqp / s, bdp / s, csp / s, otp / s
        else:
            # Priority 2: Label-based Inference
            if label == 'RV': eqp, bdp, csp, otp = 1.0, 0.0, 0.0, 0.0
            elif label == 'RF': eqp, bdp, csp, otp = 0.0, 1.0, 0.0, 0.0
            elif label == 'Monetario': eqp, bdp, csp, otp = 0.0, 0.0, 1.0, 0.0
            elif label == 'Mixto': eqp, bdp, csp, otp = 0.5, 0.5, 0.0, 0.0
            else: eqp, bdp, csp, otp = 0.0, 0.0, 0.0, 1.0

        eq_vec.append(eqp); bd_vec.append(bdp); cs_vec.append(csp); ot_vec.append(otp)

    return np.array(eq_vec), np.array(bd_vec), np.array(cs_vec), np.array(ot_vec), {}
