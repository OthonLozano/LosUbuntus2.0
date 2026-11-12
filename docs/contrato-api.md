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
  "accion_sugerida": "Corregir carta porte y salir antes de 10:30"
}
```

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
  "por_hora": { "06": "baja", "07": "baja", "08": "media", "09": "alta" }
}
```

**`POST /api/contenedores/{id}/simular-salida`**: regresa el contenedor recalculado sin guardar el cambio.

```json
{ "salida_planeada": "09:15" }
```

**`POST /api/contenedores/{id}/reprogramar`**: regresa el contenedor actualizado.

```json
{ "accion": "mover", "nueva_cita": "14:00" }
```

`accion` puede ser `mover` o `cancelar`. Con `cancelar` no se manda `nueva_cita`.

**`POST /api/contenedores/{id}/revisar-documento`**: se envía como `multipart/form-data` con un campo `archivo` (PDF, JPG o PNG). Regresa:

```json
{
  "tipo_documento": "carta_porte",
  "datos_extraidos": { "placas": "52-AM-9E", "operador": "L. Ramírez", "contenedor": "LTSU 402219-8" },
  "diferencias": ["Las placas del documento (52-AM-9E) no coinciden con las del viaje (52-AM-9F)"],
  "estado_sugerido": "error",
  "respaldo": false,
  "contenedor": { "...": "el contenedor con su color recalculado" }
}
```

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

Se usan los códigos de FastAPI: `404` si el contenedor no existe y `422` si el cuerpo no tiene la forma esperada. El detalle va en `{"detail": "..."}`.
