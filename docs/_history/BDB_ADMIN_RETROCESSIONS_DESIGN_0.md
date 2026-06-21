# BDB_ADMIN_RETROCESSIONS_DESIGN_0

> **Tipo:** Diseño funcional y técnico
> **Fecha:** 2026-05-13
> **Modo:** READ-ONLY / Documentación — NO se modifica código
> **Bloque:** BDB-ADMIN-RETROCESSIONS-DESIGN-0
> **Patch:** BDB-ADMIN-RETROCESSIONS-DESIGN-PATCH-0 (incorpora correcciones C.1–C.15 de la revisión crítica Opus 4.7 HIGH)

---

## A. Resumen Ejecutivo

Diseño del módulo **Admin > Retrocesiones** para BDB-FONDOS. Evoluciona el actual `RetrocessionPanel` (read-only, datos estáticos del write_gate_2) hacia un módulo interactivo con:

1. **Carga manual** — buscar fondo por ISIN, ver retro actual, introducir nueva.
2. **Carga masiva** — subir CSV (`;`) o XLSX, detectar columnas, normalizar, validar.
3. **Dry-run obligatorio** — comparar contra `funds_v3` sin escribir.
4. **Preview/diff** — tabla con antes/después/delta/estado por fila.
5. **Write gate controlado** — solo filas OK, WARNING con aprobación explícita.
6. **Rollback manifest** — snapshot pre-write para reversión.
7. **Auditoría completa** — trazabilidad de usuario, timestamp, ISINs afectados.

**Colección real:** `funds_v3`
**Campo objetivo:** `manual.costs.retrocession`
**Este bloque NO modifica código, NO escribe Firestore, NO despliega.**

---

## B. Estado Actual del Administrador

### Frontend

| Componente | Archivo | Estado |
|---|---|---|
| AdminPage | `frontend/src/pages/AdminPage.tsx` | ✅ Operativo, header + layout |
| AdminGuard | `frontend/src/components/admin/AdminGuard.tsx` | ✅ UX-only guard por email |
| AdminLayout | `frontend/src/components/admin/AdminLayout.tsx` | ✅ Sidebar + 8 módulos |
| RetrocessionPanel | `frontend/src/components/admin/RetrocessionPanel.tsx` | ✅ Read-only estático |
| useAdminAuth | `frontend/src/hooks/useAdminAuth.ts` | ✅ Hook con ADMIN_EMAILS |
| adminConsoleService | `frontend/src/services/adminConsoleService.ts` | ✅ Read-only callable |

### Backend

| Componente | Archivo | Estado |
|---|---|---|
| admin_auth | `functions_python/services/admin_auth.py` | ✅ `extract_and_verify_admin_callable/http` |
| endpoints_admin_console | `functions_python/api/endpoints_admin_console.py` | ✅ `admin_health`, `admin_fund_search` — **aquí vivirán los nuevos `admin_retro_*`** |
| endpoints_admin | `functions_python/api/endpoints_admin.py` | ⚠️ Endpoints legacy con email hardcoded — **fuera del flujo de retrocesiones; no reutilizar** |

> **C.10 — Endpoints legacy fuera del flujo.** Los nuevos endpoints `admin_retro_dry_run` y `admin_retro_write` viven exclusivamente en `endpoints_admin_console.py`. `endpoints_admin.py` queda fuera del flujo de retrocesiones y no se reutiliza. Los scripts legacy de write (`import_retrocesiones.js`, `update_retrocessions_funds_v3.js`) están DEPRECATED y no se invocan ni se importan desde el nuevo módulo.

### Seguridad actual — 3 capas

| Capa | Implementación | Estado |
|---|---|---|
| Frontend Guard | `useAdminAuth` → `ADMIN_EMAILS = ['oantiza@gmail.com']` | ✅ UX-only |
| Backend Auth | `admin_auth.py` → `ADMIN_EMAILS frozenset` + token verify | ✅ Autoritativo |
| Firestore Rules | `isAdmin()` → `request.auth.token.email == "oantiza@gmail.com"` | ✅ Defence in depth |

### Scripts existentes de retrocesiones

| Script | Estado | Notas |
|---|---|---|
| `bdb_retrocession_reload_dry_run.js` | ✅ ACTIVO | Dry-run read-only, canon correcto |
| `import_retrocesiones.js` | ⛔ DEPRECATED | Divide por 100, viola canon |
| `update_retrocessions_funds_v3.js` | ⛔ DEPRECATED | Heurística >1.5, viola canon |

### Último write gate

- **write_gate_2** (2026-05-09): 44 fondos actualizados, 3 excluidos, 0 fallos, 44/44 PASS.
- Artifacts en `artifacts/bdb_data_audit/retrocession_write_gate_2/`.

---

## C. Canon de Retrocesiones

```
manual.costs.retrocession = porcentaje directo en puntos porcentuales

1.38  → 1,38%
0.80  → 0,80%
0.0155 → 0,0155%
0     → 0%
```

**Reglas absolutas:**
- NO multiplicar por 100.
- NO dividir por 100.
- NO aplicar heurísticas por tamaño del valor.
- El valor se guarda TAL CUAL como porcentaje directo.

---

## D. Regla Explícita: Retrocesión = 0 es Válida

> **REGLA CRÍTICA:** Si una retrocesión aparece como `0`, `0%`, `0,00%` o `0.00%` en CSV/Excel, debe interpretarse como **retrocesión real igual a cero**.

- NO tratar `0` como error.
- NO tratar `0` como dato vacío.
- NO omitir fondos con retrocesión `0`.
- Guardar `manual.costs.retrocession = 0`.

**Solo bloquear:** retro vacía (`""`/`null`/`undefined`), no numérica, o negativa.

---

## E. Formatos CSV/XLSX Soportados

### CSV (C.8 — reglas explícitas)

- **Separador obligatorio:** `;`. Archivos cuyo separador único sea `,` se rechazan con BLOCKED de archivo: `ERR_CSV_SEPARATOR` ("Separador no soportado; usar `;`"). No se aplica auto-detección heurística de separador.
- **Encoding — orden estricto de intento:**
  1. UTF-8 con BOM (`﻿` al inicio → consumir BOM y procesar como UTF-8).
  2. UTF-8 sin BOM (intento normal).
  3. Latin-1 (fallback final si UTF-8 lanza `UnicodeDecodeError`).
  Documentar en el manifest qué encoding se resolvió finalmente.
- **Comillas dobles:** RFC 4180 mínimo. Campos entre `"..."` admiten `;` y saltos de línea internos; `""` dentro representa una comilla literal.
- **Líneas vacías:** se ignoran silenciosamente (no cuentan como filas, no son BLOCKED).
- **Líneas con todas las columnas vacías:** se ignoran como vacías.
- **Fin de línea:** se acepta `\n`, `\r\n` y `\r`.
- **Columnas:** `nombre;isin;retro` (orden no estricto, detección por header).

```csv
nombre;isin;retro
AB AMERICAN GROWTH A ACC EUR;LU0232524495;0,80%
FONDO SIN RETRO;ES0137381036;0,00%
```

### Excel (XLSX)

- **Hoja por defecto:** primera hoja del workbook.
- **Multi-hoja (C.15):** si la primera hoja tiene 0 filas de datos válidas (header + 0 rows o todas las filas BLOCKED por estructura) y existe al menos otra hoja con ≥1 fila de datos, el parser emite `WARN_SHEET_SELECTION` ("La hoja 1 está vacía pero existen otras hojas con datos: [..]") y BLOQUEA la carga hasta que el admin seleccione la hoja correcta de forma explícita. No se procesa silenciosamente una hoja vacía cuando hay otras con datos.
- **Columnas:** `nombre | isin | retro` (detección por header, mismo mapeo que CSV).
- **Formato retro en celda — ver sección H.** Se distingue valor interno vs. formato de celda; la decisión depende exclusivamente del number format reportado por la librería de parsing, nunca del tamaño del valor.

### Detección de columnas

El parser debe normalizar headers (lowercase, sin tildes, sin espacios) y mapear:

| Header normalizado | Campo |
|---|---|
| `nombre`, `name`, `fund_name` | nombre |
| `isin` | isin |
| `retro`, `retrocesion`, `retrocession`, `retrocession_percent`, `retro_percent` | retro |

---

## F. Diseño de Carga Manual

### Flujo

```
1. Admin navega a Retrocesiones > Carga Manual
2. Introduce ISIN en campo de búsqueda
3. Sistema busca en funds_v3 vía admin_fund_search
4. Muestra: nombre, ISIN, retro actual
5. Admin introduce nueva retro (input numérico)
6. Campos opcionales: fuente, notas
7. Validación inline (>=0, numérica, formato)
8. Muestra diff: actual → nuevo, delta
9. NO escribe — genera preview para futuro write gate
```

### Campos del formulario

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| ISIN | text (readonly tras búsqueda) | Sí | Formato `[A-Z]{2}[A-Z0-9]{9}[0-9]` |
| Nombre fondo | text (readonly) | Auto | Desde funds_v3 |
| Retro actual | number (readonly) | Auto | Desde `manual.costs.retrocession` |
| Retro nueva | number input | Sí | `>= 0`, numérica, `0` válido |
| Fuente | text | No | Texto libre |
| Notas | textarea | No | Texto libre |

### Validaciones inline

- Si `retro_nueva < 0` → error inline.
- Si `retro_nueva > 5` → warning "Valor alto, ¿confirmar?" (no bloqueo).
- Si `retro_nueva == retro_actual` → info "Sin cambios".
- Si `|retro_nueva - retro_actual| >= 0.50` → warning "Cambio grande".

---

## G. Diseño de Carga Masiva

### Flujo

```
1. Admin navega a Retrocesiones > Carga Masiva
2. Selecciona archivo CSV o XLSX (drag & drop o file picker)
3. Frontend parsea archivo localmente:
   a. Detecta formato (CSV/XLSX)
   b. Detecta columnas (nombre/isin/retro)
   c. Normaliza retro según canon
   d. Valida cada fila
4. Envía datos parseados al backend (admin_retro_dry_run)
5. Backend cruza contra funds_v3
6. Retorna preview completo con clasificación
7. Frontend muestra tabla diff
8. NO escribe en esta fase
```

### Parsing en frontend vs backend (C.2 — backend autoritativo)

| Paso | Dónde | Razón |
|---|---|---|
| Leer archivo | Frontend | Evita subir archivo al servidor |
| Detectar columnas | Frontend | Feedback inmediato |
| Normalizar retro (preview) | Frontend (informativo) | Solo para mostrar preview local rápido |
| **Normalizar retro (autoritativo)** | **Backend** | Re-ejecuta `normalizeRetrocession(retro_raw, cell_format?)` sobre los datos crudos enviados; ignora cualquier `retro_parsed` recibido del frontend para la decisión final |
| Cruzar con funds_v3 | Backend | Requiere acceso a Firestore |
| **Dedup por ISIN (C.5)** | **Backend obligatorio** | Backend re-detecta duplicados con mismo valor (WARNING) y duplicados contradictorios (BLOCKED) independientemente de lo que reporte el frontend |
| Clasificar filas | Backend | Autoritativo |

> **C.2 — Regla autoritativa.** El backend es la única fuente de verdad para la normalización canon. Recibe `retro_raw` (string original tal como aparece en el archivo) y, para celdas Excel, los metadatos `cell_internal_value` y `cell_number_format`. El campo `retro_parsed` enviado por el frontend es puramente diagnóstico: el backend lo registra para auditoría pero NO lo usa para decidir el valor final. Esto cierra la vía de manipulación de payload desde el cliente.

> **C.5 — Dedup obligatoria server-side.** El backend procesa la lista completa de filas tras normalizar y aplica:
> 1. Agrupar por ISIN normalizado.
> 2. Si grupo tiene >1 fila con el mismo `new_retro` (tras normalización) → marcar todas las copias adicionales como `WARNING` con motivo `DUP_SAME_VALUE`.
> 3. Si grupo tiene >1 fila con `new_retro` distintos (post-normalización, con tolerancia `< 1e-6`) → marcar TODAS las filas del grupo como `BLOCKED` con motivo `DUP_CONFLICT`.
> Esta lógica se ejecuta en backend aunque el frontend ya la haya aplicado.

---

## H. Parsing y Normalización

### Función `normalizeRetrocession(raw, cell_format?)` (C.1, C.2)

Reutiliza la lógica probada de `retrocessionPercentPoints()` del script existente. Firma extendida:

- `raw`: string original tal cual aparece en el archivo, o número crudo para celdas Excel numéricas.
- `cell_format` (opcional, solo para origen XLSX): metadata del number format de la celda (string), por ejemplo `"0.00%"`, `"0%"`, `"General"`, `"#,##0.00"`.

Retorno: `{ value: number, status: 'OK' | 'WARNING' | 'MISSING' | 'INVALID', reason?: string }`.

**Tabla de comportamiento (CSV o texto sin `cell_format`):**

```
Input              → Output   → Razón
"1,41%"            → 1.41     → Decimal español, quitar %
"1.41"             → 1.41     → Decimal estándar
"0,80%"            → 0.80     → Decimal español, quitar %
"0.80"             → 0.80     → Decimal estándar
"0,0155%"          → 0.0155   → Valor pequeño, NO escalar
"0.0155"           → 0.0155   → Valor pequeño, NO escalar
"0"                → 0        → Retro = 0 VÁLIDA
"0,00%"            → 0        → Retro = 0 VÁLIDA
"0.00%"            → 0        → Retro = 0 VÁLIDA
""                 → MISSING  → Bloquear
null               → MISSING  → Bloquear
"abc"              → INVALID  → Bloquear
"-0.5"             → INVALID  → Negativo, bloquear
"7.5"              → 7.5 + WARNING → Valor alto pero posible
```

### Excel: lectura de metadata de celda (C.1 — sin heurística por tamaño)

> **REGLA CANON ESTRICTA.** La decisión de multiplicar o no por 100 depende EXCLUSIVAMENTE de si el `cell_number_format` de la celda contiene `%`. NUNCA se decide por el tamaño del valor interno. El umbral histórico `< 0.20` queda eliminado.

Algoritmo formal:

```
def excel_to_percent_points(cell_internal_value: float, cell_number_format: str) -> float:
    if cell_number_format and "%" in cell_number_format:
        return cell_internal_value * 100   # Excel guarda fracción, mostramos puntos porcentuales
    else:
        return cell_internal_value         # Excel guarda el número tal cual; sin escalar
```

**Ejemplos obligatorios (tests):**

| Cell internal value | Cell number format | Resultado | Justificación |
|---|---|---|---|
| `0.008` | `"0.00%"` | `0.80` | Fracción `0.008` × 100 = 0.80 pp; display Excel `0,80%` |
| `0` | `"0.00%"` | `0` | Cero porcentaje válido |
| `0.50` | `"0.00%"` | `50` | Fracción `0.50` × 100 = 50 pp; display Excel `50,00%`. Sin umbral por tamaño |
| `0.80` | `"General"` | `0.80` | Sin formato `%`, valor literal en pp |
| `0.80` | `""` o `null` | `0.80` | Sin formato `%`, valor literal en pp |
| `1.38` | `"0.00"` | `1.38` | Sin formato `%`, valor literal en pp |
| `5` | `"0.00%"` | `500` | Coherente con display Excel `500,00%`; el backend marcará WARNING/BLOCKED por valor inverosímil, pero la conversión es fiel |

> Esta regla es lectura de metadata de Excel, NO una heurística sobre el valor. Es la única operación de multiplicación por 100 admitida en todo el flujo, y solo aplica cuando el origen es XLSX y la celda tiene number format con `%`. Nunca para CSV. Nunca para valores ya entregados como string-con-`%` (esos los maneja `normalizeRetrocession` quitando el sufijo).

### Precisión numérica y tolerancias (C.11)

- **Almacenamiento Firestore:** `manual.costs.retrocession` se persiste con redondeo a 4 decimales (`round(value, 4)`).
- **Comparación "sin cambio":** `|new_retro - current_retro| < 1e-6` → estado `UNCHANGED`.
- **Post-write verification:** read-back tras update; coincidencia con tolerancia `< 1e-6` → PASS; en otro caso FAIL (ver sección O).
- **Cambio grande (WARNING):** `|delta| >= 0.50` (puntos porcentuales absolutos) **O** `|delta| / max(|current_retro|, 1e-6) >= 0.50` (relativo ≥ 50%). El caso `current_retro == 0` y `new_retro > 0` se trata explícitamente como cambio grande WARNING.

### Librerías de parsing recomendadas (C.9)

| Origen | Capa | Librería recomendada | Notas |
|---|---|---|---|
| CSV | Frontend | PapaParse (si ya está en el repo) | Soporte `delimiter: ";"`, `header: true`, encoding UTF-8/BOM nativo |
| XLSX | Frontend | SheetJS (`xlsx`) | Acceder a `cell.w` (display) y `cell.v` (raw) + `cell.z` (number format) para implementar la regla C.1 |
| CSV/XLSX | Backend | El backend NO re-parsea el archivo binario. Recibe filas estructuradas en JSON con `retro_raw`, `cell_internal_value`, `cell_number_format` y re-normaliza con la misma función canónica `normalizeRetrocession` reimplementada en Python | Mantiene paridad cliente/servidor sin duplicar lectura de archivo |

> Si la librería final difiere de PapaParse/SheetJS por restricciones del repo, la elección se confirma en `BDB-ADMIN-RETROCESSIONS-DRYRUN-0` como invariante de implementación. Lo que NO es negociable: cualquier librería elegida debe exponer el number format de celda Excel para que la regla C.1 sea aplicable.

---

## I. Validaciones

### Por fila

| Validación | Resultado si falla |
|---|---|
| ISIN presente | BLOCKED |
| ISIN formato válido (`[A-Z]{2}[A-Z0-9]{9}[0-9]`) | BLOCKED |
| Fondo encontrado en `funds_v3` (C.4) | **BLOCKED** (sin opción de degradar a REVIEW en esta fase) |
| Retro presente (no vacía/null) | BLOCKED |
| Retro numérica | BLOCKED |
| Retro >= 0 | BLOCKED |
| Retro = 0 | ✅ OK |
| Retro > 5 | WARNING (no bloqueo) |
| Duplicado ISIN con mismo valor (post-normalización backend, tol `<1e-6`) | WARNING `DUP_SAME_VALUE` |
| Duplicado ISIN con valor diferente (post-normalización backend, tol `<1e-6`) | BLOCKED `DUP_CONFLICT` |
| Cambio grande (`|delta| >= 0.50` o `relativo >= 50%`) | WARNING |
| Nombre CSV ≠ nombre Firestore pero ISIN sí | WARNING |

> **C.4 — Fondo no encontrado.** No existe opción configurable de degradar BLOCKED a REVIEW en este bloque. Cualquier ISIN no presente en `funds_v3` queda como BLOCKED con motivo `FUND_NOT_FOUND`. Reabrir la decisión en un bloque posterior si surge la necesidad.

> **C.5 — Dedup autoritativa en backend.** Las dos filas de duplicados son ejecutadas siempre por el backend tras la normalización, sin confianza en el resultado del frontend. El frontend puede previsualizar duplicados pero el veredicto vinculante es el del backend.

### Metadatos conservados por fila

- Número de línea en archivo fuente.
- Nombre del archivo fuente.
- Valor raw original (antes de normalización) — campo `retro_raw`.
- Para origen XLSX: `cell_internal_value` y `cell_number_format` (necesarios para que el backend re-aplique la regla C.1).
- `retro_parsed_client` (solo diagnóstico, no se usa para decisión).

---

## J. Estados OK / WARNING / BLOCKED

### OK

- ISIN válido y encontrado en `funds_v3`.
- Retro válida, numérica, `>= 0`.
- **Incluye retro = 0.**
- Sin duplicados conflictivos.
- Delta dentro de tolerancia.

### WARNING

- Duplicado ISIN con mismo valor → "Duplicado redundante".
- Cambio grande → "Delta ≥ 0.50pp" o "Cambio relativo ≥ 50%".
- Retro > 5 → "Valor alto, verificar".
- Nombre no coincide exactamente → "Nombre difiere, ISIN coincide".

### BLOCKED

- ISIN vacío o formato inválido.
- Retro vacía, null, no numérica.
- Retro negativa.
- Fondo no encontrado en `funds_v3` — **BLOCKED inequívoco** (sin opción REVIEW, C.4).
- Duplicado ISIN con valores contradictorios (`DUP_CONFLICT`).
- CSV con separador no soportado (archivo completo BLOCKED, `ERR_CSV_SEPARATOR`).
- XLSX con primera hoja vacía y existencia de hojas alternativas con datos (BLOCKED de carga, `WARN_SHEET_SELECTION`, C.15).

---

## K. Preview / Diff

### Tabla de preview

| Columna | Descripción |
|---|---|
| # | Número de línea en archivo |
| Archivo | Nombre del CSV/XLSX |
| ISIN | ISIN del fondo |
| Nombre Firestore | Nombre del fondo en `funds_v3` |
| Retro actual | `manual.costs.retrocession` actual |
| Retro nueva | Valor normalizado del archivo |
| Δ (delta) | `retro_nueva - retro_actual` |
| Estado | OK / WARNING / BLOCKED |
| Motivo | Texto explicativo |
| Acción | UPDATE / NO_CHANGE / SKIP / REVIEW |

### Filtros en la tabla

- Filtrar por estado: OK, WARNING, BLOCKED, todos.
- Ordenar por cualquier columna.
- Contador de totales por estado.
- Exportar preview como CSV.

### Resumen visual (cards)

| Card | Contenido |
|---|---|
| Total filas | Número total de filas procesadas |
| OK | Filas listas para escribir |
| WARNING | Filas que requieren aprobación |
| BLOCKED | Filas que no se pueden escribir |
| Sin cambios | Filas con valor idéntico |

---

## L. Seguridad Admin

### Modelo de seguridad en 3 capas (obligatorio)

```
┌──────────────────────────────────┐
│ CAPA 1: Frontend Guard           │
│ - useAdminAuth oculta módulo     │
│ - AdminGuard envuelve página     │
│ ⚠️ UX-ONLY, bypassable          │
├──────────────────────────────────┤
│ CAPA 2: Backend Auth             │
│ - extract_and_verify_admin_*     │
│ - Token verify + email allowlist │
│ - Endpoints separados dry/write  │
│ ✅ AUTORITATIVO                  │
├──────────────────────────────────┤
│ CAPA 3: Firestore Rules          │
│ - isAdmin() en funds_v3 write    │
│ - admin_audit_log: write = false │
│ - Deny by default                │
│ ✅ DEFENCE IN DEPTH              │
└──────────────────────────────────┘
```

### Invariantes

1. **NO frontend-only security** — backend SIEMPRE valida.
2. **NO writes sin dry-run** — dry-run obligatorio antes de write.
3. **NO writes sin snapshot** — rollback manifest creado ANTES.
4. **NO writes directos desde frontend** — siempre vía Cloud Function.
5. **Trazabilidad** — cada acción registra email admin + timestamp.
6. **NO `set()` destructivo** — solo `update()` en campo específico.
7. **NO confiar solo en `useAdminAuth`** — backend re-verifica.
8. **NO confiar en datos parseados por frontend** — backend re-normaliza desde `retro_raw` (C.2).
9. **Endpoint dry-run estrictamente read-only** — sin `set/update/delete/batch.commit`.

### Audit log (C.13)

**Colección futura:** `admin_audit_log/{auto_id}`.

**Estructura de entrada:**

```json
{
  "timestamp": "2026-05-13T10:00:00Z",
  "admin_email": "oantiza@gmail.com",
  "action": "admin_retro_write" | "admin_retro_dry_run",
  "manifest_id": "retro_dry_run_2026_05_13_uuid",
  "isin": "LU0232524495",
  "previous": 0.75,
  "new": 0.80,
  "result": "PASS" | "FAIL" | "SKIPPED",
  "reason": "OK" | "DUP_CONFLICT" | "POST_WRITE_MISMATCH" | ...,
  "row_number": 2,
  "source_filename": "retrocesiones_2026_05.csv"
}
```

**Reglas de escritura:**
- Escrito únicamente por backend con Firebase Admin SDK; jamás desde el cliente.
- Firestore Rules `admin_audit_log`: `read: isAdmin()`, `write: false` (defence in depth contra escritura cliente).
- **No se modifica `firestore.rules` en este bloque** (ni en `DRYRUN-0`); la adaptación de rules para `admin_audit_log` y `admin_write_manifests` se realiza en `BDB-ADMIN-RETROCESSIONS-WRITE-GATE-0`.
- Entrada por fila procesada (no por batch) para granularidad de auditoría.
- Entradas correlacionadas por `manifest_id` para reconstrucción completa del evento de write.

---

## M. Contrato Backend Futuro

### Endpoints nuevos propuestos (C.10)

| Endpoint | Tipo | Ubicación | Acción | Fase |
|---|---|---|---|---|
| `admin_retro_dry_run` | Callable | `functions_python/api/endpoints_admin_console.py` | Dry-run: recibe datos RAW, re-normaliza, cruza con `funds_v3`, retorna clasificación | DRYRUN-0 |
| `admin_retro_write` | Callable | `functions_python/api/endpoints_admin_console.py` | Write gate: escribe filas aprobadas con manifest + rollback + audit | WRITE-GATE |

Los endpoints legacy (`endpoints_admin.py`) NO se reutilizan ni se modifican en este flujo.

### `admin_retro_dry_run` (C.2 — payload RAW, backend autoritativo)

```python
# Input
{
  "rows": [
    {
      "isin": "LU0232524495",
      "nombre": "AB AMERICAN GROWTH A ACC EUR",
      "retro_raw": "0,80%",
      "retro_parsed_client": 0.80,     # solo diagnóstico, backend lo ignora para decisión
      "source": "csv",                  # "csv" | "xlsx"
      "cell_internal_value": null,      # solo si source == "xlsx"
      "cell_number_format": null,       # solo si source == "xlsx"
      "row_number": 2
    },
    {
      "isin": "ES0137381036",
      "nombre": "FONDO SIN RETRO",
      "retro_raw": "0,00%",
      "retro_parsed_client": 0,
      "source": "xlsx",
      "cell_internal_value": 0,
      "cell_number_format": "0.00%",
      "row_number": 3
    }
  ],
  "source_filename": "retrocesiones_2026_05.csv",
  "source_encoding": "utf-8-bom"       # informa el encoding resuelto en frontend
}

# Output
{
  "mode": "DRY_RUN_READ_ONLY",
  "results": [
    {
      "isin": "LU0232524495",
      "firestore_name": "AB American Growth A Acc EUR",
      "current_retro": 0.75,
      "new_retro": 0.80,                # valor canónico backend (re-normalizado)
      "new_retro_client_reported": 0.80, # diagnóstico
      "delta": 0.05,
      "status": "OK",
      "reason": "",
      "action": "UPDATE_DRY_RUN",
      "row_number": 2,
      "source_filename": "retrocesiones_2026_05.csv"
    }
  ],
  "summary": {
    "total": 290,
    "ok": 240,
    "warning": 8,
    "blocked": 2,
    "unchanged": 40,
    "client_server_normalization_mismatches": 0   # >0 indica que el frontend está desincronizado con el canon
  },
  "manifest_id": "retro_dry_run_2026_05_13_uuid",
  "manifest_created_at": "2026-05-13T10:00:00Z",
  "manifest_ttl_seconds": 86400,        # C.7 — 24h
  "manifest_expires_at": "2026-05-14T10:00:00Z",
  "confirmation_phrase_expected": "BDB-RETRO-WRITE-{manifest_id_short}-{approved_count}"
}
```

Notas vinculantes:
- El backend re-ejecuta `normalizeRetrocession(retro_raw, cell_number_format)` sobre cada fila y compara con `retro_parsed_client`; si difieren más allá de la tolerancia `< 1e-6`, registra mismatch (no aborta, pero suma al contador `client_server_normalization_mismatches` y obliga a revisar la implementación frontend).
- El backend nunca toma `retro_parsed_client` como autoridad.

### `admin_retro_write` (C.3 confirmación parametrizada, C.6 protocolo rollback, C.7 TTL, C.12 idempotencia, C.14 verificación)

```python
# Input
{
  "manifest_id": "retro_dry_run_2026_05_13_uuid",
  "approved_isins": ["LU0232524495", ...],
  "confirmation_phrase": "BDB-RETRO-WRITE-2026_05_13_uuid_short-44",
  "admin_notes": "Carga mensual mayo 2026",
  "idempotency_key": "retro_write_2026_05_13_attempt_1_uuid"  # C.12
}

# Output
{
  "mode": "WRITE_EXECUTED",
  "writes_executed": 44,
  "writes_failed": 0,
  "writes_skipped_idempotent": 0,        # C.12 — reintentos con misma idempotency_key
  "writes_aborted_stale_current": 0,     # C.7 — current_retro cambió respecto al manifest
  "rollback_manifest_id": "rollback_2026_05_13_uuid",
  "post_write_verification": "44/44 PASS",
  "audit_log_entries": 44                # C.13
}
```

### Frase de confirmación (C.3)

- **Formato vinculante:** `BDB-RETRO-WRITE-{manifest_id_short}-{approved_count}`
  - `manifest_id_short` = primeros 12 caracteres del `manifest_id` del dry-run.
  - `approved_count` = número de ISINs en `approved_isins`.
- Generada server-side al cierre del dry-run y devuelta en `confirmation_phrase_expected`.
- El admin debe copiar/teclear exactamente esa cadena en el frontend.
- El backend valida la igualdad exacta antes de avanzar al protocolo de write. Si no coincide → rechazo sin tocar Firestore.
- Sin frases hardcoded por batch (la frase histórica `RETROCESSION_PERCENT_POINTS_44_FONDOS` queda fuera de uso a partir de este bloque).

### TTL del manifest (C.7)

- **TTL por defecto:** 86400 s (24 h) desde `manifest_created_at`.
- Si en el momento del write `now > manifest_expires_at` → backend rechaza con `ERR_MANIFEST_EXPIRED` y exige un nuevo dry-run.
- **Re-lectura justo antes del write:** para cada ISIN aprobado el backend lee `funds_v3/{doc}.manual.costs.retrocession` justo antes del update y compara con `current_retro` registrado en el manifest. Si difiere con tolerancia `< 1e-6` → marcar fila como `writes_aborted_stale_current`, NO escribir esa fila, registrar audit log con `result="SKIPPED"` y `reason="STALE_CURRENT"`. Las demás filas continúan.

### Idempotencia (C.12)

- **Clave lógica:** `(manifest_id, isin)`. Backend persiste registro por ISIN escrito con esta clave.
- **Idempotency token de petición:** `idempotency_key` opcional en input; si el backend recibe la misma `idempotency_key` dos veces, devuelve el resultado cacheado sin ejecutar nuevos writes ni nuevas entradas de audit log.
- Reintentos cliente nunca producen doble-write ni doble entrada de auditoría para el mismo `(manifest_id, isin)`.

---

## N. Contrato Frontend Futuro

### Componentes a crear/modificar

| Componente | Acción | Descripción |
|---|---|---|
| `RetrocessionManager.tsx` | NUEVO | Reemplaza `RetrocessionPanel.tsx` con tabs manual/masiva |
| `RetroManualTab.tsx` | NUEVO | Formulario de carga manual |
| `RetroBulkTab.tsx` | NUEVO | Upload CSV/XLSX + preview |
| `RetroPreviewTable.tsx` | NUEVO | Tabla diff con filtros |
| `RetroSummaryCards.tsx` | NUEVO | Cards de resumen por estado |
| `adminRetroService.ts` | NUEVO | Service layer para dry-run/write callables |
| `retroParser.ts` | NUEVO | Parser CSV/XLSX en frontend |
| `AdminLayout.tsx` | MODIFICAR | Render `RetrocessionManager` en vez de `RetrocessionPanel` |

### Types a crear (alineados con C.2)

```typescript
interface RetroRow {
  isin: string;
  nombre: string;
  retro_raw: string;                // original tal cual; autoridad para backend
  retro_parsed_client: number | null; // solo diagnóstico
  source: 'csv' | 'xlsx';
  cell_internal_value: number | null; // solo xlsx
  cell_number_format: string | null;  // solo xlsx
  row_number: number;
  source_filename: string;
}

interface RetroDryRunResult {
  isin: string;
  firestore_name: string;
  current_retro: number | null;
  new_retro: number | null;          // canónico backend
  new_retro_client_reported: number | null; // diagnóstico
  delta: number | null;
  status: 'OK' | 'WARNING' | 'BLOCKED' | 'UNCHANGED';
  reason: string;
  action: 'UPDATE_DRY_RUN' | 'NO_CHANGE' | 'SKIP';
  row_number: number;
  source_filename: string;
}

interface RetroDryRunResponse {
  mode: 'DRY_RUN_READ_ONLY';
  results: RetroDryRunResult[];
  summary: {
    total: number;
    ok: number;
    warning: number;
    blocked: number;
    unchanged: number;
    client_server_normalization_mismatches: number;
  };
  manifest_id: string;
  manifest_created_at: string;
  manifest_ttl_seconds: number;
  manifest_expires_at: string;
  confirmation_phrase_expected: string;
}

type RetroApprovalState = Map<string, 'approved' | 'excluded' | 'pending'>;
```

---

## O. Gate de Escritura Futuro

### Protocolo de write gate (C.6, C.7, C.12, C.14)

```
1. Dry-run completado y manifest persistido en admin_write_manifests/{manifest_id}
   con campos: status="DRY_RUN_COMPLETE", created_at, expires_at, eligible_isins[],
   per_isin_snapshot{current_retro, new_retro}.

2. Admin revisa preview/diff en UI.

3. Admin aprueba ISINs individuales:
   - OK → auto-aprobado (cliente puede aprobar el bloque OK con 1 clic, pero backend
     requiere lista explícita aprobada).
   - WARNING → requiere click explícito por ISIN.
   - BLOCKED → no seleccionable.

4. Admin recibe del backend la frase esperada
   `BDB-RETRO-WRITE-{manifest_id_short}-{approved_count}` y la teclea.

5. Frontend envía: { manifest_id, approved_isins[], confirmation_phrase,
                     idempotency_key, admin_notes }.

6. Backend valida (en este orden, abortando al primer fallo SIN tocar Firestore):
   a. Token + email admin ✓                                    (auth)
   b. manifest_id existe y status == "DRY_RUN_COMPLETE" ✓
   c. now <= manifest.expires_at ✓                              (C.7 — TTL)
   d. confirmation_phrase == expected_for(manifest, approved) ✓ (C.3)
   e. approved_isins ⊆ manifest.eligible_isins ✓
   f. idempotency_key no procesado previamente con éxito ✓     (C.12)
       — si ya procesado: devolver resultado cacheado.

7. Protocolo rollback manifest (C.6) — orden estricto y obligatorio:
   7.1 Backend genera rollback_manifest con entries pre-write
       (snapshot de current_retro por ISIN, re-leído justo antes; ver paso 8).
   7.2 Backend escribe rollback_manifest en admin_write_manifests/{rollback_id}
       con status="ROLLBACK_READY".
   7.3 Backend VERIFICA la lectura/durabilidad del rollback (read-back inmediato
       del documento recién escrito).
   7.4 Si la verificación falla → ABORTAR. Ningún write a funds_v3. Estado final
       audit_log: result="FAIL", reason="ROLLBACK_MANIFEST_NOT_DURABLE".
   7.5 Solo si 7.3 OK, marcar rollback_manifest.status="ROLLBACK_CONFIRMED" y
       proceder al paso 8.

8. Backend ejecuta writes por ISIN aprobado:
   8.1 Re-leer funds_v3/{doc}.manual.costs.retrocession (C.7 — anti-stale).
   8.2 Si difiere de manifest.per_isin_snapshot[isin].current_retro con
       tolerancia >= 1e-6 → SKIP esta fila, audit result="SKIPPED",
       reason="STALE_CURRENT". Incrementar writes_aborted_stale_current.
   8.3 Ejecutar update() sobre el documento — SOLO el campo
       manual.costs.retrocession, redondeado a 4 decimales (C.11).
       Nunca set() destructivo.
   8.4 Incluir manifest_id e isin en metadata del write para idempotencia (C.12).

9. Verificación post-write por fila (C.14):
   9.1 Read-back de funds_v3/{doc}.manual.costs.retrocession.
   9.2 Comparar contra new_retro_canon esperado.
   9.3 |readback - expected| < 1e-6 → result="PASS"; en otro caso
       result="FAIL", reason="POST_WRITE_MISMATCH" (no se intenta corregir
       automáticamente; queda para rollback manual).

10. Auditoría (C.13):
    10.1 Una entrada en admin_audit_log por ISIN procesado
         (PASS, FAIL o SKIPPED), nunca agrupada.
    10.2 Correlacionada por manifest_id.

11. Backend marca manifest.status="WRITE_COMPLETE" o "WRITE_PARTIAL_FAIL"
    según el resultado agregado, y retorna respuesta al frontend.
```

### Reglas del write

| Regla | Detalle |
|---|---|
| Método | `update()` — nunca `set()` destructivo |
| Campo | Solo `manual.costs.retrocession` |
| Precisión | Redondeo a 4 decimales antes de persistir (C.11) |
| Preservar | Todo `manual.*` excepto retrocession |
| Filas OK | Escribir solo si están en `approved_isins` |
| Filas WARNING | Solo con aprobación explícita por ISIN |
| Filas BLOCKED | Nunca escribir |
| Stale guard | Re-leer current_retro antes del update; SKIP si difiere (C.7) |
| Snapshot | Rollback manifest creado, verificado y confirmado ANTES del primer write (C.6) |
| Verificación | Read-back por fila, tolerancia `< 1e-6` (C.14) |
| Idempotencia | `(manifest_id, isin)` + `idempotency_key` de petición (C.12) |
| Audit | Entrada granular por ISIN (PASS/FAIL/SKIPPED) (C.13) |

---

## P. Rollback Manifest

### Estructura (C.6 — incluye estado de durabilidad y TTL referenciado)

```json
{
  "manifest_id": "rollback_2026_05_13_uuid",
  "created_at": "2026-05-13T10:00:00Z",
  "expires_at": "2026-05-14T10:00:00Z",
  "created_by": "oantiza@gmail.com",
  "write_manifest_id": "retro_dry_run_2026_05_13_uuid",
  "status": "ROLLBACK_READY | ROLLBACK_CONFIRMED | ROLLBACK_EXECUTED",
  "entries": [
    {
      "isin": "LU0232524495",
      "previous_retrocession": 0.75,
      "written_retrocession": 0.80,
      "write_executed": true,
      "post_write_verification": "PASS",
      "rollback_command": "update manual.costs.retrocession to 0.75"
    }
  ],
  "total_entries": 44,
  "rollback_executed": false
}
```

### Estados (C.6)

| Estado | Significado |
|---|---|
| `ROLLBACK_READY` | Documento escrito; pendiente de read-back de verificación |
| `ROLLBACK_CONFIRMED` | Read-back OK; los writes a `funds_v3` pueden proceder |
| `ROLLBACK_EXECUTED` | Rollback ejecutado a posteriori (reversión completa o parcial) |

**Invariante:** ningún write a `funds_v3.manual.costs.retrocession` ocurre antes de que `status == "ROLLBACK_CONFIRMED"`.

### Almacenamiento

- Colección: `admin_write_manifests/{manifestId}` (propuesta en `BDB_ADMIN_CONSOLE_DESIGN_0`).
- Backup local: `artifacts/bdb_data_audit/retrocession_write_gate_N/rollback_manifest.json`.
- TTL alineado con el dry-run manifest (24 h, C.7); tras expirar, el rollback sigue siendo válido para reversión histórica pero no autoriza nuevos writes.

---

## Q. Tests Necesarios

### Frontend

| Test | Descripción |
|---|---|
| `retroParser.normalizeRetrocession` | Canon: "1,41%" → 1.41, "0,00%" → 0, "" → MISSING |
| `retroParser.zero_is_valid` | Retro = 0 NO es error |
| `retroParser.detectColumns` | nombre/isin/retro en variantes |
| `retroParser.xlsx_format_only` (C.1) | `(0.008, "0.00%")` → 0.80; `(0.50, "0.00%")` → 50; `(0.80, "General")` → 0.80; `(0, "0.00%")` → 0 |
| `retroParser.xlsx_no_size_heuristic` (C.1) | El parser nunca decide multiplicar por valor; solo por `cell_number_format` |
| `retroPreview.filters` | Filtros OK/WARNING/BLOCKED |
| `retroManual.validation` | Inline validation del formulario |
| `retroBulk.csvParsing.semicolon` | CSV con `;` |
| `retroBulk.csvParsing.commaRejected` (C.8) | CSV con solo `,` → BLOCKED archivo `ERR_CSV_SEPARATOR` |
| `retroBulk.csvParsing.encodingOrder` (C.8) | UTF-8 BOM → UTF-8 → latin1 en ese orden |
| `retroBulk.csvParsing.emptyLines` (C.8) | Líneas vacías ignoradas, no BLOCKED |
| `retroBulk.xlsxParsing` | Parsing XLSX con formato porcentaje |
| `retroBulk.xlsxMultiSheet` (C.15) | Hoja 1 vacía + hoja 2 con datos → BLOCKED + `WARN_SHEET_SELECTION` |
| `retroSecurity.noDirectWrites` | grep en source `setDoc|updateDoc|deleteDoc|writeBatch` = 0 ocurrencias en módulo retro |

### Backend

| Test | Descripción |
|---|---|
| `admin_retro_dry_run.auth` | Rechaza sin auth / non-admin |
| `admin_retro_dry_run.read_only` | No modifica Firestore (sin set/update/delete/batch) |
| `admin_retro_dry_run.classification` | OK/WARNING/BLOCKED correctos |
| `admin_retro_dry_run.zero_valid` | Retro = 0 clasificada como OK |
| `admin_retro_dry_run.renormalizes_from_raw` (C.2) | Si el cliente envía `retro_parsed_client` divergente del canon, el resultado del backend ignora ese valor |
| `admin_retro_dry_run.fund_not_found_blocked` (C.4) | ISIN no presente en `funds_v3` → BLOCKED, sin REVIEW |
| `admin_retro_dry_run.server_side_dedup_same` (C.5) | Duplicados con mismo valor → WARNING en backend aunque el FE no los marque |
| `admin_retro_dry_run.server_side_dedup_conflict` (C.5) | Duplicados con valor distinto → BLOCKED en backend |
| `admin_retro_dry_run.manifest_persisted_with_ttl` (C.7) | Manifest persistido con `expires_at` y `confirmation_phrase_expected` |
| `admin_retro_write.requires_manifest` | Rechaza sin manifest válido |
| `admin_retro_write.confirmation_phrase_parametric` (C.3) | Frase hardcoded vieja → rechazada; frase parametrizada correcta → aceptada |
| `admin_retro_write.expired_manifest_rejected` (C.7) | `now > expires_at` → `ERR_MANIFEST_EXPIRED` |
| `admin_retro_write.stale_current_skips` (C.7) | `funds_v3.current_retro` cambió respecto al manifest → fila SKIPPED, no write |
| `admin_retro_write.rollback_created_first` (C.6) | Crea y confirma rollback ANTES de cualquier write a funds_v3 |
| `admin_retro_write.rollback_durability_check` (C.6) | Si el read-back del rollback manifest falla → abort sin writes |
| `admin_retro_write.update_only` | Solo update(), nunca set() |
| `admin_retro_write.precision_4_decimals` (C.11) | Valor persistido redondeado a 4 decimales |
| `admin_retro_write.post_write_verification` (C.14) | Read-back compara con tolerancia `< 1e-6`; FAIL si discrepa |
| `admin_retro_write.idempotency` (C.12) | Mismo `idempotency_key` dos veces → 0 nuevos writes, 0 nuevas entradas de audit |
| `admin_retro_write.idempotency_isin` (C.12) | Mismo `(manifest_id, isin)` ya escrito → no se reescribe |
| `admin_retro_write.audit_log` (C.13) | Una entrada por ISIN procesado, con `result` y `reason` |
| `admin_retro_write.audit_log_admin_sdk_only` (C.13) | Audit log no escribible desde cliente (rule check) — verificable cuando se modifiquen rules en WRITE-GATE-0 |

---

## R. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Write accidental | Baja | Alto | Triple gate: manifest + confirm parametrizada (C.3) + backend verify |
| Escala errónea (÷100 o ×100) | Baja | Alto | Canon estricto + tests + **sin heurística por tamaño** (C.1) |
| Retro = 0 tratada como error | Baja | Alto | Regla explícita sección D + tests dedicados |
| Excel celda porcentaje mal interpretada | Baja | Medio | Decisión por `cell_number_format` exclusivamente (C.1); paridad CSV↔XLSX |
| Cliente desincronizado del canon | Baja | Medio | Backend re-normaliza desde `retro_raw` (C.2); contador `client_server_normalization_mismatches` |
| Escalada privilegios | Baja | Alto | 3 capas auth (FE+BE+Rules) |
| Duplicados no detectados | Baja | Medio | Dedup en backend obligatoria (C.5) |
| Fondo no encontrado se cuela | Baja | Alto | BLOCKED inequívoco, sin opción REVIEW (C.4) |
| set() destructivo borra manual.* | Baja | Alto | Código usa solo update() + tests |
| Snapshot corruption | Muy baja | Alto | Read-back de rollback manifest antes de cualquier write (C.6) |
| Manifest obsoleto (drift en funds_v3) | Baja | Alto | TTL 24h + re-lectura de current_retro antes de cada update (C.7) |
| Doble-write por reintento | Baja | Medio | Idempotencia `(manifest_id, isin)` + `idempotency_key` (C.12) |
| Write incorrecto no detectado | Baja | Alto | Read-back post-write con tolerancia `<1e-6` (C.14) |
| Reuso accidental de endpoints legacy | Baja | Medio | Nuevos endpoints en `endpoints_admin_console.py`; legacy fuera del flujo (C.10) |
| Carga silenciosa de hoja Excel vacía | Baja | Medio | BLOCKED si hoja 1 vacía y existen otras con datos (C.15) |
| CSV separador `,` aceptado erróneamente | Baja | Medio | Rechazo `ERR_CSV_SEPARATOR`; separador `;` único soportado (C.8) |
| Encoding mal detectado | Baja | Bajo | Orden UTF-8 BOM → UTF-8 → latin1 documentado (C.8) |

---

## S. Fases Recomendadas

### Fase 1: Diseño ← **ACTUAL (este bloque)**
- Documento de diseño completo.
- Auditoría read-only del estado actual.
- NO código, NO writes, NO deploy.

### Fase 2: Dry-Run UI + Backend (`BDB-ADMIN-RETROCESSIONS-DRYRUN-0`)
- Frontend: `RetrocessionManager` con tabs, parser CSV/XLSX, preview table.
- Backend: endpoint `admin_retro_dry_run` (read-only).
- Tests: parsing, normalización, clasificación.
- Deploy: hosting + functions.

### Fase 3: Write Gate (`BDB-ADMIN-RETROCESSIONS-WRITE-GATE-0`)
- Backend: endpoint `admin_retro_write` con manifest + snapshot + audit.
- Frontend: flujo de aprobación por ISIN + confirmación.
- Firestore rules: admin_write_manifests, admin_audit_log.
- Tests: write gate protocol completo.
- Deploy: hosting + functions + rules.

### Fase 4: Deploy Controlado (`BDB-ADMIN-RETROCESSIONS-DEPLOY-0`)
- Deploy staging → verificación → producción.
- Primera carga real supervisada.
- Post-deploy QA.

---

## T. Prompt Recomendado: BDB-ADMIN-RETROCESSIONS-DRYRUN-0 (C.16)

```
AGENTE: Claude en Antigravity IDE

TAREA: BDB-ADMIN-RETROCESSIONS-DRYRUN-0

OBJETIVO:
Implementar el dry-run de retrocesiones en Admin Console, respetando
los invariantes C.1–C.15 del documento de diseño.

SCOPE:

1. Frontend:
   - Crear RetrocessionManager.tsx con tabs Manual/Masiva.
   - Tab Manual: búsqueda por ISIN vía admin_fund_search, form de nueva retro,
     diff inline.
   - Tab Masiva: upload CSV/XLSX, parser local, preview table.
   - Parser canónico: normalizeRetrocession(raw, cell_format?) con canon estricto,
     0 = válido, sin heurística por tamaño (C.1).
   - Envío al backend: retro_raw + (si XLSX) cell_internal_value + cell_number_format.
     retro_parsed_client SOLO como diagnóstico (C.2).
   - Preview table: columnas según diseño, filtros por estado.
   - NO escrituras directas Firestore (grep setDoc|updateDoc|deleteDoc|writeBatch
     = 0 ocurrencias en módulo retro).

2. Backend:
   - Crear endpoint admin_retro_dry_run en endpoints_admin_console.py (C.10).
   - Re-normaliza desde retro_raw con la misma función canónica (C.2).
   - Server-side dedup obligatoria, mismo valor → WARNING,
     valor distinto → BLOCKED (C.5).
   - Fondo no encontrado en funds_v3 → BLOCKED inequívoco (C.4).
   - Persiste manifest con TTL 24h y devuelve confirmation_phrase_expected
     parametrizada (C.3, C.7).
   - Read-only: NO writes a funds_v3 ni colaterales.
   - Auth: extract_and_verify_admin_callable obligatorio.
   - NO escribe en admin_audit_log durante el dry-run (esa colección se usa
     en WRITE-GATE-0).

3. Librerías recomendadas (C.9):
   - Frontend CSV: PapaParse.
   - Frontend XLSX: SheetJS, exponiendo cell.v + cell.z para C.1.
   - Backend: NO re-parsea archivos; consume JSON estructurado y re-normaliza
     en Python con paridad de comportamiento.

4. Tests obligatorios:

   Parser frontend:
   - normalizeRetrocession exhaustivo: "1,38%"→1.38, "0,80%"→0.80,
     "0,0155%"→0.0155, "0"→0, "0,00%"→0, ""→MISSING, "abc"→INVALID,
     "-0.5"→INVALID.
   - Excel: (0.008, "0.00%")→0.80; (0, "0.00%")→0;
     (0.50, "0.00%")→50; (0.80, "General")→0.80;
     (0, vacía con formato %)→0; celda vacía → MISSING.
   - Sin heurística por tamaño (C.1): la decisión SOLO depende de
     cell_number_format.
   - CSV: separador `,` único → BLOCKED ERR_CSV_SEPARATOR (C.8);
     orden encoding UTF-8 BOM → UTF-8 → latin1 (C.8);
     líneas vacías ignoradas; comillas dobles RFC 4180.
   - XLSX multi-hoja: hoja 1 vacía + hoja 2 con datos → BLOCKED
     WARN_SHEET_SELECTION (C.15).

   Backend:
   - Auth: rechaza sin token / token no admin.
   - Read-only: 0 writes a funds_v3 durante dry-run.
   - Re-normaliza desde retro_raw e ignora retro_parsed_client divergente (C.2).
   - Dedup server-side: mismo valor → WARNING; distinto valor → BLOCKED (C.5).
   - Fondo no encontrado → BLOCKED, no REVIEW (C.4).
   - Manifest persistido con expires_at y confirmation_phrase_expected (C.3, C.7).

   Source security:
   - grep "setDoc|updateDoc|deleteDoc|writeBatch" en source frontend del módulo
     retro = 0 ocurrencias.
   - Grep no permitido: imports directos de firestore client write methods.

CANON:
manual.costs.retrocession = porcentaje directo en puntos porcentuales.
0 = retro válida.
NO dividir/multiplicar por 100 (excepto regla C.1 sobre XLSX con formato %,
que NO es una heurística sino lectura de metadata).
Precisión 4 decimales en almacenamiento; tolerancia comparación <1e-6 (C.11).

NO TOCAR:
- BDB-FONDOS-CORE.
- optimizer_core.py, suitability_engine.py.
- firestore.rules (la adaptación a admin_audit_log/admin_write_manifests
  va en WRITE-GATE-0, NO en DRYRUN-0).
- Scripts históricos (import_retrocesiones.js, update_retrocessions_funds_v3.js).
- endpoints_admin.py legacy.
- Credenciales.

DISEÑO BASE:
docs/BDB_ADMIN_RETROCESSIONS_DESIGN_0.md (incl. patch C.1–C.15).

POLÍTICA DE COMMITS:
- 0 commits durante implementación incremental.
- Un único commit al cierre, solo tras revisión humana y autorización explícita.
- NO push automático.
- NO deploy automático.
```

---

## Validación Final del Bloque

| Métrica | Resultado |
|---|---|
| Archivos creados | `docs/BDB_ADMIN_RETROCESSIONS_DESIGN_0.md` (en bloque DESIGN-0) |
| Archivos modificados en PATCH-0 | Solo `docs/BDB_ADMIN_RETROCESSIONS_DESIGN_0.md` |
| Código productivo modificado | **NO** |
| Frontend modificado | **NO** |
| Backend modificado | **NO** |
| Tests modificados | **NO** |
| Firestore writes | **0** |
| Deploy | **NO** |
| Commit | **0** (pendiente revisión humana) |
| Push | **NO** |
| BDB-FONDOS-CORE tocado | **NO** |
| Cambios C.1–C.15 incorporados | **SÍ** (ver secciones B, E, G, H, I, J, L, M, N, O, P, Q, R, T) |
| Riesgos detectados | Ver sección R (actualizada) |
| Siguiente bloque | `BDB-ADMIN-RETROCESSIONS-DRYRUN-0` |

### Mapa de incorporación C.1–C.15

| Cambio | Localización |
|---|---|
| C.1 Excel sin heurística por tamaño | Sección H — `excel_to_percent_points` |
| C.2 Backend re-normaliza | Secciones G, H, M, N |
| C.3 Confirmation phrase parametrizada | Sección M (`BDB-RETRO-WRITE-{...}-{...}`) |
| C.4 Fondo no encontrado = BLOCKED | Secciones I, J |
| C.5 Dedup server-side | Secciones G, I |
| C.6 Protocolo rollback antes de writes | Secciones O (paso 7), P (estados) |
| C.7 TTL manifest 24h + anti-stale | Secciones M, O (paso 8.1–8.2), P |
| C.8 Reglas CSV explícitas | Sección E |
| C.9 Librerías de parsing | Sección H |
| C.10 Endpoints legacy fuera del flujo | Secciones B, M |
| C.11 Precisión 4 decimales + tolerancias | Sección H |
| C.12 Idempotencia write | Secciones M, O |
| C.13 Audit log | Sección L |
| C.14 Post-write verification | Sección O (paso 9) |
| C.15 Multi-hoja Excel | Sección E |
| C.16 Checklist DRYRUN-0 | Sección T |

### Estado: `BDB_ADMIN_RETROCESSIONS_DESIGN_0_PATCH_0_READY` ✅
