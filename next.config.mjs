const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Statische Seite für GitHub Pages (kein Server nötig)
  output: "export",
  basePath: isProd ? "/Wyler-Bets" : "",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
