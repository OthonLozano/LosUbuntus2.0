"""Pruebas de las reglas del semáforo (semaforo.py).

Casi todas usan congestion=None (traslado fijo de 45 min) para que las cuentas
se puedan hacer a mano. La hora de la demo es 06:15.
"""

from modelos import Contenedor, Documento
from semaforo import calcular_semaforo

AHORA = "06:15"
TIPOS = ["pedimento", "carta_porte", "folio_cita", "operador_placas", "requisito_carga"]


def contenedor(cita, salida, pendientes=(), estado_cita="activa"):
    """Arma un contenedor de prueba. `pendientes`: tipos de documento en 'falta'."""
    documentos = [
        Documento(tipo=t, estado="falta" if t in pendientes else "ok") for t in TIPOS
    ]
    return Contenedor(
        id="TEST 000000-0",
        tipo_carga="general",
        terminal="ICAVE",
        cita=cita,
        operador="Prueba",
        placas="00-AA-0A",
        salida_planeada=salida,
        documentos=documentos,
        estado_cita=estado_cita,
    )


# --- Una prueba por cada regla, en el orden de semaforo.py ---------------

def test_verde_documentos_completos_y_llega_en_la_ventana():
    # Cita 09:00 -> ventana 07:00 a 10:00. Sale 08:00 + 45 = 08:45.
    r = calcular_semaforo(contenedor("09:00", "08:00"), AHORA)
    assert r["color"] == "verde"
    assert r["llegada_estimada"] == "08:45"
    assert (r["ventana_inicio"], r["ventana_fin"]) == ("07:00", "10:00")


def test_rojo_si_ni_saliendo_ahora_llega():
    # Cita 05:30 -> la ventana cierra 06:30. Saliendo 06:15 llega 07:00.
    r = calcular_semaforo(contenedor("05:30", "04:45"), AHORA)
    assert r["color"] == "rojo"
    assert "Aunque saliera ahora (06:15) llegaría a las 07:00" in r["motivo"]
    # La ventana sigue abierta: todavía se puede evitar el No Show.
    assert r["accion_sugerida"].startswith("Mover o cancelar la cita antes de las 06:30")


def test_rojo_con_la_ventana_ya_cerrada_no_promete_evitar_el_no_show():
    # Cita 05:00 -> la ventana cerró a las 06:00, antes de la hora actual.
    r = calcular_semaforo(contenedor("05:00", "04:00"), AHORA)
    assert r["color"] == "rojo"
    assert "ya cerró" in r["accion_sugerida"]


def test_rojo_tambien_menciona_documentos_pendientes():
    r = calcular_semaforo(contenedor("05:30", "04:45", pendientes=["pedimento"]), AHORA)
    assert r["color"] == "rojo"
    assert "pedimento" in r["motivo"]


def test_amarillo_por_documentos_pendientes():
    r = calcular_semaforo(contenedor("09:00", "08:00", pendientes=["carta_porte"]), AHORA)
    assert r["color"] == "amarillo"
    assert r["motivo"] == "Falta resolver: carta porte"
    # Última salida para llegar a las 10:00 con 45 min: 09:15.
    assert r["accion_sugerida"].endswith("salir a más tardar a las 09:15")


def test_amarillo_por_documentos_y_salida_tarde_menciona_ambos():
    # Sale 09:30 -> llega 10:15, después del cierre (10:00).
    r = calcular_semaforo(contenedor("09:00", "09:30", pendientes=["pedimento"]), AHORA)
    assert r["color"] == "amarillo"
    assert "pedimento" in r["motivo"]
    assert "después del cierre" in r["motivo"]


def test_amarillo_si_la_salida_planeada_llega_tarde_pero_todavia_alcanza():
    # Esta era la falla de antes: salía rojo aunque saliendo antes sí llega.
    r = calcular_semaforo(contenedor("09:00", "09:20"), AHORA)
    assert r["color"] == "amarillo"
    assert r["accion_sugerida"] == "Adelantar la salida a las 09:15 o antes"


def test_amarillo_si_llega_antes_de_que_abra_la_ventana():
    # Cita 12:00 -> ventana abre 10:00. Sale 07:00 -> llega 07:45.
    r = calcular_semaforo(contenedor("12:00", "07:00"), AHORA)
    assert r["color"] == "amarillo"
    assert r["accion_sugerida"] == "Salir a partir de las 09:15"


def test_cita_cancelada_es_amarillo_aunque_ya_no_llegue():
    r = calcular_semaforo(contenedor("05:30", "04:45", estado_cita="cancelada"), AHORA)
    assert r["color"] == "amarillo"
    assert "cancelada" in r["motivo"].lower()


# --- Bordes ---------------------------------------------------------------

def test_borde_llegar_justo_al_cierre_es_verde():
    # Sale 09:15 + 45 = 10:00, exactamente el cierre de la ventana.
    r = calcular_semaforo(contenedor("09:00", "09:15"), AHORA)
    assert r["color"] == "verde"


def test_borde_llegar_justo_a_la_apertura_es_verde():
    # Sale 06:15 + 45 = 07:00, exactamente la apertura de la ventana.
    r = calcular_semaforo(contenedor("09:00", "06:15"), AHORA)
    assert r["color"] == "verde"


def test_borde_salir_justo_en_la_ultima_salida_no_es_rojo():
    # Cita 06:00 -> cierre 07:00 -> última salida 06:15, que es la hora actual.
    assert calcular_semaforo(contenedor("06:00", "05:30"), "06:15")["color"] == "verde"
    # Un minuto después ya no llega.
    assert calcular_semaforo(contenedor("06:00", "05:30"), "06:16")["color"] == "rojo"


def test_salida_planeada_en_el_pasado_se_calcula_desde_ahora():
    # Debía salir 05:30 pero sigue en el patio: la llegada se cuenta desde 06:15.
    r = calcular_semaforo(contenedor("06:00", "05:30"), AHORA)
    assert r["llegada_estimada"] == "07:00"


def test_la_congestion_alarga_el_traslado():
    congestion = {
        "traslado_base_min": 45,
        "multiplicadores": {"baja": 1.0, "media": 1.3, "alta": 1.5},
        "por_hora": {"09": "alta"},
    }
    # 45 × 1.5 = 67.5 -> se redondea hacia arriba a 68.
    r = calcular_semaforo(contenedor("10:30", "09:30"), AHORA, congestion)
    assert r["traslado_min"] == 68
    assert r["congestion"] == "alta"
    assert r["llegada_estimada"] == "10:38"
