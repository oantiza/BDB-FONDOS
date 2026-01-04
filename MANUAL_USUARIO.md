# Manual de Usuario - BDB Fondos

Este documento explica cómo instalar, ejecutar y utilizar la aplicación BDB Fondos.

## 1. Requisitos Previos

Asegúrate de tener instalado en tu ordenador:
- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada).
- Git (opcional, para descargar el código).

## 2. Instalación

1. Abre una terminal (PowerShell o CMD).
2. Navega a la carpeta del proyecto:
   ```bash
   cd c:\Users\oanti\Documents\BDB-FONDOS_LOCAL\BDB-FONDOS\frontend
   ```
3. Instala las dependencias necesarias:
   ```bash
   npm install
   ```

## 3. Ejecutar la Aplicación

Para iniciar la aplicación en modo desarrollo (para usarla localmente):

1. En la terminal, dentro de la carpeta `frontend`, ejecuta:
   ```bash
   npm run dev
   ```
2. Verás un mensaje indicando que el servidor está listo, por ejemplo: `Local: http://localhost:5173/`.
3. Abre esa dirección en tu navegador web.

## 4. Funcionalidades Principales

### Dashboard
- **Vista General**: Visualiza el estado actual de los fondos y métricas clave.
- **Gráficos Interactivos**: Explora la distribución de activos (Donut charts) y la evolución histórica.

### Generación de Informes
- Navega a la sección de **Informes** o busca el botón **"Generar PDF"** en el dashboard.
- Al hacer clic, se descargará automáticamente un informe detallado en formato PDF con la estrategia patrimonial, gráficos y tablas de posiciones.

### Herramientas de Administración
El proyecto incluye herramientas para la gestión de datos:

- **Insertar Reportes Manualmente**:
  - Abre el archivo `insert_report.html` ubicado en la raíz del proyecto (`../BDB-FONDOS/insert_report.html`) directamente en tu navegador.
  - Esta herramienta permite conectar con la base de datos y añadir nuevos informes mensuales, estrategias o datos macroeconómicos sin escribir código.

## 5. Solución de Problemas Comunes

- **Error al generar PDF**: Asegúrate de que todos los gráficos se hayan cargado correctamente en la pantalla antes de pulsar el botón de descarga.
- **La aplicación no carga**: Verifica que el comando `npm run dev` sigue ejecutándose en la terminal. No cierres la ventana de la terminal mientras uses el programa.
