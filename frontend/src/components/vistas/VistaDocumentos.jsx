import Semaforo from '../Semaforo.jsx'
import SubirDocumento from '../SubirDocumento.jsx'
import Checklist from './Checklist.jsx'
import ListaCompacta from './ListaCompacta.jsx'

// Vista "Documentos": a la izquierda los contenedores (primero los que tienen
// pendientes); a la derecha el checklist del elegido y la revisión con IA.
export default function VistaDocumentos({
  contenedores,
  seleccionado,
  seleccionadoId,
  onSeleccionar,
  cambiados,
  guardando,
  errorGuardar,
  onCambiarDocumento,
  onDocumentoRevisado,
  version,
}) {
  return (
    <div className="vista-dividida">
      <ListaCompacta
        contenedores={contenedores}
        seleccionadoId={seleccionadoId}
        onSeleccionar={onSeleccionar}
        cambiados={cambiados}
      />

      <section className="vista-dividida__principal" aria-label="Documentos del contenedor">
        {!seleccionado ? (
          <p className="vista-vacia">Elige un contenedor de la izquierda para revisar sus documentos.</p>
        ) : (
          <div className="docs">
            <div className="docs__columna">
              <EncabezadoContenedor c={seleccionado} />
              <h3>Checklist de documentos</h3>
              <Checklist
                contenedor={seleccionado}
                guardando={guardando}
                onCambiarDocumento={onCambiarDocumento}
              />
              <p className="detalle__estado" aria-live="polite">
                {guardando && 'Guardando y recalculando el color...'}
                {errorGuardar && <span className="detalle__error">{errorGuardar}</span>}
              </p>
            </div>
            <div className="docs__columna">
              <SubirDocumento
                // version cambia al reiniciar la demo: así se borra el resultado anterior.
                key={`${seleccionado.id}|${version}`}
                contenedor={seleccionado}
                onRevisado={onDocumentoRevisado}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// El id, el color y el motivo del contenedor elegido (se usa en Documentos y Chat).
export function EncabezadoContenedor({ c }) {
  return (
    <div className="contenedor-elegido">
      <div className="detalle__encabezado">
        <h2>{c.id}</h2>
        <Semaforo color={c.color} />
      </div>
      <p className={`detalle__motivo detalle__motivo--${c.color}`}>{c.motivo}</p>
      <p className="contenedor-elegido__datos">
        Cita {c.cita} · {c.terminal} · Operador {c.operador} · Placas {c.placas}
      </p>
    </div>
  )
}
