'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface MeResponse {
  user: {
    id: string
    email: string
    role: 'admin' | 'user'
    status: 'approved' | 'pending_approval' | 'rejected'
  }
}

export default function DashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        })

        if (!response.ok) {
          router.push('/login')
          return
        }

        const data = (await response.json()) as MeResponse
        setIsAdmin(data.user?.role === 'admin')
        setUserEmail(data.user?.email || '')
      } catch {
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    void checkAdminStatus()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0EDE4]">
        <p className="text-[#1A1A1A]">Cargando...</p>
      </div>
    )
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
          <a href="/api/auth/logout">
            <button className="text-sm font-bold text-[#1A1A1A] border border-[#1A1A1A] px-4 py-2 hover:bg-[#F5F5F5] transition">
              LOGOUT
            </button>
          </a>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* HEADER */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-[#1A1A1A] mb-2 italic uppercase">
            Bienvenido, {userEmail.split('@')[0]}
          </h1>
          <p className="text-base text-[#1A1A1A] uppercase tracking-wide">
            Gestiona tus búsquedas, mensajes y usuarios
          </p>
        </header>

        {/* GRID 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Card 1: BUSCADOR */}
          <a href="/dashboard/search">
            <div className="border border-[#1A1A1A] p-8 hover:bg-[#F5F5F5] cursor-pointer transition">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🔍</span>
                <h2 className="text-2xl font-bold text-[#1A1A1A] uppercase">Buscador</h2>
              </div>
              <p className="text-base text-[#1A1A1A] mb-8 leading-relaxed">
                Busca perfiles en LinkedIn y encuentra prospectivos para tus campañas
              </p>
              <button className="w-full bg-[#D94F00] text-white px-6 py-3 font-bold text-sm uppercase hover:brightness-90 transition">
                Buscar
              </button>
            </div>
          </a>

          {/* Card 2: MIS BÚSQUEDAS */}
          <a href="/dashboard/searches">
            <div className="border border-[#1A1A1A] p-8 hover:bg-[#F5F5F5] cursor-pointer transition">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">📋</span>
                <h2 className="text-2xl font-bold text-[#1A1A1A] uppercase">Mis Búsquedas</h2>
              </div>
              <p className="text-base text-[#1A1A1A] mb-8 leading-relaxed">
                Ve tus búsquedas guardadas y comienza a generar mensajes personalizados
              </p>
              <button className="w-full bg-[#D94F00] text-white px-6 py-3 font-bold text-sm uppercase hover:brightness-90 transition">
                Ver
              </button>
            </div>
          </a>

          {/* Card 3: GENERADOR */}
          <a href="/dashboard/searches">
            <div className="border border-[#1A1A1A] p-8 hover:bg-[#F5F5F5] cursor-pointer transition">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">💬</span>
                <h2 className="text-2xl font-bold text-[#1A1A1A] uppercase">Generador</h2>
              </div>
              <p className="text-base text-[#1A1A1A] mb-8 leading-relaxed">
                Crea mensajes personalizados con IA (3 variantes por lead)
              </p>
              <button className="w-full bg-[#4A7C59] text-white px-6 py-3 font-bold text-sm uppercase hover:brightness-90 transition">
                Generar
              </button>
            </div>
          </a>

          {/* Card 4: HUB DE MENSAJES */}
          <a href="/dashboard/messages">
            <div className="border border-[#1A1A1A] p-8 hover:bg-[#F5F5F5] cursor-pointer transition">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">📧</span>
                <h2 className="text-2xl font-bold text-[#1A1A1A] uppercase">Hub de Mensajes</h2>
              </div>
              <p className="text-base text-[#1A1A1A] mb-8 leading-relaxed">
                Visualiza tus mensajes generados, cópialos y gestiona tus lotes
              </p>
              <button className="w-full bg-[#4A7C59] text-white px-6 py-3 font-bold text-sm uppercase hover:brightness-90 transition">
                Ver
              </button>
            </div>
          </a>
        </div>

        {/* ADMIN SECTION */}
        {isAdmin && (
          <section className="border-t border-[#1A1A1A] pt-12">
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-8 uppercase">Herramientas Admin</h2>
            <a href="/dashboard/users">
              <div className="border border-[#1A1A1A] p-8 hover:bg-[#F5F5F5] cursor-pointer transition">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">⚙️</span>
                  <h3 className="text-2xl font-bold text-[#1A1A1A] uppercase">Gestionar Usuarios</h3>
                </div>
                <p className="text-base text-[#1A1A1A] mb-8 leading-relaxed">
                  Aprueba/rechaza usuarios, gestiona roles y permisos del sistema
                </p>
                <button className="w-full bg-[#D94F00] text-white px-6 py-3 font-bold text-sm uppercase hover:brightness-90 transition">
                  Gestionar
                </button>
              </div>
            </a>
          </section>
        )}
      </div>
    </div>
  )
}
