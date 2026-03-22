# 🕵️‍♂️ LinkedIn Lead Scraper V1.1 — Wabi-Sabi Edition

Sistema inteligente de prospección en frío que utiliza **Google Search (vía SearchApi.io) + OpenAI (GPT-4o-mini)** para encontrar, validar y organizar perfiles de LinkedIn de alta calidad de forma automatizada.

---

## 📜 Filosofía del Proyecto: Wabi-Sabi
Este software abraza la imperfección de la web para extraer la verdad de los datos. No buscamos bases de datos masivas y ruidosas, sino una **prospección artesanal digital** donde la IA actúa como un artesano filtrando la esencia de cada perfil.

## 🛠 Stack Tecnológico
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router + SSE Streaming)
- **Búsqueda**: [SearchApi.io](https://www.searchapi.io/) (Google Search Engine Proxy con soporte para `site:`)
- **IA / LLM**: [OpenAI API](https://platform.openai.com/) (Modelo `gpt-4o-mini`)
- **Base de Datos**: [Supabase](https://supabase.com/) (PostgreSQL)
- **UI/UX**: Tailwind CSS + Shadcn/UI (Paleta de colores tierra, ocre y pizarra)

---

## 🚀 Hitos Recientes (Sesión 22/03/2026)

### 1. Migración Crítica del Motor de Búsqueda
- **Problema**: El operador `site:linkedin.com/in/` era bloqueado por Google Custom Search tradicional (Error 400/403).
- **Solución**: Migración completa a **SearchApi.io**. Se implementó una lógica de `fetch` con `cache: 'no-store'` para garantizar resultados frescos y evitar bloqueos.
- **Archivo**: `src/lib/google_search.ts`.

### 2. Simplificación Radical de la UI
- **Refactorización**: Se eliminaron los selectores rígidos y campos numéricos.
- **Nuevo Formulario**: Ahora consta de exactamente **4 campos de texto libre**:
  1. **Puesto** (jobTitle)
  2. **Años de experiencia** (experience)
  3. **Sector** (industry)
  4. **Localización** (location)
- **Estética**: Se mantuvo el diseño Wabi-Sabi con bordes redondeados suaves y tipografía elegante.

### 3. Evolución de la Lógica de Validación
- **TypeError Fix**: Se eliminó la dependencia de `filters.keywords` que causaba errores de ejecución.
- **Validación Dinámica**: La función `validateInCode` en `src/lib/linkedin_scraper.ts` ahora es polimórfica; crea un array de términos dinámicos y valida la presencia de cualquiera de ellos en el perfil antes de enviarlo a la IA.
- **Validación Semántica**: Claude ahora recibe los 4 campos de texto libre para decidir si un perfil es relevante, permitiendo un lenguaje más natural (ej: "Senior", "Más de 5 años").

### 4. Mejoras en la Visualización de Leads
- **Enlaces Limpios**: Las URLs de LinkedIn en la tabla ahora son enlaces azules clickables con el texto "Ver Perfil ↗".
- **Identificadores**: Se optimizó la generación automática de nombres de búsqueda para ser más descriptivos.

---

## 📋 Contexto para la Próxima Sesión (Mañana)

**Si eres Gemini CLI leyendo esto, este es el estado del arte:**
1. El motor de búsqueda es **SearchApi.io** (usando la variable `SEARCHAPI_IO_KEY`).
2. El operador base es `site:linkedin.com/in/`.
3. El frontend envía un objeto `filters` con: `jobTitle`, `experience`, `industry`, `location`.
4. El backend genera el dork dinámicamente ignorando el campo `experience` (la IA solo lo usa para la validación final, no para la query de Google para no restringir resultados).
5. **Pendiente**: Verificar si la cuota de SearchApi.io es suficiente para búsquedas de 30 resultados por tanda.

---

## 📂 Estructura Principal
```text
src/
├── app/
│   ├── api/search/         # Endpoint SSE que orquesta la búsqueda
│   └── page.tsx            # Dashboard Wabi-Sabi
├── lib/
│   ├── google_search.ts    # Integración con SearchApi.io
│   ├── claude_prompts.ts   # Prompts de OpenAI (Dork Gen, Validation, Parsing)
│   └── linkedin_scraper.ts # Orquestador y validación en código
└── types/
    └── index.ts            # Interfaces actualizadas (SearchFilters)
```

## ⚙️ Configuración del Entorno (`.env.local`)
```bash
# Búsqueda
SEARCHAPI_IO_KEY=tu_clave_aqui

# IA
OPENAI_API_KEY=tu_clave_aqui

# DB
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Seguridad
NEXT_PUBLIC_SEARCH_API_KEY=tu_clave_secreta
```

---
*Desarrollado con cuidado artesanal para una prospección inteligente.*
