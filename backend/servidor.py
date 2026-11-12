"""
PORTIX: servidor para el despliegue (un solo servicio, un solo enlace).

En desarrollo usamos dos servidores:
    backend/:  uvicorn main:app --reload      (API en el puerto 8000)
    frontend/: npm run dev                    (Vite en el 5173, con proxy a /api)

En el despliegue, este archivo toma la API de main.py y además sirve el
frontend ya compilado (frontend/dist). Así todo vive en el mismo dominio y el
frontend sigue llamando a "/api/..." igual que en desarrollo.

Para probarlo en local (desde backend/), después de `npm run build` en frontend/:
    uvicorn servidor:app
"""

from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Al importar main se registran TODAS las rutas /api (incluidas las que se
# agreguen después en main.py). Las rutas del frontend van al final, así que
# nunca tapan a la API.
from main import app

CARPETA_FRONTEND = (Path(__file__).resolve().parent.parent / "frontend" / "dist").resolve()

if not (CARPETA_FRONTEND / "index.html").exists():
    raise RuntimeError(
        "No existe frontend/dist/index.html. Corre `npm run build` en frontend/ primero."
    )

# Los archivos JS y CSS que genera Vite viven en dist/assets.
app.mount("/assets", StaticFiles(directory=CARPETA_FRONTEND / "assets"), name="assets")


@app.get("/{ruta:path}", include_in_schema=False)
def frontend(ruta: str):
    """Cualquier ruta que no sea de la API regresa el frontend.

    Si la ruta es un archivo que existe en dist (por ejemplo el ícono), se
    manda ese archivo; si no, se manda index.html y React se encarga.
    """
    if ruta.startswith("api/"):
        # Una ruta de API que no existe: 404 de verdad, no la página.
        raise HTTPException(status_code=404, detail=f"No existe la ruta /{ruta}")

    archivo = (CARPETA_FRONTEND / ruta).resolve()
    # La segunda condición evita que alguien pida archivos fuera de dist (../).
    if ruta and archivo.is_file() and CARPETA_FRONTEND in archivo.parents:
        return FileResponse(archivo)
    return FileResponse(CARPETA_FRONTEND / "index.html")
