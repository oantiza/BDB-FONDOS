# MIXED Exposure Remediation Scripts — Historical Archive

**Status:** ARCHIVED — DO NOT RUN  
**Date archived:** 2026-05-11  
**Remediation:** BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-1 through 8  
**Funds corrected:** 59 / 60 (Hamco LU3038481936 remains pending — no data)

---

## What is in this directory?

This directory contains the **8 Firestore write scripts** used during the
BDB MIXED exposure remediation campaign (May 2026). Each script performed a
controlled, single-batch write of `portfolio_exposure_v2.economic_exposure`
to the `funds_v3` collection.

| Script | Lote | ISINs | Status |
|--------|------|-------|--------|
| `bdb_mixed_exposure_write_controlled_1.py` | Lote 1 — low-risk MS batch | 5 ISINs | EXECUTED |
| `bdb_mixed_exposure_write_controlled_2.py` | Lote 2 — low-risk MS batch | 10 ISINs | EXECUTED |
| `bdb_mixed_exposure_write_controlled_3.py` | Lote 3 — low-risk MS batch | 10 ISINs | EXECUTED |
| `bdb_mixed_exposure_write_controlled_4.py` | Lote 4 — low-risk MS batch | 10 ISINs | EXECUTED |
| `bdb_mixed_exposure_write_controlled_5.py` | Lote 5 — review-required batch 1 | 5 ISINs | EXECUTED |
| `bdb_mixed_exposure_write_controlled_6.py` | Lote 6 — review-required batch 2 | 5 ISINs | EXECUTED |
| `bdb_mixed_exposure_write_controlled_7.py` | Lote 7 — review-required batch 3 | 9 ISINs | EXECUTED |
| `bdb_mixed_exposure_write_controlled_8.py` | Lote 8 — official factsheet batch | 5 ISINs | EXECUTED |

---

## Why are they archived here?

All 8 scripts have already been executed. Their `write_approval_manifest.json`
artifacts contain `authorized: true` and `can_write: true`. If these scripts
were accidentally run again from their original location with an active
service account credential, they could overwrite production Firestore data.

Moving them here makes their historical-only status explicit.

---

## IMPORTANT: DO NOT RUN THESE SCRIPTS

- They have already been executed.
- Re-execution would write to **production Firestore** (`funds_v3`).
- The data they wrote is already correct.
- The manifests they depend on are already consumed.

If a new remediation is required in the future, create a **new gate** with
fresh snapshots, a new approval manifest, and a new authorized=false starting
state. Do NOT modify or re-use these historical scripts.

---

## Rollback manifests

Each script has a corresponding rollback manifest at:

```
artifacts/bdb_mixed_exposure_fix/write_gate_N/rollback_manifest.json
```

These contain the **pre-remediation state** for every ISIN that was modified.
They must be preserved indefinitely as audit evidence. Do not delete them.

---

## Reference documentation

| Document | Purpose |
|----------|---------|
| `docs/BDB_REMEDIATION_SCRIPTS_ARCHIVE_PLAN_0.md` | Archive plan and risk analysis |
| `docs/BDB_REMEDIATION_SCRIPTS_ARCHIVE_APPLY_0.md` | This operation's closeout |
| `docs/BDB_MIXED_EXPOSURE_FINAL_CLOSEOUT_59_60.md` | Full remediation closeout |
| `docs/BDB_AUDIT_MASTER_STATUS_REPORT_2026_05_0.md` | Master program audit report |

---

## Pending item

**LU3038481936 — Hamco Global Value R:** This ISIN was NOT remediated.
Morningstar has no asset allocation data (`ms.portfolio.asset_allocation = {0,0,0,0}`).
It retains its original fallback exposure (eq=80, bd=20, confidence=0.45).
Do not run any historical script to attempt remediation of Hamco.
A new gate must be created if/when Morningstar publishes data.
