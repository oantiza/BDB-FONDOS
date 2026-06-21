# FASE 3A — Informe de Validación Crítica

**Fecha:** 2026-05-04
**Estado:** VALIDACIÓN COMPLETADA — Ningún script movido, borrado o modificado.
**Referencia:** `docs/CLEANUP_PHASE_3_SCRIPTS_AUDIT_PLAN.md` (Gemini)

---

## 1. Duplicados Exactos Confirmados por SHA256

Los 10 pares reportados por la auditoría original han sido **confirmados al 100%** mediante hash SHA256.

| Script | Loc. A | Loc. B | SHA256 |
|---|---|---|---|
| `fetch_missing_history.py` | `scripts/` | `scripts/maintenance/` | ✅ MATCH |
| `fondos_no_en_csv.js` | `scripts/` | `scripts/maintenance/` | ✅ MATCH |
| `import_retrocesiones.js` | `scripts/` | `scripts/maintenance/` | ✅ MATCH |
| `repair_costs_funds_v3.js` | `scripts/` | `scripts/maintenance/` | ✅ MATCH |
| `set_retro_zero.js` | `scripts/` | `scripts/maintenance/` | ✅ MATCH |
| `update_ms_stars_funds_v3.js` | `scripts/` | `scripts/maintenance/` | ✅ MATCH |
| `backfill_asset_class_aggressive_v1.js` | `scripts/` | `scripts/archive/` | ✅ MATCH |
| `backfill_asset_class_fill_only_v1.js` | `scripts/` | `scripts/archive/` | ✅ MATCH |
| `migrate_regions_to_canonical.js` | `scripts/` | `scripts/archive/` | ✅ MATCH |
| `migrate_sectors_to_canonical.js` | `scripts/` | `scripts/archive/` | ✅ MATCH |

**Veredicto:** Todos los duplicados exactos son eliminables de forma segura desde la ubicación raíz.

---

## 2. Duplicados DIFF Clasificados por Tipo de Diferencia

### 2.1 `scripts/` raíz vs `scripts/maintenance/` — SOLO HEADER (17 pares)

Todos estos pares tienen **cuerpo de código idéntico**. La versión en `maintenance/` añade exactamente 9-10 líneas de header con metadata (`STATUS`, `CATEGORY`, `PURPOSE`, `SAFE_MODE`, `RUN`).

| Script | Líneas extra | body_identical |
|---|---|---|
| `add_manual_fund.js` | +10 | ✅ True |
| `audit_derived_unknowns.js` | +9 | ✅ True |
| `calculate_manual_metrics.js` | +10 | ✅ True |
| `copy_fund_data.js` | +10 | ✅ True |
| `generate_change_report.py` | +10 | ✅ True |
| `generate_extremos.py` | +10 | ✅ True |
| `get_current_risk_free_rate.js` | +10 | ✅ True |
| `get_fund_template.js` | +10 | ✅ True |
| `import_history_manual.js` | +10 | ✅ True |
| `purge_legacy_root_fields.js` | +10 | ✅ True |
| `recalculate_derived_fields.js` | +9 | ✅ True |
| `refresh_derived_data.js` | +10 | ✅ True |
| `restore_name.js` | +10 | ✅ True |
| `search_isin.py` | +10 | ✅ True |
| `update_3_retros.js` | +10 | ✅ True |
| `update_retrocessions_funds_v3.js` | +10 | ✅ True |
| `update_years_span_from_extremos.py` | +10 | ✅ True |

**Veredicto:** `maintenance/` es la versión canónica. Las versiones raíz son eliminables.

### 2.2 `scripts/` raíz vs `scripts/archive/` — SOLO HEADER (3 pares)

| Script | Líneas extra | Tipo |
|---|---|---|
| `aggressive_audit.py` | +10 (header) | Solo header |
| `dedupe_retro_excel.js` | +10 (header) | Solo header |
| `remediate_orphans.py` | +10 (header) | Solo header |

**Veredicto:** `archive/` tiene la versión con metadata. Ambas serán externalizadas.

### 2.3 Cross-repo: `scripts/` vs `functions_python/scripts/` — LÓGICA DIFERENTE

| Script | Diferencia |
|---|---|
| `infer_region_primary_bdb.py` | **Lógica diferente.** La versión FP tiene funciones refactorizadas (`infer_from_ms_regions` reestructurada, `normalize_region()` y comparaciones `str().upper()` en vez de comparación directa con "UNKNOWN"). No es un header — es código evolucionado. |

> [!WARNING]
> Este par **NO puede tratarse como un duplicado simple**. La versión en `functions_python/scripts/` es más robusta y segura (normaliza mayúsculas en comparaciones). La versión en `scripts/` es la original más antigua.

### 2.4 Dentro de `functions_python/scripts/` raíz vs subdirectorios — HEADER + `import` (29 pares)

Patrón consistente:
- Las versiones en subdirectorios añaden **10 líneas de header** con metadata.
- La versión raíz tiene `import firebase_admin` como primera línea; la versión subdirectorio la omite (absorbida en el header's import section).
- El conteo de "line_diffs" alto (41-223) se debe a un **desplazamiento de línea**, no a cambios lógicos reales.
- Excepción: `fix_anomalies.py` tiene **31 líneas extra** con imports mejorados (`sys.path.append`) y paths absolutos.

| Script | Diferencia real |
|---|---|
| 28 de los 29 pares | Solo header + 1 línea `import firebase_admin` |
| `fix_anomalies.py` | Header + paths de importación mejorados (más robusto) |

**Veredicto:** Las versiones en subdirectorios son canónicas. Las raíz son eliminables.

---

## 3. Scripts que NO se Deben Borrar Todavía

| Script | Ubicación | Razón |
|---|---|---|
| `infer_region_primary_bdb.py` | `scripts/` | Lógica diferente a la de FP. Requiere revisión manual para confirmar cuál es la correcta. |
| `populate_taxonomy_v2_FINAL.py` | `scripts/` | Referenciado explícitamente en `README.md` como herramienta principal de taxonomía. |
| `update_retrocessions_funds_v3.js` | `scripts/` | Es el `main` de `scripts/package.json`. Borrar rompe el entry point del paquete. |
| `scripts/package.json` | `scripts/` | Define dependencias (`firebase-admin`, `xlsx`) para los scripts JS. |
| `scripts/package-lock.json` | `scripts/` | Lock de dependencias. |

---

## 4. Scripts Seguros para Externalizar

### 4.1 `scripts/archive/` (55 archivos)
Todos están auto-marcados con `STATUS: ARCHIVE` en sus headers. Ninguno es referenciado desde fuera de la carpeta.
**Veredicto:** ✅ Seguros para externalizar.

### 4.2 `functions_python/scripts/archive/` (7 archivos)

> [!WARNING]
> **Bloqueante:** El `script_manifest.json` contiene 7 entradas que apuntan a `functions_python/scripts/archive/`. Si se externalizan estos archivos sin actualizar el manifest, las 7 entradas quedarán rotas.

| Entrada manifest | Path |
|---|---|
| `populate_taxonomy_v2_FINAL_STABLE.py` | `fp/scripts/archive/...` |
| `populate_taxonomy_v2_STABLE_31conflicts.py` | `fp/scripts/archive/...` |
| `populate_taxonomy_v2_STABLE_71conflicts.py` | `fp/scripts/archive/...` |
| `populate_taxonomy_v2_backup.py` | `fp/scripts/archive/...` |
| `sample_taxonomy_review_50_FINAL_STABLE.py` | `fp/scripts/archive/...` |
| `sample_taxonomy_review_50_STABLE_31conflicts.py` | `fp/scripts/archive/...` |
| `sample_taxonomy_review_50_STABLE_71conflicts.py` | `fp/scripts/archive/...` |

**Acción requerida:** Actualizar `script_manifest.json` eliminando las 7 entradas de archive, o cambiar su `status` a `"ARCHIVED_EXTERNAL"`, simultáneamente a la externalización.

---

## 5. Scripts Seguros para Eliminar (Fase Futura)

| Grupo | Cantidad | Condición |
|---|---|---|
| Duplicados exactos SHA256 en `scripts/` raíz | 6 | Conservar versión en `maintenance/` |
| Duplicados header-only en `scripts/` raíz | 17 | Conservar versión en `maintenance/` |
| Duplicados header+import en `fp/scripts/` raíz | 29 | Conservar versión en subdirectorio |
| `frontend/scripts/inspect_db.js` | 1 | Es una versión diferente a `.cjs` (ver nota) |
| **Total eliminable** | **53** | |

> [!IMPORTANT]
> `frontend/scripts/inspect_db.js` e `inspect_db.cjs` **NO son el mismo script**. Tienen lógica diferente:
> - `.js` hace un `limit(1).get()` genérico sobre `funds_v3` y muestra estructura.
> - `.cjs` busca fondos por `'Morningstar Emerging Markets'` y muestra campos específicos.
> Ambos son scripts de inspección de un solo uso. Ninguno está referenciado por `package.json` ni por otros archivos. Pueden eliminarse ambos si no se necesitan.

---

## 6. Bloqueos y Dudas

| ID | Bloqueo | Severidad | Acción requerida |
|---|---|---|---|
| B1 | `scripts/package.json` main apunta a `update_retrocessions_funds_v3.js` en raíz | **MEDIO** | Antes de eliminar el raíz, actualizar main a `maintenance/update_retrocessions_funds_v3.js` |
| B2 | `README.md` referencia `scripts/populate_taxonomy_v2_FINAL.py` | **BAJO** | Actualizar README al mover/eliminar |
| B3 | `script_manifest.json` tiene 7 entradas hacia `fp/scripts/archive/` | **MEDIO** | Actualizar manifest al externalizar archive |
| B4 | `script_manifest.json` tiene 4 entradas rotas (sandbox files que no existen) | **BAJO** | Limpiar entradas huérfanas |
| B5 | `infer_region_primary_bdb.py` tiene lógica diferente entre `scripts/` y `fp/scripts/` | **ALTO** | Revisión manual del usuario para decidir cuál es correcta |

---

## 7. Recomendación Final

### FASE 3B: PARCIALMENTE AUTORIZABLE

Se puede autorizar **con las siguientes condiciones**:

| Acción | Autorizable | Condición |
|---|---|---|
| Externalizar `scripts/archive/` (55 archivos) | ✅ SÍ | Sin condiciones |
| Externalizar `fp/scripts/archive/` (7 archivos) | ⚠️ CON CONDICIÓN | Actualizar `script_manifest.json` simultáneamente |
| Eliminar 6 duplicados exactos SHA256 de `scripts/` raíz | ✅ SÍ | Sin condiciones |
| Eliminar 17 duplicados header-only de `scripts/` raíz | ⚠️ CON CONDICIÓN | Actualizar `scripts/package.json` main primero |
| Eliminar 29 duplicados header+import de `fp/scripts/` raíz | ✅ SÍ | manifest ya apunta a subdirectorios |
| Eliminar `infer_region_primary_bdb.py` de `scripts/` | ❌ NO TODAVÍA | Requiere decisión del usuario sobre lógica |
| Eliminar `populate_taxonomy_v2_FINAL.py` de `scripts/` | ❌ NO TODAVÍA | Referenciado en README |
| Limpiar 4 entradas huérfanas del manifest | ✅ SÍ | Son sandbox files ya eliminados |

---

> [!IMPORTANT]
> **Confirmación:** Ningún script ha sido movido, borrado, ejecutado ni modificado durante esta validación. El repositorio permanece en su estado post-FASE 2.
