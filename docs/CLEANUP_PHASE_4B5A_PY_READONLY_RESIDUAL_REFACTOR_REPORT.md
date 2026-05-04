# FASE 4B.5A — Informe de Refactor: Python Readonly Residual

**Fecha:** 2026-05-04T10:59 (CET)

---

## 1. Archivos Refactorizados (7)

| # | Archivo | Patrón anterior | py_compile | GAC |
|---|---|---|---|---|
| 1 | `fp/scripts/audit/analyze_history_anomalies.py` | try/except + Certificate(KEY_PATH) | ✅ PASS | ✅ |
| 2 | `fp/scripts/audit/audit_fund_data.py` | get_app() + multi-path | ✅ PASS | ✅ |
| 3 | `fp/scripts/audit/audit_taxonomy_v2.py` | init_firebase() + key_paths list | ✅ PASS | ✅ |
| 4 | `fp/scripts/debug/debug_fondibas.py` | get_app() + single path | ✅ PASS | ✅ |
| 5 | `fp/scripts/debug/find_fund_by_isin.py` | get_app() + multi-path | ✅ PASS | ✅ |
| 6 | `fp/scripts/debug/inspect_anomaly_dates.py` | get_app() + multi-path | ✅ PASS | ✅ |
| 7 | `fp/scripts/fixes/fix_and_reparse_anomalies.py` | _apps + multi-path | ✅ PASS | ✅ |

## 2. Patrón Aplicado

Se insertó `os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")` como **primera prioridad** en cada función de inicialización, antes de los fallbacks existentes a `serviceAccountKey.json`. Se preservó la estructura original de cada script (funciones, try/except, etc.).

## 3. Verificaciones

| Check | Resultado |
|---|---|
| py_compile 7/7 | ✅ PASS |
| GOOGLE_APPLICATION_CREDENTIALS presente 7/7 | ✅ |
| Write-ops en archivos editados | ✅ NINGUNA |
| `serviceAccountKey.json` | ✅ Presente (2,370 bytes) |
| `.env` | ✅ Presente (57 bytes) |
| `frontend/.env` | ✅ Presente (377 bytes) |
| Scripts ejecutados | ❌ Ninguno |
| Commit realizado | ❌ No |
| Push realizado | ❌ No |

## 4. Próxima Fase Recomendada (NO ejecutada)

- **Opción A:** Commit de 4B.5A (7 archivos + docs).
- **Opción B:** Continuar con 4B.5B (mutantes con dry-run) antes de commit.
