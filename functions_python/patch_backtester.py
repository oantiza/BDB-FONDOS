import os

path = r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\services\backtester.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

target = """    # Find actual common history inside this requested period window
    df = df.dropna(subset=valid_assets)
    if df.empty:
        return {"error": f"No common history within the requested period '{period}'."}

    span_days = (df.index[-1] - df.index[0]).days if len(df.index) > 1 else 0
    min_required_obs = 5
    if len(df) < min_required_obs:
        return {
            "error": (
                f"Insufficient common history for {period}. "
                f"Needed at least {min_required_obs} observations, got {len(df)}."
            )
        }

    if False:
        # Legacy hard-fail disabled; reduced coverage is surfaced via warnings below.
        min_required_span = 0
        span_days = (df.index[-1] - df.index[0]).days
        if span_days < min_required_span:
            return {"error": f"Insufficient common history for {period}. Needed ~{int(min_required_span)} días, got {span_days}."}

    # Short History Warning
    history_days = len(df)
    warnings = []
    if period != "max" and span_days < lookback * 0.85:
        warnings.append(
            f"Reduced History Warning ({period.upper()}): using {history_days} observations over {span_days} days of common history."
        )
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

    port_ret = returns.dot(w_vector)"""

replacement = """    # Dynamic Weighting Logic: Do NOT drop missing values to allow dynamic backfilling
    # Drop only days where ALL assets are missing
    df = df.dropna(subset=valid_assets, how='all')
    
    if df.empty:
        return {"error": f"No data within the requested period '{period}'."}

    span_days = (df.index[-1] - df.index[0]).days if len(df.index) > 1 else 0
    min_required_obs = 5
    if len(df) < min_required_obs:
        return {
            "error": (
                f"Insufficient history for {period}. "
                f"Needed at least {min_required_obs} observations, got {len(df)}."
            )
        }

    if False:
        pass

    # Short History Warning
    history_days = len(df)
    warnings = []
    
    # Check for actual missing data in some assets to warn the user about backfilling
    has_missing = df[valid_assets].isnull().any().any()
    if has_missing:
        warnings.append("Dynamic Backfill: Se ha simulado el periodo anterior a la creación de algunos fondos nuevos utilizando el resto de la cartera.")

    if period != "max" and span_days < lookback * 0.85:
        warnings.append(
            f"Reduced History Warning ({period.upper()}): using {history_days} observations over {span_days} days."
        )
    if history_days < 126:
        warnings.append(
            f"Short History Warning: Comparison limited to last {history_days} days."
        )

    # Portfolio Return Calculation
    df_port = df[valid_assets]
    returns = df_port.pct_change(fill_method=None)

    # ====================================================================
    # DEFENSIVE RETURN CLIPPING: Cap daily returns at ±15%
    # ====================================================================
    DAILY_RETURN_CAP = 0.15
    clipped_count = (returns.abs() > DAILY_RETURN_CAP).sum().sum()
    if clipped_count > 0:
        print(
            f"⚠️ [Backtester] Clipping {clipped_count} extreme daily returns (>±{DAILY_RETURN_CAP * 100}%)"
        )
        returns = returns.clip(-DAILY_RETURN_CAP, DAILY_RETURN_CAP)

    # Dynamic Weighting Logic
    w_series = pd.Series([weights_map.get(c, 0) for c in df_port.columns], index=df_port.columns)
    if w_series.sum() > 0:
        w_series = w_series / w_series.sum()

    # Identify available assets each day
    available_mask = returns.notna()
    
    # Sum of available weights each day
    sum_available_weights = available_mask.multiply(w_series, axis=1).sum(axis=1)
    
    # Keep only days where at least one asset has data
    valid_days_mask = sum_available_weights > 0
    returns = returns[valid_days_mask]
    sum_available_weights = sum_available_weights[valid_days_mask]
    
    # Calculate portfolio return: Weighted sum divided by available weight
    port_ret = (returns.fillna(0) * w_series).sum(axis=1) / sum_available_weights"""

if target in content:
    content = content.replace(target, replacement)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("done")
else:
    print("Target string not found in file")
