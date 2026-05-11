# BDB_REMEDIATION_SCRIPTS_ARCHIVE_PLAN_0

**Fecha:** 2026-05-11  
**HEAD:** `dde26f9`  
**Tipo:** Auditoría read-only — sin deploy, sin escritura Firestore, sin código modificado  
**Objetivo:** Inventariar y clasificar los scripts históricos de remediación MIXED para evitar reejecuciones accidentales. Proponer plan de archivo futuro. NO ejecutar archivo todavía.

---

## A. Resumen Ejecutivo

Se han inventariado **19 scripts** en `scripts/maintenance/` y **9 directorios de artifacts** en `artifacts/bdb_mixed_exposure_fix/`, correspondientes a la remediación MIXED exposure 59/60.

| Métrica | Valor |
|---------|-------|
| Scripts totales inventariados | 19 |
| Scripts con capacidad de escritura Firestore | 8 (controlled_1 a 8) |
| Scripts read-only / dry-run | 11 (gates 0,2-8 + dry_run + offline + review_audit) |
| Artifacts gates completos | 9 (gate_0, 2-8 + official_factsheet_audit_0) |
| Artifacts con rollback_manifest | 8 (write_gate_0, 2-7, 8_official_factsheet) |
| Scripts con guards `authorized + can_write` | 8 de 8 write-capable |
| Writes Firestore en esta auditoría | 0 |
| Deploy | NO |
| Código modificado | NO |

**Conclusión:** Todos los scripts write-capable tienen guards de autorización explícitos (`authorized=true`, `can_write=true`). No pueden ejecutar escrituras sin modificación manual del `write_approval_manifest.json`. Sin embargo, su mera presencia en `scripts/maintenance/` supone un riesgo de confusión. **Se recomienda mover a subdirectorio de archivo histórico como siguiente bloque.**

---

## B. Scope

| Campo | Valor |
|-------|-------|
| Directorio principal | `scripts/maintenance/` |
| Artifacts | `artifacts/bdb_mixed_exposure_fix/` |
| Documentación relacionada | `docs/BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_*.md`, `docs/BDB_MIXED_EXPOSURE_WRITE_GATE_*.md` |
| Excluido expresamente | Parser, retrocessions, optimizer scripts, X-Ray scripts |
| Excluido: tocar BDB-FONDOS-CORE | SI |
| Excluido: mover/borrar en este bloque | SI |

---

## C. Inventario de Scripts

### Tabla completa

| # | Archivo | Tipo | Lote / Gate | Write-capable | Ejecutado | Debe reejecutarse | Recomendación | Notas |
|---|---------|------|-------------|---------------|-----------|-------------------|---------------|-------|
| 1 | `bdb_mixed_exposure_fix_dry_run.py` | DRY_RUN | Fase inicial | NO | SI | NO | MOVE_TO_ARCHIVE_LATER | Lee Firestore, genera artifact JSON. Seguro. Idempotente. |
| 2 | `bdb_mixed_exposure_fix_dry_run_offline.py` | DRY_RUN | Fase inicial | NO | SI | NO | MOVE_TO_ARCHIVE_LATER | No toca Firestore. Solo procesa artifact existente. |
| 3 | `bdb_mixed_exposure_write_gate_0.py` | WRITE_GATE | Gate 0 | NO (READ-ONLY) | SI | NO | MOVE_TO_ARCHIVE_LATER | Genera artifacts, `authorized=False`, `can_write=False`. |
| 4 | `bdb_mixed_exposure_write_gate_2.py` | WRITE_GATE | Gate 2 | NO (READ-ONLY) | SI | NO | MOVE_TO_ARCHIVE_LATER | Ídem. Genera snapshots + diff_manifest. No escribe Firestore. |
| 5 | `bdb_mixed_exposure_write_gate_3.py` | WRITE_GATE | Gate 3 | NO (READ-ONLY) | SI | NO | MOVE_TO_ARCHIVE_LATER | Ídem. |
| 6 | `bdb_mixed_exposure_write_gate_4.py` | WRITE_GATE | Gate 4 | NO (READ-ONLY) | SI | NO | MOVE_TO_ARCHIVE_LATER | Ídem. |
| 7 | `bdb_mixed_exposure_write_gate_5.py` | WRITE_GATE | Gate 5 | NO (READ-ONLY) | SI | NO | MOVE_TO_ARCHIVE_LATER | Ídem. |
| 8 | `bdb_mixed_exposure_write_gate_6.py` | WRITE_GATE | Gate 6 | NO (READ-ONLY) | SI | NO | MOVE_TO_ARCHIVE_LATER | Genera artifacts para batch official_factsheet 3. |
| 9 | `bdb_mixed_exposure_write_gate_7.py` | WRITE_GATE | Gate 7 | NO (READ-ONLY) | SI | NO | MOVE_TO_ARCHIVE_LATER | Genera artifacts para 9 review_required. |
| 10 | `bdb_mixed_exposure_write_gate_8.py` | WRITE_GATE | Gate 8 | NO (READ-ONLY) | SI | NO | MOVE_TO_ARCHIVE_LATER | Genera artifacts para official_factsheet final (gate 8). |
| 11 | `bdb_mixed_exposure_write_controlled_1.py` | CONTROLLED_WRITE | Lote 1 (10 ISINs) | **YES** | SI | **NO** | **MOVE_TO_ARCHIVE_LATER** | ⚠️ Escribe Firestore. Guards: `authorized + can_write`. |
| 12 | `bdb_mixed_exposure_write_controlled_2.py` | CONTROLLED_WRITE | Lote 2 (10 ISINs) | **YES** | SI | **NO** | **MOVE_TO_ARCHIVE_LATER** | ⚠️ Escribe Firestore. Guards: `authorized + can_write`. |
| 13 | `bdb_mixed_exposure_write_controlled_3.py` | CONTROLLED_WRITE | Lote 3 (10 ISINs) | **YES** | SI | **NO** | **MOVE_TO_ARCHIVE_LATER** | ⚠️ Escribe Firestore. Guards: `authorized + can_write`. |
| 14 | `bdb_mixed_exposure_write_controlled_4.py` | CONTROLLED_WRITE | Lote 4 (10 ISINs) | **YES** | SI | **NO** | **MOVE_TO_ARCHIVE_LATER** | ⚠️ Escribe Firestore. Guards: `authorized + can_write`. |
| 15 | `bdb_mixed_exposure_write_controlled_5.py` | CONTROLLED_WRITE | Lote 5 (5 ISINs) | **YES** | SI | **NO** | **MOVE_TO_ARCHIVE_LATER** | ⚠️ Escribe Firestore. Guards: `authorized + can_write`. |
| 16 | `bdb_mixed_exposure_write_controlled_6.py` | CONTROLLED_WRITE | Lote 6 (5 ISINs) | **YES** | SI | **NO** | **MOVE_TO_ARCHIVE_LATER** | ⚠️ Escribe Firestore. Guards: `authorized + can_write`. |
| 17 | `bdb_mixed_exposure_write_controlled_7.py` | CONTROLLED_WRITE | Lote 7 (9 ISINs) | **YES** | SI | **NO** | **MOVE_TO_ARCHIVE_LATER** | ⚠️ Escribe Firestore. Guards: `AUTHORIZED_ISINS` + manifest check. |
| 18 | `bdb_mixed_exposure_write_controlled_8.py` | CONTROLLED_WRITE | Lote 8 / Official Factsheet (5 ISINs) | **YES** | SI | **NO** | **MOVE_TO_ARCHIVE_LATER** | ⚠️ Escribe Firestore. Guards: `authorized + can_write` + ISIN whitelist. |
| 19 | `bdb_mixed_review_required_audit.py` | AUDIT_HELPER | Fase review-required | NO | SI | NO | KEEP_HISTORICAL | Solo lee artifact JSON local. Sin Firestore. |

### Resumen de clasificación

| Tipo | Cantidad | Write-capable |
|------|----------|---------------|
| WRITE_GATE (read-only, genera artifacts) | 9 | NO |
| CONTROLLED_WRITE (escribe Firestore) | 8 | **YES** |
| DRY_RUN (simula sin escribir) | 2 | NO |
| AUDIT_HELPER (solo JSON local) | 1 | NO |
| **Total** | **19** | **8 write-capable** |

### Análisis de guards en scripts write-capable

Todos los scripts `controlled_*` implementan el siguiente patrón de seguridad:

```python
# GUARD 1: Approval manifest
if not manifest.get("authorized"):
    abort("Not authorized")
if not manifest.get("can_write"):
    abort("Not authorized")

# GUARD 2: ISIN whitelist check
if manifest_isins != sorted(AUTHORIZED_ISINS):
    abort("ISIN mismatch")

# GUARD 3: Pre-write drift detection (snapshots_before vs current)
# GUARD 4: Uses docRef.update() only — never set()
```

**Evaluación de riesgo de reejecución:**

| Guard | ¿Activo en todos? | ¿Protege de reejecución accidental? |
|-------|-------------------|-------------------------------------|
| `authorized=True` en JSON | SI | SI — requiere edición manual del JSON |
| `can_write=True` en JSON | SI | SI |
| ISIN whitelist exacta | SI | SI — lista hardcoded en el script |
| Pre-write drift | SI | PARCIAL — relectura de Firestore |
| `update()` no `set()` | SI | SI — no sobreescribe campos no incluidos |

> **Nota:** Los manifests de aprobación de todos los gates **ya ejecutados** tienen `authorized=True` y `can_write=True`. Esto significa que un script `controlled_*` podría reejecutarse técnicamente si se lanza manualmente con el credential correcto, dado que sus manifests ya están aprobados. Los guards de drift detection mitigan parcialmente esto (re-leerían el estado actual, que ya tiene los valores correctos → posiblemente no abortarían). **Este es el riesgo principal documentado.**

---

## D. Inventario de Artifacts

### Tabla por gate

| Gate | Path | selection | snapshots_before | diff_manifest | rollback_manifest | write_approval | post_write_verif | Estado |
|------|------|-----------|-----------------|---------------|-------------------|----------------|-----------------|--------|
| Dry-run inicial | `artifacts/bdb_mixed_exposure_fix/mixed_exposure_fix_dry_run.json` | — | — | — | — | — | — | ✅ EVIDENCIA |
| write_gate_selection_0 | `artifacts/bdb_mixed_exposure_fix/mixed_exposure_write_gate_selection_0.json` | — | — | — | — | — | — | ✅ EVIDENCIA |
| official_factsheet_audit_0 | `artifacts/bdb_mixed_exposure_fix/official_factsheet_audit_0/official_factsheet_exposure_proposal.json` | — | — | — | — | — | — | ✅ EVIDENCIA |
| write_gate_0 | `artifacts/bdb_mixed_exposure_fix/write_gate_0/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ COMPLETO |
| write_gate_2 | `artifacts/bdb_mixed_exposure_fix/write_gate_2/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ COMPLETO |
| write_gate_3 | `artifacts/bdb_mixed_exposure_fix/write_gate_3/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ COMPLETO |
| write_gate_4 | `artifacts/bdb_mixed_exposure_fix/write_gate_4/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ COMPLETO |
| write_gate_5 | `artifacts/bdb_mixed_exposure_fix/write_gate_5/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ COMPLETO |
| write_gate_6 | `artifacts/bdb_mixed_exposure_fix/write_gate_6/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ COMPLETO |
| write_gate_7 | `artifacts/bdb_mixed_exposure_fix/write_gate_7/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ COMPLETO |
| write_gate_8_official_factsheet | `artifacts/bdb_mixed_exposure_fix/write_gate_8_official_factsheet/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ COMPLETO |

> **Observación crítica:** Todos los gates tienen cadena de evidencia **100% completa** (`selection + snapshots_before + diff_manifest + rollback_manifest + write_approval_manifest + post_write_verification`). Esta trazabilidad es invaluable y no debe borrarse.

### Documentación asociada en `docs/`

| Documento | Tipo | Estado |
|-----------|------|--------|
| `BDB_MIXED_EXPOSURE_WRITE_GATE_0.md` | WRITE_GATE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_GATE_2.md` | WRITE_GATE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_GATE_3.md` | WRITE_GATE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_GATE_4.md` | WRITE_GATE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_GATE_5.md` | WRITE_GATE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_GATE_6.md` | WRITE_GATE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_GATE_7.md` | WRITE_GATE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_GATE_8_OFFICIAL_FACTSHEET.md` | WRITE_GATE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_1.md` | CONTROLLED_WRITE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_2.md` | CONTROLLED_WRITE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_3.md` | CONTROLLED_WRITE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_4.md` | CONTROLLED_WRITE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_5.md` | CONTROLLED_WRITE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_6.md` | CONTROLLED_WRITE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_7.md` | CONTROLLED_WRITE doc | ✅ |
| `BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_8_OFFICIAL_FACTSHEET.md` | CONTROLLED_WRITE doc | ✅ |
| `BDB_MIXED_EXPOSURE_FIX_DRYRUN_0.md` | DRY_RUN doc | ✅ |
| `BDB_MIXED_EXPOSURE_REAL_DRYRUN_0.md` | DRY_RUN doc | ✅ |
| `BDB_MIXED_EXPOSURE_REVIEW_REQUIRED_AUDIT_0.md` | AUDIT doc | ✅ |
| `BDB_MIXED_EXPOSURE_OFFICIAL_FACTSHEET_AUDIT_0.md` | AUDIT doc | ✅ |
| `BDB_MIXED_EXPOSURE_SOURCE_AUDIT_0.md` | AUDIT doc | ✅ |
| `BDB_MIXED_EXPOSURE_REMEDIATION_CLOSEOUT_0.md` | CLOSEOUT doc | ✅ |
| `BDB_MIXED_EXPOSURE_FINAL_CLOSEOUT_59_60.md` | CLOSEOUT doc | ✅ |

---

## E. Riesgos Detectados

| ID | Riesgo | Clasificación | Justificación |
|----|--------|---------------|---------------|
| R-01 | Scripts `controlled_1` a `controlled_8` siguen en `scripts/maintenance/` y son ejecutables con credencial activa. Sus manifests ya tienen `authorized=True`. Un `python bdb_mixed_exposure_write_controlled_N.py` accidental podría reescribir datos ya correctos. | **WARNING** | Los guards de drift detection releerían el estado actual. Si los valores ya son los correctos, el guard de drift probablemente no aborte. Riesgo de write idempotente (mismo valor) pero inesperado. |
| R-02 | No hay banner "DO NOT RUN — HISTORICAL SCRIPT" en ningún script write-capable. Un contribuidor nuevo no tendría contexto para evitar la ejecución. | **WARNING** | Sin documentación inline de advertencia en el header del script. |
| R-03 | Los artifacts `rollback_manifest.json` contienen los valores anteriores (pre-remediación) de los 59 fondos. Si se borraran, se perdería la capacidad de rollback. | **INFO** | No hay riesgo actual. Solo documentar que no deben borrarse. |
| R-04 | El script `bdb_mixed_exposure_fix_dry_run.py` al reejecutarse sobrescribiría el artifact `mixed_exposure_fix_dry_run.json`. Dado que los fondos ya están corregidos, el output cambiaría (ya no habría write_recommended). Podría confundir si se usa como referencia de auditoría futura. | **INFO** | El artifact original del dry-run histórico debería preservarse tal cual. No borrar ni sobreescribir. |
| R-05 | No existe un `README.md` o `ARCHIVE_NOTE.md` en `scripts/maintenance/` que indique cuáles scripts son históricos vs activos. | **INFO** | Riesgo de confusión operativa. Se resuelve con `BDB-REMEDIATION-SCRIPTS-ARCHIVE-APPLY-0`. |

---

## F. Recomendación de Archivo Futuro

### Recomendación: Opción combinada (2 + 3 + 4)

Se propone la siguiente secuencia de acciones, a ejecutar en el bloque `BDB-REMEDIATION-SCRIPTS-ARCHIVE-APPLY-0`:

#### F.1 Mover scripts write-capable a subdirectorio de archivo

```
scripts/maintenance/archive/mixed_exposure_remediation_2026_05/
├── bdb_mixed_exposure_write_controlled_1.py
├── bdb_mixed_exposure_write_controlled_2.py
├── bdb_mixed_exposure_write_controlled_3.py
├── bdb_mixed_exposure_write_controlled_4.py
├── bdb_mixed_exposure_write_controlled_5.py
├── bdb_mixed_exposure_write_controlled_6.py
├── bdb_mixed_exposure_write_controlled_7.py
└── bdb_mixed_exposure_write_controlled_8.py
```

Los scripts de gate (read-only) pueden moverse también opcionalmente:

```
scripts/maintenance/archive/mixed_exposure_remediation_2026_05/gates/
├── bdb_mixed_exposure_write_gate_0.py ... gate_8.py
├── bdb_mixed_exposure_fix_dry_run.py
├── bdb_mixed_exposure_fix_dry_run_offline.py
└── bdb_mixed_review_required_audit.py
```

#### F.2 Añadir banner "DO NOT RUN" en header de scripts write-capable

Propuesta de header a añadir (en el bloque apply):

```python
# ==============================================================================
# HISTORICAL SCRIPT — DO NOT RUN
# BDB-MIXED-EXPOSURE-REMEDIATION-2026-05 — CLOSED
# This script was executed on 2026-05-XX as part of controlled write batch N.
# All 59 ISINs have been remediated. Re-execution would be a WRITE to production.
# Status: ARCHIVED | Firestore: funds_v3 | Gate: N
# See docs/BDB_MIXED_EXPOSURE_FINAL_CLOSEOUT_59_60.md
# ==============================================================================
```

#### F.3 Crear README en archive

```
scripts/maintenance/archive/mixed_exposure_remediation_2026_05/README.md
```

Contenido mínimo: qué era, cuándo se ejecutó, por qué se archiva, referencia a documentación.

#### F.4 Crear archive_note en artifacts

```
artifacts/bdb_mixed_exposure_fix/ARCHIVE_NOTE.md
```

Indicando que los artifacts son evidencia histórica de la remediación MIXED 2026-05 y no deben borrarse hasta nueva instrucción explícita.

#### F.5 NO borrar artifacts rollback

Los `rollback_manifest.json` de todos los gates deben conservarse indefinidamente como evidencia de auditoría y capacidad de rollback de emergencia.

---

## G. Propuesta de Siguiente Bloque

### `BDB-REMEDIATION-SCRIPTS-ARCHIVE-APPLY-0`

> **Este bloque NO se ejecuta ahora. Es una propuesta para el siguiente chat.**

**Descripción:**
- Mover scripts `controlled_*` y `gate_*` a `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/`
- Añadir banner "DO NOT RUN — HISTORICAL SCRIPT" en header de los 8 scripts write-capable
- Crear `README.md` en el directorio de archivo
- Crear `artifacts/bdb_mixed_exposure_fix/ARCHIVE_NOTE.md`
- Commit con mensaje: `CHORE: archive mixed exposure remediation scripts 2026-05`
- Push a `origin/master`

**Reglas del bloque apply:**
- NO escribir Firestore
- NO deploy
- NO tocar lógica de negocio
- NO borrar artifacts
- NO borrar rollback_manifests
- SI puede: mover scripts (git mv), editar headers de scripts archivados
- Confirmar 143/143 tests PASS después del archivo

**Orden de bloques actualizado:**

| Prioridad | Bloque | Estado |
|-----------|--------|--------|
| 1 | `BDB-REMEDIATION-SCRIPTS-ARCHIVE-APPLY-0` | **PROPUESTO — listo para ejecutar** |
| 2 | `BDB-EQUITY-FLOOR-DEAD-CODE-AUDIT-0` | Pendiente |
| 3 | `BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0` | Pendiente |

---

## H. Confirmaciones Finales

| Check | Estado |
|-------|--------|
| Writes a Firestore | ✅ 0 |
| Deploy | ✅ NO |
| Código productivo modificado | ✅ NO |
| Scripts write-capable reejecutados | ✅ NO |
| Scripts movidos/borrados en este bloque | ✅ NO |
| Artifacts modificados | ✅ NO |
| `optimizer_core.py` tocado | ✅ NO |
| `suitability_engine.py` tocado | ✅ NO |
| `firestore.rules` tocado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |

---

*Generado por Antigravity Agent (Claude Sonnet 4.6 Thinking) — BDB-REMEDIATION-SCRIPTS-ARCHIVE-PLAN-0*  
*HEAD: `dde26f9` — Scripts inventariados: 19 — Write-capable: 8 — Artifacts gates: 9 completos*
