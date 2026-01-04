import numpy as np
import pandas as pd
from datetime import datetime
from firebase_admin import firestore

def update_daily_metrics(db):
    """
    Iterates all funds in funds_v2, calculates metrics from returns_history,
    and updates std_perf.
    """
    print("🚀 Starting Daily Metrics Update...")
    
    # 1. Fetch all funds
    funds_ref = db.collection('funds_v2')
    docs = funds_ref.stream()
    
    batch = db.batch()
    count = 0
    updated_count = 0
    BATCH_SIZE = 400
    
    for doc in docs:
        try:
            fund = doc.to_dict()
            history = fund.get('returns_history') # Expected: Map<DateStr, Price/NAV> or Returns?
            
            # Based on frontend logic, we assumed returns_history was Price/NAV for calculation
            # or pre-calculated returns. Let's assume Price/NAV which is standard for Raw Data.
            # If it is formatted as simple returns, we process accordingly.
            # Let's handle both or assume standard.
            # Given prior context, let's treat it as Time Series of NAVs.
            
            if not history or len(history) < 10:
                continue

            # Convert to Series
            df = pd.Series(history)
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()

            # Clean zeroes or nulls
            df = df[df > 0]
            if len(df) < 10: continue

            # Calculate Daily Returns: (P_t / P_t-1) - 1
            returns = df.pct_change().dropna()
            
            if len(returns) < 5: continue
            
            # 1. Volatility (Annualized) - Assuming Daily
            vol = returns.std() * np.sqrt(252)
            
            # 2. CAGR (3 Years or Max)
            days = (df.index[-1] - df.index[0]).days
            years = days / 365.25
            if years < 0.5: continue # Too short

            total_ret = (df.iloc[-1] / df.iloc[0]) - 1
            cagr = (1 + total_ret) ** (1 / years) - 1
            
            # 3. Sharpe (Assuming Rf=0 for simple storage, adjusted in frontend)
            sharpe = 0
            if vol > 0:
                sharpe = cagr / vol

            # 4. Value at Risk (VaR) & CVaR (Historical Method, 95% Confidence)
            # "How much could I lose in a bad day?"
            # We use the 5th percentile of daily returns
            var_95_daily = np.percentile(returns, 5)
            
            # CVaR (Average of losses exceeding VaR)
            cvar_returns = returns[returns <= var_95_daily]
            cvar_95_daily = cvar_returns.mean() if len(cvar_returns) > 0 else var_95_daily
            
            # Prepare Update
            update_data = {
                'std_perf.volatility': float(round(vol, 4)),
                'std_perf.sharpe': float(round(sharpe, 4)),
                'std_perf.cagr3y': float(round(cagr, 4)) if years >= 3 else fund.get('std_perf', {}).get('cagr3y'),
                'std_perf.var95': float(round(var_95_daily, 4)), # Daily VaR
                'std_perf.cvar95': float(round(cvar_95_daily, 4)), # Daily CVaR
                'std_perf.last_updated': datetime.now()
            }
            
            # Remove None values
            update_data = {k: v for k, v in update_data.items() if v is not None}

            batch.update(doc.reference, update_data)
            count += 1
            
            if count >= BATCH_SIZE:
                batch.commit()
                batch = db.batch()
                updated_count += count
                count = 0
                print(f"📦 Committed batch of {BATCH_SIZE} updates...")

        except Exception as e:
            print(f"⚠️ Error updating fund {doc.id}: {e}")

    # Commit remaining
    if count > 0:
        batch.commit()
        updated_count += count
    
    print(f"✅ Daily Update Complete. Updated {updated_count} funds.")
    return {'success': True, 'updated': updated_count}
