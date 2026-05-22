# LinkedIn Scraper — Message Generator

Transforma búsquedas de LinkedIn en mensajes de outreach personalizados con IA.

## Stack

- **Next.js 15** + TypeScript + Tailwind CSS
- **Supabase** PostgreSQL (auth + datos)
- **OpenAI** gpt-4o-mini (generación de mensajes)

## Quick Start

```bash
npm install
cp .env.example .env.local   # configurar variables
npm run dev                   # http://localhost:3000
```

## Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
SEARCH_API_KEY=...
NEXT_PUBLIC_SEARCH_API_KEY=...
```

## Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page |
| `/login` | Auth (signin / signup) |
| `/dashboard` | Dashboard principal |
| `/dashboard/messages` | Ver todos los mensajes generados |
| `/dashboard/searches` | Gestionar búsquedas |
| `/dashboard/users` | Gestión de usuarios (solo admin) |

## API Endpoints

### Auth
- `POST /api/auth/signup` — registro → `status='pending_approval'`
- `POST /api/auth/signin` — login (requiere `status='approved'`)
- `POST /api/auth/logout`

### Admin
- `GET /api/admin/pending-users`
- `POST /api/admin/approve-user/[id]`
- `POST /api/admin/reject-user/[id]`

### Message Generator
- `GET /api/searches` — listar búsquedas
- `GET /api/batches` — listar lotes de mensajes
- `GET /api/drafts` — todos los mensajes generados (estable, 666+ records)
- `POST /api/generate-messages` — generar mensajes con IA

## /api/drafts — Endpoint estable (v4, 22 mayo 2026)

```
GET /api/drafts
```

- Devuelve **TODOS** los mensajes de `message_drafts` sin filtros
- Join automático con `leads` para nombre, LinkedIn URL y empresa
- Respuesta siempre JSON válido: `{ drafts: [...] }`
- En caso de error devuelve `{ drafts: [] }` (nunca HTML)
- Commit estable: `69d7a7a`

```json
{
  "drafts": [
    {
      "id": "uuid",
      "lead_name": "Joan-Baptista Pont Pons",
      "lead_linkedin_url": "https://linkedin.com/in/...",
      "lead_company": "PONT consultori",
      "sequence": 1,
      "draft_text": "Hola Joan-Baptista..."
    }
  ]
}
```

## Arquitectura de datos

```
searches → leads → message_drafts
                       ↕
                 message_batches
```

## Estado del proyecto

| Módulo | Estado |
|--------|--------|
| V1-V2 Message Generator | Completo |
| V3 Auth System | Completo |
| V3 Admin Dashboard | Completo |
| V3 User Management | Completo |
| V4 /api/drafts fix | Estable |
| E2E Tests | Pendiente |

## Roles de desarrollo

- **Claude Code** — Backend (API routes, DB, auth, lógica)
- **Gemini CLI** — Frontend (componentes, UI/UX)
- **Codex** — Testing (e2e, integración, seguridad)
