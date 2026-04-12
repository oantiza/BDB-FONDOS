# Manual de Usuario — BDB-FONDOS: Gestor de Fondos

**Versión:** 1.0  
**Fecha:** Marzo 2026  
**Plataforma:** Aplicación Web (React + Firebase)

---

## Índice

1. [Introducción General](#1-introducción-general)
2. [Acceso y Autenticación](#2-acceso-y-autenticación)
3. [Módulo 1 — Dashboard Principal](#3-módulo-1--dashboard-principal)
4. [Módulo 2 — Universo de Inversión (Sidebar)](#4-módulo-2--universo-de-inversión-sidebar)
5. [Módulo 3 — Cartera de Fondos](#5-módulo-3--cartera-de-fondos)
6. [Módulo 4 — Control Operativo (Optimización)](#6-módulo-4--control-operativo-optimización)
7. [Módulo 5 — Análisis X-Ray de Cartera](#7-módulo-5--análisis-x-ray-de-cartera)
8. [Módulo 6 — Analítica Avanzada](#8-módulo-6--analítica-avanzada)
9. [Módulo 7 — Macro y Estrategia](#9-módulo-7--macro-y-estrategia)
10. [Módulo 8 — Simulador de Jubilación](#10-módulo-8--simulador-de-jubilación)
11. [Módulo 9 — Comparador](#11-módulo-9--comparador)
12. [Módulo 10 — Análisis de Posiciones (Retrocesiones)](#12-módulo-10--análisis-de-posiciones-retrocesiones)
13. [Módulo 11 — Modales y Herramientas Auxiliares](#13-módulo-11--modales-y-herramientas-auxiliares)
14. [Módulo 12 — Generación de Informes PDF](#14-módulo-12--generación-de-informes-pdf)
15. [Taxonomía y Clasificación de Activos](#15-taxonomía-y-clasificación-de-activos)
16. [Arquitectura Técnica (Resumen)](#16-arquitectura-técnica-resumen)
17. [Resolución de Problemas Frecuentes](#17-resolución-de-problemas-frecuentes)

---

## 1. Introducción General

**BDB-FONDOS** es una plataforma profesional de análisis, optimización y reporting de carteras de fondos de inversión. Está diseñada para asesores financieros y gestores de patrimonio que necesitan:

- **Construir carteras** de fondos seleccionando de un universo de más de 1.000 fondos categorizados.
- **Optimizar** la asignación de pesos mediante algoritmos cuantitativos (Markowitz, maximización Sharpe).
- **Analizar** el riesgo, rentabilidad, correlaciones y distribución geográfica/sectorial de la cartera.
- **Generar informes PDF** profesionales para clientes (informe completo y resumen).
- **Simular escenarios** de jubilación con cálculo de EPSV, fiscalidad diferenciada y proyecciones temporales.
- **Monitorizar** el entorno macroeconómico con informes de estrategia y asignación táctica.

### Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Python (Firebase Cloud Functions) |
| Base de Datos | Google Firestore |
| Autenticación | Firebase Authentication |
| Hosting | Firebase Hosting |
| Motor Cuantitativo | Python (NumPy, SciPy) |
| Gráficos | Recharts |
| PDF | html2canvas + jsPDF |

---

## 2. Acceso y Autenticación

### Pantalla de Login

Al acceder a la aplicación, se presenta la pantalla de inicio de sesión con el logotipo **"Gestor de Fondos"**.

**Campos requeridos:**
- **Usuario:** Correo electrónico registrado.
- **Contraseña:** Contraseña asociada a la cuenta.

**Acciones disponibles:**
- Hacer clic en el icono del ojo (👁) para mostrar/ocultar la contraseña.
- Pulsar **"ENTRAR AL GESTOR"** o la tecla **Enter** para iniciar sesión.

**Notas:**
- La autenticación se realiza contra Firebase Authentication.
- Si las credenciales son incorrectas, se muestra un mensaje de error.
- Al autenticarse, el sistema sincroniza automáticamente los **perfiles de riesgo dinámicos** desde la base de datos.

### Cierre de Sesión

Desde cualquier vista, el botón **"Salir"** en la esquina superior derecha de la barra de navegación permite cerrar la sesión.

---

## 3. Módulo 1 — Dashboard Principal

El Dashboard es la vista central de la aplicación. Se divide en **cuatro áreas principales** dispuestas en una cuadrícula:

### 3.1 Distribución de Pantalla

| Área | Ubicación | Contenido |
|---|---|---|
| **Sidebar** (Universo de Inversión) | Columna izquierda (15%) | Catálogo de fondos disponibles |
| **Zona Central** | Columna central (58%) | Gráficos + Tabla de cartera |
| **Panel Derecho** | Columna derecha (27%) | Distribución de activos + Controles |

### 3.2 Cabecera (Header)

La barra superior contiene los botones de navegación:

| Botón | Función |
|---|---|
| **Análisis de Cartera** | Abre el módulo X-Ray completo |
| **★ Comparador** | Abre el comparador de carteras/fondos |
| **Posiciones** | Abre el analizador de posiciones |
| **Macro y Estrategia** | Abre el dashboard macroeconómico |
| **Jubilación** | Abre el simulador de jubilación |
| **Salir** | Cierra la sesión |

### 3.3 Gráficos del Dashboard

**Frontera Eficiente (Riesgo vs Retorno 3Y):**
- Muestra la curva de la frontera eficiente de Markowitz.
- Los puntos individuales representan cada fondo de la cartera.
- El punto dorado (★) indica la posición actual de la cartera.
- Permite identificar visualmente si la cartera es eficiente o no.

**Métricas Clave:**
- Tarjetas resumen con métricas para periodos de 1 año, 3 años y 5 años.
- Incluye: Rentabilidad (CAGR), Volatilidad, Ratio Sharpe, Máximo Drawdown.
- Muestra la tasa libre de riesgo actual (RF).

### 3.4 Widget de Distribución de Activos

Panel derecho superior que muestra:
- **Distribución por clase de activo** (RV, RF, Monetario, Mixto, Alternativos).
- **Distribución geográfica** (regiones de exposición de los fondos).
- Representación visual mediante gráficos de tipo donut y barras.

### 3.5 Calidad de Datos

Un badge de calidad indica el grado de completitud de los datos de la cartera (A+, A, B, C), evaluando:
- Presencia de datos históricos.
- Clasificación V2 completa.
- Métricas de rendimiento disponibles.

---

## 4. Módulo 2 — Universo de Inversión (Sidebar)

### Descripción

El panel lateral izquierdo permite explorar todo el universo de fondos disponibles en la base de datos (colección `funds_v3` de Firestore).

### Funcionalidades

**Filtro por Clase de Activo:**
Dropdown con las siguientes categorías:
- *Grandes Bloques:* Renta Variable (General), Renta Fija (General), Monetario, Mixto, Alternativos.
- *Sectores RV:* Tecnología, Salud.
- *Especialización RF:* Deuda Gubernamental, Deuda Corporativa, Alto Rendimiento (HY).

**Buscador:**
- Campo de texto para buscar por **nombre del fondo** o **código ISIN**.
- La búsqueda es inmediata (filtrado en tiempo real).

**Toggle "Mostrar sin histórico":**
- Por defecto, solo muestra fondos con datos históricos verificados (colección `historico_vl_v2`).
- Activar el toggle muestra todos los fondos, incluyendo aquellos sin histórico.
- Un indicador ⚠️ marca los fondos sin datos históricos confirmados.

**Información mostrada por fondo:**
- Nombre del fondo.
- Código ISIN.
- Clasificación V2 (tipo y subtipo del activo).

**Acciones por fondo:**
- **Clic en el nombre:** Abre el modal de detalle del fondo (`FundDetailModal`).
- **Botón "AÑADIR":** Agrega el fondo a la cartera actual (aparece al pasar el cursor).

### Verificación de Histórico

El sistema verifica en segundo plano si cada fondo tiene datos históricos reales en Firestore. Una barra de progreso muestra: *"Comprobando histórico real… X/Y"*.

---

## 5. Módulo 3 — Cartera de Fondos

### Descripción

La tabla de cartera es el componente central donde se gestionan los fondos seleccionados.

### Cabecera de la Cartera

| Elemento | Función |
|---|---|
| **Título** | "Cartera de Fondos (N)" — muestra el número de fondos |
| **Bloquear/Desbloquear Todos** | Bloquea o desbloquea todos los fondos simultaneamente |
| **Auto-completar** | Sugiere fondos adicionales para llegar al número objetivo |
| **Capital** | Muestra el capital total invertido (editable haciendo clic) |
| **Exportar CSV** (↓) | Exporta la cartera actual a formato CSV |
| **Importar CSV** (↑) | Importa una cartera desde un archivo CSV |
| **Vaciar Cartera** (🗑) | Elimina todos los fondos de la cartera (con confirmación) |

### Información por Fondo en la Tabla

Cada fila de la tabla muestra:
- **Nombre** del fondo (clic para ver detalle).
- **ISIN** del fondo.
- **Peso (%):** Porcentaje de asignación (editable).
- **Importe (€):** Calculado automáticamente según capital total × peso.
- **Volatilidad** anualizada.
- **Candado** (🔒/🔓): Indica si el fondo está bloqueado para optimización.

### Acciones por Fondo

| Acción | Descripción |
|---|---|
| **Editar peso** | Hacer clic en la celda del peso y modificar el valor |
| **Bloquear/Desbloquear** | El candado protege el fondo durante la optimización; su peso no será modificado |
| **Swap (Intercambiar)** | Abre el modal de intercambio con alternativas similares |
| **Eliminar** | Quita el fondo de la cartera |

### Formato CSV de Importación/Exportación

El archivo CSV debe contener las columnas: `ISIN`, `Weight` (peso en porcentaje).

---

## 6. Módulo 4 — Control Operativo (Optimización)

### Descripción

El panel de controles en la parte inferior derecha del Dashboard permite configurar y ejecutar la optimización de la cartera.

### Parámetros de Configuración

**Perfil de Riesgo (1–10):**
- Slider deslizante de Conservador (1) a Agresivo (10).
- Cada nivel define:
  - Exposición mínima a Renta Variable.
  - Banda objetivo de volatilidad anualizada.
  - Restricciones máximas a efectivo/bonos.

| Nivel | Perfil | Volatilidad Objetivo |
|---|---|---|
| 1 | Defensivo | ~2.5% |
| 2–3 | Conservador | ~4–6% |
| 4–5 | Moderado | ~8–10% |
| 6–7 | Equilibrado | ~12–16% |
| 8–9 | Dinámico | ~18–24% |
| 10 | Agresivo | ~30% |

**Número de Fondos (4–20):**
- Define cuántos fondos tendrá la cartera optimizada.

**Modo VIP (💎):**
- Permite marcar fondos como "prioritarios" (VIP).
- Los fondos VIP tienen prioridad en la optimización y no serán eliminados.

### Botones de Acción

| Botón | Función |
|---|---|
| **✨ Generar** | Genera una cartera manual basada en los parámetros seleccionados |
| **🚀 Optimizar** | Ejecuta la optimización cuantitativa completa (Markowitz) en el backend |
| **⚡ Sharpe** | Abre el Maximizador de Sharpe para encontrar el fondo que más mejoraría la cartera |
| **🧮 Costes** | Abre el simulador de costes (TER, comisiones) |
| **📁 Carteras** | Abre el gestor de carteras guardadas |
| **🛡️ Revisión** | Abre la comparativa táctica (antes/después) |
| **🎚️ Ajuste** | Abre el ajuste macro-táctico de la cartera |

### Flujo de Optimización

1. El usuario configura los parámetros (riesgo, nº fondos, VIP).
2. Pulsa **"Optimizar"**. El sistema envía la solicitud al backend Python.
3. El motor cuantitativo:
   - Descarga datos históricos de precios (3 años).
   - Calcula la matriz de covarianza.
   - Resuelve la optimización convexa (maximizar Sharpe, minimizar varianza, o mixta).
   - Aplica restricciones de suitability (mínimos/máximos por tipo de activo).
4. Se presenta la propuesta en un modal de revisión con comparativa **Antes vs Después**.
5. El usuario puede:
   - **Aceptar y Aplicar:** Reemplaza la cartera actual.
   - **Revisar como Táctica:** Abre la comparativa detallada.
   - **Cancelar:** Descarta la propuesta.

---

## 7. Módulo 5 — Análisis X-Ray de Cartera

### Descripción

Vista profunda de análisis de la cartera, accesible desde el botón **"Análisis de Cartera"** en la cabecera.

### Secciones

**1. Tabla de Posiciones (Holdings Table):**
- Lista detallada de cada fondo con:
  - Nombre, ISIN, peso, importe.
  - Volatilidad individual.
  - Clasificación de activo.

**2. Métricas Cuantitativas:**
- CAGR (Tasa de crecimiento anual compuesto).
- Volatilidad anualizada.
- Ratio Sharpe.
- Máximo Drawdown.
- Sortino Ratio.
- Beta vs benchmark.

**3. Asignación de Activos:**
- **Distribución Global:** Donut con el breakdown por clase de activo.
- **Distribución por Categoría:** Detalle granular (RV Global, RV Sectorial, RF Soberana, etc.).
- **Distribución Geográfica:** Exposición por regiones (Norteamérica, Europa, Asia-Pacífico, etc.).

**4. StyleBox (Morningstar):**
- **Equity StyleBox:** Posición de la cartera según capitalización (Large/Mid/Small) y estilo (Value/Blend/Growth).
- **Fixed Income StyleBox:** Posición según calidad crediticia (High/Med/Low) y duración (Short/Med/Long).

**5. Evolución Comparativa:**
- Gráfico de líneas mostrando la evolución histórica de cada fondo de la cartera.
- Permite visualizar divergencias y correlaciones.

**6. Frontera Eficiente:**
- Gráfico ampliado de la frontera eficiente con todos los puntos de los fondos.
- Punto dorado indica la cartera actual.
- Optimización Markowitz (3Y).

### Generación de Informes

Desde esta vista se pueden generar dos tipos de informes:

| Tipo | Contenido |
|---|---|
| **📄 Completo** | Portada + Índice + Composición + Métricas + Gráficos avanzados + Guía de interpretación + Plan de ejecución opcional |
| **📊 Resumen** | Portada + Composición + Métricas + Gráficos avanzados + Guía |

**Configuración del informe:**
- Nombre del cliente (opcional).
- Opción de añadir un **Plan de Ejecución** (texto libre con instrucciones de compra/venta/rebalanceo).

---

## 8. Módulo 6 — Analítica Avanzada

### Descripción

Vista analítica profunda, accesible desde el botón **"📈 Analítica Avanzada"** en la cabecera del X-Ray.

### Secciones

**1. Evolución Histórica:**
- Gráfico de evolución de la cartera vs un benchmark sintético configurable.
- **Benchmarks disponibles:** Conservador, Moderado, Equilibrado, Dinámico, Agresivo.
- **Periodos seleccionables:** 1 año, 3 años, 5 años.

**2. Mapa de Riesgo/Retorno:**
- Scatter plot con:
  - Punto de la cartera actual.
  - Puntos de los benchmarks sintéticos (perfiles de riesgo).
- Explicación textual automática que compara la cartera con el perfil seleccionado.
- Ejemplo: *"Su cartera muestra una volatilidad del **8.5%** con un retorno anualizado del **6.2%**, situándose entre los perfiles **Conservador** y **Moderado**."*

**3. Matriz de Correlación:**
- Heatmap interactivo mostrando la correlación entre todos los fondos de la cartera.
- Escala de colores: Verde (correlación baja/negativa) a Rojo (correlación alta/positiva).
- Permite identificar pares de fondos altamente correlacionados (candidatos a reducción).

**4. Análisis de Correlaciones (IA):**
- Botón **"Análisis de correlaciones"** ejecuta un análisis avanzado en el backend.
- Identifica clusters, redundancias y oportunidades de diversificación.

---

## 9. Módulo 7 — Macro y Estrategia

### Descripción

Dashboard de inteligencia macroeconómica y estrategia de inversión. Accesible desde el botón **"Macro y Estrategia"** en la cabecera.

### Pestañas Disponibles

**Táctico (Semanal):**
- Resumen ejecutivo de la semana.
- Pulso de Mercado con 3 tarjetas:
  - **Divisas:** Datos y tendencia (Alcista/Bajista/Neutral).
  - **Materias Primas:** Datos y tendencia.
  - **Oro & Metales:** Datos y tendencia.
- Análisis geopolítico y riesgos de cola.

**Estratégico (Mensual):**
- Ciclo Económico Global (EE.UU., Eurozona, China, Japón).
  - PIB, IPC y estado del ciclo por región.
- Análisis Regional de Renta Variable (tendencia y valuación).
- Renta Fija y Tipos (yield y recomendación de duración).
- Tema del Mes (análisis profundo de una tendencia).
- Riesgos de Cola (probabilidad e impacto).

**Asignación de Activos:**
- Visión de la Casa (titular estratégico).
- Recomendaciones por clase de activo:
  - **Renta Variable:** Geográfico + Sectores con vista (Sobreponderar/Neutral/Infraponderar).
  - **Renta Fija:** Subsectores + Geográfico.
  - **Activos Reales:** Materias Primas + Divisas.

### Fuente de Datos

Los informes se almacenan en la colección `reports` de Firestore con tipos: `WEEKLY`, `MONTHLY`, `STRATEGY`.

---

## 10. Módulo 8 — Simulador de Jubilación

### Descripción

Herramienta avanzada de planificación patrimonial para jubilación. Calcula rentas, fiscalidad EPSV y proyecciones temporales.

### Fase 1: Configuración de Hipótesis

**Parámetros de entrada:**

| Parámetro | Descripción |
|---|---|
| **Ahorros** | Capital financiero total disponible al jubilarse (€) |
| **Revalorización** | Tasa de rentabilidad anual esperada del patrimonio (%) |
| **Pensión Pública** | Mensualidad bruta de la pensión pública (€/mes × 14 pagas) |
| **EPSV Pre-2007** | Capital acumulado con aportaciones anteriores a 2007 (€) |
| **EPSV Post-2007** | Capital acumulado con aportaciones desde 2007 (€) |
| **Rentabilidad EPSV** | Rendimientos generados por cada tramo (€) |
| **Antigüedad** | Años de antigüedad de las aportaciones |

**Modo de Rescate EPSV:**
- **Renta:** 100% del EPSV se cobra como renta periódica.
- **Capital:** 100% del EPSV se cobra como pago único.
- **Mixto:** Un porcentaje como capital y el resto como renta.

**Tipo de Renta:**
- **Temporal:** Renta fija durante un número de años (1–40).
- **Vitalicia (Esperanza de Vida):** Se calcula la duración según tablas actuariales basadas en sexo y edad.
- **Vitalicia Sostenible:** Renta perpetua = Capital × Tasa de revalorización (no consume principal).

**Tasa de actualización de la renta:** Crecimiento anual de la renta (%).

### Fase 2: Resultados

**Panel de Resumen:**
- Renta mensual inicial calculada (€/mes).
- Capital total destinado a generar rentas.
- Efectivo neto de rescate EPSV (si aplica).

**Evento EPSV (si se rescata como capital):**
- Importe bruto rescatado.
- Importe neto tras retenciones fiscales.

**Desglose Fiscal:**
- Base imponible total (pensión + rentas).
- Cuota íntegra de IRPF.
- Tipo efectivo fiscal (%).
- Desglose por tramos de IRPF (Territorio Histórico de Bizkaia).
- Porcentaje exento (si aplica por antigüedad y tipo de renta).

**Proyección Temporal:**
- Gráfico de barras mostrando la evolución de rentas año a año.
- Incluye pensión pública como línea de referencia.
- Muestra el decrecimiento o crecimiento de la renta según el tipo seleccionado.

### Exportación

Botón **"Exportar Informe"** genera un PDF con:
- Cabecera institucional ("Planificación Patrimonial PM").
- Todos los paneles de resultados.
- Gráfico de proyección temporal.

---

## 11. Módulo 9 — Comparador

### Descripción

Módulo de comparación con dos sub-pestañas:

### Comparar Carteras

Permite comparar dos o más carteras guardadas entre sí:
- Métricas de rendimiento lado a lado.
- Diferencias de composición.
- Gráficos comparativos.

### Comparar Fondos

Permite comparar fondos individuales:
- Evolución histórica superpuesta.
- Métricas comparativas (Sharpe, Volatilidad, CAGR).
- Clasificación y regiones.

---

## 12. Módulo 10 — Análisis de Posiciones (Retrocesiones)

### Descripción

Herramienta para analizar posiciones reales importadas desde archivos (CSV/Excel). Accesible desde el botón **"Posiciones"** en la cabecera.

### Funcionalidades

**Importación de Archivos:**
- Soporte para archivos CSV con información de posiciones reales del cliente.

**Tabla de Posiciones Detallada:**
- Lista completa de posiciones con:
  - Nombre del fondo, ISIN.
  - Importe invertido.
  - Porcentaje del total.
  - Clasificación del activo.
  - TER (Total Expense Ratio).
  - Retrocesiones estimadas.

**Análisis de Retrocesiones:**
- Modal comparativo que calcula:
  - Retrocesiones de la cartera actual vs una cartera alternativa.
  - Ahorro potencial en costes.
  - Impacto anual en euros de las comisiones.

---

## 13. Módulo 11 — Modales y Herramientas Auxiliares

### 13.1 Modal de Detalle del Fondo (FundDetailModal)

Se abre al hacer clic en el nombre de un fondo. Muestra:
- Información completa del fondo.
- Histórico de precios.
- Métricas de rendimiento.
- Clasificación detallada (V2).
- Exposición geográfica y sectorial.

### 13.2 Modal de Intercambio (FundSwapModal)

Se abre al pulsar "Swap" en un fondo de la cartera:
- Lista de alternativas similares (mismo tipo, región).
- Comparativa métrica entre el fondo actual y los candidatos.
- Botón para ejecutar el intercambio (reemplaza en la cartera).
- Botón "Refrescar" para buscar nuevas alternativas.

### 13.3 Modal de Costes (CostsModal)

Simulador de impacto de comisiones:
- TER de cada fondo.
- Comisión de suscripción/reembolso.
- Coste total anual de la cartera en € y en puntos básicos.
- Impacto a largo plazo (simulación acumulada).

### 13.4 Modal Táctico (TacticalModal)

Comparativa detallada de la cartera actual vs propuesta:
- Tabla lado a lado con todos los fondos.
- Diferencias de peso resaltadas.
- Métricas comparativas.
- Tasa libre de riesgo (RF) como referencia.
- Acciones: Aceptar, Intercambiar fondos, Cancelar.

### 13.5 Modal Macro-Táctico (MacroTacticalModal)

Ajuste de la cartera basado en visión macroeconómica:
- Proporciona recomendaciones de sobreponderar/infraponderar por clase de activo.
- Permite aplicar ajustes tácticos sobre la cartera actual.

### 13.6 Modal de Revisión de Optimización (OptimizationReviewModal)

Se muestra automáticamente tras una optimización:
- Comparativa detallada: Cartera actual vs Propuesta optimizada.
- Datos de explicabilidad del optimizador.
- Métricas antes/después.
- Botones: Aceptar, Aplicar Directamente, Cerrar.

### 13.7 Maximizador de Sharpe (SharpeMaximizerModal)

Herramienta para encontrar el fondo óptimo a añadir:
- Muestra el Sharpe actual de la cartera.
- Busca en el universo de fondos el que más mejoraría el Sharpe.
- Permite añadir directamente el fondo recomendado.

### 13.8 Carteras Guardadas (SavedPortfoliosModal)

Gestión de carteras persistidas:
- Lista de carteras guardadas con fecha y nombre.
- Acciones: Cargar, Eliminar.
- Guardar la cartera actual con un nombre descriptivo.

### 13.9 Fondos VIP (VipFundsModal)

Gestión de fondos prioritarios:
- Lista de fondos marcados como VIP.
- Buscador para añadir nuevos fondos VIP.
- Los fondos VIP no serán eliminados durante la optimización.

### 13.10 Modal de Análisis de Cartera (PortfolioAnalysisModal)

Resultado del análisis avanzado de correlaciones:
- Detección de clusters de fondos similares.
- Identificación de redundancias.
- Sugerencias de diversificación.
- Métricas de concentración.

### 13.11 Estrategia de Optimización (OptimizationStrategyModal)

Modal previo a la optimización que ofrece opciones de estrategia:
- Número de fondos bloqueados vs nuevos.
- Capital actual.
- Opciones de objetivo: Minimizar riesgo, Maximizar Sharpe, Personalizado.

---

## 14. Módulo 12 — Generación de Informes PDF

### Descripción

El sistema genera informes PDF profesionales directamente desde el navegador.

### Páginas del Informe Completo

| Página | Contenido |
|---|---|
| **Portada** | Logo, título "Informe de Cartera", nombre del cliente (opcional), fecha |
| **Índice** | Tabla de contenidos con secciones del informe |
| **Matriz Macro** | Resumen estratégico macroeconómico (si hay informe vigente) |
| **Composición** (paginada) | Tablas de posiciones detalladas con métricas por fondo |
| **Métricas + Asignación** | Métricas cuantitativas, donuts de distribución, frontera eficiente |
| **Gráficos Avanzados** | Backtest, Mapa de riesgo |
| **Plan de Ejecución** (opcional) | Texto libre con instrucciones de trading |
| **Notas** | Página para notas |
| **Guía de Interpretación** | Explicación de las métricas y gráficos utilizados |

### Proceso de Generación

1. Desde el X-Ray, pulsar **"📄 Completo"** o **"📊 Resumen"**.
2. Si es informe completo:
   - Introducir nombre del cliente (opcional).
   - Elegir si incluir Plan de Ejecución.
   - Si sí: redactar plan en un editor WYSIWYG con formato DIN-A4.
3. El sistema renderiza cada página HTML → Canvas → PDF.
4. Se descarga automáticamente el archivo PDF.

---

## 15. Taxonomía y Clasificación de Activos

### Taxonomía Canónica V2

Todos los fondos se clasifican con el sistema **classification_v2**:

| Tipo (asset_type) | Descripción |
|---|---|
| `EQUITY` | Renta Variable |
| `FIXED_INCOME` | Renta Fija |
| `ALLOCATION` | Mixto / Balanced |
| `MONEY_MARKET` | Monetario |
| `ALTERNATIVE` | Alternativos |

### Subtipos Principales

**Renta Variable:**
- `GLOBAL`, `TECHNOLOGY`, `HEALTHCARE`, `SECTOR_FUND`

**Renta Fija:**
- `GOVERNMENT_BOND`, `CORPORATE_BOND`, `HIGH_YIELD_BOND`

### Precedencia de Datos

| Campo | Prioridad |
|---|---|
| Clasificación | `classification_v2` > `derived.asset_class` > `asset_class` |
| Exposición | `portfolio_exposure_v2` > `derived.portfolio_exposure` |
| Métricas | `std_perf` > `metrics` |

---

## 16. Arquitectura Técnica (Resumen)

### Frontend (React + Vite)

```
frontend/src/
├── pages/          → Vistas principales (Dashboard, X-Ray, Jubilación, etc.)
├── components/     → Componentes reutilizables
│   ├── charts/     → Gráficos (Recharts)
│   ├── modals/     → Modales de acción
│   ├── xray/       → Componentes X-Ray
│   ├── retirement/ → Componentes del simulador
│   ├── macro/      → Dashboard macroeconómico
│   ├── positions/  → Analizador de posiciones
│   └── comparator/ → Comparador de fondos/carteras
├── hooks/          → Custom Hooks (usePortfolio, useDashboardData, etc.)
├── utils/          → Utilidades (rulesEngine, exporters, calculators)
├── types/          → Definiciones TypeScript
└── context/        → Contextos React (Toast, etc.)
```

### Backend (Python Cloud Functions)

```
functions_python/
├── api/
│   ├── endpoints_portfolio.py  → Optimización, Backtest, Frontera, Análisis
│   ├── endpoints_admin.py      → Administración y mantenimiento
│   ├── endpoints_macro.py      → Endpoints macroeconómicos
│   └── schedulers.py           → Tareas programadas
├── services/
│   ├── portfolio/
│   │   ├── optimizer_core.py     → Motor de optimización Markowitz
│   │   ├── frontier_engine.py    → Generador de frontera eficiente
│   │   ├── analyzer.py           → Análisis de correlaciones
│   │   ├── suitability_engine.py → Motor de idoneidad (suitability)
│   │   └── utils.py              → Utilidades de cartera
│   ├── backtester.py     → Motor de backtesting
│   ├── calc_service.py   → Cálculos estadísticos
│   ├── data_fetcher.py   → Descarga de datos de precios
│   ├── nav_fetcher.py    → Descarga de NAVs
│   ├── config.py         → Configuración de perfiles de riesgo
│   ├── pdf_generator.py  → Generación de PDFs (backend)
│   └── research.py       → Servicio de investigación
└── main.py → Punto de entrada (FastAPI)
```

### Base de Datos (Firestore)

| Colección | Contenido |
|---|---|
| `funds_v3` | Catálogo completo de fondos (metadatos, clasificación, métricas) |
| `historico_vl_v2` | Series históricas de precios (NAV) |
| `reports` | Informes macroeconómicos (Weekly, Monthly, Strategy) |
| `system_settings` | Configuración del sistema (perfiles de riesgo dinámicos) |
| `optimizer_snapshots` | Registros de optimizaciones ejecutadas |

---

## 17. Resolución de Problemas Frecuentes

| Problema | Solución |
|---|---|
| **"Error de inicio de sesión"** | Verificar credenciales. Contactar al administrador si el problema persiste. |
| **"Sincronizando parámetros de riesgo..."** (se queda cargando) | Comprobar conexión a internet. Recargar la página. |
| **La cartera no muestra métricas** | Verificar que los fondos tienen datos históricos (✓). Los fondos sin histórico no pueden ser analizados. |
| **Optimización falla con "INFEASIBLE"** | La cartera actual no tiene suficiente diversidad de activos. Aceptar las sugerencias de fondos adicionales. |
| **No se genera el PDF** | Asegurarse de que la cartera tiene al menos 2 fondos con datos. Desactivar bloqueadores de popups. |
| **Fondos sin clasificación V2** | Algunos fondos pueden usar la clasificación legacy. El sistema aplica fallbacks automáticos. |
| **Datos de frontera eficiente vacíos** | Se necesitan al menos 3 fondos con datos históricos de +3 años para calcular la frontera. |
| **Alertas/Warnings en el dashboard** | Los avisos amarillos son informativos. Indicadores de datos parciales o recomendaciones de calidad. |

---

**© 2026 — BDB-FONDOS: Gestor de Fondos. Todos los derechos reservados.**  
*Documento generado automáticamente. Para soporte técnico, contactar al administrador del sistema.*
