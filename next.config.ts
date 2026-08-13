import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },

  // ADD THIS: Prevent Next.js from breaking Puppeteer and Clipboardy during bundling
  serverExternalPackages: [
    'puppeteer-extra', 
    'puppeteer-extra-plugin-stealth', 
    'puppeteer', 
    'clipboardy'
  ],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;