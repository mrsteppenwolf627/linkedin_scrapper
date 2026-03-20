// pages/api/search.ts
// Endpoint: POST /api/search
// Ejecuta una búsqueda de LinkedIn y retorna search_id + status

import { NextApiRequest, NextApiResponse } from "next";
import { executeLinkedInSearch, SearchFilters } from "@/backend/lib/linkedin_scraper";

interface RequestBody {
  search_name: string;
  google_query: string;
  filters: SearchFilters;
  max_results?: number;
}

interface ErrorResponse {
  error: string;
  message: string;
}

interface SuccessResponse {
  search_id: string;
  status: "running" | "queued";
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  // Validar método
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only POST requests are allowed",
    });
  }

  // Validar API key (si existe)
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.SEARCH_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing API key",
    });
  }

  try {
    const { search_name, google_query, filters, max_results = 30 }: RequestBody =
      req.body;

    // Validar campos requeridos
    if (!search_name || !google_query || !filters) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Missing required fields: search_name, google_query, filters",
      });
    }

    // Validar filtros
    if (!filters.sector || filters.years_min === undefined || !filters.keywords) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Invalid filters. Required: sector, years_min, keywords (array)",
      });
    }

    // Ejecutar búsqueda (asincrónica, sin esperar completación)
    // En producción, usar queue system como Bull/BullMQ
    executeLinkedInSearch(search_name, google_query, filters, max_results)
      .then(() => {
        console.log(`✅ Search ${search_name} completed`);
      })
      .catch((error) => {
        console.error(`❌ Search ${search_name} failed:`, error);
      });

    // Responder inmediatamente
    return res.status(202).json({
      search_id: "generating...", // Se obtendrá del WS o polling
      status: "queued",
      message: "Search queued for processing. Check status with search_id",
    });
  } catch (error) {
    console.error("API error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
      message: String(error),
    });
  }
}

// ============================================
// ALTERNATIVA: Con Sistema de Cola (Bull)
// ============================================

/*
import Bull from 'bull';

const searchQueue = new Bull('linkedin_searches', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
  }
});

searchQueue.process(async (job) => {
  const { search_name, google_query, filters, max_results } = job.data;
  
  // Actualizar progreso
  job.progress(10);
  
  const result = await executeLinkedInSearch(
    search_name,
    google_query,
    filters,
    max_results
  );
  
  return result;
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only POST requests are allowed",
    });
  }

  try {
    const { search_name, google_query, filters, max_results = 30 }: RequestBody =
      req.body;

    // Validaciones...
    if (!search_name || !google_query || !filters) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Missing required fields",
      });
    }

    // Encolar búsqueda
    const job = await searchQueue.add(
      { search_name, google_query, filters, max_results },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      }
    );

    return res.status(202).json({
      search_id: job.id.toString(),
      status: "queued",
      message: `Search queued. Job ID: ${job.id}`,
    });
  } catch (error) {
    console.error("API error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
      message: String(error),
    });
  }
}
*/
