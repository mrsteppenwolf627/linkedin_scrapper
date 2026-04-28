// ============================================
// Sample leads para testing del Message Generator
// 5 perfiles realistas: SaaS ×2, Tech, Retail, Fintech
// ============================================

import type { LeadInput } from '../src/types'

// Producto ficticio usado en todos los tests
export const TEST_PRODUCT = 'Seiza — Plataforma de automatización de outreach B2B con IA'

export const SAMPLE_LEADS: LeadInput[] = [
  // ── 1. SaaS · VP Sales · Madrid ──────────────────────────────────────────
  {
    name:            'Ana Sánchez',
    title:           'VP of Sales',
    company:         'Salesforce Spain',
    industry:        'SaaS / CRM',
    location:        'Madrid',
    linkedin_url:    'https://linkedin.com/in/ana-sanchez-vpsales',
    profile_snippet: '10+ años liderando equipos de ventas enterprise en SaaS. Ex-SAP. Speaker habitual en SaaStr y Sales Summit.',
    your_product:    TEST_PRODUCT,
  },

  // ── 2. SaaS · Head of CS · Barcelona ─────────────────────────────────────
  {
    name:            'Carlos Ruiz',
    title:           'Head of Customer Success',
    company:         'HubSpot Spain',
    industry:        'SaaS / Marketing Automation',
    location:        'Barcelona',
    linkedin_url:    'https://linkedin.com/in/carlos-ruiz-cs-hubspot',
    profile_snippet: 'Gestiono un equipo de 15 CSMs. Especializado en reducción de churn y expansión de cuentas en B2B SaaS. Certificado HubSpot Partner.',
    your_product:    TEST_PRODUCT,
  },

  // ── 3. Tech · CTO · Barcelona ────────────────────────────────────────────
  {
    name:            'Laura Gómez',
    title:           'CTO',
    company:         'Factorial HR',
    industry:        'HR Tech / SaaS',
    location:        'Barcelona',
    linkedin_url:    'https://linkedin.com/in/laura-gomez-cto-factorial',
    profile_snippet: 'CTO en Factorial (unicornio español). 150+ ingenieros. Foco en escalabilidad de plataforma y cultura de ingeniería de alto rendimiento.',
    your_product:    TEST_PRODUCT,
  },

  // ── 4. Retail · Dir. Digital Transformation · Madrid ─────────────────────
  {
    name:            'Miguel Torres',
    title:           'Director de Transformación Digital',
    company:         'El Corte Inglés',
    industry:        'Retail / Ecommerce',
    location:        'Madrid',
    linkedin_url:    'https://linkedin.com/in/miguel-torres-digital-eci',
    profile_snippet: 'Liderando la digitalización del grupo ECI: integración omnicanal, ecommerce B2C y herramientas internas. 8 años en Amazon antes de ficharme aquí.',
    your_product:    TEST_PRODUCT,
  },

  // ── 5. Fintech · CFO · Madrid (sin snippet — test de baja confianza) ──────
  {
    name:            'Patricia López',
    title:           'CFO',
    company:         'Payflow',
    industry:        'Fintech / Salarios Flexibles',
    location:        'Madrid',
    linkedin_url:    'https://linkedin.com/in/patricia-lopez-cfo-payflow',
    profile_snippet: '', // deliberadamente vacío para testear baja confianza
    your_product:    TEST_PRODUCT,
  },
]
