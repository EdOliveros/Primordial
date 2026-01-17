# Primordial (Simulador de Evolución de Colonias)

> [!NOTE]
> **Proyecto Generado Integramente con IA**
> Este proyecto es un experimento de creación asistida. Todos los prompts fueron diseñados y refinados con **Gemini**, y el 100% del código, arquitectura y diseño visual fue implementado por **Antigravity**.

**Primordial** es un simulador de vida artificial basado en WebGL donde las células evolucionan, forman colonias y crean alianzas estratégicas en tiempo real. Diseñado para correr en el navegador con alto rendimiento.

## 🌟 Características Principales

- **Micro-Mundo Masivo**: Un entorno de 1000x1000 unidades con capacidad para miles de células simultáneas.
- **Sistema de Alianzas**: Las células pueden agruparse en hasta 3 colonias distintas, cooperando para sobrevivir.
- **Log de Eventos Evolutivos**: Un sistema de narración en tiempo real que notifica nacimientos, extinciones, guerras y alianzas.
- **Panel de Dominación Genética**: Una Wiki interactiva que monitorea qué genes (SPD, AGG, PHO, etc.) están dominando la biosfera.

## 🎮 Controles

| Acción | Control |
| :--- | :--- |
| **Navegación** | Drag & Zoom con el mouse (Clic Izquierdo + Rueda). |
| **Modo Cine** | Pulsa la tecla **'H'** para ocultar toda la interfaz (HUD) y solo ver la simulación. |
| **Inspección** | Haz clic en cualquier célula para ver su ADN y estadísticas. |
| **Paneles** | Usa los botones en pantalla para colapsar/expandir el panel de información y estadísticas. |

## 🛠️ Tecnologías

Este proyecto ha sido construido utilizando un stack moderno enfocado en el rendimiento:

- **React & TypeScript**: Para la interfaz de usuario y la lógica de control robusta.
- **WebGL 2**: Renderizado de bajo nivel para visualizar miles de agentes sin lag.
- **Spatial Hash Grid**: Estructura de datos optimizada para detectar colisiones y vecinos eficientemente.
- **Web Workers**: La lógica de simulación corre en un hilo separado para mantener la UI fluida.

## 🚀 Cómo Iniciar

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar el servidor:**
   ```bash
   npx vite
   ```

3. **Disfrutar:**
   Abre tu navegador en `http://localhost:5173`.

---

*v1.0 Stable Release - Desarrollado por Antigravity.*
