# INFORME COMPLETO DE TIPOGRAFÍA - PDF RESUMEN X-RAY

**Documento:** Informe Resumen de Análisis de Cartera  
**Fecha:** 11 de febrero de 2026  
**Sistema:** BDB Fondos - Frontend

---

## NOTAS DE CONVERSIÓN

**Tailwind CSS a Píxeles:**
- `text-xs` = 12px
- `text-sm` = 14px  
- `text-base` = 16px
- `text-lg` = 18px
- `text-xl` = 20px
- `text-2xl` = 24px
- `text-3xl` = 30px
- `text-4xl` = 36px
- `text-5xl` = 48px
- `text-6xl` = 60px
- `text-7xl` = 72px
- `text-[110px]` = 110px

**Familias de Fuente Utilizadas:**
- **Inter**: Fuente sans-serif moderna para títulos y texto general
- **Fira Code**: Fuente monoespaciada para valores numéricos y códigos
- **Roboto**: Fuente alternativa para ciertos elementos
- **System UI**: Fuente predeterminada del sistema como fallback

---

## 1. PORTADA (Página 1)

### Marca Superior
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| "O.A.A." | 36px (text-4xl) | Inter, sans-serif | Light (300) | Slate 800 | Uppercase, tracking amplio |
| Separador "/" | 36px (text-4xl) | Inter, sans-serif | Light (300) | #004481 | - |
| "Independent Private Bankers" | 16px (text-base) | Inter, sans-serif | Bold (700) | #004481 | Uppercase, tracking 0.2em |

### Título Principal
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| "Análisis de cartera" | 110px | Inter, sans-serif | Bold (700) | Slate 900 | Leading none, tracking tight |
| Nombre del Cliente | 48px (text-5xl) | Inter, sans-serif | Medium (500) | Slate 800 | - |

### Metadatos
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Etiquetas ("NOMBRE DEL ARCHIVO", "FECHA") | 16px (text-base) | Inter, sans-serif | Bold (700) | Slate 500 | Uppercase, tracking widest |
| Valores ("Informe Resumen", fecha) | 24px (text-2xl) | Inter, sans-serif | Light (300) | Slate 900 | - |

---

## 2. ÍNDICE (Página 2)

| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Cabecera: "Contenido del Informe" | 24px (text-2xl) | Inter, sans-serif | Light (300) | Slate 800 | Palabra "Informe" en bold |
| Título "Índice" | 72px (text-7xl) | Inter, sans-serif | Light (300) | #003399 | Tracking tight |
| Títulos de Sección | 48px (text-5xl) | Inter, sans-serif | Light (300) | Slate 800 | - |
| Descripciones | 24px (text-2xl) | Inter, sans-serif | Light (300) | Slate 400 | - |

---

## 3. MATRIZ DE ESTRATEGIA (Página 3 - Opcional)

### Cabecera y Título
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Cabecera: "Visión de Mercado" | 24px (text-2xl) | Inter, sans-serif | Light (300) | Slate 800 | Palabra "Mercado" en bold |
| "Visión de la Casa" | 14px (text-sm) | Inter, sans-serif | Bold (700) | #A07147 | Uppercase, tracking 0.2em |
| Cita de Visión | 36px (text-4xl) | Inter, sans-serif | Light (300) | #2C3E50 | Italic, leading relaxed |

### Elementos de Matriz
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Títulos de Activos ("RV", "RF", "Reales") | 14px (text-sm) | Inter, sans-serif | Bold (700) | #2C3E50 | Uppercase, tracking widest |
| Sub-encabezados (Geográfico, Sectores) | 10px | Inter, sans-serif | Bold (700) | #A07147 | Uppercase, tracking 0.2em |
| Nombres de Items | 14px (text-sm) | Inter, sans-serif | Medium (500) | #1e293b | Tracking tight |

---

## 4. COMPOSICIÓN DE CARTERA (Páginas Variables)

### Cabecera y Títulos
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Cabecera: "Análisis de Cartera" | 30px (text-3xl) | Inter, sans-serif | Light (300) | Slate 800 | Palabra "Cartera" en bold |
| Título Página | 48px (text-5xl) | Inter, sans-serif | Light (300) | #2C3E50 | Tracking tight |

### Tabla
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Encabezados Tabla ("Fondo/Estrategia", "Peso", "Capital") | 20px (text-xl) | Inter, sans-serif | Bold (700) | #A07147 | Uppercase, tracking 0.2em |
| Nombres de Fondos | 20px (text-xl) | Inter, sans-serif | Regular (450) | #2C3E50 | Leading tight |
| Peso (%) | 20px (text-xl) | Fira Code, monospace | Regular (450) | #2C3E50 | Tabular nums, alineado derecha |
| Capital (€) | 20px (text-xl) | Fira Code, monospace | Regular (450) | #2C3E50 | Tabular nums, alineado derecha |
| Fila TOTAL | 30px (text-3xl) | Fira Code, monospace | Medium (550) | #2C3E50 | Tabular nums, tracking tight |

---

## 5. MÉTRICAS Y GRÁFICOS (Página Principal)

### Cabecera y Títulos Principales
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Cabecera: "Análisis de Cartera" | 30px (text-3xl) | Inter, sans-serif | Light (300) | Slate 800 | Palabra "Cartera" en bold |
| "Métricas de Cartera" | 48px (text-5xl) | Inter, sans-serif | Light (300) | Black | Tracking tight |

### Tarjetas de Métricas
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Etiquetas (RENTABILIDAD, VOLATILIDAD, etc.) | 14px (text-sm) | Inter, sans-serif | Bold (700) | #95a5a6 | Uppercase, tracking wide |
| Valores Numéricos | 36px (text-4xl) | Fira Code, monospace | Normal (400) | Variable* | Tabular nums |

*Colores de valores: Rentabilidad/Tasa=#2C3E50, Volatilidad/Max Drawdown=#C0392B, Ratio Sharpe=#4d5bf9

### Títulos de Gráficos
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| "Composición Global", "Diversificación" | 48px (text-5xl) | Inter, sans-serif | Light (300) | Black | Tracking tight |
| Subtítulos ("Por Activo Subyacente", "Por Geografía") | 18px (text-lg) | Inter, sans-serif | Bold (700) | #A07147 | Uppercase, tracking 0.2em, display block |
| "Frontera Eficiente" | 48px (text-5xl) | Inter, sans-serif | Light (300) | Black | Tracking tight |

### Elementos de Gráficos
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Leyenda Donut (nombres activos) | 16px (text-base) | Inter, sans-serif | Medium (500) | #2C3E50 | Uppercase, tracking wider |
| Leyenda Regional (América, Europa, Asia) | 10px | Inter, sans-serif | Bold (700) | Slate 400 | Uppercase, tracking wider |
| Etiquetas Barras Regionales | 15px | Inter, sans-serif | Medium (500) | Slate 700 | - |
| Valores Barras (%) | 15px | Inter, sans-serif | Bold (700) | Slate 800 | Tabular nums |

### Gráfico Frontera Eficiente (Chart.js)
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Leyenda | 10px | Fira Code, monospace | Normal | #64748b/#1e293b* | Point style labels |
| Tooltip - Título | 12px | Inter, sans-serif | Bold | White (sobre #1e293b) | - |
| Tooltip - Cuerpo | 11px | Fira Code, monospace | Normal | White | - |
| Títulos de Ejes | 11px | Inter, sans-serif | Bold | Black/#94a3b8* | - |
| Etiquetas de Ejes (Ticks) | 10px | Fira Code, monospace | Normal | #1e293b/#94a3b8* | Formato % |

*Color más oscuro en printMode

### Texto Descriptivo
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| "Curva de Rendimiento Ideal" | 16px (text-base) | Inter, sans-serif | Bold (700) | #A07147 | Uppercase, tracking widest |
| Descripción | 18px (text-lg) | Inter, sans-serif | Light (300) | Slate 500 | Leading relaxed |

---

## 6. ANÁLISIS AVANZADO (Gráficos Históricos)

### Títulos
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Cabecera: "Análisis Avanzado" | 30px (text-3xl) | Inter, sans-serif | Light (300) | Slate 800 | Palabra "Avanzado" en bold |
| "Evolución Histórica" | 48px (text-5xl) | Inter, sans-serif | Light (300) | #2C3E50 | Tracking tight |
| Subtítulo "(Backtest 3 Años)" | 24px (text-2xl) | Inter, sans-serif | Normal (400) | Slate 400 | - |
| "Mapa de Riesgo/Retorno" | 48px (text-5xl) | Inter, sans-serif | Light (300) | #2C3E50 | Tracking tight |

### Gráfico de Evolución (Line Chart - Chart.js)
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Leyenda | 11px (12px default) | Inter, sans-serif | Normal | #000/#64748b* | - |
| Etiquetas Ejes X (fechas) | 10px | Fira Code, monospace | Normal | #334155/#64748b* | Formato mes/año |
| Etiquetas Ejes Y (valores) | 10px | Fira Code, monospace | Normal | #334155/#64748b* | - |

### Gráfico Mapa de Riesgo (Scatter - Chart.js)
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Títulos de Ejes | 12px | Inter, sans-serif | Bold/Normal* | #1e293b/#64748b* | - |
| Etiquetas de Ejes (Ticks) | 12px | Fira Code, monospace | Normal | #1e293b/#64748b* | - |
| Leyenda | 12px | Fira Code, monospace | Normal | #1e293b/#64748b* | - |
| Etiquetas Benchmarks (en gráfico) | 12px | Inter, sans-serif | Normal | #1e293b/#64748b* | Plugin personalizado |

*Peso y color más intenso en printMode

### Texto Explicativo
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| "Balance de Eficiencia" | 16px (text-base) | Inter, sans-serif | Bold (700) | #A07147 | Uppercase, tracking widest |
| Descripción | 20px (text-xl) | Inter, sans-serif | Light (300) | Slate 500 | Leading relaxed |
| Caja Interpretación (Alpha) | 20px (text-xl) | Inter, sans-serif | Light (300) | #2C3E50 | Palabras clave en bold |

---

## 7. PLAN DE EJECUCIÓN (Página Opcional)

| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Cabecera: "Plan de Ejecución" | 24px (text-2xl) | Inter, sans-serif | Light (300) | Slate 800 | Palabra "Ejecución" en bold |
| Título Página | 48px (text-5xl) | Inter, sans-serif | Light (300) | Black | Tracking tight |
| Texto del Plan | 24px (text-2xl) | Inter, sans-serif | Light (300) | Black | Leading relaxed, whitespace pre-wrap |

---

## 8. NOTAS Y CONCLUSIONES

| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Cabecera: "Observaciones Finales" | 20px (text-xl) | Inter, sans-serif | Light (300) | Slate 800 | Palabra "Finales" en bold |
| Título "Notas y Conclusiones" | 36px (text-4xl) | Inter, sans-serif | Light (300) | Black | Tracking tight |

---

## 9. GUÍA DE INTERPRETACIÓN

### Títulos y Estructura
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Cabecera: "Guía de Interpretación" | 30px (text-3xl) | Inter, sans-serif | Light (300) | Slate 800 | Palabra "Interpretación" en bold |
| Cita Introductoria | 30px (text-3xl) | Inter, sans-serif | Light (300) | #2C3E50 | Italic, leading relaxed, borde izquierdo dorado |

### Secciones
| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Números y Títulos ("1. Volatilidad", etc.) | 24px (text-2xl) | Inter, sans-serif | Bold (700) | #2C3E50 | Uppercase, tracking widest |
| Subtítulos ("El indicador de estabilidad") | 16px (text-base) | Inter, sans-serif | Bold (700) | #A07147 | Uppercase, tracking 0.2em |
| Texto entre paréntesis | 16px (text-base) | Inter, sans-serif | Normal (400) | Slate 400 | Normal case |
| Texto de Interpretación | 20px (text-xl) | Inter, sans-serif | Light (300) | Slate 600 | Leading relaxed, text justify |
| Palabra "Interpretación:" | 20px (text-xl) | Inter, sans-serif | Bold (700) | #2C3E50 | Dentro del párrafo |

---

## PIE DE PÁGINA (Todas las Páginas)

| Elemento | Tamaño | Tipo de Letra | Peso | Color | Notas |
|:---------|:-------|:--------------|:-----|:------|:------|
| Número de Página | 14px (text-sm) | Inter, sans-serif | Light (300) | Slate 400 | Tracking widest, formato 00 |

**Nota:** Se eliminó el texto "| BDB FONDOS" del pie de página por solicitud del usuario.

---

## PALETA DE COLORES UTILIZADA

| Color Hex | Nombre/Uso | Contexto |
|:----------|:-----------|:---------|
| #0B2545 | Navy | Marca principal, gráficos |
| #D4AF37 | Gold | Acentos, marca portfolio |
| #C5A059 | Gold Alt | Gráficos alternativos |
| #A07147 | Bronze | Subtítulos, etiquetas |
| #2C3E50 | Dark Blue-Gray | Texto principal |
| #004481 | Blue | Marca, separadores |
| #003399 | Deep Blue | Título índice |
| #C0392B | Red | Valores negativos/riesgo |
| #4d5bf9 | Indigo | Ratio Sharpe |
| #95a5a6 | Gray | Etiquetas métricas |
| #64748b | Slate 500 | Texto secundario |
| #94a3b8 | Slate 400 | Texto terciario |
| #1e293b | Slate 800 | Texto oscuro |

---

## INFORMACIÓN TÉCNICA

### Sistema de Tipografía
- **Framework CSS:** Tailwind CSS v3.x
- **Renderizado PDF:** HTML to PDF via print styles
- **Gráficos:** Chart.js v4.x con configuraciones personalizadas para printMode

### Familias de Fuente (Stack Completo)
```
Primary: 'Inter', system-ui, -apple-system, sans-serif
Monospace: 'Fira Code', 'Courier New', monospace  
Alternative: 'Roboto', sans-serif
```

### Conversión a Word
Para convertir este documento a formato Word (.docx):

**Opción 1 - Microsoft Word:**
1. Abrir este archivo .md en Visual Studio Code
2. Copiar todo el contenido
3. Pegar en Word
4. Ajustar formato si es necesario

**Opción 2 - Pandoc (Recomendado):**
```bash
pandoc pdf_font_complete_report.md -o informe_tipografia_pdf.docx
```

**Opción 3 - Online:**
- Usar convertidores como https://cloudconvert.com/md-to-docx

---

**Documento generado el:** 11 de febrero de 2026  
**Versión:** 1.0  
**Autor:** Sistema BDB Fondos - Antigravity AI
