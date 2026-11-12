"""
PORTIX: avisos al operador por SMS o por voz (giro del reto).

El giro: "Un transportista no tiene smartphone moderno: la solución debe
avisarle por SMS o por mensaje de voz". Un celular básico recibe SMS y
llamadas, así que PORTIX le manda el color de su contenedor por esas dos vías.

Como ia.py con Gemini, todo lo de Twilio vive en este archivo. El resto del
backend llama a:
- mensaje_sms(): el texto del SMS (máximo 160 caracteres, sin acentos).
- texto_voz(): lo que dice la llamada (más pausado y repetido).
- enviar(): manda el SMS o hace la llamada con Twilio.

Real o simulado: si faltan las variables TWILIO_* o TELEFONO_DEMO, o Twilio
falla, enviar() NO truena: regresa "real": False y la UI muestra "Simulado"
(regla del hackathon: lo simulado se declara).

Cuenta de prueba de Twilio: solo deja mandar SUS plantillas predefinidas (el
"body" es el nombre de la plantilla, por ejemplo "sms_appointment_reminders")
y no permite mensajes de voz propios. Si TWILIO_PLANTILLA_PRUEBA tiene el
nombre de una plantilla, el SMS sale DE VERDAD con esa plantilla (el celular
suena), pero el texto de PORTIX solo se muestra en pantalla y se declara así.
Con una cuenta completa, se deja vacía y sale el texto de PORTIX.

Privacidad: los teléfonos de contenedores.json son FICTICIOS. Los avisos reales
siempre van a TELEFONO_DEMO (el celular de alguien del equipo que aceptó
usarlo), que vive en backend/.env y nunca en el repo.
"""

import base64
import json
import os
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from xml.sax.saxutils import escape

# Un SMS normal (codificación GSM-7) cabe en 160 caracteres. Si lleva una letra
# fuera de GSM-7, como "á" o "ó", el teléfono cambia de codificación y el
# límite baja a 70: el mensaje se partiría en varios. Por eso quitamos acentos.
MAXIMO_SMS = 160
SEGUNDOS_LIMITE = 10  # en una demo en vivo, mejor "simulado" que una pantalla congelada

NOMBRES_DOCUMENTO = {
    "pedimento": "pedimento",
    "carta_porte": "carta porte",
    "folio_cita": "folio de cita",
    "operador_placas": "operador y placas",
    "requisito_carga": "requisito de carga",
}


# --- Texto del SMS ---------------------------------------------------------

def sin_acentos(texto: str) -> str:
    """'Llegarás a la cita' -> 'Llegaras a la cita'. Conserva la ñ (sí está en GSM-7).

    NFD separa cada letra de su acento ("á" -> "a" + "´"); quitamos los acentos
    sueltos y volvemos a juntar. La ñ se protege antes para no volverla "n".
    """
    protegido = texto.replace("ñ", "\0").replace("Ñ", "\1")
    separado = unicodedata.normalize("NFD", protegido)
    limpio = "".join(ch for ch in separado if unicodedata.category(ch) != "Mn")
    return unicodedata.normalize("NFC", limpio).replace("\0", "ñ").replace("\1", "Ñ")


def _pendientes(contenedor: dict) -> list[str]:
    return [
        NOMBRES_DOCUMENTO[d["tipo"]]
        for d in contenedor.get("documentos", [])
        if d.get("estado") in ("falta", "error")
    ]


def mensaje_sms(contenedor: dict) -> str:
    """El SMS para el operador según el color del contenedor.

    contenedor: el contenedor CON su semáforo calculado (color, accion_sugerida...).
    Frases cortas y en mayúsculas lo importante: se lee en una pantalla pequeña.
    """
    c = contenedor
    pendientes = _pendientes(c)
    if c["color"] == "verde":
        inicio = "Cita nueva. " if c.get("estado_cita") == "movida" else ""
        texto = (
            f"PORTIX {c['id']}: VERDE, SAL. {inicio}Salida {c['salida_planeada']} "
            f"a {c['terminal']}, cita {c['cita']}. Documentos completos."
        )
    elif c["color"] == "rojo":
        texto = (
            f"PORTIX {c['id']}: ROJO, NO SALGAS. Ya no llegas a la cita de las {c['cita']}. "
            "Tu despachador la va a mover o cancelar. Espera aviso."
        )
    elif c.get("estado_cita") == "cancelada":
        texto = (
            f"PORTIX {c['id']}: ESPERA, NO SALGAS. Cita cancelada sin cargo. "
            "Te avisamos la nueva cita."
        )
    elif pendientes:
        texto = (
            f"PORTIX {c['id']}: ESPERA, NO SALGAS. Falta {', '.join(pendientes)}. "
            "Te avisamos cuando quede."
        )
    else:
        # Amarillo por horario: llega tarde o antes de la ventana.
        texto = f"PORTIX {c['id']}: ESPERA. {c['accion_sugerida']}. Cita {c['cita']} en {c['terminal']}."

    texto = sin_acentos(texto)
    # Seguro por si un texto largo (varios pendientes) se pasa del límite.
    if len(texto) > MAXIMO_SMS:
        texto = texto[: MAXIMO_SMS - 3] + "..."
    return texto


# --- Texto de la llamada ---------------------------------------------------

def deletrear(id_contenedor: str) -> str:
    """'MSKU 715384-0' -> 'M, S, K, U, 7, 1, 5, 3, 8, 4, guion, 0'.

    Leído de corrido, la voz diría "emskú setecientos quince mil...": separado
    por comas, el operador lo puede comparar con la puerta del contenedor.
    """
    partes = []
    for ch in id_contenedor:
        if ch == "-":
            partes.append("guion")
        elif ch.strip():
            partes.append(ch)
    return ", ".join(partes)


def texto_voz(contenedor: dict) -> str:
    """Lo que dice la llamada: el mismo aviso que el SMS, en frases completas."""
    c = contenedor
    operador = c.get("operador") or "operador"
    if c["color"] == "verde":
        aviso = (
            f"Su contenedor está en verde: puede salir. Salga a las {c['salida_planeada']} "
            f"hacia {c['terminal']}. Su cita es a las {c['cita']}."
        )
    elif c["color"] == "rojo":
        aviso = (
            f"Su contenedor está en rojo: no salga. Ya no alcanza a llegar a la cita de las {c['cita']}. "
            "Su despachador la va a mover o cancelar. Espere su aviso."
        )
    elif c.get("estado_cita") == "cancelada":
        aviso = "Su contenedor está en espera: no salga. La cita se canceló sin cargo. Le avisaremos la nueva cita."
    elif _pendientes(c):
        aviso = (
            f"Su contenedor está en espera: no salga todavía. Falta {', '.join(_pendientes(c))}. "
            "Le avisaremos cuando quede."
        )
    else:
        aviso = f"Su contenedor está en espera. {c['accion_sugerida']}."
    return f"Hola, {operador}. Le habla PORTIX sobre el contenedor {deletrear(c['id'])}. {aviso}"


# --- Envío con Twilio ------------------------------------------------------

def _config() -> dict | None:
    """Las credenciales de Twilio, o None si falta alguna (entonces todo es simulado)."""
    config = {
        "sid": os.getenv("TWILIO_ACCOUNT_SID", "").strip(),
        "token": os.getenv("TWILIO_AUTH_TOKEN", "").strip(),
        "desde": os.getenv("TWILIO_FROM", "").strip(),
        "destino": os.getenv("TELEFONO_DEMO", "").strip(),
    }
    if not all(config.values()):
        return None
    # Opcional: solo para la cuenta de prueba (ver el docstring del módulo).
    config["plantilla"] = os.getenv("TWILIO_PLANTILLA_PRUEBA", "").strip()
    return config


def sms_real_configurado() -> bool:
    return _config() is not None


def modo() -> str:
    """'real' (cuenta completa), 'plantilla' (cuenta de prueba) o 'simulado' (sin Twilio)."""
    config = _config()
    if config is None:
        return "simulado"
    return "plantilla" if config["plantilla"] else "real"


def _enmascarar(telefono: str) -> str:
    """'+522291234567' -> '***4567': en pantalla nunca se ve el número completo."""
    return "***" + telefono[-4:]


def _twiml(texto: str) -> str:
    """Instrucciones para la llamada: dice el aviso, pausa y lo repite.

    Polly.Mia es una voz de español de México. Se puede cambiar con TWILIO_VOZ.
    escape() evita que un texto con "<" o "&" rompa el XML.
    """
    voz = os.getenv("TWILIO_VOZ", "Polly.Mia")
    dicho = escape(texto)
    return (
        "<Response>"
        f'<Say language="es-MX" voice="{voz}">{dicho}</Say>'
        '<Pause length="1"/>'
        f'<Say language="es-MX" voice="{voz}">Repito. {dicho}</Say>'
        "</Response>"
    )


def _llamar_api(config: dict, recurso: str, campos: dict) -> dict:
    """POST a la API REST de Twilio (Messages o Calls). Lanza excepción si falla.

    Usamos urllib (de la librería estándar) en vez del paquete `twilio` para
    no agregar otra dependencia: es una sola petición con usuario y contraseña.
    """
    url = f"https://api.twilio.com/2010-04-01/Accounts/{config['sid']}/{recurso}.json"
    credencial = base64.b64encode(f"{config['sid']}:{config['token']}".encode()).decode()
    peticion = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(campos).encode(),
        headers={"Authorization": f"Basic {credencial}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=SEGUNDOS_LIMITE) as respuesta:
            return json.loads(respuesta.read())
    except urllib.error.HTTPError as error:
        # Twilio explica el problema en {"message": "..."} (número no verificado, etc.).
        try:
            mensaje = json.loads(error.read()).get("message", "")
        except Exception:
            mensaje = ""
        raise RuntimeError(f"Twilio respondió {error.code}: {mensaje}") from error


def enviar(canal: str, contenedor: dict) -> dict:
    """Manda el aviso por "sms" o "voz". Nunca truena.

    Regresa {canal, texto, real, plantilla, destino, detalle}:
    - real=True: Twilio lo aceptó (detalle trae el id de Twilio).
      Si además plantilla=True, salió con la plantilla de prueba de Twilio y
      el texto de PORTIX solo se muestra en pantalla.
    - real=False: simulado; detalle dice por qué.
    """
    texto = mensaje_sms(contenedor) if canal == "sms" else texto_voz(contenedor)
    config = _config()

    def resultado(real: bool, destino: str, detalle: str, plantilla: bool = False) -> dict:
        return {
            "canal": canal,
            "texto": texto,
            "real": real,
            "plantilla": plantilla,
            "destino": destino,
            "detalle": detalle,
        }

    if config is None:
        # Sin Twilio no se intenta nada: mostramos el teléfono FICTICIO del operador.
        return resultado(
            False,
            contenedor.get("telefono") or "sin teléfono",
            "Simulado: Twilio no está configurado en el servidor.",
        )

    # Con Twilio configurado, el único destino posible es el teléfono de la demo.
    demo = f"teléfono de la demo ({_enmascarar(config['destino'])})"

    if canal == "voz" and config["plantilla"]:
        # La cuenta de prueba rechaza el mensaje de voz propio; no gastamos un
        # intento que sabemos que falla. En la UI está "Escuchar aquí".
        return resultado(
            False,
            f"{demo}, no enviado",
            "Simulado: la cuenta de prueba de Twilio no permite mensajes de voz propios. "
            "Usa \"Escuchar aquí\".",
        )

    try:
        if canal == "sms":
            # Con la cuenta de prueba, el Body es el NOMBRE de la plantilla.
            cuerpo = config["plantilla"] or texto
            r = _llamar_api(config, "Messages", {"To": config["destino"], "From": config["desde"], "Body": cuerpo})
        else:
            r = _llamar_api(config, "Calls", {"To": config["destino"], "From": config["desde"], "Twiml": _twiml(texto)})
    except Exception as error:  # sin internet, número no verificado, sin saldo...
        return resultado(False, f"{demo}, no enviado", f"Simulado: Twilio falló ({str(error)[:150]}).")

    sid = r.get("sid", "sin id")
    if canal == "sms" and config["plantilla"]:
        return resultado(
            True,
            demo,
            f"SMS real con la plantilla de prueba de Twilio ({sid}). La cuenta de prueba no "
            "permite texto propio: el texto de PORTIX se muestra aquí, simulado.",
            plantilla=True,
        )
    return resultado(True, demo, f"Enviado por Twilio ({sid}).")
