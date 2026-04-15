"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";

interface MessageCardProps {
  text: string;
  sequence: number;
}

export function MessageCard({ text, sequence }: MessageCardProps) {
  const [copied, setCopied] = useState(false);

  const getSeqColor = (seq: number) => {
    switch (seq) {
      case 1: return 'bg-[#D94F00] text-white border-[#D94F00]';
      case 2: return 'bg-[#4A90E2] text-white border-[#4A90E2]';
      case 3: return 'bg-[#2ECC71] text-white border-[#2ECC71]';
      default: return 'bg-gray-500 text-white border-gray-500';
    }
  };

  const seqLabel = (['PRIMER CONTACTO', 'FOLLOWUP DÍA 3', 'FOLLOWUP DÍA 7'] as const)[sequence - 1] ?? `MSG ${sequence}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="flex flex-col border-b border-[#1A1A1A]/10 py-4 last:border-b-0 px-4 hover:bg-[#F0EDE4]/50 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-black text-[10px] opacity-40">[{sequence}]</span>
            <Badge className={`uppercase text-[9px] font-black rounded-none shadow-[2px_2px_0px_#1A1A1A] ${getSeqColor(sequence)}`}>
              {seqLabel}
            </Badge>
          </div>
          
          <div className="text-sm font-sans whitespace-pre-wrap opacity-90 leading-relaxed pr-8 max-h-[250px] overflow-y-auto custom-scrollbar select-text">
            {text}
          </div>
        </div>

        <button
          onClick={handleCopy}
          className={`flex-shrink-0 w-10 h-10 flex items-center justify-center border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
            copied ? 'bg-[#4A7C59] text-white border-[#4A7C59]' : 'bg-white hover:bg-[#D94F00] hover:text-white'
          }`}
          title="Copiar mensaje"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      {copied && <div className="text-[#4A7C59] font-black text-[10px] text-right mt-2 uppercase tracking-widest animate-in fade-in slide-in-from-right-2">✓ COPIADO!</div>}
    </div>
  );
}
