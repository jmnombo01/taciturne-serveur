/** @type {import('next').NextConfig} */
// Le navigateur appelle /backend/* (même origine) → le serveur Next proxifie
// vers le backend. Par défaut : le serveur de démo permanent sur Render.
// Surcharge possible via NEXT_BACKEND_URL (local : http://localhost:3000).
const backend = process.env.NEXT_BACKEND_URL || 'https://taciturne-serveur.onrender.com';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // image Docker minimale (server.js autonome)
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${backend}/:path*` }];
  },
};
export default nextConfig;
