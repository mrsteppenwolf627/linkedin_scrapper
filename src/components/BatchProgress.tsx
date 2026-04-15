"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";

interface BatchProgressProps {
  searchId: string;
  isGenerating: boolean;
  onComplete: () => void;
}

export function BatchProgress({ searchId, isGenerating, onComplete }: BatchProgressProps) {
  const [progress, setProgress] = useState({ total: 0, completed: 0, status: "idle" });

  useEffect(() => {
    if (!isGenerating || !searchId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/generate-messages/batch/status?search_id=${searchId}`, {
          headers: {
            "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? ""
          }
        });
        if (!response.ok) throw new Error("Status failed");
        const data = await response.json();
        
        console.log('[polling] response:', data);
        console.log('[polling] status:', data.status);
        
        setProgress({
           total: data.total || 0,
           completed: data.processed || 0, // Assuming backend might return processed
           status: data.status || "processing"
        });
        
        if (data.status === "completed" || data.status === "complete") {
          console.log('[polling] ✅ Status es COMPLETE, parando polling...');
          clearInterval(interval);
          onComplete();
        } else {
          console.log('[polling] Status es:', data.status, ' - siguiendo...');
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isGenerating, searchId, onComplete]);

  if (!isGenerating && progress.status === "idle") return null;

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isDone = progress.status === 'completed' || (progress.total > 0 && progress.completed === progress.total && !isGenerating);

  return (
    <Card className="bg-white border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] mt-6 rounded-none p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {isDone ? (
             <CheckCircle2 className="w-5 h-5 text-[#4A7C59]" />
          ) : (
             <Loader2 className="w-5 h-5 text-[#D94F00] animate-spin" />
          )}
          <span className="font-bold uppercase tracking-widest text-sm">
            {isDone ? `¡Completado! ${progress.completed} generados, 0 omitidos` : `Generando... ${progress.completed}/${progress.total} completados (${percent}%)`}
          </span>
        </div>
        
        <div className="w-full h-4 bg-[#F0EDE4] rounded-none overflow-hidden border-2 border-[#1A1A1A]">
          <div 
            className={`h-full transition-all duration-500 ease-out ${isDone ? 'bg-[#4A7C59]' : 'bg-[#D94F00]'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
