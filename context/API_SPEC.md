# API SPEC - LinkedIn Scraper V1

> Autor: Claude Code (Backend)
> Versión: 1.0
> Base URL: `http://localhost:3000` (dev) | `https://tu-dominio.vercel.app` (prod)
> Última actualización: 2026-03-20

---

## Autenticación

Endpoints que escriben datos requieren header:
```
x-api-key: <valor de SEARCH_API_KEY en .env.local>
```
Los GET son públicos (mismo dominio = Next.js).

---

## POST /api/search

Inicia búsqueda. Responde inmediatamente → polling con `/api/status`.

**Headers:** `x-api-key`, `Content-Type: application/json`

**Body:**
```json
{
  "search_name": "energy_spain_v1",
  "filters": {
    "sector": "energía",
    "years_min": 5,
    "keywords": ["consultor", "solar"],
    "location": "España"
  },
  "google_query": "...",
  "max_results": 30,
  "description": "Texto libre opcional"
}
```
> `google_query` es opcional. Si no se pasa, Claude la genera.

**Respuesta 202:**
```json
{
  "search_id": "uuid",
  "status": "running",
  "message": "Búsqueda iniciada..."
}
```
**Errores:** 400 (campos), 401 (auth), 409 (nombre duplicado), 500

---

## GET /api/status?search_id=uuid

Estado en tiempo real. **Hacer polling cada 5s** mientras `status === "running"`.

**Respuesta 200:**
```json
{
  "search": {
    "id": "uuid",
    "name": "energy_spain_v1",
    "status": "running | completed | failed | pending",
    "google_query": "site:linkedin.com/in...",
    "total_results_google": 25,
    "total_results_processed": 18,
    "total_contacts_created": 12,
    "total_duplicates_found": 3,
    "total_invalid": 3,
    "created_at": "2026-03-20T10:00:00Z",
    "error_message": null,
    "filters": { "sector": "energía", "years_min": 5, "keywords": ["..."] }
  },
  "contacts_count": 12
}
```
**Errores:** 400 (sin search_id), 404 (no existe)

---

## GET /api/contacts

Lista contactos con filtros y paginación.

**Query params:**
```
?search_id=uuid          → Filtrar por búsqueda (recomendado)
?status=new              → new | contacted | converted | skipped | bounced
?is_valid=true
?exclude_duplicates=true → default: true
?page=1                  → default: 1
?page_size=50            → default: 50, max: 100
?q=carlos                → Buscar por nombre o empresa
```

**Respuesta 200:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "name": "Carlos García",
      "job_title": "Senior Energy Consultant",
      "company": "Iberdrola",
      "location": "Madrid, España",
      "linkedin_url": "linkedin.com/in/carlos-garcia-energy",
      "years_experience": 8,
      "confidence_score": 0.85,
      "matching_keywords": { "matches": ["consultor", "energía"], "count": 2 },
      "status": "new",
      "is_valid": true,
      "is_duplicate": false,
      "search_id": "uuid",
      "created_at": "2026-03-20T10:01:00Z"
    }
  ],
  "total": 87,
  "page": 1,
  "page_size": 50
}
```

---

## PATCH /api/contacts?id=uuid

Actualiza status o notas de un contacto.

**Body:**
```json
{
  "status": "contacted",
  "contact_notes": "Llamé el 20/03, interesado"
}
```
> Status opciones: `new | contacted | converted | skipped | bounced`
> Al poner `contacted` → graba `contacted_at` automáticamente.

**Respuesta 200:** `{ "success": true }`

---

## GET /api/searches

Lista todas las búsquedas.

**Query params:**
```
?status=completed    → pending | running | completed | failed
?limit=20            → default: 20, max: 50
```

**Respuesta 200:**
```json
{
  "searches": [
    {
      "id": "uuid",
      "name": "energy_spain_v1",
      "status": "completed",
      "total_contacts_created": 12,
      "total_results_google": 25,
      "created_at": "2026-03-20T10:00:00Z",
      "filters": { "sector": "energía", "years_min": 5, "keywords": ["..."] }
    }
  ],
  "total": 3
}
```

---

## Tipos TypeScript compartidos

```typescript
import type { SearchFilters, ContactRecord, SearchRecord } from '@/types'
// Archivo: src/types/index.ts
```

---

## Flujo típico (Frontend)

```
1. POST /api/search           → Obtener search_id
2. GET /api/status?search_id  → Polling cada 5s hasta status !== "running"
3. GET /api/contacts?search_id → Mostrar tabla de resultados
4. PATCH /api/contacts?id     → Actualizar status al prospectar
```