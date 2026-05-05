# Auditoría UX: Fallback del Optimizador y Volatilidad

## A. Resumen Ejecutivo
Se ha realizado una auditoría exhaustiva del frontend para evaluar la transparencia y precisión en la comunicación de resultados cuando el optimizador devuelve una cartera de tipo "fallback" (una alternativa subóptima debido a restricciones matemáticas, como la imposibilidad de alcanzar la volatilidad objetivo). La conclusión es que **el frontend actual oculta casi por completo el estado de fallback al usuario final**. Trata las carteras *fallback* de manera idéntica a las óptimas (`optimal`), omitiendo los campos críticos del backend (`target_vol`, `achieved_vol`, `vol_deviation`, `fallback_reason`) y exponiendo a los asesores a graves riesgos de malinterpretación de riesgo y *compliance*.

## B. Flujo actual del resultado de optimización
1. **Acción:** El usuario pulsa optimizar. El backend (Python) no encuentra una solución óptima y devuelve un `status="fallback"` junto con métricas de volatilidad objetivo y alcanzada.
2. **Recepción (Frontend):** En `usePortfolioActions.ts` (línea 613), la lógica los agrupa en un mismo camino feliz: `if (result.status === 'optimal' || result.status === 'fallback')`.
3. **Notificación:** Si no hay cambios de pesos en la alternativa, se lanza un mensaje de éxito engañoso: `toast.success("✅ La cartera ya está optimizada.")`.
4. **Visualización Modal:** En el `OptimizationReviewModal.tsx`, se renderizan las métricas estándar de forma agnóstica. Lo único que delata la condición subóptima es un texto técnico menor en la caja inferior: `"⚠️ Se ha activado un solver de respaldo debido a restricciones estrictas"`, basado en el flag antiguo `explainability.solver_fallback_used`.

## C. Campos backend disponibles (Payload enviado desde Python)
- `status`: "fallback"
- `solver_path`: Ruta algorítmica utilizada.
- `fallback_reason`: Motivo técnico/financiero del fallback.
- `target_vol`: Volatilidad objetivo del perfil de riesgo.
- `achieved_vol`: Volatilidad real obtenida en la propuesta alternativa.
- `vol_deviation`: Diferencia absoluta o porcentual entre ambas.

## D. Campos frontend usados / no usados
| Campo | Estado Frontend | Observaciones |
| :--- | :--- | :--- |
| `status="fallback"` | Parcialmente Usado | Se agrupa junto con `optimal` sin diferenciar visualmente el flujo principal. |
| `explainability.solver_fallback_used` | Usado | Único aviso visual en el modal, pero con lenguaje extremadamente técnico y pequeño. |
| `target_vol` | **NO Usado** | Ni siquiera está definido en la interfaz de respuesta (`SmartPortfolioResponse`) en `types/index.ts`. |
| `achieved_vol` | **NO Usado** | Ignorado por completo. |
| `vol_deviation` | **NO Usado** | Ignorado por completo. |
| `fallback_reason`| **NO Usado** | Ignorado por completo. |
| `solver_path` | **NO Usado** | Ignorado por completo. |

## E. Análisis UX (Preguntas y Respuestas)

1. **¿El usuario ve claramente “Propuesta alternativa” cuando status=fallback?**
   **No.** El título del modal sigue siendo "Resultado Optimización". Sólo existe una pequeña advertencia amarilla sobre un "solver de respaldo".

2. **¿Se evita llamar “óptima” a una cartera fallback?**
   **No.** El *toast* notifica "✅ La cartera ya está optimizada" y el entorno visual comunica éxito y optimización pura.

3. **¿Se muestra volatilidad objetivo?**
   **No.** Al no incluirse el `target_vol` de retorno, el asesor no tiene un ancla de cuál era el requerimiento de riesgo original de su cliente.

4. **¿Se muestra volatilidad alcanzada?**
   **No explícitamente como comparación.** Se muestra la volatilidad general de la propuesta entre las demás tarjetas estadísticas, pero no se confronta contra el objetivo.

5. **¿Se muestra desviación de volatilidad?**
   **No.** Al omitir el `vol_deviation`, no se sabe cuánto riesgo adicional se está asumiendo.

6. **¿Se explica por qué se ha usado fallback?**
   **No.** Falta consumir el `fallback_reason` provisto por la capa matemática. 

7. **¿Dónde debería mostrarse el aviso?**
   Debería ser ubicuo:
   - **En el Toast:** Enviar una advertencia color naranja, no un check verde.
   - **En el Modal de Revisión (`OptimizationReviewModal`):** Cambio radical de título ("Propuesta de Cartera Alternativa"), mostrando la tarjeta de desviación Volatilidad Objetivo vs Alcanzada.
   - **En el PDF:** Un disclaimer legal obligatorio ("La propuesta expuesta es la mejor alternativa factible dadas las restricciones impuestas, pero difiere del riesgo objetivo en un X%").

8. **¿El copy actual es claro para banca privada?**
   **No.** "Solver de respaldo" es jerga de ingeniería/cuantitativa. Un banquero o cliente final no sabe qué es un solver.

9. **¿Hay riesgo de que el asesor interprete fallback como óptimo puro?**
   **Alto.** Al no desglosarse la diferencia en riesgo ni alertarse adecuadamente, un banquero inexperto creerá que ha cumplido a la perfección el perfil de riesgo del cliente, asumiendo un riesgo potencial de *compliance* y pérdida económica por un perfilamiento fallido encubierto.

## F. Propuesta de Copy Profesional (Para Banca Privada)
- **Título UI/Modal:** "Propuesta de Cartera Alternativa" (sustituyendo a "Resultado Optimización").
- **Toast (Aviso):** "⚠️ Alternativa Generada: Los fondos actuales no permiten alcanzar el perfil objetivo."
- **Caja de Explicación (Sustituto de "Solver de respaldo"):** 
  > *"Dadas las restricciones seleccionadas y el universo de fondos bloqueados, no es matemáticamente posible alinear la cartera exactamente al nivel de riesgo exigido. A continuación le presentamos la alternativa más eficiente (Propuesta de Mejor Esfuerzo)."*
- **Indicador de Desviación:** "Volatilidad Objetivo: X% → Volatilidad Alternativa: Y% (Desviación: Z%)"

## G. Quick Wins sin implementar (Hoja de Ruta)
1. **Tipado:** Extender la interfaz `SmartPortfolioResponse` en `types/index.ts` para aceptar los nuevos campos de volatilidad y fallback.
2. **Toast Diferenciado:** Modificar `usePortfolioActions.ts` para lanzar un `toast.warning` si el estatus es `fallback`.
3. **Modal UI (`OptimizationReviewModal`):**
   - Incorporar nueva tarjeta visual o gráfico de barras comparando `target_vol` vs `achieved_vol`.
   - Modificar el título y subtítulo dinámicamente según si es `optimal` o `fallback`.
   - Sustituir la sección de "Decisión del Optimizador" inyectando el `fallback_reason` del backend en vez del texto estático *hardcodeado*.

## H. Prompt recomendado para implementar si se aprueba

Si el usuario desea ejecutar esta mejora, se recomienda copiar y pegar este prompt en la siguiente fase:

```text
TAREA: Implementar UX Frontend de Fallback de Volatilidad

REGLAS: Frontend-only. No tocar backend.
PASOS:
1. En `types/index.ts`, añade target_vol, achieved_vol, vol_deviation, solver_path y fallback_reason a `SmartPortfolioResponse`.
2. En `usePortfolioActions.ts` (línea ~613), separa el comportamiento de 'fallback':
   - Si no hay cambios en fallback, lanza `toast.warning("⚠️ Alternativa Generada: No se pudo optimizar más con las restricciones actuales.")` en vez del check verde.
3. En `OptimizationReviewModal.tsx`:
   - Cambia dinámicamente el título "Resultado Optimización" a "Propuesta de Cartera Alternativa" si status = 'fallback'.
   - Oculta/reemplaza el aviso técnico de 'solver_fallback_used' por un bloque de advertencia para banca privada, inyectando `fallback_reason`.
   - Crea un nuevo componente visual/tarjeta en el Grid (o en una caja superior) que contraste `target_vol` vs `achieved_vol` explícitamente cuando exista status='fallback'.
```
