# BDB_OPT_FEASIBILITY_LOCKS_SEMANTIC_DECISION_0

## Resumen ejecutivo

Propuesta semántica documentada para cerrar las decisiones pendientes sobre
compatibilidad de locks con restricciones de factibilidad, antes de tocar
cualquier código de runtime.

Este documento NO implementa nada. Define el contrato futuro y las reglas
de negocio que deben validarse con el usuario.

**ESTADO: `BDB_OPT_FEASIBILITY_LOCKS_SEMANTIC_DECISION_0_READY_FOR_REVIEW`**

---

## Estado actual

| Campo | Valor |
|---|---|
| HEAD | `3871f58` |
| Commit | `OPTIMIZER_FEASIBILITY: add locks compatibility design tests` |
| Rama | `master` |
| Tests de diseño | 5 passed, 1 skipped, 3 xfailed |
| Runtime modificado | ❌ NO |

---

## Contexto: Cómo funcionan los locks hoy

### En el frontend (`usePortfolioActions.ts`)

1. El usuario marca fondos como `isLocked` (toggle de candado).
2. Los fondos con swap manual (`manualSwap`) también se tratan como bloqueados.
3. Se construye `fixed_weights`: mapa ISIN → peso (0..1).
4. Se envía `lock_mode`:
   - `keep_weight` (defecto en rebalanceo normal)
   - `keep_money` (cuando se añade capital nuevo)
5. NO existe UI para `min_keep` ni `free` actualmente.

### En el backend (`constraints_builder_v1.py`)

Modos reconocidos: `keep_weight`, `keep_money`, `min_keep`, `free`.
Si el modo no es válido, se normaliza a `keep_weight`.

### En el solver (`optimizer_core.py`, `_apply_standard_constraints`)

| lock_mode | Constraint inyectada | Efecto |
|---|---|---|
| `keep_weight` | `w[i] == fw` | Peso exacto. Inamovible. |
| `keep_money` | `w[i] == fw` | Peso exacto (ya convertido a fracción). |
| `min_keep` | `w[i] >= fw` | Peso mínimo. Solver puede subir. |
| `free` | (ninguna) | Peso libre. Solo se mantiene en universo. |
| (otro/default) | `w[i] >= 0.01` | Presencia mínima simbólica. |

### En feasibility_precheck (hoy)

Solo verifica `BLOCK_FIXED_WEIGHTS_EXCEED_100`:
- Si `lock_mode ∈ {keep_weight, keep_money, min_keep}` y `Σ fixed_weights > 1.0`.
- NO verifica compatibilidad con buckets ni equity_floor.

---

## Decisiones semánticas

### 1. lock_mode = "keep_weight"

**Pregunta:** ¿Debe tratarse como un hard lock absoluto que prevalece sobre el perfil?

**Propuesta:** SÍ, con validación previa.

| Aspecto | Propuesta | Justificación |
|---|---|---|
| ¿Hard lock absoluto? | SÍ | El usuario ha elegido explícitamente mantener ese peso. Es una decisión de inversión consciente. |
| ¿Debe bloquear si rompe equity_floor? | SÍ (BLOCK) | Si los locks en RF/cash hacen matemáticamente imposible cumplir equity_floor, el solver fallará de todas formas. Mejor detectarlo antes con mensaje claro. |
| ¿Debe bloquear si hace inviable el perfil? | SÍ (BLOCK) | Si lock 30% equity pero bucket equity.max=20%, hay contradicción matemática pura. |
| ¿Debe advertir si mantiene cartera incoherente? | SÍ (WARNING) | Si los locks son técnicamente viables pero dejan poco margen de optimización (ej. 80% ya bloqueado), advertir pero permitir. |
| ¿Prevalece sobre asset allocation? | SÍ | El lock es Nivel 1 de precedencia (documentado en optimizer_core.py). El perfil es Nivel 3. El lock gana. |

**Nota (A4):** `keep_weight` y `keep_money` producen constraints idénticas en el solver
(ambas `w[i] == fw`). La diferencia está **antes del solver**, en la conversión:
`keep_money` recalcula `fw` como `money / newTotalCapital` cuando se añade capital
(`usePortfolioActions.ts:131-133`). Una vez convertido a fracción, para el precheck
ambos modos pueden tratarse de forma equivalente.

### 2. lock_mode = "free"

**Pregunta:** ¿Debe excluirse completamente del cálculo de locks?

**Propuesta:** SÍ.

| Aspecto | Propuesta | Justificación |
|---|---|---|
| ¿Excluir del cálculo de locks? | SÍ | El fondo está en el universo pero sin constraint de peso. No consume presupuesto fijo. |
| ¿Permite venta/reducción total? | SÍ | El solver puede asignarle peso 0 si optimiza mejor. |
| ¿Ignorar en feasibility_precheck? | SÍ | No genera restricción, ergo no puede generar incompatibilidad. Mantener solo como miembro del universo. |
| ¿Mensaje UX? | OPCIONAL | Podría mostrarse "🔓 Posición liberada" pero no es urgente. |

### 3. lock_mode = "min_keep"

**Pregunta:** ¿min_keep cuenta contra el techo (max) del bucket o solo impone un piso?

**Propuesta:** Cuenta contra el techo de forma parcial.

| Aspecto | Propuesta | Justificación |
|---|---|---|
| ¿Peso mínimo obligado? | SÍ | `w[i] >= fw`. El solver no puede bajar de ese mínimo. |
| ¿Compatible con subida por solver? | SÍ | El solver puede asignar más peso si conviene al objetivo. |
| ¿Cuenta contra bucket max? | SÍ, como presupuesto consumido mínimo | Si `Σ min_keep en bond = 40%` y `bond.max = 30%`, es BLOCK porque el piso ya excede el techo. |
| ¿Cuenta contra equity_floor? | SÍ, como presupuesto no-equity consumido mínimo | Si `Σ min_keep en RF = 40%`, el presupuesto máximo para equity es ≤60%. Si equity_floor=75%, BLOCK. |
| ¿Diferente de keep_weight? | SÍ, pero solo por el margen de subida | Para el precheck, la diferencia es que min_keep garantiza un mínimo pero permite subida. Para bucket max, el mínimo ya puede ser incompatible. Para el equity_floor, lo relevante es el presupuesto mínimo consumido en non-equity. |

**Decisión pendiente resuelta:** `min_keep` consume presupuesto mínimo que cuenta tanto contra techos de bucket como contra equity_floor. El solver puede subir el peso, pero no bajar del mínimo.

### 4. Tolerancia numérica

**Propuesta de tolerancias unificadas:**

| Concepto | Tolerancia propuesta | Tolerancia actual | Justificación |
|---|---|---|---|
| Suma de pesos = 1.0 | ε = 1e-4 | 1e-4 (`_validate_optimizer_result`) | Mantener coherencia con post-solver. |
| Bucket min/max (precheck existente) | ε = 1e-4 | 1e-6 (`_check_bucket_mins_exceed_100`, `_check_bucket_maxs_below_100`) | Unificar a 1e-4 para evitar falsos positivos en precheck que no se reproducen en validate (que ya usa 1e-4). |
| equity_floor | ε = 5e-3 (0.5%) | 5e-3 (`_check_feasibility_and_autoexpand:740`) | Mantener el margen de 0.5% existente. Es una tolerancia de negocio razonable. |
| Fixed weights sum > 100% | ε = 1e-6 | 1e-6 (`_check_fixed_weights_exceed_100`) | Mantener **estricta**. La suma de locks es dato de entrada preciso controlado por el frontend. No relajar. |
| Lock vs bucket max (NUEVO) | ε = 1e-4 | (no existe) | Propuesta nueva. Misma tolerancia que bucket validation post-solver. |

**Nota (A3):** El precheck actual usa 1e-6 de forma consistente en tres checks
existentes (suma de mínimos, suma de máximos, fixed weights > 100%). La propuesta
de relajar a 1e-4 aplica **solo a los checks de compatibilidad lock vs bucket bounds**
(nuevos), no a la suma de fixed weights que debe seguir estricta. No sobregeneralizar.

**Distinción tolerancia técnica vs negocio:**

- **Técnica (1e-6):** Errores de punto flotante. Aplicar a sumas de datos de entrada (fixed_weights).
- **Negocio (1e-4 a 5e-3):** Márgenes aceptables de desviación en resultados y comparaciones de bounds. Aplicar a validación de buckets, lock vs bucket y equity_floor.

### 5. BLOCK vs WARNING

**Propuesta de clasificación:**

| Situación | Tipo | Justificación |
|---|---|---|
| Lock excede bucket max (lock 30% equity, max 20%) | **BLOCK** | Contradicción matemática pura. El solver SIEMPRE fallará. No tiene sentido intentar. |
| Locks en non-equity hacen imposible equity_floor | **BLOCK** | Contradicción matemática. Peor: el greedy check actual no lo detecta bien y cae a fallback silencioso. |
| Locks reducen margen de optimización (>60% bloqueado, <40% libre) | **WARNING** | Técnicamente viable pero la cartera resultante tendrá poca diversificación libre. El solver puede encontrar solución, pero degradada. |
| min_keep piso excede bucket max | **BLOCK** | Mismo razonamiento que keep_weight excediendo bucket max. |
| Locks viables pero cartera no alineada con perfil (locks RF en perfil agresivo, pero todavía cabe equity) | **WARNING** | Informar al usuario que los locks sesgan la cartera respecto al perfil esperado. No bloquear porque hay solución técnica. |
| equity_floor = 0 | **no check** | Sin restricción de equity → no hay incompatibilidad posible. |
| lock_mode = "free" | **no check** | Sin restricción de peso → no consume presupuesto. |

**Nota (A2):** Los buckets legacy incluyen **Mixto** (fondos multiactivo, con bandas
significativas como perfil 5: 20%-50%). Las reglas de compatibilidad lock vs bucket
deben aplicarse igual a Mixto y a cualquier bucket con límites definidos. No convertir
Mixto automáticamente en una restricción dura principal si la arquitectura futura
decide tratarlo como categoría comercial.

**Nota (A5):** Existe `_reconcile_bucket_vs_profile()` en `optimizer_core.py:531-585`
que relaja los bounds del perfil cuando `bucket_bounds_v1` contradice el perfil.
Los nuevos BLOCK checks de locks actuarían **antes** de esa reconciliación. Esto es
correcto: si los locks son matemáticamente incompatibles con los bounds, la
reconciliación no resuelve una suma fija imposible. Pero debe documentarse para
no duplicar ni contradecir esa lógica cuando se implemente.

**Comportamiento por tipo:**

| Tipo | ¿Continúa solver? | ¿Mensaje frontend? | ¿Campo en response? |
|---|---|---|---|
| BLOCK | ❌ NO | SÍ (error claro con causa) | `feasibility_precheck.blocks[]` |
| WARNING | ✅ SÍ | SÍ (advertencia no bloqueante) | `feasibility_precheck.warnings[]` |

### 6. equity_floor

**Pregunta:** ¿equity_floor debe ser siempre hard, o los locks pueden violarlo?

**Propuesta:** Hard por defecto, con detección temprana.

| Aspecto | Propuesta | Justificación |
|---|---|---|
| ¿Hard siempre? | SÍ por defecto | equity_floor representa la política de inversión prudencial del perfil de riesgo. |
| ¿Locks pueden violarlo? | NO directamente. BLOCK antes del solver. | Si el usuario bloquea 40% en RF y el perfil exige 75% equity, el precheck debe detectarlo y bloquear con mensaje claro. Hoy esto cae al solver como CVXPY infeasible sin explicación. |
| ¿Excepción por cartera heredada? | PROPUESTA: No en v1. En futuro, podría haber un flag `allow_legacy_override`. | Las carteras heredadas pueden tener distribuciones históricas que no coinciden con el perfil actual. Pero permitir excepciones silenciosas crea riesgo regulatorio. Mejor bloquearlo con mensaje y que el usuario ajuste los locks. |
| ¿Diferente por conservador/medio/agresivo? | NO | equity_floor ya varía por perfil (5% para P1, 75% para P8, 98% para P10). La regla de lock vs floor es la misma independientemente del valor numérico del floor. |
| ¿Informar al usuario? | SÍ, siempre | Si la cartera bloqueada no puede cumplir el equity_floor, el mensaje debe explicar exactamente qué locks lo impiden y cuánto equity es alcanzable. |

**Nota de implementación (A1):** Actualmente equity_floor se lee de
`constraints.get("equity_floor", 0.0)` en `optimizer_core.py:315`, inyectado desde
el flujo legacy de strategy constraints (`endpoints_portfolio.py → STRATEGY_CONSTRAINTS`).
`config.py:57-68` contiene seeds por `risk_level` (`EQUITY_FLOOR = {1: 0.05, ..., 10: 0.98}`),
pero el runtime **no** toma equity_floor directamente del perfil canónico en Firestore
para el precheck. El frontend tampoco envía equity_floor explícitamente.

Antes de implementar `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR`, debe confirmarse:
- ¿equity_floor seguirá siendo una constraint explícita del dict legacy?
- ¿O debe derivarse del perfil canónico en Firestore por risk_level?
- ¿Quién es responsable de inyectarlo: `endpoints_portfolio.py` o `constraints_builder_v1.py`?

**Nota sobre equity_floor como parámetro:**

Para implementar `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR`, `run_feasibility_precheck()` necesitará recibir `equity_floor` como parámetro adicional. Esto es un cambio de contrato API menor pero necesario:

```
# Actual:
run_feasibility_precheck(universe, max_weight, active_bounds, exposure_vectors, fixed_weights, lock_mode, _read_bound_fn)

# Propuesto:
run_feasibility_precheck(universe, max_weight, active_bounds, exposure_vectors, fixed_weights, lock_mode, _read_bound_fn, equity_floor=0.0)
```

### 7. Mensajes UX futuros propuestos

Todos los mensajes en español, orientados al usuario final (asesor financiero).

| Código | Mensaje propuesto |
|---|---|
| **BLOCK: locks incompatibles con bucket** | "Las posiciones bloqueadas ({locks_pct}% en {bucket_label}) superan el máximo permitido ({max_pct}%) para ese tipo de activo en el perfil {profile_id}. Desbloquee o reduzca las posiciones en {bucket_label} para poder optimizar." |
| **BLOCK: locks impiden equity_floor** | "Las posiciones bloqueadas en Renta Fija/Monetario ({rf_locked_pct}%) impiden alcanzar el mínimo de Renta Variable requerido ({equity_floor_pct}%). Máximo de RV alcanzable: {max_equity_pct}%. Desbloquee posiciones de RF o reduzca sus pesos para poder optimizar." |
| **WARNING: locks reducen margen** | "Tiene el {locked_pct}% del capital bloqueado. El optimizador solo puede actuar sobre el {free_pct}% restante, lo que puede limitar la diversificación." |
| **WARNING: locks sesgan perfil** | "Las posiciones bloqueadas dan más peso a {bucket_label} ({actual_pct}%) del que recomienda su perfil ({target_pct}%). La optimización respetará los bloqueos pero la cartera final puede diferir del perfil ideal." |
| **WARNING: min_keep consume mucho** | "Los pesos mínimos garantizados suman {total_min_pct}% del capital, dejando solo {free_pct}% para optimización libre." |
| **INFO: posición liberada** | "La posición {isin} está en modo libre: el optimizador puede modificar su peso según convenga." |
| **BLOCK: cartera no optimizable** | "La combinación de posiciones bloqueadas y restricciones del perfil {profile_id} no permite encontrar una distribución válida. Revise los bloqueos o considere cambiar de perfil." |

---

## Riesgos de ser demasiado rígidos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El usuario no puede optimizar porque todo se bloquea por locks legítimos heredados | Alto — frustración, abandono de la herramienta | Mensaje claro que explique qué desbloquear y por qué. No solo "Error". |
| Carteras heredadas con distribuciones históricas que no encajan en el perfil actual | Medio — el usuario puede tener una cartera construida hace años con otros criterios | Futuro: flag `allow_legacy_override` con warning explícito. No implementar en v1. |
| BLOCK excesivos con perfiles conservadores (1-3) que tienen equity_floor=0 | Bajo — equity_floor=0 no genera lock incompatibilidad | Solo asegurar que el check se saltea cuando equity_floor=0. |
| Tolerancias demasiado estrictas generan falsos BLOCKs | Medio — el usuario ve error cuando la cartera es marginalmente viable | Usar 1e-4 (no 1e-6) para comparaciones de bucket bounds. |

## Riesgos de ser demasiado laxos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Carteras no alineadas con perfil de riesgo pasan sin aviso | Alto — riesgo regulatorio y de asesoramiento | Siempre WARNING como mínimo. BLOCK para contradicciones matemáticas. |
| Solver falla con CVXPY infeasible sin explicación | Alto — hoy es el caso para GAP-H1 y GAP-H2. Mensaje genérico al usuario. | Exactamente lo que estos BLOCK codes resuelven. |
| Fallback silencioso produce cartera degradada (equal-weight) | Alto — cartera 1/N sin relación con el perfil | El precheck evitaría llegar al solver en casos imposibles. |
| El usuario cree que la cartera es óptima pero es un fallback | Alto — percepción de calidad | WARNING visible cuando el resultado es fallback. Ya existe parcialmente. |

---

## Recomendación profesional final

### Propuesta integral

1. **Implementar BLOCK para contradicciones matemáticas puras:**
   - `BLOCK_LOCKS_INCOMPATIBLE_BUCKET`: lock excede bucket max o lock en un bucket consume presupuesto que impide cumplir min de otro bucket.
   - `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR`: locks en non-equity consumen presupuesto que impide alcanzar equity_floor.

2. **Implementar WARNING para riesgos de calidad:**
   - `WARNING_LOCKS_HIGH_CONCENTRATION`: >60% del capital bloqueado.
   - `WARNING_LOCKS_PROFILE_SKEW`: locks sesgan la cartera respecto al perfil ideal.

3. **NO implementar excepciones de legacy** en esta fase. Si se necesitan, discutir como bloque separado.

4. **Unificar tolerancias** a 1e-4 para bucket bounds en precheck (actualmente 1e-6).

5. **Extender API** de `run_feasibility_precheck()` con `equity_floor` como parámetro opcional.

6. **Mensajes en español** claros, con datos numéricos concretos, que permitan al usuario entender qué desbloquear.

### Orden de implementación recomendado

```
Fase 1: BLOCK_LOCKS_INCOMPATIBLE_BUCKET
  → Cubre GAP-H1 (HIGH severity)
  → No requiere cambio de API
  → 3 tests xfail ya escritos que deberían pasar

Fase 2: BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR
  → Cubre GAP-H2 (HIGH severity)
  → Requiere añadir equity_floor como parámetro
  → 1 test xfail ya escrito + ajustar para nuevo parámetro

Fase 3: WARNING_LOCKS_HIGH_CONCENTRATION + WARNING_LOCKS_PROFILE_SKEW
  → Mejora de UX
  → No bloquea nada
  → Tests nuevos necesarios

Fase 4: Frontend — inspección de precheck.blocks[] y precheck.warnings[]
  → Actualmente el frontend solo mira result.status
  → Cubre GAP-L1 (LOW severity)
```

---

## Cambios futuros posibles (NO implementar ahora)

| Cambio | Motivo para postergar |
|---|---|
| Flag `allow_legacy_override` para carteras heredadas | Requiere discusión de negocio sobre responsabilidad regulatoria |
| Soft constraints en solver (penalización vs hard) | Cambio arquitectónico mayor. Requiere rediseño del motor. |
| Post-cutoff re-validation con re-inyección | Afecta la normalización post-solver. Riesgo de regresión. |
| Frontend: tooltips por fondo bloqueado explicando impacto | Requiere cálculos de precheck por fondo individual, no solo agregados. |
| lock_mode="free" con mensaje UX específico | Bajo impacto. Postergar a bloque UX general. |
| Distinción BLOCK vs WARNING configurable por administrador | Demasiada complejidad prematura. |

---

## Preguntas abiertas para el usuario

> **⚠️ Las siguientes preguntas NO están resueltas por este documento.**
> **Requieren decisión de negocio antes de implementar runtime.**

### P1: ¿Es aceptable que locks impidan optimizar?

Si un usuario bloquea fondos que contradicen su perfil, ¿debe el sistema:
- (a) **BLOQUEAR** y decirle que desbloquee → Propuesta actual
- (b) **IGNORAR** el perfil y optimizar solo el capital libre → Alternativa más permisiva
- (c) **PROPONER** un perfil ajustado automáticamente → Más complejo, futuro

### P2: ¿min_keep se usa o se descarta en el frontend?

Actualmente el frontend NO envía `min_keep`. Solo envía `keep_weight` o `keep_money`.
- (a) ¿Se implementa `min_keep` en el frontend en el futuro? → Si sí, los tests skip tienen valor
- (b) ¿Se descarta `min_keep` por ahora? → Si sí, eliminar el test skip y documentar como deprecated

### P3: ¿Qué porcentaje de capital bloqueado merece WARNING?

Propuesta: >60% → WARNING. ¿Es adecuado? ¿50%? ¿70%?

### P4: ¿equity_floor puede relajarse para perfiles medios (4-7)?

Los perfiles 4-7 tienen equity_floor moderado (30%-65%). ¿Debe ser estrictamente
hard o podría ser soft (con WARNING) para dar más flexibilidad a locks heredados?

### P5: ¿Qué fuente de bounds usa el precheck para validar locks?

Actualmente el runtime puede usar `_precheck_bounds` derivados de `bucket_bounds_v1`
(canónico) o de `risk_buckets` legacy (Firestore `system_settings/risk_profiles`).
El código en `optimizer_core.py:1111-1115` prioriza `bucket_bounds_v1` si existe,
si no usa el perfil legacy.

Antes de implementar BLOCK checks contra locks, debe decidirse:
- (a) ¿Usar los bounds que ya recibe el precheck (lógica actual)? → Más simple.
- (b) ¿Forzar siempre los bounds canónicos reconciliados? → Más robusto.
- (c) ¿Validar contra ambos y bloquear si cualquiera falla? → Más estricto.

---

## Qué NO se hizo

- ❌ NO runtime changes
- ❌ NO modificaciones a feasibility_precheck.py
- ❌ NO modificaciones a optimizer_core.py
- ❌ NO modificaciones a constraints_builder_v1.py
- ❌ NO modificaciones a endpoints_portfolio.py
- ❌ NO modificaciones a frontend
- ❌ NO cambios a restricciones
- ❌ NO cambios a solver / perfiles / buckets / locks / equity_floor
- ❌ NO deploy
- ❌ NO commit
- ❌ NO push
- ❌ NO Firestore writes
- ❌ NO CORE

---

## Decisión

**ESTADO: `BDB_OPT_FEASIBILITY_LOCKS_SEMANTIC_DECISION_0_READY_FOR_REVIEW`**

Fecha: 2026-05-10T00:00:00+02:00
