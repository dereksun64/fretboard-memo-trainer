import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Social previews need absolute URLs. Use SITE_URL if set (e.g. a custom
 * domain), else Vercel's production domain, else leave paths relative.
 */
function siteUrl(): Plugin {
  const url =
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', url.replace(/\/$/, '')),
  }
}

export default defineConfig({
  plugins: [react(), siteUrl()],
})
