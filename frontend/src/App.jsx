import { useEffect, useState } from 'react'
import {
  listarContenedores,
  cambiarDocumento,
  obtenerResumen,
  obtenerCongestion,
  reprogramar,
  USAR_DATOS_FALSOS,
} from './api.js'
import { PRIORIDAD, CARGO_NO_SHOW, formatoPesos } from './textos.js'
import './index.css'
import Resumen from './components/Resumen.jsx'
import GraficaCongestion from './components/GraficaCongestion.jsx'
import ListaContenedores from './components/ListaContenedores.jsx'
import PanelDetalle from './components/PanelDetalle.jsx'

// Rojo primero, luego amarillo y al final verde; dentro de cada color, por hora de cita.
function ordenar(lista) {
  return [...lista].sort(
    (a, b) => PRIORIDAD[a.color] - PRIORIDAD[b.color] || a.cita.localeCompare(b.cita),
  )
}

export default function App() {
  const [contenedores, setContenedores] = useState([])
  const [resumen, setResumen] = useState(null)
  const [congestion, setCongestion] = useState(null)
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [mensaje, setMensaje] = useState('')

  // Pide la lista y el resumen juntos, para que el color y el contador
  // de No Show siempre salgan del mismo momento del backend.
  async function cargar() {
    try {
      const [lista, res] = await Promise.all([listarContenedores(), obtenerResumen()])
      setContenedores(ordenar(lista))
      setResumen(res)
      setErrorCarga('')
      return res
    } catch (e) {
      setErrorCarga(`No se pudieron cargar los contenedores. ${e.message}`)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // La congestión (simulada) no cambia durante la demo: se pide una sola vez.
    obtenerCongestion()
      .then(setCongestion)
      .catch(() => setCongestion(null))
  }, [])

  function elegir(id) {
    setSeleccionadoId(id)
    setMensaje('')
    setErrorGuardar('')
  }

  // Al cambiar un documento: PATCH al backend y luego se vuelve a pedir la lista,
  // para que el color, el resumen y la acción sugerida salgan del cálculo del backend.
  async function onCambiarDocumento(id, tipo, estado) {
    const nota = contenedores.find((c) => c.id === id)?.documentos.find((d) => d.tipo === tipo)?.nota ?? ''
    setGuardando(true)
    setErrorGuardar('')
    setMensaje('')
    try {
      await cambiarDocumento(id, { tipo, estado, nota })
      await cargar()
    } catch (e) {
      setErrorGuardar(`No se guardó el cambio. ${e.message}`)
    } finally {
      setGuardando(false)
    }
  }

  // Mover o cancelar una cita en rojo. Comparamos el contador antes y después
  // para avisar si se sumó un No Show evitado (eso lo decide el backend).
  async function onReprogramar(id, accion, nuevaCita) {
    const antes = resumen?.no_show_evitados ?? 0
    setGuardando(true)
    setErrorGuardar('')
    setMensaje('')
    try {
      await reprogramar(id, accion, nuevaCita)
      const res = await cargar()
      const sumo = (res?.no_show_evitados ?? antes) > antes
      const hecho = accion === 'mover' ? `Cita movida a las ${nuevaCita}.` : 'Cita cancelada.'
      setMensaje(sumo ? `${hecho} No Show evitado: ${formatoPesos(CARGO_NO_SHOW)} que no se pagan.` : hecho)
    } catch (e) {
      setErrorGuardar(`No se pudo reprogramar. ${e.message}`)
    } finally {
      setGuardando(false)
    }
  }

  // F3: el backend ya actualizó el checklist al revisar el documento.
  // Solo volvemos a pedir la lista y el resumen para que el color salga de su cálculo.
  async function onDocumentoRevisado() {
    setMensaje('')
    setErrorGuardar('')
    await cargar()
  }

  const seleccionado = contenedores.find((c) => c.id === seleccionadoId)
  const horaSalida = seleccionado?.salida_planeada.slice(0, 2)

  return (
    <div className="app">
      <header className="encabezado">
        <div>
          <h1>PORTIX</h1>
          <p className="encabezado__sub">Semáforo de salida · contenedores del día</p>
        </div>
        {USAR_DATOS_FALSOS && (
          <p className="aviso-simulado">Datos de prueba: el backend aún no está conectado</p>
        )}
      </header>

      {cargando && <p>Cargando contenedores...</p>}
      {errorCarga && <p className="detalle__error">{errorCarga}</p>}

      {!cargando && !errorCarga && (
        <>
          <Resumen contenedores={contenedores} noShow={resumen} />
          <GraficaCongestion congestion={congestion} horaResaltada={horaSalida} />
          <main className="tablero">
            <ListaContenedores
              contenedores={contenedores}
              seleccionadoId={seleccionadoId}
              onSeleccionar={elegir}
            />
            <PanelDetalle
              // Si cambia la cita o la salida (por ejemplo al reprogramar), el panel se
              // reinicia para no mostrar una prueba vieja.
              key={`${seleccionadoId}|${seleccionado?.cita}|${seleccionado?.salida_planeada}|${seleccionado?.estado_cita}`}
              contenedor={seleccionado}
              guardando={guardando}
              error={errorGuardar}
              mensaje={mensaje}
              onCambiarDocumento={onCambiarDocumento}
              onReprogramar={onReprogramar}
              onDocumentoRevisado={onDocumentoRevisado}
            />
          </main>
        </>
      )}

      <footer className="pie">
        Contenedores, operadores y placas son datos sintéticos. La congestión por hora es simulada.
      </footer>
    </div>
  )
}
