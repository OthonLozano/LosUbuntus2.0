import { useState } from 'react'
import Semaforo from './Semaforo.jsx'
import BarraVentana from './BarraVentana.jsx'
import SimularSalida from './SimularSalida.jsx'
import Reprogramar from './Reprogramar.jsx'
import AvisoOperador from './AvisoOperador.jsx'
import Checklist from './vistas/Checklist.jsx'
import { pendientesDe } from './vistas/ListaCompacta.jsx'
import { CONGESTION, ESTADO_CITA, TIPOS_CARGA } from '../textos.js'

// App le pone una key con el id, la cita y la salida: al cambiar de contenedor
// (o al reprogramarlo), el panel se crea de nuevo y se borra la prueba de salida.
export default function PanelDetalle({
  contenedor,
  guardando,
  error,
  mensaje,
  onCambiarDocumento,
  onReprogramar,
  onIrA,
}) {
  const [simulado, setSimulado] = useState(null)

  if (!contenedor) {
    return (
      <aside className="detalle detalle--vacio">
        <p>Elige un contenedor de la lista para ver su detalle.</p>
      </aside>
    )
  }

  const c = contenedor
  // Si hay una prueba de hora de salida, la barra muestra la prueba.
  const paraBarra = simulado || c
  const puedeReprogramar = c.color === 'rojo' && c.estado_cita !== 'cancelada'

  return (
    <aside className="detalle" aria-label={`Detalle del contenedor ${c.id}`}>
      <div className="detalle__encabezado">
        <h2>{c.id}</h2>
        <Semaforo color={c.color} />
      </div>

      {c.estado_cita && c.estado_cita !== 'activa' && (
        <p className="detalle__cita-estado">{ESTADO_CITA[c.estado_cita]}</p>
      )}

      <p className={`detalle__motivo detalle__motivo--${c.color}`}>{c.motivo}</p>
      <p className="detalle__accion">
        <span className="etiqueta">Acción sugerida</span>
        {c.accion_sugerida}
      </p>

      {/* Subir documentos y el chat viven en sus propias pestañas. Estos botones
          cambian de pestaña sin perder el contenedor elegido. */}
      <div className="detalle__atajos">
        <button type="button" className="boton boton--secundario" onClick={() => onIrA('documentos')}>
          Revisar documento con IA →
        </button>
        <button
          type="button"
          // Si tiene pendientes, avisar a la agencia es lo más urgente: va resaltado.
          className={`boton ${pendientesDe(c) > 0 ? '' : 'boton--secundario'}`}
          onClick={() => onIrA('chat')}
        >
          Avisar a la agencia →
        </button>
      </div>

      {mensaje && (
        <p className="detalle__exito" role="status">
          {mensaje}
        </p>
      )}

      {/* Giro del reto: el operador no tiene smartphone; se le avisa por SMS o voz.
          Va justo después de la acción: primero se decide, luego se avisa al camión. */}
      <AvisoOperador contenedor={c} />

      {c.estado_cita !== 'cancelada' && (
        <div className="bloque">
          <h3>
            Llegada contra la ventana
            {simulado && <span className="etiqueta-prueba">Prueba: salida {simulado.salida_planeada}</span>}
          </h3>
          <BarraVentana
            ventanaInicio={paraBarra.ventana_inicio}
            ventanaFin={paraBarra.ventana_fin}
            llegada={paraBarra.llegada_estimada}
          />
        </div>
      )}

      {puedeReprogramar && (
        <Reprogramar contenedor={c} ocupado={guardando} onReprogramar={onReprogramar} />
      )}

      {c.estado_cita !== 'cancelada' && <SimularSalida contenedor={c} onResultado={setSimulado} />}

      <dl className="datos">
        <div><dt>Carga</dt><dd>{TIPOS_CARGA[c.tipo_carga]}</dd></div>
        <div><dt>Terminal</dt><dd>{c.terminal}</dd></div>
        <div><dt>Operador</dt><dd>{c.operador}</dd></div>
        <div><dt>Placas</dt><dd>{c.placas}</dd></div>
        <div><dt>Cita</dt><dd>{c.cita}</dd></div>
        <div><dt>Ventana</dt><dd>{c.ventana_inicio} a {c.ventana_fin}</dd></div>
        <div><dt>Salida planeada</dt><dd>{c.salida_planeada}</dd></div>
        <div><dt>Llegada estimada</dt><dd>{c.llegada_estimada}</dd></div>
        <div>
          <dt>Traslado</dt>
          <dd>{c.traslado_min} min</dd>
        </div>
        <div>
          <dt>Congestión (simulada)</dt>
          <dd>{CONGESTION[c.congestion]}</dd>
        </div>
      </dl>

      <h3>Checklist de documentos</h3>
      <Checklist contenedor={c} guardando={guardando} onCambiarDocumento={onCambiarDocumento} />

      <p className="detalle__estado" aria-live="polite">
        {guardando && 'Guardando y recalculando el color...'}
        {error && <span className="detalle__error">{error}</span>}
      </p>
    </aside>
  )
}
