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
    """Determines bucket label (RV, RF, Mixto, Monetario, Otros) strictly from DB"""
    meta = (asset_metadata or {}).get(ticker, {}) or {}
    
    # 1. Expect Explicit Tag (e.g. injected during fallback)
    if meta.get('label') in ["RV", "RF", "Mixto", "Monetario", "Otros", "Inmobiliario", "Retorno Absoluto"]:
        return meta['label']

    # 2. Use exact derived.asset_class math label
    raw = (meta.get('asset_class') or 'Otros').strip()
    valid_classes = ["RV", "RF", "Mixto", "Monetario", "Otros", "Inmobiliario", "Retorno Absoluto"]
    
    # Capitalize first letter logic is generally maintained by JS, but just in case
    # Note: DB has them as "RF", "RV", "Mixto", "Monetario", "Otros"
    if raw in valid_classes:
        return raw

    # 3. Emergency fallback only if derived string somehow mutated
    up = raw.upper()
    if "MONETARIO" in up: return "Monetario"
    if "FIJA" in up or "RF" in up: return "RF"
    if "VARIABLE" in up or "RV" in up: return "RV"
    if "MIXTO" in up: return "Mixto"
    return "Otros"

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
