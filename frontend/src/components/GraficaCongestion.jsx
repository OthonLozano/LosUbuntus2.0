import { CONGESTION } from '../textos.js'

// Altura de cada barra según el nivel. El nivel también va escrito debajo:
// la altura y el color no son la única señal.
const ALTURA = { baja: 1, media: 2, alta: 3 }

// Gráfica de congestión por hora. Los datos vienen de GET /api/congestion
// y son SIMULADOS: el ITPAP solo publica un promedio mensual.
export default function GraficaCongestion({ congestion, horaResaltada }) {
  if (!congestion) return null

  const horas = Object.keys(congestion.por_hora).sort()
  const { multiplicadores, traslado_base_min: base } = congestion

  return (
    <section className="congestion" aria-labelledby="titulo-congestion">
      <div className="congestion__encabezado">
        <h2 id="titulo-congestion">Congestión por hora de salida</h2>
        <span className="etiqueta-simulada">Simulada</span>
      </div>

      <div className="congestion__barras" role="list">
        {horas.map((hora) => {
          const nivel = congestion.por_hora[hora]
          const resaltada = hora === horaResaltada
          const minutos = Math.ceil(base * multiplicadores[nivel])
          return (
            <div
              key={hora}
              role="listitem"
              className={`congestion__columna${resaltada ? ' congestion__columna--resaltada' : ''}`}
              title={`${hora}:00 · congestión ${nivel} · traslado ${minutos} min`}
            >
              <div className="congestion__area">
                <div
                  className={`congestion__barra congestion__barra--${nivel}`}
                  style={{ height: `${(ALTURA[nivel] / 3) * 100}%` }}
                />
              </div>
              <span className="congestion__nivel">{CONGESTION[nivel]}</span>
              <span className="congestion__hora">{hora}:00</span>
            </div>
          )
        })}
      </div>

      <p className="congestion__nota">
        Traslado del patio al puerto: {base} min con congestión baja,{' '}
        {Math.ceil(base * multiplicadores.media)} min con media y{' '}
        {Math.ceil(base * multiplicadores.alta)} min con alta. Tabla supuesta por el equipo: el ITPAP
        solo publica un promedio mensual.
        {horaResaltada && ' La columna marcada es la hora de salida del contenedor elegido.'}
      </p>
    </section>
  )
}
