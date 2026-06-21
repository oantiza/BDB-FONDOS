# BDB_RETRO_ADMIN_WRITE_MVP_0

> **Tipo:** Implementación + documentación técnica
> **Fecha:** 2026-05-13
> **Bloque:** BDB-RETRO-ADMIN-WRITE-MVP-0
> **Estado:** READY-FOR-REVIEW — sin deploy, sin push, sin escrituras reales ejecutadas

---

## A. Qué se implementó

Capacidad de **escritura real gobernada** del campo `manual.costs.retrocession` en `funds_v3`, conectada a la consola Admin de retrocesiones que hasta ahora era read-only/dry-run.

El flujo queda en dos fases visibles para el admin:

1. **Dry-run** (`admin_retro_dry_run`, ya en producción): normaliza, clasifica, devuelve resultado read-only.
2. **Aplicar retrocesiones** (`admin_retro_write`, NUEVO en este bloque): tras pulsar el botón, escribir motivo, acusar warnings y marcar la confirmación, el backend re-evalúa el lote y aplica los cambios uno por uno con auditoría granular.

Ambas pestañas (Carga manual por ISIN y Carga masiva CSV/XLSX) usan el mismo `WritePanel` extraído.

---

## B. Endpoint / función nueva

| Endpoint | Tipo | Región | Memoria | Timeout | Ubicación |
|---|---|---|---|---|---|
| `admin_retro_write` | Callable (`@https_fn.on_call`) | `europe-west1` | 1 GiB | 180 s | `functions_python/api/endpoints_admin_console.py` |

**Export en `functions_python/main.py`**: añadido junto a los endpoints admin existentes.

**Wrapper / core**: la lógica testable vive en `_run_admin_retro_write_core(admin_email, actor_uid, data, db, server_timestamp)`. El callable decorado es un shim que solo hace la auth (`extract_and_verify_admin_callable`) y crea el cliente Firestore. Esto permite test unitario sin emulador.

### Contrato de input

```json
{
  "rows": [
    {
      "isin": "ES0137381036",
      "nombre": "Fondo X",
      "retro_raw": "0,80%",
      "retro_parsed_client": 0.80,
      "source": "csv",
      "cell_internal_value": null,
      "cell_number_format": null,
      "row_number": 2
    }
  ],
  "source": "manual | csv | excel | xlsx",
  "source_filename": "lote_mayo.csv",
  "dry_run_manifest_id": "retro_dry_run_2026_05_13_<uuid12>",
  "reason": "Carga mensual mayo 2026 — fuente Morningstar",
  "confirm": true,
  "warning_acks": ["ES0137381036", "ES0137381037"]
}
```

### Contrato de output

```json
{
  "mode": "WRITE_EXECUTED",
  "audit_id": "<doc_id en admin_audit_log>",
  "writes_executed": 44,
  "writes_failed": 0,
  "writes_planned": 44,
  "unchanged_count": 3,
  "warning_count": 2,
  "isins_updated": ["ES0137381036", "..."],
  "write_failures": []
}
```

Modo alternativo `WRITE_EXECUTED_AUDIT_FAILED` si los writes salieron OK pero el audit log no pudo persistirse — incluye `audit_error` para diagnóstico (los writes ya están aplicados, no se intenta deshacerlos automáticamente).

---

## C. Campos que escribe

**Solo uno**: `manual.costs.retrocession` (dotted path en `funds_v3/{isin}`).

Cada actualización pasa por `doc_ref.update({"manual.costs.retrocession": round(float(new_retro), 4)})` (4 decimales, conforme al canon C.11). No se usa `set()` en `funds_v3` bajo ninguna circunstancia.

---

## D. Campos que NO toca

- Ningún campo dentro de `funds_v3.<isin>` distinto de `manual.costs.retrocession`.
- Específicamente preservados (verificado en tests): `name`, `isin`, `asset_type`, `manual.costs.ter`, `manual.costs.ongoing`, `manual.notes`, `classification_v2.*`, `portfolio_exposure_v2.*`, todo metadato externo.
- `firestore.rules` NO se modifica en este bloque.
- BDB-FONDOS-CORE (optimizer, suitability) intacto.

---

## E. Validaciones

### Pre-flight (rechazo `INVALID_ARGUMENT`)
- `confirm == true` obligatorio.
- `reason` mínimo 3 caracteres, máximo 2000.
- `rows` no vacío y ≤ 500.
- `source ∈ {manual, csv, excel, xlsx}`.

### Re-clasificación server-side
El backend re-ejecuta el pipeline completo del dry-run (`_re_classify_for_write` reutiliza `_normalize_retrocession_backend` y `_classify_row`). NO confía en `retro_parsed_client` del cliente (canon C.2).

### Bloqueo del lote (rechazo `FAILED_PRECONDITION`)
- **Cualquier fila BLOCKED** tras re-clasificación → aborta sin escribir nada. La respuesta incluye `blocked_isins` con motivo.
- **WARNING sin acuse** (ISIN no presente en `warning_acks`) → aborta sin escribir.

### Por fila (durante escritura)
- **Anti-stale (C.7)**: read-back del documento justo antes del update. Si `current_retro` en Firestore difiere del `current_retro` del manifest con tolerancia `>= 1e-6` → SKIPPED, motivo `STALE_CURRENT`. Otras filas continúan.
- **No-op equal value**: si `existing == new` con tolerancia `<1e-6` → SKIPPED `NO_OP_EQUAL_VALUE`. No genera write.
- **Fondo no encontrado** en re-check → SKIPPED `FUND_NOT_FOUND_AT_WRITE_TIME` (consistente con el invariante de no crear fondos).
- **Verificación post-write (C.14)**: read-back tras el update. Comparación con tolerancia `<1e-6`; se anota `PASS` / `FAIL` en la entrada de audit.

---

## F. Tratamiento del valor 0

- `0`, `0%`, `0,00%`, `0.00%` en CSV → normalizado a `0` con status `OK`.
- Celda Excel con `cell_internal_value=0` + formato `%` → normalizado a `0` con status `OK`.
- Es valor válido en todos los puntos de la cadena.
- Se guarda como `manual.costs.retrocession = 0` (no se omite ni se transforma).
- En el modal de confirmación, los ISINs con retro=0 se listan en un callout azul "🟦 Retrocesiones a 0".

Tests dedicados: `test_retro_zero_is_written`, `test_retro_zero_with_percent_format_is_written`.

---

## G. Tratamiento de vacíos

`""`, `null`, `undefined`, ausencia del campo → status `MISSING` → fila BLOCKED → bloquea el lote completo. No se escribe nada.

Tests: `test_empty_retro_blocks_lote`, `test_null_retro_blocks_lote`, `test_undefined_retro_blocks_lote`.

---

## H. Tratamiento de duplicados

| Caso | Resultado |
|---|---|
| Mismo ISIN, mismo valor (tol `<1e-6`) | Segunda copia clasificada como WARNING `DUP_SAME_VALUE`. Requiere acuse en `warning_acks`. La segunda escritura termina en SKIPPED `NO_OP_EQUAL_VALUE` porque el primer update ya dejó el documento sincronizado. |
| Mismo ISIN, valores distintos | TODAS las filas del grupo BLOCKED con motivo `DUP_CONFLICT`. Bloquea el lote completo. |
| ISINs distintos | Procesados independientemente. |

La detección de duplicados se ejecuta SIEMPRE server-side, independientemente de lo que reporte el frontend.

Tests: `test_duplicate_same_value_warning_consolidated`, `test_duplicate_conflict_blocks_lote`.

---

## I. Auditoría

### Colección
`admin_audit_log/{auto_id}` — colección nueva creada implícitamente en la primera escritura del bloque. No requiere modificación previa de `firestore.rules` para empezar a funcionar (las rules actuales niegan por defecto; el Admin SDK escribe con privilegios de servicio). Cuando se quiera permitir lectura cliente debe añadirse `allow read: if isAdmin();` en un bloque WRITE-GATE-RULES posterior.

### Documento

```json
{
  "timestamp": "<SERVER_TIMESTAMP>",
  "actor_email": "oantiza@gmail.com",
  "actor_uid": "<firebase auth uid>",
  "action": "admin_retro_write",
  "source": "csv",
  "source_filename": "lote_mayo.csv",
  "dry_run_manifest_id": "retro_dry_run_2026_05_13_xxx",
  "reason": "Carga mensual mayo 2026 — Morningstar",
  "total_rows": 50,
  "writes_planned": 44,
  "writes_executed": 44,
  "writes_failed": 0,
  "unchanged_count": 3,
  "warning_count": 2,
  "warning_acks": ["ES0137381036", "ES0137381037"],
  "client_server_normalization_mismatches": 0,
  "isins_updated": ["ES0137381036", "..."],
  "entries": [
    {
      "isin": "ES0137381036",
      "previous": 0.5,
      "new": 0.8,
      "result": "PASS",
      "warning_acked": false,
      "post_write_verification": "PASS"
    },
    {
      "isin": "ES0137381037",
      "previous": 0.5,
      "new": 7.5,
      "result": "PASS",
      "warning_acked": true,
      "post_write_verification": "PASS"
    },
    {
      "isin": "ES0137381044",
      "previous": 0.6,
      "new": 0.6,
      "result": "SKIPPED",
      "reason": "NO_OP_EQUAL_VALUE"
    }
  ],
  "write_failures": []
}
```

Cada `entry` permite rollback manual leyendo `previous` y revirtiendo via update.

---

## J. Rollback manual

No hay endpoint de rollback automático en este MVP. El procedimiento manual es:

1. Localizar el `audit_id` (devuelto en la respuesta y visible en el banner verde del UI tras la escritura).
2. Leer `admin_audit_log/<audit_id>.entries` filtrando por `result == "PASS"`.
3. Para cada entry, ejecutar (script ad-hoc con Admin SDK) `funds_v3/<isin>.update({"manual.costs.retrocession": entry.previous})`.
4. Crear un nuevo audit doc del rollback con `action: "admin_retro_rollback_manual"` referenciando el `audit_id` original en `dry_run_manifest_id`.

El `previous` capturado en cada entry proviene del read-back inmediato antes del update, no del valor del manifest; refleja el estado real de Firestore en el momento del write y permite reversión fiel.

---

## K. Frontend

### Componentes
- **`RetrocessionManager.tsx`** (modificado): el banner ahora describe el flujo de dos fases. Ambas pestañas (`ManualTab`, `BulkTab`) renderizan `<WritePanel>` cuando hay un `dryRunResult` válido.
- **`WritePanel`** (nuevo, exportado desde el mismo archivo): botón "Aplicar retrocesiones", modal con motivo + acuse warnings + confirmación, banner de éxito con `audit_id` y lista de ISINs actualizados.
- **`adminRetroService.ts`** (extendido): nueva función `executeWrite(...)` que invoca el callable `admin_retro_write`. Tipos `RetroWriteSource`, `RetroWriteResponse`.

### Gating del botón "Aplicar retrocesiones"
- Disabled si: en curso de escritura, hay escritura completada (locked tras éxito), hay filas BLOCKED, o `writes_planned == 0`.
- En todo otro caso: habilitado.

### Gating del submit dentro del modal
- Disabled hasta que: `reason.trim().length >= 3`, casilla "Confirmo aplicar retrocesiones" marcada, y todos los WARNING están acusados (per-ISIN o "Acepto todos los warnings").

### Tras éxito
- Banner verde con `audit_id`, modo, `writes_executed`/`writes_planned`/`writes_failed`/`unchanged_count`.
- Lista `<details>` con los ISINs actualizados y, si los hubo, los `write_failures`.
- El botón "Aplicar retrocesiones" queda bloqueado para evitar relanzar la misma escritura (el resultado del dry-run sigue visible).

### Tras error
- Modal permanece abierto con el mensaje de error visible.
- Botón "Aplicar" del modal vuelve a estar habilitado para reintentar tras corregir.
- El bloque de resultados del dry-run NO se borra.

---

## L. CSV y Excel

- **CSV**: sin cambios respecto al estado previo en producción. PapaParse, separador `;`, encoding UTF-8 BOM → UTF-8 → latin-1, líneas vacías ignoradas, comillas RFC 4180. Coma decimal soportada (`1,38%` → 1.38).
- **Excel** (.xlsx, .xls): el parser SheetJS ya existía. El backend acepta la celda numérica con metadata `cell_internal_value` + `cell_number_format` y aplica la regla canónica C.1 (solo `%` en formato dispara la multiplicación por 100; sin heurística por tamaño). Celda interna `0` con formato `%` → retro `0` válida (no vacía).
- Frontend asigna `source` automáticamente según extensión (`.xlsx`/`.xls` → `excel`, otro caso → `csv`). Operación manual envía `source: "manual"`.

---

## M. Tests añadidos

### Backend (Python, pytest)
Archivo: `functions_python/api/test_admin_retro_write.py` (~30 tests).

Cobertura por requerimiento:

| Requerimiento | Test(s) |
|---|---|
| retro 0 write allowed | `test_retro_zero_is_written`, `test_retro_zero_with_percent_format_is_written` |
| empty retro blocked | `test_empty_retro_blocks_lote` |
| null retro blocked | `test_null_retro_blocks_lote` |
| undefined retro blocked | `test_undefined_retro_blocks_lote` |
| invalid ISIN blocked | `test_invalid_isin_blocks_lote` |
| fund not found blocked | `test_fund_not_found_blocks_lote` |
| no fund creation | `test_no_fund_creation_attempted` |
| dup same value consolidated | `test_duplicate_same_value_warning_consolidated` |
| dup conflict blocks lote | `test_duplicate_conflict_blocks_lote` |
| any BLOCKED aborts | `test_any_blocked_aborts_entire_lote` |
| WARNING requires ack | `test_warning_requires_ack`, `test_warning_proceeds_with_ack` |
| reason required, confirm required | `test_short_reason_rejected`, `test_missing_confirm_rejected` |
| only retrocession field updated | `test_only_retrocession_field_updated` |
| audit record created | `test_audit_document_created` |
| before/after captured | `test_audit_captures_before_and_after` |
| audit includes warning acks | `test_audit_includes_warning_acks` |
| unchanged skipped | `test_unchanged_row_is_skipped` |
| canon Excel sin heurística | `TestNormalizeBackend.test_xlsx_format_only_no_size_heuristic` |
| dedup helper directo | `TestReClassifyForWrite.*` |

**Auth / unauthenticated**: cubierto a nivel del decorator `extract_and_verify_admin_callable` (probado en E2E read-only previo, mismo patrón). En el core de write no se replica la prueba de auth porque el shim decorado es el único responsable; ese shim ya es triviales en su lógica (4 líneas) y reusa exactamente la misma función de auth que el resto de endpoints admin de la consola.

### Frontend (Vitest + Testing Library)
Archivo: `frontend/src/__tests__/retroWritePanel.test.tsx` (~12 tests).

| Requerimiento | Test |
|---|---|
| botón Aplicar disabled si BLOCKED | `disables Apply button when BLOCKED row present` |
| botón disabled si no hay cambios aplicables | `disables Apply button when no applicable changes` |
| retro=0 aparece como aplicable | `retro=0 OK row is counted as applicable` |
| modal abre y muestra resumen | `opens modal on click and shows summary` |
| submit requiere motivo ≥3 y confirm | `submit button is disabled until motivo + confirm checkbox` |
| reason corto bloquea submit | `submit disabled with too-short reason` |
| WARNING requiere ack-all o per-isin | `WARNING rows require per-isin ack or ack-all`, `WARNING per-isin ack also enables submit` |
| éxito muestra audit_id y locks button | `success path shows audit_id and locks the button` |
| error preserva dry-run | `error path keeps dry-run visible` |
| payload incluye motivo/acks | `payload sent to executeWrite carries reason and warning_acks` |

---

## N. Riesgos residuales

1. **`admin_audit_log` y firestore.rules**. La colección queda escrita por Admin SDK desde la Cloud Function (privilegios de servicio bypass de rules). El cliente no puede leerla ni escribirla por las rules actuales (deny by default). Si en un bloque futuro se quiere mostrar el historial en el UI, habrá que añadir `allow read: if isAdmin();` para `admin_audit_log/{doc}` en un bloque dedicado (WRITE-GATE-RULES).
2. **Race condition multi-admin**. Dos administradores que ejecuten escritura simultáneamente sobre el mismo conjunto de ISINs pueden producir entradas STALE_CURRENT en el segundo lote (el anti-stale los protege). No hay bloqueo distribuido. En el patrón actual de uso (un único admin operando), riesgo bajo.
3. **`dry_run_manifest_id` no se valida contra una colección persistida**. El manifest del dry-run sigue viviendo solo en memoria de la Cloud Function (lo confirma `endpoints_admin_console.py` con el comentario "in-memory for DRYRUN-0, not persisted"). El `dry_run_manifest_id` se registra en el audit log como referencia trazable pero el backend no verifica que exista. La defensa real es la re-clasificación server-side: aunque el cliente mienta sobre el manifest_id, el backend re-evalúa BLOCKED/WARNING y aplica los gates.
4. **Excel con valores extremos**. El normalizador interpreta `(0.50, "0.00%")` como `50` (50%). El clasificador lo marca WARNING `Valor alto`. Si el archivo usa el formato `%` de manera inusual, el admin debe acusar el warning o corregir el archivo. Documentado en el banner y en el callout de "Cambios grandes" del modal.
5. **Sin rollback automático**. El procedimiento descrito en sección J es manual y requiere un script ad-hoc. Aceptable para MVP; valorable construir un endpoint `admin_retro_rollback` en un bloque posterior si el patrón de uso lo justifica.
6. **CORS / cliente nuevo**. El nuevo callable `admin_retro_write` hereda la configuración CORS de `cors_config` ya usada por los demás endpoints admin. Pruebas locales con emulador deberían funcionar; en producción no hay riesgo CORS adicional respecto al estado actual.

---

## O. Pasos para deploy posterior

Cuando el usuario autorice deploy:

1. Confirmar `npm run build` y `npm run test -- --run` en `frontend/`. Esperado: build OK, tests parser (43) + tests write-panel (≈12) PASS.
2. Confirmar `pytest functions_python/api/test_admin_retro_write.py -v` PASS (instalando `pytest` si no estaba).
3. `git add` selectivo: SOLO los archivos listados en sección P. No `git add -A`.
4. `git status` debe mostrar nada salvo los archivos del bloque (más los pre-existentes line-ending noise ya conocidos).
5. `firebase deploy --only functions:admin_retro_write,functions:admin_retro_dry_run,functions:admin_fund_search,functions:admin_health,hosting`. NO deploy de `firestore:rules` (no se ha modificado).
6. Primera prueba controlada en producción: lote de 1 ISIN, valor que sea visiblemente reversible (e.g. cambiar `0.80` por `0.81` y luego restaurar). Verificar audit doc presente.
7. Si OK: pasar a lote completo con `reason` descriptivo.
8. Capturar `audit_id` de la primera carga real en el bloque de cierre (BDB_RETRO_ADMIN_WRITE_MVP_DEPLOY_0).

---

## P. Archivos modificados / creados

### Backend
- `functions_python/api/endpoints_admin_console.py` — añade `_re_classify_for_write`, `_run_admin_retro_write_core`, `admin_retro_write`, constantes `AUDIT_COLLECTION`, `REASON_MIN_LEN`, `REASON_MAX_LEN`.
- `functions_python/main.py` — añade `admin_retro_write` al import desde `endpoints_admin_console`.
- `functions_python/api/test_admin_retro_write.py` — NUEVO, suite de tests con mock Firestore.

### Frontend
- `frontend/src/services/adminRetroService.ts` — añade `executeWrite`, tipos `RetroWriteSource`, `RetroWriteResponse`, `WritePayload`.
- `frontend/src/components/admin/RetrocessionManager.tsx` — añade `WritePanel` (exportado), `inferBulkSource`, integra en `ManualTab` y `BulkTab`, actualiza banner y badges.
- `frontend/src/__tests__/retroWritePanel.test.tsx` — NUEVO.

### Documentación
- `docs/BDB_RETRO_ADMIN_WRITE_MVP_0.md` — este documento.

### NO modificado
- `firestore.rules`.
- BDB-FONDOS-CORE (no es parte de este repo).
- `optimizer_core.py`, `suitability_engine.py`.
- `endpoints_admin.py` (legacy).
- Frontend de otros módulos.
- `frontend/package.json` (xlsx ya estaba presente desde DRYRUN-0).

---

## Validación Final del Bloque

| Métrica | Resultado |
|---|---|
| Archivos creados | 3 (`test_admin_retro_write.py`, `retroWritePanel.test.tsx`, este `.md`) |
| Archivos modificados | 3 (`endpoints_admin_console.py`, `main.py`, `RetrocessionManager.tsx`, `adminRetroService.ts`) → 4 |
| Código productivo modificado | SÍ (backend + frontend), bajo invariantes |
| Firestore writes ejecutados | 0 (tests usan mock store; nada toca prod) |
| Deploy | NO |
| Push | NO |
| Commit | 0 |
| BDB-FONDOS-CORE tocado | NO |
| firestore.rules tocado | NO |
| Siguiente bloque | `BDB-RETRO-ADMIN-WRITE-MVP-DEPLOY-0` — primera prueba controlada |

### Estado: `BDB_RETRO_ADMIN_WRITE_MVP_0_READY` ✅
