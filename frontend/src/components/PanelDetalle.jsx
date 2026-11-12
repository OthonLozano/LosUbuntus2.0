import Semaforo from './Semaforo.jsx'
import { DOCUMENTOS, ESTADOS_DOC, TIPOS_CARGA } from '../textos.js'

export default function PanelDetalle({ contenedor, guardando, error, onCambiarDocumento }) {
  if (!contenedor) {
    return (
      <aside className="detalle detalle--vacio">
        <p>Elige un contenedor de la lista para ver su detalle.</p>
      </aside>
    )
  }

  const c = contenedor

  return (
    <aside className="detalle" aria-label={`Detalle del contenedor ${c.id}`}>
      <div className="detalle__encabezado">
        <h2>{c.id}</h2>
        <Semaforo color={c.color} />
      </div>

      <p className={`detalle__motivo detalle__motivo--${c.color}`}>{c.motivo}</p>
      <p className="detalle__accion">
        <span className="etiqueta">Acción sugerida</span>
        {c.accion_sugerida}
      </p>

      <dl className="datos">
        <div><dt>Carga</dt><dd>{TIPOS_CARGA[c.tipo_carga]}</dd></div>
        <div><dt>Terminal</dt><dd>{c.terminal}</dd></div>
        <div><dt>Operador</dt><dd>{c.operador}</dd></div>
        <div><dt>Placas</dt><dd>{c.placas}</dd></div>
        <div><dt>Cita</dt><dd>{c.cita}</dd></div>
        <div><dt>Ventana</dt><dd>{c.ventana_inicio} a {c.ventana_fin}</dd></div>
        <div><dt>Salida planeada</dt><dd>{c.salida_planeada}</dd></div>
        <div><dt>Llegada estimada</dt><dd>{c.llegada_estimada}</dd></div>
      </dl>

      <h3>Checklist de documentos</h3>
      <ul className="checklist">
        {c.documentos.map((d) => (
          <li key={d.tipo} className={`checklist__item checklist__item--${d.estado}`}>
            <div className="checklist__texto">
              <label htmlFor={`doc-${d.tipo}`}>{DOCUMENTOS[d.tipo]}</label>
              {d.nota && <span className="checklist__nota">{d.nota}</span>}
            </div>
            <select
              id={`doc-${d.tipo}`}
              value={d.estado}
              disabled={guardando}
              onChange={(e) => onCambiarDocumento(c.id, d.tipo, e.target.value)}
            >
              {Object.entries(ESTADOS_DOC).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <p className="detalle__estado" aria-live="polite">
        {guardando && 'Guardando y recalculando el color...'}
        {error && <span className="detalle__error">{error}</span>}
      </p>
    </aside>
  )
}
