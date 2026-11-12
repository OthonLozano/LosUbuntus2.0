import Semaforo from '../Semaforo.jsx'
import { PRIORIDAD } from '../../textos.js'

// Cuántos documentos tiene en "falta" o "error".
export const pendientesDe = (c) =>
  c.documentos.filter((d) => d.estado === 'falta' || d.estado === 'error').length

// Lista angosta para las vistas Documentos y Chat. Arriba van los que tienen
// documentos pendientes y abajo los que están al día. No escondemos los "al día":
// si la IA resuelve un pendiente, el contenedor se mueve de grupo (y parpadea)
// en lugar de desaparecer, así se ve el antes y el después.
export default function ListaCompacta({ contenedores, seleccionadoId, onSeleccionar, cambiados }) {
  const ordenados = [...contenedores].sort(
    (a, b) => PRIORIDAD[a.color] - PRIORIDAD[b.color] || a.cita.localeCompare(b.cita),
  )
  const grupos = [
    { titulo: 'Con pendientes', lista: ordenados.filter((c) => pendientesDe(c) > 0) },
    { titulo: 'Al día', lista: ordenados.filter((c) => pendientesDe(c) === 0) },
  ]

  return (
    <nav className="compacta" aria-label="Contenedores">
      {grupos.map(
        (g) =>
          g.lista.length > 0 && (
            <div key={g.titulo}>
              <h3 className="compacta__titulo">
                {g.titulo} <span className="compacta__cuenta">{g.lista.length}</span>
              </h3>
              <ul className="compacta__lista">
                {g.lista.map((c) => {
                  const n = pendientesDe(c)
                  const clases = ['compacta__item']
                  if (c.id === seleccionadoId) clases.push('compacta__item--activo')
                  if (cambiados[c.id]) clases.push(`cambio cambio--${c.color}`)
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={clases.join(' ')}
                        aria-current={c.id === seleccionadoId ? 'true' : undefined}
                        onClick={() => onSeleccionar(c.id)}
                      >
                        <span className="compacta__fila">
                          <span className="compacta__id">{c.id}</span>
                          <Semaforo color={c.color} />
                        </span>
                        <span className="compacta__detalle">
                          Cita {c.cita} · {n > 0 ? `${n} pendiente${n > 1 ? 's' : ''}` : 'Documentos completos'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ),
      )}
    </nav>
  )
}
