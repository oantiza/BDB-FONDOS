# BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0

## Resumen ejecutivo

Documento de cierre de decisiones del usuario sobre las preguntas abiertas
(P1–P5) del documento de decisiones semánticas de locks. Este documento
formaliza las reglas aprobadas para diseño futuro sin implementar nada en
runtime.

**Todas las decisiones aquí documentadas están aprobadas para diseño,
NO implementadas todavía.**

**ESTADO: `BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0_APPROVED_FOR_DESIGN`**

---

## Relación documental

| Documento | Estado | Relación |
|---|---|---|
| `BDB_OPT_FEASIBILITY_PRECHECK_AUDIT_0.md` | Cerrado (742e289) | Identificó GAP-H1 y GAP-H2 como gaps de alta severidad |
| `BDB_OPT_FEASIBILITY_LOCKS_DESIGN_0.md` | Cerrado (3871f58) | Definió tests de diseño xfail/skip para futuros BLOCK codes |
| `BDB_OPT_FEASIBILITY_LOCKS_SEMANTIC_DECISION_0.md` | Cerrado (d8da383) | Propuso semántica, tolerancias, BLOCK/WARNING y mensajes UX |
| **Este documento** | `APPROVED_FOR_DESIGN` | Cierra P1–P5. Autoriza implementación futura. |

---

## Tabla de decisiones P1–P5

### P1: ¿Es aceptable que locks impidan optimizar?

| Campo | Valor |
|---|---|
| **Pregunta** | Si un usuario bloquea fondos que contradicen su perfil, ¿debe el sistema bloquear, ignorar el perfil, o proponer ajuste automático? |
| **Decisión cerrada** | equity_floor es **HARD** en optimización estándar. Locks que lo violen generan **BLOCK**. |
| **Excepción futura** | Se contempla un **modo explícito de cartera heredada fuera de perfil**, con las siguientes condiciones: |
| | — NO debe optimizarse ni presentarse como cartera alineada con el perfil |
| | — Debe mostrar WARNING alto visible |
| | — Debe quedar trazado (log + response) |
| | — Debe explicar que los locks impiden una cartera coherente con el perfil |
| | — NO debe activarse de forma silenciosa |
| **Consecuencia para implementación** | Fase 1: implementar BLOCK hard. Fase futura: flag explícito `allow_legacy_override` con WARNING + trazabilidad. |
| **Estado** | `APPROVED_FOR_DESIGN` / `NOT_IMPLEMENTED` |

### P2: ¿keep_weight impide optimizar si rompe el perfil?

| Campo | Valor |
|---|---|
| **Pregunta** | ¿Debe keep_weight bloquear cuando hace inviable el perfil, equity_floor o bounds efectivos? |
| **Decisión cerrada** | SÍ. `keep_weight` = hard equality (`w[i] == fw`). Si rompe perfil, equity_floor o bounds efectivos → **BLOCK** con mensaje claro. |
| **Modo estándar** | Mensaje debe indicar que la posición bloqueada impide construir una cartera coherente con el perfil. |
| **Modo futuro heredado** | Podría permitirse continuar con WARNING alto y trazabilidad. NO debe llamarse cartera óptima alineada con perfil. |
| **Consecuencia para implementación** | `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` y `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` aplican a keep_weight y keep_money por igual. |
| **Estado** | `APPROVED_FOR_DESIGN` / `NOT_IMPLEMENTED` |

### P3: ¿min_keep cuenta contra bucket max y equity_floor?

| Campo | Valor |
|---|---|
| **Pregunta** | ¿min_keep debe contar como presupuesto consumido mínimo contra techos de bucket y equity_floor? |
| **Decisión cerrada** | SÍ. `min_keep` = peso mínimo obligatorio que cuenta contra: bucket max, equity_floor, peso total disponible, presupuesto real de optimización. |
| **Si hace matemáticamente imposible** | → **BLOCK** |
| **Si no rompe pero reduce margen/calidad** | → **WARNING** |
| **Consecuencia para implementación** | El test skip `test_case_e_lock_mode_min_keep_decision_pending` puede convertirse en xfail con semántica definida. min_keep se trata como keep_weight para el cálculo de presupuesto mínimo consumido. |
| **Estado** | `APPROVED_FOR_DESIGN` / `NOT_IMPLEMENTED` |

### P4: ¿free genera constraint?

| Campo | Valor |
|---|---|
| **Pregunta** | ¿lock_mode="free" debe excluirse completamente del cálculo de locks? |
| **Decisión cerrada** | SÍ. `free` = sin constraint. |
| **Debe** | — Quedar fuera del cálculo de locks |
| | — Permitir venta/reducción total |
| | — No generar igualdad ni mínimo en el solver |
| | — Aparecer en UX como "posición liberada" si procede |
| **Consecuencia para implementación** | Sin cambio en precheck (free ya se ignora). UX opcional en fase posterior. |
| **Estado** | `APPROVED_FOR_DESIGN` / `NOT_IMPLEMENTED` |

### P5: ¿Qué fuente de bounds usa el precheck?

| Campo | Valor |
|---|---|
| **Pregunta** | ¿Debe el precheck usar bounds legacy, bucket_bounds_v1 canónico, o una versión reconciliada? |
| **Decisión cerrada** | El precheck debe usar la **misma fuente efectiva** que luego usará el solver. No validar contra una política y resolver contra otra. |
| **Regla de prioridad** | 1. `bucket_bounds_v1` canónico si existe y está completo. 2. Si no existe, legacy `risk_buckets`. 3. Si hay reconciliación, documentar explícitamente si el precheck valida contra bounds pre o post-reconciliados. |
| **Preferencia profesional** | Precheck hard de locks contra bounds efectivos post-normalización, pero antes del solver. |
| **Nota sobre Mixto** | No introducir Mixto como nueva restricción dura sin auditoría específica. Solo aplicar locks contra Mixto si Mixto ya viene con bounds definidos en la política efectiva actual. |
| **Consecuencia para implementación** | El precheck ya recibe `_precheck_bounds` (derivados de v1 o legacy) en `optimizer_core.py:1111-1115`. Esta lógica de selección es correcta y se mantiene. |
| **Estado** | `APPROVED_FOR_DESIGN` / `NOT_IMPLEMENTED` |

---

## Política final aprobada

### Optimización estándar

| Aspecto | Regla |
|---|---|
| equity_floor | HARD. Si locks impiden cumplirlo → BLOCK. |
| Bucket bounds | HARD. Si locks exceden bucket max o impiden bucket min → BLOCK. |
| keep_weight / keep_money | Hard equality. Si incompatible → BLOCK con mensaje. |
| min_keep | Peso mínimo obligado. Si incompatible → BLOCK. Si reduce margen → WARNING. |
| free | Sin constraint. Fuera del cálculo de locks. |
| Resultado | Debe ser una cartera que se puede llamar "alineada con el perfil". |

### Modo futuro: cartera heredada fuera de perfil

| Aspecto | Regla |
|---|---|
| Activación | Flag explícito (futuro). NUNCA silencioso. |
| equity_floor | Puede relajarse con WARNING alto. |
| Bucket bounds | Puede relajarse con WARNING alto. |
| keep_weight | Puede continuar aunque sesge el perfil. |
| Resultado | NO debe llamarse "cartera óptima alineada con perfil". |
| Trazabilidad | Log + response deben reflejar que se operó en modo heredado. |
| Estado | **NO IMPLEMENTADO TODAVÍA.** Requiere bloque separado. |

---

## Matriz BLOCK vs WARNING aprobada

### BLOCK (impide solver, devuelve error claro)

| Situación | Código propuesto | Aprobado |
|---|---|---|
| Lock excede bucket max | `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` | ✅ |
| Lock en bucket impide cumplir min de otro bucket | `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` | ✅ |
| Locks en non-equity impiden equity_floor | `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` | ✅ |
| min_keep piso excede bucket max | `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` | ✅ |
| min_keep en non-equity impide equity_floor | `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` | ✅ |

### WARNING (permite solver, informa al usuario)

| Situación | Código propuesto | Aprobado |
|---|---|---|
| >60% capital bloqueado, <40% libre | `WARNING_LOCKS_HIGH_CONCENTRATION` | ✅ |
| Locks sesgan cartera vs perfil ideal | `WARNING_LOCKS_PROFILE_SKEW` | ✅ |
| min_keep reduce margen pero no rompe | `WARNING_LOCKS_HIGH_CONCENTRATION` | ✅ |

### NO CHECK

| Situación | Motivo |
|---|---|
| equity_floor = 0 | Sin restricción de equity |
| lock_mode = "free" | Sin constraint, no consume presupuesto |

---

## Reglas aprobadas por lock_mode

### keep_weight

| Regla | Estado |
|---|---|
| Constraint en solver: `w[i] == fw` | Ya implementado |
| Precheck: contar como presupuesto consumido exacto | Aprobado para diseño, NO implementado |
| Si incompatible con bucket → BLOCK | Aprobado para diseño, NO implementado |
| Si incompatible con equity_floor → BLOCK | Aprobado para diseño, NO implementado |
| Mensaje UX: explicar qué posición impide cartera coherente | Aprobado para diseño, NO implementado |

### keep_money

| Regla | Estado |
|---|---|
| Idéntico a keep_weight tras conversión a fracción | Ya implementado |
| Precheck: tratar igual que keep_weight | Aprobado para diseño, NO implementado |
| Mismos BLOCK/WARNING que keep_weight | Aprobado para diseño, NO implementado |

### min_keep

| Regla | Estado |
|---|---|
| Constraint en solver: `w[i] >= fw` | Ya implementado |
| Precheck: contar como presupuesto mínimo consumido | Aprobado para diseño, NO implementado |
| Si piso excede bucket max → BLOCK | Aprobado para diseño, NO implementado |
| Si piso impide equity_floor → BLOCK | Aprobado para diseño, NO implementado |
| Si reduce margen sin romper → WARNING | Aprobado para diseño, NO implementado |

### free

| Regla | Estado |
|---|---|
| Sin constraint en solver | Ya implementado |
| Excluir del cálculo de locks en precheck | Aprobado para diseño (ya es así implícitamente) |
| Permitir venta total | Ya implementado |
| UX: "posición liberada" | Aprobado para diseño, NO implementado |

---

## Regla aprobada para equity_floor

| Aspecto | Decisión |
|---|---|
| Tipo de restricción | HARD en optimización estándar |
| Fuente actual | `constraints.get("equity_floor", 0.0)` — flujo legacy |
| Seeds | `config.py:EQUITY_FLOOR` por risk_level (P1=5%, P8=75%, P10=98%) |
| Fuente recomendada futura | Derivar del perfil canónico en Firestore, inyectar en constraints_v1 |
| Locks pueden violarlo | NO en modo estándar. BLOCK antes del solver. |
| Excepción heredada | Solo en modo futuro explícito con WARNING alto. NO implementar ahora. |
| Diferente por perfil | NO. La regla es la misma para todo risk_level. El valor numérico ya varía. |
| Tolerancia | ε = 5e-3 (0.5%). Coherente con `_check_feasibility_and_autoexpand`. |
| Cambio de API necesario | `run_feasibility_precheck()` necesita recibir `equity_floor` como parámetro. |
| Estado | `APPROVED_FOR_DESIGN` / `NOT_IMPLEMENTED` |

---

## Regla aprobada para bounds efectivos

| Aspecto | Decisión |
|---|---|
| Principio | Precheck usa la misma fuente que el solver. No validar contra una política y resolver contra otra. |
| Prioridad | 1. `bucket_bounds_v1` si existe. 2. Legacy `risk_buckets`. |
| Reconciliación | Si `_reconcile_bucket_vs_profile()` modifica bounds, documentar si precheck valida pre o post. |
| Preferencia | Validar contra bounds post-normalización, pre-solver. |
| Tolerancia bucket | ε = 1e-4. Coherente con `_validate_optimizer_result`. |
| Estado | `APPROVED_FOR_DESIGN` / `NOT_IMPLEMENTED` |

---

## Nota sobre Mixto

Los perfiles legacy incluyen el bucket **Mixto** con bandas significativas
(ej. perfil 5: 20%–50%, perfil 8: 0%–10%).

**Decisión:**
- Las reglas de lock vs bucket aplican a Mixto **solo si Mixto ya tiene
  bounds definidos en la política efectiva actual**.
- NO introducir Mixto como nueva restricción dura sin auditoría específica.
- Si un lock cae en un activo clasificado como Mixto y Mixto tiene bounds
  en el perfil activo, los BLOCK/WARNING aplican igual que para cualquier
  otro bucket.
- Si Mixto no tiene bounds (o bounds abiertos 0%–100%), no genera
  incompatibilidad.

**Estado:** Decisión aprobada para diseño, NO implementada todavía.

---

## Mensajes UX autorizados como dirección futura

Los siguientes mensajes están **aprobados como dirección**, no implementados:

| Código | Mensaje autorizado | Tipo |
|---|---|---|
| `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` | "Las posiciones bloqueadas ({locks_pct}% en {bucket_label}) superan el máximo permitido ({max_pct}%) para su perfil {profile_id}. Desbloquee o reduzca posiciones en {bucket_label} para optimizar." | BLOCK |
| `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` | "Las posiciones bloqueadas en Renta Fija/Monetario ({rf_locked_pct}%) impiden alcanzar el mínimo de Renta Variable ({equity_floor_pct}%). Máximo de RV alcanzable: {max_equity_pct}%. Desbloquee posiciones de RF para optimizar." | BLOCK |
| `WARNING_LOCKS_HIGH_CONCENTRATION` | "Tiene el {locked_pct}% del capital bloqueado. El optimizador solo puede actuar sobre el {free_pct}% restante, lo que puede limitar la diversificación." | WARNING |
| `WARNING_LOCKS_PROFILE_SKEW` | "Las posiciones bloqueadas dan más peso a {bucket_label} ({actual_pct}%) del recomendado por su perfil ({target_pct}%). La cartera final puede diferir del perfil ideal." | WARNING |
| `BLOCK_CARTERA_NO_OPTIMIZABLE` | "La combinación de posiciones bloqueadas y restricciones del perfil {profile_id} no permite encontrar una distribución válida. Revise los bloqueos o considere cambiar de perfil." | BLOCK |

**Estado:** Mensajes aprobados como dirección futura, NO implementados todavía.

---

## Lista explícita de NO implementado todavía

| Elemento | Estado actual |
|---|---|
| `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` en feasibility_precheck.py | NO implementado |
| `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` en feasibility_precheck.py | NO implementado |
| `WARNING_LOCKS_HIGH_CONCENTRATION` en feasibility_precheck.py | NO implementado |
| `WARNING_LOCKS_PROFILE_SKEW` en feasibility_precheck.py | NO implementado |
| Parámetro `equity_floor` en `run_feasibility_precheck()` | NO implementado |
| Flag `allow_legacy_override` | NO implementado |
| Mensajes UX en frontend | NO implementado |
| Inspección de `precheck.blocks[]` en frontend | NO implementado |
| Inspección de `precheck.warnings[]` en frontend | NO implementado |
| UX "posición liberada" para free | NO implementado |
| Conversión del test skip de min_keep a xfail | NO implementado |
| Auditoría específica de Mixto como restricción dura | NO realizada |

---

## Próximo bloque recomendado

### BDB-OPT-FEASIBILITY-LOCKS-EXPECTED-BEHAVIOR-TESTS-0

**Objetivo:** Actualizar los tests de diseño existentes para reflejar las
decisiones P1–P5 cerradas en este documento.

**Alcance:**
1. Convertir el test skip de min_keep a xfail con semántica definida.
2. Añadir tests de WARNING (nueva clase TestLocksWarnings).
3. Verificar que los tests de compatible (PASSED) siguen pasando.
4. Verificar que los tests de incompatible (XFAIL) siguen siendo xfail.
5. No tocar runtime.

**Dependencias:**
- Este documento aprobado y commiteado.
- Tests de diseño existentes (`test_feasibility_precheck_locks_compatibility.py`).

**Bloques posteriores (NO hacer ahora):**
- `BDB-OPT-FEASIBILITY-LOCKS-RUNTIME-IMPL-0`: implementar checks en precheck.
- `BDB-OPT-FEASIBILITY-LOCKS-FRONTEND-INSPECT-0`: frontend lee blocks/warnings.

---

## Qué NO se hizo

- ❌ NO runtime changes
- ❌ NO modificaciones a feasibility_precheck.py
- ❌ NO modificaciones a optimizer_core.py
- ❌ NO modificaciones a constraints_builder_v1.py
- ❌ NO modificaciones a endpoints_portfolio.py
- ❌ NO modificaciones a config.py
- ❌ NO modificaciones a frontend
- ❌ NO modificaciones a tests
- ❌ NO deploy
- ❌ NO commit (pendiente de aprobación)
- ❌ NO push
- ❌ NO Firestore writes
- ❌ NO CORE

---

## Firmas de decisión

| Decisión | Aprobado por | Fecha | Estado |
|---|---|---|---|
| P1 — equity_floor hard + excepción heredada futura | Usuario | 2026-05-10 | APPROVED_FOR_DESIGN |
| P2 — keep_weight hard equality con BLOCK | Usuario | 2026-05-10 | APPROVED_FOR_DESIGN |
| P3 — min_keep como presupuesto mínimo real | Usuario | 2026-05-10 | APPROVED_FOR_DESIGN |
| P4 — free sin constraint | Usuario | 2026-05-10 | APPROVED_FOR_DESIGN |
| P5 — bounds efectivos = misma fuente que solver | Usuario | 2026-05-10 | APPROVED_FOR_DESIGN |

**ESTADO FINAL: `BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0_APPROVED_FOR_DESIGN`**

Fecha: 2026-05-10T00:25:00+02:00
