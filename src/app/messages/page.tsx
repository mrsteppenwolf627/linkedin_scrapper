"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";

interface RawDraft {
  id: string;
  lead_name: string;
  lead_linkedin_url: string;
  search_name: string;
  sequence: number;
  draft_text: string;
}

interface LeadRow {
  name: string;
  linkedin_url: string;
  messages: Record<number, string>;
}

interface SearchSection {
  name: string;
  leads: LeadRow[];
}

export default function MessagesPage() {
  const [sections, setSections] = useState<SearchSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const res = await fetch("/api/drafts", {
          headers: { "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "" },
        });
        if (!res.ok) throw new Error("Failed to load drafts");

        const data = await res.json();
        const arr: RawDraft[] = Array.isArray(data) ? data : [];

        // Group: search → lead → { linkedin_url, messages }
        const grouped: Record<string, Record<string, LeadRow>> = {};
        arr.forEach((draft) => {
          const s = draft.search_name || "SIN_BÚSQUEDA";
          const l = draft.lead_name || "SIN_NOMBRE";
          if (!grouped[s]) grouped[s] = {};
          if (!grouped[s][l]) {
            grouped[s][l] = {
              name: l,
              linkedin_url: draft.lead_linkedin_url || "#",
              messages: {},
            };
          }
          grouped[s][l].messages[draft.sequence] = draft.draft_text;
        });

        setSections(
          Object.entries(grouped).map(([name, leads]) => ({
            name,
            leads: Object.values(leads),
          }))
        );
      } catch (err) {
        console.error(err);
        toast.error("ERROR: NO SE PUDIERON CARGAR LOS MENSAJES");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrafts();
  }, []);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("✓ Copiado");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Error al copiar");
    }
  };

  return (
    <div className="min-h-screen bg-[#F0EDE4] p-4 md:p-8 font-mono text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500">

        {/* Header */}
        <header className="border-b-4 border-[#1A1A1A] pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">
              MIS MENSAJES
            </h1>
            <p className="text-sm uppercase opacity-60 font-bold mt-2">
              Secuencias listas para enviar en LinkedIn
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-bold border-2 border-[#1A1A1A] px-6 py-3 hover:bg-[#1A1A1A] hover:text-white transition-colors uppercase shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none whitespace-nowrap"
          >
            &lt; VOLVER
          </Link>
        </header>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin" />
            <span className="font-black tracking-widest text-sm uppercase">CARGANDO...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sections.length === 0 && (
          <div className="border-4 border-[#1A1A1A] p-12 text-center bg-white shadow-[8px_8px_0px_#1A1A1A]">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-xl font-black uppercase tracking-widest mb-2">BANDEJA VACÍA</h3>
            <p className="text-sm opacity-60 uppercase font-bold">
              Aún no has generado ningún mensaje.
            </p>
          </div>
        )}

        {/* One section per search */}
        {sections.map((section) => (
          <section key={section.name} className="space-y-4">
            <h2 className="text-base font-black uppercase tracking-widest border-b-2 border-[#1A1A1A] pb-2 flex items-center gap-3">
              <span>📁 {section.name}</span>
              <span className="text-xs opacity-40 font-bold normal-case">
                {section.leads.length} lead{section.leads.length !== 1 ? "s" : ""}
              </span>
            </h2>

            {/* Desktop table */}
            <div className="hidden md:block border-2 border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#1A1A1A] text-[#F0EDE4]">
                    <th className="text-left p-4 font-black uppercase tracking-widest text-[10px] w-[180px]">
                      NOMBRE
                    </th>
                    <th className="text-center p-4 font-black uppercase tracking-widest text-[10px] w-[48px]">
                      URL
                    </th>
                    <th className="p-4 font-black uppercase tracking-widest text-[10px]">
                      MENSAJE 1
                    </th>
                    <th className="p-4 font-black uppercase tracking-widest text-[10px] border-l border-white/10">
                      MENSAJE 2
                    </th>
                    <th className="p-4 font-black uppercase tracking-widest text-[10px] border-l border-white/10">
                      MENSAJE 3
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.leads.map((lead, i) => (
                    <tr
                      key={lead.name + i}
                      className="border-t border-[#1A1A1A]/10 hover:bg-[#D94F00]/5 transition-colors"
                    >
                      <td className="p-4 align-top bg-[#F0EDE4]/60 border-r-2 border-[#1A1A1A]/10">
                        <span className="font-black text-xs uppercase leading-snug">{lead.name}</span>
                      </td>

                      <td className="p-3 align-middle text-center border-r-2 border-[#1A1A1A]/10">
                        <a
                          href={lead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 border-2 border-[#1A1A1A] hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] transition-colors"
                          title="Abrir perfil"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>

                      {[1, 2, 3].map((seq) => {
                        const text = lead.messages[seq] ?? "";
                        const key = `${section.name}__${lead.name}__${seq}`;
                        const copied = copiedKey === key;
                        return (
                          <td
                            key={seq}
                            className="p-3 align-top border-l border-[#1A1A1A]/10 min-w-[200px] max-w-[280px]"
                          >
                            {text ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs font-sans leading-relaxed opacity-80 whitespace-pre-wrap break-words">
                                  {text}
                                </p>
                                <button
                                  onClick={() => handleCopy(text, key)}
                                  className={`self-start flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1.5 border-2 shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all ${
                                    copied
                                      ? "bg-[#4A7C59] text-white border-[#4A7C59]"
                                      : "bg-white border-[#1A1A1A] hover:bg-[#D94F00] hover:text-white hover:border-[#D94F00]"
                                  }`}
                                >
                                  {copied ? (
                                    <><Check className="w-3 h-3" /> COPIADO</>
                                  ) : (
                                    <><Copy className="w-3 h-3" /> COPIAR</>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] italic opacity-25 font-bold">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards */}
            <div className="md:hidden space-y-3">
              {section.leads.map((lead, i) => (
                <div
                  key={lead.name + i}
                  className="border-2 border-[#1A1A1A] bg-white shadow-[4px_4px_0px_#1A1A1A]"
                >
                  {/* Lead header */}
                  <div className="flex items-center justify-between p-3 bg-[#F0EDE4] border-b-2 border-[#1A1A1A]">
                    <span className="font-black text-xs uppercase">{lead.name}</span>
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-bold uppercase border border-[#1A1A1A] px-2 py-1 hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> LinkedIn
                    </a>
                  </div>

                  {/* Messages */}
                  {[1, 2, 3].map((seq) => {
                    const text = lead.messages[seq] ?? "";
                    const key = `${section.name}__${lead.name}__${seq}__m`;
                    const copied = copiedKey === key;
                    const labels = ["PRIMER CONTACTO", "FOLLOWUP DÍA 3", "FOLLOWUP DÍA 7"] as const;
                    return (
                      <div key={seq} className="p-3 border-b border-[#1A1A1A]/10 last:border-b-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase opacity-40">
                            {seq}. {labels[seq - 1]}
                          </span>
                          {text && (
                            <button
                              onClick={() => handleCopy(text, key)}
                              className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 border border-[#1A1A1A] transition-all ${
                                copied
                                  ? "bg-[#4A7C59] text-white border-[#4A7C59]"
                                  : "bg-white hover:bg-[#D94F00] hover:text-white hover:border-[#D94F00]"
                              }`}
                            >
                              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-sans opacity-80 leading-relaxed whitespace-pre-wrap break-words">
                          {text || <span className="italic opacity-30">— No generado</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
