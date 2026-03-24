/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SEARCH_API_KEY: process.env.NEXT_PUBLIC_SEARCH_API_KEY,
  },
  // Necesario para que el orquestador no haga timeout en Vercel
  // Las búsquedas pueden tardar varios minutos
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
