// DATOS FALSOS para trabajar mientras el backend no está listo.
// Imitan la forma exacta del contrato (PLAN-EQUIPO.md, sección 6).
// Cuando el backend funcione, se cambia USAR_DATOS_FALSOS a false en api.js
// y este archivo se puede borrar. Ningún componente lo importa directamente.
//
// Todo es sintético: contenedores, operadores y placas son inventados.

// Reloj de la demo (sección 7): la "hora actual" es fija para que la demo siempre salga igual.
const HORA_DEMO = '06:15'
const TRASLADO_MIN = 45 // F1: traslado fijo del patio al puerto

let contenedores = [
  {
    id: 'MSKU 718204-3',
    tipo_carga: 'general',
    terminal: 'ICAVE',
    cita: '09:00',
    operador: 'J. Pérez',
    placas: '31-KD-7P',
    salida_planeada: '07:30',
    documentos: [
      { tipo: 'pedimento', estado: 'ok', nota: 'Pagado' },
      { tipo: 'carta_porte', estado: 'ok', nota: '' },
      { tipo: 'folio_cita', estado: 'ok', nota: '' },
      { tipo: 'operador_placas', estado: 'ok', nota: '' },
      { tipo: 'requisito_carga', estado: 'na', nota: 'No aplica' },
    ],
  },
  {
    id: 'LTSU 402219-8',
    tipo_carga: 'general',
    terminal: 'ICAVE',
    cita: '11:00',
    operador: 'L. Ramírez',
    placas: '52-AM-9F',
    salida_planeada: '10:30',
    documentos: [
      { tipo: 'pedimento', estado: 'ok', nota: 'Confirmado por la agencia 05:30' },
      { tipo: 'carta_porte', estado: 'error', nota: 'Placas no coinciden' },
      { tipo: 'folio_cita', estado: 'ok', nota: '' },
      { tipo: 'operador_placas', estado: 'ok', nota: '' },
      { tipo: 'requisito_carga', estado: 'na', nota: 'No aplica' },
    ],
  },
  {
    id: 'TGHU 553901-6',
    tipo_carga: 'imo',
    terminal: 'CICE',
    cita: '08:00',
    operador: 'M. Cruz',
    placas: '18-TR-2X',
    salida_planeada: '08:30',
    documentos: [
      { tipo: 'pedimento', estado: 'ok', nota: '' },
      { tipo: 'carta_porte', estado: 'ok', nota: '' },
      { tipo: 'folio_cita', estado: 'ok', nota: '' },
      { tipo: 'operador_placas', estado: 'ok', nota: '' },
      { tipo: 'requisito_carga', estado: 'ok', nota: 'Hoja de seguridad IMO' },
    ],
  },
  {
    id: 'CAIU 260417-2',
    tipo_carga: 'isotanque',
    terminal: 'ICAVE',
    cita: '12:00',
    operador: 'A. Sosa',
    placas: '67-BN-4Q',
    salida_planeada: '10:00',
    documentos: [
      { tipo: 'pedimento', estado: 'falta', nota: 'Pago pendiente en la agencia' },
      { tipo: 'carta_porte', estado: 'ok', nota: '' },
      { tipo: 'folio_cita', estado: 'ok', nota: '' },
      { tipo: 'operador_placas', estado: 'ok', nota: '' },
      { tipo: 'requisito_carga', estado: 'ok', nota: 'Certificado de limpieza' },
    ],
  },
  {
    id: 'HLXU 830562-0',
    tipo_carga: 'sobredimensionada',
    terminal: 'CICE',
    cita: '13:00',
    operador: 'R. Luna',
    placas: '44-CV-8M',
    salida_planeada: '11:30',
    documentos: [
      { tipo: 'pedimento', estado: 'ok', nota: '' },
      { tipo: 'carta_porte', estado: 'ok', nota: '' },
      { tipo: 'folio_cita', estado: 'ok', nota: '' },
      { tipo: 'operador_placas', estado: 'ok', nota: '' },
      { tipo: 'requisito_carga', estado: 'ok', nota: 'Permiso de carga sobredimensionada' },
    ],
  },
  {
    id: 'SEGU 147730-5',
    tipo_carga: 'general',
    terminal: 'ICAVE',
    cita: '10:00',
    operador: 'E. Vega',
    placas: '29-HS-5T',
    salida_planeada: '10:30',
    documentos: [
      { tipo: 'pedimento', estado: 'ok', nota: '' },
      { tipo: 'carta_porte', estado: 'ok', nota: '' },
      { tipo: 'folio_cita', estado: 'falta', nota: '' },
      { tipo: 'operador_placas', estado: 'ok', nota: '' },
      { tipo: 'requisito_carga', estado: 'na', nota: 'No aplica' },
    ],
  },
]

// ---------- Semáforo simulado ----------
// Copia simple de las reglas de la sección 7, solo para que los datos falsos
// cambien de color. Con la API real, el color lo calcula el backend (semaforo.py).

const NOMBRES_DOC = {
  pedimento: 'pedimento',
  carta_porte: 'carta porte',
  folio_cita: 'folio de cita',
  operador_placas: 'operador y placas',
  requisito_carga: 'requisito de la carga',
}

function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function aHora(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0')
  const m = String(minutos % 60).padStart(2, '0')
  return `${h}:${m}`
}

function calcularSemaforo(c) {
  const cita = aMinutos(c.cita)
  const inicio = cita - 120 // la ventana abre 2 h antes de la cita
  const fin = cita + 60 // y cierra 1 h después
  const llegada = aMinutos(c.salida_planeada) + TRASLADO_MIN
  const ahora = aMinutos(HORA_DEMO)
  const pendientes = c.documentos.filter((d) => d.estado === 'falta' || d.estado === 'error')

  const base = {
    ventana_inicio: aHora(inicio),
    ventana_fin: aHora(fin),
    llegada_estimada: aHora(llegada),
  }

  if (llegada > fin) {
    return {
      ...base,
      color: 'rojo',
      motivo: `Llegaría a las ${aHora(llegada)}, después del cierre de la ventana (${aHora(fin)})`,
      accion_sugerida: `Mover o cancelar la cita antes de las ${aHora(fin)} para evitar el No Show`,
    }
  }

  if (pendientes.length > 0) {
    const nombres = pendientes.map((d) => NOMBRES_DOC[d.tipo]).join(', ')
    const motivo = pendientes
      .map((d) => (d.estado === 'error' ? `Error en ${NOMBRES_DOC[d.tipo]}` : `Falta ${NOMBRES_DOC[d.tipo]}`) + (d.nota ? `: ${d.nota}` : ''))
      .join(' · ')

    if (ahora + TRASLADO_MIN <= fin) {
      return {
        ...base,
        color: 'amarillo',
        motivo,
        accion_sugerida: `Resolver ${nombres} y salir antes de las ${aHora(fin - TRASLADO_MIN)}`,
      }
    }
    return {
      ...base,
      color: 'rojo',
      motivo: `${motivo}. Ya no hay tiempo de resolverlo`,
      accion_sugerida: `Mover o cancelar la cita antes de las ${aHora(fin)} para evitar el No Show`,
    }
  }

  if (llegada < inicio) {
    return {
      ...base,
      color: 'amarillo',
      motivo: `Llegaría a las ${aHora(llegada)}, antes de que abra la ventana (${aHora(inicio)})`,
      accion_sugerida: `Retrasar la salida a las ${aHora(inicio - TRASLADO_MIN)} o después`,
    }
  }

  return {
    ...base,
    color: 'verde',
    motivo: 'Documentos completos y llega dentro de la ventana',
    accion_sugerida: `Puede salir a las ${c.salida_planeada}`,
  }
}

// ---------- Endpoints simulados ----------
// Mismos nombres y respuestas que las funciones reales de api.js.

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const conColor = (c) => ({ ...structuredClone(c), ...calcularSemaforo(c) })

// GET /api/contenedores
export async function listarContenedores() {
  await esperar(200)
  return contenedores.map(conColor)
}

// PATCH /api/contenedores/{id}/documentos
export async function cambiarDocumento(id, cambio) {
  await esperar(300)
  const c = contenedores.find((x) => x.id === id)
  if (!c) throw new Error(`No existe el contenedor ${id}`)
  const doc = c.documentos.find((d) => d.tipo === cambio.tipo)
  if (!doc) throw new Error(`El contenedor no tiene el documento ${cambio.tipo}`)
  doc.estado = cambio.estado
  if (cambio.nota !== undefined) doc.nota = cambio.nota
  return conColor(c)
}

export const horaDemo = HORA_DEMO
