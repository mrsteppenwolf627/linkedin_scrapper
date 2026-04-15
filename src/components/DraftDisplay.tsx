"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Copy, Check, Info } from "lucide-react";
import { Badge } from "./ui/badge";

export interface Draft {
  draft_id: number;
  sequence: number;
  text: string;
  confidence: number;
}

interface DraftDisplayProps {
  drafts: Draft[];
}

export function DraftDisplay({ drafts }: DraftDisplayProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = async (draft: Draft) => {
    try {
      await navigator.clipboard.writeText(draft.text);
      setCopiedId(draft.draft_id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  if (!drafts || drafts.length === 0) return null;

  return (
    <div className="space-y-6 mt-8 w-full max-w-5xl mx-auto">
      <h3 className="text-2xl font-bold text-center">Mensajes Generados</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {drafts.map((draft) => (
          <Card key={draft.draft_id} className="flex flex-col h-full bg-white border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A]">
            <CardHeader className="pb-2 border-b-2 border-[#1A1A1A]/10">
              <div className="flex justify-between items-center">
                <Badge
                  variant={draft.sequence === 1 ? 'destructive' : draft.sequence === 2 ? 'default' : 'secondary'}
                  className="uppercase font-bold tracking-wider text-[10px]"
                >
                  {(['MSG 1', 'MSG 2', 'MSG 3'] as const)[draft.sequence - 1] ?? `MSG ${draft.sequence}`}
                </Badge>
                <div className="flex items-center text-[10px] font-bold text-muted-foreground">
                  <Info className="w-3 h-3 mr-1" />
                  {Math.round(draft.confidence * 100)}% Match
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow whitespace-pre-wrap text-sm py-4 font-sans leading-relaxed">
              {draft.text}
            </CardContent>
            <CardFooter className="pt-4 border-t-2 border-[#1A1A1A]/10">
              <Button 
                variant="outline" 
                className={`w-full font-bold uppercase tracking-wider text-xs border-2 border-[#1A1A1A] transition-all ${copiedId === draft.draft_id ? 'bg-[#4A7C59] text-white hover:bg-[#4A7C59]' : 'hover:bg-[#E8E4DB]'}`} 
                onClick={() => handleCopy(draft)}
              >
                {copiedId === draft.draft_id ? (
                  <><Check className="w-4 h-4 mr-2" /> COPIADO</>
                ) : (
                  <><Copy className="w-4 h-4 mr-2" /> COPIAR MENSAJE</>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
