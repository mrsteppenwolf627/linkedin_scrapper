# 02_PROMPTS - Sistema LinkedIn Scraper V1

## Prompt 1: Parsing de Snippet de Google Search

**Nombre del prompt:** parse_linkedin_snippet_v1  
**Versión:** 1.0  
**Objetivo:** Extraer datos estructurados del snippet de Google Search sobre un perfil de LinkedIn  
**Input esperado:** Snippet de texto de Google (headline + descripción corta)  
**Output esperado:** JSON con campos: nombre, título, empresa, ubicación, años_exp, keywords_coinciden, es_valido

```
INPUT EXAMPLE:
"John Smith - Energy Consultant at Shell | 8 years experience in energy consulting"

OUTPUT EXAMPLE:
{
  "nombre": "John Smith",
  "titulo": "Energy Consultant",
  "empresa": "Shell",
  "ubicacion": null,
  "anos_experiencia": 8,
  "palabras_clave_encontradas": ["energy consultant", "8 years"],
  "score_confianza": 0.85,
  "es_valido": true,
  "notas": "Claro que cumple criterios"
}
```

### Instrucciones:

1. **Extrae el nombre**: asume que es lo primero antes del "-"
2. **Extrae el título y empresa**: busca patrones "Title at Company"
3. **Extrae años de experiencia**: busca números + "years" o "años"
4. **Valida contra criterios**: 
   - ¿Es un perfil de LinkedIn? (debe tener url linkedin.com/in/)
   - ¿Cumple el criterio de experiencia? (5+ años para este caso)
   - ¿Los keywords coinciden? (energía, consultoría, etc.)
5. **Score de confianza**: 0-1, basado en cuántos campos se extrajeron con claridad
6. **Valida lógicamente**: ¿tiene sentido la información? ¿contradice algo?

### Reglas importantes:

- Si no encontramos algo, devuelve null, NO asumir
- Si el nombre está vacío o es ambiguo, marca es_valido como false
- Los años de experiencia deben ser ≥5 para este criterio
- Si el snippet es muy corto o incompleto, es_valido = false pero comunica por qué

---

## Prompt 2: Validación de Contacto Enriquecido

**Nombre del prompt:** validate_contact_v1  
**Versión:** 1.0  
**Objetivo:** Validar que un contacto cumple todos los criterios de la búsqueda DESPUÉS de enriquecer con datos  
**Input esperado:** Objeto contacto con datos parseados + filtros de búsqueda  
**Output esperado:** Booleano is_valid + lista de razones si no es válido

```
INPUT:
{
  "contacto": {
    "nombre": "Jane Doe",
    "titulo": "Senior Energy Consultant",
    "empresa": "EnergiCorp",
    "anos_experiencia": 6,
    "linkedin_url": "https://linkedin.com/in/janedoe"
  },
  "filtros_busqueda": {
    "sector": "energía",
    "anos_minimos": 5,
    "palabras_clave": ["consultor", "energía"]
  }
}

OUTPUT:
{
  "is_valid": true,
  "razones_rechazo": [],
  "score_cumplimiento": 0.95,
  "notas": "Cumple todos los criterios"
}
```

### Instrucciones:

1. **Validar años**: ¿años_experiencia >= filtro anos_minimos?
2. **Validar sector**: ¿El título/empresa contiene referencias al sector?
3. **Validar palabras clave**: ¿Al menos 2 de las palabras clave aparecen en título/empresa?
4. **Validar URL**: ¿Es una URL válida de LinkedIn?
5. **Resultado final**: Solo es_valid=true si TODOS los criterios se cumplen

### En caso de rechazo, detalla POR QUÉ:
- "Años de experiencia insuficiente (4 < 5)"
- "No se encontraron palabras clave relevantes"
- "URL de LinkedIn inválida"
- Etc.

---

## Prompt 3: Deduplicación Inteligente

**Nombre del prompt:** check_duplicate_v1  
**Versión:** 1.0  
**Objetivo:** Determinar si dos contactos son la MISMA persona (para evitar duplicados en BD)  
**Input esperado:** Dos objetos contacto (nuevo + existente en BD)  
**Output esperado:** Booleano is_duplicate + confianza (0-1)

```
INPUT:
{
  "contacto_nuevo": {
    "nombre": "John Smith",
    "email": "john.smith@example.com",
    "linkedin_url": "https://linkedin.com/in/johnsmith"
  },
  "contacto_existente": {
    "nombre": "J. Smith",
    "email": "j.smith@example.com",
    "linkedin_url": "https://linkedin.com/in/john-smith"
  }
}

OUTPUT:
{
  "is_duplicate": true,
  "confianza": 0.9,
  "razon": "Misma URL LinkedIn normalizada + mismo email (variación)"
}
```

### Instrucciones:

1. **Nivel 1 - Email exacto**: Si emails coinciden exactamente → duplicado (confianza: 1.0)
2. **Nivel 2 - URL LinkedIn**: Normalizar ambas URLs, si coinciden → duplicado (confianza: 0.95)
3. **Nivel 3 - Nombre + Email similar**: Distancia Levenshtein entre nombres < 2 + emails similares → duplicado (confianza: 0.8)
4. **Nivel 4 - Nombre exacto + empresa**: Si nombre exacto + empresa idéntica → probablemente duplicado (confianza: 0.7)
5. **Si todo falla**: No es duplicado (confianza: 0.0)

---

## Prompt 4: Generación de Query Google Optimizado

**Nombre del prompt:** generate_google_query_v1  
**Versión:** 1.0  
**Objetivo:** Generar una query de búsqueda en Google óptima basada en filtros  
**Input esperado:** Objeto con filtros (sector, años, keywords)  
**Output esperado:** String con query de búsqueda

```
INPUT:
{
  "sector": "energía",
  "anos_minimos": 5,
  "palabras_clave": ["consultor", "solar"],
  "ubicacion": "España"
}

OUTPUT:
"site:linkedin.com/in (consultor OR consultant) (energía OR energy OR solar) (5+ años OR 5+ years OR 5+ years experience) España"
```

### Instrucciones:

1. **Siempre incluir**: site:linkedin.com/in (para forzar resultados de LinkedIn)
2. **Palabras clave**: Usar OR para múltiples variaciones (incluir EN + ES)
3. **Años de experiencia**: "5+ años" O "5+ years" O "5 years experience"
4. **Ubicación**: Si se proporciona, añadir al final
5. **Optimización**: Orden: keywords específicas → genéricas → años → ubicación

---

## Notas sobre los prompts:

- Todos asumen que trabajamos con snippets/datos públicos de Google
- Se pueden reutilizar en múltiples búsquedas
- Versionar cada cambio importante en el nombre del prompt
- Si un prompt falla consistentemente, revisar y actualizar versión

---

## Integración con Backend:

```javascript
// Ejemplo de cómo se usarían en el código:

const snippet = "Jane Doe - Senior Energy Consultant...";
const parsed = await callClaudePrompt("parse_linkedin_snippet_v1", { snippet });

if (parsed.es_valido) {
  const validated = await callClaudePrompt("validate_contact_v1", {
    contacto: parsed,
    filtros_busqueda: searchFilters
  });
  
  if (validated.is_valid) {
    const isDupe = await checkDuplicate(parsed.linkedin_url);
    if (!isDupe) {
      // Guardar en BD
    }
  }
}
```
