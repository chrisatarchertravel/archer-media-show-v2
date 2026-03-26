/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required when running behind a custom server.js
  // Disables Next.js's built-in server so our server.js takes over
  experimental: {
    serverComponentsExternalPackages: ['voicemeeter-connector', 'atem-connection'],
  },
}

module.exports = nextConfig
