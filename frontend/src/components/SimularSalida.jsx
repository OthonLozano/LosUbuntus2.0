import { useState } from 'react'
import { simularSalida } from '../api.js'
import { CONGESTION } from '../textos.js'
import Semaforo from './Semaforo.jsx'

// "¿Y si sale a otra hora?": llama a POST /simular-salida, que recalcula
// el semáforo SIN guardar nada. El resultado se muestra aparte del contenedor real.
export default function SimularSalida({ contenedor, onResultado }) {
  const [hora, setHora] = useState(contenedor.salida_planeada)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function probar(e) {
    e.preventDefault()
    if (!hora) return
    setCargando(true)
    setError('')
    try {
      const r = await simularSalida(contenedor.id, hora)
      setResultado(r)
      onResultado(r)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  function quitar() {
    setResultado(null)
    setHora(contenedor.salida_planeada)
    onResultado(null)
  }

  return (
    <div className="bloque">
      <h3>Probar otra hora de salida</h3>
      <form className="fila-control" onSubmit={probar}>
        <label htmlFor="hora-salida">Salida</label>
        <input
          id="hora-salida"
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          required
        />
        <button type="submit" className="boton" disabled={cargando}>
          {cargando ? 'Calculando...' : 'Probar'}
        </button>
      </form>

      {error && <p className="detalle__error">{error}</p>}

      {resultado && (
        <div className="simulacion" aria-live="polite">
          <div className="simulacion__fila">
            <span>
              Si sale a las <strong>{resultado.salida_planeada}</strong>:
            </span>
            <Semaforo color={resultado.color} />
          </div>
          <p>
            Traslado de {resultado.traslado_min} min (congestión {CONGESTION[resultado.congestion].toLowerCase()},
            simulada) · llega a las {resultado.llegada_estimada}.
          </p>
          <p>{resultado.motivo}</p>
          <div className="simulacion__pie">
            <span className="simulacion__aviso">Solo es una prueba: no se guarda.</span>
            <button type="button" className="boton boton--secundario" onClick={quitar}>
              Quitar prueba
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
