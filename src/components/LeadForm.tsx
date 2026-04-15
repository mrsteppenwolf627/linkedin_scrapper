"use client";

import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./ui/card";

export interface LeadData {
  name: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  linkedin_url: string;
  profile_snippet: string;
  your_product: string;
}

interface LeadFormProps {
  onSubmit: (data: LeadData) => void;
  isLoading?: boolean;
}

export function LeadForm({ onSubmit, isLoading = false }: LeadFormProps) {
  const [formData, setFormData] = useState<LeadData>({
    name: "",
    title: "",
    company: "",
    industry: "",
    location: "",
    linkedin_url: "",
    profile_snippet: "",
    your_product: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Generador de Mensajes</CardTitle>
        <CardDescription>
          Introduce los datos del lead para generar mensajes de outreach personalizados.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="Ej: Juan García" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Cargo (Title)</Label>
              <Input id="title" name="title" value={formData.title} onChange={handleChange} required placeholder="Ej: Sales Manager" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input id="company" name="company" value={formData.company} onChange={handleChange} required placeholder="Ej: TechCorp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Sector (Industry)</Label>
              <Input id="industry" name="industry" value={formData.industry} onChange={handleChange} placeholder="Ej: SaaS" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input id="location" name="location" value={formData.location} onChange={handleChange} placeholder="Ej: Barcelona" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">URL de LinkedIn</Label>
              <Input id="linkedin_url" type="url" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} placeholder="https://linkedin.com/in/..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="your_product">Tu Producto/Servicio</Label>
            <Input id="your_product" name="your_product" value={formData.your_product} onChange={handleChange} required placeholder="Ej: AI Sales Automation" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile_snippet">Extracto del Perfil (Snippet)</Label>
            <textarea
              id="profile_snippet"
              name="profile_snippet"
              value={formData.profile_snippet}
              onChange={handleChange}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Información relevante del perfil..."
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Generando..." : "Generar Mensajes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
