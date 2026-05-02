# AUD-002 — Admin Panel Authentication

## What was done

Implemented HTTP Basic Auth via **Vercel Edge Middleware** (`middleware.js` at project root).
Every request to `/admin` or `/admin/**` is intercepted *before* the static HTML is served.
Unauthenticated requests receive HTTP 401 + `WWW-Authenticate: Basic` — the browser shows its
native credential dialog. The panel HTML is never transmitted to anonymous users.

The public footer link `Admin` was removed from `index.html` to reduce enumeration.

## Credential configuration (NOT in repo)

| Setting | Value |
|---------|-------|
| Vercel environment variable | `ADMIN_PASS` (required) |
| Username variable | `ADMIN_USER` (optional, defaults to `alvaro`) |
| Where to set | Vercel dashboard → Project → Settings → Environment Variables |
| Scope | Production + Preview (add to both if needed) |

After adding the variables, trigger a new deployment (push any commit or
use "Redeploy" in the Vercel dashboard).

## Admin URL

```
https://anrealestate.es/admin/index.html
```

Use a browser bookmark or direct URL. The link is no longer in the public footer.

## visit.html flow

Links of the form `/admin/index.html?visit=<id>` continue to work unchanged:
the middleware passes authenticated requests through without altering the URL,
so `?visit=` query strings are processed by the panel's existing JS as before.

## Verification checklist (AUD-002)

- [ ] Without credentials: `GET https://anrealestate.es/admin/index.html` returns **401**,
      browser shows Basic Auth dialog, zero HTML panel content delivered.
- [ ] With correct `ADMIN_USER` / `ADMIN_PASS`: panel loads and internal JS login
      (hash-based, still present) can optionally be left as a second factor or removed.
- [ ] visit link `https://anrealestate.es/admin/index.html?visit=TEST` → after auth,
      panel loads and `?visit=TEST` is readable by admin.js.
- [ ] `https://anrealestate.es/` public footer: **no Admin link**.
- [ ] All `/api/**` routes unaffected (middleware matcher is `/admin/**` only).

## Remaining (phase 2, out of scope)

- Replace the client-side SHA-256 hash (`ADMIN_PWD_HASH` in `admin.js`) with a
  server-side auth token issued by a Vercel Function, eliminating the public JS secret.
  Until then, the Edge Middleware layer is the real security boundary.
