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

// cambiados: { id: true } de los contenedores que cambiaron de color en la última
// carga. Esa fila parpadea 1 s con su color nuevo (la clase la quita App).
export default function ListaContenedores({ contenedores, seleccionadoId, onSeleccionar, cambiados = {} }) {
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
            const clases = ['tabla__fila']
            if (activo) clases.push('tabla__fila--activa')
            if (cambiados[c.id]) clases.push(`cambio cambio--${c.color}`)
            return (
              <tr
                key={c.id}
                className={clases.join(' ')}
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
