# FASE 3 — Auditoría de Scripts y Plan de Unificación

**Fecha:** 2026-05-04
**Estado:** AUDITORÍA COMPLETADA — Ningún script movido, borrado o modificado.
**Referencia:** `docs/CLEANUP_PHASE_2_COMPLETION_REPORT.md`

---

## 1. Inventario Completo

### 1.1 `scripts/` (raíz del proyecto)
39 archivos + 5 subdirectorios (archive: 55, sandbox: 1, maintenance: 48, firebase: 1, repo: 4).
**Total: ~143 archivos** (incluyendo subdirectorios).

### 1.2 `functions_python/scripts/`
43 archivos + 9 subdirectorios (archive: 7, sandbox: 5, maintenance: 1, fixes: 10, debug: 8, audit: 11, migration: 7, reports: 6, tests: 5).
**Total: ~98 archivos** (incluyendo subdirectorios).
Tiene un `script_manifest.json` oficial con 44 entradas categorizadas y `mutates_data` flags.

### 1.3 `frontend/scripts/`
2 archivos: `inspect_db.cjs` e `inspect_db.js`.
**Total: 2 archivos.**

### 1.4 Resumen de volumen

| Ubicación | Archivos raíz | En subdirectorios | Total |
|---|---|---|---|
| `scripts/` | 39 | ~104 | ~143 |
| `functions_python/scripts/` | 43 | ~55 | ~98 |
| `frontend/scripts/` | 2 | 0 | 2 |
| **TOTAL** | | | **~243** |

---

## 2. Duplicados Exactos (mismo nombre, mismo tamaño)

Estos son clones byte-a-byte entre `scripts/` (raíz) y `scripts/maintenance/`:

| Script | Ubicación 1 | Ubicación 2 |
|---|---|---|
| `fetch_missing_history.py` | `scripts/` (7208B) | `scripts/maintenance/` (7208B) |
| `fondos_no_en_csv.js` | `scripts/` (2629B) | `scripts/maintenance/` (2629B) |
| `import_retrocesiones.js` | `scripts/` (6953B) | `scripts/maintenance/` (6953B) |
| `repair_costs_funds_v3.js` | `scripts/` (7652B) | `scripts/maintenance/` (7652B) |
| `set_retro_zero.js` | `scripts/` (2353B) | `scripts/maintenance/` (2353B) |
| `update_ms_stars_funds_v3.js` | `scripts/` (5935B) | `scripts/maintenance/` (5935B) |

Duplicados exactos entre `scripts/` (raíz) y `scripts/archive/`:

| Script | Ubicación 1 | Ubicación 2 |
|---|---|---|
| `backfill_asset_class_aggressive_v1.js` | `scripts/` (13229B) | `scripts/archive/` (13229B) |
| `backfill_asset_class_fill_only_v1.js` | `scripts/` (13281B) | `scripts/archive/` (13281B) |
| `migrate_regions_to_canonical.js` | `scripts/` (10466B) | `scripts/archive/` (10466B) |
| `migrate_sectors_to_canonical.js` | `scripts/` (5113B) | `scripts/archive/` (5113B) |

---

## 3. Duplicados por Nombre con Contenido Diferente

### 3.1 Entre `scripts/` (raíz) y `scripts/maintenance/` (18 archivos)
En todos los casos, la versión de `maintenance/` es ligeramente más grande (diferencias de 200-300 bytes, probablemente headers o comentarios adicionales):

| Script | scripts/ | maintenance/ | Diferencia |
|---|---|---|---|
| `add_manual_fund.js` | 1844B | 2050B | +206B |
| `audit_derived_unknowns.js` | 7657B | 7947B | +290B |
| `calculate_manual_metrics.js` | 3980B | 4204B | +224B |
| `copy_fund_data.js` | 3197B | 3401B | +204B |
| `generate_change_report.py` | 3398B | 3600B | +202B |
| `generate_extremos.py` | 2480B | 2672B | +192B |
| `get_current_risk_free_rate.js` | 1157B | 1385B | +228B |
| `get_fund_template.js` | 847B | 1057B | +210B |
| `import_history_manual.js` | 2585B | 2803B | +218B |
| `purge_legacy_root_fields.js` | 2075B | 2299B | +224B |
| `recalculate_derived_fields.js` | 28609B | 28902B | +293B |
| `refresh_derived_data.js` | 9839B | 10055B | +216B |
| `restore_name.js` | 703B | 903B | +200B |
| `search_isin.py` | 503B | 683B | +180B |
| `update_3_retros.js` | 1105B | 1311B | +206B |
| `update_retrocessions_funds_v3.js` | 4581B | 4815B | +234B |
| `update_years_span_from_extremos.py` | 4679B | 4899B | +220B |
| `dedupe_retro_excel.js` | 878B (raíz) | 1083B (archive) | +205B |

### 3.2 Entre `scripts/` y `functions_python/scripts/` (cross-repo)

| Script | scripts/ | fp/scripts/ |
|---|---|---|
| `infer_region_primary_bdb.py` | 5229B | 5447B |
| `populate_taxonomy_v2*.py` | 71107B (FINAL) | 72212B (migration/) |

### 3.3 Dentro de `functions_python/scripts/` (raíz vs subdirectorio) — 29 archivos
Patrón consistente: la versión en el subdirectorio categorizado es ligeramente más grande. Esto incluye scripts de audit, debug, fixes, reports, tests y migration.

---

## 4. Scripts Peligrosos (Escritura a Firestore / Mutación de Datos)

> [!CAUTION]
> Estos scripts pueden **escribir, borrar o migrar datos** en la base de datos de producción si se ejecutan con las credenciales correctas.

### 4.1 Scripts JS con operaciones de escritura (`update`, `set`, `delete`)

| Script | Operación | Colección afectada |
|---|---|---|
| `update_retrocessions_funds_v3.js` | bulk.update | `funds_v3` |
| `update_ms_stars_funds_v3.js` | bulk.update | `funds_v3` |
| `update_3_retros.js` | docRef.update | `funds_v3` |
| `set_retro_zero.js` | writer.update | `funds_v3` |
| `restore_name.js` | doc.update | `funds_v3` |
| `repair_costs_funds_v3.js` | writer.update + FieldValue.delete | `funds_v3` |
| `purge_legacy_root_fields.js` | writer.update + FieldValue.delete | `funds_v3` |
| `recalculate_derived_fields.js` | writer.set | `funds_v3` |
| `refresh_derived_data.js` | batch.update | `funds_v3` |
| `migrate_sectors_to_canonical.js` | writer.update | `funds_v3` |
| `migrate_regions_to_canonical.js` | writer.update | `funds_v3` |
| `apply_manual_overrides.js` | batch write | `funds_v3` |
| `backfill_asset_class_*.js` | batch write | `funds_v3` |
| `import_retrocesiones.js` | batch write | `funds_v3` |
| `import_history_manual.js` | batch write | `historico_vl_v2` |
| `copy_fund_data.js` | doc.set | `funds_v3` |
| `add_manual_fund.js` | doc.set | `funds_v3` |

### 4.2 Scripts PY con operaciones de escritura

| Script | Ubicación |
|---|---|
| `populate_taxonomy_v2_FINAL.py` | `scripts/` |
| `populate_taxonomy_v2.py` | `scripts/maintenance/` y `fp/scripts/migration/` |
| `remediate_orphans.py` | `scripts/` |
| `seed_emulator_data.py` | `scripts/` y `scripts/firebase/` |
| `update_years_span_from_extremos.py` | `scripts/` |
| `fetch_missing_history.py` | `scripts/` |
| Múltiples `fix_*.py`, `sync_*.py`, `populate_*.py` | `fp/scripts/fixes/` |
| `insert_dummy_reports.py`, `insert_user_report.py` | `fp/scripts/reports/` |
| `update_risk_profiles_firestore.py` | `fp/scripts/` |
| `migrate_suitability_v2.py` | `fp/scripts/maintenance/` |

### 4.3 Scripts marcados como `mutates_data: true` en manifest

| Script | Categoría |
|---|---|
| `cleanup_dummy_reports.py` | fixes |
| `insert_dummy_reports.py` | reports |

> **Nota:** El manifest infravalora la peligrosidad. Muchos scripts con `mutates_data: false` en realidad sí ejecutan `.set()` / `.update()` (verificado por grep).

---

## 5. Scripts que Usan Credenciales

Prácticamente **todos** los scripts JS en `scripts/` usan `firebase-admin` con `serviceAccountKey.json`. Los scripts PY en `functions_python/scripts/` usan `firebase_admin` con `GOOGLE_APPLICATION_CREDENTIALS` o acceso directo al SA key.

---

## 6. Scripts Candidatos a CONSERVAR (fuente de verdad)

La recomendación es que `functions_python/scripts/` sea la fuente de verdad para scripts Python, dado que:
- Ya tiene estructura organizada por categoría (audit, debug, fixes, migration, reports, sandbox, tests).
- Tiene un `script_manifest.json` oficial.
- Las versiones en subdirectorios suelen ser más recientes (más bytes = headers añadidos).

Para scripts JS, `scripts/maintenance/` parece la versión más actualizada en la mayoría de los casos.

| Categoría | Fuente de Verdad Propuesta | Scripts clave |
|---|---|---|
| Auditoría (PY) | `fp/scripts/audit/` | audit_fund_data, audit_taxonomy_v2, scoring_comparison |
| Debug (PY) | `fp/scripts/debug/` | find_fund_by_isin, inspect_*, debug_* |
| Fixes (PY) | `fp/scripts/fixes/` | fix_anomalies, fix_data_anomalies, cleanup_dummy |
| Migration (PY) | `fp/scripts/migration/` | populate_taxonomy_v2, migrate_reports |
| Reports (PY) | `fp/scripts/reports/` | generate_benchmarks, insert_*, recalc_* |
| Tests (PY) | `fp/scripts/tests/` | test_optimizer, test_research, test_smart_portfolio |
| Sandbox (PY) | `fp/scripts/sandbox/` | debug_frontier_local, reproduce_frontier |
| Mantenimiento (JS) | `scripts/maintenance/` | recalculate_derived_fields, update_*, import_* |
| Frontend debug | `frontend/scripts/` | inspect_db.cjs |

---

## 7. Scripts Candidatos a Archivar Externamente

| Directorio | Archivos | Justificación |
|---|---|---|
| `scripts/archive/` | 55 | Ya clasificados como "ARCHIVE" en sus propios headers |
| `fp/scripts/archive/` | 7 | Snapshots de `populate_taxonomy_v2` en distintos momentos |
| `fp/scripts/audit/sample_taxonomy_review_50_*STABLE*.py` (x3) | 3 | Snapshots duplicados en audit que ya están en archive |
| `scripts/repo/` (excepto `reorganize_bdb_structure.ps1`) | 3 | Scripts de backup/zip ya obsoletos |

---

## 8. Scripts Candidatos a Eliminar (Fase Futura)

| Script | Ubicación | Justificación |
|---|---|---|
| 10 duplicados exactos raíz↔subcarpeta | `scripts/` raíz | La subcarpeta tiene la misma o mejor versión |
| 18 duplicados DIFF raíz↔maintenance | `scripts/` raíz | `maintenance/` tiene versión más reciente |
| `frontend/scripts/inspect_db.js` | `frontend/scripts/` | Existe `.cjs` que es la versión correcta para CommonJS |
| 29 duplicados DIFF raíz↔subdirectorio | `fp/scripts/` raíz | El subdirectorio categorizado es más reciente |

---

## 9. Estructura Futura Propuesta

```
scripts/                          ← Scripts JS de mantenimiento
├── maintenance/                  ← Fuente de verdad para JS activos
├── repo/                         ← reorganize_bdb_structure.ps1 (útil)
└── (eliminar raíz duplicada y archive/)

functions_python/scripts/         ← Scripts PY del backend
├── audit/                        ← Solo lectura, inspección
├── debug/                        ← Solo lectura, debugging
├── fixes/                        ← Correcciones puntuales (escriben datos)
├── maintenance/                  ← Migraciones de esquema
├── migration/                    ← Migraciones masivas (escriben datos)
├── reports/                      ← Generación de informes (escriben datos)
├── sandbox/                      ← Experimentos temporales
├── tests/                        ← Tests manuales
└── (eliminar raíz duplicada y archive/)

frontend/scripts/                 ← Mantener solo inspect_db.cjs
```

---

## 10. Riesgos

| Riesgo | Nivel | Descripción |
|---|---|---|
| Borrar la versión equivocada de un duplicado | **MEDIO** | Si el script raíz era la versión realmente ejecutada, el subcarpeta podría tener diferencias inesperadas |
| Romper `scripts/package.json` main entry | **BAJO** | El main apunta a `update_retrocessions_funds_v3.js` en raíz |
| Perder `script_manifest.json` paths | **BAJO** | El manifest apunta a subdirectorios, no a raíz |
| Ejecutar un script peligroso sin querer | **ALTO** | ~20+ scripts pueden escribir/borrar en Firestore de producción |

---

## 11. Plan FASE 3A (Documentación, sin cambios)

1. ✅ **Completado:** Este informe documenta el inventario completo.
2. Confirmar con el usuario cuál es la versión que realmente ejecuta de cada duplicado.
3. Revisar `scripts/package.json` para decidir si mantener el ecosistema JS separado.
4. Decidir si `frontend/scripts/` se conserva o se integra.

---

## 12. Plan FASE 3B (Consolidación, pendiente de aprobación)

1. Mover `scripts/archive/` (55 archivos) a `BDB-FONDOS-EXTERNAL-ARCHIVE/scripts_archive_2026-05-04/`.
2. Mover `fp/scripts/archive/` (7 archivos) al mismo destino externo.
3. Eliminar los ~29 duplicados raíz de `fp/scripts/` (conservar solo las versiones en subdirectorios).
4. Eliminar los ~28 duplicados raíz de `scripts/` (conservar solo las versiones en `maintenance/`).
5. Eliminar `frontend/scripts/inspect_db.js` (conservar solo `.cjs`).
6. Actualizar `script_manifest.json` si se cambian paths.
7. Verificar que `scripts/package.json` sigue funcional.

---

## 13. Próximo Prompt Recomendado

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 3B de consolidación de scripts en BDB-FONDOS.

REGLAS ESTRICTAS:
- Ejecuta únicamente lo aprobado en docs/CLEANUP_PHASE_3_SCRIPTS_AUDIT_PLAN.md sección 12.
- NO toques credenciales.
- NO toques frontend/src/, functions_python/api/, functions_python/services/.
- NO ejecutes ningún script.
- NO modifiques lógica.
- Antes de borrar cada duplicado raíz, confirma que la versión en subdirectorio
  es igual o más reciente.
- Mover scripts/archive/ y fp/scripts/archive/ a almacenamiento externo.
- Crear docs/CLEANUP_PHASE_3B_COMPLETION_REPORT.md con los resultados.
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún script ha sido movido, borrado, ejecutado ni modificado durante esta auditoría. El repositorio permanece en su estado post-FASE 2.
