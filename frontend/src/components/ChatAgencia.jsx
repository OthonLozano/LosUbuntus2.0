import { useEffect, useState } from 'react'
import { obtenerChat, enviarMensajeAgencia } from '../api.js'
import { CONFIANZA, DOCUMENTOS, ESTADOS_CHAT } from '../textos.js'

const MAXIMO_CARACTERES = 500 // el mismo límite que pone el backend

// F4: chat SIMULADO con la agencia aduanal. No hay WhatsApp: en la demo alguien
// del equipo escribe como si fuera la agencia. La IA (Gemini) interpreta el
// mensaje y el backend actualiza el checklist si entendió con claridad.
// Al terminar avisa a App con onActualizado() para que vuelva a pedir la lista.
export default function ChatAgencia({ contenedor, onActualizado }) {
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [interpretacion, setInterpretacion] = useState(null)
  const [error, setError] = useState('')

  // Al abrir el panel de un contenedor, pedimos su historial.
  // (PanelDetalle se crea de nuevo al cambiar de contenedor, por eso basta con el id.)
  useEffect(() => {
    obtenerChat(contenedor.id)
      .then((r) => setMensajes(r.mensajes))
      .catch((e) => setError(`No se pudo cargar el chat. ${e.message}`))
  }, [contenedor.id])

  async function enviar(e) {
    e.preventDefault()
    const limpio = texto.trim()
    if (!limpio) return
    setEnviando(true)
    setError('')
    // Mostramos el mensaje de la agencia de inmediato, mientras la IA lo interpreta.
    setMensajes((anteriores) => [...anteriores, { de: 'agencia', texto: limpio, hora: '' }])
    setTexto('')
    try {
      const r = await enviarMensajeAgencia(contenedor.id, limpio)
      setMensajes(r.mensajes) // el backend regresa el historial completo
      setInterpretacion({ ...r.interpretacion, documento_actualizado: r.documento_actualizado })
      await onActualizado()
    } catch (err) {
      setError(`No se pudo enviar el mensaje. ${err.message}`)
      // Volvemos a pedir el historial para no dejar en pantalla un mensaje que no se guardó.
      obtenerChat(contenedor.id).then((r) => setMensajes(r.mensajes)).catch(() => {})
      setTexto(limpio)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="bloque">
      <h3>
        Chat con la agencia aduanal <span className="etiqueta-simulada">Simulado</span>
      </h3>
      <p className="bloque__texto">
        En la demo, alguien del equipo escribe como si fuera la agencia. La IA interpreta el
        mensaje y actualiza el checklist.
      </p>

      <ul className="chat" aria-live="polite">
        {mensajes.map((m, i) => (
          <li key={i} className={`chat__mensaje chat__mensaje--${m.de}`}>
            <span className="chat__quien">
              {m.de === 'agencia' ? 'Agencia' : 'PORTIX'}
              {m.hora && ` · ${m.hora}`}
            </span>
            {m.texto}
          </li>
        ))}
      </ul>

      {/* Gemini tarda unos segundos: avisamos para que no parezca congelado. */}
      {enviando && <p className="subir__espera">Interpretando con IA...</p>}

      <form className="chat__forma" onSubmit={enviar}>
        <label htmlFor="mensaje-agencia">Mensaje de la agencia</label>
        <textarea
          id="mensaje-agencia"
          rows={2}
          maxLength={MAXIMO_CARACTERES}
          placeholder="Ejemplo: Ya quedó pagado el pedimento"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={enviando}
        />
        <button type="submit" className="boton" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </form>

      {error && <p className="detalle__error">{error}</p>}

      {interpretacion && <Interpretacion i={interpretacion} />}
    </div>
  )
}

// Lo que entendió la IA del último mensaje, dicho con palabras.
function Interpretacion({ i }) {
  return (
    <div className="revision" aria-live="polite">
      <div className="revision__encabezado">
        <strong>Lo que entendió la IA</strong>
        {i.respaldo && (
          <span className="etiqueta-simulada" title={i.motivo_respaldo || ''}>
            Respuesta de respaldo
          </span>
        )}
      </div>
      <p className="revision__resumen">{i.resumen}</p>
      <dl className="datos datos--compacto">
        <div>
          <dt>Documento</dt>
          <dd>{DOCUMENTOS[i.documento] || 'Ninguno'}</dd>
        </div>
        <div>
          <dt>Estado propuesto</dt>
          <dd>{ESTADOS_CHAT[i.nuevo_estado]}</dd>
        </div>
        <div>
          <dt>Confianza</dt>
          <dd>{CONFIANZA[i.confianza]}</dd>
        </div>
        <div>
          <dt>Pendiente</dt>
          <dd>{i.pendiente || 'Nada'}</dd>
        </div>
      </dl>
      <p className="revision__pie">
        {i.documento_actualizado
          ? `Se actualizó ${DOCUMENTOS[i.documento_actualizado]} en el checklist.`
          : 'No se cambió ningún documento.'}
      </p>
      {i.respaldo && (
        <p className="simulacion__aviso">
          La IA no estaba disponible: se interpretó buscando palabras clave.
        </p>
      )}
    </div>
  )
}
