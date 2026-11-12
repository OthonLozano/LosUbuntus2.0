# PORTIX

Semáforo de salida para transportistas del puerto de Veracruz: indica qué camión sale, cuál espera y qué cita hay que mover, antes de que el camión llegue a hacer fila.

Hackathon Veracruz Tech Week 2026 · Reto 1: Puerto que fluye

## Problemática

Cada día entran al puerto de Veracruz cerca de 2,000 tractocamiones. En septiembre de 2026, un camión pasó en promedio **12 h 38 min** dentro del puerto. Fue el peor tiempo de los cuatro grandes puertos del país y el doble que en junio (6 h 15 min).

Encontramos tres problemas encadenados:

1. **El camión sale sin los documentos listos.** La aduana se lleva 6 h 09 min de esas 12 h 38 min. Terminales y transportistas coinciden en que buena parte de las demoras viene de documentos incompletos, no solo de la capacidad del puerto.
2. **La espera es impredecible.** El promedio se duplicó en tres meses, y CANACAR reporta casos de 17 a 24 horas. Con esa variación, el transportista no puede planear su día.
3. **El camión pierde su cita y paga por ello.** La cita en la terminal tiene una tolerancia de 2 h antes y 1 h después. Si el camión no llega y no se canceló a tiempo, la terminal cobra $999 por contenedor (No Show).

T21 estima que las demoras en Veracruz cuestan cerca de **8.9 millones de pesos diarios** en diésel, operador y tractocamión parados (agosto 2026; es un costo modelado, no contable).

## Persona usuaria

**El despachador de una transportista mediana** que mueve contenedores desde el puerto de Veracruz. Coordina decenas de camiones al día por teléfono, WhatsApp y hojas de cálculo. Depende de la agencia aduanal para los documentos y de la terminal para las citas.

Se benefician de forma indirecta:
- La agencia aduanal, que recibe menos llamadas.
- Los operadores, que pasan menos horas en la fila.
- Los vecinos de las zonas de acceso, que tienen menos camiones parados en sus calles.

## Propuesta: semáforo de salida

Antes de que cada camión salga hacia el puerto, PORTIX le asigna un color a su contenedor:

- **Verde, sale:** los documentos están completos y el camión llega dentro de la ventana de su cita.
- **Amarillo, espera:** falta algo o hay mucha congestión, pero todavía hay tiempo de resolverlo. PORTIX avisa a quien le toca resolverlo.
- **Rojo, reprogramar:** el camión ya no llega a tiempo. PORTIX sugiere mover o cancelar la cita antes de que termine la tolerancia, para evitar el No Show.

## Fases

Cada fase termina en una demo funcional. Si no alcanzamos todas, la última fase terminada es la que presentamos.

| Fase | Qué se construye | Demo al terminar | Estado |
|---|---|---|---|
| 1. Tablero base | Contenedores del día con datos sintéticos, checklist de documentos y regla de color | Se marca un documento como faltante y el contenedor cambia de color | Pendiente |
| 2. Estimación de tiempo | Congestión por hora (simulada a partir del promedio ITPAP), llegada estimada contra la ventana de la cita, sugerencia de reprogramar y contador de No Show evitados | Se cambia la hora de salida y el semáforo se recalcula | Pendiente |
| 3. Revisión con IA | Carga de un PDF o una foto. La IA extrae los datos y los compara con los del viaje | Se sube un documento con un error y PORTIX lo detecta | Pendiente |
| 4. Avisos a la agencia | Chat simulado dentro de la app. La IA interpreta la respuesta de la agencia y actualiza el estado | La agencia responde "ya quedó pagado" y el contenedor pasa a verde | Pendiente |

Calendario: README a las 17:00 → Fase 1 a las 20:30 → Fases 2 y 3 en la noche → Fase 4 y el giro del reto el jueves temprano → cierre a las 10:30.

## Tech stack

- **Frontend:** React con Vite.
- **Backend:** FastAPI (Python).
- **Datos:** archivos JSON sintéticos en el repositorio.
- **IA:** API de Gemini (plan gratuito de Google AI Studio), aislada en un solo módulo del backend (`ia.py`). Así podemos cambiar de proveedor sin tocar el resto del código, por ejemplo si conseguimos acceso a Sintergica. Si se agota el límite gratuito, la demo usa respuestas de respaldo, que se indican en pantalla como tales.
- **Avisos:** chat simulado dentro de la app.
- **Desarrollo:** asistido con Claude Code.
- **Despliegue:** por definir.

## Arquitectura (planeada)

```
Navegador (React + Vite)
   ↓ API REST
FastAPI
   ├─ semaforo.py → reglas de color y estimación de tiempo
   ├─ ia.py       → Gemini (revisión de documentos e interpretación de mensajes)
   └─ data/*.json → contenedores y congestión (sintéticos)
```

Se desplegará como un solo servicio: el backend también servirá el frontend.

## Fuera de alcance

En esta versión no construiremos:

- Conexión real con VUCEM, el SAT o los sistemas de citas de las terminales.
- WhatsApp real; el chat será simulado.
- Un modelo predictivo entrenado. No hay datos públicos por hora, así que usaremos reglas y congestión simulada.
- Rastreo GPS en tiempo real.
- Usuarios, login ni soporte para varias empresas.
- Base de datos; usaremos archivos JSON.
- Validación de documentos contra el SAT. Solo revisaremos que sean consistentes entre sí.
- Coordinación entre varias transportistas o agencias, que queda como visión a futuro.

## Qué es real y qué es simulado

| Elemento | Estado |
|---|---|
| Tiempo promedio en el puerto y su desglose por etapa | Real: ITPAP de T21, septiembre 2026 |
| Reglas de cita (tolerancia y cargo de No Show) | Reales: avisos de la terminal ICAVE; pueden variar entre terminales |
| Contenedores, operadores y placas | Sintéticos |
| Congestión por hora del día | Simulada, ajustada al promedio del ITPAP |
| Conexión con VUCEM, el SAT o los sistemas de citas de las terminales | No existe; se simula |
| Mensajes de WhatsApp | Simulados dentro de la app |

## Cómo correrlo

Requisitos: Python 3.11 o más reciente y Node 20 o más reciente.

**Backend** (en una terminal, desde `backend/`):

```
python -m venv .venv
.venv\Scripts\activate          # en Mac o Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # en Mac o Linux: cp .env.example .env
uvicorn main:app --reload
```

Después pon tu key de Gemini en `backend/.env`. Para comprobar que funciona, abre http://localhost:8000/api/salud.

**Frontend** (en otra terminal, desde `frontend/`):

```
npm install
npm run dev
```

Abre http://localhost:5173. Las llamadas a `/api` se mandan al backend en el puerto 8000.

El contrato entre el frontend y el backend está en [docs/contrato-api.md](docs/contrato-api.md).

Sin key de Gemini, PORTIX funciona igual, pero la revisión de documentos y el chat usan **respuestas de respaldo**, y la pantalla lo indica.

### Versión de despliegue (un solo servicio)

`backend/servidor.py` sirve la API y también el frontend compilado, con un solo enlace. Para probarlo en local:

```
cd frontend
npm run build
cd ../backend
uvicorn servidor:app
```

Abre http://localhost:8000.

En la nube se usa el `Dockerfile` de la raíz: compila el frontend con Node y corre el backend con Python. En el servicio hay que configurar las variables de entorno `GEMINI_API_KEY`, `GEMINI_MODEL` y `PORTIX_HORA_ACTUAL`.

## Bitácora de IA

| Fecha | Herramienta | Para qué | Decisión clave |
|---|---|---|---|
| 2026-11-11 | Claude Code (Claude Opus 5.5) | Analizar el reto y a sus actores | El problema es de coordinación e información, no de capacidad física |
| 2026-11-11 | Claude Code + búsqueda web | Investigar y validar fuentes públicas (ITPAP, CANACAR, avisos de ICAVE, prensa local) | Usamos solo datos con fecha verificable. Descartamos cifras de 2023 que aparecían con fecha de 2026 |
| 2026-11-11 | Claude Code | Comparar usuarios posibles: agencia aduanal o transportista | Elegimos al transportista: es quien hace la fila y paga el No Show |
| 2026-11-11 | Claude Code | Proponer y comparar combinaciones de solución | Semáforo de salida construido por fases, cada una con demo funcional |
| 2026-11-11 | Claude Code | Mockup del tablero y del aviso a la agencia | Referencia visual para el equipo |
| 2026-11-11 | Claude Code | Borrador de este README | Revisado y ajustado por el equipo |
| 2026-11-11 | Claude Code + búsqueda web | Comparar APIs de IA gratuitas (Grok, Gemini, Groq) | Gemini: tiene plan gratuito y lee imágenes y PDFs. Groq queda como respaldo para texto |
| 2026-11-11 | Claude Code | Plan de trabajo del equipo: roles, ramas, turnos y prompts iniciales | Cinco roles según la herramienta de cada integrante. Cada fase cierra con merge y etiqueta |
| 2026-11-11 | Claude Code + Gemini | Escribir y probar `ia.py`: revisión de documentos e interpretación de mensajes | Salida en JSON con esquema, límite de 15 s por intento, modelo alterno si el principal está saturado y respuestas de respaldo declaradas |
| 2026-11-11 | Claude Code | Arquitectura y alcance para el punto de control 2 | Dejamos fuera las integraciones reales y el modelo predictivo; esas partes se simularán y lo declararemos |
| 2026-11-11 | Claude Code | Estructura base (F0): FastAPI, Vite + React y contrato de la API | Frontend mínimo escrito a mano, sin el boilerplate de la plantilla. Vite reenvía `/api` al backend, así que no hace falta CORS |

## Fuentes

- [T21: Demoras portuarias cuestan más de 1,166 mdp mensuales (sep. 2026)](https://t21.com.mx/demoras-portuarias-cuestan-mas-de-1166-mdp-mensuales-al-autotransporte-en-mexico/)
- [T21: Puertos reducen 42% el costo de sus demoras (oct. 2026)](https://t21.com.mx/puertos-reducen-42-el-costo-de-sus-demoras-para-el-autotransporte-pero-la-productividad-sigue-sin-encontrar-estabilidad/)
- [Plumas Libres: CANACAR denuncia demoras de hasta 1 día en la aduana de Veracruz (jun. 2026)](https://plumaslibres.com.mx/2026/06/05/canacar-veracruz-denuncia-mal-trabajo-de-aduana-de-veracruz-tardan-hasta-1-dia-para-accesar/)
- [InfoVeracruz: Trámites y congestionamientos frenan la competitividad logística del puerto (oct. 2026)](https://infoveracruz.com.mx/index.php/2026/10/09/tramites-y-congestionamientos-frenan-la-competitividad-logistica-del-puerto-de-veracruz/)
- [ICAVE: Lineamientos ICA-2025-009, cargo de No Show](https://publicaciones.gomsa.com/wp-content/uploads/2025/05/ICA-2025-009-LINEAMIENTOS-PARA-EL-RETIRO-DE-CARGA-DE-IMPORTACION.pdf)
- [ICAVE: ICA-2022-013, tolerancia de citas](https://publicaciones.gomsa.com/wp-content/uploads/2022/05/ICA-2022-013-ACTUALIZACION-EN-PROCESOS-PARA-RECEPCION-DE-CARGA-DE-EXPORT.pdf)

## Equipo Los Ubuntus 2.0

- Olimpia
- Renata
- Othon
- Brayan
- Charly
