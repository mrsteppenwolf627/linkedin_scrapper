"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, RefreshCw, Search as SearchIcon, ExternalLink, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

// --- TYPES ---

interface Search {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  total_results_processed: number;
  total_contacts_created: number;
  total_duplicates_found: number;
  total_invalid: number;
  created_at: string;
}

interface Contact {
  id: string;
  linkedin_url: string;
  name: string;
  job_title: string;
  company: string;
  location: string;
  years_experience: number;
  confidence_score: number;
  status: "new" | "contacted" | "converted" | "skipped" | "bounced";
  search_id: string;
}

interface FormData {
  jobTitle: string;
  experience: string;
  industry: string;
  location: string;
  maxResults: number;
}

// --- WABI-SABI THEME COLORS (Arbitrary Tailwind classes) ---
// Note: We use inline styles for the exact hex colors requested to ensure the Wabi-Sabi vibe.

const THEME = {
  bg: "#1c1b18",
  card: "#252520",
  cardHover: "#2e2d28",
  border: "#3a3933",
  text: "#e8e4dc",
  textMuted: "#8a8778",
  primary: "#c4935c", // Amber Terracotta
  success: "#7a9e7e", // Sage Green
  info: "#7a8fa0",    // Slate Blue
  error: "#a05c5c",   // Brick Red
};

export default function Dashboard() {
  const [searches, setSearches] = useState<Search[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Progress panel state
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    processed: number;
    created: number;
    duplicates: number;
    invalid: number;
    status: string;
  } | null>(null);

  // === FORM STATE ===
  const [formData, setFormData] = useState<FormData>({
    jobTitle: "",
    experience: "",
    industry: "",
    location: "",
    maxResults: 20,
  });

  // === GOOGLE QUERY PREVIEW ===
  const googleQueryPreview = useMemo(() => {
    const { jobTitle, experience, industry, location } = formData;
    if (!jobTitle && !experience && !industry && !location) {
      return "Esperando parámetros de búsqueda...";
    }
    return `inurl:linkedin.com/in/ intitle:"LinkedIn" ${jobTitle} ${experience} ${industry} ${location}`.trim();
  }, [formData]);

  // === CARGAR HISTORIAL ===
  const loadSearches = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/searches", {
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "",
        },
      });

      if (!response.ok) throw new Error("Failed to load searches");

      const data = await response.json();
      setSearches(data.searches ?? []);
    } catch (error) {
      console.error("Error loading searches:", error);
      toast.error("Error al cargar el historial de búsquedas");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSearches();
  }, [loadSearches]);

  // === CREAR BÚSQUEDA ===
  const handleCreateSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generación automática del identificador único
      const firstKeyword = formData.jobTitle.toLowerCase().split(' ')[0] || "search";
      const locationSlug = formData.location ? `-${formData.location.toLowerCase().replace(/\s+/g, "_")}` : "";
      const generatedName = `search-${firstKeyword}${locationSlug}-${Date.now()}`;

      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "",
        },
        body: JSON.stringify({
          search_name: generatedName,
          filters: {
            jobTitle: formData.jobTitle,
            experience: formData.experience,
            industry: formData.industry,
            location: formData.location,
            maxResults: formData.maxResults,
          },
          max_results: formData.maxResults,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al iniciar la búsqueda");
      }

      // --- SSE Stream Handling ---
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No se pudo obtener el reader del stream");

      setProgress({ processed: 0, created: 0, duplicates: 0, invalid: 0, status: "starting" });
      setContacts([]); // Clear previous contacts for real-time view
      
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.replace("event: ", "").trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            try {
              const data = JSON.parse(dataStr);

              switch (currentEvent) {
                case "search_created":
                  setActiveSearchId(data.search_id);
                  setSelectedSearch(data.search_id);
                  break;
                case "status":
                  setProgress(prev => prev ? { ...prev, status: data.message } : null);
                  break;
                case "lead_found":
                  setContacts(prev => [data, ...prev]);
                  setProgress(prev => prev ? { ...prev, created: prev.created + 1, processed: prev.processed + 1 } : null);
                  break;
                case "done":
                  toast.success(`Búsqueda completada: ${data.total_created} leads encontrados`, {
                    style: { background: THEME.card, color: THEME.success, border: `1px solid ${THEME.border}` }
                  });
                  setActiveSearchId(null);
                  loadSearches();
                  break;
                case "error":
                  toast.error(`Error en el stream: ${data.message}`);
                  setActiveSearchId(null);
                  break;
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      setFormData({
        jobTitle: "",
        experience: "",
        industry: "",
        location: "",
        maxResults: 20,
      });

    } catch (error: any) {
      console.error("Error:", error);
      toast.error(`Error crítico: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // === CARGAR CONTACTOS DE UNA BÚSQUEDA ===
  const loadContactsForSearch = async (searchId: string) => {
    try {
      const response = await fetch(`/api/contacts?search_id=${searchId}`, {
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "",
        },
      });

      if (!response.ok) throw new Error("Failed to load contacts");

      const data = await response.json();
      setContacts(data.contacts ?? []);
      setSelectedSearch(searchId);
      toast.info(`Cargados ${data.total ?? 0} contactos`, {
        style: { background: THEME.card, color: THEME.text, border: `1px solid ${THEME.border}` }
      });
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Error al cargar los contactos");
    }
  };

  // === ACTUALIZAR STATUS DE CONTACTO ===
  const updateContactStatus = async (contactId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/contacts?id=${contactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus as any } : c));
      toast.success("Estado actualizado", {
        style: { background: THEME.card, color: THEME.success, border: `1px solid ${THEME.border}` }
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error al actualizar el estado");
    }
  };

  // === DESCARGAR CSV ===
  const downloadCSV = () => {
    if (contacts.length === 0) {
      toast.warning("No hay contactos para descargar");
      return;
    }

    const headers = ["Nombre", "Puesto", "Empresa", "Ubicación", "Exp.", "Confianza", "Status", "URL"];
    const rows = contacts.map((c) => [
      c.name, c.job_title, c.company, c.location, c.years_experience,
      (c.confidence_score * 100).toFixed(0) + "%", c.status, c.linkedin_url,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_wabi_${selectedSearch}.csv`;
    a.click();
    toast.success("CSV exportado con éxito");
  };

  // === UI HELPERS ===

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return THEME.success;
      case 'running': return THEME.info;
      case 'failed': return THEME.error;
      default: return THEME.textMuted;
    }
  };

  const getContactStatusColor = (status: string) => {
    switch (status) {
      case 'new': return THEME.textMuted;
      case 'contacted': return THEME.info;
      case 'converted': return THEME.success;
      case 'skipped': return THEME.primary; // Ocre
      case 'bounced': return THEME.error;
      default: return THEME.textMuted;
    }
  };

  return (
    <div className="min-h-screen font-sans tracking-normal" style={{ backgroundColor: THEME.bg, color: THEME.text }}>
      
      {/* HEADER WABI-SABI */}
      <header className="border-b sticky top-0 z-20" style={{ backgroundColor: THEME.bg, borderColor: THEME.border }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg shadow-inner" style={{ backgroundColor: THEME.primary }}>
              <SearchIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold italic tracking-wide">
                LinkedIn Scraper <span className="font-normal text-xs opacity-50 ml-1">v1.1 Wabi-Sabi</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-slate-700 text-xs px-3 py-1" style={{ color: THEME.textMuted }}>
              Hecho con cuidado artesanal
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 space-y-12">
        
        {/* PROGRESS PANEL (LIVE) */}
        {activeSearchId && progress && (
          <Card className="animate-in fade-in slide-in-from-top-4 duration-700" style={{ backgroundColor: THEME.card, borderColor: THEME.primary, borderWidth: '1px' }}>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 animate-spin" style={{ color: THEME.primary }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME.primary }}></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Búsqueda en curso...</h3>
                    <p className="text-sm opacity-60">Claude está analizando perfiles de LinkedIn</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 tabular-nums">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{progress.processed}</div>
                    <div className="text-xs uppercase tracking-widest opacity-40">Procesados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: THEME.success }}>{progress.created}</div>
                    <div className="text-xs uppercase tracking-widest opacity-40">Creados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: THEME.primary }}>{progress.duplicates}</div>
                    <div className="text-xs uppercase tracking-widest opacity-40">Duplicados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: THEME.error }}>{progress.invalid}</div>
                    <div className="text-xs uppercase tracking-widest opacity-40">Inválidos</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="create" className="space-y-8">
          <TabsList className="p-1 rounded-xl border" style={{ backgroundColor: THEME.card, borderColor: THEME.border }}>
            <TabsTrigger value="create" className="px-8 py-2 rounded-lg data-[state=active]:text-white transition-all" style={{ '--tw-state-active-bg': THEME.primary } as any}>
              Nueva Búsqueda
            </TabsTrigger>
            <TabsTrigger value="history" className="px-8 py-2 rounded-lg data-[state=active]:text-white transition-all" style={{ '--tw-state-active-bg': THEME.primary } as any}>
              Historial
            </TabsTrigger>
          </TabsList>

          {/* TAB: CREAR BÚSQUEDA */}
          <TabsContent value="create" className="animate-in fade-in duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
              <div className="lg:col-span-3">
                <Card className="shadow-2xl rounded-2xl overflow-hidden" style={{ backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <CardHeader className="border-b" style={{ borderColor: THEME.border }}>
                    <CardTitle className="text-xl flex items-center gap-3">
                      <div className="w-1 h-6 rounded-full" style={{ backgroundColor: THEME.primary }}></div>
                      Configuración Orgánica
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-8">
                    <form onSubmit={handleCreateSearch} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <Label htmlFor="jobTitle" className="text-sm opacity-70">Puesto</Label>
                          <Input
                            id="jobTitle"
                            type="text"
                            placeholder="Ej: Director de Marketing, Frontend..."
                            value={formData.jobTitle}
                            onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                            className="py-6 rounded-xl border-none ring-1 ring-inset focus:ring-2"
                            style={{ backgroundColor: THEME.bg, color: THEME.text, '--tw-ring-color': THEME.border } as any}
                            required
                          />
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="experience" className="text-sm opacity-70">Años de experiencia</Label>
                          <Input
                            id="experience"
                            type="text"
                            placeholder="Ej: 5 años, Senior, +3..."
                            value={formData.experience}
                            onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                            className="py-6 rounded-xl border-none ring-1 ring-inset focus:ring-2"
                            style={{ backgroundColor: THEME.bg, color: THEME.text, '--tw-ring-color': THEME.border } as any}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <Label htmlFor="industry" className="text-sm opacity-70">Sector</Label>
                          <Input
                            id="industry"
                            type="text"
                            placeholder="Ej: Tecnología, Salud, Finanzas..."
                            value={formData.industry}
                            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                            className="py-6 rounded-xl border-none ring-1 ring-inset focus:ring-2"
                            style={{ backgroundColor: THEME.bg, color: THEME.text, '--tw-ring-color': THEME.border } as any}
                            required
                          />
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="location" className="text-sm opacity-70">Localización</Label>
                          <Input
                            id="location"
                            type="text"
                            placeholder="Ej: Madrid, España, Remoto..."
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="py-6 rounded-xl border-none ring-1 ring-inset focus:ring-2"
                            style={{ backgroundColor: THEME.bg, color: THEME.text, '--tw-ring-color': THEME.border } as any}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <Label htmlFor="maxResults" className="text-sm opacity-70">Cantidad de resultados</Label>
                          <Select
                            value={formData.maxResults.toString()}
                            onValueChange={(val) => setFormData({ ...formData, maxResults: parseInt(val) })}
                          >
                            <SelectTrigger 
                              className="py-6 rounded-xl border-none ring-1 ring-inset focus:ring-2"
                              style={{ backgroundColor: THEME.bg, color: THEME.text, '--tw-ring-color': THEME.border } as any}
                            >
                              <SelectValue placeholder="Selecciona cantidad" />
                            </SelectTrigger>
                            <SelectContent style={{ backgroundColor: THEME.card, color: THEME.text, borderColor: THEME.border }}>
                              <SelectItem value="10">10 resultados</SelectItem>
                              <SelectItem value="20">20 resultados</SelectItem>
                              <SelectItem value="30">30 resultados</SelectItem>
                              <SelectItem value="50">50 resultados</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="hidden md:block"></div>
                      </div>

                      {/* QUERY PREVIEW */}
                      <div className="p-4 rounded-xl border border-dashed text-xs space-y-2" style={{ backgroundColor: THEME.bg, borderColor: THEME.border }}>
                         <div className="flex items-center gap-2 opacity-40 uppercase tracking-tighter">
                            <SearchIcon className="w-3 h-3" />
                            Preview de Google Query
                         </div>
                         <code className="block break-all opacity-60 font-mono leading-relaxed" style={{ color: THEME.textMuted }}>
                           {googleQueryPreview}
                         </code>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full py-8 rounded-xl font-bold text-lg shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3"
                        style={{ backgroundColor: THEME.primary, color: 'white' }}
                      >
                        {loading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <SearchIcon className="w-5 h-5" />
                            Lanzar Scraper
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-8">
                <Card className="rounded-2xl border-none" style={{ backgroundColor: THEME.card }}>
                  <CardHeader>
                    <CardTitle className="text-lg italic opacity-80">Filosofía Wabi-Sabi</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-relaxed space-y-4" style={{ color: THEME.textMuted }}>
                    <p>Este scraper no es solo una herramienta técnica; es un proceso artesanal de filtrado.</p>
                    <p>Claude analiza cada perfil buscando la esencia: experiencia real, coherencia y valor humano.</p>
                    <div className="pt-4 border-t" style={{ borderColor: THEME.border }}>
                       <ul className="space-y-3">
                          <li className="flex gap-3">
                             <CheckCircle2 className="w-4 h-4 mt-0.5" style={{ color: THEME.success }} />
                             <span>Validación semántica de años de experiencia.</span>
                          </li>
                          <li className="flex gap-3">
                             <CheckCircle2 className="w-4 h-4 mt-0.5" style={{ color: THEME.success }} />
                             <span>Detección inteligente de duplicados.</span>
                          </li>
                          <li className="flex gap-3">
                             <CheckCircle2 className="w-4 h-4 mt-0.5" style={{ color: THEME.success }} />
                             <span>Score de confianza basado en la solidez del perfil.</span>
                          </li>
                       </ul>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="p-6 rounded-2xl border border-dashed italic text-xs text-center" style={{ borderColor: THEME.border, color: THEME.textMuted }}>
                  "La perfección es una pulida mentira. La verdad reside en los datos imperfectos, bien filtrados."
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB: HISTORIAL */}
          <TabsContent value="history" className="animate-in fade-in duration-700">
            <div className="space-y-10">
              <Card className="rounded-2xl border-none shadow-xl overflow-hidden" style={{ backgroundColor: THEME.card }}>
                <CardHeader className="flex flex-row items-center justify-between border-b" style={{ borderColor: THEME.border }}>
                  <CardTitle className="text-xl">Búsquedas Recientes</CardTitle>
                  <Button
                    onClick={() => loadSearches()}
                    variant="ghost"
                    size="sm"
                    disabled={refreshing}
                    className="hover:bg-slate-800/50 rounded-lg"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} style={{ color: THEME.primary }} />
                    <span style={{ color: THEME.textMuted }}>Actualizar</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {searches.length === 0 ? (
                    <div className="text-center py-20 opacity-20">
                       <SearchIcon className="w-16 h-16 mx-auto mb-4" />
                       <p className="italic">El archivo está vacío. Aún no hay huellas de búsquedas.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="opacity-40 text-xs uppercase tracking-tighter">
                          <TableRow className="border-b" style={{ borderColor: THEME.border }}>
                            <TableHead className="py-6 px-6">Nombre</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Contactos</TableHead>
                            <TableHead className="text-right">Progreso</TableHead>
                            <TableHead className="text-right px-6">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searches.map((search) => (
                            <TableRow key={search.id} className="group transition-colors border-b last:border-none" style={{ borderColor: THEME.border, '--tw-hover-bg': THEME.cardHover } as any}>
                              <TableCell className="py-6 px-6 font-bold text-slate-200">
                                {search.name}
                                <div className="text-[10px] font-normal opacity-30 tabular-nums">
                                  {new Date(search.created_at).toLocaleString()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {search.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" style={{ color: THEME.info }} />}
                                  <Badge variant="outline" className="text-[10px] uppercase border-none px-0" style={{ color: getStatusColor(search.status) }}>
                                    {search.status === 'running' ? 'En proceso' : 
                                     search.status === 'completed' ? 'Completada' : 
                                     search.status === 'failed' ? 'Error' : 'Pendiente'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-bold tabular-nums" style={{ color: THEME.success }}>
                                {search.total_contacts_created}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs opacity-50">
                                {search.total_results_processed} analizados
                              </TableCell>
                              <TableCell className="text-right px-6">
                                <Button
                                  onClick={() => loadContactsForSearch(search.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-lg hover:bg-slate-800"
                                  style={{ color: THEME.primary }}
                                >
                                  Ver Leads
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* TABLA DE RESULTADOS DETALLADOS */}
              {selectedSearch && (
                <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                  <div className="flex items-center justify-between">
                     <div>
                        <h2 className="text-2xl font-bold italic">Leads Encontrados</h2>
                        <p className="text-sm opacity-50">Mostrando {contacts.length} resultados validados por Claude.</p>
                     </div>
                     <Button
                        onClick={downloadCSV}
                        disabled={contacts.length === 0}
                        className="rounded-xl shadow-lg shadow-emerald-950/20"
                        style={{ backgroundColor: THEME.success, color: 'white' }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar CSV
                      </Button>
                  </div>

                  <Card className="rounded-2xl border-none shadow-2xl overflow-hidden" style={{ backgroundColor: THEME.card }}>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="opacity-40 text-[10px] uppercase">
                            <TableRow className="border-b" style={{ borderColor: THEME.border }}>
                              <TableHead className="py-6 px-6">Perfil</TableHead>
                              <TableHead>Cargo & Empresa</TableHead>
                              <TableHead>Ubicación</TableHead>
                              <TableHead className="text-right">Status CRM</TableHead>
                              <TableHead className="text-right">IA Conf.</TableHead>
                              <TableHead className="text-right px-6">Link</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-20 text-center italic opacity-30">
                                        No hay contactos disponibles para esta búsqueda.
                                    </TableCell>
                                </TableRow>
                            ) : (
                              contacts.map((contact) => (
                                <TableRow key={contact.id} className="group border-b last:border-none" style={{ borderColor: THEME.border, '--tw-hover-bg': THEME.cardHover } as any}>
                                  <TableCell className="py-6 px-6">
                                    <div className="font-bold text-slate-200">{contact.name}</div>
                                    <div className="text-[10px] opacity-40 tabular-nums">{contact.years_experience} años de exp.</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm leading-snug">{contact.job_title}</div>
                                    <div className="text-xs opacity-50">{contact.company}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-xs italic opacity-60 flex items-center gap-1">
                                       <Badge variant="outline" className="text-[9px] border-none p-0 opacity-50 uppercase tracking-tighter">Loc</Badge>
                                       {contact.location}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Select
                                      value={contact.status}
                                      onValueChange={(val) => updateContactStatus(contact.id, val ?? "new")}
                                    >
                                      <SelectTrigger className="w-32 ml-auto h-8 text-[10px] border-none ring-1 ring-inset rounded-lg" style={{ backgroundColor: THEME.bg, '--tw-ring-color': THEME.border } as any}>
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getContactStatusColor(contact.status) }}></div>
                                          <SelectValue />
                                        </div>
                                      </SelectTrigger>
                                      <SelectContent className="border-none shadow-2xl" style={{ backgroundColor: THEME.card, color: THEME.text }}>
                                        <SelectItem value="new" className="text-[10px]">New</SelectItem>
                                        <SelectItem value="contacted" className="text-[10px]">Contacted</SelectItem>
                                        <SelectItem value="converted" className="text-[10px]">Converted</SelectItem>
                                        <SelectItem value="skipped" className="text-[10px]">Skipped</SelectItem>
                                        <SelectItem value="bounced" className="text-[10px]">Bounced</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="inline-flex flex-col items-end">
                                       <span className="font-bold tabular-nums" style={{ color: contact.confidence_score > 0.8 ? THEME.success : contact.confidence_score > 0.5 ? THEME.primary : THEME.error }}>
                                         {(contact.confidence_score * 100).toFixed(0)}%
                                       </span>
                                       <div className="w-12 h-1 rounded-full bg-slate-800 mt-1">
                                          <div className="h-full rounded-full" style={{ width: `${contact.confidence_score * 100}%`, backgroundColor: contact.confidence_score > 0.8 ? THEME.success : THEME.primary }}></div>
                                       </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right px-6">
                                    <a
                                      href={contact.linkedin_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-400 underline transition-colors text-xs flex items-center justify-end gap-1"
                                    >
                                      Ver Perfil
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="max-w-7xl mx-auto p-12 text-center border-t mt-20" style={{ borderColor: THEME.border }}>
        <div className="flex flex-col items-center gap-4 opacity-30 italic text-xs">
           <p>&copy; 2026 LinkedIn Lead Scraper V1 — Un proceso imperfecto pero auténtico.</p>
           <div className="flex gap-4">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Tabular Nums Only</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> AI Validated</span>
           </div>
        </div>
      </footer>
    </div>
  );
}
