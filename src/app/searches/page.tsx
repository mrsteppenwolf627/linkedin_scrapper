"use client";

import React, { useState, useEffect } from "react";
import { SearchSelector, Search, Contact } from "@/components/SearchSelector";
import { BatchProgress } from "@/components/BatchProgress";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function SearchesPage() {
  const [searches, setSearches] = useState<Search[]>([]);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [yourProduct, setYourProduct] = useState("");

  useEffect(() => {
    // Load searches on mount
    fetch("/api/searches", {
      headers: { "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "" }
    })
      .then(res => res.json())
      .then(data => setSearches(data.searches || []))
      .catch(err => {
        console.error(err);
        toast.error("ERROR: NO SE PUDIERON CARGAR LOS ESCANEOS");
      });
  }, []);

  const handleSelectSearch = async (id: string) => {
    setSelectedSearchId(id);
    setIsLoadingContacts(true);
    setContacts([]);
    
    try {
      const res = await fetch(`/api/contacts?search_id=${id}`, {
        headers: { "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "" }
      });
      if (!res.ok) throw new Error("Failed to load contacts");
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err) {
      console.error(err);
      toast.error("ERROR: FALLO AL CARGAR LOS LEADS DEL NODO");
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleGenerateBatch = async () => {
    if (!selectedSearchId) return;
    
    setIsGenerating(true);
    
    try {
      const res = await fetch("/api/generate-messages/batch", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? ""
        },
        body: JSON.stringify({ search_id: selectedSearchId })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "INIT_FAILED");
      }
      
      toast.success("BATCH_PROCESS: INICIADO EN SEGUNDO PLANO");
    } catch (err: any) {
      console.error(err);
      toast.error(`ERROR: ${err.message}`);
      setIsGenerating(false);
    }
  };

  const handleBatchComplete = async () => {
    setIsGenerating(false);
    toast.success("✅ Mensajes generados correctamente");
    
    setTimeout(() => {
      window.location.href = "/messages";
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#F0EDE4] p-4 md:p-8 font-mono text-[#1A1A1A]">
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        <header className="border-b-4 border-[#1A1A1A] pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase flex items-center gap-3">
              <span className="text-4xl md:text-5xl">📧</span> GENERADOR DE MENSAJES EN LOTE
            </h1>
            <p className="text-sm uppercase opacity-80 font-bold mt-3 max-w-2xl leading-relaxed">
              Selecciona una búsqueda anterior y genera 3 mensajes personalizados para cada lead automáticamente
            </p>
          </div>
          <Link href="/" className="text-xs font-bold border-2 border-[#1A1A1A] px-6 py-3 hover:bg-[#1A1A1A] hover:text-white transition-colors uppercase shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none whitespace-nowrap">
            &lt; VOLVER AL DASHBOARD
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <SearchSelector 
              searches={searches}
              selectedId={selectedSearchId}
              onSelect={handleSelectSearch}
              contactsPreview={contacts}
              isLoadingContacts={isLoadingContacts}
            />
          </div>

          <div className="space-y-6 sticky top-8">
            <div className="bg-white border-2 border-[#1A1A1A] p-8 shadow-[8px_8px_0px_#1A1A1A] space-y-6">
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="your_product" className="text-sm font-black uppercase tracking-wider">
                    ¿Qué ofreces? (tu propuesta de valor) <span className="text-red-500">*</span>
                  </Label>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }} className="mt-1">
                    💡 Cuanto más detalle, mejor serán los mensajes. 
                    Incluye casos de éxito, métricas, beneficios específicos, 
                    lo que haces exactamente.
                  </p>
                  <textarea 
                    id="your_product"
                    className="flex min-h-[120px] w-full rounded-none border-2 border-[#1A1A1A] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D94F00] focus-visible:border-transparent placeholder:opacity-40"
                    placeholder="Ej: Automatizo prospección con IA. Reduzco tiempo 60%. Clientes como TechCorp pasaron de 8h/día a 2h/día. Funciona con cualquier API de búsqueda. Precio: $49/mes."
                    maxLength={1000}
                    value={yourProduct}
                    onChange={(e) => setYourProduct(e.target.value)}
                    disabled={isGenerating}
                  />
                  <p style={{ fontSize: '11px', color: '#999' }} className="mt-1 text-right uppercase font-bold">
                    {yourProduct.length} / 1000 CARACTERES
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleGenerateBatch}
                disabled={!selectedSearchId || contacts.length === 0 || isGenerating || !yourProduct.trim()}
                className={`w-full h-20 rounded-none border-4 border-[#1A1A1A] font-black text-lg md:text-xl uppercase transition-all shadow-[8px_8px_0px_#1A1A1A] active:translate-x-[8px] active:translate-y-[8px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedSearchId && contacts.length > 0 && yourProduct.trim() && !isGenerating 
                    ? 'bg-[#D94F00] text-white hover:bg-[#D94F00]/90' 
                    : 'bg-[#E8E4DB] text-[#1A1A1A]'
                }`}
              >
                {isGenerating ? (
                  <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> PROCESANDO LOTE...</>
                ) : (
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">🚀</span> GENERAR MENSAJES EN LOTE ({contacts.length} LEADS)
                  </span>
                )}
              </Button>
            </div>

            <BatchProgress 
              searchId={selectedSearchId!}
              isGenerating={isGenerating}
              onComplete={handleBatchComplete}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
