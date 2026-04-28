"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface MessageCopyProps {
  text: string;
  sequence: number;
}

export function MessageCopy({ text, sequence }: MessageCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getTooltipText = () => {
    if (sequence === 1) return "Secuencia 1: Primer contacto";
    if (sequence === 2) return "Secuencia 2: Follow-up 3 días";
    return "Secuencia 3: Último contacto";
  };

  return (
    <button
      onClick={handleCopy}
      title={getTooltipText()}
      className={`
        flex items-center justify-center gap-2 px-3 py-2 border-2 border-[#1A1A1A] 
        font-bold text-xs uppercase transition-all shadow-[2px_2px_0px_#1A1A1A] 
        active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap
        ${copied ? "bg-[#4A7C59] text-white" : "bg-white hover:bg-[#E8E4DB] text-[#1A1A1A]"}
      `}
    >
      <span>[{sequence}]</span>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied && <span className="ml-1 text-[10px]">✓ Copiado!</span>}
    </button>
  );
}
