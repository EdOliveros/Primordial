# PRIMORDIAL | Artificial Life Simulator

> [!IMPORTANT]
> **Proyecto Generado Integramente con IA**
> Este proyecto es un experimento de creación asistida. Todos los prompts fueron diseñados y refinados con **Gemini**, y el 100% del código, arquitectura y diseño visual fue implementado por **Antigravity**.

PRIMORDIAL es un simulador de vida artificial masivo diseñado bajo principios de **Data-Oriented Design (DOD)** para permitir la ejecución de hasta 50,000 células con genomas complejos en tiempo real directamente en el navegador.

## 🚀 Cómo Iniciar el Proyecto

Este proyecto utiliza **Vite** como servidor de desarrollo y **TypeScript** para la lógica del motor.

### Requisitos Previos
- [Node.js](https://nodejs.org/) (v18 o superior recomendado)
- npm (incluido con Node.js)

### Instrucciones

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar el servidor de desarrollo:**
   ```bash
   npx vite
   ```

3. **Abrir en el navegador:**
   Una vez ejecutado el comando anterior, abre la URL que aparece en la terminal (usualmente `http://localhost:5173`).

---

## 🧠 Cómo Funciona PRIMORDIAL

El corazón de la simulación es un motor híbrido que separa la carga computacional pesada de la interfaz de usuario.

### Arquitectura de Hilos
- **Main Thread (UI/Renderer):** Gestiona el DOM, los controles del Start Screen, el God Mode Dashboard y el renderizado de alto rendimiento mediante un sistema especializado en `src/web/renderer.ts`.
- **Worker Thread (Engine):** La simulación completa corre en un Web Worker independiente (`src/simWorker.ts`). Esto garantiza que la interfaz de usuario nunca se bloquee, sin importar la complejidad de la simulación.

### Componentes Clave
1. **Engine (`src/core/engine.ts`):** Orquestador de la física, termodinámica y comportamiento IA de las células.
2. **CellStorage (`src/core/storage.ts`):** Utiliza arrays tipados (Buffers) para almacenar datos de 50,000 células de forma contigua, maximizando el uso de la memoria y el caché del procesador.
3. **SpatialGrid (`src/core/spatialGrid.ts`):** Un sistema de "Spatial Hashing" que optimiza las búsquedas de vecinos de $O(n^2)$ a casi $O(n)$, permitiendo colisiones y visión masiva.

---

## 🧬 Modelo Biológico y Evolución

Cada célula posee un genoma de 8 genes que determinan su comportamiento y supervivencia:

- **SPD (Speed):** Velocidad máxima de movimiento.
- **AGG (Aggressiveness):** Tendencia a cazar otras células.
- **PHO (Photosynthesis):** Eficiencia al producir energía del sol.
- **SIZ (Size):** Tamaño físico (influye en el coste energético).
- **DEF (Defense):** Resistencia ante ataques.
- **VIS (Vision):** Rango de detección de presas y depredadores.
- **MUT (Mutation):** Probabilidad de cambios genéticos al reproducirse.
- **LIF (Lifespan):** Longevidad base.

### Dinámica de Supervivencia
- **Termodinámica:** Moverse, ver y crecer consume energía. Si la energía llega a 0, la célula muere.
- **Evolución:** Cuando una célula acumula suficiente energía, se reproduce asexualmente, pasando su genoma con pequeñas mutaciones a su descendencia.

---

## 🕹️ Controles y God Mode

- **Start Screen:** Configura la población inicial, la tasa de mutación global y la abundancia de recursos antes de iniciar la biosfera.
- **Console Dashboard:** Monitorea en tiempo real la estabilidad del ecosistema, nacimientos, extinciones y la dominancia genética.
- **Cell Inspector:** Haz clic en cualquier célula para ver su secuencia de ADN única y rastrear su energía en tiempo real.
- **Follow Mode:** Selecciona una célula y activa "Follow" para seguir su viaje a través del mundo primordial.

---

*Desarrollado con ❤️ y silicio por Antigravity.*
