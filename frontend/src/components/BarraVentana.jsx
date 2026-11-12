// Línea de tiempo: la ventana de la cita y dónde cae la llegada estimada.
// Siempre dice con palabras si llega antes, dentro o después de la ventana.

function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export default function BarraVentana({ ventanaInicio, ventanaFin, llegada }) {
  const inicio = aMinutos(ventanaInicio)
  const fin = aMinutos(ventanaFin)
  const llega = aMinutos(llegada)

  // Mostramos 1 h de margen a cada lado de la ventana (o más, si la llegada cae lejos).
  const desde = Math.min(inicio - 60, llega - 15)
  const hasta = Math.max(fin + 60, llega + 15)
  const pos = (m) => `${((m - desde) / (hasta - desde)) * 100}%`

  let posicion = 'dentro'
  let texto = 'Llega dentro de la ventana'
  if (llega > fin) {
    posicion = 'despues'
    texto = `Llega ${llega - fin} min después del cierre`
  } else if (llega < inicio) {
    posicion = 'antes'
    texto = `Llega ${inicio - llega} min antes de que abra`
  }

  return (
    <div className="ventana">
      <div className="ventana__pista" aria-hidden="true">
        <div className="ventana__rango" style={{ left: pos(inicio), width: `calc(${pos(fin)} - ${pos(inicio)})` }} />
        <div className={`ventana__llegada ventana__llegada--${posicion}`} style={{ left: pos(llega) }} />
      </div>
      <div className="ventana__marcas" aria-hidden="true">
        <span style={{ left: pos(inicio) }}>{ventanaInicio}</span>
        <span style={{ left: pos(fin) }}>{ventanaFin}</span>
      </div>
      <p className={`ventana__texto ventana__texto--${posicion}`}>
        {texto} (llegada estimada {llegada}, ventana {ventanaInicio} a {ventanaFin})
      </p>
    </div>
  )
}
