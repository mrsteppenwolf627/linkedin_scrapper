"use client";

import React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { MessageCard } from "./MessageCard";

export interface DraftMessage {
  id: string;
  sequence: number;
  text: string;
}

export interface LeadWithMessages {
  name: string;
  role: string;
  company: string;
  messages: DraftMessage[];
}

interface LeadAccordionProps {
  lead: LeadWithMessages;
}

export function LeadAccordion({ lead }: LeadAccordionProps) {
  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value={lead.name} className="border-x-0 border-b border-t-0 mb-0 shadow-none bg-transparent rounded-none">
        <AccordionTrigger className="hover:bg-[#1A1A1A] hover:text-white py-3 px-6 text-xs bg-[#F0EDE4] border-b-2 border-[#1A1A1A]/10 group">
          <div className="flex items-center gap-3">
            <span className="font-bold uppercase tracking-wider">{lead.name}</span>
            <span className="text-[10px] opacity-60 font-black group-hover:opacity-100 uppercase tracking-widest">({lead.role} - {lead.company})</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-white border-t-0 pt-0 pb-0">
          <div className="flex flex-col">
            {lead.messages.sort((a, b) => a.sequence - b.sequence).map((msg) => (
              <MessageCard
                key={msg.id}
                text={msg.text}
                sequence={msg.sequence}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
