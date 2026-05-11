# BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0
## Gate de Escritura — Corrección Clasificación Sectorial (Opción B)

**Bloque:** `BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0`  
**Fecha:** 2026-05-11  
**Commit base:** `05f7d8b` (thematic commodities audit)  
**Tipo:** Write gate — preparación de artifacts. Sin writes. Sin deploy.  
**Estado manifest:** `authorized=false | can_write=false`

---

## A. Objetivo

Corregir la clasificación de los **14 fondos HOLD** de materias primas/oro/minería/metales preciosos aplicando **Opción B** (clasificación sectorial) para que el engine existente los excluya correctamente de los perfiles 3/4.

**Sin tocar `suitability_engine.py`. Sin tocar `compatible_profiles`.**

---

## B. Campos a Escribir

| Campo | Valor actual | Valor propuesto |
|---|---|---|
| `classification_v2.is_sector_fund` | `false` (o `null`) | `true` |
| `classification_v2.sector_focus` | `null` | `PRECIOUS_METALS` o `MINING` |

**Colección:** `funds_v3`  
**Documentos:** 14 ISINs (ver diff_manifest.json)

### Distribución por sector_focus

| sector_focus | Fondos | ISINs |
|---|---|---|
| `PRECIOUS_METALS` | 9 | IE00BYVJR916, LU0171306680, LU0273148055, LU0273159177, LU0496368142, LU0496369389, LU1223083087, LU1223084051, LU1578889864 |
| `MINING` | 5 | LU0090845842, LU0172157280, LU0172157363, LU0326425351, LU0604766674 |

---

## C. Mecanismo — Por qué Funciona Sin Cambiar el Engine

La regla en `suitability_engine.py` (L61) ya existe:

```python
is_sector_fund = bool(class_v2.get("is_sector_fund")) or str(asset_subtype or "").startswith("SECTOR_EQUITY_")

if is_sector_fund and risk_profile <= 4:
    return False, f"Sector funds ({sector_focus}) excluded for profiles <= 4."
```

**Hoy:** `is_sector_fund = bool(False) = False` → regla no dispara → gap.  
**Tras write:** `is_sector_fund = bool(True) = True` → regla dispara → `eligible=False` para p1, p2, p3, p4.

Resultado: `compatible_profiles` calculado = `[5, 6, 7, 8, 9, 10]` ✅

Verificado por `TestOptionBClassificationFix` (12 tests PASS).

---

## D. Campos Prohibidos

Estos campos NO se deben tocar en ningún caso:

```
classification_v2.compatible_profiles   ← se actualiza en gate separado posterior
portfolio_exposure_v2
manual
ms
derived
std_perf
optimizer
classification_v2.risk_bucket
classification_v2.asset_type
classification_v2.asset_subtype
classification_v2.is_suitable_low_risk
```

---

## E. Artifacts Generados

Directorio: `artifacts/suitability/thematic_commodities_classification_gate_0/`

| Artifact | Descripción |
|---|---|
| `selection.json` | 14 ISINs seleccionados, campos a escribir, rationale |
| `snapshots_before.json` | Estado actual de `is_sector_fund`, `sector_focus`, `compatible_profiles` por fondo |
| `diff_manifest.json` | Current → proposed por fondo con rationale |
| `rollback_manifest.json` | Valores de restauración si es necesario |
| `write_approval_manifest.json` | **`authorized=false`** — requiere revisión humana |

> [!CAUTION]
> El rollback restauraría `is_sector_fund=False` — el estado de gap. Ejecutar SOLO si hay un problema concreto post-write.

---

## F. Scripts

| Script | Propósito |
|---|---|
| `scripts/maintenance/bdb_thematic_commodities_classification_write_gate_0.py` | Genera artifacts leyendo Firestore live (requiere credenciales) |
| `scripts/maintenance/bdb_thematic_commodities_classification_write_controlled_0.py` | Ejecuta el write (requiere `authorized=true`) |

---

## G. Proceso de Aprobación

> [!IMPORTANT]
> Para autorizar el write controlado:
> 1. Revisar `diff_manifest.json` — confirmar que los 14 `change_needed=true` son correctos.
> 2. Revisar `snapshots_before.json` — confirmar estado actual en Firestore.
> 3. Editar `write_approval_manifest.json`:
>    - `authorized = true`
>    - `can_write = true`
>    - `approved_by_human = true`
>    - `approval_reason = "..."` (texto de aprobación humana)
>    - `approved_at = "YYYY-MM-DDTHH:MM:SSZ"`
> 4. Ejecutar `bdb_thematic_commodities_classification_write_controlled_0.py` con `GOOGLE_APPLICATION_CREDENTIALS` activa.
> 5. Verificar `post_write_verification.json` — todos deben ser PASS.

---

## H. Post-Write Checklist

Tras ejecutar el write controlado:

1. **Dry-run compatible_profiles:** re-ejecutar `bdb_compatible_profiles_regen_dry_run.py` — los 14 fondos deben aparecer `MATCH` (clasificados como sector = excluded from p3/p4 = [5..10] = stored [5..10]).
2. **Tests suitability:** `pytest functions_python/tests/test_suitability_thematic_commodities_contract.py` — `TestOptionBClassificationFix` debe PASS.
3. **Suite completa suitability:** `pytest functions_python/tests/test_suitability_v2.py functions_python/tests/test_suitability_contract_parity.py` — todo PASS.
4. **Compatible profiles gate separado:** Una vez confirmado que el dry-run muestra 0 STALE, evaluar si ejecutar un nuevo write gate para actualizar `compatible_profiles` en los 14 fondos (aunque el campo ya tiene [5..10] almacenado — posiblemente no sea necesario).

---

## I. Estado del Bloque

| Dimensión | Estado |
|---|---|
| Artifacts generados | ✅ 5/5 |
| `write_approval_manifest.json` | ✅ `authorized=false` (pendiente revisión humana) |
| Firestore writes en este bloque | ✅ **CERO** |
| Deploy | ✅ **NO** |
| Engine modificado | ✅ **NO** |
| `compatible_profiles` modificado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
