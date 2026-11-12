import { SEMAFORO, formatoPesos } from '../textos.js'

// Conteo por color (de la misma lista que muestra la tabla, así siempre coinciden)
// y el contador de No Show evitados que lleva el backend (GET /api/resumen).
export default function Resumen({ contenedores, noShow }) {
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
      <div className="resumen__tarjeta resumen__tarjeta--noshow">
        <span className="resumen__numero">{noShow?.no_show_evitados ?? 0}</span>
        <span className="resumen__bloque">
          <span className="resumen__texto">No Show evitados</span>
          <span className="resumen__ahorro">{formatoPesos(noShow?.ahorro_mxn ?? 0)} ahorrados</span>
        </span>
      </div>
    </section>
  )
}
