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
NivelCongestion = Literal["baja", "media", "alta"]
# "movida" y "cancelada" las pone POST /reprogramar (F2).
EstadoCita = Literal["activa", "movida", "cancelada"]

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
    # Tiene valor por defecto para que el JSON de datos no tenga que traerlo.
    estado_cita: EstadoCita = "activa"


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
    # F2: cuánto tarda el traslado y con qué congestión (simulada) se calculó.
    traslado_min: int
    congestion: NivelCongestion


class CambioDocumento(BaseModel):
    """Cuerpo de PATCH /api/contenedores/{id}/documentos."""

    tipo: TipoDocumento
    estado: EstadoDocumento
    # Si no se manda nota, se borra la anterior: una nota vieja como
    # "Placas no coinciden" confundiría cuando el documento ya está en ok.
    nota: Optional[str] = ""


class SimularSalida(BaseModel):
    """Cuerpo de POST /api/contenedores/{id}/simular-salida."""

    salida_planeada: Hora


class Reprogramar(BaseModel):
    """Cuerpo de POST /api/contenedores/{id}/reprogramar.

    Con "mover" hay que mandar nueva_cita; con "cancelar" no se manda.
    """

    accion: Literal["mover", "cancelar"]
    nueva_cita: Optional[Hora] = None


class Congestion(BaseModel):
    """Respuesta de GET /api/congestion. Todo es simulado."""

    simulada: bool
    nota: str
    traslado_base_min: int
    multiplicadores: dict[NivelCongestion, float]
    por_hora: dict[str, NivelCongestion]


class Resumen(BaseModel):
    """Respuesta de GET /api/resumen."""

    verde: int
    amarillo: int
    rojo: int
    # Los suma POST /reprogramar cuando se mueve o cancela a tiempo una cita en rojo.
    no_show_evitados: int
    ahorro_mxn: int


# --- F4: chat simulado con la agencia aduanal -----------------------------
# Va al final del archivo para no chocar con los cambios de F3 al integrar.
# La forma de la interpretación de la IA la define ia.py (InterpretacionMensaje).


class MensajeAgencia(BaseModel):
    """Cuerpo de POST /api/contenedores/{id}/chat: lo que escribe la agencia.

    El límite de 500 caracteres evita que alguien pegue un documento entero.
    """

    texto: str = Field(min_length=1, max_length=500)


class Mensaje(BaseModel):
    """Un mensaje del chat. 'portix' son los avisos y respuestas del sistema."""

    de: Literal["portix", "agencia"]
    texto: str
    hora: str
