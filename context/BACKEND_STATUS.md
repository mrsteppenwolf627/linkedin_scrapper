# BACKEND STATUS - LinkedIn Scraper V1

> Actualizado por: Claude Code (Backend Architect)
> Última actualización: 2026-03-20

---

## Estado General: ✅ BACKEND COMPLETO

Todas las tareas del backend están implementadas y listas para conectar con el frontend.

---

## Tareas Completadas

### ✅ Tarea 1: Setup + Supabase (COMPLETA)
- `package.json` con todas las dependencias
- `tsconfig.json` + `next.config.mjs`
- `.env.example` con todas las variables documentadas
- `.gitignore` configurado
- `src/lib/supabase.ts` — Cliente Supabase (server + browser)
- `src/types/index.ts` — Tipos TypeScript compartidos

**Acción requerida por el equipo:** Crear proyecto en Supabase y ejecutar el schema SQL en `documentación/aitor_linkedin_scraper_03_schema.sql`

### ✅ Tarea 2: Google Search API (COMPLETA)
- `src/lib/google_search.ts`
  - `searchGoogle(query, maxResults)` — Llama Serper.dev
  - `filterLinkedInProfiles(results)` — Filtra solo linkedin.com/in/
  - `normalizeLinkedInUrl(url)` — Normaliza para dedup

### ✅ Tarea 3: 4 Prompts Claude (COMPLETA)
- `src/lib/claude_prompts.ts`
  - `parseLinkedInSnippet(snippet, url)` — Extrae datos del snippet
  - `validateContact(contact, filters)` — Valida contra criterios de búsqueda
  - `checkDuplicateWithClaude(new, existing)` — Dedup fuzzy con IA
  - `generateGoogleQuery(filters)` — Genera query Google optimizada
- Modelo: `gpt-4o-mini` (OpenAI) — usa `response_format: json_object` para JSON garantizado
- ⚠️ Variable de entorno: `OPENAI_API_KEY` (no Anthropic)

### ✅ Tarea 4: Orquestador Core (COMPLETA)
- `src/lib/linkedin_scraper.ts`
  - `executeLinkedInSearch(name, query, filters, maxResults)`
  - Flujo completo: Google → Parse → Validate → Dedup → Save → Stats
  - Dedup en 4 niveles: URL normalizada → URL raw → Email → Claude fuzzy
  - Manejo de errores + actualización de status en BD

### ✅ Tarea 5: API Endpoints (COMPLETA)
Ver `API_SPEC.md` para documentación completa.

- `src/app/api/search/route.ts` — POST /api/search
- `src/app/api/contacts/route.ts` — GET /api/contacts + PATCH /api/contacts
- `src/app/api/searches/route.ts` — GET /api/searches
- `src/app/api/status/route.ts` — GET /api/status

### ✅ Tarea 6: Testing (COMPLETA)
- `scripts/test_search.ts` — Script de prueba con tests unitarios
  - `npm run test:search --mock` → Test rápido sin consumir Google API
  - `npm run test:search --all` → Test completo con APIs reales

---

## Estructura de Archivos Backend

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (placeholder para frontend)
│   └── api/
│       ├── search/route.ts      ← POST /api/search
│       ├── contacts/route.ts    ← GET, PATCH /api/contacts
│       ├── searches/route.ts    ← GET /api/searches
│       └── status/route.ts      ← GET /api/status
├── lib/
│   ├── supabase.ts              ← Clientes Supabase
│   ├── google_search.ts         ← Serper.dev integration
│   ├── claude_prompts.ts        ← 4 prompts Claude
│   └── linkedin_scraper.ts      ← Core orchestrator
└── types/
    └── index.ts                 ← Tipos compartidos TypeScript
```

---

## Variables de Entorno Necesarias

Copiar `.env.example` a `.env.local` y rellenar:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
SERPER_API_KEY=
SEARCH_API_KEY=          ← Header requerido: x-api-key
```

---

## Notas para Frontend (Gemini CLI)

1. **Auth:** Todos los endpoints usan header `x-api-key` con el valor de `SEARCH_API_KEY`
2. **Polling:** Para saber si una búsqueda terminó, llamar `GET /api/status?search_id=xxx` cada 5s
3. **Paginación:** `GET /api/contacts` acepta `page` y `page_size` (max 100)
4. **CORS:** No configurado aún. Si el frontend es externo, ver `REQUESTS.md`
5. **Client Supabase:** Para datos en tiempo real, usar `createBrowserClient()` de `src/lib/supabase.ts`
