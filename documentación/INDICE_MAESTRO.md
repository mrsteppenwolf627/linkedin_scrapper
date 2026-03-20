# 📋 LINKEDIN SCRAPER V1 - ÍNDICE MAESTRO

**Proyecto:** LinkedIn Lead Scraper (Google Search)  
**Propietario:** Aitor Alarcón Muñoz  
**Versión:** V1  
**Fecha creación:** [HOY]  
**Estado:** Diseño → Listo para implementar  

---

## 🎯 PARA EMPEZAR

### Si acabas de llegar a esto:
1. Lee: **BRIEF** (`aitor_linkedin_scraper_V1_brief.md`)
2. Entiende: **ARQUITECTURA** (sección abajo)
3. Mira: **PLAN DE IMPLEMENTACIÓN** paso a paso

### Si vas a empezar desarrollo:
1. Sigue: **PLAN DE IMPLEMENTACIÓN** (`aitor_linkedin_scraper_plan_implementacion.md`)
2. Copia: **ESTRUCTURA DE CARPETAS** (`estructura_proyecto.txt`)
3. Usa: **PROMPTS** (`aitor_linkedin_scraper_02_prompts.md`)
4. Setup: **SCHEMA SQL** (`aitor_linkedin_scraper_03_schema.sql`)

---

## 📁 ÍNDICE POR TIPO DE DOCUMENTO

### 📘 PLANIFICACIÓN

| Documento | Qué es | Usar cuando |
|-----------|--------|-----------|
| `aitor_linkedin_scraper_V1_brief.md` | Problema, objetivo, alcance, riesgos | Necesitas entender el proyecto |
| `aitor_linkedin_scraper_plan_implementacion.md` | Roadmap fase a fase, con tareas | Vas a implementar |
| `aitor_linkedin_scraper_propuesta_cliente.md` | Qué entregar, cómo funciona, valor | Hablas con el cliente |
| `estructura_proyecto.txt` | Carpetas y archivos necesarios | Creas el proyecto |

### 💻 CÓDIGO BACKEND

| Documento | Qué es | Usar cuando |
|-----------|--------|-----------|
| `linkedin_scraper_core.ts` | Orquestador principal (ejecutar búsqueda) | Implementas backend |
| `api_search_endpoint.ts` | Endpoint POST /api/search | Creas la API |
| `aitor_linkedin_scraper_03_schema.sql` | Schema Supabase completo | Setup BD |

### 🎨 CÓDIGO FRONTEND

| Documento | Qué es | Usar cuando |
|-----------|--------|-----------|
| `dashboard_frontend.tsx` | Dashboard principal completo | Implementas frontend |

### 🧠 INTELIGENCIA

| Documento | Qué es | Usar cuando |
|-----------|--------|-----------|
| `aitor_linkedin_scraper_02_prompts.md` | 4 prompts de Claude con instrucciones | Necesitas parsear/validar datos |

### 📊 TRACKING

| Documento | Qué es | Usar cuando |
|-----------|--------|-----------|
| `aitor_linkedin_scraper_google_sheets_template.md` | Template Google Sheets para project management | Quieres trackear el proyecto |

---

## 🏗️ ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js + Shadcn/UI)                          │
│ - Dashboard: crear búsquedas, ver resultados            │
│ - Tabla de contactos + CSV export                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ API (Next.js API Routes)                                │
│ - POST /api/search → ejecutar búsqueda                  │
│ - GET /api/contacts → obtener resultados                │
│ - GET /api/searches → listar búsquedas                  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ BACKEND CORE (Node.js)                                  │
│ - Google Search (Serper.dev API)                        │
│ - Claude Parsing (4 prompts)                            │
│ - Deduplicación                                         │
│ - Orquestador principal                                 │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ DATOS (Supabase PostgreSQL)                             │
│ - searches (campañas)                                   │
│ - contacts (perfiles encontrados)                       │
│ - contacts_history (auditoría)                          │
│ - cost_tracking (control de gastos)                     │
└─────────────────────────────────────────────────────────┘
```

### Flujo de datos

```
Usuario:
  1. Define filtros (sector, años, keywords)
  2. Presiona "Buscar"
       ↓
Backend:
  1. Genera query de Google optimizada
  2. Busca en Google (Serper API)
  3. Para cada resultado:
     - Claude parsea el snippet
     - Claude valida contra filtros
     - Chequea duplicados en BD
     - Guarda si es válido
  4. Actualiza estadísticas
       ↓
Frontend:
  1. Tabla con contactos encontrados
  2. Puedes descargar CSV
  3. Abrir LinkedIn de cada uno
```

---

## 🔄 FLUJO DE TRABAJO RECOMENDADO

### Primer día (Setup)

```
1. Leer BRIEF (30 min)
2. Crear repo GitHub (15 min)
3. Setup Next.js (30 min)
4. Supabase + schema (30 min)
5. APIs (Google, Claude, Serper) (45 min)
   → Checkpoint: proyecto corre en local
```

### Día 2-3 (Backend)

```
1. Google Search API (2h)
2. Prompts Claude (2h)
3. Orquestador (2h)
4. API endpoints (1.5h)
   → Checkpoint: backend funciona sin frontend
```

### Día 3-4 (Frontend)

```
1. Dashboard principal (2h)
2. Componentes UI (1h)
3. CSV export (0.5h)
4. Testing manual (2h)
   → Checkpoint: sistema completo en local
```

### Día 5 (Deploy)

```
1. Deploy a Vercel (30 min)
2. Variables de entorno (30 min)
3. Testing en producción (1h)
4. Documentación (1h)
   → Checkpoint: LISTO PARA CLIENTE
```

---

## 📝 DOCUMENTACIÓN GENERADA

Todos estos documentos ya están listos para usar:

- ✅ Brief del proyecto
- ✅ Plan de implementación
- ✅ Arquitectura y esquema DB
- ✅ 4 prompts críticos de Claude
- ✅ Código backend completo
- ✅ Código frontend completo
- ✅ Endpoint API
- ✅ Template Google Sheets
- ✅ Propuesta al cliente
- ✅ Este índice

---

## 🚀 CÓMO EMPEZAR DESDE AQUÍ

### OPCIÓN A: Implementación rápida (esta semana)

```
Lunes:   Setup + Backend
Martes:  Backend + Frontend
Miércoles: Testing + Deploy
         → LISTO PARA CLIENTE
```

**Comando para empezar:**
```bash
npx create-next-app@latest linkedin_scraper --typescript --tailwind
cd linkedin_scraper
# Copiar archivos del proyecto
# Seguir plan_implementacion.md paso a paso
```

### OPCIÓN B: Aprender y personalizar (próximas 2 semanas)

```
Semana 1: Entiende la arquitectura, haz cambios menores
Semana 2: Añade features (multi-user, mejor dedup, etc.)
```

### OPCIÓN C: Delegarlo (si no tienes tiempo)

```
1. Comparte estos documentos con tu dev
2. Dale acceso a Supabase y APIs
3. Él sigue plan_implementacion.md
4. Tú haces QA final
```

---

## ✅ CHECKLIST ANTES DE EMPEZAR

- [ ] Tengo Google Custom Search API key (o Serper.dev)
- [ ] Tengo Anthropic API key (Claude)
- [ ] Cuento con acceso a Supabase
- [ ] Tengo Vercel configurado
- [ ] He leído el BRIEF
- [ ] He entendido la ARQUITECTURA
- [ ] Tengo el PLAN DE IMPLEMENTACIÓN a mano
- [ ] He creado Google Sheet de tracking
- [ ] He comunicado timeline al cliente

---

## 🆘 SI TIENES DUDAS

### Pregunta: "¿Por dónde empiezo?"
→ Lee BRIEF → Plan de implementación → Día 1 del plan

### Pregunta: "¿Cuánto cuesta?"
→ Aitor_linkedin_scraper_plan_implementacion.md → "COSTES ESTIMADOS"

### Pregunta: "¿Cómo hago X?"
→ Busca en el plan de implementación o en los prompts

### Pregunta: "¿Qué hago si Claude falla?"
→ aitor_linkedin_scraper_02_prompts.md → ver instrucciones de fallback

### Pregunta: "¿Cómo lo enseño al cliente?"
→ aitor_linkedin_scraper_propuesta_cliente.md

---

## 📊 MÉTRICAS DEL PROYECTO

| Métrica | Valor |
|---------|-------|
| Tiempo de desarrollo estimado | 20-25 horas |
| Costo mensual (cliente) | €50 (margen: 4-10x) |
| Contactos por búsqueda | 20-50 |
| Tiempo por búsqueda | 3-5 minutos |
| Precisión esperada | 85-90% |

---

## 🔐 CREDENCIALES Y SECRETOS

⚠️ **NO GUARDES AQUÍ VALORES REALES**

Guardar en:
- `.env.local` (máquina local)
- Vercel Environment Variables (producción)
- Google Drive (backup, encriptado)

Necesitas:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
SERPER_API_KEY
SEARCH_API_KEY (tuya)
```

---

## 📚 REFERENCIAS EXTERNAS

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Anthropic API Reference](https://docs.anthropic.com)
- [Serper.dev API](https://serper.dev)

---

## 🎓 LECCIONES APRENDIDAS (EN PROGRESO)

A medida que avances, documenta en:
`aitor_linkedin_scraper_plan_implementacion.md → LECCIONES APRENDIDAS`

Ejemplos:
- Qué salió bien
- Qué fue más lento de lo esperado
- Qué cambiarías
- Nuevas ideas

---

## 🎉 FIN

**Este proyecto está 100% documentado y listo para implementar.**

Tienes:
- ✅ Arquitectura clara
- ✅ Código base
- ✅ Plan paso a paso
- ✅ Prompts optimizados
- ✅ Schema BD
- ✅ Propuesta cliente
- ✅ Tracking template

**Siguiente paso:** Elige OPCIÓN A, B, o C arriba y comienza. 🚀

---

**Documento creado:** [HOY]  
**Última actualización:** [HOY]  
**Versión:** V1  
**Propietario:** Aitor Alarcón  
