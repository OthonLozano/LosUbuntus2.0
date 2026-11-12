// DATOS FALSOS para trabajar mientras el backend no está listo.
// Imitan la forma exacta del contrato (PLAN-EQUIPO.md, sección 6).
// Cuando el backend funcione, se cambia USAR_DATOS_FALSOS a false en api.js
// y este archivo se puede borrar. Ningún componente lo importa directamente.
//
// Todo es sintético: contenedores, operadores y placas son inventados.

// Reloj de la demo (sección 7): la "hora actual" es fija para que la demo siempre salga igual.
const HORA_DEMO = '06:15'

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

// ---------- Congestión simulada (sección 7 del plan) ----------
// Igual que backend/data/congestion.json. Es un supuesto del equipo, no un dato real.

const CONGESTION = {
  simulada: true,
  nota: 'Congestión SIMULADA por hora del día. El ITPAP de T21 solo publica un promedio mensual; esta tabla es un supuesto del equipo para la demo.',
  traslado_base_min: 45,
  multiplicadores: { baja: 1.0, media: 1.3, alta: 1.5 },
  por_hora: {
    '06': 'baja', '07': 'baja', '08': 'media', '09': 'alta', '10': 'alta', '11': 'alta',
    '12': 'media', '13': 'media', '14': 'baja', '15': 'baja', '16': 'baja', '17': 'media',
  },
}

let noShowEvitados = 0

// ---------- Semáforo simulado ----------
// Copia simple de las reglas de backend/semaforo.py, solo para que los datos falsos
// cambien de color. Con la API real, el color lo calcula el backend.

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
  const total = ((minutos % 1440) + 1440) % 1440
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
}

function nivelCongestion(salida) {
  const hora = String(Math.floor(salida / 60)).padStart(2, '0')
  return CONGESTION.por_hora[hora] || 'baja'
}

function trasladoMin(salida) {
  return Math.ceil(CONGESTION.traslado_base_min * CONGESTION.multiplicadores[nivelCongestion(salida)])
}

// La salida más tarde con la que el camión llega a más tardar a `limite`.
function ultimaSalidaPara(limite) {
  let salida = limite
  while (salida > 0 && salida + trasladoMin(salida) > limite) salida -= 1
  return salida
}

function calcularSemaforo(c) {
  const cita = aMinutos(c.cita)
  const inicio = cita - 120 // la ventana abre 2 h antes de la cita
  const fin = cita + 60 // y cierra 1 h después
  const salida = aMinutos(c.salida_planeada)
  const traslado = trasladoMin(salida)
  const llegada = salida + traslado
  const ahora = aMinutos(HORA_DEMO)
  const pendientes = c.documentos.filter((d) => d.estado === 'falta' || d.estado === 'error')
  const nombres = pendientes.map((d) => NOMBRES_DOC[d.tipo]).join(', ')

  const base = {
    ventana_inicio: aHora(inicio),
    ventana_fin: aHora(fin),
    llegada_estimada: aHora(llegada),
    traslado_min: traslado,
    congestion: nivelCongestion(salida),
    estado_cita: c.estado_cita || 'activa',
  }
  const reprogramarTexto = `Mover o cancelar la cita antes de las ${aHora(fin)} para evitar el No Show`

  if (c.estado_cita === 'cancelada') {
    return { ...base, color: 'amarillo', motivo: 'Cita cancelada a tiempo, sin cargo de No Show', accion_sugerida: 'Solicitar una nueva cita a la terminal' }
  }
  if (llegada > fin) {
    return { ...base, color: 'rojo', motivo: `Con salida a las ${c.salida_planeada} llega a las ${aHora(llegada)}, después del cierre de la ventana (${aHora(fin)})`, accion_sugerida: reprogramarTexto }
  }
  if (pendientes.length > 0 && ahora + trasladoMin(ahora) > fin) {
    return { ...base, color: 'rojo', motivo: `Falta resolver: ${nombres}, y ya no alcanza a llegar a la ventana`, accion_sugerida: reprogramarTexto }
  }
  if (pendientes.length > 0) {
    return { ...base, color: 'amarillo', motivo: `Falta resolver: ${nombres}`, accion_sugerida: `Resolver ${nombres} y salir a más tardar a las ${aHora(ultimaSalidaPara(fin))}` }
  }
  if (llegada < inicio) {
    return { ...base, color: 'amarillo', motivo: `Llegaría a las ${aHora(llegada)}, antes de que abra la ventana (${aHora(inicio)})`, accion_sugerida: `Salir más tarde para llegar después de las ${aHora(inicio)}` }
  }
  return { ...base, color: 'verde', motivo: 'Documentos completos y llega dentro de la ventana de su cita', accion_sugerida: `Salir a las ${c.salida_planeada}` }
}

// ---------- Endpoints simulados ----------
// Mismos nombres y respuestas que las funciones reales de api.js.

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const conColor = (c) => ({ ...structuredClone(c), ...calcularSemaforo(c) })

function buscar(id) {
  const c = contenedores.find((x) => x.id === id)
  if (!c) throw new Error(`No existe el contenedor '${id}'`)
  return c
}

// GET /api/contenedores
export async function listarContenedores() {
  await esperar(200)
  return contenedores.map(conColor)
}

// PATCH /api/contenedores/{id}/documentos
export async function cambiarDocumento(id, cambio) {
  await esperar(300)
  const c = buscar(id)
  const doc = c.documentos.find((d) => d.tipo === cambio.tipo)
  if (!doc) throw new Error(`El contenedor no tiene el documento ${cambio.tipo}`)
  doc.estado = cambio.estado
  doc.nota = cambio.nota || ''
  return conColor(c)
}

// GET /api/resumen
export async function obtenerResumen() {
  await esperar(100)
  const conteo = { verde: 0, amarillo: 0, rojo: 0 }
  contenedores.forEach((c) => (conteo[calcularSemaforo(c).color] += 1))
  return { ...conteo, no_show_evitados: noShowEvitados, ahorro_mxn: noShowEvitados * 999 }
}

// GET /api/congestion
export async function obtenerCongestion() {
  await esperar(100)
  return structuredClone(CONGESTION)
}

// POST /api/contenedores/{id}/simular-salida (no guarda)
export async function simularSalida(id, salida) {
  await esperar(200)
  return conColor({ ...buscar(id), salida_planeada: salida })
}

// POST /api/contenedores/{id}/reprogramar
export async function reprogramar(id, cuerpo) {
  await esperar(300)
  const c = buscar(id)
  const antes = calcularSemaforo(c)
  if (cuerpo.accion === 'cancelar') {
    if (c.estado_cita === 'cancelada') throw new Error('La cita ya estaba cancelada')
    c.estado_cita = 'cancelada'
  } else {
    const nuevaSalida = ultimaSalidaPara(aMinutos(cuerpo.nueva_cita))
    if (nuevaSalida < aMinutos(HORA_DEMO)) {
      throw new Error(`Son las ${HORA_DEMO}: ya no alcanza a llegar a una cita a las ${cuerpo.nueva_cita}. Elige una cita más tarde.`)
    }
    c.cita = cuerpo.nueva_cita
    c.salida_planeada = aHora(nuevaSalida)
    c.estado_cita = 'movida'
  }
  if (antes.color === 'rojo' && aMinutos(HORA_DEMO) <= aMinutos(antes.ventana_fin)) noShowEvitados += 1
  return conColor(c)
}

// POST /api/contenedores/{id}/revisar-documento
// NO lee el archivo: imita la respuesta de respaldo de backend/ia.py.
// Si el nombre del archivo contiene "error", simula que las placas no coinciden.
// Va marcada con respaldo: true para que la pantalla diga que no es una revisión real.
export async function revisarDocumento(id, archivo, documento) {
  await esperar(1500) // la revisión real tarda varios segundos
  const c = buscar(id)
  const conError = archivo.name.toLowerCase().includes('error')
  const placasDoc = conError ? c.placas.split('').reverse().join('') : c.placas
  const tipo = documento || 'carta_porte'
  const resumen = conError
    ? 'Respuesta de respaldo: las placas de la carta porte no coinciden con la unidad asignada.'
    : 'Respuesta de respaldo: los datos del documento coinciden con el viaje.'

  const renglon = c.documentos.find((d) => d.tipo === tipo)
  if (!renglon) throw new Error(`El contenedor '${id}' no tiene el documento '${tipo}'`)
  renglon.estado = conError ? 'error' : 'ok'
  renglon.nota = `${resumen} (respuesta de respaldo)`

  return {
    tipo_detectado: 'carta_porte',
    legible: true,
    hallazgos: [
      { campo: 'contenedor', valor_en_documento: c.id, valor_esperado: c.id, coincide: true },
      { campo: 'placas', valor_en_documento: placasDoc, valor_esperado: c.placas, coincide: !conError },
    ],
    estado_sugerido: conError ? 'error' : 'ok',
    resumen,
    respaldo: true,
    motivo_respaldo: 'Datos de prueba: el backend no está conectado',
    documento_actualizado: tipo,
    contenedor: conColor(c),
  }
}
