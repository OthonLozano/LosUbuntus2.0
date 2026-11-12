import { useState } from 'react'
import { CARGO_NO_SHOW, formatoPesos } from '../textos.js'

// Sumar minutos a una hora "HH:MM" (para proponer una cita nueva).
function sumarHoras(hora, horas) {
  const [h, m] = hora.split(':').map(Number)
  const total = Math.min(h + horas, 23)
  return `${String(total).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Mover o cancelar la cita de un contenedor en rojo (POST /reprogramar).
// Si se hace antes del cierre de la ventana, el backend suma un No Show evitado.
export default function Reprogramar({ contenedor, ocupado, onReprogramar }) {
  const [nuevaCita, setNuevaCita] = useState(sumarHoras(contenedor.cita, 3))

  return (
    <div className="bloque bloque--alerta">
      <h3>Reprogramar la cita</h3>
      <p className="bloque__texto">
        Este camión ya no llega a su ventana. Si se mueve o cancela la cita antes de las{' '}
        <strong>{contenedor.ventana_fin}</strong>, se evita el cargo de No Show de{' '}
        {formatoPesos(CARGO_NO_SHOW)}.
      </p>

      <form
        className="fila-control"
        onSubmit={(e) => {
          e.preventDefault()
          onReprogramar(contenedor.id, 'mover', nuevaCita)
        }}
      >
        <label htmlFor="nueva-cita">Nueva cita</label>
        <input
          id="nueva-cita"
          type="time"
          value={nuevaCita}
          onChange={(e) => setNuevaCita(e.target.value)}
          required
        />
        <button type="submit" className="boton" disabled={ocupado}>
          Mover cita
        </button>
      </form>

      <button
        type="button"
        className="boton boton--peligro"
        disabled={ocupado}
        onClick={() => onReprogramar(contenedor.id, 'cancelar')}
      >
        Cancelar cita
      </button>
    </div>
  )
}
