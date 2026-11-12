"""
PORTIX: punto de entrada del backend (FastAPI).

Por ahora solo tiene un endpoint de prueba (F0). Los endpoints del contrato
(docs/contrato-api.md) se agregan aquí en cada fase.

Para correrlo (desde la carpeta backend/):
    uvicorn main:app --reload
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI

# Lee backend/.env (si existe) y deja sus valores en os.environ.
# Así nadie escribe la API key en el código.
load_dotenv()

app = FastAPI(title="PORTIX API")


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
