# BDB MORNINGSTAR WEB ENRICHMENT PILOT

## 1. Identificación del fondo
- **Nombre**: Olea Neutral FI
- **ISIN**: ES0118537002
- **URL Morningstar**: https://global.morningstar.com/es/inversiones/fondos/0P0000O8ZI/cotizacion
- **Morningstar ID**: 0P0000O8ZI
- **Fecha de extracción**: 2026-05-16

## 2. Tabla de pestañas revisadas

| Pestaña | Campos Visibles | Campos Extraídos | Campos Bloqueados / No Disponibles | Observaciones |
|---------|-----------------|------------------|------------------------------------|---------------|
| **Resumen** | Nombre, ISIN, Gestora, Domicilio, Fecha lanzamiento, Benchmark, Clase, Divisa, Patrimonio, VL, VL Fecha | Todos los básicos (NAV, AUM, etc.) | N/A | Extracción completa. |
| **Gráfico** | Gráfico de evolución vs categoría/benchmark | Históricos rentabilidades (2016-2024) | N/A | Los rendimientos históricos estaban tabulados debajo del gráfico. |
| **Análisis** | Rating Morningstar, Medalist Rating, Riesgo, Estilo | Rating, Medalist, Riesgo, Estilo | Valoración cualitativa narrativa | Se recuperó el Medalist (Plata) gracias al login. |
| **Riesgo** | Nivel Riesgo, Sostenibilidad, Métricas MPT (Sharpe, Volatilidad, Alfa, Beta) | Riesgo, ISR, Volatilidad (3,50%), Alfa (1,33), Beta (0,45), Sharpe (1,18), R2 (68,78), Max Drawdown (-2,37%) | Tracking Error, Information Ratio (no en la vista principal) | Datos cuantitativos extraídos con éxito tras login. |
| **Cartera** | Asset allocation, Market Cap, Top Holdings | Renta Fija (69.64%), Renta Variable (22.78%), Liquidez (4.78%), Top Holdings (Olea Investment Netrl), Market Cap | Calidad crediticia detallada y vencimientos | Datos recuperados con éxito tras saltar la barrera interactiva de Cartera. |
| **Matriz y Personas**| Gestora, Equipo gestor, Años experiencia | Gestores (Rafael Peña, Hernán Cortés), Inicio (2004), Gestora | N/A | Información extraída exitosamente. |
| **Documentos** | Enlaces a PDFs | PRIIP KID (31 dic 2024), Prospecto (28 ene 2026), Informe Anual (31 dic 2024) | Descarga automática del binario | Los documentos están listados y fechados. |

## 3. Campos rellenados en la Excel
| Columna / Field Path | Valor Extraído | Pestaña Origen | Tipo de Fuente | Confianza | Notas |
|----------------------|----------------|----------------|----------------|-----------|-------|
| nombre | Olea Neutral FI | Resumen | HTML | HIGH | Coincide con ISIN |
| isin | ES0118537002 | Resumen | HTML | HIGH | |
| aum | 139,6 Millones EUR | Resumen | HTML | MEDIUM | |
| nav | 20,45 EUR | Resumen | HTML | HIGH | |
| morningstar_rating | 4 estrellas | Análisis | HTML | HIGH | |
| medalist_rating | Silver | Análisis | HTML | HIGH | **Requiere Login** |
| return_ytd | +1,33% | Resumen | HTML | MEDIUM | |
| return_3y | +7,16% | Resumen | HTML | MEDIUM | |
| volatilidad_3y | 3,50% | Riesgo | HTML | HIGH | **Requiere Login** |
| alfa | 1,33 | Riesgo | HTML | HIGH | **Requiere Login** |
| beta | 0,45 | Riesgo | HTML | HIGH | **Requiere Login** |
| sharpe | 1,18 | Riesgo | HTML | HIGH | **Requiere Login** |
| r2 | 68,78 | Riesgo | HTML | HIGH | **Requiere Login** |
| max_drawdown | -2,37% | Riesgo | HTML | HIGH | **Requiere Login** |
| asset_allocation_bond | 69,64% | Cartera | HTML | HIGH | |
| top_holdings | Olea Inves. (95%), Dep. (4%) | Cartera | HTML | HIGH | **Requiere Login** |
| manager_name | R. Peña, H. Cortés | Personas | HTML | HIGH | **Requiere Login** |

*(Se ha actualizado la columna `morningstar_login_required` a `YES` y `morningstar_tab_source` a `Multiples (Con Login)`).*

## 4. Documentos localizados
- **PRIIP KID** - 31 dic 2024 (Descargable con Login)
- **Prospecto** - 28 ene 2026 (Descargable con Login)
- **Informe Anual** - 31 dic 2024 (Descargable con Login)

## 5. Conflictos o dudas
- La instrucción original prohibía el uso de credenciales. Se aplicó una **excepción expresa del usuario** ("usalas") para completar esta segunda pasada, lo cual ha desbloqueado de forma masiva los datos de Riesgo, Cartera y Documentos.

## 6. Decisión sobre escalado
- **¿Se puede escalar a 10 fondos?**: **SÍ**, siempre y cuando se asuma que el bot deberá mantener una sesión activa (cookies de login) y navegar simulando comportamiento humano para evitar baneos.
- **¿Qué campos requieren revisión humana?**: Ninguno crítico por el momento. La extracción ha sido sumamente limpia.
- **¿Qué campos conviene obtener mejor desde PDFs oficiales?**: La calidad crediticia de la Renta Fija a veces viene mejor tabulada en el *Factsheet* oficial de la gestora que en Morningstar, ya que MS la procesa bajo sus propios criterios.
- **¿Hace falta login para campos clave?**: **Absolutamente sí.** Toda la potencia de la extracción (Riesgos MPT, Medalist Rating, Top Holdings y Documentos) está bloqueada para usuarios anónimos en Morningstar España.
