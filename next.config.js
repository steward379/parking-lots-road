/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['maps.googleapis.com'],
  },
  webpack: (config) => {
    config.externals = [...config.externals, 'google'];
    return config;
  },
}

module.exports = nextConfig