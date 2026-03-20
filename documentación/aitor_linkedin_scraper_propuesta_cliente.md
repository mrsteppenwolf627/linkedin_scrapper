# PROPUESTA: Sistema de Búsqueda de Leads en LinkedIn

---

## RESUMEN EJECUTIVO

Sistema automatizado que busca y extrae perfiles de LinkedIn basándose en criterios específicos (sector, experiencia, especialidad), devolviendo una lista de contactos cualificados para prospección en frío.

**Valor:** Reduce búsqueda manual de 10h/semana → 5 minutos. 30-50 contactos cualificados por búsqueda.

---

## QUÉ ENTREGAMOS

### 1. Dashboard Web

- Crear búsquedas con filtros (sector, años experiencia, keywords, ubicación)
- Ver histórico de búsquedas realizadas
- Tabla con contactos encontrados (nombre, puesto, empresa, LinkedIn URL)
- Descargar resultados en CSV para usar en prospección

### 2. Datos Extraídos

Por cada perfil encontrado:
- ✅ Nombre
- ✅ Puesto actual
- ✅ Empresa
- ✅ Ubicación
- ✅ Años de experiencia (estimado)
- ✅ URL del perfil LinkedIn
- ✅ Score de confianza (0-100%)

### 3. Inteligencia

- Deduplicación automática (no envías 2 veces al mismo contacto)
- Validación de criterios (filtra automáticamente no calificados)
- Parsing inteligente con IA (Claude)
- Búsquedas ilimitadas

### 4. Infraestructura

- Alojado en Vercel (rápido, escalable)
- BD en Supabase (seguro, backups automáticos)
- API segura con autenticación

---

## CÓMO FUNCIONA

```
TÚ (usuario)
    ↓
[Dashboard Web]
    ↓
Defines: "Consultores energía, 5+ años, España"
    ↓
[Sistema]
├─ Busca en Google: "site:linkedin.com/in consultant energía..."
├─ Obtiene 30 resultados
├─ Claude parsea cada uno (extrae datos)
├─ Claude valida contra tus criterios
├─ Elimina duplicados
├─ Guarda en BD
    ↓
[Resultados]
├─ 24 contactos válidos encontrados
├─ Puedes ver tabla + descargar CSV
├─ Compartes lista con equipo de ventas
└─ Ellos hacen prospección en frío

⏱️ Tiempo total: 3-5 minutos
💼 Contactos listos: 20-50 por búsqueda
