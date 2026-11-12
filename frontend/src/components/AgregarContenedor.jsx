import { useState } from 'react'
import { crearContenedor, extraerDatosViaje } from '../api.js'
import { TIPOS_CARGA } from '../textos.js'
import './formularios.css'

// F5 · Formulario para agregar un contenedor del día.
// Dueño: Othon. Renata solo lo importa (por ejemplo, dentro de un modal).
// - onCreado(contenedor): recibe la respuesta del POST /api/contenedores
//   (el contenedor con su color ya calculado).
// - onCancelar(): cierra el formulario sin guardar.
//
// El contenedor se guarda en memoria en el backend: "Reiniciar demo" lo borra.
//
// Extra con IA: "Llenar desde carta porte" manda el archivo a /api/extraer-viaje
// y llena los campos que la IA encontró. NUNCA guarda solo: el despachador
// revisa y luego presiona Agregar.

const VACIO = {
  id: '',
  tipo_carga: 'general',
  terminal: 'ICAVE',
  cita: '',
  operador: '',
  placas: '',
  salida_planeada: '',
  telefono: '',
}

// Lo mismo que acepta el backend en /api/extraer-viaje.
const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png']
const MAXIMO_MB = 10

// Mismo formato que valida el backend: 4 letras, espacio, 6 dígitos, guion y 1 dígito.
const PATRON_ID = /^[A-Z]{4} \d{6}-\d$/

// Revisamos en el navegador lo mismo que revisa el backend, para avisar antes
// de mandar. Si algo se escapa, el backend responde 422 y mostramos su mensaje.
function validar(datos) {
  if (!PATRON_ID.test(datos.id)) return 'El contenedor debe tener el formato ABCD 123456-7.'
  if (!datos.cita) return 'Falta la hora de la cita.'
  if (!datos.salida_planeada) return 'Falta la hora de salida planeada.'
  if (datos.operador.trim().length < 2) return 'Escribe el nombre del operador.'
  if (datos.placas.trim().length < 5) return 'Las placas deben tener al menos 5 caracteres.'
  return ''
}

export default function AgregarContenedor({ onCreado, onCancelar }) {
  const [datos, setDatos] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [lecturaIA, setLecturaIA] = useState(null) // { campos: n, respaldo, motivo }

  // Un solo manejador para todos los campos: usa el atributo `name` del input.
  // El id y las placas se pasan a mayúsculas mientras se escriben.
  function cambiar(e) {
    const { name, value } = e.target
    const valor = name === 'id' || name === 'placas' ? value.toUpperCase() : value
    setDatos((anteriores) => ({ ...anteriores, [name]: valor }))
    setError('')
  }

  async function llenarConIA(e) {
    const archivo = e.target.files[0]
    e.target.value = '' // para poder elegir el mismo archivo otra vez
    if (!archivo) return
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      setError('Ese tipo de archivo no se puede leer. Usa PDF, JPG o PNG.')
      return
    }
    if (archivo.size > MAXIMO_MB * 1024 * 1024) {
      setError(`El archivo pasa de ${MAXIMO_MB} MB.`)
      return
    }
    setLeyendo(true)
    setError('')
    setLecturaIA(null)
    try {
      const r = await extraerDatosViaje(archivo)
      // Solo llenamos los campos que la IA encontró; lo demás se queda como estaba.
      const encontrados = {}
      if (r.id) encontrados.id = r.id
      if (r.operador) encontrados.operador = r.operador
      if (r.placas) encontrados.placas = r.placas
      if (r.terminal) encontrados.terminal = r.terminal
      setDatos((anteriores) => ({ ...anteriores, ...encontrados }))
      setLecturaIA({ campos: Object.keys(encontrados).length, respaldo: r.respaldo, motivo: r.motivo_respaldo })
    } catch (err) {
      setError(`No se pudo leer el documento. ${err.message}`)
    } finally {
      setLeyendo(false)
    }
  }

  async function agregar(e) {
    e.preventDefault()
    const limpio = { ...datos, id: datos.id.trim(), operador: datos.operador.trim(), placas: datos.placas.trim(), telefono: datos.telefono.trim() }
    const problema = validar(limpio)
    if (problema) {
      setError(problema)
      return
    }
    setGuardando(true)
    setError('')
    try {
      const creado = await crearContenedor(limpio)
      setDatos(VACIO)
      onCreado(creado)
    } catch (err) {
      // El mensaje del backend llega tal cual (por ejemplo "Ya existe el contenedor ...").
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={agregar} noValidate>
      <h2 className="formulario__titulo">Agregar contenedor</h2>
      <p className="formulario__ayuda">
        Los documentos empiezan como pendientes: márcalos en el checklist o súbelos para que los revise la IA.
      </p>

      <div className="formulario__ia">
        <label className="boton boton--secundario">
          {leyendo ? 'Leyendo con IA...' : 'Llenar desde carta porte (IA)'}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={llenarConIA}
            disabled={leyendo || guardando}
          />
        </label>
        {lecturaIA && !lecturaIA.respaldo && (
          <span className="formulario__aviso" role="status">
            {lecturaIA.campos > 0
              ? `La IA llenó ${lecturaIA.campos} ${lecturaIA.campos === 1 ? 'campo' : 'campos'}: revísalos antes de agregar.`
              : 'La IA no encontró datos del viaje en ese documento.'}
          </span>
        )}
        {lecturaIA?.respaldo && (
          <span className="formulario__aviso" role="status">
            <span className="etiqueta-simulada" title={lecturaIA.motivo || ''}>
              Respuesta de respaldo
            </span>{' '}
            La IA no está disponible: llena los datos a mano.
          </span>
        )}
      </div>

      <div className="formulario__rejilla">
        <label className="formulario__campo formulario__campo--ancho">
          Contenedor
          <input
            name="id"
            value={datos.id}
            onChange={cambiar}
            placeholder="ABCD 123456-7"
            maxLength={13}
            autoComplete="off"
            required
          />
        </label>

        <label className="formulario__campo">
          Tipo de carga
          <select name="tipo_carga" value={datos.tipo_carga} onChange={cambiar}>
            {Object.entries(TIPOS_CARGA).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </label>

        <label className="formulario__campo">
          Terminal
          <select name="terminal" value={datos.terminal} onChange={cambiar}>
            <option value="ICAVE">ICAVE</option>
            <option value="CICE">CICE</option>
          </select>
        </label>

        <label className="formulario__campo">
          Cita
          <input type="time" name="cita" value={datos.cita} onChange={cambiar} required />
        </label>

        <label className="formulario__campo">
          Salida planeada
          <input type="time" name="salida_planeada" value={datos.salida_planeada} onChange={cambiar} required />
        </label>

        <label className="formulario__campo">
          Operador
          <input name="operador" value={datos.operador} onChange={cambiar} placeholder="R. Gómez" maxLength={60} required />
        </label>

        <label className="formulario__campo">
          Placas
          <input name="placas" value={datos.placas} onChange={cambiar} placeholder="52-AM-9F" maxLength={12} required />
        </label>

        <label className="formulario__campo formulario__campo--ancho">
          Teléfono del operador (para SMS o voz; usa uno ficticio)
          <input name="telefono" value={datos.telefono} onChange={cambiar} placeholder="229 000 0110" maxLength={20} />
        </label>
      </div>

      {error && (
        <p className="formulario__error" role="alert">
          {error}
        </p>
      )}

      <div className="formulario__botones">
        <button type="button" className="boton boton--secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Agregando...' : 'Agregar'}
        </button>
      </div>
    </form>
  )
}
