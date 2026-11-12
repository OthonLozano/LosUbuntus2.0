"""
PORTIX: todas las llamadas a la IA viven en este archivo.

Usamos Gemini (plan gratuito de Google AI Studio). Si algún día cambiamos de
proveedor (Sintergica, Groq...), solo se modifica este archivo: el resto del
backend llama a las dos funciones públicas y recibe siempre un dict con la
misma forma.

Funciones públicas:
- revisar_documento(): lee un PDF o una foto y lo compara con los datos del viaje.
- interpretar_mensaje(): entiende lo que contesta la agencia aduanal por chat.

Respaldo: si no hay API key, si Gemini falla o si se agota el límite gratuito,
las funciones NO truenan. Regresan una "respuesta de respaldo" con
"respaldo": True, y la UI debe mostrarlo así (regla del hackathon: lo simulado
se declara).
"""

import os
import re
from typing import Literal, Optional

from pydantic import BaseModel

# --- Formas de las respuestas ----------------------------------------------
# Se las pasamos a Gemini como "esquema" para que conteste JSON con esta forma
# exacta, y luego las usamos para validar lo que contestó.

TipoDocumento = Literal[
    "pedimento", "carta_porte", "folio_cita", "operador_placas", "requisito_carga"
]


class Hallazgo(BaseModel):
    """Un dato comparado entre el documento y el viaje."""

    campo: str  # por ejemplo "placas", "contenedor", "operador"
    valor_en_documento: str
    valor_esperado: str
    coincide: bool


class RevisionDocumento(BaseModel):
    tipo_detectado: Literal["pedimento", "carta_porte", "otro"]
    legible: bool
    hallazgos: list[Hallazgo]
    # "ok" si todo coincide; "error" si algo no coincide o no se pudo leer.
    estado_sugerido: Literal["ok", "error"]
    resumen: str  # una frase en español para mostrar en pantalla


class InterpretacionMensaje(BaseModel):
    documento: Literal[
        "pedimento", "carta_porte", "folio_cita", "operador_placas",
        "requisito_carga", "ninguno",
    ]
    nuevo_estado: Literal["ok", "falta", "error", "sin_cambio"]
    pendiente: str  # lo que todavía falta, por ejemplo "comprobante"; "" si nada
    resumen: str  # "La IA entendió: ..." para mostrar en el chat
    confianza: Literal["alta", "media", "baja"]


# --- Conexión con Gemini ---------------------------------------------------

SEGUNDOS_LIMITE = 15  # por modelo intentado
NIVEL_RAZONAMIENTO = "LOW"  # MINIMAL, LOW, MEDIUM o HIGH


def _cliente_y_modelos():
    """Regresa (cliente, [modelos]) o (None, []) si falta configuración.

    GEMINI_MODEL puede traer varios modelos separados por coma, en orden de
    preferencia (por ejemplo "gemini-3.5-flash,gemini-3.6-flash"). Si el
    primero está saturado, se intenta el siguiente.

    El cliente se crea al momento de usarse para que el backend arranque
    aunque no haya key (en ese caso todo usa respaldo).
    """
    key = os.getenv("GEMINI_API_KEY")
    modelos = [m.strip() for m in (os.getenv("GEMINI_MODEL") or "").split(",") if m.strip()]
    if not key or not modelos:
        return None, []
    from google import genai  # importación local: solo se necesita si hay key
    from google.genai import types

    # Límite de tiempo por intento: en una demo en vivo es mejor una respuesta
    # de respaldo que una pantalla congelada.
    # Un solo intento por modelo: sin esto, la librería reintenta sola y la
    # espera se multiplica.
    opciones = types.HttpOptions(
        timeout=SEGUNDOS_LIMITE * 1000,
        retry_options=types.HttpRetryOptions(attempts=1),
    )
    return genai.Client(api_key=key, http_options=opciones), modelos


def _pedir_json(contenido: list, esquema: type[BaseModel], instrucciones: str):
    """Llama a Gemini pidiendo JSON con la forma de `esquema` y lo valida.

    Lanza una excepción si algo sale mal; quien la llama decide el respaldo.
    """
    from google.genai import types

    cliente, modelos = _cliente_y_modelos()
    if cliente is None:
        raise RuntimeError("Falta GEMINI_API_KEY o GEMINI_MODEL en backend/.env")

    config = types.GenerateContentConfig(
        system_instruction=instrucciones,
        response_mime_type="application/json",
        response_schema=esquema,
        # Razonamiento bajo: estas tareas son de extraer y comparar datos,
        # no necesitan pensar mucho, y así la respuesta llega más rápido.
        thinking_config=types.ThinkingConfig(thinking_level=NIVEL_RAZONAMIENTO),
    )
    ultimo_error = None
    for modelo in modelos:
        try:
            respuesta = cliente.models.generate_content(
                model=modelo, contents=contenido, config=config
            )
            return esquema.model_validate_json(respuesta.text)
        except Exception as error:  # saturado, límite, respuesta inválida...
            ultimo_error = error
    raise ultimo_error


# --- 1. Revisar un documento (F3) ------------------------------------------

INSTRUCCIONES_REVISION = """Eres un asistente de una transportista en el puerto de Veracruz.
Revisas documentos de un viaje (carta porte o comprobante de pedimento) ANTES de que
el camión salga al puerto, para evitar que lo rechacen en el acceso.

Extrae del documento: número de contenedor, placas, nombre del operador y, si aparece,
número de pedimento. Compáralos con los datos del viaje que te dan y genera un
hallazgo por cada dato que puedas comparar.

Reglas:
- Ignora espacios, guiones y mayúsculas al comparar ("52-AM-9F" = "52am9f").
- Si un dato no aparece en el documento, no inventes: no generes ese hallazgo.
- estado_sugerido = "ok" solo si el documento es legible y todos los hallazgos coinciden.
- Solo revisas consistencia entre documentos; no validas nada contra el SAT.
- resumen: una sola frase en español, clara para un despachador."""


def revisar_documento(
    contenido: bytes,
    mime_type: str,
    datos_viaje: dict,
    nombre_archivo: str = "",
) -> dict:
    """Revisa un PDF o una imagen contra los datos del viaje.

    contenido: los bytes del archivo subido.
    mime_type: "application/pdf", "image/jpeg" o "image/png".
    datos_viaje: el contenedor (id, placas, operador...) tal como lo tiene el backend.
    nombre_archivo: solo se usa en el respaldo.

    Regresa un dict con la forma de RevisionDocumento más "respaldo": bool.
    """
    pregunta = (
        "Datos del viaje con los que debes comparar:\n"
        f"- Contenedor: {datos_viaje.get('id', '')}\n"
        f"- Placas de la unidad asignada: {datos_viaje.get('placas', '')}\n"
        f"- Operador: {datos_viaje.get('operador', '')}\n"
        f"- Terminal: {datos_viaje.get('terminal', '')}"
    )
    try:
        from google.genai import types

        archivo = types.Part.from_bytes(data=contenido, mime_type=mime_type)
        resultado = _pedir_json([archivo, pregunta], RevisionDocumento, INSTRUCCIONES_REVISION)
        return {**resultado.model_dump(), "respaldo": False}
    except Exception as error:  # sin key, sin internet, límite agotado, etc.
        return _respaldo_revision(datos_viaje, nombre_archivo, error)


def _respaldo_revision(datos_viaje: dict, nombre_archivo: str, error: Exception) -> dict:
    """Respuesta pregrabada para la demo cuando Gemini no está disponible.

    No lee el archivo: si su nombre contiene "error", simula que las placas no
    coinciden; si no, simula que todo coincide. La UI la marca como respaldo.
    """
    placas = datos_viaje.get("placas", "")
    con_error = "error" in nombre_archivo.lower()
    placas_doc = placas[::-1] if con_error else placas  # placas "equivocadas" de ejemplo
    return {
        "tipo_detectado": "carta_porte",
        "legible": True,
        "hallazgos": [
            {
                "campo": "placas",
                "valor_en_documento": placas_doc,
                "valor_esperado": placas,
                "coincide": not con_error,
            }
        ],
        "estado_sugerido": "error" if con_error else "ok",
        "resumen": (
            "Respuesta de respaldo: las placas de la carta porte no coinciden con la unidad asignada."
            if con_error
            else "Respuesta de respaldo: los datos del documento coinciden con el viaje."
        ),
        "respaldo": True,
        "motivo_respaldo": str(error)[:200],
    }


# --- 2. Interpretar un mensaje de la agencia (F4) ---------------------------

INSTRUCCIONES_MENSAJE = """Eres un asistente de una transportista en el puerto de Veracruz.
Lees los mensajes que manda la agencia aduanal por WhatsApp, escritos en español
coloquial y a veces con faltas de ortografía, y decides qué documento del
contenedor mencionan y en qué estado queda.

Documentos posibles: pedimento, carta_porte, folio_cita, operador_placas, requisito_carga.

Reglas:
- "ya quedó pagado", "ya se pagó", "listo el pedimento" -> pedimento en "ok".
- Si dicen que algo falta, sigue pendiente o tiene un problema -> "falta" o "error".
- Si el mensaje no cambia nada (saludos, preguntas) -> documento "ninguno", "sin_cambio".
- Si prometen mandar algo después (un comprobante), ponlo en "pendiente".
- Si no queda nada pendiente, deja "pendiente" como texto vacío "".
- Si el mensaje es ambiguo, usa confianza "baja" y no cambies el estado.
- resumen: empieza con "La IA entendió:" y es una sola frase en español."""


def interpretar_mensaje(texto: str, contenedor: dict) -> dict:
    """Interpreta lo que escribió la agencia sobre un contenedor.

    texto: el mensaje tal cual llegó ("ya quedó pagado, al rato te paso el comprobante").
    contenedor: el contenedor con sus documentos, para darle contexto a la IA.

    Regresa un dict con la forma de InterpretacionMensaje más "respaldo": bool.
    """
    pendientes = [
        d["tipo"] for d in contenedor.get("documentos", [])
        if d.get("estado") in ("falta", "error")
    ]
    pregunta = (
        f"Contenedor: {contenedor.get('id', '')}\n"
        f"Documentos pendientes ahora: {', '.join(pendientes) or 'ninguno'}\n"
        f"Mensaje de la agencia: \"{texto}\""
    )
    try:
        resultado = _pedir_json([pregunta], InterpretacionMensaje, INSTRUCCIONES_MENSAJE)
        datos = resultado.model_dump()
        # A veces el modelo escribe "ninguno" en vez de dejar el campo vacío.
        if datos["pendiente"].strip().lower() in ("ninguno", "ninguna", "nada", "n/a", "na"):
            datos["pendiente"] = ""
        return {**datos, "respaldo": False}
    except Exception as error:
        return _respaldo_mensaje(texto, pendientes, error)


def _respaldo_mensaje(texto: str, pendientes: list[str], error: Exception) -> dict:
    """Interpretación por palabras clave cuando Gemini no está disponible."""
    t = texto.lower()
    documento: Optional[str] = None
    for tipo, palabras in {
        "pedimento": ["pedimento"],
        "carta_porte": ["carta porte", "carta-porte"],
        "folio_cita": ["cita", "folio"],
    }.items():
        if any(p in t for p in palabras):
            documento = tipo
            break
    if documento is None and len(pendientes) == 1:
        documento = pendientes[0]  # si solo hay un pendiente, asumimos que hablan de ese

    confirma = bool(re.search(r"pagad|pagó|pago|listo|ya qued|ya est", t))
    pendiente = "comprobante" if "comprobante" in t else ""

    if documento and confirma:
        return {
            "documento": documento,
            "nuevo_estado": "ok",
            "pendiente": pendiente,
            "resumen": f"Respuesta de respaldo: la agencia confirma {documento.replace('_', ' ')}.",
            "confianza": "media",
            "respaldo": True,
            "motivo_respaldo": str(error)[:200],
        }
    return {
        "documento": "ninguno",
        "nuevo_estado": "sin_cambio",
        "pendiente": pendiente,
        "resumen": "Respuesta de respaldo: no se pudo interpretar el mensaje; revisar a mano.",
        "confianza": "baja",
        "respaldo": True,
        "motivo_respaldo": str(error)[:200],
    }
