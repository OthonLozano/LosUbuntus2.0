import Semaforo from './Semaforo.jsx'
import { DOCUMENTOS, ESTADO_CITA, ESTADOS_DOC, TIPOS_CARGA } from '../textos.js'

// Texto corto de documentos: "4 de 4 listos" o lo que está pendiente.
function resumenDocumentos(documentos) {
  const aplican = documentos.filter((d) => d.estado !== 'na')
  const listos = aplican.filter((d) => d.estado === 'ok').length
  const pendientes = aplican.filter((d) => d.estado !== 'ok')
  return {
    conteo: `${listos} de ${aplican.length} listos`,
    pendientes: pendientes.map((d) => `${DOCUMENTOS[d.tipo]}: ${ESTADOS_DOC[d.estado].toLowerCase()}`),
  }
}

export default function ListaContenedores({ contenedores, seleccionadoId, onSeleccionar }) {
  return (
    <div className="tabla-envoltura">
      <table className="tabla">
        <thead>
          <tr>
            <th scope="col">Estado</th>
            <th scope="col">Contenedor</th>
            <th scope="col">Cita</th>
            <th scope="col">Documentos</th>
            <th scope="col">Acción sugerida</th>
          </tr>
        </thead>
        <tbody>
          {contenedores.map((c) => {
            const docs = resumenDocumentos(c.documentos)
            const activo = c.id === seleccionadoId
            return (
              <tr
                key={c.id}
                className={activo ? 'tabla__fila tabla__fila--activa' : 'tabla__fila'}
                onClick={() => onSeleccionar(c.id)}
              >
                <td>
                  <Semaforo color={c.color} />
                </td>
                <td>
                  {/* Botón para poder elegir la fila con teclado */}
                  <button
                    type="button"
                    className="tabla__id"
                    aria-pressed={activo}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSeleccionar(c.id)
                    }}
                  >
                    {c.id}
                  </button>
                  <div className="tabla__secundario">
                    {TIPOS_CARGA[c.tipo_carga]} · {c.terminal}
                  </div>
                </td>
                <td>
                  <strong>{c.cita}</strong>
                  <div className="tabla__secundario">
                    Sale {c.salida_planeada} · llega {c.llegada_estimada}
                  </div>
                  {c.estado_cita && c.estado_cita !== 'activa' && (
                    <div className="tabla__cita-estado">{ESTADO_CITA[c.estado_cita]}</div>
                  )}
                </td>
                <td>
                  <div>{docs.conteo}</div>
                  {docs.pendientes.map((p) => (
                    <div key={p} className="tabla__pendiente">
                      {p}
                    </div>
                  ))}
                </td>
                <td className="tabla__accion">{c.accion_sugerida}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
