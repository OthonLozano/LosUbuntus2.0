"""Pruebas de la API (main.py) con el TestClient de FastAPI.

No llaman a Gemini: conftest.py deja GEMINI_API_KEY vacía. Cada prueba
empieza con POST /api/reiniciar para no depender de lo que hizo la anterior.
"""

import pytest
from fastapi.testclient import TestClient

import main

cliente = TestClient(main.app)

NUEVO = {
    "id": "PRBU 123456-7",
    "tipo_carga": "imo",
    "terminal": "CICE",
    "cita": "11:00",
    "operador": "R. Gómez",
    "placas": "52-AM-9F",
    "salida_planeada": "10:00",
}


@pytest.fixture(autouse=True)
def demo_limpia():
    assert cliente.post("/api/reiniciar").status_code == 200


def ids():
    return {c["id"] for c in cliente.get("/api/contenedores").json()}


def test_salud_trae_la_hora_de_la_demo():
    datos = cliente.get("/api/salud").json()
    assert datos["hora_actual"] == "06:15"
    assert datos["ia_configurada"] is False


def test_crear_contenedor_responde_201_con_documentos_pendientes():
    r = cliente.post("/api/contenedores", json=NUEVO)
    assert r.status_code == 201
    datos = r.json()
    assert datos["id"] == "PRBU 123456-7"
    assert {d["estado"] for d in datos["documentos"]} == {"falta"}
    # Le falta todo, pero hay tiempo: espera.
    assert datos["color"] == "amarillo"
    assert "PRBU 123456-7" in ids()


def test_carga_general_no_pide_requisito_de_carga():
    r = cliente.post("/api/contenedores", json={**NUEVO, "tipo_carga": "general"})
    requisito = next(d for d in r.json()["documentos"] if d["tipo"] == "requisito_carga")
    assert requisito["estado"] == "na"


def test_id_en_minusculas_se_normaliza():
    r = cliente.post("/api/contenedores", json={**NUEVO, "id": " prbu 123456-7 "})
    assert r.status_code == 201
    assert r.json()["id"] == "PRBU 123456-7"


def test_id_duplicado_responde_409():
    cliente.post("/api/contenedores", json=NUEVO)
    r = cliente.post("/api/contenedores", json=NUEVO)
    assert r.status_code == 409
    assert "Ya existe" in r.json()["detail"]


@pytest.mark.parametrize("campo, valor", [
    ("id", "PRBU123456"),     # sin el formato ABCD 123456-7
    ("cita", "25:00"),        # hora imposible
    ("terminal", "TIMSA"),    # terminal que no está en el contrato
    ("placas", "1"),          # demasiado corta
])
def test_datos_invalidos_responden_422(campo, valor):
    r = cliente.post("/api/contenedores", json={**NUEVO, campo: valor})
    assert r.status_code == 422


def test_reiniciar_borra_los_contenedores_agregados():
    cliente.post("/api/contenedores", json=NUEVO)
    assert "PRBU 123456-7" in ids()
    cliente.post("/api/reiniciar")
    assert "PRBU 123456-7" not in ids()


def test_resumen_trae_los_kpis_de_la_f5():
    inicial = cliente.get("/api/resumen").json()
    # Con los datos de la demo: 4 contenedores con documentos pendientes.
    assert inicial["detenidos_por_documentos"] == 4
    assert inicial["horas_espera_evitadas"] == round(4 * 3.825, 1)

    cliente.post("/api/contenedores", json=NUEVO)
    despues = cliente.get("/api/resumen").json()
    assert despues["detenidos_por_documentos"] == 5
    assert despues["horas_espera_evitadas"] == round(5 * 3.825, 1)


def test_cancelar_una_cita_en_rojo_suma_un_no_show_evitado():
    rojo = next(c for c in cliente.get("/api/contenedores").json() if c["color"] == "rojo")
    r = cliente.post(f"/api/contenedores/{rojo['id']}/reprogramar", json={"accion": "cancelar"})
    assert r.status_code == 200
    resumen = cliente.get("/api/resumen").json()
    assert resumen["no_show_evitados"] == 1
    assert resumen["ahorro_mxn"] == 999


def test_cancelar_una_cita_que_no_esta_en_rojo_no_suma():
    verde = next(c for c in cliente.get("/api/contenedores").json() if c["color"] == "verde")
    cliente.post(f"/api/contenedores/{verde['id']}/reprogramar", json={"accion": "cancelar"})
    assert cliente.get("/api/resumen").json()["no_show_evitados"] == 0


def test_extraer_viaje_sin_ia_regresa_respaldo_vacio():
    # Sin GEMINI_API_KEY: respaldo honesto, sin datos inventados.
    r = cliente.post(
        "/api/extraer-viaje",
        files={"archivo": ("carta.pdf", b"%PDF-1.4 prueba", "application/pdf")},
    )
    assert r.status_code == 200
    datos = r.json()
    assert datos["respaldo"] is True
    assert datos["id"] == "" and datos["placas"] == ""


def test_extraer_viaje_rechaza_otros_tipos_de_archivo():
    r = cliente.post(
        "/api/extraer-viaje",
        files={"archivo": ("notas.txt", b"hola", "text/plain")},
    )
    assert r.status_code == 415
