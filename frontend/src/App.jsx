import { useEffect, useState } from 'react'

// Pantalla de prueba de F0: solo confirma que el frontend habla con el backend.
// Renata la reemplaza por el tablero en F1.
export default function App() {
  const [salud, setSalud] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/salud')
      .then((r) => r.json())
      .then(setSalud)
      .catch(() => setError('No se pudo conectar con el backend. ¿Está corriendo en el puerto 8000?'))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>PORTIX</h1>
      <p>Semáforo de salida para transportistas del puerto de Veracruz.</p>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}
      {!salud && !error && <p>Conectando con el backend…</p>}
      {salud && (
        <ul>
          <li>Backend: {salud.estado}</li>
          <li>IA configurada: {salud.ia_configurada ? 'sí' : 'no (falta GEMINI_API_KEY en backend/.env)'}</li>
        </ul>
      )}
    </main>
  )
}
