# REQUESTS - LinkedIn Scraper V1

> Solicitudes del Backend al Frontend (Gemini CLI)
> Última actualización: 2026-03-20

---

## REQUEST #1: Tipos compartidos (CRÍTICO)

**Estado:** ⏳ Pendiente

**Lo que pido:**
El frontend debe importar los tipos TypeScript desde `src/types/index.ts` en lugar de redefinirlos. Así evitamos desincronización.

```typescript
import type { ContactRecord, SearchRecord, SearchFilters } from '@/types'
```

---

## REQUEST #2: Polling de estado

**Estado:** ⏳ Pendiente

**Lo que pido:**
Cuando el usuario lanza una búsqueda (POST /api/search), el frontend debe:
1. Guardar el `search_id` que devuelve el endpoint
2. Llamar `GET /api/status?search_id=xxx` cada **5 segundos**
3. Parar el polling cuando `search.status !== 'running'`
4. Mostrar las estadísticas en tiempo real: `total_contacts_created`, `total_processed`, etc.

```typescript
// Ejemplo de lógica de polling:
const poll = setInterval(async () => {
  const res = await fetch(`/api/status?search_id=${searchId}`)
  const data = await res.json()
  if (data.search.status !== 'running') clearInterval(poll)
}, 5000)
```

---

## REQUEST #3: Columnas de tabla de contactos

**Estado:** ⏳ Pendiente

**Lo que pido:**
La tabla de contactos debe mostrar estas columnas (en este orden):
1. `name` — Nombre completo
2. `job_title` — Título/puesto
3. `company` — Empresa
4. `location` — Ubicación
5. `years_experience` — Años exp (puede ser null → mostrar "-")
6. `confidence_score` — Score 0-1 (mostrar como %)
7. `linkedin_url` — Link clickeable (abrir en nueva tab)
8. `status` — Badge de color (new=gris, contacted=azul, converted=verde, skipped=amarillo, bounced=rojo)
9. Acciones: dropdown para cambiar status (llama PATCH /api/contacts?id=uuid)

---

## REQUEST #4: Formulario de nueva búsqueda

**Estado:** ⏳ Pendiente

**Campos del formulario:**
```
search_name (text, required)    → "energy_spain_v1" — unique
sector (text, required)         → "energía"
years_min (number, required)    → 5
keywords (tags input, required) → ["consultor", "solar"]
location (text, optional)       → "España"
max_results (number, optional)  → 30
description (textarea, optional)
```

**Al enviar:**
- POST /api/search con header `x-api-key`
- El `SEARCH_API_KEY` puede estar en `NEXT_PUBLIC_SEARCH_API_KEY` para el cliente

---

## REQUEST #5: Export CSV

**Estado:** ⏳ Pendiente

**Lo que pido:**
Botón "Descargar CSV" que exporte los contactos actuales.
El CSV debe tener estas columnas:
```
name, job_title, company, location, linkedin_url, years_experience, confidence_score, status, created_at
```

Se puede hacer client-side con `GET /api/contacts?search_id=xxx&page_size=100` y luego convertir a CSV en el navegador.

---

## NOTAS GENERALES

- **Auth:** El header `x-api-key` es necesario en POST y PATCH. Para que el browser lo pueda enviar, el valor debe estar en `process.env.NEXT_PUBLIC_SEARCH_API_KEY`.
- **No CORS:** Ambos frontend y backend corren en el mismo dominio (Next.js), no hay problema de CORS.
- **Supabase real-time:** Si quieres updates en tiempo real sin polling, podemos usar Supabase Realtime directamente desde el frontend. Dime si lo necesitas y lo conecto.
