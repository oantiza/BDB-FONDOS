#!/usr/bin/env python3
"""
Simple Scoring Comparison Script
Compares old vs new scoring formula on sample funds
"""

# Sample fund data (simulate Firestore documents)
sample_funds = [
    {
        'name': 'Fund A - High Sharpe, Low Drawdown',
        'isin': 'TESTA001',
        'perf': {
            'sharpe': 2.5,
            'alpha': 3.0,
            'volatility': 0.10,
            'cagr3y': 0.12,
            'cagr6m': 0.14,
            'max_drawdown': 0.05,  # -5%
            'sortino_ratio': 3.2
        },
        'inception_years': 8
    },
    {
        'name': 'Fund B - Medium Sharpe, High Drawdown',
        'isin': 'TESTB002',
        'perf': {
            'sharpe': 1.5,
            'alpha': 1.0,
            'volatility': 0.15,
            'cagr3y': 0.08,
            'cagr6m': 0.10,
            'max_drawdown': 0.20,  # -20%
            'sortino_ratio': 1.8
        },
        'inception_years': 5
    },
    {
        'name': 'Fund C - Low Sharpe, No Drawdown Data',
        'isin': 'TESTC003',
        'perf': {
            'sharpe': 0.8,
            'alpha': -1.0,
            'volatility': 0.12,
            'cagr3y': 0.05,
            'cagr6m': 0.04,
            'max_drawdown': 0,  # Missing
            'sortino_ratio': 0
        },
        'inception_years': 3
    }
]

def score_old_formula(fund, target_vol=0.12):
    """Old scoring: 35% Sharpe, 25% Alpha, 20% Safety, 10% Momentum, 10% Quality"""
    perf = fund['perf']
    years = fund['inception_years']
    
    # 1. Sharpe (35%)
    sharpe_norm = max(-1, min(3, perf['sharpe']))
    sharpe_score = (sharpe_norm / 3) * 35
    
    # 2. Alpha (25%)
    alpha_norm = max(-5, min(5, perf['alpha']))
    alpha_score = ((alpha_norm + 5) / 10) * 25
    
    # 3. Safety (20%)
    safety_ratio = max(0, (target_vol - perf['volatility']) / target_vol)
    safety_score = safety_ratio * 100 * 0.20
    
    # 4. Momentum (10%)
    if perf['cagr3y'] != 0:
        momentum_ratio = perf['cagr6m'] / perf['cagr3y']
        momentum_score = max(0, min(1, momentum_ratio)) * 10
    else:
        momentum_score = 0
    
    # 5. Quality (10%)
    quality_score = min(years / 10, 1) * 10
    
    return sharpe_score + alpha_score + safety_score + momentum_score + quality_score

def score_new_formula(fund, target_vol=0.12):
    """New scoring: Old + Drawdown Penalty + Sortino Bonus"""
    old_score = score_old_formula(fund, target_vol)
    perf = fund['perf']
    
    # 6. Drawdown Penalty
    dd_penalty = 0
    if perf['max_drawdown'] > 0:
        dd_penalty = min(abs(perf['max_drawdown']) * 500, 50)
    
    # 7. Sortino Bonus
    sortino_bonus = 0
    if perf['sortino_ratio'] > 0:
        sortino_norm = max(0, min(4, perf['sortino_ratio']))
        sortino_bonus = (sortino_norm / 4) * 5
    
    return old_score - dd_penalty + sortino_bonus

if __name__ == '__main__':
    print("=" * 70)
    print("SCORING COMPARISON: Old vs New Formula")
    print("=" * 70)
    print()
    
    for fund in sample_funds:
        old = score_old_formula(fund)
        new = score_new_formula(fund)
        diff = new - old
        
        print(f"Fund: {fund['name']}")
        print(f"  Old Score: {old:.2f}")
        print(f"  New Score: {new:.2f}")
        print(f"  Difference: {diff:+.2f}")
        print(f"  Max DD: {fund['perf']['max_drawdown']*100:.1f}%")
        print(f"  Sortino: {fund['perf']['sortino_ratio']:.2f}")
        print()
    
    print("=" * 70)
    print("KEY INSIGHTS:")
    print("- Fund A (high quality, low drawdown): Gets bonus from Sortino + low penalty")
    print("- Fund B (medium, high drawdown): Heavily penalized for -20% drawdown")
    print("- Fund C (low quality, no data): Unaffected (no drawdown/Sortino data)")
    print("=" * 70)
