"""
PORTIX: reglas del semáforo (sección 7 del plan del equipo, corregida en la F5).

Aquí no hay FastAPI ni archivos: solo funciones que reciben datos y regresan
un resultado. main.py lee data/congestion.json y nos pasa la tabla.

Reglas:
- Ventana de la cita: de 2 h antes a 1 h después de la cita (regla de ICAVE).
- Traslado del patio al puerto: 45 min × la congestión de la hora de salida
  (baja ×1.0, media ×1.3, alta ×1.5). La congestión por hora es SIMULADA.
- Salida efectiva: la salida planeada, o la hora actual si la planeada ya pasó
  (todos los camiones del tablero siguen en el patio; si ya era su hora y no
  salió, lo más temprano que puede salir es ahora).
- Llegada estimada = salida efectiva + traslado.

Color, en este orden (gana la primera regla que se cumpla):
1. Cita cancelada -> amarillo (espera una cita nueva).
2. Ni saliendo AHORA llega antes del cierre de la ventana -> ROJO
   (mover o cancelar la cita antes del cierre para evitar el No Show).
3. Algún documento en falta o error -> amarillo (todavía hay tiempo).
4. Con la salida planeada llega después del cierre -> amarillo
   (adelantar la salida: todavía alcanza).
5. Llega antes de que abra la ventana -> amarillo (salir más tarde).
6. Si no, verde.

Por qué cambió en la F5: antes el rojo comparaba la salida PLANEADA contra la
ventana. A las 06:15 marcaba rojo una cita de las 13:00 que llegaba de sobra
saliendo antes. Rojo debe significar "ya no llega a tiempo", así que ahora se
decide con la hora actual.
"""

import math

from modelos import Contenedor

# Tolerancia de la cita en ICAVE (aviso ICA-2022-013).
MINUTOS_ANTES_DE_CITA = 120
MINUTOS_DESPUES_DE_CITA = 60

# Traslado base del patio al puerto, sin congestión. Se usa tal cual si no
# hay tabla de congestión (así funcionaba la F1).
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


# --- Congestión y traslado ------------------------------------------------

def nivel_congestion(salida: int, congestion: dict | None) -> str:
    """'baja', 'media' o 'alta' para la hora en que sale el camión.

    La tabla usa la hora en punto ("09" cubre de 09:00 a 09:59). Las horas
    que no están en la tabla se consideran 'baja' (está declarado en el JSON).
    """
    if congestion is None:
        return "baja"
    hora = a_hora(salida)[:2]
    return congestion["por_hora"].get(hora, "baja")


def traslado_min(salida: int, congestion: dict | None) -> int:
    """Minutos de traslado si el camión sale a esa hora."""
    if congestion is None:
        return TRASLADO_MIN
    base = congestion["traslado_base_min"]
    multiplicador = congestion["multiplicadores"][nivel_congestion(salida, congestion)]
    # Redondeamos hacia arriba (45 × 1.3 = 58.5 -> 59): es mejor estimar de
    # más que prometer una llegada que no se cumple.
    return math.ceil(base * multiplicador)


def ultima_salida_para_llegar_a(limite: int, congestion: dict | None) -> int:
    """La hora más tarde a la que puede salir y llegar a más tardar a `limite`.

    Como el traslado cambia según la hora de salida, no basta con restar 45:
    probamos minuto por minuto hacia atrás hasta encontrar una salida que llegue.
    """
    salida = limite
    while salida + traslado_min(salida, congestion) > limite:
        salida -= 1
    return salida


def primera_salida_para_llegar_desde(inicio: int, congestion: dict | None) -> int:
    """La hora más temprana a la que puede salir sin llegar antes de `inicio`.

    Empezamos 3 h antes (ningún traslado dura tanto) y avanzamos minuto a minuto.
    """
    salida = inicio - 180
    while salida + traslado_min(salida, congestion) < inicio:
        salida += 1
    return salida


# --- Reglas ---------------------------------------------------------------

def documentos_pendientes(contenedor: Contenedor) -> list[str]:
    """Regresa los documentos que están en 'falta' o 'error' (con nombre legible)."""
    return [
        NOMBRES_DOCUMENTO[doc.tipo]
        for doc in contenedor.documentos
        if doc.estado in ("falta", "error")
    ]


def calcular_semaforo(
    contenedor: Contenedor, hora_actual: str, congestion: dict | None = None
) -> dict:
    """Calcula el color y los campos extra que pide el contrato.

    hora_actual: la "hora del reloj de la demo" (por ejemplo "06:15"), para
    que la demo siempre dé el mismo resultado sin importar la hora real.
    congestion: el contenido de data/congestion.json. Si es None, el traslado
    es de 45 min fijos.
    """
    ahora = a_minutos(hora_actual)
    cita = a_minutos(contenedor.cita)
    ventana_inicio = cita - MINUTOS_ANTES_DE_CITA
    ventana_fin = cita + MINUTOS_DESPUES_DE_CITA

    # Si la salida planeada ya pasó, el camión sigue en el patio: lo más
    # temprano que puede salir es ahora. Sin esto, la llegada estimada sería
    # una hora que ya no puede pasar.
    salida = max(a_minutos(contenedor.salida_planeada), ahora)
    traslado = traslado_min(salida, congestion)
    llegada = salida + traslado
    llega_tarde = llegada > ventana_fin

    # La última hora a la que el camión puede salir y todavía llegar a tiempo.
    ultima_salida = ultima_salida_para_llegar_a(ventana_fin, congestion)
    # Si ya pasó esa hora, ni saliendo ahora llega: eso (y solo eso) es rojo.
    ya_no_llega = ahora > ultima_salida

    pendientes = documentos_pendientes(contenedor)
    texto_pendientes = ", ".join(pendientes)

    # El orden importa: primero los casos especiales, luego lo más grave
    # (rojo) y al final el verde.
    if contenedor.estado_cita == "cancelada":
        # La cita se canceló a tiempo: el camión no sale, pero el contenedor
        # sigue pendiente de una cita nueva. Por eso es "espera" y no "sale".
        color = "amarillo"
        motivo = "Cita cancelada a tiempo, sin cargo de No Show"
        accion = "Solicitar una nueva cita a la terminal"
    elif ya_no_llega:
        color = "rojo"
        llegada_si_sale_ahora = ahora + traslado_min(ahora, congestion)
        motivo = (
            f"Aunque saliera ahora ({hora_actual}) llegaría a las "
            f"{a_hora(llegada_si_sale_ahora)}, después del cierre ({a_hora(ventana_fin)})"
        )
        if pendientes:
            motivo += f". Además falta resolver: {texto_pendientes}"
        if ahora <= ventana_fin:
            accion = (
                f"Mover o cancelar la cita antes de las {a_hora(ventana_fin)} "
                "para evitar el No Show"
            )
        else:
            # La ventana ya cerró: el cargo ya no se puede evitar.
            accion = "La ventana ya cerró: solicitar una nueva cita a la terminal"
    elif pendientes:
        color = "amarillo"
        motivo = f"Falta resolver: {texto_pendientes}"
        if llega_tarde:
            motivo += (
                f". Además, con salida a las {contenedor.salida_planeada} llegaría a las "
                f"{a_hora(llegada)}, después del cierre ({a_hora(ventana_fin)})"
            )
        accion = f"Resolver {texto_pendientes} y salir a más tardar a las {a_hora(ultima_salida)}"
    elif llega_tarde:
        # Todo está en orden y todavía alcanza: no hay que reprogramar,
        # basta con salir antes.
        color = "amarillo"
        motivo = (
            f"Con salida a las {contenedor.salida_planeada} llegaría a las {a_hora(llegada)}, "
            f"después del cierre de la ventana ({a_hora(ventana_fin)})"
        )
        accion = f"Adelantar la salida a las {a_hora(ultima_salida)} o antes"
    elif llegada < ventana_inicio:
        # Todo está en orden, pero llegaría antes de que abra la ventana y
        # tendría que esperar formado. No es verde (no cae en la ventana) ni
        # rojo (hay tiempo de sobra).
        color = "amarillo"
        motivo = (
            f"Llegaría a las {a_hora(llegada)}, antes de que abra la ventana "
            f"({a_hora(ventana_inicio)})"
        )
        primera = primera_salida_para_llegar_desde(ventana_inicio, congestion)
        accion = f"Salir a partir de las {a_hora(primera)}"
    else:
        color = "verde"
        motivo = "Documentos completos y llega dentro de la ventana de su cita"
        accion = f"Salir a las {a_hora(salida)}"

    return {
        "color": color,
        "motivo": motivo,
        "ventana_inicio": a_hora(ventana_inicio),
        "ventana_fin": a_hora(ventana_fin),
        "llegada_estimada": a_hora(llegada),
        "accion_sugerida": accion,
        "traslado_min": traslado,
        "congestion": nivel_congestion(salida, congestion),
    }
