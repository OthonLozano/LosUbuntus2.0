"""
PORTIX: reglas del semáforo (sección 7 del plan del equipo, v1).

Aquí no hay FastAPI ni archivos: solo funciones que reciben datos y regresan
un resultado. Así se pueden probar solas y la F2 solo tiene que cambiar el
traslado (multiplicándolo por la congestión) sin tocar las reglas.

Reglas:
- Ventana de la cita: de 2 h antes a 1 h después de la cita (regla de ICAVE).
- Llegada estimada = salida planeada + traslado (45 min fijos en F1).
- Verde: documentos en ok o na, y la llegada cae dentro de la ventana.
- Amarillo: algún documento en falta o error, pero todavía hay tiempo
  (hora actual + traslado <= fin de la ventana).
- Rojo: la llegada queda después del fin de la ventana, o hay documentos
  pendientes y ya no hay tiempo.
"""

from modelos import Contenedor

# Tolerancia de la cita en ICAVE (aviso ICA-2022-013).
MINUTOS_ANTES_DE_CITA = 120
MINUTOS_DESPUES_DE_CITA = 60

# Traslado del patio al puerto. En F1 es fijo; en F2 se multiplica por la
# congestión de la hora de salida.
TRASLADO_MIN = 45

# Nombres legibles para armar los textos de motivo y acción.
NOMBRES_DOCUMENTO = {
    "pedimento": "pedimento",
    "carta_porte": "carta porte",
    "folio_cita": "folio de la cita",
    "operador_placas": "operador y placas",
    "requisito_carga": "requisito de la carga",
}


# --- Utilidades de hora ---------------------------------------------------
# Trabajamos en "minutos desde la medianoche" porque sumar y comparar enteros
# es más simple que hacerlo con textos "HH:MM".

def a_minutos(hora: str) -> int:
    """'09:30' -> 570"""
    horas, minutos = hora.split(":")
    return int(horas) * 60 + int(minutos)


def a_hora(minutos: int) -> str:
    """570 -> '09:30'. El % 1440 evita horas como 25:00 si algo pasa de medianoche."""
    minutos = minutos % (24 * 60)
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


# --- Reglas ---------------------------------------------------------------

def documentos_pendientes(contenedor: Contenedor) -> list[str]:
    """Regresa los documentos que están en 'falta' o 'error' (con nombre legible)."""
    return [
        NOMBRES_DOCUMENTO[doc.tipo]
        for doc in contenedor.documentos
        if doc.estado in ("falta", "error")
    ]


def calcular_semaforo(
    contenedor: Contenedor, hora_actual: str, traslado_min: int = TRASLADO_MIN
) -> dict:
    """Calcula el color y los campos extra que pide el contrato.

    hora_actual: la "hora del reloj de la demo" (por ejemplo "06:15"), para
    que la demo siempre dé el mismo resultado sin importar la hora real.
    """
    cita = a_minutos(contenedor.cita)
    ventana_inicio = cita - MINUTOS_ANTES_DE_CITA
    ventana_fin = cita + MINUTOS_DESPUES_DE_CITA
    llegada = a_minutos(contenedor.salida_planeada) + traslado_min

    # La última hora a la que el camión puede salir y todavía llegar a tiempo.
    ultima_salida = ventana_fin - traslado_min

    pendientes = documentos_pendientes(contenedor)
    # ¿Si saliera ahora mismo, alcanzaría a llegar antes de que cierre la ventana?
    hay_tiempo = a_minutos(hora_actual) + traslado_min <= ventana_fin

    # El orden importa: primero lo más grave (rojo) y al final el verde.
    if llegada > ventana_fin:
        color = "rojo"
        motivo = (
            f"Con salida a las {contenedor.salida_planeada} llega a las {a_hora(llegada)}, "
            f"después del cierre de la ventana ({a_hora(ventana_fin)})"
        )
        accion = f"Mover o cancelar la cita antes de las {a_hora(ventana_fin)} para evitar el No Show"
    elif pendientes and not hay_tiempo:
        color = "rojo"
        motivo = f"Falta resolver: {', '.join(pendientes)}, y ya no alcanza a llegar a la ventana"
        accion = f"Mover o cancelar la cita antes de las {a_hora(ventana_fin)} para evitar el No Show"
    elif pendientes:
        color = "amarillo"
        motivo = f"Falta resolver: {', '.join(pendientes)}"
        accion = f"Resolver {', '.join(pendientes)} y salir a más tardar a las {a_hora(ultima_salida)}"
    elif llegada < ventana_inicio:
        # Caso que la sección 7 no menciona: todo está en orden, pero llegaría
        # antes de que abra la ventana y tendría que esperar formado. No es
        # verde (no cae en la ventana) ni rojo (hay tiempo de sobra).
        color = "amarillo"
        motivo = (
            f"Llegaría a las {a_hora(llegada)}, antes de que abra la ventana "
            f"({a_hora(ventana_inicio)})"
        )
        accion = f"Salir a partir de las {a_hora(ventana_inicio - traslado_min)}"
    else:
        color = "verde"
        motivo = "Documentos completos y llega dentro de la ventana de su cita"
        accion = f"Salir a las {contenedor.salida_planeada}"

    return {
        "color": color,
        "motivo": motivo,
        "ventana_inicio": a_hora(ventana_inicio),
        "ventana_fin": a_hora(ventana_fin),
        "llegada_estimada": a_hora(llegada),
        "accion_sugerida": accion,
    }
