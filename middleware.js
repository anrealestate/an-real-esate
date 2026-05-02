/**
 * Vercel Edge Middleware — Basic Auth guard for /admin/**
 *
 * Environment variables (set in Vercel → Settings → Environment Variables):
 *   ADMIN_USER  optional, defaults to "alvaro"
 *   ADMIN_PASS  REQUIRED — set a strong password, never commit it
 *
 * Works on all Vercel plans (Edge Middleware is not a Pro feature).
 * Runs before static file serving, so /admin/** is never served to
 * unauthenticated requests — the HTML never reaches the browser.
 */

export const config = {
  matcher: ['/admin', '/admin/:path*']
}

export default function middleware(request) {
  const expectedUser = process.env.ADMIN_USER ?? 'alvaro'
  const expectedPass = process.env.ADMIN_PASS

  if (!expectedPass) {
    return new Response(
      'Admin access is not configured.\n' +
      'Add ADMIN_PASS in Vercel → Project → Settings → Environment Variables,\n' +
      'then redeploy.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    )
  }

  const auth = request.headers.get('Authorization') ?? ''
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6))
      const sep     = decoded.indexOf(':')
      if (sep !== -1) {
        const user = decoded.slice(0, sep)
        const pass = decoded.slice(sep + 1)
        if (user === expectedUser && pass === expectedPass) {
          return // authenticated — Vercel serves the requested static file
        }
      }
    } catch {
      // malformed base64 — fall through to challenge
    }
  }

  return new Response('🔒 Área restringida — AN Real Estate Admin', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="AN Real Estate Admin", charset="UTF-8"',
      'Content-Type':     'text/plain; charset=utf-8',
      'Cache-Control':    'no-store'
    }
  })
}
