/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy API to backend so network clients (same WiFi) use same origin
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: 'http://127.0.0.1:8000/api/v1/:path*/' },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig
