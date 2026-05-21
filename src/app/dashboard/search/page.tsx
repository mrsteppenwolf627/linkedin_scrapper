'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function SearchPage() {
  const [jobTitle, setJobTitle] = useState('')
  const [experience, setExperience] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [maxResults, setMaxResults] = useState('100')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? '',
        },
        body: JSON.stringify({
          job_title: jobTitle,
          experience,
          industry,
          location,
          max_results: parseInt(maxResults),
        }),
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`)
      }

      toast.success('Búsqueda iniciada correctamente')
      setJobTitle('')
      setExperience('')
      setIndustry('')
      setLocation('')
      setMaxResults('100')
    } catch (error) {
      console.error(error)
      toast.error('Error al iniciar la búsqueda')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-[#F0EDE4] min-h-screen">
      {/* NAVBAR */}
      <nav className="border-b border-[#1A1A1A] bg-[#F0EDE4] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <h1 className="text-xl font-bold text-[#1A1A1A] uppercase tracking-wide">
              LinkedIn Scraper
            </h1>
          </div>
          <Link href="/dashboard">
            <button className="text-sm font-bold text-[#1A1A1A] border border-[#1A1A1A] px-4 py-2 hover:bg-[#F5F5F5] transition">
              VOLVER
            </button>
          </Link>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-[#1A1A1A] mb-2 italic uppercase">
            🔍 Nueva Búsqueda
          </h1>
          <p className="text-base text-[#1A1A1A] uppercase tracking-wide">
            Define los criterios para buscar perfiles en LinkedIn
          </p>
        </header>

        <form onSubmit={handleSubmit} className="border border-[#1A1A1A] p-8 space-y-6">
          {/* Job Title */}
          <div>
            <label className="text-sm font-bold text-[#1A1A1A] uppercase block mb-2">
              Título del Puesto *
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ej: Product Manager, Marketing Director"
              required
              className="w-full border border-[#1A1A1A] px-4 py-3 text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D94F00]"
            />
          </div>

          {/* Experience */}
          <div>
            <label className="text-sm font-bold text-[#1A1A1A] uppercase block mb-2">
              Años de Experiencia
            </label>
            <input
              type="text"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Ej: 5+, 3-7, junior, senior"
              className="w-full border border-[#1A1A1A] px-4 py-3 text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D94F00]"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="text-sm font-bold text-[#1A1A1A] uppercase block mb-2">
              Industria
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Ej: Software, Fintech, SaaS"
              className="w-full border border-[#1A1A1A] px-4 py-3 text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D94F00]"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-sm font-bold text-[#1A1A1A] uppercase block mb-2">
              Ubicación
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: Spain, Madrid, USA"
              className="w-full border border-[#1A1A1A] px-4 py-3 text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D94F00]"
            />
          </div>

          {/* Max Results */}
          <div>
            <label className="text-sm font-bold text-[#1A1A1A] uppercase block mb-2">
              Máximo de Resultados
            </label>
            <input
              type="number"
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              min="1"
              max="1000"
              className="w-full border border-[#1A1A1A] px-4 py-3 text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D94F00]"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !jobTitle.trim()}
            className="w-full bg-[#D94F00] text-white px-6 py-4 font-bold text-sm uppercase hover:brightness-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Buscando...
              </>
            ) : (
              '🔍 Buscar Perfiles'
            )}
          </button>
        </form>

        <div className="mt-8 p-6 border border-[#4A7C59] bg-white">
          <p className="text-sm text-[#1A1A1A] leading-relaxed">
            <span className="font-bold">💡 Consejo:</span> Completa al menos el título del puesto. Los demás campos son opcionales para refinar la búsqueda. Cuantos más criterios, más precisa será la búsqueda.
          </p>
        </div>
      </div>
    </div>
  )
}
