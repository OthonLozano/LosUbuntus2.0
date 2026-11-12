# PORTIX

Semáforo de salida para transportistas del puerto de Veracruz: indica qué camión sale, cuál espera y qué cita hay que mover, antes de que el camión llegue a hacer fila.

Hackathon Veracruz Tech Week 2026 · Reto 1: Puerto que fluye

**Demo en vivo: https://losubuntus2-0.onrender.com/**

- La primera carga puede tardar hasta 1 minuto: el servidor gratuito de Render se duerme cuando no se usa.
- La hora de la demo es fija (06:15) para que los colores siempre salgan igual.
- Los cambios viven en memoria y los ve cualquiera que abra el link. El botón **"Reiniciar demo"** regresa todo al estado inicial.
- Si Gemini no responde, la app usa respuestas de respaldo y lo indica en pantalla. Lo simulado está etiquetado.

**Pruébalo en 3 pasos:**

1. En **Panel**, elige un contenedor en rojo y cancela su cita: se suma un No Show evitado y se avisa al operador por SMS.
2. En **Documentos**, sube una carta porte (PDF o foto) para que la IA la compare con el viaje.
3. En **Chat con la agencia**, escribe "ya quedó pagado, al rato te paso el comprobante".

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
| 1. Tablero base | Contenedores del día con datos sintéticos, checklist de documentos y regla de color | Se marca un documento como faltante y el contenedor cambia de color | Lista (`fase-1`) |
| 2. Estimación de tiempo | Congestión por hora (simulada a partir del promedio ITPAP), llegada estimada contra la ventana de la cita, sugerencia de reprogramar y contador de No Show evitados | Se cambia la hora de salida y el semáforo se recalcula | Lista (`fase-2`) |
| 3. Revisión con IA | Carga de un PDF o una foto. La IA extrae los datos y los compara con los del viaje | Se sube un documento con un error y PORTIX lo detecta | Lista (`fase-3`) |
| 4. Avisos a la agencia | Chat simulado dentro de la app. La IA interpreta la respuesta de la agencia y actualiza el estado | La agencia responde "ya quedó pagado, al rato te paso el comprobante": el pedimento sigue pendiente hasta que se sube el comprobante y la IA lo revisa; entonces el contenedor pasa a verde | Lista (`fase-4`) |
| Giro. Aviso por SMS o voz | El operador sin smartphone recibe el color de su contenedor por SMS (≤160 caracteres, sin acentos) o por llamada de voz | Se cancela una cita en rojo y al celular del equipo le llega el SMS (Twilio) | Lista (`demoSMS`) |

Calendario: README a las 17:00 → Fase 1 a las 20:30 → Fases 2 y 3 en la noche → Fase 4 y el giro del reto el jueves temprano → cierre a las 10:30.

## Giro del reto: aviso por SMS o voz

**El giro:** "Un transportista no tiene smartphone moderno: la solución debe avisarle por SMS o por mensaje de voz."

**Cómo lo atendimos:** el semáforo ya no se queda en la pantalla del despachador; llega hasta la cabina del camión, a cualquier celular básico.

- **SMS:** PORTIX le manda al operador el color de su contenedor y qué hacer: `PORTIX TGHU 174826-8: ROJO, NO SALGAS. Ya no llegas a la cita de las 05:45...`. Cada mensaje cabe en **160 caracteres y va sin acentos**, porque una sola "á" cambia la codificación del SMS y el límite baja a 70 caracteres (el mensaje se partiría).
- **Voz:** una llamada que dice el mismo aviso en frases completas, **deletrea el número del contenedor** (para compararlo con la puerta) y lo **repite**. Sirve si el operador va manejando o lee con dificultad.
- **Automático:** cuando el despachador mueve o cancela una cita, el operador recibe el SMS sin que nadie lo pida. También se puede mandar a mano desde el detalle del contenedor ("Enviar SMS", "Llamar").
- **Real o simulado:** PORTIX manda el SMS y la llamada con la API de **Twilio** al celular de un integrante del equipo (que aceptó usarlo). Lo verificamos con nuestra cuenta: la **cuenta de prueba** de Twilio solo permite enviar sus **plantillas predefinidas** y no permite mensajes de voz propios. Por eso, en la demo, el **SMS sale de verdad** (el celular suena) con la plantilla de Twilio, mientras que **el texto de PORTIX se muestra en pantalla, declarado como simulado**. La **voz** se reproduce con "Escuchar aquí" (voz del navegador), también declarada como simulada. Con una cuenta completa de Twilio sale el texto de PORTIX sin cambiar el código (solo se vacía `TWILIO_PLANTILLA_PRUEBA`). Sin Twilio, o si falla, el aviso queda como **"Simulado"** y la pantalla lo dice.
- **Privacidad:** los teléfonos de los operadores en los datos son ficticios (`229 000 01xx`). El número real de la demo vive solo en una variable de entorno del servidor y en pantalla se muestra enmascarado (`***1234`).
- **Código:** todo lo de Twilio vive en `backend/avisos.py`, aislado igual que Gemini en `ia.py`.

## Tech stack

- **Frontend:** React con Vite.
- **Backend:** FastAPI (Python).
- **Datos:** archivos JSON sintéticos en el repositorio.
- **IA:** API de Gemini (plan gratuito de Google AI Studio), aislada en un solo módulo del backend (`ia.py`). Así podemos cambiar de proveedor sin tocar el resto del código, por ejemplo si conseguimos acceso a Sintergica. Si se agota el límite gratuito, la demo usa respuestas de respaldo, que se indican en pantalla como tales.
- **Avisos a la agencia:** chat simulado dentro de la app; la IA interpreta las respuestas.
- **Avisos al operador (giro):** SMS y llamada de voz con la API REST de Twilio, aislada en `avisos.py`.
- **Desarrollo:** asistido con Claude Code.
- **Despliegue:** Render, con el `Dockerfile` de la raíz: un solo servicio sirve la API y el frontend. En línea en https://losubuntus2-0.onrender.com/

## Arquitectura

```
Navegador (React + Vite): pestañas Panel, Documentos y Chat con la agencia
   ↓ API REST (/api/...)
FastAPI (main.py)
   ├─ semaforo.py → reglas de color, ventana de la cita y llegada estimada
   ├─ ia.py       → Gemini: revisa documentos, interpreta mensajes de la agencia
   │                y lee una carta porte para llenar "Agregar contenedor"
   ├─ avisos.py   → Twilio: SMS y llamada de voz al operador (giro)
   └─ data/*.json → contenedores y congestión (sintéticos)
servidor.py → en el despliegue, la misma app sirve también el frontend compilado
```

Todo corre como un solo servicio en Render (`Dockerfile` de la raíz). El estado vive en memoria: se carga de los JSON al arrancar y "Reiniciar demo" lo regresa al inicio. Las llamadas a Gemini y Twilio están aisladas en su propio módulo para poder cambiar de proveedor sin tocar el resto.

## Fuera de alcance

En esta versión no construimos:

- Conexión real con VUCEM, el SAT o los sistemas de citas de las terminales. Mover o cancelar una cita solo cambia el estado dentro de PORTIX.
- WhatsApp real con la agencia; el chat es simulado (alguien del equipo escribe como la agencia).
- Un modelo predictivo entrenado. No hay datos públicos por hora, así que usamos reglas y congestión simulada.
- Rastreo GPS en tiempo real.
- Usuarios, login ni soporte para varias empresas.
- Base de datos; los datos se cargan de archivos JSON y viven en memoria.
- Validación de documentos contra el SAT. La IA solo revisa que sean consistentes con los datos del viaje.
- Coordinación entre varias transportistas o agencias, que queda como visión a futuro.

## Qué es real y qué es simulado

| Elemento | Estado |
|---|---|
| Tiempo promedio en el puerto y su desglose por etapa | Real: ITPAP de T21, septiembre 2026 |
| Reglas de cita (tolerancia y cargo de No Show) | Reales: avisos de la terminal ICAVE; pueden variar entre terminales |
| Contenedores, operadores y placas | Sintéticos |
| Congestión por hora del día | Simulada, ajustada al promedio del ITPAP |
| Conexión con VUCEM, el SAT o los sistemas de citas de las terminales | No existe; se simula |
| Mensajes de WhatsApp con la agencia | Simulados dentro de la app: alguien del equipo escribe como la agencia |
| Revisión de documentos e interpretación de mensajes | Reales: Gemini lee el PDF o la foto y el texto de la agencia |
| Respuestas de respaldo | Si Gemini falla o se agota el límite gratuito, se usan reglas simples en su lugar; la pantalla dice "respuesta de respaldo" |
| Documentos de prueba (PDF) | Sintéticos, marcados como documento de prueba |
| Hora de la demo | Fija en 06:15 (`PORTIX_HORA_ACTUAL`) para que los colores salgan siempre igual |
| Datos guardados | En memoria; "Reiniciar demo" o reiniciar el servidor los regresa al estado inicial |
| Teléfonos de los operadores | Ficticios (`229 000 01xx`) |
| SMS al operador (giro) | Envío real con Twilio al celular de un integrante del equipo; con la cuenta de prueba sale la plantilla de Twilio y el texto de PORTIX se muestra simulado (se indica en pantalla) |
| Llamada de voz al operador (giro) | Simulada: la cuenta de prueba de Twilio no permite voz propia; se escucha en el navegador. El código para la llamada real existe (`avisos.py`) |

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

Para el giro (SMS y voz reales), configura además `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` y `TELEFONO_DEMO`, y con la cuenta de prueba de Twilio también `TWILIO_PLANTILLA_PRUEBA` (ver `backend/.env.example`). Sin ellas, los avisos se simulan.

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
| 2026-11-11 | Claude Code + Gemini | Endpoint de revisión de documentos (F3) y prueba con PDFs sintéticos | Solo PDF, JPG o PNG de hasta 10 MB; el resultado de la IA actualiza el checklist y deja su resumen como nota |
| 2026-11-12 | Claude Code | Regla del chat con la agencia (F4) | Regla estricta: si la agencia dice "ya quedó" pero falta el comprobante, el documento sigue pendiente hasta subirlo y que la IA lo revise |
| 2026-11-12 | Claude Code | Despliegue en un solo servicio (`servidor.py` y `Dockerfile`) en Render | La API sirve también el frontend compilado: un solo enlace y sin CORS. Las keys van en variables de entorno del servicio |
| 2026-11-12 | Claude Code | Giro del reto: avisos al operador por SMS y voz con Twilio | SMS de 160 caracteres o menos y sin acentos (GSM-7) con plantilla fija, no con IA, para que no falle; voz que deletrea el contenedor; real con Twilio o simulado y declarado |
| 2026-11-12 | Claude Code + Twilio | Probar el envío real con la cuenta de prueba de Twilio | La cuenta de prueba rechaza texto propio y voz propia; usamos su plantilla para el SMS real y declaramos simulado el texto de PORTIX y la voz |
| 2026-11-11 | Claude (plan gratuito) | Generar los datos sintéticos (contenedores, operadores y placas) y simular documentos para probar el programa | Solo datos inventados, para cubrir cada color del semáforo sin usar datos personales reales |
| 2026-11-11 y 12 | Claude Code | Frontend de las fases 2 a 5: tablero, revisión de documentos, chat con la agencia, vistas con pestañas y estilo visual | El color nunca es la única señal: cada estado y cada hallazgo de la IA también va en texto ("✓ Sí / ✗ No", "Antes Espera → Ahora Sale"). Todo lo simulado o de respaldo se marca en pantalla |
| 2026-11-12 | Claude Code | Ficha de una página para la entrega (`docs/ficha-PORTIX.pdf`) | Resume problema, solución, giro, impacto y qué es real o simulado, con fuentes |

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
