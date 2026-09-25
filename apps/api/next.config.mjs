/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, x-naturalwrite-key" },
          { key: "Access-Control-Expose-Headers", value: "Content-Disposition, X-HumanizerDad-Report" },
          { key: "Access-Control-Allow-Private-Network", value: "true" },
        ],
      },
    ];
  },
};

export default nextConfig;
