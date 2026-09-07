import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // API query parameters identify projects, products, revisions and
        // draft requests. Netlify's Next adapter otherwise varies only on
        // framework query parameters, allowing unrelated responses to collide.
        source: "/api/:path*",
        headers: [{ key: "Netlify-Vary", value: "query" }],
      },
    ];
  },
};

export default nextConfig;
