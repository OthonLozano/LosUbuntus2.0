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
| `GET /api/salud` | Prueba de que el backend corre (ya existe) | F0 |
| `GET /api/contenedores` | Lista con color calculado | F1 |
| `GET /api/contenedores/{id}` | Detalle de un contenedor | F1 |
| `PATCH /api/contenedores/{id}/documentos` | Cambiar el estado de un documento | F1 |
| `GET /api/resumen` | Conteo por color y No Show evitados | F1 / F2 |
| `GET /api/congestion` | Congestión por hora (simulada) | F2 |
| `POST /api/contenedores/{id}/simular-salida` | Recalcular con otra hora de salida | F2 |
| `POST /api/contenedores/{id}/reprogramar` | Mover o cancelar la cita (suma al contador) | F2 |
| `POST /api/contenedores/{id}/revisar-documento` | Subir un PDF o una foto para que la IA lo revise | F3 |
| `POST /api/contenedores/{id}/chat` | Mensaje de la agencia; la IA lo interpreta | F4 |

Nota: el `id` lleva un espacio (`LTSU 402219-8`). En el frontend hay que codificarlo con `encodeURIComponent(id)` al armar la URL.

## Cuerpos de las peticiones (propuesta)

Son la forma inicial. Quien implemente el endpoint puede ajustarla, pero tiene que actualizar este archivo y avisar.

**`PATCH /api/contenedores/{id}/documentos`**: regresa el contenedor con su color recalculado.

```json
{ "tipo": "carta_porte", "estado": "ok", "nota": "Corregida por la agencia" }
```

**`GET /api/resumen`**

```json
{ "verde": 3, "amarillo": 2, "rojo": 2, "no_show_evitados": 0, "ahorro_mxn": 0 }
```

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

**`POST /api/contenedores/{id}/chat`**

```json
{ "texto": "Ya quedó pagado el pedimento" }
```

Regresa:

```json
{
  "interpretacion": { "documento": "pedimento", "estado_nuevo": "ok", "resumen": "La agencia confirma el pago del pedimento" },
  "respaldo": false,
  "contenedor": { "...": "el contenedor con su color recalculado" }
}
```

## Respuestas de respaldo

Si Gemini falla o se agota el límite gratuito, `ia.py` regresa una respuesta de respaldo con la misma forma y `"respaldo": true`. Cuando eso pase, el frontend tiene que mostrar la etiqueta **"respuesta de respaldo"**.

## Errores

Se usan los códigos de FastAPI: `404` si el contenedor no existe (o, en el PATCH, si no tiene ese documento) y `422` si el cuerpo no tiene la forma esperada. El detalle va en `{"detail": "..."}`.

## Notas del backend

- Los cambios hechos con el PATCH y con `reprogramar`, y el contador de No Show, se guardan en memoria, no en `contenedores.json`. Al reiniciar el backend, todo vuelve al estado inicial, así la demo siempre sale igual.
- En el PATCH, `nota` es opcional; si no se manda, la nota anterior se borra.
- La "hora actual" de la demo se configura con `PORTIX_HORA_ACTUAL` en `backend/.env` (por defecto `06:15`).
