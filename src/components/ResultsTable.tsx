"use client";

import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Filter, ArrowUpDown, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export interface BatchDraft {
  id: string;
  lead_name: string;
  company: string;
  tone: string;
  text: string;
  confidence: number;
}

interface ResultsTableProps {
  drafts: BatchDraft[];
}

interface GroupedLead {
  lead_name: string;
  company: string;
  max_confidence: number;
  drafts: Record<string, BatchDraft>;
}

export function ResultsTable({ drafts }: ResultsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterTone, setFilterTone] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("¡Copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error("Error al copiar");
    }
  };

  const groupedDrafts = useMemo(() => {
    const map = new Map<string, GroupedLead>();
    
    drafts.forEach(draft => {
      // If filtering by tone and it doesn't match, we still need to group the lead
      // Wait, if we filter by tone, do we only show leads that have that tone? Yes.
      // Actually, "Filtros: por tone (Direct, Consultative, Value-First)" might mean 
      // we only show the column or we only show drafts of that tone. 
      // Let's just group them all first, then sort.
      
      const key = draft.lead_name + draft.company;
      if (!map.has(key)) {
        map.set(key, {
          lead_name: draft.lead_name,
          company: draft.company,
          max_confidence: 0,
          drafts: {}
        });
      }
      
      const group = map.get(key)!;
      group.drafts[draft.tone] = draft;
      if (draft.confidence > group.max_confidence) {
        group.max_confidence = draft.confidence;
      }
    });

    let result = Array.from(map.values());
    
    // Sort by max confidence
    result.sort((a, b) => {
      if (sortOrder === "desc") {
        return b.max_confidence - a.max_confidence;
      } else {
        return a.max_confidence - b.max_confidence;
      }
    });

    return result;
  }, [drafts, sortOrder]);

  if (!drafts || drafts.length === 0) return null;

  const exportCSV = () => {
    // Generate CSV for drafts
    const headers = ["Lead", "Empresa", "Tono", "Confianza", "Mensaje"];
    const rows = drafts.map(d => [d.lead_name, d.company, d.tone, d.confidence.toString(), d.text]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mensajes_generados.csv`;
    a.click();
    toast.success("Exportado a CSV");
  };

  const tones = ["direct", "consultative", "value_first"];
  const displayTones = filterTone === "all" ? tones : [filterTone];

  return (
    <div className="space-y-4 mt-12 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b-2 border-[#1A1A1A] pb-4 gap-4">
        <h3 className="text-xl font-black uppercase tracking-widest">RESULTADOS ({drafts.length} MENSAJES)</h3>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterTone} onValueChange={setFilterTone}>
              <SelectTrigger className="w-[180px] h-10 text-xs font-bold uppercase border-2 border-[#1A1A1A] rounded-none focus:ring-[#D94F00] bg-white">
                <SelectValue placeholder="Filtrar por tono" />
              </SelectTrigger>
              <SelectContent className="border-2 border-[#1A1A1A] rounded-none shadow-[4px_4px_0px_#1A1A1A]">
                <SelectItem value="all">TODOS LOS TONOS</SelectItem>
                <SelectItem value="direct">DIRECT</SelectItem>
                <SelectItem value="consultative">CONSULTATIVE</SelectItem>
                <SelectItem value="value_first">VALUE-FIRST</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            variant="outline"
            className="h-10 border-2 border-[#1A1A1A] rounded-none font-bold text-xs uppercase shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none bg-white hover:bg-[#F0EDE4]"
          >
            Match <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
          
          <Button 
            onClick={exportCSV}
            className="h-10 border-2 border-[#1A1A1A] rounded-none font-bold text-xs uppercase shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none bg-[#4A7C59] text-white hover:bg-[#1A1A1A]"
          >
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      <div className="border-2 border-[#1A1A1A] bg-white shadow-[8px_8px_0px_#1A1A1A] overflow-hidden">
        <div className="max-h-[800px] overflow-auto">
          <Table>
            <TableHeader className="bg-[#1A1A1A] sticky top-0 z-10 shadow-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[#F0EDE4] font-black uppercase tracking-widest py-4 w-[250px] min-w-[250px]">NOMBRE</TableHead>
                {displayTones.includes("direct") && <TableHead className="text-[#F0EDE4] font-black uppercase tracking-widest py-4 min-w-[300px]">DRAFT DIRECT</TableHead>}
                {displayTones.includes("consultative") && <TableHead className="text-[#F0EDE4] font-black uppercase tracking-widest py-4 min-w-[300px]">DRAFT CONSULTATIVE</TableHead>}
                {displayTones.includes("value_first") && <TableHead className="text-[#F0EDE4] font-black uppercase tracking-widest py-4 min-w-[300px]">DRAFT VALUE-FIRST</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedDrafts.map((group, idx) => {
                const hasAnyDraft = displayTones.some(t => group.drafts[t]);
                if (!hasAnyDraft) return null; // Skip if filter removes all drafts for this lead
                
                return (
                  <TableRow key={idx} className="border-b-2 border-[#1A1A1A]/10 hover:bg-[#F0EDE4]/50 transition-colors group">
                    <TableCell className="align-top p-6 bg-[#F0EDE4]/30 border-r-2 border-[#1A1A1A]/10">
                      <div className="font-black text-sm uppercase mb-1">{group.lead_name}</div>
                      <div className="text-xs opacity-60 font-bold uppercase">{group.company}</div>
                    </TableCell>
                    
                    {displayTones.includes("direct") && (
                      <TableCell className="align-top p-6 border-r-2 border-[#1A1A1A]/10">
                        <DraftCell draft={group.drafts["direct"]} copiedId={copiedId} onCopy={handleCopy} />
                      </TableCell>
                    )}
                    
                    {displayTones.includes("consultative") && (
                      <TableCell className="align-top p-6 border-r-2 border-[#1A1A1A]/10">
                        <DraftCell draft={group.drafts["consultative"]} copiedId={copiedId} onCopy={handleCopy} />
                      </TableCell>
                    )}
                    
                    {displayTones.includes("value_first") && (
                      <TableCell className="align-top p-6">
                        <DraftCell draft={group.drafts["value_first"]} copiedId={copiedId} onCopy={handleCopy} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function DraftCell({ draft, copiedId, onCopy }: { draft?: BatchDraft, copiedId: string | null, onCopy: (t: string, id: string) => void }) {
  if (!draft) return <div className="text-xs italic opacity-30 text-center py-8 font-bold">NO GENERADO</div>;
  
  const isCopied = copiedId === draft.id;
  const score = Math.round(draft.confidence * 100);
  
  return (
    <div className="flex flex-col h-full bg-white border border-[#1A1A1A]/20 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-end items-start mb-2">
        <span className={`text-[10px] font-black ${score >= 90 ? 'text-[#4A7C59]' : score >= 70 ? 'text-[#D94F00]' : 'text-muted-foreground'}`}>
          {score}% MATCH
        </span>
      </div>
      
      <div className="text-sm whitespace-pre-wrap font-sans opacity-90 mb-4 flex-grow max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
        {draft.text}
      </div>
      
      <div className="mt-auto flex flex-col gap-3 pt-3 border-t border-[#1A1A1A]/10">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">TONO:</span>
          <Badge variant={draft.tone === 'direct' ? 'destructive' : draft.tone === 'consultative' ? 'default' : 'secondary'} className="text-[9px] uppercase font-black rounded-none">
            {draft.tone}
          </Badge>
        </div>
        
        <Button
          onClick={() => onCopy(draft.text, draft.id)}
          className={`w-full h-10 rounded-none border-2 font-black text-xs uppercase shadow-[2px_2px_0px_rgba(26,26,26,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all ${
            isCopied 
              ? 'bg-[#4A7C59] border-[#4A7C59] text-white hover:bg-[#4A7C59]' 
              : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#F0EDE4]'
          }`}
        >
          {isCopied ? (
            <><Check className="w-4 h-4 mr-2" /> COPIADO</>
          ) : (
            <><Copy className="w-4 h-4 mr-2" /> COPIAR</>
          )}
        </Button>
      </div>
    </div>
  );
}
