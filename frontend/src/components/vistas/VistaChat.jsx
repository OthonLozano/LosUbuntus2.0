import ChatAgencia from '../ChatAgencia.jsx'
import ListaCompacta from './ListaCompacta.jsx'
import { EncabezadoContenedor } from './VistaDocumentos.jsx'

// Vista "Chat": como una bandeja de mensajes. A la izquierda los contenedores
// (primero los que tienen pendientes); a la derecha el chat con la agencia del
// elegido, a todo lo alto. Arriba del chat va el color actual del contenedor,
// que cambia (y parpadea en la lista) cuando la IA actualiza un documento.
export default function VistaChat({
  contenedores,
  seleccionado,
  seleccionadoId,
  onSeleccionar,
  cambiados,
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

      <section className="vista-dividida__principal vista-chat" aria-label="Chat con la agencia">
        {!seleccionado ? (
          <p className="vista-vacia">Elige un contenedor de la izquierda para ver su chat con la agencia.</p>
        ) : (
          <>
            <EncabezadoContenedor c={seleccionado} />
            <ChatAgencia
              // version cambia al reiniciar la demo: así el chat vuelve a pedir su historial.
              key={`${seleccionado.id}|${version}`}
              contenedor={seleccionado}
              onActualizado={onDocumentoRevisado}
            />
          </>
        )}
      </section>
    </div>
  )
}
