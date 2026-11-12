import { useEffect, useRef, useState } from 'react'
import { obtenerChat, enviarMensajeAgencia } from '../api.js'
import { CONFIANZA, DOCUMENTOS, ESTADOS_CHAT } from '../textos.js'
import AntesDespues from './vistas/AntesDespues.jsx'

const MAXIMO_CARACTERES = 500 // el mismo límite que pone el backend

// F4: chat SIMULADO con la agencia aduanal. No hay WhatsApp: en la demo alguien
// del equipo escribe como si fuera la agencia. La IA (Gemini) interpreta el
// mensaje y el backend actualiza el checklist si entendió con claridad.
// Al terminar avisa a App con onActualizado() para que vuelva a pedir la lista.
//
// Está hecho como bandeja de mensajes: los mensajes ocupan el alto disponible y
// el cuadro para escribir queda abajo (las reglas de alto están en index.css).
export default function ChatAgencia({ contenedor, onActualizado }) {
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [interpretacion, setInterpretacion] = useState(null)
  const [error, setError] = useState('')
  const listaRef = useRef(null)

  // Al elegir un contenedor (o al reiniciar la demo, que cambia la key), pedimos su historial.
  useEffect(() => {
    obtenerChat(contenedor.id)
      .then((r) => setMensajes(r.mensajes))
      .catch((e) => setError(`No se pudo cargar el chat. ${e.message}`))
  }, [contenedor.id])

  // Cada vez que llega un mensaje, bajamos al último (como en cualquier app de chat).
  useEffect(() => {
    const lista = listaRef.current
    if (lista) lista.scrollTop = lista.scrollHeight
  }, [mensajes, enviando])

  async function enviar(e) {
    e?.preventDefault()
    const limpio = texto.trim()
    if (!limpio || enviando) return
    const colorAntes = contenedor.color // para mostrar el "antes → después"
    setEnviando(true)
    setError('')
    // Mostramos el mensaje de la agencia de inmediato, mientras la IA lo interpreta.
    setMensajes((anteriores) => [...anteriores, { de: 'agencia', texto: limpio, hora: '' }])
    setTexto('')
    try {
      const r = await enviarMensajeAgencia(contenedor.id, limpio)
      setMensajes(r.mensajes) // el backend regresa el historial completo
      setInterpretacion({
        ...r.interpretacion,
        documento_actualizado: r.documento_actualizado,
        colorAntes,
        colorDespues: r.contenedor?.color,
      })
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

  // Enter envía; Shift + Enter hace un salto de línea.
  function alTeclear(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <div className="chat-agencia">
      <div className="chat-agencia__encabezado">
        <h3>
          Chat con la agencia aduanal <span className="etiqueta-simulada">Simulado</span>
        </h3>
        <p className="bloque__texto">
          En la demo, alguien del equipo escribe como si fuera la agencia. La IA interpreta el
          mensaje y actualiza el checklist.
        </p>
      </div>

      <ul className="chat" ref={listaRef} aria-live="polite" aria-label="Mensajes">
        {mensajes.map((m, i) => (
          <li key={i} className={`chat__mensaje chat__mensaje--${m.de}`}>
            <span className="chat__quien">
              {m.de === 'agencia' ? 'Agencia' : 'PORTIX'}
              {m.hora && ` · ${m.hora}`}
            </span>
            {m.texto}
          </li>
        ))}
        {/* Gemini tarda unos segundos: avisamos para que no parezca congelado. */}
        {enviando && <li className="chat__escribiendo">Interpretando con IA...</li>}
      </ul>

      {interpretacion && <Interpretacion i={interpretacion} />}
      {error && <p className="detalle__error">{error}</p>}

      <form className="chat__forma" onSubmit={enviar}>
        <label htmlFor="mensaje-agencia">Mensaje de la agencia</label>
        <div className="chat__escribir">
          <textarea
            id="mensaje-agencia"
            rows={2}
            maxLength={MAXIMO_CARACTERES}
            placeholder="Ejemplo: Ya quedó pagado el pedimento"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alTeclear}
            disabled={enviando}
          />
          <button type="submit" className="boton" disabled={enviando || !texto.trim()}>
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Lo que entendió la IA del último mensaje, dicho con palabras.
function Interpretacion({ i }) {
  return (
    <div className="revision revision--chat" aria-live="polite">
      <div className="revision__encabezado">
        <strong>Lo que entendió la IA</strong>
        {i.respaldo && (
          <span className="etiqueta-simulada" title={i.motivo_respaldo || ''}>
            Respuesta de respaldo
          </span>
        )}
      </div>
      <p className="revision__resumen">{i.resumen}</p>
      <dl className="datos datos--compacto datos--cuatro">
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
      <AntesDespues antes={i.colorAntes} despues={i.colorDespues} />
      {i.respaldo && (
        <p className="simulacion__aviso">
          La IA no estaba disponible: se interpretó buscando palabras clave.
        </p>
      )}
    </div>
  )
}
