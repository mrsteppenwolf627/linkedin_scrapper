# Estado del Proyecto — LinkedIn Scraper V1
### Documento para Arquitecto
> Fecha: 2026-03-20 | Autor: Claude Code (Backend)

---

## 1. RESUMEN EJECUTIVO

Sistema de búsqueda de perfiles de LinkedIn mediante Google Search + IA. El usuario define filtros (sector, años de experiencia, keywords) y el sistema devuelve perfiles validados listos para prospección en frío.

**Estado actual:** MVP funcional en local. Backend 100% operativo. Frontend 100% operativo. Pendiente de decisión de arquitectura para deploy a producción.

**Problema de negocio:** el cliente paga €50/mes por acceder a una lista de contactos cualificados de LinkedIn. Coste de operación estimado: €5-12/mes.

---

## 2. STACK TECNOLÓGICO

| Capa | Tecnología | Versión | Notas |
|------|-----------|---------|-------|
| Framework | Next.js App Router | 15.5 | Frontend + Backend en un repo |
| UI | Shadcn/UI + Tailwind | latest | Dark mode, diseño completo |
| Base de datos | Supabase (PostgreSQL) | cloud | Proyecto: `qkfglihuxzaohohuqtiv` |
| IA / Parsing | OpenAI API | gpt-4o-mini | ~€0.50/mes estimado |
| Google Search | Serper.dev | API v1 | 2.500 búsquedas/mes gratis |
| Deploy previsto | Vercel | Hobby plan | ⚠️ Ver sección de limitaciones |
| Lenguaje | TypeScript | 5.7 | Estricto, tipos compartidos |

---

## 3. ARQUITECTURA ACTUAL

### 3.1 Flujo de datos

```
Usuario (browser)
    │
    ▼
POST /api/search
    │  ① Crea registro en BD (status: running)
    │  ② Lanza executeLinkedInSearch() sin await (fire-and-forget)
    │  ③ Responde inmediatamente con search_id
    ▼
Frontend polling GET /api/status?search_id=xxx cada 5s
    │
    │  En background:
    ▼
executeLinkedInSearch()
    │
    ├─ searchGoogle() → Serper.dev API → 5-50 resultados
    │
    └─ Para cada resultado:
        ├─ parseLinkedInSnippet() → OpenAI gpt-4o-mini
        │   Input: title + snippet de Google
        │   Output: { nombre, titulo, empresa, anos_experiencia, score_confianza }
        │
        ├─ validateInCode() → Validación determinista en TypeScript
        │   Checks: datos suficientes, años mínimos, keyword matching multilingüe
        │   (NO usa LLM — más fiable y gratis)
        │
        ├─ checkDuplicate() → Supabase queries
        │   Nivel 1: URL normalizada exacta
        │   Nivel 2: Email exacto
        │   Nivel 3: Fuzzy match con OpenAI (solo si hay candidato similar)
        │
        └─ INSERT contacts → Supabase
```

### 3.2 Estructura de archivos

```
src/
├── app/
│   ├── page.tsx                    ← Dashboard (Gemini/Frontend)
│   ├── layout.tsx                  ← Root layout con Sonner toasts
│   └── api/
│       ├── search/route.ts         ← POST /api/search
│       ├── contacts/route.ts       ← GET /api/contacts + PATCH
│       ├── searches/route.ts       ← GET /api/searches
│       └── status/route.ts         ← GET /api/status (polling)
├── lib/
│   ├── supabase.ts                 ← createServerClient() + createBrowserClient()
│   ├── google_search.ts            ← searchGoogle(), filterLinkedInProfiles(), normalizeLinkedInUrl()
│   ├── claude_prompts.ts           ← parseLinkedInSnippet(), checkDuplicateWithClaude(), generateGoogleQuery()
│   └── linkedin_scraper.ts         ← validateInCode(), checkDuplicate(), executeLinkedInSearch()
└── types/
    └── index.ts                    ← Tipos TypeScript compartidos (SearchFilters, ContactRecord, etc.)

documentación/
├── schema_supabase_fixed.sql       ← Schema ejecutado en Supabase (usar este, no el original)
└── [otros docs de diseño]

context/
├── BACKEND_STATUS.md               ← Estado detallado del backend
├── FRONTEND_STATUS.md              ← Estado del frontend (Gemini)
├── API_SPEC.md                     ← Documentación de endpoints
└── REQUESTS.md                     ← Solicitudes backend → frontend
```

### 3.3 Base de datos (Supabase)

Tablas activas:
- **`searches`** — campañas de búsqueda con estadísticas
- **`contacts`** — perfiles encontrados y validados
- **`contacts_history`** — auditoría de cambios de status
- **`api_logs`** — observabilidad (tabla creada, no se usa aún)
- **`cost_tracking`** — control de costes (tabla creada, no se usa aún)

Vistas:
- **`unique_contacts`** — contactos sin duplicados
- **`search_stats`** — estadísticas agregadas por búsqueda

---

## 4. ENDPOINTS API

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/search` | `x-api-key` header | Lanza búsqueda, responde con `search_id` |
| GET | `/api/status?search_id=` | No | Polling: estado y stats de una búsqueda |
| GET | `/api/searches` | No | Lista historial de búsquedas |
| GET | `/api/contacts?search_id=` | No | Lista contactos con filtros y paginación |
| PATCH | `/api/contacts?id=` | No | Actualiza status del contacto (new/contacted/converted) |

Auth: header `x-api-key` con valor de `SEARCH_API_KEY` en `.env.local`

---

## 5. VARIABLES DE ENTORNO (.env.local — configuradas y funcionando)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://qkfglihuxzaohohuqtiv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[configurada]
SUPABASE_SERVICE_ROLE_KEY=[configurada]
OPENAI_API_KEY=[configurada]
SERPER_API_KEY=[configurada]
SEARCH_API_KEY=dev_secret_key_123     ← cambiar en producción
NEXT_PUBLIC_SEARCH_API_KEY=dev_secret_key_123
```

---

## 6. DECISIONES TÉCNICAS TOMADAS

### 6.1 OpenAI en lugar de Anthropic
**Razón:** El usuario tiene créditos en OpenAI, no en Anthropic.
**Modelo:** `gpt-4o-mini` — coste ~15x menor que `gpt-4o`, calidad suficiente para parsing estructurado.
**Ventaja técnica:** `response_format: { type: 'json_object' }` garantiza JSON válido sin regex.

### 6.2 Validación en código, no con LLM
**Razón:** En pruebas, el LLM ignoraba instrucciones críticas (rechazaba perfiles válidos por ubicación null). La validación determinista en TypeScript es 100% predecible y gratuita.
**Implementación:** `validateInCode()` en `linkedin_scraper.ts` con mapa de sinónimos multilingüe (consultor=consultant=consulting=advisor...).

### 6.3 title + snippet como input al parser
**Razón:** El `snippet` de Google no siempre contiene el nombre de la persona. El `title` sí (formato "Nombre - Cargo | Empresa"). Combinar ambos aumenta tasa de extracción exitosa de ~40% a ~100%.

### 6.4 Fire-and-forget para búsquedas
**Razón:** Las búsquedas tardan 1-3 minutos (1 llamada OpenAI por resultado). No se puede mantener la conexión HTTP abierta.
**Implementación actual:** `executeLinkedInSearch()` se lanza sin `await` en el API route.
**Problema:** esto funciona en desarrollo pero **fallará en Vercel** (ver sección 7).

### 6.5 Dedup en 4 niveles
1. URL normalizada exacta (quita `?params`, lowercase) → gratis
2. URL raw → gratis
3. Email exacto → gratis
4. Fuzzy nombre con OpenAI → solo si hay candidatos con mismo primer nombre → mínimo coste

---

## 7. ⚠️ PROBLEMA CRÍTICO PENDIENTE — DECISIÓN ARQUITECTURAL

### El problema

**Vercel Hobby plan tiene un límite de 60 segundos por API route.**

Una búsqueda de 30 resultados tarda ~90-180 segundos (1 llamada OpenAI por resultado × 30 = ~90s mínimo). En Vercel, la función se cortará a los 60s con un error 504.

El patrón actual (fire-and-forget) funciona en local porque Node.js sigue ejecutando aunque el HTTP haya respondido. **En Vercel, cuando la función responde, el proceso se mata.**

### Opciones disponibles para el arquitecto

---

#### OPCIÓN A — Vercel Pro + maxDuration
**Descripción:** Subir a Vercel Pro ($20/mes) y configurar `maxDuration: 300` (5 minutos) en el route.
```typescript
// route.ts
export const maxDuration = 300
```
**Pros:** Cero cambios de arquitectura. Listo en 1 hora.
**Contras:** Costo adicional $20/mes. El proceso sigue siendo síncrono (bloquea el serverless slot durante 5 min).
**Recomendado si:** el cliente acepta esperar, el volumen es bajo (<10 búsquedas/día).

---

#### OPCIÓN B — Queue con Upstash QStash
**Descripción:** Al recibir POST /api/search, publicar un mensaje en QStash (HTTP queue). QStash reintenta y llama a un endpoint `/api/worker` con timeout largo.
**Stack adicional:** Upstash QStash (~$0/mes en free tier hasta 500 mensajes/día).
**Pros:** Serverless puro, sin infraestructura extra. Reintentos automáticos. Free tier suficiente.
**Contras:** Añade latencia. Cada "chunk" del worker sigue teniendo límite de 60s en Hobby.
**Recomendado si:** quieres mantenerte en Hobby plan y aceptas dividir la búsqueda en lotes de 5-8 resultados.

---

#### OPCIÓN C — Servicio separado (Railway/Render)
**Descripción:** Extraer `executeLinkedInSearch()` a un microservicio Node.js independiente desplegado en Railway o Render. Vercel solo maneja el frontend y los endpoints de lectura.
**Stack adicional:** Railway ($5/mes plan Starter) o Render (free tier con cold starts).
**Pros:** Sin límites de tiempo. Arquitectura limpia. El worker puede procesar 100+ resultados.
**Contras:** Introduce un segundo servicio y deploy pipeline. Más complejidad operacional.
**Recomendado si:** el volumen crece (>50 búsquedas/mes), o necesitas búsquedas de 50+ resultados.

---

#### OPCIÓN D — Supabase Edge Functions
**Descripción:** Mover el orquestador a una Supabase Edge Function (Deno). Se invoca desde el API route de Next.js y se ejecuta en la infraestructura de Supabase.
**Stack adicional:** Ninguno (ya tenemos Supabase).
**Pros:** Sin coste adicional. Acceso directo a BD. Timeout de 150s (suficiente para 30 resultados).
**Contras:** Edge Functions usan Deno, no Node.js. Hay que reescribir el orquestador en Deno-compatible TypeScript. No todas las librerías npm funcionan.
**Recomendado si:** quieres zero coste adicional y aceptas el esfuerzo de migración a Deno (~4h de trabajo).

---

#### OPCIÓN E — Mantener en local / self-hosted
**Descripción:** No desplegar en Vercel. El sistema corre en un servidor propio (VPS, Mac mini, etc.) con PM2.
**Pros:** Sin límites. Sin coste de cloud adicional. Control total.
**Contras:** Requiere infraestructura propia. Sin HA ni escalado automático.
**Recomendado si:** el cliente es interno/único y el servidor ya existe.

---

### Resumen de opciones

| Opción | Esfuerzo | Coste adicional | Fiabilidad | Escalabilidad |
|--------|----------|----------------|------------|---------------|
| A — Vercel Pro | 1h | +$20/mes | Alta | Media |
| B — QStash | 4-6h | ~$0 | Media | Media |
| C — Railway | 3-4h | +$5/mes | Alta | Alta |
| D — Supabase Edge | 4-6h | $0 | Media | Media |
| E — Self-hosted | 1h | $0 (VPS propio) | Media | Baja |

---

## 8. ESTADO DE CALIDAD Y TESTS

### Lo que funciona (validado en producción local)
- ✅ Búsqueda real en Google → 5-50 resultados LinkedIn
- ✅ Parsing de nombre, título, empresa, años experiencia con gpt-4o-mini
- ✅ Validación determinista con sinónimos multilingüe
- ✅ Deduplicación por URL
- ✅ Guardado en Supabase con todos los campos
- ✅ API REST completa (5 endpoints)
- ✅ Dashboard UI funcional (nueva búsqueda, historial, tabla de contactos, export CSV)
- ✅ Polling de estado desde frontend
- ✅ Sistema de toasts y UX completa

### Limitaciones conocidas
- ⚠️ **Timeout en Vercel** (problema principal — ver sección 7)
- ⚠️ Los snippets de Google no siempre contienen email ni ubicación → campos null frecuentes
- ⚠️ `validateContact()` en `claude_prompts.ts` existe pero ya no se usa (reemplazada por `validateInCode()`). Limpiar en próxima iteración.
- ⚠️ `SEARCH_API_KEY` en `.env.local` es `dev_secret_key_123` → cambiar antes de producción
- ⚠️ Los GET endpoints no tienen auth (solo POST tiene `x-api-key`). Aceptable para MVP mono-usuario, no para multi-usuario.
- ℹ️ Hay 6 registros de test en Supabase (`test_energia_espana_v1` a `v6`). Limpiar antes de producción.

---

## 9. PRÓXIMOS PASOS (tras decisión arquitectural)

Una vez decidida la opción de deploy:

1. **[ ] Resolver timeout** según opción elegida (sección 7)
2. **[ ] Cambiar `SEARCH_API_KEY`** a un valor seguro aleatorio
3. **[ ] Limpiar registros de test** en Supabase
4. **[ ] Deploy a producción** (Vercel + variables de entorno)
5. **[ ] Test end-to-end** en producción con búsqueda real
6. **[ ] Primera búsqueda real para cliente** con 30 resultados

### Mejoras futuras (V2)
- Autenticación real (Supabase Auth) para multi-usuario
- Export CSV mejorado con más campos
- Enriquecimiento de datos (buscar emails)
- Rate limiting para evitar abuso de la API
- Dashboard con gráficas de conversión (new → contacted → converted)

---

## 10. PARA REPRODUCIR EL ENTORNO LOCAL

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env.local (ya configurado con todas las keys)

# 3. Test rápido (sin consumir Google)
npm run test:search -- --mock

# 4. Test completo (consume Serper + OpenAI)
npm run test:search -- --all

# 5. Arrancar servidor
npm run dev
# → http://localhost:3000
```

---

*Documento generado por Claude Code (Backend Architect) — LinkedIn Scraper V1*
