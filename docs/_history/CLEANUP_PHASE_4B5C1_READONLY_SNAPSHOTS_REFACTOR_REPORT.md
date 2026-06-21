# FASE 4B.5C.1 — Informe de Refactor: Readonly / Snapshots Restantes

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
| Credenciales intactas | ✅ |
| Scripts ejecutados | 0 |
| Escrituras Firestore añadidas | 0 |

---

## 2. Confirmación Readonly

Todos los archivos fueron verificados como **readonly** antes de la edición:

| # | Archivo | `.add()` detectado | Tipo real | Colección (lectura) |
|---|---|---|---|---|
| 1 | `sample_taxonomy_review_50_FINAL_STABLE.py` | `selected_isins.add(isin)` | Python `set.add()` | funds_v3 |
| 2 | `sample_taxonomy_review_50_STABLE_31conflicts.py` | `selected_isins.add(isin)` | Python `set.add()` | funds_v3 |
| 3 | `sample_taxonomy_review_50_STABLE_71conflicts.py` | `selected_isins.add(isin)` | Python `set.add()` | funds_v3 |
| 4 | `inspect_categories.py` | `categories.add(cat)` | Python `set.add()` | funds_v3 |
| 5 | `fondos_no_en_csv.js` | `isins.add(isin)` | JS `Set.add()` | funds_v3 |

**Ninguno contiene:** `.set()`, `.update()`, `.delete()`, `batch.commit`, `bulkWriter` sobre Firestore.

---

## 3. Archivos Refactorizados

### Patrón A — `init_firestore()` con key_paths (3 Python snapshots)

| # | Archivo | Resultado |
|---|---|---|
| 1 | `functions_python/scripts/audit/sample_taxonomy_review_50_FINAL_STABLE.py` | ✅ py_compile OK |
| 2 | `functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_31conflicts.py` | ✅ py_compile OK |
| 3 | `functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_71conflicts.py` | ✅ py_compile OK |

**Cambio:** Insertado `os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")` como primera opción dentro de `init_firestore()`, antes del loop `for kp in key_paths`.

### Patrón B — Bare `credentials.Certificate` (1 Python)

| # | Archivo | Resultado |
|---|---|---|
| 4 | `functions_python/scripts/debug/inspect_categories.py` | ✅ py_compile OK |

**Cambio:** Insertado GAC check → `elif os.path.exists(...)` → else default.

### Patrón D — JS `require` + `cert` (1 JS)

| # | Archivo | Resultado |
|---|---|---|
| 5 | `scripts/maintenance/fondos_no_en_csv.js` | ✅ node --check OK |

**Cambio:** Reemplazado `require(SA_PATH)` hardcoded con patrón estándar `process.env.GOOGLE_APPLICATION_CREDENTIALS` → `applicationDefault()` → `fs.existsSync` fallback.

---

## 4. Verificaciones

| Check | Resultado |
|---|---|
| `py_compile` (4 Python) | 4/4 ✅ |
| `node --check` (1 JS) | 1/1 ✅ |
| GAC en todos | 5/5 ✅ |
| `serviceAccountKey.json` intacto | ✅ |
| `.env` intacto | ✅ |
| `frontend/.env` intacto | ✅ |
| Scripts ejecutados | 0 |
| Escrituras Firestore añadidas | 0 |
| Lógica de negocio modificada | 0 |

---

## 5. Estado de git

```
5 archivos modificados (M):
  functions_python/scripts/audit/sample_taxonomy_review_50_FINAL_STABLE.py
  functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_31conflicts.py
  functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_71conflicts.py
  functions_python/scripts/debug/inspect_categories.py
  scripts/maintenance/fondos_no_en_csv.js

1 archivo nuevo (plan):
  docs/CLEANUP_PHASE_4B5C_MUTANTS_WITHOUT_DRYRUN_PLAN.md

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
| **4B.5C.1 Readonly/snapshots** | **5** | **✅ DONE** | **Pendiente commit** |
| 4B.5C.2 Mutantes bajo riesgo | 5 | ⏳ Pendiente | — |
| 4B.5C.3 Mutantes medio riesgo | 5 | ⏳ Pendiente | — |
| 4B.5C.4 Alto riesgo / bloqueados | 5 | ⏳ Pendiente | — |
| **Total completado** | **45/~59** | | |

---

## 7. Próxima Fase Recomendada

**Opción 1:** Commit de FASE 4B.5C.1 (7 archivos: 5 scripts + 1 plan + 1 report).

**Opción 2:** Continuar con 4B.5C.2 (mutantes bajo riesgo) antes de commit.

> **Recomendación:** Commit 4B.5C.1 primero, luego ejecutar 4B.5C.2.
