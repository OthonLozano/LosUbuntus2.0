// F5 · Formulario para agregar un contenedor (PROVISIONAL).
// Dueño: Othon. Renata solo lo importa.
// onCreado(contenedor) recibe la respuesta del POST /api/contenedores.
// onCancelar() cierra el formulario sin guardar.
export default function AgregarContenedor({ onCreado, onCancelar }) {
  // onCreado se usará cuando el formulario esté completo; por ahora no se llama.
  void onCreado

  return (
    <div className="agregar-contenedor">
      <p>Formulario en construcción</p>
      <button type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  )
}
