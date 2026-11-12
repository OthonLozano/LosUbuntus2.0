# Contrato de la API de PORTIX

Es la forma de los datos que comparten el backend (FastAPI) y el frontend (React). Si alguien necesita cambiarla, avisa en el grupo antes, porque el cambio afecta a los dos lados.

- Todas las rutas empiezan con `/api`.
- Las horas van como texto `"HH:MM"` en formato de 24 h, por ejemplo `"09:00"`.
- Todos los datos son sintéticos.

## Estructura de carpetas

```
backend/
  main.py           endpoints (FastAPI)
  semaforo.py       reglas de color y estimación de tiempo
  ia.py             todas las llamadas a Gemini
  data/
    contenedores.json
    congestion.json
  .env              (no se sube)
  .env.example
frontend/           React + Vite
docs/
  contrato-api.md
```

## Un contenedor

Así se guarda en `backend/data/contenedores.json`:

```json
{
  "id": "LTSU 402219-8",
  "tipo_carga": "general",
  "terminal": "ICAVE",
  "cita": "11:00",
  "operador": "L. Ramírez",
  "placas": "52-AM-9F",
  "salida_planeada": "10:30",
  "documentos": [
    { "tipo": "pedimento", "estado": "ok", "nota": "Confirmado por la agencia 05:30" },
    { "tipo": "carta_porte", "estado": "error", "nota": "Placas no coinciden" },
    { "tipo": "folio_cita", "estado": "ok", "nota": "" },
    { "tipo": "operador_placas", "estado": "ok", "nota": "" },
    { "tipo": "requisito_carga", "estado": "na", "nota": "No aplica" }
  ]
}
```

| Campo | Valores posibles |
|---|---|
| `tipo_carga` | `general`, `imo`, `isotanque`, `sobredimensionada` |
| `terminal` | `ICAVE`, `CICE` |
| `documentos[].tipo` | `pedimento`, `carta_porte`, `folio_cita`, `operador_placas`, `requisito_carga` |
| `documentos[].estado` | `ok`, `falta`, `error`, `na` (no aplica) |

## Lo que el backend agrega al responder

Cada contenedor que regresa la API incluye además estos campos calculados:

```json
{
  "color": "amarillo",
  "motivo": "La IA encontró un error en la carta porte",
  "ventana_inicio": "09:00",
  "ventana_fin": "12:00",
  "llegada_estimada": "11:40",
  "accion_sugerida": "Corregir carta porte y salir antes de 10:30",
  "traslado_min": 68,
  "congestion": "alta",
  "estado_cita": "activa"
}
```

- `traslado_min` y `congestion` (F2): cuánto tarda el traslado según la congestión **simulada** de la hora de salida (45 min × 1.0, 1.3 o 1.5, redondeado hacia arriba).
- `estado_cita` (F2): `activa`, `movida` o `cancelada`. Lo cambia `POST /reprogramar`. No hace falta ponerlo en `contenedores.json`: si no viene, vale `activa`.

`color` puede ser `verde`, `amarillo` o `rojo`. Las reglas para calcularlo están en la sección 7 del plan del equipo.

## Endpoints

| Método y ruta | Para qué | Fase |
|---|---|---|
| `GET /api/salud` | Prueba de que el backend corre; incluye la hora de la demo | F0 / F5 |
| `GET /api/contenedores` | Lista con color calculado | F1 |
| `GET /api/contenedores/{id}` | Detalle de un contenedor | F1 |
| `PATCH /api/contenedores/{id}/documentos` | Cambiar el estado de un documento | F1 |
| `GET /api/resumen` | Conteo por color y No Show evitados | F1 / F2 |
| `GET /api/congestion` | Congestión por hora (simulada) | F2 |
| `POST /api/contenedores/{id}/simular-salida` | Recalcular con otra hora de salida | F2 |
| `POST /api/contenedores/{id}/reprogramar` | Mover o cancelar la cita (suma al contador) | F2 |
| `POST /api/contenedores/{id}/revisar-documento` | Subir un PDF o una foto para que la IA lo revise | F3 |
| `GET /api/contenedores/{id}/chat` | Historial del chat con la agencia | F4 |
| `POST /api/contenedores/{id}/chat` | Mensaje de la agencia; la IA lo interpreta | F4 |
| `POST /api/reiniciar` | Regresar la demo a su estado inicial | F5 |
| `POST /api/contenedores` | Agregar un contenedor | F5 |
| `POST /api/extraer-viaje` | La IA lee una carta porte para llenar el formulario | F5 |
| `GET /api/contenedores/{id}/avisos` | Historial de avisos al operador y vista previa del SMS y la voz | Giro |
| `POST /api/contenedores/{id}/avisar-operador` | Avisar al operador por SMS o llamada (Twilio o simulado) | Giro |

Nota: el `id` lleva un espacio (`LTSU 402219-8`). En el frontend hay que codificarlo con `encodeURIComponent(id)` al armar la URL.

## Cuerpos de las peticiones (propuesta)

Son la forma inicial. Quien implemente el endpoint puede ajustarla, pero tiene que actualizar este archivo y avisar.

**`PATCH /api/contenedores/{id}/documentos`**: regresa el contenedor con su color recalculado.

```json
{ "tipo": "carta_porte", "estado": "ok", "nota": "Corregida por la agencia" }
```

**`GET /api/resumen`**

```json
{
  "verde": 3, "amarillo": 2, "rojo": 2,
  "no_show_evitados": 0, "ahorro_mxn": 0,
  "detenidos_por_documentos": 4, "horas_espera_evitadas": 15.3
}
```

- `detenidos_por_documentos` (F5): contenedores con algún documento en `falta` o `error`. PORTIX evitó que salieran a hacer fila con papeles incompletos.
- `horas_espera_evitadas` (F5): **estimación**, `detenidos_por_documentos × 3.825 h` (espera promedio del ITPAP de septiembre 2026, 3:49:30, T21).

**`GET /api/congestion`**: la congestión es simulada; el ITPAP solo publica un promedio mensual.

```json
{
  "simulada": true,
  "nota": "Congestión SIMULADA por hora del día...",
  "traslado_base_min": 45,
  "multiplicadores": { "baja": 1.0, "media": 1.3, "alta": 1.5 },
  "por_hora": { "06": "baja", "07": "baja", "08": "media", "09": "alta" }
}
```

La tabla vive en `backend/data/congestion.json` (de 06 a 17 h). Las horas que no aparecen se consideran `baja`.

**`POST /api/contenedores/{id}/simular-salida`**: regresa el contenedor recalculado sin guardar el cambio.

```json
{ "salida_planeada": "09:15" }
```

**`POST /api/contenedores/{id}/reprogramar`**: regresa el contenedor actualizado.

```json
{ "accion": "mover", "nueva_cita": "14:00" }
```

`accion` puede ser `mover` o `cancelar`. Con `cancelar` no se manda `nueva_cita`.

- **No Show evitado:** suma 1 al contador (y $999 a `ahorro_mxn`) solo si la cita estaba en **rojo** y se movió o canceló antes del fin de su ventana (según la hora de la demo).
- **Mover:** además de la cita, cambia `salida_planeada` a la última hora con la que el camión llega justo a la nueva cita. Si con la hora actual ya no alcanza a llegar, responde `422` con la explicación en `detail`.
- **Cancelar:** el contenedor queda en **amarillo** ("Solicitar una nueva cita a la terminal"), porque sigue pendiente de una cita nueva. Cancelar dos veces responde `422`.

**`POST /api/contenedores/{id}/revisar-documento`** (implementado): se envía como `multipart/form-data` con estos campos:

- `archivo` (obligatorio): PDF, JPG o PNG, de máximo 10 MB. Otro tipo de archivo responde `415`.
- `documento` (opcional): qué renglón del checklist actualizar, `carta_porte` o `pedimento`. Si no se manda, se usa el tipo que detecte la IA.

En el frontend se arma así:

```js
const datos = new FormData()
datos.append('archivo', archivoElegido)       // el File del <input type="file">
datos.append('documento', 'carta_porte')      // opcional
fetch(`/api/contenedores/${encodeURIComponent(id)}/revisar-documento`, { method: 'POST', body: datos })
```

No hay que poner `Content-Type` a mano: el navegador lo pone solo con `FormData`. Regresa:

```json
{
  "tipo_detectado": "carta_porte",
  "legible": true,
  "hallazgos": [
    { "campo": "contenedor", "valor_en_documento": "TCLU 930571-3", "valor_esperado": "TCLU 930571-3", "coincide": true },
    { "campo": "placas", "valor_en_documento": "25-AM-9F", "valor_esperado": "61-CD-7H", "coincide": false }
  ],
  "estado_sugerido": "error",
  "resumen": "Las placas de la carta porte no coinciden con la unidad asignada.",
  "respaldo": false,
  "documento_actualizado": "carta_porte",
  "contenedor": { "...": "el contenedor con su color recalculado" }
}
```

- El renglón `documento_actualizado` del checklist queda en `ok` o `error` (según `estado_sugerido`), y su `nota` guarda el `resumen`.
- Tarda unos 4 a 8 segundos (es la llamada a Gemini): el frontend debe mostrar un "Revisando…" mientras tanto.
- Si `respaldo` es `true`, hay que mostrar la etiqueta "respuesta de respaldo". En ese caso viene además `motivo_respaldo`.

**`GET /api/contenedores/{id}/chat`** (implementado): el historial del chat con la agencia. Si el chat es nuevo, empieza con un aviso de PORTIX que lista los documentos pendientes.

```json
{
  "mensajes": [
    { "de": "portix", "texto": "Aviso de PORTIX sobre el contenedor LTSU 402219-9 (cita 09:00): falta resolver pedimento (Pago pendiente). ¿Nos confirman cuando quede?", "hora": "06:15" }
  ]
}
```

`de` puede ser `portix` (avisos y respuestas del sistema) o `agencia`. La `hora` es la del reloj de la demo.

**`POST /api/contenedores/{id}/chat`** (implementado): lo que escribe la agencia. El texto no puede ir vacío y tiene máximo 500 caracteres (`422`).

```json
{ "texto": "Ya quedó pagado el pedimento" }
```

Regresa (la `interpretacion` es tal cual la da `ia.interpretar_mensaje()`):

```json
{
  "interpretacion": {
    "documento": "pedimento",
    "nuevo_estado": "ok",
    "pendiente": "",
    "resumen": "La IA entendió: la agencia confirma el pago del pedimento.",
    "confianza": "alta",
    "respaldo": false
  },
  "respaldo": false,
  "documento_actualizado": "pedimento",
  "contenedor": { "...": "el contenedor con su color recalculado" },
  "mensajes": [
    { "de": "portix", "texto": "Aviso de PORTIX sobre el contenedor ...", "hora": "06:15" },
    { "de": "agencia", "texto": "Ya quedó pagado el pedimento", "hora": "06:15" },
    { "de": "portix", "texto": "La IA entendió: ... Pedimento queda como 'listo'. El contenedor está en verde (sale).", "hora": "06:15" }
  ]
}
```

- `documento` puede ser uno de los 5 tipos o `ninguno`. `nuevo_estado` puede ser `ok`, `falta`, `error` o `sin_cambio`. `confianza` puede ser `alta`, `media` o `baja`.
- El checklist solo cambia si hay documento, el estado no es `sin_cambio` y la confianza no es `baja`. Si no cambia, `documento_actualizado` llega en `null`.
- `mensajes` es el historial completo, para pintarlo sin pedir otra vez el GET.
- Tarda unos segundos (la llamada a Gemini): el frontend debe mostrar un "Interpretando…" mientras tanto.
- Si `respaldo` es `true`, hay que mostrar la etiqueta "respuesta de respaldo". En ese caso viene además `interpretacion.motivo_respaldo`.

## F5: demo, agregar contenedores y datos con IA

**`GET /api/salud`**: además de lo que ya regresaba, trae la hora del reloj de la demo.

```json
{ "estado": "ok", "servicio": "PORTIX", "ia_configurada": true, "modelo": "gemini-...", "hora_actual": "06:15" }
```

Nunca regresa la API key; `ia_configurada` solo dice si existe.

**`POST /api/reiniciar`** (implementado): sin cuerpo. Vuelve a leer los JSON, pone el contador de No Show en 0 y borra los chats. También borra los contenedores agregados con `POST /api/contenedores`.

```json
{ "ok": true, "hora_actual": "06:15" }
```

**`POST /api/contenedores`** (implementado): agrega un contenedor y lo regresa con su color calculado (`201`).

```json
{
  "id": "ABCD 123456-7",
  "tipo_carga": "general",
  "terminal": "ICAVE",
  "cita": "11:00",
  "operador": "R. Gómez",
  "placas": "52-AM-9F",
  "salida_planeada": "10:00"
}
```

- `id` con formato `"ABCD 123456-7"`: 4 letras, espacio, 6 dígitos, guion y 1 dígito. El backend lo pasa a mayúsculas.
- `tipo_carga`, `terminal`, `cita` y `salida_planeada` aceptan los mismos valores que un contenedor normal.
- Los documentos empiezan en `falta`. Si `tipo_carga` es `general`, `requisito_carga` va en `na` ("No aplica").
- Responde `409` si el `id` ya existe y `422` si algún dato no es válido (el motivo va en `detail`).
- Se guarda en memoria, como todo lo demás: `POST /api/reiniciar` o reiniciar el servidor lo borran.

**`POST /api/extraer-viaje`** (implementado): se envía como `multipart/form-data` con el campo `archivo` (PDF, JPG o PNG, máximo 10 MB). La IA lee una carta porte y regresa los datos para **llenar** el formulario de agregar contenedor; no guarda nada.

```json
{ "id": "ABCD 123456-7", "operador": "R. Gómez", "placas": "52-AM-9F", "terminal": "ICAVE", "respaldo": false }
```

- Un campo que la IA no encuentre llega como `""` (o `null` en `terminal`).
- `id` se regresa ya en el formato `"ABCD 123456-7"` cuando se puede.
- Mismos límites de archivo que `revisar-documento`: `415` si no es PDF, JPG o PNG y `413` si pasa de 10 MB.
- Si `respaldo` es `true`, todos los campos llegan vacíos (sin IA no se puede leer el archivo, y no inventamos datos de ejemplo). Hay que mostrar la etiqueta "respuesta de respaldo"; viene además `motivo_respaldo`.

## Giro: avisos al operador por SMS o voz

El operador no tiene smartphone: PORTIX le avisa por SMS o con una llamada. Todo lo de Twilio vive en `backend/avisos.py`.

- Un contenedor puede traer `telefono` (texto, opcional). En los datos de la demo es **ficticio**; los avisos reales siempre van a `TELEFONO_DEMO` (variable de entorno).
- `GET /api/salud` agrega `sms_real` (`true` si Twilio está configurado) y `sms_modo`: `real` (cuenta completa), `plantilla` (cuenta de prueba: el SMS sale con la plantilla de Twilio y el texto de PORTIX solo se muestra) o `simulado`.

**`POST /api/contenedores/{id}/avisar-operador`**: cuerpo `{ "canal": "sms" }` o `{ "canal": "voz" }` (otro canal responde `422`). Regresa el aviso:

```json
{
  "canal": "sms",
  "texto": "PORTIX TGHU 174826-8: ROJO, NO SALGAS. Ya no llegas a la cita de las 05:45. ...",
  "real": true,
  "plantilla": false,
  "destino": "teléfono de la demo (***4567)",
  "detalle": "Enviado por Twilio (SM...).",
  "hora": "06:15",
  "motivo": "manual"
}
```

- `real: false` significa simulado (Twilio sin configurar o falló); `detalle` dice por qué y la UI muestra "Simulado".
- `plantilla: true` (cuenta de prueba): el SMS salió de verdad, pero con la plantilla de Twilio; `texto` es el de PORTIX y solo se muestra en pantalla.
- Con Twilio configurado, `destino` siempre es el teléfono de la demo enmascarado (`…, no enviado` si falló); el teléfono ficticio solo aparece cuando Twilio no está configurado.
- El SMS siempre tiene 160 caracteres o menos y va sin acentos (GSM-7).
- `motivo` es `manual` (botón) o `reprogramar`: al mover o cancelar una cita, el backend manda un SMS automático.

**`GET /api/contenedores/{id}/avisos`**:

```json
{
  "avisos": [ { "...": "los avisos enviados, en orden" } ],
  "vista_previa": { "sms": "PORTIX ...", "voz": "Hola, S. Luna. Le habla PORTIX..." },
  "sms_real": false,
  "sms_modo": "simulado"
}
```

`POST /api/reiniciar` también borra los avisos.

## Respuestas de respaldo

Si Gemini falla o se agota el límite gratuito, `ia.py` regresa una respuesta de respaldo con la misma forma y `"respaldo": true`. Cuando eso pase, el frontend tiene que mostrar la etiqueta **"respuesta de respaldo"**.

## Errores

Se usan los códigos de FastAPI: `404` si el contenedor no existe (o, en el PATCH, si no tiene ese documento) y `422` si el cuerpo no tiene la forma esperada. El detalle va en `{"detail": "..."}`.

## Notas del backend

- Los cambios hechos con el PATCH, con `reprogramar` y con el chat, el contador de No Show y los mensajes se guardan en memoria, no en `contenedores.json`. Al reiniciar el backend, todo vuelve al estado inicial, así la demo siempre sale igual.
- En el PATCH, `nota` es opcional; si no se manda, la nota anterior se borra.
- La "hora actual" de la demo se configura con `PORTIX_HORA_ACTUAL` en `backend/.env` (por defecto `06:15`).
