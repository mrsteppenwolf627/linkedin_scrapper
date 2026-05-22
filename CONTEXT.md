CONTEXT.md - LinkedIn Scraper: Message Generator + User System
Project Overview
Goal: Transform LinkedIn profile searches into AI-generated personalized outreach messages. Protected by user authentication with admin approval.
Stack: Next.js 15 + OpenAI API (gpt-4o-mini) + Supabase PostgreSQL + TypeScript + Tailwind CSS
Philosophy: Zero friction for sales reps. Find â†’ Generate â†’ Send. Secured by admin approval gate.

Roles

Claude Code: Backend (API routes, OpenAI prompts, DB schemas, auth, business logic, middleware)
Gemini CLI: Frontend (React components, UI/UX, form handling, landing page, login/admin dashboard)
Codex: Testing (e2e auth flow, integration tests, security audit)


Architecture
Landing Page (/) â†’ Login (/login) â†’ Auth System â†’ Dashboard (/dashboard/*)
                                         â†“
                                   Admin Approval (status='pending' â†’ 'approved')
                                         â†“
                                   Access to Message Generator
                                   
Message Generation Flow:
LinkedIn Profile (from existing search)
    â†“
API POST /api/generate-messages (protected by auth)
    â†“
OpenAI gpt-4o-mini (3 drafts: Direct, Consultative, Value-First)
    â†“
Supabase (store lead + generated drafts)
    â†“
Frontend displays drafts â†’ User copies to LinkedIn

Data Model
Table: users (V3 - Auth)
sqlid (uuid, pk)
email (text, unique)
password_hash (text)
role (text: 'user' | 'admin', default='user')
status (text: 'pending_approval' | 'approved' | 'rejected', default='pending_approval')
created_at (timestamp)
approved_at (timestamp, nullable)
approved_by (uuid, fk to users(id), nullable)
Table: user_approvals (V3 - Log)
sqlid (uuid, pk)
user_id (uuid, fk)
approved_by (uuid, fk)
status (text: 'approved' | 'rejected')
reason (text, nullable)
created_at (timestamp)
Table: leads (V1-V2 - Message Generator)
sqlid (uuid, pk)
search_id (uuid, fk)
name (text)
title (text)
company (text)
industry (text)
location (text)
linkedin_url (text)
profile_snippet (text)
score (numeric, optional)
created_at (timestamp)
Table: message_drafts (V1-V2 - Message Generator)
sqlid (uuid, pk)
lead_id (uuid, fk)
search_id (uuid, fk)
batch_id (uuid, fk to message_batches, nullable)
sequence (int: 1 | 2 | 3)
text (text)
sounds_human (numeric 0-1, optional)
confidence (numeric 0-1)
created_at (timestamp)
Table: message_batches (V2 onwards - Message Generator)
sqlid (uuid, pk)
search_id (uuid, fk)
batch_name (text)
message_count (int)
status (text: 'generated' | 'deleted', default='generated')
created_at (timestamp)

Current Status
V1-V2: Message Generator âœ… COMPLETE

 Architecture defined
 Data model designed
 OpenAI prompt finalized (humanization v2)
 API endpoint /api/generate-messages + batch route
 Supabase schema (leads, message_drafts, message_batches)
 Frontend form component (SearchSelector)
 Draft display component (results table)
 Batch Generator UI (/searches)
 Messages Management UI (/messages) with batch selection
 Legacy messages recovery (heredados)
 Batch operations (create, delete, select, regenerate)

V3: Auth System âœ… COMPLETE

 Database: users + user_approvals tables (Supabase SQL)
 Endpoints:

POST /api/auth/signup (register â†’ status='pending_approval')
POST /api/auth/signin (login, check status='approved')
POST /api/auth/logout (logout, clear session)
GET /api/admin/pending-users (list pending + rejected users)
POST /api/admin/approve-user/:id (approve user via RPC)
POST /api/admin/reject-user/:id (reject user via RPC)


 Middleware (middleware.ts - Edge Runtime):

Protege /dashboard/* â†’ requiere auth + status='approved'
Protege /admin/* â†’ requiere auth + role='admin' + status='approved'
PÃºblica: /, /login, /api/auth/*


 Security:

Fixed privilege escalation (no auto-approve by email)
Enforced: todos los signups â†’ status='pending_approval'
HttpOnly cookies para JWT tokens
Password hashing via Supabase
RPC transaccional para approve/reject



V3: Login Page UI âœ… COMPLETE

 Design: Dark minimal, hamburguesa layout (vertical stack)
 Components:

src/dashboard/login/page.tsx (main page)
src/components/auth/SigninForm.tsx (signin logic)
src/components/auth/SignupForm.tsx (signup logic)


 Features:

Tabs: "Entrar" | "Registro" (botones verticales, border sharp)
Inputs: Email + Password (sharp, legible placeholders)
Button: "Iniciar SesiÃ³n" (blanco/negro, sharp)
SearchParams: ?reason=pending, ?reason=rejected (status messages)
ValidaciÃ³n: Email format + password length (8+ chars)
UI responsivo, dark mode compatible


 Commit: "Fix: redesign login page (design system compliant)"

V3: Landing Page âœ… COMPLETE

 6 Server Components (sin "use client"):

Navbar.tsx (fixed top, logo âš¡ + nav links + CTA "Empezar")
HeroSection.tsx (terminal preview animado, stats, 2 CTAs)
FeaturesSection.tsx (grid 3 cols: BÃºsqueda / Mensajes / CampaÃ±as)
TestimonialSection.tsx (fondo negro, blockquote, social proof chips)
CTASection.tsx (fondo naranja #D94F00, "Registrarse gratis")
Footer.tsx (logo + nav links + copyright)


 Features:

EstÃ©tica idÃ©ntica al dashboard (same palette + bordes sharp)
Colores: #F0EDE4 (bg), #1A1A1A (texto), #D94F00 (accent), #4A7C59 (secondary)
Bordes: Sharp (border-radius: 0)
Server-side rendering (sin estado, sin hydration overhead)
Responsivo: Mobile first, desktop optimizado


 Routing:

/ â†’ Landing page
/login â†’ Auth page
/dashboard/* â†’ Dashboard (protegido)
/admin/* â†’ Admin panel (protegido)


 Commit: abe4ac2 â€” "Feat: create landing page (design-consistent)"

V3: Admin Dashboard ✅ COMPLETE (TAREA 11)

 Admin Approvals page (/admin/approvals)

Tabla con: Email | Status | Requested Date | Actions
Botones: Aprobar | Rechazar (con refetch automático)
API calls: GET /api/admin/pending-users, POST approve/reject
Estética: Idéntica al dashboard (sharps, OKLCH variables)
Protección: Solo role='admin' + status='approved'

 Commit: b09b808 — "Feat: admin approvals dashboard (via Codex)"
V3: E2E Tests â³ PENDIENTE (TAREA 12)

 Signup â†’ Pending approval â†’ Admin approve â†’ Signin â†’ Access
Asignada a: Codex


ðŸ” Endpoints Implementados
Auth
POST /api/auth/signup
  Body: { email, password }
  Response: { success, error?, reason? }
  
POST /api/auth/signin
  Body: { email, password }
  Response: { success, token?, error? }
  
POST /api/auth/logout
  Response: { success }
Admin
GET /api/admin/pending-users
  Response: User[]

POST /api/admin/approve-user/[id]
  Body: {}
  Response: { success, message }

POST /api/admin/reject-user/[id]
  Body: { reason?: string }
  Response: { success, message }
Message Generator (V1-V2)
GET /api/searches
GET /api/contacts/[id]
POST /api/generate-messages
GET /api/batches
GET /api/drafts?legacy=true

ðŸ“ File Structure
src/dashboard/
â”œâ”€â”€ page.tsx                           # Landing page (âœ… COMPLETE)
â”œâ”€â”€ login/
â”‚   â””â”€â”€ page.tsx                       # Auth page - dark minimal (âœ… COMPLETE)
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ page.tsx                       # Dashboard (protegido)
â”‚   â”œâ”€â”€ searches/page.tsx
â”‚   â”œâ”€â”€ messages/page.tsx
â”‚   â””â”€â”€ batches/page.tsx
â”œâ”€â”€ admin/
â”‚   â”œâ”€â”€ layout.tsx                     # ProtecciÃ³n admin
â”‚   â””â”€â”€ approvals/
â”‚       â””â”€â”€ page.tsx                   # (✅ COMPLETE)
â”œâ”€â”€ api/
â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”œâ”€â”€ signup/route.ts            # (âœ… COMPLETE)
â”‚   â”‚   â”œâ”€â”€ signin/route.ts            # (âœ… COMPLETE)
â”‚   â”‚   â””â”€â”€ logout/route.ts            # (âœ… COMPLETE)
â”‚   â”œâ”€â”€ admin/
â”‚   â”‚   â”œâ”€â”€ pending-users/route.ts     # (âœ… COMPLETE)
â”‚   â”‚   â”œâ”€â”€ approve-user/[id]/route.ts # (âœ… COMPLETE)
â”‚   â”‚   â””â”€â”€ reject-user/[id]/route.ts  # (âœ… COMPLETE)
â”‚   â””â”€â”€ [V1-V2 routes...]
â””â”€â”€ middleware.ts                      # Route protection (âœ… COMPLETE)

src/components/
â”œâ”€â”€ landing/                           # 6 componentes (âœ… COMPLETE)
â”‚   â”œâ”€â”€ Navbar.tsx
â”‚   â”œâ”€â”€ HeroSection.tsx
â”‚   â”œâ”€â”€ FeaturesSection.tsx
â”‚   â”œâ”€â”€ TestimonialSection.tsx
â”‚   â”œâ”€â”€ CTASection.tsx
â”‚   â””â”€â”€ Footer.tsx
â”œâ”€â”€ auth/                              # Auth forms (âœ… COMPLETE)
â”‚   â”œâ”€â”€ SigninForm.tsx
â”‚   â””â”€â”€ SignupForm.tsx
â””â”€â”€ [V1-V2 components...]

src/lib/
â”œâ”€â”€ auth.ts                            # Auth utilities
â”œâ”€â”€ supabase.ts                        # Supabase client
â””â”€â”€ utils.ts

src/types/
â””â”€â”€ index.ts

Decisiones ArquitectÃ³nicas (Congeladas)
1. Auth Strategy: Supabase Auth + Custom Users Table

DecisiÃ³n: Use Supabase Auth (built-in) + custom users table para roles/status
Por quÃ©: Ya usando Supabase, JWT tokens automÃ¡ticos, password hashing seguro, HttpOnly cookies

2. Admin Approval Flow (Mandatory)

DecisiÃ³n: Status field ('pending_approval' | 'approved' | 'rejected')
Por quÃ©: Simple, explÃ­cito, audit trail vÃ­a user_approvals log

3. Landing Page = Dashboard (Same Aesthetic)

DecisiÃ³n: Landing page usa EXACTAMENTE la misma palette + bordes sharp
Por quÃ©: Coherencia visual, branded experience

4. Middleware Edge Runtime Protection

DecisiÃ³n: Protege /dashboard/* y /admin/* en middleware.ts (Edge Runtime)
Por quÃ©: Performance, early redirect


Flujo de Usuario (V3)
Nuevo Usuario
1. Va a / (landing) â†’ click "Empezar" â†’ /login
2. Click "Registrarse" â†’ formulario signup
3. Email + Password â†’ Submit
4. POST /api/auth/signup â†’ status='pending_approval'
5. Response: "Espera aprobaciÃ³n del admin"
Admin (AprobaciÃ³n)
1. /admin/approvals
2. Ve tabla: email, status, fecha
3. Click "Aprobar" â†’ POST /api/admin/approve-user/:id
4. Usuario ahora puede signin
Usuario Aprobado
1. /login â†’ Signin
2. POST /api/auth/signin (status='approved')
3. Redirect â†’ /dashboard/searches (dashboard)
4. Acceso completo a message generator

Stack TÃ©cnico
Frontend: Next.js 15 + React 18 + TypeScript + Tailwind CSS
Backend: Next.js API Routes + Edge Runtime Middleware
Database: Supabase PostgreSQL
Auth: Supabase Auth + JWT HttpOnly cookies
Password: bcrypt hashing (Supabase automatic)
Styling: Tailwind CSS con variables OKLCH

V4: /api/drafts Endpoint ✅ STABLE (22 mayo 2026)

Commit: 69d7a7a — "Fix: Remove batch_id filter from /api/drafts, load all 633+ messages"
Estado: ESTABLE — push en master, versión de producción.

Implementacion:
- src/app/api/drafts/route.ts
- Usa Supabase REST API con fetch() nativo (sin SDK)
- JOIN con tabla leads: ?select=id,sequence,draft_text,batch_id,leads(name,linkedin_url,company)
- Sin filtros: retorna TODOS los mensajes (666 records en producción)
- Formato: { drafts: [] } — siempre JSON válido, nunca HTML
- Try/catch: retorna { drafts: [] } ante cualquier error
- console.log/error para debugging

Decisión técnica:
- El endpoint NO filtra por batch_id ni legacy — devuelve todos los registros
- El dashboard consume response.drafts (actualizado en messages/page.tsx)
- Verificado: 666 drafts con campos id, lead_name, lead_linkedin_url, lead_company, sequence, draft_text

Proximas Tareas
TAREA 12: E2E Tests (Codex)

Signup -> Pending -> Approve -> Signin -> Access

Ultima actualizacion: 22 de mayo de 2026
Estado: V3 Auth + Dashboard + Admin + User Management COMPLETO | /api/drafts ESTABLE | E2E Tests PENDIENTE
Build note: ✅ npm run build pasando (incluye fix de SearchFilters en scripts/test_search.ts, commit fd75c09).

V3: User Management Panel ✅ COMPLETE (TAREA 13)

Ruta: /dashboard/users
Condicional de rol en /dashboard:
- role=admin: muestra boton "Gestionar Usuarios"
- role=user: no muestra boton

Proteccion:
- Middleware: requiere cookie auth-token en /dashboard/*
- Pagina /dashboard/users valida rol admin y redirige a /dashboard si no cumple

Nuevos endpoints:
- GET /api/auth/me
- GET /api/admin/users
- PATCH /api/admin/users/[id]
- DELETE /api/admin/users/[id]

Commit esperado de esta tarea: pendiente de crear en esta sesion.
