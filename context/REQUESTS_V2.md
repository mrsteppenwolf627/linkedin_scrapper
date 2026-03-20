# REQUESTS V2 — Backend → Frontend (Gemini CLI)
> Fecha: 2026-03-20 | Autor: Claude Code (Backend)
> Contexto: El backend funciona 100%. Estas son las mejoras pendientes para el frontend.

---

## CONTEXTO TÉCNICO PARA GEMINI

El pipeline de backend está validado y operativo:
- POST /api/search → crea búsqueda + lanza en background, responde con `search_id`
- GET /api/status?search_id=xxx → polling, devuelve estado + stats en tiempo real
- GET /api/searches → historial de búsquedas
- GET /api/contacts?search_id=xxx → contactos paginados
- PATCH /api/contacts?id=xxx → cambiar status del contacto

El archivo `src/app/page.tsx` contiene la UI actual. Está funcional pero necesita mejoras.

---

## MEJORA #1 — POLLING EN VIVO (CRÍTICO)

**Problema:** El usuario lanza una búsqueda y no ve qué pasa. Las búsquedas tardan 1-3 minutos.

**Lo que debe ocurrir:**
1. Al submit del form → POST /api/search → guardar `search_id`
2. Mostrar panel de progreso con stats en vivo: `Procesados: X/Y | Creados: Z | En curso...`
3. Polling GET /api/status?search_id=xxx cada 5 segundos
4. Parar polling cuando `status !== 'running'`
5. Al completar → mostrar toast + actualizar historial automáticamente

```typescript
// Lógica de polling
const pollStatus = async (searchId: string) => {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/status?search_id=${searchId}`)
    const data = await res.json()
    const s = data.search
    updateProgressPanel({
      processed: s.total_results_processed,
      created: s.total_contacts_created,
      duplicates: s.total_duplicates_found,
      invalid: s.total_invalid,
      status: s.status
    })
    if (s.status !== 'running') {
      clearInterval(interval)
      loadSearches() // refrescar historial
      if (s.status === 'completed') toast.success(`Búsqueda completada: ${s.total_contacts_created} contactos`)
      else toast.error(`Búsqueda fallida`)
    }
  }, 5000)
}
```

---

## MEJORA #2 — PREVIEW DE QUERY GOOGLE

**Problema:** El usuario no sabe qué se está buscando en Google.

**Lo que debe ocurrir:**
- Debajo del formulario, mostrar un preview del query que se enviará:
  `🔍 Query: site:linkedin.com/in (consultor OR solar) (5+ años OR 5+ years) Madrid`
- Se actualiza en tiempo real mientras el usuario escribe
- Texto monospace, color muted — es solo informacional

---

## MEJORA #3 — STATUS DE CONTACTOS

**Problema:** Los contactos están atascados en "new" para siempre.

**Lo que debe ocurrir:**
- En la tabla de contactos, añadir columna "Estado"
- Dropdown por fila: `new` → `contacted` → `converted` → `skipped` → `bounced`
- Al cambiar: PATCH /api/contacts?id={contact.id} con `{ status: nuevo_status }`
- Colores por status:
  - `new` → gris
  - `contacted` → azul/índigo muted
  - `converted` → verde sage
  - `skipped` → amarillo ocre
  - `bounced` → rojo terracota

---

## MEJORA #4 — AUTO-POLL HISTORIAL AL ABRIR PESTAÑA

**Problema:** El usuario abre "Historial" y no ve actualizaciones si hay una búsqueda en curso.

**Lo que debe ocurrir:**
- Al entrar en la tab "Historial", verificar si hay búsquedas con `status: running`
- Si las hay → polling automático de la lista hasta que no quede ninguna en curso
- Mostrar un indicador visual en la fila de la búsqueda en curso (spinner o pulso)

---

## MEJORA #5 — ESTÉTICA WABI-SABI

**Concepto:** De la frialdad del azul-oscuro-corporate a una estética cálida, imperfecta, orgánica.
"Lo bello en la imperfección, la transitoriedad y lo incompleto." — filosofía japonesa.

**Paleta de colores:**
```
Fondo principal:  #1c1b18 (negro cálido, casi carbón)
Fondo tarjetas:   #252520 (gris cálido oscuro)
Fondo card hover: #2e2d28
Borde sutil:      #3a3933 (casi invisible)
Texto principal:  #e8e4dc (blanco cálido, como pergamino)
Texto muted:      #8a8778 (gris arena)
Acento primario:  #c4935c (ámbar terracota — para botones CTA)
Acento éxito:     #7a9e7e (verde sage — para completed/converted)
Acento info:      #7a8fa0 (azul gris pizarra — para running/contacted)
Acento error:     #a05c5c (rojo ladrillo — para failed/bounced)
```

**Tipografía y forma:**
- Fuente: `font-sans` con `tracking-wide` para títulos, `tracking-normal` para cuerpo
- Bordes: `rounded-xl` para cards, `rounded-lg` para inputs
- Sombras: muy sutiles, cálidas (`shadow-amber-950/20`)
- Sin gradientes duros — si se usa gradiente, muy sutil (casi imperceptible)
- Espaciado generoso — el wabi-sabi respira

**Elementos visuales específicos:**
- El header: sin fondo frosted glass, fondo sólido cálido con borde inferior sutil
- El botón CTA "Lanzar Scraper": color ámbar terracota, sin sombra azul
- Las badges de status: colores wabi-sabi (sin `blue-500`, sin `emerald-500` brillante)
- La tabla: filas con hover muy sutil, sin separadores duros
- Loading spinner: color ámbar, no azul

**Micro-detalles:**
- El título "LinkedIn Scraper" en serif o con ligera inclinación — algo humano
- Los números (stats) en `tabular-nums` para que no bailen
- Placeholder text más evocador: "ej: consultores energía renovable" en vez de strings técnicos

---

## RESULTADO ESPERADO

Un dashboard funcional y bello, con:
1. Feedback en tiempo real de búsquedas en curso
2. Estética cálida y orgánica — nada de UI corporativa fría
3. Gestión de estado de contactos (CRM básico)
4. Sensación de herramienta artesanal hecha con cuidado

---

## ARCHIVOS A MODIFICAR

- `src/app/page.tsx` — único archivo que gestiona Gemini
- No tocar nada en `src/lib/` ni `src/app/api/` — eso es territorio backend

---

*Generado por Claude Code (Backend) para coordinación con Gemini CLI (Frontend)*
