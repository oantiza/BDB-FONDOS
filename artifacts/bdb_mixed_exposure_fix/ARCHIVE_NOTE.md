# ARCHIVE NOTE — BDB MIXED Exposure Fix Artifacts

**Status:** HISTORICAL EVIDENCE — DO NOT MODIFY OR DELETE  
**Date closed:** 2026-05-11  
**Remediation:** BDB-MIXED-EXPOSURE-REMEDIATION-2026-05  
**HEAD at close:** `9a49314`

---

## Purpose

This directory (`artifacts/bdb_mixed_exposure_fix/`) contains the complete
audit trail for the BDB MIXED fund economic exposure remediation campaign
executed in May 2026.

**59 out of 60 MIXED funds were corrected.**  
1 fund (Hamco, LU3038481936) remains pending due to lack of Morningstar data.

---

## What is preserved here?

| Path | Contents | Status |
|------|----------|--------|
| `mixed_exposure_fix_dry_run.json` | Initial dry-run analysis, all 60 MIXED funds | PRESERVE |
| `mixed_exposure_write_gate_selection_0.json` | Initial ISIN selection for gate 0 | PRESERVE |
| `official_factsheet_audit_0/` | Official factsheet exposure proposals for 5 funds | PRESERVE |
| `write_gate_0/` | Lote 1 gate artifacts (selection, snapshots, diff, rollback, approval, verification) | PRESERVE |
| `write_gate_2/` | Lote 2 gate artifacts | PRESERVE |
| `write_gate_3/` | Lote 3 gate artifacts | PRESERVE |
| `write_gate_4/` | Lote 4 gate artifacts | PRESERVE |
| `write_gate_5/` | Lote 5 gate artifacts | PRESERVE |
| `write_gate_6/` | Lote 6 gate artifacts | PRESERVE |
| `write_gate_7/` | Lote 7 gate artifacts | PRESERVE |
| `write_gate_8_official_factsheet/` | Final batch — official factsheet funds (5 ISINs) | PRESERVE |

---

## CRITICAL: Rollback manifests must NOT be deleted

Each `write_gate_N/rollback_manifest.json` contains the **exact pre-remediation
Firestore state** for every ISIN that was written. These are the only records
of what the data looked like before the fix.

They must be retained until an explicit decision is made to archive or delete them,
with proper authorization.

---

## DO NOT re-execute historical write scripts

The write scripts (`bdb_mixed_exposure_write_controlled_*.py`) have been moved to:

```
scripts/maintenance/archive/mixed_exposure_remediation_2026_05/
```

Their `write_approval_manifest.json` artifacts in this directory already have
`authorized: true`. Do not run those scripts. Do not modify the manifests.

---

## Pending item

**LU3038481936 — Hamco Global Value R**

- `ms.portfolio.asset_allocation`: `{equity: 0, bond: 0, cash: 0, other: 0}`
- Confirmed: Morningstar has no data for this fund.
- Current state: fallback exposure (eq=80, bd=20), confidence=0.45.
- Decision: **NO ACTION** until Morningstar publishes data.
- Do not attempt remediation using historical scripts.
- If remediation becomes possible, create a fresh gate from scratch.

---

## Reference

| Document | Description |
|----------|-------------|
| `docs/BDB_MIXED_EXPOSURE_FINAL_CLOSEOUT_59_60.md` | Formal remediation closeout |
| `docs/BDB_AUDIT_MASTER_STATUS_REPORT_2026_05_0.md` | Master audit report |
| `docs/BDB_REMEDIATION_SCRIPTS_ARCHIVE_PLAN_0.md` | Archive risk analysis |
| `docs/BDB_POST_MIXED_SUITABILITY_IMPACT_AUDIT_0.md` | Post-remediation suitability audit |
