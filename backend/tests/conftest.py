"""Configuración común de las pruebas.

Fijamos la hora de la demo y quitamos la key de Gemini ANTES de importar main:
así las pruebas dan siempre lo mismo y nunca llaman a la IA real, aunque
alguien tenga un backend/.env con otra hora o con su key.
(load_dotenv no pisa variables que ya existen).
"""

import os

os.environ["PORTIX_HORA_ACTUAL"] = "06:15"
os.environ["GEMINI_API_KEY"] = ""
# Giro: sin Twilio en las pruebas; ningún SMS ni llamada sale de verdad.
for variable in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "TELEFONO_DEMO", "TWILIO_PLANTILLA_PRUEBA"):
    os.environ[variable] = ""
