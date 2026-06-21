# Informe de Dry-Run Documental — Modificación de Reglas para Perfiles Agresivos (P8, P9, P10)
**Identificador de la Tarea:** `BDB-OPT-AGGRESSIVE-PROFILES-RULES-DRYRUN-0`

---

## 1. Causa Raíz

La introducción del motor de cumplimiento final (`_validate_optimizer_result` en `optimizer_core.py`) establece una validación estricta post-optimización. Este validador contrasta los pesos finales del portafolio contra las bandas de asignación de activos definidas en Firestore (`system_settings/risk_profiles`), con fallback a la semilla estática local `config.py:RISK_BUCKETS_LABELS`.

El problema se origina debido a la conjunción de tres factores:
1. **Lógica de Look-Through Real:** En lugar de catalogar un fondo de inversión por su etiqueta general, el optimizador desglosa la cartera analizando los componentes subyacentes de cada fondo a través de vectores de exposición real (`eq_vec`, `bd_vec`, `cs_vec`, etc.).
2. **Residuos Administrativos y Liquidez:** Incluso los fondos mutuos o ETFs categorizados como 100% de renta variable (RV/Equity) pura mantienen micro-saldos operativos en caja (Monetario) para gestión de liquidez y pago de comisiones, o pequeños componentes en renta fija (RF/Bond) y otros activos derivados de rebalanceos.
3. **Bandas Demasiado Restrictivas:** Con las reglas actuales, los límites de exposición máxima para perfiles agresivos (especialmente P10) exigen un cumplimiento exacto y draconiano de `equity = 100%` con topes rígidos de `0%` para cualquier otra clase de activo. 

Al proyectar los pesos del portafolio optimizado contra estos vectores look-through, la mínima desviación física de los fondos reales (p. ej., un fondo de RV que contiene un $2.04\%$ de caja residual) se propaga en el cálculo global, violando los límites superiores de `bond`, `cash` y `other`. Esto provoca que el motor califique el resultado como **`fallback_non_compliant`**, y el frontend, siguiendo las políticas de seguridad implementadas, bloquee el flujo impidiendo que el cliente visualice o aplique su propuesta.

---

## 2. Reglas Actuales

De acuerdo con la semilla de configuración local definida en [config.py](file:///c:/Users/oanti/Documents/BDB-FONDOS/functions_python/services/config.py#L163-L187) (y replicada en Firestore bajo condiciones iniciales), las reglas base y las observadas en runtime son las siguientes:

### A. Semilla Estática en `config.py` (RISK_BUCKETS_LABELS)
| Perfil | Renta Variable (RV) | Renta Fija (RF) | Monetario | Alternativos | Otros | Mixto |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **8** | $85\% - 100\%$ | $0\% - 5\%$ | $0\% - 5\%$ | $0\% - 10\%$ | $0\% - 15\%$ | $0\% - 10\%$ |
| **9** | $95\% - 100\%$ | $0\% - 5\%$ | $0\% - 0\%$ | $0\% - 5\%$ | $0\% - 5\%$ | $0\% - 5\%$ |
| **10** | $95\% - 100\%$ | $0\% - 5\%$ | $0\% - 5\%$ | $0\% - 5\%$ | $0\% - 0\%$ | $0\% - 5\%$ |

### B. Estado en Caliente Reportado por el Usuario (Firestore `risk_profiles`)
> [!WARNING]
> Los datos en runtime sugieren que el documento Firestore vivo para el **Perfil 10** ha sido endurecido manualmente o mediante procesos de configuración previa, requiriendo límites absolutos:
> - **Renta Variable (RV) Mínimo:** $100\%$
> - **Resto de Buckets (RF, Monetario, Otros, Alternativos) Máximo:** $0\%$

Esta restricción extrema de $100\%$ de RV neta por look-through es la causante directa de los fallos constantes de cumplimiento en producción.

---

## 3. Reglas Nuevas Propuestas

Para corregir los falsos positivos por residuos look-through sin desvirtuar la naturaleza de alta exposición agresiva de estos portafolios, se proponen los siguientes límites:

### Perfil 8: Crecimiento Agresivo Moderado
* **Renta Variable (RV):** $85\% - 100\%$ (Mantiene suelo de alta convicción)
* **Renta Fija (RF):** $0\% - 10\%$ (Amplía holgura de volatilidad amortiguada)
* **Monetario:** $0\% - 8\%$ (Permite acumulación temporal de caja técnica)
* **Alternativos:** $0\% - 10\%$ (Mantiene exposición controlada a satélites)
* **Otros:** $0\% - 5\%$ (Reduce holgura residual para evitar dispersión excesiva)
* **Mixto:** $0\% - 0\%$ (Elimina el bucket Mixto en la optimización real de perfiles agresivos)

### Perfil 9: Crecimiento Agresivo Alto
* **Renta Variable (RV):** $90\% - 100\%$ (Suelo muy alto de convicción)
* **Renta Fija (RF):** $0\% - 7\%$ (Margen acotado pero realista para RF residual)
* **Monetario:** $0\% - 6\%$ (Holgura de caja técnica adaptada a fondos reales)
* **Alternativos:** $0\% - 5\%$ (Margen estrecho de inversión alternativa)
* **Otros:** $0\% - 4\%$ (Control estricto de residuos no clasificados)
* **Mixto:** $0\% - 0\%$ (Elimina exposición mixta)

### Perfil 10: Renta Variable Pura con Holguras Técnicas Realistas
* **Renta Variable (RV):** $95\% - 100\%$ (Permite hasta un $5\%$ de residuos de liquidez/RF técnica subyacente en fondos agresivos)
* **Renta Fija (RF):** $0\% - 3\%$ (Límite ultra-ajustado pero viable para deuda residual look-through)
* **Monetario:** $0\% - 5\%$ (Caja de liquidez normal de los fondos mutuos)
* **Alternativos:** $0\% - 3\%$ (Holgura mínima para clasificaciones alternativas no deseadas)
* **Otros:** $0\% - 3\%$ (Margen mínimo de tolerancia para activos sin categorizar)
* **Mixto:** $0\% - 0\%$ (Elimina exposición mixta)

---

## 4. Justificación Financiera

La gestión moderna de portafolios institucionales a través de **look-through** exige un replanteamiento matemático de los límites regulatorios o comerciales:

1. **La Falsa Identidad del 100%:** Un inversor que desea estar "100% expuesto a acciones globales" compra fondos de Renta Variable (p. ej., indexados al S&P 500 o MSCI World). Financieramente, su **intención de inversión es del 100% en RV**. Sin embargo, la **realidad física subyacente** del fondo elegido siempre revelará un porcentaje menor ($97.5\%$ acciones, $2\%$ liquidez operativa, $0.5\%$ otros). Exigir un límite estricto de $100\%$ look-through en RV obliga al optimizador a buscar fondos inexistentes o a declarar inviabilidad matemática.
2. **Control de Estilo de Cartera (Mixto = 0%):** En perfiles agresivos, la eliminación total de la banda decorativa/residual `Mixto` ($0\%-0\%$) previene el *style drift* (deriva de estilo), asegurando que el motor de optimización no asigne ponderaciones a fondos con estrategias híbridas o mixtas, concentrando el capital exclusivamente en fondos puros.
3. **Resiliencia en Mercados Volátiles:** Al expandir marginalmente los techos de Monetario ($5\%$ en P10) y RF ($3\%$ en P10), permitimos que el optimizador reconozca la estructura física estándar de los fondos comerciales sin rechazar carteras óptimas que son legítima y financieramente coherentes con el perfil de riesgo seleccionado.

---

## 5. ¿Por qué el Perfil 10 no debe exigir un 100% de Look-Through Exacto?

Exigir un $100.00\%$ exacto de exposición look-through en acciones para el Perfil 10 introduce los siguientes riesgos y fallos de diseño:

* **Inviabilidad en el Solver (Infeasibility):** El solucionador de optimización cuadrática (CVXPY) operará con restricciones contradictorias si el universo de fondos de Renta Variable seleccionables contiene, de media, un $1.5\%$ o $2\%$ de caja operativa. La única solución matemáticamente admisible sería no invertir, derivando en fallos catastróficos de factibilidad.
* **Sesgo de Selección de Activos:** Forzaría al gestor del catálogo a seleccionar fondos menos eficientes o menos líquidos solo porque su gestor reporta un saldo de caja artificialmente bajo, deteriorando el rendimiento potencial y la calidad crediticia/operativa del portafolio del cliente.
* **Degradación de Experiencia de Usuario:** La presencia de un decimal imprevisto de caja en cualquier fondo del catálogo activaría el gate de incumplimiento del validador final, forzando fallbacks constantes e impidiendo la autogestión de rebalanceos.

---

## 6. Validación del Payload Real contra las Nuevas Reglas

Para demostrar la efectividad de las nuevas reglas, se realiza el dry-run matemático sobre el payload de datos reales reportado por el usuario para el **Perfil 10**:

### Datos del Payload Real:
* **Exposición a Renta Variable (equity):** $97.5607\%$ ($0.975607$)
* **Exposición a Renta Fija (bond):** $0.1692\%$ ($0.001692$)
* **Exposición a Monetario (cash):** $2.0473\%$ ($0.020473$)
* **Exposición a Otros (other):** $0.2228\%$ ($0.002228$)
* **Exposición a Alternativos (alternative):** $0.0000\%$ ($0.000000$)
* **Exposición a Mixto (mixed):** $0.0000\%$ ($0.000000$)

### Evaluación de Cumplimiento bajo Nuevos Límites (P10):
```python
# Simulación algorítmica del validador final _validate_optimizer_result
actual_portfolio = {
    "equity": 0.975607,
    "bond": 0.001692,
    "cash": 0.020473,
    "other": 0.002228,
    "alternative": 0.0,
    "mixed": 0.0
}

proposed_limits = {
    "equity": (0.95, 1.00),
    "bond": (0.00, 0.03),
    "cash": (0.00, 0.05),
    "alternative": (0.00, 0.03),
    "other": (0.00, 0.03),
    "mixed": (0.00, 0.00)
}

def evaluate_dryrun(portfolio, limits):
    violations = []
    for asset_class, bounds in limits.items():
        min_val, max_val = bounds
        actual_val = portfolio.get(asset_class, 0.0)
        
        if min_val is not None and actual_val < min_val - 1e-4:
            violations.append(f"BUCKET_MIN_VIOLATION for {asset_class}: actual {actual_val:.6f} < min {min_val:.6f}")
        if max_val is not None and actual_val > max_val + 1e-4:
            violations.append(f"BUCKET_MAX_VIOLATION for {asset_class}: actual {actual_val:.6f} > max {max_val:.6f}")
            
    return len(violations) == 0, violations

compliant, errors = evaluate_dryrun(actual_portfolio, proposed_limits)
print(f"Compliant: {compliant}, Errors: {errors}")
```

### Tabla Comparativa de Resultados:
| Bucket | Exposición Real (%) | Nueva Regla (%) | Estado | Observación |
| :--- | :---: | :---: | :---: | :--- |
| **RV (equity)** | $97.5607\%$ | $95.0\% - 100.0\%$ | **✅ COMPLIANT** | Cumple holgadamente el nuevo suelo realista de $95\%$. |
| **RF (bond)** | $0.1692\%$ | $0.0\% - 3.0\%$ | **✅ COMPLIANT** | Perfectamente dentro de la holgura del $3\%$ para renta fija residual. |
| **Monetario (cash)**| $2.0473\%$ | $0.0\% - 5.0\%$ | **✅ COMPLIANT** | Absorbe el saldo residual estándar de liquidez del fondo ($2.04\%$). |
| **Otros (other)** | $0.2228\%$ | $0.0\% - 3.0\%$ | **✅ COMPLIANT** | Tolera desviaciones mínimas de activos inclasificables. |
| **Alternativos** | $0.0000\%$ | $0.0\% - 3.0\%$ | **✅ COMPLIANT** | Sin exposición, pasa el límite de seguridad. |
| **Mixto** | $0.0000\%$ | $0.0\% - 0.0\%$ | **✅ COMPLIANT** | Garantiza la ausencia total de fondos mixtos híbridos. |

**Resultado Global del Dry-Run:** **100% CUMPLIENTE (COMPLIANT).** La propuesta elimina con éxito todos los bloqueos algorítmicos para carteras reales de perfil agresivo alto.

---

## 7. Plan de Write Controlado en Firestore

> [!IMPORTANT]
> El documento Firestore `system_settings/risk_profiles` es la fuente canónica de verdad. Cualquier actualización en caliente debe seguir un estricto protocolo de escritura segura para evitar la corrupción de perfiles del 1 al 7.

### Pasos Operativos:
1. **Extracción y Snapshot en Vivo:**
   Extraer el contenido en caliente actual de Firestore para garantizar un respaldo seguro y preciso:
   ```bash
   # Comando conceptual para volcar el documento a snapshot local
   firebase firestore:get system_settings/risk_profiles > artifacts/aggressive_profiles_rules_update_0/snapshot_firestore_live.json
   ```
2. **Verificación de Discrepancias:**
   Comparar `snapshot_firestore_live.json` contra `snapshot_before.json`. En caso de que se detecten diferencias en los perfiles 1-7, se debe regenerar el manifiesto local para prevenir regresiones accidentales.
3. **Generación del Payload Parcial:**
   El payload a escribir debe contener únicamente las claves modificadas (`8`, `9` y `10`) y aplicarse mediante semántica de combinación parcial (*merge*):
   ```json
   {
     "8": {
       "RV":           [0.85, 1.00],
       "RF":           [0.00, 0.10],
       "Monetario":    [0.00, 0.08],
       "Alternativos": [0.00, 0.10],
       "Otros":        [0.00, 0.05],
       "Mixto":        [0.00, 0.00]
     },
     "9": {
       "RV":           [0.90, 1.00],
       "RF":           [0.00, 0.07],
       "Monetario":    [0.00, 0.06],
       "Alternativos": [0.00, 0.05],
       "Otros":        [0.00, 0.04],
       "Mixto":        [0.00, 0.00]
     },
     "10": {
       "RV":           [0.95, 1.00],
       "RF":           [0.00, 0.03],
       "Monetario":    [0.00, 0.05],
       "Alternativos": [0.00, 0.03],
       "Otros":        [0.00, 0.03],
       "Mixto":        [0.00, 0.00]
     }
   }
   ```
4. **Ejecución Segura con Merge Gate:**
   Para aplicar el parche sin riesgo de sobrescribir y eliminar la configuración de los perfiles del 1 al 7:
   ```python
   # Script conceptual de aplicación controlada
   db.collection('system_settings').document('risk_profiles').set(patch_payload, merge=True)
   ```
   > [!CAUTION]
   > **Prohibido** usar `.set(patch_payload)` sin la opción `merge=True`. Omitir este parámetro provocaría la destrucción inmediata de las reglas de los perfiles del 1 al 7 en la base de datos de producción.
5. **Validación Posterior:**
   Efectuar una lectura inmediata y comprobar que las claves 1-7 permanecen idénticas y que las claves 8-10 reflejan los nuevos intervalos de forma exacta.
6. **Sincronización del Seed Local:**
   Una vez consolidado el cambio en Firestore, se procederá a actualizar el seed en `functions_python/services/config.py:RISK_BUCKETS_LABELS` en un commit de mantenimiento independiente para mantener la coherencia en caso de fallos catastróficos de red.

---

## 8. Plan de Rollback

Si la modificación de reglas provocara un comportamiento no deseado del solver en producción o inconsistencias imprevistas, se activará el plan de restauración inmediata:

1. **Recuperación del Respando Real:**
   Cargar el contenido original almacenado en `artifacts/aggressive_profiles_rules_update_0/snapshot_before.json` (o `snapshot_firestore_live.json` si se detectaron discrepancias antes de la escritura).
2. **Payload de Rollback Directo:**
   El payload para restaurar los perfiles agresivos al estado original definido en el seed local es:
   ```json
   {
     "8": {
       "RV":           [0.85, 1.00],
       "RF":           [0.00, 0.05],
       "Mixto":        [0.00, 0.10],
       "Monetario":    [0.00, 0.05],
       "Alternativos": [0.00, 0.10],
       "Otros":        [0.00, 0.15]
     },
     "9": {
       "RV":           [0.95, 1.00],
       "RF":           [0.00, 0.05],
       "Mixto":        [0.00, 0.05],
       "Monetario":    [0.00, 0.00],
       "Alternativos": [0.00, 0.05],
       "Otros":        [0.00, 0.05]
     },
     "10": {
       "RV":           [0.95, 1.00],
       "RF":           [0.00, 0.05],
       "Mixto":        [0.00, 0.05],
       "Monetario":    [0.00, 0.05],
       "Alternativos": [0.00, 0.05],
       "Otros":        [0.00, 0.00]
     }
   }
   ```
3. **Escritura del Rollback:**
   ```python
   db.collection('system_settings').document('risk_profiles').set(rollback_payload, merge=True)
   ```
4. **Anulación del Commit Local:**
   En caso de haberse modificado la semilla física en `config.py`, realizar un `git revert` para restablecer el archivo local al baseline estable anterior.

---

## 9. Tests Necesarios

Para garantizar la estabilidad del sistema tras los cambios en las bandas de perfiles, se deben ejecutar y validar las siguientes pruebas automáticas en el entorno de desarrollo y staging:

1. **`test_constraints_canonical_contract`**: Valida que la correspondencia y transformación de etiquetas del español a claves del contrato en inglés (`RV` -> `equity`, `RF` -> `bond`, etc.) se efectúe correctamente y sin pérdidas.
2. **`test_bucket_constraints_dedup`**: Verifica que no ocurra duplicidad ni solapamiento de restricciones de asignación de activos entre `bucket_bounds_v1` (enviado por frontend) y `current_risk_buckets` de Firestore.
3. **`test_optimizer_p0_contracts`**: Comprueba que el optimizador procese correctamente perfiles de riesgo extremos sin generar fallos catastróficos en el solucionador cuadrático de CVXPY.
4. **`test_optimizer_fallback_status_contract`**: Evalúa que, ante una degradación graciosa (failure degradation), el estatus del portafolio se recalifique estrictamente a `fallback_compliant` si cumple con los nuevos límites relajados, o a `fallback_non_compliant` si los vulnera.
5. **`test_feasibility_precheck`**: Valida que el pre-chequeo determinista no bloquee falsamente portafolios con composiciones realistas en el perfil 10 antes de invocar al solver.
6. **Prueba de Smoke Test de Payload Real (Staging):**
   Inyectar artificialmente al endpoint de optimización el portafolio real del cliente agresivo:
   $$\text{Portfolio} = \{ \text{equity: } 97.56\%, \text{ cash: } 2.04\%, \text{ bond: } 0.17\%, \text{ other: } 0.22\% \}$$
   Verificar que la API retorne exitosamente:
   - `status`: **`optimal_compliant`** (o **`fallback_compliant`** en caso de activarse un fallback matemáticamente compatible).
   - `applicable`: **`True`**.
   - `usable`: **`True`**.
   - `constraint_violations`: **`[]`** (lista vacía).

---

## 10. Confirmación de Restricciones del Dry-Run

Se confirma solemnemente el estricto cumplimiento de las medidas de seguridad y restricción operacional exigidas por el usuario para esta tarea:

* **Firestore writes = 0** ✅ (Ningún dato ha sido escrito en Firestore).
* **deploy = NO** ✅ (No se ha ejecutado despliegue de hosting ni de Cloud Functions).
* **push = NO** ✅ (No se ha realizado subida de commits al servidor remoto).
* **commit = NO** ✅ (Ningún cambio ha sido confirmado en la rama local de Git).
* **BDB-FONDOS-CORE tocado = NO** ✅ (El código del solucionador matemático, del precheck y del validador permanece intacto, garantizando cero regresiones de código).
* **Alcance Exclusivo:** Solo documentación descriptiva y validación teórica de modelo.
