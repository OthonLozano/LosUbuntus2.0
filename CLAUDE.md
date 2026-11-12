# PORTIX: contexto del proyecto

Proyecto del equipo Los Ubuntus 2.0 para el Hackathon Veracruz Tech Week 2026, Reto 1: "Puerto que fluye". El README tiene la versión pública; este archivo es el contexto de trabajo para Claude Code y para el equipo.

## Qué es PORTIX

Un semáforo de salida para transportistas del puerto de Veracruz. Antes de que un camión salga hacia el puerto, PORTIX le asigna un color a su contenedor:

- **Verde, sale:** documentos completos y el camión llega dentro de la ventana de su cita.
- **Amarillo, espera:** falta algo o hay mucha congestión, pero todavía hay tiempo. Se avisa a quien debe resolverlo.
- **Rojo, reprogramar:** ya no llega a tiempo. Se sugiere mover o cancelar la cita antes de que termine la tolerancia, para evitar el No Show.

**Persona usuaria:** el despachador de una transportista mediana que mueve contenedores del puerto. La agencia aduanal participa a través de los avisos. Los operadores y los vecinos son beneficiarios indirectos.

## Qué se va a desarrollar (por fases)

Cada fase termina en una demo funcional. Si se acaba el tiempo, se presenta la última fase terminada.

1. **Tablero base:** los contenedores del día (datos sintéticos), un checklist de documentos y la regla de color.
2. **Estimación de tiempo:** congestión por hora (simulada a partir del ITPAP) y llegada estimada contra la ventana de la cita. Incluye la sugerencia de reprogramar y un contador de No Show evitados.
3. **Revisión con IA:** se sube un PDF o una foto, y la IA extrae los datos y los compara con los del viaje.
4. **Avisos a la agencia:** un chat simulado. La IA interpreta la respuesta de la agencia y actualiza el estado del contenedor.

## Decisiones tomadas

- El usuario principal es la **transportista**, no la agencia aduanal: es quien hace la fila y paga el No Show.
- La métrica central es de **espera**: horas evitadas y citas no perdidas. La revisión de documentos con IA es un medio para eso, no el producto en sí.
- Se construye **por fases**, y cada fase termina en una demo funcional (ver el README).

## Reglas del hackathon que afectan el código

- Hay que hacer un commit en cada punto de control: miércoles a las 17:00 y a las 20:30. **El código se cierra el jueves a las 10:30.**
- El jueves a las 7:00 llega un **requisito nuevo (giro)** que debe aparecer en la demo. Mantener el código modular para poder agregarlo.
- Solo se permiten **datos públicos, de ejemplo o sintéticos**. Nunca datos personales reales.
- **Presentar como funcional algo que no lo es descalifica.** Todo lo simulado se declara en la UI y en la tabla "Qué es real y qué es simulado" del README.
- La **bitácora de IA** del README es obligatoria. Después de cada uso relevante de IA, agregar una fila: fecha, herramienta, para qué y decisión clave.
- **Cualquier integrante debe poder explicar cualquier parte.** Preferir código simple y legible a soluciones ingeniosas, y comentar el *por qué* donde no sea obvio.
- Las librerías y plantillas públicas se valen, pero hay que declararlas.

## Stack y convenciones

- **Frontend:** React con Vite, en `frontend/`.
- **Backend:** FastAPI (Python), en `backend/`.
- **Datos:** JSON sintéticos en `backend/data/`.
- **IA:** toda llamada a un modelo vive en `backend/ia.py`, con funciones como `revisar_documento()` e `interpretar_mensaje()`. Se usa la **API de Gemini** (plan gratuito de Google AI Studio, modelo Flash). Para cambiar de proveedor (por ejemplo a Sintergica o Groq) solo se toca ese archivo.
- El nombre del modelo va en la variable de entorno `GEMINI_MODEL`, nunca fijo en el código.
- Si la API falla o se agota el límite gratuito, `ia.py` devuelve **respuestas de respaldo** y la UI muestra la etiqueta "respuesta de respaldo".
- La API key va en `backend/.env` como `GEMINI_API_KEY`. Ese archivo está en `.gitignore` y nunca se sube; se versiona un `.env.example` sin valores.
- La UI y los textos van en español.

## Datos verificados para la lógica y la demo

| Dato | Valor | Fuente |
|---|---|---|
| Tiempo promedio en el puerto de Veracruz | Jun. 6:15:26 · Jul. 7:13:01 · Ago. 11:31:59 · Sep. 12:38:28 (el peor de 4 puertos) | ITPAP, T21 |
| Desglose de septiembre 2026 | Aduana 6:09:29 · Espera 3:49:30 · Maniobras 2:39:29 | ITPAP, T21 (30 oct. 2026) |
| Desglose de julio → agosto | Aduana 3:32:16 → 5:39:08 · Espera 2:02:47 → 3:19:43 · Maniobras 1:37:58 → 2:33:08 | ITPAP, T21 (14 sep. 2026) |
| Flujo diario | ~2,000 tractocamiones | T21 / CANACAR |
| Costo modelado en Veracruz | ~270 mdp al mes, ~8.9 mdp al día (agosto) | T21 |
| Tolerancia de la cita en ICAVE | 2 h antes y 1 h después del horario | ICAVE ICA-2022-013 |
| Cargo por No Show en ICAVE | $999 MXN por contenedor, vigente desde el 2 de junio de 2025 | ICAVE ICA-2025-009 |
| Casos extremos | 17 a 24 h en la ruta fiscal; ~20% de las garitas operando (junio 2026) | CANACAR vía Plumas Libres |

- **No usar** las cifras de "2,400 operadores al día" ni "CALT con capacidad para 650 camiones": son de 2023.
- **No usar** "48 h de espera": la fuente no tiene fecha verificable.
- El ITPAP es un **promedio mensual**. La congestión por hora del día es simulada y debe decirse así.
