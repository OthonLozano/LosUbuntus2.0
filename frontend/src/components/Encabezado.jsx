import { useEffect, useState } from 'react'
import { obtenerSalud, USAR_DATOS_FALSOS } from '../api.js'

// Encabezado de PORTIX: nombre con un semáforo hecho en CSS, la hora fija de la
// demo, si la IA está conectada y el botón para reiniciar la demo.
// La hora y el estado de la IA salen de GET /api/salud (nunca trae la API key).
export default function Encabezado({ onReiniciar }) {
  const [salud, setSalud] = useState(null)
  const [sinConexion, setSinConexion] = useState(false)
  const [reiniciando, setReiniciando] = useState(false)

  useEffect(() => {
    obtenerSalud()
      .then(setSalud)
      .catch(() => setSinConexion(true))
  }, [])

  async function reiniciar() {
    // confirm() es la ventanita del navegador: así nadie reinicia por accidente en plena demo.
    const seguro = window.confirm(
      '¿Reiniciar la demo? Se borran los cambios, los chats y el contador de No Show.',
    )
    if (!seguro) return
    setReiniciando(true)
    try {
      await onReiniciar()
    } catch (e) {
      window.alert(`No se pudo reiniciar la demo. ${e.message}`)
    } finally {
      setReiniciando(false)
    }
  }

  const iaConectada = salud?.ia_configurada === true

  return (
    <header className="encabezado">
      <div className="marca">
        {/* Semáforo decorativo: los tres colores de PORTIX */}
        <span className="marca__semaforo" aria-hidden="true">
          <span className="marca__luz marca__luz--rojo" />
          <span className="marca__luz marca__luz--amarillo" />
          <span className="marca__luz marca__luz--verde" />
        </span>
        <div>
          <h1>PORTIX</h1>
          <p className="encabezado__sub">Semáforo de salida · contenedores del día</p>
        </div>
      </div>

      <div className="encabezado__estado">
        {USAR_DATOS_FALSOS && <span className="chip chip--aviso">Datos de prueba: backend no conectado</span>}
        <span className="chip" title="La hora de la demo está fija para que siempre salga igual">
          Hora de la demo: <strong>{salud?.hora_actual ?? '--:--'}</strong> (fija)
        </span>
        <span
          className={`chip ${iaConectada ? 'chip--ok' : 'chip--respaldo'}`}
          title={iaConectada && salud?.modelo ? `Modelo: ${salud.modelo}` : ''}
        >
          {sinConexion ? 'IA: sin conexión' : iaConectada ? 'IA: Gemini conectada' : 'IA: modo respaldo'}
        </span>
        <button type="button" className="boton boton--secundario" onClick={reiniciar} disabled={reiniciando}>
          {reiniciando ? 'Reiniciando...' : 'Reiniciar demo'}
        </button>
      </div>
    </header>
  )
}
