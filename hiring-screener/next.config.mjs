/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (via pdfjs-dist) breaks its own Node-environment detection when
  // webpack bundles it — it ends up assuming a browser DOM (DOMMatrix etc.) is
  // available and crashes. Keeping it external forces a plain runtime `require`,
  // which is how it works correctly outside of Next's bundler.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "@napi-rs/canvas"],
  },
};

export default nextConfig;
