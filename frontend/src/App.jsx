import { useEffect, useRef, useState } from 'react'
import {
  listarContenedores,
  cambiarDocumento,
  obtenerResumen,
  obtenerCongestion,
  reprogramar,
  reiniciarDemo,
} from './api.js'
import { PRIORIDAD, CARGO_NO_SHOW, formatoPesos } from './textos.js'
import './index.css'
import Encabezado from './components/Encabezado.jsx'
import VistaPanel from './components/vistas/VistaPanel.jsx'
import VistaDocumentos from './components/vistas/VistaDocumentos.jsx'
import VistaChat from './components/vistas/VistaChat.jsx'
import { pendientesDe } from './components/vistas/ListaCompacta.jsx'

// Las 3 vistas. La activa se guarda en el "hash" de la URL (#panel, #documentos,
// #chat): así se puede compartir el link y el botón Atrás del navegador funciona,
// sin instalar react-router.
const VISTAS = [
  { id: 'panel', texto: 'Panel' },
  { id: 'documentos', texto: 'Documentos' },
  { id: 'chat', texto: 'Chat con la agencia' },
]

function vistaDeLaUrl() {
  const hash = window.location.hash.slice(1) // "#chat" → "chat"
  return VISTAS.some((v) => v.id === hash) ? hash : 'panel'
}

// Rojo primero, luego amarillo y al final verde; dentro de cada color, por hora de cita.
function ordenar(lista) {
  return [...lista].sort(
    (a, b) => PRIORIDAD[a.color] - PRIORIDAD[b.color] || a.cita.localeCompare(b.cita),
  )
}

export default function App() {
  const [vista, setVista] = useState(vistaDeLaUrl)
  const [contenedores, setContenedores] = useState([])
  const [resumen, setResumen] = useState(null)
  const [congestion, setCongestion] = useState(null)
  // El contenedor elegido se comparte entre las 3 vistas.
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [mensaje, setMensaje] = useState('')
  // Sube cada vez que se reinicia la demo. Va en la key del chat y de la revisión
  // de documentos para que se creen de nuevo y pidan su estado otra vez.
  const [version, setVersion] = useState(0)

  // Parpadeo: guardamos el último color de cada contenedor (useRef no vuelve a
  // dibujar la pantalla al cambiar). Si en la siguiente carga el color es otro,
  // ese id entra a `cambiados` durante 1 s y su fila parpadea con el color nuevo.
  const coloresAnteriores = useRef({})
  const temporizador = useRef(null)
  const [cambiados, setCambiados] = useState({})

  // Pide la lista y el resumen juntos, para que el color y el contador
  // de No Show siempre salgan del mismo momento del backend.
  async function cargar() {
    try {
      const [lista, res] = await Promise.all([listarContenedores(), obtenerResumen()])
      marcarCambiosDeColor(lista)
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

  function marcarCambiosDeColor(lista) {
    const nuevos = {}
    for (const c of lista) {
      const antes = coloresAnteriores.current[c.id]
      if (antes && antes !== c.color) nuevos[c.id] = true
      coloresAnteriores.current[c.id] = c.color
    }
    if (Object.keys(nuevos).length === 0) return
    setCambiados(nuevos)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setCambiados({}), 1000)
  }

  useEffect(() => {
    cargar()
    // La congestión (simulada) no cambia durante la demo: se pide una sola vez.
    obtenerCongestion()
      .then(setCongestion)
      .catch(() => setCongestion(null))

    // Si el usuario usa Atrás/Adelante o cambia el link a mano, seguimos la URL.
    const alCambiarHash = () => setVista(vistaDeLaUrl())
    window.addEventListener('hashchange', alCambiarHash)
    return () => {
      window.removeEventListener('hashchange', alCambiarHash)
      clearTimeout(temporizador.current)
    }
  }, [])

  // Cambiar de pestaña = cambiar el hash. El evento "hashchange" actualiza `vista`.
  function irA(id) {
    if (id === vista) return
    window.location.hash = id
  }

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

  // F3 y F4: el backend ya actualizó el checklist (por el documento o por el chat).
  // Solo volvemos a pedir la lista y el resumen para que el color salga de su cálculo.
  async function onDocumentoRevisado() {
    setMensaje('')
    setErrorGuardar('')
    await cargar()
  }

  // F5: el formulario de Othon ya creó el contenedor; lo mostramos elegido.
  async function onContenedorAgregado(c) {
    await cargar()
    elegir(c.id)
  }

  // F5: regresa la demo a su estado inicial. Olvidamos los colores anteriores
  // para que no parpadee toda la lista al volver a los colores originales.
  async function onReiniciar() {
    await reiniciarDemo()
    coloresAnteriores.current = {}
    setSeleccionadoId(null)
    setMensaje('')
    setErrorGuardar('')
    setVersion((v) => v + 1)
    await cargar()
  }

  // Flechas izquierda/derecha para moverse entre pestañas (patrón de accesibilidad de tabs).
  function alTeclearPestanas(e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = VISTAS.findIndex((v) => v.id === vista)
    const siguiente = VISTAS[(i + (e.key === 'ArrowRight' ? 1 : VISTAS.length - 1)) % VISTAS.length]
    irA(siguiente.id)
    document.getElementById(`pestana-${siguiente.id}`)?.focus()
  }

  const seleccionado = contenedores.find((c) => c.id === seleccionadoId)
  const conPendientes = contenedores.filter((c) => pendientesDe(c) > 0).length

  // Lo que comparten las 3 vistas.
  const comunes = {
    contenedores,
    seleccionado,
    seleccionadoId,
    onSeleccionar: elegir,
    cambiados,
    guardando,
    errorGuardar,
    onCambiarDocumento,
    onDocumentoRevisado,
    version,
  }

  return (
    <>
      {/* Barra azul de lado a lado (estilo "Puerto"): encabezado y pestañas. */}
      <div className="cabecera">
        <div className="cabecera__interior">
          <Encabezado onReiniciar={onReiniciar} />

          <nav className="pestanas" role="tablist" aria-label="Vistas de PORTIX" onKeyDown={alTeclearPestanas}>
            {VISTAS.map((v) => (
              <button
                key={v.id}
                id={`pestana-${v.id}`}
                type="button"
                role="tab"
                aria-selected={vista === v.id}
                aria-controls="vista-activa"
                tabIndex={vista === v.id ? 0 : -1}
                className="pestana"
                onClick={() => irA(v.id)}
              >
                {v.texto}
                {v.id !== 'panel' && conPendientes > 0 && (
                  <span
                    className="pestana__contador"
                    aria-label={`${conPendientes} contenedores con documentos pendientes`}
                  >
                    {conPendientes}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="app">
        <div id="vista-activa" role="tabpanel" aria-labelledby={`pestana-${vista}`}>
          {cargando && <p>Cargando contenedores...</p>}
          {errorCarga && <p className="detalle__error">{errorCarga}</p>}

          {!cargando && !errorCarga && (
            <>
              {vista === 'panel' && (
                <VistaPanel
                  {...comunes}
                  resumen={resumen}
                  congestion={congestion}
                  mensaje={mensaje}
                  onReprogramar={onReprogramar}
                  onIrA={irA}
                  onContenedorAgregado={onContenedorAgregado}
                />
              )}
              {vista === 'documentos' && <VistaDocumentos {...comunes} />}
              {vista === 'chat' && <VistaChat {...comunes} />}
            </>
          )}
        </div>

        <footer className="pie">
          Contenedores, operadores y placas son datos sintéticos. La congestión por hora es simulada.
        </footer>
      </div>
    </>
  )
}
