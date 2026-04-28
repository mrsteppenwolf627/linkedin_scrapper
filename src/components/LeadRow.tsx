"use client";

import React from "react";
import { MessageCopy } from "./MessageCopy";
import { ExternalLink } from "lucide-react";

interface Message {
  sequence: number;
  text: string;
  confidence: number;
}

interface LeadRowProps {
  leadName: string;
  linkedinUrl: string;
  messages: Message[];
}

export function LeadRow({ leadName, linkedinUrl, messages }: LeadRowProps) {
  // Sort messages by sequence
  const sortedMessages = [...messages].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between p-4 border-b-2 border-[#1A1A1A]/20 hover:bg-[#E8E4DB] transition-colors gap-4">
      
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <a 
          href={linkedinUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-black uppercase tracking-widest text-[#1A1A1A] hover:text-[#D94F00] transition-colors flex items-center gap-2 truncate"
          title={leadName}
        >
          {leadName} <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      </div>

      <div className="flex flex-row items-center gap-3 overflow-x-auto pb-2 xl:pb-0">
        {sortedMessages.map((msg, idx) => (
          <MessageCopy key={idx} text={msg.text} sequence={msg.sequence} />
        ))}
      </div>
      
    </div>
  );
}
