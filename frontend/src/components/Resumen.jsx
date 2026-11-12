import { SEMAFORO } from '../textos.js'

// Conteo por color. Se calcula con la misma lista que se muestra,
// así el resumen y la tabla siempre coinciden.
export default function Resumen({ contenedores }) {
  const contar = (color) => contenedores.filter((c) => c.color === color).length

  return (
    <section className="resumen" aria-label="Resumen del día">
      {['verde', 'amarillo', 'rojo'].map((color) => (
        <div key={color} className={`resumen__tarjeta resumen__tarjeta--${color}`}>
          <span className="resumen__numero">{contar(color)}</span>
          <span className="resumen__texto">
            <span className="semaforo__punto" aria-hidden="true" />
            {SEMAFORO[color].plural}
          </span>
        </div>
      ))}
    </section>
  )
}
