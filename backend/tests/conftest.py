"""Configuración común de las pruebas.

Fijamos la hora de la demo y quitamos la key de Gemini ANTES de importar main:
así las pruebas dan siempre lo mismo y nunca llaman a la IA real, aunque
alguien tenga un backend/.env con otra hora o con su key.
(load_dotenv no pisa variables que ya existen).
"""

import os

os.environ["PORTIX_HORA_ACTUAL"] = "06:15"
os.environ["GEMINI_API_KEY"] = ""
