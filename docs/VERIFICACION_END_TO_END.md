# Verificación end-to-end: Swap + Pesos + Capital

Fecha: 2026-05-21
Alcance: módulo "Cartera de Fondos" del dashboard principal. Documento de referencia que describe el comportamiento **real** tras las correcciones aplicadas.

---

## 1. SUSTITUIR un fondo

### Flujo

`PortfolioTable` → botón Sustituir → `handleOpenSwap` (carga alternativas vía `findDirectAlternativesV3`) → `FundSwapModal` → click "Sustituir Activo" → `performSwap(fund, mode)` → si hay divergencias o `ft_skipSwapConfirm !== 'true'` muestra `ConfirmModal` → en confirmación → `applySwapNow(fund, mode)`.

### Qué se conserva del slot original

| Campo | Conservado | Notas |
|---|---|---|
| `weight` | ✅ Siempre | Igual al fondo original |
| `isLocked` | ✅ Siempre | El candado se preserva |
| `manualSwap` | ✅ Forzado a `true` | El optimizador respetará la elección |
| `targetEuros` | Sólo en modo "Mantener €" | Capital × peso/100 en el momento |
| `keepEuros` | Sólo en modo "Mantener €" | Flag para la lógica de recálculo |

### Avisos automáticos

`performSwap` calcula divergencias entre el fondo original y el candidato:

* **Divisa** (`std_extra.currency`, `currency`, …)
* **Clase de activo** (`classification_v2.asset_type`)
* **Región primaria** (`classification_v2.region_primary`)

Si difieren, el `ConfirmModal` muestra siempre la advertencia y exige confirmación, independientemente de la preferencia `ft_skipSwapConfirm`.

### Modo "Mantener € / Mantener %"

Toggle en la cabecera del `FundSwapModal`:

* **Mantener %** (por defecto): el peso queda igual; el € se deriva del capital actual del dashboard.
* **Mantener €**: se graban `targetEuros` y `keepEuros: true` en el slot. Cuando el usuario cambia el capital del header (`commitCapital`) o usa la opción **Aportación Proporcional**, esos slots recalculan su peso para que su € se mantenga; los demás absorben el residuo (ver §3.2).

---

## 2. Edición de pesos en la tabla

### Footer con badge de desbalance

`PortfolioFooterRow` muestra:

* `Σ pesos` en color (verde si ≈ 100, rojo si > 100, ámbar si < 100).
* Suma de € de la cartera (= `totalCapital × Σpesos/100`).
* Badge **OK** / **Faltan X €** / **Sobran X €** comparando con el capital del header.
* Tooltips con el valor exacto.

### Modo de edición Libre vs Proporcional

Toggle en la cabecera de "Cartera de Fondos" (persistido en `localStorage.ft_editMode`):

* **Libre**: cambias un peso, los demás no se mueven. Es lo que existía antes — el badge del footer avisa del desbalance.
* **Proporcional**: cambias A en Δ y los demás fondos *no bloqueados* se ajustan pro-rata (ponderado por su peso anterior) para que `Σ = 100`. Si el delta excede lo que los demás pueden absorber, se clampan a 0..100 y la reconciliación pone el residuo en la posición no bloqueada y no editada de mayor peso.

### Validaciones

* `handleUpdateWeightSmart` y `FastNumberInput` aplican clamp `[0, 100]` para `%` y `[0, totalCapital]` para `€`.
* No se acepta `NaN`/`Infinity`.

### Botón "Normalizar 100 %"

Aparece en el header sólo cuando `|Σpesos − 100| > 0,01`. Reescala los no bloqueados proporcionalmente y reconcilia el residuo en el de mayor peso. Avisa con toast si los bloqueados ya superan el 100 % o si no hay nada no bloqueado.

---

## 3. Capital total

### 3.1 Edición desde el header del dashboard

* Input `type="text"` con `inputMode="decimal"` y placeholder `Ej. 100.000,00`.
* `parseLocaleNumber` acepta:
  * `"1.234,56"` (es-ES)
  * `"1234,56"` (es-ES sin miles)
  * `"1234.56"` (en-US)
  * `"1,234.56"` (en-US con miles)
* Toast informativo al confirmar:
  * Sin slots `keepEuros` → "Importes actualizados — los pesos se mantienen".
  * Con slots `keepEuros` → "Capital actualizado — N fondo(s) con 'mantener €' recalculado(s); el resto absorbe la diferencia."
* Esc cancela la edición sin cambios.

### 3.2 Lógica `keepEuros` y reconciliación

`recomputeWeightsForCapitalChange(portfolio, newCapital)`:

1. **`keepEuros` items** → `weight_new = targetEuros / newCapital × 100`.
2. **Locked no-keepEuros** → peso intacto (su € crece/baja con el capital).
3. **Unlocked no-keepEuros (flexibles)** → absorben el residuo proporcionalmente a su peso anterior, hasta sumar 100.
4. Reconciliación del redondeo sobre el flexible de mayor peso.

> Esto resuelve el bug previo en el que sólo se recalculaban los `keepEuros` y la suma se desviaba de 100.

---

## 4. Optimización con bloqueados + nuevos: `OptimizationStrategyModal`

Cuando hay **fondos bloqueados Y nuevos** y se pulsa Optimizar, aparece el modal con **3 opciones**:

| Opción | Capital total | Pesos de bloqueados | Pesos de no bloqueados | ¿Llama al optimizador? |
|---|---|---|---|---|
| **A. Aportar Dinero Nuevo** | Aumenta (+aportación) | Peso ajustado para mantener € constante | Reasignados por el optimizador para absorber la aportación | ✅ |
| **B. Aportación Proporcional** ★nuevo★ | Aumenta (+aportación) | Peso intacto → € crece proporcionalmente | Peso intacto → € crece proporcionalmente | ❌ |
| **C. Redistribuir Capital** | Sin cambios | Peso intacto | Reasignados por el optimizador "vendiendo" parte de los actuales | ✅ |

### Aviso en la opción Proporcional

Si hay fondos con `weight = 0` en la cartera, el modal muestra un aviso ámbar listando los 3 primeros (`+N más…`) explicando que recibirían 0 €. El usuario puede:

1. Cancelar, asignar pesos manualmente y reabrir el modal.
2. Cambiar a "Aportar Dinero Nuevo" para que el optimizador los integre.

### Handler

`handleProceedStrategy('proportional', extra)` aplica exactamente el mismo algoritmo que `recomputeWeightsForCapitalChange` (sin llamar al optimizador). Si hay `keepEuros`, se respeta el € de esos slots y los demás absorben.

---

## 5. Tests manuales recomendados

### 5.1 Swap básico

1. Añade 3 fondos del mismo asset type / región. Asigna 33,33-33,33-33,34 %.
2. Pulsa "Sustituir" en uno. Sin tocar filtros, pulsa "Sustituir Activo" en una alternativa.
3. **Esperado**: modal de confirmación con resumen "33,33 %" y "Modo: mantener peso". Sin avisos.

### 5.2 Swap con divergencia

1. Selecciona un fondo de Renta Variable y abre Sustituir.
2. Cambia el filtro a "Renta Fija (General)" en el modal.
3. Espera ~300 ms — las alternativas se refrescan automáticamente.
4. Pulsa "Sustituir Activo".
5. **Esperado**: modal con sección **⚠️ Atención** listando "Cambia de clase de activo: EQUITY → FIXED_INCOME".

### 5.3 Swap manteniendo €

1. Capital del header = 100.000 €. Fondo X al 25 % (= 25.000 €).
2. En el modal de swap pulsa "Mantener €", elige alternativa y confirma.
3. Cambia el capital del header a 200.000 €.
4. **Esperado**:
   * El fondo X ahora pesa 12,5 % (25.000 / 200.000 × 100).
   * Los demás absorben el cambio (sus pesos suben proporcionalmente).
   * Σ pesos sigue siendo 100 %.
   * Toast: "Capital actualizado — 1 fondo(s) con 'mantener €' recalculado(s); el resto absorbe la diferencia."

### 5.4 Modo Proporcional

1. Cartera: A=20, B=30, C=50 (todos no bloqueados).
2. Activa toggle "Proporcional".
3. Cambia A a 50.
4. **Esperado**: B y C bajan en proporción a sus pesos anteriores → B ≈ 18,75, C ≈ 31,25. Σ = 100. Footer en verde "OK".

### 5.5 Botón Normalizar

1. En modo Libre, cambia un peso para que Σ ≠ 100 (ej. lo subes a 95 cuando los demás suman 80).
2. **Esperado**: badge rojo "Sobran X €" en el footer y aparece el botón ámbar "Normalizar 100 %" en el header.
3. Púlsalo → todos los no bloqueados se reescalan para que Σ = 100.

### 5.6 Aportación Proporcional (modal de estrategia)

1. Cartera con 1 fondo bloqueado al 50 % y 1 nuevo al 50 % (no bloqueado). Capital = 100.000 €.
2. Pulsa Optimizar → aparece `OptimizationStrategyModal`.
3. Elige "Aportación Proporcional" → escribe 50.000 €.
4. Pulsa Continuar.
5. **Esperado**:
   * No se llama al optimizador (no aparece spinner largo).
   * Capital pasa a 150.000 €.
   * Ambos fondos siguen al 50 %.
   * Bloqueado: 75.000 € (creció proporcionalmente).
   * No bloqueado: 75.000 € (creció proporcionalmente).
   * Toast: "+50.000 € añadidos · pesos sin cambios, cada € crece proporcionalmente".

### 5.7 Aportación Proporcional con peso=0 → aviso

1. Cartera con 2 fondos bloqueados al 50 % cada uno y 1 fondo nuevo al 0 %.
2. Pulsa Optimizar → modal.
3. Elige "Aportación Proporcional".
4. **Esperado**: aviso ámbar listando el fondo con peso 0 % avisando que recibiría 0 €. El usuario puede cancelar o continuar bajo su responsabilidad.

### 5.8 Formato de capital con coma

1. Edita capital → escribe `123.456,78` y pulsa Enter.
2. **Esperado**: se interpreta como 123 456,78 €.
3. Vuelve a editar → escribe `1234.56`. Pulsa Enter.
4. **Esperado**: se interpreta como 1 234,56 € (último separador = decimal).
5. Esc cancela cualquier cambio sin tocar el capital.

---

## 6. Errores TypeScript pendientes (PRE-EXISTENTES, no introducidos por estas correcciones)

* `usePortfolioActions.ts:410` — comparación con `'ALLOCATION'` (enum no contiene esa constante exacta).
* `usePortfolioActions.ts:886-888` — accesos a `result.metrics.target_vol/achieved_vol/vol_deviation` (no en `PortfolioMetrics`).
* `usePortfolioActions.ts:895` — `toast.warning(msg, { duration: 6000 })` (la firma actual de `ToastContext` espera `number`).

Estos errores existían en `main` antes de la auditoría y no afectan al runtime. Pueden corregirse aparte alineando los tipos de respuesta del optimizador y la firma del toast.

---

## 7. Suite de tests automáticos

Las tres suites relevantes se ejecutan en verde:

```
src/utils/rulesEngine.test.ts   3 tests ✓
src/utils/fundSwapper.test.ts   4 tests ✓
src/utils/statistics.test.ts    5 tests ✓
Total: 12/12 verde.
```

No hay tests automáticos para `usePortfolioActions` ni para los componentes del dashboard; la cobertura es manual mediante los escenarios de §5.
