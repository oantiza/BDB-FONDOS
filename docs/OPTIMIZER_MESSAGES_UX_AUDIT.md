# Auditoría de UX: Mensajes del Optimizador y Pre-check

## A. Resumen Ejecutivo
Tras auditar el frontend, se confirma que la infraestructura para mostrar los datos de fallback (volatilidad objetivo vs lograda) está lista, pero **hay un desajuste en el mapeo del payload** que impide que se muestren. Por otro lado, los mensajes del pre-check están usando una llamada síncrona `window.confirm()` nativa del navegador, la cual rompe la estética de la aplicación. Por último, los textos explicativos del "decision-making" del solver son mostrados en crudo (inglés técnico).

Todo esto se puede arreglar **exclusivamente en el frontend** sin tocar el backend.

## B. Origen del popup nativo
El popup proviene de **`frontend/src/hooks/usePortfolioActions.ts`** (alrededor de las líneas 640, 670 y 697).
```typescript
} else if (result.status === 'infeasible') {
    const msg = result.message || "...";
    if (window.confirm(msg)) { // <-- ORIGEN DEL POPUP NATIVO
        // Lógica de reintento con universo expandido
```
Como la optimización está en una función asíncrona (`handleOptimize`), el desarrollador original usó `window.confirm` porque pausa la ejecución hasta que el usuario decida.

## C. Propuesta de reemplazo visual
Sustituir `window.confirm` requiere pasar de un flujo sincrónico bloqueante a un flujo asíncrono basado en callbacks.
**Propuesta:**
1. Crear un componente genérico `ConfirmModal.tsx` que use el mismo estilo limpio del proyecto.
2. En `usePortfolioActions.ts`, en vez de usar `if (window.confirm(...))`, lanzaremos este modal guardando en un estado temporal la función de reintento (`onConfirm`).
3. El usuario verá el modal estilizado; si hace clic en "Reintentar", se ejecuta el callback guardado para auto-expandir el universo.

## D. Traducción recomendada de textos técnicos
En **`frontend/src/components/modals/OptimizationReviewModal.tsx`**, los textos de `explainabilityData` se pintan directos del backend.
Se recomienda inyectar un formateador:

**Objetivos:**
- `efficient_risk` → *Riesgo eficiente (Ajustado a Volatilidad Objetivo)*
- `max_sharpe` → *Máximo Ratio Sharpe*
- `min_volatility` o `min_vol` → *Mínima volatilidad*

**Restricciones (Constraints):**
- `bucket_bounds_v1 applied on portfolio_exposure_v2` → *Límites estrictos por clase de activo aplicados*
- `profile buckets skipped` → *Reglas genéricas de perfil omitidas a favor de límites personalizados*
- `legacy profile buckets applied` → *Límites genéricos del perfil de riesgo aplicados*

## E. Estado de target_vol / achieved_vol / vol_deviation
**¿Llegan al frontend en fallback?** Sí, el backend los envía.
**¿Por qué no se muestran?** Porque el backend los inyecta dentro del sub-objeto `metrics`, pero el frontend los intenta leer directamente en la raíz del objeto de respuesta.

En `usePortfolioActions.ts` (línea ~621):
```typescript
// ESTADO ACTUAL (Incorrecto):
target_vol: result.target_vol,
achieved_vol: result.achieved_vol,
vol_deviation: result.vol_deviation,

// DEBE SER (Correcto):
target_vol: result.metrics?.target_vol,
achieved_vol: result.metrics?.achieved_vol,
vol_deviation: result.metrics?.vol_deviation,
```
Con este simple cambio de 3 líneas, la tarjeta "Propuesta de Mejor Esfuerzo" en el modal de optimización se encenderá y mostrará automáticamente la desviación de volatilidad.

---

## F. Quick wins propuestos (Plan de Implementación Frontend-only)

1.  **Arreglar Fallback Card:** Actualizar las 3 referencias de `volatility` en `usePortfolioActions.ts` para que lean correctamente de `result.metrics`.
2.  **Traducciones Amigables:** Añadir las funciones `translateObjective` y `translateConstraint` a la UI de `OptimizationReviewModal.tsx`.
3.  **Sustitución Modal Nativo:**
    *   Crear `frontend/src/components/modals/ConfirmModal.tsx`.
    *   Añadir el estado `pendingConfirmation` al custom hook `usePortfolioActions.ts`.
    *   Sustituir los 3 bloques de `window.confirm` por llamadas a ese estado temporal.
    *   Conectar el `ConfirmModal` en `DashboardPage.tsx`.

## G. Prompt de Implementación

Si apruebas el plan, responde:
> "APROBADO. Procede con la implementación en frontend para solucionar la UX (Fallback card, Traducciones y ConfirmModal propio)."
