# LinkedIn Scraper - Brief de Proyecto

**Nombre del proyecto:** LinkedIn Lead Scraper (Google Search)  
**Versión:** V1  
**Tipo de proyecto:** Cliente + Producto Interno  
**Propietario:** Aitor Alarcón  

---

## 1. Objetivo
Crear un sistema automatizado que busque perfiles de LinkedIn usando Google Search como fuente, extraiga datos enriquecidos mediante IA, elimine duplicados y almacene contactos en una BD central para prospección en frío posterior.

## 2. Problema que resuelve
- Busqueda manual de perfiles en LinkedIn es lenta
- No hay forma de escalar búsquedas por criterios específicos (sector, experiencia, especialidad)
- Los scrapers directos de LinkedIn generan bans
- El cliente necesita una lista de contactos cualificados para vender su servicio

## 3. Alcance
- ✅ Backend que orquesta búsquedas en Google
- ✅ Parsing inteligente con Claude API para extraer datos del snippet
- ✅ Deduplicación automática por URL + email
- ✅ Frontend para crear búsquedas y visualizar resultados
- ✅ Base de datos (Supabase) con histórico
- ❌ No incluye venta ni follow-up (responsabilidad del cliente)

## 4. Entregable esperado
- Sistema web (Next.js + Shadcn/UI) en Vercel
- Backend en Node.js (API routes)
- Base de datos en Supabase
- MVP: búsqueda manual → resultados → tabla descargable

## 5. Stack previsto
- **Frontend:** Next.js, Shadcn/UI, Tailwind
- **Backend:** Node.js (Next.js API routes)
- **BD:** Supabase (PostgreSQL)
- **Búsqueda:** Google Search API
- **IA/Parsing:** Claude API
- **Deploy:** Vercel + Supabase
- **Versionado:** GitHub

## 6. Datos/Integraciones necesarias
- Clave Google Custom Search API (o Serper.dev)
- Clave Anthropic API (Claude)
- Conexión Supabase

## 7. Riesgos principales
- Google puede limitar/bloquear búsquedas si son muy agresivas
- Claude API costo escala con volumen de resultados
- Dedup imperfecta: mismo perfil con variaciones de nombre/email
- Quality de parsing depende de los snippets devueltos

## 8. Criterio mínimo de validación
- Búsqueda de "consultores energía 5+ años" devuelve ≥10 resultados válidos
- Cada resultado tiene: URL LinkedIn, nombre, título, empresa
- No hay duplicados en tabla
- URLs válidas (clickeables)

## 9. Siguiente paso inmediato
1. Setup de infraestructura (Supabase + Vercel)
2. Diseño de esquema DB
3. Implementar backend de búsqueda + parsing
4. Crear frontend MVP
5. Testing manual
6. Deploy a producción

---

## Timeline estimado
- Fase 1 (Planificación + Setup): 2-3 días
- Fase 2 (Backend): 3-4 días
- Fase 3 (Frontend): 2-3 días
- Fase 4 (Testing + Deploy): 1-2 días

**Total: 1-2 semanas** (dependiendo de parallelización)
