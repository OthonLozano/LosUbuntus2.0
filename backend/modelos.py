"""
PORTIX: modelos de datos (Pydantic).

Siguen la forma de docs/contrato-api.md. Pydantic valida los datos que entran
y salen: si alguien manda un estado que no existe (por ejemplo "listo"),
FastAPI responde 422 sin que tengamos que revisarlo a mano.
"""

from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field

# Los valores permitidos, tal cual vienen en el contrato.
TipoCarga = Literal["general", "imo", "isotanque", "sobredimensionada"]
Terminal = Literal["ICAVE", "CICE"]
TipoDocumento = Literal[
    "pedimento", "carta_porte", "folio_cita", "operador_placas", "requisito_carga"
]
EstadoDocumento = Literal["ok", "falta", "error", "na"]
Color = Literal["verde", "amarillo", "rojo"]

# Las horas van como texto "HH:MM" en 24 h. Esta expresión acepta de 00:00 a 23:59.
PATRON_HORA = r"^([01]\d|2[0-3]):[0-5]\d$"
Hora = Annotated[str, Field(pattern=PATRON_HORA, examples=["09:00"])]


class Documento(BaseModel):
    """Un renglón del checklist de documentos de un contenedor."""

    tipo: TipoDocumento
    estado: EstadoDocumento
    nota: str = ""


class Contenedor(BaseModel):
    """Un contenedor tal como se guarda en backend/data/contenedores.json."""

    id: str
    tipo_carga: TipoCarga
    terminal: Terminal
    cita: Hora
    operador: str
    placas: str
    salida_planeada: Hora
    documentos: list[Documento]


class ContenedorConSemaforo(Contenedor):
    """El contenedor más los campos que calcula el backend al responder.

    Hereda todos los campos de Contenedor y agrega el resultado del semáforo.
    """

    color: Color
    motivo: str
    ventana_inicio: str
    ventana_fin: str
    llegada_estimada: str
    accion_sugerida: str


class CambioDocumento(BaseModel):
    """Cuerpo de PATCH /api/contenedores/{id}/documentos."""

    tipo: TipoDocumento
    estado: EstadoDocumento
    # Si no se manda nota, se borra la anterior: una nota vieja como
    # "Placas no coinciden" confundiría cuando el documento ya está en ok.
    nota: Optional[str] = ""


class Resumen(BaseModel):
    """Respuesta de GET /api/resumen."""

    verde: int
    amarillo: int
    rojo: int
    # Se llenan en la F2, cuando exista POST /reprogramar. En F1 valen 0.
    no_show_evitados: int
    ahorro_mxn: int
