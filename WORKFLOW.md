# WORKFLOW.md - Sprint 1-2 Execution

## Phase: Message Generator (MVP)

### Task Distribution

#### Claude Code Tasks (Backend)
- [x] Task 1: Create OpenAI prompt template (3 personas)
- [x] Task 2: Implement POST `/api/generate-messages` endpoint
- [x] Task 3: Supabase schema + migrations
- [x] Task 4: Error handling + logging
- [x] Task 5: Test with sample leads
- [x] Task 6: POST `/api/generate-messages/batch` — bulk generation for a full search (max 5 concurrent, cost report)

#### Gemini CLI Tasks (Frontend)
- [x] Task 1: Form component (lead input fields)
- [x] Task 2: Draft display component (cards)
- [x] Task 3: Copy-to-clipboard functionality
- [x] Task 4: Loading states + error messages
- [x] Task 5: Connect to API endpoint

### Phase: Batch Generator

#### Gemini CLI Tasks (Frontend)
- [x] Task 4: Nueva página /searches, SearchSelector, BatchProgress, ResultsTable
- [x] Task 5: Nueva página /messages, Acordeones de Búsquedas y Leads, MessageCard con Copy

---

## Sync Points (Update CONTEXT.md after each)

**After Task 1 (Claude)**: Prompt template finalized  
**After Task 1 (Gemini)**: Form layout complete  
**After Task 2 (Claude)**: API endpoint working (test with curl)  
**After Task 2 (Gemini)**: Frontend connected to API  
**After Task 5 (Both)**: Full E2E test with real data  

---

## Testing Strategy
1. **Unit**: OpenAI prompt with sample leads (no API calls)
2. **Integration**: API endpoint → Supabase → Frontend
3. **E2E**: Real lead data → API → Display → Copy

---

## Known Blockers
- OpenAI API key required (user brings their own)
- Supabase project + credentials needed
- Need existing lead data format from search feature

---

## Rollout
1. Deploy API endpoint first (Claude)
2. Connect frontend (Gemini)
3. Test with 5 real leads
4. Ship to production

