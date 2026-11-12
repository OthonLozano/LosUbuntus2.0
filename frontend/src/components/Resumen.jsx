import { useEffect, useRef, useState } from 'react'
import { SEMAFORO, formatoPesos } from '../textos.js'
import './formularios.css'

// Texto del tooltip de la tarjeta de horas: el cálculo y su fuente, porque es una estimación.
const EXPLICACION_HORAS =
  'Estimación: camiones detenidos por documentos × 3 h 49 min, la espera promedio en el ' +
  'puerto de Veracruz en septiembre de 2026 (ITPAP, T21). Sin PORTIX, esos camiones harían ' +
  'la fila y los regresarían en el acceso.'

// Conteo por color (de la misma lista que muestra la tabla, así siempre coinciden),
// el contador de No Show evitados y las horas de fila evitadas (GET /api/resumen).
export default function Resumen({ contenedores, noShow }) {
  const contar = (color) => contenedores.filter((c) => c.color === color).length
  const evitados = noShow?.no_show_evitados ?? 0
  const detenidos = noShow?.detenidos_por_documentos ?? 0
  const horas = noShow?.horas_espera_evitadas ?? 0

  // F5: "pulso" cuando sube el contador de No Show. Guardamos el valor anterior
  // en un useRef (no provoca otro render) y solo animamos si el nuevo es mayor.
  const anterior = useRef(evitados)
  const [pulso, setPulso] = useState(false)
  useEffect(() => {
    if (evitados > anterior.current) setPulso(true)
    anterior.current = evitados
  }, [evitados])

  return (
    <section className="resumen resumen--kpis" aria-label="Resumen del día">
      {['verde', 'amarillo', 'rojo'].map((color) => (
        <div key={color} className={`resumen__tarjeta resumen__tarjeta--${color}`}>
          <span className="resumen__numero">{contar(color)}</span>
          <span className="resumen__texto">
            <span className="semaforo__punto" aria-hidden="true" />
            {SEMAFORO[color].plural}
          </span>
        </div>
      ))}
      <div
        className={`resumen__tarjeta resumen__tarjeta--noshow${pulso ? ' resumen__tarjeta--pulso' : ''}`}
        onAnimationEnd={() => setPulso(false)}
      >
        <span className="resumen__numero">{evitados}</span>
        <span className="resumen__bloque">
          <span className="resumen__texto">No Show evitados</span>
          <span className="resumen__ahorro">{formatoPesos(noShow?.ahorro_mxn ?? 0)} ahorrados</span>
        </span>
      </div>
      <div className="resumen__tarjeta resumen__tarjeta--horas" title={EXPLICACION_HORAS}>
        <span className="resumen__numero">
          {horas.toLocaleString('es-MX')}
          <span className="resumen__unidad"> h</span>
        </span>
        <span className="resumen__bloque">
          <span className="resumen__texto">Horas de fila evitadas</span>
          <span className="resumen__ahorro">
            Estimación · {detenidos} {detenidos === 1 ? 'camión detenido' : 'camiones detenidos'}{' '}
            <span className="resumen__info" aria-label={EXPLICACION_HORAS}>ⓘ</span>
          </span>
        </span>
      </div>
    </section>
  )
}
