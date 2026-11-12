import { useState } from 'react'
import { revisarDocumento } from '../api.js'
import { CAMPOS_REVISION, DOCUMENTOS, ESTADOS_DOC, TIPOS_DOCUMENTO } from '../textos.js'
import AntesDespues from './vistas/AntesDespues.jsx'

// Lo mismo que acepta el backend: PDF, JPG o PNG de máximo 10 MB.
const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png']
const MAXIMO_MB = 10

// F3: el despachador sube un PDF o una foto, la IA (Gemini) lo compara con los
// datos del viaje y el backend actualiza ese renglón del checklist.
// Al terminar avisa a App con onRevisado() para que vuelva a pedir la lista y el
// resumen: así el color nuevo sale del cálculo del backend.
export default function SubirDocumento({ contenedor, onRevisado }) {
  const [archivo, setArchivo] = useState(null)
  const [documento, setDocumento] = useState('') // '' = que la IA decida
  const [revisando, setRevisando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  function elegirArchivo(e) {
    const elegido = e.target.files[0] || null
    setResultado(null)
    setError('')
    // Revisamos aquí el tipo y el tamaño para no esperar la respuesta del backend.
    if (elegido && !TIPOS_PERMITIDOS.includes(elegido.type)) {
      setError('Ese tipo de archivo no se puede revisar. Usa PDF, JPG o PNG.')
      setArchivo(null)
      return
    }
    if (elegido && elegido.size > MAXIMO_MB * 1024 * 1024) {
      setError(`El archivo pasa de ${MAXIMO_MB} MB.`)
      setArchivo(null)
      return
    }
    setArchivo(elegido)
  }

  async function revisar(e) {
    e.preventDefault()
    if (!archivo) return
    setRevisando(true)
    setError('')
    setResultado(null)
    // Guardamos el color de antes para mostrar el "antes → después".
    const colorAntes = contenedor.color
    try {
      const r = await revisarDocumento(contenedor.id, archivo, documento)
      setResultado({ ...r, colorAntes })
      await onRevisado()
    } catch (err) {
      setError(`No se pudo revisar el documento. ${err.message}`)
    } finally {
      setRevisando(false)
    }
  }

  return (
    <div className="bloque">
      <h3>Revisar un documento con IA</h3>
      <p className="bloque__texto">
        Sube la carta porte o el comprobante del pedimento. La IA lo compara con los datos de
        este viaje y actualiza el checklist.
      </p>

      <form className="subir" onSubmit={revisar}>
        <label className="subir__campo">
          <span>Archivo (PDF, JPG o PNG)</span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={elegirArchivo}
            disabled={revisando}
          />
        </label>

        <label className="subir__campo">
          <span>¿Qué documento es?</span>
          <select value={documento} onChange={(e) => setDocumento(e.target.value)} disabled={revisando}>
            <option value="">Que lo detecte la IA</option>
            <option value="carta_porte">{DOCUMENTOS.carta_porte}</option>
            <option value="pedimento">{DOCUMENTOS.pedimento}</option>
          </select>
        </label>

        <button type="submit" className="boton" disabled={!archivo || revisando}>
          {revisando ? 'Revisando...' : 'Revisar documento'}
        </button>
      </form>

      {/* Gemini tarda de 4 a 8 segundos: avisamos para que no parezca congelado. */}
      {revisando && (
        <p className="subir__espera" aria-live="polite">
          Revisando con IA, tarda unos segundos...
        </p>
      )}

      {error && <p className="detalle__error">{error}</p>}

      {resultado && <ResultadoRevision r={resultado} />}
    </div>
  )
}

// Lo que encontró la IA. Cada fila dice con palabras si coincide o no:
// el color no es la única señal.
function ResultadoRevision({ r }) {
  const ok = r.estado_sugerido === 'ok'
  return (
    <div className={`revision revision--${ok ? 'ok' : 'error'}`} aria-live="polite">
      <div className="revision__encabezado">
        <span>
          Documento detectado: <strong>{TIPOS_DOCUMENTO[r.tipo_detectado] || r.tipo_detectado}</strong>
        </span>
        {r.respaldo && (
          <span className="etiqueta-simulada" title={r.motivo_respaldo || ''}>
            Respuesta de respaldo
          </span>
        )}
      </div>

      <p className="revision__resumen">{r.resumen}</p>
      <AntesDespues antes={r.colorAntes} despues={r.contenedor?.color} />

      {!r.legible && <p className="detalle__error">La IA no pudo leer bien el documento.</p>}

      {r.hallazgos.length > 0 && (
        <table className="revision__tabla">
          <thead>
            <tr>
              <th scope="col">Dato</th>
              <th scope="col">En el documento</th>
              <th scope="col">En el viaje</th>
              <th scope="col">¿Coincide?</th>
            </tr>
          </thead>
          <tbody>
            {r.hallazgos.map((h) => (
              <tr key={h.campo} className={h.coincide ? '' : 'revision__fila--mal'}>
                <td>{CAMPOS_REVISION[h.campo] || h.campo}</td>
                <td>{h.valor_en_documento || '—'}</td>
                <td>{h.valor_esperado || '—'}</td>
                <td>
                  <span className={`coincide coincide--${h.coincide ? 'si' : 'no'}`}>
                    {h.coincide ? '✓ Sí' : '✗ No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="revision__pie">
        {DOCUMENTOS[r.documento_actualizado]} quedó como{' '}
        <strong>{ESTADOS_DOC[r.estado_sugerido]}</strong> en el checklist.
      </p>
      {r.respaldo && (
        <p className="simulacion__aviso">
          La IA no estaba disponible: esta respuesta es de ejemplo y no viene de leer el archivo.
        </p>
      )}
    </div>
  )
}
