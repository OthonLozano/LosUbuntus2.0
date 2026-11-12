"""Pruebas del giro: avisos al operador por SMS o voz (avisos.py y endpoints).

Nunca sale un SMS de verdad: conftest.py deja vacías las variables de Twilio,
y la prueba del envío "real" reemplaza la llamada a la red por una falsa.
"""

import json

import pytest
from fastapi.testclient import TestClient

import avisos
import main

cliente = TestClient(main.app)

# Alfabeto GSM-7 básico (GSM 03.38): lo que cabe en un SMS de 160 caracteres.
GSM7 = set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?"
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
)


@pytest.fixture(autouse=True)
def demo_limpia():
    cliente.post("/api/reiniciar")


def todos_con_semaforo():
    return cliente.get("/api/contenedores").json()


# --- Texto del SMS ---------------------------------------------------------

def test_sin_acentos_conserva_la_enie():
    assert avisos.sin_acentos("Llegarás a Peñón, cita cancelada") == "Llegaras a Peñon, cita cancelada"


def test_todos_los_sms_caben_en_160_y_usan_solo_gsm7():
    for c in todos_con_semaforo():
        sms = avisos.mensaje_sms(c)
        assert len(sms) <= 160, (c["id"], len(sms))
        assert set(sms) <= GSM7, (c["id"], set(sms) - GSM7)


def test_el_sms_dice_que_hacer_segun_el_color():
    por_color = {c["color"]: avisos.mensaje_sms(c) for c in todos_con_semaforo()}
    assert "VERDE, SAL" in por_color["verde"]
    assert "NO SALGAS" in por_color["amarillo"] or "ESPERA" in por_color["amarillo"]
    assert "ROJO, NO SALGAS" in por_color["rojo"]


def test_sms_con_muchos_pendientes_se_recorta_a_160():
    c = todos_con_semaforo()[0]
    c = {**c, "color": "amarillo", "documentos": [
        {"tipo": t, "estado": "falta"} for t in avisos.NOMBRES_DOCUMENTO
    ] * 3}
    assert len(avisos.mensaje_sms(c)) <= 160


def test_la_voz_deletrea_el_contenedor():
    assert avisos.deletrear("MSKU 715384-0") == "M, S, K, U, 7, 1, 5, 3, 8, 4, guion, 0"


# --- Envío -----------------------------------------------------------------

def test_sin_twilio_el_aviso_es_simulado():
    r = avisos.enviar("sms", todos_con_semaforo()[0])
    assert r["real"] is False
    assert r["detalle"].startswith("Simulado")


def configurar_twilio(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_prueba")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "token_prueba")
    monkeypatch.setenv("TWILIO_FROM", "+15550000000")
    monkeypatch.setenv("TELEFONO_DEMO", "+522290000000")


def test_con_twilio_manda_el_sms_al_telefono_de_la_demo(monkeypatch):
    configurar_twilio(monkeypatch)
    enviado = {}

    def api_falsa(config, recurso, campos):
        enviado.update(recurso=recurso, **campos)
        return {"sid": "SM123"}

    monkeypatch.setattr(avisos, "_llamar_api", api_falsa)
    c = todos_con_semaforo()[0]
    r = avisos.enviar("sms", c)
    assert r["real"] is True
    assert enviado["recurso"] == "Messages"
    # Siempre al teléfono de la demo, nunca al número ficticio del JSON.
    assert enviado["To"] == "+522290000000"
    assert enviado["Body"] == avisos.mensaje_sms(c)
    assert r["destino"] == "teléfono de la demo (***0000)"


def test_con_twilio_la_llamada_lleva_voz_en_espanol(monkeypatch):
    configurar_twilio(monkeypatch)
    enviado = {}
    monkeypatch.setattr(
        avisos, "_llamar_api", lambda config, recurso, campos: enviado.update(recurso=recurso, **campos) or {}
    )
    avisos.enviar("voz", todos_con_semaforo()[0])
    assert enviado["recurso"] == "Calls"
    assert '<Say language="es-MX"' in enviado["Twiml"]
    assert "Repito" in enviado["Twiml"]


def test_si_twilio_falla_queda_simulado(monkeypatch):
    configurar_twilio(monkeypatch)

    def api_que_falla(config, recurso, campos):
        raise RuntimeError("Twilio respondió 400: número no verificado")

    monkeypatch.setattr(avisos, "_llamar_api", api_que_falla)
    r = avisos.enviar("sms", todos_con_semaforo()[0])
    assert r["real"] is False
    assert "no verificado" in r["detalle"]
    # Con Twilio configurado, nunca se muestra el número ficticio del operador.
    assert r["destino"] == "teléfono de la demo (***0000), no enviado"


def test_cuenta_de_prueba_manda_el_sms_real_con_la_plantilla(monkeypatch):
    configurar_twilio(monkeypatch)
    monkeypatch.setenv("TWILIO_PLANTILLA_PRUEBA", "sms_appointment_reminders")
    enviado = {}
    monkeypatch.setattr(
        avisos, "_llamar_api",
        lambda config, recurso, campos: enviado.update(campos) or {"sid": "SM9"},
    )
    c = todos_con_semaforo()[0]
    r = avisos.enviar("sms", c)
    # El SMS sale de verdad, pero con la plantilla de Twilio como Body...
    assert enviado["Body"] == "sms_appointment_reminders"
    assert r["real"] is True and r["plantilla"] is True
    # ...y el texto de PORTIX se conserva para mostrarlo en pantalla, declarado.
    assert r["texto"] == avisos.mensaje_sms(c)
    assert "plantilla de prueba" in r["detalle"]
    assert avisos.modo() == "plantilla"


def test_cuenta_de_prueba_no_intenta_la_llamada(monkeypatch):
    configurar_twilio(monkeypatch)
    monkeypatch.setenv("TWILIO_PLANTILLA_PRUEBA", "sms_appointment_reminders")

    def no_debe_llamarse(*args):
        raise AssertionError("No debe llamar a Twilio para voz en la cuenta de prueba")

    monkeypatch.setattr(avisos, "_llamar_api", no_debe_llamarse)
    r = avisos.enviar("voz", todos_con_semaforo()[0])
    assert r["real"] is False
    assert "Escuchar aquí" in r["detalle"]


def test_modo_segun_la_configuracion(monkeypatch):
    assert avisos.modo() == "simulado"
    configurar_twilio(monkeypatch)
    assert avisos.modo() == "real"


# --- Endpoints -------------------------------------------------------------

def test_avisar_operador_guarda_el_aviso_en_el_historial():
    id_ = "LTSU%20402219-9"
    r = cliente.post(f"/api/contenedores/{id_}/avisar-operador", json={"canal": "voz"})
    assert r.status_code == 200
    assert r.json()["canal"] == "voz"
    historial = cliente.get(f"/api/contenedores/{id_}/avisos").json()
    assert len(historial["avisos"]) == 1
    assert historial["vista_previa"]["sms"].startswith("PORTIX LTSU 402219-9")


def test_canal_invalido_responde_422():
    r = cliente.post("/api/contenedores/LTSU%20402219-9/avisar-operador", json={"canal": "whatsapp"})
    assert r.status_code == 422


def test_cancelar_una_cita_avisa_solo_al_operador():
    id_ = "TGHU%20174826-8"
    cliente.post(f"/api/contenedores/{id_}/reprogramar", json={"accion": "cancelar"})
    historial = cliente.get(f"/api/contenedores/{id_}/avisos").json()["avisos"]
    assert len(historial) == 1
    assert historial[0]["motivo"] == "reprogramar"
    assert "Cita cancelada sin cargo" in historial[0]["texto"]


def test_reiniciar_borra_los_avisos():
    id_ = "LTSU%20402219-9"
    cliente.post(f"/api/contenedores/{id_}/avisar-operador", json={"canal": "sms"})
    cliente.post("/api/reiniciar")
    assert cliente.get(f"/api/contenedores/{id_}/avisos").json()["avisos"] == []


def test_salud_dice_si_el_sms_es_real():
    salud = cliente.get("/api/salud").json()
    assert salud["sms_real"] is False
    assert salud["sms_modo"] == "simulado"
