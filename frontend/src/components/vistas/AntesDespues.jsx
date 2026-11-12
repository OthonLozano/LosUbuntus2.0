import Semaforo from '../Semaforo.jsx'

// Muestra cómo cambió el color del contenedor por la acción de la IA:
// "Antes: Espera → Ahora: Sale". Si no cambió, lo dice con palabras.
export default function AntesDespues({ antes, despues }) {
  if (!antes || !despues) return null
  if (antes === despues) {
    return (
      <p className="antes-despues">
        El contenedor sigue en <Semaforo color={despues} />
      </p>
    )
  }
  return (
    <p className="antes-despues antes-despues--cambio">
      <span>Antes</span> <Semaforo color={antes} />
      <span aria-hidden="true">→</span>
      <span>Ahora</span> <Semaforo color={despues} />
    </p>
  )
}
