# Auditoría: lógica "SUSTITUIR" y coherencia Capital ↔ Pesos ↔ Importes

Fecha: 2026-05-21
Alcance: módulo "Cartera de Fondos" del Dashboard principal (`DashboardPage`), tabla de cartera (`PortfolioTable`), modal de sustitución (`FundSwapModal`) y hook de acciones (`usePortfolioActions`).

---

## 1. Lógica del botón SUSTITUIR

### 1.1 Cadena de ejecución actual

`PortfolioTable.tsx:184-189` → `handleOpenSwap` (`usePortfolioActions.ts:409-459`) → `FundSwapModal` (renderizado en `DashboardPage.tsx:477`) → `onSelect` → `performSwap` (`usePortfolioActions.ts:461-473`).

`performSwap` es lo que efectivamente sustituye el fondo en la cartera:

```ts
// usePortfolioActions.ts:461-473
const performSwap = useCallback((newFund: Fund) => {
    if (!swapper.fund) return;
    const updatedPortfolio = portfolio.map(item => {
        if (item.isin === swapper.fund?.isin) {
            return { ...newFund, weight: item.weight, manualSwap: true };
        }
        return item;
    });
    setPortfolio(updatedPortfolio);
    setSwapper(prev => ({ ...prev, isOpen: false, fund: null }));
    toast.success("Fondo intercambiado con éxito");
}, [swapper.fund, portfolio, setPortfolio, toast]);
```

### 1.2 Problemas detectados

| Sev. | Hallazgo | Ubicación |
|---|---|---|
| 🔴 Alta | `performSwap` **pierde el flag `isLocked`** del fondo original. Si el usuario bloqueó la posición y la sustituye, el nuevo fondo queda desbloqueado (puede ser modificado por el optimizador). | `usePortfolioActions.ts:464-468` |
| 🟠 Media | **Sin confirmación** antes de aplicar la sustitución ni acción "deshacer". Un click en "Sustituir Activo" del modal es irreversible. | `FundSwapModal.tsx:257-262` |
| 🟠 Media | **No se advierte si la divisa difiere** entre original y alternativa (un fondo USD reemplazando uno EUR pasa silencioso). | `performSwap` |
| 🟠 Media | **No se advierte si la clase de activo o región del candidato difieren** del original cuando el usuario ha modificado los filtros del modal. Esto puede distorsionar el perfil sin que el usuario lo perciba. | `FundSwapModal.tsx:81-135` |
| 🟠 Media | El botón **"Siguientes Candidatos 🔎"** mezcla dos funciones: (a) lanzar una búsqueda con filtros nuevos y (b) paginar al siguiente lote. Como siempre incrementa `page`, la primera pulsación tras cambiar `assetClass`/`region`/`maximizeRetro` salta las 3 alternativas más relevantes. | `FundSwapModal.tsx:125-134` |
| 🟡 Baja | `handleSearch` definido pero **nunca usado** (código muerto). | `FundSwapModal.tsx:55-65` |
| 🟡 Baja | `excludeIsins` ya se pasa desde el caller, pero `fundSwapper`/`findDirectAlternativesV3` vuelven a filtrar internamente por `portfolioIsins`. Filtrado redundante (no es bug, ensucia). | `usePortfolioActions.ts:422`, `fundSwapper.ts:127-132` |
| 🟡 Baja | No se ofrece elegir entre **"Sustituir manteniendo %"** (actual) y **"Sustituir manteniendo €"**. Hoy siempre mantiene el peso. | `performSwap` |
| 🟡 Baja | Si el nuevo fondo trae su propio `manualSwap`/`isLocked`/`weight` en el documento original, se sobreescriben por el spread `...newFund` antes de aplicar `weight: item.weight`. El comportamiento actual es correcto para `weight`, pero conviene normalizar los demás flags explícitamente. | `usePortfolioActions.ts:466` |

### 1.3 Lo que sí funciona correctamente

* Se preserva el `weight` del fondo original ✅
* Se marca `manualSwap: true` para que el optimizador respete la selección ✅
* `findDirectAlternativesV3` excluye el ISIN original y los del resto de la cartera ✅
* Filtros por `assetClass` y `region` precargados con los del fondo original ✅
* Comparativa visual de Sharpe / Volatilidad / Retrocesión en el modal ✅
* Reset de filtros al abrir el modal (`useEffect` en `FundSwapModal.tsx:44-51`) ✅

---

## 2. Coherencia Capital ↔ Pesos ↔ Importes

### 2.1 Modelo conceptual actual

* `portfolio[i].weight` es la **fuente de verdad** (expresado en porcentaje, no en fracción).
* `totalCapital` es independiente del portfolio y se persiste en `localStorage` (`usePortfolio.ts:24`).
* Los importes en € de cada fondo son **derivados**: `€ = totalCapital * (weight / 100)`.

Este modelo es razonable, pero la UI **no protege la invariante "Σ pesos = 100"** en ningún punto de edición manual.

### 2.2 Problemas detectados

| Sev. | Hallazgo | Ubicación |
|---|---|---|
| 🔴 Alta | Editar un peso individual **NO rebalancea** los demás. La suma queda libre y puede salir de 100% sin aviso. El footer "TOTAL %" la muestra pero **sin alerta visual** cuando ≠ 100. | `usePortfolioActions.ts:331-334`, `PortfolioTable.tsx:213-216` |
| 🔴 Alta | Editar un importe € individual sólo modifica el peso de ese fondo (`newWeight = newCapital/totalCapital * 100`). El resto no se ajusta, así que **la suma de € deja de cuadrar con el capital del header** aunque el footer muestre lo contrario (ver siguiente fila). | `PortfolioTable.tsx:164-174` |
| 🔴 Alta | El footer muestra la suma de € como `Σ (totalCapital * peso/100) = totalCapital * Σpeso/100`. Si Σpesos = 95, el footer enseña el 95 % del capital, **no el capital del header**. El usuario asume coherencia que no existe. | `PortfolioTable.tsx:217-219` |
| 🟠 Media | Ni `handleUpdateWeight` ni `FastNumberInput` validan rango: se aceptan **pesos negativos** o **> 100**. | `usePortfolioActions.ts:331-334`, `PortfolioTable.tsx:7-63` |
| 🟠 Media | `mapOptimizationResultWeights` redondea `Math.round(rawWeight*100)/100` sin **reconciliar el residuo**. La suma final puede dar 99,98 o 100,02. | `usePortfolioActions.ts:188-193` |
| 🟠 Media | `handleManualGenerate` reparte `100/count` con `.toFixed(2)` → 7 fondos = 14,29 %, suma 100,03. Sin reconciliación. | `usePortfolioActions.ts:563` |
| 🟡 Baja | El `<input type="number">` del capital del header usa `parseFloat`, mientras que el display fuera de edición usa `Intl.NumberFormat('es-ES')` (coma decimal). Inconsistencia entre mostrar y editar para usuarios con teclado/locale es-ES. | `DashboardPage.tsx:360-393` |
| 🟡 Baja | Cuando el usuario cambia el capital total **no se le avisa** de que los € de cada fondo se recalcularán al vuelo (es el comportamiento correcto, pero no es obvio). | `DashboardPage.tsx:365-378` |
| 🟡 Baja | `setTotalCapital` sólo acepta `val > 0`. Si el usuario escribe `0` por error la edición se descarta silenciosamente (sin toast ni error). | `DashboardPage.tsx:366-376` |

### 2.3 Casos concretos donde la incoherencia se manifiesta

1. **Capital = 100.000 €, 5 fondos al 20 %**. El usuario cambia el primero al 25 %: footer marca 105 % y "Total €" = 105.000 €, pero el capital del header sigue siendo 100.000 €. Visualmente nada chilla.
2. **Capital = 100.000 €**. El usuario cambia el € del primer fondo de 20.000 a 30.000: ese peso pasa a 30 %, los demás siguen al 20 %. Footer = 110 %, "Total €" = 110.000 €.
3. **Optimización**: el optimizador devuelve pesos que tras `Math.round` suman 100,02 %. Si luego el usuario "guarda" o exporta, se exportan pesos no normalizados.
4. **Sustituir un fondo bloqueado**: el nuevo aparece desbloqueado y el optimizador puede modificarlo en la siguiente pasada — silencioso pero inesperado.

### 2.4 Lo que sí funciona correctamente

* `handleAddAsset` añade con `weight: 0` (no rompe la suma) ✅
* `handleAutoCompletePortfolio` añade con `weight: 0` ✅
* Recalculo automático de los € de cada fila cuando cambia `totalCapital` ✅
* Persistencia en `localStorage` de capital, perfil y cartera ✅
* `csvImport` normaliza pesos a 100 si vienen sin valores (`csvImport.ts:191-196`) ✅
* `rulesEngine.test.ts` ya tiene aserciones `weightsSum ≈ 100` con tolerancia 0,5 en el generador automático ✅

---

## 3. Propuestas de mejora (priorizadas)

### 🔴 Prioridad Alta — bugs y trampas silenciosas

1. **Preservar flags al sustituir** (`performSwap`):

   ```ts
   // usePortfolioActions.ts:461-473 — propuesta
   const performSwap = useCallback((newFund: Fund) => {
       if (!swapper.fund) return;
       const updatedPortfolio = portfolio.map(item => {
           if (item.isin === swapper.fund?.isin) {
               return {
                   ...newFund,
                   weight: item.weight,
                   isLocked: item.isLocked,      // ⬅ NUEVO: preserva candado
                   manualSwap: true,
               };
           }
           return item;
       });
       // …
   });
   ```

2. **Indicador visual de desbalance en el footer** (`PortfolioTable.tsx:213-216`): badge rojo/ámbar si `|Σpesos - 100| > 0,01`, y mostrar el importe que falta/sobra a la derecha del total de €.

3. **Reconciliación de redondeo**: en `mapOptimizationResultWeights` y `handleManualGenerate`, el último elemento absorbe el residuo para que la suma sea exactamente 100:

   ```ts
   // usePortfolioActions.ts:563 — propuesta
   const baseW = Number((100 / count).toFixed(2));
   generated = generated.map((p, i) => ({
       ...p,
       weight: i === count - 1
           ? Number((100 - baseW * (count - 1)).toFixed(2))
           : baseW,
   }));
   ```

4. **Clamp `weight ∈ [0, 100]`** en `handleUpdateWeight` y/o `FastNumberInput`:

   ```ts
   // usePortfolioActions.ts:331-334 — propuesta
   const handleUpdateWeight = useCallback((isin: string, value: string) => {
       const parsed = parseFloat(value as any) || 0;
       const newWeight = Math.min(100, Math.max(0, parsed));
       setPortfolio(portfolio.map(p => p.isin === isin ? { ...p, weight: newWeight } : p));
   }, [portfolio, setPortfolio]);
   ```

### 🟠 Prioridad Media — UX y robustez

5. **Modo de edición de pesos seleccionable** (toggle en el header de la tabla):
   * **Libre** (actual): editas un peso, los demás no cambian, footer avisa del desbalance.
   * **Proporcional**: al subir A en Δ, los demás (no bloqueados) se reducen prorrata para mantener 100. Es lo que normalmente se espera de un constructor de cartera.

6. **Confirmación opcional al sustituir** (preferencia de usuario, por defecto activada las primeras N veces):
   * Modal con resumen "X% / Y€ pasarán de ‹Fondo A› a ‹Fondo B›".
   * Detectar divergencias (divisa, asset class, región) y resaltarlas.

7. **Renombrar "Siguientes Candidatos" → "Buscar / Más"** y, ante cualquier cambio de filtro (`assetClass`, `region`, `maximizeRetro`), resetear `page=0` y disparar `onRefresh` automáticamente (con un debounce de 250-400 ms).

8. **Eliminar `handleSearch` muerto** en `FundSwapModal.tsx:55-65`.

### 🟡 Prioridad Baja — pulido

9. **Mostrar el total real de € y compararlo con el capital del header** con un badge `OK` / `Faltan 5.000 €` / `Sobran 5.000 €`.

10. **Botón "Normalizar a 100 %"** en el footer de la tabla (no toca posiciones bloqueadas).

11. **Opción "Sustituir manteniendo €"** vs "Sustituir manteniendo %", para los casos en que el capital cambia entre la sustitución y la siguiente optimización.

12. **Quitar `excludeIsins` redundante** del caller (`usePortfolioActions.ts:422`), o quitarlo del filtro interno: dejar una sola fuente de verdad.

13. **Normalizar input de capital con locale**: aceptar coma y punto como separador decimal, mostrar separador de miles también dentro del input, o cambiar a un componente tipo `NumericFormat` (react-number-format).

14. **Toast / aviso silencioso al cambiar capital**: "Importes actualizados — los pesos se mantienen".

---

## 4. Resumen ejecutivo

La lógica de **SUSTITUIR** funciona en su recorrido principal (búsqueda con tiered fallback, scoring, swap conservando peso y marcando `manualSwap`), pero deja **dos efectos secundarios silenciosos** que conviene corregir cuanto antes: pérdida del `isLocked` y ausencia de aviso ante divergencias estructurales (divisa / clase / región) entre original y candidato. El botón "Siguientes Candidatos" sufre además de un problema de UX que enmascara las primeras alternativas tras un cambio de filtro.

La coherencia **Capital ↔ Pesos ↔ Importes** es el área con mayor margen de mejora: el modelo "el peso manda, el € es derivado" es correcto, pero la UI **no defiende la invariante Σpesos = 100** en ningún punto de edición, y el footer enmascara el desbalance al pintar siempre `totalCapital * Σpesos/100`. Las cuatro correcciones de prioridad alta (1-4) cierran los huecos críticos sin cambiar la arquitectura, y el resto son mejoras incrementales de UX.
