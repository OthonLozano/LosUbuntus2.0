import { useEffect, useState } from 'react'
import { avisarOperador, obtenerAvisos } from '../api.js'
import './avisos.css'

// Giro del reto: "el transportista no tiene smartphone; hay que avisarle por SMS
// o por mensaje de voz". Este bloque muestra, en un celular básico dibujado,
// el SMS que recibiría el operador, y permite:
// - Enviar el SMS o hacer la llamada (reales con Twilio, o simulados).
// - Escuchar aquí el mensaje de voz, con la voz del navegador (Web Speech API).
// Los avisos reales siempre van al teléfono de la demo, nunca al ficticio.

const ICONO = { sms: '💬', voz: '📞' }
const MAXIMO_SMS = 160

// Cómo salen los avisos, según GET /avisos (sms_modo):
// - real: cuenta completa de Twilio, sale el texto de PORTIX.
// - plantilla: cuenta de PRUEBA de Twilio. El SMS sale de verdad (suena el
//   celular) pero con la plantilla de Twilio; el texto de PORTIX se ve aquí.
// - simulado: sin Twilio.
const MODOS = {
  real: { texto: 'SMS y voz reales (Twilio)', ayuda: 'Los SMS y llamadas salen de verdad por Twilio al teléfono de la demo', clase: 'aviso__modo--real' },
  plantilla: {
    texto: 'SMS real · texto simulado',
    ayuda: 'Cuenta de prueba de Twilio: el SMS sale de verdad con una plantilla de Twilio; el texto de PORTIX solo se muestra aquí. La voz se simula.',
    clase: 'aviso__modo--plantilla',
  },
  simulado: { texto: 'SIMULADO', ayuda: 'Twilio no está configurado: los avisos se simulan', clase: '' },
}

// Etiqueta de cada aviso del historial.
function estadoAviso(a) {
  if (a.real && a.plantilla) return { texto: 'SMS real · plantilla de prueba de Twilio', clase: 'aviso__estado--plantilla' }
  if (a.real) return { texto: 'Enviado de verdad (Twilio)', clase: 'aviso__estado--real' }
  return { texto: 'Simulado', clase: '' }
}

// Busca una voz en español (de preferencia de México) instalada en el navegador.
function vozEnEspanol() {
  const voces = window.speechSynthesis?.getVoices() ?? []
  return voces.find((v) => v.lang === 'es-MX') || voces.find((v) => v.lang.startsWith('es')) || null
}

export default function AvisoOperador({ contenedor }) {
  const [datos, setDatos] = useState(null) // { avisos, vista_previa, sms_real }
  const [enviando, setEnviando] = useState('') // 'sms' | 'voz' | ''
  const [error, setError] = useState('')
  const [hablando, setHablando] = useState(false)
  const c = contenedor

  async function cargar() {
    try {
      setDatos(await obtenerAvisos(c.id))
    } catch (e) {
      setError(`No se pudieron cargar los avisos. ${e.message}`)
    }
  }

  // Si cambia el color o la acción, cambia el texto del aviso: lo pedimos de nuevo.
  useEffect(() => {
    cargar()
    // Al salir, que no siga hablando la voz del navegador.
    return () => window.speechSynthesis?.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, c.color, c.accion_sugerida, c.estado_cita])

  async function avisar(canal) {
    setEnviando(canal)
    setError('')
    try {
      await avisarOperador(c.id, canal)
      await cargar()
    } catch (e) {
      setError(`No se pudo enviar el aviso. ${e.message}`)
    } finally {
      setEnviando('')
    }
  }

  function escucharAqui() {
    const sintesis = window.speechSynthesis
    if (!sintesis || !datos) return
    if (hablando) {
      sintesis.cancel()
      setHablando(false)
      return
    }
    const frase = new SpeechSynthesisUtterance(datos.vista_previa.voz)
    frase.lang = 'es-MX'
    frase.rate = 0.9 // un poco más lento: así se entiende mejor el número del contenedor
    const voz = vozEnEspanol()
    if (voz) frase.voice = voz
    frase.onend = () => setHablando(false)
    frase.onerror = () => setHablando(false)
    setHablando(true)
    sintesis.speak(frase)
  }

  const modo = MODOS[datos?.sms_modo] ?? MODOS.simulado
  const sms = datos?.vista_previa.sms ?? ''
  const historial = [...(datos?.avisos ?? [])].reverse() // el más reciente primero
  const puedeEscuchar = typeof window !== 'undefined' && 'speechSynthesis' in window

  return (
    <section className="aviso" aria-label="Aviso al operador por SMS o voz">
      <div className="aviso__titulo">
        <h3>Aviso al operador</h3>
        <span className={`aviso__modo ${modo.clase}`} title={modo.ayuda}>
          {modo.texto}
        </span>
      </div>
      <p className="aviso__ayuda">
        {c.operador} no tiene smartphone: le avisamos por SMS (máx. 160 caracteres, sin acentos) o con una llamada de voz.
      </p>

      {/* Celular básico dibujado: lo que vería el operador en su pantalla. */}
      <div className="celular" aria-label="Vista previa del SMS">
        <div className="celular__bocina" aria-hidden="true" />
        <div className="celular__pantalla">
          <div className="celular__barra">
            <span>SMS · PORTIX</span>
            <span>{c.telefono || 'sin número'}</span>
          </div>
          <p className="celular__texto">{sms || 'Cargando...'}</p>
          <div className="celular__contador">
            {sms.length}/{MAXIMO_SMS}
          </div>
        </div>
        <div className="celular__teclas" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>

      <div className="aviso__botones">
        <button type="button" className="boton" onClick={() => avisar('sms')} disabled={!!enviando || !datos}>
          {enviando === 'sms' ? 'Enviando...' : '💬 Enviar SMS'}
        </button>
        <button type="button" className="boton boton--secundario" onClick={() => avisar('voz')} disabled={!!enviando || !datos}>
          {enviando === 'voz' ? 'Llamando...' : '📞 Llamar (voz)'}
        </button>
        {puedeEscuchar && (
          <button type="button" className="boton boton--secundario" onClick={escucharAqui} disabled={!datos}>
            {hablando ? '⏹ Detener' : '🔊 Escuchar aquí'}
          </button>
        )}
      </div>

      {error && <p className="detalle__error">{error}</p>}

      {historial.length > 0 && (
        <ol className="aviso__historial" aria-label="Avisos enviados">
          {historial.map((a, i) => {
            const estado = estadoAviso(a)
            return (
            <li key={historial.length - i} className="aviso__item">
              <span className="aviso__icono" aria-hidden="true">{ICONO[a.canal]}</span>
              <div>
                <div className="aviso__meta">
                  <strong>{a.canal === 'sms' ? 'SMS' : 'Llamada'}</strong> · {a.hora} · {a.destino}
                  {a.motivo === 'reprogramar' && ' · automático al reprogramar'}
                </div>
                <span className={`aviso__estado ${estado.clase}`} title={a.detalle}>
                  {estado.texto}
                </span>
                {/* Si no salió tal cual (simulado o con plantilla), decimos por qué. */}
                {(!a.real || a.plantilla) && <span className="aviso__detalle"> {a.detalle}</span>}
              </div>
            </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
