/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necesario para que el orquestador no haga timeout en Vercel
  // Las búsquedas pueden tardar varios minutos
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
