# Implementación: UX Fallback Optimizador

## A. Resumen Ejecutivo
Se ha implementado satisfactoriamente el rediseño de la experiencia de usuario para los casos en los que el Optimizador devuelve una propuesta alternativa (`fallback`). Se enriquecieron las interfaces de TypeScript, se ajustó la lógica en el controlador de estado y se diseñó una nueva UI en el modal de revisión para comparar de forma explícita la **Volatilidad Objetivo vs. Volatilidad Lograda**, asegurando total transparencia financiera para asesores y clientes de banca privada.

## B. Archivos Modificados
1. `frontend/src/types/index.ts`
2. `frontend/src/hooks/usePortfolioActions.ts`
3. `frontend/src/components/modals/OptimizationReviewModal.tsx`

## C. Cambios Exactos por Archivo

### `frontend/src/types/index.ts`
Se extendió la interfaz `SmartPortfolioResponse` y `explainability` para tipar correctamente los nuevos campos matemáticos procedentes del backend de Python:
- `target_vol?: number;`
- `achieved_vol?: number;`
- `vol_deviation?: number;`
- `fallback_reason?: string;`
- `solver_path?: string;`

### `frontend/src/hooks/usePortfolioActions.ts`
Se interceptó el flujo cuando `result.status === 'fallback'`:
- Se unificaron y empaquetaron los campos de volatilidad y fallback dentro de `enhancedExplainability`.
- Se lanzó explícitamente un `toast.warning()` en lugar del genérico de éxito, alertando al usuario antes de abrir el modal.
- Se previno el mensaje "✅ La cartera ya está optimizada" si la respuesta es de tipo fallback, sin importar si no hubo cambios de pesos.

### `frontend/src/components/modals/OptimizationReviewModal.tsx`
- **Título dinámico:** Si es fallback, el título del modal cambia de "Resultado Optimización" a "Propuesta de Cartera Alternativa".
- **Nueva Tarjeta de Advertencia (Mejor Esfuerzo):** Se eliminó el pequeño banner técnico de "solver de respaldo" y se insertó una caja de alerta destacada (color ámbar).
- **Inyección del motivo real:** Se inyecta el `fallback_reason` directamente emitido por el backend.
- **Grilla de Volatilidad Comparada:** Se muestran 3 bloques en formato porcentual explícito para que el asesor pueda evaluar el delta de riesgo: `Volatilidad Objetivo`, `Volatilidad Lograda` y `Desviación`.

## D. Copy Final Usado
**Toast:**
> "⚠️ Propuesta alternativa generada: no se pudo alcanzar exactamente el objetivo con las restricciones actuales."

**Modal (Título):**
> "Propuesta de Cartera Alternativa"

**Modal (Caja Explicativa):**
> "⚠️ Propuesta de Mejor Esfuerzo: Dadas las restricciones seleccionadas y el universo disponible, no ha sido posible alcanzar exactamente el nivel de riesgo objetivo. Se muestra la mejor alternativa factible."
> "Motivo: [Razón inyectada por el backend]"

## E. Cómo se muestran target_vol, achieved_vol y vol_deviation
Aparecen bajo la caja explicativa de "Mejor Esfuerzo", con una separación sutil. Se formatean matemáticamente de este modo:
- **Volatilidad Objetivo:** `(target_vol * 100).toFixed(2)%`
- **Volatilidad Lograda:** `(achieved_vol * 100).toFixed(2)%`
- **Desviación:** `(vol_deviation * 100).toFixed(2)%` (color `text-rose-600` para enfatizar el desvío).
La lógica es defensiva: la tarjeta solo se renderiza si los valores existen, evitando que la UI se rompa si el backend falla en su envío.

## F. Resultado de Build y Tests
- Comando ejecutado: `npm run build`
- Resultado: `✓ built in 7.86s`. Sin errores de TypeScript.
- **Validación Visual Recomendada:** Dado que este es un cambio visual que requiere desencadenar un evento desde el backend con una cartera infactible que el solver intercepte con `fallback`, se recomienda iniciar el entorno local (`npm run dev`) y lanzar un escenario imposible (ej. Riesgo Agresivo P10 con todos los fondos bloqueados a monetarios) para observar la UI y confirmar que fluyen correctamente los datos desde Python hacia React.

## G. Riesgos Pendientes
- **Informes PDF:** Actualmente la lógica en `pdfGenerator.ts` / `XRayPage.tsx` no incluye una inyección explícita del estado de fallback en el informe final. Aunque la UI alerta fuertemente al asesor, el PDF generado omitirá este disclaimer. Se recomienda abordar esto en la siguiente iteración de reporteo.

## H. Reversión
Al ser un desarrollo frontend-only, los cambios pueden revertirse completamente con:
```bash
git checkout -- frontend/src/types/index.ts
git checkout -- frontend/src/hooks/usePortfolioActions.ts
git checkout -- frontend/src/components/modals/OptimizationReviewModal.tsx
```

## I. Confirmación Explícita
Certifico bajo estricto cumplimiento:
- **NO** se modificó el backend (`functions_python/`).
- **NO** se ejecutó ningún deploy.
- **NO** se ejecutó `git push`.
- **NO** se modificaron `firestore.rules`.
- **NO** se tocaron claves, secretos ni credenciales.
