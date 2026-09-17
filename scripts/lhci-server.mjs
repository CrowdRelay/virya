/**
 * Minimal static file server for Lighthouse CI.
 *
 * Serves dist/ (the prerendered public pages) with the same headers as
 * production so Best Practices audits (CSP, COOP, X-Frame-Options) measure
 * the real policy instead of a friendlier test double. Skipped audits in
 * lighthouserc.json: is-on-https and redirects-http (this is HTTP, not
 * HTTPS), and errors-in-console — the public tenant-config fetch is
 * CORS-rejected from localhost, an artifact of the audit origin, not the page.
 *
 * Fidelity notes (learned the hard way on crowdrelay-landing — an unfaithful
 * server turned a perfect production score into local noise):
 *   - Responses are brotli/gzip compressed like Netlify's edge.
 *   - Cache-Control mirrors netlify.toml and public/_headers.
 *   - Security headers are parsed out of public/_headers at startup — that
 *     file is the single source of truth, so this server cannot drift from it.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DIST = join(ROOT, 'dist')
const PORT = 4173

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.vtt': 'text/vtt',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
}

// Text types Netlify compresses on the wire. Everything else is already a
// compressed container format.
const COMPRESSIBLE = new Set([
  '.html', '.js', '.css', '.json', '.svg', '.txt', '.xml', '.vtt', '.webmanifest',
])

// Parse the wildcard `/*` block out of public/_headers — the site's single
// source of truth for security headers — into a {name: value} map. Path-scoped
// overrides (merch CSP, tickets no-store) don't apply to the audited routes.
async function loadHeaders() {
  const raw = await readFile(join(ROOT, 'public/_headers'), 'utf8')
  const headers = {}
  let inWildcard = false
  for (const line of raw.split('\n')) {
    if (/^\S/.test(line)) inWildcard = line.trim() === '/*'
    else if (inWildcard) {
      const match = line.match(/^\s+([A-Za-z-]+):\s*(.+?)\s*$/)
      if (match) headers[match[1]] = match[2]
    }
  }
  if (!headers['Content-Security-Policy']) {
    throw new Error('lhci-server: no CSP found in public/_headers /* block')
  }
  return headers
}

// Mirror netlify.toml so cache audits see the real policy: content-hashed
// build assets are immutable for a year, named media is 7d + SWR, prerendered
// documents revalidate.
const MEDIA_CACHE = 'public, max-age=604800, stale-while-revalidate=604800'
const DOC_CACHE = 'public, s-maxage=31536000, max-age=0, must-revalidate'
const cacheFor = (path) => {
  if (path.startsWith('/_astro/')) return 'public, max-age=31536000, immutable'
  if (/\.(webp|mp4|webm)$/.test(path)) return MEDIA_CACHE
  if (/^\/(covers|images|resp)\//.test(path)) return MEDIA_CACHE
  if (path.endsWith('/') || path.endsWith('.html')) return DOC_CACHE
  return 'public, max-age=0, must-revalidate'
}

const HEADERS = await loadHeaders()

createServer(async (req, res) => {
  let path
  try {
    path = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname)
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...HEADERS })
    res.end('Bad request')
    return
  }
  // CI-only server, but keep the traversal guard anyway — malformed or
  // dot-segment paths get a 404, never a read outside dist/.
  if (path.split('/').includes('..')) {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...HEADERS })
    res.end('Not found')
    return
  }
  if (path === '/') path = '/index.html'
  if (!path.endsWith('.html') && !MIME[path.slice(path.lastIndexOf('.'))]) {
    path = join(path, 'index.html')
  }

  try {
    const ext = path.slice(path.lastIndexOf('.'))
    let data = await readFile(join(DIST, path))
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheFor(path),
      ...HEADERS,
    }
    if (COMPRESSIBLE.has(ext)) {
      const enc = req.headers['accept-encoding'] ?? ''
      if (enc.includes('br')) {
        data = brotliCompressSync(data)
        headers['Content-Encoding'] = 'br'
      } else if (enc.includes('gzip')) {
        data = gzipSync(data)
        headers['Content-Encoding'] = 'gzip'
      }
    }
    res.writeHead(200, headers)
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...HEADERS })
    res.end('Not found')
  }
}).listen(PORT, () => {
  console.log(`LHCI server ready on :${PORT}`)
})
