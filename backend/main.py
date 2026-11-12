"""
PORTIX: punto de entrada del backend (FastAPI).

Endpoints del contrato (docs/contrato-api.md). Las reglas de color viven en
semaforo.py y los modelos de datos en modelos.py; aquí solo se conectan.

Para correrlo (desde la carpeta backend/):
    uvicorn main:app --reload
"""

import json
import os
import re
from pathlib import Path

from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

import ia

from modelos import (
    PATRON_HORA,
    CambioDocumento,
    Congestion,
    Contenedor,
    ContenedorConSemaforo,
    Reprogramar,
    Resumen,
    SimularSalida,
)
from semaforo import a_hora, a_minutos, calcular_semaforo, ultima_salida_para_llegar_a

# Lee backend/.env (si existe) y deja sus valores en os.environ.
# Así nadie escribe la API key en el código.
load_dotenv()

app = FastAPI(title="PORTIX API")


# --- Datos ----------------------------------------------------------------
# Los contenedores se cargan del JSON una sola vez, al arrancar, y se guardan
# en memoria. Los cambios (PATCH) NO se escriben de vuelta al archivo: al
# reiniciar el servidor, la demo vuelve a su estado inicial y siempre sale igual.

CARPETA_DATOS = Path(__file__).parent / "data"
ARCHIVO_CONTENEDORES = CARPETA_DATOS / "contenedores.json"
ARCHIVO_CONGESTION = CARPETA_DATOS / "congestion.json"


def cargar_contenedores() -> dict[str, Contenedor]:
    """Lee el JSON y regresa un diccionario {id: Contenedor}.

    Pydantic valida cada contenedor: si el JSON trae un valor que no está en
    el contrato, el servidor falla al arrancar y dice cuál es el problema.
    """
    with open(ARCHIVO_CONTENEDORES, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    return {c["id"]: Contenedor(**c) for c in datos}


def cargar_congestion() -> dict:
    """Lee la tabla de congestión SIMULADA por hora (F2).

    La validamos con el modelo Congestion para que un error en el JSON se
    note al arrancar, pero la guardamos como dict porque así la usa semaforo.py.
    """
    with open(ARCHIVO_CONGESTION, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    return Congestion(**datos).model_dump()


contenedores = cargar_contenedores()
congestion = cargar_congestion()

# Contador de No Show evitados. Lo incrementa POST /reprogramar cuando se
# mueve o cancela a tiempo una cita que estaba en rojo. Vive en memoria,
# igual que los contenedores: al reiniciar el backend vuelve a 0.
no_show_evitados = 0
CARGO_NO_SHOW_MXN = 999  # ICAVE, aviso ICA-2025-009


# --- Reloj de la demo -----------------------------------------------------

def hora_actual() -> str:
    """La "hora actual" de la demo, configurable con PORTIX_HORA_ACTUAL en .env.

    Usamos una hora fija en vez del reloj real para que la demo dé siempre
    los mismos colores, sin importar a qué hora la presentemos.
    """
    hora = os.getenv("PORTIX_HORA_ACTUAL") or "06:15"
    if not re.match(PATRON_HORA, hora):
        raise ValueError(f"PORTIX_HORA_ACTUAL debe ser HH:MM, llegó '{hora}'")
    return hora


# --- Funciones de apoyo ---------------------------------------------------

def con_semaforo(contenedor: Contenedor) -> ContenedorConSemaforo:
    """Junta los datos guardados del contenedor con los campos calculados."""
    calculado = calcular_semaforo(contenedor, hora_actual(), congestion)
    return ContenedorConSemaforo(**contenedor.model_dump(), **calculado)


def buscar(id: str) -> Contenedor:
    """Regresa el contenedor o responde 404 si no existe."""
    if id not in contenedores:
        raise HTTPException(status_code=404, detail=f"No existe el contenedor '{id}'")
    return contenedores[id]


# --- Endpoints ------------------------------------------------------------

@app.get("/api/salud")
def salud():
    """Endpoint de prueba: confirma que el backend corre.

    Dice si la IA está configurada, pero nunca regresa la API key.
    """
    return {
        "estado": "ok",
        "servicio": "PORTIX",
        "ia_configurada": bool(os.getenv("GEMINI_API_KEY")),
        "modelo": os.getenv("GEMINI_MODEL") or None,
    }


@app.get("/api/contenedores", response_model=list[ContenedorConSemaforo])
def listar_contenedores():
    """Todos los contenedores del día, cada uno con su color calculado."""
    return [con_semaforo(c) for c in contenedores.values()]


# Nota: el id lleva un espacio ("LTSU 402219-8"). En la URL llega como
# "LTSU%20402219-8" y FastAPI lo decodifica solo.
@app.get("/api/contenedores/{id}", response_model=ContenedorConSemaforo)
def detalle_contenedor(id: str):
    """Un contenedor con su color calculado."""
    return con_semaforo(buscar(id))


@app.patch("/api/contenedores/{id}/documentos", response_model=ContenedorConSemaforo)
def cambiar_documento(id: str, cambio: CambioDocumento):
    """Cambia el estado de un documento y regresa el contenedor recalculado."""
    contenedor = buscar(id)
    for doc in contenedor.documentos:
        if doc.tipo == cambio.tipo:
            doc.estado = cambio.estado
            doc.nota = cambio.nota or ""
            return con_semaforo(contenedor)
    raise HTTPException(
        status_code=404,
        detail=f"El contenedor '{id}' no tiene el documento '{cambio.tipo}'",
    )


@app.get("/api/congestion", response_model=Congestion)
def ver_congestion():
    """La tabla de congestión por hora. Es SIMULADA y así lo indica."""
    return congestion


@app.post("/api/contenedores/{id}/simular-salida", response_model=ContenedorConSemaforo)
def simular_salida(id: str, cuerpo: SimularSalida):
    """Recalcula el semáforo con otra hora de salida, SIN guardar el cambio.

    Sirve para que el despachador pruebe "¿y si sale a las 09:15?".
    """
    contenedor = buscar(id)
    # model_copy hace una copia: el contenedor guardado no cambia.
    prueba = contenedor.model_copy(update={"salida_planeada": cuerpo.salida_planeada})
    return con_semaforo(prueba)


@app.post("/api/contenedores/{id}/reprogramar", response_model=ContenedorConSemaforo)
def reprogramar(id: str, cuerpo: Reprogramar):
    """Mueve o cancela la cita. Si estaba en rojo y se hace a tiempo, suma un No Show evitado."""
    global no_show_evitados  # el contador vive fuera de la función

    contenedor = buscar(id)
    antes = con_semaforo(contenedor)

    if cuerpo.accion == "cancelar":
        if contenedor.estado_cita == "cancelada":
            raise HTTPException(status_code=422, detail="La cita ya estaba cancelada")
        contenedor.estado_cita = "cancelada"
    else:  # mover
        if cuerpo.nueva_cita is None:
            raise HTTPException(status_code=422, detail="Para mover la cita hay que mandar nueva_cita")
        # Al mover la cita también movemos la salida: la ponemos a la última
        # hora con la que el camión llega justo a la hora de la nueva cita.
        nueva_salida = ultima_salida_para_llegar_a(a_minutos(cuerpo.nueva_cita), congestion)
        if nueva_salida < a_minutos(hora_actual()):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Son las {hora_actual()}: ya no alcanza a llegar a una cita "
                    f"a las {cuerpo.nueva_cita}. Elige una cita más tarde."
                ),
            )
        contenedor.cita = cuerpo.nueva_cita
        contenedor.salida_planeada = a_hora(nueva_salida)
        contenedor.estado_cita = "movida"

    # Regla de la sección 7: cuenta como No Show evitado si la cita estaba en
    # rojo y se movió o canceló antes de que cerrara su ventana.
    if antes.color == "rojo" and a_minutos(hora_actual()) <= a_minutos(antes.ventana_fin):
        no_show_evitados += 1

    return con_semaforo(contenedor)


# --- F3: revisión de documentos con IA --------------------------------------

TIPOS_ARCHIVO = {"application/pdf", "image/jpeg", "image/png"}
TAMANO_MAXIMO_MB = 10


# `def` (no `async def`) a propósito: la llamada a Gemini tarda unos segundos
# y así FastAPI la corre en otro hilo sin congelar las demás peticiones.
@app.post("/api/contenedores/{id}/revisar-documento")
def revisar_documento(
    id: str,
    archivo: UploadFile = File(...),
    documento: Optional[str] = Form(None),
):
    """Recibe un PDF o una foto, la IA lo compara con el viaje y actualiza el checklist.

    - archivo: el PDF, JPG o PNG que subió el despachador.
    - documento (opcional): qué renglón del checklist actualizar
      ("carta_porte" o "pedimento"). Si no se manda, se usa el tipo que
      detectó la IA, y si no lo reconoce, "carta_porte".

    El documento queda en "ok" si todo coincide, o en "error" si algo no
    coincide o no se pudo leer. La nota guarda el resumen de la IA.
    """
    contenedor = buscar(id)

    if archivo.content_type not in TIPOS_ARCHIVO:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de archivo no permitido ({archivo.content_type}). Usa PDF, JPG o PNG.",
        )
    contenido = archivo.file.read()
    if len(contenido) > TAMANO_MAXIMO_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"El archivo pasa de {TAMANO_MAXIMO_MB} MB.")

    revision = ia.revisar_documento(
        contenido, archivo.content_type, contenedor.model_dump(), archivo.filename or ""
    )

    # ¿Qué renglón del checklist actualizamos?
    tipo = documento or (
        revision["tipo_detectado"] if revision["tipo_detectado"] in ("carta_porte", "pedimento")
        else "carta_porte"
    )
    renglon = next((d for d in contenedor.documentos if d.tipo == tipo), None)
    if renglon is None:
        raise HTTPException(status_code=404, detail=f"El contenedor '{id}' no tiene el documento '{tipo}'")

    renglon.estado = revision["estado_sugerido"]
    renglon.nota = revision["resumen"] + (" (respuesta de respaldo)" if revision["respaldo"] else "")

    return {
        **revision,
        "documento_actualizado": tipo,
        "contenedor": con_semaforo(contenedor),
    }


@app.get("/api/resumen", response_model=Resumen)
def resumen():
    """Cuántos contenedores hay de cada color, y los No Show evitados."""
    conteo = {"verde": 0, "amarillo": 0, "rojo": 0}
    for c in contenedores.values():
        conteo[con_semaforo(c).color] += 1
    return Resumen(
        **conteo,
        no_show_evitados=no_show_evitados,
        ahorro_mxn=no_show_evitados * CARGO_NO_SHOW_MXN,
    )


# =========================================================================
# F4 · Chat simulado con la agencia aduanal
# =========================================================================
# Esta sección va al final del archivo a propósito (acuerdo con Oli: F3 va
# antes de /api/resumen y F4 al final), así el merge no choca. Por la misma
# razón, sus imports están aquí y no arriba.
#
# El chat es SIMULADO: no hay WhatsApp. En la demo, alguien del equipo
# escribe como si fuera la agencia, y la IA (ia.interpretar_mensaje)
# interpreta lo que escribe.

from modelos import Mensaje, MensajeAgencia  # noqa: E402
from semaforo import NOMBRES_DOCUMENTO  # noqa: E402

# Textos para los mensajes que escribe PORTIX en el chat.
TEXTO_ESTADO = {"ok": "listo", "falta": "falta", "error": "con error", "na": "no aplica"}
TEXTO_COLOR = {"verde": "verde (sale)", "amarillo": "amarillo (espera)", "rojo": "rojo (reprogramar)"}

# Mensajes de cada contenedor: {id: [Mensaje, ...]}. Viven en memoria, igual
# que los contenedores: al reiniciar el backend, los chats empiezan de cero.
conversaciones: dict[str, list[Mensaje]] = {}


def aviso_inicial(contenedor: Contenedor) -> Mensaje:
    """El primer mensaje del chat: PORTIX le avisa a la agencia qué falta."""
    pendientes = [d for d in contenedor.documentos if d.estado in ("falta", "error")]
    if pendientes:
        detalle = "; ".join(
            f"{NOMBRES_DOCUMENTO[d.tipo]} ({d.nota or TEXTO_ESTADO[d.estado]})" for d in pendientes
        )
        texto = (
            f"Aviso de PORTIX sobre el contenedor {contenedor.id} (cita {contenedor.cita}): "
            f"falta resolver {detalle}. ¿Nos confirman cuando quede?"
        )
    else:
        texto = f"El contenedor {contenedor.id} tiene todos sus documentos completos."
    return Mensaje(de="portix", texto=texto, hora=hora_actual())


def historial(contenedor: Contenedor) -> list[Mensaje]:
    """Los mensajes del contenedor. Si el chat es nuevo, empieza con el aviso."""
    if contenedor.id not in conversaciones:
        conversaciones[contenedor.id] = [aviso_inicial(contenedor)]
    return conversaciones[contenedor.id]


@app.get("/api/contenedores/{id}/chat")
def ver_chat(id: str):
    """El historial del chat con la agencia sobre este contenedor."""
    return {"mensajes": historial(buscar(id))}


# `def` (no `async def`) por la misma razón que revisar-documento: la llamada
# a Gemini tarda unos segundos y así no congela las demás peticiones.
@app.post("/api/contenedores/{id}/chat")
def chat(id: str, cuerpo: MensajeAgencia):
    """Recibe un mensaje de la agencia, la IA lo interpreta y se actualiza el checklist."""
    contenedor = buscar(id)
    texto = cuerpo.texto.strip()
    if not texto:
        raise HTTPException(status_code=422, detail="El mensaje está vacío")

    mensajes = historial(contenedor)
    mensajes.append(Mensaje(de="agencia", texto=texto, hora=hora_actual()))

    # ia.py nunca truena: si Gemini falla, regresa una respuesta de respaldo
    # con "respaldo": True. Su forma está en ia.InterpretacionMensaje.
    interpretacion = ia.interpretar_mensaje(texto, contenedor.model_dump())

    # Solo cambiamos el checklist si la IA identificó documento Y estado, no
    # tiene dudas (confianza baja = revisar a mano) y el contenedor tiene ese
    # documento. Así un "buenos días" o un mensaje ambiguo no cambia nada.
    renglon = None
    if (
        interpretacion["documento"] != "ninguno"
        and interpretacion["nuevo_estado"] != "sin_cambio"
        and interpretacion["confianza"] != "baja"
    ):
        renglon = next(
            (d for d in contenedor.documentos if d.tipo == interpretacion["documento"]), None
        )
    if renglon:
        nuevo_estado = interpretacion["nuevo_estado"]
        # Regla estricta: si la agencia confirma pero todavía debe mandar algo
        # (un comprobante, un PDF), el documento sigue pendiente hasta recibirlo.
        if nuevo_estado == "ok" and interpretacion["pendiente"]:
            nuevo_estado = "falta"
        renglon.estado = nuevo_estado
        renglon.nota = f"Agencia {hora_actual()}: {interpretacion['resumen']}"
        if interpretacion["pendiente"]:
            renglon.nota += f" Pendiente: {interpretacion['pendiente']}."
        if interpretacion["respaldo"] and "respaldo" not in renglon.nota.lower():
            renglon.nota += " (respuesta de respaldo)"

    actualizado = con_semaforo(contenedor)

    # PORTIX contesta en el chat: qué entendió la IA y qué cambió.
    if renglon:
        efecto = (
            f"{NOMBRES_DOCUMENTO[renglon.tipo].capitalize()} queda como "
            f"'{TEXTO_ESTADO[renglon.estado]}'. El contenedor está en "
            f"{TEXTO_COLOR[actualizado.color]}."
        )
    else:
        efecto = "No cambió ningún documento; si hace falta, ajústalo a mano en el checklist."
    if interpretacion["pendiente"]:
        efecto += f" Pendiente: {interpretacion['pendiente']}."
    respuesta = f"{interpretacion['resumen']} {efecto}"
    # El resumen del respaldo ya empieza con "Respuesta de respaldo:", pero lo
    # aseguramos por si cambia el texto en ia.py.
    if interpretacion["respaldo"] and "respaldo" not in respuesta.lower():
        respuesta += " (respuesta de respaldo)"
    mensajes.append(Mensaje(de="portix", texto=respuesta, hora=hora_actual()))

    return {
        "interpretacion": interpretacion,
        "respaldo": interpretacion["respaldo"],
        "documento_actualizado": renglon.tipo if renglon else None,
        "contenedor": actualizado,
        "mensajes": mensajes,
    }
