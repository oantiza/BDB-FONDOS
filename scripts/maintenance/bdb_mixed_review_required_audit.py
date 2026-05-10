#!/usr/bin/env python3
"""Extract and classify 29 review_required MIXED funds."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
dryrun = json.loads((ROOT / "artifacts/bdb_mixed_exposure_fix/mixed_exposure_fix_dry_run.json").read_text(encoding="utf-8"))

WRITTEN = {
    "IE00BYYPF474","ES0128067008","LU0512121004","LU1883327816","LU1961009468",
    "ES0116567035","ES0162949012","FR0010041822","LU0093503737","LU0352312184",
    "LU0565136552","LU1276000236","LU1298174530","LU1304666057","LU1740985814",
    "ES0173323009","ES0175604034","LU1245470593","DE0005318406","ES0148181003",
    "LU0251131362","LU0404220724","LU0171283459","LU1899018953","LU1697017256",
    "ES0142046038","ES0162946034","LU1697018494","LU1882475392","LU2278574715",
}

review = [p for p in dryrun["patches"] if p["review_required"] and p["isin"] not in WRITTEN]
review.sort(key=lambda x: -abs(x["delta_equity"]))

print(f"Total review_required (excluding written): {len(review)}\n")
print(f"{'ISIN':16s} | {'Name':45s} | {'Sub':12s} | OldEq | NewEq | d_Eq   | d_Bd   | MsSum")
print("-" * 170)
for p in review:
    ms = p["ms_portfolio_asset_allocation"] or {}
    ms_sum = ms.get("sum", 0)
    oe = p["old_economic_exposure"]
    pe = p["proposed_economic_exposure"]
    print(f"{p['isin']:16s} | {p['name'][:45]:45s} | {p['subtype'][:12]:12s} | {oe['equity']:5.1f} | {pe['equity']:5.1f} | {p['delta_equity']:+6.1f} | {p['delta_bond']:+6.1f} | {ms_sum:6.1f}")

# Classify
print("\n\n=== CLASSIFICATION ===\n")

group_a = []  # 50/50 -> high RV (aggressive hidden as flexible)
group_b = []  # 50/50 -> low RV (conservative hidden as flexible)
group_c = []  # 80/20 or 20/80 -> MS real
group_d = []  # extreme/anomalous

for p in review:
    oe = p["old_economic_exposure"]
    pe = p["proposed_economic_exposure"]
    ms = p["ms_portfolio_asset_allocation"] or {}
    ms_sum = ms.get("sum", 0)

    if ms_sum > 150:
        group_d.append(p)
    elif oe["equity"] == 50.0:
        if pe["equity"] > 60:
            group_a.append(p)
        elif pe["equity"] < 40:
            group_b.append(p)
        else:
            group_c.append(p)
    elif oe["equity"] == 80.0:
        if pe["equity"] < 60:
            group_d.append(p)
        else:
            group_c.append(p)
    elif oe["equity"] == 20.0:
        if pe["equity"] < 5:
            group_d.append(p)
        else:
            group_c.append(p)
    else:
        group_c.append(p)

print(f"Group A - FLEXIBLE 50/50 -> RV alta (>60%): {len(group_a)}")
for p in group_a:
    print(f"  {p['isin']} | {p['name'][:40]:40s} | eq {p['old_economic_exposure']['equity']}->{p['proposed_economic_exposure']['equity']} | APPROVE")

print(f"\nGroup B - FLEXIBLE 50/50 -> RV baja (<40%): {len(group_b)}")
for p in group_b:
    print(f"  {p['isin']} | {p['name'][:40]:40s} | eq {p['old_economic_exposure']['equity']}->{p['proposed_economic_exposure']['equity']} | APPROVE")

print(f"\nGroup C - Subtype-aligned or moderate shift: {len(group_c)}")
for p in group_c:
    print(f"  {p['isin']} | {p['name'][:40]:40s} | eq {p['old_economic_exposure']['equity']}->{p['proposed_economic_exposure']['equity']} | APPROVE")

print(f"\nGroup D - Extreme/anomalous (MS sum>150 or radical shift): {len(group_d)}")
for p in group_d:
    ms = p["ms_portfolio_asset_allocation"] or {}
    print(f"  {p['isin']} | {p['name'][:40]:40s} | eq {p['old_economic_exposure']['equity']}->{p['proposed_economic_exposure']['equity']} | sum={ms.get('sum',0)} | REVIEW_MANUAL")
