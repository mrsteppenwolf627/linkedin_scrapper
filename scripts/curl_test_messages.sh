#!/usr/bin/env bash
# ============================================
# Curl tests — POST /api/generate-messages
# Uso: bash scripts/curl_test_messages.sh [lead_number]
#
# Requiere:
#   API_KEY   — valor de SEARCH_API_KEY en .env.local
#   BASE_URL  — por defecto http://localhost:3000
#
# Ejemplo de un solo lead:
#   API_KEY=mysecret bash scripts/curl_test_messages.sh 1
#
# Ejemplo de todos:
#   API_KEY=mysecret bash scripts/curl_test_messages.sh
# ============================================

API_KEY="${API_KEY:-change_this_to_a_random_secret_key}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINT="$BASE_URL/api/generate-messages"

run_test() {
  local num="$1"
  local label="$2"
  local body="$3"

  echo ""
  echo "══════════════════════════════════════════════"
  echo "  LEAD $num: $label"
  echo "══════════════════════════════════════════════"

  curl -s -w "\n\nHTTP Status: %{http_code} | Time: %{time_total}s\n" \
    -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "$body" | python3 -c "
import sys, json
lines = sys.stdin.read().split('\n')
# Find the JSON block (first line) and the status line
for i, line in enumerate(lines):
    line = line.strip()
    if line.startswith('{'):
        try:
            data = json.loads(line)
            if 'drafts' in data:
                print(f'lead_id: {data.get(\"lead_id\", \"(no DB)\")}')
                for d in data['drafts']:
                    chars = len(d['text'])
                    ok = '✅' if chars <= 300 else '❌'
                    print(f'  [{d[\"tone\"].upper()}] conf={d[\"confidence\"]} | {chars} chars {ok}')
                    print(f'  \"{d[\"text\"][:90]}...\"' if len(d['text']) > 90 else f'  \"{d[\"text\"]}\"')
                    print()
            else:
                print(json.dumps(data, indent=2, ensure_ascii=False))
        except json.JSONDecodeError:
            print(line)
    elif line.startswith('HTTP Status'):
        print(line)
" 2>/dev/null || {
    # fallback: raw output if python3 not available
    curl -s -X POST "$ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $API_KEY" \
      -d "$body"
    echo ""
  }
}

SELECTED="${1:-all}"

# ── Lead 1: SaaS · VP Sales · Madrid ─────────────────────────────────────────
if [[ "$SELECTED" == "all" || "$SELECTED" == "1" ]]; then
run_test 1 "Ana Sánchez — VP of Sales @ Salesforce Spain" '{
  "name": "Ana Sánchez",
  "title": "VP of Sales",
  "company": "Salesforce Spain",
  "industry": "SaaS / CRM",
  "location": "Madrid",
  "linkedin_url": "https://linkedin.com/in/ana-sanchez-vpsales",
  "profile_snippet": "10+ años liderando equipos de ventas enterprise en SaaS. Ex-SAP. Speaker habitual en SaaStr y Sales Summit.",
  "your_product": "Seiza — Plataforma de automatización de outreach B2B con IA"
}'
fi

# ── Lead 2: SaaS · Head CS · Barcelona ───────────────────────────────────────
if [[ "$SELECTED" == "all" || "$SELECTED" == "2" ]]; then
run_test 2 "Carlos Ruiz — Head of CS @ HubSpot Spain" '{
  "name": "Carlos Ruiz",
  "title": "Head of Customer Success",
  "company": "HubSpot Spain",
  "industry": "SaaS / Marketing Automation",
  "location": "Barcelona",
  "linkedin_url": "https://linkedin.com/in/carlos-ruiz-cs-hubspot",
  "profile_snippet": "Gestiono un equipo de 15 CSMs. Especializado en reducción de churn y expansión de cuentas en B2B SaaS. Certificado HubSpot Partner.",
  "your_product": "Seiza — Plataforma de automatización de outreach B2B con IA"
}'
fi

# ── Lead 3: Tech · CTO · Barcelona ───────────────────────────────────────────
if [[ "$SELECTED" == "all" || "$SELECTED" == "3" ]]; then
run_test 3 "Laura Gómez — CTO @ Factorial HR" '{
  "name": "Laura Gómez",
  "title": "CTO",
  "company": "Factorial HR",
  "industry": "HR Tech / SaaS",
  "location": "Barcelona",
  "linkedin_url": "https://linkedin.com/in/laura-gomez-cto-factorial",
  "profile_snippet": "CTO en Factorial (unicornio español). 150+ ingenieros. Foco en escalabilidad de plataforma y cultura de ingeniería de alto rendimiento.",
  "your_product": "Seiza — Plataforma de automatización de outreach B2B con IA"
}'
fi

# ── Lead 4: Retail · Dir. Digital · Madrid ───────────────────────────────────
if [[ "$SELECTED" == "all" || "$SELECTED" == "4" ]]; then
run_test 4 "Miguel Torres — Dir. Transformación Digital @ El Corte Inglés" '{
  "name": "Miguel Torres",
  "title": "Director de Transformación Digital",
  "company": "El Corte Inglés",
  "industry": "Retail / Ecommerce",
  "location": "Madrid",
  "linkedin_url": "https://linkedin.com/in/miguel-torres-digital-eci",
  "profile_snippet": "Liderando la digitalización del grupo ECI: integración omnicanal, ecommerce B2C y herramientas internas. 8 años en Amazon antes de ficharme aquí.",
  "your_product": "Seiza — Plataforma de automatización de outreach B2B con IA"
}'
fi

# ── Lead 5: Fintech · CFO · Madrid (sin snippet) ─────────────────────────────
if [[ "$SELECTED" == "all" || "$SELECTED" == "5" ]]; then
run_test 5 "Patricia López — CFO @ Payflow (sin snippet)" '{
  "name": "Patricia López",
  "title": "CFO",
  "company": "Payflow",
  "industry": "Fintech / Salarios Flexibles",
  "location": "Madrid",
  "linkedin_url": "https://linkedin.com/in/patricia-lopez-cfo-payflow",
  "profile_snippet": "",
  "your_product": "Seiza — Plataforma de automatización de outreach B2B con IA"
}'
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Curl tests done."
echo "  Tip: set BASE_URL and API_KEY as env vars"
echo "  API_KEY=secret BASE_URL=http://localhost:3000 bash $0"
echo "══════════════════════════════════════════════"
