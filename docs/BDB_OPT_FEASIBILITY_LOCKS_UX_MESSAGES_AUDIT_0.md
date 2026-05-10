# BDB_OPT_FEASIBILITY_LOCKS_UX_MESSAGES_AUDIT_0

## Auditoría UX: Mensajes de Locks Feasibility Precheck

**Estado: `AUDIT_ONLY` | `NO_FRONTEND_CHANGES` | `NO_DEPLOY`**

---

## 1. Resumen ejecutivo

Se auditó cómo el frontend actual (`usePortfolioActions.ts`) maneja los nuevos códigos
BLOCK y WARNING del feasibility precheck de locks. El análisis concluye que **el deploy
del backend es seguro sin cambios UX previos**, con matices documentados.

---

## 2. Estado Git

| Campo | Valor |
|---|---|
| HEAD al auditar | `27eb825` |
| HEAD = origin/master | ✅ |
| Working tree | Limpio al iniciar |

---

## 3. Flujo backend → frontend

### 3.1. Cuando precheck bloquea (is_feasible=False)

```
optimizer_core.py L1133–1147
                    ↓
{
  "status": "infeasible",
  "message": first_block["message"],     ← español claro
  "feasibility_precheck": { blocks, warnings, info },
  "weights": {},
  "metrics": {},
  "explainability": {
    "precheck_blocked": true,
    "blocking_codes": ["BLOCK_LOCKS_INCOMPATIBLE_BUCKET"]
  }
}
```

### 3.2. Cómo procesa el frontend `status: "infeasible"`

```
usePortfolioActions.ts L675–714

1. isOptimizerResultApplicable(result) → false
   (APPLICABLE_OPTIMIZER_STATUSES = {optimal_compliant, optimal_with_warnings, fallback_compliant})

2. result.status === 'fallback_non_compliant' → false
   → No entra en L637

3. result.status === 'infeasible' → true
   → Entra en L675
```

### 3.3. Qué muestra el dialog

| Elemento | Contenido actual | Fuente |
|---|---|---|
| **title** | `"Universo insuficiente para optimizar"` | Hardcoded L680 |
| **message** (body) | `result.message` del backend | Backend → BLOCK message en español |
| **confirmLabel** | `"Añadir fondos y reintentar"` | Hardcoded L682 |
| **cancelLabel** | `"Cancelar"` | Hardcoded L683 |
| **onConfirm** | Retry con `recovery_candidates` | Hardcoded L684–708 |

---

## 4. Evaluación por código BLOCK/WARNING

### 4.1. BLOCK_LOCKS_INCOMPATIBLE_BUCKET

**Mensaje backend**: *"Las posiciones bloqueadas exceden el límite del {bucket}%:
{locked}% bloqueado vs máximo permitido {max}%."*

| Aspecto | Evaluación |
|---|---|
| **Mensaje body** | ✅ **Claro y accionable** — el usuario entiende qué bucket se excede |
| **Título del dialog** | ⚠️ *"Universo insuficiente"* — no refleja que es un problema de locks |
| **Botón retry** | ⚠️ *"Añadir fondos y reintentar"* — añadir fondos no resuelve locks en bucket max |
| **recovery_candidates** | ℹ️ El backend NO envía `recovery_candidates` en precheck block → retry envía el mismo payload → **vuelve a bloquear con el mismo mensaje** |
| **Daño funcional** | ❌ Ninguno — el retry es inofensivo (loop bloqueante, el usuario puede cancelar) |

### 4.2. BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR

**Mensaje backend**: *"Las posiciones bloqueadas limitan la renta variable alcanzable
al {max}%, pero el perfil requiere al menos {floor}%."*

| Aspecto | Evaluación |
|---|---|
| **Mensaje body** | ✅ **Claro y accionable** — el usuario entiende RV insuficiente por locks |
| **Título del dialog** | ⚠️ Genérico |
| **Botón retry** | ⚠️ Inadecuado (mismo caso que BLOCK bucket) |
| **Relación con `infeasible_equity_floor`** | ℹ️ El precheck bloquea **antes** del solver, así que `infeasible_equity_floor` (L716–748) nunca se alcanza si el precheck ya bloqueó |
| **Daño funcional** | ❌ Ninguno |

### 4.3. WARNING_LOCKS_HIGH_CONCENTRATION

**Mensaje backend**: *"Las posiciones bloqueadas concentran el {pct}% del capital,
lo que limita la capacidad de diversificación del optimizador."*

| Aspecto | Evaluación |
|---|---|
| **Visibilidad** | ❌ **Invisible** — WARNING no impide `is_feasible=True`, el solver ejecuta, y `result.status` será `optimal_*` o `fallback_*`. El frontend no inspecciona `feasibility_precheck.warnings` |
| **Dato disponible en response** | ✅ `result.feasibility_precheck.warnings` contiene el WARNING |
| **Impacto de invisibilidad** | BAJO — el warning es informativo, no bloqueante. El solver sigue funcionando y genera propuesta |
| **Daño funcional** | ❌ Ninguno |

---

## 5. Riesgos de desplegar SIN UX previa

| Riesgo | Probabilidad | Impacto | Mitigación natural |
|---|---|---|---|
| Título genérico confunde al usuario | MEDIA | BAJO | El body del mensaje es claro y específico |
| Botón "Añadir fondos" no resuelve el BLOCK | MEDIA | BAJO | El retry vuelve a bloquear; el usuario puede cancelar |
| Retry infinito si usuario insiste | BAJA | BAJO | El loop es idempotente; mismo mensaje aparece |
| WARNING invisible | ALTA | BAJO | El WARNING no es bloqueante; la propuesta sale |
| Usuario no entiende por qué se bloquea | BAJA | MEDIO | El mensaje explica locks + bucket/equity_floor |

**Riesgo global: BAJO**

### ¿Antes del precheck, qué pasaba con estas mismas carteras?

| Antes (sin precheck) | Ahora (con precheck) |
|---|---|
| Solver recibía problema imposible | Precheck bloquea con mensaje claro |
| Error críptico de CVXPY/infeasible | Mensaje en español comprensible |
| `infeasible_constraints` con toast genérico | Dialog con body específico |
| Retry con auto_expand que no ayudaba | Retry que tampoco ayuda, pero con mensaje claro |
| Experiencia: ❌ confusa | Experiencia: ⚠️ mejorable pero funcional |

---

## 6. Riesgos de tocar UX ANTES de deploy

| Riesgo | Impacto |
|---|---|
| Retrasar deploy del backend (ya validado y testeado) | MEDIO |
| Introducir bugs en frontend al tocar el dialog flow | BAJO-MEDIO |
| Necesidad de rebuild + redeploy frontend | MEDIO |
| Scope creep: tocar más de lo necesario | MEDIO |
| Necesidad de tests frontend adicionales | BAJO |

**El frontend funciona correctamente hoy**. Tocarlo introduce riesgos sin
resolver un problema funcional.

---

## 7. Veredicto

### `DEPLOY_BACKEND_FIRST` ✅

| Criterio | Evaluación |
|---|---|
| ¿El usuario ve un mensaje comprensible? | ✅ Sí, el body del dialog es el message del BLOCK |
| ¿El botón de retry causa daño? | ❌ No (retry idempotente, vuelve a mostrar el mismo mensaje) |
| ¿El WARNING invisible causa daño? | ❌ No (informativo, el solver sigue) |
| ¿El comportamiento es estrictamente mejor que antes? | ✅ Sí (antes: error críptico de solver) |
| ¿Tocar UX aporta valor funcional? | ⚠️ Marginal (título y botón más precisos) |
| ¿Tocar UX introduce riesgo? | ⚠️ Sí (frontend rebuild, posibles bugs) |

**Recomendación**: Desplegar backend primero. Implementar mejoras UX como bloque
separado posterior, sin urgencia.

---

## 8. Propuesta de textos UX (para implementación futura)

Si en el futuro se decide mejorar la UX, estos serían los cambios mínimos:

### 8.1. Detección de precheck BLOCK en el dialog

```typescript
// Propuesta: detectar precheck_blocked en el path infeasible
} else if (result.status === 'infeasible') {
    const isPrecheckBlock = result.explainability?.precheck_blocked === true;

    if (isPrecheckBlock) {
        // Locks-specific dialog
        setConfirmDialog({
            isOpen: true,
            title: "Bloqueo de restricciones",
            message: result.message,
            confirmLabel: "Entendido",
            cancelLabel: undefined,   // no hay retry útil
            onConfirm: () => setConfirmDialog(null),
        });
    } else {
        // Existing infeasible flow (universe expansion)
        // ... código actual L676–714 sin cambios ...
    }
}
```

### 8.2. Textos propuestos por código

| Código | Título propuesto | Botón propuesto |
|---|---|---|
| `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` | *"Fondos bloqueados superan el límite"* | *"Entendido"* |
| `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` | *"Fondos bloqueados impiden el objetivo de RV"* | *"Entendido"* |
| `WARNING_LOCKS_HIGH_CONCENTRATION` | *(toast informativo)* | *(N/A)* |

### 8.3. Mostrar WARNING como toast

```typescript
// Propuesta: tras recibir resultado exitoso, leer warnings del precheck
if (isOptimizerResultApplicable(result)) {
    // ... código actual ...

    // Nuevo: mostrar precheck warnings si existen
    const precheckWarnings = (result as any).feasibility_precheck?.warnings;
    if (precheckWarnings?.length) {
        precheckWarnings.forEach((w: any) => {
            toast.warning(w.message, { duration: 8000 });
        });
    }
}
```

### 8.4. Impacto de la propuesta

| Aspecto | Valor |
|---|---|
| Archivos a tocar | 1 (`usePortfolioActions.ts`) |
| Líneas a cambiar | ~20 |
| Tests nuevos necesarios | 2-3 (precheck block dialog, warning toast) |
| Riesgo de regresión | BAJO (cambio acotado en un solo branch de if/else) |
| Build/deploy | Frontend rebuild + deploy |

---

## 9. Secuencia recomendada

```
1. DEPLOY backend actual (ca78051)         ← locks precheck activo en producción
   ↓
2. Verificar en staging/producción:
   - Cartera sin locks → funciona igual
   - Cartera con locks compatibles → funciona
   - Cartera con locks incompatibles → dialog con mensaje claro
   ↓
3. [OPCIONAL] BDB-OPT-FEASIBILITY-LOCKS-UX-MESSAGES-0
   - Implementar dialog diferenciado para precheck blocks
   - Mostrar WARNING como toast
   - Frontend rebuild + deploy
```

---

## 10. Estado final

```
AUDIT_ONLY
NO_FRONTEND_CHANGES
NO_DEPLOY
DEPLOY_BACKEND_FIRST
```

### Resumen en una frase

> El deploy del backend es seguro sin cambios UX previos. El mensaje del BLOCK
> llega claro al usuario. El título y botón del dialog son genéricos pero no causan
> daño funcional. Las mejoras UX son opcionales y se recomiendan como bloque posterior.

---

**Fecha de auditoría**: 2026-05-10T07:50:00+02:00

**Autor**: Asistente IA (Claude 4.6, Antigravity IDE)

**Documentos relacionados**:
- `docs/BDB_OPT_FEASIBILITY_LOCKS_RELEASE_READINESS_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_RUNTIME_CLOSEOUT_0.md`
