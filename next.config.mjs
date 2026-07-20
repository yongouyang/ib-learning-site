/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the Next.js Dev Tools button in dev — it overlays the mobile bottom
  // nav and collides with e2e locators (Next 15.2+ supports disabling it).
  devIndicators: false,
};

export default nextConfig;
