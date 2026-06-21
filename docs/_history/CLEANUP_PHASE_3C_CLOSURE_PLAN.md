# FASE 3C — Plan de Cierre Documental y Commit de Consolidación

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.

---

## 1. Diagnóstico de Documentación

### 1.1 `functions_python/scripts/README.md` — ❌ DESACTUALIZADO

El README aún lista **45 entradas** incluyendo:
- 4 entradas sandbox eliminadas en 3B.2 (`debug_test.py`, `temp_fetch_hcz61.py`, `temp_func.py`, `test_optimizer_crash.py`)
- 7 entradas archive eliminadas en 3B.3
- La sección `archive/` en la estructura de carpetas ya no existe

**Acción:** Regenerar el README desde el manifest actual (34 entradas ACTIVE) y eliminar la referencia a `archive/` en la estructura de carpetas.

### 1.2 Documentos de limpieza en `docs/` — ✅ COMPLETOS

17 documentos de auditoría/limpieza creados:

| Fase | Documentos |
|---|---|
| Fase 1 | `CLEANUP_SECURITY_AUDIT_PLAN.md`, `CLEANUP_PHASE_1_EXECUTION_PLAN.md`, `CLEANUP_PHASE_1_COMPLETION_REPORT.md` |
| Fase 2 | `CLEANUP_PHASE_2_EXECUTION_PLAN.md`, `CLEANUP_PHASE_2_COMPLETION_REPORT.md` |
| Fase 3 | `CLEANUP_PHASE_3_SCRIPTS_AUDIT_PLAN.md`, `CLEANUP_PHASE_3A_VALIDATION_REPORT.md` |
| Fase 3B | `3B1` a `3B7` (planes + informes = 10 documentos) |

**Decisión:** Todos son documentos de proceso valiosos. Incluir en commit.

### 1.3 `.gitignore` — ✅ ADECUADO

Ya protege correctamente: `.env`, `serviceAccount*.json`, `*.zip`, `data/`, logs, etc.
No se necesitan cambios.

---

## 2. Cambios Documentales Propuestos

### 2.1 Actualizar `functions_python/scripts/README.md`

- Eliminar referencia a `archive/` en la estructura de carpetas
- Regenerar tabla del catálogo con 34 entradas ACTIVE del manifest
- Añadir sección sobre scripts únicos en raíz (9 scripts sin categorizar)
- Añadir nota sobre almacenamiento externo

### 2.2 Crear `docs/CLEANUP_PHASE_3_FINAL_SUMMARY.md`

Resumen ejecutivo consolidado con:
- Cronología de fases
- Totales acumulados
- Rutas de almacenamiento externo
- Estado final del repositorio
- Decisiones pendientes

---

## 3. Estado Final del Repositorio

### 3.1 `scripts/` — 16 archivos raíz + 4 subdirectorios

```
scripts/
├── 16 archivos raíz (únicos, sin duplicados)
├── maintenance/     (48 scripts — fuente de verdad JS)
├── firebase/        (1 archivo)
├── repo/            (4 archivos)
└── sandbox/         (1 archivo)
```

### 3.2 `functions_python/scripts/` — 14 archivos raíz + 8 subdirectorios

```
functions_python/scripts/
├── 14 archivos raíz (9 scripts únicos + manifest + README + 2 CSV + 1 JS)
├── audit/       (11 scripts)
├── debug/       (8 scripts)
├── fixes/       (10 scripts)
├── maintenance/ (1 script)
├── migration/   (7 scripts)
├── reports/     (6 scripts)
├── sandbox/     (5 scripts)
└── tests/       (5 scripts)
```

### 3.3 `frontend/scripts/` — 2 archivos (intocados)

```
frontend/scripts/
├── inspect_db.cjs
└── inspect_db.js
```

### 3.4 Almacenamiento Externo

```
C:\Users\oanti\Documents\BDB-FONDOS-EXTERNAL-ARCHIVE\
├── archive_2026-05-04\              15 archivos (~118 MB, Fase 2)
├── scripts_archive_2026-05-04\      55 archivos (Fase 3B.1)
└── fp_scripts_archive_2026-05-04\   7 archivos (~326 KB, Fase 3B.3)
```

---

## 4. Checklist Pre-Commit

| # | Verificación | Comando |
|---|---|---|
| 1 | JSON válido: `package.json` | `ConvertFrom-Json` |
| 2 | JSON válido: `scripts/package.json` | `ConvertFrom-Json` |
| 3 | JSON válido: `fp/scripts/script_manifest.json` | `ConvertFrom-Json` |
| 4 | Manifest: 34 ACTIVE, 0 huérfanas | Script PowerShell |
| 5 | Rutas externas existen (3 carpetas) | `Test-Path` |
| 6 | `frontend/src/` intacto | `Test-Path` |
| 7 | `functions_python/api/` intacto | `Test-Path` |
| 8 | `functions_python/services/` intacto | `Test-Path` |
| 9 | Credenciales presentes | `Test-Path` |
| 10 | `git status` revisado | `git status` |

---

## 5. Archivos Esperados en Git Status

### Eliminados (D) — Incluir en commit
~178 archivos eliminados:
- `mingit/` completo (~110 archivos)
- `scripts/archive/` (55 archivos, externalizado en 3B.1)
- `scripts/*.js|*.py` raíz (6 SHA256 + 17 header-only = 23)
- `fp/scripts/archive/` (7 archivos, externalizado en 3B.3)
- `fp/scripts/*.py` raíz (27 + 2 = 29)
- Archivos raíz de Fase 1-2: ZIPs, logs, CSVs, HTML

### Modificados (M) — Incluir en commit
- `package.json` — actualizado main
- `scripts/package.json` — actualizado main
- `fp/scripts/script_manifest.json` — limpiado (45→34 entradas)
- `fp/scripts/sandbox/debug_frontier_local.py` — verificar si es intencional
- `fp/scripts/sandbox/test_real_frontier.py` — verificar si es intencional
- `fp/scripts/tests/test_optimizer.py` — verificar si es intencional

### Nuevos (??) — Decidir
- `docs/CLEANUP_*.md` (17 archivos) — **INCLUIR**
- `fp/scripts/debug/inspector.py` — **INCLUIR** (nuevo script legítimo)
- `scripts/maintenance/` (7 nuevos) — **INCLUIR**
- `functions_python/tests/xray/` — **INCLUIR** (tests legítimos)

### NO incluir en commit
- `.env`, `frontend/.env` — ya en `.gitignore`
- `serviceAccountKey.json` — ya en `.gitignore` (`serviceAccount*.json`)

---

## 6. Archivos Modificados Inesperados

> [!WARNING]
> 3 archivos en `fp/scripts/` aparecen como `M` (modified) pero NO fueron parte de la limpieza:
> - `functions_python/scripts/sandbox/debug_frontier_local.py`
> - `functions_python/scripts/sandbox/test_real_frontier.py`
> - `functions_python/scripts/tests/test_optimizer.py`
>
> Estos probablemente fueron modificados en sesiones de desarrollo anteriores. Se recomienda verificar con `git diff` antes de commit para confirmar que los cambios son intencionales.

---

## 7. Mensaje de Commit Propuesto

```
chore: consolidate repository cleanup phases 1-3

Phase 1: Remove build artifacts, logs, and temporary files
Phase 2: Externalize archive/ to local external storage
Phase 3: Unify script directories
  - Externalize scripts/archive/ (55 files) and fp/scripts/archive/ (7 files)
  - Clean script_manifest.json: remove 11 orphaned/archived entries
  - Remove 6 exact SHA256 duplicate scripts from scripts/ root
  - Remove 17 header-only duplicate scripts from scripts/ root
  - Remove 29 root duplicate scripts from fp/scripts/
  - Update package.json main entries to point to maintenance/
  - Remove mingit/ embedded git distribution

Final state:
  - script_manifest.json: 34 ACTIVE entries, 0 orphaned
  - scripts/ root: 16 unique files + 4 subdirectories
  - fp/scripts/ root: 14 unique files + 8 subdirectories
  - External archive: 77 files in BDB-FONDOS-EXTERNAL-ARCHIVE/
```

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Archivos eliminados que se necesiten después | Están en almacenamiento externo local |
| Scripts ejecutados desde paths legacy | No se detectaron referencias funcionales |
| Manifest desactualizado | Verificado: 34 ACTIVE, 0 huérfanas |
| README.md desactualizado | Se actualizará en FASE 3C |
| Sandbox files modificados no relacionados | Verificar con `git diff` antes de commit |

---

## 9. Prompt Recomendado para Ejecución

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 3C — cierre documental y commit de consolidación.

REGLAS ESTRICTAS:
- NO toques código funcional.
- NO toques credenciales.
- NO toques frontend/src/.
- NO toques functions_python/api/ ni services/.
- NO ejecutes scripts.
- Solo documentar y commit.

OBJETIVO:
1. Actualizar functions_python/scripts/README.md:
   - Eliminar "archive/" de la estructura de carpetas.
   - Regenerar tabla con 34 entradas ACTIVE del manifest.
   - Añadir sección de scripts únicos en raíz.

2. Crear docs/CLEANUP_PHASE_3_FINAL_SUMMARY.md con resumen ejecutivo.

3. Verificar los 3 archivos "M" no relacionados con git diff.

4. Ejecutar checklist pre-commit completo.

5. Hacer git add y commit con el mensaje propuesto.

ENTREGABLE:
Confirmación de commit con hash.
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún commit realizado. Ningún archivo modificado. El repositorio permanece en su estado post-FASE 3B.7.
