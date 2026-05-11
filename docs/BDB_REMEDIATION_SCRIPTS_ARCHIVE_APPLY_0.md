# BDB_REMEDIATION_SCRIPTS_ARCHIVE_APPLY_0

**Fecha:** 2026-05-11  
**HEAD antes:** `9a49314`  
**Tipo:** Mantenimiento — sin deploy, sin escritura Firestore, sin lógica modificada  
**Bloque previo:** `BDB-REMEDIATION-SCRIPTS-ARCHIVE-PLAN-0` (commit `9a49314`)

---

## A. Resumen Ejecutivo

Se ha aplicado el plan de archivo para los 8 scripts históricos de escritura Firestore de la
remediación MIXED 2026-05. Los scripts han sido **movidos** (no borrados) a un subdirectorio
de archivo, se les ha añadido un **banner DO NOT RUN** visible en la cabecera, y se han creado
los documentos de referencia para nuevos colaboradores.

| Item | Estado |
|------|--------|
| Scripts write-capable movidos a archive | ✅ 8 de 8 |
| Banners DO NOT RUN añadidos | ✅ 8 de 8 |
| README.md de archivo creado | ✅ |
| ARCHIVE_NOTE.md en artifacts creado | ✅ |
| Scripts read-only / gate en su sitio original | ✅ (no movidos) |
| Rollback manifests intactos | ✅ |
| Writes a Firestore | ✅ 0 |
| Deploy | ✅ NO |
| Lógica de negocio modificada | ✅ NO |
| Scripts controlled_write ejecutados | ✅ NO |

---

## B. Scripts Movidos

### Origen → Destino

| Script | Origen | Destino |
|--------|--------|---------|
| `bdb_mixed_exposure_write_controlled_1.py` | `scripts/maintenance/` | `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/` |
| `bdb_mixed_exposure_write_controlled_2.py` | `scripts/maintenance/` | `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/` |
| `bdb_mixed_exposure_write_controlled_3.py` | `scripts/maintenance/` | `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/` |
| `bdb_mixed_exposure_write_controlled_4.py` | `scripts/maintenance/` | `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/` |
| `bdb_mixed_exposure_write_controlled_5.py` | `scripts/maintenance/` | `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/` |
| `bdb_mixed_exposure_write_controlled_6.py` | `scripts/maintenance/` | `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/` |
| `bdb_mixed_exposure_write_controlled_7.py` | `scripts/maintenance/` | `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/` |
| `bdb_mixed_exposure_write_controlled_8.py` | `scripts/maintenance/` | `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/` |

Método: `git mv` — los movimientos están trackeados en el historial git con trazabilidad completa.

### Verificación post-movimiento

```
scripts/maintenance/bdb_mixed_exposure_write_controlled_*.py  → (vacío)
scripts/maintenance/archive/.../bdb_mixed_exposure_write_controlled_*.py → 8 archivos
```

**Resultado:** ✅ Correcto.

---

## C. Banner DO NOT RUN Añadido

El siguiente banner fue insertado al inicio de cada uno de los 8 scripts archivados
(inmediatamente después del shebang `#!/usr/bin/env python3`, antes del docstring original):

```python
# ---------------------------------------------------------------------------
# DO NOT RUN -- HISTORICAL SCRIPT
# This script was used once during BDB MIXED exposure remediation 2026-05.
# It is retained only for auditability and rollback traceability.
# Re-execution may write to production Firestore (funds_v3).
# See docs/BDB_REMEDIATION_SCRIPTS_ARCHIVE_PLAN_0.md
# ---------------------------------------------------------------------------
```

La lógica interna de los scripts no fue modificada. Solo se añadió el banner.

---

## D. Documentación de Archivo Creada

### `scripts/maintenance/archive/mixed_exposure_remediation_2026_05/README.md`

Contenido:
- Tabla de los 8 scripts archivados con su lote y status EXECUTED
- Advertencia explícita DO NOT RUN
- Instrucciones para nueva remediación futura (crear nuevo gate, no reutilizar)
- Referencias a rollback manifests y documentación maestra

### `artifacts/bdb_mixed_exposure_fix/ARCHIVE_NOTE.md`

Contenido:
- Tabla de todos los artifacts conservados (9 gates + dry-run + official_factsheet_audit_0)
- Advertencia crítica: rollback_manifests NO borrar
- Estado de Hamco (LU3038481936): NO TOCAR
- Referencias cruzadas a documentación maestra

---

## E. Scripts NO Movidos (intención explícita)

Los siguientes scripts **permanecen en `scripts/maintenance/`** porque son read-only
o de generación de artifacts (no escriben Firestore):

| Script | Motivo para no mover |
|--------|---------------------|
| `bdb_mixed_exposure_write_gate_0.py` | READ-ONLY, genera artifacts de gate |
| `bdb_mixed_exposure_write_gate_2.py` | READ-ONLY |
| `bdb_mixed_exposure_write_gate_3.py` | READ-ONLY |
| `bdb_mixed_exposure_write_gate_4.py` | READ-ONLY |
| `bdb_mixed_exposure_write_gate_5.py` | READ-ONLY |
| `bdb_mixed_exposure_write_gate_6.py` | READ-ONLY |
| `bdb_mixed_exposure_write_gate_7.py` | READ-ONLY |
| `bdb_mixed_exposure_write_gate_8.py` | READ-ONLY |
| `bdb_mixed_exposure_fix_dry_run.py` | DRY_RUN — no escribe Firestore |
| `bdb_mixed_exposure_fix_dry_run_offline.py` | DRY_RUN offline — no accede a Firestore |
| `bdb_mixed_review_required_audit.py` | AUDIT_HELPER — solo lee JSON local |

Estos pueden moverse en un bloque futuro si se decide limpiar completamente `scripts/maintenance/`.

---

## F. Tests Ejecutados

```
pytest tests/test_mixed_exposure_ms_portfolio.py tests/test_mixed_funds_lookthrough_contract.py tests/test_suitability_v2.py -v --tb=short
```

**Resultado:** 🟢 **62/62 PASSED** — 1.79s

El movimiento de scripts no afecta ningún test (los tests no importan los scripts de maintenance).

---

## G. Verificaciones Finales

| Check | Resultado |
|-------|-----------|
| `scripts/maintenance/bdb_mixed_exposure_write_controlled_*.py` | **VACÍO** ✅ |
| `scripts/maintenance/archive/.../bdb_mixed_exposure_write_controlled_*.py` | **8 archivos** ✅ |
| Banner visible en línea 2 de cada script archivado | ✅ |
| `artifacts/bdb_mixed_exposure_fix/write_gate_*/rollback_manifest.json` | INTACTOS ✅ |
| `artifacts/bdb_mixed_exposure_fix/ARCHIVE_NOTE.md` | CREADO ✅ |
| `scripts/maintenance/archive/.../README.md` | CREADO ✅ |

---

## H. Riesgo Residual Post-Archive

| ID | Riesgo | Clasificación | Estado |
|----|--------|---------------|--------|
| R-01 | Scripts write-capable siguen existiendo en archive con manifests `authorized=True` | **INFO** | Mitigado — ubicación archive + banner DO NOT RUN |
| R-02 | Scripts gate (read-only) siguen en raíz `scripts/maintenance/` | **INFO** | No es riesgo de escritura. Documentado para bloque futuro opcional. |
| R-03 | Hamco LU3038481936 sigue sin datos Morningstar | **INFO** | Documentado en ARCHIVE_NOTE y README. Sin acción posible ahora. |

---

## I. Confirmaciones Absolutas

| Check | Estado |
|-------|--------|
| Writes a Firestore | ✅ 0 |
| Deploy | ✅ NO |
| Scripts controlled_write ejecutados | ✅ NO |
| Scripts gate ejecutados | ✅ NO |
| `optimizer_core.py` tocado | ✅ NO |
| `suitability_engine.py` tocado | ✅ NO |
| `firestore.rules` tocado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| Rollback manifests borrados | ✅ NO |
| Artifacts de auditoría borrados | ✅ NO |
| Lógica de scripts modificada | ✅ NO (solo banner añadido) |

---

## J. Siguiente Bloque Recomendado

Con el riesgo de reejecución accidental mitigado, el siguiente paso natural es
la auditoría de deuda técnica restante:

| Bloque | Descripción |
|--------|-------------|
| `BDB-EQUITY-FLOOR-DEAD-CODE-AUDIT-0` | Auditar si `EQUITY_FLOOR` en optimizer es código muerto. Read-only. |
| `BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0` | Auditar umbrales hardcoded en suitability (30%, 45%, 60%). Read-only. |

**Recomendación inmediata:** `BDB-EQUITY-FLOOR-DEAD-CODE-AUDIT-0` — es el de menor riesgo
y mayor claridad de scope.

---

*Generado por Antigravity Agent (Claude Sonnet 4.6 Thinking) — BDB-REMEDIATION-SCRIPTS-ARCHIVE-APPLY-0*  
*Tests: 62/62 PASS — Scripts movidos: 8 — Banners añadidos: 8 — Writes Firestore: 0*
