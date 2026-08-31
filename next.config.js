/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // WebMCP requires a secure context (HTTPS) in real browsers.
  // Deploy behind HTTPS (Vercel does this by default) for the origin trial to work.
};

module.exports = nextConfig;
