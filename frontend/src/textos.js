// Etiquetas en español para los valores del contrato.

// Cada color lleva su texto: el color nunca es la única señal.
export const SEMAFORO = {
  verde: { texto: 'Sale', plural: 'Salen' },
  amarillo: { texto: 'Espera', plural: 'Esperan' },
  rojo: { texto: 'Reprogramar', plural: 'Reprogramar' },
}

// Orden para la lista: primero lo que necesita atención.
export const PRIORIDAD = { rojo: 0, amarillo: 1, verde: 2 }

export const DOCUMENTOS = {
  pedimento: 'Pedimento',
  carta_porte: 'Carta porte',
  folio_cita: 'Folio de cita',
  operador_placas: 'Operador y placas',
  requisito_carga: 'Requisito de la carga',
}

export const ESTADOS_DOC = {
  ok: 'Listo',
  falta: 'Falta',
  error: 'Con error',
  na: 'No aplica',
}

export const TIPOS_CARGA = {
  general: 'General',
  imo: 'IMO (peligrosa)',
  isotanque: 'Isotanque',
  sobredimensionada: 'Sobredimensionada',
}

// F2: niveles de congestión (simulada) y estado de la cita.
export const CONGESTION = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
}

export const ESTADO_CITA = {
  activa: 'Activa',
  movida: 'Cita movida',
  cancelada: 'Cita cancelada',
}

// Cargo por No Show en ICAVE (aviso ICA-2025-009).
export const CARGO_NO_SHOW = 999

export const formatoPesos = (n) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
