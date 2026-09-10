import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // jsdom + readability are server-only and must not be bundled for the browser.
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
  // Declare the "@/" alias to webpack directly; tsconfig paths alone did not
  // resolve for every route in this project layout.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@": root };
    return config;
  },
};

export default nextConfig;
