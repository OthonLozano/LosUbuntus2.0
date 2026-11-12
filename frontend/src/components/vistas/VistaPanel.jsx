import { useEffect, useState } from 'react'
import Resumen from '../Resumen.jsx'
import GraficaCongestion from '../GraficaCongestion.jsx'
import ListaContenedores from '../ListaContenedores.jsx'
import PanelDetalle from '../PanelDetalle.jsx'
import AgregarContenedor from '../AgregarContenedor.jsx'

// Vista "Panel": el tablero del día. Resumen, congestión (simulada), la lista
// de contenedores y el detalle del elegido. Subir documentos y el chat viven en
// sus propias pestañas; el detalle tiene botones para ir a ellas.
export default function VistaPanel({
  contenedores,
  resumen,
  congestion,
  seleccionado,
  seleccionadoId,
  onSeleccionar,
  cambiados,
  guardando,
  errorGuardar,
  mensaje,
  onCambiarDocumento,
  onReprogramar,
  onIrA,
  onContenedorAgregado,
}) {
  const [agregando, setAgregando] = useState(false)

  return (
    <>
      <Resumen contenedores={contenedores} noShow={resumen} />
      <GraficaCongestion
        congestion={congestion}
        horaResaltada={seleccionado?.salida_planeada.slice(0, 2)}
      />

      <div className="barra-lista">
        <h2>Contenedores del día</h2>
        <button type="button" className="boton" onClick={() => setAgregando(true)}>
          + Agregar contenedor
        </button>
      </div>

      <main className="tablero">
        <ListaContenedores
          contenedores={contenedores}
          seleccionadoId={seleccionadoId}
          onSeleccionar={onSeleccionar}
          cambiados={cambiados}
        />
        <PanelDetalle
          // Si cambia la cita o la salida (por ejemplo al reprogramar), el panel se
          // reinicia para no mostrar una prueba vieja.
          key={`${seleccionadoId}|${seleccionado?.cita}|${seleccionado?.salida_planeada}|${seleccionado?.estado_cita}`}
          contenedor={seleccionado}
          guardando={guardando}
          error={errorGuardar}
          mensaje={mensaje}
          onCambiarDocumento={onCambiarDocumento}
          onReprogramar={onReprogramar}
          onIrA={onIrA}
        />
      </main>

      {agregando && (
        <Modal titulo="Agregar contenedor" onCerrar={() => setAgregando(false)}>
          {/* El formulario es de Othon; aquí solo lo mostramos. */}
          <AgregarContenedor
            onCreado={async (c) => {
              setAgregando(false)
              await onContenedorAgregado(c)
            }}
            onCancelar={() => setAgregando(false)}
          />
        </Modal>
      )}
    </>
  )
}

// Ventana encima de la página. Se cierra con la X, con Escape o al dar clic afuera.
function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  return (
    <div className="modal" onClick={onCerrar}>
      <div
        className="modal__caja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        // El clic dentro de la caja no debe cerrarla.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__encabezado">
          <h2 id="modal-titulo">{titulo}</h2>
          <button type="button" className="modal__cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
