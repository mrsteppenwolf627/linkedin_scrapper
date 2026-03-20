// ============================================
// backend/lib/linkedin_scraper.ts
// Core orchestrator para búsquedas de LinkedIn
// ============================================

import Anthropic from "@anthropic-sdk/sdk";
import { createClient } from "@supabase/supabase-js";

// Tipos
interface SearchFilters {
  sector: string;
  years_min: number;
  keywords: string[];
  location?: string;
}

interface ParsedContact {
  nombre: string | null;
  titulo: string | null;
  empresa: string | null;
  ubicacion: string | null;
  anos_experiencia: number | null;
  palabras_clave_encontradas: string[];
  score_confianza: number;
  es_valido: boolean;
  notas: string;
}

interface ValidatedContact extends ParsedContact {
  is_valid: boolean;
  razones_rechazo: string[];
  score_cumplimiento: number;
}

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
}

// ============================================
// 1. GOOGLE SEARCH - Llamadas a Google
// ============================================

async function searchGoogle(
  query: string,
  maxResults: number = 10
): Promise<GoogleSearchResult[]> {
  // Opción A: Google Custom Search API (requiere setup)
  // Opción B: Serper.dev (más simple)
  // Opción C: SerpAPI

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY not found");

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
        gl: "es", // Google locale Spain
      }),
    });

    const data = await response.json();

    return (
      data.organic?.map((result: any) => ({
        title: result.title || "",
        link: result.link || "",
        snippet: result.snippet || "",
      })) || []
    );
  } catch (error) {
    console.error("Error searching Google:", error);
    throw error;
  }
}

// ============================================
// 2. CLAUDE PARSING - Extraer datos del snippet
// ============================================

async function parseLinkedInSnippet(
  snippet: string,
  linkedinUrl: string
): Promise<ParsedContact> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `
Eres un experto en parsear perfiles de LinkedIn. 

Tienes el siguiente snippet de búsqueda de Google sobre un perfil de LinkedIn:

**SNIPPET:**
${snippet}

**URL LINKEDIN:**
${linkedinUrl}

Extrae la información disponible y devuelve SOLO un JSON válido (sin markdown, sin explicaciones):

{
  "nombre": "nombre completo o null si no se encuentra",
  "titulo": "job title o null",
  "empresa": "company name o null",
  "ubicacion": "location o null",
  "anos_experiencia": número o null,
  "palabras_clave_encontradas": ["keyword1", "keyword2"],
  "score_confianza": 0.0 a 1.0 basado en claridad de datos,
  "es_valido": true/false,
  "notas": "breve explicación"
}

Reglas:
- Si no encuentras algo, devuelve null, NO asumir
- Score de confianza: 1.0 si todos los campos están claros, reduce por cada campo ambiguo
- es_valido = false si falta nombre o si el snippet es muy incompleto
- Revisa que sea realmente un perfil de LinkedIn
`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-1",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Limpiar markdown si la IA devuelve ```json ... ```
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const parsed: ParsedContact = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (error) {
    console.error("Error parsing snippet:", error);
    throw error;
  }
}

// ============================================
// 3. CLAUDE VALIDATION - Validar contra filtros
// ============================================

async function validateContact(
  contact: ParsedContact,
  filters: SearchFilters
): Promise<ValidatedContact> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `
Valida si este contacto cumple los criterios de búsqueda.

**CONTACTO:**
${JSON.stringify(contact, null, 2)}

**FILTROS DE BÚSQUEDA:**
- Sector: ${filters.sector}
- Años mínimos: ${filters.years_min}
- Palabras clave requeridas: ${filters.keywords.join(", ")}
- Ubicación (opcional): ${filters.location || "No especificada"}

Devuelve SOLO un JSON válido:

{
  "is_valid": true/false,
  "razones_rechazo": ["razón1", "razón2"],
  "score_cumplimiento": 0.0 a 1.0,
  "notas": "explicación breve"
}

Criterios de validación:
1. Si es_valido del contacto = false, rechazar
2. Si años_experiencia < años_min, rechazar
3. Si no hay overlap entre palabras_clave_encontradas y keywords, rechazar
4. Si título/empresa NO mencionan el sector, rechazar
5. Solo es_valid = true si TODOS los criterios se cumplen

Para score_cumplimiento: 
- +0.25 por cada año sobre el mínimo
- +0.20 por cada palabra clave coincidente
- -0.10 por cada razón de rechazo
`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-1",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const validation = JSON.parse(jsonMatch[0]);
    return { ...contact, ...validation };
  } catch (error) {
    console.error("Error validating contact:", error);
    throw error;
  }
}

// ============================================
// 4. DEDUPLICACIÓN
// ============================================

async function checkDuplicate(
  supabase: any,
  linkedinUrl: string,
  email: string | null
): Promise<{ isDuplicate: boolean; existingContactId?: string }> {
  // Normalizar URL LinkedIn
  const normalizedUrl = linkedinUrl
    .toLowerCase()
    .replace(/\/$/, "")
    .replace(/\?.*/, ""); // Remove query params

  // Búsqueda Nivel 1: URL exacta (normalizada)
  const { data: byUrl } = await supabase
    .from("contacts")
    .select("id")
    .eq("linkedin_url", normalizedUrl)
    .limit(1);

  if (byUrl && byUrl.length > 0) {
    return {
      isDuplicate: true,
      existingContactId: byUrl[0].id,
    };
  }

  // Búsqueda Nivel 2: Email exacto
  if (email) {
    const { data: byEmail } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email.toLowerCase())
      .limit(1);

    if (byEmail && byEmail.length > 0) {
      return {
        isDuplicate: true,
        existingContactId: byEmail[0].id,
      };
    }
  }

  // Búsqueda Nivel 3: Podría hacerse fuzzy match pero es más lento
  // Por ahora, mantenemos simple

  return { isDuplicate: false };
}

// ============================================
// 5. MAIN ORCHESTRATOR - Ejecutar búsqueda completa
// ============================================

interface ExecuteSearchResult {
  search_id: string;
  total_processed: number;
  total_created: number;
  total_duplicates: number;
  total_invalid: number;
  results: any[];
}

async function executeLinkedInSearch(
  searchName: string,
  googleQuery: string,
  filters: SearchFilters,
  maxResults: number = 30
): Promise<ExecuteSearchResult> {
  // Inicializar clientes
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  console.log(`🔍 Starting search: ${searchName}`);
  console.log(`📝 Query: ${googleQuery}`);

  // 1. Crear entrada en tabla searches
  const { data: searchRecord } = await supabase
    .from("searches")
    .insert({
      name: searchName,
      filters,
      google_query: googleQuery,
      status: "running",
    })
    .select()
    .single();

  const searchId = searchRecord.id;
  console.log(`✅ Search ID: ${searchId}`);

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalDuplicates = 0;
  let totalInvalid = 0;
  const results: any[] = [];

  try {
    // 2. Buscar en Google
    console.log(`\n🌐 Searching Google...`);
    const googleResults = await searchGoogle(googleQuery, maxResults);
    console.log(`Found ${googleResults.length} results from Google`);

    // 3. Procesar cada resultado
    for (const result of googleResults) {
      totalProcessed++;

      // Validar que sea URL de LinkedIn
      if (!result.link.includes("linkedin.com/in/")) {
        console.log(`⚠️  Skipped (not LinkedIn profile): ${result.link}`);
        continue;
      }

      console.log(`\n📌 Processing: ${result.title}`);

      // Parse snippet
      let parsed: ParsedContact;
      try {
        parsed = await parseLinkedInSnippet(result.snippet, result.link);
        if (!parsed.es_valido) {
          console.log(`❌ Invalid parse: ${parsed.notas}`);
          totalInvalid++;
          continue;
        }
      } catch (error) {
        console.error(`Parse error:`, error);
        totalInvalid++;
        continue;
      }

      // Validate against filters
      let validated: ValidatedContact;
      try {
        validated = await validateContact(parsed, filters);
        if (!validated.is_valid) {
          console.log(
            `❌ Validation failed: ${validated.razones_rechazo.join(", ")}`
          );
          totalInvalid++;
          continue;
        }
      } catch (error) {
        console.error(`Validation error:`, error);
        totalInvalid++;
        continue;
      }

      // Check duplicate
      const { isDuplicate, existingContactId } = await checkDuplicate(
        supabase,
        result.link,
        null
      );

      if (isDuplicate) {
        console.log(`🔄 Duplicate found (ID: ${existingContactId})`);
        totalDuplicates++;

        // Marcar como duplicado en BD
        await supabase
          .from("contacts")
          .update({
            is_duplicate: true,
            duplicate_of_id: existingContactId,
          })
          .eq("linkedin_url", result.link);

        continue;
      }

      // 4. Guardar en BD
      try {
        const contactData = {
          linkedin_url: result.link,
          name: validated.nombre || "Unknown",
          job_title: validated.titulo,
          company: validated.empresa,
          location: validated.ubicacion,
          years_experience: validated.anos_experiencia,
          is_valid: validated.is_valid,
          confidence_score: validated.score_confianza,
          matching_keywords: {
            matches: validated.palabras_clave_encontradas,
            count: validated.palabras_clave_encontradas.length,
          },
          search_id: searchId,
          raw_google_snippet: result.snippet,
          raw_parsed_data: parsed,
          raw_validation_result: validated,
          status: "new",
        };

        const { data: created } = await supabase
          .from("contacts")
          .insert(contactData)
          .select()
          .single();

        console.log(`✅ Saved: ${validated.nombre}`);
        totalCreated++;
        results.push(created);
      } catch (error: any) {
        // Si es unique constraint violation, marcar como duplicado
        if (error.code === "23505") {
          console.log(`🔄 Duplicate (constraint): ${result.link}`);
          totalDuplicates++;
        } else {
          console.error(`Save error:`, error);
          totalInvalid++;
        }
      }
    }

    // 5. Actualizar search record
    await supabase
      .from("searches")
      .update({
        status: "completed",
        total_results_google: googleResults.length,
        total_results_processed: totalProcessed,
        total_contacts_created: totalCreated,
        total_duplicates_found: totalDuplicates,
        total_invalid: totalInvalid,
      })
      .eq("id", searchId);

    console.log(`\n✨ Search completed!`);
    console.log(`  - Processed: ${totalProcessed}`);
    console.log(`  - Created: ${totalCreated}`);
    console.log(`  - Duplicates: ${totalDuplicates}`);
    console.log(`  - Invalid: ${totalInvalid}`);
  } catch (error) {
    console.error(`Fatal error in search:`, error);

    // Marcar búsqueda como fallida
    await supabase
      .from("searches")
      .update({
        status: "failed",
        error_message: String(error),
      })
      .eq("id", searchId);

    throw error;
  }

  return {
    search_id: searchId,
    total_processed: totalProcessed,
    total_created: totalCreated,
    total_duplicates: totalDuplicates,
    total_invalid: totalInvalid,
    results,
  };
}

// ============================================
// EXPORT
// ============================================

export {
  executeLinkedInSearch,
  searchGoogle,
  parseLinkedInSnippet,
  validateContact,
  checkDuplicate,
  SearchFilters,
  ParsedContact,
  ValidatedContact,
};
