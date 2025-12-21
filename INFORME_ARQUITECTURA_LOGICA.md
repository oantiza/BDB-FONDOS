# Informe de Arquitectura y Lógica del Sistema - Fintrader Quant

## 1. Resumen Ejecutivo
El sistema `fintrader_quant` opera bajo una arquitectura híbrida donde la **lógica matemática pesada y el acceso a datos externos** residen en un Backend serverless (Python/Firebase Functions), mientras que la **lógica de interacción, validación inmediata y visualización** se ejecuta en el cliente (Frontend React/TypeScript).

---

## 2. Lógica Backend (Python)
**Ubicación:** `functions_python/services/` y `functions_python/main.py`

Este núcleo es responsable de los cálculos financieros complejos, la integridad de los datos de mercado y la ejecución de algoritmos de optimización que requieren alta capacidad de cómputo.

### Archivos Críticos:

*   **`services/optimizer.py` (El Cerebro Matemático)**
    *   **Función:** Ejecuta la Optimización de Media-Varianza (MVO) utilizando `PyPortfolioOpt`.
    *   **Lógica Clave:**
        *   Cálculo de fronteras eficientes.
        *   Maximización del Ratio de Sharpe.
        *   Minimización de volatilidad bajo restricciones.
        *   `generate_smart_portfolio`: Algoritmo híbrido que combina selección cualitativa (Scoring) con optimización cuantitativa.

*   **`services/backtester.py` (Simulación Histórica)**
    *   **Función:** Valida las carteras propuestas contra datos históricos.
    *   **Lógica Clave:**
        *   Cálculo de retornos acumulados, anualizados (CAGR) y volatilidad.
        *   Generación de matrices de correlación.
        *   Normalización de series temporales para comparación visual.

*   **`services/market.py` (Datos de Mercado)**
    *   **Función:** Interfaz principal con proveedores de datos (Yahoo Finance).
    *   **Lógica Clave:**
        *   Obtención de precios históricos ajustados y dividendos.
        *   Construcción de curvas de tipos (Yield Curves) para análisis macro.
        *   Gestión de cachés para evitar peticiones redundantes.

*   **`main.py` (API Gateway / Orquestador)**
    *   **Función:** Punto de entrada de las Cloud Functions.
    *   **Lógica Clave:**
        *   Enrutamiento de peticiones HTTP a los servicios correspondientes.
        *   Manejo de CORS y autenticación básica.
        *   Serialización de respuestas complejas (Numpy/Pandas a JSON).

---

## 3. Lógica Frontend (TypeScript/React)
**Ubicación:** `frontend/src/`

El frontend no es solo una "cara bonita"; mantiene una copia ligera de la lógica de negocio para permitir una experiencia de usuario fluida sin latencia de red constante.

### Archivos Críticos:

*   **`App.tsx` (Controlador de Estado)**
    *   **Función:** Columna vertebral de la aplicación.
    *   **Lógica Clave:**
        *   Gestión del estado global (cartera actual, datos de mercado cargados).
        *   Orquestación de modales y flujos de usuario (Optimización -> Revisión -> Aceptación).
        *   Sincronización con Firebase Firestore.

*   **`utils/rulesEngine.ts` (Motor de Reglas Cliente)**
    *   **Función:** Réplica de la lógica de selección de fondos para feedback inmediato.
    *   **Lógica Clave:**
        *   `calculateScore`: Puntuación de fondos basada en métricas (Sharpe, OCF, etc.).
        *   `generateSmartPortfolio`: Versión ligera del generador de carteras para uso offline o rápido.
        *   **Nota:** Existe una duplicidad intencional con el backend para permitir funcionamiento híbrido.

*   **`utils/normalizer.ts` (Estandarización)**
    *   **Función:** Limpieza de datos heterogéneos.
    *   **Lógica Clave:**
        *   Conversión de estructuras de datos dispares (CSV, API, Firestore) a un modelo de datos unificado (`PortfolioItem`).

*   **`utils/csvImport.ts` (Ingesta de Datos)**
    *   **Función:** Procesamiento de archivos locales.
    *   **Lógica Clave:**
        *   Parsing de archivos CSV exportados por bancos o herramientas externas.
        *   Detección heurística de columnas (ISIN, Peso, Nombre).

---

## 4. Flujo de Datos General

1.  **Ingesta:** El usuario carga datos (`csvImport.ts`) o selecciona activos (`App.tsx`).
2.  **Validación:** `rulesEngine.ts` valida preliminarmente la calidad de los activos.
3.  **Procesamiento (Backend):**
    *   El usuario solicita optimización -> `main.py` -> `optimizer.py`.
    *   El usuario solicita backtest -> `main.py` -> `backtester.py`.
4.  **Respuesta:** El backend retorna JSON con métricas y series temporales.
5.  **Visualización:** El frontend renderiza gráficos (`chartEngine.js`) y tablas (`App.tsx`).

## 5. Conclusión
La lógica del sistema está claramente estratificada: **Python** maneja la complejidad matemática y los datos externos para asegurar precisión, mientras que **TypeScript** maneja la lógica de presentación y reglas de negocio inmediatas para asegurar usabilidad.
