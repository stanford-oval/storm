/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // swcMinify is now the default in Next.js 15, no longer needed
  images: {
    domains: ['localhost'],
  },
  // Fix workspace root detection
  outputFileTracingRoot: require('path').join(__dirname, '../../'),
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add any custom webpack config here
    return config;
  },
};

module.exports = nextConfig;
