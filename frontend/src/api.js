// Único punto de contacto entre el frontend y el backend.
// Los componentes solo usan las funciones de este archivo.
//
// Para conectar la API real: cambiar USAR_DATOS_FALSOS a false.
// En desarrollo, Vite manda /api al backend en http://localhost:8000 (ver vite.config.js).

import * as falsos from './datosFalsos.js'

export const USAR_DATOS_FALSOS = true

// El id lleva espacios ("LTSU 402219-8"), por eso se codifica para la URL.
const urlContenedor = (id) => `/api/contenedores/${encodeURIComponent(id)}`

async function pedir(url, opciones) {
  const resp = await fetch(url, opciones)
  if (!resp.ok) {
    throw new Error(`El servidor respondió ${resp.status} en ${url}`)
  }
  return resp.json()
}

// GET /api/contenedores → lista con color, motivo, ventana, llegada y acción sugerida
export async function listarContenedores() {
  if (USAR_DATOS_FALSOS) return falsos.listarContenedores()
  return pedir('/api/contenedores')
}

// PATCH /api/contenedores/{id}/documentos
// cuerpo: { "tipo": "carta_porte", "estado": "ok", "nota": "" }
export async function cambiarDocumento(id, cambio) {
  if (USAR_DATOS_FALSOS) return falsos.cambiarDocumento(id, cambio)
  return pedir(`${urlContenedor(id)}/documentos`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambio),
  })
}
