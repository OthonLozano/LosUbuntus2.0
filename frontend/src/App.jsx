import { useEffect, useState } from 'react'
import { listarContenedores, cambiarDocumento, USAR_DATOS_FALSOS } from './api.js'
import { PRIORIDAD } from './textos.js'
import './index.css'
import Resumen from './components/Resumen.jsx'
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
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  async function cargar() {
    try {
      const lista = await listarContenedores()
      setContenedores(ordenar(lista))
      setErrorCarga('')
    } catch (e) {
      setErrorCarga(`No se pudieron cargar los contenedores. ${e.message}`)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  // Al cambiar un documento: PATCH al backend y luego se vuelve a pedir la lista,
  // para que el color, el resumen y la acción sugerida salgan del cálculo del backend.
  async function onCambiarDocumento(id, tipo, estado) {
    const nota = contenedores.find((c) => c.id === id)?.documentos.find((d) => d.tipo === tipo)?.nota ?? ''
    setGuardando(true)
    setErrorGuardar('')
    try {
      await cambiarDocumento(id, { tipo, estado, nota })
      await cargar()
    } catch (e) {
      setErrorGuardar(`No se guardó el cambio. ${e.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const seleccionado = contenedores.find((c) => c.id === seleccionadoId)

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
          <Resumen contenedores={contenedores} />
          <main className="tablero">
            <ListaContenedores
              contenedores={contenedores}
              seleccionadoId={seleccionadoId}
              onSeleccionar={setSeleccionadoId}
            />
            <PanelDetalle
              contenedor={seleccionado}
              guardando={guardando}
              error={errorGuardar}
              onCambiarDocumento={onCambiarDocumento}
            />
          </main>
        </>
      )}

      <footer className="pie">
        Contenedores, operadores y placas son datos sintéticos.
      </footer>
    </div>
  )
}
