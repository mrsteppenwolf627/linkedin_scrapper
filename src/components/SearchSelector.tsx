"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export interface Search {
  id: string;
  name: string;
  status: string;
  total_contacts_created: number;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  job_title: string;
  company: string;
  location: string;
  linkedin_url: string;
  confidence_score: number;
}

interface SearchSelectorProps {
  searches: Search[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  contactsPreview: Contact[];
  isLoadingContacts: boolean;
}

export function SearchSelector({ searches, selectedId, onSelect, contactsPreview, isLoadingContacts }: SearchSelectorProps) {
  const selectedSearch = searches.find(s => s.id === selectedId);

  return (
    <Card className="w-full bg-[#F0EDE4] border-2 border-[#1A1A1A] shadow-[8px_8px_0px_#1A1A1A] rounded-none">
      <CardHeader className="pb-4 border-b-2 border-[#1A1A1A]">
        <CardTitle className="uppercase font-black tracking-widest text-lg">MIS BÚSQUEDAS ANTERIORES</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6 bg-white">
        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {searches.length === 0 ? (
            <div className="text-center py-6 text-xs italic opacity-50 uppercase font-bold">No hay búsquedas disponibles</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searches.map((s) => {
                const isSelected = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className={`flex flex-col items-start p-4 transition-all text-left uppercase w-full ${
                      isSelected 
                        ? "bg-[#D94F00] text-white border-4 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A]" 
                        : "bg-[#F0EDE4] text-[#1A1A1A] border-2 border-[#1A1A1A] hover:bg-[#D94F00] hover:text-white shadow-[2px_2px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A]"
                    } active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
                  >
                    <span className="font-black text-xs break-words w-full line-clamp-2 mb-2 leading-tight">
                      {s.name}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 border border-current ${isSelected ? 'bg-white/20' : 'bg-white/50 text-[#1A1A1A]'}`}>
                      {s.total_contacts_created} LEADS
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedId && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1 border-b border-[#1A1A1A]/10 pb-2">
              <span className="text-sm font-black uppercase tracking-wider">VISTA PREVIA</span>
              <span className="text-xs opacity-60 font-bold uppercase">{selectedSearch?.total_contacts_created || 0} leads encontrados:</span>
            </div>
            
            {isLoadingContacts ? (
              <div className="text-center py-6 text-xs italic opacity-50 uppercase animate-pulse font-bold">Cargando datos...</div>
            ) : contactsPreview.length === 0 ? (
              <div className="text-center py-6 text-xs italic opacity-50 uppercase font-bold">No hay leads en esta búsqueda</div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {contactsPreview.slice(0, 5).map(contact => (
                  <div key={contact.id} className="flex items-center text-sm border-b border-[#1A1A1A]/10 py-2 last:border-0">
                    <span className="font-bold mr-1">• {contact.name}</span>
                    <span className="opacity-80 mr-1">({contact.job_title})</span>
                    <span className="opacity-60">- {contact.company}</span>
                  </div>
                ))}
                {contactsPreview.length > 5 && (
                  <div className="text-center py-3 text-xs font-bold opacity-50 uppercase bg-[#F0EDE4] border border-[#1A1A1A]/10 mt-2">
                    + {contactsPreview.length - 5} LEADS OCULTOS (SCROLL)
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
