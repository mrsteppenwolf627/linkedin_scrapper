"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Copy, Check, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BatchSummary {
  id: string;
  created_at: string;
  search_id: string | null;
  search_name: string | null;
  label: string | null;
  total_leads: number;
  your_product: string | null;
}

interface SearchGroup {
  search_id: string;
  search_name: string;
  batches: BatchSummary[];
}

interface RawDraft {
  id: string;
  lead_name: string;
  lead_linkedin_url: string;
  lead_company: string | null;
  sequence: number;
  draft_text: string;
}

interface LeadRow {
  name: string;
  company: string | null;
  linkedin_url: string;
  messages: Record<number, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_KEY = process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  }) + " · " + d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  // "__legacy__" = sentinel for leads without batch_id; null = nothing selected
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [legacyLeads, setLegacyLeads] = useState<LeadRow[]>([]);
  const [hasLegacy, setHasLegacy] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState(false);

  // ── Fetch all batches ──────────────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch("/api/batches", {
        headers: { "x-api-key": API_KEY },
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[batches] GET /api/batches → ${res.status}`, body);

        if (res.status === 401) {
          toast.error("Error 401: API key incorrecta. Verifica NEXT_PUBLIC_SEARCH_API_KEY en .env.local");
        } else if (res.status === 500 && (body.includes("message_batches") || body.includes("does not exist"))) {
          setMigrationError(true);
        } else {
          toast.error(`Error ${res.status}: ${body.slice(0, 120)}`);
        }
        setIsLoadingBatches(false);
        return;
      }

      const data: BatchSummary[] = await res.json();

      // Fetch legacy drafts (batch_id IS NULL) in parallel
      const legacyRes = await fetch("/api/drafts?legacy=true", {
        headers: { "x-api-key": API_KEY },
      });
      if (legacyRes.ok) {
        const legacyData = await legacyRes.json();
        const legacyArr: RawDraft[] = legacyData.drafts ?? legacyData;
        const legacyMap = new Map<string, LeadRow>();
        for (const d of legacyArr) {
          const key = d.lead_name + d.lead_linkedin_url;
          if (!legacyMap.has(key)) {
            legacyMap.set(key, {
              name: d.lead_name,
              company: d.lead_company,
              linkedin_url: d.lead_linkedin_url,
              messages: {},
            });
          }
          legacyMap.get(key)!.messages[d.sequence] = d.draft_text;
        }
        const processed = Array.from(legacyMap.values());
        setLegacyLeads(processed);
        setHasLegacy(processed.length > 0);
      }

      // Group batches by search
      const map = new Map<string, SearchGroup>();
      for (const b of data) {
        const key = b.search_id ?? "__sin_busqueda__";
        const name = b.search_name ?? "SIN BÚSQUEDA";
        if (!map.has(key)) map.set(key, { search_id: key, search_name: name, batches: [] });
        map.get(key)!.batches.push(b);
      }
      const grouped = Array.from(map.values());
      setGroups(grouped);

      // Auto-select most recent batch; fall back to legacy if no batches
      if (data.length > 0 && !selectedBatchId) {
        setSelectedBatchId(data[0].id);
      }
    } catch (err) {
      console.error("[batches] fetch error:", err);
      toast.error(`Error de red: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingBatches(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch drafts for selected batch ──────────────────────────────────────
  const fetchDrafts = useCallback(async (batchId: string) => {
    setIsLoadingDrafts(true);
    setLeads([]);
    try {
      const res = await fetch(`/api/drafts?batch_id=${batchId}`, {
        headers: { "x-api-key": API_KEY },
      });
      if (!res.ok) throw new Error("Failed to load drafts");

      const resData = await res.json();
      const arr: RawDraft[] = resData.drafts ?? resData;

      // Group by lead name
      const map = new Map<string, LeadRow>();
      for (const d of arr) {
        const key = d.lead_name + d.lead_linkedin_url;
        if (!map.has(key)) {
          map.set(key, {
            name: d.lead_name,
            company: d.lead_company,
            linkedin_url: d.lead_linkedin_url,
            messages: {},
          });
        }
        map.get(key)!.messages[d.sequence] = d.draft_text;
      }
      setLeads(Array.from(map.values()));
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron cargar los mensajes");
    } finally {
      setIsLoadingDrafts(false);
    }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  useEffect(() => {
    if (!selectedBatchId || selectedBatchId === "__legacy__") {
      // Legacy drafts already loaded in fetchBatches — just swap the display
      if (selectedBatchId === "__legacy__") setLeads(legacyLeads);
      return;
    }
    fetchDrafts(selectedBatchId);
  }, [selectedBatchId, fetchDrafts, legacyLeads]);

  // ── Copy ──────────────────────────────────────────────────────────────────
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

  // ── Delete batch (2-click confirm) ────────────────────────────────────────
  const handleDeleteClick = (batchId: string) => {
    if (confirmDeleteId === batchId) {
      executeDeletion(batchId);
    } else {
      setConfirmDeleteId(batchId);
      setTimeout(() => setConfirmDeleteId((prev) => prev === batchId ? null : prev), 4000);
    }
  };

  const executeDeletion = async (batchId: string) => {
    setDeletingId(batchId);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/batches?id=${batchId}`, {
        method: "DELETE",
        headers: { "x-api-key": API_KEY },
      });
      if (!res.ok) throw new Error("Delete failed");

      toast.success("Lote eliminado");

      // If we deleted the selected batch, reset selection
      if (selectedBatchId === batchId) setSelectedBatchId(null);

      await fetchBatches();

      // Auto-select the next most recent batch
      setGroups((prev) => {
        const all = prev.flatMap((g) => g.batches).filter((b) => b.id !== batchId);
        if (all.length > 0 && !selectedBatchId) setSelectedBatchId(all[0].id);
        return prev;
      });
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar el lote");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedBatch = groups.flatMap((g) => g.batches).find((b) => b.id === selectedBatchId);
  const allBatches = groups.flatMap((g) => g.batches);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F0EDE4] p-4 md:p-8 font-mono text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

        {/* ── Header ── */}
        <header className="border-b-4 border-[#1A1A1A] pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">
              MIS MENSAJES
            </h1>
            <p className="text-sm uppercase opacity-60 font-bold mt-2">
              Secuencias listas para enviar · Gestión por lotes
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-bold border-2 border-[#1A1A1A] px-6 py-3 hover:bg-[#1A1A1A] hover:text-white transition-colors uppercase shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none whitespace-nowrap"
          >
            &lt; VOLVER
          </Link>
        </header>

        {/* ── Migration required banner ── */}
        {migrationError && (
          <div className="border-4 border-[#D94F00] bg-[#D94F00]/10 p-6 shadow-[6px_6px_0px_#D94F00]">
            <p className="font-black uppercase tracking-widest text-sm text-[#D94F00] mb-2">
              ⚠ MIGRACIÓN SQL PENDIENTE
            </p>
            <p className="text-xs font-bold opacity-80 mb-3">
              La tabla <code className="bg-[#1A1A1A] text-[#F0EDE4] px-1">message_batches</code> no existe en Supabase.
              Ejecuta la migración antes de continuar:
            </p>
            <code className="block text-[10px] font-mono bg-[#1A1A1A] text-[#4A7C59] p-3 overflow-x-auto whitespace-pre">
              {`-- Archivo: migrations/20260511_message_batches.sql\n-- Pégalo en Supabase → SQL Editor → Run`}
            </code>
          </div>
        )}

        {/* ── Loading batches ── */}
        {isLoadingBatches && (
          <div className="flex items-center justify-center py-20 opacity-50 gap-4">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="font-black tracking-widest text-sm uppercase">Cargando lotes...</span>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoadingBatches && allBatches.length === 0 && !hasLegacy && !migrationError && (
          <div className="border-4 border-[#1A1A1A] p-12 text-center bg-white shadow-[8px_8px_0px_#1A1A1A]">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-xl font-black uppercase tracking-widest mb-2">SIN MENSAJES</h3>
            <p className="text-sm opacity-60 uppercase font-bold">
              Genera mensajes desde la página de búsquedas para crear tu primer lote.
            </p>
          </div>
        )}

        {/* ── Main: batch list + messages ── */}
        {!isLoadingBatches && (allBatches.length > 0 || hasLegacy) && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* ── Left: Batch selector ── */}
            <aside className="w-full lg:w-72 shrink-0 space-y-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest opacity-50 pb-1 border-b border-[#1A1A1A]/20">
                LOTES DE GENERACIÓN
              </h2>

              {/* Legacy row */}
              {hasLegacy && (
                <div
                  className={`border-2 transition-all cursor-pointer ${
                    selectedBatchId === "__legacy__"
                      ? "border-[#1A1A1A] bg-[#1A1A1A] text-[#F0EDE4] shadow-[4px_4px_0px_#D94F00]"
                      : "border-[#1A1A1A]/30 bg-white hover:border-[#1A1A1A]"
                  }`}
                  onClick={() => setSelectedBatchId("__legacy__")}
                >
                  <div className="p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider">
                      📦 Mensajes Heredados
                    </p>
                    <p className={`text-[10px] mt-0.5 font-bold ${selectedBatchId === "__legacy__" ? "opacity-60" : "opacity-40"}`}>
                      {legacyLeads.length} lead{legacyLeads.length !== 1 ? "s" : ""} · sin lote
                    </p>
                  </div>
                </div>
              )}

              {groups.map((group) => (
                <div key={group.search_id} className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 truncate px-1">
                    📁 {group.search_name}
                  </p>

                  {group.batches.map((batch) => {
                    const isSelected = batch.id === selectedBatchId;
                    const isDeleting = deletingId === batch.id;
                    const isConfirming = confirmDeleteId === batch.id;

                    return (
                      <div
                        key={batch.id}
                        className={`border-2 transition-all ${
                          isSelected
                            ? "border-[#1A1A1A] bg-[#1A1A1A] text-[#F0EDE4] shadow-[4px_4px_0px_#D94F00]"
                            : "border-[#1A1A1A]/30 bg-white hover:border-[#1A1A1A] cursor-pointer"
                        }`}
                        onClick={() => !isSelected && setSelectedBatchId(batch.id)}
                      >
                        <div className="p-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider truncate">
                              {formatDate(batch.created_at)}
                            </p>
                            <p className={`text-[10px] mt-0.5 font-bold ${isSelected ? "opacity-60" : "opacity-40"}`}>
                              {batch.total_leads} lead{batch.total_leads !== 1 ? "s" : ""}
                            </p>
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(batch.id);
                            }}
                            disabled={isDeleting}
                            title={isConfirming ? "Confirmar borrado" : "Borrar lote"}
                            className={`shrink-0 flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1 border transition-all ${
                              isDeleting
                                ? "opacity-40 cursor-not-allowed border-transparent"
                                : isConfirming
                                ? "border-[#D94F00] bg-[#D94F00] text-white"
                                : isSelected
                                ? "border-white/30 hover:border-white hover:bg-white hover:text-[#1A1A1A]"
                                : "border-[#1A1A1A]/20 hover:border-[#D94F00] hover:text-[#D94F00]"
                            }`}
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isConfirming ? (
                              "¿SEGURO?"
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </aside>

            {/* ── Right: Messages for selected batch ── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Batch header */}
              {selectedBatchId === "__legacy__" ? (
                <div className="pb-3 border-b-2 border-[#1A1A1A]">
                  <p className="text-xs font-black uppercase tracking-widest">
                    📦 Mensajes Heredados
                  </p>
                  <p className="text-[10px] opacity-50 font-bold mt-0.5">
                    {leads.length} lead{leads.length !== 1 ? "s" : ""} generados antes del sistema de lotes
                  </p>
                </div>
              ) : selectedBatch ? (
                <div className="pb-3 border-b-2 border-[#1A1A1A]">
                  <p className="text-xs font-black uppercase tracking-widest">
                    {selectedBatch.search_name ?? "SIN BÚSQUEDA"}
                  </p>
                  <p className="text-[10px] opacity-50 font-bold mt-0.5">
                    Generado el {formatDate(selectedBatch.created_at)} · {leads.length} lead{leads.length !== 1 ? "s" : ""}
                  </p>
                </div>
              ) : null}

              {/* Loading drafts */}
              {isLoadingDrafts && (
                <div className="flex items-center justify-center py-16 opacity-50 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="font-black tracking-widest text-xs uppercase">Cargando mensajes...</span>
                </div>
              )}

              {/* No drafts for batch */}
              {!isLoadingDrafts && selectedBatchId && selectedBatchId !== "__legacy__" && leads.length === 0 && (
                <div className="border-4 border-[#1A1A1A] p-10 text-center bg-white shadow-[6px_6px_0px_#1A1A1A]">
                  <p className="text-sm font-black uppercase tracking-widest opacity-40">
                    Este lote no tiene mensajes guardados
                  </p>
                </div>
              )}

              {/* Desktop table */}
              {!isLoadingDrafts && leads.length > 0 && (
                <>
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
                        {leads.map((lead, i) => (
                          <tr
                            key={lead.name + i}
                            className="border-t border-[#1A1A1A]/10 hover:bg-[#D94F00]/5 transition-colors"
                          >
                            <td className="p-4 align-top bg-[#F0EDE4]/60 border-r-2 border-[#1A1A1A]/10">
                              <span className="font-black text-xs uppercase leading-snug block">{lead.name}</span>
                              {lead.company && (
                                <span className="text-[10px] opacity-40 font-bold block mt-0.5">{lead.company}</span>
                              )}
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
                              const key = `${lead.name}__${i}__${seq}`;
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
                    {leads.map((lead, i) => (
                      <div
                        key={lead.name + i}
                        className="border-2 border-[#1A1A1A] bg-white shadow-[4px_4px_0px_#1A1A1A]"
                      >
                        <div className="flex items-center justify-between p-3 bg-[#F0EDE4] border-b-2 border-[#1A1A1A]">
                          <div>
                            <span className="font-black text-xs uppercase">{lead.name}</span>
                            {lead.company && (
                              <span className="text-[10px] opacity-40 font-bold block">{lead.company}</span>
                            )}
                          </div>
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold uppercase border border-[#1A1A1A] px-2 py-1 hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" /> LinkedIn
                          </a>
                        </div>

                        {[1, 2, 3].map((seq) => {
                          const text = lead.messages[seq] ?? "";
                          const key = `${lead.name}__${i}__${seq}__m`;
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
                                    className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 border transition-all ${
                                      copied
                                        ? "bg-[#4A7C59] text-white border-[#4A7C59]"
                                        : "bg-white border-[#1A1A1A] hover:bg-[#D94F00] hover:text-white hover:border-[#D94F00]"
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
