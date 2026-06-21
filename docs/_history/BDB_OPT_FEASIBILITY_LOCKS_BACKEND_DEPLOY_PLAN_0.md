# BDB_OPT_FEASIBILITY_LOCKS_BACKEND_DEPLOY_PLAN_0

## Plan de Despliegue: Locks Feasibility Precheck — Backend

**Estado: `DEPLOY_PLAN_ONLY` | `NOT_DEPLOYED` | `READY_FOR_DEPLOY_EXECUTION`**

---

## 1. Resumen ejecutivo

Este documento define el plan exacto para desplegar el bloque **Locks Feasibility
Precheck** al proyecto Firebase `bdb-fondos` en producción. El deploy se limita a
**Cloud Functions (Python)** únicamente. No se toca hosting, rules ni storage.

---

## 2. Estado Git

| Campo | Valor |
|---|---|
| HEAD al planificar | `fece438` |
| HEAD = origin/master | ✅ |
| Working tree | Limpio |
| Proyecto Firebase | `bdb-fondos` |
| Runtime | `python312` |

---

## 3. Scope del deploy

### 3.1. QUÉ se despliega

| Servicio | Deploy? | Motivo |
|---|---|---|
| **functions** | ✅ SÍ | Contiene feasibility_precheck.py y optimizer_core.py modificados |
| hosting | ❌ NO | No se modificó frontend |
| firestore rules | ❌ NO | No se modificaron rules |
| storage rules | ❌ NO | No se modificó storage |

### 3.2. Functions afectadas

Todas las functions se redesplegan al hacer `firebase deploy --only functions`,
pero solo el flujo de `optimize_portfolio_quant` es impactado funcionalmente:

| Function | Impacto |
|---|---|
| `optimize_portfolio_quant` | ✅ **Contiene el precheck modificado** |
| `backtest_portfolio` | Sin cambio funcional |
| `backtest_portfolio_multi` | Sin cambio funcional |
| `getEfficientFrontier` | Sin cambio funcional |
| `analyze_portfolio_endpoint` | Sin cambio funcional |
| Schedulers/Admin/Xray | Sin cambio funcional |

### 3.3. Comando de deploy recomendado

```bash
firebase deploy --only functions
```

> **IMPORTANTE**: Usar `--only functions` para NO redesplegar hosting, rules ni storage.
> Esto evita riesgo de sobreescribir frontend con un build no actualizado.

---

## 4. Comandos predeploy

### 4.1. Verificación Git (obligatoria)

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log --oneline -5
```

**Criterio GO**: HEAD = origin/master, working tree limpio.

### 4.2. Tests unitarios (obligatorios)

```bash
# Desde functions_python/
..\functions_python\venv\Scripts\python.exe -m pytest tests\test_feasibility_precheck_locks_expected_behavior.py tests\test_feasibility_precheck_locks_compatibility.py -q
..\functions_python\venv\Scripts\python.exe -m pytest tests\test_feasibility_precheck.py -q
```

**Criterio GO**:
- Locks: 22 passed, 2 skipped, 0 xfailed, 0 failed
- Precheck original: 20 passed, 0 failed

### 4.3. Verificación de proyecto Firebase (obligatoria)

```bash
firebase projects:list
firebase use
```

**Criterio GO**: Proyecto activo = `bdb-fondos`.

---

## 5. Ejecución del deploy

### 5.1. Comando

```bash
firebase deploy --only functions
```

### 5.2. Tiempo estimado

- Deploy de functions Python: **3–8 minutos** (incluye instalación de dependencias
  en Cloud Build).

### 5.3. Output esperado

```
=== Deploying to 'bdb-fondos'...
i  functions: preparing functions_python directory for uploading...
✔  functions: functions folder uploaded successfully
i  functions: creating Node.js function ...
✔  Deploy complete!
```

---

## 6. Validación postdeploy

### 6.1. Verificar estado de functions (inmediato)

Comprobar en la consola de Firebase o con CLI que las functions están ACTIVE:

```bash
firebase functions:list
```

O en la consola: https://console.firebase.google.com/project/bdb-fondos/functions

**Criterio**: Todas las functions en estado `ACTIVE`.

### 6.2. Test funcional básico — Cartera SIN locks (obligatorio)

Desde el frontend de producción, ejecutar una optimización con una cartera
**sin posiciones bloqueadas**:

1. Abrir la app.
2. Seleccionar cartera con 5+ fondos.
3. NO bloquear ningún fondo.
4. Optimizar.
5. **Resultado esperado**: Propuesta de cartera optimizada. Sin diferencia
   visible respecto al comportamiento anterior.

### 6.3. Test funcional — Cartera CON locks compatibles (recomendado)

1. Bloquear 1–2 fondos (peso total < 30%).
2. Perfil moderado o agresivo.
3. Optimizar.
4. **Resultado esperado**: Propuesta generada con fondos bloqueados respetados.
   Sin BLOCK ni WARNING visible.

### 6.4. Test funcional — Cartera CON locks incompatibles (recomendado)

1. Bloquear 3+ fondos de renta fija con peso total > 60%.
2. Perfil agresivo (risk_level 8+, equity_floor alto).
3. Optimizar.
4. **Resultado esperado**: Dialog con mensaje en español indicando que los fondos
   bloqueados exceden el límite. Botón "Añadir fondos y reintentar" + "Cancelar".

### 6.5. Verificar logs (recomendado)

En Cloud Functions logs (consola Firebase o CLI):

```bash
firebase functions:log --only optimize_portfolio_quant
```

Buscar:
- No errores 500 nuevos.
- Si aparece precheck block, verificar que el log muestra
  `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` o `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR`.

---

## 7. Rollback plan

### 7.1. Si el deploy causa problemas de código

```bash
# Revertir los 2 commits de runtime
git revert ca78051 47d3e20 --no-commit
git commit -m "ROLLBACK: revert locks precheck runtime"
git push origin master

# Redesplegar
firebase deploy --only functions
```

### 7.2. Si solo equity_floor causa problemas

```bash
git revert ca78051 --no-commit
git commit -m "ROLLBACK: revert equity floor precheck only"
git push origin master
firebase deploy --only functions
```

### 7.3. Si el deploy falla técnicamente (Cloud Build error)

- El deploy anterior sigue activo. No hay impacto en producción.
- Diagnosticar el error de build y reintentar.

### 7.4. Si no se despliega todavía

No hay rollback necesario. El código está en master pero no en producción.

---

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Deploy falla por dependencia Python | BAJA | NULO (prod no cambia) | Reintentar o ajustar requirements.txt |
| Function falla en cold start | MUY BAJA | BAJO | Monitorear logs 15 min post-deploy |
| Cartera normal bloqueada incorrectamente | MUY BAJA | MEDIO | Tests unitarios cubren regresión |
| Locks incompatibles bloqueados (correcto) | MEDIA | POSITIVO | Comportamiento deseado (P1–P5) |
| Título genérico en dialog UX | ALTA | BAJO | Body del mensaje es claro; UX posterior |
| WARNING invisible | ALTA | MUY BAJO | No impacta funcionalidad |

---

## 9. Criterio GO / NO-GO

### GO ✅ si se cumplen TODAS:

- [ ] HEAD = origin/master
- [ ] Working tree limpio
- [ ] Locks tests: 22 passed, 2 skipped, 0 failed
- [ ] Precheck original: 20 passed, 0 failed
- [ ] Proyecto Firebase = `bdb-fondos`
- [ ] Comando: `firebase deploy --only functions`

### NO-GO ❌ si cualquiera:

- HEAD ≠ origin/master
- Tests fallan
- Working tree con cambios no commiteados
- Proyecto Firebase incorrecto
- Cambios en hosting/rules/storage no previstos

---

## 10. Secuencia completa de ejecución

```
Predeploy
─────────────────────────────────────────
1. git status --short                    → limpio
2. git rev-parse HEAD                    → fece438 (o HEAD actual post-docs)
3. pytest locks tests                    → 22 passed, 2 skipped
4. pytest precheck original              → 20 passed
5. firebase use                          → bdb-fondos

Deploy
─────────────────────────────────────────
6. firebase deploy --only functions      → ✔ Deploy complete!

Postdeploy
─────────────────────────────────────────
7. firebase functions:list               → ACTIVE
8. Test funcional: sin locks             → propuesta OK
9. Test funcional: locks compatibles     → propuesta OK
10. Test funcional: locks incompatibles  → dialog con mensaje
11. firebase functions:log               → sin errores 500
```

---

## 11. Estado final

```
DEPLOY_PLAN_ONLY
NOT_DEPLOYED
READY_FOR_DEPLOY_EXECUTION
```

### Resumen en una frase

> El deploy se ejecuta con `firebase deploy --only functions` tras confirmar
> tests y estado Git. Solo se redesplegan Cloud Functions. No se toca hosting,
> rules ni storage. Rollback disponible por `git revert` de 1–2 commits.

---

**Fecha del plan**: 2026-05-10T08:10:00+02:00

**Autor**: Asistente IA (Claude 4.6, Antigravity IDE)

**Documentos relacionados**:
- `docs/BDB_OPT_FEASIBILITY_LOCKS_RELEASE_READINESS_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_UX_MESSAGES_AUDIT_0.md`
- `docs/BDB_OPT_FEASIBILITY_LOCKS_RUNTIME_CLOSEOUT_0.md`
