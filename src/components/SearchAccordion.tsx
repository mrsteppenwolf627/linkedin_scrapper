"use client";

import React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { LeadAccordion, LeadWithMessages } from "./LeadAccordion";

export interface SearchWithLeads {
  searchName: string;
  totalLeads: number;
  leads: LeadWithMessages[];
}

interface SearchAccordionProps {
  searches: Record<string, Record<string, any>>;
}

export function SearchAccordion({ searches }: SearchAccordionProps) {
  // Transform the grouped record object into an array for rendering
  const searchList: SearchWithLeads[] = Object.entries(searches).map(([searchName, leadsObj]) => {
    const leadsArray = Object.entries(leadsObj).map(([leadName, leadData]: [string, any]) => ({
      name: leadName,
      role: leadData.role,
      company: leadData.company,
      messages: leadData.messages
    }));
    
    return {
      searchName,
      totalLeads: leadsArray.length,
      leads: leadsArray
    };
  });

  if (searchList.length === 0) {
    return (
      <div className="border-4 border-[#1A1A1A] p-12 text-center bg-white shadow-[8px_8px_0px_#1A1A1A]">
        <div className="text-4xl mb-4">📭</div>
        <h3 className="text-xl font-black uppercase tracking-widest mb-2">BANDEJA VACÍA</h3>
        <p className="text-sm opacity-60 uppercase font-bold">Aún no has generado ningún mensaje.</p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="w-full space-y-6">
      {searchList.map((search) => (
        <AccordionItem key={search.searchName} value={search.searchName} className="border-4 border-[#1A1A1A] bg-[#F0EDE4] mb-4 shadow-[8px_8px_0px_#1A1A1A] rounded-none">
          <AccordionTrigger className="hover:bg-[#D94F00] hover:text-white py-6 px-8 text-sm group">
            <div className="flex items-center gap-3">
              <span className="font-black uppercase tracking-widest">{search.searchName}</span>
              <span className="text-[10px] font-bold px-2 py-1 border-2 border-current group-hover:border-white group-hover:bg-white/20 transition-colors uppercase">
                {search.totalLeads} LEADS
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="bg-white border-t-4 border-[#1A1A1A] p-0">
            <div className="flex flex-col">
              {search.leads.map((lead) => (
                <LeadAccordion key={lead.name} lead={lead} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
