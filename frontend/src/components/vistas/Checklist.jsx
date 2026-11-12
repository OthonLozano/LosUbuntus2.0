import { DOCUMENTOS, ESTADOS_DOC } from '../../textos.js'

// Checklist editable de documentos. Se usa en el Panel y en la vista Documentos.
// Al cambiar un estado llama a onCambiarDocumento (App hace el PATCH y recarga).
export default function Checklist({ contenedor, guardando, onCambiarDocumento }) {
  return (
    <ul className="checklist">
      {contenedor.documentos.map((d) => (
        <li key={d.tipo} className={`checklist__item checklist__item--${d.estado}`}>
          <div className="checklist__texto">
            <label htmlFor={`doc-${d.tipo}`}>{DOCUMENTOS[d.tipo]}</label>
            {d.nota && <span className="checklist__nota">{d.nota}</span>}
          </div>
          <select
            id={`doc-${d.tipo}`}
            value={d.estado}
            disabled={guardando}
            onChange={(e) => onCambiarDocumento(contenedor.id, d.tipo, e.target.value)}
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
  )
}
