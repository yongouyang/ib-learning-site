// Static export (S3 + CloudFront, aws-deployment-plan.md §3) is gated on
// BUILD_EXPORT=1 so dev/e2e builds are unchanged. Only `npm run build:static`
// sets it — the script also stashes src/app/api aside, because `output:
// 'export'` rejects the non-static /api/feedback route handler. Production
// feedback is the Lambda behind the CloudFront /api/* behavior; the Next
// route remains the dev/e2e path.
// URLs stay extensionless (Next default: about-style `page.html` files) so
// app URLs and e2e assertions are identical in dev and export; CloudFront
// maps /foo → /foo.html via a Function (Session 2), mirrored locally by
// scripts/serve-static.ts.
const isExport = process.env.BUILD_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the Next.js Dev Tools button in dev — it overlays the mobile bottom
  // nav and collides with e2e locators (Next 15.2+ supports disabling it).
  devIndicators: false,
  ...(isExport ? { output: 'export' } : {}),
};

export default nextConfig;
