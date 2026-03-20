// app/page.tsx
// Dashboard principal - crear búsquedas y ver resultados

"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Download } from "lucide-react";

interface Search {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  total_contacts_created: number;
  total_duplicates_found: number;
  created_at: string;
}

interface Contact {
  id: string;
  linkedin_url: string;
  name: string;
  job_title: string;
  company: string;
  location: string;
  years_experience: number;
  confidence_score: number;
  status: string;
  search_id: string;
}

export default function Dashboard() {
  const [searches, setSearches] = useState<Search[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // === FORM STATE ===
  const [formData, setFormData] = useState({
    search_name: "",
    sector: "energía",
    years_min: "5",
    keywords: "",
    location: "",
  });

  // === CREAR BÚSQUEDA ===
  const handleCreateSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generar query de Google
      const keywords = formData.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const googleQuery = `site:linkedin.com/in (${keywords
        .map((k) => `"${k}"`)
        .join(
          " OR "
        )}) (${formData.years_min}+ años OR ${formData.years_min}+ years) ${
        formData.location || ""
      }`.trim();

      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY || "",
        },
        body: JSON.stringify({
          search_name: formData.search_name,
          google_query: googleQuery,
          filters: {
            sector: formData.sector,
            years_min: parseInt(formData.years_min),
            keywords: keywords,
            location: formData.location || undefined,
          },
          max_results: 30,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Refrescar búsquedas
      await loadSearches();

      // Limpiar form
      setFormData({
        search_name: "",
        sector: "energía",
        years_min: "5",
        keywords: "",
        location: "",
      });

      alert("✅ Búsqueda iniciada. Puede tardar unos minutos.");
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Error al crear búsqueda");
    } finally {
      setLoading(false);
    }
  };

  // === CARGAR BÚSQUEDAS ===
  const loadSearches = async () => {
    try {
      const response = await fetch("/api/searches", {
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY || "",
        },
      });

      if (!response.ok) throw new Error("Failed to load searches");

      const data = await response.json();
      setSearches(data);
    } catch (error) {
      console.error("Error loading searches:", error);
    }
  };

  // === CARGAR CONTACTOS DE UNA BÚSQUEDA ===
  const loadContactsForSearch = async (searchId: string) => {
    try {
      const response = await fetch(`/api/contacts?search_id=${searchId}`, {
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_SEARCH_API_KEY || "",
        },
      });

      if (!response.ok) throw new Error("Failed to load contacts");

      const data = await response.json();
      setContacts(data);
      setSelectedSearch(searchId);
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  // === DESCARGAR CSV ===
  const downloadCSV = () => {
    if (contacts.length === 0) {
      alert("No hay contactos para descargar");
      return;
    }

    const headers = [
      "Nombre",
      "Puesto",
      "Empresa",
      "Ubicación",
      "Años Exp.",
      "Confianza",
      "URL LinkedIn",
    ];

    const rows = contacts.map((c) => [
      c.name,
      c.job_title,
      c.company,
      c.location,
      c.years_experience,
      (c.confidence_score * 100).toFixed(0) + "%",
      c.linkedin_url,
    ]);

    const csv =
      [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => `"${cell || ""}"`)
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contactos_${selectedSearch}.csv`;
    a.click();
  };

  // === STATUS BADGE ===
  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      pending: "secondary",
      running: "default",
      completed: "default",
      failed: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "Pendiente",
      running: "En curso",
      completed: "Completada",
      failed: "Error",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            LinkedIn Lead Scraper
          </h1>
          <p className="text-slate-400">
            Busca y extrae perfiles de LinkedIn usando Google Search
          </p>
        </div>

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-slate-700">
            <TabsTrigger value="create" className="text-white">
              Nueva Búsqueda
            </TabsTrigger>
            <TabsTrigger value="history" className="text-white">
              Búsquedas Anteriores
            </TabsTrigger>
          </TabsList>

          {/* === TAB: CREAR BÚSQUEDA === */}
          <TabsContent value="create">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Crear Nueva Búsqueda</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateSearch} className="space-y-6">
                  {/* Nombre de búsqueda */}
                  <div className="space-y-2">
                    <Label htmlFor="search_name" className="text-slate-200">
                      Nombre de la búsqueda
                    </Label>
                    <Input
                      id="search_name"
                      placeholder="ej: consultores_energía_españa"
                      value={formData.search_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          search_name: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Sector */}
                    <div className="space-y-2">
                      <Label htmlFor="sector" className="text-slate-200">
                        Sector
                      </Label>
                      <Select
                        value={formData.sector}
                        onValueChange={(value) =>
                          setFormData({ ...formData, sector: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="energía">Energía</SelectItem>
                          <SelectItem value="consultoría">Consultoría</SelectItem>
                          <SelectItem value="tech">Tech/Software</SelectItem>
                          <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Años mínimos */}
                    <div className="space-y-2">
                      <Label htmlFor="years_min" className="text-slate-200">
                        Años mínimos de experiencia
                      </Label>
                      <Input
                        id="years_min"
                        type="number"
                        min="1"
                        value={formData.years_min}
                        onChange={(e) =>
                          setFormData({ ...formData, years_min: e.target.value })
                        }
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-2">
                    <Label htmlFor="keywords" className="text-slate-200">
                      Palabras clave (separadas por coma)
                    </Label>
                    <Input
                      id="keywords"
                      placeholder="ej: consultor, energía solar, sostenibilidad"
                      value={formData.keywords}
                      onChange={(e) =>
                        setFormData({ ...formData, keywords: e.target.value })
                      }
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                  </div>

                  {/* Ubicación */}
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-slate-200">
                      Ubicación (opcional)
                    </Label>
                    <Input
                      id="location"
                      placeholder="ej: España, Barcelona"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando búsqueda...
                      </>
                    ) : (
                      "Iniciar Búsqueda"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TAB: BÚSQUEDAS ANTERIORES === */}
          <TabsContent value="history">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Historial de Búsquedas</CardTitle>
                <Button
                  onClick={loadSearches}
                  variant="outline"
                  className="text-white border-slate-600"
                >
                  Refrescar
                </Button>
              </CardHeader>
              <CardContent>
                {searches.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">
                    No hay búsquedas aún
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Nombre</TableHead>
                        <TableHead className="text-slate-300">Estado</TableHead>
                        <TableHead className="text-slate-300 text-right">
                          Contactos
                        </TableHead>
                        <TableHead className="text-slate-300 text-right">
                          Duplicados
                        </TableHead>
                        <TableHead className="text-slate-300">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searches.map((search) => (
                        <TableRow key={search.id} className="border-slate-700">
                          <TableCell className="text-white font-medium">
                            {search.name}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(search.status)}
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            {search.total_contacts_created}
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            {search.total_duplicates_found}
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => loadContactsForSearch(search.id)}
                              variant="outline"
                              size="sm"
                              className="text-white border-slate-600"
                            >
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* === TABLA DE CONTACTOS === */}
            {selectedSearch && contacts.length > 0 && (
              <Card className="bg-slate-800 border-slate-700 mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-white">
                    Contactos Encontrados ({contacts.length})
                  </CardTitle>
                  <Button
                    onClick={downloadCSV}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Nombre</TableHead>
                          <TableHead className="text-slate-300">Puesto</TableHead>
                          <TableHead className="text-slate-300">Empresa</TableHead>
                          <TableHead className="text-slate-300">Ubicación</TableHead>
                          <TableHead className="text-slate-300 text-right">
                            Años
                          </TableHead>
                          <TableHead className="text-slate-300 text-right">
                            Confianza
                          </TableHead>
                          <TableHead className="text-slate-300">Enlace</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((contact) => (
                          <TableRow key={contact.id} className="border-slate-700">
                            <TableCell className="text-white font-medium">
                              {contact.name}
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {contact.job_title}
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {contact.company}
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {contact.location}
                            </TableCell>
                            <TableCell className="text-right text-slate-300">
                              {contact.years_experience}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-green-400">
                                {(contact.confidence_score * 100).toFixed(0)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <a
                                href={contact.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline"
                              >
                                Ver
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
