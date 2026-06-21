# FASE 4B.5C.2 — Informe de Refactor: 5 Mutantes Bajo Riesgo

**Fecha:** 2026-05-04  
**Estado:** COMPLETADO — 5/5 archivos refactorizados.

---

## 1. Resumen Ejecutivo

| Métrica | Valor |
|---|---|
| **Archivos refactorizados** | **5** |
| Python | 4 |
| JS | 1 |
| py_compile exitosos | 4/4 ✅ |
| node --check exitosos | 1/1 ✅ |
| GAC presente en todos | 5/5 ✅ |
| Lógica de escritura intacta | 5/5 ✅ |
| Credenciales intactas | ✅ |
| Scripts ejecutados | 0 |

---

## 2. Archivos Refactorizados

| # | Archivo | Lenguaje | Escritura | Scope | Patrón | Resultado |
|---|---|---|---|---|---|---|
| 1 | `scripts/maintenance/update_3_retros.js` | JS | `.update()` | 3 ISINs hardcoded | D — apps.length + GAC | ✅ node --check OK |
| 2 | `functions_python/scripts/reports/recalc_metrics_single.py` | Python | `.update()` | Single-doc | B — get_app + GAC | ✅ py_compile OK |
| 3 | `functions_python/scripts/fixes/fix_data_anomalies.py` | Python | `.update()` | CSV-driven | B — get_app + GAC | ✅ py_compile OK |
| 4 | `functions_python/scripts/fixes/trim_last_anomaly.py` | Python | `.update()` | 1 ISIN | C — _apps + GAC | ✅ py_compile OK |
| 5 | `functions_python/scripts/update_risk_profiles_firestore.py` | Python | `.set()` | 1 doc config | C — _apps + GAC | ✅ py_compile OK |

---

## 3. Cambios Aplicados por Script

### Script 1: `update_3_retros.js`
- Añadido `require("fs")`.
- Reemplazado `require(SA_PATH)` hardcoded con patrón GAC → `applicationDefault()` → `existsSync` fallback.
- **Lógica intacta:** `docRef.update({ "manual.costs.retrocession": item.retro })` sin cambios.

### Script 2: `recalc_metrics_single.py`
- Insertado `os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")` como primera opción en `initialize()`.
- **Lógica intacta:** `fund_ref.update(new_metrics)` sin cambios.

### Script 3: `fix_data_anomalies.py`
- Insertado GAC check idéntico al anterior en `initialize()`.
- **Lógica intacta:** `h_ref.update({series_field: new_list})` sin cambios.

### Script 4: `trim_last_anomaly.py`
- Insertado GAC check antes de `credentials.Certificate(KEY_PATH)`.
- Conservado `KEY_PATH` como fallback.
- **Lógica intacta:** `doc_ref.update({"history": clean_history})` sin cambios.

### Script 5: `update_risk_profiles_firestore.py`
- Insertado GAC check como paso 0 antes del loop de paths en `get_firebase_app()`.
- Conservado loop de paths como fallback.
- **Lógica intacta:** `doc_ref.set(payload)` sin cambios.

---

## 4. Verificaciones

| Check | Resultado |
|---|---|
| `py_compile` (4 Python) | 4/4 ✅ |
| `node --check` (1 JS) | 1/1 ✅ |
| GAC en todos | 5/5 ✅ |
| Write logic intacta | 5/5 ✅ |
| `serviceAccountKey.json` intacto | ✅ |
| `.env` intacto | ✅ |
| `frontend/.env` intacto | ✅ |
| Scripts ejecutados | 0 |
| Conexiones Firestore | 0 |

---

## 5. Estado de git

```
5 archivos modificados (M):
  functions_python/scripts/reports/recalc_metrics_single.py
  functions_python/scripts/fixes/fix_data_anomalies.py
  functions_python/scripts/fixes/trim_last_anomaly.py
  functions_python/scripts/update_risk_profiles_firestore.py
  scripts/maintenance/update_3_retros.js

1 archivo nuevo (plan):
  docs/CLEANUP_PHASE_4B5C2_LOW_RISK_MUTANTS_PLAN.md

NO commiteado todavía.
```

---

## 6. Progreso Acumulado FASE 4B

| Sublote | Scripts | Estado | Commit |
|---|---|---|---|
| 4B.3 Python readonly | 7 | ✅ DONE | `64bb990` |
| 4B.4 JS/CJS readonly | 7 | ✅ DONE | `42f16ed` |
| 4B.5A Python readonly residual | 7 | ✅ DONE | `e2f687a` |
| 4B.5B Mutantes con dry-run | 19 | ✅ DONE | `0654592` |
| 4B.5C.1 Readonly/snapshots | 5 | ✅ DONE | `9b0beee` |
| **4B.5C.2 Mutantes bajo riesgo** | **5** | **✅ DONE** | **Pendiente commit** |
| 4B.5C.3 Mutantes medio riesgo | 5 | ⏳ Pendiente | — |
| 4B.5C.4 Alto riesgo / bloqueados | 5 | ⏳ Pendiente | — |
| **Total completado** | **50/~59** | | |

---

## 7. Próxima Fase Recomendada

**Opción 1:** Commit de FASE 4B.5C.2 (7 archivos: 5 scripts + 1 plan + 1 report).

**Opción 2:** Continuar con 4B.5C.3 (mutantes medio riesgo) antes de commit.

> **Recomendación:** Commit 4B.5C.2 primero, luego plan 4B.5C.3.
