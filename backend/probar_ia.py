"""
Prueba rápida de ia.py con la key de backend/.env.

Uso (desde backend/):
    .\\.venv\\Scripts\\python.exe probar_ia.py                    -> prueba el mensaje
    .\\.venv\\Scripts\\python.exe probar_ia.py ruta\\documento.pdf -> además revisa un PDF

Si en la salida aparece "respaldo": true, Gemini no respondió y se usó la
respuesta de respaldo; "motivo_respaldo" dice por qué.
"""

import json
import sys

from dotenv import load_dotenv

load_dotenv()  # carga GEMINI_API_KEY y GEMINI_MODEL antes de importar ia

import ia  # noqa: E402

CONTENEDOR = {
    "id": "TCLU 930571-3",
    "placas": "52-AM-9F",
    "operador": "L. Ramírez",
    "terminal": "ICAVE",
    "documentos": [
        {"tipo": "pedimento", "estado": "falta", "nota": ""},
        {"tipo": "carta_porte", "estado": "ok", "nota": ""},
    ],
}


def mostrar(titulo, datos):
    print(f"\n=== {titulo} ===")
    print(json.dumps(datos, ensure_ascii=False, indent=2))


mostrar(
    "interpretar_mensaje",
    ia.interpretar_mensaje("ya quedó pagado, al rato te paso el comprobante", CONTENEDOR),
)

if len(sys.argv) > 1:
    ruta = sys.argv[1]
    mime = "application/pdf" if ruta.lower().endswith(".pdf") else "image/jpeg"
    with open(ruta, "rb") as f:
        mostrar("revisar_documento", ia.revisar_documento(f.read(), mime, CONTENEDOR, ruta))
