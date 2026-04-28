// ============================================
// Test Suite — LinkedIn Message Generator v4
// Ejecutar: npm run test:messages
//
// Checks por lead:
//   ✓ 3 drafts devueltos con estrategias correctas (hook, social_proof, urgency)
//   ✓ Cada draft ≤ 300 caracteres
//   ✓ Los 3 drafts tienen aperturas distintas
//   ✓ social_proof contiene pregunta (¿...?)
//   ✓ hook no empieza con "Hola" genérico
//   ✓ Confidence dentro de rango [0, 1]
//   ✓ ai_detector_risk < 0.50 (meta real < 0.20)
// ============================================

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { generateMessagesWithPipeline } from '../src/lib/claude_prompts'
import { SAMPLE_LEADS } from './sample_leads'
import type { MessageDraft, TokenUsage } from '../src/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

const CHAR_LIMIT = 300
const STRATEGIES = ['hook', 'social_proof', 'urgency'] as const

function fmt(n: number, dec = 2) { return n.toFixed(dec) }
function fmtCost(n: number)      { return `$${n.toFixed(6)}` }
function bar(label: string)      { return `\n${'─'.repeat(54)}\n${label}\n${'─'.repeat(54)}` }
function section(label: string)  { return `\n${'═'.repeat(54)}\n${label}\n${'═'.repeat(54)}` }

interface CheckResult {
  pass: boolean
  msg: string
}

// ── Per-draft checks ─────────────────────────────────────────────────────────

function checkCharLimit(draft: MessageDraft): CheckResult {
  const len = draft.text.length
  return {
    pass: len <= CHAR_LIMIT,
    msg:  len <= CHAR_LIMIT
      ? `${len} chars ✅`
      : `${len} chars ❌ (OVER by ${len - CHAR_LIMIT})`,
  }
}

function checkAiRisk(draft: MessageDraft): CheckResult {
  const risk = draft.ai_detector_risk ?? 0
  const ok = risk < 0.50
  return {
    pass: ok,
    msg:  ok
      ? `ai_risk ${fmt(risk)} ✅${risk < 0.20 ? ' (excelente)' : ' (aceptable)'}`
      : `ai_risk ${fmt(risk)} ❌ (alto riesgo)`,
  }
}

function checkSocialProof(draft: MessageDraft): CheckResult | null {
  if (draft.strategy !== 'social_proof') return null
  const hasQ = draft.text.includes('¿') || draft.text.includes('?')
  return {
    pass: hasQ,
    msg:  hasQ ? 'contains question ✅' : 'NO question found ❌',
  }
}

function checkHook(draft: MessageDraft): CheckResult | null {
  if (draft.strategy !== 'hook') return null
  const first20 = draft.text.slice(0, 20).toLowerCase()
  const startsWithGreeting = first20.startsWith('hola') || /^[a-záéíóúñ]+,/.test(first20)
  return {
    pass: !startsWithGreeting,
    msg:  !startsWithGreeting
      ? 'starts with hook (not greeting) ✅'
      : 'starts with greeting — weak hook ❌',
  }
}

function checkConfidence(draft: MessageDraft): CheckResult {
  const ok = draft.confidence >= 0 && draft.confidence <= 1
  return {
    pass: ok,
    msg:  ok ? `confidence ${fmt(draft.confidence)} ✅` : `confidence ${fmt(draft.confidence)} ❌ (out of range)`,
  }
}

// ── Cross-draft checks ───────────────────────────────────────────────────────

function checkDistinctOpeners(drafts: MessageDraft[]): CheckResult {
  const openers = drafts.map(d => d.text.slice(0, 30).toLowerCase().trim())
  const unique = new Set(openers)
  return {
    pass: unique.size === openers.length,
    msg:  unique.size === openers.length
      ? 'all openers distinct ✅'
      : `duplicate openers found ❌ (${openers.join(' | ')})`,
  }
}

function checkAllStrategiesPresent(drafts: MessageDraft[]): CheckResult {
  const found = drafts.map(d => d.strategy)
  const missing = STRATEGIES.filter(s => !found.includes(s))
  return {
    pass: missing.length === 0,
    msg:  missing.length === 0
      ? 'all 3 strategies present ✅'
      : `missing strategies: ${missing.join(', ')} ❌`,
  }
}

// ── Aggregated stats ─────────────────────────────────────────────────────────

interface LeadResult {
  lead: string
  draftResults: { strategy: string; checks: CheckResult[]; text: string }[]
  crossChecks: CheckResult[]
  usage: TokenUsage
  allPassed: boolean
}

// ── Test runner ──────────────────────────────────────────────────────────────

async function testLead(lead: typeof SAMPLE_LEADS[0], index: number): Promise<LeadResult> {
  const label = `${lead.name} — ${lead.title} @ ${lead.company}`
  console.log(bar(`LEAD ${index + 1}/${SAMPLE_LEADS.length}: ${label}`))

  const t0 = Date.now()
  const { drafts, usage } = await generateMessagesWithPipeline(lead)
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  console.log(`Pipeline ✓ (${elapsed}s) | tokens: ${usage.prompt_tokens}in + ${usage.completion_tokens}out = ${usage.total_tokens} | cost: ${fmtCost(usage.estimated_cost_usd)}`)

  const draftResults: LeadResult['draftResults'] = []
  let allPassed = true

  // Per-draft checks
  for (const draft of drafts) {
    const checks: CheckResult[] = []

    checks.push(checkCharLimit(draft))
    checks.push(checkConfidence(draft))
    checks.push(checkAiRisk(draft))

    const hookCheck = checkHook(draft)
    if (hookCheck) checks.push(hookCheck)

    const spCheck = checkSocialProof(draft)
    if (spCheck) checks.push(spCheck)

    const draftPassed = checks.every(c => c.pass)
    if (!draftPassed) allPassed = false

    const preview = draft.text.length > 80
      ? draft.text.slice(0, 77) + '...'
      : draft.text

    console.log(`\n  [${(draft.strategy ?? 'unknown').toUpperCase()}]`)
    console.log(`  "${preview}"`)
    checks.forEach(c => console.log(`    ${c.pass ? '' : '  '}${c.msg}`))

    draftResults.push({ strategy: draft.strategy ?? 'unknown', checks, text: draft.text })
  }

  // Cross-draft checks
  const crossChecks: CheckResult[] = [
    checkAllStrategiesPresent(drafts),
    checkDistinctOpeners(drafts),
  ]

  console.log('\n  Cross-draft:')
  crossChecks.forEach(c => {
    if (!c.pass) allPassed = false
    console.log(`    ${c.msg}`)
  })

  console.log(allPassed ? '\n  ✅ LEAD PASSED' : '\n  ❌ LEAD HAS ISSUES')

  return { lead: label, draftResults, crossChecks, usage, allPassed }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(section('LinkedIn Message Generator v4 — Test Suite'))

  const args = process.argv.slice(2)
  const leadIndex = args[0] ? parseInt(args[0], 10) - 1 : -1
  const leadsToTest = leadIndex >= 0
    ? [SAMPLE_LEADS[leadIndex]]
    : SAMPLE_LEADS

  if (leadIndex >= 0 && !SAMPLE_LEADS[leadIndex]) {
    console.error(`❌ Lead ${leadIndex + 1} no existe (hay ${SAMPLE_LEADS.length} leads)`)
    process.exit(1)
  }

  const results: LeadResult[] = []
  let totalCost = 0
  let totalTokens = 0

  for (let i = 0; i < leadsToTest.length; i++) {
    const lead = leadsToTest[i]
    const result = await testLead(lead, leadIndex >= 0 ? leadIndex : i)
    results.push(result)
    totalCost += result.usage.estimated_cost_usd
    totalTokens += result.usage.total_tokens

    if (i < leadsToTest.length - 1) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(section('SUMMARY'))
  console.log(`Leads tested : ${results.length}`)
  console.log(`Total tokens : ${totalTokens.toLocaleString()}`)
  console.log(`Total cost   : ${fmtCost(totalCost)}`)
  console.log(`Avg/lead     : ${Math.round(totalTokens / results.length)} tokens | ${fmtCost(totalCost / results.length)}`)

  const failed = results.filter(r => !r.allPassed)
  if (failed.length === 0) {
    console.log('\n✅ ALL LEADS PASSED')
  } else {
    console.log(`\n❌ ${failed.length} lead(s) with issues:`)
    failed.forEach(r => console.log(`   • ${r.lead}`))
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n❌ FATAL ERROR:', err)
  process.exit(1)
})
