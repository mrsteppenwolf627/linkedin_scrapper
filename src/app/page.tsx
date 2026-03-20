// Placeholder - el frontend lo implementa Gemini CLI
// Ver: context/REQUESTS.md para lo que necesita el frontend

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>LinkedIn Lead Scraper V1</h1>
      <p>Backend operativo. Frontend en construcción.</p>
      <hr />
      <h2>Endpoints disponibles:</h2>
      <ul>
        <li><code>POST /api/search</code> — Iniciar búsqueda</li>
        <li><code>GET /api/searches</code> — Listar búsquedas</li>
        <li><code>GET /api/contacts</code> — Listar contactos</li>
        <li><code>GET /api/status?search_id=uuid</code> — Estado de búsqueda</li>
      </ul>
      <p>Ver <code>/context/API_SPEC.md</code> para documentación completa.</p>
    </main>
  )
}
