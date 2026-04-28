# CONTEXT.md - LinkedIn Lead Scraper: Message Generator

## Project Overview
**Goal**: Transform LinkedIn profile searches into AI-generated personalized outreach messages.  
**Stack**: Next.js 14 + OpenAI API (gpt-4o-mini) + Supabase + Zapier  
**Philosophy**: Zero friction for sales reps. Find → Generate → Send.

---

## Roles
- **Claude Code**: Backend (API routes, OpenAI prompts, DB schemas, business logic)
- **Gemini CLI**: Frontend (React components, UI/UX, form handling, draft display)

---

## Architecture
```
LinkedIn Profile (from existing search)
    ↓
API POST /api/generate-messages
    ↓
OpenAI gpt-4o-mini (3 drafts: Direct, Consultative, Value-First)
    ↓
Supabase (store lead + generated drafts)
    ↓
Frontend displays drafts → User copies to LinkedIn
```

---

## Data Model

### Table: `leads`
```sql
id (uuid, pk)
search_id (uuid, fk)
name (text)
title (text)
company (text)
industry (text)
location (text)
linkedin_url (text)
profile_snippet (text) -- from search
score (numeric, optional)
created_at (timestamp)
```

### Table: `message_drafts`
```sql
id (uuid, pk)
lead_id (uuid, fk)
tone (text: 'direct' | 'consultative' | 'value_first')
draft_text (text)
confidence (numeric 0-1)
created_at (timestamp)
```

---

## Current Status
- [x] Architecture defined
- [x] Data model designed
- [x] OpenAI prompt finalized
- [x] API endpoint `/api/generate-messages` implemented
- [x] Supabase schema created
- [x] Frontend form component built
- [x] Draft display component built
- [x] Batch Generator UI (/searches, SearchSelector, BatchProgress, ResultsTable) built
- [x] Messages Management UI (/messages, Accordions, copy-to-clipboard) built
- [ ] E2E testing

---

## Sprint 1-2: Message Generator (MVP)

### Input
```json
{
  "name": "Juan García",
  "title": "Sales Manager",
  "company": "TechCorp",
  "industry": "SaaS",
  "location": "Barcelona",
  "linkedin_url": "https://linkedin.com/in/...",
  "profile_snippet": "...",
  "your_product": "AI Sales Automation"
}
```

### Output
```json
{
  "drafts": [
    {
      "draft_id": 1,
      "tone": "direct",
      "text": "Hola Juan,\n\nVi que...",
      "confidence": 0.92
    },
    {
      "draft_id": 2,
      "tone": "consultative",
      "text": "Juan,\n\nLlevamos 3 años...",
      "confidence": 0.88
    },
    {
      "draft_id": 3,
      "tone": "value_first",
      "text": "Hola Juan,\n\n¿Cuánto tiempo...",
      "confidence": 0.85
    }
  ]
}
```

---

## OpenAI Prompt Strategy
- System prompt defines 3 personas (Direct, Consultative, Value-First)
- Each persona has specific language patterns, opening hooks, CTAs
- Dynamic personalization using lead data
- Confidence scoring (based on data completeness + relevance signals)

---

## Next Steps (Claude Code)
1. Finalize OpenAI prompt template
2. Create POST `/api/generate-messages` endpoint
3. Implement Supabase insert logic
4. Add error handling + logging

---

## Next Steps (Gemini CLI)
1. Build form component (input fields for lead data)
2. Build draft display component (cards with copy-to-clipboard)
3. Connect to API endpoint
4. Add loading states + error handling

---

## Assumptions
- User brings their own OpenAI API key (BYOA model, Phase 1)
- LinkedIn profile data already extracted by existing search feature
- No real-time LinkedIn integration yet (copy/paste only)
- Spanish language priority (English later)

---

## Notes
- Keep prompts < 2000 tokens (cost efficiency)
- Test prompt with real LinkedIn profiles before deployment
- Confidence scoring helps users prioritize which drafts to use
