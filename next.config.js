/** @type {import('next').NextConfig} */
const nextConfig = {
  // Convex handles API routes via their own server
  // No additional config needed for basic setup
  
  // Server configuration for production
  serverActions: {
    bodySizeLimit: '2mb',
  },
  
  // Enable CORS headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  
  // Redirects for API routes
  async redirects() {
    return [
      // Handle OPTIONS requests for CORS preflight
    ];
  },
};

module.exports = nextConfig;
