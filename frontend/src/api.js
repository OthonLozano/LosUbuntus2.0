// Único punto de contacto entre el frontend y el backend.
// Los componentes solo usan las funciones de este archivo.
//
// Para conectar la API real: cambiar USAR_DATOS_FALSOS a false.
// En desarrollo, Vite manda /api al backend en http://localhost:8000 (ver vite.config.js).

import * as falsos from './datosFalsos.js'

export const USAR_DATOS_FALSOS = false

// El id lleva espacios ("LTSU 402219-8"), por eso se codifica para la URL.
const urlContenedor = (id) => `/api/contenedores/${encodeURIComponent(id)}`

async function pedir(url, opciones) {
  const resp = await fetch(url, opciones)
  if (!resp.ok) {
    // FastAPI manda el motivo en {"detail": "..."}; si viene, lo mostramos tal cual.
    let detalle = ''
    try {
      const cuerpo = await resp.json()
      if (typeof cuerpo.detail === 'string') detalle = cuerpo.detail
    } catch {
      // la respuesta no era JSON; nos quedamos con el código
    }
    throw new Error(detalle || `El servidor respondió ${resp.status} en ${url}`)
  }
  return resp.json()
}

const enviarJson = (metodo, cuerpo) => ({
  method: metodo,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
})

// GET /api/contenedores → lista con color, motivo, ventana, llegada, traslado y acción sugerida
export async function listarContenedores() {
  if (USAR_DATOS_FALSOS) return falsos.listarContenedores()
  return pedir('/api/contenedores')
}

// PATCH /api/contenedores/{id}/documentos
// cuerpo: { "tipo": "carta_porte", "estado": "ok", "nota": "" }
export async function cambiarDocumento(id, cambio) {
  if (USAR_DATOS_FALSOS) return falsos.cambiarDocumento(id, cambio)
  return pedir(`${urlContenedor(id)}/documentos`, enviarJson('PATCH', cambio))
}

// GET /api/resumen → { verde, amarillo, rojo, no_show_evitados, ahorro_mxn }
export async function obtenerResumen() {
  if (USAR_DATOS_FALSOS) return falsos.obtenerResumen()
  return pedir('/api/resumen')
}

// GET /api/congestion → congestión SIMULADA por hora
export async function obtenerCongestion() {
  if (USAR_DATOS_FALSOS) return falsos.obtenerCongestion()
  return pedir('/api/congestion')
}

// POST /api/contenedores/{id}/simular-salida → el contenedor recalculado, SIN guardar
// cuerpo: { "salida_planeada": "09:15" }
export async function simularSalida(id, salida) {
  if (USAR_DATOS_FALSOS) return falsos.simularSalida(id, salida)
  return pedir(`${urlContenedor(id)}/simular-salida`, enviarJson('POST', { salida_planeada: salida }))
}

// POST /api/contenedores/{id}/reprogramar
// cuerpo: { "accion": "mover", "nueva_cita": "14:00" } o { "accion": "cancelar" }
export async function reprogramar(id, accion, nuevaCita) {
  const cuerpo = accion === 'mover' ? { accion, nueva_cita: nuevaCita } : { accion }
  if (USAR_DATOS_FALSOS) return falsos.reprogramar(id, cuerpo)
  return pedir(`${urlContenedor(id)}/reprogramar`, enviarJson('POST', cuerpo))
}

// F3 · POST /api/contenedores/{id}/revisar-documento
// Se manda como FormData (multipart/form-data), no como JSON, porque lleva un archivo.
// - archivo: el File del <input type="file"> (PDF, JPG o PNG)
// - documento (opcional): "carta_porte" o "pedimento"; si va vacío, la IA decide
// Regresa { tipo_detectado, legible, hallazgos, estado_sugerido, resumen,
//           respaldo, motivo_respaldo?, documento_actualizado, contenedor }
export async function revisarDocumento(id, archivo, documento) {
  if (USAR_DATOS_FALSOS) return falsos.revisarDocumento(id, archivo, documento)
  const datos = new FormData()
  datos.append('archivo', archivo)
  if (documento) datos.append('documento', documento)
  // Sin 'Content-Type' a mano: el navegador lo pone solo (con el "boundary" que separa los campos).
  return pedir(`${urlContenedor(id)}/revisar-documento`, { method: 'POST', body: datos })
}
