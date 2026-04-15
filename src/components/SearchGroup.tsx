"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LeadRow } from "./LeadRow";

interface Message {
  sequence: number;
  text: string;
  confidence: number;
}

interface LeadData {
  linkedin_url: string;
  messages: Message[];
}

interface SearchGroupProps {
  searchName: string;
  leads: Record<string, LeadData>;
}

export function SearchGroup({ searchName, leads }: SearchGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const leadsEntries = Object.entries(leads);
  const totalLeads = leadsEntries.length;

  if (totalLeads === 0) return null;

  return (
    <div className="border-4 border-[#1A1A1A] bg-[#F0EDE4] mb-6 shadow-[8px_8px_0px_#1A1A1A] rounded-none">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 hover:bg-[#D94F00] hover:text-white transition-colors group"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-left">
          <span className="font-black text-lg md:text-xl uppercase tracking-widest break-all">
            {searchName}
          </span>
          <span className="text-xs font-bold px-3 py-1 border-2 border-current group-hover:border-white group-hover:bg-white/20 transition-colors uppercase whitespace-nowrap self-start sm:self-auto">
            {totalLeads} LEADS
          </span>
        </div>
        <div className="flex-shrink-0 ml-4">
          {isOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </div>
      </button>

      {isOpen && (
        <div className="bg-white border-t-4 border-[#1A1A1A] flex flex-col">
          {leadsEntries.map(([leadName, leadData]) => (
            <LeadRow 
              key={leadName} 
              leadName={leadName} 
              linkedinUrl={leadData.linkedin_url} 
              messages={leadData.messages} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
