# PLAN DE IMPLEMENTACIÓN - LinkedIn Scraper V1

Documento que detalla cómo pasar del diseño a producción, siguiendo la metodología de Aitor.

---

## FASE 0: SETUP INICIAL (Día 1-2)

### 0.1 Infraestructura Base

#### Crear proyecto Next.js
```bash
npx create-next-app@latest linkedin_scraper --typescript --tailwind --shadcn-ui
cd linkedin_scraper
```

#### Instalar dependencias
```bash
npm install \
  @anthropic-sdk/sdk \
  @supabase/supabase-js \
  @supabase/auth-helpers-nextjs \
  zustand \
  lucide-react \
  date-fns

# Opcional: para queue system
npm install bull redis
```

#### Estructura de carpetas
```
linkedin_scraper/
├── app/
│   ├── page.tsx (dashboard)
│   ├── api/
│   │   ├── search.ts
│   │   ├── contacts.ts
│   │   ├── searches.ts
│   │   └── status.ts
│   └── layout.tsx
├── backend/
│   └── lib/
│       ├── linkedin_scraper.ts (CORE)
│       ├── supabase_client.ts
│       └── claude_api.ts
├── components/
│   └── ui/ (shadcn components)
├── public/
└── .env.example
```

### 0.2 Configurar Supabase

#### Crear proyecto en Supabase
1. Ir a supabase.com
2. Crear nuevo proyecto (nombre: `aitor_linkedin_scraper`)
3. Copiar URL y anon key a `.env.local`

#### Ejecutar schema SQL
```bash
# En Supabase SQL editor, copiar y ejecutar:
cat aitor_linkedin_scraper_03_schema.sql
```

#### Verificar tablas
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### 0.3 Configurar APIs externas

#### Google Search (Serper.dev)
1. Crear cuenta en serper.dev
2. Obtener API key
3. Copiar a `.env.local`: `SERPER_API_KEY=...`

#### Anthropic (Claude)
1. Ir a console.anthropic.com
2. Crear API key
3. Copiar a `.env.local`: `ANTHROPIC_API_KEY=...`

#### .env.example
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxx...

# APIs
ANTHROPIC_API_KEY=sk-ant-...
SERPER_API_KEY=...

# Auth
SEARCH_API_KEY=your_secret_key_here
NEXT_PUBLIC_SEARCH_API_KEY=your_public_key

# Deploy
VERCEL_URL=localhost:3000
```

### 0.4 Git y versionado

```bash
# Inicializar git
git init
git add .
git commit -m "chore: initial setup"

# Crear repo en GitHub
# ... (manual en github.com)

git remote add origin https://github.com/aitoralmu/linkedin_scraper.git
git branch -M main
git push -u origin main
```

**Checkpoint 0:** ✅ Todo configurado, proyecto corre en local

---

## FASE 1: BACKEND CORE (Día 2-3)

### 1.1 Implementar función Google Search

**Archivo:** `backend/lib/google_search.ts`

```typescript
// Basado en linkedin_scraper_core.ts
// Función: searchGoogle()
// Input: query string
// Output: GoogleSearchResult[]
```

**Testing manual:**
```bash
# En browser console o Insomnia:
POST http://localhost:3000/api/search
Headers: x-api-key: test
Body: {
  "search_name": "test_1",
  "google_query": "site:linkedin.com/in consultant engineer",
  "filters": {
    "sector": "tech",
    "years_min": 5,
    "keywords": ["engineer", "software"]
  }
}
```

### 1.2 Implementar prompts de Claude

**Archivo:** `backend/lib/claude_prompts.ts`

Crear 4 funciones:
- `parseLinkedInSnippet()` - extrae datos
- `validateContact()` - valida contra filtros
- `checkDuplicate()` - detecta duplicados
- `generateGoogleQuery()` - genera query optimizada

**Testing:**
```javascript
// Unit tests para cada función
const snippet = "John Doe - Senior Engineer at Google, 8 years...";
const parsed = await parseLinkedInSnippet(snippet, "url");
console.assert(parsed.nombre === "John Doe");
console.assert(parsed.anos_experiencia === 8);
```

### 1.3 Implementar orquestador principal

**Archivo:** `backend/lib/linkedin_scraper.ts`

Función principal: `executeLinkedInSearch()`

Flujo:
1. Buscar en Google
2. Para cada resultado:
   - Parsear con Claude
   - Validar con Claude
   - Chequear duplicados
   - Guardar en BD
3. Actualizar estadísticas

**Testing:**
```bash
npm run test:backend
# O ejecutar manualmente en dev
node scripts/test_search.js
```

### 1.4 Crear endpoints API

**Archivos:**
- `app/api/search.ts` - POST /api/search (disparar búsqueda)
- `app/api/contacts.ts` - GET /api/contacts (obtener resultados)
- `app/api/searches.ts` - GET /api/searches (listar búsquedas)
- `app/api/status.ts` - GET /api/status?search_id=... (estado)

**Testing Insomnia/Postman:**
```
POST /api/search
x-api-key: test
{
  "search_name": "energy_consultants",
  "google_query": "site:linkedin.com/in consultant energía",
  "filters": {...}
}

→ Responde: { search_id: "uuid", status: "queued" }
```

**Checkpoint 1:** ✅ Backend funciona, busca en Google, parsea con Claude, guarda en BD

---

## FASE 2: FRONTEND (Día 3-4)

### 2.1 Dashboard principal

**Archivo:** `app/page.tsx` (basado en `dashboard_frontend.tsx`)

Componentes:
- Tabs: "Nueva Búsqueda" vs "Historial"
- Form para crear búsquedas
- Tabla de búsquedas anteriores
- Tabla de contactos

### 2.2 Componentes UI

```
components/
├── SearchForm.tsx - Formulario de búsqueda
├── SearchHistory.tsx - Tabla de búsquedas
├── ContactsTable.tsx - Tabla de contactos
├── StatusBadge.tsx - Badge de estado
└── ExportButton.tsx - Botón descargar CSV
```

### 2.3 Estilos

Usar Tailwind + Shadcn/UI (ya instalado)

Color scheme:
```
- Fondo: slate-900 (oscuro)
- Cards: slate-800
- Text: slate-200
- Accents: blue-600, green-600
```

### 2.4 Testing

```bash
npm run dev
# Ir a http://localhost:3000
# 1. Crear búsqueda
# 2. Ver que aparece en historial
# 3. Descargar CSV
```

**Checkpoint 2:** ✅ Frontend funciona, puedes crear búsquedas y ver resultados

---

## FASE 3: TESTING Y VALIDACIÓN (Día 4-5)

### 3.1 Test cases documentados

**Archivo:** `05_testing/test_cases.md`

Casos de prueba:

| Caso | Input | Expected | Status |
|------|-------|----------|--------|
| Búsqueda válida | Query + filtros válidos | 10+ resultados | ✅ |
| Query sin resultados | Query inexistente | 0 resultados | ✅ |
| Duplicados | 2 búsquedas iguales | Solo uno guardado | ✅ |
| Inválidos | Perfil sin años exp | Rechazado | ✅ |
| CSV export | 5 contactos | CSV con 5 rows | ✅ |

### 3.2 Performance

- Tiempo de búsqueda Google: < 5s
- Parsing Claude: < 2s por contacto
- Insert BD: < 1s por contacto
- Total para 30 resultados: < 3min

### 3.3 Validación de datos

Chequear en BD:
```sql
-- ¿Hay duplicados?
SELECT linkedin_url, COUNT(*) as count
FROM contacts
GROUP BY linkedin_url
HAVING count > 1;

-- ¿Score de confianza válido?
SELECT * FROM contacts WHERE confidence_score < 0 OR confidence_score > 1;

-- ¿Años de experiencia válidos?
SELECT * FROM contacts WHERE years_experience < 0;
```

**Checkpoint 3:** ✅ Sistema probado, datos válidos, listo para producción

---

## FASE 4: DEPLOYMENT A PRODUCCIÓN (Día 5)

### 4.1 Vercel

```bash
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Vercel pide confirmaciones, acepta defaults
```

### 4.2 Variables de entorno en Vercel

En https://vercel.com/dashboard/xxx/settings/environment-variables

Copiar de `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
SERPER_API_KEY
SEARCH_API_KEY
```

### 4.3 Testing en producción

```
https://linkedin-scraper.vercel.app
```

1. Crear búsqueda
2. Verificar en Supabase Dashboard que se guardó
3. Descargar CSV
4. Ver logs en Vercel

### 4.4 Documentación

**Archivo:** `06_entregables/README.md`

```markdown
# LinkedIn Lead Scraper

## Instalación local

1. Clone repo
2. npm install
3. Copy .env.example to .env.local
4. npm run dev

## Uso

1. Dashboard: http://localhost:3000
2. Crear búsqueda con filtros
3. Esperar a que complete
4. Descargar CSV

## API

POST /api/search
GET /api/contacts
GET /api/searches

## Troubleshooting

### Error: "SERPER_API_KEY not found"
→ Añadir a .env.local

### Error: "Supabase connection failed"
→ Verificar URL y API key en .env.local
```

**Checkpoint 4:** ✅ Sistema en producción, funcional, documentado

---

## FASE 5: OPTIMIZACIONES Y MEJORAS (Semana 2+)

### 5.1 Mejoras Quick Wins

- [ ] Agregar filtro por ubicación en form
- [ ] Permitir descargar resultados parciales
- [ ] Agregar búsqueda por empresa
- [ ] Exportar con más campos (email, headline, etc)

### 5.2 Mejoras Medium

- [ ] Sistema de cola (Bull/Redis) para búsquedas paralelas
- [ ] WebSockets para actualización en tiempo real
- [ ] Rate limiting para APIs
- [ ] Caché de resultados

### 5.3 Mejoras Large

- [ ] Multi-user con autenticación
- [ ] Equipos y compartir búsquedas
- [ ] Integración con herramienta de CRM
- [ ] Enriquecimiento de datos (emails, teléfonos)

---

## CHECKLIST FINAL

Antes de declarar "listo para cliente":

- [ ] Setup completado (Supabase, APIs, .env)
- [ ] Backend funciona (Google + Claude + BD)
- [ ] Frontend funciona (crear búsquedas, ver resultados)
- [ ] Testing completado (casos de prueba validados)
- [ ] Desplegado a Vercel
- [ ] Documentación lista (README, API, troubleshooting)
- [ ] Presupuesto entregado al cliente
- [ ] Google Sheets de control actualizado

---

## TIMELINE REALISTA

```
Día 1: Setup (2-3h)
Día 2: Backend (4-5h)
Día 3: Backend + Frontend (6-7h)
Día 4: Frontend + Testing (5-6h)
Día 5: Testing + Deploy (3-4h)

TOTAL: 20-25 horas (~3 días de trabajo intenso)
```

---

## COSTES ESTIMADOS (Mensual)

| Servicio | Uso | Coste |
|----------|-----|-------|
| Google Search (Serper) | 100 queries/mes | $0 (free tier) |
| Claude API | 1000 parses | ~€1-2 |
| Supabase | 500GB storage | €5-10 |
| Vercel | Hosting | €0 (hobby) |
| **Total** | | **€5-12/mes** |

Para cliente: proponer €50/mes (margen de 4-10x)

---

## Próximos pasos

1. ✅ Decidir si empezar
2. ⏳ Confirmar timeline con cliente
3. ⏳ Setup de infraestructura
4. ⏳ Desarrollo iterativo (1-2 sprints)
5. ⏳ Deploy
6. ⏳ Entrega al cliente
