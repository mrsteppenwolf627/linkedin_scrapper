"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Download, RefreshCw, Search as SearchIcon, ExternalLink, Activity } from "lucide-react";
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

// --- UI HELPERS & THEME ---
const THEME = {
  bg: "#F0EDE4",       // Crema papel
  sidebar: "#E8E4DB",  // Sidebar crema oscuro
  black: "#1A1A1A",    // Negro principal
  orange: "#D94F00",   // Naranja acento
  green: "#4A7C59",    // Verde sistema
  textMuted: "#6B6B5E",// Gris texto
  white: "#FFFFFF"
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  const [searches, setSearches] = useState<Search[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [systemTime, setSystemTime] = useState("");
  const [scanningText, setScanningText] = useState("SCANNING...");
  
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

  // --- SYSTEM CLOCK ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('en-GB', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- SCANNING TEXT ANIMATION ---
  useEffect(() => {
    if (loading) {
      const texts = ["SCANNING...", "FETCHING...", "VALIDATING...", "INDEXING..."];
      let i = 0;
      const interval = setInterval(() => {
        setScanningText(texts[i % texts.length]);
        i++;
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [loading]);

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
      toast.error("ERROR: HISTORIAL_LOAD_FAILED");
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
          },
          max_results: formData.maxResults,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "SCAN_INIT_ERROR");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("STREAM_READER_NOT_FOUND");

      setProgress({ processed: 0, created: 0, duplicates: 0, invalid: 0, status: "INITIALIZING" });
      setContacts([]);
      
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
                  break;
                case "status":
                  setProgress(prev => prev ? { ...prev, status: data.message.toUpperCase() } : null);
                  break;
                case "lead_found":
                  setContacts(prev => [data, ...prev]);
                  setProgress(prev => prev ? { ...prev, created: prev.created + 1, processed: prev.processed + 1 } : null);
                  break;
                case "done":
                  toast.success(`SCAN_COMPLETE: ${data.total_created} LEADS`);
                  setActiveSearchId(null);
                  loadSearches();
                  break;
                case "error":
                  toast.error(`STREAM_ERROR: ${data.message}`);
                  setActiveSearchId(null);
                  break;
              }
            } catch (e) { console.error(e); }
          }
        }
      }
      setFormData({ jobTitle: "", experience: "", industry: "", location: "", maxResults: 20 });
    } catch (error: any) {
      console.error(error);
      toast.error(`CRITICAL_ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // === CARGAR CONTACTOS DE UNA BÚSQUEDA ===
  const loadContactsForSearch = async (searchId: string) => {
    if (selectedSearch === searchId) {
      setSelectedSearch(null);
      return;
    }
    try {
      const response = await fetch(`/api/contacts?search_id=${searchId}`, {
        headers: { "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "" },
      });
      if (!response.ok) throw new Error("CONTACTS_LOAD_FAILED");
      const data = await response.json();
      setContacts(data.contacts ?? []);
      setSelectedSearch(searchId);
    } catch (error) {
      toast.error("ERROR: CONTACTS_FETCH");
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
      if (!response.ok) throw new Error("STATUS_UPDATE_FAILED");
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus as any } : c));
      toast.success("STATUS: UPDATED_OK");
    } catch (error) {
      toast.error("ERROR: STATUS_SYNC");
    }
  };

  // === DESCARGAR CSV ===
  const downloadCSV = () => {
    if (contacts.length === 0) return;
    const headers = ["Nombre", "Puesto", "Empresa", "Ubicación", "Exp.", "IA_Score", "Status", "URL"];
    const rows = contacts.map(c => [c.name, c.job_title, c.company, c.location, c.years_experience, c.confidence_score, c.status, c.linkedin_url]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LOG_EXPORT_${selectedSearch}.csv`;
    a.click();
    toast.success("EXPORT: SUCCESSFUL");
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-mono text-[#1A1A1A] bg-[#F0EDE4]">
      
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR IZQUIERDO */}
        <aside className="w-[220px] flex-shrink-0 bg-[#E8E4DB] border-r-2 border-[#1A1A1A] flex flex-col p-6 space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl font-black leading-tight tracking-tighter uppercase">WABI-SABI.SYS</h1>
            <p className="text-[10px] opacity-60">TERMINAL_V1.2_BUILD</p>
          </div>

          <nav className="flex-1 space-y-4">
            <button
              onClick={() => setActiveTab("create")}
              className={`w-full text-left px-4 py-3 border-2 transition-all font-bold text-sm ${
                activeTab === "create" ? "bg-white border-[#D94F00] shadow-[4px_4px_0px_#D94F00]" : "border-[#1A1A1A] hover:bg-[#F0EDE4]"
              }`}
            >
              NUEVO_ESCANEO
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`w-full text-left px-4 py-3 border-2 transition-all font-bold text-sm ${
                activeTab === "history" ? "bg-white border-[#D94F00] shadow-[4px_4px_0px_#D94F00]" : "border-[#1A1A1A] hover:bg-[#F0EDE4]"
              }`}
            >
              VER_RESULTADOS
            </button>
          </nav>

          <div className="text-[10px] space-y-1 border-t-2 border-[#1A1A1A] pt-4 opacity-70">
            <div>KERNEL: <span className="text-[#4A7C59]">STABLE_OK</span></div>
            <div>SCAN_LOC: GLOBAL</div>
            <div>SYS_TIME: {systemTime}</div>
          </div>
        </aside>

        {/* ÁREA CENTRAL */}
        <main className="flex-1 overflow-y-auto p-10 relative">
          
          {/* BANNER DE PROGRESO (LIVE) */}
          {activeSearchId && progress && (
            <div className="mb-8 border-2 border-[#1A1A1A] bg-[#1A1A1A] text-white p-4 shadow-[4px_4px_0px_#4A7C59]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-[#4A7C59] animate-pulse"></div>
                  <span className="font-bold tracking-widest text-sm uppercase">BÚSQUEDA EN CURSO: {progress.status}</span>
                </div>
                <div className="flex gap-6 text-[11px] tabular-nums">
                  <span>PROC: {progress.processed}</span>
                  <span className="text-[#4A7C59]">CREA: {progress.created}</span>
                  <span className="text-[#D94F00]">DUPL: {progress.duplicates}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "create" ? (
            <div className="max-w-3xl space-y-8 animate-in fade-in duration-500">
              <div className="border-b-4 border-[#1A1A1A] pb-4">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">DATA_ACQUISITION_MODULE</h2>
              </div>

              <form onSubmit={handleCreateSearch} className="space-y-10">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold tracking-widest block uppercase">CARGO_OBJETIVO</label>
                    <input
                      type="text"
                      placeholder="EJ: FRONTEND DEVELOPER"
                      value={formData.jobTitle}
                      onChange={e => setFormData({ ...formData, jobTitle: e.target.value })}
                      className="w-full bg-white border-2 border-[#1A1A1A] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F00] placeholder:opacity-30 uppercase"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold tracking-widest block uppercase">NIVEL_EXPERIENCIA</label>
                    <input
                      type="text"
                      placeholder="EJ: 5 AÑOS / SENIOR"
                      value={formData.experience}
                      onChange={e => setFormData({ ...formData, experience: e.target.value })}
                      className="w-full bg-white border-2 border-[#1A1A1A] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F00] placeholder:opacity-30 uppercase"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold tracking-widest block uppercase">SECTOR_DOMINIO</label>
                    <input
                      type="text"
                      placeholder="EJ: TECNOLOGÍA / SAAS"
                      value={formData.industry}
                      onChange={e => setFormData({ ...formData, industry: e.target.value })}
                      className="w-full bg-white border-2 border-[#1A1A1A] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F00] placeholder:opacity-30 uppercase"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold tracking-widest block uppercase">LOCALIZACIÓN_LOCK</label>
                    <input
                      type="text"
                      placeholder="EJ: MADRID / ESPAÑA"
                      value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-white border-2 border-[#1A1A1A] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F00] placeholder:opacity-30 uppercase"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold tracking-widest block uppercase">SCAN_DEPTH</label>
                  <div className="flex gap-4">
                    {[10, 20, 30, 50].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setFormData({ ...formData, maxResults: val })}
                        className={`px-6 py-2 border-2 font-bold text-xs transition-colors ${
                          formData.maxResults === val ? "bg-[#1A1A1A] text-white border-[#1A1A1A]" : "bg-white border-[#1A1A1A] hover:bg-[#E8E4DB]"
                        }`}
                      >
                        {val} NODES
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1A1A1A] text-[#F0EDE4] py-6 border-2 border-[#1A1A1A] font-black text-xl hover:bg-[#D94F00] transition-colors shadow-[6px_6px_0px_#1A1A1A] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-4 uppercase"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      {scanningText}
                    </>
                  ) : (
                    "INITIALIZE_SCAN >"
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="border-b-4 border-[#1A1A1A] pb-4 flex items-center justify-between">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">SCAN_HISTORY_LOG</h2>
                <button onClick={loadSearches} className="p-2 border-2 border-[#1A1A1A] bg-white hover:bg-[#E8E4DB]">
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="space-y-6">
                {searches.map((search) => (
                  <div key={search.id} className="border-2 border-[#1A1A1A] bg-white overflow-hidden shadow-[4px_4px_0px_#1A1A1A]">
                    <div 
                      onClick={() => loadContactsForSearch(search.id)}
                      className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#E8E4DB] transition-colors"
                    >
                      <div className="flex items-center gap-6">
                        <div className="font-black text-lg uppercase">{search.name}</div>
                        <div className="text-[10px] opacity-40 uppercase tabular-nums">{new Date(search.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-xs font-bold text-[#4A7C59]">{search.total_contacts_created} LEADS</div>
                        <div className={`text-[10px] px-2 py-1 font-black ${
                          search.status === 'completed' ? 'bg-[#4A7C59] text-white' : 
                          search.status === 'running' ? 'bg-[#D94F00] text-white animate-pulse' : 'bg-red-800 text-white'
                        }`}>
                          {search.status.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {selectedSearch === search.id && (
                      <div className="border-t-2 border-[#1A1A1A] p-6 bg-[#F0EDE4] animate-in slide-in-from-top-4">
                        <div className="flex items-center justify-between mb-6">
                           <h3 className="text-sm font-black tracking-widest underline underline-offset-4 uppercase">DETAILED_LEAD_REPORT</h3>
                           <button onClick={downloadCSV} className="bg-[#4A7C59] text-white px-4 py-2 border-2 border-[#1A1A1A] text-[10px] font-bold hover:bg-[#1A1A1A] transition-colors flex items-center gap-2 shadow-[3px_3px_0px_#1A1A1A] uppercase">
                             <Download className="w-3 h-3" /> EXPORT_CSV
                           </button>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b-2 border-[#1A1A1A] text-[9px] font-bold opacity-50 uppercase">
                                <th className="py-2">FULL_NAME</th>
                                <th>ROLE_COMPANY</th>
                                <th>LOCATION</th>
                                <th className="text-right">CONFIDENCE</th>
                                <th className="text-right px-4">ACTION</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contacts.length === 0 ? (
                                <tr><td colSpan={5} className="py-8 text-center text-xs italic opacity-40 uppercase">NO_DATA_AVAILABLE_IN_THIS_NODE</td></tr>
                              ) : (
                                contacts.map(c => (
                                  <tr key={c.id} className="border-b border-[#1A1A1A]/10 text-xs hover:bg-white/50 transition-colors">
                                    <td className="py-4 font-black uppercase">{c.name}</td>
                                    <td>
                                      <div className="font-bold uppercase">{c.job_title}</div>
                                      <div className="text-[10px] opacity-50 uppercase">{c.company}</div>
                                    </td>
                                    <td className="uppercase">{c.location}</td>
                                    <td className="text-right tabular-nums font-bold">
                                      <span style={{ color: c.confidence_score > 0.8 ? THEME.green : THEME.orange }}>
                                        {(c.confidence_score * 100).toFixed(0)}%
                                      </span>
                                    </td>
                                    <td className="text-right px-4">
                                      <a href={c.linkedin_url} target="_blank" className="font-black text-[#D94F00] hover:underline flex items-center justify-end gap-1 uppercase">
                                        VIEW_PROFILE <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* PANEL DERECHO */}
        <aside className="w-[280px] flex-shrink-0 bg-[#1A1A1A] text-[#F0EDE4] p-8 border-l-2 border-[#1A1A1A] hidden xl:flex flex-col justify-between">
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black tracking-[0.3em] opacity-40 uppercase underline">PHILOSOPHY_PROT</h3>
              <p className="text-sm italic leading-relaxed opacity-80 uppercase">
                "La perfección es una pulida mentira. La verdad reside en los datos imperfectos, bien filtrados."
              </p>
              <div className="h-[2px] w-12 bg-[#D94F00]"></div>
            </div>

            <div className="space-y-4 pt-10">
              <h3 className="text-xs font-black tracking-[0.3em] opacity-40 uppercase underline">ACTIVE_PARAMETERS</h3>
              <div className="space-y-3 text-[10px] font-bold tabular-nums uppercase">
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>LLM_KERNEL:</span>
                  <span className="text-[#4A7C59]">GPT-4O-MINI</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>DEDUP_LAYER:</span>
                  <span>STRICT_V2</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>SCAN_VERIF:</span>
                  <span>RECURSIVE</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-2 border-white/20 text-center">
            <div className="text-[10px] opacity-40 uppercase tracking-[0.2em]">NODE_HEALTH</div>
            <div className="flex justify-center gap-1 mt-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`w-1.5 h-3 ${i < 6 ? 'bg-[#4A7C59]' : 'bg-white/10'}`}></div>
              ))}
            </div>
          </div>
        </aside>

      </div>

      {/* BARRA INFERIOR */}
      <footer className="h-8 bg-[#1A1A1A] text-[#F0EDE4] text-[10px] font-bold flex items-center justify-between px-6 border-t-2 border-[#1A1A1A]">
        <div className="flex gap-4 items-center">
           <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-[#4A7C59]" />
              <span className="uppercase">CORE_STATUS: <span className="text-[#4A7C59]">OK</span></span>
           </div>
           <span className="opacity-30">//</span>
           <span className="uppercase">NODES_ACTIVE: 014</span>
        </div>
        <div className="tracking-widest opacity-50 uppercase">
           SCAN_MODE: AI_VALIDATED © 2026 WABI-SABI.SYS
        </div>
      </footer>

    </div>
  );
}
