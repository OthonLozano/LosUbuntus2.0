import { SEMAFORO } from '../textos.js'

// Etiqueta de color + texto (Sale / Espera / Reprogramar).
export default function Semaforo({ color }) {
  const info = SEMAFORO[color]
  if (!info) return <span className="semaforo">Sin calcular</span>
  return (
    <span className={`semaforo semaforo--${color}`}>
      <span className="semaforo__punto" aria-hidden="true" />
      {info.texto}
    </span>
  )
}
