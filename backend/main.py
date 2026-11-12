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

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from modelos import (
    PATRON_HORA,
    CambioDocumento,
    Contenedor,
    ContenedorConSemaforo,
    Resumen,
)
from semaforo import calcular_semaforo

# Lee backend/.env (si existe) y deja sus valores en os.environ.
# Así nadie escribe la API key en el código.
load_dotenv()

app = FastAPI(title="PORTIX API")


# --- Datos ----------------------------------------------------------------
# Los contenedores se cargan del JSON una sola vez, al arrancar, y se guardan
# en memoria. Los cambios (PATCH) NO se escriben de vuelta al archivo: al
# reiniciar el servidor, la demo vuelve a su estado inicial y siempre sale igual.

ARCHIVO_CONTENEDORES = Path(__file__).parent / "data" / "contenedores.json"


def cargar_contenedores() -> dict[str, Contenedor]:
    """Lee el JSON y regresa un diccionario {id: Contenedor}.

    Pydantic valida cada contenedor: si el JSON trae un valor que no está en
    el contrato, el servidor falla al arrancar y dice cuál es el problema.
    """
    with open(ARCHIVO_CONTENEDORES, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    return {c["id"]: Contenedor(**c) for c in datos}


contenedores = cargar_contenedores()

# Contador de No Show evitados. En F1 siempre es 0; lo incrementa
# POST /reprogramar en la F2.
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
    calculado = calcular_semaforo(contenedor, hora_actual())
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
